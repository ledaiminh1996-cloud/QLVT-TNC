import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createCatalogClient, CatalogApiError } from '../src/api/catalogClient.ts';
import type { CatalogClient, CatalogRow, Resource, Session } from '../src/api/catalogClient.ts';
import { formPayload, initialValues } from '../src/api/catalogFields.ts';
import { convertPartImport, parseDelimited } from '../src/api/partImport.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000/' });
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const { render, screen, fireEvent, waitFor, cleanup, within, act } = await import('@testing-library/react');
const { CloudCatalogApp } = await import('../src/components/CloudCatalogApp.tsx');
const { ConnectedDirectory } = await import('../src/components/ConnectedDirectory.tsx');
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

const admin: Session = { identity: { subject: 'admin-sub', email: 'admin@example.invalid' }, user: { id: 'admin', display_name: 'Quản trị thử nghiệm', role: 'admin' }, access_granted: true };
const part: CatalogRow = { id: 'part-1', version: 1, sku: 'VT-API-01', name: 'Vật tư từ máy chủ', category: 'filters', unit: 'Cái', applicable_for: 'both', specifications: '', lifespan_km_limit: null, lifespan_days_limit: null, is_serialized: 0, is_active: 1, notes: null };
const page = (rows: CatalogRow[] = [], total = rows.length, current = 1) => ({ data: rows, pagination: { page: current, page_size: 25, total } });
function api(overrides: Partial<CatalogClient> = {}): CatalogClient {
  const list = overrides.list ?? (async () => page());
  return { session: async () => admin, save: async () => part, importParts: async () => [part], ...overrides,
    list: async (resource, options) => resource === 'part-objects' ? page([{ id: 'o', code: 'IN', name: 'Đối tượng thử', version: 1, is_active: 1 }]) : resource === 'part-groups' ? page([{ id: 'g', code: 'TDONG', name: 'Nhóm thử', version: 1, is_active: 1 }]) : list(resource, options) };
}

test('API client uses same-origin credentials and preserves version only on PATCH', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  const client = createCatalogClient((async (path, init) => {
    calls.push({ path: String(path), init });
    return Response.json({ data: part });
  }) as typeof fetch);
  await client.save('parts', { name: 'Changed' }, { ...part, version: 7 });
  assert.equal(calls[0].path, '/api/parts/part-1');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { name: 'Changed', version: 7 });
  await client.save('parts', { sku: 'VT-NEW' });
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { sku: 'VT-NEW' });
});

test('client distinguishes expired sessions, HTML login pages and invalid response shapes', async () => {
  for (const response of [Response.json({ error: { code: 'INVALID_SESSION', message: 'Expired' } }, { status: 401 }), new Response(null, { status: 302 }), new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }), Response.json({ data: [] })]) {
    const client = createCatalogClient((async () => response) as typeof fetch);
    await assert.rejects(() => client.session(), CatalogApiError);
  }
});

test('unauthenticated screen does not read or fall back to browser inventory', async () => {
  dom.window.localStorage.setItem('fleetpro_parts_v4_tnc', JSON.stringify([{ ...part, name: 'LOCAL ONLY' }]));
  let listed = 0;
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ session: async () => { throw new CatalogApiError(401, 'UNAUTHENTICATED', 'Login'); }, list: async () => { listed++; return page([part]); } })} />);
  await screen.findByLabelText('Mật khẩu',{exact:true});
  assert.ok(screen.getByRole('button',{name:'Đăng nhập',exact:true}));
  assert.equal(screen.queryByText('LOCAL ONLY'), null);
  assert.equal(listed, 0);
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fleetpro_parts_v4_tnc')!)[0].name, 'LOCAL ONLY');
});

test('pending configuration and unprovisioned accounts display distinct explanations', async () => {
  const first = render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ session: async () => { throw new CatalogApiError(503, 'AUTH_NOT_CONFIGURED', 'Not configured'); } })} />);
  await screen.findByText(/Dịch vụ đăng nhập chưa được cấu hình/);
  first.unmount();
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ session: async () => ({ ...admin, user: null, access_granted: false }) })} />);
  await screen.findByText(/chưa được cấp tài khoản hoạt động/);
  assert.equal(screen.queryByRole('button', { name: 'Thêm vật tư' }), null);
});

test('retry checks session again before showing actual API data', async () => {
  let attempts = 0;
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ session: async () => { if (attempts++ === 0) throw new CatalogApiError(503, 'TEMPORARY_ERROR', 'Tạm thời mất kết nối'); return admin; }, list: async () => page([part]) })} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
  await screen.findByText('Vật tư từ máy chủ');
  assert.equal(attempts, 2);
});

test('read-only roles see records without edit or create controls', async () => {
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ session: async () => ({ ...admin, user: { ...admin.user!, role: 'viewer' } }), list: async () => page([part]) })} />);
  await screen.findByText('Vật tư từ máy chủ');
  assert.equal(screen.queryByRole('button', { name: 'Thêm vật tư' }), null);
  assert.equal(screen.queryByRole('button', { name: /Sửa Vật tư/ }), null);
  assert.equal(screen.queryByText(/Đang dùng tài khoản/),null);
});

test('API listing uses server pagination, debounced search and status filters', async () => {
  const calls: { resource: Resource; options: any }[] = [];
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ list: async (resource, options) => { calls.push({ resource, options }); return page([part], 51, options?.page); } })} />);
  await screen.findByText('Vật tư từ máy chủ');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => assert.equal(calls.at(-1)!.options.page, 2));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm' }), { target: { value: 'lọc' } });
  await waitFor(() => { assert.equal(calls.at(-1)!.options.q, 'lọc'); assert.equal(calls.at(-1)!.options.page, 1); });
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc trạng thái' }), { target: { value: '0' } });
  await waitFor(() => assert.equal(calls.at(-1)!.options.status, '0'));
});

test('create confirms save only after the server responds and blocks duplicate submits', async () => {
  let complete!: (row: CatalogRow) => void;
  const calls: any[] = [];
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ save: async (...args) => { calls.push(args); return new Promise(resolve => { complete = resolve; }); } })} />);
  await screen.findByText('Chưa có vật tư trên máy chủ.');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm vật tư' }));
  const dialog = screen.getByRole('dialog');
  await screen.findByRole('option', { name: 'IN — Đối tượng thử' });
  fireEvent.change(within(dialog).getByLabelText('Mã đối tượng *'), { target: { value: 'IN' } });
  fireEvent.change(within(dialog).getByLabelText('Mã nhóm *'), { target: { value: 'TDONG' } });
  fireEvent.change(within(dialog).getByLabelText('Tên vật tư *'), { target: { value: 'Mới' } });
  fireEvent.change(within(dialog).getByLabelText('Đơn vị tính *'), { target: { value: 'Cái' } });
  fireEvent.submit(dialog.querySelector('form')!);
  fireEvent.submit(dialog.querySelector('form')!);
  await waitFor(() => assert.equal(calls.length, 1));
  assert.equal(screen.queryByText('Đã lưu trên máy chủ.'), null);
  assert.equal((within(dialog).getByRole('button', { name: 'Đang lưu…' }) as HTMLButtonElement).disabled, true);
  await act(async () => complete(part));
  await screen.findByText('Đã lưu trên máy chủ.');
  assert.equal(screen.queryByRole('dialog'), null);
});

test('version conflict keeps edited values and never reports a successful save', async () => {
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ list: async () => page([part]), save: async () => { throw new CatalogApiError(409, 'VERSION_CONFLICT', 'Conflict'); } })} />);
  await screen.findByText('Vật tư từ máy chủ');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa Vật tư từ máy chủ' }));
  const name = screen.getByLabelText('Tên vật tư *') as HTMLInputElement;
  fireEvent.change(name, { target: { value: 'Thay đổi chưa lưu' } });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
  await screen.findByText(/Bản ghi đã được người khác cập nhật/);
  assert.equal(name.value, 'Thay đổi chưa lưu');
  assert.equal(screen.queryByText('Đã lưu trên máy chủ.'), null);
});

test('network errors retain form values without writing any browser cache', async () => {
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ list: async () => page([part]), save: async () => { throw new TypeError('Network failed'); } })} />);
  await screen.findByText('Vật tư từ máy chủ');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa Vật tư từ máy chủ' }));
  fireEvent.change(screen.getByLabelText('Tên vật tư *'), { target: { value: 'Chờ lưu' } });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
  await screen.findByText(/Không kết nối được máy chủ/);
  assert.equal((screen.getByLabelText('Tên vật tư *') as HTMLInputElement).value, 'Chờ lưu');
  assert.equal(dom.window.localStorage.length, 0);
});

