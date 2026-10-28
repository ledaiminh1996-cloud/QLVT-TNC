import {documentDateTime} from "./documentFormatting";
import { issuePurposes,issueInstallationLabel } from "../../shared/issueDetails";
import { normalizeReceiptUnits } from "../../shared/receiptTotals";
import { zipSync, strToU8 } from "fflate";
import { sheet, type Cell } from "./receiptExcel";
import type { DocumentRecord, DocumentSummary } from "../../shared/documents";
import { lineSerials } from "../../shared/documentSerials";
import { documentDate, documentCreatedAt } from "./documentFormatting";
import { receiptQuantity } from "./ReceiptTable";
function workbook(rows: Cell[][]) {
  return zipSync(
    Object.fromEntries(
      Object.entries({
        "[Content_Types].xml":
          '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels":
          '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml":
          '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Phiếu xuất" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels":
          '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": sheet(rows),
      }).map(([k, v]) => [k, strToU8(v)]),
    ),
    { level: 6 },
  );
}
function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function buildIssueListWorkbook(rows: DocumentSummary[]) {
  return workbook([
    ["DANH SÁCH PHIẾU XUẤT KHO"],
    [
      "Số phiếu",
      "Ngày CT",
      "Kho",
      "Người nhận",
      "Mục đích/nội dung",
      "Tổng SL (theo ĐVT)",
      "Giá trị xuất (đ)",
      "Trạng thái",
      "Người tạo",
      "Ngày giờ tạo",
      "Serial",
    ],
    ...rows.map((r) => [
      r.code,
      documentDateTime(r.business_at),
      r.warehouse_label,
      r.partner_label,
      r.purpose ?? "",
      normalizeReceiptUnits(r.quantity_units ?? []).length === 1 &&
      normalizeReceiptUnits(r.quantity_units ?? [])[0]
        ? receiptQuantity(r.total_quantity) +
          " " +
          normalizeReceiptUnits(r.quantity_units ?? [])[0]
        : normalizeReceiptUnits(r.quantity_units ?? []).length > 1
          ? "Nhiều ĐVT"
          : "—",
      r.totals.net,
      r.status === "posted"
        ? "Đã xuất kho"
        : r.status === "cancelled"
          ? "Đã hủy"
          : "Nháp",
      r.created_by_name,
      documentCreatedAt(r.created_at),
      (r.serial_numbers ?? []).join("\n"),
    ]),
  ]);
}
export function downloadIssueListExcel(rows: DocumentSummary[]) {
  download(buildIssueListWorkbook(rows), "Danh-sach-phieu-xuat");
}
export function buildIssueWorkbook(row: DocumentRecord) {
  return workbook([
    ["PHIẾU XUẤT KHO VT-TB"],
    ["Số phiếu", row.code],
    ["Ngày CT", documentDateTime(row.draft.business_at)],
    ["Kho", row.labels["warehouses:" + row.draft.warehouse_id] ?? ""],
    ["Người nhận", row.draft.recipient],
    ["Bộ phận nhận", row.draft.issue_details?.department_name ?? ""],
    ["Họ tên lái xe", row.draft.issue_details?.driver_name ?? ""],
    ["Biển số xe", row.draft.issue_details?.vehicle_plate ?? ""],
    ["ODO hiện tại", row.draft.issue_details?.odo ?? ""],
    [
      "Nhóm xe",
      (
        {
          BNAM: "Đường dài",
          DCANG: "Đường cảng",
          box_truck: "Xe tải thùng",
          office_car: "Xe con",
        } as Record<string, string>
      )[row.draft.issue_details?.vehicle_group ?? ""] ?? "",
    ],
    ["Rơmooc số", row.draft.issue_details?.trailer_number ?? ""],
    ["Máy phát", row.draft.issue_details?.other ?? ""],
    ["Container số", row.draft.issue_details?.container_number ?? ""],
    ["Phương tiện lắp thiết bị",issueInstallationLabel(row.draft.issue_details)],
    ["ODO lúc lắp",row.draft.issue_details?.installation_target==="vehicle"?row.draft.issue_details.odo:row.draft.issue_details?.installation_odo??""],
    ["Giờ máy lúc lắp",row.draft.issue_details?.installation_hours??""],
    ["Nội dung", row.draft.purpose],
    ["Giá trị xuất (đ)", row.totals.net],
    [
      "Vật tư",
      "ĐVT",
      "Số lượng",
      "Trạng thái hàng",
      "Serial",
      "Thiết bị nhận",
      "Vị trí lắp",
      "ODO (km)",
      "Giờ máy",
      "Mục đích",
      "Ghi chú",
    ],
    ...row.draft.lines.map((l) => [
      row.labels["parts:" + l.part_id] ?? "",
      row.labels["unit:" + l.part_id] ?? "",
      Number(l.quantity),
      l.stock_state,
      lineSerials(l).join("\n"),
      row.labels[
        (l.target_type === "vehicle" ? "vehicles:" : "equipment:") + l.target_id
      ] ?? "",
      l.to_position,
      l.odo,
      l.hours,
      issuePurposes[l.issue_purpose ?? "use"],
      l.notes,
    ]),
  ]);
}
export function downloadIssueExcel(row: DocumentRecord) {
  download(buildIssueWorkbook(row), row.code.replaceAll("/", "-"));
}
