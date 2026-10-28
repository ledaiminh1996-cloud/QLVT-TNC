import { searchIncludes } from '../../shared/searchText';
import { StatusBadge } from './StatusBadge';
import React, { useState } from 'react';
import { 
  Truck, 
  Gauge, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Plus, 
  Wrench, 
  Edit3, 
  Trash2, 
  Calendar, 
  Clock, 
  Search, 
  ChevronRight, 
  TrendingUp, 
  RefreshCw, 
  Download, 
  Upload 
} from 'lucide-react';
import { Vehicle, MountedComponent, SparePart } from '../types/inventory';
import { formatNumber, formatDate, calculateComponentWear, formatVND, exportToCSV } from '../utils/inventoryUtils';
import { DirectoryExcelImportModal } from './DirectoryExcelImportModal';

interface FleetMountedManagerProps {
  vehicles: Vehicle[];
  mountedComponents: MountedComponent[];
  parts: SparePart[];
  onUpdateVehicleOdo: (vehicleId: string, newOdo: number) => void;
  onOpenNewTxModal: (type: 'IN' | 'OUT', defaultPartId?: string, defaultVehicleId?: string) => void;
  onAddNewVehicle: (vehicle: Vehicle) => void;
  onEditVehicle?: (vehicle: Vehicle) => void;
  onDeleteVehicle?: (vehicleId: string) => void;
  onImportVehicles?: (imported: Vehicle[]) => void;
}

