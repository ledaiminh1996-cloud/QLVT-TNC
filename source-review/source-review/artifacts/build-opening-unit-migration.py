from pathlib import Path
import sqlite3
root=Path('.')
db=sqlite3.connect(':memory:')
for p in sorted(root.glob('migrations/*.sql')):
 if p.name.startswith('0034'):break
 db.executescript(p.read_text(encoding='utf-8-sig'))
ddl=db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_document_lines'").fetchone()[0]
objects=db.execute("SELECT type,name,sql FROM sqlite_master WHERE type IN ('trigger','index','view') AND sql IS NOT NULL AND lower(sql) LIKE '%inventory_document_lines%'").fetchall()
columns=[r[1] for r in db.execute('PRAGMA table_info(inventory_document_lines)')]
new=ddl.replace('CREATE TABLE inventory_document_lines','CREATE TABLE inventory_document_lines_new',1).replace('  CHECK (from_warehouse_id IS NOT NULL OR to_warehouse_id IS NOT NULL),','  is_opening_usage INTEGER NOT NULL DEFAULT 0 CHECK(is_opening_usage IN (0,1)),\n  CHECK (from_warehouse_id IS NOT NULL OR to_warehouse_id IS NOT NULL OR is_opening_usage=1),')
sql='\n-- Allow mounted opening roots without manufacturing a warehouse association.\nPRAGMA defer_foreign_keys=ON;\n'
for kind,name,_ in objects:sql+='DROP '+kind.upper()+' "'+name+'";\n'
sql+=new+';\nINSERT INTO inventory_document_lines_new('+','.join(columns)+') SELECT '+','.join(columns)+' FROM inventory_document_lines;\nDROP TABLE inventory_document_lines;\nALTER TABLE inventory_document_lines_new RENAME TO inventory_document_lines;\n'
for _,_,source in objects:sql+=source+';\n'
sql+='''CREATE TRIGGER opening_line_scope BEFORE INSERT ON inventory_document_lines WHEN NEW.is_opening_usage=1 AND (NEW.from_warehouse_id IS NOT NULL OR NEW.to_warehouse_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM inventory_documents d WHERE d.id=NEW.document_id AND d.type='OPENING')) BEGIN SELECT RAISE(ABORT,'INVALID_OPENING_SCOPE'); END;
'''
p=Path('migrations/0034_opening_management_units.sql');p.write_text(p.read_text(encoding='utf-8')+sql,encoding='utf-8')
p=Path('worker/src/inventoryPosting.ts');s=p.read_text(encoding='utf-8').replace('vehicle_odo_km,mount_position) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)','vehicle_odo_km,mount_position,is_opening_usage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').replace('      line.to_position || null,\n    );','      line.to_position || null,\n      this.draft.kind==="opening"&&this.draft.opening_mode==="in_use"?1:0,\n    );');p.write_text(s,encoding='utf-8')
