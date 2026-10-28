import sqlite3,json,hashlib,re
from pathlib import Path
db=sqlite3.connect(':memory:');db.executescript(Path('artifacts/before-opening-edit-20261027.sql').read_text(encoding='utf-8-sig'));db.execute('PRAGMA foreign_keys=ON')
assert not db.execute('PRAGMA foreign_key_check').fetchall()
def snapshot(table):
 data=db.execute('SELECT * FROM "'+table+'"').fetchall();return len(data),hashlib.sha256(json.dumps(sorted(data,key=repr),ensure_ascii=False,default=str,separators=(',',':')).encode()).hexdigest()
tables=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")];before={t:snapshot(t) for t in tables};oldObjects=db.execute("SELECT type,name FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('trigger','index','view')").fetchall()
db.executescript('BEGIN;\n'+Path('migrations/0035_opening_edits.sql').read_text(encoding='utf-8')+'\nCOMMIT;')
for table,expected in before.items():assert snapshot(table)==expected,'Changed data: '+table
for kind,name in oldObjects:assert db.execute('SELECT 1 FROM sqlite_master WHERE type=? AND name=?',(kind,name)).fetchone(),'Missing schema object'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
predicate=re.search(r'return `([^`]+)`;',Path('worker/src/openingMutations.ts').read_text(encoding='utf-8')).group(1).replace('${alias}','d');guard=db.execute("SELECT sql FROM sqlite_master WHERE name='opening_mutation_dependencies'").fetchone()[0];assert predicate in guard,'Dependency guard drift'
result={'tables_verified':len(tables),'rows_unchanged':sum(v[0] for v in before.values()),'schema_objects_preserved':len(oldObjects),'foreign_key_violations':0,'dependency_guard_matches':True};Path('artifacts/opening-edit-backup-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
