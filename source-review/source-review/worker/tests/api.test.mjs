import {hashPassword,tokenHash,randomToken} from "../src/passwords.ts";
import {emptyDraft} from '../../shared/documents.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { createHandler } from '../src/index.ts';
import { createAccessVerifier } from '../src/auth.ts';

const issuer = 'https://tnc-test.cloudflareaccess.com';
const audience = 'tnc-test-audience';
const keys = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const verify = createAccessVerifier(() => createLocalJWKSet({ keys: [jwk] }));
const handler = createHandler(verify);

async function token(role = 'admin', options = {}) {
  return new SignJWT({ email: `${role}@example.invalid`, ...options.claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(options.subject ?? `subject-${role}`)
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? audience)
    .setIssuedAt()
    .setExpirationTime(options.expiration ?? '5m')
    .sign(options.privateKey ?? keys.privateKey);
}

// D1 API adapter backed by SQLite. Batch runs atomically on one connection.
// This suite tests application SQL, not the Cloudflare runtime itself.
function rig() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const name of ['0001_inventory_core.sql', '0002_catalog_versions.sql', '0003_directory_details.sql', '0004_part_numbering.sql', '0005_part_price_min_stock.sql', '0006_part_hours_min_stock_unit.sql', '0007_fuel_tanks.sql', '0008_personnel_tree.sql', '0009_staff_rank.sql', '0010_supplier_rules.sql', '0011_supplier_optional_province.sql', '0012_equipment_catalog.sql', '0013_equipment_import_framework.sql', '0014_pairing_sets.sql', '0015_unicode_catalog_search.sql', '0016_stopped_condition_label.sql', '0017_pairing_route_version.sql', '0018_pairing_review_workflow.sql', '0019_catalog_history_index.sql', '0020_document_drafts.sql', '0021_document_validation.sql', '0022_document_serials.sql', '0023_receipt_posting.sql', '0024_inventory_operations.sql', '0025_receipt_exact_pricing.sql', '0026_vat_catalog.sql', '0027_mount_positions.sql', '0028_serial_cost_snapshot.sql', '0029_mount_position_usage.sql', '0030_pending_inventory_values.sql', '0031_opening_in_use.sql', '0032_user_access.sql', '0033_native_auth.sql', '0034_opening_management_units.sql', '0035_opening_edits.sql', '0036_stock_book_months.sql']) {
    sql.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));
  }
  for (const role of ['admin', 'accountant', 'warehouse', 'viewer']) {
    sql.prepare('INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES (?,?,?,?,?)')
      .run(role, `subject-${role}`, `${role}@example.invalid`, role, role);
  }
  class Statement {
    constructor(query, args = []) { this.query = query; this.args = args; }
    bind(...args) { return new Statement(this.query, args); }
    async first() { return sql.prepare(this.query).get(...this.args) ?? null; }
    async all() { return this.execute(); }
    async run() { return this.execute(); }
    execute() {
      const stmt = sql.prepare(this.query);
      if (stmt.columns().length) return { results: stmt.all(...this.args), success: true, meta: { changes: 0 } };
      const result = stmt.run(...this.args);
      return { results: [], success: true, meta: { changes: Number(result.changes) } };
    }
  }
  const db = {
    prepare: (query) => new Statement(query),
    async batch(statements) {
      sql.exec('BEGIN');
      try {
        const result = statements.map(stmt => stmt.execute());
        sql.exec('COMMIT');
        return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const env = { DB: db, ACCESS_TEAM_DOMAIN: 'tnc-test.cloudflareaccess.com', ACCESS_AUD: audience };
  async function request(path, { method = 'GET', body, role = 'admin', jwt, headers = {}, raw } = {}) {
    const authorization = role === null ? {} : { Authorization: `Bearer ${jwt ?? await token(role)}` };
    const req = new Request(`https://inventory.example.invalid${path}`, {
      method, headers: { ...authorization, ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const response = await handler(req, env);
    const payload = await response.json();
    return { status: response.status, payload, response };
  }
  return { sql, env, request, close: () => sql.close() };
}

const part = { sku: 'vt-001', name: 'Lọc dầu', category: 'filters', unit: 'Cái', applicable_for: 'both' };
function scenario(name, run) {
  test(name, async () => {
    const context = rig();
    try { await run(context); } finally { context.close(); }
  });
}

scenario('health checks database without leaking identity or configuration', async ({ request }) => {
  const result = await request('/api/health', { role: null });
  assert.equal(result.status, 200);
  assert.equal(result.payload.data.status, 'ok');
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
});

scenario('unsigned email headers cannot authenticate', async ({ request }) => {
  const result = await request('/api/parts', { role: null, headers: { 'Cf-Access-Authenticated-User-Email': 'admin@example.invalid' } });
  assert.equal(result.status, 401);
});

scenario('valid signed Access identity maps to an active D1 user', async ({ request }) => {
  const result = await request('/api/auth/me');
  assert.equal(result.status, 200);
  assert.equal(result.payload.data.user.role, 'admin');
  assert.equal(result.payload.data.access_granted, true);
});

scenario('unknown identities can see only their own onboarding identity', async ({ request }) => {
  const jwt = await token('new-user');
  const me = await request('/api/auth/me', { jwt });
  assert.equal(me.payload.data.access_granted, false);
  assert.equal(me.payload.data.user, null);
  assert.equal((await request('/api/parts', { jwt })).status, 403);
});

scenario('expired, wrong-audience, wrong-issuer and forged tokens are rejected', async ({ request }) => {
  const forged = await generateKeyPair('RS256');
  for (const options of [{ expiration: Math.floor(Date.now() / 1000) - 60 }, { audience: 'other-app' }, { issuer: 'https://evil.invalid' }, { privateKey: forged.privateKey }, { claims: { email: 123 } }]) {
    const result = await request('/api/parts', { jwt: await token('admin', options) });
    assert.equal(result.status, 401);
  }
});

scenario('authentication fails closed when Access settings are missing', async ({ request, env }) => {
  env.ACCESS_AUD = '';
  assert.equal((await request('/api/parts')).status, 503);
});

scenario('inactive user is denied even with a valid JWT', async ({ request, sql }) => {
  sql.exec("UPDATE app_users SET is_active=0 WHERE id='viewer'");
  assert.equal((await request('/api/parts', { role: 'viewer' })).status, 403);
});

scenario('catalog create persists normalized values and an audit entry atomically', async ({ request, sql }) => {
  const result = await request('/api/parts', { method: 'POST', body: part });
  assert.equal(result.status, 201);
  assert.equal(result.payload.data.sku, 'VT-001');
  assert.equal(result.payload.data.version, 1);
  const audit = sql.prepare('SELECT * FROM audit_events').get();
  assert.equal(audit.actor_id, 'admin');
  assert.equal(audit.action, 'catalog.create');
  assert.equal(JSON.parse(audit.after_json).id, result.payload.data.id);
});

scenario('viewer and warehouse can read but cannot mutate catalogs', async ({ request }) => {
  for (const role of ['viewer', 'warehouse']) {
    assert.equal((await request('/api/parts', { role })).status, 200);
    assert.equal((await request('/api/parts', { method: 'POST', body: part, role })).status, 403);
    assert.equal((await request('/api/users', { role })).status, 403);
  }
  assert.equal((await request('/api/parts', { method: 'POST', body: part, role: 'accountant' })).status, 201);
});

scenario('duplicate SKU is a conflict with no extra audit or data', async ({ request, sql }) => {
  assert.equal((await request('/api/parts', { method: 'POST', body: part })).status, 201);
  const duplicate = await request('/api/parts', { method: 'POST', body: { ...part, sku: 'VT-001' } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.payload.error.code, 'DUPLICATE');
  assert.equal(sql.prepare('SELECT count(*) AS n FROM audit_events').get().n, 1);
});

scenario('audit failure rolls back its catalog mutation', async ({ request, sql }) => {
  sql.exec("CREATE TRIGGER test_reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
  assert.equal((await request('/api/parts', { method: 'POST', body: part })).status, 500);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM parts').get().n, 0);
});

scenario('PATCH requires the current version and rejects stale edits', async ({ request, sql }) => {
  const created = await request('/api/parts', { method: 'POST', body: part });
  const id = created.payload.data.id;
  assert.equal((await request(`/api/parts/${id}`, { method: 'PATCH', body: { name: 'New' } })).status, 400);
  const changed = await request(`/api/parts/${id}`, { method: 'PATCH', body: { name: 'New', version: 1 } });
  assert.equal(changed.status, 200);
  assert.equal(changed.payload.data.version, 2);
  assert.equal((await request(`/api/parts/${id}`, { method: 'PATCH', body: { name: 'Stale', version: 1 } })).status, 409);
  assert.equal(sql.prepare('SELECT name FROM parts WHERE id=?').get(id).name, 'New');
  assert.equal(sql.prepare('SELECT count(*) AS n FROM audit_events').get().n, 2);
});

scenario('a concurrent change between read and write is not overwritten or audited', async ({ request, env, sql }) => {
  const created = await request('/api/parts', { method: 'POST', body: part });
  const id = created.payload.data.id;
  const batch = env.DB.batch;
  env.DB.batch = async statements => {
    sql.prepare("UPDATE parts SET name='Concurrent',version=version+1 WHERE id=?").run(id);
    return batch(statements);
  };
  const result = await request(`/api/parts/${id}`, { method: 'PATCH', body: { name: 'Overwrite', version: 1 } });
  assert.equal(result.status, 409);
  assert.equal(sql.prepare('SELECT name FROM parts WHERE id=?').get(id).name, 'Concurrent');
  assert.equal(sql.prepare('SELECT count(*) AS n FROM audit_events').get().n, 1);
});

scenario('unknown fields, invalid enums and floating point integer fields are rejected', async ({ request }) => {
  for (const body of [{ ...part, currentStock: 100 }, { ...part, category: 'unknown' }, { ...part, lifespan_km_limit: 1.5 }, { ...part, sku: '   ' }, { ...part, is_active: true }]) {
    assert.equal((await request('/api/parts', { method: 'POST', body })).status, 400);
  }
});

scenario('warehouse/staff/supplier/vehicle endpoints validate real relationships', async ({ request }) => {
  assert.equal((await request('/api/warehouses', { method: 'POST', body: { code: 'kho-1', name: 'Kho 1', kind: 'parts' } })).status, 201);
  assert.equal((await request('/api/suppliers', { method: 'POST', body: { code: 'NCC00001', name: 'NCC 1', province_name:'Hà Nội' } })).status, 201);
  const staff = await request('/api/staff', { method: 'POST', body: { code: 'lx-1', name: 'Lái xe 1', staff_type: 'driver' } });
  const vehicle = { plate_number: '50h-123.45', type: 'tractor', current_odo_km: 1000, assigned_driver_id: staff.payload.data.id };
  const created = await request('/api/vehicles', { method: 'POST', body: vehicle });
  assert.equal(created.status, 201);
  assert.equal(created.payload.data.plate_number, '50H-123.45');
  assert.equal((await request(`/api/vehicles/${created.payload.data.id}`, { method: 'PATCH', body: { current_odo_km: 999, version: 1 } })).status, 409);
  assert.equal((await request('/api/vehicles', { method: 'POST', body: { ...vehicle, plate_number: '50H-222.22', assigned_driver_id: 'missing' } })).status, 409);
  assert.equal((await request(`/api/staff/${staff.payload.data.id}`, { method: 'PATCH', body: { is_active: 0, version: 1 } })).status, 200);
  assert.equal((await request('/api/vehicles', { method: 'POST', body: { ...vehicle, plate_number: '50H-333.33' } })).status, 409);
});

scenario('search is parameterized and LIKE wildcards are literal', async ({ request }) => {
  await request('/api/parts', { method: 'POST', body: part });
  for (const q of ["' OR 1=1 --", '%', '_']) {
    const result = await request(`/api/parts?q=${encodeURIComponent(q)}`);
    assert.equal(result.status, 200);
    assert.equal(result.payload.pagination.total, 0);
  }
  assert.equal((await request('/api/parts?q=VT-001')).payload.pagination.total, 1);
  assert.equal((await request('/api/parts?page_size=101')).status, 400);
});

scenario('deactivate instead of delete; filter and pagination stay consistent', async ({ request }) => {
  const created = await request('/api/parts', { method: 'POST', body: part });
  const id = created.payload.data.id;
  assert.equal((await request(`/api/parts/${id}`, { method: 'DELETE' })).status, 405);
  assert.equal((await request(`/api/parts/${id}`, { method: 'PATCH', body: { is_active: 0, version: 1 } })).status, 200);
  assert.equal((await request('/api/parts?is_active=1')).payload.pagination.total, 0);
  assert.equal((await request('/api/parts?is_active=0&page=2&page_size=1')).payload.data.length, 0);
});

scenario('user provisioning is admin-only and does not allow self privilege removal', async ({ request }) => {
  const body = { auth_subject: 'subject-new', email: 'new@example.invalid', display_name: 'New', role: 'viewer' };
  assert.equal((await request('/api/users', { method: 'POST', body, role: 'accountant' })).status, 403);
  assert.equal((await request('/api/users', { method: 'POST', body })).status, 201);
  assert.equal((await request('/api/users/admin', { method: 'PATCH', body: { role: 'viewer', version: 1 } })).status, 409);
  assert.equal((await request('/api/users/admin', { method: 'PATCH', body: { is_active: 0, version: 1 } })).status, 409);
});

scenario('cross-origin mutations, malformed JSON and oversized bodies are rejected', async ({ request }) => {
  assert.equal((await request('/api/parts', { method: 'POST', body: part, headers: { Origin: 'https://evil.invalid' } })).status, 403);
  assert.equal((await request('/api/parts', { method: 'POST', body: part, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await request('/api/parts', { method: 'POST', raw: '{' })).status, 400);
  assert.equal((await request('/api/parts', { method: 'POST', raw: '[]' })).status, 400);
  assert.equal((await request('/api/parts', { method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/parts', { method: 'POST', body: { ...part, notes: 'x'.repeat(33000) } })).status, 413);
});

scenario('unknown API routes never serve the SPA and errors do not expose SQL', async ({ request }) => {
  const missing = await request('/api/transactions');
  assert.equal(missing.status, 404);
  assert.ok(missing.payload.error.request_id);
  const duplicate = await request('/api/users', { method: 'POST', body: { auth_subject: 'subject-admin', email: 'other@example.invalid', display_name: 'Dup', role: 'viewer' } });
  assert.equal(duplicate.status, 409);
  assert.ok(!JSON.stringify(duplicate.payload).includes('constraint'));
});

scenario('original directory details survive creation and updates', async ({ request }) => {
  const created = await request('/api/staff', { method: 'POST', body: { code: 'NS-ORIGINAL', name: 'Lái xe', vehicle_plate: '50H-123.45', trailer_plate: '51R-123.45', job_title: 'Lái xe đầu kéo' } });
  assert.equal(created.status, 201);
  const id = created.payload.data.id;
  assert.equal((await request(`/api/staff/${id}`)).payload.data.trailer_plate, '51R-123.45');
  assert.equal((await request(`/api/staff/${id}`, { method: 'PATCH', body: { vehicle_plate: '50H-999.99', version: 1 } })).status, 200);
  assert.equal((await request(`/api/staff/${id}`)).payload.data.vehicle_plate, '50H-999.99');
  const supplier = await request('/api/suppliers', { method: 'POST', body: { code: 'NCC00001', name: 'NCC', province_name:'Hà Nội', supplied_items: 'Lốp, lọc và dầu' } });
  assert.equal((await request(`/api/suppliers/${supplier.payload.data.id}`)).payload.data.supplied_items, 'Lốp, lọc và dầu');
  const warehouse = await request('/api/warehouses', { method: 'POST', body: { code: 'KHO-O', name: 'Kho', kind: 'parts', type_label: 'Kho phụ tùng nặng' } });
  assert.equal((await request(`/api/warehouses/${warehouse.payload.data.id}`)).payload.data.type_label, 'Kho phụ tùng nặng');
});

async function codes(request) {
  assert.equal((await request('/api/part-objects', { method: 'POST', body: { code: 'IN', name: 'Đối tượng IN' } })).status, 201);
  for (const code of ['TDONG', 'LOP']) assert.equal((await request('/api/part-groups', { method: 'POST', body: { code, name: code } })).status, 201);
}
const numbered = { name: 'Vật tư cấp mã', category: 'accessories', unit: 'Cái', applicable_for: 'both', item_type: 'M', object_code: 'IN', group_code: 'TDONG' };

scenario('server numbering is sequential per prefix and does not reuse inactive SKUs', async ({ request }) => {
  await codes(request);
  const first = await request('/api/parts', { method: 'POST', body: numbered });
  assert.equal(first.status, 201, JSON.stringify(first.payload));
  assert.equal(first.payload.data.sku, 'M-IN-TDONG-0001');
  assert.equal((await request('/api/parts', { method: 'POST', body: numbered })).payload.data.sku, 'M-IN-TDONG-0002');
  assert.equal((await request('/api/parts', { method: 'POST', body: { ...numbered, group_code: 'LOP' } })).payload.data.sku, 'M-IN-LOP-0001');
  assert.equal((await request('/api/parts', { method: 'POST', body: { ...numbered, item_type: 'G' } })).payload.data.sku, 'G-IN-TDONG-0001');
  await request(`/api/parts/${first.payload.data.id}`, { method: 'PATCH', body: { is_active: 0, version: 1 } });
  assert.equal((await request('/api/parts', { method: 'POST', body: numbered })).payload.data.sku, 'M-IN-TDONG-0003');
  const renamed = await request(`/api/parts/${first.payload.data.id}`, { method: 'PATCH', body: { object_code: 'OTHER', version: 2 } });
  assert.equal(renamed.status, 409);
});

scenario('atomic import preserves explicit codes, advances numbers and replays without duplication', async ({ request, sql }) => {
  await codes(request);
  const body = { batch_id: 'batch-import-test-001', rows: [{ ...numbered, sku: 'M-IN-TDONG-0002' }, numbered] };
  const imported = await request('/api/parts/import', { method: 'POST', body });
  assert.equal(imported.status, 201, JSON.stringify(imported.payload));
  assert.deepEqual(imported.payload.data.map(row => row.sku), ['M-IN-TDONG-0002', 'M-IN-TDONG-0003']);
  const replayed = await request('/api/parts/import', { method: 'POST', body });
  assert.equal(replayed.status, 200);
  assert.equal(replayed.payload.replayed, true);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM parts').get().n, 2);
  assert.equal((await request('/api/parts/import', { method: 'POST', body: { ...body, rows: [numbered] } })).status, 409);
});

scenario('duplicate in an import rolls back all rows and reserved sequence numbers', async ({ request, sql }) => {
  await codes(request);
  const row = { ...numbered, sku: 'M-IN-TDONG-0002' };
  const bad = await request('/api/parts/import', { method: 'POST', body: { batch_id: 'batch-import-rollback', rows: [numbered, row, row] } });
  assert.equal(bad.status, 409);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM parts').get().n, 0);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM part_sku_sequences').get().n, 0);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM part_import_batches').get().n, 0);
  assert.equal((await request('/api/parts', { method: 'POST', body: numbered })).payload.data.sku, 'M-IN-TDONG-0001');
});

scenario('numbering rejects missing/inactive codes, disallows overflow and restricts imports', async ({ request, sql }) => {
  assert.equal((await request('/api/parts', { method: 'POST', body: numbered })).status, 409);
  await codes(request);
  sql.exec("INSERT INTO part_sku_sequences VALUES ('M-IN-TDONG-',9999)");
  const exhausted = await request('/api/parts', { method: 'POST', body: numbered });
  assert.equal(exhausted.status, 409);
  assert.equal(exhausted.payload.error.code, 'SKU_EXHAUSTED');
  assert.equal((await request('/api/parts/import', { method: 'POST', role: 'viewer', body: { batch_id: 'batch-viewer-123456', rows: [numbered] } })).status, 403);
  assert.equal((await request('/api/part-objects', { method: 'POST', body: { code: 'BAD-CODE', name: 'Bad' } })).status, 400);
  sql.exec("UPDATE part_objects SET is_active=0 WHERE code='IN'");
  assert.equal((await request('/api/parts', { method: 'POST', body: { ...numbered, item_type: 'C' } })).status, 409);
});

scenario('part price and minimum stock persist with legacy defaults and reject negatives', async ({ request }) => {
  const created = await request('/api/parts', { method: 'POST', body: { sku: 'PRICE-1', name: 'Lọc', unit: 'Cái', unit_price_vnd: 125000, min_stock_milli: 2500 } });
  assert.equal(created.status, 201);
  assert.equal(created.payload.data.unit_price_vnd, 125000);
  assert.equal(created.payload.data.min_stock_milli, 2500);
  assert.equal(created.payload.data.category, 'accessories');
  const id = created.payload.data.id;
  const updated = await request('/api/parts/' + id, { method: 'PATCH', body: { version: created.payload.data.version, unit_price_vnd: 150000, min_stock_milli: 3750 } });
  assert.equal(updated.status, 200);
  const loaded = await request('/api/parts/' + id);
  assert.equal(loaded.payload.data.unit_price_vnd, 150000);
  assert.equal(loaded.payload.data.min_stock_milli, 3750);
  assert.equal((await request('/api/parts', { method: 'POST', body: { ...part, min_stock_milli: -1 } })).status, 400);
});

scenario('warehouse owns multiple tanks, filters by warehouse and protects active children', async ({request,sql}) => {
  const makeKho=async code=>(await request('/api/warehouses',{method:'POST',body:{code,name:code}})).payload.data;
  const a=await makeKho('K-A'), b=await makeKho('K-B');
  const tank={code:'B-01',name:'Bồn 1',warehouse_id:a.id,capacity_milli:25000125};
  assert.equal((await request('/api/fuel-tanks',{method:'POST',body:tank,role:'viewer'})).status,403);
  assert.equal((await request('/api/fuel-tanks',{method:'POST',body:{...tank,warehouse_id:'missing'}})).status,409);
  assert.equal((await request('/api/fuel-tanks',{method:'POST',body:{...tank,capacity_milli:0}})).status,400);
  const created=await request('/api/fuel-tanks',{method:'POST',body:tank});assert.equal(created.status,201);
  const t=created.payload.data;
  assert.equal((await request('/api/fuel-tanks',{method:'POST',body:{...tank,code:'B-02'}})).status,201);
  assert.equal((await request('/api/fuel-tanks?warehouse_id='+a.id)).payload.pagination.total,2);
  assert.equal((await request('/api/fuel-tanks?warehouse_id='+b.id)).payload.pagination.total,0);
  assert.equal((await request('/api/warehouses/'+a.id,{method:'PATCH',body:{version:1,is_active:0}})).status,409);
  assert.throws(()=>sql.prepare('UPDATE warehouses SET is_active=0 WHERE id=?').run(a.id),/WAREHOUSE_HAS_ACTIVE_TANKS/);
  assert.equal((await request('/api/fuel-tanks/'+t.id,{method:'PATCH',body:{version:1,warehouse_id:b.id}})).status,200);
  assert.equal((await request('/api/fuel-tanks/'+t.id,{method:'PATCH',body:{version:1,name:'Stale'}})).status,409);
  assert.equal((await request('/api/fuel-tanks?warehouse_id='+b.id)).payload.pagination.total,1);
  assert.equal((await request('/api/fuel-tanks?warehouse_id='+a.id)).payload.pagination.total,1);
  assert.equal((await request('/api/fuel-tanks',{method:'POST',body:tank})).status,409);
  const t2=(await request('/api/fuel-tanks?warehouse_id='+a.id)).payload.data[0];
  assert.equal((await request('/api/fuel-tanks/'+t2.id,{method:'PATCH',body:{version:t2.version,is_active:0}})).status,200);
  assert.equal((await request('/api/warehouses/'+a.id,{method:'PATCH',body:{version:1,is_active:0}})).status,200);
  assert.equal((await request('/api/fuel-tanks/'+t2.id,{method:'PATCH',body:{version:t2.version+1,is_active:1}})).status,409);
  assert.equal((await request('/api/warehouses',{method:'POST',body:{code:'OLD',name:'Old merged',kind:'fuel_tank'}})).status,400);
});

scenario('personnel hierarchy leaves units empty, separates staff and enforces parent and driver relationships', async({request,sql})=>{
 const created=await request('/api/org-units',{method:'POST',body:{code:'DV1',name:'Đơn vị 1'}});assert.equal(created.status,201);const unit=created.payload.data;
 assert.equal((await request('/api/departments?unit_id='+unit.id)).payload.data.length,0);
 const teams=[(await request('/api/departments',{method:'POST',body:{code:'DX',name:'Đội xe cũ',unit_id:unit.id,kind:'driver'}})).payload.data];
 const office=(await request('/api/departments',{method:'POST',body:{code:'HC',name:'Hành chính',unit_id:unit.id}})).payload.data;
 const person={code:'NV1',name:'Nhân viên A',unit_id:unit.id,department_id:office.id,staff_type:'employee'};
 const employee=(await request('/api/staff',{method:'POST',body:person})).payload.data;
 const driver=(await request('/api/staff',{method:'POST',body:{...person,code:'TX1',name:'Tài xế A',department_id:teams[0].id,staff_type:'driver'}})).payload.data;
 assert.equal((await request('/api/staff?department_id='+office.id+'&staff_type=employee')).payload.pagination.total,1);
 assert.equal((await request('/api/staff?department_id='+teams[0].id+'&staff_type=employee')).payload.pagination.total,0);
 assert.equal((await request('/api/staff?department_id='+teams[0].id+'&staff_type=driver')).payload.pagination.total,1);
 assert.equal((await request('/api/staff',{method:'POST',body:{...person,code:'BAD',department_id:teams[0].id}})).status,409);
 assert.equal((await request('/api/staff',{method:'POST',body:{...person,code:'BAD',unit_id:'missing'}})).status,409);
 assert.equal((await request('/api/org-units/'+unit.id,{method:'PATCH',body:{is_active:0,version:1}})).status,409);
 assert.equal((await request('/api/departments/'+office.id,{method:'PATCH',body:{is_active:0,version:1}})).status,409);
 const vehicle={plate_number:'50H-11111',type:'tractor',assigned_driver_id:employee.id};
 assert.equal((await request('/api/vehicles',{method:'POST',body:vehicle})).status,409);
 assert.equal((await request('/api/vehicles',{method:'POST',body:{...vehicle,assigned_driver_id:driver.id}})).status,201);
 assert.equal((await request('/api/staff/'+driver.id,{method:'PATCH',body:{staff_type:'employee',department_id:office.id,version:1}})).status,409);
 assert.throws(()=>sql.prepare('UPDATE departments SET kind=? WHERE id=?').run('employee',teams[0].id),/ORG_HAS_MEMBERS/);
 assert.equal((await request('/api/org-units',{method:'POST',body:{code:'DENIED',name:'No'},role:'viewer'})).status,403);
 assert.equal((await request('/api/org-units/'+unit.id,{method:'PATCH',body:{name:'Đổi tên',version:1}})).status,200);
 assert.equal((await request('/api/org-units/'+unit.id,{method:'PATCH',body:{name:'Stale',version:1}})).status,409);
});
scenario('unit creation audit is atomic without creating departments',async({request,sql})=>{
 sql.exec("CREATE TRIGGER fail_dept BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test child failure'); END");
 assert.equal((await request('/api/org-units',{method:'POST',body:{code:'ATOMIC',name:'Unit rollback'}})).status,500);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM org_units').get().n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM audit_events').get().n,0);
});

scenario('drivers can be saved independently with tractor and trailer plates',async({request})=>{
 const created=await request('/api/staff',{method:'POST',body:{code:'TX-FREE',name:'Tài xế tự do',staff_type:'driver',vehicle_plate:'50H-12345',trailer_plate:'51R-12345'}});
 assert.equal(created.status,201);const row=created.payload.data;assert.equal(row.unit_id,null);assert.equal(row.department_id,null);
 const loaded=(await request('/api/staff?staff_type=driver')).payload.data;assert.equal(loaded.length,1);assert.equal(loaded[0].vehicle_plate,'50H-12345');assert.equal(loaded[0].trailer_plate,'51R-12345');
 assert.equal((await request('/api/staff?staff_type=employee')).payload.pagination.total,0);
 const edited=await request('/api/staff/'+row.id,{method:'PATCH',body:{version:1,trailer_plate:'51R-99999'}});assert.equal(edited.status,200);assert.equal(edited.payload.data.trailer_plate,'51R-99999');
});

scenario('personnel rank is editable without changing staff group or access role',async({request})=>{
 const created=await request('/api/staff',{method:'POST',body:{code:'RANK1',name:'Nhân sự'}});assert.equal(created.status,201);const row=created.payload.data;assert.equal(row.staff_rank,'Nhân viên');
 const edited=await request('/api/staff/'+row.id,{method:'PATCH',body:{version:row.version,staff_rank:'Quản lý'}});assert.equal(edited.status,200);
 const loaded=(await request('/api/staff/'+row.id)).payload.data;assert.equal(loaded.staff_rank,'Quản lý');assert.equal(loaded.staff_type,'employee');
 assert.equal((await request('/api/staff/'+row.id,{method:'PATCH',body:{version:loaded.version,staff_rank:'x'.repeat(257)}})).status,400);
});

scenario('supplier codes follow current maximum, validate province, and reject duplicates',async({request,sql})=>{
 const data={name:'Nhà cung cấp',province_name:'Hồ Chí Minh'};
 const first=await request('/api/suppliers',{method:'POST',body:data});assert.equal(first.status,201);assert.equal(first.payload.data.code,'NCC00001');
 assert.equal((await request('/api/suppliers',{method:'POST',body:{...data,code:'NCC00008'}})).status,201);
 assert.equal((await request('/api/suppliers',{method:'POST',body:data})).payload.data.code,'NCC00009');
 assert.equal((await request('/api/suppliers',{method:'POST',body:{...data,code:'NCC00008'}})).status,409);
 for(const code of ['NCC-00010','NCC00000','NCC123456'])assert.equal((await request('/api/suppliers',{method:'POST',body:{...data,code}})).status,400);
 for (const province_name of [undefined,null,'','   ']) {
  const saved=await request('/api/suppliers',{method:'POST',body:{name:'Thiếu tỉnh',province_name}});
  assert.equal(saved.status,201);assert.equal(saved.payload.data.province_name,null);
  const edited=await request('/api/suppliers/'+saved.payload.data.id,{method:'PATCH',body:{version:saved.payload.data.version,province_name:'Hà Nội'}});
  assert.equal(edited.status,200);
  assert.equal((await request('/api/suppliers/'+saved.payload.data.id,{method:'PATCH',body:{version:edited.payload.data.version,province_name:null}})).payload.data.province_name,null);
 }
 assert.equal((await request('/api/suppliers',{method:'POST',body:{...data,province_name:'Hà Giang'}})).status,400);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM vietnam_provinces').get().n,34);
 assert.equal((await request('/api/suppliers',{method:'POST',body:data,role:'viewer'})).status,403);
});
scenario('supplier tax code is optional but unique across normalized branch codes and failed saves reserve no number',async({request,sql})=>{
 const body={name:'NCC',province_name:'Hà Nội'};
 const a=(await request('/api/suppliers',{method:'POST',body:{...body,tax_code:'1234567890-001'}})).payload.data;
 const duplicate=await request('/api/suppliers',{method:'POST',body:{...body,tax_code:' 1234567890001 '}});assert.equal(duplicate.status,409);assert.equal(duplicate.payload.error.code,'DUPLICATE_TAX_CODE');
 const b=(await request('/api/suppliers',{method:'POST',body:{...body,tax_code:''}})).payload.data;assert.equal(b.code,'NCC00002');assert.equal(b.tax_code,null);
 assert.equal((await request('/api/suppliers',{method:'POST',body:body})).payload.data.code,'NCC00003');
 assert.equal((await request('/api/suppliers/'+b.id,{method:'PATCH',body:{version:1,tax_code:a.tax_code}})).status,409);
 assert.equal(sql.prepare('SELECT version FROM suppliers WHERE id=?').get(b.id).version,1);
 assert.equal((await request('/api/suppliers/'+a.id,{method:'PATCH',body:{version:1,name:'Đổi tên'}})).status,200);
});
scenario('linked supplier cannot be deactivated or deleted, and inactive supplier cannot gain documents',async({request,sql})=>{
 const body={name:'NCC',province_name:'Đồng Nai'};
 const a=(await request('/api/suppliers',{method:'POST',body:body})).payload.data;
 sql.prepare("INSERT INTO inventory_documents(id,code,type,business_date,supplier_id,created_by,idempotency_key,request_hash) VALUES ('doc1','PN1','IN','2026-10-22',?,'admin','idemp1','hash')").run(a.id);
 assert.equal((await request('/api/suppliers')).payload.data[0].is_linked,1);
 const removed=await request('/api/suppliers/'+a.id,{method:'PATCH',body:{version:1,is_active:0}});assert.equal(removed.status,409);assert.equal(removed.payload.error.code,'SUPPLIER_HAS_DOCUMENTS');
 assert.throws(()=>sql.prepare('UPDATE suppliers SET is_active=0 WHERE id=?').run(a.id),/SUPPLIER_HAS_DOCUMENTS/);
 assert.throws(()=>sql.prepare('DELETE FROM suppliers WHERE id=?').run(a.id),/SUPPLIER_HAS_DOCUMENTS/);
 const b=(await request('/api/suppliers',{method:'POST',body:body})).payload.data;
 assert.equal((await request('/api/suppliers/'+b.id,{method:'PATCH',body:{version:1,is_active:0}})).status,200);
 assert.equal((await request('/api/suppliers',{method:'POST',body:body})).payload.data.code,'NCC00003');
 assert.throws(()=>sql.prepare("INSERT INTO inventory_documents(id,code,type,business_date,supplier_id,created_by,idempotency_key,request_hash) VALUES ('doc2','PN2','IN','2026-10-22',?,'admin','idemp2','hash')").run(b.id),/SUPPLIER_INACTIVE/);
});
scenario('supplier auto-number audit rollback and exhaustion are safe',async({request,sql})=>{
 const body={name:'NCC',province_name:'Huế'};
 sql.exec("CREATE TRIGGER fail_supplier_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test audit'); END");
 assert.equal((await request('/api/suppliers',{method:'POST',body})).status,500);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM suppliers').get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM supplier_code_sequence').get().n,0);
 sql.exec('DROP TRIGGER fail_supplier_audit');
 assert.equal((await request('/api/suppliers',{method:'POST',body})).payload.data.code,'NCC00001');
 assert.equal((await request('/api/suppliers',{method:'POST',body:{...body,code:'NCC99999'}})).status,201);
 const exhausted=await request('/api/suppliers',{method:'POST',body});assert.equal(exhausted.status,409);assert.equal(exhausted.payload.error.code,'SUPPLIER_CODE_EXHAUSTED');
});

scenario('independent equipment catalogs validate types, paging, versions and audit without pairing',async({request,sql})=>{
 const gen=await request('/api/equipment',{method:'POST',body:{code:'MP001',name:'Máy phát 1',type:'generator',operating_hours:120}});
 assert.equal(gen.status,201);assert.equal(gen.payload.data.assigned_driver_id,undefined);
 const cont=await request('/api/equipment',{method:'POST',body:{code:'CONT001',name:'Cont 40 feet',type:'container'}});assert.equal(cont.status,201);
 assert.equal((await request('/api/equipment?type=generator&page_size=1')).payload.pagination.total,1);
 assert.equal((await request('/api/equipment?type=container')).payload.data[0].code,'CONT001');
 assert.equal((await request('/api/equipment?type=tractor')).status,400);
 assert.equal((await request('/api/equipment',{method:'POST',body:{code:'mp001',name:'Trùng',type:'generator'}})).status,409);
 assert.equal((await request('/api/equipment',{method:'POST',body:{code:'BAD',name:'Sai',type:'tractor'}})).status,400);
 assert.equal((await request('/api/equipment',{method:'POST',body:{code:'NEG',name:'Sai',type:'generator',operating_hours:-1}})).status,400);
 const id=gen.payload.data.id;
 assert.equal((await request('/api/equipment/'+id,{method:'PATCH',body:{version:1,operating_hours:119}})).status,400);
 assert.equal((await request('/api/equipment/'+id,{method:'PATCH',body:{version:1,operating_hours:121}})).status,200);
 assert.equal((await request('/api/equipment/'+id,{method:'PATCH',body:{version:1,status:'stopped'}})).status,409);
 assert.equal((await request('/api/equipment/'+id,{method:'PATCH',body:{version:2,status:'stopped'}})).status,200);
 assert.equal((await request('/api/equipment?type=generator&status=active')).payload.pagination.total,0);
 assert.equal((await request('/api/equipment',{method:'POST',body:{code:'READ',name:'Sai quyền',type:'generator'},role:'viewer'})).status,403);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_type='equipment'").get().n,4);
 for(const type of ['tractor','trailer']) assert.equal((await request('/api/vehicles',{method:'POST',body:{plate_number:type,type}})).status,201);
 assert.equal((await request('/api/vehicles?type=tractor')).payload.pagination.total,1);
 assert.equal((await request('/api/vehicles?type=trailer')).payload.pagination.total,1);
});

scenario('parameter groups and pairing drafts preserve independent catalogs and validate references',async({request,sql})=>{
 const p=await request('/api/equipment-parameters',{method:'POST',body:{group_key:'route',code:'BNAM',name:'Đường dài'}});assert.equal(p.status,201);
 assert.equal((await request('/api/equipment-parameters?group_key=route')).payload.pagination.total,1);
 assert.equal((await request('/api/equipment-parameters?group_key=source')).payload.pagination.total,0);
 for(const [plate_number,type,source_group] of [['DK1','tractor','tractor'],['RM1','trailer','trailer'],['TT1','rented_truck','box_truck'],['TN1','rented_truck','rented_truck']])assert.equal((await request('/api/vehicles',{method:'POST',body:{plate_number,type,source_group,route_group:'BNAM',chassis_number:'000123'}})).status,201);
 assert.equal((await request('/api/vehicles?type=rented_truck&source_group=box_truck')).payload.data[0].plate_number,'TT1');
 const body={parent_code:'DK1',child_code:'RM1',pairing_type:'trailer'};
 assert.equal((await request('/api/equipment-pairings',{method:'POST',body})).status,405);
 sql.prepare("INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type) VALUES('legacy-draft','DK1','RM1','trailer')").run();
 assert.equal((await request('/api/equipment-pairings')).payload.data[0].effective_from,null);
 assert.throws(()=>sql.prepare("INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type) VALUES('invalid','DK1','MISSING','trailer')").run(),/PAIRING_INVALID_REFERENCE/);
 assert.equal((await request('/api/equipment-pairings/legacy-draft',{method:'PATCH',body:{version:1,is_active:0}})).status,405);
 const parent=sql.prepare("SELECT id,version FROM vehicles WHERE plate_number='DK1'").get();
 assert.equal((await request('/api/vehicles/'+parent.id,{method:'PATCH',body:{version:parent.version,plate_number:'OTHER'}})).status,409);
 assert.equal(sql.prepare("SELECT assigned_driver_id FROM vehicles WHERE plate_number='DK1'").get().assigned_driver_id,null);
 assert.equal((await request('/api/equipment-parameters',{method:'POST',body:{group_key:'route',code:'X',name:'X'},role:'viewer'})).status,403);
});

scenario('equipment form parameter values validate and original condition synchronizes operational status',async({request})=>{
 for(const p of [{group_key:'route',code:'BNAM',name:'Đường dài'},{group_key:'source',code:'TTC',name:'Thuê tài chính'},{group_key:'condition',code:'HD',name:'Hoạt động'},{group_key:'condition',code:'HU',name:'Hư'}])assert.equal((await request('/api/equipment-parameters',{method:'POST',body:p})).status,201);
 const saved=await request('/api/vehicles',{method:'POST',body:{plate_number:'50H-001.01',type:'tractor',route_group:'BNAM',ownership_source:'Thuê tài chính',original_status:'Hoạt động',chassis_number:'0000123',engine_number:'0000456',current_odo_km:12345}});
 assert.equal(saved.status,201);
 const changed=await request('/api/vehicles/'+saved.payload.data.id,{method:'PATCH',body:{version:1,original_status:'Hư'}});
 assert.equal(changed.status,200);assert.equal(changed.payload.data.status,'maintenance');assert.equal(changed.payload.data.chassis_number,'0000123');assert.equal(changed.payload.data.current_odo_km,12345);
 assert.equal((await request('/api/vehicles/'+saved.payload.data.id,{method:'PATCH',body:{version:2,route_group:'Không có'}})).status,400);
});

scenario('condition filter separates warehouse containers from stopped assets and handles legacy status',async({request,sql})=>{
 for(const [code,name] of [['HD','Hoạt động'],['HU','Hư'],['KHO','Làm kho'],['NGUNG','Ngừng hoạt động']])assert.equal((await request('/api/equipment-parameters',{method:'POST',body:{group_key:'condition',code,name}})).status,201);
 for(const [code,original_status] of [['C1','Hoạt động'],['C2','Hư'],['C3','Làm kho'],['C4','Ngừng hoạt động']])assert.equal((await request('/api/equipment',{method:'POST',body:{code,name:code,type:'container',original_status}})).status,201);
 assert.equal((await request('/api/equipment?type=container&original_status='+encodeURIComponent('Làm kho'))).payload.data[0].code,'C3');
 assert.equal((await request('/api/equipment?type=container&original_status='+encodeURIComponent('Ngừng hoạt động'))).payload.pagination.total,1);
 assert.equal((await request('/api/equipment?type=container&original_status='+encodeURIComponent('Hư'))).payload.data[0].code,'C2');
 sql.prepare("UPDATE equipment SET status='stopped' WHERE code='C1'").run();
 assert.equal((await request('/api/equipment?type=container&original_status='+encodeURIComponent('Ngừng hoạt động'))).payload.pagination.total,2);
});

scenario('pairing actions require reason and time, preserve state and reject collisions atomically',async({request,sql})=>{
 const time='2026-01-01T00:00:00.000Z';
 const create=async(path,body)=>(await request(path,{method:'POST',body})).payload.data;
 const dk=await create('/api/vehicles',{plate_number:'DK01',type:'tractor'}),dk2=await create('/api/vehicles',{plate_number:'DK02',type:'tractor'});
 await create('/api/vehicles',{plate_number:'RM01',type:'trailer'});await create('/api/vehicles',{plate_number:'RM02',type:'trailer'});
 for(const code of ['MP01','MP02'])await create('/api/equipment',{code,name:code,type:'generator'});
 const set=(await request('/api/equipment-pairing-sets/'+dk.id)).payload.data;
 const change={version:set.version,action:'assemble',trailer_code:'RM01',generator_1:'MP01',effective_at:time,reason:'Ghép lần đầu'};
 assert.equal((await request('/api/equipment-pairing-sets/'+dk.id,{method:'PATCH',body:{...change,reason:''}})).status,400);
 assert.equal((await request('/api/equipment-pairing-sets/'+dk.id,{method:'PATCH',body:{...change,effective_at:'2099-01-01T00:00:00Z'}})).status,400);
 const result=await request('/api/equipment-pairing-sets/'+dk.id,{method:'PATCH',body:change});assert.equal(result.status,200,JSON.stringify(result.payload));assert.equal(JSON.parse(result.payload.data.links_json).length,2);
 assert.equal((await request('/api/equipment-pairing-sets?q=MP01')).payload.pagination.total,1);
 assert.equal((await request('/api/equipment-pairing-sets/'+dk.id,{method:'PATCH',body:change})).status,409);
 const other=(await request('/api/equipment-pairing-sets/'+dk2.id)).payload.data;
 const conflict=await request('/api/equipment-pairing-sets/'+dk2.id,{method:'PATCH',body:{version:other.version,action:'assemble',trailer_code:'RM02',generator_1:'MP01',effective_at:time,reason:'Xung đột'}});assert.equal(conflict.status,409);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM equipment_pairing_drafts WHERE parent_code='DK02' AND is_active=1").get().n,0);
 assert.equal((await request('/api/equipment-pairing-sets/'+dk2.id)).payload.data.version,other.version);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM pairing_change_events WHERE parent_id=?').get(dk2.id).n,0);
 const clear=await request('/api/equipment-pairing-sets/'+dk.id,{method:'PATCH',body:{version:result.payload.data.version,action:'detach',value:'all',effective_at:time,reason:'Tháo bộ'}});assert.equal(clear.status,200);assert.equal(JSON.parse(clear.payload.data.links_json).length,0);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM equipment_pairing_drafts WHERE parent_code='DK01'").get().n,2);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_type='pairing_sets'").get().n,2);
 const history=await request('/api/equipment-pairing-sets?view=history&parent_id='+dk.id);assert.equal(history.payload.pagination.total,2);assert.ok(history.payload.data.every(r=>r.reason&&r.effective_at&&r.actor_name));
 assert.equal((await request('/api/equipment-pairing-sets/'+dk.id,{method:'PATCH',body:change,role:'viewer'})).status,403);
 await assert.rejects(async()=>sql.prepare('DELETE FROM pairing_change_events').run(),/PAIRING_HISTORY_IMMUTABLE/);
});

scenario('Vietnamese search matches uppercase lowercase across catalogs, keeps originals and tracks direct updates',async({request,sql})=>{
 const name='ĐẠI LONG';
 const inputs=[['suppliers',{name}],['parts',{sku:'UNI-1',name,unit:'Cái'}],['warehouses',{code:'UNI-K',name}],['org-units',{code:'UNI-U',name}],['staff',{code:'UNI-S',name}],['equipment',{code:'UNI-E',name,type:'generator'}],['equipment-parameters',{group_key:'source',code:'UNI-P',name}],['vehicles',{plate_number:'UNI-V',type:'tractor',brand_model:name}]];
 for(const [resource,body] of inputs){
  const created=await request('/api/'+resource,{method:'POST',body});assert.equal(created.status,201,resource+JSON.stringify(created.payload));
  for(const query of ['đại long','Đại Long',name,'đại long'.normalize('NFD')]){
   const result=await request('/api/'+resource+'?q='+encodeURIComponent(query));assert.equal(result.status,200);assert.equal(result.payload.pagination.total,1,resource+query);assert.equal(result.payload.data[0].id,created.payload.data.id);
  }
 }
 const supplier=(await request('/api/suppliers?q='+encodeURIComponent('đại long'))).payload.data[0];assert.equal(supplier.name,name);
 sql.prepare("UPDATE suppliers SET name='ĐẠI HƯNG' WHERE id=?").run(supplier.id);
 assert.equal((await request('/api/suppliers?q='+encodeURIComponent('đại long'))).payload.pagination.total,0);
 assert.equal((await request('/api/suppliers?q='+encodeURIComponent('đại hưng'))).payload.pagination.total,1);
 sql.prepare('DELETE FROM equipment_parameters').run();
 assert.equal(sql.prepare("SELECT count(*) AS n FROM catalog_search WHERE resource='equipment-parameters'").get().n,0);
});


scenario('pairing route is read only and catalog route changes invalidate versions',async({request,sql})=>{
 const tractor=(await request('/api/vehicles',{method:'POST',body:{plate_number:'ROUTE-DK',type:'tractor'}})).payload.data;
 sql.prepare("UPDATE vehicles SET route_group='BNAM' WHERE id=?").run(tractor.id);
 const first=(await request('/api/equipment-pairing-sets/'+tractor.id)).payload.data;assert.equal(first.route_group,'BNAM');
 assert.equal((await request('/api/equipment-pairing-sets/'+tractor.id,{method:'PATCH',body:{version:first.version,route_group:'DCANG'}})).status,400);
 sql.prepare("UPDATE vehicles SET route_group='DCANG' WHERE id=?").run(tractor.id);
 const latest=(await request('/api/equipment-pairing-sets/'+tractor.id)).payload.data;assert.ok(latest.version>first.version);assert.equal(latest.route_group,'DCANG');
});

scenario('pairing list reads driver name and employee code from the linked staff record',async({request,sql})=>{
 const driver=(await request('/api/staff',{method:'POST',body:{code:'NV0099',name:'Tài xế kiểm tra',staff_type:'driver'}})).payload.data;
 const tractor=(await request('/api/vehicles',{method:'POST',body:{plate_number:'DRIVER-DK',type:'tractor',assigned_driver_id:driver.id}})).payload.data;
 const row=(await request('/api/equipment-pairing-sets/'+tractor.id)).payload.data;
 assert.equal(row.driver_name,'Tài xế kiểm tra');assert.equal(row.driver_code,'NV0099');assert.equal(row.assigned_driver_id,driver.id);
 sql.prepare("UPDATE staff SET name='Tên đã sửa',code='NV0100' WHERE id=?").run(driver.id);
 const updated=(await request('/api/equipment-pairing-sets/'+tractor.id)).payload.data;
 assert.equal(updated.driver_name,'Tên đã sửa');assert.equal(updated.driver_code,'NV0100');
});

scenario('pairing tiles, route, sort, free choices and reviews operate across all pages',async({request,sql})=>{
 const create=async(path,body)=>(await request(path,{method:'POST',body})).payload.data;
 const a=await create('/api/vehicles',{plate_number:'DK-A',type:'tractor'}),b=await create('/api/vehicles',{plate_number:'DK-B',type:'tractor'}),c=await create('/api/vehicles',{plate_number:'DK-C',type:'tractor'});
 sql.prepare("UPDATE vehicles SET route_group='BNAM' WHERE id=?").run(a.id);sql.prepare("UPDATE vehicles SET route_group='DCANG' WHERE id=?").run(b.id);
 const driver=await create('/api/staff',{code:'TX01',name:'ĐẠI LONG',staff_type:'driver'});
 const trailer=await create('/api/vehicles',{plate_number:'RM-A',type:'trailer'}),machine=await create('/api/equipment',{code:'MP-A',name:'MP A',type:'generator'});
 await create('/api/vehicles',{plate_number:'RM-FREE',type:'trailer'});await create('/api/equipment',{code:'MP-STOP',name:'Stopped',type:'generator',status:'stopped'});
 const initial=(await request('/api/equipment-pairing-sets/'+a.id)).payload.data;
 const saved=await request('/api/equipment-pairing-sets/'+a.id,{method:'PATCH',body:{version:initial.version,action:'assemble',trailer_code:'RM-A',generator_1:'MP-A',driver_id:driver.id,effective_at:'2026-01-01T00:00:00Z',reason:'Ghép đủ bộ'}});assert.equal(saved.status,200,JSON.stringify(saved.payload));
 assert.equal(sql.prepare('SELECT vehicle_plate FROM staff WHERE id=?').get(driver.id).vehicle_plate,'DK-A');assert.equal(sql.prepare('SELECT trailer_plate FROM staff WHERE id=?').get(driver.id).trailer_plate,'RM-A');
 const list=(await request('/api/equipment-pairing-sets?page_size=1&sort=parent_code&direction=desc')).payload;
 assert.equal(list.data.length,1);assert.equal(list.data[0].parent_code,'DK-C');assert.equal(list.stats.total,3);assert.equal(list.stats.complete,1);assert.equal(list.stats.missing_trailer,1);assert.equal(list.stats.missing_generator,1);assert.equal(list.stats.missing_driver,2);
 assert.equal((await request('/api/equipment-pairing-sets?filter=missing_trailer&page_size=1')).payload.pagination.total,1);
 assert.equal((await request('/api/equipment-pairing-sets?filter=complete&route_group=DCANG')).payload.pagination.total,0);
 assert.equal((await request('/api/equipment-pairing-sets?q='+encodeURIComponent('đại long'))).payload.data[0].id,a.id);
 const free=(await request('/api/equipment-pairing-sets?view=available&kind=trailer&q=RM')).payload;
 assert.equal(free.pagination.total,1);assert.equal(free.data[0].plate_number,'RM-FREE');
 assert.equal((await request('/api/equipment-pairing-sets?view=available&kind=generator')).payload.pagination.total,0);
 assert.equal((await request('/api/equipment-pairing-sets?view=available&kind=driver')).payload.pagination.total,0);
 assert.equal((await request('/api/vehicles',{method:'POST',body:{plate_number:'DUP-DRIVER',type:'tractor',assigned_driver_id:driver.id}})).status,409);
 const bulk=await request('/api/equipment-pairing-sets?page_size=100');
 const items=bulk.payload.data.map(r=>({id:r.id,version:r.version}));
 assert.equal((await request('/api/equipment-pairing-sets/review',{method:'PATCH',role:'viewer',body:{version:1,reviews_json:JSON.stringify(items)}})).status,403);
 sql.prepare("UPDATE vehicles SET route_group='BNAM' WHERE id=?").run(c.id);
 assert.equal((await request('/api/equipment-pairing-sets/review',{method:'PATCH',body:{version:1,reviews_json:JSON.stringify(items)}})).status,409);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM pairing_set_versions WHERE reviewed_version IS NOT NULL').get().n,0);
 const fresh=(await request('/api/equipment-pairing-sets?page_size=100')).payload.data.map(r=>({id:r.id,version:r.version}));
 assert.equal((await request('/api/equipment-pairing-sets/review',{method:'PATCH',body:{version:1,reviews_json:JSON.stringify(fresh)}})).status,200);
 assert.equal((await request('/api/equipment-pairing-sets')).payload.stats.reviewed,3);
 sql.prepare("UPDATE equipment SET status='maintenance' WHERE id=?").run(machine.id);
 const changed=(await request('/api/equipment-pairing-sets')).payload;assert.equal(changed.stats.reviewed,2);assert.equal(changed.stats.complete,0);assert.equal(changed.data.find(r=>r.id===a.id).bad_devices,1);
 const old=(await request('/api/equipment-pairing-sets/'+b.id)).payload.data;
 assert.equal((await request('/api/equipment-pairing-sets/'+b.id,{method:'PATCH',body:{version:old.version,action:'replace_driver',value:driver.id,effective_at:'2026-01-01T00:00:00Z',reason:'Thử trùng'}})).status,409);
 assert.equal((await request('/api/equipment-pairing-sets/'+b.id)).payload.data.version,old.version);
 assert.equal((await request('/api/equipment-pairing-sets?view=detail&kind=trailer&entity_id='+trailer.id)).payload.data[0].plate_number,'RM-A');
 assert.equal((await request('/api/equipment-pairing-sets?sort=badSQL')).status,400);
});

scenario('driver replacement and detach synchronize personnel and keep audit transaction atomic',async({request,sql})=>{
 const create=async(path,body)=>(await request(path,{method:'POST',body})).payload.data;
 const first=await create('/api/staff',{code:'FIRST',name:'Tài xế cũ',staff_type:'driver'}),second=await create('/api/staff',{code:'SECOND',name:'Tài xế mới',staff_type:'driver'});
 const tractor=await create('/api/vehicles',{plate_number:'SWAP-DK',type:'tractor',assigned_driver_id:first.id});
 await create('/api/vehicles',{plate_number:'SWAP-RM',type:'trailer'});
 let row=(await request('/api/equipment-pairing-sets/'+tractor.id)).payload.data;
 const patch=async(body)=>request('/api/equipment-pairing-sets/'+tractor.id,{method:'PATCH',body:{version:row.version,effective_at:'2026-01-01T00:00:00Z',reason:'Điều động',...body}});
 let response=await patch({action:'assemble',trailer_code:'SWAP-RM'});assert.equal(response.status,200);row=response.payload.data;
 response=await patch({action:'replace_driver',value:second.id});assert.equal(response.status,200);row=response.payload.data;
 const linkedTrailer=sql.prepare("SELECT id FROM vehicles WHERE plate_number='SWAP-RM'").get();
 const trailerHistory=(await request('/api/vehicles?view=history&entity_id='+linkedTrailer.id)).payload;
 assert.ok(trailerHistory.data.some(event=>event.action==='pairing.relationship_changed'));
 const driverHistory=(await request('/api/staff?view=history&entity_id='+second.id)).payload;
 assert.ok(driverHistory.data.some(event=>event.action==='pairing.staff_sync'));
 assert.equal(row.driver_name,'Tài xế mới');assert.equal(sql.prepare('SELECT vehicle_plate FROM staff WHERE id=?').get(first.id).vehicle_plate,null);assert.equal(sql.prepare('SELECT trailer_plate FROM staff WHERE id=?').get(second.id).trailer_plate,'SWAP-RM');
 response=await patch({action:'detach',value:'trailer'});assert.equal(response.status,200);row=response.payload.data;
 assert.equal(row.driver_code,'SECOND');assert.equal(sql.prepare('SELECT trailer_plate FROM staff WHERE id=?').get(second.id).trailer_plate,null);
 const count=sql.prepare('SELECT count(*) AS n FROM pairing_change_events').get().n;
 sql.exec("CREATE TRIGGER fail_pairing_event BEFORE INSERT ON pairing_change_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
 response=await patch({action:'detach',value:'driver'});assert.equal(response.status,500);
 assert.equal((await request('/api/equipment-pairing-sets/'+tractor.id)).payload.data.assigned_driver_id,second.id);assert.equal(sql.prepare('SELECT vehicle_plate FROM staff WHERE id=?').get(second.id).vehicle_plate,'SWAP-DK');assert.equal(sql.prepare('SELECT count(*) AS n FROM pairing_change_events').get().n,count);
});

scenario('catalog histories are paged, isolated per record, readable by viewers and preserve original audits',async({request,sql})=>{
 const create=async(resource,body)=>{const r=await request('/api/'+resource,{method:'POST',body});assert.equal(r.status,201,resource+JSON.stringify(r.payload));return r.payload.data;};
 const warehouse=await create('warehouses',{code:'H-K',name:'Kho lịch sử'}),unit=await create('org-units',{code:'H-U',name:'Đơn vị lịch sử'});
 const fixtures=[['parts',{sku:'H-P',name:'Vật tư',unit:'Cái'}],['part-objects',{code:'HO',name:'Đối tượng'}],['part-groups',{code:'HG',name:'Nhóm'}],['fuel-tanks',{code:'H-T',name:'Bồn',warehouse_id:warehouse.id,capacity_milli:1000000}],['departments',{code:'H-D',name:'Phòng',unit_id:unit.id}],['staff',{code:'H-S',name:'Nhân viên',unit_id:unit.id}],['suppliers',{name:'NCC lịch sử'}],['vehicles',{plate_number:'H-V',type:'tractor'}],['equipment',{code:'H-E',name:'Máy phát',type:'generator'}],['equipment-parameters',{code:'H-PR',name:'Nguồn',group_key:'source'}]];
 for(const [resource,body] of fixtures){
  const row=await create(resource,body),patch=resource==='vehicles'?{brand_model:'Nhãn hiệu mới'}:resource==='fuel-tanks'?{capacity_milli:2000000}:{name:'Tên mới'};
  const updated=await request('/api/'+resource+'/'+row.id,{method:'PATCH',body:{version:row.version,...patch}});assert.equal(updated.status,200,resource+JSON.stringify(updated.payload));
  const history=await request('/api/'+resource+'?view=history&entity_id='+row.id+'&page_size=1',{role:'viewer'});assert.equal(history.status,200,resource);assert.equal(history.payload.pagination.total,2);assert.equal(history.payload.data.length,1);assert.ok(history.payload.data[0].actor_name);
  const next=await request('/api/'+resource+'?view=history&entity_id='+row.id+'&page=2&page_size=1');assert.equal(next.payload.data.length,1);assert.notEqual(next.payload.data[0].id,history.payload.data[0].id);
  for(const event of [...history.payload.data,...next.payload.data]){const stored=sql.prepare('SELECT before_json,after_json FROM audit_events WHERE id=?').get(event.id);assert.equal(event.before_json,stored.before_json);assert.equal(event.after_json,stored.after_json);}
  if(resource==='fuel-tanks'){const labels=JSON.parse(history.payload.data[0].references_json);assert.match(labels['warehouses:'+warehouse.id],/Kho lịch sử/);}
 }
 const unitHistory=await request('/api/org-units?view=history&entity_id='+unit.id);assert.equal(unitHistory.payload.pagination.total,1);
 const unknown=await request('/api/staff?view=history&entity_id='+warehouse.id);assert.equal(unknown.status,404);
 assert.equal((await request('/api/staff?view=history&entity_id=bad%27SQL')).status,400);
 assert.equal((await request('/api/users?view=history&entity_id=admin',{role:'viewer'})).status,403);
 const historical=(await request('/api/parts?q=H-P')).payload.data[0];sql.prepare('DELETE FROM parts WHERE id=?').run(historical.id);
 assert.equal((await request('/api/parts?view=history&entity_id='+historical.id)).payload.pagination.total,2);
});

scenario('port tractors ignore missing trailer and generator in completion, filters and statistics',async({request,sql})=>{
 const create=async(path,body)=>(await request(path,{method:'POST',body})).payload.data;
 const driver=await create('/api/staff',{code:'PORT01',name:'Port driver',staff_type:'driver'});
 const port=await create('/api/vehicles',{plate_number:'PORT-DK',type:'tractor',assigned_driver_id:driver.id});
 sql.prepare("UPDATE vehicles SET route_group='DCANG' WHERE id=?").run(port.id);
 let list=(await request('/api/equipment-pairing-sets?route_group=DCANG')).payload;
 assert.equal(list.stats.complete,1);assert.equal(list.stats.missing_trailer,0);assert.equal(list.stats.missing_generator,0);
 assert.equal((await request('/api/equipment-pairing-sets?filter=missing_trailer')).payload.pagination.total,0);
 assert.equal((await request('/api/equipment-pairing-sets?filter=missing_generator')).payload.pagination.total,0);
 assert.equal((await request('/api/equipment-pairing-sets?filter=complete')).payload.pagination.total,1);
 sql.prepare("UPDATE vehicles SET route_group='BNAM' WHERE id=?").run(port.id);
 list=(await request('/api/equipment-pairing-sets')).payload;
 assert.equal(list.stats.complete,0);assert.equal(list.stats.missing_trailer,1);assert.equal(list.stats.missing_generator,1);
});

let issueFixtureNumber = 0;
async function issueHeaderFixture(request) {
 const suffix = String(++issueFixtureNumber);
 const create = async (path,body) => { const r=await request(path,{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data; };
 const driver=await create('/api/staff',{code:'PXDRV'+suffix,name:'Tài xế thử',staff_type:'driver'});
 const vehicle=await create('/api/vehicles',{plate_number:'PX-TEST-'+suffix,type:'tractor',assigned_driver_id:driver.id,current_odo_km:100});
 const context=await request('/api/document-drafts?view=issue-context&driver_id='+driver.id);
 assert.equal(context.status,200,JSON.stringify(context.payload));
 const {recipient,...info}=context.payload.data;
 assert.equal(info.vehicle_id,vehicle.id);assert.equal(info.odo,'100');
 return info;
}
async function documentFixture(request,kind='receipt',serial=false){
 const create=async(path,body)=>{const r=await request(path,{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data;};
 const warehouse=await create('/api/warehouses',{code:'D-WH',name:'Kho chứng từ',kind:'parts'}),item=await create('/api/parts',{...part,sku:'D-PART',category:kind==='retread'?'tires':part.category,is_serialized:serial?1:0});
 const draft=emptyDraft(kind);if(kind==='issue')draft.issue_details=await issueHeaderFixture(request);draft.business_at='2026-10-24T08:30';draft.warehouse_id=warehouse.id;draft.lines[0].part_id=item.id;if(['receipt','proposal','opening'].includes(kind))draft.lines[0].unit_price='12345';return {draft,item,warehouse};
}
scenario('draft numbers, exact VAT and idempotency are atomic and never change inventory',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='2.125';draft.lines[0].vat_rate='8';const body={draft,idempotency_key:'one'};
 const response=await request('/api/document-drafts',{method:'POST',body});assert.equal(response.status,201,JSON.stringify(response.payload));const row=response.payload.data;
 assert.equal(row.code,'10.26.00001/PN');assert.deepEqual(row.totals,{net:26233,vat:2099,gross:28332});
 const replay=await request('/api/document-drafts',{method:'POST',body});assert.equal(replay.payload.data.id,row.id);assert.equal(sql.prepare('SELECT last_no FROM document_counters').get().last_no,1);
 const changed=structuredClone(draft);changed.lines[0].quantity='3';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:changed,idempotency_key:'one'}})).status,409);
 assert.equal((await request('/api/document-drafts?kind=receipt&q='+encodeURIComponent(row.code.toLowerCase()))).payload.pagination.total,1);
 assert.equal((await request('/api/document-drafts?kind=receipt&q='+encodeURIComponent('KHO CHỨNG TỪ'))).payload.pagination.total,1);
 assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_documents').get().n,0);
});
scenario('draft edits enforce versions and reason, cancelled numbers persist and history is immutable',async({request,sql})=>{
 const {draft}=await documentFixture(request);const initial=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'edit'}});assert.equal(initial.status,201,JSON.stringify(initial.payload));let row=initial.payload.data;
 const next=structuredClone(draft);next.lines[0].quantity='4';const edit=reason=>request('/api/document-drafts/'+row.id,{method:'PATCH',body:{version:1,action:'save',reason,draft:next}});
 assert.equal((await edit('')).status,400);const saved=await edit('Đổi lượng');assert.equal(saved.status,200,JSON.stringify(saved.payload));assert.equal(saved.payload.data.version,2);assert.equal((await edit('Trễ')).status,409);
 assert.equal((await request('/api/document-drafts/'+row.id,{role:'warehouse'})).status,403);
 assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',role:'viewer',body:{version:2,action:'cancel',reason:'Không có quyền'}})).status,403);
 assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{version:2,action:'post',reason:'Thử ghi sổ'}})).payload.error.code,'POSTING_NOT_ENABLED');
 assert.equal((await request('/api/document-drafts/'+row.id+'?view=history')).payload.pagination.total,2);assert.throws(()=>sql.prepare('DELETE FROM document_draft_events').run());
 assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{version:2,action:'cancel',reason:'Hủy nháp'}})).payload.data.status,'cancelled');
 const second=structuredClone(draft);second.lines[0].id=crypto.randomUUID();assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:second,idempotency_key:'next'}})).payload.data.code,'10.26.00002/PN');
});
scenario('serial quantities and uniqueness preserve leading zero strings; warehouse scope and locks fail closed',async({request,sql})=>{
 const {draft,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].serial='000012345678901234567890';
 const bad=structuredClone(draft);bad.lines[0].quantity='2';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:bad,idempotency_key:'bad'}})).status,201);
 const duplicate=structuredClone(draft);duplicate.lines.push({...draft.lines[0],id:crypto.randomUUID()});assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:duplicate,idempotency_key:'dup'}})).status,400);
 assert.equal((await request('/api/document-drafts',{method:'POST',role:'warehouse',body:{draft,idempotency_key:'scope'}})).status,403);
 sql.prepare('INSERT INTO document_warehouse_access(user_id,warehouse_id) VALUES (?,?)').run('warehouse',warehouse.id);
 const good=await request('/api/document-drafts',{method:'POST',role:'warehouse',body:{draft,idempotency_key:'scope'}});assert.equal(good.status,201,JSON.stringify(good.payload));assert.equal(good.payload.data.draft.lines[0].serial,draft.lines[0].serial);
 sql.prepare("INSERT INTO accounting_periods(period,is_locked,locked_by,locked_at) VALUES ('2026-10',1,'admin','2026-10-31')").run();
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'locked'}})).payload.error.code,'PERIOD_LOCKED');
});
scenario('all draft kinds prepare documents without posting and transfer types share a monthly sequence',async({request,sql})=>{
 const {draft,warehouse}=await documentFixture(request);const second=(await request('/api/warehouses',{method:'POST',body:{code:'WH2',name:'Kho nhận',kind:'parts'}})).payload.data;
 for(const kind of ['issue','recovery','liquidation','warehouse_transfer','equipment_transfer','rotation','opening']){
  const next={...draft,kind,to_warehouse_id:kind==='warehouse_transfer'?second.id:'',lines:draft.lines.map(l=>({...l,id:crypto.randomUUID(),unit_price:kind==='opening'?'100':'',stock_state:kind==='liquidation'?'pending_scrap':['retread','recovery'].includes(kind)?'recovered':'new'}))};
  const r=await request('/api/document-drafts',{method:'POST',body:{draft:next,idempotency_key:kind}});assert.equal(r.status,201,kind+JSON.stringify(r.payload));if(kind==='equipment_transfer')assert.equal(r.payload.data.code,'10.26.00002/PĐC');
 }
 assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,kind:'warehouse_transfer',to_warehouse_id:warehouse.id},idempotency_key:'same'}})).status,400);
});
scenario('proposal snapshots require assigned all approvers; editing workflow does not affect pending documents',async({request,sql})=>{
 const {draft}=await documentFixture(request,'proposal');const unit=(await request('/api/org-units',{method:'POST',body:{code:'U',name:'Unit'}})).payload.data;
 const dept=(await request('/api/departments',{method:'POST',body:{code:'D',name:'Dept',unit_id:unit.id,kind:'employee'}})).payload.data;draft.department_id=dept.id;
 const config={name:'Quy trình mua',department_id:dept.id,proposal_type:'purchase',is_active:1,steps:[{label:'Đồng duyệt',mode:'all',approver_ids:['admin','accountant']}]};
 assert.equal((await request('/api/document-workflows',{method:'POST',role:'accountant',body:config})).status,403);const wf=await request('/api/document-workflows',{method:'POST',body:config});assert.equal(wf.status,201,JSON.stringify(wf.payload));
 const create=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'proposal'}});assert.equal(create.status,201,JSON.stringify(create.payload));let row=create.payload.data;assert.equal(row.code,'10.26.00001/PĐX/D');
 const act=async(action,role='admin')=>request('/api/document-drafts/'+row.id,{method:'PATCH',role,body:{version:row.version,action,reason:'Thử '+action}});
 row=(await act('submit')).payload.data;assert.equal(row.status,'pending');
 assert.equal((await request('/api/document-workflows/'+wf.payload.data.id,{method:'PATCH',body:{...config,version:1,steps:[{label:'Mới',mode:'any',approver_ids:['admin']}]}})).status,200);
 row=(await act('approve')).payload.data;assert.equal(row.status,'pending');assert.equal((await act('approve')).status,409);
 row=(await act('approve','accountant')).payload.data;assert.equal(row.status,'approved');assert.equal(row.workflow_snapshot.steps[0].label,'Đồng duyệt');
 row=(await act('revoke')).payload.data;assert.equal(row.status,'returned');row=(await act('submit')).payload.data;assert.equal(row.workflow_snapshot.steps[0].label,'Mới');assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
});

