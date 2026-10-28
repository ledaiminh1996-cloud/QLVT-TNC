from pathlib import Path
import re,json
seed=re.search(r'db.exec\("(INSERT INTO app_users.*?)"\);',Path('worker/tests/opening-unit-migration.test.mjs').read_text(encoding='utf-8')).group(1)
s='''import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('D1 runtime upgrades populated mounted-opening schema without changing ledger, lots or references',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default {fetch(){return new Response('ok')}}",compatibilityDate:'2026-10-20',d1Databases:{DB:'opening-unit-upgrade'}}));
 try{const db=await mf.getD1Database('DB'),dir=new URL('../../migrations/',import.meta.url);
 const run=async(text)=>{const source=text.replace(/--[^\\n]*/g,'').replace(/CREATE TRIGGER[\\s\\S]*?END;/g,block=>block.slice(0,-1).replaceAll(';','__SEMICOLON__')+';');await db.batch(source.split(';').map(s=>s.replaceAll('__SEMICOLON__',';').trim()).filter(Boolean).map(s=>db.prepare(s)));};
 for(const name of readdirSync(dir).filter(n=>/^\\d+.*\\.sql$/.test(n)&&n<'0034').sort())await run(readFileSync(new URL(name,dir),'utf8'));
 await run(SEED);
 const before=(await db.prepare('SELECT * FROM inventory_document_lines').all()).results;
 await run(readFileSync(new URL('0034_opening_management_units.sql',dir),'utf8'));
 const after=(await db.prepare('SELECT * FROM inventory_document_lines').all()).results.map(({is_opening_usage,...row})=>row);assert.deepEqual(after,before);assert.equal((await db.prepare('SELECT remaining_quantity_milli FROM stock_lots').first()).remaining_quantity_milli,1000);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose()}
});
'''.replace('SEED',json.dumps(seed,ensure_ascii=False))
Path('worker/tests/opening-unit-runtime.test.mjs').write_text(s,encoding='utf-8')
