import React, { useState } from 'react';
import { X, Package, Check, AlertCircle } from 'lucide-react';
import { SparePart, PartCategory } from '../types/inventory';
import { CATEGORY_LABELS } from '../data/initialData';

interface PartCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPart?: SparePart | null;
  onSavePart: (part: SparePart) => void;
}

export const PartCatalogModal: React.FC<PartCatalogModalProps> = ({
  isOpen,
  onClose,
  initialPart,
  onSavePart
}) => {
  if (!isOpen) return null;

  const isEdit = !!initialPart;

  const [sku, setSku] = useState(initialPart?.sku || 'VT-');
  const [name, setName] = useState(initialPart?.name || '');
  const [category, setCategory] = useState<PartCategory>(initialPart?.category || 'tires');
  const [applicableFor, setApplicableFor] = useState<'tractor' | 'trailer' | 'both'>(initialPart?.applicableFor || 'both');
  const [unit, setUnit] = useState(initialPart?.unit || 'Quả');
  const [specifications, setSpecifications] = useState(initialPart?.specifications || '');
  const [minStock, setMinStock] = useState<number>(initialPart?.minStock || 4);
  const [currentStock, setCurrentStock] = useState<number>(initialPart?.currentStock || 0);
  const [avgCostPrice, setAvgCostPrice] = useState<number>(initialPart?.avgCostPrice || 1000000);
  const [storageLocation, setStorageLocation] = useState(initialPart?.storageLocation || 'Khu A1');
  const [lifespanKmLimit, setLifespanKmLimit] = useState<number | undefined>(initialPart?.lifespanKmLimit || 80000);
  const [lifespanDaysLimit, setLifespanDaysLimit] = useState<number | undefined>(initialPart?.lifespanDaysLimit || 365);
  const [notes, setNotes] = useState(initialPart?.notes || '');

  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Mã vật tư (SKU) và Tên phụ tùng');
      return;
    }

    const saved: SparePart = {
      id: initialPart ? initialPart.id : `part-${Date.now()}`,
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category,
      applicableFor,
      unit: unit.trim(),
      specifications: specifications.trim(),
      minStock: Number(minStock),
      currentStock: Number(currentStock),
      avgCostPrice: Number(avgCostPrice),
      storageLocation: storageLocation.trim(),
      lifespanKmLimit: lifespanKmLimit && Number(lifespanKmLimit) > 0 ? Number(lifespanKmLimit) : undefined,
      lifespanDaysLimit: lifespanDaysLimit && Number(lifespanDaysLimit) > 0 ? Number(lifespanDaysLimit) : undefined,
      notes: notes.trim() || undefined
    };

    onSavePart(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? 'Chỉnh Sửa Thông Tin Phụ Tùng' : 'Thêm Mới Phụ Tùng & Định Mức Kỹ Thuật'}
              </h3>
              <p className="text-xs text-slate-500">
                Cấu hình định mức tồn kho tối thiểu, định mức KM và tuổi thọ bảo trì
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã Vật Tư (SKU) <span className="text-red-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="VD: VT-LOP-12R225..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhóm Danh Mục:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PartCategory)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên Phụ Tùng / Vật Tư <span className="text-red-500">*</span>:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Vỏ lốp xe 12R22.5 Bridgestone R150..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phù hợp cho xe:
              </label>
              <select
                value={applicableFor}
                onChange={(e) => setApplicableFor(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              >
                <option value="both">Dùng chung (Cả 2 loại)</option>
                <option value="tractor">Chuyên Xe Đầu Kéo</option>
                <option value="trailer">Chuyên Rơ-Moóc</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn Vị Tính (ĐVT):
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Quả, Cái, Xô, Lít, Bộ..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vị Trí Kệ Lưu Kho:
              </label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="Kho A1, Kệ Lốp B2..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quy Cách Kỹ Thuật Chi Tiết:
            </label>
            <input
              type="text"
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              placeholder="VD: 12R22.5 bố thép 18PR chuyên trục dẫn hướng..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          {/* Section: Stock & Cost */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-amber-800 mb-1">
                Mức Tồn Tối Thiểu (Min Stock) *:
              </label>
              <input
                type="number"
                min="0"
                required
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-xs"
              />
              <span className="text-[10px] text-slate-500">Cảnh báo khi tồn &le; số này</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tồn Kho Hiện Tại:
              </label>
              <input
                type="number"
                min="0"
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn Giá Vốn Bình Quân (VNĐ):
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={avgCostPrice}
                onChange={(e) => setAvgCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-900 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
          </div>

          {/* Section: Technical Lifespan Limits */}
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                Định Mức Số KM Tối Đa:
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={lifespanKmLimit || ''}
                  onChange={(e) => setLifespanKmLimit(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="VD: 100000 KM..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">KM</span>
              </div>
              <span className="text-[10px] text-slate-500">Ví dụ: Lốp 100.000km, Nhớt 18.000km</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                Định Mức Tuổi Thọ Thời Gian (Ngày):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={lifespanDaysLimit || ''}
                  onChange={(e) => setLifespanDaysLimit(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="VD: 730 ngày (2 năm)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Ngày</span>
              </div>
              <span className="text-[10px] text-slate-500">Ví dụ: Ắc quy 730 ngày (2 năm), Dây hơi 540 ngày</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi Chú Kỹ Thuật:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Cần siết lực đều tay, bôi trơn đúng chủng loại..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs cursor-pointer"
            >
              {isEdit ? 'Cập Nhật Phụ Tùng' : 'Tạo Phụ Tùng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