export const FleetMountedManager: React.FC<FleetMountedManagerProps> = ({
  vehicles,
  mountedComponents,
  parts,
  onUpdateVehicleOdo,
  onOpenNewTxModal,
  onAddNewVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onImportVehicles
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'tractor' | 'trailer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'split'>('table');
  
  // State for Odo update modal
  const [editingOdoVehicle, setEditingOdoVehicle] = useState<Vehicle | null>(null);
  const [newOdoValue, setNewOdoValue] = useState<number>(0);

  // State for Add/Edit Vehicle modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicleObj, setEditingVehicleObj] = useState<Vehicle | null>(null);

  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState<'tractor' | 'trailer'>('tractor');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState(2023);
  const [newOdo, setNewOdo] = useState(150000);
  const [newDriver, setNewDriver] = useState('');

  // State for Import Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filtered vehicles
  const filteredVehicles = vehicles.filter(v => {
    if (vehicleFilter !== 'all' && v.type !== vehicleFilter) return false;
    if (searchQuery && !searchIncludes(v.plateNumber,searchQuery) &&
        !searchIncludes(v.brandModel,searchQuery)) {
      return false;
    }
    return true;
  });

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || filteredVehicles[0];
  const vehicleComponents = mountedComponents.filter(c => c.vehicleId === selectedVehicle?.id);

  const handleOpenOdoModal = (v: Vehicle) => {
    setEditingOdoVehicle(v);
    setNewOdoValue(v.currentOdoKm);
  };

  const handleSaveOdo = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOdoVehicle && newOdoValue >= 0) {
      onUpdateVehicleOdo(editingOdoVehicle.id, newOdoValue);
      setEditingOdoVehicle(null);
    }
  };

  const handleOpenEditVehicle = (veh: Vehicle) => {
    setEditingVehicleObj(veh);
    setNewPlate(veh.plateNumber);
    setNewType(veh.type as any || 'tractor');
    setNewModel(veh.brandModel);
    setNewYear(veh.manufactureYear || 2023);
    setNewOdo(veh.currentOdoKm);
    setNewDriver(veh.assignedDriver || '');
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicleForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;

    if (editingVehicleObj && onEditVehicle) {
      const updated: Vehicle = {
        ...editingVehicleObj,
        plateNumber: newPlate.trim().toUpperCase(),
        type: newType,
        brandModel: newModel.trim() || editingVehicleObj.brandModel,
        manufactureYear: Number(newYear),
        currentOdoKm: Number(newOdo),
        assignedDriver: newDriver.trim() || undefined
      };
      onEditVehicle(updated);
    } else {
      const created: Vehicle = {
        id: `veh-${Date.now()}`,
        plateNumber: newPlate.trim().toUpperCase(),
        type: newType,
        brandModel: newModel.trim() || (newType === 'tractor' ? 'Howo Sitrak' : 'Rơ-moóc Tân Thanh'),
        manufactureYear: Number(newYear),
        currentOdoKm: Number(newOdo),
        assignedDriver: newDriver.trim() || undefined,
        status: 'active'
      };
      onAddNewVehicle(created);
      setSelectedVehicleId(created.id);
    }

    setIsVehicleModalOpen(false);
    setEditingVehicleObj(null);
  };

  const handleDeleteVehicle = (vehId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phương tiện này khỏi đội xe?')) {
      if (onDeleteVehicle) {
        onDeleteVehicle(vehId);
      }
    }
  };

  const handleExportVehiclesExcel = () => {
    const headers = [
      { key: 'plate', label: 'Biển Số Xe' },
      { key: 'type', label: 'Loại Phương Tiện' },
      { key: 'model', label: 'Nhãn Hiệu & Dòng Xe' },
      { key: 'year', label: 'Năm Sản Xuất' },
      { key: 'odo', label: 'Odometer (KM)' },
      { key: 'driver', label: 'Tài Xế Phụ Trách' },
      { key: 'status', label: 'Trạng Thái' }
    ];

    const rows = filteredVehicles.map(v => ({
      plate: v.plateNumber,
      type: v.type === 'tractor' ? 'Xe Đầu Kéo' : 'Rơ-Moóc',
      model: v.brandModel,
      year: v.manufactureYear,
      odo: v.currentOdoKm,
      driver: v.assignedDriver || '-',
      status: v.status === 'active' ? 'Đang hoạt động' : 'Bảo dưỡng'
    }));

    exportToCSV(`Danh_Muc_Phuong_Tien_Xe_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  const handleImportVehicles = (rows: Record<string, string>[]) => {
    if (!onImportVehicles) return;

    const imported: Vehicle[] = rows.map((r, i) => {
      const isTrailer = (r['Loại Phương Tiện'] || r['type'] || '').toLowerCase().includes('moóc') || 
                        (r['Biển Số Xe'] || r['plate'] || '').includes('R');
      return {
        id: `veh-imp-${Date.now()}-${i}`,
        plateNumber: (r['Biển Số Xe'] || r['plate'] || `50H-${i}`).trim().toUpperCase(),
        type: isTrailer ? 'trailer' : 'tractor',
        brandModel: r['Nhãn Hiệu & Dòng Xe'] || r['model'] || (isTrailer ? 'Rơ-moóc Tân Thanh' : 'Xe đầu kéo'),
        manufactureYear: Number(r['Năm Sản Xuất'] || r['year']) || 2022,
        currentOdoKm: Number(r['Odometer (KM)'] || r['odo']) || 100000,
        assignedDriver: r['Tài Xế Phụ Trách'] || r['driver'] || undefined,
        status: 'active'
      };
    });

    onImportVehicles(imported);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Danh Mục Phương Tiện &amp; Giám Sát Odometer Đội Xe
              </h2>
              <p className="text-xs text-slate-500">
                Thêm mới, sửa, xóa, Import/Export Excel đội xe đầu kéo, rơ-moóc và theo dõi số KM
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingVehicleObj(null);
                setNewPlate('');
                setNewModel('');
                setNewDriver('');
                setIsVehicleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Xe / Rơ-Moóc</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Import Excel</span>
            </button>

            <button
              onClick={handleExportVehiclesExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Vehicle list filters */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo biển số (VD: 50H-048.53, 51R...), dòng xe..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setVehicleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vehicleFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tất cả ({vehicles.length})
            </button>
            <button
              onClick={() => setVehicleFilter('tractor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vehicleFilter === 'tractor'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Đầu Kéo ({vehicles.filter(v => v.type === 'tractor').length})
            </button>
            <button
              onClick={() => setVehicleFilter('trailer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vehicleFilter === 'trailer'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Rơ-Moóc ({vehicles.filter(v => v.type === 'trailer').length})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bảng Danh Mục
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thẻ &amp; Giám Sát
            </button>
          </div>
        </div>
      </div>

      {/* RENDER TABLE VIEW MODE */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold">
                  <th className="p-3">Biển Số Xe</th>
                  <th className="p-3">Loại Phương Tiện</th>
                  <th className="p-3">Nhãn Hiệu &amp; Model</th>
                  <th className="p-3">Năm SX</th>
                  <th className="p-3 text-right">Odometer (KM)</th>
                  <th className="p-3">Tài Xế Phụ Trách</th>
                  <th className="p-3">Linh Kiện Lắp</th>
                  <th className="p-3">Trạng Thái</th>
                  <th scope="col" className="catalog-actions-cell">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVehicles.map(veh => {
                  const mounted = mountedComponents.filter(c => c.vehicleId === veh.id);
                  const overdueCount = mounted.filter(c => {
                    const wear = calculateComponentWear(c, veh);
                    return wear.urgency === 'critical';
                  }).length;

                  return (
                    <tr key={veh.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <span className="font-mono font-bold text-xs text-slate-900 px-2 py-0.5 bg-slate-100 rounded border border-slate-300">
                          {veh.plateNumber}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          veh.type === 'tractor' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {veh.type === 'tractor' ? 'Xe Đầu Kéo' : 'Rơ-Moóc'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{veh.brandModel}</td>
                      <td className="p-3 text-slate-500">{veh.manufactureYear}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-sans tabular-nums text-right font-bold text-slate-900">{formatNumber(veh.currentOdoKm)} KM</span>
                          <button
                            onClick={() => handleOpenOdoModal(veh)}
                            title="Cập nhật ODO"
                            className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">{veh.assignedDriver || '-'}</td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            setSelectedVehicleId(veh.id);
                            setViewMode('split');
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                            overdueCount > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {mounted.length} linh kiện {overdueCount > 0 ? `(${overdueCount} quá hạn)` : ''}
                        </button>
                      </td>
                      <td className="p-3">
                        <StatusBadge value={veh.status} />
                      </td>
                      <td className="catalog-actions-cell">
                    <div className="catalog-actions">
                          <button
                            onClick={() => {
                              setSelectedVehicleId(veh.id);
                              setViewMode('split');
                            }}
                            title="Xem chi tiết linh kiện xe"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditVehicle(veh)}
                            title="Sửa thông tin xe"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition cursor-pointer border border-amber-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(veh.id)}
                            title="Xóa phương tiện"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer border border-rose-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenNewTxModal('OUT', undefined, veh.id)}
                            title="Xuất vật tư thay thế cho xe"
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-xs"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      /* Main Split Layout: Left Vehicle Selector / Right Mounted Details */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Fleet List (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Danh Sách Phương Tiện ({filteredVehicles.length})
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {filteredVehicles.map(veh => {
              const isSelected = selectedVehicle?.id === veh.id;
              const mounted = mountedComponents.filter(c => c.vehicleId === veh.id);
              const overdueCount = mounted.filter(c => {
                const wear = calculateComponentWear(c, veh);
                return wear.urgency === 'critical';
              }).length;

              return (
                <div
                  key={veh.id}
                  onClick={() => setSelectedVehicleId(veh.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/60 border-amber-400 shadow-xs ring-1 ring-amber-400/50'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 px-2 py-0.5 bg-slate-100 rounded border border-slate-300">
                          {veh.plateNumber}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          veh.type === 'tractor' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {veh.type === 'tractor' ? 'Đầu Kéo' : 'Rơ-Moóc'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 font-semibold mt-1">
                        {veh.brandModel}
                      </div>
                      {veh.assignedDriver && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tài xế: {veh.assignedDriver}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditVehicle(veh);
                        }}
                        title="Sửa xe"
                        className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-amber-700 border border-slate-200 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVehicle(veh.id);
                        }}
                        title="Xóa xe"
                        className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Gauge className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-sans tabular-nums text-right font-bold">{formatNumber(veh.currentOdoKm)} KM</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenOdoModal(veh);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Cập nhật ODO</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Vehicle Details & Mounted Parts (8 cols) */}
        <div className="lg:col-span-8">
          {selectedVehicle ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-xl text-slate-900 px-3 py-1 bg-slate-100 rounded-lg border border-slate-300">
                      {selectedVehicle.plateNumber}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                      selectedVehicle.type === 'tractor' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {selectedVehicle.type === 'tractor' ? 'Xe Đầu Kéo' : 'Rơ-Moóc'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 mt-1.5">
                    <strong>{selectedVehicle.brandModel}</strong> &bull; Đời xe: {selectedVehicle.manufactureYear}
                  </div>
                  {selectedVehicle.assignedDriver && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Lái xe phụ trách: <span className="text-slate-800 font-medium">{selectedVehicle.assignedDriver}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="text-xs text-slate-500">ODO hiện tại</div>
                    <div className="text-lg font-sans tabular-nums text-right font-bold text-slate-900">
                      {formatNumber(selectedVehicle.currentOdoKm)} KM
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenOdoModal(selectedVehicle)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-amber-700 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Cập nhật ODO"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEditVehicle(selectedVehicle)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Sửa thông tin xe"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenNewTxModal('OUT', undefined, selectedVehicle.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Xuất Thay Thế</span>
                  </button>
                </div>
              </div>

              {/* Mounted Parts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Linh Kiện Đang Lắp Trên Xe ({vehicleComponents.length})
                  </h3>
                </div>

                {vehicleComponents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs">Chưa có lịch sử lắp phụ tùng nào cho xe này.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vehicleComponents.map(comp => {
                      const wear = calculateComponentWear(comp, selectedVehicle);
                      const isCritical = wear.urgency === 'critical';
                      const isWarning = wear.urgency === 'warning';

                      return (
                        <div
                          key={comp.id}
                          className={`p-4 rounded-xl border transition ${
                            isCritical ? 'bg-rose-50/50 border-rose-200' : isWarning ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-amber-700 font-bold">{comp.sku}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">Vị trí: {comp.mountPosition}</span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 mt-1">{comp.partName}</h4>
                              <div className="text-[11px] text-slate-500 mt-1">
                                ODO lúc lắp: {formatNumber(comp.mountOdoKm)} KM &bull; Đã chạy: <strong>{formatNumber(wear.kmUsed)} KM</strong>
                              </div>
                            </div>
                            <StatusBadge label={wear.urgencyText + ' (' + wear.maxPercentage + '%)'} tone={isCritical ? 'danger' : isWarning ? 'warning' : 'success'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400">
              Chọn phương tiện để xem chi tiết
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modal Thêm / Sửa Xe */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <span>{editingVehicleObj ? 'Chỉnh Sửa Thông Tin Phương Tiện' : 'Thêm Phương Tiện Mới'}</span>
            </h3>

            <form onSubmit={handleSaveVehicleForm} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loại phương tiện:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="tractor">Xe Đầu Kéo</option>
                    <option value="trailer">Rơ-Moóc</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Biển số xe *:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 50H-048.53"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nhãn hiệu &amp; Dòng xe:</label>
                <input
                  type="text"
                  placeholder="VD: Howo Sitrak 440, Tân Thanh 40ft..."
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số ODO (KM):</label>
                  <input
                    type="number"
                    min="0"
                    value={newOdo}
                    onChange={(e) => setNewOdo(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Năm sản xuất:</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tài xế phụ trách:</label>
                <input
                  type="text"
                  placeholder="VD: Hoàng Văn Huy"
                  value={newDriver}
                  onChange={(e) => setNewDriver(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  {editingVehicleObj ? 'Cập Nhật Phương Tiện' : 'Tạo Phương Tiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cập Nhật ODO */}
      {editingOdoVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-amber-600" />
              <span>Cập Nhật Số Odometer Mới</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Xe: <strong className="text-slate-900 font-mono">{editingOdoVehicle.plateNumber}</strong>
            </p>

            <form onSubmit={handleSaveOdo} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số KM Odometer Hiện Tại:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={newOdoValue}
                    onChange={(e) => setNewOdoValue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-sans tabular-nums text-right font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">KM</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOdoVehicle(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs cursor-pointer border border-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  Lưu &amp; Cập Nhật ODO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Excel Phương Tiện */}
      <DirectoryExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Danh Mục Phương Tiện (Đầu Kéo & Rơ-Moóc)"
        sampleFormat={"Biển Số Xe\tLoại Phương Tiện\tNhãn Hiệu & Dòng Xe\tOdometer (KM)\tTài Xế Phụ Trách\n50H-999.88\tXe Đầu Kéo\tHowo Sitrak 440\t120000\tNguyễn Văn A\n51R-888.99\tRơ-Moóc\tTân Thanh 40ft\t95000\tĐi kèm 50H-999.88"}
        onImportRows={handleImportVehicles}
      />
    </div>
  );
};
