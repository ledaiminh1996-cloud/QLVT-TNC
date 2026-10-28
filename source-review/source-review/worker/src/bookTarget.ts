import type {Row} from "./types.ts";
type ObjectValue=Record<string,unknown>;
function object(value:unknown):ObjectValue{return value&&typeof value==="object"&&!Array.isArray(value)?value as ObjectValue:{}}
function parse(value:unknown):ObjectValue{if(typeof value!=="string")return {};try{return object(JSON.parse(value))}catch{return {}}}
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const code=(v:unknown)=>text(v).split(/\s+[—–](?:\s+|$)/)[0].trim();
const decimal=(v:unknown)=>{const s=text(v);return /^\d{1,12}(?:\.\d{1,3})?$/.test(s)?s:""};
const kinds:Record<string,string>={tractor:"Đầu kéo",trailer:"Rơ moóc",generator:"Máy phát",container:"Container",office_car:"Xe con",box_truck:"Xe tải thùng",rented_truck:"Xe thuê"};
/** Historical report data comes only from document/usage snapshots, never current fleet pairings. */
export function bookTarget(row:Row):{target_label:string;target_kind:string;odo:string;hours:string}{
 const header=parse(row.header_json),labels=parse(row.labels_json),line=parse(row.line_json),sourceHeader=parse(row.source_header_json),sourceLabels=parse(row.source_labels_json);
 const issue=object(header.issue_details),recovery=object(header.recovery_details),sourceIssue=object(sourceHeader.issue_details),sourceOpening=object(sourceHeader.opening_details);
 const recovered=row.kind==="recovery",targetType=recovered?text(row.source_target_type):text(line.target_type),targetId=recovered?text(row.source_target_id):text(line.target_id);
 const key=(targetType==="equipment"?"equipment:":"vehicles:")+targetId;
 let label=targetId?code(labels[key])||code(sourceLabels[key]):"";
 if(recovered)label=code(labels["recovery_source:"+text(line.id)])||label;
 if(!label&&targetType!=="equipment")label=code(row.vehicle_plate_snapshot);
 if(!label&&!targetId)label=code(recovered?recovery.vehicle_plate:issue.vehicle_plate);
 const type=text(recovered?labels["recovery_target_kind:"+text(line.id)]:labels["type:"+key])||text(sourceLabels["type:"+key]);
 let kind=kinds[type]??"";
 for(const saved of [issue,recovery,sourceIssue,sourceOpening]){
  if(!label)continue;
  if(label===text(saved.trailer_number)){kind=kind||"Rơ moóc";break}
  if(label===text(saved.generator_code)||label===text(saved.other)){kind=kind||"Máy phát";break}
  if(label===text(saved.container_number)){kind=kind||"Container";break}
  if(label===text(saved.vehicle_plate)){kind=kind||(text(saved.vehicle_group)==="box_truck"?"Xe tải thùng":text(saved.vehicle_group)==="office_car"?"Xe con":["BNAM","DCANG"].includes(text(saved.vehicle_group))?"Đầu kéo":"Phương tiện");break}
 }
 if(label&&!kind)kind=targetType==="equipment"?"Thiết bị":targetType==="vehicle"?"Phương tiện":"";
 let odo=decimal(line.odo),hours=decimal(line.hours);
 const headerReading=recovered?recovery:issue;
 // A tractor's ODO is not the trailer/generator reading merely because they share a form.
 if(!odo&&label&&label===text(headerReading.vehicle_plate))odo=decimal(headerReading.odo);
 if(!hours&&recovered&&label&&label===text(recovery.removed_from))hours=decimal(recovery.hours);
 if(!odo&&row.vehicle_odo_km!==null&&row.vehicle_odo_km!==undefined&&Number.isSafeInteger(row.vehicle_odo_km))odo=String(row.vehicle_odo_km);
 return {target_label:label,target_kind:kind,odo,hours};
}
