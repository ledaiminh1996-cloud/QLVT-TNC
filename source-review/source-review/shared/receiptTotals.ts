import type { DocumentSummary } from "./documents";
export interface ReceiptTotals {
  count: number;
  recovery_counts?:Record<import("./recoveryDetails").RecoveryClass,number>;
  status_counts?: { posted: number; cancelled: number };
  quantity_milli: string;
  units: string[];
  net: string | null;
  vat: string | null;
  gross: string | null;
}
export function normalizeReceiptUnits(units: string[]): string[] {
  return [
    ...new Set(
      units.map((u) => u.normalize("NFC").trim().toLocaleLowerCase("vi-VN")),
    ),
  ];
}
export function receiptTotals(rows: DocumentSummary[]): ReceiptTotals {
  const sum = (key: "net" | "vat" | "gross") =>
    rows.some((r) => r.totals[key] === null)
      ? null
      : String(rows.reduce((s, r) => s + BigInt(r.totals[key]!), 0n));
  return {
    count: rows.length,
    ...(rows.some(r=>r.kind==="recovery")?{recovery_counts:Object.fromEntries((["CSD","CSC","KSD","CTL"] as const).map(c=>[c,rows.reduce((n,r)=>n+(r.recovery_counts?.[c]??0),0)])) as NonNullable<ReceiptTotals["recovery_counts"]>}:{}),
    status_counts: {
      posted: rows.filter((r) => r.status === "posted").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    },
    quantity_milli: String(
      rows.reduce((s, r) => s + BigInt(r.total_quantity ?? "0"), 0n),
    ),
    units: normalizeReceiptUnits(rows.flatMap((r) => r.quantity_units ?? [""])),
    net: sum("net"),
    vat: sum("vat"),
    gross: sum("gross"),
  };
}
