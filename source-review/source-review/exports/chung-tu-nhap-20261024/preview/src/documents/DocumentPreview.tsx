import {useMemo,useRef,useState} from 'react';
import {DocumentsWorkspace} from './DocumentsWorkspace';
import {createDocumentPreview} from './previewStore';
import {documentKinds} from '../../shared/documents';
import type {Session} from '../api/catalogClient';
import {ThemeToggle} from '../components/ThemeToggle';
import {MenuIcon} from '../components/MenuIcon';
export default function DocumentPreview(){
 const [menu,setMenu]=useState('ct_nhap_kho'),[role,setRole]=useState<'admin'|'accountant'|'warehouse'|'viewer'>('admin');
 const user:NonNullable<Session['user']>={id:'preview-'+role,display_name:role==='admin'?'Quản trị mẫu':role==='accountant'?'Kế toán mẫu':role==='warehouse'?'Thủ kho mẫu':'Người xem mẫu',role};const current=useRef(user);current.current=user;
 const preview=useMemo(()=>createDocumentPreview(()=>current.current),[]),menus=[...new Map(Object.values(documentKinds).map(k=>[k.menu,k.label])).entries(),['ht_quy_trinh','Quy trình duyệt đề xuất']];
 return <div className="min-h-screen bg-slate-50 font-sans text-slate-900"><header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><div><strong>BẢN DỰNG CHỨNG TỪ TRÊN MÁY</strong><p className="mt-1">Dữ liệu mẫu chỉ ở bộ nhớ phiên này; tải lại sẽ xóa. Không kết nối hoặc ghi lên Cloudflare.</p></div><div className="flex items-center gap-2"><select aria-label="Vai trò xem thử" className="rounded border border-slate-300 bg-white p-2" value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="admin">Quản trị mẫu</option><option value="accountant">Kế toán mẫu</option><option value="warehouse">Thủ kho mẫu</option><option value="viewer">Người xem mẫu</option></select><ThemeToggle/></div></header><div className="mx-auto grid max-w-[1600px] gap-4 p-3 lg:grid-cols-[240px_minmax(0,1fr)]"><nav aria-label="Chứng từ dựng trước" className="flex gap-2 overflow-auto rounded-xl border border-slate-200 bg-white p-2 lg:flex-col lg:overflow-visible">{menus.map(([id,label])=><button key={id} className={'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs '+(menu===id?'bg-blue-50 font-semibold text-blue-700':'text-slate-600 hover:bg-slate-50')} onClick={()=>setMenu(id)}><MenuIcon menuId={id} size={16}/>{id==='ct_dieu_chuyen'?'Điều chuyển kho / thiết bị':label}</button>)}</nav><main className="min-w-0"><DocumentsWorkspace key={menu} menu={menu} api={preview.catalog} documents={preview.documents} user={user}/></main></div></div>;
}