scenario('draft counter and lines roll back if immutable history write fails',async({request,sql})=>{
 const {draft}=await documentFixture(request);sql.exec("CREATE TRIGGER fail_draft_audit BEFORE INSERT ON document_draft_events BEGIN SELECT RAISE(ABORT,'draft test failure'); END;");
 const result=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'rollback'}});assert.equal(result.status,500);assert.equal(sql.prepare('SELECT count(*) n FROM document_drafts').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM document_counters').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM document_draft_lines').get().n,0);
 sql.exec('DROP TRIGGER fail_draft_audit');const retry=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'rollback'}});assert.equal(retry.payload.data.code,'10.26.00001/PN');
});
scenario('receipt oil requires its warehouse tank and consumed oil cannot be recovered even as a draft',async({request})=>{
 const {draft,warehouse}=await documentFixture(request);const oil=(await request('/api/parts',{method:'POST',body:{...part,sku:'M-DC-TIEU-0020',is_fuel:1,name:'Dầu DO',unit:'Lít'}})).payload.data;draft.lines[0].part_id=oil.id;
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'oil-no-tank'}})).status,400);
 const tank=(await request('/api/fuel-tanks',{method:'POST',body:{code:'TANK',name:'Bồn dầu',warehouse_id:warehouse.id,capacity_milli:10000000}})).payload.data;assert.ok(tank);draft.lines[0].tank_id=tank.id;
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'oil-good'}})).status,201);
 const recovery={...draft,kind:'recovery',lines:draft.lines.map(l=>({...l,id:crypto.randomUUID(),unit_price:'',stock_state:'recovered'}))};assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:recovery,idempotency_key:'oil-recovery'}})).status,400);
});

