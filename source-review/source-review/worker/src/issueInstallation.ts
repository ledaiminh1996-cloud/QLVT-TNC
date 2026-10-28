import type {DocumentDraft} from "../../shared/documents.ts";
import {issueInstallationOptions} from "../../shared/issueDetails.ts";
import {ApiError} from "./http.ts";
import type {Env,Row} from "./types.ts";
/** Resolve the selected header device into authoritative line/usage IDs. Never guess from the driver. */
export async function applyIssueInstallation(env:Env,draft:DocumentDraft,old:DocumentDraft|undefined,complete:boolean){
 if(draft.kind!=='issue'||!draft.issue_details?.vehicle_id)return;
 const info=draft.issue_details,choice=info.installation_target;
 if(!choice){
  if(complete&&issueInstallationOptions(info).length>1&&draft.lines.some(l=>!l.target_id))throw new ApiError(400,'ISSUE_TARGET_REQUIRED','Chọn Phương tiện lắp thiết bị; bộ xe có nhiều thiết bị, không thể tự gán cho đầu kéo.');
  if(issueInstallationOptions(info).length===1)for(const line of draft.lines)if(!line.target_id){line.target_type='vehicle';line.target_id=info.vehicle_id;line.odo=info.odo}
  return;
 }
 const option=issueInstallationOptions(info).find(o=>o.value===choice);
 if(!option)throw new ApiError(400,'ISSUE_TARGET_INVALID','Phương tiện lắp thiết bị không có trên phiếu.');
 const type=choice==='vehicle'||choice==='trailer'?'vehicle':'equipment';
 let id=info.vehicle_id;
 if(choice!=='vehicle'){
  const table=type==='vehicle'?'vehicles':'equipment',column=type==='vehicle'?'plate_number':'code';
  const target=await env.DB.prepare(`SELECT id,status FROM ${table} WHERE ${column}=? AND type=?`).bind(option.code,choice).first<Row>();
  if(!target||target.status!=='active')throw new ApiError(400,'ISSUE_TARGET_INVALID','Phương tiện lắp thiết bị không tồn tại hoặc ngừng hoạt động.');
  id=String(target.id);
  const prior=old?.issue_details,priorCode=prior?issueInstallationOptions(prior).find(o=>o.value===choice)?.code:'';
  const unchanged=prior?.vehicle_id===info.vehicle_id&&prior.installation_target===choice&&priorCode===option.code&&old?.lines.every(l=>l.target_type===type&&l.target_id===id);
  if(!unchanged){const link=await env.DB.prepare('SELECT 1 FROM equipment_pairing_drafts WHERE parent_code=? AND child_code=? AND pairing_type=? AND is_active=1').bind(info.vehicle_plate,option.code,choice).first();if(!link)throw new ApiError(400,'ISSUE_TARGET_NOT_PAIRED','Phương tiện lắp thiết bị chưa được ghép với xe trên phiếu. Chọn lại tài xế/xe hoặc kiểm tra ghép thiết bị.');}
 }
 for(const line of draft.lines){line.target_type=type;line.target_id=id;line.odo=choice==='vehicle'?info.odo:choice==='trailer'?(info.installation_odo??''):'';line.hours=info.installation_hours??'';}
}
