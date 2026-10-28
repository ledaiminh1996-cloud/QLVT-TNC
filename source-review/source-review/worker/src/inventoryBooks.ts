import {serialKey} from "../../shared/documentSerials.ts";
import {bookTarget} from "./bookTarget.ts";
import {searchPattern} from "../../shared/searchText.ts";
import {bookKindLabels} from "../../shared/inventoryBooks.ts";
import type {BookGroup,BookMovement,BookPage,BookTotals,InventoryBook} from "../../shared/inventoryBooks.ts";
import {ApiError,json} from "./http.ts";
import type {Env,Row,User} from "./types.ts";
const invalid=(message:string):never=>{throw new ApiError(400,"INVALID_BOOK_FILTER",message)};
function date(value:string):string{if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+"T00:00Z"))||new Date(value+"T00:00Z").toISOString().slice(0,10)!==value)return invalid("Chọn ngày hợp lệ.");return value}
function integer(value:unknown):number{const n=Number(value??0);if(!Number.isSafeInteger(n))throw new ApiError(422,"BOOK_TOTAL_TOO_LARGE","Số liệu vượt giới hạn tính toán. Hãy thu hẹp bộ lọc.");return n}
const amount=(r:Row,key:string):number|null=>r[key]===null?null:integer(r[key]);
function group(r:Row):BookGroup{return {part_id:String(r.part_id),sku:String(r.sku),part_name:String(r.part_name),unit:String(r.unit),warehouse_id:String(r.warehouse_id),warehouse_code:String(r.warehouse_code),warehouse_name:String(r.warehouse_name),stock_state:r.stock_state as BookGroup["stock_state"],last_at:String(r.last_at),pending_lines:integer(r.pending_lines),transfer_in_quantity_milli:integer(r.transfer_in_quantity_milli),transfer_in_value_vnd:amount(r,"transfer_in_value_vnd"),transfer_out_quantity_milli:integer(r.transfer_out_quantity_milli),transfer_out_value_vnd:amount(r,"transfer_out_value_vnd"),first_movement_at:r.first_movement_at===null?null:String(r.first_movement_at),last_movement_at:r.last_movement_at===null?null:String(r.last_movement_at),...Object.fromEntries(["opening_quantity_milli","in_quantity_milli","out_quantity_milli","closing_quantity_milli"].map(k=>[k,integer(r[k])])),...Object.fromEntries(["opening_value_vnd","in_value_vnd","out_value_vnd","closing_value_vnd"].map(k=>[k,amount(r,k)]))} as BookGroup}
export async function handleInventoryBooks(request:Request,env:Env,user:User):Promise<Response>{
 if(request.method!=="GET")throw new ApiError(405,"METHOD_NOT_ALLOWED","Sổ kho chỉ cho phép xem dữ liệu.");
 const p=new URL(request.url).searchParams;
 if(p.get("view")==="warehouses"){
  const rows=await env.DB.prepare("SELECT w.id,w.code,w.name FROM warehouses w "+(user.role==="warehouse"?"WHERE EXISTS(SELECT 1 FROM document_warehouse_access a WHERE a.warehouse_id=w.id AND a.user_id=?) ":"")+"ORDER BY w.code,w.id").bind(...(user.role==="warehouse"?[user.id]:[])).all<Row>();return json({data:rows.results});
 }
 const book=p.get("book")??"summary";if(!["stock","card","summary"].includes(book))return invalid("Loại sổ không hợp lệ.");
 const from=date(p.get("from")??""),to=date(p.get("to")??"");if(from>to)return invalid("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
 const warehouse=p.get("warehouse_id")??"",part=p.get("part_id")??"",state=p.get("stock_state")??"",q=p.get("q")?.trim()??"",kind=p.get("kind")??"",direction=p.get("direction")??"asc";
 if(!["asc","desc"].includes(direction)||kind&&!Object.hasOwn(bookKindLabels,kind)||book!=="card"&&kind)return invalid("Loại phiếu hoặc sắp xếp không hợp lệ.");
 for(const id of [warehouse,part])if(id&&!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return invalid("Mã kho hoặc vật tư không hợp lệ.");
 if(state&&!["new","recovered","pending_scrap"].includes(state))return invalid("Trạng thái hàng không hợp lệ.");if(q.length>200)return invalid("Từ khóa quá dài.");
 if(book==="card"&&!part)return invalid("Chọn vật tư để xem sổ chi tiết NXT.");
 if(warehouse&&user.role==="warehouse"&&!(await env.DB.prepare("SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?").bind(user.id,warehouse).first()))throw new ApiError(403,"WAREHOUSE_FORBIDDEN","Bạn không có quyền xem sổ kho này.");
 const exporting=p.get("export")==="1",page=Number(p.get("page")??1),size=exporting?10000:Number(p.get("page_size")??25);
 if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(size)||size<1||(!exporting&&size>100))return invalid("Phân trang không hợp lệ.");
 const where=["d.status='posted'","l.is_opening_usage=0"],args:(string|number)[]=[];
 if(user.role==="warehouse"){where.push("EXISTS(SELECT 1 FROM document_warehouse_access a WHERE a.user_id=? AND a.warehouse_id=m.warehouse_id)");args.push(user.id)}
 if(warehouse){where.push("m.warehouse_id=?");args.push(warehouse)}if(part){where.push("m.part_id=?");args.push(part)}
 if(q&&book!=="card"){where.push("EXISTS(SELECT 1 FROM catalog_search cs WHERE cs.resource='parts' AND cs.entity_id=m.part_id AND cs.normalized_text LIKE ? ESCAPE '\\')");args.push(searchPattern(q))}
 const serialExpression=book==="summary"?"''":"coalesce(rj.serial_after,(SELECT group_concat(ds.serial_number,'; ') FROM document_draft_serials ds WHERE ds.document_id=dd.id AND ds.line_id=dl.id),l.serial_number_snapshot,'')";
 const serialSearch=book==="card"&&!!q;
 // A complete Serial is a data scope, not a post-balance text filter.
 const serialMatch=serialSearch?`CASE WHEN rj.received_line_id IS NOT NULL THEN CASE WHEN upper(trim(rj.serial_after))=(SELECT serial_key FROM bounds) THEN rj.serial_after END ELSE coalesce((SELECT ds.serial_number FROM document_draft_serials ds WHERE ds.document_id=dd.id AND ds.line_id=dl.id AND ds.serial_key=(SELECT serial_key FROM bounds) LIMIT 1),CASE WHEN upper(trim(l.serial_number_snapshot))=(SELECT serial_key FROM bounds) THEN l.serial_number_snapshot END) END`:"NULL";
 const serialCost=serialSearch?`(SELECT json_extract(cost.value,'$.amount_vnd') FROM json_each(CASE WHEN json_valid(json_extract(dd.labels_json,'$."'||CASE WHEN dd.kind='recovery' THEN 'recovery_serial_costs:' ELSE 'issue_serial_costs:' END||dl.id||'"')) THEN json_extract(dd.labels_json,'$."'||CASE WHEN dd.kind='recovery' THEN 'recovery_serial_costs:' ELSE 'issue_serial_costs:' END||dl.id||'"') ELSE '[]' END) cost WHERE upper(trim(json_extract(cost.value,'$.serial')))=(SELECT serial_key FROM bounds) LIMIT 1)`:"NULL";
 const serialCount=serialSearch?"CASE WHEN rj.received_line_id IS NOT NULL THEN 1 ELSE (SELECT count(*) FROM document_draft_serials ds WHERE ds.document_id=dd.id AND ds.line_id=dl.id) END":"0";
 const entryMatch=[...(kind?["kind=?"]:[]),...(q&&book==="card"?["((SELECT enabled FROM serial_scope)=1 OR lower(code) LIKE ? ESCAPE '\\' OR lower(serials) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM catalog_search cs WHERE cs.resource='parts' AND cs.entity_id=running.part_id AND cs.normalized_text LIKE ? ESCAPE '\\'))"]:[])];
 const matchArgs=[...(kind?[kind]:[]),...(q&&book==="card"?["%"+q.toLowerCase().replace(/[\\%_]/g,c=>"\\"+c)+"%","%"+q.toLowerCase().replace(/[\\%_]/g,c=>"\\"+c)+"%",searchPattern(q)]:[])];
 const opened="(business_at < (SELECT start_at FROM bounds) OR (type='OPENING' AND substr(business_at,1,10)=(SELECT start_day FROM bounds)))";
 const period="NOT "+opened;
 const base=`WITH bounds AS (SELECT ? AS start_at,? AS end_at,? AS start_day,? AS serial_key), source AS (
 SELECT m.id AS movement_id,m.part_id,l.sku_snapshot AS sku,l.part_name_snapshot AS part_name,l.unit_snapshot AS unit,m.warehouse_id,w.code AS warehouse_code,w.name AS warehouse_name,
 coalesce(json_extract(dl.line_json,'$.stock_state'),CASE WHEN d.type='RECOVERY' THEN 'recovered' ELSE 'new' END) AS stock_state,
 coalesce(rj.received_at,dd.business_at,d.business_date||'T00:00') AS business_at,d.posted_at,d.id AS document_id,l.line_number,dd.id AS draft_id,d.code,d.type,
 CASE WHEN rj.received_line_id IS NOT NULL THEN 'retread_receive' ELSE coalesce(dd.kind,d.type) END AS kind,
 coalesce(json_extract(dd.header_json,'$.purpose'),d.notes,'') AS purpose,coalesce(json_extract(dl.line_json,'$.notes'),'') AS notes,
 ${serialExpression} AS batch_serials,${serialMatch} AS matched_serial,${serialCost} AS snapshot_serial_amount,${serialCount} AS serial_count,
 dd.header_json,dd.labels_json,dl.line_json,l.vehicle_plate_snapshot,l.vehicle_odo_km,
 u.target_type AS source_target_type,u.target_id AS source_target_id,ud.header_json AS source_header_json,ud.labels_json AS source_labels_json,
 m.quantity_delta_milli AS original_quantity,m.value_delta_vnd AS original_value,
 EXISTS(SELECT 1 FROM inventory_valuation_flags f WHERE f.inventory_line_id=l.id AND f.status='pending') AS original_pending
 FROM stock_movements m JOIN inventory_document_lines l ON l.id=m.document_line_id JOIN inventory_documents d ON d.id=l.document_id JOIN warehouses w ON w.id=m.warehouse_id
 LEFT JOIN retread_jobs rj ON rj.received_line_id=l.id
 LEFT JOIN document_drafts dd ON dd.posted_inventory_id=d.id OR (rj.document_id IS NOT NULL AND dd.id=rj.document_id)
 LEFT JOIN document_draft_lines dl ON dl.document_id=dd.id AND dl.line_number=l.line_number
 LEFT JOIN stock_usages u ON u.id=json_extract(dl.line_json,'$.usage_id')
 LEFT JOIN document_drafts ud ON ud.posted_inventory_id=u.document_id
 WHERE ${where.join(" AND ")}
 ), scoped AS (SELECT * FROM source WHERE business_at <= (SELECT end_at FROM bounds) ${state?"AND stock_state=?":""}),
 serial_scope AS (SELECT EXISTS(SELECT 1 FROM scoped WHERE matched_serial IS NOT NULL) AS enabled),
 priced AS (SELECT scoped.*,coalesce(snapshot_serial_amount,CASE WHEN abs(original_quantity)=1000 THEN abs(original_value) WHEN (type IN ('IN','OPENING') OR kind='receipt') AND serial_count*1000=abs(original_quantity) THEN abs(original_value)/serial_count+CASE WHEN (abs(original_value)%serial_count)*2>=serial_count THEN 1 ELSE 0 END END) AS serial_amount FROM scoped),
 raw AS (SELECT priced.*,
 CASE WHEN (SELECT enabled FROM serial_scope)=1 THEN matched_serial ELSE batch_serials END AS serials,
 CASE WHEN (SELECT enabled FROM serial_scope)=1 THEN CASE WHEN original_quantity>0 THEN 1000 WHEN original_quantity<0 THEN -1000 ELSE 0 END ELSE original_quantity END AS quantity_delta,
 CASE WHEN (SELECT enabled FROM serial_scope)=1 THEN coalesce(serial_amount,0)*CASE WHEN original_quantity<0 THEN -1 ELSE 1 END ELSE original_value END AS value_delta,
 CASE WHEN (SELECT enabled FROM serial_scope)=1 THEN original_pending OR serial_amount IS NULL ELSE original_pending END AS pending
 FROM priced WHERE (SELECT enabled FROM serial_scope)=0 OR matched_serial IS NOT NULL),
 aggregates AS (SELECT part_id,warehouse_id,stock_state,
 sum(CASE WHEN ${opened} THEN quantity_delta ELSE 0 END) AS opening_quantity_milli,
 CASE WHEN sum(CASE WHEN ${opened} THEN pending ELSE 0 END)>0 AND sum(CASE WHEN ${opened} THEN quantity_delta ELSE 0 END)<>0 THEN NULL ELSE sum(CASE WHEN ${opened} THEN value_delta ELSE 0 END) END AS opening_value_vnd,
 sum(CASE WHEN ${period} AND quantity_delta>0 THEN quantity_delta ELSE 0 END) AS in_quantity_milli,
 CASE WHEN sum(CASE WHEN ${period} AND quantity_delta>0 THEN pending ELSE 0 END)>0 THEN NULL ELSE sum(CASE WHEN ${period} AND quantity_delta>0 THEN value_delta ELSE 0 END) END AS in_value_vnd,
 sum(CASE WHEN ${period} AND quantity_delta<0 THEN -quantity_delta ELSE 0 END) AS out_quantity_milli,
 CASE WHEN sum(CASE WHEN ${period} AND quantity_delta<0 THEN pending ELSE 0 END)>0 THEN NULL ELSE sum(CASE WHEN ${period} AND quantity_delta<0 THEN -value_delta ELSE 0 END) END AS out_value_vnd,
 sum(quantity_delta) AS closing_quantity_milli,CASE WHEN sum(pending)>0 AND sum(quantity_delta)<>0 THEN NULL ELSE sum(value_delta) END AS closing_value_vnd,
 sum(CASE WHEN ${period} AND (kind='warehouse_transfer' OR type='TRANSFER') AND quantity_delta>0 THEN quantity_delta ELSE 0 END) AS transfer_in_quantity_milli,
 CASE WHEN sum(CASE WHEN ${period} AND (kind='warehouse_transfer' OR type='TRANSFER') AND quantity_delta>0 THEN pending ELSE 0 END)>0 THEN NULL ELSE sum(CASE WHEN ${period} AND (kind='warehouse_transfer' OR type='TRANSFER') AND quantity_delta>0 THEN value_delta ELSE 0 END) END AS transfer_in_value_vnd,
 sum(CASE WHEN ${period} AND (kind='warehouse_transfer' OR type='TRANSFER') AND quantity_delta<0 THEN -quantity_delta ELSE 0 END) AS transfer_out_quantity_milli,
 CASE WHEN sum(CASE WHEN ${period} AND (kind='warehouse_transfer' OR type='TRANSFER') AND quantity_delta<0 THEN pending ELSE 0 END)>0 THEN NULL ELSE sum(CASE WHEN ${period} AND (kind='warehouse_transfer' OR type='TRANSFER') AND quantity_delta<0 THEN -value_delta ELSE 0 END) END AS transfer_out_value_vnd,
 min(CASE WHEN business_at>=(SELECT start_at FROM bounds) THEN business_at END) AS first_movement_at,
 max(CASE WHEN business_at>=(SELECT start_at FROM bounds) THEN business_at END) AS last_movement_at,
 sum(pending) AS pending_lines,max(business_at) AS last_at
 FROM raw GROUP BY part_id,warehouse_id,stock_state),
 groups AS (SELECT a.*,p.sku,p.name AS part_name,p.unit,w.code AS warehouse_code,w.name AS warehouse_name FROM aggregates a JOIN parts p ON p.id=a.part_id JOIN warehouses w ON w.id=a.warehouse_id),
 running AS (SELECT raw.*,sum(quantity_delta) OVER seq AS balance_quantity_milli,sum(value_delta) OVER seq AS balance_raw,sum(pending) OVER seq AS pending_seen FROM raw WINDOW seq AS (PARTITION BY part_id,warehouse_id,stock_state ORDER BY CASE WHEN ${opened} THEN 0 ELSE 1 END,business_at,posted_at,document_id,line_number,movement_id ROWS UNBOUNDED PRECEDING)),
 entries AS (SELECT * FROM running WHERE ${period} ${entryMatch.length?"AND "+entryMatch.join(" AND "):""}), tracking AS (SELECT * FROM running WHERE business_at >= (SELECT start_at FROM bounds))`;
 const bound=[from+"T00:00",to+"T23:59:59.999",from,serialSearch?serialKey(q):"",...args,...(state?[state]:[]),...matchArgs];
 const rowsSql=book==="stock"?"SELECT * FROM tracking ORDER BY business_at DESC,posted_at DESC,document_id DESC,line_number DESC,movement_id DESC LIMIT ? OFFSET ?":book==="card"?`SELECT * FROM entries ORDER BY business_at ${direction},posted_at ${direction},document_id ${direction},line_number ${direction},movement_id ${direction} LIMIT ? OFFSET ?`:`SELECT * FROM groups ORDER BY warehouse_code ${direction},warehouse_id ${direction},sku ${direction},part_id ${direction},stock_state ${direction} LIMIT ? OFFSET ?`;
 const totalSql="SELECT count(*) AS total FROM "+(book==="stock"?"tracking":book==="card"?"entries":"groups");
 const totalsSql="SELECT (SELECT enabled FROM serial_scope) AS serial_scoped,count(*) AS group_count,coalesce(sum(pending_lines>0),0) AS pending_groups,"+["opening","in","out","closing",...(book==="summary"?["transfer_in","transfer_out"]:[])].map(k=>`CASE WHEN count(*)>count(${k}_value_vnd) THEN NULL ELSE coalesce(sum(${k}_value_vnd),0) END AS ${k}_value_vnd`).join(",")+" FROM groups";
 const statements=[env.DB.prepare(base+" "+rowsSql).bind(...bound,size,exporting?0:(page-1)*size),env.DB.prepare(base+" "+totalSql).bind(...bound),env.DB.prepare(base+" "+totalsSql).bind(...bound),...(book==="card"?[env.DB.prepare(base+" SELECT * FROM groups ORDER BY warehouse_code,warehouse_id,stock_state LIMIT 1001").bind(...bound)]:[])];
 const results=await env.DB.batch<Row>(statements),total=integer(results[1].results[0].total);if(exporting&&total>10000)throw new ApiError(422,"BOOK_EXPORT_LIMIT","Sổ có hơn 10.000 dòng. Chọn khoảng ngày hoặc kho hẹp hơn để xuất đầy đủ.");
 if(book==="card"&&results[3].results.length>1000)throw new ApiError(422,"BOOK_GROUP_LIMIT","Chọn một kho cụ thể để xem sổ chi tiết NXT.");
 const data=book!=="summary"?results[0].results.map((r):BookMovement=>({...bookTarget(r),movement_id:String(r.movement_id),part_id:String(r.part_id),sku:String(r.sku),part_name:String(r.part_name).startsWith(String(r.sku)+" — ")?String(r.part_name).slice(String(r.sku).length+3):String(r.part_name),unit:String(r.unit),warehouse_id:String(r.warehouse_id),warehouse_code:String(r.warehouse_code),warehouse_name:String(r.warehouse_name),stock_state:r.stock_state as BookMovement["stock_state"],business_at:String(r.business_at),document_id:String(r.document_id),draft_id:r.draft_id===null?null:String(r.draft_id),code:String(r.code),kind:String(r.kind),purpose:String(r.purpose),notes:String(r.notes),serials:String(r.serials),in_quantity_milli:integer(Number(r.quantity_delta)>0?r.quantity_delta:0),in_value_vnd:Number(r.quantity_delta)>0?(r.pending?null:integer(r.value_delta)):0,out_quantity_milli:integer(Number(r.quantity_delta)<0?-Number(r.quantity_delta):0),out_value_vnd:Number(r.quantity_delta)<0?(r.pending?null:-integer(r.value_delta)):0,balance_quantity_milli:integer(r.balance_quantity_milli),balance_value_vnd:Number(r.pending_seen)>0&&Number(r.balance_quantity_milli)!==0?null:integer(r.balance_raw),valuation_pending:!!r.pending})):results[0].results.map(group);
 const r=results[2].results[0],totals:BookTotals={group_count:integer(r.group_count),pending_groups:integer(r.pending_groups),opening_value_vnd:amount(r,"opening_value_vnd"),in_value_vnd:amount(r,"in_value_vnd"),out_value_vnd:amount(r,"out_value_vnd"),closing_value_vnd:amount(r,"closing_value_vnd"),...(book==="summary"?{transfer_in_value_vnd:amount(r,"transfer_in_value_vnd"),transfer_out_value_vnd:amount(r,"transfer_out_value_vnd")}: {})};
 return json({book:book as InventoryBook,from,to,...(r.serial_scoped?{serial_filter:serialKey(q)}:{}),data,groups:book==="card"?results[3].results.map(group):[],totals,pagination:{page:exporting?1:page,page_size:size,total}} satisfies BookPage);
}
