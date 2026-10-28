import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const backup=resolve(root,'artifacts/before-issue-target-correction-20261028.sql');
const dump=readFileSync(backup,'utf8');
const config={draftId:'c707a451-a741-495f-abd5-87167ac5571e',code:'10.26.00001/PX',oldId:'b84e36f0-b79f-56e8-9853-07dfb882b363',oldPlate:'50H-110.99',targetId:'359ad25d-733d-5cb6-9322-41384cce5824',targetPlate:'51R-047.31',count:12};
const hash=s=>createHash('sha256').update(s).digest('hex');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const makeDb=()=>{const db=new DatabaseSync(':memory:',{enableForeignKeyConstraints:false});db.exec(dump);db.exec('PRAGMA foreign_keys=ON');return db};
const all=(db,sql,args=[])=>db.prepare(sql).all(...args);
const one=(db,sql,args=[])=>db.prepare(sql).get(...args);
const command=(sql,...args)=>({sql,args});
const guard=(condition,...args)=>command(`SELECT CASE WHEN (${condition}) THEN 1 ELSE json('ISSUE_TARGET_REPAIR_GUARD_FAILED') END AS ok`,...args);
const localBatch=(db,commands)=>{db.exec('BEGIN IMMEDIATE');try{for(const c of commands){if(c.sql.startsWith('SELECT'))all(db,c.sql,c.args);else db.prepare(c.sql).run(...c.args)}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}};
function snapshot(db,table,exclude=[]){
 const columns=all(db,`PRAGMA table_info(${quote(table)})`).map(c=>c.name).filter(c=>!exclude.includes(c));
 assert.ok(columns.length>0,table);
 const fields=columns.map(c=>`'${c.replaceAll("'","''")}',${quote(c)}`).join(',');
 const sql=`SELECT json_group_array(json_object(${fields})) AS value FROM (SELECT ${columns.map(quote).join(',')} FROM ${quote(table)} ORDER BY ${columns.map(quote).join(',')})`;
 const value=one(db,sql).value;return {table,sql,value,rows:JSON.parse(value).length,sha256:hash(value)};
}
function build(db){
 const d=one(db,'SELECT * FROM document_drafts WHERE id=?',[config.draftId]);assert.ok(d);assert.equal(d.code,config.code);assert.equal(d.kind,'issue');assert.equal(d.version,1);assert.equal(d.deleted_at,null);
 const inventory=one(db,'SELECT * FROM inventory_documents WHERE id=?',[d.posted_inventory_id]);assert.equal(inventory.status,'posted');assert.equal(inventory.type,'OUT');
 const head=JSON.parse(d.header_json),labels=JSON.parse(d.labels_json);assert.equal(head.issue_details.vehicle_id,config.oldId);assert.equal(head.issue_details.vehicle_plate,config.oldPlate);assert.equal(head.issue_details.trailer_number,config.targetPlate);
 const target=one(db,'SELECT * FROM vehicles WHERE id=?',[config.targetId]);assert.equal(target.type,'trailer');assert.equal(target.plate_number,config.targetPlate);
 const actor=one(db,"SELECT id,email,role,is_active FROM app_users WHERE lower(email)='ledaiminh1996@gmail.com'");assert.equal(actor?.role,'admin');assert.equal(actor.is_active,1);
 const dl=all(db,'SELECT * FROM document_draft_lines WHERE document_id=? ORDER BY line_number',[d.id]),il=all(db,'SELECT * FROM inventory_document_lines WHERE document_id=? ORDER BY line_number',[inventory.id]),usages=all(db,'SELECT * FROM stock_usages WHERE document_id=? ORDER BY root_line_id,id',[inventory.id]);
 assert.equal(dl.length,config.count);assert.equal(il.length,config.count);assert.equal(usages.length,config.count);assert.equal(new Set(usages.map(u=>u.root_line_id)).size,config.count);
 for(const l of dl){const line=JSON.parse(l.line_json);assert.equal(line.target_type,'vehicle');assert.equal(line.target_id,config.oldId);assert.ok(line.to_position.startsWith('Rơ moóc'));assert.equal(line.odo,head.issue_details.odo);assert.ok(!line.hours);}
 for(const u of usages){assert.equal(u.target_id,config.oldId);assert.equal(u.target_type,'vehicle');assert.equal(u.open_quantity_milli,u.quantity_milli);assert.equal(u.parent_usage_id,null)}
 const invariantTables=['inventory_documents','stock_balances','stock_buckets','stock_lots','stock_movements','stock_source_allocations','stock_cost_dependencies','inventory_serials','usage_serials','stock_book_months','stock_book_flow','opening_groups','retread_jobs','inventory_valuation_flags','equipment_operations','document_draft_serials','accounting_periods'];
 const invariants=invariantTables.map(t=>snapshot(db,t));invariants.push(snapshot(db,'inventory_document_lines',['vehicle_id','vehicle_plate_snapshot','vehicle_odo_km']),snapshot(db,'stock_usages',['target_type','target_id','odo_milli','version']));
 const triggersSql="SELECT json_group_array(json_object('name',name,'sql',sql)) AS value FROM (SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name)";invariants.push({table:'all_triggers',sql:triggersSql,value:one(db,triggersSql).value});
 const operationId=randomUUID(),reason='Người dùng xác nhận qua Codex ngày 28/10/2026: 12 vỏ trên phiếu '+config.code+' thực tế lắp rơ moóc '+config.targetPlate+'. Sửa ID/snapshot thiết bị nhận và bỏ ODO đầu kéo bị tự gán; giữ nguyên ID nguồn, số lượng, tiền, tồn và chứng từ gốc.';
 const newHeader=structuredClone(head);Object.assign(newHeader.issue_details,{installation_target:'trailer',installation_odo:'',installation_hours:''});
 const newLabel=config.targetPlate+' — '+(target.brand_model||'Rơ moóc'),newLabels={...labels,['vehicles:'+target.id]:newLabel,['type:vehicles:'+target.id]:'trailer'};
 const newLines=dl.map(row=>({...row,line_json:JSON.stringify({...JSON.parse(row.line_json),target_type:'vehicle',target_id:target.id,odo:''})}));
 const before={version:d.version,header:head,labels,lines:dl.map(l=>({id:l.id,line:JSON.parse(l.line_json)})),inventory_targets:il.map(l=>({id:l.id,vehicle_id:l.vehicle_id,vehicle_plate_snapshot:l.vehicle_plate_snapshot,vehicle_odo_km:l.vehicle_odo_km})),usage_targets:usages.map(u=>({id:u.id,target_type:u.target_type,target_id:u.target_id,odo_milli:u.odo_milli,version:u.version}))};
 const after={version:d.version+1,header:newHeader,labels:newLabels,lines:newLines.map(l=>({id:l.id,line:JSON.parse(l.line_json)})),inventory_targets:il.map(l=>({id:l.id,vehicle_id:target.id,vehicle_plate_snapshot:newLabel,vehicle_odo_km:null})),usage_targets:usages.map(u=>({id:u.id,target_type:'vehicle',target_id:target.id,odo_milli:null,version:u.version+1})),confirmation:'User confirmed all 12 tires installed on 51R-047.31 in this Codex conversation',financial_invariants:invariants.map(i=>({table:i.table,sha256:hash(i.value)}))};
 const pre=[
 guard("EXISTS(SELECT 1 FROM document_drafts d JOIN inventory_documents i ON i.id=d.posted_inventory_id WHERE d.id=? AND d.code=? AND d.kind='issue' AND d.version=? AND d.deleted_at IS NULL AND d.header_json=? AND d.labels_json=? AND d.totals_json=? AND i.status='posted' AND i.type='OUT')",d.id,d.code,d.version,d.header_json,d.labels_json,d.totals_json),
 guard("EXISTS(SELECT 1 FROM app_users WHERE id=? AND role='admin' AND is_active=1)",actor.id),
 guard("EXISTS(SELECT 1 FROM vehicles WHERE id=? AND plate_number=? AND type='trailer')",target.id,config.targetPlate),
 guard("NOT EXISTS(SELECT 1 FROM accounting_periods WHERE is_locked=1 AND period>=?)",d.business_at.slice(0,7)),
 guard('(SELECT count(*) FROM document_draft_lines WHERE document_id=?)=?',d.id,config.count),
 guard('(SELECT count(*) FROM inventory_document_lines WHERE document_id=?)=?',inventory.id,config.count),
 guard('(SELECT count(*) FROM stock_usages WHERE document_id=?)=?',inventory.id,config.count),
 guard('NOT EXISTS(SELECT 1 FROM receipt_mutation_locks WHERE document_id=?)',d.id),
 guard('NOT EXISTS(SELECT 1 FROM stock_usages WHERE document_id=? AND (open_quantity_milli<>quantity_milli OR parent_usage_id IS NOT NULL))',inventory.id),
 guard("NOT EXISTS(SELECT 1 FROM document_draft_lines other JOIN document_drafts od ON od.id=other.document_id JOIN stock_usages u ON u.id=json_extract(other.line_json,'$.usage_id') WHERE u.document_id=? AND other.document_id<>?)",inventory.id,d.id),
 guard('NOT EXISTS(SELECT 1 FROM stock_usages child JOIN stock_usages parent ON parent.id=child.parent_usage_id WHERE parent.document_id=?)',inventory.id),
 guard('NOT EXISTS(SELECT 1 FROM equipment_operations e JOIN stock_usages u ON u.id=e.from_usage_id OR u.id=e.to_usage_id WHERE u.document_id=?)',inventory.id),
 guard('NOT EXISTS(SELECT 1 FROM stock_cost_dependencies c JOIN inventory_document_lines l ON l.id=c.source_line_id WHERE l.document_id=?)',inventory.id),
 guard("NOT EXISTS(SELECT 1 FROM json_each(?) e LEFT JOIN document_draft_lines l ON l.id=json_extract(e.value,'$.id') WHERE l.id IS NULL OR l.document_id<>? OR l.line_json<>json_extract(e.value,'$.line_json'))",JSON.stringify(dl),d.id),
 guard("NOT EXISTS(SELECT 1 FROM json_each(?) e LEFT JOIN stock_usages u ON u.id=json_extract(e.value,'$.id') WHERE u.id IS NULL OR u.root_line_id<>json_extract(e.value,'$.root_line_id') OR u.target_type<>json_extract(e.value,'$.target_type') OR u.target_id<>json_extract(e.value,'$.target_id') OR u.version<>json_extract(e.value,'$.version'))",JSON.stringify(usages)),
 guard(invariants.map(i=>`(SELECT value FROM (${i.sql}))=?`).join(' AND '),...invariants.map(i=>i.value))
 ];
 // The existing metadata/receive lock permits the narrowly guarded snapshot update.
 // Period, lifecycle, version and complete financial snapshots are checked explicitly above.
 // No guard trigger is disabled or altered, and no stock mutation/reposting runs.
 const changes=[command("INSERT INTO receipt_mutation_locks(document_id,expected_version,actor_id,mode) VALUES (?,?,?,'receive')",d.id,d.version,actor.id),
 command("UPDATE document_draft_lines SET line_json=(SELECT json_extract(e.value,'$.line_json') FROM json_each(?) e WHERE json_extract(e.value,'$.id')=document_draft_lines.id) WHERE document_id=?",JSON.stringify(newLines),d.id),
 command('UPDATE inventory_document_lines SET vehicle_id=?,vehicle_plate_snapshot=?,vehicle_odo_km=NULL WHERE document_id=?',target.id,newLabel,inventory.id),
 command("UPDATE stock_usages SET target_type='vehicle',target_id=?,odo_milli=NULL,version=version+1 WHERE document_id=?",target.id,inventory.id),
 command("UPDATE document_drafts SET header_json=?,labels_json=?,search_text=search_text||?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND version=?",JSON.stringify(newHeader),JSON.stringify(newLabels),' '+(config.targetPlate+' rơ moóc').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),d.id,d.version),
 command('INSERT INTO document_draft_events(id,document_id,actor_id,action,reason,before_json,after_json,request_id) VALUES (?,?,?,?,?,?,?,?)',randomUUID(),d.id,actor.id,'correct_installation_target',reason,JSON.stringify(before),JSON.stringify(after),operationId),
 command('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,reason,request_id) VALUES (?,?,?,?,?,?,?,?,?)',randomUUID(),actor.id,'document.correct_installation_target','document_drafts',d.id,JSON.stringify({target_id:config.oldId,plate:config.oldPlate,count:config.count}),JSON.stringify({target_id:target.id,plate:config.targetPlate,count:config.count,odo:'unknown; removed inherited tractor ODO'}),reason,operationId),
 command('DELETE FROM receipt_mutation_locks WHERE document_id=? AND expected_version=?',d.id,d.version)];
 const post=[guard(invariants.map(i=>`(SELECT value FROM (${i.sql}))=?`).join(' AND '),...invariants.map(i=>i.value)),guard('NOT EXISTS(SELECT 1 FROM receipt_mutation_locks WHERE document_id=?)',d.id),guard('NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check)'),guard('(SELECT version FROM document_drafts WHERE id=?)=?',d.id,d.version+1),guard("(SELECT count(*) FROM stock_usages WHERE document_id=? AND target_type='vehicle' AND target_id=? AND odo_milli IS NULL)=?",inventory.id,target.id,config.count)];
 return {config,d,actor,before,after,invariants,operationId,pre,changes,post,commands:[...pre,...changes,...post]};
}
function verifyLocal(db,plan){
 for(const i of plan.invariants)assert.equal(one(db,i.sql).value,i.value,i.table);
 assert.equal(one(db,'SELECT version FROM document_drafts WHERE id=?',[plan.d.id]).version,2);
 assert.equal(one(db,"SELECT count(*) n FROM stock_usages WHERE document_id=? AND target_id=? AND odo_milli IS NULL",[plan.d.posted_inventory_id,config.targetId]).n,12);
 assert.equal(one(db,'SELECT count(*) n FROM receipt_mutation_locks').n,0);
 assert.equal(one(db,'SELECT count(*) n FROM document_draft_events WHERE request_id=?',[plan.operationId]).n,1);
 assert.equal(one(db,'SELECT count(*) n FROM audit_events WHERE request_id=?',[plan.operationId]).n,1);
}
const db=makeDb(),plan=build(db);localBatch(db,plan.commands);verifyLocal(db,plan);
assert.throws(()=>localBatch(db,plan.commands));verifyLocal(db,plan);db.close();
const dependent=makeDb();dependent.prepare('UPDATE stock_usages SET open_quantity_milli=0 WHERE id=?').run(plan.before.usage_targets[0].id);assert.throws(()=>localBatch(dependent,plan.commands));assert.equal(one(dependent,'SELECT version FROM document_drafts WHERE id=?',[plan.d.id]).version,1);dependent.close();
const bad=makeDb();assert.throws(()=>localBatch(bad,[...plan.pre,...plan.changes,command('UPDATE stock_balances SET version=version+1'),...plan.post]));assert.equal(one(bad,'SELECT version FROM document_drafts WHERE id=?',[plan.d.id]).version,1);assert.equal(one(bad,'SELECT count(*) n FROM receipt_mutation_locks').n,0);bad.close();
writeFileSync(resolve(root,'artifacts/issue-target-correction-plan.json'),JSON.stringify({operationId:plan.operationId,config,commands:plan.commands},null,2));
console.log(JSON.stringify({local_checks:'passed',normal_correction:true,replay_blocked:true,dependent_usage_blocked:true,financial_change_rolls_back:true,protected_tables:plan.invariants.length,statements:plan.commands.length,largest_snapshot_bytes:Math.max(...plan.invariants.map(i=>i.value.length)),from:config.oldPlate,to:config.targetPlate,lines:12,remove_inherited_odo:true}));
if(!process.argv.includes('--apply')){console.log('Dry run only; production has not been changed.');process.exit(0)}
const {getPlatformProxy}=await import('../../worker/node_modules/wrangler/wrangler-dist/cli.js');
const proxy=await getPlatformProxy({configPath:resolve(root,'worker/wrangler.jsonc'),persist:false,remoteBindings:true,envFiles:[]});
try{
 const remote=proxy.env.tnc_vattu;
 await remote.batch(plan.commands.map(c=>remote.prepare(c.sql).bind(...c.args)));
 const checks=[];for(const i of plan.invariants){const r=await remote.prepare(i.sql).first();assert.equal(r.value,i.value,i.table);checks.push({table:i.table,rows:i.rows,sha256:hash(i.value),unchanged:true})}
 const usages=(await remote.prepare('SELECT target_type,target_id,odo_milli,version FROM stock_usages WHERE document_id=?').bind(plan.d.posted_inventory_id).all()).results;assert.equal(usages.length,12);assert.ok(usages.every(u=>u.target_id===config.targetId&&u.odo_milli===null));
 const {handleStockLedger}=await import(new URL('../../worker/src/stockLedger.ts',import.meta.url).href);
 const env={DB:remote,ACCESS_TEAM_DOMAIN:'',ACCESS_AUD:''},user={id:plan.actor.id,role:'admin',is_active:1};
 const response=await handleStockLedger(new Request('https://local.invalid/api/stock-ledger?from=2026-10-01&to=2026-10-31&kind=issue&q='+encodeURIComponent(config.code)),env,user);const ledger=await response.json();assert.equal(response.status,200);assert.equal(ledger.data.length,1);assert.equal(ledger.data[0].target,config.targetPlate+' · Rơ moóc');assert.equal(ledger.data[0].readings,'');assert.equal(ledger.data[0].out_milli,12000);
 const result={operation_id:plan.operationId,document:config.code,old_target:config.oldPlate,new_target:config.targetPlate,draft_version_before:1,draft_version_after:2,lines_corrected:12,usages_corrected:12,inherited_tractor_odo_removed:true,financial_checks:checks,ledger:{target:ledger.data[0].target,quantity_milli:ledger.data[0].out_milli,readings:ledger.data[0].readings},completed_at:new Date().toISOString(),backup:backup.split(/[\\/]/).at(-1)};
 writeFileSync(resolve(root,'artifacts/issue-target-correction-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({applied:true,operation_id:plan.operationId,document:config.code,target:ledger.data[0].target,quantity_milli:12000,protected_tables_unchanged:checks.length}));
}finally{await proxy.dispose()}
