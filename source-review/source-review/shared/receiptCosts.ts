import type { DocumentDraft } from "./documents";
import { receiptPricing } from "./receiptPricing.ts";
export const receiptCostFields = [
  { key: "transport", label: "Chi phí vận chuyển" },
  { key: "unloading", label: "Chi phí bốc dỡ" },
  { key: "installation", label: "Chi phí nhân công thay thế lắp đặt" },
  { key: "other", label: "Chi phí khác" },
  { key: "vat", label: "Thuế GTGT (nếu có)" },
] as const;
export type ReceiptCostKey = (typeof receiptCostFields)[number]["key"];
export type ReceiptCosts = Record<ReceiptCostKey, string>;
export const emptyReceiptCosts = (): ReceiptCosts => ({
  transport: "",
  unloading: "",
  installation: "",
  other: "",
  vat: "",
});
const max = 9000000000000n;
export function parseReceiptCosts(value: unknown): ReceiptCosts {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Chi phí liên quan không hợp lệ.");
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some((k) => !receiptCostFields.some((f) => f.key === k))
  )
    throw new Error("Chi phí liên quan có trường không được hỗ trợ.");
  const result = emptyReceiptCosts();
  for (const f of receiptCostFields) {
    const raw = data[f.key] ?? "";
    if (
      typeof raw !== "string" ||
      !/^\d*$/.test(raw) ||
      raw.length > 13 ||
      BigInt(raw || "0") > max
    )
      throw new Error(
        f.label + ": nhập số nguyên đồng không âm, tối đa 9.000.000.000.000 đ.",
      );
    result[f.key] = raw;
  }
  receiptExtraTotals(result);
  return result;
}
export const receiptCostTypes = [
  { value: "transport", label: "Vận chuyển" },
  { value: "unloading", label: "Bốc dỡ" },
  { value: "insurance", label: "Bảo hiểm" },
  { value: "import_duty", label: "Thuế nhập khẩu" },
  { value: "other", label: "Khác" },
] as const;
export type ReceiptCostItem = {
  id: string;
  type: (typeof receiptCostTypes)[number]["value"];
  name: string;
  amount: string;
  vat_rate: string;
};
export function parseReceiptCostItems(value: unknown): ReceiptCostItem[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("Chi phí liên quan: tối đa 100 khoản.");
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const prefix = `Chi phí ${index + 1}: `;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error(prefix + "dữ liệu không hợp lệ.");
    const r = raw as Record<string, unknown>;
    if (
      Object.keys(r).some(
        (k) => !["id", "type", "name", "amount", "vat_rate"].includes(k),
      )
    )
      throw new Error(prefix + "có trường không được hỗ trợ.");
    if (typeof r.id !== "string" || !r.id || r.id.length > 128 || ids.has(r.id))
      throw new Error(prefix + "mã dòng trống hoặc trùng.");
    ids.add(r.id);
    const type = receiptCostTypes.find((t) => t.value === r.type);
    if (!type) throw new Error(prefix + "chọn loại chi phí.");
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (
      !name ||
      name.length > 256 ||
      (type.value === "other" && name.toLocaleLowerCase("vi-VN") === "khác")
    )
      throw new Error(prefix + "nhập tên chi phí cụ thể.");
    if (
      typeof r.amount !== "string" ||
      !/^\d+$/.test(r.amount) ||
      r.amount.length > 13 ||
      BigInt(r.amount) > max
    )
      throw new Error(prefix + "số tiền phải là số nguyên đồng không âm.");
    if (
      typeof r.vat_rate !== "string" ||
      !/^\d{1,3}$/.test(r.vat_rate) ||
      Number(r.vat_rate) > 100
    )
      throw new Error(prefix + "VAT không hợp lệ.");
    return {
      id: r.id,
      type: type.value,
      name,
      amount: r.amount,
      vat_rate: r.vat_rate,
    };
  });
}
export function receiptCostItemTotals(item: ReceiptCostItem) {
  const net = BigInt(item.amount || "0"),
    rate = BigInt(item.vat_rate || "0"),
    vat = (net * rate + 50n) / 100n;
  return { net: Number(net), vat: Number(vat), gross: Number(net + vat) };
}
export function receiptExtraTotals(
  costs?: ReceiptCosts,
  items?: ReceiptCostItem[],
) {
  const net =
    receiptCostFields
      .filter((f) => f.key !== "vat")
      .reduce((s, f) => s + BigInt(costs?.[f.key] || "0"), 0n) +
    (items ?? []).reduce((s, i) => s + BigInt(i.amount || "0"), 0n);
  const vat =
    BigInt(costs?.vat || "0") +
    (items ?? []).reduce(
      (s, i) => s + BigInt(receiptCostItemTotals(i).vat),
      0n,
    );
  if (net < 0n || vat < 0n || net + vat > max)
    throw new Error("Tổng chi phí liên quan vượt giới hạn.");
  return { net: Number(net), vat: Number(vat), gross: Number(net + vat) };
}
/** Allocate whole dong by invoice net value, largest remainder; zero-value lines split evenly. */
export function receiptLandedCosts(draft: DocumentDraft) {
  const amounts = draft.lines.map((l, i) => {
    try {
      return receiptPricing(l);
    } catch (e) {
      throw new Error(
        `Dòng ${i + 1}: ${e instanceof Error ? e.message : "Giá không hợp lệ"}`,
      );
    }
  });
  const extra = BigInt(
      receiptExtraTotals(draft.related_costs, draft.related_cost_items).net,
    ),
    base = amounts.reduce((s, a) => s + BigInt(a.net), 0n);
  const weights = amounts.map((a) => (base === 0n ? 1n : BigInt(a.net))),
    denom = base || BigInt(amounts.length);
  const shares = weights.map((w, index) => ({
    index,
    value: (extra * w) / denom,
    remainder: (extra * w) % denom,
  }));
  let remaining = extra - shares.reduce((s, a) => s + a.value, 0n);
  for (const s of [...shares].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (remaining === 0n) break;
    s.value++;
    remaining--;
  }
  return amounts.map((amount, i) => ({
    amount,
    allocated: Number(shares[i].value),
    landed: amount.net + Number(shares[i].value),
  }));
}