scenario('retread preparation accepts a single tire serial and rejects non-serial material',async({request})=>{
 const {draft}=await documentFixture(request,'retread',true);draft.lines[0].serial='000-TIRE-001';const result=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'retread'}});assert.equal(result.status,201,JSON.stringify(result.payload));assert.equal(result.payload.data.code,'10.26.00001/DV');
 const material=(await request('/api/parts',{method:'POST',body:{...part,sku:'NOT-TIRE'}})).payload.data;draft.lines[0].part_id=material.id;draft.lines[0].id=crypto.randomUUID();assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'wrong-retread'}})).status,400);
});

scenario('document reference flags reject unrelated serial, tank and data; line IDs are scoped per document',async({request,sql})=>{
 const {draft,item}=await documentFixture(request);for(const change of [{serial:'0001'},{tank_id:'anything'},{data_package:'GOI90'}]){const result=await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,lines:[{...draft.lines[0],...change}]},idempotency_key:JSON.stringify(change)}});assert.equal(result.status,400,JSON.stringify(result.payload));assert.match(result.payload.error.message,/Dòng 1/);}
 const first=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'same-line-1'}});assert.equal(first.status,201,JSON.stringify(first.payload));const second=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'same-line-2'}});assert.equal(second.status,201,JSON.stringify(second.payload));assert.equal(first.payload.data.draft.lines[0].id,second.payload.data.draft.lines[0].id);assert.equal(sql.prepare('SELECT count(*) n FROM document_draft_lines').get().n,2);
 const fuel=(await request('/api/parts',{method:'POST',body:{...part,sku:'FUEL-NOT-HARDCODED',is_fuel:1}})).payload.data;const noTank=await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,lines:[{...draft.lines[0],part_id:fuel.id}]},idempotency_key:'flag-fuel'}});assert.equal(noTank.status,400);assert.match(noTank.payload.error.message,/bồn/);
 const sim=(await request('/api/parts',{method:'POST',body:{...part,sku:'UNRELATED-CODE',needs_data_package:1}})).payload.data;const valid=await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,lines:[{...draft.lines[0],part_id:sim.id,data_package:'GOI90'}]},idempotency_key:'flag-data'}});assert.equal(valid.status,201,JSON.stringify(valid.payload));assert.equal((await request('/api/document-drafts?kind=receipt&q=goi90')).payload.pagination.total,1);
});
scenario('proposal search folds accents and duplicate workflow returns an actionable conflict',async({request})=>{
 const {draft}=await documentFixture(request,'proposal');const unit=(await request('/api/org-units',{method:'POST',body:{code:'UU',name:'Đơn vị'}})).payload.data;const dept=(await request('/api/departments',{method:'POST',body:{code:'DD',name:'Phòng',unit_id:unit.id,kind:'employee'}})).payload.data;draft.department_id=dept.id;
 const config={name:'Duyệt',department_id:dept.id,proposal_type:'purchase',is_active:1,steps:[{label:'Duyệt',mode:'any',approver_ids:['admin']}]};assert.equal((await request('/api/document-workflows',{method:'POST',body:config})).status,201);const duplicate=await request('/api/document-workflows',{method:'POST',body:config});assert.equal(duplicate.status,409,JSON.stringify(duplicate.payload));assert.equal(duplicate.payload.error.message,'Đã có quy trình cho bộ phận và loại này');
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pdx-search'}})).status,201);assert.equal((await request('/api/document-drafts?kind=proposal&q=pdx')).payload.pagination.total,1);
 const fractional={...draft,proposal:{purchase_cost:'100.5',labor_cost:'0',other_cost:'0',vat_cost:'0'}};assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:fractional,idempotency_key:'fractional'}})).status,400);
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,kind:'external_repair'},idempotency_key:'removed-scn'}})).status,400);
});
scenario('serial is searchable and flagged numeric strings remain textual identifiers',async({request})=>{
 const {draft}=await documentFixture(request,'receipt',true);draft.lines[0].serial='0000-AbC';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'serial-search'}})).status,201);assert.equal((await request('/api/document-drafts?kind=receipt&q=0000-abc')).payload.pagination.total,1);
});

scenario('next document number is read-only and concurrent previews never reserve duplicate final numbers',async({request,sql})=>{
 const {draft}=await documentFixture(request);const url='/api/document-drafts?view=next-number&kind=receipt&date=2026-10-25';const a=await request(url),b=await request(url);assert.equal(a.status,200);assert.equal(a.payload.data.code,'10.26.00001/PN');assert.equal(b.payload.data.code,a.payload.data.code);assert.equal(sql.prepare('SELECT count(*) n FROM document_counters').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM document_drafts').get().n,0);
 const saved1=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'preview-1'}});const saved2=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'preview-2'}});assert.equal(saved1.payload.data.code,'10.26.00001/PN');assert.equal(saved2.payload.data.code,'10.26.00002/PN');assert.equal((await request(url)).payload.data.code,'10.26.00003/PN');assert.equal((await request(url.replace('2026-10-25','2026-11-01'))).payload.data.code,'11.26.00001/PN');
 assert.equal((await request(url.replace('2026-10-25','2026-02-31'))).status,400);assert.equal((await request(url.replace('kind=receipt','kind=external_repair'))).status,400);
 const unit=(await request('/api/org-units',{method:'POST',body:{code:'NN',name:'Unit'}})).payload.data;const dept=(await request('/api/departments',{method:'POST',body:{code:'KHO',name:'Kho',unit_id:unit.id,kind:'employee'}})).payload.data;assert.equal((await request(url.replace('kind=receipt','kind=proposal')+'&department_id='+dept.id)).payload.data.code,'10.26.00001/PĐX/KHO');
});

scenario('multi serial rows round trip separately, drafts allow shortages and save never creates stock',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].quantity='5';draft.lines[0].serials=['00001','00002'];const result=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'multi'}});assert.equal(result.status,201,JSON.stringify(result.payload));let row=result.payload.data;assert.equal(row.draft.lines.length,1);assert.deepEqual(row.draft.lines[0].serials,['00001','00002']);assert.equal(sql.prepare('SELECT count(*) n FROM document_draft_serials').get().n,2);const raw=JSON.parse(sql.prepare('SELECT line_json FROM document_draft_lines').get().line_json);assert.equal(raw.serials,undefined);assert.equal(raw.serial,'');assert.equal(sql.prepare('SELECT count(*) n FROM inventory_serials').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
 const bad=structuredClone(draft);bad.lines[0].serials=['00001','00001'];assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:bad,idempotency_key:'multi-dup'}})).status,400);
 sql.prepare("INSERT INTO inventory_serials(part_id,serial_key,serial_number,warehouse_id,stock_state,status) VALUES (?,?,?,?,'new','in_stock')").run(item.id,'00003','00003',warehouse.id);const check=await request('/api/document-drafts?view=serial-check&part_id='+item.id+'&serial=00003');assert.deepEqual(check.payload.data.conflicts,['00003']);bad.lines[0].serials=['00003'];assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:bad,idempotency_key:'multi-stock'}})).status,400);
 draft.lines[0].serials=['00004'];const edit=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Đổi serial nháp',draft}});assert.equal(edit.status,200,JSON.stringify(edit.payload));assert.equal(sql.prepare('SELECT count(*) n FROM document_draft_serials').get().n,1);assert.equal(edit.payload.data.draft.lines[0].serials[0],'00004');
});
scenario('proposal submission requires all expected serials even though draft save permits missing ones',async({request})=>{
 const {draft}=await documentFixture(request,'proposal',true);const unit=(await request('/api/org-units',{method:'POST',body:{code:'SS',name:'Serial unit'}})).payload.data;const dept=(await request('/api/departments',{method:'POST',body:{code:'S',name:'Serial',unit_id:unit.id,kind:'employee'}})).payload.data;draft.department_id=dept.id;draft.lines[0].quantity='2';draft.lines[0].serials=['SN001'];const config={name:'Serial approval',department_id:dept.id,proposal_type:'purchase',is_active:1,steps:[{label:'Approve',mode:'any',approver_ids:['admin']}]};assert.equal((await request('/api/document-workflows',{method:'POST',body:config})).status,201);const create=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'serial-approval'}});assert.equal(create.status,201,JSON.stringify(create.payload));let row=create.payload.data;const missing=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'submit',version:row.version,reason:'Gửi'}});assert.equal(missing.status,400);assert.match(missing.payload.error.message,/chưa đủ serial/);draft.lines[0].serials=['SN001','SN002'];row=(await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Bổ sung',draft}})).payload.data;assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'submit',version:row.version,reason:'Đủ serial'}})).payload.data.status,'pending');
});

scenario('decimal unit prices persist without loss and receipt totals round to whole VND',async({request})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='50';draft.lines[0].unit_price='3703703.7';draft.lines[0].vat_rate='8';const result=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'decimal-price'}});assert.equal(result.status,201,JSON.stringify(result.payload));assert.equal(result.payload.data.draft.lines[0].unit_price,'3703703.7');assert.deepEqual(result.payload.data.totals,{net:185185185,vat:14814815,gross:200000000});draft.lines[0].unit_price='1.1234567890123';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'decimal-overprecision'}})).status,400);
});

scenario('receipt save posts actual quantity, net stock value and VAT separately, idempotent replay cannot double stock',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request);draft.lines[0].quantity='50';draft.lines[0].document_quantity='60';draft.lines[0].unit_price='3703703.7';draft.lines[0].vat_rate='8';const body={draft,idempotency_key:'post-receipt',commit:true};const result=await request('/api/document-drafts',{method:'POST',body});assert.equal(result.status,201,JSON.stringify(result.payload));const row=result.payload.data;assert.equal(row.status,'posted');assert.equal(sql.prepare('SELECT status FROM inventory_documents').get().status,'posted');assert.equal(sql.prepare('SELECT quantity_delta_milli FROM stock_movements').get().quantity_delta_milli,50000);assert.equal(sql.prepare('SELECT value_delta_vnd FROM stock_movements').get().value_delta_vnd,185185185);assert.deepEqual({...sql.prepare('SELECT net_vnd,vat_vnd,gross_vnd FROM receipt_line_details').get()},{net_vnd:185185185,vat_vnd:14814815,gross_vnd:200000000});assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,50000);assert.equal((await request('/api/document-drafts?view=stock&part_id='+item.id+'&warehouse_id='+warehouse.id)).payload.data.quantity_milli,50000);
 const replay=await request('/api/document-drafts',{method:'POST',body});assert.equal(replay.payload.data.id,row.id);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_documents').get().n,1);assert.equal((await request('/api/document-drafts?kind=receipt&status=posted')).payload.pagination.total,1);
 assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{version:row.version,action:'cancel',reason:'Không được hủy'}})).status,409);assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{version:row.version,action:'save',reason:'Sửa khi chưa xuất',draft,commit:true}})).status,200);assert.throws(()=>sql.prepare('UPDATE document_draft_lines SET line_number=2 WHERE document_id=?').run(row.id));
});
scenario('receipt posting requires complete serials and atomically records each stock serial',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'receipt',true);draft.lines[0].quantity='3';draft.lines[0].serials=['S0001'];assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-short',commit:true}})).status,400);assert.equal(sql.prepare('SELECT count(*) n FROM document_drafts').get().n,0);draft.lines[0].serials=['S0001','S0002','S0003'];const good=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-serial',commit:true}});assert.equal(good.status,201,JSON.stringify(good.payload));assert.equal(sql.prepare('SELECT count(*) n FROM inventory_serials').get().n,3);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,3000);assert.deepEqual((await request('/api/document-drafts?view=serial-check&part_id='+item.id+'&serial=S0001')).payload.data.conflicts,['S0001']);const again=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-dup',commit:true}});assert.equal(again.status,400);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_documents').get().n,1);
});
scenario('receipt posting failure rolls back counters, metadata, stock and serials together',async({request,sql})=>{
 const {draft}=await documentFixture(request,'receipt',true);draft.lines[0].serials=['ROLLBACK-0001'];sql.exec("CREATE TRIGGER fail_receipt_event BEFORE INSERT ON document_draft_events BEGIN SELECT RAISE(ABORT,'receipt audit failure'); END;");const bad=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-rollback',commit:true}});assert.equal(bad.status,500);for(const table of ['document_counters','document_drafts','inventory_documents','inventory_document_lines','stock_movements','stock_balances','inventory_serials'])assert.equal(sql.prepare('SELECT count(*) n FROM '+table).get().n,0,table);sql.exec('DROP TRIGGER fail_receipt_event');assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-rollback',commit:true}})).status,201);
});
scenario('existing receipt draft can be saved into stock only once; other document kinds cannot commit',async({request,sql})=>{
 const {draft}=await documentFixture(request);const created=(await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'legacy-draft'}})).payload.data;const posted=await request('/api/document-drafts/'+created.id,{method:'PATCH',body:{action:'save',version:1,reason:'Nhập kho',draft,commit:true}});assert.equal(posted.status,200,JSON.stringify(posted.payload));assert.equal(posted.payload.data.status,'posted');assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,1);const bad=await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,kind:'opening'},idempotency_key:'bad-kind',commit:true}});assert.equal(bad.status,409);
});

scenario('receipt commit rejects wrong warehouse scope, locked periods and missing price before touching stock',async({request,sql})=>{
 const {draft}=await documentFixture(request);assert.equal((await request('/api/document-drafts',{method:'POST',role:'warehouse',body:{draft,idempotency_key:'post-scope',commit:true}})).status,403);draft.lines[0].unit_price='';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-price',commit:true}})).status,400);draft.lines[0].unit_price='100';sql.exec("INSERT INTO accounting_periods(period,is_locked,locked_by,locked_at) VALUES ('2026-10',1,'admin','2026-10-31');");assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-lock',commit:true}})).status,409);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
});
scenario('simultaneous receipt commits with the same serial cannot double-post stock',async({request,sql})=>{
 const {draft}=await documentFixture(request,'receipt',true);draft.lines[0].serials=['RACE0001'];const results=await Promise.all(['A','B'].map(key=>request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'post-race-'+key,commit:true}})));assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));assert.ok(results.some(r=>[400,409].includes(r.status)),JSON.stringify(results));assert.equal(sql.prepare('SELECT count(*) n FROM inventory_documents').get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,1);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,1000);assert.equal(sql.prepare('SELECT last_no FROM document_counters').get().last_no,1);
});

scenario('receipt posting rechecks a period lock introduced between validation and the batch',async({request,sql,env})=>{
 const {draft}=await documentFixture(request);const original=env.DB.batch;let injected=false;env.DB.batch=async statements=>{if(!injected&&statements.some(statement=>statement.query.includes('INSERT INTO inventory_documents'))){injected=true;sql.exec("INSERT INTO accounting_periods(period,is_locked,locked_by,locked_at) VALUES ('2026-10',1,'admin','2026-10-31');");}return original(statements);};const result=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'lock-race',commit:true}});assert.equal(result.status,409,JSON.stringify(result.payload));assert.equal(result.payload.error.code,'PERIOD_LOCKED');assert.equal(sql.prepare('SELECT count(*) n FROM inventory_documents').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
});

scenario('posted receipt can be edited and deleted before use, keeping audit and number',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='5';draft.lines[0].unit_price='100';let row=(await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'editable',commit:true}})).payload.data;assert.equal(row.can_modify,true);
 draft.lines[0].quantity='3';draft.lines[0].unit_price='200';let r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Sửa số lượng',draft,commit:true}});assert.equal(r.status,200,JSON.stringify(r.payload));row=r.payload.data;assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,3000);assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,600);
 r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'delete',version:row.version,reason:'Nhập nhầm'}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,0);assert.equal(sql.prepare('SELECT count(*) n FROM current_stock WHERE quantity_milli<>0').get().n,0);assert.equal((await request('/api/document-drafts?kind=receipt')).payload.pagination.total,0);assert.equal(sql.prepare('SELECT count(*) n FROM receipt_mutation_locks').get().n,0);
});
scenario('issue posts FIFO stock and permanently blocks editing its receipt; recovery restores stock',async({request,sql})=>{
 const {draft}=await documentFixture(request);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();draft.lines[0].quantity='5';draft.lines[0].unit_price='100';const pn=(await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pn',commit:true}})).payload.data;
 const px=structuredClone(draft);px.kind='issue';px.issue_details=await issueHeaderFixture(request);px.business_at='2026-10-24T09:00';px.lines[0].unit_price='';px.lines[0].quantity='2';let r=await request('/api/document-drafts',{method:'POST',body:{draft:px,idempotency_key:'px',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,3000);assert.equal(r.payload.data.totals.net,200);
 for(const action of ['delete','save']){r=await request('/api/document-drafts/'+pn.id,{method:'PATCH',body:{action,version:pn.version,reason:'Không cho sửa',draft,commit:true}});assert.equal(r.status,409,JSON.stringify(r.payload));}
 const th=structuredClone(px);th.kind='recovery';delete th.issue_details;th.business_at='2026-10-24T10:00';th.lines[0].stock_state='recovered';th.lines[0].odo='100';th.lines[0].quantity='1';th.lines[0].usage_id=sql.prepare('SELECT id FROM stock_usages').get().id;r=await request('/api/document-drafts',{method:'POST',body:{draft:th,idempotency_key:'th',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,4000);
 px.lines[0].quantity='100';r=await request('/api/document-drafts',{method:'POST',body:{draft:px,idempotency_key:'over',commit:true}});assert.equal(r.status,409);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,4000);
});
scenario('warehouse transfer conserves global quantity and value and traces receipt sources',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='5';draft.lines[0].unit_price='100';await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pn',commit:true}});const wh=(await request('/api/warehouses',{method:'POST',body:{code:'SECOND',name:'Kho nhận',kind:'parts'}})).payload.data;
 draft.kind='warehouse_transfer';draft.to_warehouse_id=wh.id;draft.business_at='2026-10-24T09:00';draft.lines[0].unit_price='';draft.lines[0].quantity='2';const r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'transfer',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT sum(quantity_milli) q FROM stock_balances').get().q,5000);assert.equal(sql.prepare('SELECT sum(value_vnd) v FROM stock_balances').get().v,500);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances WHERE warehouse_id=?').get(wh.id).quantity_milli,2000);
});

scenario('opening and serial warehouse transfer post atomically; duplicate opening is blocked',async({request,sql})=>{
 const {draft,warehouse,item}=await documentFixture(request,'opening',true);draft.lines[0].quantity='2';draft.lines[0].serials=['S01','S02'];let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'sd',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const again=await request('/api/document-drafts',{method:'POST',body:{draft:{...draft,lines:[{...draft.lines[0],serials:['S03','S04']}]},idempotency_key:'sd2',commit:true}});assert.equal(again.status,409,JSON.stringify(again.payload));
 const wh=(await request('/api/warehouses',{method:'POST',body:{code:'DEST',name:'Kho nhận',kind:'parts'}})).payload.data;draft.kind='warehouse_transfer';draft.to_warehouse_id=wh.id;draft.lines[0].unit_price='';draft.lines[0].quantity='1';draft.lines[0].serials=['S01'];draft.business_at='2026-10-24T09:00';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'ck',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT warehouse_id FROM inventory_serials WHERE serial_key=?').get('S01').warehouse_id,wh.id);assert.equal(sql.prepare('SELECT sum(quantity_milli) q FROM stock_balances').get().q,2000);
});
scenario('retread sends recovered serial and receives it once with repair cost',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'retread',true);const opening=structuredClone(draft);opening.kind='opening';opening.lines[0].unit_price='100';opening.lines[0].serial='TIRE01';let r=await request('/api/document-drafts',{method:'POST',body:{draft:opening,idempotency_key:'sd',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));draft.business_at='2026-10-24T09:00';draft.lines[0].serial='TIRE01';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'send',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const row=r.payload.data;assert.equal(row.operation_state,'sent');assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,0);
 draft.business_at='2026-10-25T10:00';draft.lines[0].returned_serial='TIRE02';draft.lines[0].retread_cost='50';r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'receive',version:row.version,reason:'Nhận vỏ',draft}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.operation_state,'received');assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,150);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,1000);assert.equal((await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'receive',version:r.payload.data.version,reason:'Nhận lại',draft}})).status,409);
 const base='/api/inventory-books?book=card&part_id='+item.id;let book=await request(base+'&from=2026-10-24&to=2026-10-24');assert.equal(book.status,200,JSON.stringify(book.payload));assert.equal(book.payload.data.length,1);assert.equal(book.payload.data[0].business_at,'2026-10-24T09:00');assert.equal(book.payload.data[0].serials,'TIRE01');assert.equal(book.payload.groups[0].closing_quantity_milli,0);
 book=await request(base+'&from=2026-10-25&to=2026-10-25');assert.equal(book.status,200,JSON.stringify(book.payload));assert.equal(book.payload.data.length,1);assert.equal(book.payload.data[0].business_at,'2026-10-25T10:00');assert.equal(book.payload.data[0].kind,'retread_receive');assert.equal(book.payload.data[0].serials,'TIRE02');assert.equal(book.payload.data[0].in_value_vnd,150);assert.equal(book.payload.data[0].draft_id,row.id);assert.equal(book.payload.groups[0].opening_quantity_milli,0);assert.equal(book.payload.groups[0].closing_quantity_milli,1000);

});
scenario('pending scrap recovery can be liquidated, with no negative or new stock liquidation',async({request,sql})=>{
 const {draft}=await documentFixture(request);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pn',commit:true}});draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.business_at='2026-10-24T09:00';let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'px',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));draft.kind='recovery';delete draft.issue_details;draft.lines[0].stock_state='pending_scrap';draft.lines[0].odo='100';draft.lines[0].usage_id=sql.prepare('SELECT id FROM stock_usages').get().id;draft.business_at='2026-10-24T10:00';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'th',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));draft.kind='liquidation';delete draft.issue_details;draft.lines[0].usage_id='';draft.business_at='2026-10-24T11:00';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'tl',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,0);
});

scenario('equipment transfer and rotation move usage without making warehouse stock',async({request,sql})=>{
 const {draft}=await documentFixture(request);await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pn',commit:true}});const a=(await request('/api/vehicles',{method:'POST',body:{plate_number:'A-01',type:'tractor'}})).payload.data;const b=(await request('/api/vehicles',{method:'POST',body:{plate_number:'B-01',type:'tractor'}})).payload.data;
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.lines[0].target_id=a.id;draft.lines[0].to_position='L1';draft.business_at='2026-10-24T09:00';let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'px',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));let usage=sql.prepare('SELECT id FROM stock_usages WHERE open_quantity_milli>0').get().id;
 for(const [kind,key,time] of [['equipment_transfer','move','10:00'],['rotation','rotate','11:00']]){draft.kind=kind;delete draft.issue_details;draft.lines[0].usage_id=usage;draft.lines[0].target_id=b.id;draft.lines[0].to_position=key;draft.business_at='2026-10-24T'+time;r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));usage=sql.prepare('SELECT id FROM stock_usages WHERE open_quantity_milli>0').get().id;assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,2);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,0);}
 assert.equal(sql.prepare('SELECT count(*) n FROM equipment_operations').get().n,2);
});
scenario('concurrent issues cannot overdraw and receipt mutations roll back on audit failure',async({request,sql})=>{
 const {draft}=await documentFixture(request);let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pn',commit:true}});const pn=r.payload.data;sql.exec("CREATE TRIGGER fail_edit_audit BEFORE INSERT ON document_draft_events BEGIN SELECT RAISE(ABORT,'audit failed'); END");draft.lines[0].quantity='2';r=await request('/api/document-drafts/'+pn.id,{method:'PATCH',body:{action:'save',version:pn.version,reason:'Sửa',draft,commit:true}});assert.equal(r.status,500);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,1000);assert.equal(sql.prepare('SELECT count(*) n FROM receipt_mutation_locks').get().n,0);sql.exec('DROP TRIGGER fail_edit_audit');draft.lines[0].quantity='1';draft.lines[0].unit_price='';draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.business_at='2026-10-24T09:00';const both=await Promise.all(['A','B'].map(key=>request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:key,commit:true}})));assert.equal(both.filter(r=>r.status===201).length,1,JSON.stringify(both));assert.equal(both.filter(r=>r.status===409).length,1,JSON.stringify(both));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,0);
});
scenario('serialized receipt edits retain own serials while rejecting foreign serials',async({request,sql})=>{
 const {draft}=await documentFixture(request,'receipt',true);draft.lines[0].serials=['EDIT01'];let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'pn',commit:true}});const row=r.payload.data;const check=await request('/api/document-drafts?view=serial-check&part_id='+draft.lines[0].part_id+'&serial=EDIT01&exclude_document='+row.id);assert.equal(check.status,200);assert.deepEqual(check.payload.data.conflicts,[]);draft.lines[0].unit_price='20';r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Sửa giá',draft,commit:true}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT count(*) n FROM inventory_serials').get().n,1);assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,20);
});

scenario('weighted-average costing also protects unconsumed receipts contributing to cost',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines[0].unit_price='100';let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'one',commit:true}});assert.equal(r.status,201);draft.lines[0].unit_price='200';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'two',commit:true}});const second=r.payload.data;draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.business_at='2026-10-24T09:00';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'out',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,150);assert.equal((await request('/api/document-drafts/'+second.id)).payload.data.can_modify,false);r=await request('/api/document-drafts/'+second.id,{method:'PATCH',body:{action:'delete',version:second.version,reason:'Không xóa nguồn tính giá vốn'}});assert.equal(r.status,409);assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,150);
});

