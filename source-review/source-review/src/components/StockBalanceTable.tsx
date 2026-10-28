import { searchIncludes } from '../../shared/searchText';
import { StatusBadge } from './StatusBadge';
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  ArrowDownRight, 
  ArrowUpRight, 
  Package, 
  SlidersHorizontal, 
  ChevronDown, 
  PlusCircle, 
  ExternalLink, 
  Layers, 
  History 
} from 'lucide-react';
import { SparePart, InventoryTransaction } from '../types/inventory';
import { 
  computeInventoryBalance, 
  formatVND, 
  formatNumber, 
  exportToCSV, 
  getStockStatus 
} from '../utils/inventoryUtils';
import { CATEGORY_LABELS } from '../data/initialData';

interface StockBalanceTableProps {
  parts: SparePart[];
  transactions: InventoryTransaction[];
  onOpenNewTxModal: (type: 'IN' | 'OUT', defaultPartId?: string) => void;
  onOpenPartHistory: (part: SparePart) => void;
}

export const StockBalanceTable: React.FC<StockBalanceTableProps> = ({
  parts,
  transactions,
  onOpenNewTxModal,
  onOpenPartHistory
}) => {
  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedApplicable, setSelectedApplicable] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'low' | 'out' | 'normal'>('all');
  
  // Lọc theo khoảng ngày (Mặc định quý hiện tại hoặc cả năm 2026)
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-12-31');

  // Tính toán bảng cân đối Xuất - Nhập - Tồn
  const balanceRows = useMemo(() => {
    return computeInventoryBalance(parts, transactions, startDate, endDate);
  }, [parts, transactions, startDate, endDate]);

  // Áp dụng bộ lọc tìm kiếm
  const filteredRows = useMemo(() => {
    return balanceRows.filter(row => {
      // Tìm kiếm theo tên hoặc mã SKU
      const matchesSearch = 
        searchIncludes(row.name,searchQuery) ||
        searchIncludes(row.sku,searchQuery) ||
        searchIncludes(row.specifications,searchQuery) ||
        searchIncludes(row.storageLocation,searchQuery);

      if (!matchesSearch) return false;

      // Lọc danh mục
      if (selectedCategory !== 'all' && row.category !== selectedCategory) {
        return false;
      }

      // Lọc dùng cho xe
      const part = parts.find(p => p.id === row.partId);
      if (selectedApplicable !== 'all' && part?.applicableFor !== selectedApplicable) {
        return false;
      }

      // Lọc trạng thái tồn kho
      if (selectedStatus === 'low' && row.stockStatus === 'normal') return false;
      if (selectedStatus === 'out' && row.closingStock > 0) return false;
      if (selectedStatus === 'normal' && row.stockStatus !== 'normal') return false;

      return true;
    });
  }, [balanceRows, searchQuery, selectedCategory, selectedApplicable, selectedStatus, parts]);

  // Tổng cộng
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.openingAmount += row.openingStock * (parts.find(p => p.id === row.partId)?.avgCostPrice || 0);
        acc.inQty += row.inQty;
        acc.inAmount += row.inAmount;
        acc.outQty += row.outQty;
        acc.outAmount += row.outAmount;
        acc.closingQty += row.closingStock;
        acc.closingAmount += row.closingAmount;
        return acc;
      },
      {
        openingAmount: 0,
        inQty: 0,
        inAmount: 0,
        outQty: 0,
        outAmount: 0,
        closingQty: 0,
        closingAmount: 0
      }
    );
  }, [filteredRows, parts]);

  // Xuất file CSV báo cáo Xuất Nhập Tồn
  const handleExportCSV = () => {
    const exportHeaders = [
      { key: 'sku', label: 'Mã Vật Tư' },
      { key: 'name', label: 'Tên Phụ Tùng / Vật Tư' },
      { key: 'unit', label: 'ĐVT' },
      { key: 'specifications', label: 'Quy Cách Chi Tiết' },
      { key: 'storageLocation', label: 'Vị Trí Kho' },
      { key: 'minStock', label: 'Tồn An Toàn Tối Thiểu' },
      { key: 'openingStock', label: 'Tồn Đầu Kỳ' },
      { key: 'inQty', label: 'Nhập Trong Kỳ' },
      { key: 'inAmount', label: 'Giá Trị Nhập (VNĐ)' },
      { key: 'outQty', label: 'Xuất Trong Kỳ' },
      { key: 'outAmount', label: 'Giá Trị Xuất (VNĐ)' },
      { key: 'closingStock', label: 'Tồn Cuối Kỳ' },
      { key: 'closingAmount', label: 'Giá Trị Tồn Cuối (VNĐ)' },
      { key: 'stockStatus', label: 'Trạng Thái Tồn Kho' }
    ];

    exportToCSV(`So_Xuat_Nhap_Ton_${new Date().toISOString().slice(0, 10)}`, filteredRows, exportHeaders);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner & Period Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Bảng Tổng Hợp Xuất - Nhập - Tồn Vật Tư Xe Đầu Kéo & Rơ-Moóc
                </h2>
                <p className="text-xs text-slate-500">
                  Chuẩn kế toán quản trị kho vận tải. Tự động cảnh báo mức tồn an toàn và định mức bảo dưỡng.
                </p>
              </div>
            </div>
          </div>

          {/* Date range picker & Export button */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Kỳ:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-slate-800 border-0 focus:ring-0 p-0 text-xs cursor-pointer"
              />
              <span className="text-slate-400">đến</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-slate-800 border-0 focus:ring-0 p-0 text-xs cursor-pointer"
              />
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel (.CSV)</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
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

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả nhóm phụ tùng --</option>
              {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Vehicle Type Filter */}
          <div>
            <select
              value={selectedApplicable}
              onChange={(e) => setSelectedApplicable(e.target.value)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Áp dụng cho phương tiện --</option>
              <option value="tractor">Chuyên Xe Đầu Kéo</option>
              <option value="trailer">Chuyên Rơ-Moóc</option>
              <option value="both">Dùng chung (Cả 2 loại)</option>
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả trạng thái tồn --</option>
              <option value="low">Cảnh báo thiếu (Tồn &le; Tối thiểu)</option>
              <option value="out">Đã hết sạch (Tồn = 0)</option>
              <option value="normal">Đủ mức an toàn</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-slate-500">Tổng nhập trong kỳ</span>
          <div className="font-bold text-sm text-emerald-700 mt-0.5">
            +{formatNumber(totals.inQty)} cái/vật tư
          </div>
          <div className="text-[11px] text-slate-500 font-sans tabular-nums text-right">
            {formatVND(totals.inAmount)}
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-slate-500">Tổng xuất thay xe trong kỳ</span>
          <div className="font-bold text-sm text-blue-700 mt-0.5">
            -{formatNumber(totals.outQty)} cái/vật tư
          </div>
          <div className="text-[11px] text-slate-500 font-sans tabular-nums text-right">
            {formatVND(totals.outAmount)}
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-slate-500">Tổng tồn hiện tại</span>
          <div className="font-bold text-sm text-slate-900 mt-0.5">
            {formatNumber(totals.closingQty)} đơn vị tồn
          </div>
          <div className="text-[11px] text-slate-500 font-sans tabular-nums text-right">
            {filteredRows.length} mặt hàng hiển thị
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-slate-500">Giá trị tồn kho cuối kỳ</span>
          <div className="font-bold text-sm text-amber-700 mt-0.5">
            {formatVND(totals.closingAmount)}
          </div>
          <div className="text-[11px] text-slate-400">
            Tính theo giá vốn bình quân
          </div>
        </div>
      </div>

      {/* Main Standard Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                <th rowSpan={2} className="py-3 px-3 text-center w-12 border-r border-slate-200">STT</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 min-w-[130px]">Mã VT (SKU)</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 min-w-[220px]">Tên Phụ Tùng / Quy Cách</th>
                <th rowSpan={2} className="py-3 px-2 text-center border-r border-slate-200 w-16">ĐVT</th>
                <th rowSpan={2} className="py-3 px-2 text-center border-r border-slate-200 w-24">Dùng Cho</th>
                <th colSpan={1} className="py-2 px-3 text-center border-r border-slate-200 bg-slate-100 text-slate-700">Tồn Đầu</th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-emerald-50 text-emerald-800">Nhập Trong Kỳ</th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-blue-50 text-blue-800">Xuất Trong Kỳ</th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-amber-50 text-amber-800">Tồn Cuối Kỳ</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 min-w-[150px]">Cảnh Báo Tồn Kho</th>
                <th rowSpan={2} className="py-3 px-3 text-right border-r border-slate-200 min-w-[120px]">Định Mức KM / Ngày</th>
                <th rowSpan={2} className="py-3 px-3 text-center min-w-[130px]">Thao Tác</th>
              </tr>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] font-semibold">
                <th className="py-1 px-2 text-right border-r border-slate-200">SL</th>
                <th className="py-1 px-2 text-right border-r border-slate-200">SL</th>
                <th className="py-1 px-2 text-right border-r border-slate-200">Thành Tiền</th>
                <th className="py-1 px-2 text-right border-r border-slate-200">SL</th>
                <th className="py-1 px-2 text-right border-r border-slate-200">Thành Tiền</th>
                <th className="py-1 px-2 text-right border-r border-slate-200 font-bold text-amber-800">SL</th>
                <th className="py-1 px-2 text-right border-r border-slate-200 font-bold text-amber-800">Giá Trị</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 text-xs">
                    Không tìm thấy phụ tùng hoặc vật tư nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const part = parts.find(p => p.id === row.partId);
                  const isLow = row.stockStatus !== 'normal';
                  const isZero = row.closingStock <= 0;

                  return (
                    <tr 
                      key={row.partId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isZero ? 'bg-rose-50/40' : isLow ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* STT */}
                      <td className="py-2.5 px-3 text-slate-500 font-sans tabular-nums text-right text-[11px] border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* SKU */}
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700 border-r border-slate-200 whitespace-nowrap">
                        {row.sku}
                      </td>

                      {/* Tên & quy cách */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-900 hover:text-amber-700 cursor-pointer" onClick={() => part && onOpenPartHistory(part)}>
                          {row.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[260px]">
                          {row.specifications}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Kho: {row.storageLocation}
                        </div>
                      </td>

                      {/* ĐVT */}
                      <td className="py-2.5 px-2 text-center text-slate-600 border-r border-slate-200">
                        {row.unit}
                      </td>

                      {/* Dùng cho */}
                      <td className="py-2.5 px-2 text-center border-r border-slate-200">
                        {part?.applicableFor === 'tractor' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Đầu kéo
                          </span>
                        ) : part?.applicableFor === 'trailer' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Rơ-moóc
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Cả hai
                          </span>
                        )}
                      </td>

                      {/* Tồn đầu */}
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums border-r border-slate-200 text-slate-500">
                        {formatNumber(row.openingStock)}
                      </td>

                      {/* Nhập trong kỳ */}
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums border-r border-slate-200 text-emerald-700 font-bold">
                        {row.inQty > 0 ? `+${formatNumber(row.inQty)}` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums text-[11px] border-r border-slate-200 text-slate-500">
                        {row.inAmount > 0 ? formatVND(row.inAmount) : '-'}
                      </td>

                      {/* Xuất trong kỳ */}
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums border-r border-slate-200 text-blue-700 font-bold">
                        {row.outQty > 0 ? `-${formatNumber(row.outQty)}` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums text-[11px] border-r border-slate-200 text-slate-500">
                        {row.outAmount > 0 ? formatVND(row.outAmount) : '-'}
                      </td>

                      {/* Tồn cuối kỳ */}
                      <td className={`py-2.5 px-2 text-right font-sans tabular-nums font-bold border-r border-slate-200 ${
                        isZero ? 'text-rose-700 font-black' : isLow ? 'text-amber-700' : 'text-slate-900'
                      }`}>
                        {formatNumber(row.closingStock)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums font-semibold border-r border-slate-200 text-slate-800">
                        {formatVND(row.closingAmount)}
                      </td>

                      {/* Cảnh báo tồn kho */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge label={(isZero ? 'Hết' : isLow ? 'Thiếu' : 'An toàn') + ' (Min: ' + row.minStock + ')'} tone={isZero ? 'danger' : isLow ? 'warning' : 'success'} />
                        </div>
                        {row.suggestedReorder > 0 && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                            Cần đặt: +{row.suggestedReorder} {row.unit}
                          </div>
                        )}
                      </td>

                      {/* Định mức KM / Ngày */}
                      <td className="py-2.5 px-3 text-right tabular-nums border-r border-slate-200 text-[11px]">
                        {part?.lifespanKmLimit ? (
                          <div className="font-semibold text-slate-800 font-sans tabular-nums text-right">
                            {formatNumber(part.lifespanKmLimit)} KM
                          </div>
                        ) : null}
                        {part?.lifespanDaysLimit ? (
                          <div className="text-slate-500 text-[10px]">
                            {part.lifespanDaysLimit} ngày ({Math.round(part.lifespanDaysLimit / 30)} tháng)
                          </div>
                        ) : null}
                        {!part?.lifespanKmLimit && !part?.lifespanDaysLimit && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenNewTxModal('IN', row.partId)}
                            title="Tạo phiếu nhập hàng"
                            className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenNewTxModal('OUT', row.partId)}
                            title="Tạo phiếu xuất thay thế xe"
                            className="p-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => part && onOpenPartHistory(part)}
                            title="Xem thẻ kho chi tiết"
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Footer Row */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
                  <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-amber-800 border-r border-slate-200">
                    TỔNG CỘNG ({filteredRows.length} mặt hàng):
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-slate-500">
                    -
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-emerald-700">
                    +{formatNumber(totals.inQty)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-emerald-700 text-[11px]">
                    {formatVND(totals.inAmount)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-blue-700">
                    -{formatNumber(totals.outQty)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-blue-700 text-[11px]">
                    {formatVND(totals.outAmount)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-amber-800">
                    {formatNumber(totals.closingQty)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 font-sans tabular-nums text-amber-800">
                    {formatVND(totals.closingAmount)}
                  </td>
                  <td colSpan={3} className="py-3 px-3 text-slate-500 text-[11px] font-normal italic">
                    Dữ liệu được cập nhật theo thời gian thực
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
