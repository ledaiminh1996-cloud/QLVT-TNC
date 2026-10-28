import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Truck, 
  Package, 
  TrendingDown, 
  ArrowUpRight, 
  PlusCircle, 
  Wrench,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { SparePart, Vehicle, MountedComponent } from '../types/inventory';
import { formatVND, formatNumber, formatDate, calculateComponentWear, getStockStatus } from '../utils/inventoryUtils';
import { CATEGORY_LABELS } from '../data/initialData';

interface DashboardAlertsProps {
  parts: SparePart[];
  vehicles: Vehicle[];
  mountedComponents: MountedComponent[];
  onOpenNewTxModal: (type: 'IN' | 'OUT', defaultPartId?: string, defaultVehicleId?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onSelectVehicle?: (vehicleId: string) => void;
}

export const DashboardAlerts: React.FC<DashboardAlertsProps> = ({
  parts,
  vehicles,
  mountedComponents,
  onOpenNewTxModal,
  onNavigateToTab,
  onSelectVehicle
}) => {
  // 1. Phân tích Tồn kho tối thiểu
  const lowStockParts = parts.filter(p => p.currentStock <= p.minStock);
  const outOfStockParts = parts.filter(p => p.currentStock === 0);
  const totalStockValue = parts.reduce((sum, p) => sum + (p.currentStock * p.avgCostPrice), 0);
  const totalRestockCostEstimate = lowStockParts.reduce((sum, p) => {
    const shortage = Math.max(1, p.minStock * 2 - p.currentStock);
    return sum + (shortage * p.avgCostPrice);
  }, 0);

  // 2. Phân tích Linh kiện trên xe chạm định mức KM / Tuổi thọ
  const vehicleMap = new Map<string, Vehicle>(vehicles.map(v => [v.id, v]));

  const analyzedComponents = mountedComponents.map(comp => {
    const v = vehicleMap.get(comp.vehicleId);
    const wear = calculateComponentWear(comp, v);
    return {
      component: comp,
      vehicle: v,
      wear
    };
  });

  const overdueComponents = analyzedComponents.filter(c => c.wear.urgency === 'critical');
  const warningComponents = analyzedComponents.filter(c => c.wear.urgency === 'warning');

  const tractorsCount = vehicles.filter(v => v.type === 'tractor').length;
  const trailersCount = vehicles.filter(v => v.type === 'trailer').length;

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Giá trị tồn kho */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tổng Giá Trị Kho Phụ Tùng</span>
            <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 font-bold text-xl text-slate-900">
            {formatVND(totalStockValue)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{parts.length} danh mục phụ tùng</span>
            <button 
              onClick={() => onNavigateToTab('balance')}
              className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Xem sổ kho <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: Cảnh báo Tồn kho an toàn */}
        <div className={`border rounded-xl p-4 shadow-xs relative overflow-hidden ${
          lowStockParts.length > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Cảnh Báo Tồn Kho Tối Thiểu</span>
            <span className={`p-1.5 rounded-lg ${lowStockParts.length > 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-bold text-xl ${lowStockParts.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {lowStockParts.length} Mặt Hàng Thiếu
            </span>
            {outOfStockParts.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                {outOfStockParts.length} hết nhẵn
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Dự trù đặt bù: {formatVND(totalRestockCostEstimate)}</span>
            <button 
              onClick={() => onNavigateToTab('maintenance_report')}
              className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Lập dự trù <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 3: Cảnh báo Định mức KM / Tuổi thọ xe */}
        <div className={`border rounded-xl p-4 shadow-xs relative overflow-hidden ${
          overdueComponents.length > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Định Mức KM & Tuổi Thọ Xe</span>
            <span className={`p-1.5 rounded-lg ${overdueComponents.length > 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'}`}>
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-bold text-xl ${overdueComponents.length > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {overdueComponents.length} Linh Kiện Quá Hạn
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{warningComponents.length} chi tiết sắp đến hạn (&gt;80%)</span>
            <button 
              onClick={() => onNavigateToTab('fleet')}
              className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Xem chi tiết <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 4: Đội ngũ Phương tiện */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Đoàn Xe Quản Lý</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 font-bold text-xl text-slate-900">
            {vehicles.length} Phương Tiện
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{tractorsCount} Đầu Kéo | {trailersCount} Rơ-Moóc</span>
            <button 
              onClick={() => onNavigateToTab('fleet')}
              className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              Xem đội xe <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Alert Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PANEL 1: CẢNH BÁO TỒN KHO TỐI THIỂU CẦN ĐẶT HÀNG GẤP */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Cảnh Báo Tồn Kho Tối Thiểu
                  </h3>
                  <p className="text-xs text-slate-500">
                    Các phụ tùng có số lượng tồn kho chạm hoặc dưới định mức an toàn
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-800 font-semibold rounded-full border border-amber-200">
                {lowStockParts.length} vật tư
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {lowStockParts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  Tất cả phụ tùng vật tư xe đầu kéo & rơ moóc đang ở mức an toàn.
                </div>
              ) : (
                lowStockParts.map(part => {
                  const status = getStockStatus(part);
                  const isZero = part.currentStock === 0;
                  
                  return (
                    <div 
                      key={part.id}
                      className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-amber-700 font-bold">
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
                          <h4 className="text-xs font-bold text-slate-800">
                            {part.name}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Vị trí: {part.storageLocation} | Quy cách: {part.specifications}
                          </p>
                        </div>

                        {/* Stock comparison badge */}
                        <div className="text-right whitespace-nowrap">
                          <div className={`text-xs font-bold ${isZero ? 'text-rose-600' : 'text-amber-700'}`}>
                            Tồn: {part.currentStock} {part.unit}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Định mức tối thiểu: {part.minStock} {part.unit}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700 mt-1">
                            Thiếu: {status.shortageQty} {part.unit}
                          </div>
                        </div>
                      </div>

                      {/* Stock Bar Indicator */}
                      <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${isZero ? 'bg-rose-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, Math.round((part.currentStock / part.minStock) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenNewTxModal('IN', part.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Lập phiếu nhập</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Tự động cảnh báo khi tồn kho &le; mức an toàn
            </span>
            <button
              onClick={() => onNavigateToTab('maintenance_report')}
              className="text-amber-700 hover:text-amber-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Xem báo cáo đề xuất mua hàng</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* PANEL 2: CẢNH BÁO ĐỊNH MỨC SỐ KM & TUỔI THỌ SỬ DỤNG TRÊN XE */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Cảnh Báo Định Mức KM & Bảo Trì Xe
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi số KM thực tế và tuổi thọ linh kiện đang gắn trên đầu kéo, rơ-moóc
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 bg-rose-50 text-rose-700 font-semibold rounded-full border border-rose-200">
                {overdueComponents.length + warningComponents.length} cảnh báo
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {[...overdueComponents, ...warningComponents].length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  Mọi linh kiện trên các xe đầu kéo và rơ moóc đều trong định mức an toàn.
                </div>
              ) : (
                [...overdueComponents, ...warningComponents].map(({ component, vehicle, wear }) => {
                  const isCritical = wear.urgency === 'critical';

                  return (
                    <div 
                      key={component.id}
                      className={`p-3 rounded-lg border transition ${
                        isCritical 
                          ? 'bg-rose-50/50 border-rose-200' 
                          : 'bg-amber-50/50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-900 font-mono font-bold text-xs rounded border border-slate-300">
                              {component.vehiclePlate}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {vehicle ? vehicle.brandModel : ''}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 mt-1">
                            {component.partName}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Vị trí: <span className="text-slate-700 font-medium">{component.mountPosition}</span>
                          </p>
                        </div>

                        {/* Wear Status Badge */}
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isCritical ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {wear.urgencyText}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1 font-sans tabular-nums text-right">
                            Mức hao mòn: {wear.maxPercentage}%
                          </div>
                        </div>
                      </div>

                      {/* Detail metrics: KM and Days */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500">Đã chạy: </span>
                          <span className="font-semibold text-slate-800">{formatNumber(wear.kmUsed)} KM</span>
                          {component.lifespanKmLimit && (
                            <span className="text-slate-400"> / {formatNumber(component.lifespanKmLimit)} KM</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">Thời gian: </span>
                          <span className="font-semibold text-slate-800">{wear.daysUsed} ngày</span>
                          {component.lifespanDaysLimit && (
                            <span className="text-slate-400"> / {component.lifespanDaysLimit} ngày</span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, wear.maxPercentage)}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 italic">
                          {wear.recommendedAction}
                        </span>
                        <button
                          onClick={() => onOpenNewTxModal('OUT', component.partId, component.vehicleId)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Xuất thay thế ngay</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Dựa trên Odometer & ngày lắp đặt thực tế
            </span>
            <button
              onClick={() => onNavigateToTab('fleet')}
              className="text-amber-700 hover:text-amber-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Quản lý sơ đồ lắp đặt phương tiện</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
