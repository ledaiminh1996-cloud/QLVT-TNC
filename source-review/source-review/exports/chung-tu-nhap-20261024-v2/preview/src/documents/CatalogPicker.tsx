import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import type {
  CatalogClient,
  CatalogRow,
  Resource,
  Page,
} from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
export const docInput =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60";
export const docButton =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs whitespace-nowrap font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
export function catalogLabel(row: CatalogRow): string {
  return (
    String(row.sku ?? row.plate_number ?? row.code ?? "") +
    " — " +
    String(row.name ?? row.brand_model ?? "")
  );
}
export function CatalogPicker({
  api,
  resource,
  label,
  value,
  selectedLabel,
  onChange,
  disabled = false,
  warehouseId,
}: {
  api: CatalogClient;
  resource: Resource;
  label: string;
  value: string;
  selectedLabel?: string;
  onChange: (id: string, row?: CatalogRow) => void;
  disabled?: boolean;
  warehouseId?: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 280 });
  const id = useId(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [current, setCurrent] = useState(1),
    [result, setResult] = useState<Page>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const rect = root.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(
          8,
          Math.min(rect.left, innerWidth - Math.max(240, rect.width) - 8),
        ),
        top:
          rect.bottom + 300 < innerHeight
            ? rect.bottom + 4
            : Math.max(8, rect.top - 300),
        width: Math.min(innerWidth - 16, Math.max(240, rect.width)),
      });
    const outside = (e: MouseEvent) => {
      if (
        e.target instanceof Node &&
        !root.current?.contains(e.target) &&
        !popup.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setCurrent(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(undefined);
    api
      .list(resource, {
        page: current,
        pageSize: 25,
        q: search,
        status: ["vehicles", "equipment"].includes(resource) ? "active" : "1",
        warehouse_id: warehouseId,
        signal: controller.signal,
      })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(accessMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, resource, current, search, open, warehouseId]);
  return (
    <div ref={root} className="relative min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold">
        {label}
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={id + "-options"}
          autoComplete="off"
          className={docInput}
          disabled={disabled}
          value={open ? query : value ? selectedLabel || value : ""}
          placeholder="Tìm theo mã hoặc tên…"
          title={selectedLabel}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label={"Bỏ chọn " + label}
            className={docButton + " !px-2"}
            onClick={() => {
              onChange("");
              setQuery("");
            }}
          >
            ×
          </button>
        )}
      </div>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={popup}
            style={position}
            className="fixed z-[90] rounded-lg border border-slate-200 bg-white p-2 text-slate-900 shadow-lg"
          >
            <div
              id={id + "-options"}
              role="listbox"
              aria-label={label}
              className="max-h-52 overflow-auto"
            >
              {loading ? (
                <p role="status" className="p-2 text-xs">
                  Đang tìm…
                </p>
              ) : error ? (
                <p role="alert" className="p-2 text-xs text-red-700">
                  {error}
                </p>
              ) : (
                result?.data.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    aria-selected={value === row.id}
                    className="block w-full rounded px-2 py-2 text-left text-xs hover:bg-blue-50"
                    onClick={() => {
                      onChange(row.id, row);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    {catalogLabel(row)}
                  </button>
                ))
              )}
              {!loading && !error && result?.data.length === 0 && (
                <p className="p-2 text-xs text-slate-500">Không có kết quả.</p>
              )}
            </div>
            <div className="mt-2 flex justify-between gap-1">
              <button
                type="button"
                className={docButton}
                disabled={loading || current === 1}
                onClick={() => setCurrent((n) => n - 1)}
              >
                Trước
              </button>
              <button
                type="button"
                className={docButton}
                onClick={() => setOpen(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className={docButton}
                disabled={
                  loading ||
                  !result ||
                  current * result.pagination.page_size >=
                    result.pagination.total
                }
                onClick={() => setCurrent((n) => n + 1)}
              >
                Sau
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
