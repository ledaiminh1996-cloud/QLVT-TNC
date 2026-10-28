import test from "node:test";
import assert from "node:assert/strict";
import {emptyLine,parseDraft,emptyDraft} from "../shared/documents";
import {recoveryImportResolver} from "../src/documents/recoveryQuickImport";
import type {RecoverySourceRow} from "../shared/recoverySources";
import type {DocumentClient} from "../src/documents/documentClient";
import {parseQuickTable,quickTableText} from "../shared/quickImportTable";
const source=(id:string,serial:string|null=null):RecoverySourceRow=>({usage_id:id,root_line_id:"root-"+id,part_id:"part",sku:"TIRE",name:"Tire",unit:"Cái",part_version:1,is_serialized:serial?1:0,serial_number:serial,target_label:"50H-001",position:"GTT",code:"10.26.001/PX",started_at:"2026-10-10T10:00",odo_milli:100000,hours_milli:null,quantity_milli:serial?1000:7000,issued_quantity_milli:10000,open_quantity_milli:7000});
const line=(q="1",serials:string[]=[])=>({...emptyLine(),part_id:"part",quantity:q,stock_state:"recovered" as const,recovery_classification:"CSD" as const,recovery_quality_percent:"40",serials});
function client(rows:RecoverySourceRow[],calls:string[]=[]){return {recoverySources:async(q:string,page:number,vehicle?:string)=>{calls.push(vehicle??"");return {data:rows.slice((page-1)*2,page*2),pagination:{page,page_size:2,total:rows.length}}}} as unknown as DocumentClient;}
test("recovery import joins serials across paginated issue/opening usages, splits roots and inherits opening valuation",async()=>{
 const rows=[source('u1','S1'),source('u2','S2'),{...source('u3','S3'),source_kind:'opening_usage' as const,opening_original_unit_price_known:0,opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'}],calls:string[]=[];
 const resolve=recoveryImportResolver(client(rows,calls),'tractor','2026-10-26T10:00',[]);
 const result=await resolve({...line('3',['S1','s2','S3']),recovery_quality_percent:undefined},{sku:'TIRE',recovery_quality_percent:''},true).catch(e=>{assert.match(e.message,/chất lượng/);return null;});assert.equal(result,null);
 const resolved=await recoveryImportResolver(client(rows,calls),'tractor','2026-10-26T10:00',[])(line('3',['S1','s2','S3']),{sku:'TIRE'},true);
 assert.deepEqual(resolved.map(l=>[l.usage_id,l.quantity,l.serials]),[['u1','1',['S1']],['u2','1',['S2']],['u3','1',['S3']]]);assert.ok(calls.every(v=>v==='tractor'));assert.equal(resolved[2].recovery_current_unit_price,'5000000');assert.equal(resolved[2].recovery_assessor,'Kỹ thuật');
 const inherited=await recoveryImportResolver(client([rows[2]]),'','2026-10-26T10:00',[])({...line('1',['S3']),recovery_quality_percent:undefined},{sku:'TIRE'},true);assert.equal(inherited[0].recovery_quality_percent,'20');
 const draft=emptyDraft('recovery');draft.warehouse_id='wh';draft.lines=resolved;assert.equal(parseDraft(draft).lines[0].usage_id,'u1');
});
test("recovery import rejects missing, duplicate or ambiguous roots and cumulative over-return including existing lines",async()=>{
 await assert.rejects(()=>recoveryImportResolver(client([]),'','2026-10-26T10:00',[])(line('1',['S1']),{sku:'TIRE'},true),/Không tìm thấy/);
 await assert.rejects(()=>recoveryImportResolver(client([source('u1','S1')]),'','2026-10-26T10:00',[])(line('2',['S1','s1']),{sku:'TIRE'},true),/bị lặp/);
 await assert.rejects(()=>recoveryImportResolver(client([source('u1')]),'','2026-10-26T10:00',[{...line('5'),usage_id:'u1'}])(line('3'),{sku:'TIRE'},false),/vượt/);
 const multiple=[source('u1'),{...source('u2'),code:'10.26.002/SD',target_label:'51R-002'}];
 await assert.rejects(()=>recoveryImportResolver(client(multiple),'','2026-10-26T10:00',[])(line(),{sku:'TIRE'},false),/nhiều lần xuất/);
 const resolved=await recoveryImportResolver(client(multiple),'','2026-10-26T10:00',[])(line('3'),{sku:'TIRE',source_code:'10.26.002/SD',target_code:'51R-002'},false);assert.equal(resolved[0].usage_id,'u2');
 const resolver=recoveryImportResolver(client([source('u1')]),'','2026-10-26T10:00',[]);await resolver(line('4'),{sku:'TIRE'},false);await assert.rejects(()=>resolver(line('4'),{sku:'TIRE'},false),/vượt/);
 await assert.rejects(()=>recoveryImportResolver(client([source('u1')]),'','2026-10-09T10:00',[])(line(),{sku:'TIRE'},false),/Không tìm thấy/);
});
test("recovery quick table round trips optional source document and target headings without shifting old columns",()=>{
 const rows=[{sku:'TIRE',quantity:'1',serial:'S1',recovery_classification:'CSD',recovery_quality_percent:'20',source_code:'10.26.001/SD',target_code:'51R-002'}];assert.deepEqual(parseQuickTable(quickTableText(rows,'recovery'),'recovery')[0],{...rows[0],notes:''});
 assert.equal(parseQuickTable('Serial\tSố lượng\tMã vật tư\tPhân loại\tChất lượng (%)\nS1\t1\tTIRE\tCSD\t20','recovery')[0].serial,'S1');
});
