import { ThemeToggle } from './ThemeToggle';
import { navigationTrail } from './navigationTrail';
import React from 'react';
import { 
  PlusCircle, 
  FileSpreadsheet, 
  RotateCcw, 
  Upload, 
  Lock, 
  Menu,
  ChevronRight 
} from 'lucide-react';

interface HeaderProps {
  activeMenuId: string;
  accountAction?:React.ReactNode;
  hideReceiptCreate?: boolean;
  compactActions?:boolean;
  lowStockCount: number;
  criticalWearCount: number;
  fuelTxCount: number;
  onToggleMobileSidebar: () => void;
  onOpenNewTxModal: (type: 'IN' | 'OUT') => void;
  onOpenNewPartModal: () => void;
  onOpenImportModal: () => void;
  onOpenPeriodLock: () => void;
  onExportBalanceCSV: () => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMenuId,
  accountAction,
  hideReceiptCreate = false,
  compactActions=false,
  lowStockCount,
  criticalWearCount,
  fuelTxCount,
  onToggleMobileSidebar,
  onOpenNewTxModal,
  onOpenNewPartModal,
  onOpenImportModal,
  onOpenPeriodLock,
  onExportBalanceCSV,
  onResetData
}) => {
  const trail = navigationTrail[activeMenuId] ?? { group: 'HỆ THỐNG', label: 'Quản lý vật tư' };
  return (
    <header className="shrink-0 bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
          {/* Left: Mobile Toggle */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={onToggleMobileSidebar}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition border border-slate-200"
              title="Mở cây Menu nghiệp vụ"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Vị trí trang" className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">{trail.group}</span>
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <strong aria-current="page" title={trail.label} className="min-w-0 truncate text-sm font-black text-slate-900">{trail.label}</strong>
            </nav>
          </div>

          {/* Right Quick Actions */}
          <div className="flex max-w-full flex-wrap items-center gap-2 sm:gap-2.5">
            <ThemeToggle />
            {accountAction}
            {activeMenuId!=="ht_users"&&!compactActions&&<>
            <button
              onClick={onOpenImportModal}
              title="Nhập thêm dữ liệu từ file CSV hoặc JSON của dự án"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhập Dữ Liệu Dự Án</span>
              <span className="sm:hidden">Nhập CSV</span>
            </button>

            {!hideReceiptCreate&&<>
            <button
              onClick={() => onOpenNewTxModal('IN')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">+ Nhập Kho</span>
            </button>

            </>}
            {activeMenuId !== 'ct_xuat_kho' && <button
              onClick={() => onOpenNewTxModal('OUT')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">- Xuất Xe / Dầu</span>
            </button>}

            <button
              onClick={onOpenPeriodLock}
              title="Khóa sổ kế toán kỳ theo tháng"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden xl:inline">Khóa Sổ</span>
            </button>

            <button
              onClick={onExportBalanceCSV}
              title="Xuất bảng Xuất - Nhập - Tồn ra file Excel (CSV)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={onResetData}
              title="Khôi phục lại dữ liệu dự án ban đầu"
              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            </>}
          </div>
        </div>
      </div>
    </header>
  );
};
