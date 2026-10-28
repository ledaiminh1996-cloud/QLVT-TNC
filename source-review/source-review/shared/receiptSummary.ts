import type { DraftLine } from "./documents";
import { receiptUnitDisplay } from "./receiptPricing.ts";
export function receiptPriceSummary(lines: DraftLine[]) {
  return {
    unit_prices: [
      ...new Set(
        lines.map((l) =>
          l.unit_price === "" && !l.pricing_value ? "" : receiptUnitDisplay(l).replace(",", ".").replace("—", ""),
        ),
      ),
    ],
    vat_rates: [...new Set(lines.map((l) => l.vat_rate))],
  };
}

