import type {DocumentDraft} from "../../shared/documents";
import {normalizeViNumber} from "../../shared/documentNumbers";
import {openingUsageTotals} from "../../shared/openingUsageAssessment";
import {money} from "./documentFormatting";
export function OpeningUsageTotals({draft}:{draft:DocumentDraft}){
 try{const values=openingUsageTotals(draft.lines.filter(l=>l.part_id).map(l=>({...l,quantity:normalizeViNumber(l.quantity,"Số lượng"),opening_current_unit_price:normalizeViNumber(l.opening_current_unit_price??"","Nguyên giá"),opening_quality_percent:normalizeViNumber(l.opening_quality_percent??"","Tỷ lệ còn lại")})));
 return <section aria-label="Tổng cộng vật tư đầu kỳ" className="ml-auto grid w-full gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3"><div>Tổng số lượng<strong aria-label="Tổng số lượng đầu kỳ" className="mt-1 block font-sans tabular-nums">{new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(values.quantity_milli/1000)}</strong></div><div>Tổng nguyên giá<strong aria-label="Tổng nguyên giá đầu kỳ" className="mt-1 block font-sans tabular-nums">{money(values.base_vnd)}</strong>{!!values.missing_base&&<span className="mt-1 block text-amber-700">{values.missing_base} dòng chưa có nguyên giá</span>}</div><div>Tổng giá trị còn lại<strong aria-label="Tổng giá trị còn lại đầu kỳ" className="mt-1 block font-sans tabular-nums">{money(values.remaining_vnd)}</strong>{!!values.missing_remaining&&<span className="mt-1 block text-amber-700">{values.missing_remaining} dòng chưa đủ dữ liệu</span>}</div></section>;
 }catch(e){return <p role="status" className="text-xs text-amber-700">{e instanceof Error?e.message:"Kiểm tra số liệu để tính tổng cộng."}</p>}
}
