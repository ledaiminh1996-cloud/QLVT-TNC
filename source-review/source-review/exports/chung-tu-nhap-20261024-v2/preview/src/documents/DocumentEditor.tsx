import { DocumentLines } from "./DocumentLines";
import { focusDocumentError } from "./focusDocumentError";
import {
  formDraft,
  normalizeDraftInput,
  displayViNumber,
} from "../../shared/documentNumbers";
import { ProposalForm } from "./ProposalForm";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Copy, ChevronDown, Upload, X, Save } from "lucide-react";
import type { CatalogClient, CatalogRow } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import {
  documentKinds,
  emptyDraft,
  emptyLine,
  parseDraft,
  draftTotals,
  lineTotals,
  stockStates,
  editableDraft,
} from "../../shared/documents";
import type {
  DocumentKind,
  DocumentRecord,
  DocumentDraft,
  DraftLine,
} from "../../shared/documents";
import type { DocumentClient } from "./documentClient";
import {
  CatalogPicker,
  catalogLabel,
  docButton,
  docInput,
} from "./CatalogPicker";
import { DocumentQuickImport } from "./DocumentQuickImport";
export { money } from "./documentFormatting";
import { money } from "./documentFormatting";
export const proposalTypes = {
  purchase: "Mua vật tư",
  issue: "Cấp vật tư",
  transfer: "Điều chuyển",
  repair: "Sửa chữa",
} as const;
export function DocumentEditor({
  kind,
  record,
  api,
  documents,
  canEdit,
  onClose,
  onSaved,
}: {
  kind: DocumentKind;
  record?: DocumentRecord;
  api: CatalogClient;
  documents: DocumentClient;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (row: DocumentRecord) => void;
}) {
  const [draft, setDraft] = useState<DocumentDraft>(() =>
      formDraft(record ? structuredClone(record.draft) : emptyDraft(kind)),
    ),
    [labels, setLabels] = useState<Record<string, string>>(
      record?.labels ?? {},
    ),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [saving, setSaving] = useState(false),
    [expanded, setExpanded] = useState<Record<string, boolean>>({}),
    [importing, setImporting] = useState(false);
  const key = useRef(crypto.randomUUID()),
    lock = useRef(false),
    root = useRef<HTMLDivElement>(null),
    readOnly = !canEdit || (!!record && !editableDraft(record.status)),
    priced = documentKinds[kind].priced;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("button,input")?.focus();
    return () => previous?.focus();
  }, []);
  const initial = useRef(JSON.stringify(draft));
  const dirty =
    !readOnly &&
    (JSON.stringify(draft) !== initial.current || reason.trim() !== "");
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
  function close() {
    if (
      !saving &&
      (!dirty ||
        window.confirm(
          "Phiếu có thay đổi chưa lưu. Bạn muốn bỏ thay đổi và đóng?",
        ))
    )
      onClose();
  }
  const totals = useMemo(() => {
    try {
      return draftTotals(normalizeDraftInput(draft));
    } catch {
      return { net: null, vat: null, gross: null };
    }
  }, [draft]);
  const update = (key: keyof Omit<DocumentDraft, "lines">, value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "warehouse_id"
        ? { lines: current.lines.map((l) => ({ ...l, tank_id: "" })) }
        : {}),
    }));
  const line = (id: string, patch: Partial<DraftLine>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  const remember = (resource: string, id: string, row?: CatalogRow) => {
    if (row)
      setLabels((current) => ({
        ...current,
        [resource + ":" + id]: catalogLabel(row),
        ...(resource === "parts"
          ? {
              ["unit:" + id]: String(row.unit),
              ["serialized:" + id]: String(row.is_serialized),
              ["sku:" + id]: String(row.sku),
              ["fuel:" + id]: String(row.is_fuel ?? 0),
              ["data:" + id]: String(row.needs_data_package ?? 0),
            }
          : {}),
      }));
  };
  function pick(
    resource: "warehouses" | "suppliers" | "departments",
    field: "warehouse_id" | "to_warehouse_id" | "supplier_id" | "department_id",
    label: string,
  ) {
    return (
      <CatalogPicker
        api={api}
        resource={resource}
        label={label}
        value={draft[field]}
        selectedLabel={labels[resource + ":" + draft[field]]}
        onChange={(id, row) => {
          remember(resource, id, row);
          update(field, id);
        }}
        disabled={readOnly || saving}
      />
    );
  }
  function input(
    label: string,
    key: keyof Omit<
      DocumentDraft,
      "lines" | "kind" | "proposal_type" | "proposal"
    >,
    type = "text",
    mono = false,
  ) {
    return (
      <label className="block text-xs font-semibold">
        {label}
        <input
          className={docInput + " mt-1" + (mono ? " font-mono" : "")}
          type={type}
          value={draft[key]}
          disabled={readOnly || saving}
          onChange={(e) => update(key, e.target.value)}
        />
      </label>
    );
  }
  function focusError(message: string) {
    const row = message.match(/Dòng (\d+)/i);
    if (row) {
      const item = draft.lines[Number(row[1]) - 1];
      if (item) setExpanded((prev) => ({ ...prev, [item.id]: true }));
    }
    setTimeout(() => focusDocumentError(root.current, message), 0);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || readOnly) return;
    setError("");
    let normalized: DocumentDraft;
    try {
      normalized = parseDraft(normalizeDraftInput(draft));
      if (record && !reason.trim()) throw new Error("Nhập lý do sửa phiếu.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Phiếu không hợp lệ.";
      setError(message);
      focusError(message);
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      const result = await documents.save(
        normalized,
        key.current,
        record,
        reason,
      );
      initial.current = JSON.stringify(draft);
      onSaved(result);
    } catch (e) {
      const message = accessMessage(e);
      setError(message);
      focusError(message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  function trap(event: React.KeyboardEvent) {
    if (event.key === "Escape" && !saving && !importing) close();
    if (event.key === "Tab") {
      const nodes = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-5">
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={
          (record ? "Chi tiết / sửa " : "Lập ") + documentKinds[kind].label
        }
        className="flex max-h-[95dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-xl"
        onKeyDown={trap}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-bold">{documentKinds[kind].label}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {record ? (
                <span className="font-mono">{record.code}</span>
              ) : (
                "Số được cấp khi lưu nháp: MM.yy.00001/" +
                documentKinds[kind].code
              )}{" "}
              · Chưa ghi sổ kho
            </p>
            {record && kind === "warehouse_transfer" && (
              <p className="mt-1 text-xs text-slate-500">
                Hai đầu dự kiến:{" "}
                <span className="font-mono">
                  {record.code.replace("/PĐC", "/PXĐC")} ·{" "}
                  {record.code.replace("/PĐC", "/PNĐC")}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Đóng phiếu"
            className={docButton + " !px-2"}
            disabled={saving}
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kind === "opening" ? (
                <label className="text-xs font-semibold">
                  Ngày bắt đầu số dư *
                  <input
                    type="date"
                    className={docInput + " mt-1"}
                    disabled={readOnly || saving}
                    value={draft.business_at.slice(0, 10)}
                    onChange={(e) =>
                      update("business_at", e.target.value + "T00:00")
                    }
                  />
                </label>
              ) : (
                input("Ngày giờ chứng từ *", "business_at", "datetime-local")
              )}
              {!["equipment_transfer", "rotation"].includes(kind) &&
                pick(
                  "warehouses",
                  "warehouse_id",
                  kind === "warehouse_transfer"
                    ? "Kho đi *"
                    : ["proposal"].includes(kind)
                      ? "Kho liên quan"
                      : "Kho *",
                )}
              {kind === "warehouse_transfer" &&
                pick("warehouses", "to_warehouse_id", "Kho nhận *")}
              {["receipt", "retread"].includes(kind) &&
                pick(
                  "suppliers",
                  "supplier_id",
                  kind === "retread" ? "Đơn vị đắp vỏ" : "Nhà cung cấp",
                )}
              {kind === "proposal" && (
                <>
                  {pick("departments", "department_id", "Bộ phận đề xuất *")}
                  <label className="text-xs font-semibold">
                    Loại đề xuất
                    <select
                      className={docInput + " mt-1"}
                      disabled={readOnly || saving}
                      value={draft.proposal_type}
                      onChange={(e) => update("proposal_type", e.target.value)}
                    >
                      {Object.entries(proposalTypes).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {["receipt"].includes(kind) &&
                input(
                  "Số hóa đơn / tham chiếu",
                  "invoice_number",
                  "text",
                  true,
                )}
              {[
                "issue",
                "warehouse_transfer",
                "equipment_transfer",
                "rotation",
              ].includes(kind) && input("Người nhận / bàn giao", "recipient")}
              {input("Mục đích / nội dung", "purpose")}
            </div>
            {kind === "warehouse_transfer" && (
              <p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
                Một hồ sơ PĐC quản lý cả PXĐC và PNĐC. Hai đầu chỉ có hiệu lực
                cùng nhau khi ghi sổ; không cộng điều chuyển hai lần trong NXT.
              </p>
            )}
            {["equipment_transfer", "rotation"].includes(kind) && (
              <p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
                Thay đổi giai đoạn sử dụng / vị trí lắp, không tạo nhập hoặc
                xuất kho thực tế.
              </p>
            )}
            {["issue", "recovery", "liquidation", "retread"].includes(kind) && (
              <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                Tồn khả dụng, nguồn nhập và lần lắp gốc sẽ được đối chiếu tại
                bước ghi sổ. Giá vốn không lấy từ đơn giá tự nhập.
              </p>
            )}
            {kind === "proposal" ? (
              <ProposalForm
                draft={draft}
                onChange={setDraft}
                disabled={readOnly || saving}
                api={api}
                labels={labels}
                remember={remember}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    Dòng vật tư{" "}
                    <span className="font-normal tabular-nums text-slate-500">
                      ({draft.lines.length}/60)
                    </span>
                  </h3>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={docButton}
                        disabled={saving}
                        onClick={() => setImporting(true)}
                      >
                        <Upload size={14} />
                        Nhập nhanh dòng
                      </button>
                      <button
                        type="button"
                        className={docButton}
                        disabled={draft.lines.length >= 60 || saving}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            lines: [
                              ...d.lines,
                              {
                                ...emptyLine(),
                                stock_state:
                                  kind === "liquidation"
                                    ? "pending_scrap"
                                    : ["recovery", "retread"].includes(kind)
                                      ? "recovered"
                                      : "new",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={14} />
                        Thêm dòng
                      </button>
                    </div>
                  )}
                </div>
                <DocumentLines
                  draft={draft}
                  setDraft={setDraft}
                  kind={kind}
                  api={api}
                  labels={labels}
                  readOnly={readOnly}
                  saving={saving}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  remember={remember}
                  line={line}
                />

                {priced && (
                  <div className="ml-auto grid max-w-md grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-200 p-3 text-xs">
                    <span>Tiền hàng (thực nhập)</span>
                    <strong className="text-right font-sans tabular-nums">
                      {money(totals.net)}
                    </strong>
                    <span>VAT</span>
                    <strong className="text-right font-sans tabular-nums">
                      {money(totals.vat)}
                    </strong>
                    <span className="font-bold">Tổng sau VAT</span>
                    <strong className="text-right font-sans tabular-nums text-blue-700">
                      {money(totals.gross)}
                    </strong>
                  </div>
                )}
              </>
            )}
            {kind === "proposal" && (
              <div className="rounded-lg border border-slate-200 p-3 text-right text-xs tabular-nums">
                Tổng trước thuế: <strong>{money(totals.net)}</strong> · Thuế dự
                kiến: <strong>{money(totals.vat)}</strong> · Tổng thanh toán:{" "}
                <strong>{money(totals.gross)}</strong>
              </div>
            )}
            <label className="block text-xs font-semibold">
              Diễn giải / ghi chú
              <textarea
                rows={2}
                className={docInput + " mt-1"}
                disabled={readOnly || saving}
                value={draft.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>
            {record && !readOnly && (
              <label className="block text-xs font-semibold">
                Lý do sửa *
                <input
                  className={docInput + " mt-1"}
                  disabled={saving}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
              >
                {error}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 p-4">
            <span className="text-[11px] text-slate-500">
              {readOnly ? "Chế độ xem" : "Lưu nháp chưa làm thay đổi tồn kho."}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={docButton}
                disabled={saving}
                onClick={close}
              >
                Đóng
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  className={docButton + " !bg-blue-600 !text-white"}
                  disabled={saving}
                >
                  <Save size={14} />
                  {saving ? "Đang lưu…" : "Lưu nháp"}
                </button>
              )}
            </div>
          </div>
        </form>
        {importing && (
          <DocumentQuickImport
            api={api}
            kind={kind}
            onClose={() => setImporting(false)}
            onApply={(rows, parts) => {
              if (
                draft.lines.filter((l) => l.part_id).length + rows.length >
                60
              ) {
                setError("Tối đa 60 dòng.");
                setImporting(false);
                return;
              }
              parts.forEach((p) => remember("parts", p.id, p));
              setDraft((d) => ({
                ...d,
                lines: [
                  ...d.lines.filter((l) => l.part_id),
                  ...formDraft({ ...d, lines: rows }).lines,
                ],
              }));
              setImporting(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
