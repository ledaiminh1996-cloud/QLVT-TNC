import {ApiError,json} from "./http.ts";
import {bookTarget} from "./bookTarget.ts";
import type {Env,Row,User} from "./types.ts";
import type {LedgerRow,LedgerChild,LedgerBalance,LedgerPage,LedgerChildren,LedgerUnits} from "../../shared/stockLedger.ts";
import {ledgerKinds} from "../../shared/stockLedger.ts";
const bad=(message:string):never=>{throw new ApiError(400,"INVALID_LEDGER_FILTER",message)};
function date(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+"T00:00Z"))||new Date(s+"T00:00Z").toISOString().slice(0,10)!==s)return bad("Chọn ngày chứng từ hợp lệ.");return s}
function n(v:unknown){const value=Number(v??0);if(!Number.isSafeInteger(value))throw new ApiError(422,"LEDGER_LIMIT","Số liệu vượt giới hạn. Chọn phạm vi nhỏ hơn.");return value}
const str=(v:unknown)=>String(v??"");
function reading(r:Row){const m=bookTarget(r);return {target:m.target_label,target_kind:m.target_kind,readings:[m.odo?m.odo+" km":"",m.hours?m.hours+" giờ":""].filter(Boolean).join(" / ")}}
export async function handleStockLedger(request:Request,env:Env,user:User){
 if(request.method!=="GET")throw new ApiError(405,"METHOD_NOT_ALLOWED","Sổ kho chỉ cho phép xem.");
 const p=new URL(request.url).searchParams,from=date(p.get("from")??""),to=date(p.get("to")??""),warehouse=p.get("warehouse_id")??"",part=p.get("part_id")??"",state=p.get("stock_state")??"",kind=p.get("kind")??"",q=p.get("q")?.trim()??"",view=p.get("view")??"",exporting=p.get("export")==="1",direction=p.get("direction")??"asc";
 if(from>to)return bad("Ngày bắt đầu phải trước ngày kết thúc.");for(const id of [warehouse,part])if(id&&!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return bad("Mã kho/vật tư không hợp lệ.");if(state&&!["new","recovered","pending_scrap"].includes(state))return bad("Trạng thái không hợp lệ.");if(kind&&!Object.hasOwn(ledgerKinds,kind))return bad("Loại phiếu không hợp lệ.");if(q.length>200||!["asc","desc"].includes(direction)||!["","children"].includes(view))return bad("Bộ lọc không hợp lệ.");
 if(warehouse&&user.role==="warehouse"&&!(await env.DB.prepare("SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?").bind(user.id,warehouse).first()))throw new ApiError(403,"WAREHOUSE_FORBIDDEN","Bạn không có quyền xem kho này.");
 const page=Number(p.get("page")??1),size=exporting?10000:Number(p.get("page_size")??(view==="children"?100:50));if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(size)||![50,100,10000].includes(size)||(!exporting&&size===10000))return bad("Chọn 50 hoặc 100 dòng mỗi trang.");
 const childKey=view==="children"?(p.get("group_key")??""):"",childVersion=Number(p.get("version"));
 if(view==="children"&&(!/^[a-zA-Z0-9_:-]{1,512}$/.test(childKey)||!Number.isSafeInteger(childVersion)||childVersion<0))return bad("Nhóm chứng từ không hợp lệ.");
 const access=(alias:string)=>{const conditions:string[]=[],args:(string|number)[]=[];if(user.role==="warehouse"){conditions.push(`EXISTS(SELECT 1 FROM document_warehouse_access a WHERE a.user_id=? AND a.warehouse_id=${alias}.warehouse_id)`);args.push(user.id)}for(const [key,value] of [["warehouse_id",warehouse],["part_id",part],["stock_state",state]])if(value){conditions.push(`${alias}.${key}=?`);args.push(value)}return {sql:conditions.length?" AND "+conditions.join(" AND "):"",args}};
 const flowScope=access("f"),monthScope=access("b"),scope=access("s");
 // The only pre-period movement scan is the partial first month; full older months use the materialized table.
 const calcBalance=!!part&&view!=="children";
 const opening=calcBalance?`opening AS (SELECT part_id,warehouse_id,stock_state,sum(q) AS opening_milli FROM (
 SELECT b.part_id,b.warehouse_id,b.stock_state,b.quantity_milli AS q FROM stock_book_months b WHERE b.period<substr(?,1,7) ${monthScope.sql}
 UNION ALL SELECT f.part_id,f.warehouse_id,f.stock_state,f.quantity_delta_milli FROM stock_book_flow f WHERE f.status='posted' AND f.day>=substr(?,1,7)||'-01' AND f.day<? ${flowScope.sql}) GROUP BY part_id,warehouse_id,stock_state),`:
 `opening AS (SELECT NULL AS part_id,NULL AS warehouse_id,NULL AS stock_state,0 AS opening_milli WHERE 0),`;
 const openingArgs=calcBalance?[from,...monthScope.args,from,from,...flowScope.args]:[];
 const base=`WITH ${opening} source AS (
 SELECT m.id AS movement_id,m.part_id,m.warehouse_id,l.line_number,l.sku_snapshot AS sku,l.part_name_snapshot AS part_name,l.unit_snapshot AS unit,
 coalesce(json_extract(dl.line_json,'$.stock_state'),CASE WHEN d.type='RECOVERY' THEN 'recovered' ELSE 'new' END) AS stock_state,d.business_date AS day,coalesce(rj.received_at,dd.business_at,d.business_date||'T00:00') AS business_at,d.posted_at,d.id AS document_id,dd.id AS draft_id,coalesce(dd.version,0) AS version,d.code,
 CASE WHEN rj.received_line_id IS NOT NULL THEN 'retread_receive' ELSE coalesce(dd.kind,CASE d.type WHEN 'IN' THEN 'receipt' WHEN 'OUT' THEN 'issue' WHEN 'OPENING' THEN 'opening' WHEN 'RECOVERY' THEN 'recovery' WHEN 'TRANSFER' THEN 'warehouse_transfer' WHEN 'SCRAP' THEN 'liquidation' ELSE d.type END) END AS kind,
 w.code AS warehouse_code,m.quantity_delta_milli AS delta,
 CASE WHEN m.quantity_delta_milli>0 THEN 'in' ELSE 'out' END AS flow,
 d.id||':'||m.warehouse_id||':'||m.part_id||':'||coalesce(json_extract(dl.line_json,'$.stock_state'),CASE WHEN d.type='RECOVERY' THEN 'recovered' ELSE 'new' END)||':'||CASE WHEN m.quantity_delta_milli>0 THEN 'in' ELSE 'out' END AS group_key,
 dd.header_json,dd.labels_json,dl.id AS draft_line_id,dl.line_json,l.vehicle_plate_snapshot,l.vehicle_odo_km,
 u.target_type AS source_target_type,u.target_id AS source_target_id,ud.header_json AS source_header_json,ud.labels_json AS source_labels_json,
 coalesce(rj.serial_after,l.serial_number_snapshot,'') AS fallback_serial,
 CASE WHEN rj.received_line_id IS NOT NULL THEN 1 ELSE (SELECT count(*) FROM document_draft_serials ds WHERE ds.document_id=dd.id AND ds.line_id=dl.id) END AS serial_count,
 EXISTS(SELECT 1 FROM inventory_valuation_flags v WHERE v.inventory_line_id=l.id AND v.status='pending') AS pending
 FROM inventory_documents d JOIN inventory_document_lines l ON l.document_id=d.id JOIN stock_movements m ON m.document_line_id=l.id JOIN warehouses w ON w.id=m.warehouse_id
 LEFT JOIN retread_jobs rj ON rj.received_line_id=l.id
 LEFT JOIN document_drafts dd ON dd.posted_inventory_id=d.id OR (rj.document_id IS NOT NULL AND dd.id=rj.document_id)
 LEFT JOIN document_draft_lines dl ON dl.document_id=dd.id AND dl.line_number=l.line_number
 LEFT JOIN stock_usages u ON u.id=json_extract(dl.line_json,'$.usage_id') LEFT JOIN document_drafts ud ON ud.posted_inventory_id=u.document_id
 WHERE d.status='posted' AND d.business_date>=? AND d.business_date<=? AND l.is_opening_usage=0),
 rows AS MATERIALIZED (SELECT s.* FROM source s WHERE 1 ${scope.sql} ${view==="children"?"AND s.group_key=?":""}),
 ${q?`search_hits AS MATERIALIZED (SELECT DISTINCT r.group_key FROM rows r WHERE
 lower(coalesce(r.vehicle_plate_snapshot,'')||' '||coalesce(json_extract(r.header_json,'$.issue_details.vehicle_plate'),'')||' '||coalesce(json_extract(r.header_json,'$.recovery_details.vehicle_plate'),'')||' '||coalesce((SELECT e.value FROM json_each(r.labels_json) e WHERE e.key='recovery_source:'||json_extract(r.line_json,'$.id') LIMIT 1),'')||' '||coalesce((SELECT e.value FROM json_each(r.labels_json) e WHERE e.key=(CASE json_extract(r.line_json,'$.target_type') WHEN 'equipment' THEN 'equipment:' ELSE 'vehicles:' END)||json_extract(r.line_json,'$.target_id') LIMIT 1),'')) LIKE ? ESCAPE '\\'
 OR EXISTS(SELECT 1 FROM document_draft_serials ds WHERE ds.document_id=r.draft_id AND ds.line_id=r.draft_line_id AND lower(ds.serial_number) LIKE ? ESCAPE '\\')
 OR (NOT EXISTS(SELECT 1 FROM document_draft_serials ds WHERE ds.document_id=r.draft_id AND ds.line_id=r.draft_line_id) AND lower(r.fallback_serial) LIKE ? ESCAPE '\\')),`:""}

 grouped AS (SELECT group_key,max(version) AS version,day,document_id,draft_id,code,kind,warehouse_id,warehouse_code,stock_state,part_id,sku,part_name,unit,flow,
 min(business_at) AS at,max(posted_at) AS posted_at,sum(CASE WHEN delta>0 THEN delta ELSE 0 END) AS in_milli,sum(CASE WHEN delta<0 THEN -delta ELSE 0 END) AS out_milli,sum(delta) AS delta,sum(serial_count) AS serial_count,sum(CASE WHEN serial_count>0 THEN serial_count ELSE 1 END) AS detail_count,max(pending) AS pending FROM rows GROUP BY group_key),
 numbered AS (SELECT g.*${calcBalance?",coalesce((SELECT o.opening_milli FROM opening o WHERE o.part_id=g.part_id AND o.warehouse_id=g.warehouse_id AND o.stock_state=g.stock_state),0)+sum(delta) OVER (PARTITION BY part_id,warehouse_id,stock_state ORDER BY day,at,document_id,flow ROWS UNBOUNDED PRECEDING) AS balance_milli":",NULL AS balance_milli"} FROM grouped g),
 matched AS MATERIALIZED (SELECT g.* FROM numbered g WHERE 1 ${kind?"AND kind=?":""} ${q?`AND (lower(code) LIKE ? ESCAPE '\\' OR group_key IN (SELECT group_key FROM search_hits))`:""})`;
 const pattern="%"+q.toLowerCase().replace(/[\\%_]/g,c=>"\\"+c)+"%";
 const args=[...openingArgs,from,to,...scope.args,...(view==="children"?[childKey]:[]),...(q?[pattern,pattern,pattern]:[]),...(kind?[kind]:[]),...(q?[pattern]:[])];
 const order=direction==="asc"?"ASC":"DESC";
 const childrenSql=`SELECT r.*,coalesce(nullif(r.fallback_serial,''),ds.serial_number,'') AS serial FROM rows r JOIN matched g ON g.group_key=r.group_key LEFT JOIN document_draft_serials ds ON ds.document_id=r.draft_id AND ds.line_id=r.draft_line_id AND r.kind<>'retread_receive'`;
 const child=(r:Row):LedgerChild=>{const quantity=n(r.serial_count)>1&&Math.abs(n(r.delta))!==n(r.serial_count)*1000?null:n(r.serial_count)>1?1000:Math.abs(n(r.delta));return {key:str(r.movement_id)+":"+str(r.serial),group_key:str(r.group_key),serial:str(r.serial),in_milli:n(r.delta)>0?quantity:0,out_milli:n(r.delta)<0?quantity:0,...reading(r),notes:(()=>{try{return str(JSON.parse(str(r.line_json)||"{}").notes)}catch{return ""}})()}};
 if(view==="children"){
  const key=childKey,expected=childVersion;
  const where=" WHERE r.group_key=? AND g.version=?",results=await env.DB.batch<Row>([
   env.DB.prepare(base+" "+childrenSql+where+" ORDER BY r.line_number,serial,r.movement_id LIMIT ? OFFSET ?").bind(...args,key,expected,size,(page-1)*size),
   env.DB.prepare(base+" SELECT (SELECT version FROM matched WHERE group_key=?) AS version,(SELECT count(*) FROM ("+childrenSql+where+")) AS total").bind(...args,key,key,expected)
  ]);
  const stats=results[1].results[0];
  if(stats.version===null||n(stats.version)!==expected)throw new ApiError(409,"LEDGER_CHANGED","Nhóm phiếu đã thay đổi hoặc không còn trong bộ lọc. Tải lại sổ.");
  return json({data:results[0].results.map(child),pagination:{page,page_size:size,total:n(stats.total)}} satisfies LedgerChildren);
 }
 const pageSql=`SELECT g.*,(SELECT r.header_json FROM rows r WHERE r.group_key=g.group_key LIMIT 1) AS header_json,(SELECT r.labels_json FROM rows r WHERE r.group_key=g.group_key LIMIT 1) AS labels_json,(SELECT json_group_array(json_object('kind',r.kind,'line_json',r.line_json,'source_target_type',r.source_target_type,'source_target_id',r.source_target_id,'source_header_json',r.source_header_json,'source_labels_json',r.source_labels_json,'vehicle_plate_snapshot',r.vehicle_plate_snapshot,'vehicle_odo_km',r.vehicle_odo_km)) FROM rows r WHERE r.group_key=g.group_key) AS metadata FROM selected_page g ORDER BY day ${order},at ${order},document_id ${order},flow ${order}`;
 const pageBase=base+`, selected_page AS MATERIALIZED (SELECT * FROM matched ORDER BY day ${order},at ${order},document_id ${order},flow ${order} LIMIT ? OFFSET ?)`;
 const balancesSql=part?`SELECT x.part_id,x.warehouse_id,x.stock_state,w.code AS warehouse_code,p.sku,p.name AS part_name,p.unit,sum(x.opening_milli) AS opening_milli,sum(x.closing_milli) AS closing_milli FROM (
 SELECT part_id,warehouse_id,stock_state,opening_milli,opening_milli AS closing_milli FROM opening UNION ALL SELECT part_id,warehouse_id,stock_state,0,sum(delta) FROM grouped GROUP BY part_id,warehouse_id,stock_state
 ) x JOIN warehouses w ON w.id=x.warehouse_id JOIN parts p ON p.id=x.part_id GROUP BY x.part_id,x.warehouse_id,x.stock_state ORDER BY w.code,x.stock_state`:"SELECT NULL WHERE 0";
 // One statistics statement reuses matched/grouped/opening for count, unit totals and balances.
 const statsSql=`SELECT (SELECT count(*) FROM matched) AS total,
 (SELECT json_group_array(json_object('unit',unit,'in_milli',in_milli,'out_milli',out_milli)) FROM (SELECT unit,sum(in_milli) AS in_milli,sum(out_milli) AS out_milli FROM matched GROUP BY unit)) AS units_json,
 ${part?`(SELECT json_group_array(json_object('part_id',part_id,'warehouse_id',warehouse_id,'stock_state',stock_state,'warehouse_code',warehouse_code,'sku',sku,'part_name',part_name,'unit',unit,'opening_milli',opening_milli,'closing_milli',closing_milli)) FROM (${balancesSql}))`:"'[]'"} AS balances_json`;
 const statements=[env.DB.prepare(pageBase+" "+pageSql).bind(...args,size,exporting?0:(page-1)*size),env.DB.prepare(base+" "+statsSql).bind(...args),...(exporting?[env.DB.prepare(base+" "+childrenSql+" ORDER BY r.day,r.business_at,r.document_id,r.line_number,serial LIMIT 10001").bind(...args)]:[])];
 const results=await env.DB.batch<Row>(statements),stats=results[1].results[0],count=n(stats.total);
 if(exporting&&(count>10000||results[2].results.length>10000))throw new ApiError(422,"LEDGER_EXPORT_LIMIT","Sổ có hơn 10.000 dòng chi tiết. Thu hẹp kỳ hoặc kho để xuất đầy đủ.");
 const unitRows=JSON.parse(str(stats.units_json)||"[]") as Row[],balanceRows=JSON.parse(str(stats.balances_json)||"[]") as Row[];
 const data=results[0].results.map((r):LedgerRow=>{const metadata=(JSON.parse(str(r.metadata)||"[]") as Row[]).map(m=>reading({...m,header_json:r.header_json,labels_json:r.labels_json})),targets=[...new Set(metadata.map(m=>m.target+(m.target_kind?" · "+m.target_kind:"")).filter(Boolean))],readings=[...new Set(metadata.map(m=>m.readings).filter(Boolean))];return {key:str(r.group_key),version:n(r.version),day:str(r.day),posted_at:str(r.posted_at),document_id:str(r.document_id),draft_id:r.draft_id===null?null:str(r.draft_id),code:str(r.code),kind:str(r.kind),warehouse_id:str(r.warehouse_id),warehouse_code:str(r.warehouse_code),stock_state:r.stock_state as LedgerRow['stock_state'],part_id:str(r.part_id),sku:str(r.sku),part_name:str(r.part_name).startsWith(str(r.sku)+" — ")?str(r.part_name).slice(str(r.sku).length+3):str(r.part_name),unit:str(r.unit),in_milli:n(r.in_milli),out_milli:n(r.out_milli),balance_milli:r.balance_milli===null?null:n(r.balance_milli),serial_count:n(r.serial_count),detail_count:n(r.detail_count),target:targets.length>1?"Nhiều thiết bị":targets[0]??"",target_kind:"",readings:readings.length>1?"Nhiều số đo":readings[0]??"",pending:!!r.pending}});
 const balances:LedgerBalance[]=part?balanceRows.map(r=>({part_id:str(r.part_id),warehouse_id:str(r.warehouse_id),stock_state:r.stock_state as LedgerBalance['stock_state'],warehouse_code:str(r.warehouse_code),sku:str(r.sku),part_name:str(r.part_name),unit:str(r.unit),opening_milli:n(r.opening_milli),closing_milli:n(r.closing_milli)})):[];
 return json({data,balances,units:unitRows.map(r=>({unit:str(r.unit),in_milli:n(r.in_milli),out_milli:n(r.out_milli)} satisfies LedgerUnits)),totals:{count,opening_milli:part?balances.reduce((sum,b)=>n(sum+b.opening_milli),0):null,closing_milli:part?balances.reduce((sum,b)=>n(sum+b.closing_milli),0):null},pagination:{page:exporting?1:page,page_size:size,total:count},...(exporting?{children:results[2].results.map(child)}:{})} satisfies LedgerPage);
}