test('switching resource aborts stale requests so late records cannot replace current data', async () => {
  let finish!: (value: any) => void;
  let firstSignal: AbortSignal | undefined;
  const store = api({ list: async (resource, options) => {
    if (resource === 'parts') { firstSignal = options?.signal; return new Promise(resolve => { finish = resolve; }); }
    return page([{ id: 'warehouse-1', version: 1, code: 'KHO-01', name: 'Kho máy chủ', kind: 'parts', location: '', capacity_milli: null, is_active: 1 }]);
  } });
  render(<CloudCatalogApp onOpenLocal={() => {}} api={store} />);
  await waitFor(() => assert.ok(finish));
  fireEvent.click(screen.getByRole('button', { name: 'Danh mục kho', exact: true }));
  await screen.findByText('Kho máy chủ');
  assert.equal(firstSignal?.aborted, true);
  await act(async () => finish(page([part])));
  assert.equal(screen.queryByText('Vật tư từ máy chủ'), null);
});

test('vehicle form loads all staff pages and sends stable driver ID with ODO', async () => {
  const saved: any[] = [];
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api({ list: async (resource, options) => resource === 'staff' ? (options?.page === 1 ? page([{ id: 'driver-1', version: 1, name: 'Tài xế A', code: 'LX-1', is_active: 1, staff_type:'driver' }], 2, 1) : page([{ id: 'driver-2', version: 1, name: 'Tài xế B', code: 'LX-2', is_active: 1, staff_type:'driver' }], 2, 2)) : page(), save: async (...args) => { saved.push(args); return { id: 'v', version: 1 }; } })} />);
  await screen.findByText('Chưa có vật tư trên máy chủ.');
  fireEvent.click(screen.getByRole('button', { name: 'Phương tiện', exact: true }));
  await screen.findByText('Chưa có phương tiện trên máy chủ.');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm phương tiện' }));
  await screen.findByRole('option', { name: 'Tài xế B (LX-2)' });
  fireEvent.change(screen.getByLabelText('Biển số *'), { target: { value: '50H-123.45' } });
  fireEvent.change(screen.getByLabelText('Tài xế phụ trách'), { target: { value: 'driver-2' } });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
  await waitFor(() => assert.equal(saved.length, 1));
  assert.equal(saved[0][1].assigned_driver_id, 'driver-2');
  assert.equal(saved[0][1].current_odo_km, 0);
});

test('tank capacity is in litres, requires a warehouse and rejects zero or excessive decimals', () => {
  const values = initialValues('fuel-tanks', { id: 't', version: 1, code: 'B1', name: 'Bồn 1', warehouse_id: 'w', location: '', capacity_milli: 25000123, is_active: 1 });
  assert.equal(values.capacity_milli, '25000.123');
  assert.equal(formPayload('fuel-tanks', values).capacity_milli, 25000123);
  assert.equal(formPayload('fuel-tanks', values).warehouse_id, 'w');
  for (const invalid of ['', '0', '0.0001']) { values.capacity_milli=invalid; assert.throws(() => formPayload('fuel-tanks', values)); }
});

test('original personnel screen saves add/edit/delete to API and never writes local personnel', async () => {
  const source: CatalogRow = { id: 'staff-1', version: 4, code: 'NS-1', name: 'Tài xế máy chủ', job_title: 'Lái xe', department: 'Đội xe', vehicle_plate: '50H-123.45', trailer_plate: '51R-123.45', phone: '0900000000', email: null, is_active: 1 };
  const calls: any[] = [];
  const store = api({ list: async () => page([source]), save: async (resource, values, existing) => {
    calls.push({ resource, values, existing });
    return { ...(existing ?? { id: 'new-id', version: 0, is_active: 1 }), ...values, version: (existing?.version ?? 0) + 1 } as CatalogRow;
  } });
  const confirmed = dom.window.confirm;
  dom.window.confirm = () => true;
  try {
    render(<ConnectedDirectory resource="staff" api={store} canEdit onAccessError={() => {}} />);
    await screen.findByText('Tài xế máy chủ');
    fireEvent.click(screen.getByTitle('Sửa'));
    const name = document.querySelector<HTMLInputElement>('input[name="staffName"]')!;
    fireEvent.change(name, { target: { value: 'Đổi tên tài xế' } });
    fireEvent.submit(name.closest('form')!);
    await screen.findByText('Đổi tên tài xế');
    assert.equal(calls[0].existing.version, 4);
    assert.equal(calls[0].values.vehicle_plate, '50H-123.45');
    fireEvent.click(screen.getByTitle('Xóa'));
    await waitFor(() => assert.ok(!screen.queryByText('Đổi tên tài xế'), 'Deleted staff must leave active list'));
    assert.deepEqual(calls[1].values, { is_active: 0 });
    assert.equal(calls[1].existing.version, 5);
    fireEvent.click(screen.getByRole('button', { name: /Thêm Nhân Sự/ }));
    const newName = document.querySelector<HTMLInputElement>('input[name="staffName"]')!;
    fireEvent.change(newName, { target: { value: 'Tài xế mới' } });
    fireEvent.submit(newName.closest('form')!);
    await screen.findByText('Tài xế mới');
    assert.equal(calls[2].existing, undefined);
    assert.equal(calls[2].values.name, 'Tài xế mới');
    assert.equal(dom.window.localStorage.getItem('fleetpro_dm_nhansu'), null);
  } finally { dom.window.confirm = confirmed; }
});

test('original personnel form stays open when the server rejects an edit', async () => {
  render(<ConnectedDirectory resource="staff" api={api({ list: async () => page([{ id: 's', version: 1, code: 'NS-1', name: 'Người A', is_active: 1 }]), save: async () => { throw new CatalogApiError(409, 'VERSION_CONFLICT', 'Conflict'); } })} canEdit onAccessError={() => {}} />);
  await screen.findByText('Người A');
  fireEvent.click(screen.getByTitle('Sửa'));
  const name = document.querySelector<HTMLInputElement>('input[name="staffName"]')!;
  fireEvent.change(name, { target: { value: 'Chưa lưu' } });
  fireEvent.submit(name.closest('form')!);
  await screen.findByText(/Bản ghi đã được người khác cập nhật/);
  assert.equal(name.isConnected, true);
  assert.equal(name.value, 'Chưa lưu');
  assert.equal(screen.queryByText('Đã lưu trên máy chủ.'), null);
});

test('webapp opens personnel tree and retains unassigned personnel without local cache', async () => {
  render(<CloudCatalogApp webapp onOpenLocal={() => {}} api={api({ list: async resource => resource === 'staff' ? page([{ id: 's', version: 1, code: 'NS-1', name: 'Nhân sự trực tuyến', staff_type:'employee', is_active: 1 }]) : page() })} />);
  await screen.findByText('Chưa có vật tư trên máy chủ.');
  fireEvent.click(screen.getByText('Danh mục nhân sự'));
  await screen.findByRole('complementary',{name:'Cây nhân sự'});
  fireEvent.click(screen.getByRole('button',{name:'Nhân viên chưa phân phòng'}));
  await screen.findByText('Nhân sự trực tuyến');
  assert.equal(screen.queryByText('Quản lý danh mục'), null);
  assert.equal(dom.window.localStorage.getItem('fleetpro_dm_nhansu'), null);
});

test('part import parses quoted commas, multiline cells, BOM and existing structured SKUs', () => {
  const rows = convertPartImport(parseDelimited('\uFEFFLoại hàng,Mã đối tượng,Mã nhóm,Tên vật tư,ĐVT,Mã vật tư\r\nM,IN,TDONG,"Bộ phận, loại A\nDòng mô tả",Cái,\r\n,,,Lốp,Quả,M-IN-TDONG-0002'));
  assert.equal(rows[0].name, 'Bộ phận, loại A\nDòng mô tả');
  assert.equal(rows[1].item_type, 'M');
  assert.equal(rows[1].object_code, 'IN');
  assert.equal(rows[1].group_code, 'TDONG');
  assert.equal(rows[1].sku, 'M-IN-TDONG-0002');
  assert.equal(rows[0].sku, undefined);
  assert.throws(() => parseDelimited('a,b\n"missing,b'), /ngoặc kép/);
});

test('part import validates required codes, duplicate codes and unsupported stock columns', () => {
  assert.throws(() => convertPartImport([['Tên vật tư', 'ĐVT'], ['Thiếu mã', 'Cái']]), /cần Loại hàng/);
  assert.throws(() => convertPartImport([['Tồn kho'], [10]]), /Cột chưa hỗ trợ/);
  assert.throws(() => convertPartImport([['Mã vật tư', 'Tên vật tư', 'ĐVT'], ['M-IN-TDONG-0002', 'A', 'Cái'], ['M-IN-TDONG-0002', 'B', 'Cái']]), /trùng nhau/);
  const service = convertPartImport([['Loại hàng', 'Mã đối tượng', 'Mã nhóm', 'Tên vật tư', 'ĐVT'], ['DỊCH VỤ', 'in', 'tdong', 'Dịch vụ sửa chữa', 'Lần']]);
  assert.equal(service[0].item_type, 'G');
});

