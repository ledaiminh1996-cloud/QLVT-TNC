import { searchPattern } from '../../shared/searchText.ts';
import type { Env, Row, User } from './types.ts';
import { ApiError, json, readJson } from './http.ts';
import { requireRole } from './auth.ts';

const selection = `v.id,v.plate_number AS parent_code,v.route_group,v.assigned_driver_id,v.status AS tractor_status,
 s.name AS driver_name,s.code AS driver_code,s.is_active AS driver_active,p.version,
 CASE WHEN p.reviewed_version=p.version THEN 1 ELSE 0 END AS reviewed,p.reviewed_at,
 (SELECT count(*) FROM equipment_pairing_drafts d WHERE d.parent_code=v.plate_number AND d.is_active=1 AND d.pairing_type='trailer') AS trailer_count,
 (SELECT count(*) FROM equipment_pairing_drafts d WHERE d.parent_code=v.plate_number AND d.is_active=1 AND d.pairing_type='generator') AS generator_count,
 CASE WHEN v.assigned_driver_id IS NOT NULL AND EXISTS(SELECT 1 FROM vehicles other WHERE other.id!=v.id AND other.assigned_driver_id=v.assigned_driver_id AND other.type='tractor') THEN 1 ELSE 0 END AS duplicate_driver,
 (SELECT count(*) FROM equipment_pairing_drafts d LEFT JOIN vehicles t ON d.pairing_type='trailer' AND t.plate_number=d.child_code LEFT JOIN equipment e ON d.pairing_type IN ('generator','container') AND e.code=d.child_code
 WHERE d.parent_code=v.plate_number AND d.is_active=1 AND COALESCE(t.status,e.status,'missing')!='active') AS bad_devices,
 COALESCE((SELECT json_group_array(json_object('id',d.id,'child_code',d.child_code,'pairing_type',d.pairing_type,'version',d.version,'asset_id',COALESCE(t.id,e.id),'status',COALESCE(t.status,e.status,'missing'))) FROM equipment_pairing_drafts d LEFT JOIN vehicles t ON d.pairing_type='trailer' AND t.plate_number=d.child_code LEFT JOIN equipment e ON d.pairing_type IN ('generator','container') AND e.code=d.child_code WHERE d.parent_code=v.plate_number AND d.is_active=1),'[]') AS links_json`;
