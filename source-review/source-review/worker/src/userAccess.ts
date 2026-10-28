import {hashPassword,validatePassword} from "./passwords.ts";
import { userRoles, type UserRole, type UserAccessInput, type ManagedUser } from "../../shared/userAccess.ts";
import { requireRole } from "./auth.ts";
import { ApiError, json, readJson } from "./http.ts";
import { searchPattern } from "../../shared/searchText.ts";
import type { Env, Row, User } from "./types.ts";
function fail(message:string):never {throw new ApiError(400,"VALIDATION_ERROR",message)}
async function detail(env:Env,id:string){
 const row=await env.DB.prepare("SELECT id,version,email,display_name,role,is_active,access_linked,access_linked_at,EXISTS(SELECT 1 FROM native_credentials c WHERE c.user_id=app_users.id) AS password_set FROM app_users WHERE id=?").bind(id).first<Omit<ManagedUser,"warehouses">>();
 if(!row)throw new ApiError(404,"NOT_FOUND","Không tìm thấy tài khoản.");
 const warehouses=await env.DB.prepare("SELECT w.id,w.code,w.name,w.is_active FROM document_warehouse_access a JOIN warehouses w ON w.id=a.warehouse_id WHERE a.user_id=? ORDER BY w.code,w.id").bind(id).all<ManagedUser["warehouses"][number]>();
 const units=await env.DB.prepare("SELECT o.id,o.code,o.name,o.is_active FROM document_unit_access a JOIN org_units o ON o.id=a.unit_id WHERE a.user_id=? ORDER BY o.code,o.id").bind(id).all<ManagedUser["warehouses"][number]>();
 return {...row,warehouses:warehouses.results,units:units.results};
}
function input(body:Record<string,unknown>):UserAccessInput {
 if(Object.keys(body).some(k=>!["version","email","display_name","role","is_active","warehouse_ids","unit_ids","initial_password"].includes(k)))fail("Thông tin tài khoản không được hỗ trợ.");
 if(typeof body.email!=="string"||body.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))fail("Nhập email đăng nhập hợp lệ.");
 if(typeof body.display_name!=="string"||!body.display_name.trim()||body.display_name.length>256)fail("Nhập họ tên, tối đa 256 ký tự.");
 if(typeof body.role!=="string"||!Object.hasOwn(userRoles,body.role))fail("Vai trò không hợp lệ.");
 if(body.is_active!==0&&body.is_active!==1)fail("Trạng thái không hợp lệ.");
 if(!Array.isArray(body.warehouse_ids)||body.warehouse_ids.length>50||body.warehouse_ids.some(v=>typeof v!=="string"||! /^[a-zA-Z0-9_-]{1,128}$/.test(v))||new Set(body.warehouse_ids).size!==body.warehouse_ids.length)fail("Danh sách kho không hợp lệ.");
 if(body.role!=="warehouse"&&body.warehouse_ids.length)fail("Chỉ cấp kho riêng cho vai trò Thủ kho.");
 if(body.unit_ids!==undefined&&(!Array.isArray(body.unit_ids)||body.unit_ids.length>50||body.unit_ids.some(v=>typeof v!=="string"||! /^[a-zA-Z0-9_-]{1,128}$/.test(v))||new Set(body.unit_ids).size!==body.unit_ids.length))fail("Danh sách đơn vị không hợp lệ.");
 if(body.role!=="warehouse"&&Array.isArray(body.unit_ids)&&body.unit_ids.length)fail("Chỉ cấp đơn vị riêng cho vai trò Thủ kho.");
 if(body.initial_password!==undefined)validatePassword(body.initial_password);
 return {...(typeof body.initial_password==="string"?{initial_password:body.initial_password}:{}),email:body.email.trim().toLowerCase(),display_name:body.display_name.trim(),role:body.role as UserRole,is_active:body.is_active,warehouse_ids:body.warehouse_ids as string[],...(body.unit_ids!==undefined?{unit_ids:body.unit_ids as string[]}:{}),version:body.version as number|undefined};
}
export async function handleUserAccess(request:Request,env:Env,user:User,id:string|undefined,requestId:string):Promise<Response>{
 if(request.method==="GET"&&id==="me")return json({data:await detail(env,user.id)});
 requireRole(user,["admin"]);
 const url=new URL(request.url);
 if(request.method==="GET"&&!id){
  const page=Number(url.searchParams.get("page")??1),q=url.searchParams.get("q")??"",status=url.searchParams.get("status")??"",role=url.searchParams.get("role")??"";
  if(!Number.isSafeInteger(page)||page<1||page>1000000||q.length>200||!["","active","pending","locked"].includes(status)||(role&&!Object.hasOwn(userRoles,role)))fail("Bộ lọc người dùng không hợp lệ.");
  const where:string[]=[],args:Array<string|number>=[];
  if(q){where.push("EXISTS(SELECT 1 FROM catalog_search s WHERE s.resource='users' AND s.entity_id=u.id AND s.normalized_text LIKE ? ESCAPE '\\')");args.push(searchPattern(q));}
  if(role){where.push("u.role=?");args.push(role);}
  if(status==="locked")where.push("u.is_active=0");
  if(status==="active")where.push(env.AUTH_MODE==="native"?"u.is_active=1 AND EXISTS(SELECT 1 FROM native_credentials c WHERE c.user_id=u.id)":"u.is_active=1 AND u.access_linked=1");
  if(status==="pending")where.push(env.AUTH_MODE==="native"?"u.is_active=1 AND NOT EXISTS(SELECT 1 FROM native_credentials c WHERE c.user_id=u.id)":"u.is_active=1 AND u.access_linked=0");
  const clause=where.length?" WHERE "+where.join(" AND "):"";
  const results=await env.DB.batch<Row>([env.DB.prepare("SELECT u.id,u.version,u.email,u.display_name,u.role,u.is_active,u.access_linked,u.access_linked_at,EXISTS(SELECT 1 FROM native_credentials c WHERE c.user_id=u.id) AS password_set,(SELECT json_group_array(json_object('id',w.id,'code',w.code,'name',w.name,'is_active',w.is_active)) FROM document_warehouse_access a JOIN warehouses w ON w.id=a.warehouse_id WHERE a.user_id=u.id) AS warehouses_json,(SELECT json_group_array(json_object('id',o.id,'code',o.code,'name',o.name,'is_active',o.is_active)) FROM document_unit_access ua JOIN org_units o ON o.id=ua.unit_id WHERE ua.user_id=u.id) AS units_json FROM app_users u"+clause+" ORDER BY u.display_name,u.id LIMIT 25 OFFSET ?").bind(...args,(page-1)*25),env.DB.prepare("SELECT count(*) AS total FROM app_users u"+clause).bind(...args)]);
  return json({data:results[0].results.map(row=>{const {warehouses_json,units_json,...rest}=row;return {...rest,warehouses:JSON.parse(String(warehouses_json)),units:JSON.parse(String(units_json))}}),pagination:{page,page_size:25,total:results[1].results[0].total}});
 }
 if(request.method==="GET"&&id)return json({data:await detail(env,id)});
 if((request.method!=="POST"||id)&&(request.method!=="PATCH"||!id))throw new ApiError(405,"METHOD_NOT_ALLOWED","Dùng Khóa tài khoản để giữ lịch sử người dùng.");
 const values=input(await readJson(request)),before=id?await detail(env,id):null;
 if(before&&values.initial_password!==undefined)fail("Dùng Đặt lại mật khẩu để đổi mật khẩu người dùng.");
 if(env.AUTH_MODE==='native'&&!before&&!values.initial_password)fail("Nhập mật khẩu tạm cho tài khoản mới.");
 const encoded=values.initial_password?await hashPassword(env,values.initial_password):undefined;
 const {initial_password,...auditValues}=values;
 if(before){
  if(!Number.isSafeInteger(values.version)||values.version!==before.version)throw new ApiError(409,"VERSION_CONFLICT","Tài khoản vừa thay đổi. Tải lại trước khi sửa.");
  if(before.access_linked===1&&values.email!==String(before.email).toLowerCase())throw new ApiError(409,"LINKED_EMAIL","Email đã liên kết đăng nhập không được đổi. Tạo tài khoản mới khi thay email.");
  if(id===user.id&&(values.role!=="admin"||values.is_active!==1))throw new ApiError(409,"SELF_ADMIN_CHANGE","Không thể tự khóa hoặc thu hồi quyền quản trị đang đăng nhập.");
 }
 if(values.warehouse_ids.length){
  const valid=await env.DB.prepare("SELECT id,is_active FROM warehouses WHERE id IN ("+values.warehouse_ids.map(()=>"?").join(",")+")").bind(...values.warehouse_ids).all<Row>();
  const prior=new Set(before?.warehouses.map(w=>String(w.id))??[]);
  if(valid.results.length!==values.warehouse_ids.length||valid.results.some(w=>w.is_active!==1&&!prior.has(String(w.id))))fail("Chọn kho đang hoạt động để cấp quyền.");
 }
 const unitIds=values.role==="warehouse"?(values.unit_ids??before?.units?.map(u=>u.id)??[]):[];
 if(unitIds.length){const valid=await env.DB.prepare("SELECT id,is_active FROM org_units WHERE id IN ("+unitIds.map(()=>"?").join(",")+")").bind(...unitIds).all<Row>();const prior=new Set(before?.units?.map(u=>u.id)??[]);if(valid.results.length!==unitIds.length||valid.results.some(u=>u.is_active!==1&&!prior.has(String(u.id))))fail("Chọn đơn vị đang hoạt động để cấp quyền.");}
 const rowId=id??crypto.randomUUID();
 const mutation=before?env.DB.prepare("UPDATE app_users SET email=?,display_name=?,role=?,is_active=?,version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=?").bind(values.email,values.display_name,values.role,values.is_active,values.version,rowId):env.DB.prepare("INSERT INTO app_users(id,auth_subject,email,display_name,role,is_active,access_linked) VALUES (?,?,?,?,?,?,0)").bind(rowId,"pending:"+crypto.randomUUID(),values.email,values.display_name,values.role,values.is_active);
 const statements=[mutation,env.DB.prepare("DELETE FROM document_warehouse_access WHERE user_id=?").bind(rowId)];
 statements.push(env.DB.prepare("DELETE FROM document_unit_access WHERE user_id=?").bind(rowId));
 if(unitIds.length)statements.push(env.DB.prepare("INSERT INTO document_unit_access(user_id,unit_id) VALUES "+unitIds.map(()=>"(?,?)").join(",")).bind(...unitIds.flatMap(unit=>[rowId,unit])));
 if(encoded)statements.push(env.DB.prepare("INSERT INTO native_credentials(user_id,password_hash,must_change) VALUES (?,?,1)").bind(rowId,encoded));
 if(before&&values.is_active===0)statements.push(env.DB.prepare("DELETE FROM native_sessions WHERE user_id=?").bind(rowId));
 if(values.warehouse_ids.length)statements.push(env.DB.prepare("INSERT INTO document_warehouse_access(user_id,warehouse_id) VALUES "+values.warehouse_ids.map(()=>"(?,?)").join(",")).bind(...values.warehouse_ids.flatMap(warehouse=>[rowId,warehouse])));
 statements.push(env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,request_id) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),user.id,before?"user_access.update":"user_access.create","users",rowId,before?JSON.stringify(before):null,JSON.stringify(auditValues),requestId));
 try{await env.DB.batch(statements)}catch(error){if(String(error).includes("CHECK constraint failed: version"))throw new ApiError(409,"VERSION_CONFLICT","Tài khoản vừa thay đổi. Tải lại trước khi sửa.");throw error;}
 return json({data:await detail(env,rowId)},before?200:201);
}
