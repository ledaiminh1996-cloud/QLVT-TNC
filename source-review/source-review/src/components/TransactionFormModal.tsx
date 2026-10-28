import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Truck, 
  Package, 
  Calendar, 
  FileText, 
  Check, 
  AlertCircle,
  Wrench,
  DollarSign
} from 'lucide-react';
import { SparePart, Vehicle, InventoryTransaction, TransactionItem, TransactionType } from '../types/inventory';
import { formatVND, formatNumber } from '../utils/inventoryUtils';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TransactionType; // 'IN' | 'OUT'
  parts: SparePart[];
  vehicles: Vehicle[];
  defaultPartId?: string;
  defaultVehicleId?: string;
  onSubmit: (tx: InventoryTransaction, updateVehicleOdo?: { vehicleId: string; newOdo: number }, newMountedItem?: any) => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  type,
  parts,
  vehicles,
  defaultPartId,
  defaultVehicleId,
  onSubmit
}) => {
  if (!isOpen) return null;

  const isImport = type === 'IN';

  // Form Header State
  const [code, setCode] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [creatorName, setCreatorName] = useState('Lê Đại Minh (Thủ kho)');
  const [partnerOrReceiver, setPartnerOrReceiver] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [note, setNote] = useState('');

  // Fleet Issue specific state
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId || '');
  const [currentVehicleOdo, setCurrentVehicleOdo] = useState<number>(0);
  const [mountPosition, setMountPosition] = useState('Trục 1 dẫn hướng (Bánh lái)');

  // Transaction Items State
  const [items, setItems] = useState<Array<{
    partId: string;
    quantity: number;
    unitPrice: number;
  }>>([]);

  const [errorMsg, setErrorMsg] = useState('');

  // Auto-generate code when opening
  useEffect(() => {
    const prefix = isImport ? 'PNK' : 'PXK';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setCode(`${prefix}-${dateStr}-${randomSuffix}`);

    // If defaultPartId supplied, pre-fill items
    const initialPart = parts.find(p => p.id === defaultPartId) || parts[0];
    if (initialPart) {
      setItems([{
        partId: initialPart.id,
        quantity: 1,
        unitPrice: initialPart.avgCostPrice
      }]);
    }

    if (defaultVehicleId) {
      setSelectedVehicleId(defaultVehicleId);
      const v = vehicles.find(veh => veh.id === defaultVehicleId);
      if (v) setCurrentVehicleOdo(v.currentOdoKm);
    }
  }, [isOpen, type, defaultPartId, defaultVehicleId, isImport, parts, vehicles]);

  // Update vehicle odo when selecting vehicle
  useEffect(() => {
    if (selectedVehicleId) {
      const v = vehicles.find(veh => veh.id === selectedVehicleId);
      if (v) {
        setCurrentVehicleOdo(v.currentOdoKm);
      }
    }
  }, [selectedVehicleId, vehicles]);

  const handleAddItem = () => {
    const fallbackPart = parts[0];
    if (!fallbackPart) return;
    setItems(prev => [
      ...prev,
      {
        partId: fallbackPart.id,
        quantity: 1,
        unitPrice: fallbackPart.avgCostPrice
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemPartChange = (index: number, partId: string) => {
    const selected = parts.find(p => p.id === partId);
    if (!selected) return;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        partId,
        unitPrice: selected.avgCostPrice
      };
    }));
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        quantity: Math.max(1, qty)
      };
    }));
  };

  const handleItemPriceChange = (index: number, price: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        unitPrice: Math.max(0, price)
      };
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code.trim() || !partnerOrReceiver.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ Mã số phiếu và Đối tác / Người nhận.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Phiếu phải có ít nhất 1 dòng phụ tùng.');
      return;
    }

    // Check stock for OUT transactions
    if (!isImport) {
      for (const it of items) {
        const p = parts.find(part => part.id === it.partId);
        if (p && it.quantity > p.currentStock) {
          setErrorMsg(`Không đủ tồn kho để xuất: [${p.sku}] ${p.name}. Tồn hiện tại: ${p.currentStock}, Yêu cầu: ${it.quantity}`);
          return;
        }
      }
    }

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    const txItems: TransactionItem[] = items.map(it => {
      const p = parts.find(part => part.id === it.partId)!;
      return {
        partId: p.id,
        partName: p.name,
        sku: p.sku,
        unit: p.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.quantity * it.unitPrice,
        vehiclePlate: !isImport && selectedVehicle ? selectedVehicle.plateNumber : undefined,
        vehicleOdoAtMount: !isImport && selectedVehicle ? currentVehicleOdo : undefined,
        mountPosition: !isImport && selectedVehicle ? mountPosition : undefined
      };
    });

    const newTx: InventoryTransaction = {
      id: `tx-${Date.now()}`,
      code,
      type,
      date,
      creatorName,
      partnerOrReceiver,
      invoiceNumber: invoiceNumber.trim() || undefined,
      items: txItems,
      totalAmount,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    // If OUT for vehicle, construct mounted components to track wear
    let newMountedItems: any[] = [];
    if (!isImport && selectedVehicle) {
      newMountedItems = items.map(it => {
        const p = parts.find(part => part.id === it.partId)!;
        return {
          id: `mc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          vehicleId: selectedVehicle.id,
          vehiclePlate: selectedVehicle.plateNumber,
          partId: p.id,
          partName: p.name,
          sku: p.sku,
          category: p.category,
          mountDate: date,
          mountOdoKm: currentVehicleOdo,
          lifespanKmLimit: p.lifespanKmLimit,
          lifespanDaysLimit: p.lifespanDaysLimit,
          mountPosition: mountPosition,
          status: 'running',
          notes: `Lắp thay thế theo phiếu ${code}`
        };
      });
    }

    onSubmit(
      newTx, 
      !isImport && selectedVehicle ? { vehicleId: selectedVehicle.id, newOdo: currentVehicleOdo } : undefined,
      newMountedItems.length > 0 ? newMountedItems : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${
          isImport 
            ? 'bg-emerald-50 border-emerald-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              isImport ? 'bg-emerald-600' : 'bg-blue-600'
            }`}>
              {isImport ? <Package className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isImport ? 'Lập Phiếu Nhập Kho Phụ Tùng (PNK)' : 'Lập Phiếu Xuất Kho Thay Thế Xe (PXK)'}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                  isImport ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}>
                  {code}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {isImport 
                  ? 'Ghi nhận phụ tùng mua mới, bổ sung tồn kho xe đầu kéo & rơ moóc' 
                  : 'Xuất phụ tùng thay thế/bảo dưỡng cho xe đầu kéo hoặc rơ-moóc cụ thể'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: General Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày ghi phiếu <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isImport ? 'Nhà cung cấp / Đại lý' : 'Đơn vị / Thợ kỹ thuật nhận'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={partnerOrReceiver}
                onChange={(e) => setPartnerOrReceiver(e.target.value)}
                placeholder={isImport ? 'Nhà cung cấp lốp/dầu...' : 'Tên thợ hoặc xưởng...'}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isImport ? 'Số hóa đơn VAT / Phiếu giao' : 'Số lệnh sửa chữa'}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="VD: HD-0098231..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thủ kho / Người lập
              </label>
              <input
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
          </div>

          {/* Section 2: Fleet Assignment (For OUT - Issue to Vehicle) */}
          {!isImport && (
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
                <Wrench className="w-4 h-4 text-blue-600" />
                <span>Chỉ định Xe Đầu Kéo / Rơ-Moóc Lắp Đặt &amp; Cập Nhật ODO</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Select Vehicle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chọn Biển Số Phương Tiện:
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-sans focus:outline-none focus:border-blue-500 shadow-xs"
                  >
                    <option value="">-- Chọn xe hoặc để trống (Xuất ngoài) --</option>
                    <optgroup label="Xe Đầu Kéo:">
                      {vehicles.filter(v => v.type === 'tractor').map(v => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber} ({v.brandModel})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Rơ-Moóc:">
                      {vehicles.filter(v => v.type === 'trailer').map(v => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber} ({v.brandModel})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Current Odometer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số ODO KM Xe Khi Lắp Đặt:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={currentVehicleOdo}
                      onChange={(e) => setCurrentVehicleOdo(Number(e.target.value))}
                      placeholder="Số KM..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-sans tabular-nums text-right focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">KM</span>
                  </div>
                </div>

                {/* Mount Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vị trí lắp đặt chi tiết:
                  </label>
                  <input
                    type="text"
                    value={mountPosition}
                    onChange={(e) => setMountPosition(e.target.value)}
                    placeholder="VD: Trục 1 lái, Bầu phanh cầu 2..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-600 italic">
                * Khi chọn xe, hệ thống sẽ tự động liên kết vật tư này vào hồ sơ xe để đếm số KM và tuổi thọ bảo trì tự động.
              </p>
            </div>
          )}

          {/* Section 3: Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Danh Sách Phụ Tùng / Vật Tư
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm dòng vật tư</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">Phụ Tùng / Vật Tư</th>
                    <th className="py-2.5 px-2 text-center w-20">ĐVT</th>
                    <th className="py-2.5 px-2 text-right w-24">Tồn Kho</th>
                    <th className="py-2.5 px-2 text-right w-28">Số Lượng</th>
                    <th className="py-2.5 px-3 text-right w-36">Đơn Giá (VNĐ)</th>
                    <th className="py-2.5 px-3 text-right w-36">Thành Tiền</th>
                    <th className="py-2.5 px-2 text-center w-12">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const part = parts.find(p => p.id === item.partId);
                    const subtotal = item.quantity * item.unitPrice;
                    const isExceedStock = !isImport && part && item.quantity > part.currentStock;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        {/* Part selection */}
                        <td className="py-2 px-3">
                          <select
                            value={item.partId}
                            onChange={(e) => handleItemPartChange(idx, e.target.value)}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
                          >
                            {parts.map(p => (
                              <option key={p.id} value={p.id}>
                                [{p.sku}] {p.name}
                              </option>
                            ))}
                          </select>
                          {part && (
                            <div className="text-[10px] text-slate-500 mt-1 truncate">
                              Quy cách: {part.specifications} | Vị trí: {part.storageLocation}
                            </div>
                          )}
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-2 text-center text-slate-600">
                          {part ? part.unit : '-'}
                        </td>

                        {/* Current Stock */}
                        <td className="py-2 px-2 text-right">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-sans tabular-nums text-right font-bold ${
                            part && part.currentStock <= part.minStock ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'text-slate-700'
                          }`}>
                            {part ? formatNumber(part.currentStock) : 0}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                            className={`w-20 py-1 bg-white border rounded-lg text-xs font-sans tabular-nums text-right font-bold text-slate-900 focus:outline-none shadow-xs ${
                              isExceedStock ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-300 focus:border-amber-500'
                            }`}
                          />
                          {isExceedStock && (
                            <div className="text-[10px] text-red-600 mt-0.5 font-semibold">
                              Vượt tồn!
                            </div>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.unitPrice}
                            onChange={(e) => handleItemPriceChange(idx, Number(e.target.value))}
                            className="w-28 text-right py-1 px-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-slate-800 focus:outline-none focus:border-amber-500 shadow-xs"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="py-2 px-3 text-right font-sans tabular-nums font-bold text-slate-900">
                          {formatVND(subtotal)}
                        </td>

                        {/* Delete row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={5} className="py-3 px-3 text-right text-xs uppercase text-slate-700">
                      Tổng Cộng Giá Trị Phiếu:
                    </td>
                    <td className="py-3 px-3 text-right font-sans tabular-nums text-sm text-blue-900 font-extrabold">
                      {formatVND(totalAmount)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 4: Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú nội dung phiếu:
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Thay thế lốp trục lái xe Howo trước chuyến hàng Hải Phòng - Sài Gòn..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              * Tồn kho và định mức xe sẽ được tự động đồng bộ hóa ngay khi lưu phiếu.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer border border-slate-200"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition cursor-pointer flex items-center gap-1.5 ${
                  isImport 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{isImport ? 'Lưu Phiếu Nhập Kho' : 'Lưu Phiếu Xuất Kho'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