test('VT-TB import previews then sends one idempotent server import, retaining the preview on failure', async () => {
  const calls: any[] = [];
  const store = api({ importParts: async (rows, batchId) => { calls.push({ rows, batchId }); if (calls.length === 1) throw new TypeError('Lost response'); return [part]; } });
  const { PartImportModal } = await import('../src/components/PartImportModal.tsx');
  let imported = 0;
  render(<PartImportModal api={store} onClose={() => {}} onImported={count => { imported = count; }} />);
  fireEvent.change(screen.getByLabelText('Hoặc dán bảng từ Excel / nội dung CSV'), { target: { value: 'Loại hàng,Mã đối tượng,Mã nhóm,Tên vật tư,ĐVT\nM,IN,TDONG,Vật tư mới,Cái' } });
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích và xem trước' }));
  await screen.findByText('Tự cấp khi lưu');
  fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 dòng lên máy chủ' }));
  await screen.findByText(/Chưa xác nhận được kết quả nhập/);
  fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 dòng lên máy chủ' }));
  await waitFor(() => assert.equal(imported,1));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].batchId, calls[1].batchId);
  assert.equal(calls[0].rows[0].object_code, 'IN');
});

test('VT-TB and vehicles share the directory title, add/export toolbar and table style', async () => {
  render(<CloudCatalogApp onOpenLocal={() => {}} api={api()} />);
  await screen.findByText('Danh mục VT-TB');
  assert.ok(screen.getByRole('button', { name: 'Export Excel' }));
  assert.equal(screen.queryByRole('button', { name: 'Import Excel' }),null);
  fireEvent.click(screen.getByRole('button', { name: 'Phương tiện', exact: true }));
  await screen.findByText('Danh Mục Phương Tiện');
  assert.ok(screen.getByRole('button', { name: 'Export Excel' }));
  assert.ok(screen.getByRole('button', { name: 'Thêm phương tiện' }));
});

test('part price and minimum stock round-trip and import decimal quantities', () => {
  const values = initialValues('parts', { ...part, unit_price_vnd: 125000, min_stock_milli: 2500 });
  assert.equal(values.min_stock_milli, '2.5');
  const payload = formPayload('parts', values, part);
  assert.equal(payload.unit_price_vnd, 125000);
  assert.equal(payload.min_stock_milli, 2500);
  for (const key of ['category', 'applicable_for', 'specifications']) assert.equal(Object.hasOwn(payload, key), false);
  const rows = convertPartImport([['Mã vật tư','Tên vật tư','ĐVT','Đơn giá (VNĐ)','Tồn kho tối thiểu'],['M-IN-TDONG-0001','Lọc','Cái','125000','2.5']]);
  assert.equal(rows[0].min_stock_milli, 2500);
  assert.equal(rows[0].unit_price_vnd, 125000);
  assert.throws(() => formPayload('parts', { ...values, min_stock_milli: '-1' }, part));
});

test('part maintenance hours and reorder packaging units survive form and import', () => {
 const values=initialValues('parts', {...part,lifespan_hours_limit:8760,min_stock_milli:1000,min_stock_unit:'Hộp'});
 const payload=formPayload('parts',values,part);
 assert.equal(payload.lifespan_hours_limit,8760);assert.equal(payload.min_stock_unit,'Hộp');assert.equal(payload.min_stock_milli,1000);
 const rows=convertPartImport([['Mã vật tư','Tên vật tư','ĐVT','Tồn kho tối thiểu','Đơn vị tồn tối thiểu','Tuổi thọ (giờ)'],['M-DC-TIEU-0001','Băng keo','Cuộn','1','Hộp','8760']]);
 assert.equal(rows[0].lifespan_hours_limit,8760);assert.equal(rows[0].min_stock_unit,'Hộp');assert.equal(rows[0].min_stock_milli,1000);
});

