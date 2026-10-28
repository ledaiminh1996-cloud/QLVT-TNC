import { receiptCostFields } from "./receiptCosts.ts";
/** UI/Excel boundary only. API and stored JSON always use canonical decimal strings. */
import type { DocumentDraft, DraftLine } from "./documents";
export const numericLineLabels = {
  quantity: "Số lượng",
  document_quantity: "Số lượng chứng từ",
  unit_price: "Đơn giá",
  pricing_value: "Giá / thành tiền",
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
    ...(d.opening_details?{opening_details:{...d.opening_details,vehicle_odo:displayViNumber(d.opening_details.vehicle_odo??""),trailer_odo:displayViNumber(d.opening_details.trailer_odo??"")}}:{}),
    recovery_details:d.recovery_details?{...d.recovery_details,odo:displayViNumber(d.recovery_details.odo),hours:displayViNumber(d.recovery_details.hours)}:undefined,
    issue_details: d.issue_details
      ? { ...d.issue_details, odo: displayViNumber(d.issue_details.odo),installation_odo:displayViNumber(d.issue_details.installation_odo??""),installation_hours:displayViNumber(d.issue_details.installation_hours??"") }
      : undefined,
    related_cost_items: d.related_cost_items?.map((i) => ({
      ...i,
      amount: displayViNumber(i.amount),
      vat_rate: displayViNumber(i.vat_rate),
    })),
    related_costs: d.related_costs
      ? (Object.fromEntries(
          receiptCostFields.map((f) => [
            f.key,
            displayViNumber(d.related_costs![f.key] ?? ""),
          ]),
        ) as typeof d.related_costs)
      : undefined,
    lines: d.lines.map((l) => ({
      ...l,
      ...(l.opening_current_unit_price!==undefined?{opening_current_unit_price:displayViNumber(l.opening_current_unit_price)}:{}),
      ...(l.opening_quality_percent!==undefined?{opening_quality_percent:displayViNumber(l.opening_quality_percent)}:{}),
      ...(l.recovery_current_unit_price!==undefined?{recovery_current_unit_price:displayViNumber(l.recovery_current_unit_price)}:{}),
      ...(l.recovery_quality_percent!==undefined?{recovery_quality_percent:displayViNumber(l.recovery_quality_percent)}:{}),
      ...(d.kind === "issue" ? { source_line_id: "" } : {}),
      ...Object.fromEntries(
        Object.keys(numericLineLabels).map((k) => [
          k,
          displayViNumber(l[k as keyof typeof numericLineLabels] ?? ""),
        ]),
      ),
    })),
  };
}
export function normalizeDraftInput(d: DocumentDraft): DocumentDraft {
  return {
    ...d,
    ...(d.opening_details?{opening_details:{...d.opening_details,vehicle_odo:normalizeViNumber(d.opening_details.vehicle_odo??"","ODO Đầu kéo"),trailer_odo:normalizeViNumber(d.opening_details.trailer_odo??"","ODO Rơ Moóc")}}:{}),
    recovery_details:d.recovery_details?{...d.recovery_details,odo:normalizeViNumber(d.recovery_details.odo,"ODO thu hồi"),hours:normalizeViNumber(d.recovery_details.hours,"Giờ máy thu hồi")}:undefined,
    issue_details: d.issue_details
      ? {
          ...d.issue_details,
          odo: normalizeViNumber(d.issue_details.odo, "ODO hiện tại"),
          installation_odo:normalizeViNumber(d.issue_details.installation_odo??"","ODO lúc lắp"),
          installation_hours:normalizeViNumber(d.issue_details.installation_hours??"","Giờ máy lúc lắp"),
        }
      : undefined,
    related_cost_items: d.related_cost_items?.map((i, index) => ({
      ...i,
      amount: normalizeViNumber(
        i.amount,
        `Chi phí ${index + 1}: Số tiền`,
        true,
      ),
      vat_rate: normalizeViNumber(
        i.vat_rate,
        `Chi phí ${index + 1}: VAT`,
        true,
      ),
    })),
    related_costs: d.related_costs
      ? (Object.fromEntries(
          receiptCostFields.map((f) => [
            f.key,
            normalizeViNumber(d.related_costs![f.key] ?? "", f.label, true),
          ]),
        ) as typeof d.related_costs)
      : undefined,
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
      ...(l.opening_current_unit_price!==undefined?{opening_current_unit_price:normalizeViNumber(l.opening_current_unit_price,"Giá mua hiện tại đầu kỳ")} : {}),
      ...(l.opening_quality_percent!==undefined?{opening_quality_percent:normalizeViNumber(l.opening_quality_percent,"Chất lượng đầu kỳ")} : {}),
      ...(l.recovery_current_unit_price!==undefined?{recovery_current_unit_price:normalizeViNumber(l.recovery_current_unit_price,"Giá mua hiện tại")} : {}),
      ...(l.recovery_quality_percent!==undefined?{recovery_quality_percent:normalizeViNumber(l.recovery_quality_percent,"Chất lượng thu hồi")} : {}),
      ...Object.fromEntries(
        Object.entries(numericLineLabels).map(([k, label]) => [
          k,
          normalizeViNumber(
            l[k as keyof typeof numericLineLabels] ?? "",
            `Dòng ${index + 1} — ${label}`,
            k === "retread_cost",
          ),
        ]),
      ),
    })),
  };
}

/** Group display digits without converting high precision prices to floating point. */
export function formatViNumber(raw: string): string {
  if (!raw.trim()) return "";
  const canonical = normalizeViNumber(raw, "Số tiền"),
    [whole, fraction] = canonical.split(".");
  return (
    new Intl.NumberFormat("vi-VN").format(BigInt(whole)) +
    (fraction !== undefined ? "," + fraction : "")
  );
}
