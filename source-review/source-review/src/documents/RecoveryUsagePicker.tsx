import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { RecoverySourceRow } from "../../shared/recoverySources";
import type { DocumentClient, DocumentPage } from "./documentClient";
import { docButton, docInput } from "./CatalogPicker";
import { documentDateTime } from "./documentFormatting";
import { accessMessage } from "../api/catalogClient";
export function RecoveryUsagePicker({
  documents,
  vehicleId,
  used,
  onSelect,
  onClose,
}: {
  documents: DocumentClient;
  vehicleId: string;
  used: string[];
  onSelect: (row: RecoverySourceRow) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<DocumentPage<RecoverySourceRow>>(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => trigger?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const c = new AbortController();
    setPending(true);
    setError("");
    setResult(undefined);
    if (!documents.recoverySources) {
      setPending(false);
      setError("Chưa tải được vật tư đang sử dụng.");
      return;
    }
    documents
      .recoverySources(search, page, vehicleId, c.signal)
      .then((r) => {
        if (!c.signal.aborted) setResult(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(accessMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setPending(false);
      });
    return () => c.abort();
  }, [documents, search, page, vehicleId]);
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const nodes = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled]),input:not([disabled])",
            ) ?? [],
          );
          const first = nodes[0],
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
        aria-label="Vật tư đang sử dụng"
        className="flex max-h-[90dvh] w-full max-w-[1300px] flex-col rounded-xl bg-white p-4 text-slate-900 shadow-xl"
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Chọn vật tư đang sử dụng</h2>
          <button
            type="button"
            className={docButton}
            title="Đóng chọn vật tư đang sử dụng"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <input
          className={docInput}
          aria-label="Tìm vật tư đang sử dụng"
          placeholder="Tìm mã vật tư, serial hoặc số phiếu nguồn…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="my-2 text-xs text-slate-500">
          Nguồn từ phiếu xuất hoặc vật tư đang sử dụng đầu kỳ, chỉ hiện phần còn được thu hồi. Mỗi serial được chọn thành một dòng riêng.
        </p>
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {[
                  "Vật tư",
                  "Serial",
                  "Phương tiện / vị trí",
                  "Phiếu nguồn",
                  "Ngày lắp",
                  "ODO xuất/lắp",
                  "Giờ lúc xuất",
                  "Còn thu hồi",
                  "",
                ].map((h, i) => (
                  <th key={i} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result?.data.map((row) => (
                <tr
                  className="border-t border-slate-200"
                  key={row.usage_id + ":" + row.serial_number}
                >
                  <td className="p-2">
                    <strong>{row.sku}</strong>
                    <p>{row.name}</p>{row.valuation_pending===1&&<p className="text-amber-700">⚠ Chưa xác định giá trị</p>}
                  </td>
                  <td className="p-2 font-mono">{row.serial_number || "—"}</td>
                  <td className="p-2">
                    {row.target_label}
                    <p>{row.position}</p>
                  </td>
                  <td className="p-2">{row.code}{row.source_kind==="opening_usage"&&<small className="block text-slate-500">Đang sử dụng đầu kỳ</small>}</td>
                  <td className="p-2 whitespace-nowrap">
                    {row.source_kind==="opening_usage"&&!row.opening_installed_at?"Chưa rõ ngày lắp gốc":documentDateTime(row.started_at)}
                  </td>
                  <td className="p-2 tabular-nums">
                    {row.odo_milli === null
                      ? "—"
                      : new Intl.NumberFormat("vi-VN").format(
                          row.odo_milli / 1000,
                        )}
                  </td>
                  <td className="p-2 tabular-nums">
                    {row.hours_milli === null
                      ? "—"
                      : new Intl.NumberFormat("vi-VN").format(
                          row.hours_milli / 1000,
                        )}
                  </td>
                  <td className="p-2">
                    {row.quantity_milli / 1000} {row.unit}
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      className={docButton}
                      disabled={
                        !!row.serial_number &&
                        used.includes(
                          row.usage_id + ":" + row.serial_number.toUpperCase(),
                        )
                      }
                      onClick={() => onSelect(row)}
                      aria-label={
                        "Chọn " +
                        row.sku +
                        " " +
                        (row.serial_number || row.code)
                      }
                    >
                      {row.serial_number &&
                      used.includes(
                        row.usage_id + ":" + row.serial_number.toUpperCase(),
                      )
                        ? "Đã chọn"
                        : "Chọn"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending && (
            <p role="status" className="p-3 text-sm">
              Đang tải vật tư đang sử dụng…
            </p>
          )}
          {error && (
            <p role="alert" className="p-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {!pending && !error && result?.data.length === 0 && (
            <p className="p-3 text-sm">Không có vật tư đang sử dụng phù hợp.</p>
          )}
        </div>
        <footer className="mt-3 flex items-center justify-between text-xs">
          <span>{result?.pagination.total ?? 0} nguồn / serial</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={docButton}
              disabled={page === 1 || pending}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </button>
            <span className="self-center">Trang {page}</span>
            <button
              type="button"
              className={docButton}
              disabled={
                pending || !result || page * 25 >= result.pagination.total
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
