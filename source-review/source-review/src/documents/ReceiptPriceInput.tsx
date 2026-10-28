import type { DraftLine } from "../../shared/documents";
import { receiptPricing } from "../../shared/receiptPricing";
import {
  normalizeViNumber,
  formatViNumber,
} from "../../shared/documentNumbers";
import { docInput } from "./CatalogPicker";
export function ReceiptPriceInput({
  item,
  index,
  disabled,
  view = false,
  onChange,
}: {
  item: DraftLine;
  index: number;
  disabled: boolean;
  view?: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
}) {
  const mode = item.pricing_mode || "unit_net";
  let derived = "—";
  try {
    derived = receiptPricing({
      ...item,
      quantity: normalizeViNumber(item.quantity, "Thực nhập"),
      unit_price: normalizeViNumber(item.unit_price, "Đơn giá"),
      vat_rate: normalizeViNumber(item.vat_rate, "VAT"),
      pricing_value: normalizeViNumber(
        item.pricing_value ?? "",
        "Giá / thành tiền",
      ),
    }).unitDisplay;
  } catch {}
  const rawValue =
    mode === "unit_net"
      ? item.unit_price
      : derived === "—"
        ? ""
        : derived.replace("…", "");
  let display = rawValue;
  try {
    if (view)
      display =
        formatViNumber(rawValue) +
        (derived.includes("…") && mode !== "unit_net" ? "…" : "");
  } catch {}
  return (
    <input
      aria-label={"Đơn giá dòng " + (index + 1)}
      title={
        mode === "unit_net"
          ? "Đơn giá trước VAT"
          : "Đơn giá trước VAT hiển thị rút gọn; giá gốc được giữ nguyên khi chưa chỉnh sửa ô này."
      }
      className={docInput + " !px-1.5 text-right tabular-nums"}
      inputMode="decimal"
      disabled={disabled}
      value={display}
      onChange={(e) =>
        onChange({
          unit_price: e.target.value,
          pricing_mode: "unit_net",
          pricing_value: "",
        })
      }
    />
  );
}
