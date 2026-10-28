/** UI/Excel boundary only. API and stored JSON always use canonical decimal strings. */
import type { DocumentDraft, DraftLine } from "./documents";
export const numericLineLabels = {
  quantity: "Số lượng",
  document_quantity: "Số lượng chứng từ",
  unit_price: "Đơn giá",
  vat_rate: "Thuế GTGT (%)",
  odo: "ODO (km)",
  hours: "Giờ máy",
  retread_cost: "Chi phí đắp",
} as const;
export function normalizeViNumber(
  raw: string,
  label: string,
  integer = false,
): string {
  const value = raw.trim();
  if (!value) return "";
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(value))
    throw new Error(
      label +
        ": dùng dấu chấm hàng nghìn và dấu phẩy thập phân (ví dụ 150.000 hoặc 1,5).",
    );
  const canonical = value.replaceAll(".", "").replace(",", ".");
  if (integer && canonical.includes("."))
    throw new Error(label + ": số tiền VND phải là số nguyên đồng.");
  return canonical;
}
export function displayViNumber(value: string): string {
  return value.replace(".", ",");
}
export function formDraft(d: DocumentDraft): DocumentDraft {
  return {
    ...d,
    lines: d.lines.map((l) => ({
      ...l,
      ...Object.fromEntries(
        Object.keys(numericLineLabels).map((k) => [
          k,
          displayViNumber(l[k as keyof DraftLine] ?? ""),
        ]),
      ),
    })),
  };
}
export function normalizeDraftInput(d: DocumentDraft): DocumentDraft {
  return {
    ...d,
    proposal: d.proposal
      ? {
          ...d.proposal,
          ...Object.fromEntries(
            [
              "purchase_cost",
              "labor_cost",
              "other_cost",
              "vat_cost",
              "stock_reference",
            ]
              .filter(
                (k) => d.proposal?.[k as keyof typeof d.proposal] !== undefined,
              )
              .map((k) => [
                k,
                normalizeViNumber(
                  d.proposal?.[k as keyof typeof d.proposal] ?? "",
                  "Dự toán",
                  true,
                ),
              ]),
          ),
        }
      : undefined,
    lines: d.lines.map((l, index) => ({
      ...l,
      ...Object.fromEntries(
        Object.entries(numericLineLabels).map(([k, label]) => [
          k,
          normalizeViNumber(
            l[k as keyof DraftLine] ?? "",
            `Dòng ${index + 1} — ${label}`,
            ["unit_price", "retread_cost"].includes(k),
          ),
        ]),
      ),
    })),
  };
}
