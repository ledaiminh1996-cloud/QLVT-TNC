import type { DocumentRecord } from "../../shared/documents";
import {
  receiptCostFields,
  receiptExtraTotals,
  receiptCostItemTotals,
} from "../../shared/receiptCosts";
import { money } from "./documentFormatting";
export function ReceiptPrintCosts({ row }: { row: DocumentRecord }) {
  const extra = receiptExtraTotals(
    row.draft.related_costs,
    row.draft.related_cost_items,
  );
  return (
    <section>
      <p className="number">
        Tiền hàng trước VAT (A):{" "}
        {money(row.totals.net === null ? null : row.totals.net - extra.net)}
      </p>
      <h2>B. Chi phí liên quan</h2>
      <table>
        <thead>
          <tr>
            <th>Loại chi phí</th>
            <th>Số tiền (chưa VAT)</th>
            <th>VAT %</th>
            <th>Tiền VAT</th>
          </tr>
        </thead>
        <tbody>
          {row.draft.related_costs &&
            receiptCostFields.map((f) => (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td className="number">
                  {money(Number(row.draft.related_costs?.[f.key] || "0"))}
                </td>
                <td>—</td>
                <td>—</td>
              </tr>
            ))}
          {(row.draft.related_cost_items ?? []).map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td className="number">{money(Number(i.amount))}</td>
              <td className="number">{i.vat_rate}%</td>
              <td className="number">{money(receiptCostItemTotals(i).vat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="number">Chi phí trước VAT (B): {money(extra.net)}</p>
      <p className="number">
        <strong>C. Tổng giá trị nhập kho (A+B): {money(row.totals.net)}</strong>
      </p>
      <p className="number">Tổng thuế GTGT: {money(row.totals.vat)}</p>
      <p className="number">
        <strong>Tổng thanh toán (gồm VAT): {money(row.totals.gross)}</strong>
      </p>
    </section>
  );
}
