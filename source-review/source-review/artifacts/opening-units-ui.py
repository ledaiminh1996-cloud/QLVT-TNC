from pathlib import Path
p=Path('shared/openingUsageAssessment.ts');s=p.read_text(encoding='utf-8');s+='''
export function openingUsageTotals(lines:DraftLine[]){
 let quantity=0n,base=0n,remaining=0n;let missingBase=0,missingRemaining=0;
 for(const line of lines){const q=scaledDecimal(line.quantity,3,"Số lượng")??0n;quantity+=q;
  const price=line.opening_current_unit_price?scaledDecimal(line.opening_current_unit_price,3,"Nguyên giá"):null;
  if(price===null)missingBase++;else base+=(price*q+500000n)/1000000n;
  const amount=openingUsageAssessment(line).amount_vnd;if(amount===null)missingRemaining++;else remaining+=BigInt(amount);
 }
 for(const value of [quantity,base,remaining])if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Tổng cộng vượt giới hạn.");
 return {quantity_milli:Number(quantity),base_vnd:missingBase?null:Number(base),remaining_vnd:missingRemaining?null:Number(remaining),missing_base:missingBase,missing_remaining:missingRemaining};
}
''';p.write_text(s,encoding='utf-8')
p=Path('src/documents/documentClient.ts');s=p.read_text(encoding='utf-8').replace('export interface DocumentClient {','export interface DocumentClient {\n  openingUnit?(type:string,id:string,signal?:AbortSignal):Promise<{unit_id:string|null;unit_label:string;source:string}>;');s=s.replace('  return {\n    async recoverySources','  return {\n    async openingUnit(type,id,signal){const result=await request("document-drafts/opening-unit?"+new URLSearchParams({target_type:type,target_id:id}),{signal});const d=result.data;if(!object(d)||(d.unit_id!==null&&typeof d.unit_id!=="string")||typeof d.unit_label!=="string"||typeof d.source!=="string")return invalid();return {unit_id:d.unit_id,unit_label:d.unit_label,source:d.source};},\n    async recoverySources');p.write_text(s,encoding='utf-8')
Path('src/documents/OpeningManagementUnit.tsx').write_text('''import {useEffect,useState} from "react";
import type {DocumentDraft} from "../../shared/documents";
import type {DocumentClient} from "./documentClient";
import {docInput} from "./CatalogPicker";
export function OpeningManagementUnit({draft,documents,labels,readOnly}:{draft:DocumentDraft;documents:DocumentClient;labels:Record<string,string>;readOnly:boolean}){
 const key=JSON.stringify([...new Set(draft.lines.filter(l=>l.target_id).map(l=>l.target_type+":"+l.target_id))]);
 const [value,setValue]=useState(""),[error,setError]=useState("");
 useEffect(()=>{const targets=JSON.parse(key)as string[];const controller=new AbortController();setError("");
 if(!targets.length){setValue("Chọn xe/rơ moóc hoặc thiết bị");return()=>controller.abort();}
 if(readOnly){setValue([...new Set(targets.map(t=>labels["managing_unit_label:"+t]||"Chưa xác định"))].join("; "));return()=>controller.abort();}
 setValue("Đang xác định đơn vị…");
 if(!documents.openingUnit){setValue("Chưa xác định");return()=>controller.abort();}
 Promise.all(targets.map(t=>{const i=t.indexOf(":");return documents.openingUnit!(t.slice(0,i),t.slice(i+1),controller.signal)})).then(units=>{if(!controller.signal.aborted)setValue([...new Set(units.map(u=>u.unit_label))].join("; "))}).catch(e=>{if(!controller.signal.aborted){setValue("Chưa xác định");setError(e instanceof Error?e.message:"Không đọc được đơn vị quản lý.")}});return()=>controller.abort();
 },[key,documents,readOnly,labels]);
 return <label className="block text-xs font-semibold">Đơn vị quản lý<input aria-label="Đơn vị quản lý" className={docInput+" mt-1"} value={value} readOnly title={value}/>{(value.includes("Chưa xác định")||error)&&<span className="mt-1 block text-xs font-normal text-amber-700">{error||"Bổ sung Đơn vị quản lý trong danh mục xe/thiết bị khi có thông tin."}</span>}</label>;
}
''',encoding='utf-8')
Path('src/documents/OpeningUsageTotals.tsx').write_text('''import type {DocumentDraft} from "../../shared/documents";
import {normalizeViNumber} from "../../shared/documentNumbers";
import {openingUsageTotals} from "../../shared/openingUsageAssessment";
import {money} from "./documentFormatting";
export function OpeningUsageTotals({draft}:{draft:DocumentDraft}){
 try{const values=openingUsageTotals(draft.lines.map(l=>({...l,quantity:normalizeViNumber(l.quantity,"Số lượng"),opening_current_unit_price:normalizeViNumber(l.opening_current_unit_price??"","Nguyên giá"),opening_quality_percent:normalizeViNumber(l.opening_quality_percent??"","Tỷ lệ còn lại")})));
 return <section aria-label="Tổng cộng vật tư đầu kỳ" className="ml-auto grid w-full gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3"><div>Tổng số lượng<strong aria-label="Tổng số lượng đầu kỳ" className="mt-1 block font-sans tabular-nums">{new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(values.quantity_milli/1000)}</strong></div><div>Tổng nguyên giá<strong aria-label="Tổng nguyên giá đầu kỳ" className="mt-1 block font-sans tabular-nums">{money(values.base_vnd)}</strong>{!!values.missing_base&&<span className="mt-1 block text-amber-700">{values.missing_base} dòng chưa có nguyên giá</span>}</div><div>Tổng giá trị còn lại<strong aria-label="Tổng giá trị còn lại đầu kỳ" className="mt-1 block font-sans tabular-nums">{money(values.remaining_vnd)}</strong>{!!values.missing_remaining&&<span className="mt-1 block text-amber-700">{values.missing_remaining} dòng chưa đủ dữ liệu</span>}</div></section>;
 }catch(e){return <p role="status" className="text-xs text-amber-700">{e instanceof Error?e.message:"Kiểm tra số liệu để tính tổng cộng."}</p>}
}
''',encoding='utf-8')
p=Path('src/documents/DocumentEditor.tsx');s=p.read_text(encoding='utf-8');s='import {OpeningManagementUnit} from "./OpeningManagementUnit";\nimport {OpeningUsageTotals} from "./OpeningUsageTotals";\n'+s;s=s.replace('{!["equipment_transfer", "rotation"].includes(kind) &&','{openingInUse?<OpeningManagementUnit draft={draft} documents={documents} labels={labels} readOnly={readOnly}/>:!["equipment_transfer", "rotation"].includes(kind) &&',1);s=s.replace('            {kind !== "receipt" && (','            {openingInUse&&<OpeningUsageTotals draft={draft}/>}\n            {kind !== "receipt" && !openingInUse && (');s=s.replace('Lưu phiếu sẽ ghi nhận vật tư đang sử dụng để làm nguồn thu hồi.','Ghi nhận vật tư đang sử dụng tại ngày đầu kỳ. Không làm thay đổi tồn kho.');p.write_text(s,encoding='utf-8')
p=Path('shared/documents.ts');s=p.read_text(encoding='utf-8');needle='  if (kind === "proposal" && !d.department_id)';s=s.replace(needle,'  if(kind === "opening" && d.opening_mode === "in_use"){d.warehouse_id="";d.to_warehouse_id="";}\n'+needle);p.write_text(s,encoding='utf-8')
p=Path('src/api/equipmentFormFields.ts');s=p.read_text(encoding='utf-8').replace('  return keys.flatMap(key=>{','  if(!keys.includes("managing_unit_id"))keys.splice(keys.indexOf("notes")>=0?keys.indexOf("notes"):keys.length,0,"managing_unit_id");\n  return keys.flatMap(key=>{');p.write_text(s,encoding='utf-8')
p=Path('src/documents/previewStore.ts');s=p.read_text(encoding='utf-8').replace('  const client: DocumentClient = {','  const client: DocumentClient = {\n    async openingUnit(type,id,signal){signal?.throwIfAborted();return {unit_id:"preview-unit",unit_label:"CN01 — Chi nhánh mẫu",source:"target"};},');p.write_text(s,encoding='utf-8')
p=Path('src/documents/OpeningUsagePrint.tsx');s=p.read_text(encoding='utf-8').replace('import {openingUsageAssessment}','import {openingUsageAssessment,openingUsageTotals}');s=s.replace('  const { draft, labels } = row;','  const { draft, labels } = row;\n  const totals=openingUsageTotals(draft.lines);');s=s.replace('<p>Kho quản lý: {labels["warehouses:" + draft.warehouse_id] || "—"}</p>','<p>Đơn vị quản lý: {[...new Set(draft.lines.map(line=>labels["managing_unit_label:"+line.target_type+":"+line.target_id]||"Chưa xác định"))].join("; ")}</p>');s=s.replace('Số liệu dùng để quản lý vật tư đang lắp và làm nguồn thu hồi về kho.','Ghi nhận vật tư đang sử dụng tại ngày đầu kỳ. Không làm thay đổi tồn kho.');s=s.replace('Tổng giá trị còn lại: <strong>{money(draft.lines.every(line=>openingUsageAssessment(line).amount_vnd!==null)?draft.lines.reduce((total,line)=>total+(openingUsageAssessment(line).amount_vnd??0),0):null)}</strong>','Tổng số lượng: <strong>{number(totals.quantity_milli/1000)}</strong> · Tổng nguyên giá: <strong>{money(totals.base_vnd)}</strong> · Tổng giá trị còn lại: <strong>{money(totals.remaining_vnd)}</strong>');s=s.replace('        {draft.notes && <p>Ghi chú: {draft.notes}</p>}\n','');p.write_text(s,encoding='utf-8')