scenario('one receipt line with fifty serials persists fifty independent records and exact invoice-derived price',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].quantity='50';draft.lines[0].document_quantity='50';draft.lines[0].unit_price='';draft.lines[0].pricing_mode='line_gross';draft.lines[0].pricing_value='200000000';draft.lines[0].vat_rate='8';draft.lines[0].serials=Array.from({length:50},(_,i)=>'SN'+String(i+1).padStart(4,'0'));const body={draft,idempotency_key:'fifty-exact',commit:true};let r=await request('/api/document-drafts',{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));const row=r.payload.data;assert.deepEqual(row.totals,{net:185185185,vat:14814815,gross:200000000});assert.equal(row.draft.lines.length,1);assert.equal(row.draft.lines[0].unit_price,'');assert.equal(row.draft.lines[0].pricing_value,'200000000');assert.equal(sql.prepare('SELECT count(*) n FROM inventory_document_lines').get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_serials').get().n,50);assert.equal(sql.prepare('SELECT count(*) n FROM document_draft_serials').get().n,50);const line=sql.prepare('SELECT * FROM inventory_document_lines').get();assert.equal(line.unit_price_numerator,'100000000');assert.equal(line.unit_price_denominator,'27');const raw=JSON.parse(sql.prepare('SELECT line_json FROM document_draft_lines').get().line_json);assert.equal(raw.serials,undefined);assert.equal(raw.serial,'');assert.equal((await request('/api/document-drafts',{method:'POST',body})).status,200);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_serials').get().n,50);
 const later=structuredClone(draft);later.business_at='2026-10-24T09:00';Object.assign(later.lines[0],{quantity:'1',pricing_mode:'unit_net',pricing_value:'',unit_price:'100',serials:['SN0051']});r=await request('/api/document-drafts',{method:'POST',body:{draft:later,idempotency_key:'later',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal((await request('/api/document-drafts?view=stock&part_id='+item.id+'&warehouse_id='+warehouse.id)).payload.data.quantity_milli,51000);assert.equal((await request('/api/document-drafts?view=stock&part_id='+item.id+'&warehouse_id='+warehouse.id+'&exclude_document='+row.id)).payload.data.quantity_milli,0);
});
scenario('after-VAT unit price and high precision net input retain their exact sources',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='50';draft.lines[0].vat_rate='8';draft.lines[0].unit_price='';draft.lines[0].pricing_mode='unit_gross';draft.lines[0].pricing_value='4000000';let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'gross-unit',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.gross,200000000);assert.equal(sql.prepare('SELECT unit_price_denominator FROM inventory_document_lines').get().unit_price_denominator,'27');
 draft.lines[0].pricing_mode='unit_net';draft.lines[0].pricing_value='';draft.lines[0].unit_price='3703703.703703703703';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'precise-unit',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.draft.lines[0].unit_price,'3703703.703703703703');assert.equal(sql.prepare("SELECT unit_price_numerator FROM inventory_document_lines WHERE document_id=?").get(r.payload.data.id).unit_price_numerator,'3703703703703703703');assert.equal(r.payload.data.totals.gross,200000000);
 draft.lines[0].pricing_mode='line_gross';draft.lines[0].pricing_value='200000000.5';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'fractional-invoice',commit:true}});assert.equal(r.status,400);
});

scenario('receipt filters combine warehouse supplier dates and every serial including legacy search indexes',async({request,sql})=>{
 const {draft,warehouse}=await documentFixture(request,'receipt',true);const supplier=(await request('/api/suppliers',{method:'POST',body:{name:'NCC bộ lọc',tax_code:'0012345678',address:'12 Đường A',province_name:'Hồ Chí Minh'}})).payload.data;draft.supplier_id=supplier.id;draft.invoice_number='0000123';draft.invoice_date='2026-10-20';draft.purpose='Mua lốp';draft.lines[0].quantity='3';draft.lines[0].serials=['B65006700','SECOND00001','LITERAL%_01'];let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'filter-source'}});assert.equal(r.status,201,JSON.stringify(r.payload));const row=r.payload.data;assert.equal(row.labels['tax:suppliers:'+supplier.id],'0012345678');assert.equal(row.labels['address:suppliers:'+supplier.id],'12 Đường A');sql.prepare('UPDATE suppliers SET address=? WHERE id=?').run('Địa chỉ thay đổi',supplier.id);assert.equal((await request('/api/document-drafts/'+row.id)).payload.data.labels['address:suppliers:'+supplier.id],'12 Đường A');assert.equal(row.draft.invoice_date,'2026-10-20');assert.equal((await request('/api/document-drafts/'+row.id)).payload.data.draft.invoice_date,'2026-10-20');const listing=await request('/api/document-drafts?kind=receipt');const summary=listing.payload.data.find(x=>x.id===row.id);assert.deepEqual([...summary.serial_numbers].sort(),['B65006700','SECOND00001','LITERAL%_01'].sort());assert.equal(summary.last_edited_by_name,null);sql.prepare("INSERT INTO document_draft_events(id,document_id,actor_id,action,reason,before_json,after_json,request_id) VALUES (?,?,?,'save','Sửa thử','{}','{}','test-last-editor')").run('test-editor-event',row.id,row.created_by);const editedSummary=(await request('/api/document-drafts?kind=receipt')).payload.data.find(x=>x.id===row.id);assert.equal(editedSummary.last_edited_by_name,row.created_by_name);assert.equal(summary.total_quantity,'3000');assert.equal(summary.invoice_number,'00000123');assert.equal(summary.purpose,'Mua lốp');assert.ok(summary.created_by_name);sql.prepare("UPDATE document_drafts SET search_text='legacy header only' WHERE id=?").run(row.id);
 const creators=await request('/api/document-drafts?view=creators');assert.equal(creators.status,200);assert.ok(creators.payload.data.some(c=>c.id===row.created_by));
 const ownCreators=await request('/api/document-drafts?view=creators',{role:'warehouse'});assert.equal(ownCreators.status,200);assert.equal(ownCreators.payload.data.length,1);assert.notEqual(ownCreators.payload.data[0].id,row.created_by);
 assert.equal((await request('/api/document-drafts?kind=receipt&created_by='+row.created_by)).payload.pagination.total,1);
 const wrongCreator=await request('/api/document-drafts?kind=receipt&created_by=missing');assert.equal(wrongCreator.payload.pagination.total,0);assert.equal(wrongCreator.payload.receipt_totals.count,0);
 const base='/api/document-drafts?kind=receipt';for(const q of ['b65006700','second00001','%_']){r=await request(base+'&q='+encodeURIComponent(q)+'&warehouse_id='+warehouse.id+'&supplier_id='+supplier.id+'&from=2026-10-01&to=2026-10-31');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,1);}
 for(const query of ['warehouse_id=wrong','supplier_id=wrong','from=2026-11-01','to=2026-09-30'])assert.equal((await request(base+'&'+query)).payload.pagination.total,0);
 assert.equal((await request(base+'&from=2026-02-30')).status,400);assert.equal((await request(base+'&from=2026-10-26&to=2026-10-01')).status,400);assert.equal((await request(base+'&warehouse_id='+warehouse.id,{role:'warehouse'})).payload.pagination.total,0);
});

scenario('receipt filter totals cover all pages and retain unit boundaries',async({request})=>{
 const {draft,item}=await documentFixture(request);draft.lines[0].quantity='2.125';draft.lines[0].vat_rate='8';draft.purpose='TOTAL-SCOPE';
 let gross=0;
 for(let i=0;i<26;i++){const r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'summary-'+i}});assert.equal(r.status,201,JSON.stringify(r.payload));gross+=r.payload.data.totals.gross;}
 let r=await request('/api/document-drafts?kind=receipt&q=TOTAL-SCOPE');assert.equal(r.payload.data.length,25);assert.equal(r.payload.receipt_totals.count,26);assert.equal(r.payload.receipt_totals.quantity_milli,'55250');assert.equal(r.payload.receipt_totals.gross,String(gross));assert.equal(r.payload.receipt_totals.units.length,1);assert.ok(r.payload.receipt_totals.units[0]);
 r=await request('/api/document-drafts?kind=receipt&q=TOTAL-SCOPE&page=2');assert.equal(r.payload.data.length,1);assert.equal(r.payload.receipt_totals.count,26);for(const pageSize of [20,50,100]){const sized=await request('/api/document-drafts?kind=receipt&q=TOTAL-SCOPE&page_size='+pageSize);assert.equal(sized.payload.data.length,Math.min(pageSize,26));assert.equal(sized.payload.pagination.page_size,pageSize);assert.equal(sized.payload.receipt_totals.count,26);}
 const other=(await request('/api/parts',{method:'POST',body:{...part,sku:'LITRE-PART',unit:'Lít'}})).payload.data;
 const mixed=structuredClone(draft);mixed.lines.push({...mixed.lines[0],id:crypto.randomUUID(),part_id:other.id});mixed.purpose='MIXED-SCOPE';
 r=await request('/api/document-drafts',{method:'POST',body:{draft:mixed,idempotency_key:'mixed-summary'}});assert.equal(r.status,201,JSON.stringify(r.payload));
 r=await request('/api/document-drafts?kind=receipt&q=MIXED-SCOPE');assert.equal(r.payload.data[0].quantity_units.length,2);assert.equal(r.payload.receipt_totals.units.length,2);
 r=await request('/api/document-drafts?kind=receipt&q=NO-MATCH-SCOPE');assert.equal(r.payload.receipt_totals.count,0);assert.equal(r.payload.receipt_totals.gross,'0');
});

scenario('receipt paging can omit all total calculations while list and initial totals use one response',async({request,env})=>{
 const {draft}=await documentFixture(request);const saved=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'skip-total-source'}});assert.equal(saved.status,201,JSON.stringify(saved.payload));
 const original=env.DB.batch.bind(env.DB);const queries=[];env.DB.batch=async(statements)=>{queries.push(...statements.map(s=>s.query));return original(statements);};
 let r=await request('/api/document-drafts?kind=receipt&include_totals=1');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.receipt_totals.count,1);assert.equal(r.payload.receipt_totals.status_counts.posted,1);assert.equal(queries.length,3);
 const quantities=queries.find(q=>q.includes(' AS quantity_milli'));assert.ok(quantities);assert.ok(!quantities.includes('document_draft_serials'));
 queries.length=0;r=await request('/api/document-drafts?kind=receipt&include_totals=0&page=2');assert.equal(r.status,200);assert.equal(r.payload.receipt_totals,undefined);assert.equal(queries.length,2);assert.ok(!queries.some(q=>q.includes(' AS quantity_milli')||q.includes(' AS posted_count')||q.includes('sum(json_extract(d.totals_json')));
 assert.equal((await request('/api/document-drafts?kind=receipt&include_totals=2')).status,400);
});

scenario('related receipt costs are allocated into stock, line notes persist, unused edit and cancel reverse full landed value',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines=[{...draft.lines[0],quantity:'2',unit_price:'100',vat_rate:'10',notes:'Cầu trước'},{...draft.lines[0],id:crypto.randomUUID(),quantity:'1',unit_price:'300',vat_rate:'8',notes:'Cầu sau'}];draft.related_costs={transport:'100',unloading:'20',installation:'30',other:'5',vat:'15'};
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'costs'}});assert.equal(r.status,201,JSON.stringify(r.payload));let row=r.payload.data;assert.deepEqual(row.totals,{net:655,vat:59,gross:714});assert.equal(row.draft.lines[1].notes,'Cầu sau');assert.equal(row.draft.related_costs.installation,'30');assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,655);assert.deepEqual(sql.prepare('SELECT amount_vnd,unit_price_vnd_milli FROM inventory_document_lines ORDER BY line_number').all().map(l=>[l.amount_vnd,l.unit_price_vnd_milli]),[[262,131000],[393,393000]]);assert.equal(sql.prepare('SELECT sum(net_vnd) n FROM receipt_line_details').get().n,500);
 draft.related_costs.transport='200';r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Bổ sung vận chuyển',draft,commit:true}});assert.equal(r.status,200,JSON.stringify(r.payload));row=r.payload.data;assert.equal(row.totals.net,755);assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,755);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,3000);
 r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'delete',version:row.version,reason:'Nhập nhầm'}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,0);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,0);
});
scenario('related costs enter issue costing and cannot change once a receipt is used',async({request,sql})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='2';draft.lines[0].unit_price='100';draft.lines[0].vat_rate='8';draft.related_costs={transport:'100',unloading:'',installation:'',other:'',vat:'10'};
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'landed-source'}});assert.equal(r.status,201,JSON.stringify(r.payload));const receipt=r.payload.data;
 const out=structuredClone(draft);delete out.related_costs;out.kind='issue';out.issue_details=await issueHeaderFixture(request);out.business_at='2026-10-24T09:00';out.lines[0].quantity='1';out.lines[0].unit_price='';out.lines[0].vat_rate='0';r=await request('/api/document-drafts',{method:'POST',body:{draft:out,commit:true,idempotency_key:'landed-out'}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,150);assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,150);
 draft.related_costs.transport='200';r=await request('/api/document-drafts/'+receipt.id,{method:'PATCH',body:{action:'save',version:receipt.version,reason:'Không được sửa',draft,commit:true}});assert.equal(r.status,409);assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,150);
});
scenario('invalid related costs fail before creating inventory',async({request,sql})=>{
 const {draft}=await documentFixture(request);for(const cost of ['-1','1.25','1e3']){draft.related_costs={transport:cost};const r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'bad-cost-'+cost}});assert.equal(r.status,400,JSON.stringify(r.payload));}assert.equal(sql.prepare('SELECT count(*) n FROM inventory_documents').get().n,0);
});

scenario('receipt sorting orders all matched records before pagination and keeps missing amounts last',async({request})=>{
 const {draft}=await documentFixture(request);const rows=[];
 for(const [day,price] of [['24','100'],['23','300'],['22','200']]){draft.business_at='2026-10-'+day+'T08:00';draft.lines[0].unit_price=price;const r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'sort-'+day}});assert.equal(r.status,201);rows.push(r.payload.data);}
 let r=await request('/api/document-drafts?kind=receipt&sort=gross&direction=desc&page_size=1');assert.equal(r.payload.data[0].id,rows[1].id);
 r=await request('/api/document-drafts?kind=receipt&sort=gross&direction=desc&page_size=1&page=2&include_totals=0');assert.equal(r.payload.data[0].id,rows[2].id);assert.equal(r.payload.receipt_totals,undefined);
 r=await request('/api/document-drafts?kind=receipt&sort=code&direction=desc');assert.equal(r.payload.data[0].id,rows[2].id);
 r=await request('/api/document-drafts?kind=receipt&sort=business_at&direction=asc');assert.equal(r.payload.data[0].id,rows[2].id);
 draft.lines[0].unit_price='';const blank=(await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'sort-null'}})).payload.data;
 for(const direction of ['asc','desc']){r=await request('/api/document-drafts?kind=receipt&sort=gross&direction='+direction);assert.equal(r.payload.data.at(-1).id,blank.id);}
 assert.equal((await request('/api/document-drafts?kind=receipt&sort=unknown')).status,400);assert.equal((await request('/api/document-drafts?kind=receipt&direction=invalid')).status,400);
});

scenario('VAT catalog seeds four rates and dynamic receipt costs calculate individual VAT into total tax only',async({request,sql})=>{
 const rates=(await request('/api/vat-rates')).payload.data;assert.deepEqual(rates.map(r=>r.rate_pct),[0,5,8,10]);
 assert.equal((await request('/api/vat-rates',{method:'POST',body:{code:'VAT-DUP',name:'Trùng',rate_pct:8}})).status,409);
 assert.equal((await request('/api/vat-rates/'+rates[0].id,{method:'PATCH',body:{version:1,name:'Không có quyền'},role:'viewer'})).status,403);
 const {draft}=await documentFixture(request);draft.lines[0].unit_price='100';draft.lines[0].vat_rate='5';draft.related_cost_items=[{id:'c1',type:'transport',name:'Vận chuyển',amount:'1500000',vat_rate:'8'},{id:'c2',type:'unloading',name:'Bốc dỡ',amount:'300000',vat_rate:'10'}];
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'cost-items'}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.deepEqual(r.payload.data.totals,{net:1800100,vat:150005,gross:1950105});assert.equal(sql.prepare('SELECT value_vnd FROM stock_balances').get().value_vnd,1800100);assert.equal(r.payload.data.draft.related_cost_items[1].vat_rate,'10');
 for(const change of [{name:'',type:'other'},{vat_rate:'7'},{amount:'-1'}]){const bad=structuredClone(draft);Object.assign(bad.related_cost_items[0],change);r=await request('/api/document-drafts',{method:'POST',body:{draft:bad,commit:true,idempotency_key:'bad-item-'+JSON.stringify(change)}});assert.equal(r.status,400,JSON.stringify(r.payload));}
});
scenario('inactive VAT blocks new selection while existing receipt VAT snapshots remain editable',async({request})=>{
 const {draft}=await documentFixture(request);draft.lines[0].vat_rate='8';draft.related_cost_items=[{id:'old-cost',type:'other',name:'Phí cầu đường',amount:'1000',vat_rate:'8'}];
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'old-vat'}});assert.equal(r.status,201);const row=r.payload.data;
 r=await request('/api/vat-rates/vat-8',{method:'PATCH',body:{version:1,is_active:0}});assert.equal(r.status,200);
 r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'inactive-vat'}});assert.equal(r.status,400);
 const edited=structuredClone(row.draft);edited.related_cost_items[0].amount='2000';r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Giữ VAT đã lưu',draft:edited,commit:true}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.draft.related_cost_items[0].vat_rate,'8');
});

scenario('issue stock lookup and serial selection respect warehouse state posting and scope',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);
 draft.lines[0].quantity='2';draft.lines[0].serials=['ISSUE001','ISSUE002'];
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'issue-ui-pn',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const stock='/api/document-drafts?view=stock&part_id='+item.id+'&warehouse_id='+warehouse.id;
 assert.equal((await request(stock+'&stock_state=new')).payload.data.quantity_milli,2000);
 assert.equal((await request(stock+'&stock_state=recovered')).payload.data.quantity_milli,0);
 assert.equal((await request(stock+'&stock_state=wrong')).status,400);
 assert.equal((await request(stock+'&stock_state=new',{role:'warehouse'})).status,403);
 const serial='/api/document-drafts?view=available-serials&part_id='+item.id+'&warehouse_id='+warehouse.id;
 r=await request(serial+'&stock_state=new&page_size=1');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,2);assert.equal(r.payload.data.length,1);
 assert.equal((await request(serial+'&stock_state=recovered')).payload.pagination.total,0);
 assert.equal((await request(serial+'&stock_state=new',{role:'warehouse'})).status,403);
 const issue=structuredClone(draft);issue.kind='issue';issue.issue_details=await issueHeaderFixture(request);issue.business_at='2026-10-24T09:00';issue.recipient='Người nhận thử';issue.lines[0].unit_price='';issue.lines[0].quantity='1';issue.lines[0].serials=['ISSUE001'];
 r=await request('/api/document-drafts',{method:'POST',body:{draft:issue,idempotency_key:'issue-ui-px',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const issued=r.payload.data;
 r=await request(serial+'&stock_state=new');assert.deepEqual(r.payload.data.map(s=>s.serial_number),['ISSUE002']);
 assert.equal((await request(stock+'&stock_state=new')).payload.data.quantity_milli,1000);
 r=await request('/api/document-drafts?kind=issue&include_totals=1&warehouse_id='+warehouse.id);assert.equal(r.payload.receipt_totals.count,1);assert.equal(r.payload.receipt_totals.net,String(issued.totals.net));assert.equal(r.payload.data[0].partner_label,'Người nhận thử');
 assert.equal((await request('/api/document-drafts?kind=issue&include_totals=0&page=2')).payload.receipt_totals,undefined);
 assert.ok((await request('/api/document-drafts?view=creators&kind=issue')).payload.data.some(c=>c.id===issued.created_by));
 issue.lines[0].serials=['ISSUE001'];r=await request('/api/document-drafts',{method:'POST',body:{draft:issue,idempotency_key:'issue-ui-duplicate',commit:true}});assert.ok([400,409].includes(r.status));
 assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances WHERE part_id=? AND warehouse_id=?').get(item.id,warehouse.id).quantity_milli,1000);
});

scenario('issue source is automatic: serial keeps its own later lot while quantities use FIFO',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);
 draft.lines[0].quantity='1';draft.lines[0].serials=['SERIAL-EARLY'];
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'serial-early',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const early=sql.prepare('SELECT document_line_id FROM inventory_serials WHERE serial_key=?').get('SERIAL-EARLY').document_line_id;
 const later=structuredClone(draft);later.business_at='2026-10-24T08:45';later.lines[0].serials=['SERIAL-LATER'];
 r=await request('/api/document-drafts',{method:'POST',body:{draft:later,idempotency_key:'serial-later',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const late=sql.prepare('SELECT document_line_id FROM inventory_serials WHERE serial_key=?').get('SERIAL-LATER').document_line_id;
 const issue=structuredClone(draft);issue.kind='issue';issue.issue_details=await issueHeaderFixture(request);issue.business_at='2026-10-24T09:00';issue.lines[0].unit_price='';issue.lines[0].serials=['SERIAL-LATER'];issue.lines[0].source_line_id=early;
 r=await request('/api/document-drafts',{method:'POST',body:{draft:issue,idempotency_key:'no-manual-source',commit:true}});assert.equal(r.status,400);assert.match(r.payload.error.message,/nguồn nhập/);
 issue.lines[0].source_line_id='';r=await request('/api/document-drafts',{method:'POST',body:{draft:issue,idempotency_key:'serial-select-later',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 assert.equal(sql.prepare('SELECT remaining_quantity_milli n FROM stock_lots WHERE source_line_id=?').get(early).n,1000);
 assert.equal(sql.prepare('SELECT remaining_quantity_milli n FROM stock_lots WHERE source_line_id=?').get(late).n,0);
 const allocation=sql.prepare('SELECT source_line_id FROM stock_source_allocations WHERE consumer_line_id=(SELECT document_line_id FROM inventory_serials WHERE serial_key=?)').get('SERIAL-LATER');assert.equal(allocation.source_line_id,late);
 // A separate, non-serialized material is allocated from the oldest available lot.
 const plain=(await request('/api/parts',{method:'POST',body:{...part,sku:'FIFO-PLAIN',is_serialized:0}})).payload.data;
 const a=structuredClone(draft);a.lines[0].part_id=plain.id;a.lines[0].serials=[];
 r=await request('/api/document-drafts',{method:'POST',body:{draft:a,idempotency_key:'qty-early',commit:true}});assert.equal(r.status,201);
 const oldest=sql.prepare('SELECT source_line_id FROM stock_lots WHERE part_id=? ORDER BY available_at,source_line_id').get(plain.id).source_line_id;
 a.business_at='2026-10-24T08:50';r=await request('/api/document-drafts',{method:'POST',body:{draft:a,idempotency_key:'qty-later',commit:true}});assert.equal(r.status,201);
 a.kind='issue';a.issue_details=await issueHeaderFixture(request);a.business_at='2026-10-24T09:10';a.lines[0].unit_price='';r=await request('/api/document-drafts',{method:'POST',body:{draft:a,idempotency_key:'qty-fifo',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 assert.equal(sql.prepare('SELECT remaining_quantity_milli n FROM stock_lots WHERE source_line_id=?').get(oldest).n,0);
 assert.equal(sql.prepare('SELECT sum(remaining_quantity_milli) n FROM stock_lots WHERE part_id=?').get(plain.id).n,1000);
});

scenario('issue recipient department and vehicle metadata come from catalogs and survive later catalog changes',async({request,sql})=>{
 const create=async(path,body)=>{const r=await request(path,{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};
 const unit=await create('/api/org-units',{code:'ISSUNIT',name:'Đơn vị nhận'});
 const dept=await create('/api/departments',{code:'ISSDEPT',name:'Phòng vận hành',unit_id:unit.id});
 const receiver=await create('/api/staff',{code:'ISSREC',name:'Người nhận A',unit_id:unit.id,department_id:dept.id});
 const driver=await create('/api/staff',{code:'ISSDRV',name:'Tài xế B',staff_type:'driver'});
 await create('/api/equipment-parameters',{group_key:'route',code:'DCANG',name:'Đường cảng'});
 const vehicle=await create('/api/vehicles',{plate_number:'50E-123.45',type:'tractor',route_group:'DCANG',assigned_driver_id:driver.id,current_odo_km:123456});
 let r=await request('/api/document-drafts?view=issue-context&staff_id='+receiver.id+'&vehicle_id='+vehicle.id);assert.equal(r.status,200,JSON.stringify(r.payload));const info=r.payload.data;assert.equal(info.department_name,'Phòng vận hành');assert.equal(info.vehicle_group,'DCANG');assert.equal(info.driver_name,'Tài xế B');assert.equal(info.odo,'123456');
 const {draft}=await documentFixture(request,'issue');draft.recipient='Tên giả';draft.issue_details={...info,department_name:'Giả',driver_name:'Giả',vehicle_group:'office_car',odo:'123457.5'};delete draft.issue_details.recipient;
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'issue-header-context'}});assert.equal(r.status,201,JSON.stringify(r.payload));const row=r.payload.data;assert.equal(row.draft.recipient,'Người nhận A');assert.equal(row.draft.issue_details.department_name,'Phòng vận hành');assert.equal(row.draft.issue_details.vehicle_group,'DCANG');assert.equal(row.draft.issue_details.driver_name,'Tài xế B');assert.equal(row.draft.issue_details.odo,'123457.5');
 sql.prepare('UPDATE departments SET name=? WHERE id=?').run('Tên đổi sau',dept.id);sql.prepare('UPDATE vehicles SET route_group=? WHERE id=?').run('BNAM',vehicle.id);
 r=await request('/api/document-drafts/'+row.id);assert.equal(r.payload.data.draft.issue_details.department_name,'Phòng vận hành');assert.equal(r.payload.data.draft.issue_details.vehicle_group,'DCANG');
 assert.equal((await request('/api/document-drafts?view=issue-context&staff_id=missing')).status,400);
});

scenario('issue requires driver vehicle and ODO before posting and inherits header vehicle on new lines',async({request,sql})=>{
 const {draft}=await documentFixture(request,'issue');
 const valid=structuredClone(draft.issue_details);
 for(const field of ['driver_id','vehicle_id','odo']) {
  draft.issue_details={...valid,[field]:''};
  const r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'missing-'+field}});
  assert.equal(r.status,400,JSON.stringify(r.payload));
 }
 assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
 draft.issue_details=valid;
 const r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'header-target'}});
 assert.equal(r.status,201,JSON.stringify(r.payload));
 assert.equal(r.payload.data.draft.lines[0].target_id,valid.vehicle_id);
 assert.equal(r.payload.data.draft.lines[0].odo,valid.odo);
});

scenario('issue purposes persist and reject liquidation of new stock; generator comes from active pairing',async({request,sql})=>{
 const {draft}=await documentFixture(request,'issue');
 draft.lines[0].issue_purpose='liquidation';
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'new-liquidation',commit:true}});
 assert.equal(r.status,400);assert.match(r.payload.error.message,/Thanh lý.*hàng thu hồi/);
 assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
 draft.lines[0].stock_state='recovered';
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'recovered-purpose'}});
 assert.equal(r.status,201,JSON.stringify(r.payload));
 const saved=r.payload.data;
 assert.equal((await request('/api/document-drafts/'+saved.id)).payload.data.draft.lines[0].issue_purpose,'liquidation');
 draft.lines[0].issue_purpose='invalid';
 assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'invalid-purpose'}})).status,400);
 const gen=await request('/api/equipment',{method:'POST',body:{code:'PXGEN',name:'Máy phát thử',type:'generator'}});assert.equal(gen.status,201,JSON.stringify(gen.payload));
 const plate=draft.issue_details.vehicle_plate;
 sql.prepare("INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type,is_active) VALUES ('px-gen',?,'PXGEN','generator',1)").run(plate);
 r=await request('/api/document-drafts?view=issue-context&driver_id='+draft.issue_details.driver_id);
 assert.equal(r.status,200);assert.equal(r.payload.data.other,'PXGEN');
 sql.prepare("UPDATE equipment_pairing_drafts SET is_active=0 WHERE id='px-gen'").run();
 r=await request('/api/document-drafts?view=issue-context&driver_id='+draft.issue_details.driver_id);
 assert.equal(r.payload.data.other,'');
});

scenario('issue parts picker filters positive stock by warehouse and state before search and pagination',async({request,sql})=>{
 const {item,warehouse}=await documentFixture(request);
 const create=async(path,body)=>{const r=await request(path,{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data;};
 const recovered=await create('/api/parts',{...part,sku:'REC-ONLY',name:'Hàng thu hồi riêng'});
 const zero=await create('/api/parts',{...part,sku:'ZERO',name:'Hết hàng'});
 const other=await create('/api/warehouses',{code:'OTHER-WH',name:'Kho khác'});
 for(const [id,wh,state,q] of [[item.id,warehouse.id,'new',2500],[recovered.id,warehouse.id,'recovered',1000],[zero.id,warehouse.id,'new',0],[zero.id,other.id,'new',5000]])
  sql.prepare('INSERT INTO stock_buckets(part_id,warehouse_id,stock_state,quantity_milli,value_vnd) VALUES (?,?,?,?,0)').run(id,wh,state,q);
 const url='/api/parts?is_active=1&warehouse_id='+warehouse.id+'&stock_state=';
 let r=await request(url+'new&page_size=1');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].id,item.id);assert.equal(r.payload.data[0].current_stock_milli,2500);
 r=await request(url+'recovered');assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].id,recovered.id);assert.equal(r.payload.data[0].current_stock_milli,1000);
 assert.equal((await request(url+'new&q=REC-ONLY')).payload.pagination.total,0);
 assert.equal((await request(url+'new&page=2&page_size=1')).payload.data.length,0);
 assert.equal((await request(url+'wrong')).status,400);
 assert.equal((await request('/api/parts?stock_state=new')).status,400);
 assert.equal((await request(url+'new',{role:'warehouse'})).status,403);
 sql.prepare('INSERT INTO document_warehouse_access(user_id,warehouse_id) VALUES (?,?)').run('warehouse',warehouse.id);
 r=await request(url+'new',{role:'warehouse'});assert.equal(r.status,200);assert.equal(r.payload.data[0].current_stock_milli,2500);
 assert.equal((await request('/api/parts?warehouse_id='+other.id+'&stock_state=new',{role:'warehouse'})).status,403);
});

