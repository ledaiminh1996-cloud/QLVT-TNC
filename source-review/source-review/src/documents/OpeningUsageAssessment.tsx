import {useState} from "react";
import {docInput} from "./CatalogPicker";
import {normalizeViNumber} from "../../shared/documentNumbers";
import {openingUsageAssessment} from "../../shared/openingUsageAssessment";
import type {DraftLine} from "../../shared/documents";
import {money} from "./documentFormatting";

function OriginalPrice({item,index,disabled,line}:Props){
 const [editing,setEditing]=useState(false);let formatted=item.opening_current_unit_price??"";
 try{const value=normalizeViNumber(formatted,"Nguyên giá");formatted=value?new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(Number(value))+" đ":"—";}catch{}
 return <input className={editing?docInput+" !px-2 !py-1.5 !text-[11px]": "w-full min-w-0 min-h-[28px] !border-0 !bg-transparent !rounded-none p-0 text-xs font-semibold tabular-nums outline-none focus:ring-2 focus:ring-blue-400"} aria-label={"Nguyên giá đầu kỳ dòng "+(index+1)} title={disabled?formatted:"Chọn để sửa nguyên giá"} required inputMode="decimal" value={editing?item.opening_current_unit_price??"":formatted} disabled={disabled} onFocus={()=>setEditing(true)} onBlur={()=>setEditing(false)} onChange={e=>line(item.id,{opening_current_unit_price:e.target.value})}/>;
}
type Props={item:DraftLine;index:number;disabled:boolean;line:(id:string,patch:Partial<DraftLine>)=>void};
export function OpeningUsageAssessment({item,index,disabled,line}:Props){
 let amount:number|null=null,error="";
 try{amount=openingUsageAssessment({...item,quantity:normalizeViNumber(item.quantity,"Số lượng"),opening_current_unit_price:normalizeViNumber(item.opening_current_unit_price??"","Nguyên giá"),opening_quality_percent:normalizeViNumber(item.opening_quality_percent??"","Tỷ lệ còn lại")}).amount_vnd;}catch(e){error=e instanceof Error?e.message:"Số liệu không hợp lệ.";}
 return <>
  <td className="p-1.5 align-top"><OriginalPrice item={item} index={index} disabled={disabled} line={line}/></td>
  <td className="p-1.5 align-top"><input className={docInput+" !px-2 !py-1.5 !text-[11px]"} aria-label={"Tỷ lệ còn lại đầu kỳ (%) dòng "+(index+1)} required inputMode="decimal" placeholder="0–100%" value={item.opening_quality_percent??""} disabled={disabled} onChange={e=>line(item.id,{opening_quality_percent:e.target.value})}/></td>
  <td className="p-1.5 align-top tabular-nums" aria-label={"Giá trị còn lại đầu kỳ dòng "+(index+1)}><div className="flex min-h-[28px] items-center font-semibold">{money(amount)}</div>{error?<p role="status" className="mt-1 text-xs text-amber-700">{error}</p>:amount===null&&<p className="mt-1 text-xs text-slate-500">Chờ đủ nguyên giá, tỷ lệ và xác nhận.</p>}</td>
  <td className="space-y-1 p-1.5 align-top"><input className={docInput+" !px-2 !py-1.5 !text-[11px]"} aria-label={"Người xác nhận đầu kỳ dòng "+(index+1)} placeholder="Kỹ thuật / người xác nhận" required maxLength={256} value={item.opening_assessor??""} disabled={disabled} onChange={e=>line(item.id,{opening_assessor:e.target.value})}/></td>
 </>;
}

