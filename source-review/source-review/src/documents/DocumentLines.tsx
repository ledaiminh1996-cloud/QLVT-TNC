import { IssueSerialPicker } from "./IssueSerialPicker";
import { lineSerials } from "../../shared/documentSerials";
import { PartStock } from "./PartStock";
import { OperationSourcePicker } from "./OperationSourcePicker";
import type { DocumentClient } from "./documentClient";
import React, { useState } from "react";
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
  documents,
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
  documents: DocumentClient;
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
  const [serialLine, setSerialLine] = useState<string>();
  const activeSerial = draft.lines.find((l) => l.id === serialLine);
  const openingStock=kind==="opening"&&draft.opening_mode!=="in_use";
  const priced = ["receipt", "proposal", "opening"].includes(kind);
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table
          className={
            "w-full table-fixed text-left text-xs " +
            (kind === "issue" ? "min-w-[800px]" : "min-w-[960px]")
          }
        >
          <colgroup>
            {kind === "issue" && <col style={{ width: 42 }} />}
            <col style={{ width: kind === "issue" ? 350 : 290 }} />
            {kind === "receipt" && <col style={{ width: 92 }} />}
            <col style={{ width: 100 }} />
            {priced && (
              <>
                <col style={{ width: 118 }} />
                {!openingStock&&<col style={{ width: 80 }} />}
                <col style={{ width: 128 }} />
              </>
            )}
            <col style={{ width: 150 }} />
            <col style={{ width: 156 }} />
            {openingStock&&<col style={{width:180}}/>}
            <col style={{ width: 100 }} />
          </colgroup>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {kind === "issue" && <th className="px-2 py-2">STT</th>}
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
                  {!openingStock&&<th className="px-2 py-2 text-right">VAT %</th>}
                  <th className="px-2 py-2 text-right">{openingStock?"Thành tiền":"Sau VAT"}</th>
                </>
              )}
              <th className="px-2 py-2">Serial</th>
              <th className="px-2 py-2">Trạng thái hàng</th>
              {openingStock&&<th className="px-2 py-2">Ghi chú</th>}
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
                key:
                  "quantity" | "document_quantity" | "unit_price" | "vat_rate",
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
                    {kind === "issue" && (
                      <td className="p-2 tabular-nums">{index + 1}</td>
                    )}
                    <td className="p-2">
                      <CatalogPicker
                        hideLabel={kind === "issue"}
                        api={api}
                        resource="parts"
                        label={"Vật tư dòng " + (index + 1)}
                        value={item.part_id}
                        selectedLabel={
                          kind === "issue"
                            ? (labels["sku:" + item.part_id] ??
                              labels["parts:" + item.part_id]?.split(" — ")[0])
                            : labels["parts:" + item.part_id]
                        }
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
                            serials: [],
                            source_line_id: "",
                            usage_id: "",
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
                      {kind === "issue" && item.part_id && (
                        <p className="mt-1 text-xs font-semibold">
                          {labels["parts:" + item.part_id]
                            ?.split(" — ")
                            .slice(1)
                            .join(" — ")}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">
                        ĐVT: {labels["unit:" + item.part_id] ?? "—"}
                        {kind === "issue" && (
                          <>
                            {" "}
                            ·{" "}
                            <PartStock
                              documents={documents}
                              partId={item.part_id}
                              warehouseId={draft.warehouse_id}
                              stockState={item.stock_state}
                              label="Tồn hiện tại"
                            />
                          </>
                        )}
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
                        {!openingStock&&<td className="p-2">{numeric("vat_rate")}</td>}
                        <td className="p-2 text-right font-sans tabular-nums">
                          {money(amount)}
                        </td>
                      </>
                    )}
                    <td className="p-2">
                      {kind === "issue" ? (
                        labels["serialized:" + item.part_id] === "1" ? (
                          <button
                            type="button"
                            title="Chọn serial còn trong kho"
                            aria-label={"Serial xuất dòng " + (index + 1)}
                            className={docButton + " !min-h-7 !px-2"}
                            disabled={
                              saving ||
                              (!readOnly &&
                                (!item.part_id || !draft.warehouse_id))
                            }
                            onClick={() => setSerialLine(item.id)}
                          >
                            Serial {lineSerials(item).length}/{item.quantity} ›
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : openingStock ? (
                        <input
                          type="text"
                          aria-label={"Serial dòng " + (index + 1)}
                          className={docInput + " font-mono"}
                          placeholder="Serial"
                          key={item.part_id}
                          defaultValue={lineSerials(item).join("; ")}
                          disabled={readOnly || saving}
                          onPaste={e=>{
                            const pasted=e.clipboardData.getData("text");
                            if(!/[\r\n\t]/.test(pasted))return;
                            e.preventDefault();const el=e.currentTarget;
                            const next=el.value.slice(0,el.selectionStart??el.value.length)+pasted.replace(/[\r\n\t]+/g,"; ")+el.value.slice(el.selectionEnd??el.value.length);
                            el.value=next;line(item.id,{serial:"",serials:next.split(/[;,]+/).map(v=>v.trim()).filter(Boolean)});
                          }}
                          onChange={e=>line(item.id,{serial:"",serials:e.target.value.split(/[;,]+/).map(v=>v.trim()).filter(Boolean)})}
                        />
                      ) : (
                        <textarea
                          aria-label={"Serial dòng " + (index + 1)}
                          className={docInput + " font-mono"}
                          rows={2}
                          placeholder="Mỗi serial một dòng"
                          key={item.part_id}
                          defaultValue={(item.serials?.length
                            ? item.serials
                            : item.serial
                              ? [item.serial]
                              : []
                          ).join("\n")}
                          disabled={readOnly || saving}
                          onChange={(e) =>
                            line(item.id, {
                              serial: "",
                              serials: e.target.value
                                .split(/[\n\t;,]+/)
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      )}
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
                            ...(kind === "issue"
                              ? { serial: "", serials: [], source_line_id: "" }
                              : {}),
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
                    {openingStock&&<td className="p-2"><input type="text" aria-label={"Ghi chú dòng "+(index+1)} className={docInput} placeholder="Ghi chú dòng" value={item.notes} disabled={readOnly||saving} onChange={e=>line(item.id,{notes:e.target.value})}/></td>}
                    <td className="p-2">
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          title={
                            kind === "issue"
                              ? "Thiết bị nhận, ODO/giờ, nguồn nhập và ghi chú"
                              : "Thông tin dòng"
                          }
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
                              title="Nhân đôi dòng (không sao chép serial)"
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
                                      serials: [],
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
                              title="Xóa dòng"
                              aria-label={"Xóa dòng " + (index + 1)}
                              className={
                                docButton + " !min-h-7 !px-1.5 text-rose-600"
                              }
                              disabled={saving || draft.lines.length === 1}
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  lines: d.lines.filter(
                                    (l) => l.id !== item.id,
                                  ),
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
                        colSpan={
                          kind === "receipt"
                            ? 9
                            : kind === "issue"
                              ? 6
                              : priced
                                ? 8
                                : 5
                        }
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
                              selectedLabel={
                                labels["fuel-tanks:" + item.tank_id]
                              }
                              disabled={
                                readOnly || saving || !draft.warehouse_id
                              }
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
                          ].includes(kind) && (
                            <OperationSourcePicker
                              documents={documents}
                              view="sources"
                              part={item.part_id}
                              warehouse={draft.warehouse_id}
                              state={item.stock_state}
                              value={item.source_line_id}
                              disabled={readOnly || saving}
                              onChange={(id) =>
                                line(item.id, { source_line_id: id })
                              }
                            />
                          )}
                          {[
                            "recovery",
                            "equipment_transfer",
                            "rotation",
                          ].includes(kind) && (
                            <OperationSourcePicker
                              documents={documents}
                              view="usages"
                              part={item.part_id}
                              warehouse={draft.warehouse_id}
                              state={item.stock_state}
                              value={item.usage_id}
                              disabled={readOnly || saving}
                              onChange={(id) => line(item.id, { usage_id: id })}
                            />
                          )}
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
                          {!openingStock&&li("Ghi chú dòng", "notes")}
                          {kind === "issue" && (
                            <p className="text-xs text-slate-500">
                              Giá vốn được tính khi lưu theo kho và trạng thái
                              hàng. Để trống nguồn nhập để máy chủ tự phân bổ
                              FIFO.
                            </p>
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
      {kind === "issue" && activeSerial && (
        <IssueSerialPicker
          key={
            activeSerial.id +
            ":" +
            activeSerial.part_id +
            ":" +
            draft.warehouse_id +
            ":" +
            activeSerial.stock_state
          }
          documents={documents}
          part={activeSerial.part_id}
          warehouse={draft.warehouse_id}
          state={activeSerial.stock_state}
          quantity={activeSerial.quantity}
          values={lineSerials(activeSerial)}
          used={draft.lines
            .filter(
              (l) =>
                l.id !== activeSerial.id && l.part_id === activeSerial.part_id,
            )
            .flatMap(lineSerials)}
          label={labels["parts:" + activeSerial.part_id] ?? ""}
          disabled={readOnly || saving}
          onChange={(serials) => line(activeSerial.id, { serial: "", serials })}
          onClose={() => setSerialLine(undefined)}
        />
      )}
    </>
  );
}
