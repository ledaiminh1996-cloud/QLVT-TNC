import {CatalogHistoryButton} from './CatalogHistoryDrawer';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import type { CatalogRow } from '../api/catalogClient';
import { displayValue } from '../api/catalogFields';

interface Props {
  rows: CatalogRow[];
  canEdit: boolean;
  deleting: boolean;
  emptyMessage: string;
  onHistory?: (row: CatalogRow) => void;
  onEdit: (row: CatalogRow) => void;
  onRemove: (row: CatalogRow) => void;
}

/** Uses the same server page as the list; no local stock estimates. */
export function PartCardGrid({ rows, canEdit, deleting, emptyMessage, onEdit, onRemove, onHistory }: Props) {
  if (!rows.length) return <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{emptyMessage}</p>;
  return <div aria-label="Thẻ vật tư" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
    {rows.map(row => {
      const value = (key: string) => displayValue('parts', key, row[key]);
      const stock=row.current_stock_milli==null?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:3}).format(Number(row.current_stock_milli)/1000);
      const typeLabel = ({ M: 'Vật tư', G: 'Dịch vụ', T: 'Thanh lý', C: 'Hàng cũ' } as Record<string, string>)[String(row.item_type)] ?? value('item_type');
      return <article key={row.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition hover:border-slate-300">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 break-all font-mono text-[11px] text-amber-700">{value('sku')}</span>
          <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-900">{value('unit_price_vnd')}{row.unit_price_vnd != null ? ' đ' : ''}<span className="font-normal text-slate-600">/{value('unit')}</span></span>
        </div>
        <h3 title={value('name')} className="mt-1 line-clamp-2 min-h-10 break-words text-sm font-semibold leading-5 text-slate-900">{value('name')}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium leading-4">
          <span className="rounded bg-blue-100 px-2 text-blue-700">{typeLabel}</span>
          <span title="Mã đối tượng" className="font-mono rounded border border-slate-200 px-2 text-slate-600">{value('object_code')}</span>
          <span title="Mã nhóm" className="font-mono rounded border border-slate-200 px-2 text-slate-600">{value('group_code')}</span>
        </div>
        <p className="mb-2 mt-2 text-xs tabular-nums text-slate-600">{value('lifespan_km_limit')} km · {value('lifespan_hours_limit')} giờ</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 pt-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600" title={`${row.is_active === 1 ? 'Hoạt động' : 'Ngừng hoạt động'}. Tồn theo sổ: ${stock} ${row.unit||''}.`}>
            <span aria-label={row.is_active === 1 ? 'Hoạt động' : 'Ngừng hoạt động'} className={`h-2 w-2 shrink-0 rounded-full ${row.is_active === 1 ? 'bg-emerald-600' : 'bg-slate-400'}`} />
            <span className="truncate">Tồn {stock} {row.current_stock_milli==null?'':row.unit} / tối thiểu {value('min_stock_milli')} {row.min_stock_unit || row.unit || ''}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">{onHistory&&<CatalogHistoryButton label={String(row.name??row.sku??'')} onClick={()=>onHistory(row)}/>} {canEdit && <div className="flex shrink-0 items-center gap-1"><button type="button" title="Sửa vật tư" disabled={deleting} aria-label={`Sửa ${row.name ?? ''}`} onClick={() => onEdit(row)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"><Pencil size={15} /></button>{row.is_active === 1 && <details className="relative"><summary aria-label={`Thao tác khác ${row.name ?? ''}`} className="flex cursor-pointer list-none rounded p-1 text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={16} /></summary><div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button type="button" disabled={deleting} aria-label={`Xóa ${row.name ?? ''}`} onClick={() => onRemove(row)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={14} />Xóa vật tư</button></div></details>}</div>}</div>
        </div>
      </article>;
    })}
  </div>;
}
