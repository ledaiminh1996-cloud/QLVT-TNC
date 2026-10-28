import { MenuIcon } from './MenuIcon';
import { StatusBadge } from './StatusBadge';
import React, { useState } from 'react';
import { 
  CalendarCheck, 
  AlertTriangle, 
  ShieldAlert, 
  Download, 
  Printer, 
  Truck, 
  Package, 
  CheckCircle2, 
  Wrench, 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet 
} from 'lucide-react';
import { SparePart, Vehicle, MountedComponent, InventoryTransaction } from '../types/inventory';
import { 
  formatVND, 
  formatNumber, 
  formatDate, 
  calculateComponentWear, 
  exportToCSV 
} from '../utils/inventoryUtils';

interface MaintenanceReportProps {
  parts: SparePart[];
  vehicles: Vehicle[];
  mountedComponents: MountedComponent[];
  transactions: InventoryTransaction[];
  onOpenNewTxModal: (type: 'IN' | 'OUT', defaultPartId?: string, defaultVehicleId?: string) => void;
}

export const MaintenanceReport: React.FC<MaintenanceReportProps> = ({
  parts,
  vehicles,
  mountedComponents,
  transactions,
  onOpenNewTxModal
}) => {
  const [reportView, setReportView] = useState<'maintenance' | 'purchase_plan'>('maintenance');

  const vehicleMap = new Map<string, Vehicle>(vehicles.map(v => [v.id, v]));

  // 1. Phân tích chi tiết linh kiện gắn trên xe
  const analyzedMounted = mountedComponents.map(comp => {
    const veh = vehicleMap.get(comp.vehicleId);
    const wear = calculateComponentWear(comp, veh);
    const part = parts.find(p => p.id === comp.partId);
    return {
      comp,
      veh,
      wear,
      part
    };
  });

  const overdueList = analyzedMounted.filter(a => a.wear.urgency === 'critical');
  const warningList = analyzedMounted.filter(a => a.wear.urgency === 'warning');
  const normalList = analyzedMounted.filter(a => a.wear.urgency === 'normal');

  // 2. Phân tích đề xuất mua hàng (Restock Order Plan)
  const lowStockParts = parts.filter(p => p.currentStock <= p.minStock).map(p => {
    const shortage = Math.max(0, p.minStock - p.currentStock);
    const suggestedBuy = Math.max(p.minStock, (p.minStock * 2) - p.currentStock);
    const estimatedCost = suggestedBuy * p.avgCostPrice;
    return {
      part: p,
      shortage,
      suggestedBuy,
      estimatedCost
    };
  });

  const totalRestockBudget = lowStockParts.reduce((s, it) => s + it.estimatedCost, 0);

  // 3. Phân tích chi phí thay thế vật tư theo từng xe từ lịch sử PXK
  const vehicleCostSummary = vehicles.map(veh => {
    let totalCost = 0;
    let partsCount = 0;

    transactions.filter(t => t.type === 'OUT').forEach(tx => {
      tx.items.forEach(it => {
        if (it.vehicleId === veh.id) {
          totalCost += it.totalPrice;
          partsCount += it.quantity;
        }
      });
    });

    return {
      vehicle: veh,
      totalCost,
      partsCount
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  // Export report
  const handleExportMaintenance = () => {
    const headers = [
      { key: 'plate', label: 'Biển Số Xe' },
      { key: 'type', label: 'Loại Phương Tiện' },
      { key: 'brand', label: 'Dòng Xe' },
      { key: 'partSku', label: 'Mã Vật Tư' },
      { key: 'partName', label: 'Tên Linh Kiện / Phụ Tùng' },
      { key: 'position', label: 'Vị Trí Lắp Đặt' },
      { key: 'mountDate', label: 'Ngày Lắp' },
      { key: 'kmUsed', label: 'Số KM Đã Chạy' },
      { key: 'kmLimit', label: 'Định Mức KM' },
      { key: 'wearPercent', label: 'Tỷ Lệ Hao Mòn (%)' },
      { key: 'urgency', label: 'Mức Độ Cảnh Báo' }
    ];

    const rows = analyzedMounted.map(a => ({
      plate: a.comp.vehiclePlate,
      type: a.veh?.type === 'tractor' ? 'Đầu Kéo' : 'Rơ-Moóc',
      brand: a.veh?.brandModel || '',
      partSku: a.comp.sku,
      partName: a.comp.partName,
      position: a.comp.mountPosition,
      mountDate: a.comp.mountDate,
      kmUsed: a.wear.kmUsed,
      kmLimit: a.comp.lifespanKmLimit || 0,
      wearPercent: `${a.wear.maxPercentage}%`,
      urgency: a.wear.urgencyText
    }));

    exportToCSV(`Bao_Cao_Dinh_Muc_Bao_Tri_Xe_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  const handleExportPurchasePlan = () => {
    const headers = [
      { key: 'sku', label: 'Mã Vật Tư' },
      { key: 'name', label: 'Tên Phụ Tùng' },
      { key: 'unit', label: 'ĐVT' },
      { key: 'currentStock', label: 'Tồn Kho Hiện Tại' },
      { key: 'minStock', label: 'Tồn Tối Thiểu' },
      { key: 'shortage', label: 'Thiếu Hụt' },
      { key: 'suggestedBuy', label: 'Số Lượng Đề Xuất Đặt Mua' },
      { key: 'unitPrice', label: 'Đơn Giá Dự Toán' },
      { key: 'estimatedCost', label: 'Thành Tiền Dự Toán (VNĐ)' }
    ];

    const rows = lowStockParts.map(p => ({
      sku: p.part.sku,
      name: p.part.name,
      unit: p.part.unit,
      currentStock: p.part.currentStock,
      minStock: p.part.minStock,
      shortage: p.shortage,
      suggestedBuy: p.suggestedBuy,
      unitPrice: p.part.avgCostPrice,
      estimatedCost: p.estimatedCost
    }));

    exportToCSV(`De_Xuat_Du_Tru_Mua_Vat_Tu_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <MenuIcon menuId="td_canh_bao" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Báo Cáo Tự Động Định Mức Kỹ Thuật &amp; Kế Hoạch Cung Ứng
              </h2>
              <p className="text-xs text-slate-500">
                Thuật toán tự động quét tình trạng hao mòn phương tiện và tạo danh sách đề xuất thay thế, mua hàng
              </p>
            </div>
          </div>

          {/* Tab switch buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReportView('maintenance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                reportView === 'maintenance'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Lịch Bảo Trì Xe ({overdueList.length + warningList.length})
            </button>
            <button
              onClick={() => setReportView('purchase_plan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                reportView === 'purchase_plan'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Kế Hoạch Mua Hàng ({lowStockParts.length})
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: LỊCH BẢO TRÌ & THAY THẾ TỰ ĐỘNG THEO ĐỊNH MỨC XE */}
      {reportView === 'maintenance' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-rose-700 font-semibold">
                <span>Khẩn Cấp: Đã Quá Định Mức (&gt;100%)</span>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-700">
                {overdueList.length} Linh Kiện
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Yêu cầu đưa vào xưởng thay ngay để đảm bảo an toàn giao thông đường dài.
              </p>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-amber-700 font-semibold">
                <span>Cảnh Báo: Sắp Đến Hạn (80% - 100%)</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-700">
                {warningList.length} Linh Kiện
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Lên kế hoạch đặt hàng và bảo dưỡng trong chuyến quay đầu tiếp theo.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
                <span>Hoạt Động Bình Thường (&lt;80%)</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">
                {normalList.length} Linh Kiện
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Đang trong tuổi thọ định mức cho phép.
              </p>
            </div>
          </div>

          {/* Action and Export Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bảng Kê Chi Tiết Tình Trạng Định Mức Kỹ Thuật Đội Xe
            </h3>
            <button
              onClick={handleExportMaintenance}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Báo Cáo Bảo Trì (Excel)</span>
            </button>
          </div>

          {/* Maintenance Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3">Phương Tiện</th>
                    <th className="py-3 px-3">Linh Kiện / Phụ Tùng</th>
                    <th className="py-3 px-3">Vị Trí Lắp</th>
                    <th className="py-3 px-2 text-center">Ngày Lắp</th>
                    <th className="py-3 px-2 text-right">KM Đã Chạy</th>
                    <th className="py-3 px-2 text-right">Định Mức KM</th>
                    <th className="py-3 px-3 text-center min-w-[130px]">Mức Hao Mòn</th>
                    <th className="py-3 px-3 text-center">Trạng Thái</th>
                    <th className="py-3 px-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {analyzedMounted.map(({ comp, veh, wear, part }) => {
                    const isCritical = wear.urgency === 'critical';
                    const isWarning = wear.urgency === 'warning';

                    return (
                      <tr 
                        key={comp.id}
                        className={`hover:bg-slate-50/70 transition ${
                          isCritical ? 'bg-rose-50/30' : isWarning ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Vehicle */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {comp.vehiclePlate}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                            {veh ? veh.brandModel : ''}
                          </div>
                        </td>

                        {/* Component */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {comp.partName}
                          </div>
                          <div className="text-[10px] font-mono text-amber-700 font-bold">
                            {comp.sku}
                          </div>
                        </td>

                        {/* Mount Position */}
                        <td className="py-2.5 px-3 text-slate-700">
                          {comp.mountPosition}
                        </td>

                        {/* Mount Date */}
                        <td className="py-2.5 px-2 text-center text-slate-500 font-sans text-[11px]">
                          {formatDate(comp.mountDate)}
                        </td>

                        {/* KM Used */}
                        <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-slate-900">
                          {formatNumber(wear.kmUsed)} KM
                        </td>

                        {/* KM Limit */}
                        <td className="py-2.5 px-2 text-right font-sans tabular-nums text-slate-500">
                          {comp.lifespanKmLimit ? `${formatNumber(comp.lifespanKmLimit)} KM` : '-'}
                        </td>

                        {/* Wear Progress */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-500">Hao mòn:</span>
                            <span className={`font-sans tabular-nums text-right font-bold ${
                              isCritical ? 'text-rose-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {wear.maxPercentage}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, wear.maxPercentage)}%` }}
                            />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge label={wear.urgencyText} tone={isCritical ? 'danger' : isWarning ? 'warning' : 'success'} />
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onOpenNewTxModal('OUT', comp.partId, comp.vehicleId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded text-[11px] font-semibold transition cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Xuất Thay</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vehicle Cost Ranking */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>Bảng Tổng Hợp Chi Phí Vật Tư &amp; Phụ Tùng Đã Xuất Theo Từng Xe</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {vehicleCostSummary.map(({ vehicle, totalCost, partsCount }) => (
                <div key={vehicle.id} className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {vehicle.plateNumber}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                      {vehicle.type === 'tractor' ? 'Đầu kéo' : 'Rơ-moóc'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {vehicle.brandModel}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Tổng chi phí xuất:</span>
                    <span className="text-xs font-bold text-amber-700 font-sans tabular-nums text-right">
                      {formatVND(totalCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KẾ HOẠCH DỰ TRÙ MUA HÀNG VẬT TƯ (PURCHASE ORDER PLAN) */}
      {reportView === 'purchase_plan' && (
        <div className="space-y-6">
          {/* Top Banner Budget */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Dự Trù Ngân Sách Đặt Hàng Bù Tồn Kho An Toàn
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatVND(totalRestockBudget)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tính toán dựa trên số lượng thiếu hụt và mức đệm tồn kho an toàn (Buffer x2 Min Stock).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPurchasePlan}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Đề Xuất Đặt Hàng (Excel)</span>
              </button>
            </div>
          </div>

          {/* Low Stock Items List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Danh Sách Phụ Tùng Cần Đặt Hàng Ngay ({lowStockParts.length} mặt hàng)
              </h3>
              <span className="text-xs text-slate-500">
                Chỉ hiển thị phụ tùng có Tồn kho &le; Mức tối thiểu
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3">Mã Vật Tư</th>
                    <th className="py-3 px-3">Tên Phụ Tùng / Vật Tư</th>
                    <th className="py-3 px-2 text-center">ĐVT</th>
                    <th className="py-3 px-2 text-right">Tồn Hiện Tại</th>
                    <th className="py-3 px-2 text-right">Tồn Tối Thiểu</th>
                    <th className="py-3 px-2 text-right">Thiếu Hụt</th>
                    <th className="py-3 px-2 text-right text-amber-700 font-bold">Số Lượng Đề Xuất</th>
                    <th className="py-3 px-3 text-right">Đơn Giá Dự Toán</th>
                    <th className="py-3 px-3 text-right">Thành Tiền Dự Toán</th>
                    <th className="py-3 px-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {lowStockParts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                        Kho phụ tùng đang đảm bảo đầy đủ mức tồn kho an toàn cho tất cả mặt hàng.
                      </td>
                    </tr>
                  ) : (
                    lowStockParts.map(({ part, shortage, suggestedBuy, estimatedCost }) => (
                      <tr key={part.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                          {part.sku}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {part.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {part.specifications}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-600">
                          {part.unit}
                        </td>
                        <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-rose-600">
                          {part.currentStock}
                        </td>
                        <td className="py-2.5 px-2 text-right font-sans tabular-nums text-slate-500">
                          {part.minStock}
                        </td>
                        <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-amber-700">
                          {shortage}
                        </td>
                        <td className="py-2.5 px-2 text-right font-sans tabular-nums font-bold text-emerald-700 text-sm">
                          +{suggestedBuy}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans tabular-nums text-slate-600">
                          {formatVND(part.avgCostPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans tabular-nums font-bold text-amber-700">
                          {formatVND(estimatedCost)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onOpenNewTxModal('IN', part.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition cursor-pointer shadow-xs"
                          >
                            <span>+ Nhập Hàng</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lowStockParts.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs text-slate-900">
                      <td colSpan={8} className="py-3 px-3 text-right uppercase tracking-wider text-amber-800">
                        Tổng Ngân Sách Dự Trù Mua Hàng:
                      </td>
                      <td className="py-3 px-3 text-right font-sans tabular-nums text-emerald-700 font-bold text-sm">
                        {formatVND(totalRestockBudget)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
