import {OpeningUsagePrint} from "./OpeningUsagePrint";
import {RecoveryPrint,recoveryPrintCss} from "./RecoveryPrint";
import { IssuePrint,issuePrintCss } from "./IssuePrint";
import { ReceiptPrint, receiptPrintCss } from "./ReceiptPrint";
import { lineSerials } from "../../shared/documentSerials";
import { documentDate } from "./documentFormatting";
import { ProposalPrint } from "./ProposalPrint";
import type { DocumentRecord } from "../../shared/documents";
import { documentKinds, stockStates, lineTotals } from "../../shared/documents";
import { money } from "./DocumentEditor";
import { renderToStaticMarkup } from "react-dom/server";
export function printDraft(row: DocumentRecord) {
  const openingStock=row.draft.kind==="opening"&&row.draft.opening_mode!=="in_use";
  const html = renderToStaticMarkup(
    row.draft.kind==="opening"&&row.draft.opening_mode==="in_use"?(<OpeningUsagePrint row={row}/>):row.draft.kind === "proposal" ? (
      <ProposalPrint row={row} />
    ) : row.draft.kind === "receipt" ? (
      <ReceiptPrint row={row} />
    ) : row.draft.kind === "issue" ? (
      <IssuePrint row={row} />
    ) : row.draft.kind==="recovery"?(<RecoveryPrint row={row}/>): (
      <main>
        <h1>{documentKinds[row.draft.kind].label}</h1>
        <p className="watermark">
          {row.status === "posted" ? "ĐÃ GHI SỔ" : "BẢN NHÁP / CHƯA GHI SỔ KHO"}
        </p>
        <p>
          Số: <span className="code">{row.code}</span> · Ngày:{" "}
          {documentDate(row.draft.business_at)}
        </p>
        <p>Kho: {row.labels["warehouses:" + row.draft.warehouse_id] ?? "—"}</p>
        <p>
          Đối tác / người nhận:{" "}
          {row.labels["suppliers:" + row.draft.supplier_id] ??
            row.draft.recipient ??
            "—"}
        </p>
        <p>
          Diễn giải: {row.draft.purpose} {row.draft.notes}
        </p>
        <table>
          <thead>
            <tr>
              <th>Vật tư</th>
              <th>Serial</th>
              <th>Trạng thái</th>
              <th className="number">Số lượng</th>
              <th className="number">{openingStock?"Đơn giá":"Đơn giá trước VAT"}</th>
              {!openingStock&&<th className="number">VAT %</th>}
              <th className="number">{openingStock?"Thành tiền":"Thành tiền sau VAT"}</th>
              {openingStock&&<th>Ghi chú</th>}
            </tr>
          </thead>
          <tbody>
            {row.draft.lines.map((line) => (
              <tr key={line.id}>
                <td>{row.labels["parts:" + line.part_id]}</td>
                <td className="code">{lineSerials(line).join(", ")}</td>
                <td>{stockStates[line.stock_state]}</td>
                <td className="number">{line.quantity}</td>
                <td className="number">{line.unit_price || "—"}</td>
                {!openingStock&&<td className="number">
                  {documentKinds[row.draft.kind].priced ? line.vat_rate : "—"}
                </td>}
                <td className="number">
                  {money(lineTotals(line, row.draft.kind).gross)}
                </td>
                {openingStock&&<td>{line.notes}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="number">{openingStock?"Tổng thành tiền":"Tổng sau VAT"}: {money(row.totals.gross)}</p>
        <p>Người lập: {row.created_by_name}</p>
      </main>
    ),
  );
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Bản in chứng từ");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const target = frame.contentDocument;
  if (!target) {
    frame.remove();
    throw new Error("Không mở được bản in.");
  }
  const embedded = Array.from(document.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("");
  const css = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  )
    .map((link) => '<link rel="stylesheet" href="' + link.href + '">')
    .join("");
  const loaded = new Promise<void>((resolve) => {
    frame.onload = () => resolve();
  });
  target.open();
  target.write(
    '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bản in chứng từ</title>' +
      css +
      embedded +
      "<style>body{font-family:var(--font-sans),Arial,sans-serif;font-size:12px;color:#0f172a;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #cbd5e1;text-align:left}.number{text-align:right;font-variant-numeric:tabular-nums}.code{font-family:var(--font-mono),monospace;font-size:11px}.watermark{color:#b45309;font-weight:bold}@page{size:A4 landscape;margin:12mm}</style>" +
      (["receipt", "issue","recovery"].includes(row.draft.kind)||(row.draft.kind==="opening"&&row.draft.opening_mode==="in_use")
        ? "<style>" + receiptPrintCss + (row.draft.kind==="issue"?issuePrintCss:row.draft.kind==="recovery"?recoveryPrintCss:"") + "</style>"
        : "") +
      "</head><body>" +
      html +
      "</body></html>",
  );
  target.close();
  const win = frame.contentWindow;
  let cleaned = false;
  const cleanup = () => {
    if (!cleaned) {
      cleaned = true;
      frame.remove();
    }
  };
  win?.addEventListener("afterprint", cleanup, { once: true });
  void loaded
    .then(() => target.fonts.ready)
    .then(() => {
      win?.focus();
      win?.print();
    });
  setTimeout(cleanup, 120000);
}
