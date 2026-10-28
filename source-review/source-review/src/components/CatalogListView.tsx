import { searchIncludes, normalizeSearch } from '../../shared/searchText';
import { StatusBadge } from './StatusBadge';
import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Trash2, 
  Download, 
  Upload 
} from 'lucide-react';
import { SparePart, PartCategory } from '../types/inventory';
import { formatVND, formatNumber, getStockStatus, exportToCSV } from '../utils/inventoryUtils';
import { CATEGORY_LABELS } from '../data/initialData';

interface CatalogListViewProps {
  parts: SparePart[];
  onOpenNewPartModal: () => void;
  onEditPart: (part: SparePart) => void;
  onDeletePart: (partId: string) => void;
  onOpenStockCard: (part: SparePart) => void;
  onOpenNewTxModal: (type: 'IN' | 'OUT', partId?: string) => void;
  onImportParts?: (imported: SparePart[]) => void;
}

export const CatalogListView: React.FC<CatalogListViewProps> = ({
  parts,
  onOpenNewPartModal,
  onEditPart,
  onDeletePart,
  onOpenStockCard,
  onOpenNewTxModal,
  onImportParts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<string>('all');

  const filteredParts = parts.filter(p => {
    if (selectedCat !== 'all' && p.category !== selectedCat) return false;
    if (selectedApp !== 'all' && p.applicableFor !== selectedApp) return false;
    if (searchQuery) {
      const q = normalizeSearch(searchQuery.trim());
      if (!searchIncludes(p.name,q) &&
          !searchIncludes(p.sku,q) &&
          !searchIncludes(p.specifications,q) &&
          !searchIncludes(p.storageLocation,q)) {
        return false;
      }
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = [
      { key: 'sku', label: 'Mã Vật Tư' },
      { key: 'name', label: 'Tên Phụ Tùng / Vật Tư' },
      { key: 'category', label: 'Nhóm Danh Mục' },
      { key: 'unit', label: 'ĐVT' },
      { key: 'applicableFor', label: 'Áp Dụng Cho' },
      { key: 'specifications', label: 'Quy Cách Kỹ Thuật' },
      { key: 'storageLocation', label: 'Vị Trí Kho' },
      { key: 'currentStock', label: 'Tồn Kho Hiện Tại' },
      { key: 'minStock', label: 'Tồn Tối Thiểu' },
      { key: 'avgCostPrice', label: 'Đơn Giá Vốn (VNĐ)' },
      { key: 'lifespanKmLimit', label: 'Định Mức KM' },
      { key: 'lifespanDaysLimit', label: 'Tuổi Thọ Ngày' }
    ];

    exportToCSV(`Danh_Muc_Vat_Tu_Thiet_Bi_${new Date().toISOString().slice(0, 10)}`, filteredParts, headers);
  };

  const handleImportRows = (rows: Record<string, string>[]) => {
    if (!onImportParts) return;

    const imported: SparePart[] = rows.map((r, i) => ({
      id: `part-imp-${Date.now()}-${i}`,
      sku: r['Mã Vật Tư'] || r['sku'] || `VT-${Date.now()}-${i}`,
      name: r['Tên Phụ Tùng / Vật Tư'] || r['name'] || 'Vật tư mới',
      category: (r['category'] as PartCategory) || 'lubricants',
      unit: r['ĐVT'] || r['unit'] || 'Cái',
      applicableFor: (r['applicableFor'] as any) || 'both',
      specifications: r['Quy Cách Kỹ Thuật'] || r['specifications'] || '',
      storageLocation: r['Vị Trí Kho'] || r['storageLocation'] || 'Kho VT-TB',
      currentStock: Number(r['Tồn Kho Hiện Tại'] || r['currentStock']) || 0,
      minStock: Number(r['Tồn Tối Thiểu'] || r['minStock']) || 4,
      avgCostPrice: Number(r['Đơn Giá Vốn (VNĐ)'] || r['avgCostPrice']) || 500000,
      lifespanKmLimit: Number(r['Định Mức KM']) || undefined,
      lifespanDaysLimit: Number(r['Tuổi Thọ Ngày']) || undefined
    }));

    onImportParts(imported);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Danh Mục Vật Tư - Thiết Bị (VT-TB)
              </h2>
              <p className="text-xs text-slate-500">
                Thêm mới, sửa, xóa, Import/Export Excel phụ tùng, vật tư xe đầu kéo &amp; rơ-moóc
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenNewPartModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm VT-TB</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã VT, tên phụ tùng, vị trí..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả nhóm phụ tùng ({parts.length}) --</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả loại xe --</option>
              <option value="tractor">Chuyên Xe Đầu Kéo</option>
              <option value="trailer">Chuyên Rơ-Moóc</option>
              <option value="both">Dùng chung (Cả 2 loại)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Parts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredParts.map(part => {
          const status = getStockStatus(part);
          const isLow = status.status !== 'normal';

          return (
            <div
              key={part.id}
              className={`bg-white border rounded-xl p-4 flex flex-col justify-between shadow-xs transition hover:border-slate-300 ${
                isLow ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-amber-700">
                    {part.sku}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    part.applicableFor === 'tractor' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    part.applicableFor === 'trailer' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}>
                    {part.applicableFor === 'tractor' ? 'Đầu Kéo' : part.applicableFor === 'trailer' ? 'Rơ-Moóc' : 'Cả hai'}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-800 mt-1.5 line-clamp-2">
                  {part.name}
                </h3>

                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {part.specifications}
                </p>

                <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Định mức KM:</span>
                    <div className="font-semibold text-slate-800 font-sans tabular-nums text-right">
                      {part.lifespanKmLimit ? `${formatNumber(part.lifespanKmLimit)} KM` : '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tuổi thọ ngày:</span>
                    <div className="font-semibold text-slate-800 font-sans tabular-nums text-right">
                      {part.lifespanDaysLimit ? `${part.lifespanDaysLimit} ngày` : '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Tồn kho hiện tại:</span>
                    <div className={`font-bold font-sans tabular-nums text-right text-sm ${isLow ? 'text-amber-700' : 'text-slate-900'}`}>
                      {formatNumber(part.currentStock)} {part.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Tồn tối thiểu:</span>
                    <div className="font-sans tabular-nums text-right text-slate-700 font-medium">
                      {part.minStock} {part.unit}
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <StatusBadge label={status.label} tone={isLow ? 'warning' : 'success'} />
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs font-sans tabular-nums text-right text-slate-600 font-semibold">
                  {formatVND(part.avgCostPrice)}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenStockCard(part)}
                    title="Xem thẻ kho"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onEditPart(part)}
                    title="Chỉnh sửa định mức & thông số"
                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition cursor-pointer border border-amber-200"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeletePart(part.id)}
                    title="Xóa phụ tùng"
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenNewTxModal('IN', part.id)}
                    title="Nhập thêm hàng"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition cursor-pointer shadow-xs"
                  >
                    + Nhập
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
