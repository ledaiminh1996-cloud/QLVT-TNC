import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { DocumentDraft } from "../../shared/documents";
import {
  emptyRecoveryDetails,
  recoveryClasses,
  type RecoveryDetails,
} from "../../shared/recoveryDetails";
import { displayViNumber } from "../../shared/documentNumbers";
import type { CatalogClient } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import type { DocumentClient } from "./documentClient";
import { CatalogPicker, docInput } from "./CatalogPicker";
export function RecoveryHeader({
  draft,
  setDraft,
  api,
  documents,
  disabled,
  onBusyChange,
  topFields,
}: {
  draft: DocumentDraft;
  setDraft: Dispatch<SetStateAction<DocumentDraft>>;
  api: CatalogClient;
  documents: DocumentClient;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  topFields: ReactNode;
}) {
  const info = draft.recovery_details ?? emptyRecoveryDetails();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      controller.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  const change = (key: keyof RecoveryDetails, value: string) =>
    setDraft((d) => ({
      ...d,
      recovery_details: {
        ...(d.recovery_details ?? emptyRecoveryDetails()),
        [key]: value,
      },
    }));
  async function choose(key: "vehicle_id" | "driver_id", id: string) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setPending(true);
    onBusyChange(true);
    setError("");
    try {
      if (!documents.issueContext)
        throw new Error("Chưa tải được thông tin phương tiện.");
      const next = { ...info, [key]: id };
      const result = await documents.issueContext(
        "",
        key === "driver_id" ? "" : next.vehicle_id,
        key === "vehicle_id" ? "" : next.driver_id,
        c.signal,
      );
      if (c.signal.aborted) return;
      setDraft((d) => ({
        ...d,
        ...(d.recovery_details?.vehicle_id !== result.vehicle_id
          ? {
              lines: d.lines.map((line) => ({
                ...line,
                usage_id: "",
                serial: "",
                serials: [],
                odo: "",
                hours: "",
              })),
            }
          : {}),
        recovery_details: {
          ...next,
          vehicle_id: result.vehicle_id,
          vehicle_plate: result.vehicle_plate,
          driver_id: result.driver_id,
          driver_name: result.driver_name,
          trailer_number: result.trailer_number,
          generator_code: result.other,
          container_number: result.container_number,
          odo: displayViNumber(result.odo),
          removed_from: next.removed_from || result.vehicle_plate,
        },
      }));
    } catch (e) {
      if (!c.signal.aborted) setError(accessMessage(e));
    } finally {
      if (!c.signal.aborted) {
        setPending(false);
        onBusyChange(false);
      }
    }
  }
  const input = (key: keyof RecoveryDetails, label: string) => (
    <label className="block text-xs font-semibold">
      {label}
      <input
        aria-label={label}
        className={docInput + " mt-1"}
        value={info[key]}
        disabled={disabled || pending}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  return (
    <section
      className="issue-header space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
      aria-label="Thông tin thu hồi"
    >
      <div className="grid gap-3 sm:grid-cols-3">{topFields}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CatalogPicker
          api={api}
          resource="staff"
          staffType="driver"
          label="Họ tên lái xe"
          value={info.driver_id}
          selectedLabel={info.driver_name}
          disabled={disabled || pending}
          onChange={(id) => void choose("driver_id", id)}
        />
        {input("odo", "Số Km (ODO) hiện tại")}
        {input("hours", "Giờ máy hiện tại")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CatalogPicker
          api={api}
          resource="vehicles"
          label="Biển số xe"
          value={info.vehicle_id}
          selectedLabel={info.vehicle_plate}
          disabled={disabled || pending}
          onChange={(id) => void choose("vehicle_id", id)}
        />
        {input("trailer_number", "Rơmooc số")}
        {input("generator_code", "Máy phát số")}
        {input("container_number", "Container số")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {input("removed_from", "Phương tiện tháo thiết bị")}
        <label className="block text-xs font-semibold">
          Lý do tháo
          <input
            aria-label="Lý do tháo"
            className={docInput + " mt-1"}
            value={draft.purpose}
            disabled={disabled || pending}
            onChange={(e) =>
              setDraft((d) => ({ ...d, purpose: e.target.value }))
            }
          />
        </label>
        {input("handover_name", "Người bàn giao")}
        <label className="block text-xs font-semibold">
          Người tiếp nhận
          <input
            aria-label="Người tiếp nhận"
            className={docInput + " mt-1"}
            value={draft.recipient}
            disabled={disabled || pending}
            onChange={(e) =>
              setDraft((d) => ({ ...d, recipient: e.target.value }))
            }
          />
        </label>
      </div>
      <fieldset>
        <legend className="mb-1 text-xs font-semibold">
          Phân loại theo từng dòng vật tư
        </legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(recoveryClasses).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={draft.lines.some(
                  (l) =>
                    (l.recovery_classification ??
                      (l.stock_state === "pending_scrap" ? "CTL" : "CSD")) ===
                    key,
                )}
                disabled
              />
              {label} ({key})
            </label>
          ))}
        </div>
      </fieldset>
      {pending && (
        <p role="status" className="text-xs text-slate-500">
          Đang lấy thông tin phương tiện…
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
