import {CatalogHistoryButton} from './CatalogHistoryDrawer';
import { searchIncludes } from '../../shared/searchText';
import { VIETNAM_PROVINCES } from '../../shared/vietnamProvinces';
import { MenuIcon } from './MenuIcon';
import { StatusBadge } from './StatusBadge';
import React, { useState } from 'react';
import { 
  AlertCircle, 
  Clock, 
  Users, 
  Building2, 
  ShoppingBag, 
  Wifi, 
  Fuel, 
  UserCheck, 
  Sliders, 
  History, 
  Truck, 
  DollarSign, 
  FileText, 
  Wrench, 
  Plus, 
  Download, 
  Upload, 
  ShieldCheck, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  Search 
} from 'lucide-react';
import { Vehicle, InventoryTransaction } from '../types/inventory';
import { formatNumber, formatVND, formatDate, exportToCSV } from '../utils/inventoryUtils';
import { DirectoryExcelImportModal } from './DirectoryExcelImportModal';
import type { DirectoryControl } from './ConnectedDirectory';

interface EnterpriseSectionsViewProps {
  sectionId: string;
  vehicles: Vehicle[];
  transactions: InventoryTransaction[];
  onOpenNewTx: (type: any) => void;
  directory?: DirectoryControl;
}

export const EnterpriseSectionsView: React.FC<EnterpriseSectionsViewProps> = ({
  sectionId,
  vehicles,
  transactions,
  onOpenNewTx,
  directory
}) => {
  // 1. Not Ready Reports
  const NOT_READY_SECTIONS: Record<string, string> = {
    'cp_vt_tb_cty': 'Chi Phí VT-TB Công Ty',
    'cp_vt_tb_mua_ngoai': 'Chi Phí VT-TB Mua Ngoài',
    'cp_sua_chua_ngoai': 'Chi Phí Sửa Chữa Ngoài',
    'cp_gia_cong_chu_dong': 'Chi Phí Gia Công, Sửa Chữa Chủ Động'
  };

  if (NOT_READY_SECTIONS[sectionId]) {
    const title = NOT_READY_SECTIONS[sectionId];
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h2>
        <div className="mt-3 inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold">
          Báo cáo này chưa sẵn sàng
        </div>
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          Phân hệ đang được hoàn thiện định dạng dữ liệu kế toán chi phí theo cấu trúc quy chuẩn. Dữ liệu sẽ tự động khả dụng khi hệ thống kích hoạt module chi phí này.
        </p>
      </div>
    );
  }

  // Common Search query
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // --- STATE FOR DANH MỤC NHÂN SỰ ---
  const [localStaffList, setStaffList] = useState(() => {
    if (directory) return [];
    try {
      const saved = localStorage.getItem('fleetpro_dm_nhansu');
      return saved ? JSON.parse(saved) : [
        { id: 'ns-1', name: 'Lê Đại Minh', email: 'ledaiminh1996@gmail.com', role: 'Thủ kho kiêm Quản trị hệ thống', phone: '0988.123.456', dept: 'Bộ phận Quản lý Kho VT-TB', vehicle: '', trailer: '', status: 'active' },
        { id: 'ns-2', name: 'Nguyễn Thị Thuý', email: 'nguyenthuy060882@gmail.com', role: 'Kế toán kho vật tư & cấp dầu', phone: '0977.654.321', dept: 'Phòng Kế toán Vật tư', vehicle: '', trailer: '', status: 'active' },
        { id: 'ns-3', name: 'Hoàng Văn Huy', role: 'Lái xe đầu kéo', vehicle: '50H-048.53', trailer: '51R-254.81', phone: '0912.111.222', dept: 'Đội xe đường dài', status: 'active' },
        { id: 'ns-4', name: 'Nguyễn Văn Kha', role: 'Lái xe đầu kéo', vehicle: '50E-085.50', trailer: '51R-503.34', phone: '0912.333.444', dept: 'Đội xe đường dài', status: 'active' },
        { id: 'ns-5', name: 'Trần Minh Tuấn', role: 'Lái xe đầu kéo', vehicle: '50H-045.43', trailer: '51R-093.05', phone: '0912.555.666', dept: 'Đội xe đường dài', status: 'active' },
        { id: 'ns-6', name: 'Nguyễn Thành Đôn', role: 'Lái xe đầu kéo', vehicle: '50E-858.25', trailer: '50R-048.78', phone: '0912.777.888', dept: 'Đội xe đường dài', status: 'active' },
        { id: 'ns-7', name: 'Nguyễn Đình Sĩ', role: 'Lái xe đầu kéo', vehicle: '50H-091.40', trailer: '51R-271.81', phone: '0913.111.999', dept: 'Đội xe đường dài', status: 'active' },
        { id: 'ns-8', name: 'Trần Trung Hiếu', role: 'Lái xe đầu kéo', vehicle: '50H-048.95', trailer: '51R-270.96', phone: '0913.222.888', dept: 'Đội xe máy lạnh', status: 'active' },
        { id: 'ns-9', name: 'Giản Tư Tâm', role: 'Lái xe đầu kéo', vehicle: '50H-110.99', trailer: '51R-047.31', phone: '0913.333.777', dept: 'Đội xe đường dài', status: 'active' }
      ];
    } catch {
      return [];
    }
  });

  const staffList = directory?.resource === 'staff' ? directory.rows : localStaffList;
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);

  const handleSaveStaffList = async (updated: any[]) => {
    if (directory) return directory.saveList(updated);
    setStaffList(updated);
    localStorage.setItem('fleetpro_dm_nhansu', JSON.stringify(updated));
  };

  const handleDeleteStaff = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhân sự này khỏi danh mục?')) {
      void handleSaveStaffList(staffList.filter((s: any) => s.id !== id)).catch(() => {});
    }
  };

  const handleExportStaffExcel = () => {
    const headers = [
      { key: 'name', label: 'Họ Và Tên' },
      { key: 'role', label: 'Chức Danh' },
      { key: 'dept', label: 'Bộ Phận' },
      { key: 'vehicle', label: 'Xe Đầu Kéo' },
      { key: 'trailer', label: 'Rơ-Moóc' },
      { key: 'phone', label: 'Số Điện Thoại' },
      { key: 'email', label: 'Email' }
    ];
    exportToCSV(`Danh_Muc_Nhan_Su_${new Date().toISOString().slice(0, 10)}`, staffList, headers);
  };

  const handleImportStaff = (rows: Record<string, string>[]) => {
    const imported = rows.map((r, i) => ({
      id: `ns-imp-${Date.now()}-${i}`,
      name: r['Họ Và Tên'] || r['name'] || 'Nhân sự',
      role: r['Chức Danh'] || r['role'] || 'Lái xe',
      dept: r['Bộ Phận'] || r['dept'] || 'Đội xe',
      vehicle: r['Xe Đầu Kéo'] || r['vehicle'] || '',
      trailer: r['Rơ-Moóc'] || r['trailer'] || '',
      phone: r['Số Điện Thoại'] || r['phone'] || '',
      email: r['Email'] || r['email'] || '',
      status: 'active'
    }));
    handleSaveStaffList([...staffList, ...imported]);
  };

  // --- STATE FOR DANH MỤC KHO ---
  const [localWarehouseList, setWarehouseList] = useState(() => {
    if (directory) return [];
    try {
      const saved = localStorage.getItem('fleetpro_dm_kho');
      return saved ? JSON.parse(saved) : [
        { id: 'k-1', code: 'BON1-KHODAU', name: 'Bồn Chứa Dầu Số 1', type: 'Bồn dầu DO', capacity: '25,000 Lít', current: '16,250 Lít', location: 'Trạm trung tâm', status: 'Hoạt động' },
        { id: 'k-2', code: 'BON2-KHODAU', name: 'Bồn Chứa Dầu Số 2', type: 'Bồn dầu DO', capacity: '25,000 Lít', current: '18,750 Lít', location: 'Trạm trung tâm', status: 'Hoạt động' },
        { id: 'k-3', code: 'KHO-LOP-A', name: 'Kho Bãi Vỏ Lốp Xe Đầu Kéo & Rơ-Moóc', type: 'Kho phụ tùng nặng', capacity: '250 Quả lốp', current: '18 Quả', location: 'Bãi xe Trung Tâm', status: 'Hoạt động' },
        { id: 'k-4', code: 'KHO-DAU-6', name: 'Trạm Cấp Dầu Lưu Động Kho Dầu 6', type: 'Bồn téc dã chiến', capacity: '10,000 Lít', current: '4,200 Lít', location: 'Trạm tiếp vận số 6', status: 'Hoạt động' },
        { id: 'k-5', code: 'KHO-DAU-7', name: 'Trạm Cấp Dầu Lưu Động Kho Dầu 7', type: 'Bồn téc dã chiến', capacity: '10,000 Lít', current: '3,800 Lít', location: 'Trạm tiếp vận số 7', status: 'Hoạt động' },
        { id: 'k-6', code: 'KHO-DAU-2', name: 'Trạm Cấp Dầu Lưu Động Kho Dầu 2', type: 'Bồn téc dã chiến', capacity: '10,000 Lít', current: '5,100 Lít', location: 'Trạm tiếp vận số 2', status: 'Hoạt động' }
      ];
    } catch {
      return [];
    }
  });

  const warehouseList = directory?.resource === 'warehouses' ? directory.rows : localWarehouseList;
  const [editingWarehouse, setEditingWarehouse] = useState<any | null>(null);
  const [isWarehouseFormOpen, setIsWarehouseFormOpen] = useState(false);

  const handleSaveWarehouseList = async (updated: any[]) => {
    if (directory) return directory.saveList(updated);
    setWarehouseList(updated);
    localStorage.setItem('fleetpro_dm_kho', JSON.stringify(updated));
  };

  const handleDeleteWarehouse = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa kho này?')) {
      void handleSaveWarehouseList(warehouseList.filter((w: any) => w.id !== id)).catch(() => {});
    }
  };

  const handleExportWarehouseExcel = () => {
    const headers = [
      { key: 'code', label: 'Mã Kho / Bồn' },
      { key: 'name', label: 'Tên Kho' },
      { key: 'type', label: 'Loại Kho' },
      { key: 'capacity', label: 'Sức Chứa' },
      { key: 'current', label: 'Tồn Thực Tế' },
      { key: 'location', label: 'Vị Trí' },
      { key: 'status', label: 'Trạng Thái' }
    ];
    exportToCSV(`Danh_Muc_Kho_${new Date().toISOString().slice(0, 10)}`, warehouseList, headers);
  };

  const handleImportWarehouse = (rows: Record<string, string>[]) => {
    const imported = rows.map((r, i) => ({
      id: `k-imp-${Date.now()}-${i}`,
      code: r['Mã Kho / Bồn'] || r['code'] || `KHO-${i}`,
      name: r['Tên Kho'] || r['name'] || 'Kho phụ tùng',
      type: r['Loại Kho'] || r['type'] || 'Kho hàng',
      capacity: r['Sức Chứa'] || r['capacity'] || '10,000',
      current: r['Tồn Thực Tế'] || r['current'] || '0',
      location: r['Vị Trí'] || r['location'] || 'Kho Trung Tâm',
      status: 'Hoạt động'
    }));
    handleSaveWarehouseList([...warehouseList, ...imported]);
  };

  // --- STATE FOR DANH MỤC NHÀ CUNG CẤP ---
  const [localSupplierList, setSupplierList] = useState(() => {
    if (directory) return [];
    try {
      const saved = localStorage.getItem('fleetpro_dm_ncc');
      return saved ? JSON.parse(saved) : [
        { id: 'ncc-1', name: 'Tổng Công Ty Dầu Petrolimex', items: 'Dầu DO 0.05S-II, Dầu Mazut', contact: '0237.3888.999', address: 'Trạm phân phối nhiên liệu' },
        { id: 'ncc-2', name: 'Công Ty TNHH Lốp Xe Bridgestone Việt Nam', items: 'Vỏ lốp 12R22.5 R150, 11R22.5 gai xuôi', contact: '028.3822.4567', address: 'TP. Hồ Chí Minh' },
        { id: 'ncc-3', name: 'Công Ty CP Cao Su Miền Nam (Casumina)', items: 'Vỏ lốp 11R22.5 GS201, 12R22.5', contact: '028.3855.1234', address: 'Bình Dương' },
        { id: 'ncc-4', name: 'Công Ty Cổ Phần Cao Su Đà Nẵng (DRC)', items: 'Vỏ lốp rơ-moóc 12R22.5 D601, lốp đắp', contact: '0236.3771.888', address: 'Đà Nẵng' },
        { id: 'ncc-5', name: 'Đại Lý Dầu Nhớt Hải Phát (Mobil / Castrol)', items: 'Dầu nhớt động cơ Mobil 15W40, Castrol 85W140', contact: '0912.345.678', address: 'Hải Phòng' },
        { id: 'ncc-6', name: 'Nhà Phân Phối Phụ Tùng Fleetguard / Wabco', items: 'Ruột lọc nhớt LF9009, ruột lọc sấy khí Wabco', contact: '0903.888.777', address: 'Hà Nội' },
        { id: 'ncc-7', name: 'Công Ty CP Cơ Khí Tân Thanh & Fuwa', items: 'Bố thắng trục Fuwa 420x180, búp sen T30/30, tang trống', contact: '028.3731.4444', address: 'TP. Thủ Đức' }
      ];
    } catch {
      return [];
    }
  });

  const supplierList = directory?.resource === 'suppliers' ? directory.rows : localSupplierList;
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [supplierSaveError,setSupplierSaveError] = useState('');

  const handleSaveSupplierList = async (updated: any[]) => {
    if (directory) return directory.saveList(updated);
    setSupplierList(updated);
    localStorage.setItem('fleetpro_dm_ncc', JSON.stringify(updated));
  };

  const handleDeleteSupplier = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhà cung cấp này?')) {
      void handleSaveSupplierList(supplierList.filter((s: any) => s.id !== id)).catch(() => {});
    }
  };

  const handleExportSupplierExcel = () => {
    if (directory?.exportAll) { void directory.exportAll(); return; }
    const headers = [
      { key: 'name', label: 'Tên Nhà Cung Cấp' },
      { key: 'items', label: 'Mặt Hàng Cung Ứng' },
      { key: 'code', label: 'Mã NCC' },
      { key: 'tax_code', label: 'Mã số thuế' },
      { key: 'province_name', label: 'Tỉnh/Thành phố' },
      { key: 'address', label: 'Địa Chỉ' }
    ];
    exportToCSV(`Danh_Muc_Nha_Cung_Cap_${new Date().toISOString().slice(0, 10)}`, supplierList, headers);
  };

  const handleImportSupplier = (rows: Record<string, string>[]) => {
    const imported = rows.map((r, i) => ({
      id: `ncc-imp-${Date.now()}-${i}`,
      name: r['Tên Nhà Cung Cấp'] || r['name'] || 'Nhà cung cấp',
      items: r['Mặt Hàng Cung Ứng'] || r['items'] || 'Phụ tùng',
      contact: r['Điện Thoại'] || r['contact'] || '',
      address: r['Địa Chỉ'] || r['address'] || ''
    }));
    handleSaveSupplierList([...supplierList, ...imported]);
  };

  // --- RENDER DANH MỤC NHÂN SỰ ---
  if (sectionId === 'dm_nhan_su') {
    const filteredStaff = staffList.filter((s: any) => 
      searchIncludes(s.name,searchQuery) ||
      (s.vehicle && searchIncludes(s.vehicle,searchQuery)) ||
      (s.phone && searchIncludes(s.phone,searchQuery))
    );

    return (
      <div className="catalog-page space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MenuIcon menuId="dm_nhan_su" className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Danh Mục Nhân Sự &amp; Lái Xe
              </h2>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={!!directory && !directory.canEdit} onClick={() => { setEditingStaff(null);
                setIsStaffFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Nhân Sự</span>
            </button>

            <button
              disabled={!!directory}
              title={directory ? "Nhập hàng loạt chưa khả dụng" : undefined}
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Import Excel</span>
            </button>

            <button
              onClick={handleExportStaffExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên nhân sự, biển số xe phụ trách, số điện thoại..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
          <table className="catalog-table w-max min-w-full table-auto whitespace-nowrap text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold">
                <th className="p-3">Họ Và Tên</th>
                <th className="p-3">Chức Danh / Vị Trí</th>
                <th className="p-3">Bộ Phận</th>
                <th className="p-3">Xe / Rơ-Moóc Phụ Trách</th>
                <th className="p-3">Liên Hệ</th>
                <th className="catalog-cell-center p-3">Trạng thái</th>
                <th scope="col" className="catalog-actions-cell">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStaff.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition">
                  <td className="p-3 font-semibold text-slate-900">{s.name}</td>
                  <td className="p-3 text-slate-700">{s.role}</td>
                  <td className="p-3 text-slate-500">{s.dept}</td>
                  <td className="p-3">
                    {s.vehicle ? (
                      <span className="font-mono text-amber-700 font-bold">
                        {s.vehicle} {s.trailer ? `• ${s.trailer}` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Điều hành</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 font-sans text-[11px]">{s.phone || s.email || '-'}</td>
                  <td className="catalog-cell-center p-3"><StatusBadge value={s.status ?? 'active'} /></td>
                  <td className="catalog-actions-cell">
                    <div className="catalog-actions">
                      {directory?.onHistory&&<CatalogHistoryButton label={String(s.name)} onClick={()=>directory.onHistory?.(s.id)}/>}
                      <button
                        disabled={!!directory && !directory.canEdit} onClick={() => { setEditingStaff(s);
                          setIsStaffFormOpen(true);
                        }}
                        title="Sửa"
                        className="p-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={!!directory && !directory.canEdit} onClick={() => handleDeleteStaff(s.id)}
                        title="Xóa"
                        className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Thêm / Sửa Nhân sự */}
        {isStaffFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MenuIcon menuId="dm_nhan_su" className="text-blue-600" />
                <span>{editingStaff ? 'Chỉnh Sửa Nhân Sự' : 'Thêm Nhân Sự Mới'}</span>
              </h3>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget.elements as HTMLFormControlsCollection & Record<string, HTMLInputElement>;
                const updatedObj = {
                  id: editingStaff ? editingStaff.id : `ns-${Date.now()}`,
                  name: form.staffName.value,
                  role: form.staffRole.value,
                  dept: form.staffDept.value,
                  vehicle: form.staffVehicle.value,
                  trailer: form.staffTrailer.value,
                  phone: form.staffPhone.value,
                  email: form.staffEmail.value,
                  status: 'active'
                };
                if (directory && !directory.canEdit) return;
                try {
                if (editingStaff) {
                  await handleSaveStaffList(staffList.map((s: any) => s.id === editingStaff.id ? updatedObj : s));
                } else {
                  await handleSaveStaffList([updatedObj, ...staffList]);
                }
                setIsStaffFormOpen(false);
                } catch { /* Server error is shown above the directory; keep the form open. */ }
              }} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Họ Và Tên *:</label>
                  <input type="text" required name="staffName" defaultValue={editingStaff?.name || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Chức Danh:</label>
                    <input type="text" name="staffRole" defaultValue={editingStaff?.role || 'Lái xe đầu kéo'} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bộ Phận:</label>
                    <input type="text" name="staffDept" defaultValue={editingStaff?.dept || 'Đội xe'} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Xe Đầu Kéo:</label>
                    <input type="text" name="staffVehicle" placeholder="VD: 50H-048.53" defaultValue={editingStaff?.vehicle || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rơ-Moóc:</label>
                    <input type="text" name="staffTrailer" placeholder="VD: 51R-254.81" defaultValue={editingStaff?.trailer || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Điện Thoại:</label>
                    <input type="text" name="staffPhone" defaultValue={editingStaff?.phone || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email:</label>
                    <input type="email" name="staffEmail" defaultValue={editingStaff?.email || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsStaffFormOpen(false)} className="min-h-9 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold border border-slate-200 cursor-pointer">Hủy</button>
                  <button type="submit" disabled={!!directory && !directory.canEdit} className="min-h-9 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm shadow-xs cursor-pointer">Lưu Nhân Sự</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <DirectoryExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Danh Mục Nhân Sự"
          sampleFormat={"Họ Và Tên\tChức Danh\tBộ Phận\tXe Đầu Kéo\tRơ-Moóc\tSố Điện Thoại\nNguyễn Văn A\tLái xe\tĐội xe\t50H-123.45\t51R-678.90\t0912345678"}
          onImportRows={handleImportStaff}
        />
      </div>
    );
  }

  // --- RENDER DANH MỤC KHO ---
  if (sectionId === 'dm_kho') {
    const filteredWarehouse = warehouseList.filter((w: any) => 
      searchIncludes(w.name,searchQuery) ||
      searchIncludes(w.code,searchQuery)
    );

    return (
      <div className="catalog-page space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MenuIcon menuId="dm_kho" className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Danh Mục Hệ Thống Kho &amp; Bồn Chứa Dầu
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={!!directory && !directory.canEdit} onClick={() => { setEditingWarehouse(null);
                setIsWarehouseFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Kho / Bồn</span>
            </button>

            <button
              disabled={!!directory}
              title={directory ? "Nhập hàng loạt chưa khả dụng" : undefined}
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Import Excel</span>
            </button>

            <button
              onClick={handleExportWarehouseExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã kho, tên kho, loại bồn chứa hoặc vị trí..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Warehouse Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
          <div className="overflow-x-auto">
            <table className="catalog-table w-max min-w-full table-auto whitespace-nowrap text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold">
                  <th className="p-3">Mã Kho / Bồn</th>
                  <th className="p-3">Tên Kho / Bồn Chứa</th>
                  <th className="p-3">Loại Kho</th>
                  <th className="p-3 text-right">Sức Chứa Thiết Kế</th>
                  <th className="p-3 text-right">Tồn Kho Thực Tế</th>
                  <th className="p-3">Vị Trí / Địa Điểm</th>
                  <th className="catalog-cell-center p-3">Trạng Thái</th>
                  <th scope="col" className="catalog-actions-cell">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredWarehouse.map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3 font-mono font-bold text-amber-700">{w.code}</td>
                    <td className="p-3 font-semibold text-slate-900">{w.name}</td>
                    <td className="p-3 text-slate-700">{w.type}</td>
                    <td className="p-3 text-slate-500 font-sans tabular-nums text-right">{w.capacity}</td>
                    <td className="p-3 font-sans tabular-nums text-right font-bold text-emerald-700">{w.current}</td>
                    <td className="p-3 text-slate-500">{w.location}</td>
                    <td className="p-3">
                      <StatusBadge value={w.status || 'active'} />
                    </td>
                    <td className="catalog-actions-cell">
                    <div className="catalog-actions">
                        {directory?.onHistory&&<CatalogHistoryButton label={String(w.name)} onClick={()=>directory.onHistory?.(w.id)}/>}
                        <button
                          disabled={!!directory && !directory.canEdit} onClick={() => { setEditingWarehouse(w); setIsWarehouseFormOpen(true); }}
                          title="Sửa kho"
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={!!directory && !directory.canEdit} onClick={() => handleDeleteWarehouse(w.id)}
                          title="Xóa kho"
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Thêm / Sửa Kho */}
        {isWarehouseFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MenuIcon menuId="dm_kho" className="text-blue-600" />
                <span>{editingWarehouse ? 'Chỉnh Sửa Kho / Bồn' : 'Thêm Kho / Bồn Mới'}</span>
              </h3>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget.elements as HTMLFormControlsCollection & Record<string, HTMLInputElement>;
                const updatedObj = {
                  id: editingWarehouse ? editingWarehouse.id : `k-${Date.now()}`,
                  code: form.wCode.value,
                  name: form.wName.value,
                  type: form.wType.value,
                  capacity: form.wCapacity.value,
                  current: form.wCurrent.value,
                  location: form.wLoc.value,
                  status: 'Hoạt động'
                };
                if (directory && !directory.canEdit) return;
                try {
                if (editingWarehouse) {
                  await handleSaveWarehouseList(warehouseList.map((w: any) => w.id === editingWarehouse.id ? updatedObj : w));
                } else {
                  await handleSaveWarehouseList([updatedObj, ...warehouseList]);
                }
                setIsWarehouseFormOpen(false);
                } catch { /* Server error is shown above the directory; keep the form open. */ }
              }} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Kho / Bồn *:</label>
                  <input type="text" required name="wCode" defaultValue={editingWarehouse?.code || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Kho / Bồn *:</label>
                  <input type="text" required name="wName" defaultValue={editingWarehouse?.name || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Loại:</label>
                    <input type="text" name="wType" defaultValue={editingWarehouse?.type || 'Bồn dầu DO'} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Sức Chứa:</label>
                    <input type={directory ? "number" : "text"} step={directory ? "0.001" : undefined} min={directory ? "0.001" : undefined} name="wCapacity" defaultValue={editingWarehouse?.capacity || (directory ? "" : "25,000 Lít")} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tồn Thực Tế:</label>
                    <input readOnly={!!directory} type="text" name="wCurrent" defaultValue={editingWarehouse?.current || (directory ? 'Chưa kết nối sổ kho' : '10,000 Lít')} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans tabular-nums text-right text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Địa Điểm:</label>
                    <input type="text" name="wLoc" defaultValue={editingWarehouse?.location || 'Kho Trung Tâm'} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsWarehouseFormOpen(false)} className="min-h-9 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold border border-slate-200 cursor-pointer">Hủy</button>
                  <button type="submit" disabled={!!directory && !directory.canEdit} className="min-h-9 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm shadow-xs cursor-pointer">Lưu Kho</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <DirectoryExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Danh Mục Kho"
          sampleFormat={"Mã Kho / Bồn\tTên Kho\tLoại Kho\tSức Chứa\tTồn Thực Tế\tVị Trí\nBON3-KHODAU\tBồn Dầu Số 3\tBồn dầu DO\t20000 Lít\t15000 Lít\tKho Trung Tâm"}
          onImportRows={handleImportWarehouse}
        />
      </div>
    );
  }

  // --- RENDER DANH MỤC NHÀ CUNG CẤP ---
  if (sectionId === 'dm_ncc') {
    const filteredNCC = directory?.onSearch ? supplierList : supplierList.filter((item: any) => [item.code,item.name,item.items,item.tax_code,item.province_name].some(value => searchIncludes(value,searchQuery)));

    return (
      <div className="catalog-page space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MenuIcon menuId="dm_ncc" className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Danh Mục Nhà Cung Cấp
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={!!directory && !directory.canEdit} onClick={() => { setEditingSupplier(null); setSupplierSaveError('');
                setIsSupplierFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Nhà Cung Cấp</span>
            </button>

            <button
              disabled={directory?.exporting} onClick={handleExportSupplierExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>{directory?.exporting ? 'Đang xuất…' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={directory?.search ?? searchQuery}
            onChange={(e) => directory?.onSearch ? directory.onSearch(e.target.value) : setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã NCC, tên, mã số thuế hoặc tỉnh/thành phố..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="supplier-list-table bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
          <table className="catalog-table w-full min-w-[900px] table-fixed text-left text-xs border-collapse">
            <colgroup><col className="w-[9%]" /><col className="w-[23%]" /><col className="w-[13%]" /><col className="w-[12%]" /><col className="w-[19%]" /><col className="w-[11%]" /><col className="w-[13%]" /></colgroup>
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold">
                <th className="px-2 py-3">Mã NCC</th>
                <th className="px-2 py-3">Tên Nhà Cung Cấp</th>
                <th className="px-2 py-3">Mã số thuế</th>
                <th className="px-2 py-3">Tỉnh/Thành phố</th>
                <th className="px-2 py-3">Địa Chỉ</th>
                <th className="catalog-cell-center px-2 py-3">Trạng thái</th>
                <th scope="col" className="catalog-actions-cell !px-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredNCC.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition">
                  <td className="whitespace-nowrap px-2 py-3 font-mono font-bold text-amber-700">{s.code || '—'}</td>
                  <td title={s.name} className="whitespace-normal break-words px-2 py-3 font-semibold leading-5 text-slate-900">{s.name}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-slate-500 font-mono">{s.tax_code || '—'}</td>
                  <td className="px-2 py-3">{s.province_name || '—'}</td>
                  <td title={s.address} className="whitespace-normal break-words px-2 py-3 leading-5 text-slate-500">{s.address}</td>
                  <td className="catalog-cell-center px-2 py-3"><StatusBadge value={s.is_active ?? 1} /></td>
                  <td className="catalog-actions-cell !px-2">
                    <div className="catalog-actions">
                      {directory?.onHistory&&<CatalogHistoryButton label={String(s.name)} onClick={()=>directory.onHistory?.(s.id)}/>}
                      <button disabled={!!directory && !directory.canEdit} onClick={() => { setEditingSupplier(s); setSupplierSaveError(''); setIsSupplierFormOpen(true); }} className="p-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button disabled={(!!directory && !directory.canEdit) || !!s.is_linked} title={s.is_linked ? "NCC đã có phát sinh, không được xóa" : "Xóa NCC"} onClick={() => handleDeleteSupplier(s.id)} className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Thêm / Sửa NCC */}
        {isSupplierFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MenuIcon menuId="dm_ncc" className="text-blue-600" />
                <span>{editingSupplier ? 'Chỉnh Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</span>
              </h3>

              <form onSubmit={async (e) => {
                e.preventDefault(); setSupplierSaveError('');
                const form = e.currentTarget.elements as HTMLFormControlsCollection & Record<string, HTMLInputElement>;
                const updatedObj = {
                  id: editingSupplier ? editingSupplier.id : `ncc-${Date.now()}`,
                  name: form.nccName.value,
                  items: form.nccItems.value,
                  code: form.nccCode.value,
                  tax_code: form.nccTax.value,
                  province_name: form.nccProvince.value,
                  address: form.nccAddress.value
                };
                if (directory && !directory.canEdit) return;
                try {
                if (editingSupplier) {
                  await handleSaveSupplierList(supplierList.map((s: any) => s.id === editingSupplier.id ? updatedObj : s));
                } else {
                  await handleSaveSupplierList([updatedObj, ...supplierList]);
                }
                setIsSupplierFormOpen(false);
                } catch(failure) { setSupplierSaveError(failure instanceof Error ? failure.message : 'Chưa lưu được nhà cung cấp.'); }
              }} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="ncc-code" className="block text-xs font-semibold text-slate-700 mb-1">Mã NCC *:</label>
                  <input id="ncc-code" name="nccCode" readOnly required pattern="NCC[0-9]{5}" defaultValue={editingSupplier?.code || directory?.supplierCodePreview || ('NCC' + String(Math.max(0,...supplierList.filter((item:any)=>/^NCC[0-9]{5}$/.test(item.code??'')).map((item:any)=>Number(item.code.slice(3))))+1).padStart(5,'0'))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  <p className="mt-1 text-[11px] text-slate-500">Mã được cấp tự động khi lưu.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Nhà Cung Cấp *:</label>
                  <input type="text" required name="nccName" defaultValue={editingSupplier?.name || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mặt Hàng Cung Ứng:</label>
                  <input type="text" name="nccItems" defaultValue={editingSupplier?.items || ''} placeholder="VD: Lốp xe, dầu nhớt, lọc..." className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                <div>
                  <label htmlFor="ncc-tax" className="block text-xs font-semibold text-slate-700 mb-1">Mã số thuế:</label>
                  <input id="ncc-tax" name="nccTax" maxLength={256} defaultValue={editingSupplier?.tax_code || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                <div>
                  <label htmlFor="ncc-province" className="block text-xs font-semibold text-slate-700 mb-1">Tỉnh/Thành phố:</label>
                  <select id="ncc-province" name="nccProvince" defaultValue={editingSupplier?.province_name || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                    <option value="">Chưa có thông tin</option>
                    {VIETNAM_PROVINCES.map(province=><option key={province} value={province}>{province}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Địa chỉ (Không nhập tỉnh/thành phố ở đây):</label>
                  <input type="text" name="nccAddress" defaultValue={editingSupplier?.address || ''} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                </div>
                {supplierSaveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{supplierSaveError}</p>}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsSupplierFormOpen(false)} className="min-h-9 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold border border-slate-200 cursor-pointer">Hủy</button>
                  <button type="submit" disabled={!!directory && !directory.canEdit} className="min-h-9 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm shadow-xs cursor-pointer">Lưu Nhà Cung Cấp</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 6. Theo Dõi Sim Data GPS
  if (sectionId === 'td_sim_data') {
    const simList = vehicles.filter(v => v.type === 'tractor').slice(0, 15).map((v, idx) => ({
      vehiclePlate: v.plateNumber,
      driver: v.assignedDriver || 'Lái xe',
      simNumber: `098${Math.floor(1000000 + idx * 777123)}`,
      carrier: 'Viettel 4G IoT Fleet',
      gpsDevice: 'Thiết Bị Giám Sát Hành Trình VG-400',
      dataPlan: 'Gói 12 tháng không giới hạn',
      currentKm: v.currentOdoKm,
      status: 'Online (Đang phát sóng)'
    }));

    return (
      <div className="catalog-page space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MenuIcon menuId="td_sim_data" className="text-purple-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Theo Dõi Sim Data &amp; Thiết Bị Giám Sát Hành Trình
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Quản lý số SIM 4G, hạn cước truyền dữ liệu GPS và đồng bộ số KM di chuyển thực tế của đầu kéo
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 font-bold rounded-lg border border-purple-200">
              {simList.length} thiết bị GPS
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
          <table className="catalog-table w-max min-w-full table-auto whitespace-nowrap text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold">
                <th className="p-3">Biển Số Xe</th>
                <th className="p-3">Lái Xe Phụ Trách</th>
                <th className="p-3">Số Điện Thoại SIM 4G</th>
                <th className="p-3">Nhà Mạng &amp; Gói Cước</th>
                <th className="p-3">Model Thiết Bị GPS</th>
                <th className="p-3 text-right">Odometer Thực Tế</th>
                <th className="p-3 text-center">Trạng Thái Tín Hiệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {simList.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="p-3 font-mono font-bold text-amber-700">{s.vehiclePlate}</td>
                  <td className="p-3 font-semibold text-slate-900">{s.driver}</td>
                  <td className="p-3 font-sans text-slate-600">{s.simNumber}</td>
                  <td className="p-3 text-slate-500">{s.carrier} • {s.dataPlan}</td>
                  <td className="p-3 text-slate-500">{s.gpsDevice}</td>
                  <td className="p-3 text-right font-sans tabular-nums font-bold text-slate-900">{formatNumber(s.currentKm)} KM</td>
                  <td className="p-3 text-center">
                    <StatusBadge value={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 7. Người Dùng, Phân Quyền
  if (sectionId === 'ht_users' || sectionId === 'ht_quy_trinh' || sectionId === 'ht_lich_su') {
    return (
      <div className="catalog-page space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              Quản Trị Người Dùng &amp; Phân Quyền Hệ Thống
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập vai trò, quyền lập duyệt phiếu xuất/nhập kho và giám sát lịch sử truy cập
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-700">Tài Khoản Quản Trị</span>
            <div className="font-bold text-sm text-slate-900">Lê Đại Minh</div>
            <div className="text-xs font-sans text-slate-500">ledaiminh1996@gmail.com</div>
            <div className="pt-2 text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Toàn quyền Admin (Full Access)
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-blue-700">Kế Toán Kho Vật Tư</span>
            <div className="font-bold text-sm text-slate-900">Nguyễn Thị Thuý</div>
            <div className="text-xs font-sans text-slate-500">nguyenthuy060882@gmail.com</div>
            <div className="pt-2 text-[11px] text-blue-700 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Quyền Lập Phiếu &amp; Khóa Kỳ Sổ Sách
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500">Đội Lái Xe &amp; Thợ Kỹ Thuật</span>
            <div className="font-bold text-sm text-slate-900">Hơn 50+ Bác Tài &amp; Thợ Sửa Chữa</div>
            <div className="text-xs text-slate-500">Truy cập giao diện đề xuất &amp; ký nhận</div>
            <div className="pt-2 text-[11px] text-slate-600 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Xem phiếu xuất &amp; gửi đề xuất
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs shadow-xs">
      Đang hiển thị mục: <strong>{sectionId}</strong>.
    </div>
  );
};