scenario('issue quotes and posts selected serial acquisition cost rather than bucket average',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);
 draft.lines[0].serials=['CHEAP'];draft.lines[0].unit_price='100';
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'cheap-cost',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 draft.business_at='2026-10-24T08:45';draft.lines[0].serials=['COSTLY'];draft.lines[0].unit_price='300';
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'costly-cost',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const input={part_id:item.id,warehouse_id:warehouse.id,stock_state:'new',quantity:'1',serials:['COSTLY']};
 const before=sql.prepare('SELECT count(*) n FROM stock_movements').get().n;
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:input});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,300);assert.equal(r.payload.data.unit_price_vnd_milli,300000);
 assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,before);
 assert.equal((await request('/api/document-drafts/issue-price',{method:'POST',body:input,role:'warehouse'})).status,403);
 const list=await request('/api/document-drafts?view=available-serials&part_id='+item.id+'&warehouse_id='+warehouse.id+'&stock_state=new');assert.equal(list.payload.data.find(s=>s.serial_number==='COSTLY').unit_cost_vnd,300);
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.business_at='2026-10-24T09:00';
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'serial-cost-out',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,300);
 assert.equal(sql.prepare('SELECT value_vnd FROM stock_buckets WHERE part_id=?').get(item.id).value_vnd,100);
 const serialCostSnapshot=JSON.parse(r.payload.data.labels['issue_serial_costs:'+draft.lines[0].id]);assert.equal(serialCostSnapshot[0].unit_price_vnd_milli,300000);assert.equal(serialCostSnapshot[0].amount_vnd,300);
 sql.prepare("UPDATE inventory_serials SET cost_vnd_milli=999000 WHERE serial_number='COSTLY'").run();
 const historical=await request('/api/document-drafts/'+r.payload.data.id);assert.equal(JSON.parse(historical.payload.data.labels['issue_serial_costs:'+draft.lines[0].id])[0].unit_price_vnd_milli,300000);

});
scenario('quantity issue quote uses weighted average and positions have CRUD search snapshots and inactive protection',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request);
 for(const [key,price] of [['one','100'],['two','300']]){draft.lines[0].unit_price=price;const r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));}
 let r=await request('/api/document-drafts/issue-price',{method:'POST',body:{part_id:item.id,warehouse_id:warehouse.id,stock_state:'new',quantity:'1',serials:[]}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,200);
 r=await request('/api/mount-positions',{method:'POST',body:{code:'L1',name:'Lốp trước trái'}});assert.equal(r.status,201,JSON.stringify(r.payload));const position=r.payload.data;
 assert.equal((await request('/api/mount-positions?q='+encodeURIComponent('LỐP TRƯỚC'))).payload.pagination.total,1);
 assert.equal((await request('/api/mount-positions',{method:'POST',body:{code:'L1',name:'Trùng'}})).status,409);
 assert.equal((await request('/api/mount-positions',{method:'POST',body:{code:'NO',name:'Không có quyền'},role:'viewer'})).status,403);
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.lines[0].mount_position_id=position.id;draft.business_at='2026-10-24T09:00';
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'position-issue',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const issued=r.payload.data;assert.equal(issued.totals.net,200);assert.equal(issued.draft.lines[0].to_position,'Lốp trước trái');
 r=await request('/api/mount-positions/'+position.id,{method:'PATCH',body:{version:position.version,name:'Tên mới',is_active:0}});assert.equal(r.status,200);
 assert.equal((await request('/api/document-drafts/'+issued.id)).payload.data.draft.lines[0].to_position,'Lốp trước trái');
 assert.equal((await request('/api/mount-positions?is_active=1')).payload.pagination.total,20);
 draft.business_at='2026-10-24T09:05';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'inactive-position'}});assert.equal(r.status,400,JSON.stringify(r.payload));
});

scenario('mixed-cost serialized warehouse transfer preserves individual serial acquisition costs',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'receipt',true);
 for(const [serial,price] of [['MOVE100','100'],['MOVE300','300']]){draft.lines[0].serials=[serial];draft.lines[0].unit_price=price;let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:serial,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));}
 let r=await request('/api/warehouses',{method:'POST',body:{code:'COST-DEST',name:'Kho nhận'}});const destination=r.payload.data;
 draft.kind='warehouse_transfer';draft.to_warehouse_id=destination.id;draft.business_at='2026-10-24T09:00';draft.lines[0].quantity='2';draft.lines[0].unit_price='';draft.lines[0].serials=['MOVE100','MOVE300'];
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'cost-transfer',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const snapshots=sql.prepare('SELECT serial_number,cost_vnd_milli FROM inventory_serials WHERE part_id=? ORDER BY serial_number').all(item.id);assert.deepEqual(snapshots.map(r=>r.cost_vnd_milli),[100000,300000]);
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:{part_id:item.id,warehouse_id:destination.id,stock_state:'new',quantity:'1',serials:['MOVE300']}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,300);
});

scenario('weighted average unit price retains three decimals independently of rounded line amount',async({request})=>{
 const {draft,item,warehouse}=await documentFixture(request);draft.lines[0].quantity='3';draft.lines[0].unit_price='33.333';
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'fractional-average-in',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:{part_id:item.id,warehouse_id:warehouse.id,stock_state:'new',quantity:'1',serials:[]}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,33);assert.equal(r.payload.data.unit_price_vnd_milli,33333);
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].quantity='1';draft.lines[0].unit_price='';draft.business_at='2026-10-24T09:00';
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'fractional-average-out',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.labels['issue_unit_price:'+draft.lines[0].id],'33333');assert.equal(r.payload.data.totals.net,33);
});

scenario('user mounting positions contain eight tractor and twelve trailer positions with validated usage',async({request})=>{
 const r=await request('/api/mount-positions?page_size=100');assert.equal(r.status,200);assert.equal(r.payload.pagination.total,20);
 const tractors=r.payload.data.filter(p=>p.notes==='Đầu kéo');const trailers=r.payload.data.filter(p=>p.notes==='Rơ moóc');assert.equal(tractors.length,8);assert.equal(trailers.length,12);
 assert.equal(tractors.find(p=>p.code==='GTT').name,'Giữa Trái Trong');assert.equal(trailers.find(p=>p.code==='T3PN').name,'Trục 3 Phải Ngoài');
 assert.equal((await request('/api/mount-positions?q='+encodeURIComponent('RƠ MOÓC'))).payload.pagination.total,12);
 const p=tractors[0];let changed=await request('/api/mount-positions/'+p.id,{method:'PATCH',body:{version:p.version,notes:'Xe khác'}});assert.equal(changed.status,400);
 changed=await request('/api/mount-positions/'+p.id,{method:'PATCH',body:{version:p.version,notes:'Rơ moóc'}});assert.equal(changed.status,200);
 assert.equal((await request('/api/mount-positions?q='+encodeURIComponent('Rơ moóc'))).payload.pagination.total,13);
});

scenario('issue date and time rejects earlier hours and accepts receipts at the selected timestamp',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);
 draft.business_at='2026-10-10T23:07';draft.lines[0].serials=['B65046023'];draft.lines[0].unit_price='100';
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'late-day-in',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const serialUrl='/api/document-drafts?view=available-serials&part_id='+item.id+'&warehouse_id='+warehouse.id+'&stock_state=new&business_at=';
 assert.equal((await request(serialUrl+'2026-10-10T08:00')).payload.pagination.total,0);
 assert.equal((await request(serialUrl+'2026-10-10T23:07')).payload.pagination.total,1);
 assert.equal((await request(serialUrl+'2026-10-09T23:59')).payload.pagination.total,0);
 assert.equal((await request(serialUrl+'2026-02-30T08:00')).status,400);
 const quote={part_id:item.id,warehouse_id:warehouse.id,stock_state:'new',quantity:'1',serials:['B65046023'],business_at:'2026-10-09T23:59'};
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:quote});assert.equal(r.status,409);assert.match(r.payload.error.message,/10\/10\/2026 23:07.*trước thời điểm nhập/);
 quote.business_at='2026-10-10T08:00';assert.equal((await request('/api/document-drafts/issue-price',{method:'POST',body:quote})).status,409);
 quote.business_at='2026-10-10T23:07';r=await request('/api/document-drafts/issue-price',{method:'POST',body:quote});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,100);
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.business_at='2026-10-09T23:59';
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'before-day-out',commit:true}});assert.equal(r.status,409);assert.equal(sql.prepare("SELECT status FROM inventory_serials WHERE serial_number='B65046023'").get().status,'in_stock');
 draft.business_at='2026-10-10T08:00';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'early-hour-out',commit:true}})).status,409);
 draft.business_at='2026-10-10T23:07';r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'same-day-out',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,100);
});
scenario('quantity issue uses the explicit business time and position snapshots include vehicle group',async({request})=>{
 const {draft,item,warehouse}=await documentFixture(request);draft.business_at='2026-10-10T23:07';draft.lines[0].unit_price='100';
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'quantity-late-in',commit:true}});assert.equal(r.status,201);
 const input={part_id:item.id,warehouse_id:warehouse.id,stock_state:'new',quantity:'1',serials:[],business_at:'2026-10-09T23:59'};
 assert.equal((await request('/api/document-drafts/issue-price',{method:'POST',body:input})).status,400);
 input.business_at='2026-10-10T08:00';assert.equal((await request('/api/document-drafts/issue-price',{method:'POST',body:input})).status,400);
 input.business_at='2026-10-10T23:07';assert.equal((await request('/api/document-drafts/issue-price',{method:'POST',body:input})).status,200);
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.lines[0].mount_position_id='mount-t1tt';draft.business_at=input.business_at;
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'quantity-same-day-out',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.draft.lines[0].to_position,'Rơ moóc – Trục 1 Trái Trong');
});

scenario('serial issue retains incoming fractional unit price independently of rounded whole-dong amount',async({request})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].quantity='3';draft.lines[0].unit_price='33.333';draft.lines[0].serials=['FRA','FRB','FRC'];
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'fractional-serial-in',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:{part_id:item.id,warehouse_id:warehouse.id,stock_state:'new',quantity:'1',serials:['FRA'],business_at:'2026-10-24T09:00'}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.unit_price_vnd_milli,33333);assert.equal(r.payload.data.amount_vnd,33);
 draft.kind='issue';draft.business_at='2026-10-24T09:00';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].quantity='1';draft.lines[0].unit_price='';draft.lines[0].serials=['FRA'];
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'fractional-serial-out',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.labels['issue_unit_price:'+draft.lines[0].id],'33333');assert.equal(JSON.parse(r.payload.data.labels['issue_serial_costs:'+draft.lines[0].id])[0].amount_vnd,33);
});

scenario('lifetime remaining percentage quotes and posts exact value, scoped mounted serials, rejects invalid or repeated returns',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();draft.lines[0].quantity='2';draft.lines[0].unit_price='12345';draft.lines[0].serials=['REC001','REC002'];
 const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});
 let r=await post(draft,'rec-pn');assert.equal(r.status,201,JSON.stringify(r.payload));
 const issue=structuredClone(draft);issue.kind='issue';issue.issue_details=await issueHeaderFixture(request);issue.business_at='2026-10-24T09:00';issue.lines[0].unit_price='';r=await post(issue,'rec-px');assert.equal(r.status,201,JSON.stringify(r.payload));
 const usage=sql.prepare('SELECT id FROM stock_usages').get().id;
 const quote={usage_id:usage,part_id:item.id,quantity:'1',quality_percent:'40',odo:'700',hours:'',serials:['REC001'],business_at:'2026-10-24T10:00'};
 r=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.base_vnd,12345);assert.equal(r.payload.data.amount_vnd,4938);assert.equal(r.payload.data.remaining_percent,"40");assert.equal(r.payload.data.metadata.estimated_hours,false);
 for(const quality_percent of ['0','100','40.25'])assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,quality_percent}})).status,200);
 for(const quality_percent of ['101','-1','40.123',''])assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,quality_percent}})).status,400);
 for(const business_at of ['bad','2026-02-30T10:00','2026-10-24T08:59'])assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,business_at}})).status,409);
 assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,quantity:'3'}})).status,409);
 assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',role:'warehouse',body:quote})).status,403);
 r=await request('/api/document-drafts?view=recovery-serials&usage_id='+usage);assert.equal(r.status,200,JSON.stringify(r.payload));assert.deepEqual(r.payload.data.map(s=>s.serial_number),['REC001','REC002']);
 assert.equal((await request('/api/document-drafts?view=recovery-serials&usage_id='+usage,{role:'warehouse'})).status,403);
 const th=structuredClone(issue);th.kind='recovery';delete th.issue_details;th.recovery_details={odo:'700',handover_name:'Người bàn giao',removed_from:'Đầu kéo'};th.business_at=quote.business_at;Object.assign(th.lines[0],{quantity:'1',serials:['REC001'],usage_id:usage,stock_state:'recovered',recovery_classification:'CSC',recovery_quality_percent:'40'});
 const invalid=structuredClone(th);invalid.lines[0].stock_state='pending_scrap';assert.equal((await post(invalid,'bad-class')).status,400);
 const noQuality=structuredClone(th);delete noQuality.lines[0].recovery_quality_percent;assert.equal((await post(noQuality,'no-quality')).status,400);
 r=await post(th,'rec-th');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,4938);assert.equal(r.payload.data.labels['recovery_base:'+th.lines[0].id],'12345');assert.equal(r.payload.data.labels['recovery_amount:'+th.lines[0].id],'4938');assert.equal(r.payload.data.labels['recovery_quality:'+th.lines[0].id],'40');
 assert.equal(sql.prepare("SELECT value_vnd FROM stock_buckets WHERE stock_state='recovered'").get().value_vnd,4938);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,1000);assert.equal(sql.prepare("SELECT status FROM inventory_serials WHERE serial_key='REC001'").get().status,'in_stock');
 assert.equal((await post(th,'repeat-return')).status,409);r=await request('/api/document-drafts?view=recovery-serials&usage_id='+usage);assert.deepEqual(r.payload.data.map(s=>s.serial_number),['REC002']);
 th.lines[0].serials=['REC002'];th.lines[0].recovery_classification='CTL';th.lines[0].stock_state='pending_scrap';th.lines[0].recovery_quality_percent='0';th.recovery_details.odo='1200';th.lines[0].odo='1200';r=await post(th,'zero-scrap');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,0);assert.equal(sql.prepare("SELECT quantity_milli FROM stock_buckets WHERE stock_state='pending_scrap'").get().quantity_milli,1000);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,0);
});

scenario('recovery needs lifetime evidence, caps usage and ignores forged value and assessment percentages',async({request,sql})=>{
 const {draft,item}=await documentFixture(request);draft.lines[0].quantity='5';draft.lines[0].unit_price='1000';const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal((await post(draft,'life-pn')).status,201);draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.lines[0].hours='10';draft.business_at='2026-10-24T09:00';assert.equal((await post(draft,'life-px')).status,201);const usage=sql.prepare('SELECT id FROM stock_usages').get().id;
 const quote={usage_id:usage,part_id:item.id,quantity:'2',business_at:'2026-10-24T10:00',odo:'600',hours:'60',serials:[],quality_percent:'5',base_vnd:999999,amount_vnd:999999,started_at:'1900-01-01T00:00',open_quantity_milli:999999};
 let pendingQuote=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(pendingQuote.status,200);assert.equal(pendingQuote.payload.data.amount_vnd,null);assert.equal(pendingQuote.payload.data.valuation_status,'pending');
 sql.prepare('UPDATE parts SET lifespan_km_limit=1000,lifespan_hours_limit=100').run();
 let r=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.base_vnd,2000);assert.equal(r.payload.data.amount_vnd,1000);assert.equal(r.payload.data.remaining_percent,'50');assert.equal(r.payload.data.metadata.measurements.length,2);
 for(const quality_percent of ['0','100']){r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,quality_percent}});assert.equal(r.payload.data.amount_vnd,1000);}
 for(const patch of [{odo:'99'},{hours:'9'},{quantity:'6'}])assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,...patch}})).status,409);
 r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,odo:'1200',hours:'120'}});assert.equal(r.payload.data.amount_vnd,0);assert.equal(r.payload.data.remaining_percent,'0');
 draft.kind='recovery';delete draft.issue_details;draft.business_at=quote.business_at;Object.assign(draft.lines[0],{usage_id:usage,quantity:'2',stock_state:'recovered',recovery_classification:'CSD',recovery_quality_percent:'5',odo:'600',hours:'60'});r=await post(draft,'life-th');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,1000);const meta=JSON.parse(r.payload.data.labels['recovery_valuation:'+draft.lines[0].id]);assert.equal(meta.usage_id,usage);assert.equal(meta.basis,'issue_cost_lifetime');assert.equal(meta.remaining_percent,'50');assert.equal(r.payload.data.labels['recovery_quality:'+draft.lines[0].id],'5');
 const before=sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli;draft.lines[0].quantity='4';assert.equal((await post(draft,'life-too-many')).status,409);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,before);
});

scenario('recovery retains each serial issue value after lifetime percentage instead of averaging incoming costs',async({request,sql})=>{
 const {draft}=await documentFixture(request,'receipt',true);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();draft.lines[0].quantity='1';draft.lines[0].unit_price='100';draft.lines[0].serials=['LIFE-CHEAP'];draft.lines.push({...draft.lines[0],id:crypto.randomUUID(),unit_price:'300',serials:['LIFE-COSTLY']});const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal((await post(draft,'serial-life-pn')).status,201);draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines=[{...draft.lines[0],unit_price:'',quantity:'2',serials:['LIFE-CHEAP','LIFE-COSTLY']}];draft.business_at='2026-10-24T09:00';let r=await post(draft,'serial-life-px');assert.equal(r.status,201,JSON.stringify(r.payload));draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T10:00';Object.assign(draft.lines[0],{stock_state:'recovered',usage_id:sql.prepare('SELECT id FROM stock_usages').get().id,odo:'600',recovery_quality_percent:'90',recovery_classification:'CSD'});r=await post(draft,'serial-life-th');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,200);const costs=JSON.parse(r.payload.data.labels['recovery_serial_costs:'+draft.lines[0].id]);assert.deepEqual(costs.map(c=>c.amount_vnd),[50,150]);assert.equal(sql.prepare("SELECT cost_vnd_milli FROM inventory_serials WHERE serial_key='LIFE-CHEAP'").get().cost_vnd_milli,50000);assert.equal(sql.prepare("SELECT cost_vnd_milli FROM inventory_serials WHERE serial_key='LIFE-COSTLY'").get().cost_vnd_milli,150000);
});

scenario('recovery usage sources accept empty stock filter and scope vehicle with open original issues and serials',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].quantity='2';draft.lines[0].serials=['SOURCE-A','SOURCE-B'];let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'source-pn',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.business_at='2026-10-24T09:00';draft.lines[0].quantity='1';draft.lines[0].unit_price='';draft.lines[0].serials=['SOURCE-A'];r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'source-px-a',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const vehicleA=draft.issue_details.vehicle_id;draft.issue_details=await issueHeaderFixture(request);const vehicleB=draft.issue_details.vehicle_id;draft.lines[0].serials=['SOURCE-B'];r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'source-px-b',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const path='/api/document-drafts?view=usages&part_id='+item.id+'&warehouse_id=&stock_state=';
 r=await request(path);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,2);
 r=await request(path+'&vehicle_id='+vehicleA);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].target_id,vehicleA);assert.equal(r.payload.data[0].started_at,'2026-10-24T09:00');assert.equal(r.payload.data[0].quantity_milli,1000);let serials=await request('/api/document-drafts?view=recovery-serials&usage_id='+r.payload.data[0].id);assert.deepEqual(serials.payload.data.map(s=>s.serial_number),['SOURCE-A']);
 r=await request(path+'&vehicle_id='+vehicleB);assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].target_id,vehicleB);
 r=await request(path,{role:'warehouse'});assert.equal(r.payload.pagination.total,0);sql.prepare('INSERT INTO document_warehouse_access(user_id,warehouse_id) VALUES (?,?)').run('warehouse',warehouse.id);r=await request(path+'&vehicle_id='+vehicleA,{role:'warehouse'});assert.equal(r.payload.pagination.total,1);
 assert.equal((await request('/api/document-drafts?view=sources&part_id='+item.id+'&stock_state=')).status,400);
 // An installed device in the current pairing is also included in the selected vehicle context.
 const equipment=(await request('/api/equipment',{method:'POST',body:{code:'SOURCE-GEN',name:'Máy phát nguồn',type:'generator'}})).payload.data;
 if(!equipment?.id)throw Error('equipment fixture failed');sql.prepare("UPDATE stock_usages SET target_type='equipment',target_id=? WHERE target_id=?").run(equipment.id,vehicleB);
 const plate=sql.prepare('SELECT plate_number FROM vehicles WHERE id=?').get(vehicleA).plate_number;sql.prepare("INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type,is_active) VALUES ('source-gen-link',?,'SOURCE-GEN','generator',1)").run(plate);
 r=await request(path+'&vehicle_id='+vehicleA);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,2);
});

scenario('recovery source first list exposes installed serials and current balances, hours estimate is explicit and future recovery is rejected',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'receipt',true);draft.lines[0].serials=['SOURCE-FIRST'];const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal((await post(draft,'first-pn')).status,201);draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);const vehicle=draft.issue_details.vehicle_id;draft.business_at='2026-10-24T09:00';draft.lines[0].unit_price='';assert.equal((await post(draft,'first-px')).status,201);
 let r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle+'&q=SOURCE-FIRST');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,1);const source=r.payload.data[0];assert.equal(source.serial_number,'SOURCE-FIRST');assert.equal(source.odo_milli,100000);assert.equal(source.quantity_milli,1000);assert.equal(source.open_quantity_milli,1000);assert.equal(source.part_id,item.id);assert.equal(source.is_serialized,1);assert.ok(source.root_line_id);assert.equal(source.started_at,'2026-10-24T09:00');
 assert.equal((await request('/api/document-drafts?view=recovery-sources',{role:'warehouse'})).payload.pagination.total,0);
 sql.prepare('UPDATE parts SET lifespan_hours_limit=100').run();const quote={usage_id:source.usage_id,part_id:item.id,quantity:'1',business_at:'2026-10-24T19:00',odo:'110',hours:'',serials:['SOURCE-FIRST']};r=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.remaining_percent,'90');assert.equal(r.payload.data.metadata.estimated_hours,true);assert.equal(r.payload.data.metadata.measurements[0].time_basis.method,'elapsed_calendar_hours');
 assert.equal((await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,business_at:'2099-01-01T00:00'}})).status,409);
 draft.kind='recovery';delete draft.issue_details;draft.business_at=quote.business_at;Object.assign(draft.lines[0],{usage_id:source.usage_id,stock_state:'recovered',recovery_classification:'CSD',recovery_quality_percent:'80',odo:'110'});r=await post(draft,'first-th');assert.equal(r.status,201,JSON.stringify(r.payload));r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle);assert.equal(r.payload.pagination.total,0);
});

scenario('source quantity recovery returns 3 of 10 leaving 7, then closes old cycle and creates a new usage on reissue',async({request,sql})=>{
 const {draft,item}=await documentFixture(request);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();draft.lines[0].quantity='10';draft.lines[0].unit_price='1000';const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal((await post(draft,'partial10-pn')).status,201);draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);const vehicle=draft.issue_details.vehicle_id;const issueDetails=structuredClone(draft.issue_details);draft.business_at='2026-10-24T09:00';draft.lines[0].unit_price='';assert.equal((await post(draft,'partial10-px')).status,201);const original=sql.prepare('SELECT id FROM stock_usages').get().id;
 draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T10:00';Object.assign(draft.lines[0],{quantity:'3',stock_state:'recovered',usage_id:original,odo:'600',recovery_classification:'CSD',recovery_quality_percent:'80'});let r=await post(draft,'partial10-first');assert.equal(r.status,201,JSON.stringify(r.payload));r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle);assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].issued_quantity_milli,10000);assert.equal(r.payload.data[0].quantity_milli,7000);assert.equal(r.payload.data[0].usage_id,original);
 draft.lines[0].quantity='8';assert.equal((await post(draft,'partial10-over')).status,409);draft.lines[0].quantity='7';assert.equal((await post(draft,'partial10-all')).status,201);r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle);assert.equal(r.payload.pagination.total,0);
 draft.kind='issue';draft.issue_details=issueDetails;draft.business_at='2026-10-24T11:00';draft.lines[0].quantity='3';draft.lines[0].usage_id='';draft.lines[0].odo='';delete draft.lines[0].recovery_classification;delete draft.lines[0].recovery_quality_percent;assert.equal((await post(draft,'partial10-reissue')).status,201);r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle);assert.equal(r.payload.pagination.total,1);assert.notEqual(r.payload.data[0].usage_id,original);assert.equal(r.payload.data[0].quantity_milli,3000);assert.equal(sql.prepare("SELECT count(*) n FROM inventory_documents WHERE type='OUT'").get().n,2);
});

scenario('unknown recovery value receives quantity, leaves money blank and propagates warning through reissue and another cycle',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].serials=['PENDING-SERIAL'];const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});let r=await post(draft,'pending-pn');assert.equal(r.status,201);const originalReceipt=r.payload.data;draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);const header=structuredClone(draft.issue_details);draft.business_at='2026-10-24T09:00';draft.lines[0].unit_price='';r=await post(draft,'pending-px');assert.equal(r.status,201);const oldUsage=sql.prepare('SELECT id FROM stock_usages').get().id;
 draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T10:00';Object.assign(draft.lines[0],{usage_id:oldUsage,stock_state:'recovered',recovery_classification:'CSC',recovery_quality_percent:'50',odo:'600'});r=await post(draft,'pending-th');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,null);assert.equal(r.payload.data.labels['valuation_pending:'+draft.lines[0].id],'1');assert.equal(r.payload.data.labels['recovery_amount:'+draft.lines[0].id],undefined);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages WHERE id=?').get(oldUsage).open_quantity_milli,0);assert.equal(sql.prepare('SELECT status,cost_vnd_milli FROM inventory_serials').get().status,'in_stock');assert.equal(sql.prepare('SELECT cost_vnd_milli FROM inventory_serials').get().cost_vnd_milli,null);
 const stock=await request('/api/document-drafts?view=stock&part_id='+item.id+'&warehouse_id='+warehouse.id+'&stock_state=recovered');assert.equal(stock.status,200);assert.equal(stock.payload.data.quantity_milli,1000);assert.equal(stock.payload.data.value_vnd,null);
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:{part_id:item.id,warehouse_id:warehouse.id,stock_state:'recovered',quantity:'1',serials:['PENDING-SERIAL'],business_at:'2026-10-24T11:00'}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,null);assert.equal(r.payload.data.valuation_status,'pending');
 const available=await request('/api/document-drafts?view=available-serials&part_id='+item.id+'&warehouse_id='+warehouse.id+'&stock_state=recovered');assert.equal(available.payload.data[0].unit_cost_vnd,null);
 draft.kind='issue';draft.issue_details=header;draft.business_at='2026-10-24T11:00';draft.lines[0].usage_id='';draft.lines[0].odo='';delete draft.lines[0].recovery_classification;delete draft.lines[0].recovery_quality_percent;r=await post(draft,'pending-reissue');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,null);assert.equal(r.payload.data.labels['valuation_pending:'+draft.lines[0].id],'1');assert.equal(r.payload.data.labels['issue_amount:'+draft.lines[0].id],undefined);assert.equal(sql.prepare('SELECT status FROM inventory_serials').get().status,'mounted');
 let list=await request('/api/document-drafts?kind=issue&valuation_pending=1');assert.equal(list.payload.pagination.total,1);assert.equal(list.payload.data[0].totals.net,null);assert.equal((await request('/api/document-drafts?kind=recovery&valuation_pending=1')).payload.pagination.total,1);
 const newUsage=sql.prepare('SELECT id FROM stock_usages WHERE open_quantity_milli>0').get().id;assert.notEqual(newUsage,oldUsage);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T12:00';Object.assign(draft.lines[0],{usage_id:newUsage,stock_state:'pending_scrap',recovery_classification:'CTL',recovery_quality_percent:'20',odo:'700'});r=await post(draft,'pending-cycle-2');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,null);assert.equal(sql.prepare("SELECT quantity_milli FROM stock_buckets WHERE stock_state='pending_scrap'").get().quantity_milli,1000);assert.equal((await request('/api/document-drafts/'+originalReceipt.id)).payload.data.totals.net,originalReceipt.totals.net);
});

scenario('reissued recovered material consumes remaining lifetime rather than resetting to the full norm',async({request,sql})=>{
 const {draft}=await documentFixture(request);sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();draft.lines[0].unit_price='1000';const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal((await post(draft,'budget-pn')).status,201);draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);const header=structuredClone(draft.issue_details);draft.business_at='2026-10-24T09:00';draft.lines[0].unit_price='';assert.equal((await post(draft,'budget-px')).status,201);const usage=sql.prepare('SELECT id FROM stock_usages').get().id;draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T10:00';Object.assign(draft.lines[0],{usage_id:usage,stock_state:'recovered',recovery_classification:'CSD',recovery_quality_percent:'90',odo:'600'});let r=await post(draft,'budget-th');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,500);
 draft.kind='issue';draft.issue_details=header;draft.business_at='2026-10-24T11:00';draft.lines[0].usage_id='';draft.lines[0].odo='';delete draft.lines[0].recovery_classification;delete draft.lines[0].recovery_quality_percent;r=await post(draft,'budget-reissue');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,500);
 const newUsage=sql.prepare('SELECT id FROM stock_usages WHERE open_quantity_milli>0').get().id;draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T12:00';Object.assign(draft.lines[0],{usage_id:newUsage,recovery_classification:'CSD',recovery_quality_percent:'80',odo:'200'});r=await post(draft,'budget-th-2');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,400);const meta=JSON.parse(r.payload.data.labels['recovery_valuation:'+draft.lines[0].id]);assert.equal(meta.measurements[0].limit_milli,500000);assert.equal(meta.remaining_percent,'80');assert.equal(meta.used_cost_vnd,100);
});

scenario('supplier picker searches tax number with or without branch hyphen or spaces while keeping active scope',async({request})=>{
 const create=async(body)=>{const r=await request('/api/suppliers',{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data;};const supplier=await create({name:'Nhà cung cấp tra mã số thuế',tax_code:'0312345678-001'});await create({name:'Nhà cung cấp khác',tax_code:'0999999999'});await create({name:'Nhà cung cấp ngừng hoạt động',tax_code:'0312345678-002',is_active:0});
 for(const query of ['0312345678-001','0312345678001','0312 345678 001','345678','0312345678']){const r=await request('/api/suppliers?q='+encodeURIComponent(query)+'&is_active=1&page_size=25');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,1,query);assert.equal(r.payload.data[0].id,supplier.id);assert.equal(r.payload.data[0].tax_code,'0312345678-001');}
 const byCode=await request('/api/suppliers?q='+supplier.code+'&is_active=1');assert.equal(byCode.payload.data[0].id,supplier.id);const noMatch=await request('/api/suppliers?q=0000000000&is_active=1');assert.equal(noMatch.payload.pagination.total,0);
});

scenario('mounted opening serials create no warehouse stock and recover through the same source picker including paired trailer',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening',true);const create=async(path,body)=>{const r=await request(path,{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data;};const tractor=await create('/api/vehicles',{plate_number:'OP-DK-001',type:'tractor'}),trailer=await create('/api/vehicles',{plate_number:'OP-RM-001',type:'trailer'});sql.prepare("INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type,is_active) VALUES ('opening-trailer',?,?, 'trailer',1)").run(tractor.plate_number,trailer.plate_number);
 draft.opening_mode='in_use';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{stock_state:'recovered',unit_price:'',serials:['OLD-OPEN-001'],target_type:'vehicle',target_id:trailer.id,to_position:'Rơ moóc – Trục 1 Trái Trong',odo:'',hours:''});const post=async(d,key,role='admin')=>request('/api/document-drafts',{method:'POST',role,body:{draft:d,idempotency_key:key,commit:true}});let r=await post(draft,'opening-mounted');assert.equal(r.status,201,JSON.stringify(r.payload));const original=r.payload.data;assert.equal(original.status,'posted');assert.equal(original.totals.net,null);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_balances').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_buckets').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_lots').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM opening_groups').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM opening_usage_lines').get().n,1);assert.equal(sql.prepare('SELECT status FROM inventory_serials').get().status,'mounted');assert.equal(sql.prepare('SELECT warehouse_id FROM inventory_serials').get().warehouse_id,null);
 const usage=sql.prepare('SELECT id FROM stock_usages').get().id;r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+tractor.id+'&q=OLD-OPEN');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].usage_id,usage);assert.equal(r.payload.data[0].source_kind,'opening_usage');assert.equal(r.payload.data[0].opening_installed_at,null);assert.equal(r.payload.data[0].odo_milli,null);assert.equal(r.payload.data[0].quantity_milli,1000);r=await request('/api/document-drafts?view=recovery-serials&usage_id='+usage);assert.deepEqual(r.payload.data.map(s=>s.serial_number),['OLD-OPEN-001']);assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use')).payload.pagination.total,1);assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=stock')).payload.pagination.total,0);
 assert.equal((await post(draft,'opening-mounted')).payload.data.id,original.id);assert.equal(sql.prepare('SELECT count(*) n FROM stock_usages').get().n,1);const duplicate=await post(draft,'opening-duplicate');assert.ok(duplicate.status>=400&&duplicate.status<500,JSON.stringify(duplicate.payload));assert.equal(sql.prepare('SELECT count(*) n FROM stock_usages').get().n,1);
 const recovery=emptyDraft('recovery');recovery.business_at='2026-10-26T10:00';recovery.warehouse_id=warehouse.id;Object.assign(recovery.lines[0],{part_id:item.id,quantity:'1',serials:['OLD-OPEN-001'],usage_id:usage,recovery_classification:'CSC',recovery_quality_percent:'50'});r=await post(recovery,'opening-recovery');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,null);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,1000);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages WHERE id=?').get(usage).open_quantity_milli,0);assert.equal(sql.prepare('SELECT status FROM inventory_serials').get().status,'in_stock');assert.equal((await request('/api/document-drafts?view=recovery-sources&vehicle_id='+tractor.id)).payload.pagination.total,0);assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.draft.opening_mode,'in_use');assert.equal((await post(recovery,'opening-double-return')).status,409);
});
scenario('mounted opening quantity can be recovered partially using known original cost and install ODO',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');sql.prepare('UPDATE parts SET lifespan_km_limit=1000').run();const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'OP-QTY',type:'tractor'}})).payload.data;draft.opening_mode='in_use';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{stock_state:'recovered',quantity:'10',unit_price:'100',target_type:'vehicle',target_id:vehicle.id,to_position:'Vị trí kiểm kê',installed_at:'2026-09-01T08:00',odo:'100'});const post=async(d,key,role='admin')=>request('/api/document-drafts',{method:'POST',role,body:{draft:d,idempotency_key:key,commit:true}});let r=await post(draft,'opening-qty');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,1000);const usage=sql.prepare('SELECT id FROM stock_usages').get().id;assert.equal(sql.prepare('SELECT started_at FROM stock_usages').get().started_at,'2026-09-01T08:00');assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
 const stock=emptyDraft('opening');stock.warehouse_id=warehouse.id;stock.business_at='2026-10-10T00:00';Object.assign(stock.lines[0],{part_id:item.id,quantity:'2',unit_price:'100'});assert.equal((await post(stock,'real-stock-opening')).status,201);
 assert.equal((await post(draft,'opening-qty-duplicate')).status,409);
 const recovery=emptyDraft('recovery');recovery.warehouse_id=warehouse.id;recovery.business_at='2026-10-26T10:00';Object.assign(recovery.lines[0],{part_id:item.id,usage_id:usage,quantity:'3',odo:'600',recovery_classification:'CSD',recovery_quality_percent:'90'});r=await post(recovery,'opening-qty-return');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,150);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,7000);assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances').get().quantity_milli,5000);
 r=await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle.id);assert.equal(r.payload.data[0].quantity_milli,7000);assert.equal(r.payload.data[0].source_kind,'opening_usage');assert.equal(r.payload.data[0].opening_installed_at,'2026-09-01T08:00');recovery.business_at='2026-10-09T10:00';assert.equal((await post(recovery,'before-opening')).status,409);
 assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=stock')).payload.pagination.total,1);assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use')).payload.pagination.total,1);
});

