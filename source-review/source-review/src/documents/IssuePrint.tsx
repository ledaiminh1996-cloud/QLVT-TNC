import type {DocumentRecord,DraftLine} from "../../shared/documents";
import {stockStates} from "../../shared/documents";
import {lineSerials,serialKey} from "../../shared/documentSerials";
import {issuePurposes,issueInstallationLabel} from "../../shared/issueDetails";
import {documentDateTime,money} from "./documentFormatting";
const blank="........................................";
const number=(value:number|null,decimals=0)=>value===null?"—":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:decimals}).format(value);
const partName=(label:string)=>label.includes(" — ")?label.slice(label.indexOf(" — ")+3):label;
interface SerialCost {serial:string;unit_price_vnd_milli:number;amount_vnd:number}
function serialCosts(raw:string|undefined,serials:string[],total:number|null):SerialCost[]|undefined{
 try{
  const data:unknown=JSON.parse(raw??"null");
  if(!Array.isArray(data)||data.length!==serials.length)return;
  const result:SerialCost[]=[];
  for(const serial of serials){const entry:unknown=data.find((item:unknown)=>!!item&&typeof item==="object"&&"serial"in item&&typeof item.serial==="string"&&serialKey(item.serial)===serialKey(serial));
   if(!entry||typeof entry!=="object"||!("unit_price_vnd_milli"in entry)||!("amount_vnd"in entry)||!Number.isSafeInteger(entry.unit_price_vnd_milli)||!Number.isSafeInteger(entry.amount_vnd)||Number(entry.unit_price_vnd_milli)<0||Number(entry.amount_vnd)<0)return;
   result.push({serial,unit_price_vnd_milli:Number(entry.unit_price_vnd_milli),amount_vnd:Number(entry.amount_vnd)});
  }
  if(total!==null&&result.reduce((sum,e)=>sum+e.amount_vnd,0)!==total)return;
  return result;
 }catch{return;}
}
export function issuePrintRows(row:DocumentRecord){
 let sequence=0;
 return row.draft.lines.flatMap(line=>{
  const serials=lineSerials(line),raw=row.labels["issue_amount:"+line.id],amount=raw===undefined?null:Number(raw);
  const priceRaw=row.labels["issue_unit_price:"+line.id];
  const price=priceRaw!==undefined?Number(priceRaw)/1000:amount!==null&&Number(line.quantity)>0?amount/Number(line.quantity):null;
  if(!serials.length||serials.length!==Number(line.quantity))return [{line,sequence:++sequence,quantity:line.quantity,serial:serials.join("; "),amount,price,rounding:false}];
  const costs=serialCosts(row.labels["issue_serial_costs:"+line.id],serials,amount);
  return serials.map((serial,index)=>({line,sequence:++sequence,quantity:"1",serial,price:costs?costs[index].unit_price_vnd_milli/1000:price,amount:costs?costs[index].amount_vnd:amount===null?null:Number(BigInt(amount)/BigInt(serials.length)+(BigInt(index)<BigInt(amount)%BigInt(serials.length)?1n:0n)),rounding:!costs&&amount!==null&&amount%serials.length!==0}));
 });
}
export function IssuePrint({row}:{row:DocumentRecord}){
 const {draft,labels}=row,info=draft.issue_details,rows=issuePrintRows(row);
 return <main className="receipt-print issue-print">
  <div className="receipt-page-id">Số phiếu: {row.code} · Ngày {documentDateTime(draft.business_at)}</div>
  <header><div className="company">CÔNG TY TNHH DV VÀ TM TÂN NAM CHINH. MÃ SỐ THUẾ: 0303955513</div><h1>PHIẾU XUẤT KHO VẬT TƯ – THIẾT BỊ</h1><div className="document-number">Số: <strong>{row.code}</strong> · Ngày {documentDateTime(draft.business_at)}</div></header>
  {row.status!=="posted"&&<div className="receipt-watermark">{row.status==="cancelled"?"PHIẾU ĐÃ HỦY":"CHƯA GHI SỔ KHO"}</div>}
  <section className="receipt-meta">
   <p>Kho xuất: <strong>{labels["warehouses:"+draft.warehouse_id]||blank}</strong></p>
   <p>Người nhận: <strong>{draft.recipient||blank}</strong><span className="address">Bộ phận nhận: {info?.department_name||blank}</span></p>
   <p>Nội dung: {draft.purpose||blank}</p>
   <p>Theo đề xuất số: ........................ ngày ..../..../........<span className="address">Người duyệt: ........................</span></p>
   <p>Họ tên lái xe: <strong>{info?.driver_name||blank}</strong><span className="address">Biển số xe: <strong>{info?.vehicle_plate||"........................"}</strong></span></p>
   <p>Số Km (ODO) hiện tại: {info?.odo?number(Number(info.odo),3):blank}</p>
   {info?.installation_target&&<p>Phương tiện lắp thiết bị: <strong>{issueInstallationLabel(info)}</strong>{info.installation_odo&&<> · ODO lúc lắp: {number(Number(info.installation_odo),3)}</>}{info.installation_hours&&<> · Giờ máy lúc lắp: {number(Number(info.installation_hours),3)}</>}</p>}
   <p>Nhóm xe: {[["BNAM","Đường dài"],["DCANG","Đường cảng"],["box_truck","Xe tải thùng"],["office_car","Xe con"]].map(([key,label])=><span className="issue-vehicle-group" key={key}>{label} {info?.vehicle_group===key?"☑":"☐"}</span>)}</p>
   <p>Phương tiện/thiết bị ghép nối: Rơmooc số: {info?.trailer_number||"................"} · Máy phát: {info?.other||"................"} · Container số: {info?.container_number||"................"}</p>
  </section>
  <table className="receipt-goods issue-goods"><colgroup>{[4,11,18,5,7,6,10,11,10,10,8].map((w,i)=><col key={i} style={{width:w+"%"}}/>)}</colgroup>
   <thead><tr>{["STT","Mã vật tư","Tên vật tư","ĐVT","Chất lượng","Số lượng","Đơn giá","Thành tiền","Số serial (nếu có)","Vị trí lắp","Ghi chú"].map(label=><th key={label}>{label}</th>)}</tr></thead>
   <tbody><tr className="issue-section"><td className="center">I</td><td colSpan={10}>Vật tư TB thay thế</td></tr>
   {rows.map(printed=>{const l:DraftLine=printed.line;return <tr key={l.id+":"+printed.sequence} data-serial-row={printed.serial||undefined}>
    <td className="center">{printed.sequence}</td><td className="code">{labels["sku:"+l.part_id]||labels["parts:"+l.part_id]?.split(" — ")[0]||"—"}</td><td>{partName(labels["parts:"+l.part_id]||"")}</td><td className="center">{labels["unit:"+l.part_id]||"—"}</td><td className="center">{stockStates[l.stock_state]}</td><td className="number">{number(Number(printed.quantity),3)}</td><td className="number">{number(printed.price,3)}</td><td className="number">{number(printed.amount)}</td><td className="code">{printed.serial||"—"}</td><td>{l.to_position||"—"}</td><td>{l.notes}{labels["valuation_pending:"+l.id]==="1"&&<small>Chưa xác định giá trị – cần bổ sung sau.</small>}{l.issue_purpose&&l.issue_purpose!=="use"&&<small>Mục đích: {issuePurposes[l.issue_purpose]}</small>}</td>
   </tr>;})}
   <tr className="receipt-total"><td colSpan={7}>Tổng cộng</td><td className="number">{number(row.totals.net)}</td><td colSpan={3}/></tr></tbody>
  </table>
  {rows.some(r=>r.rounding)&&<p className="receipt-rounding">Thành tiền được phân bổ theo serial từ số đã lưu, giữ nguyên tổng giá trị phiếu; có thể chênh 1 đồng do làm tròn.</p>}
  <section className="receipt-bottom"><p className="payment">Tổng giá trị xuất kho: <strong>{money(row.totals.net)}</strong></p>{draft.notes&&<p>Ghi chú: {draft.notes}</p>}<div className="receipt-signatures">{["Người lập phiếu","Người giao hàng","Người nhận","Thủ kho","Trưởng bộ phận"].map((label,index)=><div key={label}><strong>{label}</strong><em>(Ký, ghi rõ họ tên)</em><div className="signature-space"/>{index===0&&<strong>{row.created_by_name}</strong>}{index===2&&<strong>{draft.recipient}</strong>}</div>)}</div></section>
 </main>;
}
export const issuePrintCss=`
/* Page numbers use the receipt margin box; avoid a fixed footer creating a blank page. */
.receipt-print.issue-print .receipt-page-id{display:none!important}
.receipt-print.issue-print .receipt-signatures{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
.receipt-print.issue-print .receipt-signatures strong{display:block}
.receipt-print.issue-print .issue-section{font-weight:700;color:#173f8a;background:#f8fafc!important}
.receipt-print.issue-print .issue-vehicle-group{display:inline-block;margin-right:12px;white-space:nowrap}
.receipt-print.issue-print .issue-goods .number{overflow-wrap:normal;word-break:normal}
`;
