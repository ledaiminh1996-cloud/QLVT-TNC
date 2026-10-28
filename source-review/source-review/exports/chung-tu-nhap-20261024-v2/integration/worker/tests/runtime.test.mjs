import {emptyDraft} from '../../shared/documents.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { fileURLToPath } from 'node:url';

test('Workers runtime + D1: JWT, migrations, catalog writes, audit and stale versions', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'runtime-key', alg: 'RS256', use: 'sig' };
  const result = await build({
    stdin: {
      // Only this test wrapper supplies local public keys. The production entry
      // always fetches Cloudflare Access's JWKS; it has no test auth switch.
      contents: `import { createHandler } from './src/index.ts';
        import { createAccessVerifier } from './src/auth.ts';
        import { createLocalJWKSet } from 'jose';
        export default { fetch: createHandler(createAccessVerifier(() => createLocalJWKSet(${JSON.stringify({ keys: [jwk] })}))) };`,
      resolveDir: fileURLToPath(new URL('..', import.meta.url)),
      sourcefile: 'runtime-test-entry.ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: result.outputFiles[0].text,
    compatibilityDate: '2026-10-20',
    d1Databases: { DB: 'test-tnc-runtime' },
    bindings: { ACCESS_TEAM_DOMAIN: 'tnc-test.cloudflareaccess.com', ACCESS_AUD: 'runtime-aud' },
  }));
  try {
    const db = await mf.getD1Database('DB');
    for (const name of ['0001_inventory_core.sql', '0002_catalog_versions.sql', '0003_directory_details.sql', '0004_part_numbering.sql', '0005_part_price_min_stock.sql', '0006_part_hours_min_stock_unit.sql', '0007_fuel_tanks.sql', '0008_personnel_tree.sql', '0009_staff_rank.sql', '0010_supplier_rules.sql', '0011_supplier_optional_province.sql', '0012_equipment_catalog.sql', '0013_equipment_import_framework.sql', '0014_pairing_sets.sql', '0015_unicode_catalog_search.sql', '0016_stopped_condition_label.sql', '0017_pairing_route_version.sql', '0018_pairing_review_workflow.sql', '0019_catalog_history_index.sql', '0020_document_drafts.sql', '0021_document_validation.sql']) {
      const sql = readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
      const protectedSql = sql.replace(/CREATE TRIGGER[\s\S]*?END;/g, block => block.slice(0,-1).replaceAll(';', '__TRIGGER_SEMICOLON__') + ';');
      await db.batch(protectedSql.split(';').map(s => s.replaceAll('__TRIGGER_SEMICOLON__', ';').trim()).filter(Boolean).map(s => db.prepare(s)));
    }
    await db.prepare("INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES ('u','runtime-sub','runtime@example.invalid','Runtime admin','admin')").run();
    const jwt = await new SignJWT({ email: 'runtime@example.invalid' })
      .setProtectedHeader({ alg: 'RS256', kid: 'runtime-key' }).setSubject('runtime-sub')
      .setIssuer('https://tnc-test.cloudflareaccess.com').setAudience('runtime-aud').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    const call = (path, method = 'GET', body) => mf.dispatchFetch(`https://inventory.example.invalid${path}`, {
      method, headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal((await mf.dispatchFetch('https://inventory.example.invalid/api/health')).status, 200);
    assert.equal((await mf.dispatchFetch('https://inventory.example.invalid/api/parts')).status, 401);
    const create = await call('/api/parts', 'POST', { sku: 'D1-1', name: 'D1 test', unit: 'Cái', category: 'filters', applicable_for: 'both' });
    assert.equal(create.status, 201, await create.clone().text());
    const id = (await create.json()).data.id;
    assert.equal((await db.prepare('SELECT count(*) AS n FROM audit_events').first()).n, 1);
    assert.equal((await call(`/api/parts/${id}`, 'PATCH', { name: 'Changed on D1', version: 1 })).status, 200);
    assert.equal((await call(`/api/parts/${id}`, 'PATCH', { name: 'Stale', version: 1 })).status, 409);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM audit_events').first()).n, 2);
    assert.equal((await db.prepare('SELECT name FROM parts WHERE id=?').bind(id).first()).name, 'Changed on D1');
    const duplicate = await call('/api/parts', 'POST', { sku: 'd1-1', name: 'Duplicate', unit: 'Cái', category: 'filters', applicable_for: 'both' });
    assert.equal(duplicate.status, 409);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM audit_events').first()).n, 2);
    assert.equal((await call('/api/part-objects', 'POST', { code: 'IN', name: 'Đối tượng IN' })).status, 201);
    assert.equal((await call('/api/part-groups', 'POST', { code: 'TDONG', name: 'Nhóm TDONG' })).status, 201);
    const numbered = { name: 'Concurrent part', category: 'accessories', unit: 'Cái', applicable_for: 'both', item_type: 'M', object_code: 'IN', group_code: 'TDONG' };
    const parallel = await Promise.all(Array.from({ length: 4 }, () => call('/api/parts', 'POST', numbered)));
    const numberedResults = await Promise.all(parallel.map(async response => { assert.equal(response.status, 201, await response.clone().text()); return response.json(); }));
    assert.deepEqual(numberedResults.map(result => result.data.sku).sort(), ['M-IN-TDONG-0001', 'M-IN-TDONG-0002', 'M-IN-TDONG-0003', 'M-IN-TDONG-0004']);
    const importRequest = { batch_id: 'runtime-import-test-001', rows: [numbered, numbered] };
    const imported = await call('/api/parts/import', 'POST', importRequest);
    assert.equal(imported.status, 201, await imported.clone().text());
    assert.deepEqual((await imported.json()).data.map(row => row.sku), ['M-IN-TDONG-0005', 'M-IN-TDONG-0006']);
    assert.equal((await call('/api/parts/import', 'POST', importRequest)).status, 200);
    const warehouseResponse = await call('/api/warehouses','POST',{code:'K1',name:'Kho 1'});
    assert.equal(warehouseResponse.status,201);
    const warehouse = (await warehouseResponse.json()).data;
    const tankResponse = await call('/api/fuel-tanks','POST',{code:'B1',name:'Bồn 1',warehouse_id:warehouse.id,capacity_milli:25000125});
    assert.equal(tankResponse.status,201,await tankResponse.clone().text());
    assert.equal((await call('/api/fuel-tanks?warehouse_id='+warehouse.id).then(r=>r.json())).pagination.total,1);
    assert.equal((await call('/api/warehouses/'+warehouse.id,'PATCH',{version:1,is_active:0})).status,409);
    await assert.rejects(()=>db.prepare('UPDATE warehouses SET is_active=0 WHERE id=?').bind(warehouse.id).run(),/WAREHOUSE_HAS_ACTIVE_TANKS/);
    const unitResponse=await call('/api/org-units','POST',{code:'DV1',name:'Đơn vị 1'});
    assert.equal(unitResponse.status,201,await unitResponse.clone().text());
    const unit=(await unitResponse.json()).data;
    const teams=(await call('/api/departments?unit_id='+unit.id).then(r=>r.json())).data;
    assert.equal(teams.length,0);
    const office=(await call('/api/departments','POST',{code:'HC',name:'Hành chính',unit_id:unit.id}).then(r=>r.json())).data;
    const driverResponse=await call('/api/staff','POST',{code:'TX1',name:'Tài xế',staff_type:'driver',vehicle_plate:'50H-1',trailer_plate:'51R-1'});
    assert.equal(driverResponse.status,201,await driverResponse.clone().text());
    const driver=(await driverResponse.json()).data;
    assert.equal((await call('/api/vehicles','POST',{plate_number:'50H-1',type:'tractor',assigned_driver_id:driver.id})).status,201);
    const pairPage=await call('/api/equipment-pairing-sets').then(r=>r.json());
    const set=pairPage.data.find(row=>row.parent_code==='50H-1');assert.ok(set);
    assert.equal((await call('/api/vehicles','POST',{plate_number:'RM-1',type:'trailer'})).status,201);
    assert.equal((await call('/api/equipment','POST',{code:'MP-1',name:'Máy phát',type:'generator'})).status,201);
    const pairResponse=await call('/api/equipment-pairing-sets/'+set.id,'PATCH',{version:set.version,action:'assemble',trailer_code:'RM-1',generator_1:'MP-1',effective_at:'2026-01-01T00:00:00Z',reason:'Runtime ghép'});
    assert.equal(pairResponse.status,200,await pairResponse.clone().text());
    assert.equal(JSON.parse((await pairResponse.json()).data.links_json).length,2);
    assert.equal((await call('/api/equipment-pairing-sets/'+set.id,'PATCH',{version:set.version,trailer_code:''})).status,409);
    const historyResponse=await call('/api/parts?view=history&entity_id='+id);assert.equal(historyResponse.status,200,await historyResponse.clone().text());assert.ok((await historyResponse.json()).pagination.total>=2);
    assert.ok(office.id);
    await assert.rejects(()=>db.prepare('UPDATE org_units SET is_active=0 WHERE id=?').bind(unit.id).run(),/ORG_HAS_MEMBERS/);
    const suppliers=await Promise.all(Array.from({length:4},()=>call('/api/suppliers','POST',{name:'NCC đồng thời',province_name:'Hà Nội'})));
    const supplierRows=await Promise.all(suppliers.map(async r=>{assert.equal(r.status,201,await r.clone().text());return (await r.json()).data;}));
    assert.deepEqual(supplierRows.map(row=>row.code).sort(),['NCC00001','NCC00002','NCC00003','NCC00004']);
    const unicodeSupplier=await call('/api/suppliers','POST',{name:'ĐẠI LONG'});assert.equal(unicodeSupplier.status,201);
    const unicodeSearch=await call('/api/suppliers?q='+encodeURIComponent('đại long')).then(r=>r.json());assert.equal(unicodeSearch.pagination.total,1);assert.equal(unicodeSearch.data[0].name,'ĐẠI LONG');
    const taxRace=await Promise.all(Array.from({length:2},()=>call('/api/suppliers','POST',{name:'Trùng MST',province_name:'Đà Nẵng',tax_code:'1234567890'})));
    assert.deepEqual(taxRace.map(r=>r.status).sort(),[201,409]);
    await db.prepare("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'test audit failure'); END").run();
    const rejected = await call('/api/parts', 'POST', { sku: 'D1-ROLLBACK', name: 'Must roll back', unit: 'Cái', category: 'filters', applicable_for: 'both' });
    assert.equal(rejected.status, 500);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM parts WHERE sku='D1-ROLLBACK'").first()).n, 0);

    {
    await db.prepare('DROP TRIGGER fail_audit').run();
    const warehouse=await call('/api/warehouses','POST',{code:'RUNTIME-WH',name:'Kho cục bộ',kind:'parts'});assert.equal(warehouse.status,201);const warehouseId=(await warehouse.json()).data.id;
    const draft=emptyDraft('receipt');draft.business_at='2026-10-24T08:30';draft.warehouse_id=warehouseId;draft.lines[0].part_id=id;draft.lines[0].unit_price='100000';draft.lines[0].vat_rate='8';
    const prepared=await call('/api/document-drafts','POST',{draft,idempotency_key:'runtime-document'});assert.equal(prepared.status,201,await prepared.clone().text());const document=(await prepared.json()).data;assert.equal(document.code,'10.26.00001/PN');assert.equal(document.totals.gross,108000);
    assert.equal((await call('/api/document-drafts/'+document.id,'PATCH',{version:1,action:'post',reason:'Chưa bật ghi sổ'})).status,409);
    assert.equal((await db.prepare('SELECT count(*) n FROM stock_movements').first()).n,0);
    assert.equal((await call('/api/document-drafts?kind=receipt&q=10.26.00001')).status,200);
    }

  } finally { await mf.dispose(); }
});
