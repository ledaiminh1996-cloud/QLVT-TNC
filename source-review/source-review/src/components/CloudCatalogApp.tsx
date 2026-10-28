import {inventoryBookMenus,isInventoryBookMenu} from "../../shared/inventoryBooks";
import {UserManagement} from "./UserManagement";
import {AccessGate} from "./AccessGate";
import {createUserAccessClient,type UserAccessClient} from "../api/userAccessClient";
import {userRoles} from "../../shared/userAccess";
import {isDocumentMenu} from '../../shared/documents';
import {createDocumentClient} from '../documents/documentClient';
import {CatalogHistoryButton,CatalogHistoryDrawer} from './CatalogHistoryDrawer';
import { PairingSetsView } from './PairingSetsView';
import { equipmentFormFields, equipmentTableDefinition, initialCondition } from '../api/equipmentFormFields';
import { createParameterCatalogClient } from '../api/parameterCatalogClient';
import { loadCatalogRows } from '../api/loadCatalogRows';
import { ThemeToggle } from './ThemeToggle';
import { PartCardGrid } from './PartCardGrid';
import { CatalogIcon } from './MenuIcon';
import { StatusBadge } from './StatusBadge';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, RefreshCw, Plus, Pencil, Cloud, ArrowLeft, X, Trash2, Upload, Download, Truck, List, LayoutGrid } from 'lucide-react';
import { accessMessage, CatalogApiError, createCatalogClient } from '../api/catalogClient.ts';
import type { CatalogClient, CatalogRow, Page, Resource, Session } from '../api/catalogClient.ts';
import { definitions, displayValue, formPayload, initialValues } from '../api/catalogFields.ts';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ConnectedDirectory } from './ConnectedDirectory';
import { exportToCSV } from '../utils/inventoryUtils';

const client = createCatalogClient();
const accountClient=createUserAccessClient();
const documentClient=createDocumentClient();
const InventoryBooks=React.lazy(()=>import("../books/InventoryBooks").then(module=>({default:module.InventoryBooks})));
const DocumentsWorkspace=React.lazy(()=>import('../documents/DocumentsWorkspace').then(module=>({default:module.DocumentsWorkspace})));
const buttonClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed';
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400';

