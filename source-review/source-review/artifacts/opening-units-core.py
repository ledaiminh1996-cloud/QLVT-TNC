from pathlib import Path
Path('migrations/0034_opening_management_units.sql').write_text('''-- Management scopes for materials mounted at opening; no warehouse movements.
ALTER TABLE vehicles ADD COLUMN managing_unit_id TEXT REFERENCES org_units(id);
ALTER TABLE equipment ADD COLUMN managing_unit_id TEXT REFERENCES org_units(id);
ALTER TABLE opening_usage_lines ADD COLUMN managing_unit_id TEXT REFERENCES org_units(id);
CREATE TABLE document_unit_access(user_id TEXT NOT NULL REFERENCES app_users(id),unit_id TEXT NOT NULL REFERENCES org_units(id),PRIMARY KEY(user_id,unit_id));
CREATE INDEX idx_opening_usage_unit ON opening_usage_lines(managing_unit_id);
''',encoding='utf-8')
Path('worker/src/openingManagement.ts').write_text('''import type {Env,Row,User} from "./types.ts";
import type {DocumentDraft} from "../../shared/documents.ts";
import {ApiError} from "./http.ts";
import {normalizeSearch} from "../../shared/searchText.ts";
export interface ManagementUnit {unit_id:string|null;unit_label:string;source:string}
export async function managementUnit(env:Env,type:string,id:string):Promise<ManagementUnit>{
 const table=type==="vehicle"?"vehicles":"equipment";
 const target=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<Row>();
 if(!target)return {unit_id:null,unit_label:"Chưa xác định",source:"missing_target"};
 const direct=target.managing_unit_id?await env.DB.prepare("SELECT id,code,name FROM org_units WHERE id=? AND is_active=1").bind(target.managing_unit_id).first<Row>():null;
 if(direct)return {unit_id:String(direct.id),unit_label:direct.code+" — "+direct.name,source:"target"};
 const driver=type==="vehicle"&&target.assigned_driver_id?await env.DB.prepare("SELECT o.id,o.code,o.name FROM staff s JOIN org_units o ON o.id=s.unit_id AND o.is_active=1 WHERE s.id=? AND s.is_active=1").bind(target.assigned_driver_id).first<Row>():null;
 if(driver)return {unit_id:String(driver.id),unit_label:driver.code+" — "+driver.name,source:"driver"};
 const location=normalizeSearch(target.location_unit??"").trim();
 if(location){const units=await env.DB.prepare("SELECT id,code,name FROM org_units WHERE is_active=1").all<Row>();const matches=units.results.filter(u=>[u.id,u.code,u.name,u.code+" — "+u.name].some(v=>normalizeSearch(v)===location));if(matches.length===1)return {unit_id:String(matches[0].id),unit_label:matches[0].code+" — "+matches[0].name,source:"location"};}
 const code=String(type==="vehicle"?target.plate_number:target.code);
 const parents=await env.DB.prepare("SELECT v.id,v.managing_unit_id,s.unit_id FROM equipment_pairing_drafts p JOIN vehicles v ON v.plate_number=p.parent_code LEFT JOIN staff s ON s.id=v.assigned_driver_id AND s.is_active=1 WHERE p.child_code=? AND p.is_active=1 AND v.status='active' AND p.pairing_type=?").bind(code,type==="vehicle"?"trailer":String(target.type)).all<Row>();
 const ids=[...new Set(parents.results.map(p=>p.managing_unit_id??p.unit_id).filter(Boolean))];
 if(parents.results.length===1&&ids.length===1){const unit=await env.DB.prepare("SELECT id,code,name FROM org_units WHERE id=? AND is_active=1").bind(ids[0]).first<Row>();if(unit)return {unit_id:String(unit.id),unit_label:unit.code+" — "+unit.name,source:"paired_tractor"};}
 return {unit_id:null,unit_label:"Chưa xác định",source:"unassigned"};
}
export async function openingUnits(env:Env,draft:DocumentDraft){const entries=await Promise.all([...new Map(draft.lines.filter(l=>l.target_id).map(l=>[l.target_type+":"+l.target_id,l])).values()].map(async line=>[line.target_type+":"+line.target_id,await managementUnit(env,line.target_type,line.target_id)]as const));return new Map(entries);}
export async function checkOpeningUnits(env:Env,user:User,draft:DocumentDraft){if(draft.kind!=="opening"||draft.opening_mode!=="in_use"||user.role!=="warehouse")return;for(const unit of (await openingUnits(env,draft)).values()){if(!unit.unit_id||!await env.DB.prepare("SELECT 1 FROM document_unit_access WHERE user_id=? AND unit_id=?").bind(user.id,unit.unit_id).first())throw new ApiError(403,"UNIT_SCOPE","Xe/thiết bị chưa có đơn vị quản lý hoặc tài khoản chưa được cấp quyền đơn vị đó.");}}
/** Snapshot unit scope for new opening sources; legacy sources retain their warehouse scope. */
export const sourceAccessSql=(line="l",opening="ou")=>`((${opening}.managing_unit_id IS NOT NULL AND EXISTS(SELECT 1 FROM document_unit_access ua WHERE ua.user_id=? AND ua.unit_id=${opening}.managing_unit_id)) OR (${opening}.managing_unit_id IS NULL AND EXISTS(SELECT 1 FROM document_warehouse_access wa WHERE wa.user_id=? AND wa.warehouse_id=${line}.from_warehouse_id)))`;
export async function checkSourceAccess(env:Env,user:User,rootId:string){if(user.role!=="warehouse")return;const allowed=await env.DB.prepare("SELECT 1 FROM inventory_document_lines l LEFT JOIN opening_usage_lines ou ON ou.inventory_line_id=l.id WHERE l.id=? AND "+sourceAccessSql()).bind(rootId,user.id,user.id).first();if(!allowed)throw new ApiError(403,"SOURCE_SCOPE","Nguồn vật tư chưa được cấp quyền theo đơn vị quản lý hoặc kho xuất.");}
''',encoding='utf-8')
p=Path('shared/documents.ts');s=p.read_text(encoding='utf-8').replace('!["equipment_transfer", "rotation", "proposal"].includes(kind) &&\n    !d.warehouse_id','!["equipment_transfer", "rotation", "proposal"].includes(kind) &&\n    !(kind === "opening" && d.opening_mode === "in_use") &&\n    !d.warehouse_id');p.write_text(s,encoding='utf-8')
p=Path('worker/src/catalogs.ts');s=p.read_text(encoding='utf-8').replace('fields:{ ...equipmentMetadata,','fields:{ ...equipmentMetadata, managing_unit_id:idRef,').replace('...equipmentMetadata, plate_number:','...equipmentMetadata, managing_unit_id:idRef, plate_number:');needle="  if (resource === 'vehicles' && values.assigned_driver_id)";s=s.replace(needle,'''  if (["vehicles","equipment"].includes(resource) && values.managing_unit_id) {
    const unit=await env.DB.prepare("SELECT id FROM org_units WHERE id=? AND is_active=1").bind(values.managing_unit_id).first();
    if(!unit)throw new ApiError(409,"INVALID_REFERENCE","Đơn vị quản lý không tồn tại hoặc ngừng hoạt động.");
  }
'''+needle);p.write_text(s,encoding='utf-8')
p=Path('src/api/catalogFields.ts');s=p.read_text(encoding='utf-8').replace('const equipmentMetadata: Field[] = [','const equipmentMetadata: Field[] = [\n  {key:"managing_unit_id",label:"Đơn vị quản lý",lookup:"org-units",nullable:true},');p.write_text(s,encoding='utf-8')
p=Path('worker/src/documents.ts');s=p.read_text(encoding='utf-8');s='import {managementUnit,openingUnits,checkOpeningUnits,sourceAccessSql,checkSourceAccess} from "./openingManagement.ts";\n'+s;s=s.replace('  if (own(user)) {\n    for (const id of new Set(', '  await checkOpeningUnits(env,user,draft);\n  if (own(user) && !(draft.kind === "opening" && draft.opening_mode === "in_use")) {\n    for (const id of new Set(',1);needle='  return labels;\n}\nasync function checkLock';s=s.replace(needle,'''  if(draft.kind==="opening"&&draft.opening_mode==="in_use")for(const [key,unit] of await openingUnits(env,draft)){
    labels["managing_unit:"+key]=unit.unit_id??"";labels["managing_unit_label:"+key]=unit.unit_label;
  }
  return labels;
}
async function checkLock''');needle='  if(request.method==="POST"&&id==="recovery-price")';s=s.replace(needle,'''  if(request.method==="GET"&&id==="opening-unit"){
    const type=url.searchParams.get("target_type")??"",target=url.searchParams.get("target_id")??"";
    if(!["vehicle","equipment"].includes(type)||!/^[a-zA-Z0-9_-]{1,128}$/.test(target))return fail("Đối tượng quản lý không hợp lệ.");
    return json({data:await managementUnit(env,type,target)});
  }
'''+needle);s=s.replace('if(own(user)&&!await env.DB.prepare("SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?").bind(user.id,usage.from_warehouse_id).first())throw new ApiError(403,"WAREHOUSE_SCOPE","Nguồn xuất chưa được cấp quyền.");','await checkSourceAccess(env,user,String(usage.root_line_id));');s=s.replace('SELECT u.id,l.from_warehouse_id FROM stock_usages','SELECT u.id,u.root_line_id,l.from_warehouse_id FROM stock_usages');s=s.replace('if(own(user)){where+=" AND EXISTS(SELECT 1 FROM document_warehouse_access a WHERE a.user_id=? AND a.warehouse_id=l.from_warehouse_id)";args.push(user.id);}','if(own(user)){where+=" AND "+sourceAccessSql();args.push(user.id,user.id);}');p.write_text(s,encoding='utf-8')
p=Path('worker/src/inventoryPosting.ts');s=p.read_text(encoding='utf-8');s='import {checkSourceAccess} from "./openingManagement.ts";\n'+s;s=s.replace('plan.coreLine(line,lineId,value,draft.warehouse_id,null);','plan.coreLine(line,lineId,value,null,null);');s=s.replace('declared_at,installed_at,original_unit_price_known) VALUES (?,?,?,?,?,?,?,?,?)",lineId,line.part_id,line.target_type,line.target_id,line.to_position,Number(part.is_serialized),draft.business_at,line.installed_at||null,known?1:0);','declared_at,installed_at,original_unit_price_known,managing_unit_id) VALUES (?,?,?,?,?,?,?,?,?,?)",lineId,line.part_id,line.target_type,line.target_id,line.to_position,Number(part.is_serialized),draft.business_at,line.installed_at||null,known?1:0,labels["managing_unit:"+line.target_type+":"+line.target_id]||null);');a=s.index('        "SELECT 1 FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id JOIN document_warehouse_access');print(s[a-130:a+420]);p.write_text(s,encoding='utf-8')
