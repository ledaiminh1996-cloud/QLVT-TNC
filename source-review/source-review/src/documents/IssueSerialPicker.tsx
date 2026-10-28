import {money} from "./documentFormatting";
import { normalizeViNumber } from "../../shared/documentNumbers";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DocumentClient, DocumentPage } from "./documentClient";
import { docInput, docButton } from "./CatalogPicker";
import { accessMessage } from "../api/catalogClient";
import { serialKey } from "../../shared/documentSerials";
export function IssueSerialPicker({
  documents,
  recovery = false,
  businessAt,
  part,
  warehouse,
  state,
  quantity,
  values,
  used,
  label,
  disabled,
  onChange,
  onClose,
}: {
  documents: DocumentClient;
  recovery?: boolean;
  businessAt?:string;
  part: string;
  warehouse: string;
  state: string;
  quantity: string;
  values: string[];
  used: string[];
  label: string;
  disabled: boolean;
  onChange: (v: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [result, setResult] = useState<DocumentPage<{ serial_number: string; unit_cost_vnd?: number|null }>>(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    trigger.current = document.activeElement as HTMLElement;
    return () => trigger.current?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (disabled || !warehouse || !part) return;
    const c = new AbortController();
    setPending(true);
    setResult(undefined);
    setError("");
    if (!documents.availableSerials) {
      setPending(false);
      setError("Chưa tải được danh sách serial");
      return;
    }
    documents
      .availableSerials(part, warehouse, state, search, page, c.signal, businessAt)
      .then((v) => {
        if (!c.signal.aborted) setResult(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(accessMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setPending(false);
      });
    return () => c.abort();
  }, [documents, part, warehouse, state, search, page, disabled, revision,businessAt]);
  let required = 0;
  try {
    required = Number(normalizeViNumber(quantity, "Số lượng"));
  } catch {}
  const dialog = useRef<HTMLElement>(null);
  const blocked = new Set(used.map(serialKey)),
    selected = new Set(values.map(serialKey));
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-slate-900/40"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const nodes = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                "button:not([disabled]),input:not([disabled])",
              ) ?? [],
            ),
            first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={recovery ? "Chọn serial thu hồi" : "Chọn serial xuất kho"}
        className="flex h-full w-full max-w-[540px] flex-col bg-white p-4 text-slate-900 shadow-2xl"
      >
        <header className="flex justify-between gap-3">
          <div>
            <h2 className="font-bold">{recovery ? "Serial thu hồi" : "Serial xuất kho"}</h2>
            <p className="mt-1 text-sm">{label}</p>
            <p className="mt-1 text-xs">
              Đã chọn {values.length}/{quantity} ·{" "}
              {state === "new" ? "Hàng mới" : "Hàng thu hồi"}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            className={docButton}
            title="Đóng serial"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <p className="my-3 text-xs text-slate-500">
          {recovery ? "Chỉ chọn serial đang lắp trong lần xuất đã chọn. Mỗi serial tương ứng số lượng 1." : "Chỉ chọn serial còn trong kho và đúng trạng thái hàng. Mỗi serial tương ứng số lượng 1."}
        </p>
        {!disabled && (
          <input
            aria-label={recovery ? "Tìm serial đang sử dụng" : "Tìm serial trong kho"}
            placeholder="Tìm serial…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={docInput}
          />
        )}
        <div className="my-3 flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-slate-200">
          {pending && (
            <p role="status" className="p-3 text-sm">
              Đang tải serial…
            </p>
          )}
          {error && (
            <p role="alert" className="p-3 text-sm text-red-700">
              {error}{" "}
              <button
                type="button"
                className={docButton}
                onClick={() => setRevision((n) => n + 1)}
              >
                Thử lại
              </button>
            </p>
          )}
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="p-2">Chọn</th>
                <th>Serial</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {(disabled
                ? values.map((serial_number) => ({ serial_number,unit_cost_vnd:undefined as number|undefined }))
                : (result?.data ?? [])
              ).map((r) => {
                const key = serialKey(r.serial_number);
                return (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={"Chọn serial " + r.serial_number}
                        checked={selected.has(key)}
                        disabled={
                          disabled ||
                          blocked.has(key) ||
                          (!selected.has(key) && values.length >= required)
                        }
                        onChange={(e) =>
                          onChange(
                            e.target.checked
                              ? [...values, r.serial_number]
                              : values.filter((v) => serialKey(v) !== key),
                          )
                        }
                      />
                    </td>
                    <td className="font-mono">{r.serial_number}{typeof r.unit_cost_vnd === "number" && <span className="ml-auto font-sans tabular-nums text-slate-500">{money(r.unit_cost_vnd)}</span>}</td>
                    <td className="text-xs">
                      {blocked.has(key)
                        ? "Đã chọn ở dòng khác"
                        : disabled
                          ? (recovery ? "Đã thu hồi" : "Đã xuất")
                          : (recovery ? "Đang sử dụng" : "Trong kho")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pending && !error && !disabled && result?.data.length === 0 && (
            <p className="p-3 text-sm text-slate-500">
              Không có serial phù hợp.
            </p>
          )}
        </div>
        {!disabled && values.length > 0 && (
          <div className="mb-3 flex max-h-24 flex-wrap gap-1 overflow-auto">
            {values.map((v) => (
              <button
                type="button"
                key={v}
                title="Bỏ chọn serial"
                className="rounded border border-blue-200 px-2 py-1 font-mono text-xs text-blue-700"
                onClick={() => onChange(values.filter((s) => s !== v))}
              >
                {v} ×
              </button>
            ))}
          </div>
        )}
        <footer className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!disabled && (
              <>
                <button
                  type="button"
                  className={docButton}
                  disabled={page === 1 || pending}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Trước
                </button>
                <span className="text-xs">Trang {page}</span>
                <button
                  type="button"
                  className={docButton}
                  disabled={
                    pending ||
                    !result ||
                    page * result.pagination.page_size >=
                      result.pagination.total
                  }
                  onClick={() => setPage((n) => n + 1)}
                >
                  Sau
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className={docButton + " !bg-blue-600 !text-white"}
            onClick={onClose}
          >
            Xong
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