scenario('unknown mounted opening uses current purchase price and technical quality with immutable evidence and known reissue cost',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening',true);
 const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'MARKET-OPEN',type:'tractor'}})).payload.data;
 draft.opening_mode='in_use';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{stock_state:'recovered',unit_price:'',serials:['OLD-MARKET'],target_type:'vehicle',target_id:vehicle.id,to_position:'GTT',odo:'100'});
 const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});
 let r=await post(draft,'market-opening');assert.equal(r.status,201,JSON.stringify(r.payload));const opening=r.payload.data;
 const usage=sql.prepare('SELECT id FROM stock_usages').get().id;
 const sources=await request('/api/document-drafts?view=recovery-sources');assert.equal(sources.payload.data[0].opening_original_unit_price_known,0);
 const quote={usage_id:usage,part_id:item.id,quantity:'1',business_at:'2026-10-26T10:00',odo:'200',hours:'',serials:['OLD-MARKET'],current_unit_price:'5000000',quality_percent:'20',assessor:'Nguyễn Kỹ Thuật'};
 r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,assessor:''}});assert.equal(r.payload.data.valuation_status,'pending');assert.equal(r.payload.data.amount_vnd,null);
 for(const [quality,expected] of [['0',0],['20',1000000],['100',5000000],['20.25',1012500]]){r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,quality_percent:quality}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,expected);assert.equal(r.payload.data.valuation_method,'current_price_quality');assert.equal(r.payload.data.remaining_percent,null);}
 for(const patch of [{serials:['WRONG']},{quantity:'2'},{odo:'99'},{business_at:'2026-10-09T10:00'},{current_unit_price:'0'},{quality_percent:'101'},{current_unit_price:'-1'},{assessor:15}]){r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,...patch}});assert.ok(r.status>=400&&r.status<500,JSON.stringify(patch));}
 const recovery=emptyDraft('recovery');recovery.business_at=quote.business_at;recovery.warehouse_id=warehouse.id;Object.assign(recovery.lines[0],{part_id:item.id,quantity:'1',serials:['OLD-MARKET'],usage_id:usage,odo:'200',recovery_classification:'CSD',recovery_quality_percent:'20',recovery_current_unit_price:'5000000',recovery_assessor:quote.assessor});
 r=await post(recovery,'market-recovery');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,1000000);const meta=JSON.parse(r.payload.data.labels['recovery_valuation:'+recovery.lines[0].id]);assert.equal(meta.basis,'current_price_quality');assert.equal(meta.current_unit_price_vnd_milli,'5000000000');assert.equal(meta.quality_percent,'20');assert.equal(meta.assessor,quote.assessor);assert.equal(meta.usage_id,usage);assert.ok(meta.confirmed_at);assert.equal(sql.prepare('SELECT cost_vnd_milli FROM inventory_serials').get().cost_vnd_milli,1000000000);assert.equal(sql.prepare('SELECT original_unit_price_known FROM opening_usage_lines').get().original_unit_price_known,0);assert.equal((await request('/api/document-drafts/'+opening.id)).payload.data.totals.net,null);
 r=await request('/api/document-drafts/issue-price',{method:'POST',body:{part_id:item.id,warehouse_id:warehouse.id,stock_state:'recovered',quantity:'1',serials:['OLD-MARKET'],business_at:'2026-10-26T11:00'}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,1000000);
 recovery.kind='issue';recovery.issue_details=await issueHeaderFixture(request);recovery.business_at='2026-10-26T11:00';for(const key of ['recovery_classification','recovery_quality_percent','recovery_current_unit_price','recovery_assessor'])delete recovery.lines[0][key];recovery.lines[0].usage_id='';recovery.lines[0].odo='';r=await post(recovery,'market-reissue');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,1000000);
});
scenario('current price quality supports partial quantity and cannot override known opening original cost',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'MARKET-QTY',type:'tractor'}})).payload.data;
 draft.opening_mode='in_use';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{stock_state:'recovered',quantity:'10',unit_price:'',target_type:'vehicle',target_id:vehicle.id,to_position:'quantity'});const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal((await post(draft,'market-qty')).status,201);const usage=sql.prepare('SELECT id FROM stock_usages').get().id;
 const quote={usage_id:usage,part_id:item.id,quantity:'3',business_at:'2026-10-26T10:00',odo:'',hours:'',serials:[],current_unit_price:'5000000',quality_percent:'20',assessor:'Kỹ thuật'};let r=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(r.payload.data.amount_vnd,3000000);
 const recovery=emptyDraft('recovery');recovery.business_at=quote.business_at;recovery.warehouse_id=warehouse.id;Object.assign(recovery.lines[0],{part_id:item.id,quantity:'3',usage_id:usage,recovery_classification:'CSD',recovery_quality_percent:'20',recovery_current_unit_price:'5000000',recovery_assessor:'Kỹ thuật'});r=await post(recovery,'market-partial');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,3000000);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,7000);
 sql.prepare('UPDATE opening_usage_lines SET original_unit_price_known=1').run();r=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(r.status,409);r=await post(recovery,'market-no-override');assert.equal(r.status,409);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,7000);
});

scenario('user management provisions email and warehouse scope then binds only a verified first login',async({request,sql})=>{
 const warehouse=(await request('/api/warehouses',{method:'POST',body:{code:'LOGIN-K1',name:'Kho cấp quyền',kind:'parts'}})).payload.data;
 const input={email:' New.Operator@Example.Invalid ',display_name:'Thủ kho thử',role:'warehouse',is_active:1,warehouse_ids:[warehouse.id]};
 let r=await request('/api/user-management',{method:'POST',body:input});assert.equal(r.status,201,JSON.stringify(r.payload));let row=r.payload.data;assert.equal(row.email,'new.operator@example.invalid');assert.equal(row.access_linked,0);assert.equal(row.warehouses[0].id,warehouse.id);assert.equal(row.auth_subject,undefined);
 const jwt=await token('new-operator',{claims:{email:'NEW.OPERATOR@example.invalid'}});
 r=await request('/api/auth/me',{jwt});assert.equal(r.status,200);assert.equal(r.payload.data.access_granted,true);assert.equal(r.payload.data.user.id,row.id);
 const linked=sql.prepare('SELECT auth_subject,access_linked,access_linked_at,version FROM app_users WHERE id=?').get(row.id);assert.equal(linked.auth_subject,'subject-new-operator');assert.equal(linked.access_linked,1);assert.ok(linked.access_linked_at);assert.equal(linked.version,2);
 await request('/api/auth/me',{jwt});assert.equal(sql.prepare("SELECT count(*) n FROM audit_events WHERE action='user_access.link'").get().n,1);
 r=await request('/api/user-management/me',{jwt});assert.equal(r.payload.data.warehouses[0].id,warehouse.id);assert.equal((await request('/api/user-management',{jwt})).status,403);
 const forged=await token('different-subject',{claims:{email:'new.operator@example.invalid'}});assert.equal((await request('/api/auth/me',{jwt:forged})).payload.data.access_granted,false);
 assert.equal((await request('/api/document-drafts?view=stock&part_id=unused&warehouse_id='+warehouse.id,{jwt})).status,200);
 const other=(await request('/api/warehouses',{method:'POST',body:{code:'LOGIN-K2',name:'Kho chưa cấp',kind:'parts'}})).payload.data;assert.equal((await request('/api/document-drafts?view=stock&part_id=unused&warehouse_id='+other.id,{jwt})).status,403);
 row=(await request('/api/user-management/'+row.id)).payload.data;
 r=await request('/api/user-management/'+row.id,{method:'PATCH',body:{...input,email:row.email,version:row.version,is_active:0}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal((await request('/api/auth/me',{jwt})).payload.data.access_granted,false);assert.equal((await request('/api/parts',{jwt})).status,403);assert.equal(sql.prepare("SELECT count(*) n FROM audit_events WHERE action='user_access.update'").get().n,1);
});
scenario('user access rejects unauthorized edits, subject injection, stale updates and self lock without losing scopes',async({request,sql})=>{
 const input={email:'staff@example.invalid',display_name:'Nhân viên mẫu',role:'viewer',is_active:1,warehouse_ids:[]};
 for(const role of ['viewer','warehouse','accountant']){assert.equal((await request('/api/user-management',{role})).status,403);assert.equal((await request('/api/user-management',{method:'POST',role,body:input})).status,403);const me=await request('/api/user-management/me',{role});assert.equal(me.payload.data.id,role);}
 assert.equal((await request('/api/user-management',{method:'POST',body:{...input,auth_subject:'subject-admin'}})).status,400);
 let r=await request('/api/user-management',{method:'POST',body:input});assert.equal(r.status,201);const row=r.payload.data;
 assert.equal((await request('/api/user-management',{method:'POST',body:{...input,email:'STAFF@example.invalid'}})).status,409);
 for(const patch of [{role:'admin',is_active:0},{role:'viewer',is_active:1}])assert.equal((await request('/api/user-management/admin',{method:'PATCH',body:{...input,email:'admin@example.invalid',version:1,...patch}})).status,409);
 r=await request('/api/user-management/'+row.id,{method:'PATCH',body:{...input,display_name:'Đã thay đổi',version:row.version}});assert.equal(r.status,200);assert.equal(r.payload.data.version,2);
 r=await request('/api/user-management/'+row.id,{method:'PATCH',body:{...input,is_active:0,version:row.version}});assert.equal(r.status,409);assert.equal(sql.prepare('SELECT is_active FROM app_users WHERE id=?').get(row.id).is_active,1);
 assert.equal((await request('/api/user-management/'+row.id,{method:'DELETE'})).status,405);
 assert.equal((await request('/api/user-management/admin',{method:'PATCH',body:{...input,email:'changed@example.invalid',role:'admin',version:1}})).status,409);
 assert.equal((await request('/api/user-management?status=pending&q=nhan%20vien')).payload.pagination.total,0);assert.equal((await request('/api/user-management?status=pending&q='+encodeURIComponent('ĐÃ THAY ĐỔI'))).payload.pagination.total,1);assert.equal((await request('/api/user-management?role=viewer')).payload.pagination.total,2);assert.equal((await request('/api/user-management?page=bad')).status,400);
});
scenario('pending locked accounts cannot bind and warehouse grants validate references and are replaced atomically',async({request,sql})=>{
 const w=(await request('/api/warehouses',{method:'POST',body:{code:'SCOPE-1',name:'Kho 1',kind:'parts'}})).payload.data;
 const input={email:'locked@example.invalid',display_name:'Kho khóa',role:'warehouse',is_active:0,warehouse_ids:[w.id]};let r=await request('/api/user-management',{method:'POST',body:input});assert.equal(r.status,201);const row=r.payload.data;const jwt=await token('locked',{claims:{email:input.email}});assert.equal((await request('/api/auth/me',{jwt})).payload.data.access_granted,false);assert.equal(sql.prepare('SELECT access_linked FROM app_users WHERE id=?').get(row.id).access_linked,0);
 for(const ids of [['missing'],[w.id,w.id]]){r=await request('/api/user-management/'+row.id,{method:'PATCH',body:{...input,warehouse_ids:ids,version:row.version}});assert.equal(r.status,400);assert.equal(sql.prepare('SELECT warehouse_id FROM document_warehouse_access WHERE user_id=?').get(row.id).warehouse_id,w.id);}
 r=await request('/api/user-management/'+row.id,{method:'PATCH',body:{...input,role:'accountant',warehouse_ids:[],is_active:1,version:row.version}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT count(*) n FROM document_warehouse_access WHERE user_id=?').get(row.id).n,0);assert.equal((await request('/api/auth/me',{jwt})).payload.data.user.role,'accountant');
});
scenario('login entry redirects to the configured Access application and ignores external return parameters',async({env})=>{
 const response=await handler(new Request('https://inventory.example.invalid/api/auth/login?return_to=https://evil.invalid'),env);assert.equal(response.status,302);const target=new URL(response.headers.get('location'));assert.equal(target.origin,issuer);assert.equal(target.pathname,'/cdn-cgi/access/login/inventory.example.invalid');assert.equal(target.searchParams.get('kid'),audience);assert.equal(target.searchParams.get('redirect_url'),'/');assert.equal(response.headers.get('cache-control'),'no-store');
});

scenario('user access concurrent version conflict rolls back warehouse grants and audit',async({request,sql,env})=>{
 const w=(await request('/api/warehouses',{method:'POST',body:{code:'CONCURRENT',name:'Kho giữ nguyên',kind:'parts'}})).payload.data;
 const input={email:'concurrent@example.invalid',display_name:'Thủ kho đồng thời',role:'warehouse',is_active:1,warehouse_ids:[w.id]};const created=await request('/api/user-management',{method:'POST',body:input});const row=created.payload.data;
 const original=env.DB.batch;let injected=false;env.DB.batch=async statements=>{if(!injected){injected=true;sql.prepare('UPDATE app_users SET version=version+1 WHERE id=?').run(row.id)}return original(statements)};
 const changed=await request('/api/user-management/'+row.id,{method:'PATCH',body:{...input,is_active:0,warehouse_ids:[],version:row.version}});assert.equal(changed.status,409,JSON.stringify(changed.payload));assert.equal(sql.prepare('SELECT is_active FROM app_users WHERE id=?').get(row.id).is_active,1);assert.equal(sql.prepare('SELECT warehouse_id FROM document_warehouse_access WHERE user_id=?').get(row.id).warehouse_id,w.id);assert.equal(sql.prepare("SELECT count(*) n FROM audit_events WHERE action='user_access.update' AND entity_id=?").get(row.id).n,0);
});

async function nativeFixture(ctx){ctx.env.AUTH_MODE='native';ctx.env.AUTH_PASSWORD_PEPPER='test-only-native-pepper-not-for-production-2026';const password='Test administrator password 2026!';const encoded=await hashPassword(ctx.env,password);ctx.sql.prepare('INSERT INTO native_credentials(user_id,password_hash,must_change) VALUES(?,?,0)').run('admin',encoded);const login=await ctx.request('/api/auth/login',{method:'POST',role:null,body:{email:'admin@example.invalid',password}});assert.equal(login.status,200,JSON.stringify(login.payload));return{password,cookie:login.response.headers.get('set-cookie').split(';')[0]};}
scenario('native login uses HttpOnly sessions, ignores Access headers, enforces expiry, and logs out server-side',async ctx=>{
 const {request,sql}=ctx,{cookie,password}=await nativeFixture(ctx);
 assert.equal((await request('/api/parts')).status,401);assert.equal((await request('/api/auth/me',{role:null})).status,401);
 const me=await request('/api/auth/me',{role:null,headers:{Cookie:cookie}});assert.equal(me.status,200);assert.equal(me.payload.data.auth_method,'password');assert.equal(me.payload.data.user.id,'admin');assert.equal(me.payload.data.must_change_password,false);assert.equal((await request('/api/parts',{role:null,headers:{Cookie:cookie}})).status,200);
 const login=await request('/api/auth/login',{method:'POST',role:null,body:{email:'ADMIN@example.invalid',password}});assert.equal(login.status,200);const header=login.response.headers.get('set-cookie');for(const flag of ['__Host-tnc_session=','HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(header.includes(flag));assert.equal(JSON.stringify(login.payload).includes(password),false);assert.equal(JSON.stringify(login.payload).includes(header.split(';')[0].split('=')[1]),false);
 assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:cookie+'; '+cookie}})).status,401);
 let r=await request('/api/auth/logout',{method:'POST',role:null,headers:{Cookie:cookie},body:{}});assert.equal(r.status,200);assert.ok(r.response.headers.get('set-cookie').includes('Max-Age=0'));assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:cookie}})).status,401);
 sql.prepare('UPDATE native_sessions SET idle_expires_at=0').run();assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:header.split(';')[0]}})).status,401);
});
scenario('native password login rejects guessing, enumeration, injected identity and cross-origin changes',async ctx=>{
 const {request,sql}=ctx;await nativeFixture(ctx);
 const wrong=await request('/api/auth/login',{method:'POST',role:null,body:{email:'admin@example.invalid',password:'wrong'}});const unknown=await request('/api/auth/login',{method:'POST',role:null,body:{email:'unknown@example.invalid',password:'wrong'}});assert.equal(wrong.status,401);assert.deepEqual(wrong.payload.error.message,unknown.payload.error.message);
 assert.equal((await request('/api/auth/login',{method:'POST',role:null,headers:{Origin:'https://evil.invalid'},body:{email:'admin@example.invalid',password:'anything'}})).status,403);
 assert.equal((await request('/api/auth/login',{method:'POST',role:null,body:{email:'admin@example.invalid',password:'anything',role:'admin'}})).status,401);
 for(let i=0;i<8;i++)await request('/api/auth/login',{method:'POST',role:null,body:{email:'blocked@example.invalid',password:'wrong'}});const limited=await request('/api/auth/login',{method:'POST',role:null,body:{email:'blocked@example.invalid',password:'wrong'}});assert.equal(limited.status,429);
 assert.equal(sql.prepare('SELECT count(*) n FROM native_sessions').get().n,1);
});
scenario('native new users must change temporary password before inventory and changing revokes all old sessions',async ctx=>{
 const {request,sql}=ctx,{cookie}=await nativeFixture(ctx);const initial='Temporary employee password!';let r=await request('/api/user-management',{method:'POST',role:null,headers:{Cookie:cookie},body:{email:'employee@example.invalid',display_name:'Nhân viên mới',role:'viewer',is_active:1,warehouse_ids:[],initial_password:initial}});assert.equal(r.status,201,JSON.stringify(r.payload));const target=r.payload.data;assert.equal(target.password_set,1);assert.equal(JSON.stringify(r.payload).includes(initial),false);assert.equal(sql.prepare("SELECT after_json FROM audit_events WHERE action='user_access.create' AND entity_id=?").get(target.id).after_json.includes(initial),false);
 const login=()=>request('/api/auth/login',{method:'POST',role:null,body:{email:'employee@example.invalid',password:initial}});r=await login();assert.equal(r.status,200);const oldCookie=r.response.headers.get('set-cookie').split(';')[0];const second=await login(),secondCookie=second.response.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:oldCookie}})).payload.data.must_change_password,true);assert.equal((await request('/api/parts',{role:null,headers:{Cookie:oldCookie}})).status,403);
 const freshPassword='My own employee password 2026!';r=await request('/api/auth/change-password',{method:'POST',role:null,headers:{Cookie:oldCookie},body:{current_password:initial,new_password:freshPassword}});assert.equal(r.status,200,JSON.stringify(r.payload));const newCookie=r.response.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:secondCookie}})).status,401);assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:oldCookie}})).status,401);assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:newCookie}})).payload.data.must_change_password,false);assert.equal((await request('/api/parts',{role:null,headers:{Cookie:newCookie}})).status,200);assert.equal((await login()).status,401);
});
scenario('native admin reset and account lock revoke sessions, preserve scope, and never reveal password hashes',async ctx=>{
 const {request,sql}=ctx,{cookie,password}=await nativeFixture(ctx);const initial='Initial warehouse password!';const w=(await request('/api/warehouses',{method:'POST',role:null,headers:{Cookie:cookie},body:{code:'NATIVE-KHO',name:'Kho được cấp',kind:'parts'}})).payload.data;
 const body={email:'native-kho@example.invalid',display_name:'Kho QLVT',role:'warehouse',is_active:1,warehouse_ids:[w.id],initial_password:initial};let r=await request('/api/user-management',{method:'POST',role:null,headers:{Cookie:cookie},body});assert.equal(r.status,201);let target=r.payload.data;sql.prepare('UPDATE native_credentials SET must_change=0 WHERE user_id=?').run(target.id);
 const login=await request('/api/auth/login',{method:'POST',role:null,body:{email:body.email,password:initial}});const userCookie=login.response.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/document-drafts?view=stock&part_id=unused&warehouse_id='+w.id,{role:null,headers:{Cookie:userCookie}})).status,200);assert.equal((await request('/api/user-management',{role:null,headers:{Cookie:userCookie}})).status,403);
 assert.equal((await request('/api/user-passwords/admin',{method:'POST',role:null,headers:{Cookie:userCookie},body:{password:'Forged administrator password!',version:1}})).status,403);
 r=await request('/api/user-passwords/'+target.id,{method:'POST',role:null,headers:{Cookie:cookie},body:{password:'Reset warehouse password!',version:target.version}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:userCookie}})).status,401);assert.equal(sql.prepare("SELECT actor_id FROM audit_events WHERE action='auth.admin_password_reset'").get().actor_id,'admin');
 target=(await request('/api/user-management/'+target.id,{role:null,headers:{Cookie:cookie}})).payload.data;assert.equal(JSON.stringify(target).includes('password_hash'),false);const login2=await request('/api/auth/login',{method:'POST',role:null,body:{email:body.email,password:'Reset warehouse password!'}});const resetCookie=login2.response.headers.get('set-cookie').split(';')[0];const {initial_password,...update}=body;r=await request('/api/user-management/'+target.id,{method:'PATCH',role:null,headers:{Cookie:cookie},body:{...update,version:target.version,is_active:0}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:resetCookie}})).status,401);assert.equal(sql.prepare('SELECT count(*) n FROM native_sessions WHERE user_id=?').get(target.id).n,0);
 assert.equal((await request('/api/users/admin',{method:'PATCH',role:null,headers:{Cookie:cookie},body:{version:1,is_active:0}})).status,405);
});
scenario('native activation is one time, expires, preserves the existing admin ID and cannot be used as a password reset',async ctx=>{
 const {env,request,sql}=ctx;env.AUTH_MODE='native';env.AUTH_PASSWORD_PEPPER='test-only-native-pepper-not-for-production-2026';const token=randomToken(),hash=await tokenHash(token);sql.prepare('INSERT INTO native_activation_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash,'admin',Math.floor(Date.now()/1000)+3600);
 assert.equal((await request('/api/auth/activate',{method:'POST',role:null,body:{token,password:'short'}})).status,400);
 const r=await request('/api/auth/activate',{method:'POST',role:null,body:{token,password:'My private admin password 2026!'}});assert.equal(r.status,200,JSON.stringify(r.payload));const cookie=r.response.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/auth/me',{role:null,headers:{Cookie:cookie}})).payload.data.user.id,'admin');assert.equal(sql.prepare('SELECT must_change FROM native_credentials').get().must_change,0);
 assert.equal((await request('/api/auth/activate',{method:'POST',role:null,body:{token,password:'Another admin password 2026!'}})).status,400);assert.equal(sql.prepare('SELECT count(*) n FROM app_users').get().n,4);assert.equal(sql.prepare('SELECT used FROM native_activation_tokens').get().used,1);
});

scenario('opening current price assessment persists evidence separately from original cost and flows to recovery references',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'OPEN-ASSESS',type:'tractor'}})).payload.data;draft.opening_mode='in_use';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{stock_state:'recovered',quantity:'10',unit_price:'',target_type:'vehicle',target_id:vehicle.id,to_position:'GTT',opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật đầu kỳ',opening_confirmation_basis:'Biên bản DK-01'});
 const post=async(d,key,commit=true)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit}});let r=await post(draft,'assessed-opening');assert.equal(r.status,201,JSON.stringify(r.payload));const original=r.payload.data;const meta=JSON.parse(original.labels['opening_reference_assessment:'+draft.lines[0].id]);assert.equal(meta.amount_vnd,10000000);assert.equal(meta.assessor,'Kỹ thuật đầu kỳ');assert.equal(meta.confirmation_basis,'Biên bản DK-01');assert.equal(meta.business_at,draft.business_at);assert.equal(original.totals.net,10000000);assert.equal(sql.prepare('SELECT count(*) n FROM stock_balances').get().n,0);assert.equal(sql.prepare('SELECT original_unit_price_known FROM opening_usage_lines').get().original_unit_price_known,0);assert.equal(sql.prepare('SELECT open_value_vnd FROM stock_usages').get().open_value_vnd,10000000);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_valuation_flags').get().n,0);
 const restored=(await request('/api/document-drafts/'+original.id)).payload.data;assert.equal(restored.draft.lines[0].opening_current_unit_price,'5000000');assert.equal(restored.draft.lines[0].opening_quality_percent,'20');assert.equal(restored.draft.lines[0].opening_confirmation_basis,'Biên bản DK-01');
 const source=(await request('/api/document-drafts?view=recovery-sources&vehicle_id='+vehicle.id)).payload.data[0];assert.equal(source.opening_current_unit_price,'5000000');assert.equal(source.opening_quality_percent,'20');assert.equal(source.opening_assessor,'Kỹ thuật đầu kỳ');assert.equal(source.opening_confirmation_basis,'Biên bản DK-01');assert.equal(source.opening_original_unit_price_known,0);
 const quote={usage_id:source.usage_id,part_id:item.id,quantity:'3',business_at:'2026-10-26T10:00',odo:'',hours:'',serials:[]};
 sql.prepare('UPDATE parts SET unit_price_vnd=9000000 WHERE id=?').run(item.id);
 r=await request('/api/document-drafts/recovery-price',{method:'POST',body:quote});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,3000000);assert.equal(r.payload.data.unit_price_vnd_milli,1000000000);assert.equal(r.payload.data.metadata.assessor,'Kỹ thuật đầu kỳ');assert.equal(r.payload.data.metadata.quality_percent,'20');
 const inherited=emptyDraft('recovery');Object.assign(inherited,{warehouse_id:warehouse.id,business_at:quote.business_at});Object.assign(inherited.lines[0],{part_id:item.id,usage_id:source.usage_id,quantity:'2',recovery_classification:'CSD'});r=await post(inherited,'inherited-opening-recovery');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,2000000);assert.equal(sql.prepare('SELECT original_value_vnd FROM stock_lots').get().original_value_vnd,2000000);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,8000);
 r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{...quote,current_unit_price:'',assessor:''}});assert.equal(r.status,200);assert.equal(r.payload.data.amount_vnd,null);
 const recovery=emptyDraft('recovery');recovery.warehouse_id=warehouse.id;recovery.business_at='2026-10-26T10:00';Object.assign(recovery.lines[0],{part_id:item.id,usage_id:source.usage_id,quantity:'3',recovery_classification:'CSD',recovery_quality_percent:'10'});r=await post(recovery,'legacy-assessed-draft',false);assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.labels['recovery_market_eligible:'+recovery.lines[0].id],'1');assert.equal(r.payload.data.draft.lines[0].recovery_current_unit_price,undefined);
 Object.assign(recovery.lines[0],{recovery_current_unit_price:'6000000',recovery_assessor:'Kỹ thuật lúc tháo'});r=await post(recovery,'assessed-recovery');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.totals.net,1800000);const returned=JSON.parse(r.payload.data.labels['recovery_valuation:'+recovery.lines[0].id]);assert.equal(returned.quality_percent,'10');assert.equal(returned.current_unit_price_vnd_milli,'6000000000');assert.equal(returned.assessor,'Kỹ thuật lúc tháo');assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.draft.lines[0].opening_quality_percent,'20');
 const forged=structuredClone(draft);forged.lines[0].opening_reference_amount='1';assert.equal((await post(forged,'forged-assessment')).status,400);
});

