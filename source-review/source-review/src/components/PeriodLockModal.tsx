import React, { useState } from 'react';
import { X, Lock, Unlock, Check, AlertCircle, Calendar, ShieldCheck } from 'lucide-react';
import { formatVND, formatNumber } from '../utils/inventoryUtils';

interface PeriodLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClosingStockValue: number;
  totalInAmount: number;
  totalOutAmount: number;
}

export const PeriodLockModal: React.FC<PeriodLockModalProps> = ({
  isOpen,
  onClose,
  currentClosingStockValue,
  totalInAmount,
  totalOutAmount
}) => {
  if (!isOpen) return null;

  const [month, setMonth] = useState(10);
  const [year, setYear] = useState(2026);
  const [lockedBy, setLockedBy] = useState('Lê Đại Minh (Kế toán kho)');
  const [isLocked, setIsLocked] = useState(false);
  const [lockNotes, setLockNotes] = useState('Khóa sổ kế toán vật tư & cấp dầu kỳ tháng 10/2026');

  const handleToggleLock = () => {
    setIsLocked(!isLocked);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-6">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              isLocked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Khóa Sổ Kế Toán Kho Theo Kỳ
              </h3>
              <p className="text-xs text-slate-500">
                Chốt số dư tồn kho, bảo toàn số liệu và ngăn chặn sửa đổi chứng từ cũ
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kỳ Tháng:
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Năm Kế Toán:
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
          </div>

          {/* Snapshot Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-amber-800 uppercase tracking-wide text-[11px]">
              Số Liệu Chốt Kỳ Tháng {month}/{year}:
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tổng giá trị nhập trong kỳ:</span>
              <span className="font-sans tabular-nums text-right font-bold text-emerald-700">{formatVND(totalInAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tổng giá trị xuất trong kỳ:</span>
              <span className="font-sans tabular-nums text-right font-bold text-blue-700">{formatVND(totalOutAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-slate-200">
              <span>Giá trị tồn kho chốt chuyển sang kỳ sau:</span>
              <span className="font-sans tabular-nums text-right text-slate-900 font-black">{formatVND(currentClosingStockValue)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Người phê duyệt chốt sổ:
            </label>
            <input
              type="text"
              value={lockedBy}
              onChange={(e) => setLockedBy(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú chốt kỳ:
            </label>
            <textarea
              rows={2}
              value={lockNotes}
              onChange={(e) => setLockNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          {/* Status Indicator */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            isLocked ? 'bg-red-50 border-red-300 text-red-700' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
          }`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>
                {isLocked ? `Kỳ Tháng ${month}/${year} ĐÃ ĐƯỢC KHÓA CHẶT` : `Kỳ Tháng ${month}/${year} ĐANG MỞ ĐỂ GHI NHẬN PHIẾU`}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleLock}
              className={`px-3 py-1 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
                isLocked ? 'bg-amber-500 text-slate-950 hover:bg-amber-600' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isLocked ? 'Mở Khóa Kỳ' : 'Khóa Sổ Ngay'}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
