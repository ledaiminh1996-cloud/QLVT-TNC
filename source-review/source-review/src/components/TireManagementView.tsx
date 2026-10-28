import { searchIncludes, normalizeSearch } from '../../shared/searchText';
import { MenuIcon } from './MenuIcon';
import { StatusBadge } from './StatusBadge';
import React, { useState, useMemo } from 'react';
import { 
  Disc, 
  RotateCw, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Search, 
  Download, 
  Truck, 
  Layers, 
  Wrench, 
  History, 
  FileText, 
  DollarSign 
} from 'lucide-react';
import { TireDetail, Vehicle, SparePart } from '../types/inventory';
import { formatNumber, formatDate, exportToCSV } from '../utils/inventoryUtils';

export const INITIAL_TIRES: TireDetail[] = [
  {
    serialNumber: 'BS-882901-2025',
    brand: 'Bridgestone R150',
    size: '12R22.5',
    status: 'running',
    currentVehiclePlate: '50H-048.53',
    currentPosition: 'Trục 1 Dẫn Hướng Lái (FL - Trước Trái)',
    mountDate: '2025-11-20',
    mountOdoKm: 210000,
    currentKmRun: 78500,
    retreadCount: 0,
    treadDepthMm: 4.5,
    notes: 'Lốp nguyên bản ban đầu, mòn đều'
  },
  {
    serialNumber: 'BS-882902-2025',
    brand: 'Bridgestone R150',
    size: '12R22.5',
    status: 'running',
    currentVehiclePlate: '50H-048.53',
    currentPosition: 'Trục 1 Dẫn Hướng Lái (FR - Trước Phải)',
    mountDate: '2025-11-20',
    mountOdoKm: 210000,
    currentKmRun: 78500,
    retreadCount: 0,
    treadDepthMm: 4.2,
    notes: 'Lốp dẫn hướng'
  },
  {
    serialNumber: 'CAS-11R-9041',
    brand: 'Casumina GS201',
    size: '11R22.5',
    status: 'running',
    currentVehiclePlate: '50H-110.99',
    currentPosition: 'Cầu Láp Sau 1 Bên Phụ (RR1 Ngoài)',
    mountDate: '2026-03-10',
    mountOdoKm: 965000,
    currentKmRun: 81598,
    retreadCount: 0,
    treadDepthMm: 2.8,
    notes: 'Độ sâu gai còn 2.8mm, khẩn cấp đảo xuống trục moóc hoặc gửi đắp vỏ'
  },
  {
    serialNumber: 'DRC-12R-5531-D1',
    brand: 'DRC D601 (Đắp vỏ Lần 1)',
    size: '12R22.5',
    status: 'retreaded',
    currentVehiclePlate: '51R-254.81',
    currentPosition: 'Trục 2 Rơ-Moóc Tân Thanh (Bên Lái)',
    mountDate: '2026-05-15',
    mountOdoKm: 140000,
    currentKmRun: 42000,
    retreadCount: 1,
    treadDepthMm: 7.5,
    notes: 'Vỏ đắp lần 1 chạy trục rơ-moóc rất êm và tiết kiệm'
  },
  {
    serialNumber: 'MC-295-7729',
    brand: 'Michelin X Multiway',
    size: '295/80R22.5',
    status: 'running',
    currentVehiclePlate: '51D-308.50',
    currentPosition: 'Trục Dẫn Hướng Lái',
    mountDate: '2026-01-15',
    mountOdoKm: 260000,
    currentKmRun: 55000,
    retreadCount: 0,
    treadDepthMm: 6.8,
    notes: 'Gai lốp còn tốt'
  },
  {
    serialNumber: 'CAS-12R-3310-RE',
    brand: 'Casumina 12R22.5',
    size: '12R22.5',
    status: 'recovered',
    currentPosition: 'Kho Vỏ Thu Hồi - Chờ Đắp Vỏ',
    currentKmRun: 95000,
    retreadCount: 0,
    treadDepthMm: 1.8,
    notes: 'Thu hồi từ xe 50H-045.43, mòn đều đủ tiêu chuẩn gửi xưởng đắp'
  }
];

interface TireManagementViewProps {
  vehicles: Vehicle[];
}

