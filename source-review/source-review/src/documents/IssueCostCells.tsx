import { useEffect, useState } from "react";
import type { DocumentClient } from "./documentClient";
import type { DraftLine } from "../../shared/documents";
import { lineSerials } from "../../shared/documentSerials";
import { normalizeViNumber } from "../../shared/documentNumbers";
import { accessMessage } from "../api/catalogClient";
import { money } from "./documentFormatting";
export function IssueCostCells({
  item,
  index,
  warehouse,
  documents,
  amount,
  quantity,
  saved,
  serialized,
  savedUnitPrice,
  businessAt,
  pendingReason,
}: {
  item: DraftLine;
  index: number;
  warehouse: string;
  documents: DocumentClient;
  amount?: string;
  quantity?: string;
  saved: boolean;
  serialized: boolean;
  savedUnitPrice?: string;
  businessAt?: string;
  pendingReason?: string;
}) {
  const [quote, setQuote] = useState<import("./documentClient").PriceQuote>(),
    [error, setError] = useState("");
  const serials = JSON.stringify(lineSerials(item));
  let q = "";
  try {
    q = normalizeViNumber(item.quantity, "Số lượng");
  } catch {}
  const key = JSON.stringify([
    item.part_id,
    warehouse,
    item.stock_state,
    q,
    serials,
    businessAt,
  ]);
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    setQuote(undefined);
    setError("");
    setResolved("");
    if (
      saved ||
      pendingReason ||
      !documents.issuePrice ||
      !item.part_id ||
      !warehouse ||
      !q ||
      Number(q) <= 0 ||
      (serialized && JSON.parse(serials).length !== Number(q))
    )
      return;
    const c = new AbortController();
    const timer = setTimeout(
      () =>
        documents.issuePrice!(
          {
            part_id: item.part_id,
            warehouse_id: warehouse,
            stock_state: item.stock_state,
            quantity: q,
            serials: JSON.parse(serials),
            business_at: businessAt,
          },
          c.signal,
        )
          .then((r) => {
            if (!c.signal.aborted) {
              setQuote(r);
              setResolved(key);
            }
          })
          .catch((e) => {
            if (!c.signal.aborted) {
              setError(accessMessage(e));
              setResolved(key);
            }
          }),
      180,
    );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [
    documents,
    item.part_id,
    warehouse,
    item.stock_state,
    q,
    serials,
    saved,
    serialized,
    key,
    businessAt,
    pendingReason,
  ]);
  const known = saved && amount !== undefined && Number(quantity) > 0;
  const current = resolved === key ? quote : undefined;
  const total = known ? Number(amount) : current?.amount_vnd;
  const price = known
    ? savedUnitPrice !== undefined
      ? Number(savedUnitPrice) / 1000
      : (Number(amount) * 1000) / Number(quantity)
    : current?.unit_price_vnd_milli != null
      ? current.unit_price_vnd_milli / 1000
      : undefined;
  return (
    <>
      <td
        className="p-2 align-top text-left tabular-nums"
        aria-label={"Đơn giá dòng " + (index + 1)}
      >
        <div className="flex min-h-[34px] items-center">
          {price == null
            ? "—"
            : new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 3,
              }).format(price) + " đ"}
        </div>
      </td>
      <td
        className="p-2 align-top text-left tabular-nums"
        aria-label={"Thành tiền dòng " + (index + 1)}
      >
        <div className="flex min-h-[34px] items-center">
          {total == null ? "—" : money(total)}
        </div>
        {(pendingReason || current?.valuation_status === "pending") && (
          <p role="status" className="mt-1 text-xs text-amber-700">
            ⚠ Chưa xác định giá trị – vẫn được xuất, cần bổ sung sau.
          </p>
        )}
        {resolved === key && error && (
          <p role="status" className="mt-1 text-xs text-amber-700">
            {error}
          </p>
        )}
      </td>
    </>
  );
}
