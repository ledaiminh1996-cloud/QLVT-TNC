import type { DraftLine } from "./documents";
export type ReceiptPriceMode = "unit_net" | "unit_gross" | "line_gross";
const round = (n: bigint, d: bigint) => (n + d / 2n) / d;
function decimal(raw: string, places: number, label: string) {
  if (
    !new RegExp(
      places === 0 ? "^\\d+$" : "^\\d+(?:\\.\\d{1," + places + "})?$",
    ).test(raw) ||
    raw.length > 30
  )
    throw new Error(label + ": tối đa " + places + " chữ số thập phân.");
  const [w, f = ""] = raw.split(".");
  return { n: BigInt(w + f), d: 10n ** BigInt(f.length) };
}
function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}
/** All arithmetic is rational BigInt. Derived repeating prices are never persisted as rounded decimals. */
export function receiptPricing(line: DraftLine) {
  const mode = line.pricing_mode || "unit_net";
  if (!["unit_net", "unit_gross", "line_gross"].includes(mode))
    throw new Error("Cách nhập giá không hợp lệ.");
  const value =
    mode === "unit_net" ? line.unit_price : (line.pricing_value ?? "");
  if (value === "") throw new Error("Nhập đơn giá hoặc thành tiền.");
  const q = decimal(line.quantity, 3, "Thực nhập"),
    p = decimal(value, mode === "line_gross" ? 0 : 12, "Giá"),
    r = decimal(line.vat_rate, 2, "VAT");
  if (q.n <= 0n) throw new Error("Thực nhập phải lớn hơn 0.");
  if (r.n > 100n * r.d) throw new Error("VAT không vượt quá 100%.");
  if (mode !== "line_gross" && p.n > 9000000000n * p.d)
    throw new Error("Đơn giá vượt giới hạn.");
  const factor = 100n * r.d + r.n;
  let net: bigint, gross: bigint, un: bigint, ud: bigint;
  if (mode === "unit_net") {
    un = p.n;
    ud = p.d;
    net = round(q.n * un, q.d * ud);
    gross = net + round(net * r.n, 100n * r.d);
  } else {
    gross = mode === "line_gross" ? p.n : round(q.n * p.n, q.d * p.d);
    net = round(gross * 100n * r.d, factor);
    un = p.n * 100n * r.d * (mode === "line_gross" ? q.d : 1n);
    ud = p.d * factor * (mode === "line_gross" ? q.n : 1n);
  }
  if (gross > 9000000000000n) throw new Error("Thành tiền vượt giới hạn.");
  if (un > 9000000000n * ud) throw new Error("Đơn giá suy ra vượt giới hạn.");
  const divisor = gcd(un, ud);
  un /= divisor;
  ud /= divisor;
  const fraction = un % ud;
  const digits = ((fraction * 10n ** 12n) / ud)
    .toString()
    .padStart(12, "0")
    .replace(/0+$/, "");
  const approximate = (fraction * 10n ** 12n) % ud !== 0n;
  return {
    net: Number(net),
    vat: Number(gross - net),
    gross: Number(gross),
    numerator: un.toString(),
    denominator: ud.toString(),
    legacyMilli: Number(round(un * 1000n, ud)),
    unitDisplay:
      (un / ud).toString() +
      (digits ? "," + digits : "") +
      (approximate ? "…" : ""),
    mode,
    value,
  };
}

export function receiptUnitDisplay(line: DraftLine): string {
  try {
    return receiptPricing(line).unitDisplay;
  } catch {
    return "—";
  }
}
