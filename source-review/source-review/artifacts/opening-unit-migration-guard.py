from pathlib import Path
p=Path('migrations/0034_opening_management_units.sql');s=p.read_text(encoding='utf-8');s+='''-- Verify the rebuilt graph before clearing deferred DROP/recreate counters.
CREATE TABLE opening_unit_migration_guard(valid INTEGER NOT NULL CHECK(valid=1));
INSERT INTO opening_unit_migration_guard SELECT CASE WHEN count(*)=0 THEN 1 ELSE 0 END FROM pragma_foreign_key_check;
DROP TABLE opening_unit_migration_guard;
PRAGMA defer_foreign_keys=OFF;
''';p.write_text(s,encoding='utf-8')
p=Path('tests/documents.test.tsx');s=p.read_text(encoding='utf-8');a=s.index('assert.ok(screen.getByText("Ghi nhận vật tư đang sử dụng tại ngày đầu kỳ.');b=s.index('\n});',a);checks=s[a:b];s=s[:a]+s[b:];needle='fireEvent.click(screen.getByRole("button",{name:"Lưu",exact:true}));await waitFor(()=>assert.ok(saved));';s=s.replace(needle,checks+needle,1);p.write_text(s,encoding='utf-8')
p=Path('worker/src/openingManagement.ts');s=p.read_text(encoding='utf-8').replace(' if(direct)return',' if(target.managing_unit_id&&!direct)return {unit_id:null,unit_label:"Chưa xác định",source:"inactive_unit"};\n if(direct)return');p.write_text(s,encoding='utf-8')
