import { VatSelect, type useVatRates } from "./VatSelect";
import { ReceiptPriceInput } from "./ReceiptPriceInput";
import { PartStock } from "./PartStock";
import React from "react";
import { Copy, Trash2, ChevronRight } from "lucide-react";
import type { DocumentLines } from "./DocumentLines";
import type { DocumentClient } from "./documentClient";
import type { DraftLine } from "../../shared/documents";
import { lineTotals } from "../../shared/documents";
import {
  lineSerials,
  serialKey,
  serialFormatError,
} from "../../shared/documentSerials";
import {
  normalizeDraftInput,
  normalizeViNumber,
  displayViNumber,
} from "../../shared/documentNumbers";
import { CatalogPicker, docButton, docInput } from "./CatalogPicker";
import { money } from "./documentFormatting";
import { SerialEditor } from "./SerialEditor";
type Props = Parameters<typeof DocumentLines>[0] & {
  documents: DocumentClient;
  excludeDocument?: string;
  vatCatalog: ReturnType<typeof useVatRates>;
};
export function ReceiptLines({
  draft,
  setDraft,
  kind,
  api,
  labels,
  readOnly,
  saving,
  expanded,
  setExpanded,
  remember,
  line,
  documents,
  excludeDocument,
  vatCatalog,
}: Props) {
  const disabled = readOnly || saving,
    counts = new Map<string, number>(),
    locations = new Map<string, string[]>();
  for (const [row, item] of draft.lines.entries())
    for (const [position, value] of lineSerials(item).entries()) {
      const key = item.part_id + ":" + serialKey(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      locations.set(key, [
        ...(locations.get(key) ?? []),
        `dòng hàng ${row + 1}, serial #${position + 1}`,
      ]);
    }
  const duplicates = new Set(
    [...counts].filter(([, count]) => count > 1).map(([key]) => key),
  );
  function quantity(item: DraftLine) {
    try {
      const value = normalizeViNumber(item.quantity, "Thực nhập");
      return value !== "" && Number.isSafeInteger(Number(value))
        ? Number(value)
        : null;
    } catch {
      return null;
    }
  }
  const missing = draft.lines.filter(
    (item) =>
      labels["serialized:" + item.part_id] === "1" &&
      lineSerials(item).length !== quantity(item),
  );
  function open(item: DraftLine) {
    setExpanded({ [item.id]: true });
  }
  const activeIndex = draft.lines.findIndex(
    (item) => labels["serialized:" + item.part_id] === "1" && expanded[item.id],
  );
  const active = activeIndex >= 0 ? draft.lines[activeIndex] : undefined;
  return (
    <div className="space-y-3">
      {active && (
        <SerialEditor
          key={active.id}
          item={active}
          index={activeIndex}
          title={
            labels["parts:" + active.part_id] ??
            "Vật tư dòng " + (activeIndex + 1)
          }
          expected={quantity(active)}
          disabled={disabled}
          documents={documents}
          excludeDocument={excludeDocument}
          otherLocations={
            new Map(
              [...locations].map(([key, values]) => [
                key,
                values.filter(
                  (value) => !value.startsWith(`dòng hàng ${activeIndex + 1},`),
                ),
              ]),
            )
          }
          onChange={(patch) => line(active.id, patch)}
          onClose={() => setExpanded({})}
        />
      )}

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <strong>
            Có {missing.length} dòng chưa khớp serial với Thực nhập
          </strong>
          <div className="mt-1 flex flex-wrap gap-2">
            {missing.map((item) => (
              <button
                type="button"
                key={item.id}
                className="underline"
                onClick={() => open(item)}
              >
                Dòng {draft.lines.indexOf(item) + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table
          aria-label="Dòng vật tư phiếu nhập"
          className="w-full min-w-[960px] table-fixed text-left text-xs lg:min-w-0"
        >
          <colgroup>
            {[4, 34, 10, 10, 12, 7, 14, 9].map((width, i) => (
              <col key={i} style={{ width: width + "%" }} />
            ))}
          </colgroup>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "STT",
                "Vật tư",
                "SL chứng từ",
                "Thực nhập",
                "Đơn giá",
                "VAT %",
                "Thành tiền sau VAT",
                "Thao tác",
              ].map((label, i) => (
                <th
                  key={label}
                  className={
                    "px-2 py-2 " +
                    (i >= 2 && i <= 6
                      ? "text-right"
                      : i === 7
                        ? "text-center"
                        : "text-left")
                  }
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((item, index) => {
              const serial = labels["serialized:" + item.part_id] === "1",
                oil = labels["fuel:" + item.part_id] === "1",
                sim = labels["data:" + item.part_id] === "1",
                expected = quantity(item),
                list = lineSerials(item),
                full = labels["parts:" + item.part_id] ?? "",
                name = full.split(" — ").slice(1).join(" — ");
              let total: number | null = null;
              try {
                total = lineTotals(
                  normalizeDraftInput({
                    ...draft,
                    related_costs: undefined,
                    related_cost_items: undefined,
                    lines: [item],
                  }).lines[0],
                  kind,
                ).gross;
              } catch {}
              const numeric = (
                key:
                  "quantity" | "document_quantity" | "unit_price" | "vat_rate",
                label: string,
              ) => (
                <input
                  aria-label={label + " dòng " + (index + 1)}
                  className={docInput + " !px-1.5 text-right tabular-nums"}
                  inputMode="decimal"
                  value={item[key]}
                  disabled={disabled}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (key === "quantity" && serial) {
                      try {
                        const canonical = normalizeViNumber(value, "Thực nhập");
                        if (
                          canonical !== "" &&
                          Number.isSafeInteger(Number(canonical)) &&
                          Number(canonical) < list.length
                        ) {
                          const count = Number(canonical);
                          if (
                            !window.confirm(
                              `Đã nhập ${list.length} serial. Giảm Thực nhập xuống ${count} và bỏ ${list.length - count} serial cuối?`,
                            )
                          )
                            return;
                          line(item.id, {
                            quantity: value,
                            serial: "",
                            serials: list.slice(0, count),
                          });
                          return;
                        }
                      } catch {}
                    }
                    line(item.id, { [key]: value });
                  }}
                />
              );
              return (
                <React.Fragment key={item.id}>
                  <tr
                    data-line-number={index + 1}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="px-2 py-3 tabular-nums">{index + 1}</td>
                    <td className="p-2">
                      <CatalogPicker
                        api={api}
                        resource="parts"
                        label={"Vật tư dòng " + (index + 1)}
                        hideLabel
                        value={item.part_id}
                        selectedLabel={
                          labels["sku:" + item.part_id] ?? full.split(" — ")[0]
                        }
                        disabled={disabled}
                        onChange={(id, row) => {
                          remember("parts", id, row);
                          line(item.id, {
                            part_id: id,
                            serial: "",
                            serials: [],
                            pricing_mode: "unit_net",
                            pricing_value: "",
                            tank_id: "",
                            data_package: "",
                            unit_price: displayViNumber(
                              String(row?.unit_price_vnd ?? ""),
                            ),
                          });
                          if (row?.is_serialized === 1) {
                            setExpanded({ [item.id]: true });
                          } else
                            setExpanded((prev) => ({
                              ...prev,
                              [item.id]: false,
                            }));
                        }}
                      />
                      <p className="mt-1 font-semibold" title={name}>
                        {name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>
                          ĐVT: {labels["unit:" + item.part_id] ?? "—"} ·{" "}
                          <PartStock
                            partId={item.part_id}
                            warehouseId={draft.warehouse_id}
                            documents={documents}
                            excludeDocument={excludeDocument}
                          />
                        </span>
                        {serial && (
                          <>
                            <button
                              type="button"
                              aria-label={"Serial dòng " + (index + 1)}
                              aria-expanded={!!expanded[item.id]}
                              data-serial-line={item.id}
                              className={
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " +
                                (list.length === expected &&
                                !list.some(serialFormatError) &&
                                !list.some((value) =>
                                  duplicates.has(
                                    item.part_id + ":" + serialKey(value),
                                  ),
                                )
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : expected !== null && list.length > expected
                                    ? "border-red-300 bg-red-50 text-red-700"
                                    : "border-amber-300 bg-amber-50 text-amber-800")
                              }
                              onClick={() =>
                                expanded[item.id]
                                  ? setExpanded((prev) => ({
                                      ...prev,
                                      [item.id]: false,
                                    }))
                                  : open(item)
                              }
                            >
                              Serial {list.length}/{expected ?? "—"}
                              <ChevronRight size={12} />
                            </button>
                            {list.length > 0 && (
                              <span
                                className="inline-flex max-w-full items-center gap-1 text-[10px] text-slate-500"
                                title={
                                  list.slice(0, 2).join(", ") +
                                  (list.length > 2
                                    ? ` và ${list.length - 2} serial khác`
                                    : "")
                                }
                              >
                                <span className="max-w-[210px] truncate font-mono">
                                  {list.slice(0, 2).join(", ")}
                                </span>
                                {list.length > 2 && (
                                  <span className="shrink-0">
                                    và {list.length - 2} serial khác
                                  </span>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <input
                        aria-label={"Ghi chú dòng " + (index + 1)}
                        title={item.notes}
                        placeholder="Ghi chú dòng hàng"
                        maxLength={1000}
                        className={docInput + " mt-2 !min-h-8 !py-1 text-xs"}
                        value={item.notes}
                        disabled={disabled}
                        onChange={(e) =>
                          line(item.id, { notes: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      {numeric("document_quantity", "SL chứng từ")}
                    </td>
                    <td className="p-2">{numeric("quantity", "Số lượng")}</td>
                    <td className="p-2">
                      <ReceiptPriceInput
                        item={item}
                        index={index}
                        disabled={disabled}
                        view={readOnly}
                        onChange={(patch) => line(item.id, patch)}
                      />
                    </td>
                    <td className="p-2">
                      <VatSelect
                        value={item.vat_rate}
                        onChange={(v) => line(item.id, { vat_rate: v })}
                        label={"VAT % dòng " + (index + 1)}
                        disabled={disabled || !!vatCatalog.error}
                        rates={vatCatalog.rates}
                        pending={vatCatalog.pending}
                      />
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {money(total)}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          aria-label={"Nhân đôi dòng " + (index + 1)}
                          className={docButton + " !min-h-7 !px-1.5"}
                          disabled={disabled || draft.lines.length >= 60}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              lines: [
                                ...d.lines,
                                {
                                  ...item,
                                  id: crypto.randomUUID(),
                                  serial: "",
                                  serials: [],
                                },
                              ],
                            }))
                          }
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={"Xóa dòng " + (index + 1)}
                          className={
                            docButton + " !min-h-7 !px-1.5 text-rose-600"
                          }
                          disabled={disabled || draft.lines.length === 1}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              lines: d.lines.filter((l) => l.id !== item.id),
                            }))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {(oil || sim) && (
                    <tr>
                      <td colSpan={8} className="px-3 pb-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {oil && (
                            <CatalogPicker
                              api={api}
                              resource="fuel-tanks"
                              label="Bồn dầu"
                              warehouseId={draft.warehouse_id}
                              value={item.tank_id}
                              selectedLabel={
                                labels["fuel-tanks:" + item.tank_id]
                              }
                              disabled={disabled || !draft.warehouse_id}
                              onChange={(id, row) => {
                                remember("fuel-tanks", id, row);
                                line(item.id, { tank_id: id });
                              }}
                            />
                          )}
                          {sim && (
                            <label className="text-xs font-semibold">
                              Gói Data
                              <input
                                className={docInput + " mt-1"}
                                disabled={disabled}
                                value={item.data_package}
                                onChange={(e) =>
                                  line(item.id, {
                                    data_package: e.target.value,
                                  })
                                }
                              />
                            </label>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
