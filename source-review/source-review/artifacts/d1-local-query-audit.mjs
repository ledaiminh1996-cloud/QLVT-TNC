import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:',{enableForeignKeyConstraints:false});
try {
 db.exec(fs.readFileSync('artifacts/before-issue-target-correction-20261028.sql','utf8'));
 const captured=[];class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async first(){return db.prepare(this.query).get(...this.args)??null}}
 const fake={prepare:q=>new Statement(q),batch:async statements=>{captured.push(...statements);return statements.map((_,i)=>({results:i===1?[{total:0}]:[]}))}};
 const {handleStockLedger}=await import(new URL('../worker/src/stockLedger.ts',import.meta.url).href);
 await handleStockLedger(new Request('https://read-only.invalid/api/stock-ledger?from=2026-10-01&to=2026-10-31&q=50H-110.99'),{DB:fake},{id:'local-audit',role:'admin'});
 const plan=stat=>db.prepare('EXPLAIN QUERY PLAN '+stat.query).all(...stat.args).map(r=>r.detail);
 fs.writeFileSync('artifacts/d1-captured-ledger-queries-20261028.json',JSON.stringify(captured));
 const queries=captured.map((s,i)=>({case:'ledger-search-'+i,plan:plan(s)}));
 const catalogSql="SELECT count(*) AS total FROM vehicles WHERE EXISTS(SELECT 1 FROM catalog_search s WHERE s.resource=? AND s.entity_id=vehicles.id AND s.normalized_text LIKE ? ESCAPE '\\')";
 queries.push({case:'vehicle-picker-search-count',plan:plan(new Statement(catalogSql,['vehicles','%50h%']))});
 const counts=Object.fromEntries(['parts','vehicles','catalog_search','stock_movements','inventory_document_lines','document_drafts','document_draft_serials'].map(t=>[t,db.prepare('SELECT count(*) n FROM '+t).get().n]));
 const report={source:'Local memory copy of existing backup; no production workload replay',counts,queries};fs.writeFileSync('artifacts/d1-local-query-plans-20261028.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({counts,plans:queries.map(q=>({case:q.case,scans:q.plan.filter(p=>/SCAN|CORRELATED|MATERIALIZE|AUTOMATIC|TEMP B-TREE/.test(p)).slice(0,26)}))},null,2));
} finally {db.close()}
