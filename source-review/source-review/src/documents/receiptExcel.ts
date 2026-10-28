import {documentDateTime} from "./documentFormatting";
import { displayInvoiceNumber } from "../../shared/invoiceNumber";
import {
  receiptCostFields,
  receiptExtraTotals,
  receiptCostItemTotals,
} from "../../shared/receiptCosts";
import {
  receiptTotals,
  normalizeReceiptUnits,
} from "../../shared/receiptTotals";
import { zipSync, strToU8 } from "fflate";
import type { DocumentRecord, DocumentSummary } from "../../shared/documents";
import { lineTotals, stockStates } from "../../shared/documents";
import { lineSerials } from "../../shared/documentSerials";
import { receiptUnitDisplay } from "../../shared/receiptPricing";
import { documentDate, documentCreatedAt } from "./documentFormatting";
export type Cell = string | number | null;
const escape = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function sheet(rows: Cell[][]) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map(
        (row, i) =>
          '<row r="' +
          (i + 1) +
          '">' +
          row
            .map((v, j) => {
              const ref = String.fromCharCode(65 + j) + (i + 1);
              return typeof v === "number" && Number.isFinite(v)
                ? '<c r="' + ref + '"><v>' + v + "</v></c>"
                : '<c r="' +
                    ref +
                    '" t="inlineStr"><is><t xml:space="preserve">' +
                    escape(v === null ? "" : String(v)) +
                    "</t></is></c>";
            })
            .join("") +
          "</row>",
      )
      .join("") +
    "</sheetData></worksheet>"
  );
}
/** Inline strings keep employee/material/serial identifiers intact and cannot become Excel formulas. */
export function buildReceiptWorkbook(row: DocumentRecord): Uint8Array {
  const lines: Cell[][] = [
    ["PHIẾU NHẬP KHO VT-TB"],
    ["Số phiếu", row.code],
    ["Ngày chứng từ", documentDateTime(row.draft.business_at)],
    ["Kho", row.labels["warehouses:" + row.draft.warehouse_id] ?? ""],
    ["Nhà cung cấp", row.labels["suppliers:" + row.draft.supplier_id] ?? ""],
    ["Số hóa đơn", displayInvoiceNumber(row.draft.invoice_number)],
    [
      "Ngày hóa đơn",
      row.draft.invoice_date ? documentDate(row.draft.invoice_date) : "",
    ],
    [],
    [
      "STT",
      "Mã vật tư",
      "Tên vật tư",
      "ĐVT",
      "SL chứng từ",
      "Thực nhập",
      "Đơn giá trước VAT (hiển thị)",
      "VAT %",
      "Tiền trước VAT",
      "VAT",
      "Thành tiền sau VAT",
      "Cách nhập giá",
      "Giá nhập gốc (chính xác)",
      "Ghi chú",
    ],
  ];
  const serials: Cell[][] = [
    ["Số phiếu", "STT dòng hàng", "Mã vật tư", "Serial", "Trạng thái hàng"],
  ];
  row.draft.lines.forEach((l, i) => {
    const amount = lineTotals(l, "receipt");
    lines.push([
      i + 1,
      row.labels["sku:" + l.part_id] ?? "",
      row.labels["parts:" + l.part_id] ?? "",
      row.labels["unit:" + l.part_id] ?? "",
      Number(l.document_quantity || l.quantity),
      Number(l.quantity),
      receiptUnitDisplay(l),
      Number(l.vat_rate),
      amount.net,
      amount.vat,
      amount.gross,
      l.pricing_mode === "unit_gross"
        ? "Đơn giá sau VAT"
        : l.pricing_mode === "line_gross"
          ? "Thành tiền sau VAT"
          : "Đơn giá trước VAT",
      l.pricing_mode && l.pricing_mode !== "unit_net"
        ? (l.pricing_value ?? "")
        : l.unit_price,
      l.notes,
    ]);
    lineSerials(l).forEach((serial) =>
      serials.push([
        row.code,
        i + 1,
        row.labels["sku:" + l.part_id] ?? "",
        serial,
        stockStates[l.stock_state],
      ]),
    );
  });
  const extra = receiptExtraTotals(
    row.draft.related_costs,
    row.draft.related_cost_items,
  );
  lines.push(
    [
      "A. Chi phí vật tư (trước VAT)",
      row.totals.net === null ? null : row.totals.net - extra.net,
    ],
    ["B. Chi phí liên quan"],
    ...(row.draft.related_costs
      ? receiptCostFields.map(
          (f) =>
            [
              f.label,
              Number(row.draft.related_costs?.[f.key] || "0"),
            ] as Cell[],
        )
      : []),
  );
  lines.push(
    ["Loại chi phí", "Số tiền (chưa VAT)", "VAT %", "Tiền VAT"],
    ...(row.draft.related_cost_items ?? []).map(
      (i) =>
        [
          i.name,
          Number(i.amount),
          Number(i.vat_rate),
          receiptCostItemTotals(i).vat,
        ] as Cell[],
    ),
  );
  lines.push(
    [],
    ["C. Tổng giá trị nhập kho (A+B)", row.totals.net],
    ["VAT", row.totals.vat],
    ["Tổng sau VAT", row.totals.gross],
  );
  return workbook(lines, serials);
}
function workbook(lines: Cell[][], serials: Cell[][]): Uint8Array {
  const xml: Record<string, string> = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Phiếu nhập" sheetId="1" r:id="rId1"/><sheet name="Serial" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheet(lines),
    "xl/worksheets/sheet2.xml": sheet(serials),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(xml).map(([name, text]) => [name, strToU8(text)]),
    ),
    { level: 6 },
  );
}
export function downloadReceiptExcel(row: DocumentRecord) {
  const bytes = buildReceiptWorkbook(row),
    url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  const a = document.createElement("a");
  a.href = url;
  a.download = row.code.replaceAll("/", "-") + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildReceiptListWorkbook(rows: DocumentSummary[]): Uint8Array {
  const lines: Cell[][] = [
    ["DANH SÁCH PHIẾU NHẬP KHO"],
    [
      "Số phiếu",
      "Ngày CT",
      "Kho",
      "Nhà cung cấp",
      "Số hóa đơn",
      "Mục đích / nội dung",
      "Tổng SL",
      "Sau VAT (đ)",
      "Trạng thái",
      "Tiền hàng (trước VAT)",
      "Tiền VAT",
      "Người tạo",
      "Ngày giờ tạo",
      "Số serial",
      "Người sửa cuối",
    ],
  ];
  rows.forEach((r) =>
    lines.push([
      r.code,
      documentDateTime(r.business_at),
      r.warehouse_label,
      r.partner_label,
      displayInvoiceNumber(r.invoice_number),
      r.purpose ?? "",
      r.total_quantity === undefined ||
      !r.quantity_units?.length ||
      normalizeReceiptUnits(r.quantity_units).includes("")
        ? null
        : normalizeReceiptUnits(r.quantity_units).length > 1
          ? "Nhiều ĐVT"
          : Number(r.total_quantity) / 1000,
      r.totals.gross,
      {
        posted: "Đã nhập kho",
        draft: "Nháp",
        cancelled: "Đã hủy",
        pending: "Chờ duyệt",
        approved: "Đã duyệt",
        returned: "Trả về",
        rejected: "Từ chối",
      }[r.status],
      r.totals.net,
      r.totals.vat,
      r.created_by_name,
      documentCreatedAt(r.created_at),
      (r.serial_numbers ?? []).join("\n"),
      r.last_edited_by_name ?? "",
    ]),
  );
  const sum = (key: "net" | "vat" | "gross") =>
    rows.some((r) => r.totals[key] === null)
      ? null
      : rows.reduce((s, r) => s + r.totals[key]!, 0);
  lines.push([
    "Tổng cộng",
    "",
    "",
    "",
    "",
    "",
    receiptTotals(rows).units.length === 1 && receiptTotals(rows).units[0]
      ? Number(receiptTotals(rows).quantity_milli) / 1000
      : null,
    sum("gross"),
    "",
    sum("net"),
    sum("vat"),
    "",
    "",
    "",
    "",
  ]);
  return workbook(lines, [
    ["Danh sách theo bộ lọc tại thời điểm xuất", "Số phiếu", rows.length],
  ]);
}
export function downloadReceiptListExcel(rows: DocumentSummary[]) {
  const bytes = buildReceiptListWorkbook(rows);
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "Danh-sach-phieu-nhap.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
