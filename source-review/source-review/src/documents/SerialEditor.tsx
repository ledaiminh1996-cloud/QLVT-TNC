import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ArrowDownAZ,
  Undo2,
  ClipboardPaste,
  Plus,
  Loader2,
} from "lucide-react";
import {
  lineSerials,
  serialKey,
  serialFormatError,
  MAX_SERIALS_PER_LINE,
} from "../../shared/documentSerials";
import type { DraftLine } from "../../shared/documents";
import type { DocumentClient } from "./documentClient";
import { stockStates } from "../../shared/documents";
import { docInput, docButton } from "./CatalogPicker";
import { accessMessage } from "../api/catalogClient";
type SerialRow = { id: string; value: string };
const entries = (values: string[]): SerialRow[] =>
  values.map((value) => ({ id: crypto.randomUUID(), value }));
const serialOrder = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
}).compare;
const split = (raw: string) =>
  raw
    .split(/[\r\n\t]+/)
    .map((v) => v.trim())
    .filter(Boolean);
export function SerialEditor({
  item,
  index,
  expected,
  otherLocations,
  disabled,
  onChange,
  documents,
  excludeDocument,
  title,
  onClose,
}: {
  item: DraftLine;
  index: number;
  expected: number | null;
  otherLocations?: Map<string, string[]>;
  disabled: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
  documents: DocumentClient;
  excludeDocument?: string;
  title: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() => entries(lineSerials(item))),
    [buffer, setBuffer] = useState(""),
    [search, setSearch] = useState(""),
    [stockState, setStockState] = useState(item.stock_state),
    [conflicts, setConflicts] = useState(new Set<string>()),
    [checked, setChecked] = useState(""),
    [checking, setChecking] = useState(false),
    [checkError, setCheckError] = useState(""),
    [inputError, setInputError] = useState(""),
    [undo, setUndo] = useState<{ rows: SerialRow[]; buffer: string }>();
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const root = useRef<HTMLElement>(null),
    input = useRef<HTMLInputElement>(null),
    initial = useRef(
      JSON.stringify({ values: lineSerials(item), state: item.stock_state }),
    );
  const values = rows.map((row) => row.value),
    signature = JSON.stringify(
      [
        ...new Set(
          values.filter((value) => !serialFormatError(value)).map(serialKey),
        ),
      ].sort(),
    ),
    dirty =
      !disabled &&
      (initial.current !== JSON.stringify({ values, state: stockState }) ||
        !!buffer.trim());
  const groups = useMemo(() => {
    const map = new Map<string, number[]>();
    rows.forEach((row, pos) => {
      const key = serialKey(row.value);
      map.set(key, [...(map.get(key) ?? []), pos + 1]);
    });
    return map;
  }, [rows]);
  const checks = rows.map((row) => {
    const key = serialKey(row.value),
      local = groups.get(key) ?? [],
      external = otherLocations?.get(item.part_id + ":" + key) ?? [];
    const format = serialFormatError(row.value);
    return {
      format,
      duplicate: local.length > 1 || external.length > 0,
      stock: conflicts.has(key),
      detail:
        format ||
        (local.length > 1 ? "Trùng tại STT " + local.join(", ") : "") +
          (external.length
            ? (local.length > 1 ? "; " : "") + "Trùng " + external.join("; ")
            : "") ||
        (conflicts.has(key) ? "Serial đã tồn tại trong kho" : ""),
    };
  });
  const duplicates = checks.filter((c) => c.duplicate || c.stock).length,
    invalid = checks.filter((c) => !!c.format).length,
    complete =
      expected !== null &&
      values.length === expected &&
      !duplicates &&
      !invalid,
    progress =
      expected && expected > 0
        ? Math.min(100, (values.length / expected) * 100)
        : 0;
  const status =
    expected === null
      ? "Chưa có số lượng"
      : values.length > expected
        ? "Thừa " + (values.length - expected)
        : values.length < expected
          ? "Thiếu " + (expected - values.length)
          : duplicates || invalid
            ? "Cần kiểm tra"
            : "Đủ";
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const parents = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ).filter((node) => !node.hasAttribute("data-serial-drawer"));
    const saved = parents.map((node) => ({
      node,
      inert: node.getAttribute("inert"),
      hidden: node.getAttribute("aria-hidden"),
    }));

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (disabled
      ? root.current?.querySelector<HTMLButtonElement>("button")
      : input.current
    )?.focus();
    saved.forEach(({ node }) => {
      node.setAttribute("inert", "");
      node.setAttribute("aria-hidden", "true");
    });
    return () => {
      saved.forEach(({ node, inert, hidden }) => {
        if (inert === null) node.removeAttribute("inert");
        else node.setAttribute("inert", inert);
        if (hidden === null) node.removeAttribute("aria-hidden");
        else node.setAttribute("aria-hidden", hidden);
      });
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            "button[data-serial-line]",
          ),
        )
          .find((b) => b.dataset.serialLine === item.id)
          ?.focus();
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setCheckError("");
    setConflicts(new Set());
    setChecked("");
    const valid = [
      ...new Map(
        values
          .filter((v) => !serialFormatError(v))
          .map((v) => [serialKey(v), v]),
      ).values(),
    ];
    if (disabled || !valid.length) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const found: string[] = [];
        for (let start = 0; start < valid.length; start += 50)
          found.push(
            ...(await documents.checkSerials(
              item.part_id,
              valid.slice(start, start + 50),
              controller.signal,
              excludeDocument,
            )),
          );
        if (!controller.signal.aborted) {
          setConflicts(new Set(found.map(serialKey)));
          setChecked(signature);
        }
      } catch (e) {
        if (!controller.signal.aborted) setCheckError(accessMessage(e));
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [documents, item.part_id, signature, excludeDocument, disabled]);
  function cancel() {
    if (!dirty || window.confirm("Bỏ thay đổi serial chưa áp dụng vào phiếu?"))
      onClose();
  }
  function change(next: SerialRow[]) {
    rowsRef.current = next;
    setRows(next);
    setUndo(undefined);
    setInputError("");
  }
  function append(raw: string) {
    if (!root.current) return false;
    const current = rowsRef.current;
    const added = split(raw);
    if (!added.length) return true;
    if (current.length + added.length > MAX_SERIALS_PER_LINE) {
      setInputError(
        "Tối đa 500 serial mỗi dòng. Danh sách vừa dán chưa được thêm.",
      );
      return false;
    }
    change([...current, ...entries(added)]);
    setBuffer("");
    input.current?.focus();
    return true;
  }
  function done() {
    if (disabled) {
      onClose();
      return;
    }
    const pending = split(buffer);
    if (rows.length + pending.length > MAX_SERIALS_PER_LINE) {
      setInputError("Tối đa 500 serial mỗi dòng.");
      return;
    }
    onChange({
      serial: "",
      serials: [...values, ...pending],
      stock_state: stockState,
    });
    onClose();
  }
  function trap(event: React.KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    if (event.key === "Tab") {
      const nodes = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
          ) ?? [],
        ),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  const visible = rows
    .map((row, pos) => ({ row, pos }))
    .filter(
      ({ row }) =>
        !search.trim() || serialKey(row.value).includes(serialKey(search)),
    );
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-slate-900/30"
      onKeyDown={trap}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0" aria-hidden="true" onClick={cancel} />
      <style>
        {
          "@keyframes serial-drawer-enter{from{transform:translateX(100%)}to{transform:translateX(0)}}"
        }
      </style>
      <aside
        ref={root}
        data-serial-drawer
        role="dialog"
        aria-modal="true"
        aria-label={"Serial dòng " + (index + 1)}
        className="relative flex h-[100dvh] w-full max-w-[540px] flex-col border-l border-slate-200 bg-white text-slate-900 shadow-2xl motion-safe:animate-[serial-drawer-enter_160ms_ease-out]"
      >
        <header className="shrink-0 space-y-3 border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold">Serial vật tư</h3>
              <p
                className="mt-1 break-words text-sm font-semibold"
                title={title}
              >
                {title}
              </p>
            </div>
            <button
              type="button"
              className={docButton + " shrink-0 !px-2"}
              aria-label="Đóng ngăn serial"
              onClick={cancel}
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="flex flex-wrap items-center gap-3 text-xs tabular-nums"
            aria-live="polite"
          >
            <span>
              Cần nhập: <strong>{expected ?? "—"}</strong>
            </span>
            <span>
              Đã nhập: <strong>{values.length}</strong>
            </span>
            <span
              className={
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " +
                (complete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800")
              }
            >
              {complete ? (
                <CheckCircle2 size={13} />
              ) : (
                <AlertTriangle size={13} />
              )}
              {status}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Tiến độ nhập serial"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={values.length + "/" + (expected ?? "—")}
            className="h-1.5 overflow-hidden rounded bg-slate-100"
          >
            <div
              className={
                "h-full " + (complete ? "bg-emerald-500" : "bg-blue-500")
              }
              style={{ width: progress + "%" }}
            />
          </div>
        </header>
        <div className="shrink-0 space-y-2 border-b border-slate-200 px-4 py-3">
          {!disabled && (
            <>
              <div className="flex gap-2">
                <input
                  ref={input}
                  aria-label={"Nhập nhanh serial dòng " + (index + 1)}
                  placeholder="Dán/gõ serial, Enter để thêm…"
                  className={docInput + " min-w-0 flex-1 font-mono"}
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.stopPropagation();
                      append(buffer);
                    }
                  }}
                  onPaste={(e) => {
                    const raw = e.clipboardData.getData("text");
                    if (/[\r\n\t]/.test(raw)) {
                      e.preventDefault();
                      append([buffer, raw].filter(Boolean).join("\n"));
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label="Thêm serial"
                  className={docButton + " !px-2"}
                  disabled={!buffer.trim()}
                  onClick={() => append(buffer)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={docButton + " !min-h-8 !px-2 text-xs"}
                  onClick={async () => {
                    try {
                      if (!navigator.clipboard?.readText) {
                        input.current?.focus();
                        setInputError(
                          "Nhấn Ctrl+V tại ô nhập nhanh để dán từ Excel.",
                        );
                        return;
                      }
                      const raw = await navigator.clipboard.readText();
                      append(
                        [input.current?.value ?? buffer, raw]
                          .filter(Boolean)
                          .join("\n"),
                      );
                    } catch {
                      input.current?.focus();
                      setInputError(
                        "Nhấn Ctrl+V tại ô nhập nhanh để dán từ Excel.",
                      );
                    }
                  }}
                >
                  <ClipboardPaste size={14} />
                  Dán từ Excel
                </button>
                <button
                  type="button"
                  className={docButton + " !min-h-8 !px-2 text-xs"}
                  disabled={rows.length < 2}
                  onClick={() =>
                    change(
                      [...rows].sort((a, b) => serialOrder(a.value, b.value)),
                    )
                  }
                >
                  <ArrowDownAZ size={14} />
                  Sắp xếp
                </button>
              </div>
            </>
          )}
          <input
            aria-label={"Tìm serial dòng " + (index + 1)}
            placeholder="Tìm serial…"
            className={docInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex justify-between gap-2 text-[11px] text-slate-500">
            <span>
              {search.trim()
                ? `Hiển thị ${visible.length}/${rows.length} serial`
                : "Mỗi serial một dòng; hỗ trợ dán nhiều dòng từ Excel."}
            </span>
            {checking && (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                Kiểm tra kho…
              </span>
            )}
          </div>
          {inputError && (
            <p role="alert" className="text-xs text-red-700">
              {inputError}
            </p>
          )}
          {checkError && (
            <p role="alert" className="text-xs text-amber-700">
              Chưa kiểm tra được kho: {checkError}. Máy chủ sẽ kiểm tra khi lưu
              phiếu.
            </p>
          )}
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          aria-label="Danh sách serial"
        >
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col style={{ width: 42 }} />
              <col style={{ width: "43%" }} />
              <col />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-right">STT</th>
                <th className="p-2">Serial</th>
                <th className="p-2">Trạng thái</th>
                <th className="p-2">
                  <span className="sr-only">Xóa</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, pos }) => {
                const c = checks[pos],
                  bad = !!c.detail,
                  pending = !disabled && (checking || checked !== signature);
                return (
                  <tr
                    key={row.id}
                    className={
                      "h-11 border-b border-slate-100 " +
                      (bad ? "bg-red-50/60" : "")
                    }
                  >
                    <td className="p-2 text-right tabular-nums text-slate-500">
                      {pos + 1}
                    </td>
                    <td className="p-2">
                      {disabled ? (
                        <span className="break-all font-mono">{row.value}</span>
                      ) : (
                        <input
                          aria-label={
                            "Serial #" + (pos + 1) + " dòng " + (index + 1)
                          }
                          title={row.value}
                          className={
                            "w-full min-w-0 rounded border px-1.5 py-1.5 font-mono outline-none focus:border-blue-500 " +
                            (bad
                              ? "border-red-300 bg-red-50"
                              : "border-transparent bg-transparent hover:border-slate-200")
                          }
                          value={row.value}
                          onChange={(e) =>
                            change(
                              rows.map((r) =>
                                r.id === row.id
                                  ? { ...r, value: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {bad ? (
                        <span
                          role="status"
                          title={c.detail}
                          className="inline-flex items-start gap-1 text-red-700"
                        >
                          <AlertTriangle
                            size={13}
                            className="mt-0.5 shrink-0"
                          />
                          <span>
                            {c.format
                              ? "Sai định dạng"
                              : c.stock
                                ? "Trùng trong kho"
                                : "Trùng serial"}
                            <small className="mt-0.5 block text-[10px] leading-tight">
                              {c.detail}
                            </small>
                          </span>
                        </span>
                      ) : pending || checkError ? (
                        <span className="text-slate-500">
                          {pending ? "Đang kiểm tra" : "Chưa kiểm tra kho"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={13} />
                          Hợp lệ
                        </span>
                      )}
                    </td>
                    <td className="p-1">
                      {!disabled && (
                        <button
                          type="button"
                          aria-label={"Xóa serial #" + (pos + 1)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() =>
                            change(rows.filter((r) => r.id !== row.id))
                          }
                        >
                          <X size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    {rows.length
                      ? "Không tìm thấy serial phù hợp."
                      : "Chưa có serial. Nhập hoặc dán vào ô phía trên."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 space-y-2 border-t border-slate-200 px-4 py-3">
          <label className="block text-xs font-semibold">
            Trạng thái hàng (chung cho dòng)
            <select
              className={docInput + " mt-1"}
              disabled={disabled}
              value={stockState}
              onChange={(e) =>
                setStockState(e.target.value as DraftLine["stock_state"])
              }
            >
              <option value="new">{stockStates.new}</option>
            </select>
          </label>
          {!disabled && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:text-slate-400"
                disabled={!rows.length && !buffer.trim()}
                onClick={() => {
                  if (
                    window.confirm(
                      "Xóa hết " + rows.length + " serial của dòng vật tư này?",
                    )
                  ) {
                    setUndo({ rows, buffer });
                    rowsRef.current = [];
                    setRows([]);
                    setBuffer("");
                    setInputError("");
                  }
                }}
              >
                <Trash2 size={13} />
                Xóa hết serial
              </button>
              {undo && (
                <button
                  type="button"
                  className={docButton + " !min-h-7 !px-2 text-xs"}
                  onClick={() => {
                    rowsRef.current = undo.rows;
                    setRows(undo.rows);
                    setBuffer(undo.buffer);
                    setUndo(undefined);
                  }}
                >
                  <Undo2 size={13} />
                  Hoàn tác
                </button>
              )}
            </div>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <span
            className={
              "text-xs " +
              (duplicates || invalid ? "text-red-700" : "text-slate-500")
            }
            aria-live="polite"
          >
            Lỗi: {duplicates} serial trùng · {invalid} sai định dạng
          </span>
          <div className="flex gap-2">
            {!disabled && (
              <button type="button" className={docButton} onClick={cancel}>
                Hủy
              </button>
            )}
            <button
              type="button"
              className={docButton + " !bg-blue-600 !text-white"}
              onClick={done}
            >
              {disabled ? "Đóng" : "Xong"}
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
