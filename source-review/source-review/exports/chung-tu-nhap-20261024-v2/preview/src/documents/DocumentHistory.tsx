import { proposalSections } from "../../shared/proposal";
import { useEffect, useState } from "react";
import type {
  DocumentClient,
  DocumentEvent,
  DocumentPage,
} from "./documentClient";
import type { DocumentDraft, DocumentRecord } from "../../shared/documents";
import { accessMessage } from "../api/catalogClient";
import { stockStates } from "../../shared/documents";
import { docButton } from "./CatalogPicker";
const actions: Record<string, string> = {
  create: "Lập nháp",
  save: "Sửa nháp",
  cancel: "Hủy phiếu",
  submit: "Gửi duyệt",
  approve: "Duyệt",
  return: "Trả về",
  reject: "Từ chối",
  revoke: "Bỏ duyệt",
};
function Snapshot({
  value,
  row,
}: {
  value: string | null;
  row: DocumentRecord;
}) {
  if (!value)
    return <p className="mt-1 text-xs text-slate-500">Chưa có dữ liệu</p>;
  let snapshot: {
    draft?: DocumentDraft;
    status?: string;
    labels?: Record<string, string>;
  };
  try {
    snapshot = JSON.parse(value);
  } catch {
    return <p>Dữ liệu lịch sử không đọc được.</p>;
  }
  const labels = snapshot.labels ?? row.labels;
  const d = snapshot.draft;
  if (!d) return <p>Chưa có chi tiết phiếu.</p>;
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 text-[11px]">
      <p>Ngày giờ: {d.business_at.replace("T", " ")}</p>
      <p>Kho: {labels["warehouses:" + d.warehouse_id] ?? "—"}</p>
      <p>Người nhận: {d.recipient || "—"}</p>
      <p>
        Hóa đơn: <span className="font-mono">{d.invoice_number || "—"}</span>
      </p>
      <p>
        Diễn giải: {d.purpose} {d.notes}
      </p>
      {d.proposal && (
        <div>
          {proposalSections.flatMap(([, fields]) =>
            fields.map((f) =>
              d.proposal?.[f[0]] ? (
                <p key={f[0]}>
                  {f[1]}: {d.proposal[f[0]]}
                </p>
              ) : null,
            ),
          )}
          <p>Phương án: {d.proposal.plans || "—"}</p>
        </div>
      )}
      <ul className="space-y-2">
        {d.lines.map((line) => (
          <li key={line.id} className="border-t border-slate-200 pt-1">
            <p>{labels["parts:" + line.part_id] ?? "Vật tư trong phiếu"}</p>
            <p className="tabular-nums">
              Số lượng: {line.quantity} · Đơn giá:{" "}
              {line.unit_price || "Chưa định giá"} · VAT: {line.vat_rate}%
            </p>
            {d.kind === "proposal" && (
              <p>
                {line.proposal_side === "remove"
                  ? "Tháo / thu hồi"
                  : "Cấp / lắp"}{" "}
                · {line.proposal_condition} · {line.proposal_source} ·{" "}
                {line.proposal_location} · {line.proposal_link}
              </p>
            )}
            <p>
              {stockStates[line.stock_state]}
              {line.serial && (
                <>
                  {" "}
                  · Serial: <span className="font-mono">{line.serial}</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function DocumentHistory({
  documents,
  row,
  onClose,
}: {
  documents: DocumentClient;
  row: DocumentRecord;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1),
    [result, setResult] = useState<DocumentPage<DocumentEvent>>(),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    setError("");
    documents
      .history(row.id, page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(accessMessage(e));
      });
    return () => controller.abort();
  }, [documents, row.id, page, revision]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Lịch sử chứng từ"
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white text-slate-900"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <header className="flex justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="font-bold">Lịch sử chứng từ</h3>
            <p className="mt-1 font-mono">{row.code}</p>
          </div>
          <button type="button" className={docButton} onClick={onClose}>
            Đóng
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {error ? (
            <p role="alert">
              {error}{" "}
              <button
                className={docButton}
                onClick={() => setRevision((n) => n + 1)}
              >
                Thử lại
              </button>
            </p>
          ) : !result ? (
            <p role="status">Đang tải lịch sử…</p>
          ) : (
            result.data.map((event) => (
              <article
                key={event.id}
                className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs"
              >
                <div className="flex justify-between gap-3">
                  <strong>{actions[event.action] ?? event.action}</strong>
                  <time className="tabular-nums text-slate-500">
                    {new Date(event.created_at).toLocaleString("vi-VN")}
                  </time>
                </div>
                <p>
                  {event.actor_name} · {event.reason}
                </p>
                <details>
                  <summary className="cursor-pointer text-blue-600">
                    Đối chiếu dữ liệu trước / sau
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[event.before_json, event.after_json].map(
                      (value, index) => (
                        <div key={index}>
                          <strong>{index === 0 ? "Trước" : "Sau"}</strong>
                          <Snapshot value={value} row={row} />
                        </div>
                      ),
                    )}
                  </div>
                </details>
              </article>
            ))
          )}
        </div>
        <footer className="flex justify-between border-t border-slate-200 p-3">
          <button
            className={docButton}
            disabled={page === 1}
            onClick={() => setPage((n) => n - 1)}
          >
            Trước
          </button>
          <span className="text-xs">Trang {page}</span>
          <button
            className={docButton}
            disabled={
              !result ||
              page * result.pagination.page_size >= result.pagination.total
            }
            onClick={() => setPage((n) => n + 1)}
          >
            Sau
          </button>
        </footer>
      </section>
    </div>
  );
}