const from = `FROM vehicles v JOIN pairing_set_versions p ON p.parent_id=v.id LEFT JOIN staff s ON s.id=v.assigned_driver_id`;
const missingTrailer="COALESCE(route_group,'')!='DCANG' AND trailer_count=0";
const missingGenerator="COALESCE(route_group,'')!='DCANG' AND generator_count=0";
const complete = `(COALESCE(route_group,'')='DCANG' OR (trailer_count>0 AND generator_count>0)) AND assigned_driver_id IS NOT NULL AND driver_active=1 AND duplicate_driver=0 AND bad_devices=0 AND tractor_status='active'`;
const sorts:Record<string,string>={parent_code:'parent_code',driver_name:'driver_name COLLATE NOCASE',driver_code:'driver_code',trailer:'(SELECT min(child_code) FROM equipment_pairing_drafts WHERE parent_code=b.parent_code AND is_active=1 AND pairing_type=\'trailer\')',generator:'(SELECT min(child_code) FROM equipment_pairing_drafts WHERE parent_code=b.parent_code AND is_active=1 AND pairing_type=\'generator\')',route_group:'route_group',reviewed:'reviewed'};
const filters:Record<string,string>={all:'1',complete,missing_trailer:missingTrailer,missing_generator:missingGenerator,missing_driver:'assigned_driver_id IS NULL',unreviewed:'reviewed=0'};
async function getSet(env:Env,id:string) {return env.DB.prepare(`SELECT ${selection} ${from} WHERE v.id=? AND v.type='tractor'`).bind(id).first<Row>();}
function paging(url:URL){const page=Number(url.searchParams.get('page')??1),size=Number(url.searchParams.get('page_size')??25);if(!Number.isInteger(page)||page<1||!Number.isInteger(size)||size<1||size>100)throw new ApiError(400,'VALIDATION_ERROR','Trang không hợp lệ.');return {page,size};}
function text(value:unknown,max=1000):string{if(typeof value!=='string'||!value.trim()||value.length>max)throw new ApiError(400,'VALIDATION_ERROR','Thông tin không hợp lệ.');return value.trim();}
function decodeLinks(row:Row):Row[]{return JSON.parse(String(row.links_json??'[]')) as Row[];}
async function batch(env:Env,statements:D1PreparedStatement[]) {
 try {return await env.DB.batch(statements);}catch(error){const message=String(error);if(message.includes('version>=1'))throw new ApiError(409,'VERSION_CONFLICT','Bộ ghép vừa thay đổi. Tải lại để kiểm tra.');if(message.includes('DRIVER_PAIRING_IN_USE')||message.includes('UNIQUE constraint failed'))throw new ApiError(409,'PAIRING_IN_USE','Thiết bị hoặc tài xế đã được ghép ở xe khác. Tải lại danh sách thiết bị rảnh.');throw error;}
}
async function readAvailable(url:URL,env:Env) {
 const {page,size}=paging(url),kind=url.searchParams.get('kind'),query=url.searchParams.get('q')?.trim()??'';if(query.length>200)throw new ApiError(400,'VALIDATION_ERROR','Tìm kiếm quá dài.');
 const q=searchPattern(query);let table:string,resource:string,columns:string,where:string;
 if(kind==='trailer'||kind==='tractor') {
  table='vehicles';resource='vehicles';columns="a.*,a.plate_number AS label";where=`a.type='${kind}' AND a.status='active'`;
  if(kind==='trailer')where+=` AND NOT EXISTS(SELECT 1 FROM equipment_pairing_drafts d WHERE d.child_code=a.plate_number AND d.is_active=1)`;
  else where+=` AND (a.assigned_driver_id IS NULL OR NOT EXISTS(SELECT 1 FROM equipment_pairing_drafts d WHERE d.parent_code=a.plate_number AND d.is_active=1 AND d.pairing_type='trailer') OR NOT EXISTS(SELECT 1 FROM equipment_pairing_drafts d WHERE d.parent_code=a.plate_number AND d.is_active=1 AND d.pairing_type='generator'))`;
 }else if(kind==='generator') {table='equipment';resource='equipment';columns='a.*,a.code AS label';where="a.type='generator' AND a.status='active' AND NOT EXISTS(SELECT 1 FROM equipment_pairing_drafts d WHERE d.child_code=a.code AND d.is_active=1)";}
 else if(kind==='driver'){table='staff';resource='staff';columns="a.*,a.code || ' — ' || a.name AS label";where="a.staff_type='driver' AND a.is_active=1 AND NOT EXISTS(SELECT 1 FROM vehicles v WHERE v.assigned_driver_id=a.id AND v.type='tractor')";}
 else throw new ApiError(400,'VALIDATION_ERROR','Loại thiết bị không hợp lệ.');
 where+=` AND EXISTS(SELECT 1 FROM catalog_search cs WHERE cs.resource='${resource}' AND cs.entity_id=a.id AND cs.normalized_text LIKE ? ESCAPE '\\')`;
 const result=await env.DB.batch([env.DB.prepare(`SELECT ${columns} FROM ${table} a WHERE ${where} ORDER BY label LIMIT ? OFFSET ?`).bind(q,size,(page-1)*size),env.DB.prepare(`SELECT count(*) AS total FROM ${table} a WHERE ${where}`).bind(q)]);
 return json({data:result[0].results,pagination:{page,page_size:size,total:(result[1].results[0] as {total:number}).total}});
}
export async function handlePairingSets(request:Request,env:Env,user:User,id:string|undefined,requestId:string):Promise<Response> {
 const url=new URL(request.url);
 if(request.method==='GET') {
  const view=url.searchParams.get('view');
  if(view==='available')return readAvailable(url,env);
  if(view==='set'){const row=await getSet(env,text(url.searchParams.get('parent_id'),128));if(!row)throw new ApiError(404,'NOT_FOUND','Không tìm thấy đầu kéo.');return json({data:[row],pagination:{page:1,page_size:1,total:1}});}
  if(view==='history') {
   const parent=text(url.searchParams.get('parent_id'),128),{page,size}=paging(url);
   if(!await getSet(env,parent))throw new ApiError(404,'NOT_FOUND','Không tìm thấy đầu kéo.');
   const results=await env.DB.batch([env.DB.prepare(`SELECT id,1 AS version,action,effective_at,reason,before_json,after_json,created_at,(SELECT display_name FROM app_users WHERE id=e.actor_id) AS actor_name FROM pairing_change_events e WHERE parent_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(parent,size,(page-1)*size),env.DB.prepare('SELECT count(*) AS total FROM pairing_change_events WHERE parent_id=?').bind(parent)]);
   return json({data:results[0].results,pagination:{page,page_size:size,total:(results[1].results[0] as {total:number}).total}});
  }
  if(view==='detail') {
   const kind=url.searchParams.get('kind'),asset=text(url.searchParams.get('entity_id'),128);
   const table=kind==='trailer'?'vehicles':kind==='generator'?'equipment':null;if(!table)throw new ApiError(400,'VALIDATION_ERROR','Loại thiết bị không hợp lệ.');
   const row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND type=?`).bind(asset,kind).first<Row>();if(!row)throw new ApiError(404,'NOT_FOUND','Không tìm thấy thiết bị.');
   return json({data:[row],pagination:{page:1,page_size:1,total:1}});
  }
  if(id){const row=await getSet(env,id);if(!row)throw new ApiError(404,'NOT_FOUND','Không tìm thấy đầu kéo.');return json({data:row});}
  const {page,size}=paging(url),query=url.searchParams.get('q')?.trim()??'',route=url.searchParams.get('route_group')??'',filter=url.searchParams.get('filter')??'all',sort=url.searchParams.get('sort')??'parent_code',direction=url.searchParams.get('direction')??'asc';
  if(query.length>200||!filters[filter]||!sorts[sort]||!['asc','desc'].includes(direction)||!['','BNAM','DCANG'].includes(route))throw new ApiError(400,'VALIDATION_ERROR','Bộ lọc không hợp lệ.');
  const q=searchPattern(query),where=`v.type='tractor' AND (?='' OR v.route_group=?) AND (EXISTS(SELECT 1 FROM catalog_search cs WHERE cs.resource='vehicles' AND cs.entity_id=v.id AND cs.field_key='plate_number' AND cs.normalized_text LIKE ? ESCAPE '\\') OR EXISTS(SELECT 1 FROM equipment_pairing_drafts d JOIN catalog_search cs ON cs.resource='equipment-pairings' AND cs.entity_id=d.id AND cs.field_key='child_code' WHERE d.parent_code=v.plate_number AND d.is_active=1 AND cs.normalized_text LIKE ? ESCAPE '\\') OR EXISTS(SELECT 1 FROM catalog_search cs WHERE cs.resource='staff' AND cs.entity_id=v.assigned_driver_id AND cs.field_key IN ('name','code') AND cs.normalized_text LIKE ? ESCAPE '\\'))`;
  const cte=`WITH b AS (SELECT ${selection} ${from} WHERE ${where}) `,args=[route,route,q,q,q];
  const results=await env.DB.batch([
   env.DB.prepare(`${cte} SELECT * FROM b WHERE ${filters[filter]} ORDER BY ${sorts[sort]} ${direction},id LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size),
   env.DB.prepare(`${cte} SELECT count(*) AS total FROM b WHERE ${filters[filter]}`).bind(...args),
   env.DB.prepare(`${cte} SELECT count(*) AS total,COALESCE(sum(CASE WHEN ${complete} THEN 1 ELSE 0 END),0) AS complete,COALESCE(sum(${missingTrailer}),0) AS missing_trailer,COALESCE(sum(${missingGenerator}),0) AS missing_generator,COALESCE(sum(assigned_driver_id IS NULL),0) AS missing_driver,COALESCE(sum(reviewed),0) AS reviewed,COALESCE(sum(CASE WHEN ${filters[filter]} AND ${complete} THEN 1 ELSE 0 END),0) AS filtered_complete FROM b`).bind(...args)
  ]);
  return json({data:results[0].results,pagination:{page,page_size:size,total:(results[1].results[0] as {total:number}).total},stats:results[2].results[0]});
 }
 if(request.method!=='PATCH'||!id)throw new ApiError(405,'METHOD_NOT_ALLOWED','Dùng PATCH để cập nhật bộ ghép.');
 requireRole(user,['admin','accountant']);const body=await readJson(request);
 if(id==='review') {
  if(Object.keys(body).some(k=>!['version','reviews_json'].includes(k)))throw new ApiError(400,'UNKNOWN_FIELD','Trường rà soát không hợp lệ.');
  let items:unknown;try{items=JSON.parse(String(body.reviews_json));}catch{throw new ApiError(400,'VALIDATION_ERROR','Danh sách rà soát không hợp lệ.');}
  if(!Array.isArray(items)||items.length<1||items.length>100)throw new ApiError(400,'VALIDATION_ERROR','Chọn từ 1 đến 100 dòng.');
  const statements:D1PreparedStatement[]=[],seen=new Set<string>();
  for(const item of items){if(!item||typeof item!=='object'||typeof item.id!=='string'||!Number.isSafeInteger(item.version)||item.version<1||seen.has(item.id))throw new ApiError(400,'VALIDATION_ERROR','Dòng rà soát không hợp lệ.');seen.add(item.id);
   statements.push(env.DB.prepare("UPDATE pairing_set_versions SET version=CASE WHEN version=? THEN version ELSE -1 END,reviewed_version=?,reviewed_by=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE parent_id=?").bind(item.version,item.version,user.id,item.id));
   if(!await getSet(env,item.id))throw new ApiError(404,'NOT_FOUND','Không tìm thấy bộ ghép để rà soát.');
   statements.push(env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_json,reason,request_id) VALUES(?,?,'pairing.review','pairing_sets',?,?,'Xác nhận đã rà soát',?)").bind(crypto.randomUUID(),user.id,item.id,JSON.stringify({reviewed_version:item.version}),requestId));
  }
  await batch(env,statements);return json({data:{id:'review',version:1}});
 }
 if(Object.keys(body).some(k=>!['version','action','value','effective_at','reason','trailer_code','generator_1','driver_id'].includes(k)))throw new ApiError(400,'UNKNOWN_FIELD','Trường ghép không hợp lệ; nhóm tuyến chỉ sửa tại danh mục đầu kéo.');
 if(!Number.isSafeInteger(body.version)||Number(body.version)<1)throw new ApiError(400,'VALIDATION_ERROR','Thiếu phiên bản bộ ghép.');
 const before=await getSet(env,id);if(!before)throw new ApiError(404,'NOT_FOUND','Không tìm thấy đầu kéo.');if(before.version!==body.version)throw new ApiError(409,'VERSION_CONFLICT','Bộ ghép đã thay đổi. Tải lại để kiểm tra.');
 const action=text(body.action,40),reason=text(body.reason),rawTime=text(body.effective_at,40),time=Date.parse(rawTime);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(rawTime)||!Number.isFinite(time)||time>Date.now()+60_000)throw new ApiError(400,'VALIDATION_ERROR','Từ ngày giờ phải có múi giờ và không ở tương lai.');
 const effective=new Date(time).toISOString(),last=await env.DB.prepare('SELECT max(effective_at) AS latest FROM pairing_change_events WHERE parent_id=?').bind(id).first<Row>();
 if(last?.latest&&effective<String(last.latest))throw new ApiError(400,'VALIDATION_ERROR','Ngày giờ phải từ lần thay đổi gần nhất trở đi.');
 const old=decodeLinks(before),desired=old.map(row=>({code:String(row.child_code),type:String(row.pairing_type)}));let driver=before.assigned_driver_id;
 const value=body.value==null?'':typeof body.value==='string'?body.value.trim():text(body.value);
 function replace(type:string,codes:string[]){for(let i=desired.length-1;i>=0;i--)if(desired[i].type===type)desired.splice(i,1);for(const code of codes)if(code)desired.push({code:code.toUpperCase(),type});}
 if(action==='replace_trailer'||action==='replace_generator'){if(!value)throw new ApiError(400,'VALIDATION_ERROR','Chọn thiết bị mới.');replace(action==='replace_trailer'?'trailer':'generator',[text(value,80)]);}
 else if(action==='replace_driver'){driver=text(value,128);}
 else if(action==='detach'){if(!['trailer','generator','driver','all'].includes(value))throw new ApiError(400,'VALIDATION_ERROR','Chọn phần cần tách.');if(value==='all'){desired.length=0;driver=null;}else if(value==='driver')driver=null;else replace(value,[]);}
 else if(action==='assemble') {for(const [key,type] of [['trailer_code','trailer'],['generator_1','generator']] as const){if(body[key]){if(old.some(row=>row.pairing_type===type))throw new ApiError(400,'PAIRING_EXISTS','Đã có thiết bị; dùng thao tác Đổi để thay thế.');replace(type,[text(body[key],80)]);}}if(body.driver_id){if(driver)throw new ApiError(400,'PAIRING_EXISTS','Đã có tài xế; dùng Đổi tài xế.');driver=text(body.driver_id,128);}}
 else throw new ApiError(400,'VALIDATION_ERROR','Thao tác không hợp lệ.');
 if(new Set(desired.map(r=>r.code)).size!==desired.length)throw new ApiError(400,'VALIDATION_ERROR','Không ghép trùng thiết bị.');
 const unchanged=driver===before.assigned_driver_id&&desired.length===old.length&&desired.every(item=>old.some(row=>row.child_code===item.code&&row.pairing_type===item.type));if(unchanged)throw new ApiError(400,'NO_CHANGE','Chưa có thay đổi để lưu.');
 const added=desired.filter(item=>!old.some(row=>row.child_code===item.code&&row.pairing_type===item.type));
 if(before.tractor_status!=='active'&&(added.length||driver!==null&&driver!==before.assigned_driver_id))throw new ApiError(409,'INVALID_REFERENCE','Đầu kéo phải đang hoạt động để ghép mới.');
 const assetIds=new Map<string,string>();
 for(const row of old)if(row.asset_id)assetIds.set(`${row.pairing_type}:${row.child_code}`,String(row.asset_id));
 for(const item of added){const table=item.type==='trailer'?'vehicles':'equipment',column=item.type==='trailer'?'plate_number':'code';const row=await env.DB.prepare(`SELECT id FROM ${table} WHERE ${column}=? AND type=? AND status='active'`).bind(item.code,item.type).first<{id:string}>();if(row)assetIds.set(`${item.type}:${item.code}`,row.id);if(!row)throw new ApiError(409,'INVALID_REFERENCE','Thiết bị phải đang hoạt động.');}
 if(driver!==null&&driver!==before.assigned_driver_id){if(!await env.DB.prepare("SELECT id FROM staff WHERE id=? AND staff_type='driver' AND is_active=1").bind(driver).first())throw new ApiError(409,'INVALID_REFERENCE','Chọn tài xế đang hoạt động.');}
 const statements:D1PreparedStatement[]=[env.DB.prepare('UPDATE pairing_set_versions SET version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE parent_id=?').bind(body.version,id)];
 for(const row of old)if(!desired.some(item=>item.code===row.child_code&&item.type===row.pairing_type))statements.push(env.DB.prepare('UPDATE equipment_pairing_drafts SET is_active=0,version=version+1 WHERE id=?').bind(row.id));
 for(const item of added)statements.push(env.DB.prepare('INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type,effective_from,updated_by_name,notes) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),before.parent_code,item.code,item.type,effective,user.display_name,reason));
 if(driver!==before.assigned_driver_id)statements.push(env.DB.prepare('UPDATE vehicles SET assigned_driver_id=?,version=version+1 WHERE id=?').bind(driver,id));
 if(driver!==before.assigned_driver_id || action==='replace_trailer' || action==='detach' || action==='assemble') {
  for(const staffId of new Set([before.assigned_driver_id,driver].filter((value):value is string=>typeof value==='string'&&!!value))) {
   // Compatibility fields in the personnel directory are derived from the authoritative links.
   const plates="(SELECT group_concat(plate_number, ', ') FROM (SELECT plate_number FROM vehicles WHERE assigned_driver_id=staff.id AND type='tractor' ORDER BY plate_number))";
   const trailers="(SELECT group_concat(child_code, ', ') FROM (SELECT DISTINCT d.child_code FROM vehicles v JOIN equipment_pairing_drafts d ON d.parent_code=v.plate_number WHERE v.assigned_driver_id=staff.id AND v.type='tractor' AND d.pairing_type='trailer' AND d.is_active=1 ORDER BY d.child_code))";
   statements.push(env.DB.prepare(`INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,reason,request_id)
    SELECT ?,?,'pairing.staff_sync','staff',id,json_object('vehicle_plate',vehicle_plate,'trailer_plate',trailer_plate),json_object('vehicle_plate',${plates},'trailer_plate',${trailers}),?,? FROM staff WHERE id=? AND (vehicle_plate IS NOT ${plates} OR trailer_plate IS NOT ${trailers})`).bind(crypto.randomUUID(),user.id,reason,requestId,staffId));
   statements.push(env.DB.prepare(`UPDATE staff SET vehicle_plate=${plates},trailer_plate=${trailers},version=version+1 WHERE id=? AND (vehicle_plate IS NOT ${plates} OR trailer_plate IS NOT ${trailers})`).bind(staffId));
  }
 }
 const driverInfo=driver?await env.DB.prepare('SELECT name,code FROM staff WHERE id=?').bind(driver).first<Row>():null;
 const after=JSON.stringify({driver_id:driver,driver_name:driverInfo?.name??null,driver_code:driverInfo?.code??null,links:desired});
 for(const [key,assetId] of assetIds){
  const [type,...parts]=key.split(':'),code=parts.join(':');
  const was=old.some(row=>row.pairing_type===type&&row.child_code===code),now=desired.some(item=>item.type===type&&item.code===code);
  if(was===now&&driver===before.assigned_driver_id)continue;
  const previous=JSON.stringify({parent_code:was?before.parent_code:null,driver_name:was?before.driver_name:null,driver_code:was?before.driver_code:null});
  const next=JSON.stringify({parent_code:now?before.parent_code:null,driver_name:now?driverInfo?.name??null:null,driver_code:now?driverInfo?.code??null:null});
  statements.push(env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,reason,request_id) VALUES(?,?,'pairing.relationship_changed',?,?,?,?,?,?)").bind(crypto.randomUUID(),user.id,type==='trailer'?'vehicles':'equipment',assetId,previous,next,reason,requestId));
 }

 statements.push(env.DB.prepare('INSERT INTO pairing_change_events(id,parent_id,action,effective_at,reason,actor_id,before_json,after_json,request_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,action,effective,reason,user.id,JSON.stringify({driver_id:before.assigned_driver_id,driver_name:before.driver_name,driver_code:before.driver_code,links:old}),after,requestId));
 statements.push(env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,reason,request_id) VALUES(?,?,'pairing.change','pairing_sets',?,?,?,?,?)").bind(crypto.randomUUID(),user.id,id,JSON.stringify(before),after,reason,requestId));
 await batch(env,statements);return json({data:await getSet(env,id)});
}
