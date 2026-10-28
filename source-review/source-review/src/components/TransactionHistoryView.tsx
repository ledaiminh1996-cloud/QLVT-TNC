import { searchIncludes, normalizeSearch } from '../../shared/searchText';
import { MenuIcon } from './MenuIcon';
import { StatusBadge } from './StatusBadge';
import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  ArrowDownRight, 
  ArrowUpRight, 
  Printer, 
  PlusCircle, 
  Calendar, 
  Truck, 
  Package 
} from 'lucide-react';
import { InventoryTransaction } from '../types/inventory';
import { formatVND, formatNumber, formatDate } from '../utils/inventoryUtils';

interface TransactionHistoryViewProps {
  transactions: InventoryTransaction[];
  onOpenReceipt: (tx: InventoryTransaction) => void;
  onOpenNewTxModal: (type: 'IN' | 'OUT') => void;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  transactions,
  onOpenReceipt,
  onOpenNewTxModal
}) => {
  const [filterType, setFilterType] = useState<'all' | 'IN' | 'OUT'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTxs = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery) {
      const q = normalizeSearch(searchQuery.trim());
      const matchCode = searchIncludes(tx.code,q);
      const matchPartner = searchIncludes(tx.partnerOrReceiver,q);
      const matchItem = tx.items.some(i => searchIncludes(i.partName,q) || searchIncludes(i.sku,q) || (i.vehiclePlate && searchIncludes(i.vehiclePlate,q)));
      if (!matchCode && !matchPartner && !matchItem) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
              <MenuIcon menuId="td_xem_phieu" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Nhật Ký Phiếu Nhập &amp; Xuất Kho Phụ Tùng
              </h2>
              <p className="text-xs text-slate-500">
                Toàn bộ chứng từ nhập xuất có giá trị pháp lý kế toán và hồ sơ bảo dưỡng phương tiện
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenNewTxModal('IN')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Lập Phiếu Nhập</span>
            </button>
            <button
              onClick={() => onOpenNewTxModal('OUT')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>- Lập Phiếu Xuất Xe</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo số phiếu, tên nhà cung cấp, biển số xe, tên phụ tùng..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tất cả ({transactions.length})
            </button>
            <button
              onClick={() => setFilterType('IN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === 'IN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Phiếu Nhập PNK ({transactions.filter(t => t.type === 'IN').length})
            </button>
            <button
              onClick={() => setFilterType('OUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === 'OUT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Phiếu Xuất PXK ({transactions.filter(t => t.type === 'OUT').length})
            </button>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                <th className="py-3 px-3">Loại</th>
                <th className="py-3 px-3">Số Chứng Từ</th>
                <th className="py-3 px-2 text-center">Ngày Lập</th>
                <th className="py-3 px-3">Đối Tác / Người Nhận</th>
                <th className="py-3 px-3">Phục Vụ Xe</th>
                <th className="py-3 px-2 text-right">Số Mặt Hàng</th>
                <th className="py-3 px-3 text-right">Tổng Tiền (VNĐ)</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    Không có chứng từ nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredTxs.map(tx => {
                  const isImport = tx.type === 'IN';
                  const vehiclePlate = tx.items.find(i => i.vehiclePlate)?.vehiclePlate;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isImport 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {isImport ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {isImport ? 'NHẬP KHO' : 'XUẤT XE'}
                        </span>
                      </td>

                      {/* Code */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-xs">
                        {tx.code}
                        {tx.invoiceNumber && (
                          <div className="font-sans text-[10px] text-slate-500 font-normal">
                            HĐ: <span className="font-mono">{tx.invoiceNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-2 text-center text-slate-500 font-sans text-[11px]">
                        {formatDate(tx.date)}
                      </td>

                      {/* Partner */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {tx.partnerOrReceiver}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Thủ kho: {tx.creatorName}
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="py-3 px-3">
                        {vehiclePlate ? (
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-amber-700 border border-slate-300">
                            {vehiclePlate}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Items Count */}
                      <td className="py-3 px-2 font-sans tabular-nums text-right text-slate-600">
                        {tx.items.length} mặt hàng
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-right font-sans tabular-nums font-bold text-amber-700 text-xs">
                        {formatVND(tx.totalAmount)}
                      </td>

                      <td className="py-3 px-3"><StatusBadge value={tx.status} /></td>
                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onOpenReceipt(tx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer border border-slate-200"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>Xem &amp; In</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