scenario('mounted opening does not require unit or warehouse; creator sources and recovery warehouse have independent permissions',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'NO-UNIT',type:'tractor'}})).payload.data;
 draft.opening_mode='in_use';draft.warehouse_id='';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{quantity:'2',stock_state:'recovered',unit_price:'',target_type:'vehicle',target_id:vehicle.id,to_position:'GTT',opening_current_unit_price:'100',opening_quality_percent:'50',opening_assessor:'Kỹ thuật'});
 const post=async(d,key,role='warehouse')=>request('/api/document-drafts',{method:'POST',role,body:{draft:d,idempotency_key:key,commit:true}});
 let r=await post(draft,'no-unit-opening');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.draft.warehouse_id,'');const source=sql.prepare('SELECT * FROM inventory_document_lines').get();assert.equal(source.from_warehouse_id,null);assert.equal(source.to_warehouse_id,null);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);assert.equal(sql.prepare('SELECT managing_unit_id FROM opening_usage_lines').get().managing_unit_id,null);
 const sources=await request('/api/document-drafts?view=recovery-sources',{role:'warehouse'});assert.equal(sources.payload.data.length,1);const usage=sources.payload.data[0].usage_id;
 const quote={usage_id:usage,part_id:item.id,quantity:'1',quality_percent:'50',current_unit_price:'100',assessor:'Kỹ thuật tháo',business_at:'2026-10-11T00:00',odo:'',hours:'',serials:[]};r=await request('/api/document-drafts/recovery-price',{role:'warehouse',method:'POST',body:quote});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,50);
 const recovery=emptyDraft('recovery');recovery.warehouse_id=warehouse.id;recovery.business_at='2026-10-11T00:00';Object.assign(recovery.lines[0],{part_id:item.id,quantity:'1',unit_price:'',usage_id:usage,stock_state:'recovered',recovery_quality_percent:'50',recovery_current_unit_price:'100',recovery_assessor:'Kỹ thuật tháo',recovery_classification:'CSD'});
 assert.equal((await post(recovery,'no-unit-no-warehouse')).status,403);
 sql.prepare('INSERT INTO document_warehouse_access(user_id,warehouse_id) VALUES(?,?)').run('warehouse',warehouse.id);r=await post(recovery,'no-unit-recovery');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_buckets').get().quantity_milli,1000);
 sql.prepare("INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES('second','subject-second','second@example.invalid','Second','warehouse')").run();const otherJwt=await token('warehouse',{subject:'subject-second',claims:{email:'second@example.invalid'}});
 r=await request('/api/document-drafts?view=recovery-sources',{role:'second',jwt:otherJwt});assert.equal(r.payload.data.length,0);assert.equal((await request('/api/document-drafts/recovery-price',{role:'second',jwt:otherJwt,method:'POST',body:quote})).status,403);
});
scenario('mounted opening stores authoritative driver and current paired fleet without trusting spoofed display names',async({request,sql})=>{
 const {draft}=await documentFixture(request,'opening');const driver=(await request('/api/staff',{method:'POST',body:{code:'ODRIVER',name:'Lái xe đầu kỳ',staff_type:'driver'}})).payload.data;
 const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'OPEN-FLEET',type:'tractor',assigned_driver_id:driver.id}})).payload.data;
 const trailer=(await request('/api/vehicles',{method:'POST',body:{plate_number:'OPEN-TRAILER',type:'trailer'}})).payload.data;
 const generator=(await request('/api/equipment',{method:'POST',body:{code:'OPEN-GEN',name:'Máy phát',type:'generator'}})).payload.data;
 sql.prepare("INSERT INTO equipment_pairing_drafts(id,parent_code,child_code,pairing_type,is_active) VALUES('op-trailer',?,?,'trailer',1),('op-generator',?,?,'generator',1)").run(vehicle.plate_number,trailer.plate_number,vehicle.plate_number,generator.code);
 Object.assign(draft,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-10T00:00',opening_details:{driver_id:driver.id,driver_name:'forged',vehicle_id:vehicle.id,vehicle_plate:'forged',trailer_number:'forged',generator_code:'forged'}});Object.assign(draft.lines[0],{target_type:'vehicle',target_id:trailer.id,stock_state:'recovered',unit_price:''});
 const post=async(d,key)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});let r=await post(draft,'opening-fleet');assert.equal(r.status,201,JSON.stringify(r.payload));const info=r.payload.data.draft.opening_details;assert.equal(info.driver_name,driver.name);assert.equal(info.vehicle_plate,vehicle.plate_number);assert.equal(info.trailer_number,trailer.plate_number);assert.equal(info.generator_code,generator.code);
 sql.prepare('UPDATE equipment_pairing_drafts SET is_active=0').run();const reopened=(await request('/api/document-drafts/'+r.payload.data.id)).payload.data;assert.equal(reopened.draft.opening_details.generator_code,generator.code);
 const forged=structuredClone(draft);forged.opening_details.vehicle_id='wrong';r=await post(forged,'opening-fleet-wrong');assert.equal(r.status,400);
});
scenario('opening price policy accepts catalog or entered original price and zero ratio, requires named assessor, suppresses obsolete flags without rewriting history',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'opening',true);sql.prepare('UPDATE parts SET unit_price_vnd=5000000 WHERE id=?').run(item.id);const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'PRICE-POLICY',type:'tractor'}})).payload.data;
 draft.opening_mode='in_use';draft.warehouse_id='';draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{part_id:item.id,quantity:'1',serials:['OPEN-POLICY-01'],target_type:'vehicle',target_id:vehicle.id,stock_state:'recovered',unit_price:'',opening_current_unit_price:'',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});
 const post=async(d,key,commit=true)=>request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit}});
 const missing=structuredClone(draft);missing.lines[0].opening_assessor='';missing.lines[0].opening_confirmation_basis='Biên bản thay cho người';let r=await post(missing,'policy-missing-assessor');assert.equal(r.status,400);assert.ok(r.payload.error.message.includes('Người xác nhận'));
 r=await post(draft,'policy-default');assert.equal(r.status,201,JSON.stringify(r.payload));const original=r.payload.data,line=original.draft.lines[0];assert.equal(line.opening_current_unit_price,'5000000');assert.equal(original.totals.net,1000000);assert.equal(original.labels['valuation_pending:'+line.id],undefined);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_valuation_flags').get().n,0);assert.equal(sql.prepare('SELECT open_value_vnd FROM stock_usages').get().open_value_vnd,1000000);assert.equal(sql.prepare('SELECT cost_vnd_milli FROM inventory_serials').get().cost_vnd_milli,1000000000);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);
 const root=sql.prepare('SELECT * FROM inventory_document_lines').get();const obsolete='Chưa có giá gốc của vật tư đang sử dụng đầu kỳ.';sql.prepare('INSERT INTO inventory_valuation_flags(inventory_line_id,reason,origin_line_id) VALUES(?,?,?)').run(root.id,obsolete,root.id);const labels={...original.labels,['valuation_pending:'+line.id]:'1',['valuation_reason:'+line.id]:obsolete};const guard=sql.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='posted_prepared_update'").get().sql;sql.exec('DROP TRIGGER posted_prepared_update');try{sql.prepare('UPDATE document_drafts SET totals_json=?,labels_json=? WHERE id=?').run(JSON.stringify({net:null,vat:0,gross:null}),JSON.stringify(labels),original.id);}finally{sql.exec(guard)} // Fixture of a legacy posted row; restore immutability before exercising the API.
 const history=JSON.stringify(sql.prepare('SELECT * FROM inventory_document_lines').all());const restored=(await request('/api/document-drafts/'+original.id)).payload.data;assert.equal(restored.totals.net,1000000);assert.equal(restored.labels['valuation_pending:'+line.id],undefined);assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use&valuation_pending=1')).payload.pagination.total,0);assert.equal((await request('/api/document-drafts?view=recovery-sources')).payload.data[0].valuation_pending,0);assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use')).payload.data[0].totals.net,1000000);assert.equal(JSON.stringify(sql.prepare('SELECT * FROM inventory_document_lines').all()),history);assert.equal(JSON.parse(sql.prepare('SELECT totals_json FROM document_drafts WHERE id=?').get(original.id).totals_json).net,null);
 const manual=structuredClone(draft);Object.assign(manual.lines[0],{serials:['OPEN-POLICY-02'],opening_current_unit_price:'4000000',opening_quality_percent:'0'});r=await post(manual,'policy-manual-zero');assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.draft.lines[0].opening_current_unit_price,'4000000');assert.equal(r.payload.data.totals.net,0);
 const zeroUsage=sql.prepare('SELECT u.id FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id JOIN inventory_documents d ON d.id=l.document_id WHERE d.code=?').get(r.payload.data.code).id;
 r=await request('/api/document-drafts/recovery-price',{method:'POST',body:{usage_id:zeroUsage,part_id:item.id,quantity:'1',business_at:'2026-10-26T10:00',odo:'',hours:'',serials:['OPEN-POLICY-02']}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.amount_vnd,0);assert.equal(r.payload.data.valuation_status,'known');
 sql.prepare('UPDATE parts SET unit_price_vnd=9000000 WHERE id=?').run(item.id);assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.draft.lines[0].opening_current_unit_price,'5000000');
});
scenario('opening list publishes fleet snapshot and management totals and searches saved driver and paired codes',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'opening');const driver=(await request('/api/staff',{method:'POST',body:{code:'LISTDRIVER',name:'Nguyễn Danh Sách',staff_type:'driver'}})).payload.data;const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'50H-LIST',type:'tractor',assigned_driver_id:driver.id}})).payload.data;
 draft.opening_mode='in_use';draft.warehouse_id='';draft.business_at='2026-10-10T08:35';draft.opening_details={driver_id:driver.id,driver_name:driver.name,vehicle_id:vehicle.id,vehicle_plate:vehicle.plate_number,trailer_number:'',generator_code:''};Object.assign(draft.lines[0],{quantity:'12',stock_state:'recovered',unit_price:'',target_type:'vehicle',target_id:vehicle.id,opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});
 const posted=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'opening-list-fields',commit:true}});assert.equal(posted.status,201,JSON.stringify(posted.payload));
 let result=await request('/api/document-drafts?kind=opening&opening_mode=in_use&q='+encodeURIComponent('nguyen danh sach'));assert.equal(result.payload.pagination.total,1);const row=result.payload.data[0];assert.equal(row.opening_details.driver_name,driver.name);assert.equal(row.opening_details.vehicle_plate,vehicle.plate_number);assert.equal(row.total_quantity,'12000');assert.equal(row.opening_original_value_vnd,60000000);assert.equal(row.totals.net,12000000);assert.equal(row.business_at,'2026-10-10T08:35');
 assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use&q=50H-LIST')).payload.pagination.total,1);assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use&q=unknown')).payload.pagination.total,0);
 const guard=sql.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='posted_prepared_update'").get().sql;sql.exec('DROP TRIGGER posted_prepared_update');try{sql.prepare("UPDATE document_drafts SET search_text='legacy index' WHERE id=?").run(posted.payload.data.id)}finally{sql.exec(guard)}
 // An older index did not include opening_details: header snapshot search remains usable.
 assert.equal((await request('/api/document-drafts?kind=opening&opening_mode=in_use&q=50H-LIST')).payload.pagination.total,1);
});
scenario('posted opening edits keep source IDs, update serial/quantity/value atomically and retain audit without changing stock',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'opening',true);const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'EDIT-OPEN',type:'tractor'}})).payload.data;
 Object.assign(draft,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-10T08:00'});Object.assign(draft.lines[0],{quantity:'1',stock_state:'recovered',unit_price:'',target_type:'vehicle',target_id:vehicle.id,serials:['EDIT-A'],opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});draft.lines.push({...structuredClone(draft.lines[0]),id:crypto.randomUUID(),serials:['EDIT-B']});
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'edit-opening-create',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));let record=r.payload.data;assert.equal(record.can_modify,true);const code=record.code,rootIds=sql.prepare('SELECT id FROM inventory_document_lines ORDER BY line_number').all().map(v=>v.id),usageIds=sql.prepare('SELECT id FROM stock_usages ORDER BY rowid').all().map(v=>v.id);
 const save=(value,version=record.version,reason='Điều chỉnh kiểm kê',role='admin')=>request('/api/document-drafts/'+record.id,{method:'PATCH',role,body:{action:'save',version,reason,draft:value}});
 assert.equal((await save(record.draft,record.version,'')).status,400);assert.equal((await save(record.draft,record.version,'test','viewer')).status,403);assert.equal((await save(record.draft,record.version,'test','warehouse')).status,403);
 const edit=structuredClone(record.draft);edit.business_at='2026-10-11T09:30';edit.purpose='Đã điều chỉnh';Object.assign(edit.lines[0],{serial:'',serials:['EDIT-A2'],opening_current_unit_price:'6000000',opening_quality_percent:'50',opening_assessor:'Kỹ thuật mới'});Object.assign(edit.lines[1],{opening_current_unit_price:'2000000',opening_quality_percent:'50'});
 r=await save(edit);assert.equal(r.status,200,JSON.stringify(r.payload));record=r.payload.data;assert.equal(record.code,code);assert.equal(record.status,'posted');assert.equal(record.version,2);assert.equal(record.totals.net,4000000);assert.equal(record.can_modify,true);assert.deepEqual(sql.prepare('SELECT id FROM inventory_document_lines ORDER BY line_number').all().map(v=>v.id),rootIds);assert.deepEqual(sql.prepare('SELECT id FROM stock_usages ORDER BY rowid').all().map(v=>v.id),usageIds);assert.equal(sql.prepare('SELECT min(version) v FROM stock_usages').get().v,2);assert.equal(sql.prepare("SELECT count(*) n FROM inventory_serials WHERE serial_number='EDIT-A'").get().n,0);assert.equal(sql.prepare("SELECT cost_vnd_milli FROM inventory_serials WHERE serial_number='EDIT-A2'").get().cost_vnd_milli,3000000000);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_buckets').get().n,0);
 const event=sql.prepare("SELECT * FROM document_draft_events WHERE document_id=? AND action='save'").get(record.id);assert.equal(event.reason,'Điều chỉnh kiểm kê');assert.ok(JSON.parse(event.before_json).draft.lines[0].serials.includes('EDIT-A'));assert.equal(JSON.parse(event.after_json).draft.purpose,'Đã điều chỉnh');
 const next=structuredClone(record.draft);next.lines=[next.lines[0],{...next.lines[1],id:crypto.randomUUID(),serial:'',serials:['EDIT-C'],opening_current_unit_price:'1000000'}];r=await save(next);assert.equal(r.status,200,JSON.stringify(r.payload));record=r.payload.data;assert.equal(record.version,3);assert.equal(record.totals.net,3500000);assert.equal(sql.prepare('SELECT id FROM inventory_document_lines WHERE line_number=1').get().id,rootIds[0]);assert.notEqual(sql.prepare('SELECT id FROM inventory_document_lines WHERE line_number=2').get().id,rootIds[1]);assert.equal(sql.prepare('SELECT version FROM stock_usages WHERE id=?').get(usageIds[0]).version,3);assert.equal(sql.prepare('SELECT count(*) n FROM receipt_mutation_locks').get().n,0);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal((await save(next,2)).status,409);
 sql.prepare("INSERT INTO accounting_periods(period,is_locked,locked_by,locked_at) VALUES('2026-10',1,'admin','2026-10-27')").run();assert.equal((await request('/api/document-drafts/'+record.id)).payload.data.can_modify,false);assert.equal((await save(record.draft)).status,409);
});
scenario('opening edits reject linked recovery drafts, completed recovery and a new dependency arriving just before the atomic batch',async({request,sql,env})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'EDIT-DEPS',type:'tractor'}})).payload.data;Object.assign(draft,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-10T08:00'});Object.assign(draft.lines[0],{quantity:'10',stock_state:'recovered',unit_price:'',target_type:'vehicle',target_id:vehicle.id,opening_current_unit_price:'100',opening_quality_percent:'50',opening_assessor:'Kỹ thuật'});
 const original=(await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'edit-deps-opening',commit:true}})).payload.data;const usage=sql.prepare('SELECT id FROM stock_usages').get().id;const recovery=emptyDraft('recovery');Object.assign(recovery,{business_at:'2026-10-11T00:00',warehouse_id:warehouse.id});Object.assign(recovery.lines[0],{part_id:item.id,quantity:'3',unit_price:'',usage_id:usage,stock_state:'recovered',recovery_quality_percent:'50',recovery_current_unit_price:'100',recovery_assessor:'Kỹ thuật',recovery_classification:'CSD'});
 const edit=structuredClone(original.draft);edit.lines[0].opening_current_unit_price='200';const save=()=>request('/api/document-drafts/'+original.id,{method:'PATCH',body:{action:'save',version:original.version,reason:'Sửa giá',draft:edit}});
 const batch=env.DB.batch;let injected=false,pending;
 env.DB.batch=async statements=>{if(!injected&&statements.some(s=>s.query.includes('INSERT INTO receipt_mutation_locks'))){injected=true;pending=await request('/api/document-drafts',{method:'POST',body:{draft:recovery,idempotency_key:'edit-race-recovery',commit:false}});assert.equal(pending.status,201,JSON.stringify(pending.payload));}return batch(statements)};
 let result=await save();env.DB.batch=batch;assert.equal(result.status,409,JSON.stringify(result.payload));assert.equal(result.payload.error.code,'OPENING_HAS_DEPENDENCIES');assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.version,1);assert.equal(sql.prepare('SELECT open_value_vnd FROM stock_usages').get().open_value_vnd,500);assert.equal(sql.prepare('SELECT count(*) n FROM receipt_mutation_locks').get().n,0);assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.can_modify,false);
 let r=await request('/api/document-drafts/'+pending.payload.data.id,{method:'PATCH',body:{action:'cancel',version:pending.payload.data.version,reason:'Bỏ bản nháp'}});assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.can_modify,true);
 r=await request('/api/document-drafts',{method:'POST',body:{draft:recovery,idempotency_key:'edit-real-recovery',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal((await request('/api/document-drafts/'+original.id)).payload.data.can_modify,false);assert.equal((await save()).status,409);assert.equal(sql.prepare('SELECT open_quantity_milli FROM stock_usages').get().open_quantity_milli,7000);
});

scenario('stale recovery cannot consume the previous source version after a concurrent opening edit',async({request,sql,env})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'EDIT-STALE-USAGE',type:'tractor'}})).payload.data;Object.assign(draft,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-10T00:00'});Object.assign(draft.lines[0],{quantity:'10',stock_state:'recovered',unit_price:'',target_type:'vehicle',target_id:vehicle.id,opening_current_unit_price:'100',opening_quality_percent:'50',opening_assessor:'Kỹ thuật'});const record=(await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'stale-edit-opening',commit:true}})).payload.data;const usage=sql.prepare('SELECT id FROM stock_usages').get().id;const recovery=emptyDraft('recovery');Object.assign(recovery,{business_at:'2026-10-11T00:00',warehouse_id:warehouse.id});Object.assign(recovery.lines[0],{part_id:item.id,quantity:'1',usage_id:usage,stock_state:'recovered',recovery_classification:'CSD',recovery_quality_percent:'50',recovery_current_unit_price:'100',recovery_assessor:'Kỹ thuật'});const batch=env.DB.batch;let injected=false;
 env.DB.batch=async statements=>{if(!injected&&statements.some(s=>s.query.includes('UPDATE stock_usages SET'))){injected=true;const edit=structuredClone(record.draft);edit.lines[0].opening_current_unit_price='200';const r=await request('/api/document-drafts/'+record.id,{method:'PATCH',body:{action:'save',version:record.version,reason:'Cập nhật trước thu hồi',draft:edit}});assert.equal(r.status,200,JSON.stringify(r.payload));}return batch(statements)};
 const stale=await request('/api/document-drafts',{method:'POST',body:{draft:recovery,idempotency_key:'stale-edit-recovery',commit:true}});env.DB.batch=batch;assert.equal(injected,true);assert.equal(stale.status,409,JSON.stringify(stale.payload));const current=sql.prepare('SELECT id,version,open_quantity_milli,open_value_vnd FROM stock_usages').get();assert.equal(current.id,usage);assert.equal(current.version,2);assert.equal(current.open_quantity_milli,10000);assert.equal(current.open_value_vnd,1000);assert.equal(sql.prepare('SELECT count(*) n FROM stock_movements').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM stock_buckets').get().n,0);
});


scenario('opening stock DK has a separate atomic counter from mounted opening SD and preserves existing codes',async({request,sql})=>{
 const {draft}=await documentFixture(request,'opening');draft.business_at='2026-10-10T00:00';Object.assign(draft.lines[0],{quantity:'2',unit_price:'100',vat_rate:'0'});
 const preview='/api/document-drafts?view=next-number&kind=opening&date=2026-10-10';assert.equal((await request(preview)).payload.data.code,'10.26.00001/DK');assert.equal((await request(preview+'&opening_mode=in_use')).payload.data.code,'10.26.00001/SD');assert.equal((await request(preview+'&opening_mode=invalid')).status,400);assert.equal(sql.prepare('SELECT count(*) n FROM document_counters').get().n,0);
 const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'DK-SEQUENCE',type:'tractor'}})).payload.data;const mounted=structuredClone(draft);Object.assign(mounted,{opening_mode:'in_use',warehouse_id:''});Object.assign(mounted.lines[0],{quantity:'1',stock_state:'recovered',target_type:'vehicle',target_id:vehicle.id,opening_current_unit_price:'100',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});
 let r=await request('/api/document-drafts',{method:'POST',body:{draft:mounted,idempotency_key:'dk-mounted',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const old=r.payload.data;assert.equal(old.code,'10.26.00001/SD');
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'dk-stock',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal(r.payload.data.code,'10.26.00001/DK');assert.equal(r.payload.data.totals.gross,200);assert.equal(sql.prepare('SELECT i.code FROM inventory_documents i JOIN document_drafts d ON d.posted_inventory_id=i.id WHERE d.id=?').get(r.payload.data.id).code,'10.26.00001/DK');
 r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'dk-stock',commit:true}});assert.equal(r.payload.data.code,'10.26.00001/DK');assert.equal((await request(preview)).payload.data.code,'10.26.00002/DK');assert.equal((await request(preview+'&opening_mode=in_use')).payload.data.code,'10.26.00002/SD');assert.equal((await request('/api/document-drafts/'+old.id)).payload.data.code,old.code);assert.deepEqual(sql.prepare('SELECT kind,last_no FROM document_counters ORDER BY kind').all().map(v=>({...v})),[{kind:'DK',last_no:1},{kind:'SD',last_no:1}]);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
});


scenario('inventory books reconcile opening receipt issue transfer and running balances with warehouse scope and no writes',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};
 draft.business_at='2026-10-01T00:00';Object.assign(draft.lines[0],{quantity:'10',unit_price:'1000'});await post(draft,'books-opening');
 draft.kind='receipt';draft.business_at='2026-10-05T08:00';draft.lines[0].vat_rate='8';const receipt=await post(draft,'books-receipt');
 draft.kind='issue';draft.business_at='2026-10-10T09:00';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].quantity='3';draft.lines[0].unit_price='';draft.lines[0].vat_rate='0';await post(draft,'books-issue');
 const other=(await request('/api/warehouses',{method:'POST',body:{code:'BOOK-WH2',name:'Kho nhận',kind:'parts'}})).payload.data;
 draft.kind='warehouse_transfer';delete draft.issue_details;draft.business_at='2026-10-12T09:00';draft.to_warehouse_id=other.id;draft.lines[0].quantity='2';await post(draft,'books-transfer');
 const unposted=emptyDraft('receipt');unposted.warehouse_id=warehouse.id;unposted.business_at='2026-10-06T00:00';Object.assign(unposted.lines[0],{part_id:item.id,quantity:'100',unit_price:'1000'});assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:unposted,idempotency_key:'books-draft'}})).status,201);
 const mounted=emptyDraft('opening');Object.assign(mounted,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-01T00:00'});Object.assign(mounted.lines[0],{part_id:item.id,quantity:'50',stock_state:'recovered',target_type:'vehicle',target_id:(await issueHeaderFixture(request)).vehicle_id,opening_current_unit_price:'1000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});await post(mounted,'books-mounted');
 const snapshot=JSON.stringify(sql.prepare('SELECT * FROM stock_movements ORDER BY id').all()),audits=sql.prepare('SELECT count(*) n FROM audit_events').get().n;
 const base='/api/inventory-books?from=2026-10-01&to=2026-10-31';let r=await request(base+'&book=summary');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,2);let own=r.payload.data.find(g=>g.warehouse_id===warehouse.id);assert.deepEqual([own.opening_quantity_milli,own.opening_value_vnd,own.in_quantity_milli,own.in_value_vnd,own.out_quantity_milli,own.out_value_vnd,own.closing_quantity_milli,own.closing_value_vnd],[10000,10000,10000,10000,5000,5000,15000,15000]);assert.deepEqual(r.payload.totals,{group_count:2,pending_groups:0,opening_value_vnd:10000,in_value_vnd:12000,out_value_vnd:5000,closing_value_vnd:17000,transfer_in_value_vnd:2000,transfer_out_value_vnd:2000});
 assert.deepEqual([own.transfer_in_quantity_milli,own.transfer_in_value_vnd,own.transfer_out_quantity_milli,own.transfer_out_value_vnd],[0,0,2000,2000]);assert.equal(own.first_movement_at,'2026-10-01T00:00');assert.equal(own.last_movement_at,'2026-10-12T09:00');const destination=r.payload.data.find(g=>g.warehouse_id===other.id);assert.deepEqual([destination.transfer_in_quantity_milli,destination.transfer_in_value_vnd,destination.transfer_out_quantity_milli],[2000,2000,0]);assert.equal(destination.first_movement_at,'2026-10-12T09:00');assert.equal(destination.last_movement_at,'2026-10-12T09:00');
 const summaryTotals=r.payload.totals;const summarySecond=(await request(base+'&book=summary&page=2&page_size=1')).payload;assert.equal(summarySecond.data.length,1);assert.deepEqual(summarySecond.totals,summaryTotals);const scopedTotals=(await request(base+'&book=summary&warehouse_id='+warehouse.id)).payload.totals;assert.equal(scopedTotals.transfer_in_value_vnd,0);assert.equal(scopedTotals.transfer_out_value_vnd,2000);assert.equal(scopedTotals.closing_value_vnd,15000);
 const noActivity=(await request('/api/inventory-books?book=summary&from=2026-10-13&to=2026-10-31&warehouse_id='+warehouse.id)).payload.data[0];assert.equal(noActivity.first_movement_at,null);assert.equal(noActivity.last_movement_at,null);assert.equal(noActivity.transfer_out_quantity_milli,0);assert.equal(noActivity.closing_quantity_milli,15000);

 r=await request(base+'&book=stock&q=D-PART');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,5);assert.equal(r.payload.data.filter(m=>m.kind==='opening').length,1);assert.ok(r.payload.data.every(m=>typeof m.target_label==='string'&&typeof m.odo==='string'));assert.equal((await request(base+'&q=%25_%27')).payload.pagination.total,0);
 const card=base+'&book=card&part_id='+item.id+'&warehouse_id='+warehouse.id;r=await request(card);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,3);assert.deepEqual(r.payload.data.map(m=>m.balance_quantity_milli),[20000,17000,15000]);assert.equal(r.payload.data[0].draft_id,receipt.id);assert.equal(r.payload.data[0].in_value_vnd,10000);assert.equal(r.payload.data[2].out_value_vnd,2000);assert.equal(r.payload.groups[0].opening_quantity_milli,10000);
 const paged=(await request(card+'&page=2&page_size=1')).payload;assert.equal(paged.data.length,1);assert.equal(paged.data[0].balance_quantity_milli,17000);const exported=(await request(card+'&page=2&page_size=1&export=1')).payload;assert.equal(exported.data.length,3);assert.equal(exported.pagination.page,1);
 r=await request('/api/inventory-books?book=summary&from=2026-10-10&to=2026-10-12&warehouse_id='+warehouse.id);own=r.payload.data[0];assert.equal(own.opening_quantity_milli,20000);assert.equal(own.in_quantity_milli,0);assert.equal(own.out_quantity_milli,5000);assert.equal(own.closing_quantity_milli,15000);
 r=await request('/api/inventory-books?book=summary&from=2026-10-01&to=2026-10-05&warehouse_id='+warehouse.id);assert.equal(r.payload.data[0].closing_quantity_milli,20000);
 assert.equal((await request(base,{role:'warehouse'})).payload.pagination.total,0);sql.prepare('INSERT INTO document_warehouse_access VALUES (?,?)').run('warehouse',warehouse.id);r=await request(base,{role:'warehouse'});assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].warehouse_id,warehouse.id);assert.equal((await request(base+'&warehouse_id='+other.id,{role:'warehouse'})).status,403);assert.equal((await request('/api/inventory-books?view=warehouses',{role:'warehouse'})).payload.data.length,1);assert.equal((await request(base,{role:'viewer'})).status,200);assert.equal((await request(base,{role:null})).status,401);
 for(const suffix of ['&book=bad','&book=card','&page=0','&page_size=101','&stock_state=bad','&warehouse_id=%27'])assert.equal((await request(base+suffix)).status,400,suffix);assert.equal((await request('/api/inventory-books?from=2026-02-30&to=2026-03-01')).status,400);assert.equal((await request('/api/inventory-books?from=2026-10-31&to=2026-10-01')).status,400);assert.equal((await request(base,{method:'POST',body:{}})).status,405);assert.equal(JSON.stringify(sql.prepare('SELECT * FROM stock_movements ORDER BY id').all()),snapshot);assert.equal(sql.prepare('SELECT count(*) n FROM audit_events').get().n,audits);
});

scenario('inventory books show unknown recovery money as null and preserve serial cycle history',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].serials=['BOOK-UNKNOWN'];const post=async(key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};await post('books-unknown-pn');draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.business_at='2026-10-24T09:00';draft.lines[0].unit_price='';await post('books-unknown-px');const usage=sql.prepare('SELECT id FROM stock_usages').get().id;
 draft.kind='recovery';delete draft.issue_details;draft.business_at='2026-10-24T10:00';Object.assign(draft.lines[0],{usage_id:usage,stock_state:'recovered',recovery_classification:'CSC',recovery_quality_percent:'50',odo:'600'});const recovered=await post('books-unknown-th');assert.equal(recovered.totals.net,null);
 const base='/api/inventory-books?from=2026-10-24&to=2026-10-24&part_id='+item.id;let r=await request(base+'&book=summary');assert.equal(r.status,200,JSON.stringify(r.payload));const group=r.payload.data.find(g=>g.stock_state==='recovered');assert.equal(group.closing_quantity_milli,1000);assert.equal(group.in_value_vnd,null);assert.equal(group.closing_value_vnd,null);assert.equal(r.payload.totals.closing_value_vnd,null);assert.equal(r.payload.totals.pending_groups,1);
 r=await request(base+'&book=card&stock_state=recovered&q=BOOK-UNKNOWN');assert.equal(r.payload.serial_filter,'BOOK-UNKNOWN');assert.equal(r.payload.data.length,1);const movement=r.payload.data[0];assert.equal(movement.valuation_pending,true);assert.equal(movement.in_value_vnd,null);assert.equal(movement.serials,'BOOK-UNKNOWN');assert.equal(movement.draft_id,recovered.id);
 r=await request(base+'&book=card&stock_state=new');assert.equal(r.payload.data.length,2);assert.equal(r.payload.data[0].serials,'BOOK-UNKNOWN');assert.equal(r.payload.data[1].serials,'BOOK-UNKNOWN');assert.deepEqual(r.payload.data.map(m=>m.balance_quantity_milli),[1000,0]);assert.equal(r.payload.data[1].balance_value_vnd,0);
});


scenario('inventory books reflect posted receipt corrections and deletion and reject truncated exports',async({request,sql,env})=>{
 const {draft}=await documentFixture(request);draft.lines[0].quantity='2';draft.lines[0].unit_price='100';let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'book-edit',commit:true}});assert.equal(r.status,201);let row=r.payload.data;const base='/api/inventory-books?book=summary&from=2026-10-01&to=2026-10-31';assert.equal((await request(base)).payload.totals.closing_value_vnd,200);
 const original=env.DB.batch;env.DB.batch=async statements=>{const data=await original(statements);if(statements[0].query.startsWith('WITH bounds'))data[1].results[0].total=10001;return data};r=await request(base+'&export=1');assert.equal(r.status,422);assert.equal(r.payload.error.code,'BOOK_EXPORT_LIMIT');env.DB.batch=original;
 draft.lines[0].unit_price='200';r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'save',version:row.version,reason:'Sửa giá',draft,commit:true}});assert.equal(r.status,200,JSON.stringify(r.payload));row=r.payload.data;assert.equal((await request(base)).payload.totals.closing_value_vnd,400);
 r=await request('/api/document-drafts/'+row.id,{method:'PATCH',body:{action:'delete',version:row.version,reason:'Lập nhầm'}});assert.equal(r.status,200);r=await request(base);assert.equal(r.payload.pagination.total,0);assert.equal(r.payload.totals.closing_value_vnd,0);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
});


scenario('tracking lists actual movement targets and frozen equipment types and readings, including opening',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};draft.business_at='2026-10-01T00:00';Object.assign(draft.lines[0],{quantity:'3',unit_price:'1000'});await post(draft,'tracking-opening');
 const issue=emptyDraft('issue');issue.warehouse_id=warehouse.id;issue.business_at='2026-10-10T08:35';issue.issue_details=await issueHeaderFixture(request);const trailer=(await request('/api/vehicles',{method:'POST',body:{plate_number:'51R-TRACK',type:'trailer'}})).payload.data;const generator=(await request('/api/equipment',{method:'POST',body:{code:'MP-TRACK',name:'Máy phát theo dõi',type:'generator'}})).payload.data;Object.assign(issue.lines[0],{part_id:item.id,quantity:'1',target_type:'vehicle',target_id:trailer.id,odo:'123456.5'});issue.lines.push({...structuredClone(issue.lines[0]),id:crypto.randomUUID(),target_type:'equipment',target_id:generator.id,odo:'',hours:'40.25'});const issued=await post(issue,'tracking-issue');sql.prepare('UPDATE vehicles SET current_odo_km=999999 WHERE id=?').run(trailer.id);
 const base='/api/inventory-books?book=stock&from=2026-10-01&to=2026-10-31';let r=await request(base);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,3);const rows=r.payload.data;const rm=rows.find(m=>m.target_label==='51R-TRACK'),mp=rows.find(m=>m.target_label==='MP-TRACK'),opening=rows.find(m=>m.kind==='opening');assert.ok(rm,JSON.stringify(rows));assert.ok(mp,JSON.stringify(rows));assert.equal(rm.target_kind,'Rơ moóc');assert.equal(rm.odo,'123456.5');assert.equal(rm.out_quantity_milli,1000);assert.equal(rm.draft_id,issued.id);assert.equal(mp.target_kind,'Máy phát');assert.equal(mp.hours,'40.25');assert.equal(mp.odo,'');assert.equal(opening.in_quantity_milli,3000);assert.equal(opening.target_label,'');assert.equal(opening.odo,'');assert.equal(opening.part_name,item.name);assert.equal(rows[0].kind,'issue');assert.equal((await request('/api/stock-ledger?from=2026-10-01&to=2026-10-31&q=MP-TRACK')).payload.pagination.total,1);assert.equal((await request(base+'&page=2&page_size=1')).payload.data.length,1);assert.equal((await request(base+'&export=1')).payload.data.length,3);
 const usage=sql.prepare('SELECT id FROM stock_usages WHERE target_id=?').get(trailer.id);const recovered=emptyDraft('recovery');Object.assign(recovered,{warehouse_id:warehouse.id,business_at:'2026-10-11T10:00'});Object.assign(recovered.lines[0],{part_id:item.id,quantity:'1',stock_state:'recovered',usage_id:usage.id,odo:'123500',recovery_classification:'CSD',recovery_quality_percent:'50'});const recovery=await post(recovered,'tracking-recovery');r=await request(base);const source=r.payload.data.find(m=>m.draft_id===recovery.id);assert.equal(source.target_label,'51R-TRACK');assert.equal(source.target_kind,'Rơ moóc');assert.equal(source.odo,'123500');assert.equal(source.in_quantity_milli,1000);assert.equal(source.out_quantity_milli,0);
});


