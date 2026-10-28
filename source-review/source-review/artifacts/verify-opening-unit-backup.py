import sqlite3,json,hashlib
from pathlib import Path
sql=Path('artifacts/before-opening-units-20261027.sql').read_text(encoding='utf-8-sig')
db=sqlite3.connect(':memory:');db.executescript(sql);db.execute('PRAGMA foreign_keys=ON')
assert not db.execute('PRAGMA foreign_key_check').fetchall(),'Existing foreign key violations'
tables=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
def snapshot(table,columns):
 rows=db.execute('SELECT '+','.join('"'+c+'"' for c in columns)+' FROM "'+table+'"').fetchall()
 raw=json.dumps(sorted(rows,key=repr),ensure_ascii=False,default=lambda o:o.hex() if isinstance(o,bytes) else str(o),separators=(',',':'))
 return len(rows),hashlib.sha256(raw.encode()).hexdigest()
before={table:([r[1] for r in db.execute('PRAGMA table_info("'+table+'")')],None) for table in tables}
for table,(columns,_) in list(before.items()):before[table]=(columns,snapshot(table,columns))
objects=db.execute("SELECT type,name FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('index','view','trigger')").fetchall()
db.executescript('BEGIN;\n'+Path('migrations/0034_opening_management_units.sql').read_text(encoding='utf-8')+'\nCOMMIT;')
for table,(columns,expected) in before.items():assert snapshot(table,columns)==expected,'Changed existing rows in '+table
for kind,name in objects:assert db.execute('SELECT 1 FROM sqlite_master WHERE type=? AND name=?',(kind,name)).fetchone(),'Missing schema object '+name
assert not db.execute('PRAGMA foreign_key_check').fetchall(),'New foreign key violations'
print(json.dumps({'tables_verified':len(before),'existing_rows_preserved':sum(count for _,(count,_) in before.values()),'schema_objects_preserved':len(objects),'foreign_key_violations':0}))
Path('artifacts/opening-unit-backup-verification.json').write_text(json.dumps({'tables_verified':len(before),'rows_preserved':sum(count for _,(count,_) in before.values()),'objects_preserved':len(objects),'foreign_key_violations':0},indent=2),encoding='utf-8')