test('warehouse opens its tanks and new tank saves the selected warehouse ID and litres', async () => {
  const kho: CatalogRow={id:'kho-a',version:1,code:'K-A',name:'Kho A',location:'HCM',is_active:1,kind:'parts'};
  const calls: any[]=[]; const saves: any[]=[];
  const store=api({list:async (resource, options) => { calls.push({resource,options});return page(resource==='warehouses'?[kho]:[]); },save:async(resource,values)=>{saves.push({resource,values});return {id:'tank-new',version:1,...values} as CatalogRow;}});
  render(<CloudCatalogApp onOpenLocal={()=>{}} api={store} />);
  fireEvent.click(await screen.findByRole('button',{name:'Danh mục kho',exact:true}));
  await screen.findByText('Kho A');
  assert.equal(screen.queryByText('Sức Chứa Thiết Kế'),null);
  fireEvent.click(screen.getByRole('button',{name:'Xem bồn'}));
  await screen.findByRole('button',{name:'Thêm bồn dầu'});
  await waitFor(()=>assert.ok(calls.some(call=>call.resource==='fuel-tanks'&&call.options.warehouse_id==='kho-a')));
  fireEvent.click(screen.getByRole('button',{name:'Thêm bồn dầu'}));
  const dialog=screen.getByRole('dialog');
  await waitFor(()=>assert.equal((within(dialog).getByLabelText('Kho trực thuộc *') as HTMLSelectElement).disabled,false));
  assert.equal((within(dialog).getByLabelText('Kho trực thuộc *') as HTMLSelectElement).value,'kho-a');
  fireEvent.change(within(dialog).getByLabelText('Mã *'),{target:{value:'B-01'}});
  fireEvent.change(within(dialog).getByLabelText('Tên *'),{target:{value:'Bồn số 1'}});
  fireEvent.change(within(dialog).getByLabelText('Dung tích (lít) *'),{target:{value:'25000.125'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Lưu trên máy chủ'}));
  await waitFor(()=>assert.equal(saves.length,1));
  assert.equal(saves[0].resource,'fuel-tanks');assert.equal(saves[0].values.warehouse_id,'kho-a');assert.equal(saves[0].values.capacity_milli,25000125);
});

test('personnel tabs keep employee tree separate and save independent driver with tractor and trailer', async () => {
 const units:CatalogRow[]=[{id:'u1',code:'DV1',name:'Đơn vị 1',is_active:1,version:1}];
 const departments:CatalogRow[]=[{id:'d1',unit_id:'u1',kind:'employee',code:'HC',name:'Hành chính',is_active:1,version:1},{id:'dx',unit_id:'u1',kind:'driver',code:'DX',name:'Đội xe',is_active:1,version:1}];
 const people:CatalogRow[]=[{id:'nv1',code:'NV1',name:'Nhân viên A',staff_type:'employee',unit_id:'u1',department_id:'d1',is_active:1,version:1},{id:'tx1',code:'TX1',name:'Tài xế A',staff_type:'driver',unit_id:'u1',department_id:'dx',is_active:1,version:1}];
 const saved:any[]=[];
 const store=api({list:async(resource,options)=>page(resource==='org-units'?units:resource==='departments'?departments.filter(d=>!options?.unit_id||d.unit_id===options.unit_id):resource==='staff'?people.filter(p=>(!options?.department_id||p.department_id===options.department_id)&&(!options?.staff_type||p.staff_type===options.staff_type)):[]),save:async(resource,values)=>{saved.push({resource,values});return {id:'new',version:1,...values} as CatalogRow;}});
 render(<CloudCatalogApp webapp api={store} onOpenLocal={()=>{}} />);
 fireEvent.click(await screen.findByText('Danh mục nhân sự'));
 const tree=await screen.findByRole('complementary',{name:'Cây nhân sự'});
 fireEvent.click(within(tree).getByText('Hành chính'));
 await screen.findByRole('heading',{name:'Nhân viên · Hành chính'});
 assert.ok(within(screen.getByRole('table')).getByText('Nhân viên A'));
 assert.equal(within(screen.getByRole('table')).queryByText('Tài xế A'),null);
 assert.equal(within(tree).queryByText('Đội xe · Tài xế'),null);
 fireEvent.click(screen.getByRole('tab',{name:'Tài xế'}));
 await screen.findByRole('heading',{name:'Tài xế'});
 await waitFor(()=>assert.ok(within(screen.getByRole('table')).getByText('Tài xế A')));
 assert.equal(within(screen.getByRole('table')).queryByText('Nhân viên A'),null);
 fireEvent.click(screen.getByRole('button',{name:'Thêm tài xế'}));
 const dialog=screen.getByRole('dialog');
 await waitFor(()=>assert.equal((within(dialog).getByLabelText('Đơn vị') as HTMLSelectElement).disabled,false));
 assert.equal(within(dialog).queryByLabelText('Nhóm nhân sự'),null);
 assert.equal((within(dialog).getByLabelText('Cấp bậc') as HTMLSelectElement).value,'Nhân viên');
 assert.deepEqual(within(within(dialog).getByLabelText('Cấp bậc')).getAllByRole('option').map(option=>option.textContent),['Nhân viên','Quản lý']);
 fireEvent.change(within(dialog).getByLabelText('Cấp bậc'),{target:{value:'Quản lý'}});
 assert.equal(within(dialog).queryByLabelText('Phòng ban *'),null);
 assert.ok(screen.getByRole('columnheader',{name:'Đầu kéo phụ trách'}));assert.ok(screen.getByRole('columnheader',{name:'Rơ-moóc phụ trách'}));
 assert.equal(within(dialog).queryByRole('option',{name:'HC — Hành chính'}),null);
 fireEvent.change(within(dialog).getByLabelText('Mã *'),{target:{value:'TX2'}});fireEvent.change(within(dialog).getByLabelText('Tên *'),{target:{value:'Tài xế B'}});
 fireEvent.change(within(dialog).getByLabelText('Đầu kéo phụ trách'),{target:{value:'50H-12345'}});fireEvent.change(within(dialog).getByLabelText('Rơ-moóc phụ trách'),{target:{value:'51R-12345'}});
 fireEvent.click(within(dialog).getByRole('button',{name:'Lưu trên máy chủ'}));
 await waitFor(()=>assert.equal(saved.length,1));
 assert.equal(saved[0].values.staff_rank,'Quản lý');assert.equal(saved[0].values.staff_type,'driver');assert.equal(saved[0].values.unit_id,null);assert.equal(saved[0].values.department_id,null);assert.equal(saved[0].values.vehicle_plate,'50H-12345');assert.equal(saved[0].values.trailer_plate,'51R-12345');
});

test('catalog active status and document cancelled or missing status use shared badge without inventing completion', async()=>{
 const {StatusBadge}=await import('../src/components/StatusBadge.tsx');
 const {TransactionHistoryView}=await import('../src/components/TransactionHistoryView.tsx');
 const records:any[]=[{id:'tx-1',code:'PX-1',type:'OUT',date:'2026-10-21',creatorName:'Minh',partnerOrReceiver:'Tài xế',items:[],totalAmount:0,createdAt:'2026-10-21',status:'Đã hủy'},{id:'tx-2',code:'PX-2',type:'OUT',date:'2026-10-21',creatorName:'Minh',partnerOrReceiver:'Tài xế',items:[],totalAmount:0,createdAt:'2026-10-21'}];
 render(<><StatusBadge value={1}/><TransactionHistoryView transactions={records} onOpenReceipt={()=>{}} onOpenNewTxModal={()=>{}}/></>);
 const active=screen.getByText('Hoạt động');assert.equal(active.getAttribute('data-status-tone'),'success');assert.ok(active.querySelector('[aria-hidden="true"]'));
 assert.equal(screen.getByText('Đã hủy').getAttribute('data-status-tone'),'danger');
 assert.equal(screen.getByText('Chưa có trạng thái').getAttribute('data-status-tone'),'neutral');
 assert.equal(screen.queryByText('Hoàn thành'),null);assert.equal(records[0].status,'Đã hủy');assert.equal(records[1].status,undefined);
 assert.ok(screen.getByRole('columnheader',{name:'Trạng thái'}));
});

test('header breadcrumb follows selected catalog and hides server/account explanatory lines',async()=>{
 render(<CloudCatalogApp webapp api={api()} onOpenLocal={()=>{}} />);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});
 const trail=screen.getByRole('navigation',{name:'Vị trí trang'});
 assert.equal(trail.querySelector('[aria-current="page"]')?.textContent,'Danh mục VT-TB');
 assert.equal(screen.queryByText(/Danh mục ở đây được đọc và lưu qua máy chủ/),null);
 assert.equal(screen.queryByText(/Đang dùng tài khoản/),null);
 fireEvent.click(screen.getByText('Danh mục nhân sự',{exact:true}));
 await screen.findByRole('heading',{name:'Danh mục nhân sự'});
 assert.equal(trail.querySelector('[aria-current="page"]')?.textContent,'Danh mục nhân sự');
});

test('supplier sidebar, page title and form share the same icon and omit empty-server banner',async()=>{
 render(<CloudCatalogApp webapp api={api()} onOpenLocal={()=>{}} />);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});
 fireEvent.click(screen.getByText('Danh mục nhà cung cấp',{exact:true}));
 const title=await screen.findByRole('heading',{name:'Danh Mục Nhà Cung Cấp'});
 assert.ok(title.parentElement?.querySelector('svg[data-menu-icon="dm_ncc"]'));
 const icons=document.querySelectorAll('svg[data-menu-icon="dm_ncc"]');assert.ok(icons.length>=2);
 for(const icon of icons)assert.ok(icon.classList.contains('lucide-handshake'));
 assert.equal(screen.queryByText(/Danh mục máy chủ đang trống/),null);
 assert.equal(screen.queryByRole('button',{name:'Import Excel'}),null);
 assert.ok(screen.getByRole('button',{name:'Export Excel'}));
 fireEvent.click(screen.getByRole('button',{name:/Thêm Nhà Cung Cấp/}));
 assert.ok(screen.getByRole('heading',{name:'Thêm Nhà Cung Cấp Mới'}).querySelector('svg[data-menu-icon="dm_ncc"]'));
});

test('supplier form previews next code including inactive suppliers, allows blank or one of 34 provinces and hides phone',async()=>{
 let records:CatalogRow[]=[{id:'old',code:'NCC00007',name:'Đã ngừng',is_active:0,version:1,province_name:'Hà Nội'}];const calls:any[]=[];
 const store=api({list:async()=>page(records),save:async(resource,values,old)=>{calls.push({resource,values,old});const row={id:'new',version:1,is_active:1,code:'NCC00008',...values} as CatalogRow;records=[...records,row];return row;}});
 render(<ConnectedDirectory resource="suppliers" api={store} canEdit onAccessError={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Thêm Nhà Cung Cấp/}));
 const code=screen.getByLabelText('Mã NCC *:') as HTMLInputElement;assert.equal(code.value,'NCC00008');assert.equal(code.readOnly,true);assert.equal(code.required,true);
 const province=screen.getByLabelText('Tỉnh/Thành phố:') as HTMLSelectElement;assert.equal(province.required,false);assert.equal(province.options.length,35);assert.equal(province.value,'');
 assert.equal(document.querySelector('input[name="nccContact"]'),null);assert.ok(screen.getByText('Địa chỉ (Không nhập tỉnh/thành phố ở đây):'));
 fireEvent.change(document.querySelector('input[name="nccName"]')!,{target:{value:'NCC mới'}});fireEvent.change(province,{target:{value:'Đà Nẵng'}});fireEvent.change(screen.getByLabelText('Mã số thuế:'),{target:{value:'0123456789'}});
 fireEvent.submit(code.closest('form')!);await screen.findByText('NCC mới');assert.equal(calls.length,1);assert.equal(calls[0].values.province_name,'Đà Nẵng');assert.equal(calls[0].values.tax_code,'0123456789');assert.equal(Object.hasOwn(calls[0].values,'phone'),false);assert.equal(Object.hasOwn(calls[0].values,'code'),false);
});
test('supplier with linked documents has delete disabled and duplicate tax failure keeps form values',async()=>{
 const linked:CatalogRow={id:'s',code:'NCC00001',name:'NCC đã có phiếu',province_name:'Đồng Nai',tax_code:'123',is_active:1,is_linked:1,version:1};
 const store=api({list:async()=>page([linked]),save:async()=>{throw new CatalogApiError(409,'DUPLICATE_TAX_CODE','Mã số thuế đã tồn tại ở nhà cung cấp khác.');}});
 render(<ConnectedDirectory resource="suppliers" api={store} canEdit onAccessError={()=>{}}/>);
 await screen.findByText('NCC đã có phiếu');assert.equal((screen.getByTitle('NCC đã có phát sinh, không được xóa') as HTMLButtonElement).disabled,true);
 fireEvent.click(screen.getByRole('button',{name:/Thêm Nhà Cung Cấp/}));const code=screen.getByLabelText('Mã NCC *:');fireEvent.change(document.querySelector('input[name="nccName"]')!,{target:{value:'Tên chưa lưu'}});fireEvent.change(screen.getByLabelText('Tỉnh/Thành phố:'),{target:{value:'Hà Nội'}});fireEvent.change(screen.getByLabelText('Mã số thuế:'),{target:{value:'123'}});fireEvent.submit(code.closest('form')!);
 await waitFor(()=>assert.ok(code.closest('form')?.querySelector('[role="alert"]')));assert.equal((document.querySelector('input[name="nccName"]') as HTMLInputElement).value,'Tên chưa lưu');
});

