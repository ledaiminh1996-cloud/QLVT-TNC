import React from "react";
import { Copy, Trash2, ChevronDown } from "lucide-react";
import type { CatalogClient, CatalogRow } from "../api/catalogClient";
import type {
  DocumentDraft,
  DocumentKind,
  DraftLine,
} from "../../shared/documents";
import { emptyLine, lineTotals, stockStates } from "../../shared/documents";
import {
  normalizeDraftInput,
  displayViNumber,
} from "../../shared/documentNumbers";
import { CatalogPicker, docInput, docButton } from "./CatalogPicker";
import { money } from "./documentFormatting";
export function DocumentLines({
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
}: {
  draft: DocumentDraft;
  setDraft: React.Dispatch<React.SetStateAction<DocumentDraft>>;
  kind: DocumentKind;
  api: CatalogClient;
  labels: Record<string, string>;
  readOnly: boolean;
  saving: boolean;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  remember: (resource: string, id: string, row?: CatalogRow) => void;
  line: (id: string, patch: Partial<DraftLine>) => void;
}) {
  const priced = ["receipt", "proposal", "opening"].includes(kind);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[960px] table-fixed text-left text-xs">
        <colgroup>
          <col style={{ width: 290 }} />
          {kind === "receipt" && <col style={{ width: 92 }} />}
          <col style={{ width: 100 }} />
          {priced && (
            <>
              <col style={{ width: 118 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 128 }} />
            </>
          )}
          <col style={{ width: 150 }} />
          <col style={{ width: 156 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2">Vật tư</th>
            {kind === "receipt" && (
              <th className="px-2 py-2 text-right">SL chứng từ</th>
            )}
            <th className="px-2 py-2 text-right">
              {kind === "receipt" ? "Thực nhập" : "Số lượng"}
            </th>
            {priced && (
              <>
                <th className="px-2 py-2 text-right">Đơn giá</th>
                <th className="px-2 py-2 text-right">VAT %</th>
                <th className="px-2 py-2 text-right">Sau VAT</th>
              </>
            )}
            <th className="px-2 py-2">Serial</th>
            <th className="px-2 py-2">Trạng thái hàng</th>
            <th className="px-2 py-2 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((item, index) => {
            let amount: number | null = null;
            try {
              amount = lineTotals(
                normalizeDraftInput({ ...draft, lines: [item] }).lines[0],
                kind,
              ).gross;
            } catch {
              /* Invalid in-progress input is reported on save. */
            }
            const code =
                labels["sku:" + item.part_id] ??
                labels["parts:" + item.part_id]?.split(" — ")[0] ??
                "",
              oil = labels["fuel:" + item.part_id] === "1",
              sim = labels["data:" + item.part_id] === "1";
            const li = (
              label: string,
              key: keyof DraftLine,
              type = "text",
              identifier = false,
            ) => (
              <label className="block text-xs font-semibold">
                {label}
                <input
                  className={
                    docInput +
                    " mt-1" +
                    (identifier
                      ? " font-mono"
                      : [
                            "quantity",
                            "unit_price",
                            "odo",
                            "hours",
                            "retread_cost",
                          ].includes(key)
                        ? " font-sans tabular-nums text-right"
                        : "")
                  }
                  type={type}
                  value={item[key]}
                  disabled={readOnly || saving}
                  onChange={(e) => line(item.id, { [key]: e.target.value })}
                />
              </label>
            );
            const numeric = (
              key: "quantity" | "document_quantity" | "unit_price" | "vat_rate",
            ) => (
              <input
                aria-label={
                  {
                    quantity: "Số lượng",
                    document_quantity: "SL chứng từ",
                    unit_price: "Đơn giá",
                    vat_rate: "VAT %",
                  }[key] +
                  " dòng " +
                  (index + 1)
                }
                className={
                  docInput + " font-sans tabular-nums text-right !px-2"
                }
                inputMode="decimal"
                value={item[key]}
                disabled={
                  readOnly ||
                  saving ||
                  (kind === "opening" && key === "vat_rate")
                }
                onChange={(e) => line(item.id, { [key]: e.target.value })}
              />
            );
            return (
              <React.Fragment key={item.id}>
                <tr className="border-t border-slate-100">
                  <td className="p-2">
                    <CatalogPicker
                      api={api}
                      resource="parts"
                      label={"Vật tư dòng " + (index + 1)}
                      value={item.part_id}
                      selectedLabel={labels["parts:" + item.part_id]}
                      disabled={readOnly || saving}
                      onChange={(id, row) => {
                        remember("parts", id, row);
                        if (
                          row &&
                          (row.is_fuel === 1 || row.needs_data_package === 1)
                        )
                          setExpanded((previous) => ({
                            ...previous,
                            [item.id]: true,
                          }));
                        line(item.id, {
                          part_id: id,
                          serial: "",
                          tank_id: "",
                          data_package: "",
                          ...(row && priced
                            ? {
                                unit_price: displayViNumber(
                                  String(row.unit_price_vnd ?? ""),
                                ),
                              }
                            : {}),
                        });
                      }}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      ĐVT: {labels["unit:" + item.part_id] ?? "—"}
                      {labels["serialized:" + item.part_id] === "1"
                        ? " · SERIAL"
                        : ""}
                    </p>
                  </td>
                  {kind === "receipt" && (
                    <td className="p-2">{numeric("document_quantity")}</td>
                  )}
                  <td className="p-2">{numeric("quantity")}</td>
                  {priced && (
                    <>
                      <td className="p-2">{numeric("unit_price")}</td>
                      <td className="p-2">{numeric("vat_rate")}</td>
                      <td className="p-2 text-right font-sans tabular-nums">
                        {money(amount)}
                      </td>
                    </>
                  )}
                  <td className="p-2">
                    <input
                      aria-label={"Serial dòng " + (index + 1)}
                      className={docInput + " font-mono"}
                      value={item.serial}
                      disabled={readOnly || saving}
                      onChange={(e) =>
                        line(item.id, { serial: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      aria-label={"Trạng thái hàng dòng " + (index + 1)}
                      className={docInput + " !px-2"}
                      value={item.stock_state}
                      disabled={readOnly || saving}
                      onChange={(e) =>
                        line(item.id, {
                          stock_state: e.target
                            .value as DraftLine["stock_state"],
                        })
                      }
                    >
                      {Object.entries(stockStates)
                        .filter(([key]) =>
                          kind === "receipt"
                            ? key === "new"
                            : kind === "liquidation"
                              ? key === "pending_scrap"
                              : kind === "retread"
                                ? key === "recovered"
                                : kind === "recovery"
                                  ? key !== "new"
                                  : ["issue", "opening"].includes(kind)
                                    ? key !== "pending_scrap"
                                    : true,
                        )
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        aria-label={"Thông tin dòng " + (index + 1)}
                        aria-expanded={!!expanded[item.id]}
                        className={docButton + " !min-h-7 !px-1.5"}
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                      >
                        <ChevronDown size={14} />
                      </button>
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            aria-label={"Nhân đôi dòng " + (index + 1)}
                            className={docButton + " !min-h-7 !px-1.5"}
                            disabled={saving || draft.lines.length >= 60}
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                lines: [
                                  ...d.lines,
                                  {
                                    ...item,
                                    id: crypto.randomUUID(),
                                    serial: "",
                                    returned_serial: "",
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
                            disabled={saving || draft.lines.length === 1}
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                lines: d.lines.filter((l) => l.id !== item.id),
                              }))
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded[item.id] && (
                  <tr className="border-t border-slate-100 bg-slate-50/50">
                    <td
                      colSpan={kind === "receipt" ? 9 : priced ? 8 : 5}
                      className="p-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {oil && (
                          <CatalogPicker
                            api={api}
                            resource="fuel-tanks"
                            label="Bồn dầu"
                            warehouseId={draft.warehouse_id}
                            value={item.tank_id}
                            selectedLabel={labels["fuel-tanks:" + item.tank_id]}
                            disabled={readOnly || saving || !draft.warehouse_id}
                            onChange={(id, row) => {
                              remember("fuel-tanks", id, row);
                              line(item.id, { tank_id: id });
                            }}
                          />
                        )}
                        {sim && li("Gói Data", "data_package")}
                        {[
                          "issue",
                          "recovery",
                          "equipment_transfer",
                          "rotation",
                          "proposal",
                        ].includes(kind) && (
                          <>
                            <label className="text-xs font-semibold">
                              Thiết bị nhận
                              <select
                                className={docInput + " mt-1"}
                                value={item.target_type}
                                disabled={readOnly || saving}
                                onChange={(e) =>
                                  line(item.id, {
                                    target_type: e.target
                                      .value as DraftLine["target_type"],
                                    target_id: "",
                                  })
                                }
                              >
                                <option value="vehicle">Phương tiện</option>
                                <option value="equipment">
                                  Máy phát / Cont
                                </option>
                              </select>
                            </label>
                            <CatalogPicker
                              api={api}
                              resource={
                                item.target_type === "vehicle"
                                  ? "vehicles"
                                  : "equipment"
                              }
                              label="Chọn xe / thiết bị"
                              value={item.target_id}
                              selectedLabel={
                                labels[
                                  (item.target_type === "vehicle"
                                    ? "vehicles"
                                    : "equipment") +
                                    ":" +
                                    item.target_id
                                ]
                              }
                              disabled={readOnly || saving}
                              onChange={(id, row) => {
                                remember(
                                  item.target_type === "vehicle"
                                    ? "vehicles"
                                    : "equipment",
                                  id,
                                  row,
                                );
                                line(item.id, { target_id: id });
                              }}
                            />
                            {li("ODO tại thao tác (km)", "odo")}
                            {li("Số giờ tại thao tác", "hours")}
                          </>
                        )}
                        {[
                          "issue",
                          "liquidation",
                          "retread",
                          "warehouse_transfer",
                        ].includes(kind) &&
                          li(
                            "ID dòng nguồn (đối chiếu khi ghi sổ)",
                            "source_line_id",
                            "text",
                            true,
                          )}
                        {[
                          "recovery",
                          "equipment_transfer",
                          "rotation",
                        ].includes(kind) &&
                          li("ID lần xuất / lắp gốc", "usage_id", "text", true)}
                        {[
                          "issue",
                          "equipment_transfer",
                          "rotation",
                          "recovery",
                        ].includes(kind) && (
                          <>
                            {li("Vị trí trước / tháo", "from_position")}
                            {li("Vị trí sau / lắp", "to_position")}
                          </>
                        )}
                        {kind === "retread" && (
                          <>
                            {li(
                              "Serial dự kiến sau đắp",
                              "returned_serial",
                              "text",
                              true,
                            )}
                            {li("Chi phí đắp dự kiến (đ)", "retread_cost")}
                          </>
                        )}
                        {li("Ghi chú dòng", "notes")}
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
  );
}
