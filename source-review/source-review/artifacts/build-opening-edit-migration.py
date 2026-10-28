from pathlib import Path
import sqlite3,re
db=sqlite3.connect(':memory:')
for p in sorted(Path('migrations').glob('*.sql')):db.executescript(p.read_text(encoding='utf-8-sig'))
trigger=db.execute("SELECT sql FROM sqlite_master WHERE name='receipt_mutation_dependencies'").fetchone()[0]
isopening="EXISTS(SELECT 1 FROM document_drafts d WHERE d.id=NEW.document_id AND d.kind='opening' AND json_extract(d.header_json,'$.opening_mode')='in_use')"
trigger=trigger.replace("WHEN NEW.mode<>'receive' AND (","WHEN NEW.mode<>'receive' AND NOT ("+isopening+") AND (",1)
helper=Path('worker/src/openingMutations.ts').read_text(encoding='utf-8');predicate=re.search(r'return `([^`]+)`;',helper).group(1).replace('${alias}','d')
sql='''-- Atomic opening edits reuse the established mutation lock; warehouse receipts keep their original guard.
DROP TRIGGER receipt_mutation_dependencies;
'''+trigger+';\n'+f"CREATE TRIGGER opening_mutation_dependencies BEFORE INSERT ON receipt_mutation_locks WHEN {isopening} AND (SELECT {predicate} FROM document_drafts d WHERE d.id=NEW.document_id) BEGIN SELECT RAISE(ABORT,'OPENING_HAS_DEPENDENCIES'); END;\n"+f"CREATE TRIGGER opening_mutation_edit_only BEFORE INSERT ON receipt_mutation_locks WHEN {isopening} AND NEW.mode<>'edit' BEGIN SELECT RAISE(ABORT,'OPENING_EDIT_ONLY'); END;\n"
Path('migrations/0035_opening_edits.sql').write_text(sql,encoding='utf-8')
for f in ['worker/tests/api.test.mjs','worker/tests/runtime.test.mjs']:
 p=Path(f);s=p.read_text(encoding='utf-8').replace("'0034_opening_management_units.sql']","'0034_opening_management_units.sql', '0035_opening_edits.sql']");p.write_text(s,encoding='utf-8')
