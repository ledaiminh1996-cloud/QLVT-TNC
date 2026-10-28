import { StatusBadge } from './StatusBadge';
import React from 'react';
import { X, Printer, Download, Check, Truck, Package } from 'lucide-react';
import { InventoryTransaction } from '../types/inventory';
import { formatVND, formatNumber, formatDate } from '../utils/inventoryUtils';

interface TransactionReceiptModalProps {
  transaction: InventoryTransaction | null;
  onClose: () => void;
}

export const TransactionReceiptModal: React.FC<TransactionReceiptModalProps> = ({
  transaction,
  onClose
}) => {
  if (!transaction) return null;

  const isImport = transaction.type === 'IN';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6">
        {/* Modal Controls Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-900">Xem Mẫu Phiếu In:</span>
            <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
              {transaction.code}
            </span>
            <StatusBadge value={transaction.status} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 printable-area font-sans">
          {/* Document Header - No internal company logo or Kho Nghi Sơn */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight">
                HỆ THỐNG QUẢN LÝ VẬT TƯ
              </h2>
              <p className="text-xs text-slate-600 font-medium">Bộ Phận Quản Lý Vật Tư - Thiết Bị Vận Tải</p>
              <p className="text-[11px] text-slate-500">Trạm Dịch Vụ Kỹ Thuật &amp; Kho Phụ Tùng Trung Tâm</p>
            </div>
            <div className="text-right text-xs">
              <div className="font-bold text-slate-800">
                Mẫu số: 0{isImport ? '1' : '2'} - VT
              </div>
              <p className="text-[10px] text-slate-500">(Ban hành theo TT 200/2014/TT-BTC)</p>
              <div className="mt-1 font-bold text-slate-900">
                Số: <span className="font-mono">{transaction.code}</span>
              </div>
            </div>
          </div>

          {/* Form Title */}
          <div className="text-center my-6">
            <h1 className="text-xl font-black uppercase text-slate-950 tracking-wider">
              {isImport ? 'PHIẾU NHẬP KHO VẬT TƯ' : 'PHIẾU XUẤT KHO THAY THẾ PHƯƠNG TIỆN'}
            </h1>
            <p className="text-xs text-slate-600 italic mt-0.5">
              Ngày lập phiếu: {formatDate(transaction.date)}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-800 mb-6">
            <div>
              <span className="font-semibold text-slate-600">
                {isImport ? 'Họ tên người giao / NCC: ' : 'Họ tên người nhận / Thợ: '}
              </span>
              <span className="font-bold">{transaction.partnerOrReceiver}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">Người lập / Thủ kho: </span>
              <span className="font-bold">{transaction.creatorName}</span>
            </div>

            {transaction.invoiceNumber && (
              <div>
                <span className="font-semibold text-slate-600">Số hóa đơn / Chứng từ: </span>
                <span className="font-mono">{transaction.invoiceNumber}</span>
              </div>
            )}

            {/* If vehicle is specified */}
            {transaction.items[0]?.vehiclePlate && (
              <div className="col-span-2 p-2 bg-slate-50 rounded border border-slate-200">
                <span className="font-bold text-blue-900">Phục vụ phương tiện: </span>
                <span className="font-black text-slate-900 font-mono text-sm mr-4">
                  {transaction.items[0].vehiclePlate}
                </span>
                {transaction.items[0].vehicleOdoAtMount && (
                  <span className="text-slate-700">
                    (Số ODO: <strong>{formatNumber(transaction.items[0].vehicleOdoAtMount)} KM</strong>)
                  </span>
                )}
                {transaction.items[0].mountPosition && (
                  <span className="ml-3 text-slate-600">
                    - Vị trí: <strong>{transaction.items[0].mountPosition}</strong>
                  </span>
                )}
              </div>
            )}

            {transaction.note && (
              <div className="col-span-2">
                <span className="font-semibold text-slate-600">Lý do xuất / nhập: </span>
                <span>{transaction.note}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-xs border border-slate-300 border-collapse mb-6">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-300">
                <th className="p-2 border-r border-slate-300 w-10">STT</th>
                <th className="p-2 border-r border-slate-300">Tên Phụ Tùng / Vật Tư</th>
                <th className="p-2 border-r border-slate-300 w-28">Mã Số</th>
                <th className="p-2 border-r border-slate-300 w-16">ĐVT</th>
                <th className="p-2 border-r border-slate-300 w-20 text-right">Số Lượng</th>
                <th className="p-2 border-r border-slate-300 w-28 text-right">Đơn Giá</th>
                <th className="p-2 text-right w-32">Thành Tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-2 text-center border-r border-slate-200">{idx + 1}</td>
                  <td className="p-2 border-r border-slate-200 font-medium">
                    {item.partName}
                  </td>
                  <td className="p-2 border-r border-slate-200 font-mono text-center">{item.sku}</td>
                  <td className="p-2 border-r border-slate-200 text-center">{item.unit}</td>
                  <td className="p-2 border-r border-slate-200 text-right font-sans tabular-nums font-bold">{item.quantity}</td>
                  <td className="p-2 border-r border-slate-200 text-right font-sans tabular-nums">{formatNumber(item.unitPrice)}</td>
                  <td className="p-2 text-right font-sans tabular-nums font-bold">{formatNumber(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <td colSpan={4} className="p-2 text-right uppercase">Cộng Tổng:</td>
                <td className="p-2 text-center">
                  {transaction.items.reduce((s, it) => s + it.quantity, 0)}
                </td>
                <td className="p-2 border-r border-slate-200"></td>
                <td className="p-2 text-right font-sans tabular-nums font-bold text-slate-950">
                  {formatVND(transaction.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs mt-10 pt-4">
            <div>
              <div className="font-bold text-slate-900">Người Lập Phiếu</div>
              <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
              <div className="h-16"></div>
              <div className="font-semibold text-slate-700">{transaction.creatorName}</div>
            </div>

            <div>
              <div className="font-bold text-slate-900">Người Nhận / Tài Xế</div>
              <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
              <div className="h-16"></div>
              <div className="font-semibold text-slate-700">{transaction.partnerOrReceiver}</div>
            </div>

            <div>
              <div className="font-bold text-slate-900">Thủ Kho Vật Tư</div>
              <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
              <div className="h-16"></div>
              <div className="font-semibold text-slate-700">Đã xuất kho</div>
            </div>

            <div>
              <div className="font-bold text-slate-900">Giám Đốc Kỹ Thuật</div>
              <p className="text-[10px] text-slate-500 italic">(Ký, đóng dấu)</p>
              <div className="h-16"></div>
              <div className="font-semibold text-slate-700">Ban Giám Đốc</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
