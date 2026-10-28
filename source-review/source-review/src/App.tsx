import {AppEntrance} from "./components/AppEntrance";
import React, { useState, useEffect } from 'react';
import { 
  INITIAL_PARTS, 
  INITIAL_VEHICLES, 
  INITIAL_TRANSACTIONS, 
  INITIAL_MOUNTED_COMPONENTS 
} from './data/initialData';
import { 
  SparePart, 
  Vehicle, 
  InventoryTransaction, 
  MountedComponent, 
  TransactionType 
} from './types/inventory';
import { computeInventoryBalance, exportToCSV } from './utils/inventoryUtils';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardAlerts } from './components/DashboardAlerts';
import { StockBalanceTable } from './components/StockBalanceTable';
import { TransactionHistoryView } from './components/TransactionHistoryView';
import { FleetMountedManager } from './components/FleetMountedManager';
import { MaintenanceReport } from './components/MaintenanceReport';
import { CatalogListView } from './components/CatalogListView';
import { FuelManagementView } from './components/FuelManagementView';
import { TireManagementView } from './components/TireManagementView';
import { EnterpriseSectionsView } from './components/EnterpriseSectionsView';
import { TransactionFormModal } from './components/TransactionFormModal';
import { TransactionReceiptModal } from './components/TransactionReceiptModal';
import { PartCatalogModal } from './components/PartCatalogModal';
import { PartStockCardModal } from './components/PartStockCardModal';
import { ProjectDataImportModal } from './components/ProjectDataImportModal';
import { PeriodLockModal } from './components/PeriodLockModal';
import { CloudCatalogApp } from './components/CloudCatalogApp';

const STORAGE_KEYS = {
  PARTS: 'fleetpro_parts_v4_tnc',
  VEHICLES: 'fleetpro_vehicles_v4_tnc',
  TXS: 'fleetpro_txs_v4_tnc',
  MOUNTED: 'fleetpro_mounted_v4_tnc'
};

export default function App() {
  const [source, setSource] = useState<'cloud' | 'local'>('cloud');
  const [entered,setEntered]=useState(false);
  useEffect(()=>{const setup=()=>{if(new URLSearchParams(window.location.hash.slice(1)).has('setup'))setEntered(false)};window.addEventListener('hashchange',setup);return()=>window.removeEventListener('hashchange',setup)},[]);
  if(source==='cloud'&&!entered)return <AppEntrance onEnter={()=>setEntered(true)}/>;
  if (source === 'cloud') return <CloudCatalogApp webapp onOpenLocal={() => setSource('local')} />;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
      <span><strong>Dữ liệu trên máy</strong> · Các thay đổi ở đây chưa được lưu lên database Cloudflare.</span>
      <button className="rounded-lg border border-amber-600 px-3 py-1.5 font-bold hover:bg-amber-200" onClick={() => setSource('cloud')}>Mở dữ liệu tập trung</button>
    </div>
    <LocalApp />
  </>;
}

