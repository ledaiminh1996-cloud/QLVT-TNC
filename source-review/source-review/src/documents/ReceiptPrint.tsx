import {documentDateTime} from "./documentFormatting";
import type { DocumentRecord } from "../../shared/documents";
import { lineTotals, stockStates } from "../../shared/documents";
import { lineSerials } from "../../shared/documentSerials";
import {
  receiptCostFields,
  receiptCostItemTotals,
  receiptExtraTotals,
} from "../../shared/receiptCosts";
import { receiptPricing } from "../../shared/receiptPricing";
import { displayInvoiceNumber } from "../../shared/invoiceNumber";
import { documentDate } from "./documentFormatting";
const blank =
  "................................................................";
const num = (v: number | null) =>
  v === null ? "—" : new Intl.NumberFormat("vi-VN").format(v);
const labelName = (v: string) =>
  v.includes(" — ") ? v.slice(v.indexOf(" — ") + 3) : v;
function unitPrice(line: DocumentRecord["draft"]["lines"][number]) {
  try {
    const raw = receiptPricing(line).unitDisplay;
    const [whole, decimal] = raw.split(",");
    return (
      new Intl.NumberFormat("vi-VN").format(BigInt(whole)) +
      (decimal ? "," + decimal : "")
    );
  } catch {
    return "—";
  }
}
/** Split only the printed rows; allocate whole-dong totals without recalculating rounded unit prices. */
export function receiptPrintRows(draft: DocumentRecord["draft"]) {
  let sequence = 0;
  return draft.lines.flatMap((line) => {
    const serials = lineSerials(line);
    const totals = lineTotals(line, "receipt");
    if (!serials.length || Number(line.quantity) !== serials.length)
      return [
        {
          line,
          sequence: ++sequence,
          quantity: line.quantity,
          serials,
          net: totals.net,
          vat: totals.vat,
          incomplete: serials.length > 0,
          rounding: false,
        },
      ];
    const share = (total: number | null, index: number) =>
      total === null
        ? null
        : Number(
            BigInt(total) / BigInt(serials.length) +
              (BigInt(index) < BigInt(total) % BigInt(serials.length)
                ? 1n
                : 0n),
          );
    const rounding = [totals.net, totals.vat].some(
      (v) => v !== null && v % serials.length !== 0,
    );
    return serials.map((serial, index) => ({
      line,
      sequence: ++sequence,
      quantity: "1",
      serials: [serial],
      net: share(totals.net, index),
      vat: share(totals.vat, index),
      incomplete: false,
      rounding,
    }));
  });
}
export function ReceiptPrint({ row }: { row: DocumentRecord }) {
  const { draft, labels } = row;
  const extra = receiptExtraTotals(
    draft.related_costs,
    draft.related_cost_items,
  );
  const goodsNet = row.totals.net === null ? null : row.totals.net - extra.net;
  const goodsVat = row.totals.vat === null ? null : row.totals.vat - extra.vat;
  const supplier = draft.supplier_id;
  const printedRows = receiptPrintRows(draft);
  const costs = [
    ...(draft.related_costs
      ? receiptCostFields
          .filter(
            (f) =>
              f.key !== "vat" &&
              Number(draft.related_costs?.[f.key] || 0) !== 0,
          )
          .map((f) => ({
            id: f.key,
            name: f.label,
            net: Number(draft.related_costs![f.key]),
            vat: null as number | null,
            rate: "—",
          }))
      : []),
    ...(draft.related_cost_items ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      net: Number(c.amount),
      vat: receiptCostItemTotals(c).vat,
      rate: c.vat_rate + "%",
    })),
  ];
  return (
    <main className="receipt-print">
      <div className="receipt-page-id">
        Số phiếu: {row.code} · Ngày {documentDateTime(draft.business_at)}
      </div>
      <header>
        <div className="company">
          CÔNG TY TNHH DV VÀ TM TÂN NAM CHINH. MÃ SỐ THUẾ: 0303955513
        </div>
        <h1>PHIẾU NHẬP VẬT TƯ – THIẾT BỊ</h1>
        <div className="document-number">
          Số: <strong>{row.code}</strong> · Ngày{" "}
          {documentDateTime(draft.business_at)}
        </div>
      </header>
      {row.status !== "posted" && (
        <div className="receipt-watermark">
          {row.status === "cancelled" ? "PHIẾU ĐÃ HỦY" : "CHƯA GHI SỔ KHO"}
        </div>
      )}
      <section className="receipt-meta">
        <p>
          Tên nhà cung cấp:{" "}
          <strong>
            {labelName(labels["suppliers:" + supplier] ?? "") || blank}
          </strong>
        </p>
        <p>
          Mã số thuế:{" "}
          {labels["tax:suppliers:" + supplier] || "........................"}{" "}
          <span className="address">
            Địa chỉ:{" "}
            {[
              labels["address:suppliers:" + supplier],
              labels["province:suppliers:" + supplier],
            ]
              .filter(Boolean)
              .join(", ") || blank}
          </span>
        </p>
        <p>
          Kho nhập:{" "}
          <strong>
            {labels["warehouses:" + draft.warehouse_id] ||
              "........................"}
          </strong>{" "}
          <span className="address">
            Theo hóa đơn số:{" "}
            <strong>
              {displayInvoiceNumber(draft.invoice_number) || "................"}
            </strong>{" "}
            · Ngày{" "}
            {draft.invoice_date
              ? documentDate(draft.invoice_date)
              : "..../..../........"}
          </span>
        </p>
        {draft.purpose && <p>Nội dung: {draft.purpose}</p>}
      </section>
      <h2>1. Hàng hóa</h2>
      <table className="receipt-goods">
        <colgroup>
          {[4, 12, 18, 5, 7, 5, 10, 11, 9, 12, 7].map((w, i) => (
            <col key={i} style={{ width: w + "%" }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {[
              "STT",
              "Mã vật tư",
              "Tên vật tư",
              "ĐVT",
              "Chất lượng",
              "Số lượng",
              "Đơn giá",
              "Thành tiền (chưa GTGT)",
              "Thuế GTGT",
              "Số serial (nếu có)",
              "Ghi chú",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {printedRows.map((printed) => {
            const l = printed.line;
            return (
              <tr
                key={l.id + ":" + printed.sequence}
                data-serial-row={
                  printed.serials.length === 1 ? printed.serials[0] : undefined
                }
              >
                <td className="center">{printed.sequence}</td>
                <td className="code">
                  {labels["sku:" + l.part_id] ||
                    labels["parts:" + l.part_id]?.split(" — ")[0] ||
                    "—"}
                </td>
                <td>{labelName(labels["parts:" + l.part_id] || "")}</td>
                <td className="center">{labels["unit:" + l.part_id] || "—"}</td>
                <td className="center">{stockStates[l.stock_state]}</td>
                <td className="number">{num(Number(printed.quantity))}</td>
                <td className="number">{unitPrice(l)}</td>
                <td className="number">{num(printed.net)}</td>
                <td className="number">
                  {num(printed.vat)}
                  <small>({l.vat_rate}%)</small>
                </td>
                <td className="code">
                  {printed.serials.map((serial, index) => (
                    <div key={index}>{serial}</div>
                  ))}
                </td>
                <td>
                  {l.notes}
                  {printed.incomplete && <div>Chưa khớp số lượng serial</div>}
                </td>
              </tr>
            );
          })}
          <tr className="receipt-total">
            <td colSpan={7}>Tổng cộng hàng hóa (1)</td>
            <td className="number">{num(goodsNet)}</td>
            <td className="number">{num(goodsVat)}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
      {printedRows.some((r) => r.rounding) && (
        <p className="receipt-rounding">
          Tiền hàng và thuế từng serial được phân bổ từ tổng dòng vật tư, giữ
          nguyên tổng tiền phiếu; có thể chênh 1 đồng do làm tròn.
        </p>
      )}
      <section className="receipt-bottom">
        <h2>2. Chi phí liên quan</h2>
        {costs.length ? (
          <table className="receipt-costs">
            <thead>
              <tr>
                <th>Loại chi phí</th>
                <th>Số tiền (chưa VAT)</th>
                <th>VAT %</th>
                <th>Tiền VAT</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="number">{num(c.net)}</td>
                  <td className="center">{c.rate}</td>
                  <td className="number">
                    {c.vat === null ? "—" : num(c.vat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Không phát sinh chi phí liên quan.</p>
        )}
        {draft.related_costs && Number(draft.related_costs.vat || 0) > 0 && (
          <p>
            Thuế GTGT chi phí đã lưu: {num(Number(draft.related_costs.vat))} đ
          </p>
        )}
        <p className="cost-subtotal">
          Cộng chi phí (2): <strong>{num(extra.net)} đ</strong> · Thuế GTGT chi
          phí: <strong>{num(extra.vat)} đ</strong>
        </p>
        <div className="receipt-grand">
          <span>
            3. Tổng giá trị nhập kho (1+2):{" "}
            <strong>{num(row.totals.net)} đ</strong>
          </span>
          <span>
            Tổng thuế GTGT: <strong>{num(row.totals.vat)} đ</strong>
          </span>
        </div>
        <p className="payment">
          Tổng thanh toán (gồm GTGT): <strong>{num(row.totals.gross)} đ</strong>
        </p>
        <div className="receipt-signatures">
          {["Người lập phiếu", "Người giao hàng", "Thủ kho", "Kế toán"].map(
            (s, i) => (
              <div key={s}>
                <strong>{s}</strong>
                <em>(Ký, ghi rõ họ tên)</em>
                <div className="signature-space" />
                {i === 0 && <strong>{row.created_by_name}</strong>}
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
export const receiptPrintCss = `
@page{size:A4 portrait;margin:10mm 10mm 15mm;@bottom-right{content:"Trang " counter(page) " / " counter(pages);font:9px Arial;color:#475569}}
body{margin:0;padding:0;background:white!important;color:#111827!important}
.receipt-print{font-family:var(--font-sans),Arial,sans-serif;font-size:11px;line-height:1.4;color:#111827;}
.receipt-print .receipt-page-id{display:none}@media print{.receipt-print .receipt-page-id{display:block;position:fixed;bottom:-10mm;left:0;font-size:9px;color:#475569}}
.receipt-print header{text-align:center;color:#173f8a;margin-bottom:10px}
.receipt-print .company{font-size:13px;font-weight:700}.receipt-print h1{font-size:19px;margin:4px 0;font-weight:800}.receipt-print .document-number{font-size:12px}
.receipt-print h2{font-size:12px;font-weight:700;margin:9px 0 4px;color:#173f8a}.receipt-print h3{font-size:11px;font-weight:600;margin:7px 0}
.receipt-print p{margin:4px 0}.receipt-print .address{margin-left:20px}.receipt-print .receipt-meta{font-size:11px}
.receipt-print table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px}.receipt-print th,.receipt-print td{border:1px solid #94a3b8;padding:4px 3px;vertical-align:top;text-align:left;overflow-wrap:anywhere}.receipt-print th{font-weight:700;text-align:center;background:#eef3fb!important;color:#173f8a;vertical-align:middle}
.receipt-print thead{display:table-header-group}.receipt-print tr{break-inside:avoid}.receipt-print .number{text-align:right;font-variant-numeric:tabular-nums}.receipt-print .center{text-align:center}.receipt-print .code{font-family:var(--font-mono),monospace;font-size:8px}.receipt-print small{display:block;font-size:9px;color:#475569}.receipt-print .receipt-total{font-weight:700;background:#f8fafc!important}
.receipt-print .receipt-costs{width:100%}.receipt-print .receipt-costs th:first-child{width:48%}.receipt-print .receipt-bottom{break-inside:avoid}.receipt-print .receipt-grand{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;border-top:1px solid #94a3b8;padding-top:7px;margin-top:6px;font-size:12px;font-weight:600}.receipt-print .payment{text-align:right;font-size:12px}.receipt-print .receipt-signatures{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;margin-top:15px;font-size:11px}.receipt-print .receipt-signatures em{display:block;font-size:10px;font-weight:400}.receipt-print .signature-space{height:55px}.receipt-print .receipt-watermark{text-align:center;font-weight:700;color:#9a3412;padding:4px;border:1px solid #9a3412;margin-bottom:6px}.receipt-print .receipt-rounding{font-size:9px;color:#475569}.receipt-print .receipt-table-reference th{text-align:left;background:white!important;font-size:10px;padding:3px 5px}.receipt-print .serial-index{font-family:var(--font-sans),Arial,sans-serif;color:#64748b;font-size:9px}.receipt-print .serial-group{margin-bottom:10px}.receipt-print *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;
