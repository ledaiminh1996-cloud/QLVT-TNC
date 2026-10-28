import type {StockState} from "./documents";
export const inventoryBookMenus={so_theo_doi_kho:"stock",so_chi_tiet_nxt:"card",so_tong_hop_nxt:"summary"} as const;
export type InventoryBook="stock"|"card"|"summary";
export const inventoryBookTitles:Record<InventoryBook,string>={stock:"Sổ theo dõi kho",card:"Sổ chi tiết NXT",summary:"Sổ tổng hợp NXT"};
export function isInventoryBookMenu(menu:string):menu is keyof typeof inventoryBookMenus{return Object.hasOwn(inventoryBookMenus,menu)}
export interface BookFilter{book:InventoryBook;from:string;to:string;warehouse_id?:string;part_id?:string;stock_state?:StockState|"";q?:string;kind?:string;direction?:"asc"|"desc";page?:number;page_size?:number;export?:boolean}
export interface BookAmounts{opening_quantity_milli:number;opening_value_vnd:number|null;in_quantity_milli:number;in_value_vnd:number|null;out_quantity_milli:number;out_value_vnd:number|null;closing_quantity_milli:number;closing_value_vnd:number|null}
export interface BookGroup extends BookAmounts{part_id:string;sku:string;part_name:string;unit:string;warehouse_id:string;warehouse_code:string;warehouse_name:string;stock_state:StockState;last_at:string;pending_lines:number;transfer_in_quantity_milli?:number;transfer_in_value_vnd?:number|null;transfer_out_quantity_milli?:number;transfer_out_value_vnd?:number|null;first_movement_at?:string|null;last_movement_at?:string|null}
export interface BookMovement{target_label?:string;target_kind?:string;odo?:string;hours?:string;movement_id:string;part_id:string;sku:string;part_name:string;unit:string;warehouse_id:string;warehouse_code:string;warehouse_name:string;stock_state:StockState;business_at:string;document_id:string;draft_id:string|null;code:string;kind:string;purpose:string;notes:string;serials:string;in_quantity_milli:number;in_value_vnd:number|null;out_quantity_milli:number;out_value_vnd:number|null;balance_quantity_milli:number;balance_value_vnd:number|null;valuation_pending:boolean}
export interface BookTotals{transfer_in_value_vnd?:number|null;transfer_out_value_vnd?:number|null;opening_value_vnd:number|null;in_value_vnd:number|null;out_value_vnd:number|null;closing_value_vnd:number|null;pending_groups:number;group_count:number}
export interface BookPage{serial_filter?:string;book:InventoryBook;from:string;to:string;data:(BookGroup|BookMovement)[];groups:BookGroup[];totals:BookTotals;pagination:{page:number;page_size:number;total:number}}
export interface BookWarehouse{id:string;code:string;name:string}
export const bookKindLabels:Record<string,string>={receipt:"Nhập kho",issue:"Xuất kho",opening:"Tồn kho đầu kỳ",recovery:"Thu hồi",warehouse_transfer:"Điều chuyển kho",retread:"Gửi đắp vỏ",retread_receive:"Nhận đắp vỏ",liquidation:"Thanh lý",IN:"Nhập kho",OUT:"Xuất kho",OPENING:"Tồn kho đầu kỳ",TRANSFER:"Điều chuyển kho",RECOVERY:"Thu hồi",SCRAP:"Thanh lý",ADJUSTMENT:"Điều chỉnh",REVERSAL:"Đảo giao dịch"};

export const bookSerials=(row:BookMovement)=>row.serials.split(";").map(s=>s.trim()).filter(Boolean);

export function serialMovementLabel(row:BookMovement){const count=bookSerials(row).length,q=row.in_quantity_milli||row.out_quantity_milli;return count>0&&q===count*1000?(row.in_quantity_milli>0?"Nhập":"Xuất")+" 1 "+row.unit:"";}
