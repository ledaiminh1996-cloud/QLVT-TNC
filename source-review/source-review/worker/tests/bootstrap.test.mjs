import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

test('bootstrap SQL safely quotes identity, creates only the first admin and audits once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tnc-bootstrap-test-'));
  const path = join(dir, 'bootstrap.sql');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    db.exec(readFileSync(new URL('../../migrations/0001_inventory_core.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0002_catalog_versions.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0003_directory_details.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0004_part_numbering.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0005_part_price_min_stock.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0006_part_hours_min_stock_unit.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0007_fuel_tanks.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0008_personnel_tree.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0009_staff_rank.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../../migrations/0010_supplier_rules.sql', import.meta.url), 'utf8'));
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/bootstrap-admin.mjs', import.meta.url)),
      '--email', 'admin@example.invalid', '--subject', "subject-'safe", '--name', "O'Neil", '--out', path]);
    const sql = readFileSync(path, 'utf8');
    db.exec(sql);
    assert.equal(db.prepare('SELECT display_name FROM app_users').get().display_name, "O'Neil");
    assert.equal(db.prepare('SELECT auth_subject FROM app_users').get().auth_subject, "subject-'safe");
    assert.equal(db.prepare('SELECT count(*) AS n FROM audit_events').get().n, 1);
    db.exec(sql);
    assert.equal(db.prepare('SELECT count(*) AS n FROM app_users').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM audit_events').get().n, 1);
  } finally {
    db.close();
    try { unlinkSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    rmdirSync(dir);
  }
});
