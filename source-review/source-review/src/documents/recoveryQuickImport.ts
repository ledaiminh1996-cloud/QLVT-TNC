import type {DraftLine} from "../../shared/documents";
import {scaledDecimal} from "../../shared/documents";
import {serialKey,lineSerials} from "../../shared/documentSerials";
import type {RecoverySourceRow} from "../../shared/recoverySources";
import type {QuickRow} from "../../shared/quickImportTable";
import type {DocumentClient} from "./documentClient";
import {normalizeSearch} from "../../shared/searchText";

/** Resolve a human-readable import against authorized open usages, including mounted openings. */
export function recoveryImportResolver(documents:DocumentClient|undefined,vehicleId:string,businessAt:string,existing:DraftLine[],onSource:(source:RecoverySourceRow)=>void=()=>{}){
 const cache=new Map<string,RecoverySourceRow[]>(),used=new Map<string,number>(),serialsUsed=new Set<string>();
 for(const line of existing){if(!line.usage_id)continue;used.set(line.usage_id,(used.get(line.usage_id)??0)+Number(scaledDecimal(line.quantity,3,"Số lượng")));for(const serial of lineSerials(line))serialsUsed.add(line.part_id+":"+serialKey(serial));}
 async function sources(query:string){
  if(cache.has(query))return cache.get(query)!;
  if(!documents?.recoverySources)throw new Error("Chưa tải được nguồn vật tư đang sử dụng. Đóng và mở lại phiếu.");
  const rows:RecoverySourceRow[]=[];
  for(let page=1;page<=200;page++){
   const result=await documents.recoverySources(query,page,vehicleId);
   rows.push(...result.data);
   if(rows.length>=result.pagination.total){cache.set(query,rows);return rows;}
   if(!result.data.length)throw new Error("Danh sách nguồn đã thay đổi. Xem trước lại bảng nhập.");
  }
  throw new Error("Có quá nhiều nguồn. Bổ sung Serial hoặc số phiếu nguồn để tìm chính xác.");
 }
 return async(line:DraftLine,values:QuickRow,serialized:boolean)=>{
  const match=(r:RecoverySourceRow)=>r.part_id===line.part_id&&(!businessAt||r.started_at<=businessAt)&&(!values.source_code?.trim()||normalizeSearch(r.code)===normalizeSearch(values.source_code))&&(!values.target_code?.trim()||normalizeSearch(r.target_label)===normalizeSearch(values.target_code));
  const groups=new Map<string,{source:RecoverySourceRow;serials:string[];quantity:number}>();
  const add=(source:RecoverySourceRow,quantity:number,serial?:string)=>{
   const group=groups.get(source.usage_id)??{source,serials:[],quantity:0};group.quantity+=quantity;if(serial)group.serials.push(serial);groups.set(source.usage_id,group);
  };
  if(serialized){
   if(!lineSerials(line).length)throw new Error("Vật tư Serial: nhập đủ Serial đang gắn để xác định lần xuất/lắp gốc.");
   for(const serial of lineSerials(line)){
    const key=line.part_id+":"+serialKey(serial);if(serialsUsed.has(key))throw new Error("Serial bị lặp trong phiếu: "+serial);
    const candidates=(await sources(serial)).filter(r=>match(r)&&r.serial_number!==null&&serialKey(r.serial_number)===serialKey(serial));
    const unique=[...new Map(candidates.map(r=>[r.usage_id,r])).values()];
    if(!unique.length)throw new Error("Không tìm thấy lần xuất/lắp còn mở cho Serial "+serial+" theo phương tiện/ngày đã chọn.");
    if(unique.length>1)throw new Error("Serial "+serial+" có nhiều nguồn; bổ sung Số phiếu nguồn và Biển số / mã thiết bị.");
    add(unique[0],1000,unique[0].serial_number!);serialsUsed.add(key);
   }
  }else{
   const candidates=(await sources(values.source_code?.trim()||values.sku!.trim())).filter(match);
   const unique=[...new Map(candidates.map(r=>[r.usage_id,r])).values()];
   if(!unique.length)throw new Error("Không tìm thấy lần xuất/lắp còn mở cho vật tư theo phương tiện/ngày đã chọn.");
   if(unique.length>1)throw new Error("Vật tư có nhiều lần xuất/lắp còn mở. Bổ sung Số phiếu nguồn và Biển số / mã thiết bị; nếu vẫn trùng, chọn nguồn trực tiếp trong phiếu.");
   add(unique[0],Number(scaledDecimal(line.quantity,3,"Số lượng")));
  }
  return [...groups.values()].map(({source,serials,quantity}):DraftLine=>{
   const total=(used.get(source.usage_id)??0)+quantity;if(total>source.open_quantity_milli)throw new Error("Tổng số lượng thu hồi vượt phần còn đang sử dụng của "+source.code+".");used.set(source.usage_id,total);
   onSource(source);
   const opening=source.source_kind==="opening_usage"&&source.opening_original_unit_price_known===0;
   const quality=line.recovery_quality_percent??(opening?source.opening_quality_percent:undefined);
   if(!quality)throw new Error("Nhập chất lượng còn lại từ 0 đến 100%.");
   return {...line,id:crypto.randomUUID(),usage_id:source.usage_id,quantity:String(quantity/1000),document_quantity:String(quantity/1000),serial:"",serials,recovery_quality_percent:quality,...(opening?{recovery_current_unit_price:source.opening_current_unit_price??"",recovery_assessor:source.opening_assessor??""}:{} )};
  });
 };
}
