import { RecoveryUsagePicker } from "./RecoveryUsagePicker";
import type { RecoverySourceRow } from "../../shared/recoverySources";
import { useEffect, useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import type { DocumentLines } from "./DocumentLines";
import type { DraftLine } from "../../shared/documents";
import {
  recoveryClasses,
  recoveryState,
  type RecoveryClass,
} from "../../shared/recoveryDetails";
import { lineSerials } from "../../shared/documentSerials";
import { normalizeViNumber,displayViNumber } from "../../shared/documentNumbers";
import type { DocumentClient } from "./documentClient";
import { docInput, docButton } from "./CatalogPicker";
import { IssueSerialPicker } from "./IssueSerialPicker";
import { money, documentDateTime } from "./documentFormatting";
import { accessMessage } from "../api/catalogClient";
type Props = Parameters<typeof DocumentLines>[0];
function RecoveryMoney({
  item,
  index,
  documents,
  businessAt,
  odo,
  hours,
  labels,
  saved,
  pendingReason,
}: {
  item: DraftLine;
  index: number;
  documents: DocumentClient;
  businessAt: string;
  odo: string;
  hours: string;
  labels: Record<string, string>;
  saved: boolean;
  pendingReason?: string;
}) {
  const [quote, setQuote] = useState<{
      amount_vnd: number | null;
      unit_price_vnd_milli: number | null;
      remaining_percent?: string | null;
      valuation_status?: string;
      warning?: string;
      estimated_hours?: boolean;
      valuation_method?: string;
    }>(),
    [error, setError] = useState("");
  let quantity = "",
    removalOdo = "",
    removalHours = "", currentPrice = "", quality = "";
  try {
    quantity = normalizeViNumber(item.quantity, "Số lượng");
    removalOdo = normalizeViNumber(odo, "ODO tháo");
    removalHours = normalizeViNumber(hours, "Giờ tháo");
    currentPrice = normalizeViNumber(item.recovery_current_unit_price ?? "", "Giá mua hiện tại");
    quality = normalizeViNumber(item.recovery_quality_percent ?? "", "Chất lượng");
  } catch {}
  const key = JSON.stringify([
    item.part_id,
    item.usage_id,
    quantity,
    businessAt,
    removalOdo,
    removalHours,
    lineSerials(item), currentPrice, item.recovery_current_unit_price!==undefined?quality:undefined, item.recovery_assessor,
  ]);
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    setQuote(undefined);
    setError("");
    setResolved("");
    if (
      saved ||
      !documents.recoveryPrice ||
      !item.usage_id ||
      !item.part_id ||
      !quantity
    )
      return;
    const c = new AbortController();
    const t = setTimeout(
      () =>
        documents.recoveryPrice!(
          {
            usage_id: item.usage_id,
            part_id: item.part_id,
            quantity,
            odo: removalOdo,
            hours: removalHours,
            serials: lineSerials(item),
            business_at: businessAt,
            ...(item.recovery_current_unit_price!==undefined?{current_unit_price:currentPrice,assessor:item.recovery_assessor??"",...(quality?{quality_percent:quality}:{})}:{}),
          },
          c.signal,
        )
          .then((r) => {
            if (!c.signal.aborted) {
              setQuote(r);
              setResolved(key);
            }
          })
          .catch((e) => {
            if (!c.signal.aborted) {
              setError(accessMessage(e));
              setResolved(key);
            }
          }),
      180,
    );
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [
    documents,
    item.usage_id,
    item.part_id,
    quantity,
    businessAt,
    removalOdo,
    removalHours,
    saved,
    key,
  ]);
  const amount =
    saved && labels["recovery_amount:" + item.id] !== undefined
      ? Number(labels["recovery_amount:" + item.id])
      : resolved === key
        ? quote?.amount_vnd
        : undefined;
  const price =
    saved && labels["recovery_unit_price:" + item.id] !== undefined
      ? Number(labels["recovery_unit_price:" + item.id]) / 1000
      : resolved === key &&
          quote?.unit_price_vnd_milli !== null &&
          quote?.unit_price_vnd_milli !== undefined
        ? quote.unit_price_vnd_milli / 1000
        : undefined;
  const remainingPercent = saved
    ? labels["recovery_remaining_percent:" + item.id]
    : resolved === key
      ? (quote?.remaining_percent ?? undefined)
      : undefined;
  return (
    <>
      <td
        className="p-2 align-top tabular-nums"
        aria-label={"Đơn giá thu hồi dòng " + (index + 1)}
      >
        <div className="flex min-h-[34px] items-center">
          {price === undefined
            ? "—"
            : new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 3,
              }).format(price) + " đ"}
        </div>
      </td>
      <td
        className="p-2 align-top tabular-nums"
        aria-label={"Thành tiền thu hồi dòng " + (index + 1)}
      >
        <div className="flex min-h-[34px] items-center">
          {amount === undefined ? "—" : money(amount)}
        </div>
        {(saved ? labels["recovery_valuation_method:"+item.id] === "current_price_quality" : resolved === key && quote?.valuation_method === "current_price_quality") && <p className="text-xs text-slate-500">Giá hiện tại × chất lượng kỹ thuật.</p>}
        {remainingPercent !== undefined && (
          <p className="text-xs text-slate-500">
            Còn {remainingPercent.replace(".", ",")}% định mức
          </p>
        )}
        {(saved
          ? labels["recovery_estimated_hours:" + item.id] === "1"
          : resolved === key && quote?.estimated_hours) && (
          <p className="text-xs text-amber-700">
            Giờ tạm tính từ thời gian lắp/tháo.
          </p>
        )}
        {(pendingReason ||
          (resolved === key && quote?.valuation_status === "pending")) && (
          <p role="status" className="text-xs text-amber-700">
            ⚠ Chưa xác định giá trị – có thể xuất tiếp, cần bổ sung sau.
            {(pendingReason || quote?.warning) && (
              <span className="block">{pendingReason || quote?.warning}</span>
            )}
          </p>
        )}
        {resolved === key && error && (
          <p role="status" className="text-xs text-amber-700">
            {error}
          </p>
        )}
      </td>
    </>
  );
}
function RecoverySerials({
  documents,
  usageId,
  ...props
}: Omit<Parameters<typeof IssueSerialPicker>[0], "documents"> & {
  documents: DocumentClient;
  usageId: string;
}) {
  const adapter = useMemo(
    () => ({
      ...documents,
      availableSerials: async (
        _part: string,
        _warehouse: string,
        _state: string,
        q: string,
        page: number,
        signal?: AbortSignal,
      ) => {
        if (!documents.recoverySerials)
          throw new Error("Chưa tải được serial thu hồi.");
        return documents.recoverySerials(usageId, q, page, signal);
      },
    }),
    [documents, usageId],
  );
  return <IssueSerialPicker {...props} recovery documents={adapter} />;
}
export function RecoveryLines({
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
}: Props & { costsCurrent?: boolean }) {
  const [serialId, setSerialId] = useState<string>();
  const [sourceLine, setSourceLine] = useState<string>();
  const [selectedSources, setSelectedSources] = useState<
    Record<string, RecoverySourceRow>
  >({});
  const active = draft.lines.find((l) => l.id === serialId),
    disabled = readOnly || saving;
  const field = (
    item: DraftLine,
    key: "quantity" | "recovery_quality_percent" | "recovery_current_unit_price" | "recovery_assessor" | "notes",
    label: string,
    index: number,
  ) => (
    <input
      aria-label={label + " dòng " + (index + 1)}
      className={docInput}
      value={item[key] ?? ""}
      disabled={disabled}
      readOnly={
        key === "quantity" &&
        labels["serialized:" + item.part_id] === "1" &&
        lineSerials(item).length <= 1
      }
      required={key === "quantity" || key === "recovery_quality_percent"}
      inputMode={key === "notes" || key === "recovery_assessor" ? undefined : "decimal"}
      onChange={(e) => line(item.id, { [key]: e.target.value })}
    />
  );
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1460px] table-fixed text-left text-xs">
          <colgroup>
            {[36, 310, 85, 110, 120, 150, 110, 170, 110, 150, 90].map(
              (w, i) => (
                <col key={i} style={{ width: w }} />
              ),
            )}
          </colgroup>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "STT",
                "Vật tư / Nguồn xuất",
                "Số lượng",
                "Đơn giá",
                "Thành tiền",
                "Chất lượng (%)",
                "Serial",
                "Phân loại",
                "Kho nhận thu hồi",
                "Ghi chú",
                "Thao tác",
              ].map((h) => (
                <th key={h} className={"p-2"+(h==="Kho nhận thu hồi"?" text-center":"")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((item, index) => {
              const marketEligible=item.recovery_current_unit_price!==undefined||labels["recovery_market_eligible:"+item.id]==="1";
              const serial = labels["serialized:" + item.part_id] === "1",
                classification =
                  item.recovery_classification ??
                  (item.stock_state === "pending_scrap" ? "CTL" : "CSD");
              return (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="p-2 align-top">{index + 1}</td>
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      className={docButton + " w-full !justify-start"}
                      disabled={disabled}
                      onClick={() => setSourceLine(item.id)}
                      aria-label={
                        "Chọn vật tư đang sử dụng dòng " + (index + 1)
                      }
                    >
                      {labels["sku:" + item.part_id] ||
                        "Chọn vật tư đang sử dụng…"}
                    </button>
                    <p className="mt-1 font-semibold">
                      {labels["parts:" + item.part_id]
                        ?.split(" — ")
                        .slice(1)
                        .join(" — ")}
                    </p>
                    <p className="text-slate-500">
                      ĐVT: {labels["unit:" + item.part_id] ?? "—"}
                    </p>
                    {selectedSources[item.id] &&
                    selectedSources[item.id].usage_id === item.usage_id ? (
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <p>
                          {selectedSources[item.id].code} ·{" "}
                          {documentDateTime(
                            selectedSources[item.id].started_at,
                          )}
                        </p>
                        <p>
                          {selectedSources[item.id].target_label} ·{" "}
                          {selectedSources[item.id].position}
                        </p>
                        <p>
                          ODO lúc xuất:{" "}
                          {selectedSources[item.id].odo_milli === null
                            ? "—"
                            : new Intl.NumberFormat("vi-VN").format(
                                selectedSources[item.id].odo_milli! / 1000,
                              )}{" "}
                          · Còn thu hồi:{" "}
                          {selectedSources[item.id].quantity_milli / 1000}
                        </p>
                      </div>
                    ) : item.usage_id ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {labels["recovery_source:" + item.id] ||
                          "Đã liên kết lần xuất/lắp"}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Chọn đúng lần xuất/lắp từ vật tư đang sử dụng.
                      </p>
                    )}
                    {marketEligible&&<label className="mt-2 block text-xs text-slate-500">Giá mua hiện tại / đơn vị{field(item,"recovery_current_unit_price","Giá mua hiện tại",index)}<span>Chưa rõ giá gốc: giá hiện tại × chất lượng kỹ thuật.</span></label>}
                    {selectedSources[item.id]?.opening_current_unit_price&&<p className="mt-2 text-xs text-slate-500">Tham khảo đầu kỳ: {money(Number(selectedSources[item.id].opening_current_unit_price))} · {selectedSources[item.id].opening_quality_percent??"—"}% · {[selectedSources[item.id].opening_assessor,selectedSources[item.id].opening_confirmation_basis].filter(Boolean).join(" · ")||"Chưa ghi căn cứ"}. Có thể điều chỉnh theo đánh giá lúc tháo.</p>}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["odo", "hours"] as const).map((key) => (
                        <label key={key} className="text-xs text-slate-500">
                          {key === "odo" ? "ODO lúc tháo" : "Giờ lúc tháo"}
                          <input
                            className={docInput + " mt-1"}
                            aria-label={
                              (key === "odo" ? "ODO tháo" : "Giờ tháo") +
                              " dòng " +
                              (index + 1)
                            }
                            disabled={disabled}
                            inputMode="decimal"
                            value={item[key]}
                            placeholder={
                              draft.recovery_details?.[key] || "Theo đầu phiếu"
                            }
                            onChange={(e) =>
                              line(item.id, { [key]: e.target.value })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    {field(item, "quantity", "Số lượng thu hồi", index)}
                  </td>
                  <RecoveryMoney
                    item={item}
                    index={index}
                    documents={documents}
                    businessAt={draft.business_at}
                    odo={item.odo || draft.recovery_details?.odo || ""}
                    hours={item.hours || draft.recovery_details?.hours || ""}
                    labels={labels}
                    saved={
                      costsCurrent &&
                      (labels["recovery_amount:" + item.id] !== undefined ||
                        labels["valuation_pending:" + item.id] === "1")
                    }
                    pendingReason={
                      costsCurrent
                        ? labels["valuation_reason:" + item.id]
                        : undefined
                    }
                  />
                  <td className="p-2 align-top">
                    {field(item,"recovery_quality_percent","Chất lượng còn lại (%)",index)}
                    {marketEligible&&<label className="mt-2 block text-xs text-slate-500">Kỹ thuật xác nhận{field(item,"recovery_assessor","Kỹ thuật xác nhận",index)}</label>}
                  </td>
                  <td className="p-2 align-top">
                    {serial ? (
                      <button
                        type="button"
                        className={docButton}
                        disabled={
                          saving ||
                          (!readOnly && (!item.usage_id || !draft.warehouse_id))
                        }
                        onClick={() => setSerialId(item.id)}
                        aria-label={"Serial thu hồi dòng " + (index + 1)}
                      >
                        Serial {lineSerials(item).length}/{item.quantity} ›
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <select
                      aria-label={"Phân loại thu hồi dòng " + (index + 1)}
                      className={docInput}
                      value={classification}
                      disabled={disabled}
                      onChange={(e) =>
                        line(item.id, {
                          recovery_classification: e.target
                            .value as RecoveryClass,
                          stock_state: recoveryState(
                            e.target.value as RecoveryClass,
                          ),
                        })
                      }
                    >
                      {Object.entries(recoveryClasses).map(([key, label]) => (
                        <option key={key} value={key}>
                          {key} – {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 align-top text-center" aria-label={"Kho nhận thu hồi dòng "+(index+1)}>
                    <div className="flex min-h-[38px] items-center justify-center">{labels["warehouses:" + draft.warehouse_id]?.split(
                      " — ",
                    )[0] || "Chọn kho"}</div>
                  </td>
                  <td className="p-2 align-top">
                    {field(item, "notes", "Ghi chú thu hồi", index)}
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className={docButton + " !px-1.5"}
                        title="Nhân đôi dòng"
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
                        className={docButton + " !px-1.5 text-red-600"}
                        title="Xóa dòng"
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
      {sourceLine && (
        <RecoveryUsagePicker
          documents={documents}
          vehicleId={draft.recovery_details?.vehicle_id || ""}
          used={draft.lines
            .filter((l) => l.id !== sourceLine)
            .flatMap((l) =>
              lineSerials(l).map(
                (serial) => l.usage_id + ":" + serial.toUpperCase(),
              ),
            )}
          onClose={() => setSourceLine(undefined)}
          onSelect={(row) => {
            remember("parts", row.part_id, {
              id: row.part_id,
              version: row.part_version,
              sku: row.sku,
              name: row.name,
              unit: row.unit,
              is_serialized: row.is_serialized,
            });
            line(sourceLine, {
              part_id: row.part_id,
              usage_id: row.usage_id,
              quantity: row.is_serialized
                ? "1"
                : String(Math.min(1, row.quantity_milli / 1000)),
              serial: "",
              serials: row.serial_number ? [row.serial_number] : [],
              source_line_id: "",
              recovery_current_unit_price: row.source_kind === "opening_usage" && row.opening_original_unit_price_known === 0 ? displayViNumber(row.opening_current_unit_price??"") : undefined,
              recovery_quality_percent: row.source_kind === "opening_usage" && row.opening_original_unit_price_known === 0 ? displayViNumber(row.opening_quality_percent??"") : undefined,
              recovery_assessor: row.source_kind === "opening_usage" && row.opening_original_unit_price_known === 0 ? row.opening_assessor??"" : undefined,
              odo: "",
              hours: "",
            });
            setSelectedSources((current) => ({
              ...current,
              [sourceLine]: row,
            }));
            setSourceLine(undefined);
          }}
        />
      )}
      {active && (
        <RecoverySerials
          key={active.id + ":" + active.usage_id}
          usageId={active.usage_id}
          documents={documents}
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
          onChange={(serials) => line(active.id, { serial: "", serials })}
          onClose={() => setSerialId(undefined)}
        />
      )}
    </>
  );
}
