import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type { DocumentDraft, DocumentTotals } from "../../shared/documents";
import { draftTotals } from "../../shared/documents";
import {
  receiptCostFields,
  receiptCostTypes,
  receiptCostItemTotals,
  receiptExtraTotals,
} from "../../shared/receiptCosts";
import {
  normalizeDraftInput,
  normalizeViNumber,
  formatViNumber,
} from "../../shared/documentNumbers";
import { VatSelect, type useVatRates } from "./VatSelect";
import { Plus, Trash2 } from "lucide-react";
import { docButton, docInput } from "./CatalogPicker";
import { money } from "./documentFormatting";
export function ReceiptCostsForm({
  draft,
  setDraft,
  disabled,
  totals,
  vatCatalog,
}: {
  draft: DocumentDraft;
  setDraft: Dispatch<SetStateAction<DocumentDraft>>;
  disabled: boolean;
  totals: DocumentTotals;
  vatCatalog: ReturnType<typeof useVatRates>;
}) {
  const material = useMemo(() => {
    try {
      return draftTotals(
        normalizeDraftInput({
          ...draft,
          related_costs: undefined,
          related_cost_items: undefined,
        }),
      );
    } catch {
      return { net: null, vat: null, gross: null };
    }
  }, [draft]);
  const extra = useMemo(() => {
    try {
      const normalized = normalizeDraftInput({ ...draft, lines: [] });
      return receiptExtraTotals(
        normalized.related_costs,
        normalized.related_cost_items,
      );
    } catch {
      return { net: null, vat: null, gross: null };
    }
  }, [draft]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs tabular-nums">
        <span>
          Tiền hàng trước VAT (A): <strong>{money(material.net)}</strong>
        </span>
        <span>
          Thuế GTGT vật tư: <strong>{money(material.vat)}</strong>
        </span>
      </div>
      <section
        className="rounded-xl border border-slate-200 p-3"
        aria-labelledby="receipt-related-costs"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="receipt-related-costs" className="text-sm font-bold">
            B. Chi phí liên quan
          </h3>
          {!disabled && (
            <button
              type="button"
              className={docButton}
              disabled={(draft.related_cost_items?.length ?? 0) >= 100}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  related_cost_items: [
                    ...(d.related_cost_items ?? []),
                    {
                      id: crypto.randomUUID(),
                      type: "transport",
                      name: "Vận chuyển",
                      amount: "",
                      vat_rate:
                        vatCatalog.rates.find((r) => r.value === "0")?.value ??
                        vatCatalog.rates[0]?.value ??
                        "0",
                    },
                  ],
                }))
              }
            >
              <Plus size={14} />
              Thêm chi phí
            </button>
          )}
        </div>
        {draft.related_costs &&
          Object.values(draft.related_costs).some((v) => v && v !== "0") && (
            <div className="mb-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              <strong>Chi phí theo mẫu cũ được giữ nguyên</strong>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {receiptCostFields
                  .filter((f) => Number(draft.related_costs?.[f.key] || 0) > 0)
                  .map((f) => (
                    <span key={f.key}>
                      {f.label}: {money(Number(draft.related_costs![f.key]))}
                    </span>
                  ))}
              </div>
            </div>
          )}
        {vatCatalog.error && (
          <p role="alert" className="mb-2 text-xs text-red-700">
            {vatCatalog.error}{" "}
            <button
              type="button"
              className={docButton}
              onClick={vatCatalog.retry}
            >
              Thử lại
            </button>
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[620px] table-fixed text-left text-xs">
            <colgroup>
              <col style={{ width: "42%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2">Loại chi phí</th>
                <th className="p-2 text-right">Số tiền (chưa VAT)</th>
                <th className="p-2 text-right">VAT %</th>
                <th className="p-2 text-right">Tiền VAT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.related_cost_items ?? []).map((item, index) => {
                const update = (patch: Partial<typeof item>) =>
                  setDraft((d) => ({
                    ...d,
                    related_cost_items: d.related_cost_items?.map((i) =>
                      i.id === item.id ? { ...i, ...patch } : i,
                    ),
                  }));
                let tax: number | null = null;
                try {
                  tax = receiptCostItemTotals({
                    ...item,
                    amount: normalizeViNumber(item.amount, "Số tiền", true),
                    vat_rate: normalizeViNumber(item.vat_rate, "VAT", true),
                  }).vat;
                } catch {}
                let amount = item.amount;
                try {
                  if (disabled) amount = formatViNumber(amount);
                } catch {}
                return (
                  <tr
                    key={item.id}
                    data-cost-number={index + 1}
                    className="border-t border-slate-100"
                  >
                    <td className="p-2">
                      <select
                        aria-label={"Loại chi phí " + (index + 1)}
                        className={docInput}
                        value={item.type}
                        disabled={disabled}
                        onChange={(e) => {
                          const kind = receiptCostTypes.find(
                            (t) => t.value === e.target.value,
                          )!;
                          update({
                            type: kind.value,
                            name: kind.value === "other" ? "" : kind.label,
                          });
                        }}
                      >
                        {receiptCostTypes.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {item.type === "other" && (
                        <input
                          aria-label={"Tên chi phí " + (index + 1)}
                          className={docInput + " mt-1"}
                          value={item.name}
                          maxLength={256}
                          placeholder="Nhập tên chi phí cụ thể"
                          disabled={disabled}
                          onChange={(e) => update({ name: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <input
                        aria-label={"Số tiền chi phí " + (index + 1)}
                        inputMode="numeric"
                        className={docInput + " text-right tabular-nums"}
                        value={amount}
                        disabled={disabled}
                        onChange={(e) => update({ amount: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <VatSelect
                        value={item.vat_rate}
                        onChange={(v) => update({ vat_rate: v })}
                        label={"VAT chi phí " + (index + 1)}
                        disabled={disabled || !!vatCatalog.error}
                        pending={vatCatalog.pending}
                        rates={vatCatalog.rates}
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {money(tax)}
                    </td>
                    <td className="p-1">
                      {!disabled && (
                        <button
                          type="button"
                          title="Xóa chi phí"
                          aria-label={"Xóa chi phí " + (index + 1)}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              related_cost_items: d.related_cost_items?.filter(
                                (i) => i.id !== item.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!draft.related_cost_items?.length && (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-500">
                    Chưa có khoản chi phí thêm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-x-5 gap-y-1 text-xs tabular-nums">
          <span>
            Chi phí trước VAT (B): <strong>{money(extra.net)}</strong>
          </span>
          <span>
            VAT chi phí: <strong>{money(extra.vat)}</strong>
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Chi phí trước VAT phân bổ theo giá trị từng dòng; nếu tiền hàng bằng 0
          thì phân bổ đều. Thuế GTGT cộng riêng.
        </p>
      </section>
      <section
        className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:grid-cols-3"
        aria-label="Tổng giá trị nhập kho"
      >
        <div>
          <h3 className="text-xs font-semibold">
            C. Tổng giá trị nhập kho (A+B)
          </h3>
          <strong className="mt-1 block text-base tabular-nums text-blue-700">
            {money(totals.net)}
          </strong>
        </div>
        <div>
          <h3 className="text-xs font-semibold">Tổng thuế GTGT</h3>
          <strong className="mt-1 block text-base tabular-nums">
            {money(totals.vat)}
          </strong>
        </div>
        <div>
          <h3 className="text-xs font-semibold">Tổng thanh toán (gồm VAT)</h3>
          <strong className="mt-1 block text-base tabular-nums">
            {money(totals.gross)}
          </strong>
        </div>
      </section>
    </div>
  );
}
