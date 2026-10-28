import { useEffect, useState } from "react";
import type { DocumentClient, DocumentPage } from "./documentClient";
import { docButton, docInput } from "./CatalogPicker";
import { accessMessage } from "../api/catalogClient";
export function OperationSourcePicker({
  documents,
  view,
  part,
  warehouse,
  state,
  value,
  onChange,
  disabled,
}: {
  documents: DocumentClient;
  view: "sources" | "usages";
  part: string;
  warehouse: string;
  state: string;
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const [page, setPage] = useState(1),
    [data, setData] =
      useState<
        DocumentPage<{ id: string; code: string; quantity_milli: number }>
      >(),
    [error, setError] = useState("");
  useEffect(() => {
    setPage(1);
  }, [part, warehouse, state, view]);
  useEffect(() => {
    setData(undefined);
    setError("");
    if (!part || disabled) return;
    const c = new AbortController();
    documents
      .sources(view, part, warehouse, state, page, c.signal)
      .then((r) => {
        if (!c.signal.aborted) setData(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(accessMessage(e));
      });
    return () => c.abort();
  }, [documents, view, part, warehouse, state, page, disabled]);
  const label = view === "sources" ? "Nguồn nhập" : "Lần xuất / lắp còn mở";
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold">
        {label}
        <select
          aria-label={label}
          className={docInput + " mt-1"}
          disabled={disabled || !part}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {view === "sources" ? "Tự động phân bổ FIFO" : "Chọn lần xuất/lắp"}
          </option>
          {value && !data?.data.some((row) => row.id === value) && (
            <option value={value}>Nguồn đã chọn</option>
          )}
          {data?.data.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · còn{" "}
              {new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 3,
              }).format(row.quantity_milli / 1000)}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {data && data.pagination.total > 25 && (
        <div className="flex gap-2">
          <button
            type="button"
            className={docButton}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </button>
          <button
            type="button"
            className={docButton}
            disabled={page * 25 >= data.pagination.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
