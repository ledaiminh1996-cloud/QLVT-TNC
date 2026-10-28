import type {Env,Row} from './types.ts';
import {ApiError,json} from './http.ts';

/** Called only after the catalog's normal authorization checks. SQL identifiers are from its static specification. */
export async function catalogHistory(url:URL,env:Env,resource:string,table:string) {
 const id=url.searchParams.get('entity_id')??'',page=Number(url.searchParams.get('page')??1),size=Number(url.searchParams.get('page_size')??25);
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id)||!Number.isInteger(page)||page<1||!Number.isInteger(size)||size<1||size>100)throw new ApiError(400,'VALIDATION_ERROR','Bản ghi hoặc trang lịch sử không hợp lệ.');
 const aliases=[resource,resource.replaceAll('-','_')];if(resource==='vehicles')aliases.push('pairing_sets');
 const where=`a.entity_id=? AND a.entity_type IN (${aliases.map(()=>'?').join(',')})`,args=[id,...aliases];
 const results=await env.DB.batch([
  env.DB.prepare(`SELECT a.id,1 AS version,a.action,a.created_at,a.reason,a.before_json,a.after_json,u.display_name AS actor_name FROM audit_events a LEFT JOIN app_users u ON u.id=a.actor_id WHERE ${where} ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size),
  env.DB.prepare(`SELECT count(*) AS total FROM audit_events a WHERE ${where}`).bind(...args)
 ]);
 const total=Number((results[1].results[0] as {total:number}).total);
 if(!total&&!await env.DB.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first())throw new ApiError(404,'NOT_FOUND','Không tìm thấy bản ghi hoặc lịch sử.');
 const mappings:Record<string,string>={warehouse_id:'warehouses',unit_id:'org_units',department_id:'departments',assigned_driver_id:'staff',driver_id:'staff'};
 const refs=new Map<string,Set<string>>();
 for(const event of results[0].results as Row[]){for(const key of ['before_json','after_json']){try{const data:unknown=JSON.parse(String(event[key]??'null'));if(!data||typeof data!=='object'||Array.isArray(data))continue;for(const [field,refTable] of Object.entries(mappings)){const value=(data as Record<string,unknown>)[field];if(typeof value==='string'&&value.length<=128){if(!refs.has(refTable))refs.set(refTable,new Set());refs.get(refTable)!.add(value);}}}catch{/* Some historical import events may lack a structured snapshot. */}}}
 const labels:Record<string,string>={};
 for(const [refTable,ids] of refs){const list=[...ids];for(let offset=0;offset<list.length;offset+=80){const part=list.slice(offset,offset+80);const result=await env.DB.batch([env.DB.prepare(`SELECT id,code,name FROM ${refTable} WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part)]);for(const row of result[0].results as Row[])labels[`${refTable}:${row.id}`]=`${row.code} — ${row.name}`;}}
 return json({data:(results[0].results as Row[]).map(event=>({...event,references_json:JSON.stringify(labels)})),pagination:{page,page_size:size,total}});
}
