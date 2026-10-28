export interface IssueDetails {
  installation_target?:string;
  installation_odo?:string;
  installation_hours?:string;
  recipient_staff_id: string;
  department_id: string;
  department_name: string;
  driver_id: string;
  driver_name: string;
  vehicle_id: string;
  vehicle_plate: string;
  odo: string;
  vehicle_group: string;
  trailer_number: string;
  container_number: string;
  other: string;
}
export const emptyIssueDetails = (): IssueDetails => ({
  installation_target:"",installation_odo:"",installation_hours:"",
  recipient_staff_id: "",
  department_id: "",
  department_name: "",
  driver_id: "",
  driver_name: "",
  vehicle_id: "",
  vehicle_plate: "",
  odo: "",
  vehicle_group: "",
  trailer_number: "",
  container_number: "",
  other: "",
});
export function parseIssueDetails(value: unknown): IssueDetails {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Thông tin nhận vật tư không hợp lệ.");
  const result = emptyIssueDetails();
  for (const [key, raw] of Object.entries(value)) {
    if (
      !Object.hasOwn(result, key) ||
      typeof raw !== "string" ||
      raw.length > (key === "other" ? 1000 : 256)
    )
      throw new Error("Thông tin nhận vật tư không hợp lệ.");
    if (key.endsWith("_id") && raw.length > 128)
      throw new Error("Mã liên kết không hợp lệ.");
    result[key as keyof IssueDetails] = raw.trim();
  }
  if ([result.odo,result.installation_odo,result.installation_hours].some(v=>v&&!/^\d{1,12}(?:\.\d{1,3})?$/.test(v)))
    throw new Error("ODO hiện tại phải là số không âm, tối đa 3 số lẻ.");
  if (
    !["", "BNAM", "DCANG", "box_truck", "office_car"].includes(
      result.vehicle_group,
    )
  )
    throw new Error("Nhóm xe không hợp lệ.");
  if(result.installation_target&&!Object.hasOwn(installationKinds,result.installation_target))throw new Error("Phương tiện lắp thiết bị không hợp lệ.");
  return result;
}
export function issueVehicleGroup(row: {
  route_group?: unknown;
  source_group?: unknown;
  type?: unknown;
}) {
  const route = String(row.route_group ?? "").toUpperCase();
  if (row.source_group === "box_truck") return "box_truck";
  if (row.type === "office_car" || row.source_group === "office_car")
    return "office_car";
  return ["BNAM", "DCANG"].includes(route) ? route : "";
}

export function requireIssueDetails(info?:IssueDetails){
 if(!info?.driver_id)throw new Error("Chọn Họ tên lái xe.");
 if(!info.vehicle_id)throw new Error("Chọn Biển số xe.");
 if(!info.odo.trim())throw new Error("Nhập Số Km (ODO) hiện tại.");
}

export const issuePurposes = {
  use: "Sử dụng",
  repair: "Sửa chữa",
  warranty: "Bảo hành",
  liquidation: "Thanh lý",
} as const;
export type IssuePurpose = keyof typeof issuePurposes;

export const installationKinds={vehicle:'Xe',trailer:'Rơ moóc',generator:'Máy phát',container:'Container'} as const;
export function issueInstallationOptions(info:IssueDetails){
 return ([['vehicle',info.vehicle_plate],['trailer',info.trailer_number],['generator',info.other],['container',info.container_number]] as const).filter(([,code])=>!!code.trim()).map(([value,code])=>({value,code,label:installationKinds[value]+' · '+code}));
}
export function requireIssueInstallation(info?:IssueDetails){
 if(!info?.installation_target||!issueInstallationOptions(info).some(o=>o.value===info.installation_target))throw new Error('Chọn Phương tiện lắp thiết bị.');
}
export function issueInstallationLabel(info?:IssueDetails){return info?issueInstallationOptions(info).find(o=>o.value===info.installation_target)?.label??'':'';}
