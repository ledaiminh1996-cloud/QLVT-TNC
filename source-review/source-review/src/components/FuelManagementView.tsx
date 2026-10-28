import { searchIncludes, normalizeSearch } from '../../shared/searchText';
import { StatusBadge } from './StatusBadge';
import React, { useState, useMemo } from 'react';
import { 
  Fuel, 
  Truck, 
  Snowflake, 
  Calendar, 
  Search, 
  Download, 
  ArrowUpRight, 
  TrendingUp, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Filter, 
  PlusCircle, 
  FileSpreadsheet 
} from 'lucide-react';
import { InventoryTransaction, Vehicle } from '../types/inventory';
import { formatNumber, formatVND, formatDate, exportToCSV } from '../utils/inventoryUtils';

interface FuelManagementViewProps {
  transactions: InventoryTransaction[];
  vehicles: Vehicle[];
  onOpenNewTxModal: (type: 'IN' | 'OUT', defaultPartId?: string) => void;
  onOpenReceipt: (tx: InventoryTransaction) => void;
}

export const FuelManagementView: React.FC<FuelManagementViewProps> = ({
  transactions,
  vehicles,
  onOpenNewTxModal,
  onOpenReceipt
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTarget, setFilterTarget] = useState<'all' | 'engine' | 'reefer'>('all');
  const [filterTank, setFilterTank] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>('2026-10-31');

  // Filter fuel transactions (part SKU M-DC-TIEU-0020 or name contains "Dầu")
  const fuelTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const isFuelTx = tx.items.some(it => 
        it.sku.includes('M-DC-TIEU-0020') || 
        it.partName.toLowerCase().includes('dầu do') ||
        it.sku.includes('VT-DAU')
      );
      if (!isFuelTx) return false;
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Extract fuel records
  const fuelRecords = useMemo(() => {
    const records: Array<{
      txId: string;
      code: string;
      date: string;
      creator: string;
      driver: string;
      plate: string;
      trailer?: string;
      liters: number;
      amount: number;
      tank: string;
      isReefer: boolean;
      odo?: number;
      note?: string;
      txRef: InventoryTransaction;
    }> = [];

    fuelTransactions.forEach(tx => {
      tx.items.forEach(it => {
        if (it.sku.includes('M-DC-TIEU-0020') || it.partName.toLowerCase().includes('dầu do')) {
          const isReefer = it.partName.includes('Máy Lạnh') || (tx.note?.toLowerCase().includes('máy lạnh') ?? false);
          
          // Match trailer from note
          const trailerMatch = tx.note?.match(/\b([0-9]{2}[A-Z]{1,2}-[0-9]{3}\.[0-9]{2})\b/g);
          const trailer = trailerMatch && trailerMatch.length >= 2 ? trailerMatch[1] : undefined;

          // Match tank
          const tankMatch = tx.note?.match(/(BON[0-9]|KHODAU[0-9]|BỒN\s*[0-9])/i);
          const tank = tankMatch ? tankMatch[0] : (tx.invoiceNumber || 'Bồn Dầu Trung Tâm');

          records.push({
            txId: tx.id,
            code: tx.code,
            date: tx.date,
            creator: tx.creatorName,
            driver: it.vehiclePlate ? (tx.partnerOrReceiver || 'Tài xế') : tx.partnerOrReceiver,
            plate: it.vehiclePlate || 'Xe văn phòng',
            trailer,
            liters: it.quantity,
            amount: it.totalPrice,
            tank,
            isReefer,
            odo: it.vehicleOdoAtMount,
            note: tx.note,
            txRef: tx
          });
        }
      });
    });

    return records;
  }, [fuelTransactions]);

  // Filtered by search and target
  const filteredRecords = useMemo(() => {
    return fuelRecords.filter(r => {
      if (filterTarget === 'engine' && r.isReefer) return false;
      if (filterTarget === 'reefer' && !r.isReefer) return false;
      if (filterTank !== 'all' && !r.tank.toLowerCase().includes(filterTank.toLowerCase())) return false;
      if (searchQuery) {
        const q = normalizeSearch(searchQuery.trim());
        const matchPlate = searchIncludes(r.plate,q);
        const matchDriver = searchIncludes(r.driver,q);
        const matchCode = searchIncludes(r.code,q);
        const matchNote = searchIncludes(r.note,q);
        if (!matchPlate && !matchDriver && !matchCode && !matchNote) return false;
      }
      return true;
    });
  }, [fuelRecords, filterTarget, filterTank, searchQuery]);

  // Totals
  const totalLiters = filteredRecords.reduce((s, r) => s + r.liters, 0);
  const totalAmount = filteredRecords.reduce((s, r) => s + r.amount, 0);
  const engineLiters = filteredRecords.filter(r => !r.isReefer).reduce((s, r) => s + r.liters, 0);
  const reeferLiters = filteredRecords.filter(r => r.isReefer).reduce((s, r) => s + r.liters, 0);

  // Group by tractor to see consumption
  const tractorStats = useMemo(() => {
    const stats = new Map<string, { plate: string; driver: string; totalLiters: number; reeferLiters: number; count: number }>();
    filteredRecords.forEach(r => {
      const cur = stats.get(r.plate) || { plate: r.plate, driver: r.driver, totalLiters: 0, reeferLiters: 0, count: 0 };
      cur.totalLiters += r.liters;
      if (r.isReefer) cur.reeferLiters += r.liters;
      cur.count += 1;
      stats.set(r.plate, cur);
    });
    return Array.from(stats.values()).sort((a, b) => b.totalLiters - a.totalLiters);
  }, [filteredRecords]);

  const handleExportCSV = () => {
    const headers = [
      { key: 'code', label: 'Số Phiếu Xuất' },
      { key: 'date', label: 'Ngày Cấp' },
      { key: 'plate', label: 'Biển Số Đầu Kéo' },
      { key: 'trailer', label: 'Rơ-Moóc Đi Kèm' },
      { key: 'driver', label: 'Tài Xế Nhận' },
      { key: 'target', label: 'Mục Đích Cấp' },
      { key: 'liters', label: 'Số Lượng (Lít)' },
      { key: 'amount', label: 'Thành Tiền (VNĐ)' },
      { key: 'tank', label: 'Bồn Xuất Dầu' },
      { key: 'odo', label: 'Số ODO' },
      { key: 'creator', label: 'Người Lập' },
      { key: 'note', label: 'Diễn Giải Chi Tiết' }
    ];

    const rows = filteredRecords.map(r => ({
      code: r.code,
      date: r.date,
      plate: r.plate,
      trailer: r.trailer || '-',
      driver: r.driver,
      target: r.isReefer ? 'Máy Lạnh Rơ-Moóc' : 'Động Cơ Xe Đầu Kéo',
      liters: r.liters,
      amount: r.amount,
      tank: r.tank,
      odo: r.odo || '-',
      creator: r.creator,
      note: r.note || ''
    }));

    exportToCSV(`Bao_Cao_Xuat_Dau_DO_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Sổ Cấp Phát Nhiên Liệu Dầu DO
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Dữ Liệu Thực Tế
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Theo dõi chi tiết cấp dầu cho Đầu kéo, Máy lạnh Container và Bồn chứa (Bồn 1 &amp; Bồn 2)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Sổ Cấp Dầu (Excel)</span>
            </button>
            <button
              onClick={() => onOpenNewTxModal('OUT', 'part-diesel-0020')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Lập Phiếu Cấp Dầu</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo biển số, tài xế, số phiếu PX..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <select
              value={filterTarget}
              onChange={(e) => setFilterTarget(e.target.value as any)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả mục đích cấp --</option>
              <option value="engine">Động cơ Xe Đầu Kéo ({filteredRecords.filter(r => !r.isReefer).length})</option>
              <option value="reefer">Máy Lạnh Rơ-Moóc ({filteredRecords.filter(r => r.isReefer).length})</option>
            </select>
          </div>

          <div>
            <select
              value={filterTank}
              onChange={(e) => setFilterTank(e.target.value)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả bồn cấp --</option>
              <option value="BON1">Bồn 1</option>
              <option value="BON2">Bồn 2</option>
              <option value="KHODAU6">Kho Dầu 6</option>
              <option value="KHODAU7">Kho Dầu 7</option>
              <option value="KHODAU2">Kho Dầu 2</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-800 border-0 p-0 text-xs cursor-pointer focus:ring-0"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-800 border-0 p-0 text-xs cursor-pointer focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tổng Dầu DO Đã Xuất</span>
            <Fuel className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-sans tabular-nums text-right">
            {formatNumber(totalLiters)} <span className="text-sm font-normal text-slate-500">Lít</span>
          </div>
          <div className="text-xs text-amber-700 mt-1 font-sans tabular-nums text-right font-semibold">
            {formatVND(totalAmount)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Cấp Động Cơ Đầu Kéo</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700 font-sans tabular-nums text-right">
            {formatNumber(engineLiters)} <span className="text-sm font-normal text-slate-500">Lít</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Chiếm {totalLiters > 0 ? Math.round((engineLiters / totalLiters) * 100) : 0}% tổng tiêu hao
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Cấp Máy Lạnh Moóc</span>
            <Snowflake className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-700 font-sans tabular-nums text-right">
            {formatNumber(reeferLiters)} <span className="text-sm font-normal text-slate-500">Lít</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Chuyên chở hàng đông lạnh
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Số Lượt Cấp Phát</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-sans tabular-nums text-right">
            {filteredRecords.length} <span className="text-sm font-normal text-slate-500">phiếu</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Đội xe: {tractorStats.length} đầu kéo
          </div>
        </div>
      </div>

      {/* Main Split: Left Fuel Issue Table, Right Tractor Consumption Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Detail Ledger (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Nhật Ký Cấp Dầu Chi Tiết ({filteredRecords.length} phiếu PX)
            </h3>
            <span className="text-xs text-slate-500">
              Cập nhật từ hệ thống quản lý kho
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">Số Phiếu</th>
                    <th className="py-2.5 px-2 text-center">Ngày</th>
                    <th className="py-2.5 px-3">Xe Đầu Kéo</th>
                    <th className="py-2.5 px-3">Tài Xế</th>
                    <th className="py-2.5 px-2 text-center">Mục Đích</th>
                    <th className="py-2.5 px-2 text-right">Số Lượng</th>
                    <th className="py-2.5 px-3">Bồn Xuất</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-2 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                        {r.code}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-500 font-sans text-[11px]">
                        {formatDate(r.date)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900">
                          {r.plate}
                        </div>
                        {r.trailer && (
                          <div className="text-[10px] text-slate-500">
                            Moóc: <span className="text-slate-700 font-mono">{r.trailer}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {r.driver}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Lập: {r.creator}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {r.isReefer ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                            <Snowflake className="w-3 h-3" /> Máy Lạnh
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Truck className="w-3 h-3" /> Động Cơ
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-slate-900">
                        {formatNumber(r.liters)} L
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">
                        {r.tank}
                      </td>
                      <td className="py-2.5 px-3"><StatusBadge value={r.txRef.status} /></td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => onOpenReceipt(r.txRef)}
                          className="text-blue-600 hover:text-blue-700 text-[11px] font-semibold hover:underline cursor-pointer"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Vehicle Consumption Ranking (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>Tiêu Thụ Dầu Theo Xe</span>
            </h3>
            <span className="text-xs text-slate-500 font-sans tabular-nums text-right">
              Top {tractorStats.length} xe
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-[600px] overflow-y-auto space-y-2 shadow-xs">
            {tractorStats.map((item, idx) => (
              <div 
                key={item.plate} 
                className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {item.plate}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 pl-7">
                      Tài xế: <span className="text-slate-800 font-medium">{item.driver}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-sans tabular-nums text-right text-amber-700">
                      {formatNumber(item.totalLiters)} L
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {item.count} lần cấp
                    </div>
                  </div>
                </div>

                {item.reeferLiters > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-cyan-700 pl-7">
                    <span>Có máy lạnh:</span>
                    <span className="font-sans tabular-nums text-right font-semibold">{formatNumber(item.reeferLiters)} L</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
