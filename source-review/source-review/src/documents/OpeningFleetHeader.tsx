import {displayViNumber} from "../../shared/documentNumbers";
import {useEffect,useRef,useState,type Dispatch,type SetStateAction,type ReactNode} from "react";
import type {DocumentDraft} from "../../shared/documents";
import {emptyOpeningDetails} from "../../shared/openingDetails";
import type {CatalogClient} from "../api/catalogClient";
import {accessMessage} from "../api/catalogClient";
import type {DocumentClient} from "./documentClient";
import {CatalogPicker,docInput} from "./CatalogPicker";
export function OpeningFleetHeader({draft,setDraft,api,documents,disabled,onBusyChange,topFields}:{draft:DocumentDraft;setDraft:Dispatch<SetStateAction<DocumentDraft>>;api:CatalogClient;documents:DocumentClient;disabled:boolean;onBusyChange:(busy:boolean)=>void;topFields:ReactNode}){
 const info={...emptyOpeningDetails(),...draft.opening_details};const controller=useRef<AbortController|undefined>(undefined);const [error,setError]=useState("");
 useEffect(()=>()=>{controller.current?.abort();onBusyChange(false)},[onBusyChange]);
 async function choose(id:string,name:string){controller.current?.abort();const c=new AbortController();controller.current=c;setError("");setDraft(d=>({...d,opening_details:{...emptyOpeningDetails(),driver_id:id,driver_name:name}}));
 if(!id){onBusyChange(false);return;}onBusyChange(true);
 try{if(!documents.issueContext)throw new Error("Chưa tải được thông tin ghép nối.");const result=await documents.issueContext("","",id,c.signal);if(c.signal.aborted)return;
 let trailerOdo="";
 if(result.trailer_number){const page=await api.list("vehicles",{q:result.trailer_number,type:"trailer",status:"active",pageSize:25,signal:c.signal});if(c.signal.aborted)return;const trailer=page.data.find(row=>String(row.plate_number)===result.trailer_number);if(trailer&&typeof trailer.current_odo_km==="number")trailerOdo=String(trailer.current_odo_km);}
 setDraft(d=>({...d,opening_details:{driver_id:result.driver_id,driver_name:result.driver_name,vehicle_id:result.vehicle_id,vehicle_plate:result.vehicle_plate,trailer_number:result.trailer_number,generator_code:result.other,vehicle_odo:displayViNumber(result.odo),trailer_odo:displayViNumber(trailerOdo)}}));
 if(!result.vehicle_id)setError("Tài xế chưa có xe đang hoạt động được phân công duy nhất. Kiểm tra danh mục tài xế và ghép nối.");
 }catch(e){if(!c.signal.aborted)setError(accessMessage(e))}finally{if(!c.signal.aborted)onBusyChange(false)}
 }
 const odo=(key:"vehicle_odo"|"trailer_odo",label:string,available:boolean)=><label className="block text-xs font-semibold">{label}<input aria-label={label} className={docInput+" mt-1 font-sans tabular-nums"} inputMode="decimal" value={info[key]??""} disabled={disabled||!available} placeholder="Chưa có dữ liệu" onChange={e=>setDraft(d=>({...d,opening_details:{...emptyOpeningDetails(),...d.opening_details,[key]:e.target.value}}))}/></label>;
 const field=(label:string,value:string)=><label className="block text-xs font-semibold">{label}<input className={docInput+" mt-1"} aria-label={label} value={value} readOnly placeholder="Chưa có dữ liệu"/></label>;
 return <section className="space-y-3" aria-label="Thông tin phiếu đầu kỳ"><div className="grid gap-3 sm:grid-cols-3">{topFields}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><CatalogPicker api={api} resource="staff" staffType="driver" label="Tài xế" value={info.driver_id} selectedLabel={info.driver_name} disabled={disabled} onChange={(id,row)=>void choose(id,String(row?.name??""))}/>{field("Đầu kéo",info.vehicle_plate)}{odo("vehicle_odo","ODO Đầu kéo",!!info.vehicle_id)}{field("Rơ moóc",info.trailer_number)}{odo("trailer_odo","ODO Rơ Moóc",!!info.trailer_number)}{field("Máy phát",info.generator_code)}</div>{error&&<p role="alert" className="text-xs text-amber-700">{error}</p>}</section>;
}
