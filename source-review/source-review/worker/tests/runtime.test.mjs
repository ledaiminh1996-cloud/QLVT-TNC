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
    for (const name of ['0001_inventory_core.sql', '0002_catalog_versions.sql', '0003_directory_details.sql', '0004_part_numbering.sql', '0005_part_price_min_stock.sql', '0006_part_hours_min_stock_unit.sql', '0007_fuel_tanks.sql', '0008_personnel_tree.sql', '0009_staff_rank.sql', '0010_supplier_rules.sql', '0011_supplier_optional_province.sql', '0012_equipment_catalog.sql', '0013_equipment_import_framework.sql', '0014_pairing_sets.sql', '0015_unicode_catalog_search.sql', '0016_stopped_condition_label.sql', '0017_pairing_route_version.sql', '0018_pairing_review_workflow.sql', '0019_catalog_history_index.sql', '0020_document_drafts.sql', '0021_document_validation.sql', '0022_document_serials.sql', '0023_receipt_posting.sql', '0024_inventory_operations.sql', '0025_receipt_exact_pricing.sql', '0026_vat_catalog.sql', '0027_mount_positions.sql', '0028_serial_cost_snapshot.sql', '0029_mount_position_usage.sql', '0030_pending_inventory_values.sql', '0031_opening_in_use.sql', '0032_user_access.sql', '0033_native_auth.sql', '0034_opening_management_units.sql', '0035_opening_edits.sql', '0036_stock_book_months.sql']) {
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
    const recoveryListResponse=await call('/api/document-drafts?kind=recovery&q=Gi%E1%BA%A3n&recovery_recipient=Kh%C3%B4i');assert.equal(recoveryListResponse.status,200,await recoveryListResponse.clone().text());const recoveryListResult=await recoveryListResponse.json();assert.equal(recoveryListResult.receipt_totals.count,0);assert.deepEqual(recoveryListResult.receipt_totals.recovery_counts,{CSD:0,CSC:0,KSD:0,CTL:0});
    const serialPart=await call('/api/parts','POST',{sku:'RUNTIME-SERIAL',name:'Multi serial',unit:'Cái',is_serialized:1});assert.equal(serialPart.status,201);const serialPartId=(await serialPart.json()).data.id;const multi=structuredClone(draft);multi.lines[0].part_id=serialPartId;multi.lines[0].quantity='5';multi.lines[0].serials=['000001','000002','000003'];multi.lines[0].id=crypto.randomUUID();const multiResult=await call('/api/document-drafts','POST',{draft:multi,idempotency_key:'runtime-multi'});assert.equal(multiResult.status,201,await multiResult.clone().text());const multiRow=(await multiResult.json()).data;assert.deepEqual(multiRow.draft.lines[0].serials,['000001','000002','000003']);assert.equal((await db.prepare('SELECT count(*) n FROM document_draft_serials WHERE document_id=?').bind(multiRow.id).first()).n,3);assert.equal((await db.prepare('SELECT count(*) n FROM inventory_serials').first()).n,0);
    multi.lines[0].quantity='3';const body={draft:multi,idempotency_key:'runtime-posted',commit:true};const posted=await call('/api/document-drafts','POST',body);assert.equal(posted.status,201,await posted.clone().text());const postedRow=(await posted.json()).data;assert.equal(postedRow.status,'posted');assert.equal((await db.prepare('SELECT quantity_milli FROM stock_balances WHERE part_id=?').bind(serialPartId).first()).quantity_milli,3000);assert.equal((await db.prepare('SELECT count(*) n FROM inventory_serials').first()).n,3);assert.equal((await call('/api/document-drafts','POST',body)).status,200);assert.equal((await db.prepare('SELECT count(*) n FROM stock_movements').first()).n,1);
    const ledger=await call('/api/inventory-books?book=card&from=2026-10-01&to=2026-10-31&part_id='+serialPartId);assert.equal(ledger.status,200,await ledger.clone().text());const book=(await ledger.json());assert.equal(book.data.length,1);assert.equal(book.data[0].balance_quantity_milli,3000);assert.equal(book.data[0].serials.split('; ').length,3);assert.equal(book.groups[0].closing_value_vnd,300000);
    const groupedResponse=await call('/api/stock-ledger?from=2026-10-01&to=2026-10-31&part_id='+serialPartId);assert.equal(groupedResponse.status,200,await groupedResponse.clone().text());const grouped=(await groupedResponse.json());assert.equal(grouped.data.length,1);assert.equal(grouped.data[0].serial_count,3);assert.equal(grouped.data[0].balance_milli,3000);assert.equal(grouped.totals.opening_milli,0);assert.equal((await db.prepare('SELECT sum(quantity_milli) q FROM stock_book_months WHERE part_id=?').bind(serialPartId).first()).q,3000);
    const groupedSearchResponse=await call('/api/stock-ledger?from=2026-10-01&to=2026-10-31&part_id='+serialPartId+'&q=000001');assert.equal(groupedSearchResponse.status,200,await groupedSearchResponse.clone().text());const groupedSearch=await groupedSearchResponse.json();assert.equal(groupedSearch.data.length,1);assert.equal(groupedSearch.data[0].in_milli,3000);assert.equal(groupedSearch.units[0].in_milli,3000);assert.equal(groupedSearch.balances[0].closing_milli,3000);
    const selectedGroup=groupedSearch.data[0],childUrl='/api/stock-ledger?from=2026-10-01&to=2026-10-31&view=children&group_key='+encodeURIComponent(selectedGroup.key)+'&version='+selectedGroup.version;const childResponse=await call(childUrl);assert.equal(childResponse.status,200,await childResponse.clone().text());const childPage=await childResponse.json();assert.equal(childPage.pagination.total,3);assert.equal(childPage.data.length,3);assert.ok(childPage.data.every(c=>c.in_milli===1000));assert.equal((await call(childUrl+'&q=not-present')).status,409);
    const emptyLedger=await call('/api/stock-ledger?from=2026-10-01&to=2026-10-31&q=not-present');assert.equal(emptyLedger.status,200);const emptyLedgerPage=await emptyLedger.json();assert.deepEqual(emptyLedgerPage.data,[]);assert.deepEqual(emptyLedgerPage.units,[]);assert.equal(emptyLedgerPage.pagination.total,0);
    const nxtSummary=await call('/api/inventory-books?book=summary&from=2026-10-01&to=2026-10-31&part_id='+serialPartId);assert.equal(nxtSummary.status,200,await nxtSummary.clone().text());const nxtGroup=(await nxtSummary.json()).data[0];assert.equal(nxtGroup.closing_quantity_milli,3000);assert.equal(nxtGroup.serials,undefined);
    const nxtCard=await call('/api/inventory-books?book=card&from=2026-10-01&to=2026-10-31&part_id='+serialPartId+'&direction=desc&kind=receipt');assert.equal(nxtCard.status,200,await nxtCard.clone().text());const nxtMovement=(await nxtCard.json()).data[0];assert.equal(nxtMovement.in_quantity_milli,3000);assert.ok(nxtMovement.serials);

    multi.lines[0].unit_price='120000';let edited=await call('/api/document-drafts/'+postedRow.id,'PATCH',{action:'save',version:postedRow.version,reason:'Sửa PN chưa xuất',draft:multi,commit:true});assert.equal(edited.status,200,await edited.clone().text());const updated=(await edited.json()).data;
    const px=structuredClone(multi);px.kind='issue';
    const driverResponse=await call('/api/staff','POST',{code:'RUNTIME-DRV',name:'Tài xế thử',staff_type:'driver'});assert.equal(driverResponse.status,201);const driverId=(await driverResponse.json()).data.id;
    const vehicleResponse=await call('/api/vehicles','POST',{plate_number:'RUNTIME-PX',type:'tractor',assigned_driver_id:driverId,current_odo_km:100});assert.equal(vehicleResponse.status,201);const vehicleId=(await vehicleResponse.json()).data.id;
    px.issue_details={recipient_staff_id:'',department_id:'',department_name:'',driver_id:driverId,driver_name:'',vehicle_id:vehicleId,vehicle_plate:'',odo:'100',vehicle_group:'',trailer_number:'',container_number:'',other:''};
    px.business_at='2026-10-24T09:00';px.lines[0].unit_price='';px.lines[0].vat_rate='0';px.lines[0].quantity='1';px.lines[0].serials=['000001'];const issued=await call('/api/document-drafts','POST',{draft:px,idempotency_key:'runtime-issue',commit:true});assert.equal(issued.status,201,await issued.clone().text());assert.equal((await db.prepare('SELECT quantity_milli FROM stock_balances WHERE part_id=?').bind(serialPartId).first()).quantity_milli,2000);
    const blocked=await call('/api/document-drafts/'+postedRow.id,'PATCH',{action:'delete',version:updated.version,reason:'Không xóa PN đã xuất'});assert.equal(blocked.status,409,await blocked.clone().text());



    }

    const openingVehicleResponse=await call('/api/vehicles','POST',{plate_number:'D1-OPEN-EDIT',type:'tractor'});assert.equal(openingVehicleResponse.status,201);const openingVehicle=(await openingVehicleResponse.json()).data;
    const openingDraft=emptyDraft('opening');Object.assign(openingDraft,{opening_mode:'in_use',warehouse_id:'',business_at:'2026-10-10T08:00'});Object.assign(openingDraft.lines[0],{part_id:id,quantity:'10',stock_state:'recovered',unit_price:'',target_type:'vehicle',target_id:openingVehicle.id,to_position:'D1 OPEN',opening_current_unit_price:'100',opening_quality_percent:'50',opening_assessor:'Kỹ thuật D1'});
    const openingCreate=await call('/api/document-drafts','POST',{draft:openingDraft,idempotency_key:'d1-opening-edit',commit:true});assert.equal(openingCreate.status,201,await openingCreate.clone().text());let openingRecord=(await openingCreate.json()).data;assert.equal(openingRecord.can_modify,true);const rootBefore=await db.prepare('SELECT id,version FROM stock_usages WHERE document_id=?').bind(openingRecord.id).first();
    openingRecord.draft.lines[0].opening_current_unit_price='200';const openingEdit=await call('/api/document-drafts/'+openingRecord.id,'PATCH',{action:'save',version:openingRecord.version,reason:'D1 sửa giá đầu kỳ',draft:openingRecord.draft});assert.equal(openingEdit.status,200,await openingEdit.clone().text());openingRecord=(await openingEdit.json()).data;assert.equal(openingRecord.version,2);assert.equal(openingRecord.totals.net,1000);const rootAfter=await db.prepare('SELECT id,version FROM stock_usages WHERE document_id=?').bind(openingRecord.id).first();assert.equal(rootAfter.id,rootBefore.id);assert.equal(rootAfter.version,rootBefore.version+1);assert.equal((await db.prepare('SELECT count(*) n FROM receipt_mutation_locks').first()).n,0);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);

    const userWarehouse=await db.prepare('SELECT id FROM warehouses LIMIT 1').first();
    const managed=await call('/api/user-management','POST',{email:'d1-user@example.invalid',display_name:'Thủ kho D1',role:'warehouse',is_active:1,warehouse_ids:[userWarehouse.id]});assert.equal(managed.status,201,await managed.clone().text());const managedRow=(await managed.json()).data;assert.equal(managedRow.access_linked,0);assert.equal(managedRow.warehouses[0].id,userWarehouse.id);
    const managedList=await call('/api/user-management?status=pending&q=d1-user');assert.equal(managedList.status,200,await managedList.clone().text());assert.equal((await managedList.json()).pagination.total,1);
    const userJwt=await new SignJWT({email:'d1-user@example.invalid'}).setProtectedHeader({alg:'RS256',kid:'runtime-key'}).setSubject('runtime-new-user').setIssuer('https://tnc-test.cloudflareaccess.com').setAudience('runtime-aud').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    const firstLogin=await mf.dispatchFetch('https://inventory.example.invalid/api/auth/me',{headers:{Authorization:`Bearer ${userJwt}`}});assert.equal(firstLogin.status,200,await firstLogin.clone().text());assert.equal((await firstLogin.json()).data.user.id,managedRow.id);assert.equal((await db.prepare('SELECT access_linked FROM app_users WHERE id=?').bind(managedRow.id).first()).access_linked,1);
  } finally { await mf.dispose(); }
});