scenario('grouped stock ledger folds receipt and issue serial rows consistently, uses monthly opening and unfiltered running balances',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);const serials=Array.from({length:50},(_,i)=>'LEDGER-R'+String(i+1).padStart(3,'0'));draft.business_at='2026-09-30T10:00';Object.assign(draft.lines[0],{quantity:'50',unit_price:'100',serials});const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};await post(draft,'ledger-sep');draft.business_at='2026-10-05T09:28';Object.assign(draft.lines[0],{quantity:'10',serials:Array.from({length:10},(_,i)=>'LEDGER-A'+String(i+1).padStart(3,'0'))});const receipt=await post(draft,'ledger-oct');const issue=emptyDraft('issue');issue.business_at='2026-10-10T15:00';issue.warehouse_id=warehouse.id;issue.issue_details=await issueHeaderFixture(request);issue.lines=serials.slice(0,12).map(serial=>({...emptyDraft('issue').lines[0],part_id:item.id,serials:[serial],quantity:'1'}));await post(issue,'ledger-issue');
 const base='/api/stock-ledger?from=2026-10-01&to=2026-10-31';let r=await request(base);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,2);assert.deepEqual(r.payload.data.map(v=>v.in_milli-v.out_milli),[10000,-12000]);assert.equal(r.payload.data[1].serial_count,12);assert.equal(r.payload.data[0].serial_count,10);assert.equal(r.payload.data[0].balance_milli,null);assert.equal(r.payload.balances.length,0);assert.equal(r.payload.pagination.page_size,50);
 r=await request(base+'&part_id='+item.id);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.totals.opening_milli,50000);assert.equal(r.payload.totals.closing_milli,48000);assert.deepEqual(r.payload.data.map(v=>v.balance_milli),[60000,48000]);const rows=r.payload.data;assert.equal(rows[0].day,'2026-10-05');
 const childUrl=(row,page=1)=>base+'&part_id='+item.id+'&view=children&group_key='+encodeURIComponent(row.key)+'&version='+row.version+'&page='+page+'&page_size=100';let children=await request(childUrl(rows[1]));assert.equal(children.status,200,JSON.stringify(children.payload));assert.equal(children.payload.pagination.total,12);assert.equal(children.payload.data.length,12);assert.ok(children.payload.data.every(c=>c.out_milli===1000&&c.in_milli===0));children=await request(childUrl(rows[0]));assert.equal(children.payload.pagination.total,10);assert.ok(children.payload.data.every(c=>c.in_milli===1000));
 const query=await request(base+'&part_id='+item.id+'&q=LEDGER-R001');assert.equal(query.status,200,JSON.stringify(query.payload));assert.equal(query.payload.data.length,1);assert.equal(query.payload.data[0].out_milli,12000);assert.equal(query.payload.data[0].balance_milli,48000);r=await request(base+'&part_id='+item.id+'&kind=issue&direction=desc');assert.equal(r.payload.data[0].balance_milli,48000);assert.equal(r.payload.totals.opening_milli,50000);assert.equal(r.payload.totals.closing_milli,48000);assert.equal((await request(base+'&q='+encodeURIComponent(issue.issue_details.vehicle_plate))).payload.pagination.total,1);
 r=await request(base+'&part_id='+item.id+'&direction=desc');assert.equal(r.payload.data[0].kind,'issue');assert.equal(r.payload.data[0].balance_milli,48000);r=await request(base+'&export=1&part_id='+item.id);assert.equal(r.payload.children.length,22);assert.equal(r.payload.data.length,2);assert.equal((await request(base+'&kind=invalid')).status,400);assert.equal((await request(base+'&page_size=25')).status,400);assert.equal((await request(base,{role:'warehouse'})).payload.pagination.total,0);assert.equal((await request(childUrl(rows[1]),{role:'warehouse'})).status,409);sql.prepare('INSERT INTO document_warehouse_access VALUES (?,?)').run('warehouse',warehouse.id);assert.equal((await request(base,{role:'warehouse'})).payload.pagination.total,2);
 const monthly=sql.prepare('SELECT sum(quantity_milli) q FROM stock_book_months WHERE part_id=?').get(item.id);assert.equal(monthly.q,48000);assert.equal(sql.prepare("SELECT quantity_milli FROM stock_book_months WHERE part_id=? AND period='2026-09'").get(item.id).quantity_milli,50000);
 // A later correction in the older month changes the materialized opening, not the serial source records consumed above.
 const extra=emptyDraft('receipt');extra.business_at='2026-09-29T00:00';extra.warehouse_id=warehouse.id;Object.assign(extra.lines[0],{part_id:item.id,quantity:'1',unit_price:'100',serials:['LEDGER-EXTRA']});let old=await post(extra,'ledger-backdate');assert.equal((await request(base+'&part_id='+item.id)).payload.totals.opening_milli,51000);extra.business_at='2026-09-28T00:00';extra.lines[0].unit_price='200';let edited=await request('/api/document-drafts/'+old.id,{method:'PATCH',body:{action:'save',version:old.version,reason:'Sửa trước kỳ',draft:extra,commit:true}});assert.equal(edited.status,200,JSON.stringify(edited.payload));old=edited.payload.data;assert.equal((await request(base+'&part_id='+item.id)).payload.totals.opening_milli,51000);assert.equal((await request('/api/document-drafts/'+old.id,{method:'PATCH',body:{action:'delete',version:old.version,reason:'Lập nhầm'}})).status,200);assert.equal((await request(base+'&part_id='+item.id)).payload.totals.opening_milli,50000);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

scenario('recovery list exposes saved fleet, all-filter totals and line classification counts without serial multiplication',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'opening');const vehicle=(await request('/api/vehicles',{method:'POST',body:{plate_number:'50H-REC-LIST',type:'tractor'}})).payload.data;
 Object.assign(draft,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-10T00:00'});Object.assign(draft.lines[0],{quantity:'12',unit_price:'',stock_state:'recovered',target_type:'vehicle',target_id:vehicle.id,opening_current_unit_price:'5000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,idempotency_key:'rec-list-opening',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const usage=sql.prepare('SELECT id FROM stock_usages').get().id;
 const recovery=emptyDraft('recovery');Object.assign(recovery,{business_at:'2026-10-26T10:00',warehouse_id:warehouse.id,purpose:'Thay vỏ cũ',recipient:'Lê Văn Khôi',recovery_details:{vehicle_id:vehicle.id,vehicle_plate:'50H-REC-LIST',driver_id:'',driver_name:'',trailer_number:'51R-LIST',generator_code:'MP-LIST',container_number:'CONT-LIST',removed_from:'Rơ moóc',odo:'',hours:'',handover_name:'Giản Tư Tâm'}});
 recovery.lines=[['CSD','1'],['CSC','2'],['KSD','3'],['CTL','6']].map(([classification,quantity])=>({...recovery.lines[0],id:crypto.randomUUID(),part_id:item.id,quantity,usage_id:usage,recovery_classification:classification,stock_state:['KSD','CTL'].includes(classification)?'pending_scrap':'recovered',recovery_quality_percent:'20'}));
 r=await request('/api/document-drafts',{method:'POST',body:{draft:recovery,idempotency_key:'rec-list-posted',commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));const posted=r.payload.data;assert.equal(posted.totals.net,12000);
 const draftOnly=structuredClone(recovery);draftOnly.lines=[{...draftOnly.lines[0],id:crypto.randomUUID(),quantity:'2'}];r=await request('/api/document-drafts',{method:'POST',body:{draft:draftOnly,idempotency_key:'rec-list-draft'}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const base='/api/document-drafts?kind=recovery&from=2026-10-01&to=2026-10-31&';
 r=await request(base+'page_size=1');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.pagination.total,2);assert.equal(r.payload.data.length,1);assert.equal(r.payload.receipt_totals.quantity_milli,'14000');assert.deepEqual(r.payload.receipt_totals.recovery_counts,{CSD:2,CSC:1,KSD:1,CTL:1});assert.equal(r.payload.receipt_totals.status_counts.posted,1);
 r=await request(base+'status=posted');assert.equal(r.payload.data[0].recovery_details.trailer_number,'51R-LIST');assert.equal(r.payload.data[0].partner_label,'Lê Văn Khôi');assert.equal(r.payload.receipt_totals.net,'12000');assert.deepEqual(r.payload.data[0].recovery_counts,{CSD:1,CSC:1,KSD:1,CTL:1});
 for(const q of ['50H-REC-LIST','51R-LIST','MP-LIST','CONT-LIST','gian tu tam','le van khoi','thay vo cu']){r=await request(base+'status=posted&q='+encodeURIComponent(q));assert.equal(r.payload.pagination.total,1,q+JSON.stringify(r.payload));}
 r=await request(base+'recovery_classification=CSC');assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.receipt_totals.quantity_milli,'12000');assert.equal(r.payload.data[0].code,posted.code);
 assert.equal((await request(base+'recovery_vehicle=51R-LIST&recovery_recipient='+encodeURIComponent('Văn Khôi'))).payload.pagination.total,2);
 assert.equal((await request(base+'part_id='+item.id+'&warehouse_id='+warehouse.id)).payload.pagination.total,2);assert.equal((await request(base+'part_id=other')).payload.pagination.total,0);
 r=await request(base+'include_totals=0');assert.equal(r.payload.receipt_totals,undefined);assert.equal(r.payload.pagination.total,2);
 assert.equal((await request(base+'recovery_classification=WRONG')).status,400);assert.equal((await request(base.replace('to=2026-10-31','to=2026-99-99'))).status,400);
 assert.equal((await request(base,{role:'warehouse'})).payload.pagination.total,0);assert.equal((await request(base,{role:'viewer'})).payload.pagination.total,2);
 assert.equal((await request(base+'q=%25')).payload.pagination.total,0);
 const {documentSearchGlob}=await import('../../shared/documentSearch.ts');for(const text of ['Giản Tư Tâm','LÊ VĂN KHÔI','A[12]?*']){assert.equal(sql.prepare('SELECT ? GLOB ? AS found').get(text,documentSearchGlob(text)).found,1);}
 const legacy=sql.prepare("SELECT id FROM document_drafts WHERE kind='recovery' AND posted_inventory_id IS NULL").get();sql.prepare('UPDATE document_drafts SET search_text=code WHERE id=?').run(legacy.id);
 assert.equal((await request(base+'status=draft&q=GIAN%20TU%20TAM')).payload.pagination.total,1);
 assert.equal((await request(base+'status=draft&q=thay%20vo%20cu')).payload.pagination.total,1);
 assert.equal((await request(base+'recovery_recipient=LE%20VAN%20KHOI')).payload.pagination.total,2);
 const other=(await request('/api/parts',{method:'POST',body:{...part,sku:'OTHER-REC'}})).payload.data;const mixed=structuredClone(draftOnly);mixed.lines.push({...mixed.lines[0],id:crypto.randomUUID(),part_id:other.id,recovery_classification:'CTL',stock_state:'pending_scrap'});r=await request('/api/document-drafts',{method:'POST',body:{draft:mixed,idempotency_key:'rec-list-mixed'}});assert.equal(r.status,201,JSON.stringify(r.payload));assert.equal((await request(base+'status=draft&part_id='+item.id+'&recovery_classification=CTL')).payload.pagination.total,0);assert.equal((await request(base+'status=draft&part_id='+other.id+'&recovery_classification=CTL')).payload.pagination.total,1);
 r=await request(base+'status=draft&recovery_classification=CSD,CSC');assert.equal(r.payload.pagination.total,2);r=await request(base+'status=draft&recovery_classification=CSC,CTL');assert.equal(r.payload.pagination.total,1);assert.equal((await request(base+'status=draft&part_id='+item.id+'&recovery_classification=CSC,CTL')).payload.pagination.total,0);assert.equal((await request(base+'status=draft&part_id='+other.id+'&recovery_classification=CSD,CTL')).payload.pagination.total,1);assert.equal((await request(base+'recovery_classification=CSD,WRONG')).status,400);assert.equal((await request(base+'recovery_classification=CSD,CSD')).status,400);


});

scenario('NXT summary totals serial-managed tires and batteries by quantity; detail scopes exact serial before running balances',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);sql.prepare('UPDATE parts SET name=? WHERE id=?').run('Vỏ xe theo Serial',item.id);Object.assign(draft.lines[0],{quantity:'3',unit_price:'100',serials:['NXT-TIRE-01','NXT-TIRE-02','NXT-TIRE-03']});draft.business_at='2026-10-10T10:00';const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data;};await post(draft,'nxt-serial-pn');
 const battery=(await request('/api/parts',{method:'POST',body:{...part,sku:'NXT-BATTERY',name:'Ắc quy theo Serial',is_serialized:1}})).payload.data;const bat=structuredClone(draft);Object.assign(bat.lines[0],{part_id:battery.id,quantity:'2',unit_price:'200',serials:['NXT-BAT-01','NXT-BAT-02']});await post(bat,'nxt-battery-pn');const issue=structuredClone(draft);issue.kind='issue';issue.issue_details=await issueHeaderFixture(request);issue.business_at='2026-10-12T10:00';Object.assign(issue.lines[0],{quantity:'1',unit_price:'',serials:['NXT-TIRE-01']});await post(issue,'nxt-tire-px');
 const base='/api/inventory-books?from=2026-10-01&to=2026-10-31&warehouse_id='+warehouse.id;let r=await request(base+'&book=summary');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.length,2);const tire=r.payload.data.find(g=>g.part_id===item.id),batteryGroup=r.payload.data.find(g=>g.part_id===battery.id);assert.equal(tire.in_quantity_milli,3000);assert.equal(tire.out_quantity_milli,1000);assert.equal(tire.closing_quantity_milli,2000);assert.equal(batteryGroup.closing_quantity_milli,2000);assert.ok(!JSON.stringify(r.payload.data).includes('NXT-TIRE-01'));assert.ok(!('serials' in tire));
 const card=base+'&book=card&part_id='+item.id;r=await request(card+'&q=NXT-TIRE-01');assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.data.length,2);assert.equal(r.payload.serial_filter,'NXT-TIRE-01');assert.equal(r.payload.data[0].serials,'NXT-TIRE-01');assert.deepEqual(r.payload.data.map(m=>m.balance_quantity_milli),[1000,0]);assert.equal(r.payload.totals.in_value_vnd,100);assert.equal(r.payload.totals.out_value_vnd,100);assert.equal(r.payload.groups[0].closing_quantity_milli,0);assert.equal(r.payload.groups[0].closing_value_vnd,0);
 r=await request(card+'&q=NXT-TIRE-03');assert.equal(r.payload.data.length,1);assert.equal(r.payload.data[0].in_quantity_milli,1000);assert.equal(r.payload.groups[0].closing_quantity_milli,1000);r=await request(card+'&direction=desc');assert.deepEqual(r.payload.data.map(m=>m.balance_quantity_milli),[2000,3000]);r=await request(card+'&kind=issue');assert.equal(r.payload.data.length,1);assert.equal(r.payload.data[0].balance_quantity_milli,2000);assert.equal(r.payload.groups[0].in_value_vnd,300);assert.equal((await request(card+'&q=NXT-TIRE-01',{role:'warehouse'})).status,403);assert.equal((await request(card+'&direction=bad')).status,400);assert.equal((await request(card+'&kind=bad')).status,400);
});


scenario('issue header installation target writes the correct trailer or generator usage and frozen ledger target',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);draft.lines[0].quantity='2';draft.lines[0].unit_price='100';draft.lines[0].serials=['INSTALL-RM','INSTALL-MP'];let r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'installation-pn'}});assert.equal(r.status,201,JSON.stringify(r.payload));
 const head=await issueHeaderFixture(request),tractor=head.vehicle_id;
 const trailer=(await request('/api/vehicles',{method:'POST',body:{plate_number:'INSTALL-RM',type:'trailer'}})).payload.data;
 const generator=(await request('/api/equipment',{method:'POST',body:{code:'INSTALL-MP',name:'Máy phát',type:'generator'}})).payload.data;
 const fleet=(await request('/api/equipment-pairing-sets/'+tractor)).payload.data;
 r=await request('/api/equipment-pairing-sets/'+tractor,{method:'PATCH',body:{version:fleet.version,action:'assemble',trailer_code:'INSTALL-RM',generator_1:'INSTALL-MP',effective_at:'2026-10-01T00:00:00Z',reason:'Ghép thử'}});assert.equal(r.status,200,JSON.stringify(r.payload));
 head.trailer_number='INSTALL-RM';head.other='INSTALL-MP';
 const post=async(kind,key,serial)=>{const d=structuredClone(draft);d.kind='issue';d.business_at='2026-10-24T10:00';d.issue_details={...head,installation_target:kind,installation_odo:'321.5',installation_hours:'12.25'};Object.assign(d.lines[0],{quantity:'1',unit_price:'',serials:[serial],target_type:'vehicle',target_id:tractor,odo:'999999'});return request('/api/document-drafts',{method:'POST',body:{draft:d,commit:true,idempotency_key:key}})};
 r=await post('trailer','installation-rm','INSTALL-RM');assert.equal(r.status,201,JSON.stringify(r.payload));const rm=r.payload.data;assert.equal(rm.draft.lines[0].target_id,trailer.id);assert.equal(rm.draft.lines[0].odo,'321.5');
 r=await post('generator','installation-mp','INSTALL-MP');assert.equal(r.status,201,JSON.stringify(r.payload));const mp=r.payload.data;assert.equal(mp.draft.lines[0].target_type,'equipment');assert.equal(mp.draft.lines[0].target_id,generator.id);assert.equal(mp.draft.lines[0].odo,'');assert.equal(mp.draft.lines[0].hours,'12.25');
 const usages=sql.prepare('SELECT target_type,target_id,odo_milli,hours_milli FROM stock_usages ORDER BY target_type').all();assert.ok(usages.some(u=>u.target_id===trailer.id&&u.odo_milli===321500));assert.ok(usages.some(u=>u.target_id===generator.id&&u.hours_milli===12250));
 const ledger=(await request('/api/stock-ledger?from=2026-10-01&to=2026-10-31&kind=issue')).payload;assert.ok(ledger.data.some(l=>l.target==='INSTALL-RM · Rơ moóc'&&l.readings==='321.5 km / 12.25 giờ'));assert.ok(ledger.data.some(l=>l.target==='INSTALL-MP · Máy phát'&&l.readings==='12.25 giờ'));
 const sources=(await request('/api/document-drafts?view=recovery-sources&vehicle_id='+tractor)).payload;assert.ok(sources.data.some(u=>u.target_label==='INSTALL-RM'));assert.ok(sources.data.some(u=>u.target_label==='INSTALL-MP'));
 sql.prepare('UPDATE equipment_pairing_drafts SET is_active=0').run();const after=(await request('/api/stock-ledger?from=2026-10-01&to=2026-10-31&kind=issue')).payload;assert.deepEqual(after.data.map(l=>l.target),ledger.data.map(l=>l.target));assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances WHERE part_id=?').get(item.id).quantity_milli,0);
});

scenario('issue blocks ambiguous missing or unpaired installation targets without changing stock',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'receipt');draft.lines[0].unit_price='100';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'installation-invalid-pn'}})).status,201);
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.lines[0].unit_price='';draft.issue_details.trailer_number='UNPAIRED-RM';await request('/api/vehicles',{method:'POST',body:{plate_number:'UNPAIRED-RM',type:'trailer'}});
 let r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'installation-missing'}});assert.equal(r.status,400,JSON.stringify(r.payload));assert.equal(r.payload.error.code,'ISSUE_TARGET_REQUIRED');
 draft.issue_details.installation_target='trailer';r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'installation-unpaired'}});assert.equal(r.status,400);assert.equal(r.payload.error.code,'ISSUE_TARGET_NOT_PAIRED');
 const pos=(await request('/api/mount-positions',{method:'POST',body:{code:'INSTALL-RM-POS',name:'Trục 1 Trái Trong',notes:'Rơ moóc'}})).payload.data;draft.issue_details.installation_target='vehicle';draft.lines[0].mount_position_id=pos.id;r=await request('/api/document-drafts',{method:'POST',body:{draft,commit:true,idempotency_key:'installation-position-mismatch'}});assert.equal(r.status,400,JSON.stringify(r.payload));assert.ok(r.payload.error.message.includes('Vị trí lắp không phù hợp'));
 assert.equal(sql.prepare('SELECT quantity_milli FROM stock_balances WHERE part_id=?').get(item.id).quantity_milli,1000);assert.equal(sql.prepare('SELECT count(*) n FROM stock_usages').get().n,0);
});


scenario('NXT exact Serial scopes a 50-item receipt, opening, closing, pagination, export and permissions without reading mutable current cost',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);
 Object.assign(draft.lines[0],{quantity:'50',unit_price:'3703703.7',serials:['B65006700','B650067001',...Array.from({length:48},(_,i)=>'OTHER-'+i)]});draft.business_at='2026-10-10T08:00';
 const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};
 const pn=await post(draft,'serial-50-pn');const px=structuredClone(draft);px.kind='issue';px.issue_details=await issueHeaderFixture(request);px.business_at='2026-10-14T10:48';Object.assign(px.lines[0],{quantity:'1',unit_price:'',serials:['B65006700']});const issue=await post(px,'serial-50-px');
 sql.prepare('UPDATE inventory_serials SET cost_vnd_milli=999999999 WHERE part_id=?').run(item.id);
 const movementsBefore=JSON.stringify(sql.prepare('SELECT * FROM stock_movements ORDER BY id').all());
 const base='/api/inventory-books?book=card&part_id='+item.id+'&q=b65006700';const month='&from=2026-10-01&to=2026-10-31';
 let r=await request(base+month);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.serial_filter,'B65006700');assert.deepEqual(r.payload.data.map(m=>[m.serials,m.in_quantity_milli,m.out_quantity_milli,m.balance_quantity_milli,m.balance_value_vnd]),[['B65006700',1000,0,1000,3703704],['B65006700',0,1000,0,0]]);assert.deepEqual([r.payload.totals.in_value_vnd,r.payload.totals.out_value_vnd,r.payload.totals.closing_value_vnd],[3703704,3703704,0]);assert.equal(r.payload.groups[0].closing_quantity_milli,0);
 r=await request(base+'&from=2026-10-11&to=2026-10-31');assert.equal(r.payload.groups[0].opening_quantity_milli,1000);assert.equal(r.payload.groups[0].opening_value_vnd,3703704);assert.equal(r.payload.groups[0].in_quantity_milli,0);assert.equal(r.payload.data[0].balance_quantity_milli,0);
 r=await request(base+'&from=2026-10-01&to=2026-10-12');assert.equal(r.payload.groups[0].closing_quantity_milli,1000);assert.equal(r.payload.totals.out_value_vnd,0);
 r=await request(base+month+'&page_size=1&page=2');assert.equal(r.payload.pagination.total,2);assert.equal(r.payload.data.length,1);assert.equal(r.payload.data[0].draft_id,issue.id);assert.equal(r.payload.groups[0].in_quantity_milli,1000);
 r=await request(base+month+'&direction=desc&export=1');assert.equal(r.payload.pagination.total,2);assert.deepEqual(r.payload.data.map(m=>m.draft_id),[issue.id,pn.id]);assert.deepEqual(r.payload.data.map(m=>m.balance_quantity_milli),[0,1000]);
 r=await request(base+month+'&kind=issue');assert.equal(r.payload.data.length,1);assert.equal(r.payload.groups[0].in_quantity_milli,1000);assert.equal(r.payload.totals.in_value_vnd,3703704);
 const byDoc=await request('/api/inventory-books?book=card&part_id='+item.id+month+'&q='+encodeURIComponent(pn.code));assert.equal(byDoc.payload.serial_filter,undefined);assert.equal(byDoc.payload.data[0].in_quantity_milli,50000);
 r=await request(base+month,{role:'warehouse'});assert.equal(r.payload.data.length,0);assert.equal(r.payload.serial_filter,undefined);sql.prepare('INSERT INTO document_warehouse_access VALUES (?,?)').run('warehouse',warehouse.id);r=await request(base+month,{role:'warehouse'});assert.equal(r.payload.serial_filter,'B65006700');assert.equal(r.payload.groups[0].closing_quantity_milli,0);
 assert.equal(JSON.stringify(sql.prepare('SELECT * FROM stock_movements ORDER BY id').all()),movementsBefore);
});

scenario('NXT exact Serial retains distinct frozen costs within one mixed-price issue line',async({request,sql})=>{
 const {draft,item}=await documentFixture(request,'receipt',true);const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};
 Object.assign(draft.lines[0],{quantity:'2',unit_price:'100',serials:['MIX-A','MIX-B']});await post(draft,'mix-pn-1');Object.assign(draft.lines[0],{quantity:'1',unit_price:'300',serials:['MIX-C']});await post(draft,'mix-pn-2');
 draft.kind='issue';draft.issue_details=await issueHeaderFixture(request);draft.business_at='2026-10-24T10:00';Object.assign(draft.lines[0],{quantity:'2',unit_price:'',serials:['MIX-A','MIX-C']});await post(draft,'mix-px');sql.prepare('UPDATE inventory_serials SET cost_vnd_milli=999000').run();
 for(const [sn,value] of [['MIX-A',100],['MIX-C',300]]){const r=await request('/api/inventory-books?book=card&from=2026-10-01&to=2026-10-31&part_id='+item.id+'&q='+sn);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.totals.in_value_vnd,value);assert.equal(r.payload.totals.out_value_vnd,value);assert.equal(r.payload.groups[0].closing_quantity_milli,0);assert.equal(r.payload.groups[0].closing_value_vnd,0);}
});


scenario('optimized stock ledger uses a bounded read budget and retains all-filter totals, empty pages and child version checks',async({request,sql,env})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);Object.assign(draft.lines[0],{quantity:'3',unit_price:'100',serials:['PERF-A','PERF-B','PERF-C']});const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};await post(draft,'perf-receipt');
 const liquid=(await request('/api/parts',{method:'POST',body:{...part,sku:'PERF-LIQUID',unit:'Lít',is_serialized:0}})).payload.data;const other=structuredClone(draft);Object.assign(other.lines[0],{part_id:liquid.id,quantity:'2.125',serials:[],unit_price:'200'});await post(other,'perf-liquid');
 const base='/api/stock-ledger?from=2026-10-01&to=2026-10-31';const batch=env.DB.batch;let statements=0;env.DB.batch=async ss=>{statements+=ss.length;return batch(ss)};
 let r=await request(base);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(statements,2,'ordinary ledger read must stay within two report statements');assert.equal(r.payload.pagination.total,2);assert.equal(r.payload.totals.closing_milli,null);assert.deepEqual(r.payload.units.map(u=>[u.unit,u.in_milli]).sort(),[['Cái',3000],['Lít',2125]]);const parent=r.payload.data.find(g=>g.part_id===item.id);
 statements=0;r=await request(base+'&page=2');assert.equal(r.status,200);assert.equal(statements,2);assert.deepEqual(r.payload.data,[]);assert.equal(r.payload.pagination.total,2);assert.equal(r.payload.units.length,2);
 r=await request(base+'&q=PERF-A&part_id='+item.id);assert.equal(r.payload.pagination.total,1);assert.equal(r.payload.data[0].in_milli,3000,'stock ledger search keeps complete group quantities');assert.equal(r.payload.data[0].balance_milli,3000);assert.equal(r.payload.balances[0].closing_milli,3000);
 r=await request(base+'&q=not-found&part_id='+item.id);assert.equal(r.payload.pagination.total,0);assert.deepEqual(r.payload.units,[]);assert.equal(r.payload.balances[0].closing_milli,3000);assert.equal((await request(base+'&q=%25')).payload.pagination.total,0);assert.equal((await request(base+'&q=_')).payload.pagination.total,0);
 const child=base+'&view=children&group_key='+encodeURIComponent(parent.key)+'&version='+parent.version;statements=0;r=await request(child);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(statements,2);assert.equal(r.payload.pagination.total,3);assert.deepEqual(r.payload.data.map(c=>c.serial),['PERF-A','PERF-B','PERF-C']);r=await request(child+'&page=2');assert.equal(r.status,200);assert.deepEqual(r.payload.data,[]);assert.equal(r.payload.pagination.total,3);assert.equal((await request(child.replace('version='+parent.version,'version=999'))).status,409);assert.equal((await request(child+'&q=not-found')).status,409);assert.equal((await request(child,{role:'warehouse'})).status,409);
 statements=0;r=await request(base+'&export=1');assert.equal(r.status,200);assert.equal(statements,3);assert.equal(r.payload.children.length,4);assert.equal(r.payload.units.length,2);
 env.DB.batch=async ss=>{const result=await batch(ss);if(ss.length===3&&ss[1].query.includes('units_json'))result[1].results[0].total=10001;return result};r=await request(base+'&export=1');assert.equal(r.status,422);assert.equal(r.payload.error.code,'LEDGER_EXPORT_LIMIT');env.DB.batch=batch;
});


scenario('optimized ledger statistics retain separate warehouse/state balances through transfer, issue and recovery',async({request,sql})=>{
 const {draft,item,warehouse}=await documentFixture(request,'receipt',true);Object.assign(draft.lines[0],{quantity:'2',unit_price:'100',serials:['OPT-A','OPT-B']});const post=async(d,key)=>{const r=await request('/api/document-drafts',{method:'POST',body:{draft:d,idempotency_key:key,commit:true}});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data};await post(draft,'opt-multi-pn');
 const other=(await request('/api/warehouses',{method:'POST',body:{code:'OPT-OTHER',name:'Kho khác',kind:'parts'}})).payload.data;const transfer=structuredClone(draft);transfer.kind='warehouse_transfer';transfer.business_at='2026-10-24T09:00';transfer.destination_warehouse_id=other.id;Object.assign(transfer.lines[0],{quantity:'1',unit_price:'',serials:['OPT-B']});await post(transfer,'opt-multi-transfer');
 const issue=structuredClone(draft);issue.kind='issue';issue.business_at='2026-10-24T10:00';issue.issue_details=await issueHeaderFixture(request);Object.assign(issue.lines[0],{quantity:'1',unit_price:'',serials:['OPT-A']});await post(issue,'opt-multi-issue');const usage=sql.prepare('SELECT id FROM stock_usages LIMIT 1').get().id;
 const recovery=structuredClone(issue);recovery.kind='recovery';delete recovery.issue_details;recovery.business_at='2026-10-24T11:00';Object.assign(recovery.lines[0],{usage_id:usage,stock_state:'recovered',recovery_classification:'CSD',recovery_quality_percent:'50',odo:'200'});await post(recovery,'opt-multi-recovery');
 const base='/api/stock-ledger?from=2026-10-01&to=2026-10-31&part_id='+item.id;let r=await request(base);assert.equal(r.status,200,JSON.stringify(r.payload));assert.equal(r.payload.totals.closing_milli,2000);assert.equal(r.payload.balances.length,3);assert.equal(r.payload.balances.find(b=>b.warehouse_id===warehouse.id&&b.stock_state==='new').closing_milli,0);assert.equal(r.payload.balances.find(b=>b.warehouse_id===warehouse.id&&b.stock_state==='recovered').closing_milli,1000);assert.equal(r.payload.balances.find(b=>b.warehouse_id===other.id).closing_milli,1000);assert.deepEqual(r.payload.units,[{unit:'Cái',in_milli:4000,out_milli:2000}]);
 r=await request(base+'&q=OPT-A');assert.equal(r.payload.pagination.total,3);assert.equal(r.payload.totals.closing_milli,2000);assert.equal(r.payload.units[0].in_milli,3000);assert.equal(r.payload.units[0].out_milli,1000);
 sql.prepare('INSERT INTO document_warehouse_access VALUES (?,?)').run('warehouse',warehouse.id);r=await request(base,{role:'warehouse'});assert.equal(r.payload.balances.length,2);assert.equal(r.payload.totals.closing_milli,1000);assert.ok(r.payload.data.every(g=>g.warehouse_id===warehouse.id));assert.equal((await request(base+'&warehouse_id='+other.id,{role:'warehouse'})).status,403);
});
