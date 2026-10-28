import type { DocumentKind } from "./documents";
export type QuickColumn =
  | "source_code" | "target_type" | "target_code" | "opening_current_unit_price" | "opening_quality_percent" | "opening_assessor"
  | "sku"
  | "quantity"
  | "unit_price"
  | "vat_rate"
  | "data_package"
  | "stock_state"
  | "serial"
  | "issue_purpose"
  | "position"
  | "notes"
  | "recovery_classification"
  | "recovery_quality_percent";
export type QuickRow = Partial<Record<QuickColumn, string>>;
export function quickColumns(
  kind: DocumentKind,
  openingInUse = false,
): { key: QuickColumn; label: string; required?: boolean }[] {
  if(kind === "opening" && openingInUse)return [
    {key:"sku",label:"Mã vật tư",required:true},
    {key:"target_type",label:"Loại phương tiện"},
    {key:"target_code",label:"Biển số / mã thiết bị",required:true},
    {key:"position",label:"Vị trí lắp"},
    {key:"quantity",label:"Số lượng",required:true},
    {key:"serial",label:"Serial"},
    {key:"opening_current_unit_price",label:"Nguyên giá"},
    {key:"opening_quality_percent",label:"Tỷ lệ còn lại (%)"},
    {key:"opening_assessor",label:"Người xác nhận"},
    {key:"notes",label:"Ghi chú"},
  ];
  const incoming = ["receipt", "proposal", "opening"].includes(kind);
  return [
    { key: "sku", label: "Mã vật tư", required: true },
    { key: "quantity", label: "Số lượng", required: true },
    ...(incoming
      ? [
          { key: "unit_price" as const, label: "Đơn giá", required: true },
          ...(kind==="opening"?[]:[{ key: "vat_rate" as const, label: "VAT (%)" }]),
          { key: "data_package" as const, label: "Gói Data" },
        ]
      : kind === "recovery"
        ? [
            {
              key: "recovery_classification" as const,
              label: "Phân loại",
              required: true,
            },
            {
              key: "recovery_quality_percent" as const,
              label: "Chất lượng (%)",
              required: true,
            },
          ]
        : [
            {
              key: "stock_state" as const,
              label: "Trạng thái hàng",
              required: true,
            },
          ]),
    { key: "serial", label: "Serial" },
    ...(kind==="recovery"?[{key:"source_code" as const,label:"Số phiếu nguồn"},{key:"target_code" as const,label:"Biển số / mã thiết bị"}]:[]),
    ...(kind === "issue"
      ? [
          { key: "issue_purpose" as const, label: "Mục đích" },
          { key: "position" as const, label: "Vị trí lắp" },
        ]
      : []),
    { key: "notes", label: "Ghi chú" },
  ];
}
const heading = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases: Record<string, QuickColumn> = {
  sophieunguon:"source_code",
  phieuxuat:"source_code",
  loaiphuongtien:"target_type",
  biensomathietbi:"target_code",
  bienso:"target_code",
  nguyengia:"opening_current_unit_price",
  tyleconlai:"opening_quality_percent",
  nguoixacnhan:"opening_assessor",
  mavattu: "sku",
  mavt: "sku",
  sku: "sku",
  soluong: "quantity",
  sl: "quantity",
  slxuat: "quantity",
  dongia: "unit_price",
  vat: "vat_rate",
  vatphantram: "vat_rate",
  thuegtgt: "vat_rate",
  goidata: "data_package",
  trangthaihang: "stock_state",
  trangthai: "stock_state",
  serial: "serial",
  soserial: "serial",
  mucdich: "issue_purpose",
  vitrilap: "position",
  ghichu: "notes",
  phanloai: "recovery_classification",
  chatluong: "recovery_quality_percent",
  chatluongconlai: "recovery_quality_percent",
};
function tsv(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "\t" && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) result.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Thiếu dấu đóng ngoặc kép trong bảng.");
  row.push(cell.trim());
  if (row.some(Boolean)) result.push(row);
  return result;
}
export function parseQuickTable(text: string, kind: DocumentKind, openingInUse = false): QuickRow[] {
  if (!text.includes("\t"))
    throw new Error("Hãy sao chép bảng từ Excel kèm hàng tiêu đề.");
  const rows = tsv(text);
  if (!rows.length) throw new Error("Chưa có dữ liệu bảng.");
  const columns = quickColumns(kind, openingInUse),
    allowed = new Set(columns.map((c) => c.key));
  const seen = new Set<QuickColumn>();
  const keys = rows[0].map((label) => {
    const key = aliases[heading(label)];
    if (!key || !allowed.has(key))
      throw new Error(
        "Không nhận diện cột “" + label + "”. Hãy dùng tiêu đề trong bảng mẫu.",
      );
    if (seen.has(key)) throw new Error("Trùng cột “" + label + "”.");
    seen.add(key);
    return key;
  });
  for (const col of columns)
    if (col.required && !seen.has(col.key))
      throw new Error(
        "Thiếu cột “" + col.label + "”. Sao chép cả hàng tiêu đề.",
      );
  if (rows.length > 61) throw new Error("Tối đa 60 dòng vật tư.");
  return rows.slice(1).map((row, i) => {
    if (row.length !== keys.length)
      throw new Error(`Dòng ${i + 1}: số ô không khớp hàng tiêu đề.`);
    return Object.fromEntries(keys.map((key, j) => [key, row[j]])) as QuickRow;
  });
}
export function quickTableText(rows: QuickRow[], kind: DocumentKind, openingInUse = false): string {
  const cols = quickColumns(kind, openingInUse),
    quote = (value: string) =>
      /[\t\n\r"]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  return [
    cols.map((c) => c.label),
    ...rows.map((row) => cols.map((c) => row[c.key] ?? "")),
  ]
    .map((row) => row.map(quote).join("\t"))
    .join("\r\n");
}
