import type {StockState} from "./documents";
export interface LedgerFilter{from:string;to:string;warehouse_id?:string;part_id?:string;stock_state?:StockState|"";q?:string;kind?:string;direction?:"asc"|"desc";page?:number;page_size?:number;export?:boolean}
export interface LedgerBalance{warehouse_id:string;warehouse_code:string;stock_state:StockState;part_id:string;sku:string;part_name:string;unit:string;opening_milli:number;closing_milli:number}
export interface LedgerRow{key:string;version:number;day:string;posted_at:string;document_id:string;draft_id:string|null;code:string;kind:string;warehouse_id:string;warehouse_code:string;stock_state:StockState;part_id:string;sku:string;part_name:string;unit:string;in_milli:number;out_milli:number;balance_milli:number|null;serial_count:number;detail_count:number;target:string;target_kind:string;readings:string;pending:boolean}
export interface LedgerChild{key:string;group_key:string;serial:string;in_milli:number|null;out_milli:number|null;target:string;target_kind:string;readings:string;notes:string}
export interface LedgerUnits{unit:string;in_milli:number;out_milli:number}
export interface LedgerPage{data:LedgerRow[];balances:LedgerBalance[];units:LedgerUnits[];totals:{count:number;opening_milli:number|null;closing_milli:number|null};pagination:{page:number;page_size:number;total:number};children?:LedgerChild[]}
export interface LedgerChildren{data:LedgerChild[];pagination:{page:number;page_size:number;total:number}}
export const ledgerKinds={opening:"Tồn kho đầu kỳ",receipt:"Nhập kho",issue:"Xuất kho",recovery:"Thu hồi",warehouse_transfer:"Điều chuyển kho",retread:"Gửi đắp vỏ",retread_receive:"Nhận đắp vỏ",liquidation:"Thanh lý"} as const;
