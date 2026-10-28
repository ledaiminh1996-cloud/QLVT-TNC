import {nxtSummaryColumns} from "./nxtSummaryColumns";
import type {BookGroup,BookMovement,InventoryBook} from "../../shared/inventoryBooks";
import {bookKindLabels} from "../../shared/inventoryBooks";
import {stockStates} from "../../shared/documents";
import {documentDateTime,documentDate} from "../documents/documentFormatting";
export type BookRow=BookGroup|BookMovement;
export interface BookColumn{key:string;label:string;type:"text"|"code"|"quantity"|"money"|"date";width:number;value:(row:BookRow)=>string|number|null}
const common:BookColumn[]=[{key:"warehouse",label:"Kho",type:"code",width:110,value:r=>r.warehouse_code},{key:"sku",label:"Mã vật tư",type:"code",width:145,value:r=>r.sku},{key:"name",label:"Tên vật tư",type:"text",width:230,value:r=>r.part_name},{key:"unit",label:"ĐVT",type:"text",width:65,value:r=>r.unit},{key:"state",label:"Trạng thái hàng",type:"text",width:160,value:r=>stockStates[r.stock_state]}];
function field(key:keyof BookGroup,label:string,type:BookColumn["type"]):BookColumn{return {key,label,type,width:type==="quantity"?115:145,value:r=>{const v=(r as BookGroup)[key];return typeof v==="number"||typeof v==="string"||v===null?v:null}}}
export function bookColumns(book:InventoryBook):BookColumn[]{
 if(book==="stock"){const tracking:BookColumn[]=[
  {key:"business_at",label:"Ngày phiếu",type:"date",width:155,value:r=>(r as BookMovement).business_at},
  {key:"code",label:"Số phiếu",type:"code",width:155,value:r=>(r as BookMovement).code},
  {key:"kind",label:"Loại phiếu",type:"text",width:140,value:r=>bookKindLabels[(r as BookMovement).kind]??(r as BookMovement).kind},
  common[0],common[4],common[1],common[2],common[3],
  {key:"in_quantity_milli",label:"SL nhập",type:"quantity",width:100,value:r=>(r as BookMovement).in_quantity_milli},
  {key:"out_quantity_milli",label:"SL xuất",type:"quantity",width:100,value:r=>(r as BookMovement).out_quantity_milli},
  {key:"serials",label:"Serial",type:"code",width:180,value:r=>(r as BookMovement).serials},
  {key:"target_label",label:"Biển số",type:"code",width:130,value:r=>(r as BookMovement).target_label??""},
  {key:"target_kind",label:"Loại thiết bị",type:"text",width:125,value:r=>(r as BookMovement).target_kind??""},
  {key:"readings",label:"ODO/Giờ",type:"text",width:175,value:r=>{const m=r as BookMovement;return [m.odo?new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(Number(m.odo))+" km":"",m.hours?new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(Number(m.hours))+" giờ":""].filter(Boolean).join(" / ")}}
 ];
 const widths:Record<string,number>={business_at:140,code:134,kind:108,warehouse:76,state:128,sku:128,name:208,unit:52,in_quantity_milli:74,out_quantity_milli:74,serials:132,target_label:112,target_kind:112,readings:142};
 return tracking.map(column=>({...column,width:widths[column.key]??column.width}));
 }
 if(book==="summary")return [common[0],{key:"warehouse_name",label:"Tên kho",type:"text",width:170,value:r=>r.warehouse_name},common[4],common[1],common[2],common[3],...nxtSummaryColumns.map(c=>field(c.key,c.label,c.money?"money":"quantity")),{key:"first_movement_at",label:"Phát sinh đầu",type:"text",width:110,value:r=>(r as BookGroup).first_movement_at?documentDate((r as BookGroup).first_movement_at!):"-"},{key:"last_movement_at",label:"Phát sinh cuối",type:"text",width:110,value:r=>(r as BookGroup).last_movement_at?documentDate((r as BookGroup).last_movement_at!):"-"}];
 const v=(key:keyof BookMovement)=>(r:BookRow)=>{const value=(r as BookMovement)[key];return typeof value==="number"||typeof value==="string"||value===null?value:null};
 return [{key:"business_at",label:"Ngày giờ CT",type:"date",width:155,value:v("business_at")},{key:"code",label:"Số phiếu",type:"code",width:160,value:v("code")},{key:"kind",label:"Loại phiếu",type:"text",width:145,value:r=>bookKindLabels[(r as BookMovement).kind]??(r as BookMovement).kind},common[0],common[4],{key:"purpose",label:"Nội dung",type:"text",width:230,value:v("purpose")},{key:"serials",label:"Serial",type:"code",width:180,value:v("serials")},...["in","out"].flatMap((k,i)=>[{key:k+"_quantity_milli",label:i?"Xuất · SL":"Nhập · SL",type:"quantity" as const,width:110,value:v((k+"_quantity_milli") as keyof BookMovement)},{key:k+"_value_vnd",label:i?"Xuất (đ)":"Nhập (đ)",type:"money" as const,width:145,value:v((k+"_value_vnd") as keyof BookMovement)}]),{key:"balance_quantity_milli",label:"Tồn · SL",type:"quantity",width:110,value:v("balance_quantity_milli")},{key:"balance_value_vnd",label:"Tồn (đ)",type:"money",width:145,value:v("balance_value_vnd")},{key:"notes",label:"Ghi chú",type:"text",width:200,value:v("notes")}];
}
export function formatBookCell(value:string|number|null,type:BookColumn["type"]):string{if(value===null)return type==="money"?"Chưa xác định":"Chưa ghi nhận";if(value==="")return "Chưa ghi nhận";if(type==="quantity")return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(Number(value)/1000);if(type==="money")return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(Number(value));if(type==="date")return documentDateTime(String(value));return String(value)||"Chưa ghi nhận"}