export function CloudCatalogApp({ onOpenLocal, api = client, accounts = accountClient, webapp = false }: { onOpenLocal: () => void; api?: CatalogClient; accounts?:UserAccessClient; webapp?: boolean }) {
  const [resource, setResource] = useState<Resource>('parts');
  const [menu, setMenu] = useState('dm_vt_tb');
  const [mobile, setMobile] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [featureNotice, setFeatureNotice] = useState('');
  const [documentCreate,setDocumentCreate]=useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setChecking(true); setError(null); setSession(null);
    api.session(controller.signal).then(data => {
      if (!controller.signal.aborted) setSession(data);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure);
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [api, attempt]);

  const activeUser = session?.access_granted === true ? session.user : null;
  if(checking||!activeUser||error||session?.must_change_password)return <AccessGate checking={checking} error={error} session={session} onRetry={()=>setAttempt(n=>n+1)}/>;
  const menus: Record<string, Resource> = { dm_vi_tri_lap:'mount-positions', dm_vat:'vat-rates', dm_vt_tb: 'parts', td_tra_cuu_vt: 'parts', dm_phuong_tien: 'vehicles', dm_ghep_thiet_bi: 'equipment-pairing-sets', dm_tham_so_pttb: 'equipment-parameters', dm_nhan_su: 'staff', dm_kho: 'warehouses', dm_bon_dau: 'fuel-tanks', dm_ncc: 'suppliers', dm_ma_doi_tuong: 'part-objects', dm_ma_nhom: 'part-groups' };
  const unavailable = () => setFeatureNotice('Phân hệ này đang được kết nối máy chủ. Bạn có thể thao tác các danh mục trong menu Danh mục.');
  const pairingPage=webapp && menu==='dm_ghep_thiet_bi';
  const receiptPage=webapp && menu==='ct_nhap_kho';
  const recoveryPage=webapp && menu==='ct_thu_hoi';
  const bookPage=webapp&&isInventoryBookMenu(menu);
  const ledgerPage=bookPage&&menu==="so_theo_doi_kho";
  const stockPage=webapp && (['ct_nhap_kho','ct_xuat_kho','ct_thu_hoi'].includes(menu)||bookPage);
  const content = (
    <div className={`${bookPage||recoveryPage?'flex h-dvh min-h-0 flex-col overflow-hidden':pairingPage?'flex h-dvh min-h-0 flex-col overflow-hidden':stockPage?'flex min-h-screen flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden':'min-h-screen'} min-w-0 flex-1 ${webapp ? 'bg-white' : 'bg-slate-50'} text-slate-800`}>
      {webapp ? <>
        <Header compactActions={bookPage||recoveryPage} accountAction={<button title={session?.identity.email} onClick={()=>setMenu("ht_users")} className="inline-flex max-w-40 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"><span className="truncate">{activeUser.display_name}</span><span className="hidden whitespace-nowrap text-slate-500 xl:inline">{userRoles[activeUser.role]}</span></button>} hideReceiptCreate={receiptPage} activeMenuId={menu} lowStockCount={0} criticalWearCount={0} fuelTxCount={0} onToggleMobileSidebar={() => setMobile(value => !value)} onOpenNewTxModal={type=>{setMenu(type==='IN'?'ct_nhap_kho':'ct_xuat_kho');setDocumentCreate(n=>n+1);}} onOpenNewPartModal={unavailable} onOpenImportModal={unavailable} onOpenPeriodLock={unavailable} onExportBalanceCSV={unavailable} onResetData={unavailable} />
        {menu!=="ht_users"&&!pairingPage&&!stockPage&&<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-5 py-2 text-xs text-emerald-900"><span><strong>Lưu trên máy chủ</strong> · Thêm, sửa, xóa danh mục ngay trong webapp.</span><button onClick={onOpenLocal} className="rounded border border-emerald-500 px-2 py-1">Xem dữ liệu cũ trên máy</button></div>}
      </> : <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div><div className="text-xs font-bold uppercase tracking-widest text-amber-700">Tân Nam Chinh</div><h1 className="mt-1 text-xl font-bold">Quản lý danh mục</h1></div>
          <div className="flex flex-wrap items-center gap-3"><ThemeToggle /><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800"><Cloud size={16} /> Dữ liệu tập trung</span>
            <button className={buttonClass} onClick={onOpenLocal}><ArrowLeft size={14} className="mr-1 inline" /> Xem dữ liệu trên máy</button></div>
        </div>
      </header>}
      <main className={stockPage?"flex min-h-0 w-full flex-1 flex-col gap-2 px-4 py-3 sm:px-6":pairingPage?"mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6":"mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-8"}>
        {!webapp && <nav aria-label="Danh mục" className="flex flex-wrap gap-2">
          {(Object.keys(definitions) as Resource[]).filter(key => !['org-units','departments'].includes(key)).map(key => <button key={key} onClick={() => setResource(key)} aria-pressed={resource === key} className={`${buttonClass} ${resource === key ? 'border-amber-500 bg-amber-100 text-amber-950' : 'bg-white'}`}>{definitions[key].label}</button>)}
        </nav>}
        {featureNotice && <p role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">{featureNotice}</p>}
        {checking ? <div role="status" className="rounded-xl border border-slate-200 bg-white p-8">Đang kiểm tra kết nối và quyền truy cập…</div>
          : !activeUser || error ? <section className="rounded-xl border border-amber-200 bg-white p-6" aria-label="Trạng thái truy cập">
            <h2 className="text-lg font-bold">Chưa thể mở dữ liệu tập trung</h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-slate-600">{error ? accessMessage(error) : 'Bạn đã đăng nhập nhưng chưa được cấp tài khoản hoạt động trong ứng dụng. Hãy liên hệ người quản trị.'}</p>
            {session?.identity.email && <p className="mt-2 text-sm">Email đăng nhập: {session.identity.email}</p>}
            <button className={`${buttonClass} mt-4`} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} className="mr-1 inline" /> Kiểm tra lại</button>
          </section>
          : <>
            {webapp&&menu==="ht_users"?<UserManagement session={session!} accounts={accounts} api={api}/>:webapp&&isInventoryBookMenu(menu)?<React.Suspense fallback={<p role="status">Đang mở sổ…</p>}><InventoryBooks key={menu} book={inventoryBookMenus[menu]} api={api} documents={documentClient}/></React.Suspense>:webapp&&isDocumentMenu(menu)?<React.Suspense fallback={<p role="status">Đang mở chứng từ…</p>}><DocumentsWorkspace key={menu} menu={menu} api={api} documents={documentClient} user={activeUser} createToken={documentCreate}/></React.Suspense>:webapp && !menus[menu] ? <section className="rounded-xl border border-slate-200 p-6">Phân hệ đang được kết nối máy chủ. Chọn một mục trong menu Danh mục để thêm, sửa, xóa dữ liệu.</section>
              : ['warehouses', 'fuel-tanks'].includes(resource) ? <WarehouseDirectory key={attempt} api={api} initialResource={resource as 'warehouses' | 'fuel-tanks'} canEdit={['admin', 'accountant'].includes(activeUser.role)} onAccessError={setError} />
              : resource === 'equipment-pairing-sets' || resource === 'equipment-pairings' ? <PairingSetsView api={api} canEdit={['admin','accountant'].includes(activeUser.role)} onAccessError={setError} />
              : resource === 'equipment-parameters' ? <EquipmentParameterDirectory api={api} canEdit={['admin','accountant'].includes(activeUser.role)} onAccessError={setError} />
              : resource === 'vehicles' && webapp ? <EquipmentDirectory api={api} canEdit={['admin','accountant'].includes(activeUser.role)} onAccessError={setError} />
              : resource === 'staff' ? <PersonnelDirectory key={attempt} api={api} canEdit={['admin','accountant'].includes(activeUser.role)} onAccessError={setError} />
              : resource === 'suppliers' ? <ConnectedDirectory key={`${resource}-${attempt}`} resource={resource as 'staff' | 'warehouses' | 'suppliers'} api={api} canEdit={['admin', 'accountant'].includes(activeUser.role)} onAccessError={setError} />
              : <CatalogPanel key={`${resource}-${attempt}`} resource={resource} api={api} canEdit={['admin', 'accountant'].includes(activeUser.role)} onAccessError={setError} />}
          </>}
      </main>
    </div>
  );
  if (!webapp) return content;
  return <div className="flex min-h-screen bg-white font-sans"><Sidebar showPairingCatalog activeMenuId={menu} onSelectMenu={id => { setMenu(id);setDocumentCreate(0); setFeatureNotice(''); if (menus[id]) setResource(menus[id]); }} lowStockCount={0} criticalWearCount={0} fuelTxCount={0} isOpenMobile={mobile} onCloseMobile={() => setMobile(false)} isMinimized={minimized} onToggleMinimize={() => setMinimized(value => !value)} />{content}</div>;
}

function EquipmentDirectory({api,canEdit,onAccessError}: {api:CatalogClient;canEdit:boolean;onAccessError:(error:unknown)=>void}) {
  const [tab,setTab] = useState('tractor');
  const cached = useMemo(()=>createParameterCatalogClient(api),[api]);
  useEffect(()=>()=>cached.dispose(),[cached]);
  const tabs = [['tractor','Đầu kéo'],['trailer','Rơ moóc'],['generator_container','Máy phát / Cont'],['office_and_box','Xe văn phòng / tải thùng'],['rented_truck','Xe thuê ngoài']] as const;
  const resource:Resource = tab==='generator_container'?'equipment':'vehicles';
  const label = tabs.find(([key])=>key===tab)![1];
  const controls = <div role="tablist" aria-label="Loại phương tiện thiết bị" className="flex max-w-full flex-wrap items-center gap-1.5">{tabs.map(([key,name])=><button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)} className={`inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors ${tab===key?'border-amber-500 bg-amber-500 text-slate-950 shadow-xs':'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50'}`}>{name}</button>)}</div>;
  const type=tab==='box_truck'?'rented_truck':tab;
  const scope=tab==='generator_container'?{source_group:'generator_container'}:tab==='office_and_box'?{source_group:'office_and_box'}:{type,...(resource==='vehicles'?{source_group:tab}:{})};
  const defaults=tab==='generator_container'?{type:'generator'}:tab==='office_and_box'?{type:'office_car',source_group:'office_car'}:scope;
  return <div role="tabpanel" aria-label={label}><CatalogPanel key={tab} resource={resource} api={cached.client} canEdit={canEdit} onAccessError={onAccessError} scope={scope} formDefaults={defaults} title={'Danh mục '+label.toLowerCase()} filterControls={controls} /></div>;
}

