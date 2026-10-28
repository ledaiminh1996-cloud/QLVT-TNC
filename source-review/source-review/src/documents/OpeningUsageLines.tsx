import {openingVehicleLabel} from "../../shared/openingVehicleLabel";
import {OpeningUsageAssessment} from "./OpeningUsageAssessment";
import { Copy, Trash2 } from "lucide-react";
import type { DocumentLines } from "./DocumentLines";
import type { DraftLine } from "../../shared/documents";
import { CatalogPicker, docInput, docButton } from "./CatalogPicker";
import {displayViNumber} from "../../shared/documentNumbers";
import { mountPositionLabel } from "../../shared/mountPositionLabel";
import { lineSerials } from "../../shared/documentSerials";
type Props = Parameters<typeof DocumentLines>[0];
export function OpeningUsageLines({
  draft,
  setDraft,
  api,
  labels,
  readOnly,
  saving,
  remember,
  line,
}: Props) {
  const disabled = readOnly || saving;
  const compactInput=docInput+" !px-2 !py-1.5 !text-[11px]";
  const input = (
    item: DraftLine,
    key: "quantity" | "notes",
    label: string,
    index: number,
  ) => (
    <input
      className={compactInput}
      aria-label={label + " dòng " + (index + 1)}
      value={item[key]}
      disabled={disabled}
      readOnly={
        key === "quantity" && labels["serialized:" + item.part_id] === "1"
      }
      required={key === "quantity"}
      inputMode={key === "notes" ? undefined : "decimal"}
      onChange={(e) => line(item.id, { [key]: e.target.value })}
    />
  );
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1460px] table-fixed text-left text-xs">
          <colgroup>
            {[30, 200, 180, 150, 65, 130, 125, 90, 125, 165, 135, 66].map(
              (w, i) => (
                <col key={i} style={{ width: w }} />
              ),
            )}
          </colgroup>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "STT",
                "Vật tư đang sử dụng",
                "Biển số / loại phương tiện",
                "Vị trí lắp",
                "Số lượng",
                "Serial thực tế",
                "Nguyên giá",
                "Tỷ lệ còn lại (%)",
                "Giá trị còn lại",
                "Căn cứ/người xác nhận",
                "Ghi chú",
                "Thao tác",
              ].map((h) => (
                <th key={h} className="p-1.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((item, index) => {
              const serialized = labels["serialized:" + item.part_id] === "1";
              return (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="p-1.5 align-top">{index + 1}</td>
                  <td className="p-1.5 align-top">
                    <CatalogPicker
                      compact
                      hideLabel
                      api={api}
                      resource="parts"
                      label={"Vật tư đầu kỳ đang dùng dòng " + (index + 1)}
                      value={item.part_id}
                      selectedLabel={
                        labels["sku:" + item.part_id] ||
                        labels["parts:" + item.part_id]
                      }
                      disabled={disabled}
                      onChange={(id, row) => {
                        remember("parts", id, row);
                        line(item.id, {
                          part_id: id,
                          opening_current_unit_price: typeof row?.unit_price_vnd === "number" && row.unit_price_vnd > 0 ? displayViNumber(String(row.unit_price_vnd)) : "",
                          opening_quality_percent:undefined,opening_assessor:undefined,opening_confirmation_basis:undefined,
                          stock_state: "recovered",
                          quantity:
                            row?.is_serialized === 1 ? "1" : item.quantity,
                          serial: "",
                          serials: [],
                        });
                      }}
                    />
                    <p className="mt-1 font-semibold">
                      {labels["parts:" + item.part_id]
                        ?.split(" — ")
                        .slice(1)
                        .join(" — ")}
                    </p>
                    <p className="text-slate-500">
                      ĐVT: {labels["unit:" + item.part_id] || "—"}
                    </p>
                  </td>
                  <td className="space-y-1 p-1.5 align-top">
                    <select
                      className={compactInput}
                      aria-label={"Loại đối tượng đầu kỳ dòng " + (index + 1)}
                      value={item.target_type}
                      disabled={disabled}
                      onChange={(e) =>
                        line(item.id, {
                          target_type: e.target.value as
                            "vehicle" | "equipment",
                          target_id: "",
                        })
                      }
                    >
                      <option value="vehicle">Xe / rơ moóc</option>
                      <option value="equipment">Thiết bị</option>
                    </select>
                    <CatalogPicker
                      compact
                      hideLabel
                      api={api}
                      resource={
                        item.target_type === "vehicle"
                          ? "vehicles"
                          : "equipment"
                      }
                      formatLabel={item.target_type === "vehicle" ? openingVehicleLabel : undefined}
                      label={"Đối tượng đang sử dụng dòng " + (index + 1)}
                      value={item.target_id}
                      selectedLabel={
                        labels[
                          (item.target_type === "vehicle"
                            ? "vehicles:"
                            : "equipment:") + item.target_id
                        ]
                      }
                      disabled={disabled}
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
                  </td>
                  <td className="p-1.5 align-top">
                    <CatalogPicker
                      compact
                      hideLabel
                      api={api}
                      resource="mount-positions"
                      label={"Vị trí đầu kỳ dòng " + (index + 1)}
                      value={item.to_position ? "__saved-position__" : ""}
                      selectedLabel={item.to_position}
                      disabled={disabled}
                      onChange={(_id, row) =>
                        line(item.id, {
                          to_position: row
                            ? mountPositionLabel(row).slice(0, 256)
                            : "",
                        })
                      }
                    />
                  </td>
                  <td className="p-1.5 align-top">
                    {input(item, "quantity", "Số lượng đầu kỳ", index)}
                  </td>
                  <td className="p-1.5 align-top">
                    {serialized ? (
                      <input
                        className={compactInput + " font-mono"}
                        aria-label={"Serial đầu kỳ dòng " + (index + 1)}
                        value={lineSerials(item).join("; ")}
                        disabled={disabled}
                        required
                        onChange={(e) =>
                          line(item.id,{serial:"",serials:e.target.value?[e.target.value]:[]})
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <OpeningUsageAssessment item={item} index={index} disabled={disabled} line={line}/>
                  <td className="p-1.5 align-top">
                    {input(item, "notes", "Ghi chú đầu kỳ", index)}
                  </td>
                  <td className="p-1.5 align-top">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Nhân đôi dòng"
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
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        title="Xóa dòng"
                        className={docButton + " !min-h-7 !px-1.5"}
                        disabled={disabled || draft.lines.length === 1}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            lines: d.lines.filter((l) => l.id !== item.id),
                          }))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
