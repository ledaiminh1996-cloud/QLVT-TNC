import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { DocumentDraft } from "../../shared/documents";
import { emptyIssueDetails,issueInstallationOptions } from "../../shared/issueDetails";
import { displayViNumber } from "../../shared/documentNumbers";
import type { CatalogClient } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import type { DocumentClient } from "./documentClient";
import { CatalogPicker, docInput } from "./CatalogPicker";
export function IssueHeader({
  draft,
  setDraft,
  api,
  documents,
  disabled,
  onBusyChange,
  topFields,
}: {
  topFields?: ReactNode;
  draft: DocumentDraft;
  setDraft: Dispatch<SetStateAction<DocumentDraft>>;
  api: CatalogClient;
  documents: DocumentClient;
  disabled: boolean;
  onBusyChange: (v: boolean) => void;
}) {
  const info = draft.issue_details ?? emptyIssueDetails();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      request.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  async function choose(
    key: "recipient_staff_id" | "driver_id" | "vehicle_id",
    id: string,
  ) {
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    setPending(true);
    onBusyChange(true);
    setError("");
    try {
      if (!documents.issueContext)
        throw new Error("Chưa tải được thông tin nhận vật tư.");
      const next = { ...info, [key]: id };
      const result = await documents.issueContext(
        next.recipient_staff_id,
        key === "driver_id" ? "" : next.vehicle_id,
        key === "vehicle_id" ? "" : next.driver_id,
        c.signal,
      );
      if (c.signal.aborted) return;
      setDraft((d) => ({
        ...d,
        ...((key==='vehicle_id'||key==='driver_id')?{lines:d.lines.map(l=>({...l,target_id:'',odo:'',hours:''}))}:{}),
        recipient:
          result.recipient || (key !== "recipient_staff_id" ? d.recipient : ""),
        issue_details: {
          ...next,
          department_id: result.department_id,
          department_name: result.department_name,
          driver_id: result.driver_id,
          driver_name: result.driver_name,
          vehicle_id:result.vehicle_id,
          vehicle_plate: result.vehicle_plate,
          vehicle_group: result.vehicle_group,
          ...((key === "vehicle_id" || key === "driver_id")
            ? {
                odo: displayViNumber(result.odo),
                installation_target:"",installation_odo:"",installation_hours:"",
                trailer_number: result.trailer_number,
                container_number: result.container_number,
                other: result.other,
              }
            : {}),
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
  const change = (
    key: "odo" | "trailer_number" | "container_number" | "other" | "installation_odo" | "installation_hours",
    value: string,
  ) =>
    setDraft((d) => {
      const selected=d.issue_details?.installation_target,reset=(key==='trailer_number'&&selected==='trailer')||(key==='other'&&selected==='generator')||(key==='container_number'&&selected==='container');
      return {...d,...(reset?{lines:d.lines.map(l=>({...l,target_id:'',odo:'',hours:''}))}:{}),issue_details:{...(d.issue_details??emptyIssueDetails()),[key]:value,...(reset?{installation_target:'',installation_odo:'',installation_hours:''}:{})}};
    });
  const input = (
    key: "odo" | "trailer_number" | "container_number" | "other" | "installation_odo" | "installation_hours",
    label: string,
  ) => (
    <label className="block text-xs font-semibold">
      {label}
      <input
        aria-label={label}
        className={
          docInput + " mt-1" + (key === "odo" ? " text-left tabular-nums" : "")
        }
        required={key === "odo"}
        inputMode={["odo","installation_odo","installation_hours"].includes(key) ? "decimal" : undefined}
        value={info[key]??""}
        disabled={disabled || pending}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  return (
    <section
      className="issue-header space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3"
      aria-label="Thông tin nhận vật tư"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {topFields}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CatalogPicker
          api={api}
          resource="staff"
          label="Người nhận"
          value={
            info.recipient_staff_id ||
            (draft.recipient ? "__saved-recipient__" : "")
          }
          selectedLabel={draft.recipient}
          disabled={disabled || pending}
          onChange={(id) => void choose("recipient_staff_id", id)}
        />
        <label className="block text-xs font-semibold">
          Bộ phận nhận
          <input
            aria-label="Bộ phận nhận"
            className={docInput + " mt-1"}
            readOnly
            value={info.department_name}
            placeholder="Tự lấy theo người nhận"
          />
        </label>
        <label className="block text-xs font-semibold">
          Nội dung
          <input
            className={docInput + " mt-1"}
            value={draft.purpose}
            disabled={disabled || pending}
            onChange={(e) =>
              setDraft((d) => ({ ...d, purpose: e.target.value }))
            }
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CatalogPicker
          api={api}
          resource="staff"
          staffType="driver"
          label="Họ tên lái xe *"
          value={info.driver_id}
          selectedLabel={info.driver_name}
          disabled={disabled || pending}
          onChange={(id) => void choose("driver_id", id)}
        />
        <CatalogPicker
          api={api}
          resource="vehicles"
          label="Biển số xe *"
          value={info.vehicle_id}
          selectedLabel={info.vehicle_plate}
          disabled={disabled || pending}
          onChange={(id) => void choose("vehicle_id", id)}
        />
        {input("odo", "Số Km (ODO) hiện tại *")}
      </div>
      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <fieldset className="min-w-0 rounded-lg border border-slate-200 px-3 py-2">
          <legend className="px-1 text-xs font-semibold">Nhóm xe</legend>
          <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2">
            {[
              ["BNAM", "Đường dài"],
              ["DCANG", "Đường cảng"],
              ["box_truck", "Xe tải thùng"],
              ["office_car", "Xe con"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={info.vehicle_group === key}
                  disabled
                />
                {label}
              </label>
            ))}
          </div>
          {info.vehicle_id && !info.vehicle_group && (
            <p className="mt-1 text-xs text-amber-700">
              Danh mục xe chưa có nhóm phù hợp.
            </p>
          )}
        </fieldset>
        <fieldset className="min-w-0 rounded-lg border border-slate-200 px-3 py-2">
          <legend className="px-1 text-xs font-semibold">
            Phương tiện/thiết bị ghép nối
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {input("trailer_number", "Rơmooc số")}
            {input("other", "Máy phát")}
            {input("container_number", "Container số")}
          </div>
        </fieldset>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-semibold">Phương tiện lắp thiết bị *
          <select aria-label="Phương tiện lắp thiết bị" required className={docInput+' mt-1'} value={info.installation_target??''} disabled={disabled||pending||!info.vehicle_id} onChange={e=>{const value=e.target.value;setDraft(d=>({...d,issue_details:{...(d.issue_details??emptyIssueDetails()),installation_target:value,installation_odo:'',installation_hours:''},lines:d.lines.map(l=>({...l,target_id:'',odo:'',hours:''}))}))}}>
            <option value="">Chọn phương tiện lắp thiết bị</option>{issueInstallationOptions(info).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">ODO lúc lắp
          <input aria-label="ODO lúc lắp" className={docInput+' mt-1 tabular-nums'} inputMode="decimal" value={info.installation_target==='vehicle'?info.odo:(info.installation_odo??'')} disabled={disabled||pending||!info.installation_target||info.installation_target==='vehicle'||info.installation_target==='generator'||info.installation_target==='container'} placeholder="Chưa có số đo thì để trống" onChange={e=>change('installation_odo',e.target.value)}/>
        </label>
        {input('installation_hours','Giờ máy lúc lắp')}
      </div>
      {info.driver_id&&!info.vehicle_id&&!pending&&<p className="text-xs text-amber-700">Tài xế chưa có xe duy nhất trong danh mục. Vui lòng chọn biển số xe.</p>}
      {pending && (
        <p role="status" className="text-xs text-slate-500">
          Đang lấy thông tin danh mục…
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