function EquipmentParameterDirectory({api,canEdit,onAccessError}: {api:CatalogClient;canEdit:boolean;onAccessError:(error:unknown)=>void}) {
  const [group,setGroup]=useState('route');
  const cached = useMemo(()=>createParameterCatalogClient(api),[api]);
  useEffect(()=>()=>cached.dispose(),[cached]);
  const groups=[['route','Nhóm tuyến'],['equipment_type','Loại thiết bị'],['source','Nguồn'],['condition','Trạng thái']] as const;
  const controls=<div role="tablist" aria-label="Nhóm tham số" className="flex flex-wrap gap-1.5">{groups.map(([key,label])=><button key={key} role="tab" aria-selected={key===group} onClick={()=>setGroup(key)} className={`h-9 rounded-lg border px-3 text-xs font-semibold ${key===group?'border-amber-500 bg-amber-500 text-slate-950':'border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</div>;
  return <CatalogPanel key={group} resource="equipment-parameters" api={cached.client} onReload={cached.clear} canEdit={canEdit} onAccessError={onAccessError} scope={{group_key:group}} formDefaults={{group_key:group}} title="Tham số phương tiện thiết bị" filterControls={controls} />;
}

function PersonnelDirectory({ api, canEdit, onAccessError }: { api: CatalogClient; canEdit: boolean; onAccessError: (error: unknown) => void }) {
  const [personnelTab,setPersonnelTab] = useState<'employees'|'drivers'>('employees');
  const [units,setUnits] = useState<CatalogRow[]>([]);
  const [departments,setDepartments] = useState<CatalogRow[]>([]);
  const [people,setPeople] = useState<CatalogRow[]>([]);
  const [selected,setSelected] = useState<{ unit?: string; dept?: string; unassigned?: 'employee'|'driver' }>({});
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<unknown>(null);
  const [focused,setFocused] = useState<CatalogRow>();
  useEffect(() => {
    const controller=new AbortController();setLoading(true);setError(null);
    const load = (resource: Resource) => loadCatalogRows(api, resource, controller.signal);
    Promise.all([load('org-units'),load('departments'),load('staff')]).then(([u,d,p])=>{if(!controller.signal.aborted){setUnits(u);setDepartments(d);setPeople(p);}}).catch(failure=>{if(!controller.signal.aborted){setError(failure);if(failure instanceof CatalogApiError&&[401,403].includes(failure.status))onAccessError(failure);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[api,revision,onAccessError]);
  const dept=departments.find(row=>row.id===selected.dept);
  const unit=units.find(row=>row.id===selected.unit);
  const isStaff=!!dept||!!selected.unassigned;
  const type=String(dept?.kind??selected.unassigned??'employee');
  const resource:Resource=isStaff?'staff':unit?'departments':'org-units';
  const choose=(next:typeof selected)=>{setSelected(next);setFocused(undefined);};
  const scope=isStaff ? dept ? { unit_id:String(dept.unit_id),department_id:dept.id,staff_type:type } : {staff_type:type,unassigned:'1'} : unit?{unit_id:unit.id,kind:'employee'}:undefined;
  const defaults: Record<string,string> | undefined=dept?{unit_id:String(dept.unit_id),department_id:dept.id,staff_type:type}:isStaff?{staff_type:type}:unit?{unit_id:unit.id,kind:'employee'}:undefined;
  const labels=Object.fromEntries([...units,...departments].map(row=>[row.id,String(row.name)]));
  return <section className="space-y-4" aria-label="Danh mục nhân sự">
    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><CatalogIcon resource="staff" className="text-blue-600" />Danh mục nhân sự</h2>
    <nav aria-label="Nhóm nhân sự" className="flex gap-2" role="tablist">
      <button role="tab" aria-selected={personnelTab==='employees'} className={buttonClass+(personnelTab==='employees'?' bg-blue-600 text-white':'')} onClick={()=>{setPersonnelTab('employees');setFocused(undefined);}}>Nhân viên</button>
      <button role="tab" aria-selected={personnelTab==='drivers'} className={buttonClass+(personnelTab==='drivers'?' bg-blue-600 text-white':'')} onClick={()=>{setPersonnelTab('drivers');setFocused(undefined);}}>Tài xế</button>
    </nav>
    {personnelTab==='drivers' ? <CatalogPanel key="drivers" resource="staff" api={api} canEdit={canEdit} onAccessError={onAccessError} scope={{staff_type:'driver'}} formDefaults={{staff_type:'driver'}} title="Tài xế" onChanged={()=>setRevision(n=>n+1)} /> : <>
    {error?<div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">{accessMessage(error)} <button className={buttonClass} onClick={()=>setRevision(n=>n+1)}>Tải lại</button></div>:loading?<p role="status">Đang tải cây nhân sự…</p>:<div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs" aria-label="Cây nhân sự">
        <button className="mb-3 w-full rounded-lg bg-blue-50 p-2 text-left font-bold text-blue-700" onClick={()=>choose({})}>Đơn vị</button>
        <ul className="space-y-2">
          {units.map(u=><li key={u.id}><details open><summary className="cursor-pointer rounded p-1.5 font-semibold text-slate-900" onClick={()=>choose({unit:u.id})}>{u.name}{u.is_active!==1?' (ngừng sử dụng)':''}</summary>
            <ul className="ml-3 space-y-1 border-l border-slate-200 pl-3">{departments.filter(d=>d.unit_id===u.id&&d.kind==='employee').map(d=><li key={d.id}><details><summary className={'cursor-pointer rounded p-1.5 font-semibold '+(d.kind==='driver'?'text-blue-700':'text-slate-700')} onClick={()=>choose({unit:u.id,dept:d.id})}>{d.name}{d.kind==='driver'?' · Tài xế':''}{d.is_active!==1?' (ngừng sử dụng)':''}</summary>
              <ul className="ml-2 border-l border-slate-200 pl-2">{people.filter(person=>person.department_id===d.id&&person.staff_type==='employee').map(person=><li key={person.id}><button className="w-full rounded p-1.5 text-left hover:bg-blue-50" onClick={()=>{setSelected({unit:u.id,dept:d.id});setFocused(person);}}>{person.name}{person.is_active!==1?' (ngừng sử dụng)':''}</button></li>)}</ul>
            </details></li>)}</ul>
          </details></li>)}
          {(['employee'] as const).map(kind=>people.some(p=>!p.department_id&&p.staff_type===kind)&&<li key={kind}><button className="rounded p-2 text-left text-amber-700" onClick={()=>choose({unassigned:kind})}>Nhân viên chưa phân phòng</button></li>)}
        </ul>
      </aside>
      <div className="min-w-0"><CatalogPanel key={resource+(selected.unit??'')+(selected.dept??'')+(selected.unassigned??'')} resource={resource} api={api} canEdit={canEdit} onAccessError={onAccessError} scope={scope} formDefaults={defaults} warehouseLabels={labels} title={isStaff?(type==='driver'?'Tài xế':'Nhân viên')+' · '+(dept?.name??'Chưa phân phòng'):unit?'Phòng ban · '+unit.name:'Đơn vị'} onViewTanks={!isStaff?row=>choose(resource==='org-units'?{unit:row.id}:{unit:String(row.unit_id),dept:row.id}):undefined} actionLabel={resource==='org-units'?'Xem phòng ban':'Xem thành viên'} onChanged={()=>{setFocused(undefined);setRevision(n=>n+1);}} focusedRow={focused} /></div>
    </div>}
    </>}
  </section>;
}

function WarehouseDirectory({ api, initialResource, canEdit, onAccessError }: { api: CatalogClient; initialResource: 'warehouses' | 'fuel-tanks'; canEdit: boolean; onAccessError: (error: unknown) => void }) {
  const [view, setView] = useState(initialResource);
  const [selected, setSelected] = useState('');
  const [warehouses, setWarehouses] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => { setView(initialResource); setSelected(''); }, [initialResource]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailure(null);
    (async () => {
      const all: CatalogRow[] = [];
      for (let page = 1; page <= 1000; page++) {
        const data = await api.list('warehouses', { page, signal: controller.signal });
        if (controller.signal.aborted) return;
        all.push(...data.data);
        if (all.length >= data.pagination.total) break;
        if (!data.data.length || page === 1000) throw new Error('Không tải đủ danh mục kho.');
      }
      setWarehouses(all);
    })().catch(error => { if (!controller.signal.aborted) { setFailure(error); if (error instanceof CatalogApiError && [401,403].includes(error.status)) onAccessError(error); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, revision, onAccessError]);
  return <section className="space-y-4" aria-label="Kho và bồn dầu">
    <nav role="tablist" className="flex flex-wrap items-center gap-2" aria-label="Danh mục kho và bồn">
      <button className={buttonClass + (view === 'warehouses' ? ' bg-blue-600 text-white' : '')} role="tab" aria-selected={view === 'warehouses'} onClick={() => setView('warehouses')}>Kho</button>
      <button className={buttonClass + (view === 'fuel-tanks' ? ' bg-blue-600 text-white' : '')} role="tab" aria-selected={view === 'fuel-tanks'} onClick={() => setView('fuel-tanks')}>Bồn dầu</button>
    </nav>
    {view === 'fuel-tanks' && <div className="flex flex-wrap items-center gap-3"><label htmlFor="tank-warehouse-filter" className="text-sm font-semibold">Kho trực thuộc</label><select id="tank-warehouse-filter" className={inputClass + ' max-w-sm'} value={selected} disabled={loading || !!failure} onChange={event => setSelected(event.target.value)}><option value="">Tất cả kho</option>{warehouses.map(row => <option key={row.id} value={row.id}>{row.code} — {row.name}{row.is_active !== 1 ? ' (ngừng sử dụng)' : ''}</option>)}</select></div>}
    {failure ? <div role="alert" className="text-sm text-red-700">{accessMessage(failure)} <button className={buttonClass} onClick={() => setRevision(n => n+1)}>Tải lại kho</button></div> : loading && view === 'fuel-tanks' ? <p role="status">Đang tải kho…</p> : <CatalogPanel key={view + selected} resource={view} api={api} canEdit={canEdit} onAccessError={onAccessError} warehouseId={view === 'fuel-tanks' ? selected : undefined} warehouseLabels={Object.fromEntries(warehouses.map(row => [row.id, row.code + ' — ' + row.name]))} onViewTanks={view === 'warehouses' ? row => { setSelected(row.id); setView('fuel-tanks'); } : undefined} onChanged={() => { if (view === 'warehouses') setRevision(n => n+1); }} />}
  </section>;
}

function catalogCellClass(key:string,type?:string):string {
 if(['status','is_active','route_group','type','staff_rank'].includes(key))return 'catalog-cell-center';
 if(type==='number'||key==='load_spec')return 'catalog-cell-number font-sans tabular-nums';
 return 'catalog-cell-text';
}

function CatalogPanel({ resource, api, canEdit, onAccessError, warehouseId, warehouseLabels, onViewTanks, onChanged, scope, formDefaults, title, actionLabel, focusedRow, filterControls, onReload }: { resource: Resource; api: CatalogClient; canEdit: boolean; onAccessError: (error: unknown) => void; warehouseId?: string; warehouseLabels?: Record<string, string>; onViewTanks?: (row: CatalogRow) => void; onChanged?: () => void; scope?: { source_group?: string; group_key?: string; type?: string; unit_id?: string; department_id?: string; staff_type?: string; unassigned?: string; kind?: string }; formDefaults?: Record<string,string>; title?: string; actionLabel?: string; focusedRow?: CatalogRow; filterControls?: React.ReactNode; onReload?: () => void }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState<{ row?: CatalogRow } | null>(null);
  const [historyRow,setHistoryRow]=useState<CatalogRow>();
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [partView, setPartView] = useState<'list' | 'cards'>('list');
  const statusResource = ['vehicles','equipment'].includes(resource);
  const conditionMode = statusResource && !!(scope?.type || scope?.source_group);
  const [conditions,setConditions] = useState<CatalogRow[]>([]);
  const [conditionError,setConditionError] = useState('');
  useEffect(()=>{
    if(!conditionMode)return;
    const controller=new AbortController();
    loadCatalogRows(api,'equipment-parameters',controller.signal).then(rows=>{if(!controller.signal.aborted)setConditions(rows.filter(row=>row.group_key==='condition' && row.is_active===1));}).catch(failure=>{
      if(!controller.signal.aborted){setConditionError(accessMessage(failure));if(failure instanceof CatalogApiError && [401,403].includes(failure.status))onAccessError(failure);}
    });
    return ()=>controller.abort();
  },[api,conditionMode,onAccessError]);
  const statusQuery = conditionMode ? {original_status:status || undefined} : {status};

  const baseDefinition = definitions[resource];
  const definition = resource === 'staff' && scope?.staff_type === 'driver' ? { ...baseDefinition, columns: ['code','name','staff_rank','vehicle_plate','trailer_plate','phone','email','is_active'] } : conditionMode ? equipmentTableDefinition(baseDefinition,scope?.type,scope?.source_group) : baseDefinition;
  useEffect(() => { if (focusedRow && canEdit) setForm({row:focusedRow}); }, [focusedRow,canEdit]);
  const revision = useRef(0);
  const deletionLock = useRef(false);
  async function exportCatalog() {
    setExporting(true);
    try {
      const all: CatalogRow[] = [];
      for (let current = 1; current <= 1000; current++) {
        const data = await api.list(resource, { page: current, q: search, ...statusQuery, warehouse_id: warehouseId, ...scope });
        all.push(...data.data);
        if (all.length >= data.pagination.total) break;
        if (!data.data.length || current === 1000) throw new Error('Không tải đủ danh mục để xuất.');
      }
      exportToCSV(`Danh_Muc_${resource}`, all.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => { const field = definitions[resource].fields.find(field => field.key === key); return [key, field?.scale && value != null ? Number(value) / field.scale : key === 'warehouse_id' ? warehouseLabels?.[String(value)] ?? value : value]; }))), definitions[resource].fields.map(field => ({ key: field.key, label: field.label })));
    } catch (failure) { setError(failure); } finally { setExporting(false); }
  }
  async function removeRow(row: CatalogRow) {
    if (deletionLock.current || !window.confirm('Xóa bản ghi khỏi danh mục đang sử dụng? Lịch sử liên quan sẽ được giữ lại.')) return;
    deletionLock.current = true; setDeleting(true); setNotice(''); setError(null);
    try {
      await api.save(resource, statusResource ? { status: 'stopped' } : { is_active: 0 }, row);
      onChanged?.();
      setNotice('Đã xóa khỏi danh mục sử dụng và lưu trên máy chủ.');
      setStatus(conditionMode ? '' : statusResource ? 'active' : '1');
      setReload(n => n + 1);
    } catch (failure) {
      setError(failure);
      if (failure instanceof CatalogApiError && [401, 403].includes(failure.status)) onAccessError(failure);
    } finally { deletionLock.current = false; setDeleting(false); }
  }

  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++revision.current;
    setLoading(true); setError(null); setResult(null);
    api.list(resource, { q: search, page, ...statusQuery, warehouse_id: warehouseId, ...scope, signal: controller.signal }).then(data => {
      if (controller.signal.aborted || revision.current !== current) return;
      if (data.data.length === 0 && page > 1 && data.pagination.total <= (page - 1) * data.pagination.page_size) {
        setPage(Math.max(1, Math.ceil(data.pagination.total / data.pagination.page_size))); return;
      }
      setResult(data);
    }).catch(failure => {
      if (controller.signal.aborted || revision.current !== current) return;
      setError(failure);
      if (failure instanceof CatalogApiError && [401, 403].includes(failure.status)) onAccessError(failure);
    }).finally(() => { if (!controller.signal.aborted && revision.current === current) setLoading(false); });
    return () => controller.abort();
  }, [resource, api, search, status, page, reload, onAccessError, warehouseId, scope?.unit_id, scope?.department_id, scope?.staff_type, scope?.unassigned, scope?.kind, scope?.type, scope?.source_group, scope?.group_key]);

  return <section className="catalog-page space-y-4" aria-label={`Danh sách ${definition.singular}`}>
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center"><div><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><CatalogIcon resource={resource} className="shrink-0 text-blue-600" /> {title ?? (resource === 'parts' ? 'Danh mục VT-TB' : resource === 'vehicles' ? 'Danh Mục Phương Tiện' : definition.label)}</h2></div>
      <div className="flex flex-wrap gap-2">
        {resource === 'parts' && <div role="group" aria-label="Chế độ hiển thị vật tư" className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">{(['list', 'cards'] as const).map(view => <button key={view} type="button" aria-pressed={partView === view} onClick={() => setPartView(view)} className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium ${partView === view ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-50'}`}>{view === 'list' ? <List size={14} /> : <LayoutGrid size={14} />}{view === 'list' ? 'Danh sách' : 'Thẻ'}</button>)}</div>}
        {canEdit && <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500" onClick={() => { setNotice(''); setForm({}); }}><Plus size={14} /> Thêm {resource === 'staff' ? scope?.staff_type === 'driver' ? 'tài xế' : 'nhân viên' : definition.singular}</button>}
        <button disabled={loading || exporting || !!error} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium shadow-xs hover:bg-slate-50 disabled:opacity-50" onClick={() => { void exportCatalog(); }}><Download size={14} className="text-emerald-600" /> {exporting ? 'Đang xuất…' : 'Export Excel'}</button>
        <button className="rounded-lg border border-slate-200 p-2 text-xs" aria-label="Tải lại" disabled={loading} onClick={() => { onReload?.(); setReload(n => n + 1); }}><RefreshCw size={14} /></button>
      </div></div>
    <div className="flex flex-wrap gap-3"><input aria-label="Tìm kiếm" className={`${inputClass} ${filterControls ? 'h-9 min-w-[200px] flex-1' : 'max-w-md'}`} placeholder="Tìm theo mã hoặc tên…" value={query} maxLength={200} onChange={event => { setNotice(''); setQuery(event.target.value); }} />
      <select aria-label="Lọc trạng thái" className={`${inputClass} ${filterControls ? 'h-9 !w-48 shrink-0' : 'max-w-xs'}`} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>
        {conditionMode ? conditions.map(row=><option key={row.id} value={String(row.name)}>{row.name}</option>) : statusResource ? <><option value="active">Đang hoạt động</option><option value="maintenance">Bảo dưỡng</option><option value="stopped">Ngừng hoạt động</option></> : <><option value="1">Đang sử dụng</option><option value="0">Ngừng hoạt động</option></>}</select>{filterControls}</div>
    {conditionError && <p role="alert" className="text-xs text-red-700">Không tải được bộ lọc trạng thái: {conditionError}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading ? <div role="status" className="rounded-xl border border-slate-200 bg-white p-8">Đang tải danh mục…</div>
      : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{accessMessage(error)} <button className={`${buttonClass} ml-2`} onClick={() => { onReload?.(); setReload(n => n + 1); }}>Thử lại</button></div>
      : result && <>
        {resource === 'parts' && partView === 'cards' ? <PartCardGrid rows={result.data} canEdit={canEdit} deleting={deleting} emptyMessage={search || status ? 'Không có bản ghi phù hợp với bộ lọc.' : 'Chưa có vật tư trên máy chủ.'} onEdit={row => { setNotice(''); setForm({ row }); }} onRemove={row => { void removeRow(row); }} onHistory={setHistoryRow} /> : <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs ${resource === 'parts' ? 'parts-list-table' : resource === 'equipment' && scope?.source_group==='generator_container' ? 'equipment-list-table' : resource === 'vehicles' && scope?.type === 'trailer' ? 'trailer-list-table' : ''}`}><table className="catalog-table w-max min-w-full table-auto border-collapse whitespace-nowrap text-left text-xs">{resource === 'parts' && <colgroup>{[14,18,9,6,6,8,8,6,7,9,9].map((width,index)=><col key={index} style={{width:`${width}%`}} />)}</colgroup>}{resource === 'vehicles' && scope?.type === 'trailer' && <colgroup>{[10,10,5,16,7,10,10,10,12,10].map((width,index)=><col key={index} style={{width:`${width}%`}} />)}</colgroup>}{resource === 'equipment' && scope?.source_group==='generator_container' && <colgroup>{[19,10,16,18,15,6,16].map((width,index)=><col key={index} style={{width:`${width}%`}} />)}</colgroup>}<thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600"><tr>{definition.columns.map(key => <th key={key} title={definition.fields.find(field=>field.key===key)?.label} className={catalogCellClass(key,definition.fields.find(field=>field.key===key)?.type)}> {key==='manufacture_year'?'Năm SX':resource==='parts'?({item_type:'Loại',object_code:'Đối tượng',group_code:'Nhóm',unit:'ĐVT',unit_price_vnd:'Đơn giá',min_stock_milli:'Tồn min',min_stock_unit:'ĐVT tồn'} as Record<string,string>)[key]??definition.fields.find(field=>field.key===key)?.label:definition.fields.find(field=>field.key===key)?.label}</th>)}<th scope="col" className="catalog-actions-cell">Thao tác</th></tr></thead>
          <tbody>{result.data.length === 0 ? <tr><td colSpan={definition.columns.length + 1} className="p-10 text-center text-slate-500">{search || status ? 'Không có bản ghi phù hợp với bộ lọc.' : `Chưa có ${definition.singular} trên máy chủ.`}</td></tr>
            : result.data.map(row => <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">{definition.columns.map(key => <td key={key} title={displayValue(resource,key,row[key])} className={`${catalogCellClass(key,definition.fields.find(field=>field.key===key)?.type)} ${['sku','plate_number','code','object_code','group_code','serial_number','tax_code'].includes(key) && row[key]!=null && row[key]!=='' ? 'font-mono font-bold text-amber-700' : key === 'name' ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{['is_active','status'].includes(key) ? <StatusBadge value={key === 'status' && conditionMode ? initialCondition(row) : row[key]} /> : ['warehouse_id','unit_id','department_id'].includes(key) ? warehouseLabels?.[String(row[key])] ?? String(row[key] ?? '—') : displayValue(resource, key, row[key])}</td>)}
              <td className="catalog-actions-cell"><div className="catalog-actions"><CatalogHistoryButton label={String(row.name??row.plate_number??row.code??row.sku??'')} onClick={()=>setHistoryRow(row)}/>{onViewTanks && <button className="rounded-lg border border-blue-200 px-2 py-1 font-semibold text-blue-600" onClick={() => onViewTanks(row)}>{actionLabel ?? 'Xem bồn'}</button>}{canEdit && <><button className="rounded-lg border border-amber-200 bg-amber-50 p-1 text-amber-700 hover:bg-amber-100 disabled:opacity-50" title="Sửa" disabled={deleting} aria-label={`Sửa ${row.name ?? row.plate_number ?? ''}`} onClick={() => { setNotice(''); setForm({ row }); }}><Pencil size={14} /></button>{(statusResource ? row.status !== 'stopped' : row.is_active === 1) && <button className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 disabled:opacity-50" title="Xóa" disabled={deleting} aria-label={`Xóa ${row.name ?? row.plate_number ?? ''}`} onClick={() => { void removeRow(row); }}><Trash2 size={14} /></button>}</>}</div></td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Tổng {result.pagination.total} bản ghi · Trang {page}/{Math.max(1, Math.ceil(result.pagination.total / result.pagination.page_size))}</span><div className="flex gap-2"><button className={buttonClass} disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Trang trước</button><button className={buttonClass} disabled={page * result.pagination.page_size >= result.pagination.total} onClick={() => setPage(n => n + 1)}>Trang sau</button></div></div>
      </>}
    {historyRow&&<CatalogHistoryDrawer key={resource+historyRow.id} resource={resource} row={historyRow} api={api} onAccessError={onAccessError} onClose={()=>setHistoryRow(undefined)}/>}
    {form && <CatalogForm resource={resource} row={form.row} standalone={conditionMode} allowVehicleSubtype={scope?.source_group==='office_and_box'} allowEquipmentSubtype={scope?.source_group==='generator_container'} defaults={formDefaults ?? (resource === 'fuel-tanks' && warehouseId ? { warehouse_id: warehouseId } : undefined)} api={api} onClose={() => setForm(null)} onSaved={() => { setForm(null); setNotice('Đã lưu trên máy chủ.'); onChanged?.(); setReload(n => n + 1); }} onAccessError={onAccessError} />}
  </section>;
}

function CatalogForm({ resource, row, defaults, standalone = false, allowVehicleSubtype = false, allowEquipmentSubtype = false, api, onClose, onSaved, onAccessError }: { resource: Resource; row?: CatalogRow; defaults?: Record<string,string>; standalone?: boolean; allowVehicleSubtype?: boolean; allowEquipmentSubtype?: boolean; api: CatalogClient; onClose: () => void; onSaved: () => void; onAccessError: (error: unknown) => void }) {
  const [values, setValues] = useState<Record<string,string>>(() => ({ ...initialValues(resource, row), ...(!row ? defaults : {}), ...(standalone ? {original_status:initialCondition(row)} : {}) }));
  const [parameters,setParameters] = useState<CatalogRow[]>([]);
  const [parametersLoading,setParametersLoading] = useState(standalone);
  const [parameterError,setParameterError] = useState('');
  useEffect(()=>{
    if(!standalone)return;
    const controller=new AbortController();
    loadCatalogRows(api,'equipment-parameters',controller.signal).then(rows=>{if(!controller.signal.aborted)setParameters(rows);}).catch(failure=>{
      if(!controller.signal.aborted){setParameterError(accessMessage(failure));if(failure instanceof CatalogApiError && [401,403].includes(failure.status))onAccessError(failure);}
    }).finally(()=>{if(!controller.signal.aborted)setParametersLoading(false);});
    return ()=>controller.abort();
  },[api,standalone,onAccessError]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<CatalogRow[]>([]);
  const [driverError, setDriverError] = useState('');
  const [driversLoading, setDriversLoading] = useState(resource === 'vehicles' && !standalone);
  const dialog = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const [lookups, setLookups] = useState<Record<string, CatalogRow[]>>({});
  const [codesLoading, setCodesLoading] = useState(definitions[resource].fields.some(field => field.lookup) && !(resource === 'parts' && row && !row.item_type));
  const [codesError, setCodesError] = useState('');
  useEffect(() => {
    if (!definitions[resource].fields.some(field => field.lookup) || (resource === 'parts' && row && !row.item_type)) return;
    const controller = new AbortController();
    (async () => {
      const result: Record<string, CatalogRow[]> = {};
      for (const type of Array.from(new Set(definitions[resource].fields.flatMap(field => field.lookup ? [field.lookup] : [])))) {
        const all: CatalogRow[] = [];
        for (let page = 1; page <= 1000; page++) {
          const data = await api.list(type, { page, signal: controller.signal });
          if (controller.signal.aborted) return;
          all.push(...data.data);
          if (all.length >= data.pagination.total) break;
          if (!data.data.length || page === 1000) throw new Error('Không tải đủ danh mục mã.');
        }
        result[type] = all;
      }
      setLookups(result);
    })().catch(failure => { if (!controller.signal.aborted) setCodesError(accessMessage(failure)); }).finally(() => { if (!controller.signal.aborted) setCodesLoading(false); });
    return () => controller.abort();
  }, [api, resource, row]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    if (resource !== 'vehicles' || standalone) return;
    const controller = new AbortController();
    (async () => {
      const all: CatalogRow[] = [];
      let page = 1;
      while (true) {
        const data = await api.list('staff', { page, signal: controller.signal });
        if (controller.signal.aborted) return;
        all.push(...data.data);
        if (all.length >= data.pagination.total) break;
        if (!data.data.length || page >= 1000) throw new Error('Không thể tải đầy đủ danh sách nhân sự.');
        page++;
      }
      setDrivers(all.filter(driver => (driver.is_active === 1 && driver.staff_type === 'driver') || driver.id === row?.assigned_driver_id));
    })().catch(failure => { if (!controller.signal.aborted) setDriverError(accessMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setDriversLoading(false); });
    return () => controller.abort();
  }, [resource, api, row, standalone]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current || driversLoading || driverError || codesLoading || codesError || parametersLoading || parameterError) return;
    setError('');
    let payload: Record<string, string | number | null>;
    try { payload = formPayload(resource, standalone && resource==='equipment' ? {...values,name:values.name || `${values.type==='generator'?'Máy phát':'Cont'} ${values.code}`,serial_number:values.serial_number || values.code} : values, row); } catch (failure) { setError((failure as Error).message); return; }
    if (standalone) { delete payload.assigned_driver_id; delete payload.has_reefer; delete payload.current_odo_km; }
    // Only send changed fields on edit. An inactive, unchanged driver is not reassigned.
    if (row) {
      for (const key of Object.keys(payload)) if (payload[key] === row[key]) delete payload[key];
      if (!Object.keys(payload).length) { setError('Chưa có thay đổi để lưu.'); return; }
    }
    submitLock.current = true; setSaving(true);
    try { await api.save(resource, payload, row); onSaved(); }
    catch (failure) {
      setError(accessMessage(failure));
      if (failure instanceof CatalogApiError && [401, 403].includes(failure.status)) onAccessError(failure);
    } finally { submitLock.current = false; setSaving(false); }
  }

  function trapFocus(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && !saving) { onClose(); return; }
    if (event.key !== 'Tab') return;
    const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])') ?? []);
    const first = elements[0]; const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="catalog-form-title" onKeyDown={trapFocus} className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 id="catalog-form-title" className="flex items-center gap-2 text-lg font-bold"><CatalogIcon resource={resource} className="shrink-0 text-blue-600" />{row ? 'Sửa' : 'Thêm'} {standalone ? (({tractor:'đầu kéo',trailer:'rơ moóc',generator:'máy phát',container:'Cont',office_car:'xe văn phòng',rented_truck:values.source_group==='box_truck'?'xe tải thùng':'xe thuê ngoài'} as Record<string,string>)[values.type] ?? definitions[resource].singular) : definitions[resource].singular}</h2><button className={buttonClass} aria-label="Đóng biểu mẫu" disabled={saving} onClick={onClose}><X size={18} /></button></div>
    <form onSubmit={submit}>
      {resource === 'parts' && <p className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">{row ? `Mã đã cấp: ${row.sku}. Cấu trúc mã được giữ nguyên.` : `Mã tự động: ${values.item_type || 'M'}-${values.object_code || '[ĐỐI TƯỢNG]'}-${values.group_code || '[NHÓM]'}-####. Số chính xác được cấp khi lưu. Thêm mã lựa chọn trong menu Mã đối tượng / Mã nhóm VT-TB.`}</p>}
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        {(standalone ? equipmentFormFields(resource,values.type,parameters,values) : definitions[resource].fields).filter(field => !(field.key === 'source_group' && !allowVehicleSubtype) && !(defaults?.group_key && field.key === 'group_key') && !(standalone && ((!allowEquipmentSubtype && field.key==='type') || ['assigned_driver_id','has_reefer'].includes(field.key))) && !(standalone && values.type === 'container' && field.key === 'operating_hours') && !(resource === 'staff' && field.key === 'staff_type') && !(resource === 'staff' && values.staff_type !== 'driver' && ['vehicle_plate','trailer_plate'].includes(field.key)) && !(resource === 'staff' && values.staff_type === 'driver' && field.key === 'department_id') && !(resource === 'departments' && field.key === 'kind')).map(field => {
          const id = `catalog-${field.key}`;
          const fixed = resource === 'parts' && !!row && ['sku', 'item_type', 'object_code', 'group_code'].includes(field.key);
          const common = { id, className: inputClass + (!field.lookup&&!field.choices&&!field.reference&&['sku','code','plate_number','serial_number','chassis_number','engine_number','tax_code'].includes(field.key)?' font-mono':field.type==='number'||field.key==='load_spec'?' font-sans tabular-nums text-right':''), value: values[field.key], required: field.required && !(resource === 'staff' && values.staff_type === 'driver' && ['unit_id','department_id'].includes(field.key)) && !(row && resource === 'parts' && ['item_type', 'object_code', 'group_code'].includes(field.key)), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const value = event.target.value; setValues(current => ({ ...current, [field.key]: value, ...(standalone && field.key === 'source_group' ? {type:value==='box_truck'?'rented_truck':'office_car'} : {}), ...(resource === 'staff' && ['unit_id','staff_type'].includes(field.key) ? { department_id: '' } : {}) })); } };
          return <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}><label className="mb-1 block text-sm font-medium" htmlFor={id}>{field.label}{common.required ? ' *' : ''}</label>
            {field.lookup ? <select {...common} disabled={fixed || saving || codesLoading}><option value="">Chọn {field.label.toLowerCase()}</option>{(lookups[field.lookup] ?? []).filter(item => ((item.is_active === 1 && item.kind !== 'fuel_tank') || (['part-objects','part-groups'].includes(field.lookup!) ? item.code : item.id) === values[field.key]) && (field.lookup !== 'departments' || (item.unit_id === values.unit_id && item.kind === values.staff_type))).map(item => <option key={item.id} value={String(['part-objects','part-groups'].includes(field.lookup!) ? item.code : item.id)}>{item.code} — {item.name}{item.is_active !== 1 ? ' (ngừng sử dụng)' : ''}</option>)}</select>
              : field.reference ? <><select {...common} disabled={saving || driversLoading || !!driverError}><option value="">Chưa phân công</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} ({driver.code}){driver.is_active !== 1 ? ' · Ngừng hoạt động' : ''}</option>)}{row?.assigned_driver_id && !drivers.some(driver => driver.id === row.assigned_driver_id) && <option value={String(row.assigned_driver_id)}>Tài xế đang được phân công</option>}</select>{driversLoading && <p className="mt-1 text-xs">Đang tải nhân sự…</p>}</>
              : field.choices ? <select {...common} disabled={fixed || saving || (allowEquipmentSubtype && !!row && field.key==='type') || (standalone && parametersLoading) || (resource === 'staff' && field.key === 'staff_type')}>{field.choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              : field.type === 'textarea' ? <textarea {...common} rows={3} maxLength={field.maxLength} />
              : <input {...common} readOnly={resource === 'parts' && field.key === 'sku'} placeholder={resource === 'parts' && field.key === 'sku' ? 'Tự cấp trên máy chủ khi lưu' : undefined} type={field.type ?? 'text'} maxLength={field.maxLength} min={field.min} max={field.max} step={field.type === 'number' ? field.scale ? '0.001' : '1' : undefined} />}</div>;
        })}
      </fieldset>
      {parametersLoading && <p role="status" className="mt-3 text-xs text-slate-500">Đang tải lựa chọn tham số…</p>}
      {(error || driverError || codesError || parameterError) && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error || driverError || codesError || parameterError}</p>}
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" className="min-h-9 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50" disabled={saving} onClick={onClose}>Đóng</button><button type="submit" className="min-h-9 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50" disabled={saving || driversLoading || !!driverError || codesLoading || !!codesError || parametersLoading || !!parameterError}>{saving ? 'Đang lưu…' : 'Lưu trên máy chủ'}</button></div>
    </form>
  </div></div>;
}
