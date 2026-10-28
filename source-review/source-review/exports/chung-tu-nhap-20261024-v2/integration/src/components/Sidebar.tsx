import React, { useState, useEffect, useMemo } from 'react';
import { MenuIcon } from './MenuIcon';
import { BarChart3, BookOpen, FileText, Layers, DollarSign, FileSpreadsheet, Activity, Settings, PanelLeftClose, X, PanelLeftOpen, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { TncLogo } from './TncLogo';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
  children?: MenuItem[];
  notReady?: boolean;
}

interface SidebarProps {
  showPairingCatalog?: boolean;
  activeMenuId: string;
  onSelectMenu: (menuId: string) => void;
  lowStockCount: number;
  criticalWearCount: number;
  fuelTxCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

const FAVORITES_KEY = 'app_favorite_menu_ids_v1';
const MAX_FAVORITES = 2;

export const Sidebar: React.FC<SidebarProps> = ({
  showPairingCatalog = false,
  activeMenuId,
  onSelectMenu,
  lowStockCount,
  criticalWearCount,
  fuelTxCount,
  isOpenMobile,
  onCloseMobile,
  isMinimized,
  onToggleMinimize
}) => {
  // State for expanded parent groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'menu_dm': true,
    'menu_ct': false,
    'menu_so': true,
    'menu_cp': false,
    'menu_td': true,
    'menu_ht': false
  });

  // State for favorite menus (max 2)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return [...new Set(parsed.filter((id): id is string => typeof id === 'string').map(id => id === 'dm_bon_dau' ? 'dm_kho' : id))].slice(0, MAX_FAVORITES);
        }
      }
    } catch {
      // fallback
    }
    return ['dm_vt_tb', 'so_tong_hop_nxt'];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleToggleFavorite = (e: React.MouseEvent, menuId: string) => {
    e.stopPropagation();
    if (favoriteIds.includes(menuId)) {
      setFavoriteIds(prev => prev.filter(id => id !== menuId));
    } else {
      if (favoriteIds.length >= MAX_FAVORITES) {
        setToastMessage(`Đã chọn tối đa ${MAX_FAVORITES} mục yêu thích. Bỏ chọn bớt 1 mục để đổi!`);
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      setFavoriteIds(prev => [...prev, menuId]);
    }
  };

  // Menu Groups without number prefixes
  const MENU_GROUPS: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    children?: MenuItem[];
    directId?: string;
  }> = useMemo(() => [
    {
      id: 'menu_tq',
      label: 'TỔNG QUAN',
      icon: <BarChart3 className="w-4 h-4 text-amber-600" />,
      directId: 'tong_quan'
    },
    {
      id: 'menu_dm',
      label: 'DANH MỤC',
      icon: <BookOpen className="w-4 h-4 text-blue-600" />,
      children: [
        { id: 'dm_nhan_su', label: 'Danh mục nhân sự', icon: <MenuIcon menuId="dm_nhan_su" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'dm_kho', label: 'Danh mục kho', icon: <MenuIcon menuId="dm_kho" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'dm_ncc', label: 'Danh mục nhà cung cấp', icon: <MenuIcon menuId="dm_ncc" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'dm_vt_tb', label: 'Danh mục VT-TB', icon: <MenuIcon menuId="dm_vt_tb" size={14} className="w-3.5 h-3.5 text-amber-600" />, badge: lowStockCount > 0 ? `${lowStockCount} thiếu` : undefined, badgeColor: 'bg-amber-100 text-amber-800' },
        { id: 'dm_phuong_tien', label: 'Danh mục phương tiện thiết bị', icon: <MenuIcon menuId="dm_phuong_tien" size={14} className="w-3.5 h-3.5 text-blue-600" /> },
        ...(showPairingCatalog ? [{ id: 'dm_ghep_thiet_bi', label: 'Ghép thiết bị', icon: <MenuIcon menuId="dm_ghep_thiet_bi" size={14} className="w-3.5 h-3.5 text-blue-600" /> }] : []),
        { id: 'dm_tham_so_pttb', label: 'Tham số phương tiện thiết bị', icon: <MenuIcon menuId="dm_tham_so_pttb" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'dm_ma_doi_tuong', label: 'Mã đối tượng VT-TB', icon: <MenuIcon menuId="dm_ma_doi_tuong" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'dm_ma_nhom', label: 'Mã nhóm VT-TB', icon: <MenuIcon menuId="dm_ma_nhom" size={14} className="w-3.5 h-3.5 text-slate-500" /> }
      ]
    },
    {
      id: 'menu_ct',
      label: 'CHỨNG TỪ KẾ TOÁN',
      icon: <FileText className="w-4 h-4 text-emerald-600" />,
      children: [
        { id: 'ct_de_xuat', label: 'Phiếu đề xuất VT-TB', icon: <MenuIcon menuId="ct_de_xuat" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'ct_nhap_kho', label: 'Phiếu nhập kho VT-TB', icon: <MenuIcon menuId="ct_nhap_kho" size={14} className="w-3.5 h-3.5 text-emerald-600" /> },
        { id: 'ct_xuat_kho', label: 'Phiếu xuất kho VT-TB', icon: <MenuIcon menuId="ct_xuat_kho" size={14} className="w-3.5 h-3.5 text-blue-600" /> },
        { id: 'ct_dieu_chuyen', label: 'Phiếu điều chuyển nội bộ', icon: <MenuIcon menuId="ct_dieu_chuyen" size={14} className="w-3.5 h-3.5 text-purple-600" /> },
        { id: 'ct_dao_vo_acquy', label: 'Phiếu đảo, điều chuyển vỏ xe, ắc quy', icon: <MenuIcon menuId="ct_dao_vo_acquy" size={14} className="w-3.5 h-3.5 text-amber-600" /> },
        { id: 'ct_thu_hoi', label: 'Phiếu nhập thu hồi VT-TB', icon: <MenuIcon menuId="ct_thu_hoi" size={14} className="w-3.5 h-3.5 text-orange-600" /> },
        { id: 'ct_thanh_ly', label: 'Phiếu thanh lý VT-TB', icon: <MenuIcon menuId="ct_thanh_ly" size={14} className="w-3.5 h-3.5 text-rose-600" /> },
        { id: 'ct_dap_vo', label: 'Phiếu đắp vỏ', icon: <MenuIcon menuId="ct_dap_vo" size={14} className="w-3.5 h-3.5 text-cyan-600" /> },
      ]
    },
    {
      id: 'menu_so',
      label: 'SỔ SÁCH KẾ TOÁN',
      icon: <Layers className="w-4 h-4 text-purple-600" />,
      children: [
        { id: 'so_theo_doi_kho', label: 'Sổ theo dõi kho', icon: <MenuIcon menuId="so_theo_doi_kho" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'so_chi_tiet_nxt', label: 'Sổ chi tiết NXT (Thẻ kho)', icon: <MenuIcon menuId="so_chi_tiet_nxt" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'so_tong_hop_nxt', label: 'Sổ tổng hợp NXT', icon: <MenuIcon menuId="so_tong_hop_nxt" size={14} className="w-3.5 h-3.5 text-amber-600" /> }
      ]
    },
    {
      id: 'menu_cp',
      label: 'CHI PHÍ VÀ QUẢN LÝ CHI PHÍ',
      icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
      children: [
        { id: 'cp_vt_tb_cty', label: 'Chi phí VT-TB công ty', icon: <MenuIcon menuId="cp_vt_tb_cty" size={14} className="w-3.5 h-3.5 text-slate-500" />, notReady: true },
        { id: 'cp_vt_tb_mua_ngoai', label: 'Chi phí VT-TB mua ngoài', icon: <MenuIcon menuId="cp_vt_tb_mua_ngoai" size={14} className="w-3.5 h-3.5 text-slate-500" />, notReady: true },
        { id: 'cp_sua_chua_ngoai', label: 'Chi phí sửa chữa ngoài', icon: <MenuIcon menuId="cp_sua_chua_ngoai" size={14} className="w-3.5 h-3.5 text-slate-500" />, notReady: true },
        { id: 'cp_gia_cong_chu_dong', label: 'Chi phí gia công, sửa chữa chủ động', icon: <MenuIcon menuId="cp_gia_cong_chu_dong" size={14} className="w-3.5 h-3.5 text-slate-500" />, notReady: true },
        { id: 'cp_dau_xe_thue', label: 'Chi phí dầu xe thuê ngoài', icon: <MenuIcon menuId="cp_dau_xe_thue" size={14} className="w-3.5 h-3.5 text-amber-600" /> }
      ]
    },
    {
      id: 'menu_bc',
      label: 'BÁO CÁO QUẢN TRỊ',
      icon: <FileSpreadsheet className="w-4 h-4 text-amber-600" />,
      directId: 'bao_cao_quan_tri'
    },
    {
      id: 'menu_td',
      label: 'THEO DÕI VẬN HÀNH',
      icon: <Activity className="w-4 h-4 text-cyan-600" />,
      children: [
        { id: 'td_vo_odo', label: 'Theo dõi vỏ/ODO', icon: <MenuIcon menuId="td_vo_odo" size={14} className="w-3.5 h-3.5 text-blue-600" /> },
        { id: 'td_sim_data', label: 'Theo dõi Sim Data', icon: <MenuIcon menuId="td_sim_data" size={14} className="w-3.5 h-3.5 text-purple-600" /> },
        { id: 'td_dau_nhot', label: 'Dầu nhớt', icon: <MenuIcon menuId="td_dau_nhot" size={14} className="w-3.5 h-3.5 text-amber-600" />, badge: fuelTxCount > 0 ? fuelTxCount : undefined, badgeColor: 'bg-amber-100 text-amber-800' },
        { id: 'td_xem_phieu', label: 'Xem phiếu', icon: <MenuIcon menuId="td_xem_phieu" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'td_tra_cuu_vt', label: 'Tra cứu vật tư', icon: <MenuIcon menuId="td_tra_cuu_vt" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'td_canh_bao', label: 'Cảnh báo thay thế vật tư', icon: <MenuIcon menuId="td_canh_bao" size={14} className="w-3.5 h-3.5 text-rose-600" />, badge: criticalWearCount > 0 ? criticalWearCount : undefined, badgeColor: 'bg-rose-100 text-rose-700' }
      ]
    },
    {
      id: 'menu_ht',
      label: 'HỆ THỐNG',
      icon: <Settings className="w-4 h-4 text-slate-500" />,
      children: [
        { id: 'ht_users', label: 'Người dùng, phân quyền', icon: <MenuIcon menuId="ht_users" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'ht_quy_trinh', label: 'Thiết lập quy trình', icon: <MenuIcon menuId="ht_quy_trinh" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'ht_khoa_so', label: 'Khóa sổ kỳ', icon: <MenuIcon menuId="ht_khoa_so" size={14} className="w-3.5 h-3.5 text-amber-600" /> },
        { id: 'ht_so_du_dau', label: 'Nhập số dư ban đầu', icon: <MenuIcon menuId="ht_so_du_dau" size={14} className="w-3.5 h-3.5 text-slate-500" /> },
        { id: 'ht_lich_su', label: 'Lịch sử hoạt động', icon: <MenuIcon menuId="ht_lich_su" size={14} className="w-3.5 h-3.5 text-slate-500" /> }
      ]
    }
  ], [lowStockCount, criticalWearCount, fuelTxCount]);

  // Flattened items map for quick lookup (for favorites)
  const allItemsMap = useMemo(() => {
    const map = new Map<string, { id: string; label: string; icon: React.ReactNode }>();
    MENU_GROUPS.forEach(g => {
      if (g.directId) {
        map.set(g.directId, { id: g.directId, label: g.label, icon: g.icon });
      }
      if (g.children) {
        g.children.forEach(c => {
          map.set(c.id, { id: c.id, label: c.label, icon: c.icon });
        });
      }
    });
    return map;
  }, [MENU_GROUPS]);

  const handleItemClick = (id: string) => {
    onSelectMenu(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out text-slate-800 shadow-xs
        ${isOpenMobile ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
        ${isMinimized ? 'lg:w-20' : 'lg:w-72'}
      `}>
        {/* Brand Header: Logo 1 hàng, Tên 1 hàng */}
        <div className="p-3 border-b border-slate-200 flex flex-col gap-2.5 flex-shrink-0 bg-slate-50/90">
          {!isMinimized ? (
            <>
              {/* Top Bar with Minimize and Mobile Close */}
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">TÂN NAM CHINH LOGISTICS</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleMinimize}
                    className="hidden lg:flex p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-md transition cursor-pointer"
                    title="Thu gọn menu (Minimize)"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={onCloseMobile}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 lg:hidden cursor-pointer"
                    title="Đóng menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Hàng 1: Logo */}
              <div className="sidebar-logo bg-white rounded-xl px-3 py-2 shadow-xs flex items-center justify-center border border-slate-200/90 hover:border-slate-300 transition w-full">
                <TncLogo size="md" showSubtitle={true} className="h-8 w-auto max-w-full" />
              </div>

              {/* Hàng 2: Tên */}
              <div className="text-center pt-0.5">
                <h1 className="font-black text-xs tracking-wider text-slate-900 uppercase leading-snug">
                  HỆ THỐNG QUẢN LÝ VẬT TƯ
                </h1>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="sidebar-logo bg-white rounded-lg p-1.5 border border-slate-200 shadow-xs flex items-center justify-center" title="Hệ thống quản lý vật tư">
                <TncLogo size="sm" showSubtitle={false} className="h-6 w-auto" />
              </div>
              <button
                onClick={onToggleMinimize}
                className="hidden lg:flex p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                title="Mở rộng menu"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          )}
        </div>

        {/* Toast Warning for Favorites */}
        {toastMessage && (
          <div className="mx-2 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-medium leading-tight shadow-sm flex items-center gap-1.5 animate-fadeIn">
            <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Navigation Tree */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs select-none">
          {/* MỤC YÊU THÍCH (FAVORITES SECTION - MAX 2 ITEMS) */}
          {favoriteIds.length > 0 && (
            <div className={`mb-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 ${isMinimized ? 'p-1' : 'p-2'}`}>
              {!isMinimized ? (
                <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-extrabold tracking-wider uppercase text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    Mục Yêu Thích ({favoriteIds.length}/{MAX_FAVORITES})
                  </span>
                  <span className="text-[9px] text-amber-700/70 font-normal">Tối đa 2 mục</span>
                </div>
              ) : (
                <div className="text-center py-1 text-amber-600" title={`Mục Yêu Thích (${favoriteIds.length}/${MAX_FAVORITES})`}>
                  <Star className="w-3.5 h-3.5 mx-auto text-amber-500 fill-amber-500" />
                </div>
              )}

              <div className="space-y-1">
                {favoriteIds.map(favId => {
                  const item = allItemsMap.get(favId);
                  if (!item) return null;
                  const isActive = activeMenuId === favId;

                  return (
                    <div
                      key={`fav_${favId}`}
                      onClick={() => handleItemClick(favId)}
                      title={item.label}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'bg-white hover:bg-amber-100/60 text-slate-700 hover:text-slate-900 border border-amber-200/60'
                      } ${isMinimized ? 'justify-center px-1' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {item.icon}
                        {!isMinimized && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isMinimized && (
                        <button
                          onClick={(e) => handleToggleFavorite(e, favId)}
                          className="opacity-70 group-hover:opacity-100 p-0.5 hover:scale-110 transition cursor-pointer"
                          title="Bỏ đánh dấu yêu thích"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MAIN MENU GROUPS */}
          {MENU_GROUPS.map(group => {
            const hasChildren = group.children && group.children.length > 0;
            const isDirectActive = group.directId && activeMenuId === group.directId;
            const isChildActive = group.children?.some(c => c.id === activeMenuId);
            const isExpanded = expandedGroups[group.id] ?? false;

            if (!hasChildren && group.directId) {
              const isFav = favoriteIds.includes(group.directId);

              return (
                <div
                  key={group.id}
                  onClick={() => handleItemClick(group.directId!)}
                  title={group.label}
                  className={`group relative w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold tracking-tight transition cursor-pointer ${
                    isDirectActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  } ${isMinimized ? 'justify-center px-2 py-2.5' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    {group.icon}
                    {!isMinimized && <span className="truncate">{group.label}</span>}
                  </div>

                  {!isMinimized && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(e, group.directId!)}
                      className={`p-1 rounded transition cursor-pointer ${
                        isFav 
                          ? 'text-amber-500 fill-amber-500 opacity-100' 
                          : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-500'
                      }`}
                      title={isFav ? "Bỏ yêu thích" : "Đánh dấu yêu thích (Tối đa 2 mục)"}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-500' : ''}`} />
                    </button>
                  )}
                </div>
              );
            }

            // Minimized view for group with children: show parent icon as popover/accordion
            if (isMinimized) {
              return (
                <div key={group.id} className="relative group/mini py-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex justify-center py-2.5 px-2 rounded-xl transition cursor-pointer ${
                      isChildActive
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={group.label}
                  >
                    {group.icon}
                  </button>

                  {/* Submenu on expand in minimized mode */}
                  {isExpanded && group.children && (
                    <div className="mt-1 space-y-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                      {group.children.map(child => {
                        const isItemActive = activeMenuId === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => handleItemClick(child.id)}
                            className={`w-full flex justify-center p-1.5 rounded-md transition cursor-pointer ${
                              isItemActive ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-600 hover:bg-white'
                            }`}
                            title={child.label}
                          >
                            {child.icon}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Parent Group Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-bold transition text-left cursor-pointer ${
                    isChildActive
                      ? 'text-amber-800 bg-amber-50/70 border border-amber-200/60'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {group.icon}
                    <span className="truncate">{group.label}</span>
                  </div>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {/* Submenu Items */}
                {isExpanded && group.children && (
                  <div className="pl-5 pr-1 space-y-0.5 border-l-2 border-slate-200 ml-3.5 py-0.5">
                    {group.children.map(child => {
                      const isItemActive = activeMenuId === child.id;
                      const isFav = favoriteIds.includes(child.id);

                      return (
                        <div
                          key={child.id}
                          onClick={() => handleItemClick(child.id)}
                          className={`group relative w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-medium transition text-left cursor-pointer ${
                            isItemActive
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            {child.icon}
                            <span className="truncate">{child.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {child.notReady && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                Sắp có
                              </span>
                            )}
                            {child.badge !== undefined && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isItemActive ? 'bg-slate-950 text-amber-400' : (child.badgeColor || 'bg-slate-100 text-slate-700')
                              }`}>
                                {child.badge}
                              </span>
                            )}
                            {/* Star favorite toggle */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(e, child.id)}
                              className={`p-0.5 rounded transition cursor-pointer ${
                                isFav 
                                  ? 'text-amber-500 fill-amber-500 opacity-100' 
                                  : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-500'
                              }`}
                              title={isFav ? "Bỏ yêu thích" : "Đánh dấu yêu thích (Tối đa 2 mục)"}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-500' : ''}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer info & Minimize Toggle */}
        <div className="p-2.5 border-t border-slate-200 text-[10px] text-slate-400 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
          {!isMinimized ? (
            <>
              <span>Hệ thống Quản lý Vật tư</span>
              <span>v1.2</span>
            </>
          ) : (
            <button
              onClick={onToggleMinimize}
              className="w-full flex justify-center py-1 text-slate-400 hover:text-slate-700"
              title="Mở rộng menu"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