export const TireManagementView: React.FC<TireManagementViewProps> = ({ vehicles }) => {
  const [tires, setTires] = useState<TireDetail[]>(() => {
    try {
      const saved = localStorage.getItem('fleetpro_tires');
      return saved ? JSON.parse(saved) : INITIAL_TIRES;
    } catch {
      return INITIAL_TIRES;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalMode, setModalMode] = useState<'add' | 'rotate' | 'retread' | null>(null);
  const [selectedTire, setSelectedTire] = useState<TireDetail | null>(null);

  // Form states
  const [newSerial, setNewSerial] = useState('');
  const [newBrand, setNewBrand] = useState('Bridgestone R150');
  const [newSize, setNewSize] = useState('12R22.5');
  const [newPlate, setNewPlate] = useState(vehicles[0]?.plateNumber || '50H-048.53');
  const [newPos, setNewPos] = useState('Trục 1 Dẫn Hướng (FL)');
  const [newDepth, setNewDepth] = useState('14.0');

  // Rotate Form States
  const [targetVehicle, setTargetVehicle] = useState(vehicles[0]?.plateNumber || '');
  const [targetPosition, setTargetPosition] = useState('Trục Rơ-Moóc (Bên Lái)');
  const [measuredDepth, setMeasuredDepth] = useState('');

  const handleSaveTires = (newTires: TireDetail[]) => {
    setTires(newTires);
    localStorage.setItem('fleetpro_tires', JSON.stringify(newTires));
  };

  const filteredTires = useMemo(() => {
    return tires.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (searchQuery) {
        const q = normalizeSearch(searchQuery.trim());
        const m1 = searchIncludes(t.serialNumber,q);
        const m2 = searchIncludes(t.brand,q);
        const m3 = searchIncludes(t.currentVehiclePlate,q);
        if (!m1 && !m2 && !m3) return false;
      }
      return true;
    });
  }, [tires, filterStatus, searchQuery]);

  // Rotate Action
  const handleConfirmRotate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTire) return;

    const updated = tires.map(t => {
      if (t.serialNumber === selectedTire.serialNumber) {
        return {
          ...t,
          currentVehiclePlate: targetVehicle,
          currentPosition: targetPosition,
          treadDepthMm: measuredDepth ? Number(measuredDepth) : t.treadDepthMm,
          notes: `${t.notes || ''} | Đảo vỏ sang ${targetVehicle} (${targetPosition}) ngày ${new Date().toLocaleDateString('vi-VN')}`
        };
      }
      return t;
    });

    handleSaveTires(updated);
    setModalMode(null);
    setSelectedTire(null);
  };

  // Send for Retread
  const handleSendRetread = (tire: TireDetail) => {
    if (window.confirm(`Xác nhận gửi lốp seri ${tire.serialNumber} đi đắp vỏ công nghệ cao?`)) {
      const updated = tires.map(t => {
        if (t.serialNumber === tire.serialNumber) {
          return {
            ...t,
            status: 'retreaded' as const,
            retreadCount: t.retreadCount + 1,
            treadDepthMm: 9.0,
            brand: `${tire.brand} (Đắp lần ${t.retreadCount + 1})`,
            currentPosition: 'Kho Vỏ Đắp - Sẵn sàng lắp trục moóc',
            notes: `${t.notes || ''} | Đã đắp vỏ lần ${t.retreadCount + 1} ngày ${new Date().toLocaleDateString('vi-VN')}`
          };
        }
        return t;
      });
      handleSaveTires(updated);
    }
  };

  // Add New Tire
  const handleAddNewTire = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim()) return;

    const newTire: TireDetail = {
      serialNumber: newSerial.trim().toUpperCase(),
      brand: newBrand,
      size: newSize,
      status: 'running',
      currentVehiclePlate: newPlate,
      currentPosition: newPos,
      mountDate: new Date().toISOString().slice(0, 10),
      currentKmRun: 0,
      retreadCount: 0,
      treadDepthMm: Number(newDepth),
      notes: 'Lốp mới nhập kho lắp đặt'
    };

    handleSaveTires([newTire, ...tires]);
    setModalMode(null);
    setNewSerial('');
  };

  const handleExportCSV = () => {
    const headers = [
      { key: 'serial', label: 'Số Seri Lốp' },
      { key: 'brand', label: 'Thương Hiệu & Quy Cách' },
      { key: 'size', label: 'Kích Cỡ' },
      { key: 'plate', label: 'Xe Đang Lắp' },
      { key: 'pos', label: 'Vị Trí Trục Lắp' },
      { key: 'kmRun', label: 'Số KM Đã Chạy' },
      { key: 'retread', label: 'Số Lần Đắp Vỏ' },
      { key: 'tread', label: 'Độ Sâu Gai (mm)' },
      { key: 'status', label: 'Tình Trạng' }
    ];

    const rows = filteredTires.map(t => ({
      serial: t.serialNumber,
      brand: t.brand,
      size: t.size,
      plate: t.currentVehiclePlate || 'Trong Kho',
      pos: t.currentPosition || '-',
      kmRun: t.currentKmRun,
      retread: t.retreadCount > 0 ? `Đắp Lần ${t.retreadCount}` : 'Vỏ Mới 100%',
      tread: t.treadDepthMm ? `${t.treadDepthMm} mm` : '-',
      status: t.status === 'running' ? 'Đang chạy' : t.status === 'retreaded' ? 'Đã đắp vỏ' : t.status === 'recovered' ? 'Thu hồi chờ đắp' : 'Thanh lý'
    }));

    exportToCSV(`So_Theo_Doi_Vo_Lop_Xe_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <MenuIcon menuId="td_vo_odo" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Sổ Quản Lý &amp; Đảo Vỏ Lốp Xe
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Chuẩn Nghiệp Vụ
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Theo dõi từng số seri lốp, độ sâu gai lốp, định mức đảo vỏ và quy trình gửi đắp vỏ tiết kiệm chi phí
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Sổ Vỏ (Excel)</span>
            </button>
            <button
              onClick={() => setModalMode('add')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Khai Báo Seri Lốp Mới</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo số seri lốp, biển số xe, hãng lốp..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">-- Tất cả trạng thái vỏ ({tires.length}) --</option>
              <option value="running">Đang chạy trên xe ({tires.filter(t => t.status === 'running').length})</option>
              <option value="retreaded">Vỏ đã đắp tái sử dụng ({tires.filter(t => t.status === 'retreaded').length})</option>
              <option value="recovered">Thu hồi bãi chờ đắp ({tires.filter(t => t.status === 'recovered').length})</option>
              <option value="scrapped">Đã thanh lý phế liệu</option>
            </select>
          </div>

          <div className="text-right text-xs text-slate-500 flex items-center justify-end">
            <span>Đang hiển thị <strong>{filteredTires.length}</strong> quả lốp theo dõi</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Tổng Vỏ Lốp Theo Dõi</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-sans tabular-nums text-right">
            {tires.length} <span className="text-xs font-normal text-slate-500">quả</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Gồm Bridgestone, Michelin, Casumina, DRC
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Vỏ Đắp Tái Sử Dụng</span>
          <div className="mt-1 text-2xl font-bold text-amber-700 font-sans tabular-nums text-right">
            {tires.filter(t => t.retreadCount > 0).length} <span className="text-xs font-normal text-slate-500">quả</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Tiết kiệm ~45% chi phí lốp mới
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Cảnh Báo Gai Mòn (&lt; 3mm)</span>
          <div className="mt-1 text-2xl font-bold text-rose-700 font-sans tabular-nums text-right">
            {tires.filter(t => t.treadDepthMm && t.treadDepthMm < 3).length} <span className="text-xs font-normal text-slate-500">quả</span>
          </div>
          <div className="text-[11px] text-rose-600 mt-1">
            Cần lên lịch đảo hoặc đắp vỏ ngay
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Định Mức Đảo Vỏ Định Kỳ</span>
          <div className="mt-1 text-2xl font-bold text-blue-700 font-sans tabular-nums text-right">
            30.000 <span className="text-xs font-normal text-slate-500">KM</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Chuyển từ trục lái xuống trục moóc
          </div>
        </div>
      </div>

      {/* Main Tires Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                <th className="py-3 px-3">Số Seri Lốp</th>
                <th className="py-3 px-3">Hãng Lốp &amp; Quy Cách</th>
                <th className="py-3 px-2 text-center">Kích Cỡ</th>
                <th className="py-3 px-3">Xe &amp; Vị Trí Trục Lắp</th>
                <th className="py-3 px-2 text-right">KM Đã Chạy</th>
                <th className="py-3 px-2 text-right">Độ Sâu Gai</th>
                <th className="py-3 px-2 text-right">Số Lần Đắp</th>
                <th className="py-3 px-3 text-center">Tình Trạng</th>
                <th className="py-3 px-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTires.map(tire => {
                const isWorn = tire.treadDepthMm && tire.treadDepthMm < 3.0;

                return (
                  <tr key={tire.serialNumber} className={`hover:bg-slate-50/70 transition ${isWorn ? 'bg-rose-50/30' : ''}`}>
                    <td className="py-3 px-3 font-mono font-bold text-amber-700 text-xs">
                      {tire.serialNumber}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">
                        {tire.brand}
                      </div>
                      {tire.notes && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[220px]">
                          {tire.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-2 text-center font-sans text-slate-600">
                      {tire.size}
                    </td>

                    <td className="py-3 px-3">
                      {tire.currentVehiclePlate ? (
                        <div>
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300">
                            {tire.currentVehiclePlate}
                          </span>
                          <div className="text-[11px] text-slate-700 mt-1">
                            {tire.currentPosition}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">{tire.currentPosition || 'Trong kho'}</span>
                      )}
                    </td>

                    <td className="py-3 px-2 text-right font-sans tabular-nums font-bold text-slate-900">
                      {formatNumber(tire.currentKmRun)} KM
                    </td>

                    <td className="py-3 px-2 font-sans tabular-nums text-right">
                      {tire.treadDepthMm ? (
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          isWorn ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'text-slate-700'
                        }`}>
                          {tire.treadDepthMm} mm
                        </span>
                      ) : '-'}
                    </td>

                    <td className="py-3 px-2 font-sans tabular-nums text-right">
                      {tire.retreadCount > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Đắp Lần {tire.retreadCount}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Vỏ Mới</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <StatusBadge value={tire.status} />
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedTire(tire);
                            setTargetVehicle(tire.currentVehiclePlate || vehicles[0]?.plateNumber || '');
                            setTargetPosition('Trục Rơ-Moóc (Bên Lái)');
                            setMeasuredDepth(tire.treadDepthMm?.toString() || '');
                            setModalMode('rotate');
                          }}
                          title="Lập phiếu đảo vị trí lốp"
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-semibold border border-amber-200 cursor-pointer"
                        >
                          <RotateCw className="w-3 h-3 inline mr-0.5" />
                          <span>Đảo</span>
                        </button>

                        <button
                          onClick={() => handleSendRetread(tire)}
                          title="Gửi đắp vỏ công nghệ cao"
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold border border-blue-200 cursor-pointer"
                        >
                          <Wrench className="w-3 h-3 inline mr-0.5" />
                          <span>Đắp</span>
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

      {/* MODAL 1: ĐẢO VỎ LỐP */}
      {modalMode === 'rotate' && selectedTire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-amber-600" />
              <span>Lập Phiếu Đảo Vị Trí Vỏ Lốp</span>
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Số Seri: <strong className="text-amber-700 font-mono">{selectedTire.serialNumber}</strong> ({selectedTire.brand})
            </p>

            <form onSubmit={handleConfirmRotate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Xe đích chuyển đến:</label>
                <select
                  value={targetVehicle}
                  onChange={(e) => setTargetVehicle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.plateNumber}>
                      {v.plateNumber} ({v.type === 'tractor' ? 'Đầu kéo' : 'Moóc'} - {v.brandModel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vị trí trục mới:</label>
                <select
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Trục 2 Rơ-Moóc (Bên Lái Ngoài)">Trục 2 Rơ-Moóc (Bên Lái Ngoài)</option>
                  <option value="Trục 2 Rơ-Moóc (Bên Lái Trong)">Trục 2 Rơ-Moóc (Bên Lái Trong)</option>
                  <option value="Trục 3 Rơ-Moóc (Bên Phụ Ngoài)">Trục 3 Rơ-Moóc (Bên Phụ Ngoài)</option>
                  <option value="Trục Cầu Láp Sau 1 (Bên Phụ)">Trục Cầu Láp Sau 1 (Bên Phụ)</option>
                  <option value="Trục Cầu Láp Sau 2 (Bên Lái)">Trục Cầu Láp Sau 2 (Bên Lái)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Độ sâu gai đo thực tế (mm):</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="VD: 3.5"
                  value={measuredDepth}
                  onChange={(e) => setMeasuredDepth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  Lưu &amp; Cập Nhật Đảo Vỏ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: KHAI BÁO SERI LỐP MỚI */}
      {modalMode === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              <span>Khai Báo Seri Lốp Mới Vào Đội Xe</span>
            </h3>

            <form onSubmit={handleAddNewTire} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số Seri Dập Trên Lốp *:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: BS-992810-2026"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Thương hiệu:</label>
                  <select
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Bridgestone R150">Bridgestone R150</option>
                    <option value="Casumina GS201">Casumina GS201</option>
                    <option value="DRC D601">DRC D601</option>
                    <option value="Michelin X Multi">Michelin X Multi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kích cỡ:</label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="12R22.5">12R22.5</option>
                    <option value="11R22.5">11R22.5</option>
                    <option value="295/80R22.5">295/80R22.5</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Xe lắp đặt:</label>
                <select
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.plateNumber}>
                      {v.plateNumber} ({v.type === 'tractor' ? 'Đầu kéo' : 'Moóc'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vị trí lắp:</label>
                  <input
                    type="text"
                    value={newPos}
                    onChange={(e) => setNewPos(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Độ sâu gai ban đầu (mm):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDepth}
                    onChange={(e) => setNewDepth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  Tạo Seri Lốp Mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
