import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
let checks = 0;
function check(name, run) {
  run();
  checks++;
  console.log(`PASS ${name}`);
}
function reject(sql, pattern) {
  assert.throws(() => db.exec(sql), pattern);
}
try {
  check('migration creates 12 core tables on an empty database', () => {
    db.exec(readFileSync(new URL('../migrations/0001_inventory_core.sql', import.meta.url), 'utf8'));
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n, 12);
  });
  db.exec(`
    INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES ('u','identity-u','u@example.invalid','Test','admin');
    INSERT INTO warehouses(id,code,name,kind) VALUES ('w','W1','Test warehouse','parts');
    INSERT INTO parts(id,sku,name,category,unit,applicable_for) VALUES ('p','SKU1','Test part','filters','Cái','both');
    INSERT INTO parts(id,sku,name,category,unit,applicable_for) VALUES ('p2','SKU2','Other part','filters','Cái','both');
    INSERT INTO inventory_documents(id,code,type,business_date,created_by,idempotency_key,request_hash)
      VALUES ('d','PNK-001','IN','2026-10-20','u','request-1','hash-1');
    INSERT INTO inventory_document_lines(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,to_warehouse_id)
      VALUES ('l','d',1,'p','SKU1','Test part','Cái',2000,100000,200,'w');
    INSERT INTO stock_movements(id,document_line_id,part_id,warehouse_id,quantity_delta_milli,value_delta_vnd)
      VALUES ('m','l','p','w',2000,200);
  `);
  check('SKU is unique regardless of letter case', () => reject(
    "INSERT INTO parts(id,sku,name,category,unit,applicable_for) VALUES ('duplicate','sku1','Duplicate','filters','Cái','both')", /UNIQUE/));
  check('draft movements do not affect current stock', () => {
    assert.equal(db.prepare('SELECT count(*) AS n FROM current_stock').get().n, 0);
  });
  check('posted documents require posting identity and timestamp', () => reject(
    "UPDATE inventory_documents SET status='posted' WHERE id='d'", /CHECK/));
  check('posted movements produce the expected quantity and carrying value', () => {
    db.exec("UPDATE inventory_documents SET status='posted',posted_by='u',posted_at='2026-10-20T00:00:00Z' WHERE id='d'");
    const row = db.prepare('SELECT * FROM current_stock').get();
    assert.equal(row.quantity_milli, 2000);
    assert.equal(row.carrying_value_vnd, 200);
  });
  check('referenced parts cannot be hard deleted', () => reject("DELETE FROM parts WHERE id='p'", /FOREIGN KEY/));
  check('line quantity must be positive', () => reject("UPDATE inventory_document_lines SET quantity_milli=0 WHERE id='l'", /CHECK/));
  check('scaled quantities cannot silently store fractions', () => reject("UPDATE inventory_document_lines SET quantity_milli=1.5 WHERE id='l'", /CHECK/));
  check('movement must reference the same part as its source line', () => reject(
    "UPDATE stock_movements SET part_id='p2' WHERE id='m'", /FOREIGN KEY/));
  check('duplicate movement for one line and warehouse is rejected', () => reject(
    "INSERT INTO stock_movements VALUES ('m2','l','p','w',2000,200)", /UNIQUE/));
  check('idempotency key cannot be reused for another document', () => reject(
    "INSERT INTO inventory_documents(id,code,type,business_date,created_by,idempotency_key,request_hash) VALUES ('d2','PNK-002','IN','2026-10-20','u','request-1','hash-2')", /UNIQUE/));
  check('period lock requires an accountable user and timestamp', () => reject(
    "INSERT INTO accounting_periods(period,is_locked) VALUES ('2026-10',1)", /CHECK/));
  check('unknown vehicle cannot be attached to a line', () => reject(
    "UPDATE inventory_document_lines SET vehicle_id='missing' WHERE id='l'", /FOREIGN KEY/));
  check('same warehouse cannot be both source and destination', () => reject(
    "UPDATE inventory_document_lines SET from_warehouse_id='w' WHERE id='l'", /CHECK/));
  check('database has no dangling foreign keys', () => {
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  });
  console.log(`\n${checks} schema checks passed. D1 deployment and posting rules are not tested here.`);
} finally {
  db.close();
}