function LocalApp() {
  // Navigation State with the 8 requested groups
  const [activeMenuId, setActiveMenuId] = useState<string>('tong_quan');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core Data States with LocalStorage Cache
  const [parts, setParts] = useState<SparePart[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTS);
      return saved ? JSON.parse(saved) : INITIAL_PARTS;
    } catch {
      return INITIAL_PARTS;
    }
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VEHICLES);
      return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
    } catch {
      return INITIAL_VEHICLES;
    }
  });

  const [transactions, setTransactions] = useState<InventoryTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TXS);
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [mountedComponents, setMountedComponents] = useState<MountedComponent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MOUNTED);
      return saved ? JSON.parse(saved) : INITIAL_MOUNTED_COMPONENTS;
    } catch {
      return INITIAL_MOUNTED_COMPONENTS;
    }
  });

  // Persist to LocalStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PARTS, JSON.stringify(parts));
    } catch (e) {
      console.error(e);
    }
  }, [parts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    } catch (e) {
      console.error(e);
    }
  }, [vehicles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(transactions));
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MOUNTED, JSON.stringify(mountedComponents));
    } catch (e) {
      console.error(e);
    }
  }, [mountedComponents]);

  // Modal States
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('OUT');
  const [selectedPartIdForTx, setSelectedPartIdForTx] = useState<string | undefined>();
  const [selectedVehicleIdForTx, setSelectedVehicleIdForTx] = useState<string | undefined>();

  const [selectedReceiptTx, setSelectedReceiptTx] = useState<InventoryTransaction | null>(null);

  const [isPartCatalogModalOpen, setIsPartCatalogModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);

  const [viewingStockCardPart, setViewingStockCardPart] = useState<SparePart | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPeriodLockOpen, setIsPeriodLockOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_sidebar_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarMinimize = () => {
    setIsSidebarMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('app_sidebar_minimized', String(next));
      } catch {}
      return next;
    });
  };

  // Compute live alerts count
  const lowStockCount = parts.filter(p => p.currentStock <= p.minStock).length;
  
  // Mounted critical wear count
  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));
  const criticalWearCount = mountedComponents.filter(c => {
    const v = vehicleMap.get(c.vehicleId);
    const currentOdo = v ? v.currentOdoKm : c.mountOdoKm;
    const kmUsed = Math.max(0, currentOdo - c.mountOdoKm);
    const kmLimit = c.lifespanKmLimit || 0;
    return kmLimit > 0 && kmUsed >= kmLimit;
  }).length;

  // Fuel transactions count
  const fuelTxCount = transactions.filter(tx => 
    tx.items.some(it => it.sku.includes('M-DC-TIEU-0020') || it.partName.toLowerCase().includes('dầu do'))
  ).length;

  // Live accounting values for period lock
  const currentClosingStockValue = parts.reduce((sum, p) => sum + (p.currentStock * p.avgCostPrice), 0);
  const totalInAmount = transactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.totalAmount, 0);
  const totalOutAmount = transactions.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.totalAmount, 0);

  // Open Transaction Modal
  const handleOpenNewTx = (type: TransactionType, defaultPartId?: string, defaultVehicleId?: string) => {
    setTxModalType(type);
    setSelectedPartIdForTx(defaultPartId);
    setSelectedVehicleIdForTx(defaultVehicleId);
    setIsTxModalOpen(true);
  };

  // Submit Transaction Handler
  const handleTransactionSubmit = (
    newTx: InventoryTransaction,
    updateVehicleOdo?: { vehicleId: string; newOdo: number },
    newMountedItems?: MountedComponent[]
  ) => {
    // 1. Add transaction
    setTransactions(prev => [newTx, ...prev]);

    // 2. Adjust stock levels
    setParts(prevParts => {
      return prevParts.map(part => {
        let delta = 0;
        newTx.items.forEach(it => {
          if (it.partId === part.id) {
            if (newTx.type === 'IN') {
              delta += it.quantity;
            } else {
              delta -= it.quantity;
            }
          }
        });

        if (delta !== 0) {
          const newStock = Math.max(0, part.currentStock + delta);
          return {
            ...part,
            currentStock: newStock
          };
        }
        return part;
      });
    });

    // 3. Update vehicle ODO if changed
    if (updateVehicleOdo) {
      setVehicles(prevVehs =>
        prevVehs.map(v =>
          v.id === updateVehicleOdo.vehicleId ? { ...v, currentOdoKm: updateVehicleOdo.newOdo } : v
        )
      );
    }

    // 4. Record mounted components if any
    if (newMountedItems && newMountedItems.length > 0) {
      setMountedComponents(prev => [...newMountedItems, ...prev]);
    }

    // Auto-open print preview receipt
    setSelectedReceiptTx(newTx);
  };

  // Update Vehicle Odometer
  const handleUpdateVehicleOdo = (vehicleId: string, newOdo: number) => {
    setVehicles(prev =>
      prev.map(v => (v.id === vehicleId ? { ...v, currentOdoKm: newOdo } : v))
    );
  };

  // Add new Vehicle
  const handleAddNewVehicle = (vehicle: Vehicle) => {
    setVehicles(prev => [vehicle, ...prev]);
  };

  // Edit Vehicle
  const handleEditVehicle = (updatedVehicle: Vehicle) => {
    setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
  };

  // Delete Vehicle
  const handleDeleteVehicle = (vehicleId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phương tiện này khỏi đội xe?')) {
      setVehicles(prev => prev.filter(v => v.id !== vehicleId));
      setMountedComponents(prev => prev.filter(c => c.vehicleId !== vehicleId));
    }
  };

  // Import Vehicles from Excel / CSV
  const handleImportVehicles = (imported: Vehicle[]) => {
    setVehicles(prev => {
      const existingPlates = new Set(prev.map(v => v.plateNumber.toUpperCase().trim()));
      const filtered = imported.filter(v => !existingPlates.has(v.plateNumber.toUpperCase().trim()));
      return [...filtered, ...prev];
    });
  };

  // Import Parts from Excel / CSV
  const handleImportParts = (imported: SparePart[]) => {
    setParts(prev => {
      const existingSkus = new Set(prev.map(p => p.sku.toUpperCase().trim()));
      const filtered = imported.filter(p => !existingSkus.has(p.sku.toUpperCase().trim()));
      return [...filtered, ...prev];
    });
  };

  // Save / Update Spare Part
  const handleSavePart = (part: SparePart) => {
    setParts(prev => {
      const exists = prev.some(p => p.id === part.id);
      if (exists) {
        return prev.map(p => (p.id === part.id ? part : p));
      } else {
        return [part, ...prev];
      }
    });
  };

  // Delete Spare Part
  const handleDeletePart = (partId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa mã phụ tùng này?')) {
      setParts(prev => prev.filter(p => p.id !== partId));
    }
  };

  // Batch import handler from CSV / JSON
  const handleImportBatchData = (newVehicles: Vehicle[], newTxs: InventoryTransaction[], fuelPart: SparePart) => {
    // Merge vehicles
    setVehicles(prev => {
      const existingPlates = new Set(prev.map(v => v.plateNumber));
      const added = newVehicles.filter(v => !existingPlates.has(v.plateNumber));
      return [...prev, ...added];
    });

    // Merge transactions (avoid duplicate receipt codes)
    setTransactions(prev => {
      const existingCodes = new Set(prev.map(t => t.code));
      const added = newTxs.filter(t => !existingCodes.has(t.code));
      return [...added, ...prev];
    });

    // Merge or update Fuel part
    setParts(prev => {
      const hasFuel = prev.some(p => p.id === fuelPart.id || p.sku === fuelPart.sku);
      if (hasFuel) {
        return prev.map(p => (p.id === fuelPart.id || p.sku === fuelPart.sku) ? fuelPart : p);
      }
      return [fuelPart, ...prev];
    });

    setActiveMenuId('td_dau_nhot');
  };

  // Export full stock balance to CSV
  const handleExportBalanceCSV = () => {
    const rows = computeInventoryBalance(parts, transactions);
    const headers = [
      { key: 'sku', label: 'Mã Vật Tư' },
      { key: 'name', label: 'Tên Phụ Tùng / Vật Tư' },
      { key: 'unit', label: 'ĐVT' },
      { key: 'specifications', label: 'Quy Cách' },
      { key: 'storageLocation', label: 'Vị Trí Kho' },
      { key: 'minStock', label: 'Tồn Tối Thiểu' },
      { key: 'openingStock', label: 'Tồn Đầu Kỳ' },
      { key: 'inQty', label: 'Nhập Trong Kỳ' },
      { key: 'inAmount', label: 'Giá Trị Nhập' },
      { key: 'outQty', label: 'Xuất Trong Kỳ' },
      { key: 'outAmount', label: 'Giá Trị Xuất' },
      { key: 'closingStock', label: 'Tồn Cuối Kỳ' },
      { key: 'closingAmount', label: 'Giá Trị Tồn Cuối' },
      { key: 'stockStatus', label: 'Trạng Thái' }
    ];

    exportToCSV(`So_Xuat_Nhap_Ton_${new Date().toISOString().slice(0, 10)}`, rows, headers);
  };

  // Reset to default sample fleet data
  const handleResetData = () => {
    if (window.confirm('Khôi phục lại toàn bộ dữ liệu dự án ban đầu của xe đầu kéo & rơ moóc?')) {
      setParts(INITIAL_PARTS);
      setVehicles(INITIAL_VEHICLES);
      setTransactions(INITIAL_TRANSACTIONS);
      setMountedComponents(INITIAL_MOUNTED_COMPONENTS);
      localStorage.removeItem(STORAGE_KEYS.PARTS);
      localStorage.removeItem(STORAGE_KEYS.VEHICLES);
      localStorage.removeItem(STORAGE_KEYS.TXS);
      localStorage.removeItem(STORAGE_KEYS.MOUNTED);
    }
  };

  // Handle Menu Actions like opening modals directly
  const handleSelectMenu = (menuId: string) => {
    if (menuId === 'ht_khoa_so') {
      setIsPeriodLockOpen(true);
      return;
    }
    if (menuId === 'ht_so_du_dau') {
      setIsImportModalOpen(true);
      return;
    }
    setActiveMenuId(menuId);
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* 1. ENTERPRISE SIDEBAR (THE EXACT 8-GROUP TREE) */}
      <Sidebar
        activeMenuId={activeMenuId}
        onSelectMenu={handleSelectMenu}
        lowStockCount={lowStockCount}
        criticalWearCount={criticalWearCount}
        fuelTxCount={fuelTxCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isMinimized={isSidebarMinimized}
        onToggleMinimize={handleToggleSidebarMinimize}
      />

      {/* 2. MAIN APPLICATION CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Bar */}
        <Header
          activeMenuId={activeMenuId}
          lowStockCount={lowStockCount}
          criticalWearCount={criticalWearCount}
          fuelTxCount={fuelTxCount}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenNewTxModal={handleOpenNewTx}
          onOpenNewPartModal={() => {
            setEditingPart(null);
            setIsPartCatalogModalOpen(true);
          }}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onOpenPeriodLock={() => setIsPeriodLockOpen(true)}
          onExportBalanceCSV={handleExportBalanceCSV}
          onResetData={handleResetData}
        />

        {/* View Router Based on exact activeMenuId */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* GROUP 1: TỔNG QUAN */}
          {activeMenuId === 'tong_quan' && (
            <DashboardAlerts
              parts={parts}
              vehicles={vehicles}
              mountedComponents={mountedComponents}
              onOpenNewTxModal={handleOpenNewTx}
              onNavigateToTab={(tab) => {
                if (tab === 'balance') setActiveMenuId('so_tong_hop_nxt');
                else if (tab === 'fleet') setActiveMenuId('dm_phuong_tien');
                else if (tab === 'maintenance_report') setActiveMenuId('bao_cao_quan_tri');
                else setActiveMenuId(tab);
              }}
            />
          )}

          {/* GROUP 2: DANH MỤC */}
          {(activeMenuId === 'dm_nhan_su' || activeMenuId === 'dm_kho' || activeMenuId === 'dm_ncc') && (
            <EnterpriseSectionsView
              sectionId={activeMenuId}
              vehicles={vehicles}
              transactions={transactions}
              onOpenNewTx={handleOpenNewTx}
            />
          )}

          {activeMenuId === 'dm_vt_tb' && (
            <CatalogListView
              parts={parts}
              onOpenNewPartModal={() => {
                setEditingPart(null);
                setIsPartCatalogModalOpen(true);
              }}
              onEditPart={(part) => {
                setEditingPart(part);
                setIsPartCatalogModalOpen(true);
              }}
              onDeletePart={handleDeletePart}
              onOpenStockCard={(part) => setViewingStockCardPart(part)}
              onOpenNewTxModal={handleOpenNewTx}
              onImportParts={handleImportParts}
            />
          )}

          {activeMenuId === 'dm_phuong_tien' && (
            <FleetMountedManager
              vehicles={vehicles}
              mountedComponents={mountedComponents}
              parts={parts}
              onUpdateVehicleOdo={handleUpdateVehicleOdo}
              onOpenNewTxModal={handleOpenNewTx}
              onAddNewVehicle={handleAddNewVehicle}
              onEditVehicle={handleEditVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              onImportVehicles={handleImportVehicles}
            />
          )}

          {/* GROUP 3: CHỨNG TỪ KẾ TOÁN */}
          {activeMenuId.startsWith('ct_') && (
            <TransactionHistoryView
              transactions={transactions}
              onOpenReceipt={(tx) => setSelectedReceiptTx(tx)}
              onOpenNewTxModal={handleOpenNewTx}
            />
          )}

          {/* GROUP 4: SỔ SÁCH KẾ TOÁN */}
          {(activeMenuId === 'so_tong_hop_nxt' || activeMenuId === 'so_chi_tiet_nxt' || activeMenuId === 'so_theo_doi_kho') && (
            <StockBalanceTable
              parts={parts}
              transactions={transactions}
              onOpenNewTxModal={handleOpenNewTx}
              onOpenPartHistory={(part) => setViewingStockCardPart(part)}
            />
          )}

          {/* GROUP 5: CHI PHÍ VÀ QUẢN LÝ CHI PHÍ */}
          {activeMenuId.startsWith('cp_') && (
            <EnterpriseSectionsView
              sectionId={activeMenuId}
              vehicles={vehicles}
              transactions={transactions}
              onOpenNewTx={handleOpenNewTx}
            />
          )}

          {/* GROUP 6: BÁO CÁO QUẢN TRỊ */}
          {activeMenuId === 'bao_cao_quan_tri' && (
            <MaintenanceReport
              parts={parts}
              vehicles={vehicles}
              mountedComponents={mountedComponents}
              transactions={transactions}
              onOpenNewTxModal={handleOpenNewTx}
            />
          )}

          {/* GROUP 7: THEO DÕI VẬN HÀNH */}
          {activeMenuId === 'td_vo_odo' && (
            <TireManagementView
              vehicles={vehicles}
            />
          )}

          {activeMenuId === 'td_sim_data' && (
            <EnterpriseSectionsView
              sectionId="td_sim_data"
              vehicles={vehicles}
              transactions={transactions}
              onOpenNewTx={handleOpenNewTx}
            />
          )}

          {activeMenuId === 'td_dau_nhot' && (
            <FuelManagementView
              transactions={transactions}
              vehicles={vehicles}
              onOpenNewTxModal={handleOpenNewTx}
              onOpenReceipt={(tx) => setSelectedReceiptTx(tx)}
            />
          )}

          {activeMenuId === 'td_xem_phieu' && (
            <TransactionHistoryView
              transactions={transactions}
              onOpenReceipt={(tx) => setSelectedReceiptTx(tx)}
              onOpenNewTxModal={handleOpenNewTx}
            />
          )}

          {activeMenuId === 'td_tra_cuu_vt' && (
            <CatalogListView
              parts={parts}
              onOpenNewPartModal={() => {
                setEditingPart(null);
                setIsPartCatalogModalOpen(true);
              }}
              onEditPart={(part) => {
                setEditingPart(part);
                setIsPartCatalogModalOpen(true);
              }}
              onDeletePart={handleDeletePart}
              onOpenStockCard={(part) => setViewingStockCardPart(part)}
              onOpenNewTxModal={handleOpenNewTx}
              onImportParts={handleImportParts}
            />
          )}

          {activeMenuId === 'td_canh_bao' && (
            <MaintenanceReport
              parts={parts}
              vehicles={vehicles}
              mountedComponents={mountedComponents}
              transactions={transactions}
              onOpenNewTxModal={handleOpenNewTx}
            />
          )}

          {/* GROUP 8: HỆ THỐNG */}
          {activeMenuId.startsWith('ht_') && (
            <EnterpriseSectionsView
              sectionId={activeMenuId}
              vehicles={vehicles}
              transactions={transactions}
              onOpenNewTx={handleOpenNewTx}
            />
          )}
        </main>
      </div>

      {/* MODAL: KHÓA SỔ KẾ TOÁN KỲ (TNC KeToanKy) */}
      <PeriodLockModal
        isOpen={isPeriodLockOpen}
        onClose={() => setIsPeriodLockOpen(false)}
        currentClosingStockValue={currentClosingStockValue}
        totalInAmount={totalInAmount}
        totalOutAmount={totalOutAmount}
      />

      {/* MODAL: NHẬP DỮ LIỆU DỰ ÁN (CSV / JSON IMPORT) */}
      <ProjectDataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportData={handleImportBatchData}
      />

      {/* MODAL: LẬP PHIẾU NHẬP / XUẤT */}
      <TransactionFormModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        type={txModalType}
        parts={parts}
        vehicles={vehicles}
        defaultPartId={selectedPartIdForTx}
        defaultVehicleId={selectedVehicleIdForTx}
        onSubmit={handleTransactionSubmit}
      />

      {/* MODAL: XEM & IN PHIẾU CHUẨN (PRINTABLE RECEIPT) */}
      <TransactionReceiptModal
        transaction={selectedReceiptTx}
        onClose={() => setSelectedReceiptTx(null)}
      />

      {/* MODAL: THÊM / SỬA PHỤ TÙNG */}
      <PartCatalogModal
        isOpen={isPartCatalogModalOpen}
        onClose={() => setIsPartCatalogModalOpen(false)}
        initialPart={editingPart}
        onSavePart={handleSavePart}
      />

      {/* MODAL: THẺ KHO CHI TIẾT */}
      <PartStockCardModal
        part={viewingStockCardPart}
        transactions={transactions}
        onClose={() => setViewingStockCardPart(null)}
        onOpenReceipt={(tx) => setSelectedReceiptTx(tx)}
      />
    </div>
  );
}
