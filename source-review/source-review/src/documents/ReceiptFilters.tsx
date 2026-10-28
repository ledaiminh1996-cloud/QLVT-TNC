import type { CatalogClient, CatalogRow } from "../api/catalogClient";
import {
  CatalogPicker,
  docInput,
  docButton,
  catalogLabel,
} from "./CatalogPicker";
import type { DocumentClient } from "./documentClient";
import { receiptDateRange, type ReceiptRange } from "./receiptListUtils";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FilterX, X } from "lucide-react";
export interface ReceiptFilterValues {
  query: string;
  status: string;
  from: string;
  to: string;
  warehouse_id: string;
  supplier_id: string;
  created_by?: string;
}
const periods = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
  { key: "previous", label: "Tháng trước" },
  { key: "custom", label: "Tùy chọn" },
] as const;
const dateLabel = (v: string) => (v ? v.split("-").reverse().join("/") : "…");
export function ReceiptFilters({
  api,
  documents,
  kind = "receipt",
  value,
  onChange,
  onValidChange,
  trailingAction,
}: {
  trailingAction?: ReactNode;
  kind?: "receipt" | "issue";
  api: CatalogClient;
  documents?: DocumentClient;
  value: ReceiptFilterValues;
  onChange: (v: ReceiptFilterValues) => void;
  onValidChange: (valid: boolean) => void;
}) {
  const [panel, setPanel] = useState<"period" | "other" | null>(null);
  const [dates, setDates] = useState({ from: value.from, to: value.to });
  const [custom, setCustom] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [creators, setCreators] = useState<
    { id: string; display_name: string }[]
  >([]);
  const [creatorError, setCreatorError] = useState(false);
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLElement>(null);
  const defaultRange = useRef(receiptDateRange("month")).current;
  useEffect(() => {
    if (panel !== "other" || !documents?.creators) return;
    const controller = new AbortController();
    setCreatorError(false);
    documents
      .creators(controller.signal, kind)
      .then((v) => {
        if (!controller.signal.aborted) setCreators(v);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCreatorError(true);
      });
    return () => controller.abort();
  }, [panel, documents, retry, kind]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as Element;
      const listbox = target.closest?.('[role="listbox"]');
      const ownedPopup =
        listbox &&
        [...(root.current?.querySelectorAll('[role="combobox"]') ?? [])].some(
          (input) => input.getAttribute("aria-controls") === listbox.id,
        );
      if (!root.current?.contains(target) && !ownedPopup) setPanel(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const period =
    periods.find(
      (p) =>
        p.key !== "custom" &&
        (() => {
          const r = receiptDateRange(p.key as ReceiptRange);
          return r.from === value.from && r.to === value.to;
        })(),
    )?.label ?? "Tùy chọn";
  const count = [
    value.query.trim(),
    value.status,
    value.from !== defaultRange.from || value.to !== defaultRange.to,
    value.warehouse_id,
    value.supplier_id,
    value.created_by,
  ].filter(Boolean).length;
  const change = (key: keyof ReceiptFilterValues, v: string) =>
    onChange({ ...value, [key]: v });
  function pick(
    key: "warehouse_id" | "supplier_id",
    id: string,
    row?: CatalogRow,
  ) {
    if (row) setLabels((p) => ({ ...p, [key + ":" + id]: catalogLabel(row) }));
    change(key, id);
  }
  const chips = [
    {
      key: "warehouse_id" as const,
      label: "Kho",
      id: value.warehouse_id,
      text: labels["warehouse_id:" + value.warehouse_id] ?? value.warehouse_id,
    },
    {
      key: "supplier_id" as const,
      label: "NCC",
      id: value.supplier_id,
      text: labels["supplier_id:" + value.supplier_id] ?? value.supplier_id,
    },
    {
      key: "created_by" as const,
      label: "Người tạo",
      id: value.created_by,
      text:
        creators.find((c) => c.id === value.created_by)?.display_name ??
        value.created_by,
    },
  ];
  const popup =
    "absolute top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl";
  const compactInput = docInput + " !h-8 !px-2 !py-1.5";
  return (
    <section
      ref={root}
      aria-label={kind === "issue" ? "Bộ lọc phiếu xuất" : "Bộ lọc phiếu nhập"}
      className="relative space-y-2 rounded-xl border border-slate-200 bg-white p-2"
    >
      <div
        className={
          "grid items-end gap-1.5 sm:grid-cols-2 " +
          (trailingAction
            ? "lg:grid-cols-[minmax(170px,1fr)_minmax(270px,1fr)_125px_120px_auto]"
            : "lg:grid-cols-[minmax(180px,1fr)_minmax(270px,1fr)_125px_120px]")
        }
      >
        <label className="min-w-0 text-xs font-semibold">
          Tìm kiếm
          <input
            aria-label="Tìm chứng từ"
            placeholder={
              kind === "issue"
                ? "Số phiếu, serial, vật tư, người nhận…"
                : "Số phiếu, serial, vật tư, nhà cung cấp…"
            }
            className={compactInput + " mt-1"}
            value={value.query}
            onChange={(e) => change("query", e.target.value)}
          />
        </label>
        <div className="relative min-w-0">
          <button
            type="button"
            aria-label="Chọn khoảng thời gian"
            title={
              "Kỳ: " +
              period +
              " (" +
              dateLabel(value.from) +
              " – " +
              dateLabel(value.to) +
              ")"
            }
            aria-expanded={panel === "period"}
            className={
              compactInput +
              " flex items-center justify-between gap-2 text-left"
            }
            onClick={() => {
              setDates({ from: value.from, to: value.to });
              setCustom(false);
              setPanel(panel === "period" ? null : "period");
            }}
          >
            <span className="truncate">
              Kỳ: {period}{" "}
              <span className="text-xs text-slate-500">
                ({dateLabel(value.from)} – {dateLabel(value.to)})
              </span>
            </span>
            <ChevronDown size={14} className="shrink-0" />
          </button>
          {panel === "period" && (
            <div
              role="dialog"
              aria-label="Khoảng thời gian"
              className={popup + " left-0 w-[min(400px,calc(100vw-48px))]"}
            >
              <div className="mb-3 flex flex-wrap gap-1">
                {periods.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={docButton}
                    onClick={() => {
                      if (p.key === "custom") {
                        setCustom(true);
                        return;
                      }
                      const r = receiptDateRange(p.key);
                      setDates(r);
                      onValidChange(true);
                      onChange({ ...value, ...r });
                      setPanel(null);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["from", "to"] as const).map((key) => (
                  <label key={key} className="text-xs font-semibold">
                    {key === "from" ? "Từ ngày" : "Đến ngày"}
                    <input
                      type="date"
                      aria-label={key === "from" ? "Từ ngày" : "Đến ngày"}
                      className={compactInput + " mt-1"}
                      value={dates[key]}
                      onChange={(e) => {
                        setCustom(true);
                        setDates({ ...dates, [key]: e.target.value });
                      }}
                    />
                  </label>
                ))}
              </div>
              {dates.from && dates.to && dates.from > dates.to && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  Từ ngày không được sau Đến ngày.
                </p>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {custom
                    ? "Chọn ngày rồi áp dụng"
                    : "Có thể chọn khoảng ngày riêng"}
                </span>
                <button
                  type="button"
                  className={docButton}
                  disabled={!dates.from || !dates.to || dates.from > dates.to}
                  onClick={() => {
                    onValidChange(true);
                    onChange({ ...value, ...dates });
                    setPanel(null);
                  }}
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}
        </div>
        <label className="text-xs font-semibold">
          Trạng thái
          <select
            aria-label="Trạng thái chứng từ"
            className={compactInput + " mt-1"}
            value={value.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="posted">
              {kind === "issue" ? "Đã xuất kho" : "Đã nhập kho"}
            </option>
            <option value="draft">Nháp</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </label>
        <div className="relative">
          <button
            type="button"
            aria-expanded={panel === "other"}
            className={
              compactInput + " flex items-center justify-between gap-2"
            }
            onClick={() => setPanel(panel === "other" ? null : "other")}
          >
            Bộ lọc khác
            <ChevronDown size={14} />
          </button>
          {panel === "other" && (
            <div
              role="dialog"
              aria-label="Bộ lọc khác"
              className={
                popup + " right-0 w-[min(360px,calc(100vw-48px))] space-y-3"
              }
            >
              <CatalogPicker
                includeInactive
                api={api}
                resource="warehouses"
                label="Kho"
                value={value.warehouse_id}
                selectedLabel={labels["warehouse_id:" + value.warehouse_id]}
                onChange={(id, row) => pick("warehouse_id", id, row)}
              />
              {kind === "receipt" && (
                <CatalogPicker
                  includeInactive
                  api={api}
                  resource="suppliers"
                  label="Nhà cung cấp"
                  value={value.supplier_id}
                  selectedLabel={labels["supplier_id:" + value.supplier_id]}
                  onChange={(id, row) => pick("supplier_id", id, row)}
                />
              )}
              <label className="block text-xs font-semibold">
                Người tạo
                <select
                  aria-label="Người tạo"
                  className={compactInput + " mt-1"}
                  value={value.created_by ?? ""}
                  onChange={(e) => change("created_by", e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </label>
              {creatorError && (
                <p role="alert" className="text-xs text-red-700">
                  Chưa tải được người tạo.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setRetry((n) => n + 1)}
                  >
                    Thử lại
                  </button>
                </p>
              )}
              <div className="text-right">
                <button
                  type="button"
                  className={docButton}
                  onClick={() => setPanel(null)}
                >
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>
        {trailingAction && (
          <div className="flex justify-end sm:col-span-2 lg:col-span-1">
            {trailingAction}
          </div>
        )}
      </div>
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {chips
            .filter((c) => c.id)
            .map((c) => (
              <button
                type="button"
                key={c.key}
                title={c.label + ": " + c.text + " — Bỏ lọc"}
                aria-label={"Bỏ lọc " + c.label}
                className="flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700"
                onClick={() => change(c.key, "")}
              >
                <span className="truncate">
                  {c.label}: {c.text}
                </span>
                <X size={12} className="shrink-0" />
              </button>
            ))}
          <span aria-live="polite" className="ml-auto text-slate-500">
            {count} bộ lọc đang áp dụng
          </span>
          <button
            type="button"
            title="Xóa các bộ lọc đã chọn, trở về tháng hiện tại"
            className={docButton + " !min-h-7 !px-2"}
            onClick={() => {
              onValidChange(true);
              onChange({
                query: "",
                status: "",
                ...defaultRange,
                warehouse_id: "",
                supplier_id: "",
                created_by: "",
              });
              setPanel(null);
            }}
          >
            <FilterX size={12} />
            Xóa lọc
          </button>
        </div>
      )}
    </section>
  );
}
