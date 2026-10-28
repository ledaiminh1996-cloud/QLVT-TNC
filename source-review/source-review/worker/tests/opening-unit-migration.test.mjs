import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
test('opening unit migration preserves populated ledger references, triggers and stock while allowing only flagged opening roots without warehouse',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 try{
  const directory=new URL('../../migrations/',import.meta.url);
  for(const name of readdirSync(directory).filter(n=>/^\d+.*\.sql$/.test(n)&&n<'0034').sort())db.exec(readFileSync(new URL(name,directory),'utf8'));
  db.exec("INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES('u','u','u@example.invalid','Admin','admin');INSERT INTO warehouses(id,code,name,kind) VALUES('w','W','Warehouse','parts');INSERT INTO parts(id,sku,name,category,unit,applicable_for) VALUES('p','P','Part','tires','Cái','both');INSERT INTO inventory_documents(id,code,type,business_date,created_by,idempotency_key,request_hash) VALUES('d','D','IN','2026-10-01','u','key','hash');INSERT INTO inventory_document_lines(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,to_warehouse_id) VALUES('l','d',1,'p','P','Part','Cái',1000,50000,50,'w');INSERT INTO stock_lots(source_line_id,part_id,warehouse_id,stock_state,initial_quantity_milli,remaining_quantity_milli,original_value_vnd,available_at) VALUES('l','p','w','new',1000,1000,50,'2026-10-01T00:00');");
  const before=JSON.stringify(db.prepare('SELECT * FROM inventory_document_lines').all());
  const objects=db.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('trigger','view','index') AND sql IS NOT NULL AND lower(sql) LIKE '%inventory_document_lines%' ORDER BY name").all();
  db.exec('BEGIN');db.exec(readFileSync(new URL('0034_opening_management_units.sql',directory),'utf8'));assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.exec('COMMIT');
  const after=db.prepare('SELECT * FROM inventory_document_lines').all().map(({is_opening_usage,...row})=>row);assert.equal(JSON.stringify(after),before);
  assert.equal(db.prepare('SELECT remaining_quantity_milli FROM stock_lots').get().remaining_quantity_milli,1000);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  for(const object of objects)assert.ok(db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get(object.type,object.name),object.name);
  assert.throws(()=>db.exec("INSERT INTO inventory_document_lines(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,is_opening_usage) VALUES('fake','d',2,'p','P','Part','Cái',1000,0,0,1)"),/INVALID_OPENING_SCOPE/);
  db.exec("INSERT INTO inventory_documents(id,code,type,business_date,created_by,idempotency_key,request_hash) VALUES('o','O','OPENING','2026-10-01','u','opening','hash');INSERT INTO inventory_document_lines(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,is_opening_usage) VALUES('ol','o',1,'p','P','Part','Cái',1000,0,0,1)");
  assert.equal(db.prepare("SELECT from_warehouse_id FROM inventory_document_lines WHERE id='ol'").get().from_warehouse_id,null);
 }finally{db.close()}
});


