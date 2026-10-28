import React from 'react';
import { Users, Warehouse, Cylinder, Handshake, Package, Truck, Barcode, Tags, ClipboardList, PackagePlus, PackageMinus, ArrowLeftRight, RefreshCw, Undo2, ArchiveX, Disc3, Wrench, ClipboardCheck, NotebookPen, Table2, Building2, ShoppingCart, BadgeDollarSign, Cog, ReceiptText, Gauge, RadioTower, Fuel, Files, Search, BellRing, ShieldCheck, Workflow, LockKeyhole, Database, History, Network, SlidersHorizontal, Link2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
const icons: Record<string,LucideIcon> = {
  'dm_nhan_su': Users,
  'dm_kho': Warehouse,
  'dm_bon_dau': Cylinder,
  'dm_ncc': Handshake,
  'dm_vt_tb': Package,
  'dm_phuong_tien': Truck,
  'dm_ghep_thiet_bi': Link2,
  'dm_tham_so_pttb': SlidersHorizontal,
  'dm_ma_doi_tuong': Barcode,
  'dm_ma_nhom': Tags,
  'ct_de_xuat': ClipboardList,
  'ct_nhap_kho': PackagePlus,
  'ct_xuat_kho': PackageMinus,
  'ct_dieu_chuyen': ArrowLeftRight,
  'ct_dao_vo_acquy': RefreshCw,
  'ct_thu_hoi': Undo2,
  'ct_thanh_ly': ArchiveX,
  'ct_dap_vo': Disc3,
  'ct_sua_chua_ngoai': Wrench,
  'so_theo_doi_kho': ClipboardCheck,
  'so_chi_tiet_nxt': NotebookPen,
  'so_tong_hop_nxt': Table2,
  'cp_vt_tb_cty': Building2,
  'cp_vt_tb_mua_ngoai': ShoppingCart,
  'cp_sua_chua_ngoai': BadgeDollarSign,
  'cp_gia_cong_chu_dong': Cog,
  'cp_dau_xe_thue': ReceiptText,
  'td_vo_odo': Gauge,
  'td_sim_data': RadioTower,
  'td_dau_nhot': Fuel,
  'td_xem_phieu': Files,
  'td_tra_cuu_vt': Search,
  'td_canh_bao': BellRing,
  'ht_users': ShieldCheck,
  'ht_quy_trinh': Workflow,
  'ht_khoa_so': LockKeyhole,
  'ht_so_du_dau': Database,
  'ht_lich_su': History,
};
const resources: Record<string,string> = { parts:'dm_vt_tb', 'part-objects':'dm_ma_doi_tuong', 'part-groups':'dm_ma_nhom', warehouses:'dm_kho', 'fuel-tanks':'dm_bon_dau', vehicles:'dm_phuong_tien', equipment:'dm_phuong_tien', 'equipment-pairings':'dm_ghep_thiet_bi', 'equipment-pairing-sets':'dm_ghep_thiet_bi', 'equipment-parameters':'dm_tham_so_pttb', staff:'dm_nhan_su' };
export function MenuIcon({ menuId, size=20, className }: { menuId: string; size?: number; className?: string }) {
 const Icon=icons[menuId] ?? Package;
 return <Icon aria-hidden="true" data-menu-icon={menuId} size={size} className={className} />;
}
export function CatalogIcon({resource,size=20,className}: {resource:string;size?:number;className?:string}) {
 if(resource==='org-units')return <Building2 aria-hidden="true" size={size} className={className}/>;
 if(resource==='departments')return <Network aria-hidden="true" size={size} className={className}/>;
 if(resource==='suppliers')return <MenuIcon menuId="dm_ncc" size={size} className={className}/>;
 return <MenuIcon menuId={resources[resource]??'dm_vt_tb'} size={size} className={className}/>;
}