test('supplier directory opens only one page and searches across server pages', async () => {
  const calls: {page?:number;q?:string;pageSize?:number}[]=[];
  const client=api({list:async (_resource,options={})=>{
    calls.push(options);
    const current=options.page??1;
    return {data:[{id:String(current),version:1,code:'NCC0000'+current,name:options.q?'Kết quả từ toàn danh mục':'NCC trang '+current,is_active:1}],pagination:{page:current,page_size:25,total:options.q?1:432},supplier_next_code:'NCC05003'};
  }});
  render(<ConnectedDirectory resource="suppliers" api={client} canEdit={true} onAccessError={()=>{}} />);
  await screen.findByText('NCC trang 1');assert.equal(calls.length,1);assert.equal(calls[0].pageSize,25);
  fireEvent.click(screen.getByRole('button',{name:'Trang sau'}));
  await screen.findByText('NCC trang 2');assert.equal(calls.length,2);assert.equal(calls[1].page,2);
  fireEvent.change(screen.getByPlaceholderText('Tìm theo mã NCC, tên, mã số thuế hoặc tỉnh/thành phố...'),{target:{value:'tìm xa'}});
  await screen.findByText('Kết quả từ toàn danh mục');assert.equal(calls.length,3);assert.equal(calls[2].page,1);assert.equal(calls[2].q,'tìm xa');
  assert.equal((screen.getByRole('button',{name:'Trang sau'}) as HTMLButtonElement).disabled,true);
});

test('equipment directory merges generators and containers with subtype-specific forms',async()=>{
 const calls:any[]=[];const saves:any[]=[];
 render(<CloudCatalogApp webapp onOpenLocal={()=>{}} api={api({list:async(resource,options)=>{calls.push({resource,...options});return page();},save:async(resource,values)=>{saves.push({resource,values});return {id:'new-equipment',version:1,...values};}})} />);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});
 fireEvent.click(screen.getByText('Danh mục phương tiện thiết bị'));
 await screen.findByRole('tab',{name:'Đầu kéo'});
 await waitFor(()=>assert.ok(calls.some(c=>c.resource==='vehicles' && c.type==='tractor')));
 fireEvent.click(screen.getByRole('tab',{name:'Rơ moóc'}));await waitFor(()=>assert.ok(calls.some(c=>c.resource==='vehicles' && c.type==='trailer')));
 fireEvent.click(screen.getByRole('tab',{name:'Máy phát / Cont'}));await screen.findByRole('button',{name:'Thêm thiết bị'});
 fireEvent.click(screen.getByRole('button',{name:'Thêm thiết bị'}));
 assert.equal(screen.queryByLabelText('Tài xế phụ trách'),null);assert.equal(screen.queryByLabelText('Có máy lạnh'),null);
 fireEvent.change(screen.getByLabelText('Mã thiết bị *'),{target:{value:'MP001'}});
 await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Lưu trên máy chủ'}) as HTMLButtonElement).disabled,false));fireEvent.click(screen.getByRole('button',{name:'Lưu trên máy chủ'}));await waitFor(()=>assert.equal(saves.length,1));
 assert.equal(saves[0].resource,'equipment');assert.equal(saves[0].values.type,'generator');assert.equal(Object.hasOwn(saves[0].values,'assigned_driver_id'),false);
 await waitFor(()=>assert.ok(calls.some(c=>c.resource==='equipment' && !c.type && c.source_group==='generator_container')));
 assert.equal(screen.queryByRole('tab',{name:'Cont'}),null);
 fireEvent.click(screen.getByRole('button',{name:'Thêm thiết bị'}));
 assert.equal(screen.queryByLabelText('Loại máy phát'),null);
 assert.equal(screen.queryByLabelText('Quy cách Cont'),null);
 fireEvent.change(screen.getByLabelText('Loại thiết bị *'),{target:{value:'container'}});
 assert.ok(screen.getByLabelText('Quy cách Cont'));
 assert.equal(screen.queryByLabelText('Nhóm tuyến'),null);
 assert.equal(screen.queryByLabelText('Giờ hoạt động'),null);
 fireEvent.change(screen.getByLabelText('Mã thiết bị *'),{target:{value:'CONT001'}});
 await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Lưu trên máy chủ'}) as HTMLButtonElement).disabled,false));
 fireEvent.click(screen.getByRole('button',{name:'Lưu trên máy chủ'}));
 await waitFor(()=>assert.equal(saves.length,2));
 assert.equal(saves[1].values.type,'container');
});

test('pairing drafts and parameter groups have separate paged screens',async()=>{
 const calls:any[]=[];
 render(<CloudCatalogApp webapp onOpenLocal={()=>{}} api={api({list:async(resource,options)=>{calls.push({resource,...options});return page();}})} />);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});
 fireEvent.click(screen.getByText('Danh mục phương tiện thiết bị'));
 assert.equal(screen.queryByRole('tab',{name:'Ghép thiết bị'}),null);fireEvent.click(screen.getByText('Ghép thiết bị'));await screen.findByRole('heading',{name:'Ghép thiết bị'});
 await waitFor(()=>assert.ok(calls.some(c=>c.resource==='equipment-pairing-sets')));
 assert.ok(screen.getByLabelText('Định nghĩa đủ bộ'));assert.equal(screen.queryByRole('button',{name:'Trang sau'}),null);
 fireEvent.click(screen.getByText('Tham số phương tiện thiết bị'));
 await screen.findByRole('tab',{name:'Nhóm tuyến'});
 fireEvent.click(screen.getByRole('tab',{name:'Nguồn'}));await waitFor(()=>assert.ok(calls.some(c=>c.resource==='equipment-parameters'&&c.pageSize===100)));
 assert.equal(calls.filter(c=>c.resource==='equipment-parameters').length,2); // One scoped read for each of the equipment and parameter screens.
});

test('equipment condition dropdown uses parameter labels and sends server condition filter',async()=>{
 const calls:any[]=[];
 render(<CloudCatalogApp webapp onOpenLocal={()=>{}} api={api({list:async(resource,options)=>{
   calls.push({resource,...options});
   if(resource==='equipment-parameters')return page(['Hoạt động','Hư','Làm kho','Ngừng hoạt động'].map((name,i)=>({id:String(i),version:1,group_key:'condition',code:String(i),name,is_active:1})));
   return page();
 }})} />);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});fireEvent.click(screen.getByText('Danh mục phương tiện thiết bị'));
 await screen.findByRole('option',{name:'Làm kho'});
 assert.equal(screen.queryByRole('option',{name:'Bảo dưỡng'}),null);
 fireEvent.change(screen.getByLabelText('Lọc trạng thái'),{target:{value:'Làm kho'}});
 await waitFor(()=>assert.ok(calls.some(call=>call.resource==='vehicles' && call.original_status==='Làm kho' && !call.status)));
});

test('combined office box tab selects correct subtype and grouped pairing form saves one set',async()=>{
 const calls:any[]=[];const saves:any[]=[];
 const set:CatalogRow={id:'dk',version:4,parent_code:'DK01',driver_name:'Tài xế đối chiếu',driver_code:'NV12345',links_json:JSON.stringify([{child_code:'RM01',pairing_type:'trailer'},{child_code:'MP01',pairing_type:'generator'}])};
 const client=api({list:async(resource,options)=>{
  calls.push({resource,...options});
  if(resource==='equipment-pairing-sets')return page([set]);
  if(resource==='equipment-parameters')return page([{id:'c',version:1,group_key:'condition',code:'HD',name:'Hoạt động',is_active:1}]);
  if(resource==='vehicles'&&!options?.source_group)return page([{id:'r',version:1,plate_number:'RM01',type:'trailer',status:'active'}]);
  if(resource==='equipment'&&!options?.type)return page([{id:'m1',version:1,code:'MP01',type:'generator',status:'active'},{id:'m2',version:1,code:'MP02',type:'generator',status:'active'}]);
  return page();
 },save:async(resource,values)=>{saves.push({resource,values});return set;}});
 render(<CloudCatalogApp webapp onOpenLocal={()=>{}} api={client}/>);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});fireEvent.click(screen.getByText('Danh mục phương tiện thiết bị'));
 fireEvent.click(await screen.findByRole('tab',{name:'Xe văn phòng / tải thùng'}));
 await waitFor(()=>assert.ok(calls.some(call=>call.resource==='vehicles'&&call.source_group==='office_and_box'&&!call.type)));
 assert.equal(screen.queryByRole('tab',{name:'Xe tải thùng'}),null);
 fireEvent.click(screen.getByRole('button',{name:'Thêm phương tiện'}));await screen.findByLabelText('Nhóm xe *');
 fireEvent.change(screen.getByLabelText('Nhóm xe *'),{target:{value:'box_truck'}});fireEvent.change(screen.getByLabelText('Biển số *'),{target:{value:'TT01'}});
 await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Lưu trên máy chủ'}) as HTMLButtonElement).disabled,false));
 fireEvent.click(screen.getByRole('button',{name:'Lưu trên máy chủ'}));await waitFor(()=>assert.equal(saves.length,1));assert.equal(saves[0].values.type,'rented_truck');assert.equal(saves[0].values.source_group,'box_truck');
 fireEvent.click(screen.getByText('Ghép thiết bị'));await screen.findByText('DK01');
 assert.ok(screen.getByRole('columnheader',{name:'Tài xế'}));assert.equal(screen.queryByRole('columnheader',{name:'Mã nhân viên'}),null);assert.ok(screen.getByText('Tài xế đối chiếu'));assert.ok(screen.getByText('NV12345'));
 fireEvent.click(screen.getByRole('button',{name:'Thao tác bộ ghép DK01'}));
 await screen.findByRole('dialog');
 assert.ok(screen.getByRole('button',{name:'Đổi tài xế'}));assert.ok(screen.getByRole('button',{name:'Tách'}));assert.ok(screen.getByRole('button',{name:'Xem lịch sử'}));
});

