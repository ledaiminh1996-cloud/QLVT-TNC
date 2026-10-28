import React from 'react';
import { X, History, ArrowDownRight, ArrowUpRight, Printer, Download, Truck } from 'lucide-react';
import { SparePart, InventoryTransaction, TransactionType } from '../types/inventory';
import { formatNumber, formatDate, formatVND, exportToCSV } from '../utils/inventoryUtils';

interface PartStockCardModalProps {
  part: SparePart | null;
  transactions: InventoryTransaction[];
  onClose: () => void;
  onOpenReceipt: (tx: InventoryTransaction) => void;
}

export const PartStockCardModal: React.FC<PartStockCardModalProps> = ({
  part,
  transactions,
  onClose,
  onOpenReceipt
}) => {
  if (!part) return null;

  // Filter transactions involving this part, ordered by date ascending for stock card
  const historyEntries: Array<{
    date: string;
    code: string;
    type: TransactionType;
    partnerOrReceiver: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vehiclePlate?: string;
    vehicleOdo?: number;
    mountPosition?: string;
    note?: string;
    txRef: InventoryTransaction;
  }> = [];

  transactions.forEach(tx => {
    tx.items.forEach(it => {
      if (it.partId === part.id) {
        historyEntries.push({
          date: tx.date,
          code: tx.code,
          type: tx.type,
          partnerOrReceiver: tx.partnerOrReceiver,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          vehiclePlate: it.vehiclePlate,
          vehicleOdo: it.vehicleOdoAtMount,
          mountPosition: it.mountPosition,
          note: tx.note,
          txRef: tx
        });
      }
    });
  });

  // Sort ascending by date
  historyEntries.sort((a, b) => a.date.localeCompare(b.date));

  // Compute progressive running stock
  const totalIn = historyEntries.filter(h => h.type === 'IN').reduce((s, h) => s + h.quantity, 0);
  const totalOut = historyEntries.filter(h => h.type === 'OUT').reduce((s, h) => s + h.quantity, 0);
  const initialStock = Math.max(0, part.currentStock - totalIn + totalOut);

  let running = initialStock;
  const computedEntries = historyEntries.map(entry => {
    if (entry.type === 'IN') {
      running += entry.quantity;
    } else {
      running -= entry.quantity;
    }
    return {
      ...entry,
      balanceAfter: running
    };
  });

  const handleExportStockCard = () => {
    const headers = [
      { key: 'date', label: 'Ngày Tháng' },
      { key: 'code', label: 'Số Chứng Từ' },
      { key: 'partner', label: 'Diễn Giải / Đối Tác' },
      { key: 'vehiclePlate', label: 'Biển Số Xe Nhận' },
      { key: 'inQty', label: 'Số Lượng Nhập' },
      { key: 'outQty', label: 'Số Lượng Xuất' },
      { key: 'balance', label: 'Tồn Sau Giao Dịch' }
    ];

    const rows = computedEntries.map(e => ({
      date: e.date,
      code: e.code,
      partner: e.partnerOrReceiver,
      vehiclePlate: e.vehiclePlate || '-',
      inQty: e.type === 'IN' ? e.quantity : '',
      outQty: e.type === 'OUT' ? e.quantity : '',
      balance: e.balanceAfter
    }));

    exportToCSV(`The_Kho_${part.sku}_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Thẻ Kho Chi Tiết Vật Tư (Stock Ledger Card)
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {part.sku}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lịch sử biến động Xuất - Nhập - Tồn theo ngày và phương tiện sử dụng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportStockCard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Thẻ Kho</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Part Info Banner */}
        <div className="p-4 sm:p-6 bg-slate-50/60 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Tên phụ tùng:</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{part.name}</div>
            <div className="text-[11px] text-slate-500">{part.specifications}</div>
          </div>

          <div>
            <span className="text-slate-500">Đơn vị &amp; Vị trí:</span>
            <div className="font-bold text-slate-800 mt-0.5">ĐVT: {part.unit}</div>
            <div className="text-[11px] text-slate-500">Vị trí: {part.storageLocation}</div>
          </div>

          <div>
            <span className="text-slate-500">Định mức kỹ thuật:</span>
            <div className="font-bold text-slate-800 mt-0.5">
              {part.lifespanKmLimit ? `${formatNumber(part.lifespanKmLimit)} KM` : 'Theo thực tế'}
            </div>
            <div className="text-[11px] text-slate-500">
              {part.lifespanDaysLimit ? `${part.lifespanDaysLimit} ngày` : ''}
            </div>
          </div>

          <div className="text-right">
            <span className="text-slate-500">Tồn kho hiện tại:</span>
            <div className="font-black text-lg text-amber-600 font-sans tabular-nums text-right mt-0.5">
              {formatNumber(part.currentStock)} {part.unit}
            </div>
            <div className="text-[11px] text-slate-500">
              Mức an toàn: {part.minStock} {part.unit}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden border-collapse bg-white shadow-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Ngày</th>
                <th className="py-2.5 px-3">Số Phiếu</th>
                <th className="py-2.5 px-3">Diễn Giải / Nhà Cung Cấp / Xe</th>
                <th className="py-2.5 px-2 text-right text-emerald-700">SL Nhập</th>
                <th className="py-2.5 px-2 text-right text-blue-700">SL Xuất</th>
                <th className="py-2.5 px-2 text-right text-slate-900 font-bold">Tồn Sau</th>
                <th className="py-2.5 px-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* Row for Opening Balance */}
              <tr className="bg-slate-50 italic text-slate-500">
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 font-sans font-bold text-slate-600">ĐẦU KỲ</td>
                <td className="py-2 px-3">Số dư tồn kho đầu kỳ</td>
                <td className="py-2 px-2 text-right">-</td>
                <td className="py-2 px-2 text-right">-</td>
                <td className="py-2 px-2 text-right font-sans tabular-nums font-bold text-slate-900">
                  {formatNumber(initialStock)}
                </td>
                <td className="py-2 px-3 text-center">-</td>
              </tr>

              {computedEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Chưa có giao dịch phát sinh nào cho mã phụ tùng này.
                  </td>
                </tr>
              ) : (
                computedEntries.map((e, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-sans text-[11px] text-slate-600">
                      {formatDate(e.date)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                      {e.code}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">
                        {e.partnerOrReceiver}
                      </div>
                      {e.vehiclePlate && (
                        <div className="text-[11px] text-blue-700 flex items-center gap-1.5 mt-0.5">
                          <Truck className="w-3 h-3 text-blue-600" />
                          <span>Lắp xe: <strong>{e.vehiclePlate}</strong> ({e.mountPosition || 'Bộ phận'})</span>
                          {e.vehicleOdo && <span>@ {formatNumber(e.vehicleOdo)} KM</span>}
                        </div>
                      )}
                      {e.note && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                          {e.note}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-emerald-700">
                      {e.type === 'IN' ? `+${e.quantity}` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-blue-700">
                      {e.type === 'OUT' ? `-${e.quantity}` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-sans tabular-nums font-black text-slate-900">
                      {formatNumber(e.balanceAfter)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onOpenReceipt(e.txRef)}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold hover:underline cursor-pointer"
                      >
                        Xem phiếu
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
