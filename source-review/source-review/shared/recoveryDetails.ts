export const recoveryClasses = {
  CSD: "Còn sử dụng được",
  CSC: "Chờ sửa chữa",
  KSD: "Không sử dụng được",
  CTL: "Chờ thanh lý",
} as const;
export type RecoveryClass = keyof typeof recoveryClasses;
export const recoveryState = (value: RecoveryClass) =>
  value === "KSD" || value === "CTL" ? "pending_scrap" : "recovered";
export interface RecoveryDetails {
  vehicle_id: string;
  vehicle_plate: string;
  driver_id: string;
  driver_name: string;
  trailer_number: string;
  generator_code: string;
  container_number: string;
  removed_from: string;
  odo: string;
  hours: string;
  handover_name: string;
}
export const emptyRecoveryDetails = (): RecoveryDetails => ({
  vehicle_id: "",
  vehicle_plate: "",
  driver_id: "",
  driver_name: "",
  trailer_number: "",
  generator_code: "",
  container_number: "",
  removed_from: "",
  odo: "",
  hours: "",
  handover_name: "",
});
export function parseRecoveryDetails(raw: unknown): RecoveryDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Thông tin thu hồi không hợp lệ.");
  const value = emptyRecoveryDetails();
  for (const [key, v] of Object.entries(raw)) {
    if (
      !Object.hasOwn(value, key) ||
      typeof v !== "string" ||
      v.length > (key === "removed_from" ? 1000 : 256)
    )
      throw new Error("Thông tin thu hồi không hợp lệ.");
    value[key as keyof RecoveryDetails] = v.trim();
  }
  for (const key of ["vehicle_id", "driver_id"] as const)
    if (value[key] && !/^[a-zA-Z0-9_-]{1,128}$/.test(value[key]))
      throw new Error("Phương tiện/tài xế thu hồi không hợp lệ.");
  for (const key of ["odo", "hours"] as const)
    if (value[key] && !/^\d{1,12}(?:\.\d{1,3})?$/.test(value[key]))
      throw new Error("ODO/giờ máy thu hồi không hợp lệ.");
  return value;
}

export function recoveryLineCounts(lines:readonly {recovery_classification?:RecoveryClass;stock_state:string}[]):Record<RecoveryClass,number>{
 const result:Record<RecoveryClass,number>={CSD:0,CSC:0,KSD:0,CTL:0};for(const line of lines)result[line.recovery_classification??(line.stock_state==='pending_scrap'?'CTL':'CSD')]++;return result;
}

/** Empty means all; multiple selected classifications match any selected type. */
export function parseRecoveryClassFilter(value:string):RecoveryClass[]{
 if(!value)return [];const values=value.split(',');if(values.length>4||new Set(values).size!==values.length||values.some(c=>!Object.hasOwn(recoveryClasses,c)))throw new Error('Phân loại thu hồi không hợp lệ.');
 return (Object.keys(recoveryClasses) as RecoveryClass[]).filter(c=>values.includes(c));
}
export function toggleRecoveryClassFilter(value:string,key:RecoveryClass):string{
 const selected=parseRecoveryClassFilter(value),next=selected.includes(key)?selected.filter(c=>c!==key):[...selected,key];return (Object.keys(recoveryClasses) as RecoveryClass[]).filter(c=>next.includes(c)).join(',');
}
