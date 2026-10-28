import type { ReceiptTotals } from "../../shared/receiptTotals";
import { normalizeReceiptUnits } from "../../shared/receiptTotals";
import { receiptQuantity } from "./ReceiptTable";
export function ReceiptSummaryCards({
  kind = "receipt",
  totals,
  status,
  pending,
  onStatusChange,
}: {
  kind?: "receipt" | "issue";
  totals?: ReceiptTotals;
  status: string;
  pending: boolean;
  onStatusChange: (status: string) => void;
}) {
  const money = (v: string | null | undefined) =>
    v == null ? "—" : new Intl.NumberFormat("vi-VN").format(BigInt(v));
  const units = normalizeReceiptUnits(totals?.units ?? []);
  const quantity = !totals
    ? "—"
    : units.length === 1 && units[0]
      ? receiptQuantity(totals.quantity_milli) + " " + units[0]
      : units.length > 1
        ? "Nhiều ĐVT"
        : "—";
  const cards =
    kind === "issue"
      ? [
          {
            key: "count",
            label: "Số phiếu",
            value: totals ? String(totals.count) : "—",
          },
          { key: "quantity", label: "Tổng SL", value: quantity },
          {
            key: "gross",
            label: "Giá trị xuất (đ)",
            value: money(totals?.net),
          },
        ]
      : [
          {
            key: "count",
            label: "Số phiếu",
            value: totals ? String(totals.count) : "—",
          },
          { key: "quantity", label: "Tổng SL", value: quantity },
          { key: "net", label: "Tiền hàng (đ)", value: money(totals?.net) },
          { key: "vat", label: "Tiền VAT (đ)", value: money(totals?.vat) },
          {
            key: "gross",
            label: "Tổng sau VAT (đ)",
            value: money(totals?.gross),
          },
        ];
  return (
    <div
      aria-label="Tổng theo bộ lọc"
      aria-busy={pending}
      className={
        "grid min-w-0 flex-1 grid-cols-2 gap-2 " +
        (kind === "issue"
          ? "sm:grid-cols-[1fr_1fr_1.4fr]"
          : "sm:grid-cols-[1fr_1fr_1fr_1fr_1.4fr]")
      }
    >
      {cards.map((c) => (
        <div
          key={c.key}
          className={
            "grid h-[72px] min-w-0 grid-rows-[12px_26px_16px] content-center gap-y-0.5 rounded-xl border px-2.5 py-1.5 " +
            (c.key === "gross"
              ? "col-span-2 border-blue-300 bg-blue-50 sm:col-span-1"
              : "border-slate-200 bg-slate-50")
          }
        >
          <div
            className={
              "text-[10px] leading-3 " +
              (c.key === "gross"
                ? "font-semibold text-blue-700"
                : "text-slate-500")
            }
          >
            {c.label}
          </div>
          <div
            title={c.value}
            className={
              "truncate leading-6 tabular-nums " +
              (c.key === "gross"
                ? "text-lg font-black text-blue-700 xl:text-xl xl:leading-6"
                : "text-base font-bold text-slate-900 xl:text-lg xl:leading-6")
            }
          >
            {c.value}
          </div>
          {c.key === "count" && totals?.status_counts ? (
            <div className="flex gap-1 text-[9px] leading-4">
              {(
                [
                  {
                    key: "posted",
                    label: kind === "issue" ? "Đã xuất kho" : "Đã nhập kho",
                  },
                  { key: "cancelled", label: "Đã hủy" },
                ] as const
              )
                .filter(
                  (s) =>
                    s.key === "posted" ||
                    totals.status_counts![s.key] > 0 ||
                    status === s.key,
                )
                .map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    title={"Lọc " + s.label}
                    aria-pressed={status === s.key}
                    onClick={() =>
                      onStatusChange(status === s.key ? "" : s.key)
                    }
                    className={
                      "!min-h-0 !h-4 !text-[9px] !leading-3 whitespace-nowrap rounded border px-1 " +
                      (status === s.key
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700")
                    }
                  >
                    {s.label}: {totals.status_counts![s.key]}
                  </button>
                ))}
            </div>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
