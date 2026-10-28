import sqlite3,json,hashlib
from pathlib import Path
c=sqlite3.connect(':memory:');c.executescript(Path('artifacts/before-grouped-ledger-20261027.sql').read_text(encoding='utf-8'));c.execute('PRAGMA foreign_keys=ON')
tables=[r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
def snap():
 result={}
 for name in tables:
  rows=c.execute('SELECT * FROM "'+name+'"').fetchall()
  payload=json.dumps(sorted([repr(r) for r in rows]),ensure_ascii=False).encode()
  result[name]=(len(rows),hashlib.sha256(payload).hexdigest())
 return result
before=snap();objects=set(c.execute("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'"))
c.executescript('BEGIN;'+Path('migrations/0036_stock_book_months.sql').read_text(encoding='utf-8')+'COMMIT;')
assert snap()==before
assert objects.issubset(set(c.execute("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")))
expected="SELECT substr(day,1,7),part_id,warehouse_id,stock_state,sum(quantity_delta_milli),count(*) FROM stock_book_flow WHERE status='posted' GROUP BY substr(day,1,7),part_id,warehouse_id,stock_state"
actual="SELECT period,part_id,warehouse_id,stock_state,quantity_milli,movement_count FROM stock_book_months"
def check():
 assert not c.execute(expected+' EXCEPT '+actual).fetchall()
 assert not c.execute(actual+' EXCEPT '+expected).fetchall()
 assert not c.execute('PRAGMA foreign_key_check').fetchall()
check()
record=c.execute("SELECT id FROM inventory_documents WHERE status='posted' AND EXISTS(SELECT 1 FROM inventory_document_lines l JOIN stock_movements m ON m.document_line_id=l.id WHERE l.document_id=inventory_documents.id) LIMIT 1").fetchone()
if record:
 c.execute('SAVEPOINT trial');c.execute("UPDATE inventory_documents SET status='cancelled',posted_by=NULL,posted_at=NULL WHERE id=?",record);check();c.execute('ROLLBACK TO trial');c.execute('RELEASE trial')
 c.execute('SAVEPOINT trial');c.execute("UPDATE inventory_documents SET business_date='2026-11-01' WHERE id=?",record);check();c.execute('ROLLBACK TO trial');c.execute('RELEASE trial')
check();assert snap()==before
ledger_q="SELECT part_id,warehouse_id,stock_state,sum(quantity_milli) q FROM stock_book_months GROUP BY part_id,warehouse_id,stock_state HAVING q<>0"
bucket_q="SELECT part_id,warehouse_id,stock_state,quantity_milli FROM stock_buckets WHERE quantity_milli<>0"
assert not c.execute(ledger_q+' EXCEPT '+bucket_q).fetchall()
assert not c.execute(bucket_q+' EXCEPT '+ledger_q).fetchall()
report={'tables_unchanged':len(tables),'rows_unchanged':sum(v[0] for v in before.values()),'schema_objects_preserved':len(objects),'monthly_rows':c.execute('SELECT count(*) FROM stock_book_months').fetchone()[0],'monthly_equals_posted_ledger':True,'matches_current_stock_buckets':True,'foreign_key_violations':0,'status_and_date_changes_verified':bool(record)}
Path('artifacts/grouped-ledger-backup-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