const {PairingSetsView}=await import('../src/components/PairingSetsView');
const pairingExample:CatalogRow={id:'pair-example',version:7,parent_code:'50H-TEST',route_group:'BNAM',assigned_driver_id:'staff-test',driver_name:'Tài xế kiểm thử',driver_code:'NV0001',driver_active:1,tractor_status:'active',reviewed:0,links_json:JSON.stringify([{id:'leaf',child_code:'RM-CURRENT',pairing_type:'trailer',asset_id:'rm-current',status:'active'}])};
const pairingStats={total:91,complete:65,missing_trailer:24,missing_generator:6,missing_driver:16,reviewed:12,filtered_complete:65};
test('pairing dashboard filters server pages and reviews selected row versions',async()=>{
 const calls:Parameters<CatalogClient['list']>[1][]=[],saves:Record<string,string|number|null>[]=[];
 const client=api({list:async(_resource,options)=>{calls.push(options);return {...page([pairingExample],91),stats:pairingStats};},save:async(_resource,values)=>{saves.push(values);return {id:'review',version:1};}});
 render(<PairingSetsView api={client} canEdit={true} controls={null} onAccessError={()=>{}}/>);
 await screen.findByText('12/91 đã rà soát');
 fireEvent.click(screen.getByRole('button',{name:/Thiếu rơ moóc/}));await waitFor(()=>assert.ok(calls.some(o=>o?.filter==='missing_trailer'&&o.page===1)));
 fireEvent.change(screen.getByLabelText('Lọc nhóm tuyến'),{target:{value:'DCANG'}});await waitFor(()=>assert.ok(calls.some(o=>o?.route_group==='DCANG'&&o.filter==='missing_trailer')));
 await screen.findByLabelText('Rà soát 50H-TEST');fireEvent.click(screen.getByLabelText('Rà soát 50H-TEST'));fireEvent.click(screen.getByRole('button',{name:'Xác nhận đã rà soát (1)'}));
 await waitFor(()=>assert.equal(saves.length,1));assert.deepEqual(JSON.parse(String(saves[0].reviews_json)),[{id:pairingExample.id,version:7}]);
 assert.equal(screen.queryByRole('columnheader',{name:'Trạng thái'}),null);assert.ok(screen.getByRole('columnheader',{name:'Cảnh báo'}));
 assert.equal(screen.getByRole('progressbar',{name:'Tiến độ rà soát'}).getAttribute('aria-valuenow'),'13');
 assert.ok(screen.getByRole('button',{name:'Bỏ lọc Thiếu rơ moóc'}));fireEvent.click(screen.getByRole('button',{name:'Bỏ lọc Thiếu rơ moóc'}));await waitFor(()=>assert.ok(calls.some(o=>o?.filter==='all'&&o.route_group==='DCANG')));
 assert.ok(screen.getByTitle('Bắc Nam'));assert.equal(screen.queryByText('Bản nháp'),null);
});

