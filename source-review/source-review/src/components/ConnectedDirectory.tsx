import {CatalogHistoryDrawer} from './CatalogHistoryDrawer';
import { exportToCSV } from '../utils/inventoryUtils';
import { loadCatalogRows } from '../api/loadCatalogRows';
import React, { useEffect, useRef, useState } from 'react';
import { EnterpriseSectionsView } from './EnterpriseSectionsView';
import { accessMessage, CatalogApiError } from '../api/catalogClient.ts';
import type { CatalogClient, CatalogRow } from '../api/catalogClient.ts';
import { directoryPayload, toLegacy } from '../api/legacyDirectories.ts';
import type { DirectoryResource, LegacyRow } from '../api/legacyDirectories.ts';

export interface DirectoryControl {
  resource: DirectoryResource;
  rows: LegacyRow[];
  canEdit: boolean;
  saveList: (next: LegacyRow[]) => Promise<void>;
  supplierCodePreview?: string;
  search?: string;
  onSearch?: (value: string) => void;
  exportAll?: () => Promise<void>;
  exporting?: boolean;
  onHistory?: (id:string)=>void;
}

export function ConnectedDirectory({ resource, api, canEdit, onAccessError }: { resource: DirectoryResource; api: CatalogClient; canEdit: boolean; onAccessError: (error: unknown) => void }) {
  const [historyRow,setHistoryRow]=useState<CatalogRow>();
  const [records, setRecords] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [nextCode, setNextCode] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    (async () => {
      if (resource === 'suppliers') {
        const result = await api.list(resource, {page, pageSize:25, q:search, status:'1', signal:controller.signal});
        if (controller.signal.aborted) return;
        if (page > 1 && !result.data.length) { setPage(Math.max(1,Math.ceil(result.pagination.total/25))); return; }
        setRecords(result.data); setTotal(result.pagination.total); setNextCode(result.supplier_next_code);
      } else {
        const all = await loadCatalogRows(api, resource, controller.signal, '1');
        if (!controller.signal.aborted) setRecords(all);
      }
    })().catch(error => {
      if (controller.signal.aborted) return;
      setLoadError(accessMessage(error));
      if (error instanceof CatalogApiError && [401, 403].includes(error.status)) onAccessError(error);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, resource, retry, onAccessError, page, search]);

  const rows = records.filter(record => record.is_active === 1).map(record => toLegacy(resource, record));
  const supplierMax = Math.max(0,...records.filter(record => /^NCC[0-9]{5}$/.test(String(record.code))).map(record => Number(String(record.code).slice(3))));
  const supplierCodePreview = nextCode ?? ('NCC' + String(supplierMax+1).padStart(5,'0'));
  async function exportAll() {
    if (exporting) return;
    setExporting(true); setSaveError('');
    try {
      const all: CatalogRow[] = [];
      for (let current=1;current<=1000;current++) {
        const result=await api.list(resource,{page:current,pageSize:100,q:search,status:'1'});
        all.push(...result.data);
        if(all.length>=result.pagination.total) break;
        if(!result.data.length || current===1000) throw new Error('Không tải đủ danh mục để xuất.');
      }
      exportToCSV('Danh_Muc_Nha_Cung_Cap',all.map(row=>toLegacy(resource,row)),[{key:'code',label:'Mã NCC'},{key:'name',label:'Tên Nhà Cung Cấp'},{key:'tax_code',label:'Mã số thuế'},{key:'province_name',label:'Tỉnh/Thành phố'},{key:'address',label:'Địa chỉ'}]);
    } catch(error) { setSaveError(accessMessage(error)); } finally { setExporting(false); }
  }
  async function saveList(next: LegacyRow[]) {
    if (!canEdit || saving.current) throw new Error('Chưa thể lưu thao tác.');
    saving.current = true; setBusy(true); setSaveError(''); setNotice('');
    try {
      const removed = rows.filter(row => !next.some(item => item.id === row.id));
      const changed = next.filter(row => {
        const old = rows.find(item => item.id === row.id);
        return !old || JSON.stringify(old) !== JSON.stringify(row);
      });
      if (removed.length + changed.length === 0) { setNotice('Không có thay đổi cần lưu.'); return; }
      if (removed.length + changed.length !== 1) throw new Error('Vui lòng lưu từng bản ghi. Nhập hàng loạt sẽ được bổ sung riêng.');
      if (removed.length) {
        const old = records.find(record => record.id === removed[0].id)!;
        const deleted = await api.save(resource, { is_active: 0 }, old);
        setRecords(current => resource === 'suppliers' ? current.map(record => record.id === old.id ? deleted : record) : current.filter(record => record.id !== old.id));
        setNotice('Đã xóa khỏi danh mục sử dụng và lưu trên máy chủ. Lịch sử liên quan được giữ lại.');
        if(resource === 'suppliers') setRetry(n=>n+1);
      } else {
        const item = changed[0];
        const old = records.find(record => record.id === item.id);
        const saved = await api.save(resource, directoryPayload(resource, item, old), old);
        setRecords(current => old ? current.map(record => record.id === old.id ? saved : record) : [saved, ...current]);
        setNotice('Đã lưu trên máy chủ.');
        if(resource === 'suppliers') setRetry(n=>n+1);
      }
    } catch (error) {
      setSaveError(error instanceof CatalogApiError || error instanceof TypeError ? accessMessage(error) : (error as Error).message);
      if (error instanceof CatalogApiError && [401, 403].includes(error.status)) onAccessError(error);
      throw error;
    } finally { saving.current = false; setBusy(false); }
  }
  if (loading && !records.length) return <p role="status" className="p-5">Đang tải danh mục từ máy chủ…</p>;
  if (loadError) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">{loadError}<button className="ml-3 underline" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>;
  return <div className="space-y-3">
    {historyRow&&<CatalogHistoryDrawer key={resource+historyRow.id} resource={resource} row={historyRow} api={api} onAccessError={onAccessError} onClose={()=>setHistoryRow(undefined)}/>}
    {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {busy && <p role="status" className="text-sm text-blue-700">Đang lưu trên máy chủ…</p>}
    <div aria-busy={loading} className={loading ? 'pointer-events-none opacity-60' : ''}><EnterpriseSectionsView sectionId={{ staff: 'dm_nhan_su', warehouses: 'dm_kho', suppliers: 'dm_ncc' }[resource]} vehicles={[]} transactions={[]} onOpenNewTx={() => {}} directory={{ resource, rows, canEdit: canEdit && !busy, saveList, onHistory:(id)=>setHistoryRow(records.find(row=>row.id===id)), supplierCodePreview, ...(resource === 'suppliers' ? {search:query,onSearch:setQuery,exportAll,exporting} : {}) }} /></div>
    {resource === 'suppliers' && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><span>Tổng {total} NCC · Trang {page}/{Math.max(1,Math.ceil(total/25))} · 25 dòng/trang</span><div className="flex gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={loading || busy || page<=1} onClick={()=>setPage(n=>n-1)}>Trang trước</button><button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={loading || busy || page*25>=total} onClick={()=>setPage(n=>n+1)}>Trang sau</button></div></div>}
  </div>;
}
