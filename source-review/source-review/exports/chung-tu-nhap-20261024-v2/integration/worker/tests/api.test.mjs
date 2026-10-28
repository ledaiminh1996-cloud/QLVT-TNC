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
  for (const name of ['0001_inventory_core.sql', '0002_catalog_versions.sql', '0003_directory_details.sql', '0004_part_numbering.sql', '0005_part_price_min_stock.sql', '0006_part_hours_min_stock_unit.sql', '0007_fuel_tanks.sql', '0008_personnel_tree.sql', '0009_staff_rank.sql', '0010_supplier_rules.sql', '0011_supplier_optional_province.sql', '0012_equipment_catalog.sql', '0013_equipment_import_framework.sql', '0014_pairing_sets.sql', '0015_unicode_catalog_search.sql', '0016_stopped_condition_label.sql', '0017_pairing_route_version.sql', '0018_pairing_review_workflow.sql', '0019_catalog_history_index.sql', '0020_document_drafts.sql', '0021_document_validation.sql']) {
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

async function documentFixture(request,kind='receipt',serial=false){
 const create=async(path,body)=>{const r=await request(path,{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.payload));return r.payload.data;};
 const warehouse=await create('/api/warehouses',{code:'D-WH',name:'Kho chứng từ',kind:'parts'}),item=await create('/api/parts',{...part,sku:'D-PART',category:kind==='retread'?'tires':part.category,is_serialized:serial?1:0});
 const draft=emptyDraft(kind);draft.business_at='2026-10-24T08:30';draft.warehouse_id=warehouse.id;draft.lines[0].part_id=item.id;if(['receipt','proposal','opening'].includes(kind))draft.lines[0].unit_price='12345';return {draft,item,warehouse};
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
 const bad=structuredClone(draft);bad.lines[0].quantity='2';assert.equal((await request('/api/document-drafts',{method:'POST',body:{draft:bad,idempotency_key:'bad'}})).status,400);
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