test('pairing drawer searches free choices, requires reason and keeps input on save rejection',async()=>{
 let attempts=0;const calls:Parameters<CatalogClient['list']>[1][]=[],saves:Record<string,string|number|null>[]=[];
 const client=api({list:async(_resource,options)=>{calls.push(options);if(options?.view==='history')return page();if(options?.view==='available')return page([{id:'rm-free',version:1,plate_number:'RM-FREE',label:'RM-FREE',status:'active'}]);return {...page([pairingExample]),stats:pairingStats};},save:async(_resource,values)=>{saves.push(values);attempts++;if(attempts===1)throw new CatalogApiError(409,'PAIRING_IN_USE','Thiết bị vừa được ghép ở xe khác.');return {...pairingExample,version:8};}});
 render(<PairingSetsView api={client} canEdit={true} controls={null} onAccessError={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Thao tác bộ ghép 50H-TEST'}));
 fireEvent.click(screen.getByRole('button',{name:'Đổi rơ moóc'}));
 assert.equal(screen.queryByLabelText('Tuyến đường'),null);assert.equal(screen.queryByRole('combobox',{name:'Nhóm tuyến'}),null);
 fireEvent.focus(screen.getByRole('combobox',{name:'Rơ moóc mới'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Rơ moóc mới'}),{target:{value:'FREE'}});
 fireEvent.click(await screen.findByRole('option',{name:'RM-FREE'}));
 await waitFor(()=>assert.ok(calls.some(o=>o?.view==='available'&&o.kind==='trailer')));
 fireEvent.change(screen.getByLabelText('Lý do *'),{target:{value:'Thay rơ moóc theo điều động'}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));await screen.findByRole('alert');
 assert.equal((screen.getByLabelText('Lý do *') as HTMLTextAreaElement).value,'Thay rơ moóc theo điều động');assert.equal(saves[0].action,'replace_trailer');assert.equal(saves[0].value,'RM-FREE');assert.match(String(saves[0].effective_at),/Z$/);
 fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));await screen.findByText('Đã lưu thay đổi và nhật ký.');
});

test('read-only pairing users can inspect history without mutation controls',async()=>{
 const client=api({list:async(_resource,options)=>options?.view==='history'?page():{...page([pairingExample]),stats:pairingStats}});
 render(<PairingSetsView api={client} canEdit={false} controls={null} onAccessError={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Lịch sử bộ ghép 50H-TEST'}));
 assert.equal(screen.queryByRole('button',{name:'Đổi tài xế'}),null);assert.equal(screen.queryByRole('button',{name:'Ghép mới'}),null);assert.equal(screen.queryByLabelText('Rà soát 50H-TEST'),null);
 await screen.findByText('Chưa có thao tác đổi/tách được ghi nhận trong nhật ký mới.');
});

const {CatalogHistoryDrawer}=await import('../src/components/CatalogHistoryDrawer');
const {historyChanges}=await import('../src/api/catalogHistory');
test('history formats only captured changed fields with scaled units and readable references',()=>{
 const event:CatalogRow={id:'h',version:1,before_json:JSON.stringify({name:'Tên cũ',min_stock_milli:1000,notes:'Giữ nguyên'}),after_json:JSON.stringify({name:'Tên mới',min_stock_milli:2500}),references_json:'{}'};
 const changes=historyChanges('parts',event);assert.equal(changes.length,2);assert.equal(changes.find(c=>c.key==='name')?.before,'Tên cũ');assert.equal(changes.find(c=>c.key==='min_stock_milli')?.after,'2,5');assert.ok(!changes.some(c=>c.key==='notes'));
 const refs=historyChanges('fuel-tanks',{id:'h',version:1,before_json:null,after_json:JSON.stringify({warehouse_id:'warehouse-uuid'}),references_json:JSON.stringify({'warehouses:warehouse-uuid':'KHO01 — Kho chính'})});assert.equal(refs[0].after,'KHO01 — Kho chính');
 const pairing=historyChanges('vehicles',{id:'h',version:1,before_json:JSON.stringify({assigned_driver_id:'old',links_json:JSON.stringify([{child_code:'RM01',pairing_type:'trailer',version:1}])}),after_json:JSON.stringify({driver_id:'new',links:[{code:'RM01',type:'trailer'}]}),references_json:JSON.stringify({'staff:old':'NV01 — Tài xế cũ','staff:new':'NV02 — Tài xế mới'})});assert.equal(pairing.length,1);assert.equal(pairing[0].before,'NV01 — Tài xế cũ');
});

test('catalog history opens on demand for read-only users and paginates server events',async()=>{
 const calls:Parameters<CatalogClient['list']>[1][]=[];
 const event:CatalogRow={id:'event-1',version:1,action:'catalog.update',actor_name:'Người sửa',created_at:'2026-10-24T01:00:00Z',before_json:JSON.stringify({name:'Tên cũ'}),after_json:JSON.stringify({name:'Tên mới'})};
 render(<CloudCatalogApp api={api({session:async()=>({...admin,user:{...admin.user!,role:'viewer'}}),list:async(_resource,options)=>{calls.push(options);if(options?.view==='history')return page([{...event,id:'event-'+options.page}],26,options.page);return page([part]);}})} onOpenLocal={()=>{}}/>);
 await screen.findByText(part.name);assert.equal(calls.some(o=>o?.view==='history'),false);
 fireEvent.click(screen.getByRole('button',{name:'Lịch sử '+part.name}));await screen.findByText('Tên cũ');assert.ok(screen.getByText('Tên mới'));assert.ok(screen.getByText('Người sửa'));assert.equal(calls.find(o=>o?.view==='history')?.entity_id,part.id);
 fireEvent.click(screen.getByRole('button',{name:'Lịch sử sau'}));await waitFor(()=>assert.ok(calls.some(o=>o?.view==='history'&&o.page===2)));
});

test('supplier original screen exposes the same history drawer without edit permission',async()=>{
 const supplier:CatalogRow={id:'ncc-h',version:1,code:'NCC00001',name:'NCC kiểm thử lịch sử',is_active:1};
 render(<ConnectedDirectory resource="suppliers" api={api({list:async(_resource,options)=>options?.view==='history'?page([{id:'import-h',version:1,action:'import',actor_name:'Người nhập',created_at:'2026-10-24T01:00:00Z',after_json:JSON.stringify({name:supplier.name})}]):page([supplier])})} canEdit={false} onAccessError={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Lịch sử '+supplier.name}));await screen.findByRole('dialog');assert.ok(await screen.findByText('Người nhập'));
});

const {createParameterCatalogClient}=await import('../src/api/parameterCatalogClient');
test('parameter history bypasses the small catalog cache without replacing it',async()=>{
 const calls:Parameters<CatalogClient['list']>[1][]=[];
 const client=api({list:async(_resource,options)=>{calls.push(options);return options?.view==='history'?page([{id:'history-only',version:1,action:'catalog.update'}]):page([{id:'param',version:1,code:'BNAM',name:'Nhóm tuyến',group_key:'route',is_active:1}]);}});
 const cached=createParameterCatalogClient(client);
 assert.equal((await cached.client.list('equipment-parameters')).data[0].id,'param');
 assert.equal((await cached.client.list('equipment-parameters',{view:'history',entity_id:'param'})).data[0].id,'history-only');
 assert.equal((await cached.client.list('equipment-parameters')).data[0].id,'param');
 assert.equal(calls.length,2);cached.dispose();
});

test('pairing has its own menu and breadcrumb with viewport layout; fleet no longer contains its tab',async()=>{
 render(<CloudCatalogApp webapp onOpenLocal={()=>{}} api={api({list:async(resource)=>resource==='equipment-pairing-sets'?{...page([pairingExample]),stats:pairingStats}:page()})}/>);
 await screen.findByRole('heading',{name:'Danh mục VT-TB'});
 fireEvent.click(screen.getByText('Ghép thiết bị'));await screen.findByText('50H-TEST');
 const trail=screen.getByRole('navigation',{name:'Vị trí trang'});assert.match(trail.textContent??'',/DANH MỤC.*Ghép thiết bị/);
 assert.equal(screen.queryByRole('tablist',{name:'Loại phương tiện thiết bị'}),null);
 const main=document.querySelector('main')!;assert.ok(main.classList.contains('min-h-0'));assert.ok(main.classList.contains('overflow-hidden'));
 const region=screen.getByLabelText('Vùng cuộn bảng ghép thiết bị');assert.ok(region.classList.contains('flex-1'));assert.equal(region.className.includes('65vh'),false);
 const driver=screen.getByText('Tài xế kiểm thử').closest('td')!;assert.match(driver.textContent??'',/NV0001/);
 assert.equal(screen.queryByRole('columnheader',{name:'Mã nhân viên'}),null);
 fireEvent.click(screen.getByText('Danh mục phương tiện thiết bị'));await screen.findByRole('tab',{name:'Đầu kéo'});
 assert.equal(screen.queryByRole('tab',{name:'Ghép thiết bị'}),null);assert.equal(document.querySelector('main')?.classList.contains('overflow-hidden'),false);
});


test('pairing scroll view loads remaining server batches without pagination controls',async()=>{
 const calls:number[]=[];
 const client=api({list:async(_resource,options)=>{const current=options?.page??1;calls.push(current);const start=current===1?0:100;const rows=Array.from({length:current===1?100:1},(_,i)=>({...pairingExample,id:'batch-'+(start+i),parent_code:'TEST-'+(start+i)}));return {...page(rows,101),pagination:{page:current,page_size:100,total:101},stats:pairingStats};}});
 render(<PairingSetsView api={client} canEdit={false} onAccessError={()=>{}}/>);
 await screen.findByText('TEST-100');assert.deepEqual(calls,[1,2]);assert.equal(screen.queryByRole('button',{name:'Trang sau'}),null);assert.ok(screen.getByText(/Hiển thị 101 đầu kéo/));
});


test('pairing missing warnings collapse into one label while duplicate driver stays separate',async()=>{
 const row={...pairingExample,links_json:'[]',assigned_driver_id:null,driver_name:null,driver_code:null,duplicate_driver:1};
 render(<PairingSetsView api={api({list:async()=>({...page([row]),stats:pairingStats})})} canEdit={false} onAccessError={()=>{}}/>);
 await screen.findByText('Thiếu 3');assert.ok(screen.getByTitle('Thiếu rơ moóc, Thiếu máy phát, Chưa có tài xế'));assert.ok(screen.getByText('Trùng tài xế'));
 assert.equal(screen.getAllByTitle('Chưa ghép').length,3);
});


test('port pairing warnings omit missing equipment but retain driver and data errors',async()=>{
 const row={...pairingExample,route_group:'DCANG',links_json:'[]',assigned_driver_id:null,driver_name:null,driver_code:null,duplicate_driver:1};
 render(<PairingSetsView api={api({list:async()=>({...page([row]),stats:pairingStats})})} canEdit={false} onAccessError={()=>{}}/>);
 await screen.findByText('Trùng tài xế');assert.ok(screen.getByTitle('Chưa có tài xế'));assert.equal(screen.queryByText('Thiếu 3'),null);assert.equal(screen.queryByTitle('Thiếu rơ moóc'),null);assert.equal(screen.queryByTitle('Thiếu máy phát'),null);
 assert.ok(screen.getByRole('table').classList.contains('catalog-table'));
});


test('user management assigns warehouse scopes and offers lock while protecting current admin',async()=>{
 const {UserManagement}=await import('../src/components/UserManagement');
 const own={id:'admin',version:1,email:admin.identity.email,display_name:'Quản trị thử nghiệm',role:'admin' as const,is_active:1 as const,access_linked:1 as const,access_linked_at:null,warehouses:[]};
 const calls:import('../shared/userAccess').UserAccessInput[]=[];
 const accounts={me:async()=>own,list:async()=>({data:[own],pagination:{page:1,page_size:25,total:1}}),save:async(input:import('../shared/userAccess').UserAccessInput)=>{calls.push(input);return{...own,...input,id:'new',warehouses:[],access_linked:0 as const}}};
 const catalog=api({list:async(resource)=>resource==='org-units'?page([{id:'unit1',version:1,code:'CN01',name:'CN Nghi Sơn',is_active:1}]):page([{id:'wh1',version:1,code:'KHO01',name:'Kho Nghi Sơn',is_active:1},{id:'wh2',version:1,code:'KHO02',name:'Kho khác',is_active:1}])});
 render(<UserManagement session={admin} accounts={accounts} api={catalog}/>);await screen.findByRole('button',{name:'Sửa tài khoản '+own.email});
 fireEvent.click(screen.getByRole('button',{name:'Thêm người dùng'}));const dialog=screen.getByRole('dialog',{name:'Thêm người dùng'});fireEvent.change(within(dialog).getByLabelText('Họ tên *'),{target:{value:'Thủ kho mới'}});fireEvent.change(within(dialog).getByLabelText('Email đăng nhập *'),{target:{value:'kho@example.invalid'}});fireEvent.change(within(dialog).getByLabelText('Mật khẩu tạm *'),{target:{value:'Temporary password for tests!'}});await within(dialog).findByLabelText('KHO01 — Kho Nghi Sơn');fireEvent.click(within(dialog).getByLabelText('KHO01 — Kho Nghi Sơn'));fireEvent.change(within(dialog).getByLabelText('Trạng thái'),{target:{value:'0'}});fireEvent.click(within(dialog).getByRole('button',{name:'Lưu tài khoản'}));await waitFor(()=>assert.equal(calls.length,1));assert.deepEqual(calls[0].warehouse_ids,['wh1']);assert.equal(calls[0].is_active,0);assert.equal(calls[0].role,'warehouse');assert.equal(calls[0].email,'kho@example.invalid');assert.equal(screen.queryByRole('dialog'),null);
 fireEvent.click(screen.getByRole('button',{name:'Sửa tài khoản '+own.email}));const edit=screen.getByRole('dialog',{name:'Sửa tài khoản'});assert.equal((within(edit).getByLabelText('Email đăng nhập *')as HTMLInputElement).readOnly,true);assert.equal((within(edit).getByLabelText('Vai trò *')as HTMLSelectElement).disabled,true);assert.equal((within(edit).getByLabelText('Trạng thái')as HTMLSelectElement).disabled,true);
});
test('non-admin user account view never requests the user directory or exposes provisioning controls',async()=>{
 const {UserManagement}=await import('../src/components/UserManagement');let listCount=0;
 const session={...admin,user:{...admin.user!,role:'warehouse' as const}};
 const own={id:'warehouse',version:1,email:session.identity.email,display_name:'Thủ kho',role:'warehouse' as const,is_active:1 as const,access_linked:1 as const,access_linked_at:null,warehouses:[{id:'wh1',code:'KHO01',name:'Kho Nghi Sơn',is_active:1}]};
 const accounts={me:async()=>own,list:async()=>{listCount++;return{data:[],pagination:{page:1,page_size:25,total:0}}},save:async()=>own};
 render(<UserManagement session={session} accounts={accounts} api={api()}/>);await screen.findByText(/Kho được cấp: KHO01/);assert.equal(listCount,0);assert.equal(screen.queryByRole('button',{name:'Thêm người dùng'}),null);assert.ok(screen.getByRole('button',{name:'Đăng xuất',exact:true}));assert.equal(screen.queryByRole('link',{name:'Đăng xuất'}),null);
});
test('native gate offers an inline login form and user client preserves versions and rejects invalid roles',async()=>{
 render(<CloudCatalogApp webapp onOpenLocal={()=>{}} api={api({session:async()=>{throw new CatalogApiError(401,'UNAUTHENTICATED','Expired')}})}/>);await screen.findByLabelText('Mật khẩu',{exact:true});assert.ok(screen.getByRole('button',{name:'Đăng nhập',exact:true}));assert.equal(screen.queryByRole('link',{name:'Đăng nhập',exact:true}),null);assert.equal(screen.queryByRole('navigation',{name:'Vị trí trang'}),null);
 const {createUserAccessClient}=await import('../src/api/userAccessClient');const row={id:'u',version:3,email:'user@example.invalid',display_name:'Nhân viên',role:'warehouse' as const,is_active:1 as const,access_linked:0 as const,access_linked_at:null,warehouses:[]};let body:Record<string,unknown>|undefined;let init:RequestInit|undefined;
 const client=createUserAccessClient(async(_url,options)=>{init=options;body=JSON.parse(String(options?.body));return Response.json({data:row})});await client.save({email:row.email,display_name:row.display_name,role:'warehouse',is_active:1,warehouse_ids:[]},row);assert.equal(init?.method,'PATCH');assert.equal(init?.credentials,'same-origin');assert.equal(body?.version,3);assert.equal(body?.auth_subject,undefined);
 const invalid=createUserAccessClient(async()=>Response.json({data:{...row,role:'superadmin'}}));await assert.rejects(()=>invalid.me(),CatalogApiError);
});


test('app entrance requires explicit entry after a valid session and never loads inventory while waiting',async()=>{
 const {AppEntrance}=await import('../src/components/AppEntrance');let entered=0,listed=0;
 render(<AppEntrance api={api({list:async()=>{listed++;return page()}})} onEnter={()=>{entered++}}/>);
 await screen.findByRole('button',{name:'Vào phần mềm'});assert.equal(entered,0);assert.equal(listed,0);assert.ok(screen.getByText(admin.identity.email));assert.ok(screen.getByRole('heading',{name:'Chào mừng trở lại'}));assert.equal(screen.queryByRole('textbox',{name:'Mật khẩu'}),null);
 fireEvent.click(screen.getByRole('button',{name:'Vào phần mềm'}));assert.equal(entered,1);
});
test('unprovisioned entrance cannot continue and expired sessions show the inline password form',async()=>{
 const {AppEntrance}=await import('../src/components/AppEntrance');let entered=0;
 const view=render(<AppEntrance api={api({session:async()=>({...admin,user:null,access_granted:false})})} onEnter={()=>{entered++}}/>);await screen.findByRole('heading',{name:'Kiểm tra quyền truy cập'});assert.equal(screen.queryByRole('button',{name:'Vào phần mềm'}),null);assert.equal(entered,0);view.unmount();
 render(<AppEntrance api={api({session:async()=>{throw new CatalogApiError(401,'UNAUTHENTICATED','Expired')}})} onEnter={()=>{entered++}}/>);await screen.findByLabelText('Mật khẩu',{exact:true});assert.ok(screen.getByRole('button',{name:'Đăng nhập',exact:true}));assert.equal(screen.queryByRole('link',{name:'Đăng nhập',exact:true}),null);assert.equal(screen.queryByRole('button',{name:'Vào phần mềm'}),null);assert.equal(entered,0);
});


test('native login submits without navigation, enforces temporary password change, and enters only after change',async()=>{
 const {AppEntrance}=await import('../src/components/AppEntrance');let signed=false,changed=false,entered=0;const logins:string[][]=[],changes:string[][]=[];
 const auth={login:async(email:string,password:string)=>{logins.push([email,password]);signed=true},logout:async()=>{},activate:async()=>{},resetPassword:async()=>{},changePassword:async(current:string,next:string)=>{changes.push([current,next]);changed=true}};
 const service=api({session:async()=>{if(!signed)throw new CatalogApiError(401,'UNAUTHENTICATED','Login');return{...admin,auth_method:'password',must_change_password:!changed}}});
 render(<AppEntrance api={service} auth={auth} onEnter={()=>entered++}/>);await screen.findByLabelText('Mật khẩu',{exact:true});fireEvent.change(screen.getByLabelText('Email đăng nhập',{exact:true}),{target:{value:'admin@example.invalid'}});fireEvent.change(screen.getByLabelText('Mật khẩu',{exact:true}),{target:{value:'Temporary password 2026!'}});fireEvent.click(screen.getByRole('button',{name:'Đăng nhập',exact:true}));await screen.findByRole('heading',{name:'Đổi mật khẩu tạm'});assert.equal(entered,0);assert.deepEqual(logins,[['admin@example.invalid','Temporary password 2026!']]);assert.equal(screen.queryByRole('button',{name:'Vào phần mềm'}),null);
 fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại',{exact:true}),{target:{value:'Temporary password 2026!'}});fireEvent.change(screen.getByLabelText('Mật khẩu mới',{exact:true}),{target:{value:'My private password 2026!'}});fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới',{exact:true}),{target:{value:'My private password 2026!'}});fireEvent.click(screen.getByRole('button',{name:'Đổi mật khẩu',exact:true}));await waitFor(()=>assert.equal(entered,1));assert.deepEqual(changes,[['Temporary password 2026!','My private password 2026!']]);assert.equal(dom.window.localStorage.getItem('password'),null);
});
test('native authentication client sends password only in a same-origin POST and does not follow Access redirects',async()=>{
 const {createNativeAuthClient}=await import('../src/api/nativeAuthClient');let init:RequestInit|undefined,path='';const auth=createNativeAuthClient(async(url,options)=>{path=String(url);init=options;return Response.json({data:{ok:true}})});await auth.login('staff@example.invalid','Private password for test!');assert.equal(path,'/api/auth/login');assert.equal(init?.method,'POST');assert.equal(init?.credentials,'same-origin');assert.equal(init?.redirect,'manual');assert.deepEqual(JSON.parse(String(init?.body)),{email:'staff@example.invalid',password:'Private password for test!'});const gated=createNativeAuthClient(async()=>new Response(null,{status:302}));await assert.rejects(()=>gated.login('a@example.invalid','test'),e=>e instanceof CatalogApiError&&e.code==='ACCESS_GATE_ACTIVE');
});
