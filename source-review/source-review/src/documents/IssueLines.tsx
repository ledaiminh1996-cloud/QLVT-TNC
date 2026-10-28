import {mountPositionLabel} from "../../shared/mountPositionLabel";
import { issuePurposes, type IssuePurpose } from "../../shared/issueDetails";
import { IssueCostCells } from "./IssueCostCells";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import type { DocumentLines } from "./DocumentLines";
import type { DraftLine } from "../../shared/documents";
import { stockStates } from "../../shared/documents";
import { lineSerials } from "../../shared/documentSerials";
import { CatalogPicker, docInput, docButton } from "./CatalogPicker";
import { PartStock } from "./PartStock";
import { IssueSerialPicker } from "./IssueSerialPicker";
type Props = Parameters<typeof DocumentLines>[0];
export function IssueLines({
  draft,
  setDraft,
  documents,
  api,
  labels,
  readOnly,
  saving,
  remember,
  line,
  costsCurrent = true,
}: Props & {costsCurrent?: boolean}) {
  const [serialLine, setSerialLine] = useState<string>();
  const active = draft.lines.find((l) => l.id === serialLine);
  const disabled = readOnly || saving;
  const field = (
    item: DraftLine,
    key:
      "quantity" | "to_position" | "odo" | "hours" | "notes" | "data_package",
    label: string,
    index: number,
  ) => (
    <input
      aria-label={label + " dòng " + (index + 1)}
      placeholder={
        key === "notes"
          ? "Ghi chú dòng hàng"
          : key === "to_position"
            ? "Vị trí lắp"
            : undefined
      }
      className={
        docInput +
        (["quantity", "odo", "hours"].includes(key)
          ? " !px-1.5 text-right tabular-nums"
          : " !px-1.5")
      }
      inputMode={
        ["quantity", "odo", "hours"].includes(key) ? "decimal" : undefined
      }
      value={item[key]}
      disabled={disabled}
      onChange={(e) =>
        line(item.id, { [key]: e.target.value, source_line_id: "" })
      }
    />
  );
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1500px] table-fixed text-left text-xs">
          <colgroup>
            {[36, 270, 80, 110, 110, 125, 104, 300, 115, 145, 82].map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "STT",
                "Vật tư",
                "Số lượng",
                "Trạng thái hàng",
                "Đơn giá",
                "Thành tiền",
                "Serial",
                "Vị trí lắp",
                "Mục đích",
                "Ghi chú",
                "Thao tác",
              ].map((h) => (
                <th
                  key={h}
                  className={
                    "px-2 py-2 " +
                    (["Số lượng"].includes(h)
                      ? "text-right"
                      : h === "Thao tác"
                        ? "text-center"
                        : "")
                  }
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((item, index) => {
              const serial = labels["serialized:" + item.part_id] === "1";
              const amount = labels["issue_amount:" + item.id];
              const quantity = labels["issue_quantity:" + item.id];
              const known = costsCurrent && amount !== undefined && Number(quantity) > 0;
              return (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-2 py-3 align-top tabular-nums">
                    {index + 1}
                  </td>
                  <td className="p-2 align-top">
                    <CatalogPicker
                      hideLabel
                      api={api}
                      resource="parts"
                      warehouseId={draft.warehouse_id}
                      stockState={item.stock_state === "recovered" ? "recovered" : "new"}
                      label={"Vật tư dòng " + (index + 1)}
                      value={item.part_id}
                      selectedLabel={
                        labels["sku:" + item.part_id] ??
                        labels["parts:" + item.part_id]?.split(" — ")[0]
                      }
                      disabled={disabled || !draft.warehouse_id}
                      onChange={(id, row) => {
                        remember("parts", id, row);
                        line(item.id, {
                          part_id: id,
                          serial: "",
                          serials: [],
                          source_line_id: "",
                          tank_id: "",
                          data_package: "",
                        });
                      }}
                    />
                    <p className="mt-1 text-xs font-semibold">
                      {labels["parts:" + item.part_id]
                        ?.split(" — ")
                        .slice(1)
                        .join(" — ")}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      ĐVT: {labels["unit:" + item.part_id] ?? "—"} ·{" "}
                      <PartStock
                        documents={documents}
                        partId={item.part_id}
                        warehouseId={draft.warehouse_id}
                        stockState={item.stock_state}
                        label="Tồn hiện tại"
                      />
                    </p>
                    {labels["fuel:" + item.part_id] === "1" && (
                      <div className="mt-2">
                        <CatalogPicker
                          api={api}
                          resource="fuel-tanks"
                          label={"Bồn dầu dòng " + (index + 1)}
                          warehouseId={draft.warehouse_id}
                          value={item.tank_id}
                          selectedLabel={labels["fuel-tanks:" + item.tank_id]}
                          disabled={disabled || !draft.warehouse_id}
                          onChange={(id, row) => {
                            remember("fuel-tanks", id, row);
                            line(item.id, { tank_id: id });
                          }}
                        />
                      </div>
                    )}
                    {labels["data:" + item.part_id] === "1" && (
                      <label className="mt-2 block text-xs">
                        Gói Data{field(item, "data_package", "Gói Data", index)}
                      </label>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    {field(item, "quantity", "Số lượng", index)}
                  </td>
                  <td className="p-2 align-top">
                    <select
                      aria-label={"Trạng thái hàng dòng " + (index + 1)}
                      className={docInput + " !px-1.5"}
                      value={item.stock_state}
                      disabled={disabled}
                      onChange={(e) =>
                        line(item.id, {
                          stock_state: e.target
                            .value as DraftLine["stock_state"],
                          source_line_id: "",
                          serial: "",
                          serials: [],
                          issue_purpose: e.target.value === "new" && item.issue_purpose === "liquidation" ? "use" : item.issue_purpose,
                        })
                      }
                    >
                      {["new", "recovered"].map((state) => (
                        <option key={state} value={state}>
                          {stockStates[state as DraftLine["stock_state"]]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <IssueCostCells item={item} index={index} warehouse={draft.warehouse_id} documents={documents} amount={amount} quantity={quantity} saved={known} serialized={serial} savedUnitPrice={labels["issue_unit_price:"+item.id]} businessAt={draft.business_at} pendingReason={costsCurrent?labels["valuation_reason:"+item.id]:undefined}/>
                  <td className="p-2 align-top">
                    {serial ? (
                      <button
                        type="button"
                        title="Chọn serial trong kho"
                        aria-label={"Serial xuất dòng " + (index + 1)}
                        className={docButton + " !px-1.5"}
                        disabled={saving || (!readOnly && !draft.warehouse_id)}
                        onClick={() => setSerialLine(item.id)}
                      >
                        Serial {lineSerials(item).length}/{item.quantity} ›
                      </button>
                    ) : (
                      <span className="block py-2 text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <CatalogPicker hideLabel api={api} resource="mount-positions" label={"Vị trí lắp dòng " + (index+1)} value={item.mount_position_id || (item.to_position ? "__saved-position__" : "")} selectedLabel={item.to_position} disabled={disabled} onChange={(id,row)=>line(item.id,{mount_position_id:id,to_position:row?mountPositionLabel(row).slice(0,256):""})}/>
                  </td>
                  <td className="p-2 align-top">
                    <select
                      aria-label={"Mục đích dòng " + (index + 1)}
                      className={docInput + " !px-1.5"}
                      value={item.issue_purpose ?? "use"}
                      disabled={disabled}
                      onChange={(e) => line(item.id, {issue_purpose: e.target.value as IssuePurpose})}
                    >
                      {Object.entries(issuePurposes).map(([value, label]) => (
                        <option key={value} value={value} disabled={value === "liquidation" && item.stock_state !== "recovered"}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 align-top">
                    {field(item, "notes", "Ghi chú", index)}
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex justify-center gap-1">
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            className={docButton + " !px-1.5"}
                            title="Nhân đôi dòng, không sao chép serial"
                            aria-label={"Nhân đôi dòng " + (index + 1)}
                            disabled={saving || draft.lines.length >= 60}
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                lines: [
                                  ...d.lines,
                                  {
                                    ...item,
                                    id: crypto.randomUUID(),
                                    source_line_id: "",
                                    serial: "",
                                    serials: [],
                                    usage_id: "",
                                  },
                                ],
                              }))
                            }
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            className={docButton + " !px-1.5 text-red-600"}
                            title="Xóa dòng"
                            aria-label={"Xóa dòng " + (index + 1)}
                            disabled={saving || draft.lines.length === 1}
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                lines: d.lines.filter((l) => l.id !== item.id),
                              }))
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Hàng theo serial: xuất đúng serial đã chọn. Hàng không theo serial: tự
        phân bổ số lượng theo FIFO. Giá xuất được tính tự động: theo giá nhập serial đã chọn hoặc bình quân gia quyền cho hàng số lượng.
      </p>
      {active && (
        <IssueSerialPicker
          key={
            active.id +
            ":" +
            active.part_id +
            ":" +
            draft.warehouse_id +
            ":" +
            active.stock_state
          }
          documents={documents}
          businessAt={draft.business_at}
          part={active.part_id}
          warehouse={draft.warehouse_id}
          state={active.stock_state}
          quantity={active.quantity}
          values={lineSerials(active)}
          used={draft.lines
            .filter((l) => l.id !== active.id && l.part_id === active.part_id)
            .flatMap(lineSerials)}
          label={labels["parts:" + active.part_id] ?? ""}
          disabled={disabled}
          onChange={(serials) =>
            line(active.id, { serial: "", serials, source_line_id: "" })
          }
          onClose={() => setSerialLine(undefined)}
        />
      )}
    </>
  );
}
