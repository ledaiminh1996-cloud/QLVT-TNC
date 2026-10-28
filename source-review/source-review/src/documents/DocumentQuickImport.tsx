import {recoveryImportResolver} from "./recoveryQuickImport";
import type {DocumentClient} from "./documentClient";
import {openingUsageAssessment} from "../../shared/openingUsageAssessment";
import {openingVehicleLabel} from "../../shared/openingVehicleLabel";
import {recoveryClasses,recoveryState,type RecoveryClass} from "../../shared/recoveryDetails";
import {mountPositionLabel} from "../../shared/mountPositionLabel";
import {quickColumns,parseQuickTable,quickTableText,type QuickRow} from "../../shared/quickImportTable";
import {issuePurposes,type IssuePurpose} from "../../shared/issueDetails";
import {
  normalizeViNumber,
  displayViNumber,
} from "../../shared/documentNumbers";
import { useRef, useState } from "react";
import {
  emptyLine,
  scaledDecimal,
  stockStates,
} from "../../shared/documents";
import type { DraftLine, DocumentKind } from "../../shared/documents";
import type { CatalogClient, CatalogRow } from "../api/catalogClient";
import { normalizeSearch } from "../../shared/searchText";
import { docButton, docInput, catalogLabel } from "./CatalogPicker";
export function DocumentQuickImport({
  api,
  kind,
  warehouseId,
  documents,vehicleId="",businessAt="",existingLines=[],
  openingInUse = false,
  onApply,
  onClose,
}: {
  api: CatalogClient;
  kind: DocumentKind;
  warehouseId?:string;
  documents?:DocumentClient;vehicleId?:string;businessAt?:string;existingLines?:DraftLine[];
  openingInUse?:boolean;
  onApply: (lines: DraftLine[], parts: CatalogRow[], targets?:{resource:"vehicles"|"equipment";row:CatalogRow}[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<QuickRow[]>([{}]),
    [copyNotice,setCopyNotice]=useState(""),
    [preview, setPreview] = useState<{
      lines: DraftLine[];
      parts: CatalogRow[];
      sources:Record<string,string>;
      targets:{resource:"vehicles"|"equipment";row:CatalogRow}[];
    }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    sequence = useRef(0);
  const incoming = ["receipt", "proposal", "opening"].includes(kind)&&!openingInUse;
  const columns=quickColumns(kind,openingInUse);
  const updateRows=(next:QuickRow[])=>{sequence.current++;setRows(next);setPreview(undefined);setError("");setCopyNotice("");};
  function paste(event:React.ClipboardEvent) {
    const text=event.clipboardData.getData("text/plain");
    if(!/[\t\r\n]/.test(text))return;
    event.preventDefault();
    try{const next=parseQuickTable(text,kind,openingInUse);if(!next.length)throw new Error("Bảng chỉ có tiêu đề, chưa có dòng vật tư.");updateRows(next);}catch(e){setError(e instanceof Error?e.message:"Không đọc được bảng.");setPreview(undefined);}
  }
  async function copyTable(){
    try{await navigator.clipboard.writeText(quickTableText(rows,kind,openingInUse));setCopyNotice("Đã sao chép bảng kèm tiêu đề. Dán vào Excel để nhập dữ liệu.");}catch{setError("Chưa sao chép được. Hãy cho phép trình duyệt dùng bộ nhớ tạm rồi thử lại.");}
  }
  async function inspect() {
    if (busy) return;
    setBusy(true);
    setError("");
    const revision = ++sequence.current;
    try {
      const data=rows.filter(row=>Object.values(row).some(v=>v?.trim()));
      if (!data.length) throw new Error("Chưa có dòng để nhập.");
      if(kind==="issue"&&!warehouseId)throw new Error("Chọn kho xuất trước khi nhập nhanh.");
      const parts: CatalogRow[] = [],
        lines: DraftLine[] = [];
      const targets:{resource:"vehicles"|"equipment";row:CatalogRow}[]=[];
      const sourceLabels:Record<string,string>={};
      const resolveRecovery=recoveryImportResolver(documents,vehicleId,businessAt,existingLines,source=>{sourceLabels[source.usage_id]=source.code+" · "+source.target_label+" · "+source.started_at.replace("T"," ");});
      const scopedParts=new Map<string,CatalogRow>(),usedStock=new Map<string,number>();
      for (const [index, values] of data.entries()) {
        try {
          const sku=values.sku?.trim()??"",quantity=values.quantity??"";
          if(!sku)throw new Error("Nhập Mã vật tư.");
          const recoveryClass=values.recovery_classification?.trim()||"CSD";
          if(kind==="recovery"&&!Object.hasOwn(recoveryClasses,recoveryClass))throw new Error("Phân loại dùng CSD/CSC/KSD/CTL.");
          const state = kind==="recovery"?Object.entries(stockStates).find(([key])=>key===recoveryState(recoveryClass as RecoveryClass)):Object.entries(stockStates).find(([key,label])=>normalizeSearch(key)===normalizeSearch(values.stock_state??"")||normalizeSearch(label)===normalizeSearch(values.stock_state??""));
          if(!incoming&&!openingInUse&&!state)throw new Error("Chọn Trạng thái hàng: Hàng mới hoặc Hàng thu hồi.");
          const cacheKey=normalizeSearch(sku)+":"+(kind==="issue"?state![0]:"");
          let part = scopedParts.get(cacheKey);
          if (!part) {
            const page = await api.list("parts", { q: sku, pageSize: 25, ...(kind==="issue"?{warehouse_id:warehouseId,stock_state:state![0],status:"1"}:{}) });
            part = page.data.find(
              (p) => normalizeSearch(p.sku) === normalizeSearch(sku),
            );
            if (!part)
              throw new Error(`Dòng ${index + 1}: không tìm thấy mã ${sku}.`);
            scopedParts.set(cacheKey,part);
            if(!parts.some(p=>p.id===part!.id))parts.push(part);
          }
          const line = emptyLine();
          line.part_id = part.id;
          line.quantity = normalizeViNumber(
            quantity,
            `Dòng ${index + 1}: Số lượng`,
          );
          if (scaledDecimal(line.quantity, 3, "Số lượng")! <= 0n)
            throw new Error("Số lượng phải lớn hơn 0.");
          if(kind==="issue"&&typeof part.current_stock_milli==="number"){
            const used=(usedStock.get(cacheKey)??0)+Number(scaledDecimal(line.quantity,3,"Số lượng"));
            if(used>part.current_stock_milli)throw new Error("Tổng số lượng vượt tồn kho của trạng thái đã chọn.");
            usedStock.set(cacheKey,used);
          }
          line.document_quantity = line.quantity;
          if(openingInUse){
            if(part.is_fuel===1)throw new Error("Không khai báo dầu tiêu hao trong vật tư đang sử dụng đầu kỳ.");
            const type=normalizeSearch(values.target_type??"").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").trim(),code=values.target_code?.trim()??"";
            const equipment=["thiet bi","equipment","may phat","container"].includes(type);
            if(type && !equipment && !["dau keo","ro mooc","romooc","xe","vehicle","tractor","trailer"].includes(type))throw new Error("Loại phương tiện dùng Đầu kéo, Rơ moóc hoặc Thiết bị.");
            if(!code)throw new Error("Nhập biển số hoặc mã thiết bị.");
            const resource=equipment?"equipment":"vehicles";
            const page=await api.list(resource,{q:code,status:"active",pageSize:100});
            const matches=page.data.filter(row=>normalizeSearch(equipment?row.code:row.plate_number)===normalizeSearch(code));
            if(matches.length!==1)throw new Error("Không tìm được duy nhất phương tiện/thiết bị đang hoạt động: "+code);
            const target=matches[0];
            if((["dau keo","tractor"].includes(type)&&target.type!=="tractor")||(["ro mooc","romooc","trailer"].includes(type)&&target.type!=="trailer"))throw new Error("Loại phương tiện không khớp biển số.");
            line.target_type=equipment?"equipment":"vehicle";line.target_id=target.id;line.stock_state="recovered";
            if(!targets.some(item=>item.resource===resource&&item.row.id===target.id))targets.push({resource,row:target});
            line.opening_current_unit_price=normalizeViNumber(values.opening_current_unit_price?.trim() || (typeof part.unit_price_vnd==="number"&&part.unit_price_vnd>0?String(part.unit_price_vnd):""),"Nguyên giá");
            line.opening_quality_percent=normalizeViNumber(values.opening_quality_percent??"","Tỷ lệ còn lại");
            line.opening_assessor=values.opening_assessor?.trim()??"";
            if(line.opening_quality_percent&&!/^\d{1,3}(?:\.\d{1,2})?$/.test(line.opening_quality_percent))throw new Error("Tỷ lệ còn lại từ 0 đến 100%, tối đa 2 số lẻ.");
            openingUsageAssessment(line);
            if(part.is_serialized===1&&line.quantity!=="1")throw new Error("Vật tư Serial: mỗi dòng nhập 1 cái và 1 Serial.");
          }else if (incoming) {
            line.unit_price = normalizeViNumber(
              values.unit_price??"",
              `Dòng ${index + 1}: Đơn giá`,
              false,
            );
            if(!line.unit_price)throw new Error("Nhập Đơn giá.");
            scaledDecimal(line.unit_price, 3, "Đơn giá");
            line.data_package = values.data_package??"";
            line.vat_rate=normalizeViNumber(values.vat_rate?.trim()||"0","VAT");
            if(scaledDecimal(line.vat_rate,2,"VAT")!>10000n)throw new Error("VAT phải từ 0 đến 100%.");
          } else {
            line.stock_state = state![0] as DraftLine["stock_state"];
            if(kind==="issue"&&line.stock_state==="pending_scrap")throw new Error("Phiếu xuất chỉ dùng Hàng mới hoặc Hàng thu hồi.");
          }
          if(kind==="recovery"){
            const quality=normalizeViNumber(values.recovery_quality_percent??"","Chất lượng");
            if(quality&&(!/^\d{1,3}(?:\.\d{1,2})?$/.test(quality)||Number(quality)>100))throw new Error("Nhập chất lượng từ 0 đến 100%, tối đa 2 số lẻ.");
            line.recovery_classification=recoveryClass as RecoveryClass;line.recovery_quality_percent=quality||undefined;
          }
          line.notes=values.notes??"";
          const serials=(values.serial??"").split(/[;\r\n]+/).map(s=>s.trim()).filter(Boolean);
          if(serials.length){line.serials=serials;line.serial="";}
          if(openingInUse&&part.is_serialized===1&&serials.length!==1)throw new Error("Vật tư Serial cần 1 Serial thực tế trên mỗi dòng.");
          if(kind==="issue"){
            const purpose=Object.entries(issuePurposes).find(([key,label])=>normalizeSearch(key)===normalizeSearch(values.issue_purpose?.trim()||"use")||normalizeSearch(label)===normalizeSearch(values.issue_purpose?.trim()||"Sử dụng"));
            if(!purpose)throw new Error("Mục đích không hợp lệ.");
            line.issue_purpose=purpose[0] as IssuePurpose;
            if(line.issue_purpose==="liquidation"&&line.stock_state!=="recovered")throw new Error("Thanh lý chỉ áp dụng cho hàng thu hồi.");
          }
          if(kind==="issue"||openingInUse){
            if(values.position?.trim()){
              const positions=await api.list("mount-positions",{q:values.position.trim(),status:"1",pageSize:100});
              const matches=positions.data.filter(p=>normalizeSearch(p.code)===normalizeSearch(values.position)||normalizeSearch(p.name)===normalizeSearch(values.position)||normalizeSearch(mountPositionLabel(p))===normalizeSearch(values.position));
              if(matches.length!==1)throw new Error("Vị trí lắp không tồn tại hoặc không duy nhất. Dùng mã vị trí trong danh mục.");
              if(kind==="issue")line.mount_position_id=matches[0].id;line.to_position=mountPositionLabel(matches[0]).slice(0,256);
            }
          }
          if (
            part.is_serialized === 1 &&
            scaledDecimal(line.quantity, 3, "Số lượng")! % 1000n !== 0n
          )
            throw new Error(
              `Dòng ${index + 1}: vật tư SERIAL cần số lượng nguyên; thêm danh sách serial trong phiếu.`,
            );
          if (serials.length && part.is_serialized !== 1)
            throw new Error(
              `Dòng ${index + 1}: vật tư không quản lý SERIAL, không nhập Serial.`,
            );
          if(serials.length&&serials.length!==Number(line.quantity))throw new Error("Số serial phải khớp số lượng. Ngăn cách nhiều serial bằng dấu chấm phẩy.");
          if (line.data_package && part.needs_data_package !== 1)
            throw new Error(
              `Dòng ${index + 1}: vật tư không sử dụng gói Data.`,
            );
          if(kind==="recovery")lines.push(...await resolveRecovery(line,values,part.is_serialized===1));else lines.push(line);
          if(lines.length+existingLines.filter(l=>l.part_id).length>60)throw new Error("Sau khi tách nguồn xuất/lắp, phiếu vượt 60 dòng. Chia thành nhiều phiếu.");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Dữ liệu không hợp lệ.";
          throw new Error(
            /^Dòng \d+/.test(message)
              ? message
              : `Dòng ${index + 1}: ${message}`,
          );
        }
      }
      if (sequence.current === revision) setPreview({ lines, parts, targets, sources:sourceLabels });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không phân tích được dữ liệu.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-3">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Nhập nhanh dòng vật tư"
        className="max-h-[85dvh] w-full max-w-6xl space-y-3 overflow-auto rounded-xl bg-white p-5"
      >
        <h3 className="font-bold">Nhập nhanh dòng vật tư</h3>
        <p className="text-xs text-slate-600">Sao chép bảng kèm tiêu đề sang Excel, nhập dữ liệu rồi dán lại vào một ô bên dưới. Dữ liệu được ghép theo tên cột, có thể đổi thứ tự cột. Bảng dán sẽ thay dữ liệu đang nhập.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={docButton} disabled={busy} onClick={()=>void copyTable()}>Sao chép bảng kèm tiêu đề</button>
          <button type="button" className={docButton} disabled={busy||rows.length>=60} onClick={()=>updateRows([...rows,{}])}>Thêm dòng</button>
          {copyNotice&&<span role="status" className="text-xs text-emerald-700">{copyNotice}</span>}
        </div>
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200" onPaste={paste}>
          <table className="w-full min-w-[940px] text-left text-xs" aria-label="Bảng nhập nhanh vật tư">
            <thead className="sticky top-0 bg-slate-50 text-slate-700"><tr><th className="p-2">STT</th>{columns.map(col=><th key={col.key} className="p-2">{col.label}{col.required?" *":""}</th>)}<th className="p-2">Thao tác</th></tr></thead>
            <tbody>{rows.map((row,index)=><tr key={index} className="border-t border-slate-200"><td className="p-2">{index+1}</td>{columns.map(col=><td key={col.key} className="p-1"><input aria-label={col.label+" nhập nhanh dòng "+(index+1)} className={docInput+" min-w-28"} value={row[col.key]??""} disabled={busy} placeholder={col.key==="stock_state"?"Hàng mới / Hàng thu hồi":undefined} onChange={e=>updateRows(rows.map((r,i)=>i===index?{...r,[col.key]:e.target.value}:r))}/></td>)}<td className="p-1"><button type="button" className={docButton} disabled={busy} aria-label={"Xóa dòng nhập nhanh "+(index+1)} onClick={()=>updateRows(rows.length===1?[{}]:rows.filter((_,i)=>i!==index))}>×</button></td></tr>)}</tbody>
          </table>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        {preview && (
          <div className="max-h-52 overflow-auto rounded border border-slate-200">
            <table className="catalog-table w-full text-left">
              <thead>
                <tr>
                  <th>Vật tư</th>
                  <th className="text-right">Số lượng</th>
                  <th>
                    {openingInUse?"Phương tiện / Nguyên giá / Tỷ lệ còn lại":incoming ? "Đơn giá / Gói Data" : "Trạng thái / Serial"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {catalogLabel(
                        preview.parts.find((p) => p.id === line.part_id)!,
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {displayViNumber(line.quantity)}
                    </td>
                    <td>
                      {openingInUse ? ((()=>{const target=preview.targets.find(t=>t.row.id===line.target_id&&t.resource===(line.target_type==="vehicle"?"vehicles":"equipment"));return target?(line.target_type==="vehicle"?openingVehicleLabel(target.row):catalogLabel(target.row)):"—"})())+" · "+(line.opening_current_unit_price||"—")+" · "+(line.opening_quality_percent||"—")+"% · "+(line.serials??[]).join("; ") : incoming
                        ? line.unit_price +
                          (line.data_package ? " · " + line.data_package : "")
                        : stockStates[line.stock_state] + " · " + (line.serials??[]).join("; ")}
                      {kind==="recovery"&&<p className="mt-1 text-xs text-slate-500">Nguồn: {preview.sources[line.usage_id]}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={docButton}
            disabled={busy}
            onClick={() => {
              sequence.current++;
              onClose();
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            className={docButton}
            disabled={busy}
            onClick={() => {
              void inspect();
            }}
          >
            {busy ? "Đang kiểm tra…" : "Xem trước"}
          </button>
          <button
            type="button"
            className={docButton + " !bg-blue-600 !text-white"}
            disabled={!preview || busy}
            onClick={() => preview && onApply(preview.lines, preview.parts, preview.targets)}
          >
            Thêm vào phiếu
          </button>
        </div>
      </section>
    </div>
  );
}
