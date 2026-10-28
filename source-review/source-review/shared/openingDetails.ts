export interface OpeningDetails {driver_id:string;driver_name:string;vehicle_id:string;vehicle_plate:string;trailer_number:string;generator_code:string;vehicle_odo?:string;trailer_odo?:string}
export const emptyOpeningDetails=():OpeningDetails=>({driver_id:"",driver_name:"",vehicle_id:"",vehicle_plate:"",trailer_number:"",generator_code:"",vehicle_odo:"",trailer_odo:""});
export function parseOpeningDetails(value:unknown):OpeningDetails{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Thông tin tài xế đầu kỳ không hợp lệ.");
 const result=emptyOpeningDetails();
 for(const [key,raw]of Object.entries(value)){if(!Object.hasOwn(result,key)||typeof raw!=="string"||raw.length>(key.endsWith("_id")?128:256)||(key.endsWith("_id")&&raw&&!/^[a-zA-Z0-9_-]+$/.test(raw)))throw new Error("Thông tin tài xế đầu kỳ không hợp lệ.");result[key as keyof OpeningDetails]=raw.trim();}
 for(const key of ["vehicle_odo","trailer_odo"]as const)if(result[key]&&!/^\d{1,12}(?:\.\d{1,3})?$/.test(result[key]!))throw new Error("ODO đầu kỳ phải là số không âm, tối đa 3 số lẻ.");
 return result;
}
