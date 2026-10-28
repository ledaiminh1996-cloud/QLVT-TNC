import {proposalKeys,proposalSections,proposalPlans,proposalEvidence,type ProposalData} from './proposal.ts';
/** Draft preparation only. No function in this module posts stock or authorizes a stock movement. */
export const documentKinds = {
 external_repair:{label:'Phiếu sửa chữa ngoài',code:'SCN',menu:'ct_sua_chua_ngoai',priced:true},
 proposal:{label:'Phiếu đề xuất VT-TB',code:'PĐX',menu:'ct_de_xuat',priced:true},
 receipt:{label:'Phiếu nhập kho VT-TB',code:'PN',menu:'ct_nhap_kho',priced:true},
 issue:{label:'Phiếu xuất kho VT-TB',code:'PX',menu:'ct_xuat_kho',priced:false},
 recovery:{label:'Phiếu nhập thu hồi VT-TB',code:'PTH',menu:'ct_thu_hoi',priced:false},
 liquidation:{label:'Phiếu thanh lý VT-TB',code:'TL',menu:'ct_thanh_ly',priced:false},
 retread:{label:'Phiếu gửi / nhận đắp vỏ',code:'DV',menu:'ct_dap_vo',priced:false},
 warehouse_transfer:{label:'Điều chuyển giữa kho',code:'PĐC',menu:'ct_dieu_chuyen',priced:false},
 equipment_transfer:{label:'Điều chuyển giữa thiết bị',code:'PĐC',menu:'ct_dieu_chuyen',priced:false},
 rotation:{label:'Đảo vỏ xe / ắc quy',code:'DAO',menu:'ct_dao_vo_acquy',priced:false},
 opening:{label:'Số dư đầu kỳ',code:'SD',menu:'ht_so_du_dau',priced:true},
} as const;
export type DocumentKind=keyof typeof documentKinds;
export type DraftStatus='draft'|'pending'|'approved'|'returned'|'rejected'|'cancelled';
export type StockState='new'|'recovered'|'pending_scrap';
export const stockStates:Record<StockState,string>={new:'Hàng mới',recovered:'Hàng thu hồi',pending_scrap:'Hàng thu hồi chờ thanh lý'};
export interface DraftLine {
 proposal_side?:string;proposal_description?:string;proposal_condition?:string;proposal_source?:string;proposal_location?:string;proposal_destination?:string;proposal_link?:string;
 id:string;part_id:string;quantity:string;document_quantity:string;unit_price:string;vat_rate:string;stock_state:StockState;
 serial:string;tank_id:string;data_package:string;target_type:'vehicle'|'equipment';target_id:string;
 source_line_id:string;usage_id:string;odo:string;hours:string;from_position:string;to_position:string;
 returned_serial:string;retread_cost:string;notes:string;
}
export interface DocumentDraft {
 kind:DocumentKind;business_at:string;warehouse_id:string;to_warehouse_id:string;supplier_id:string;department_id:string;
 proposal_type:'purchase'|'issue'|'transfer'|'repair';recipient:string;invoice_number:string;purpose:string;notes:string;
 proposal?:ProposalData;lines:DraftLine[];
}
export interface DocumentTotals {net:number|null;vat:number|null;gross:number|null}
export interface ApprovalStep {label:string;mode:'any'|'all';approver_ids:string[]}
export interface DocumentWorkflow {id:string;version:number;name:string;department_id:string;proposal_type:DocumentDraft['proposal_type'];steps:ApprovalStep[];is_active:number}
export interface DocumentRecord {
 id:string;version:number;code:string;status:DraftStatus;draft:DocumentDraft;labels:Record<string,string>;totals:DocumentTotals;
 created_by:string;created_by_name:string;created_at:string;updated_at:string;
 workflow_snapshot:{name:string;steps:ApprovalStep[]}|null;approval_step:number;approval_votes:string[];
}
export type DocumentSummary=Omit<DocumentRecord,'draft'|'workflow_snapshot'|'labels'|'approval_votes'> & {kind:DocumentKind;business_at:string;warehouse_label:string;partner_label:string;line_count:number};
export const editableDraft=(status:DraftStatus)=>status==='draft'||status==='returned';
export function emptyLine():DraftLine{return {id:crypto.randomUUID(),part_id:'',quantity:'1',document_quantity:'1',unit_price:'',vat_rate:'0',stock_state:'new',serial:'',tank_id:'',data_package:'',target_type:'vehicle',target_id:'',source_line_id:'',usage_id:'',odo:'',hours:'',from_position:'',to_position:'',returned_serial:'',retread_cost:'',notes:''};}
export function emptyDraft(kind:DocumentKind):DocumentDraft {
 const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16),line=emptyLine();
 if(['retread','recovery'].includes(kind))line.stock_state='recovered';if(kind==='liquidation')line.stock_state='pending_scrap';
 return {kind,business_at:kind==='opening'?local.slice(0,10)+'T00:00':local,warehouse_id:'',to_warehouse_id:'',supplier_id:'',department_id:'',proposal_type:'purchase',recipient:'',invoice_number:'',purpose:'',notes:'',...(kind==='proposal'?{proposal:{}}:{}),lines:[line]};
}
export function scaledDecimal(value:string,places:number,label:string,optional=false):bigint|null {
 if(optional&&value==='')return null;
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(value)||value.length>18)throw new Error(label+': nhập số không âm, tối đa '+places+' chữ số thập phân; không dùng dấu phân cách hàng nghìn.');
 const [whole,fraction='']=value.split('.'),n=BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));
 if(n>9000000000000n)throw new Error(label+' vượt giới hạn.');return n;
}
function rounded(n:bigint,d:bigint):bigint{return (n+d/2n)/d;}
export function lineTotals(line:DraftLine,kind:DocumentKind):DocumentTotals {
 if(!documentKinds[kind].priced||line.unit_price==='')return {net:null,vat:null,gross:null};
 const qty=scaledDecimal(line.quantity,3,'Số lượng')!,price=scaledDecimal(line.unit_price,3,'Đơn giá')!,rate=scaledDecimal(line.vat_rate,2,'VAT')!;
 if(rate>10000n)throw new Error('VAT không vượt quá 100%.');
 const net=rounded(qty*price,1000000n),vat=rounded(net*rate,10000n),gross=net+vat;
 if(gross>9000000000000n)throw new Error('Thành tiền vượt giới hạn.');return {net:Number(net),vat:Number(vat),gross:Number(gross)};
}
export function draftTotals(draft:DocumentDraft):DocumentTotals {
 if(draft.kind==='proposal'&&draft.proposal){const p=draft.proposal;const amounts=['purchase_cost','labor_cost','other_cost'].map(k=>scaledDecimal(p[k as keyof ProposalData]??'',3,k,true));const vat=scaledDecimal(p.vat_cost??'',3,'Thuế dự kiến',true);const net=amounts.some(n=>n===null)?null:amounts.reduce<bigint>((a,n)=>a+n!,0n);if(net!==null&&net+(vat??0n)>9000000000000n)throw new Error('Tổng dự toán vượt giới hạn.');return {net:net===null?null:Number(net)/1000,vat:vat===null?null:Number(vat)/1000,gross:net===null||vat===null?null:Number(net+vat)/1000};}
 const values=draft.lines.map(line=>lineTotals(line,draft.kind));if(values.some(v=>v.net===null))return {net:null,vat:null,gross:null};
 const result={net:0,vat:0,gross:0};for(const value of values)for(const key of ['net','vat','gross'] as const){result[key]+=value[key]!;if(!Number.isSafeInteger(result[key])||result[key]>9000000000000)throw new Error('Tổng tiền vượt giới hạn.');}return result;
}
const headers=['kind','business_at','warehouse_id','to_warehouse_id','supplier_id','department_id','proposal_type','recipient','invoice_number','purpose','notes','lines','proposal'];
const lineKeys=['id','part_id','quantity','document_quantity','unit_price','vat_rate','stock_state','serial','tank_id','data_package','target_type','target_id','source_line_id','usage_id','odo','hours','from_position','to_position','returned_serial','retread_cost','notes'];
export function parseDraft(value:unknown):DocumentDraft {
 const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Dữ liệu phiếu không hợp lệ.');return v as Record<string,unknown>;};
 const text=(v:unknown,max=1000)=>{if(typeof v!=='string'||v.length>max)throw new Error('Trường nhập không hợp lệ hoặc quá dài.');return v.trim();};
 const v=obj(value);if(Object.keys(v).some(k=>!headers.includes(k)))throw new Error('Phiếu có trường không được hỗ trợ.');
 if(typeof v.kind!=='string'||!Object.hasOwn(documentKinds,v.kind))throw new Error('Loại phiếu không hợp lệ.');
 const kind=v.kind as DocumentKind,business_at=text(v.business_at,16);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(business_at)||!Number.isFinite(Date.parse(business_at+':00Z'))||new Date(business_at+':00Z').toISOString().slice(0,16)!==business_at)throw new Error('Ngày giờ chứng từ không hợp lệ.');
 if(!Array.isArray(v.lines)||v.lines.length<1||v.lines.length>60)throw new Error('Một phiếu cần từ 1 đến 60 dòng.');
 const d={kind,business_at,lines:[] as DraftLine[]} as DocumentDraft;
 for(const key of headers.filter(k=>!['kind','business_at','lines','proposal'].includes(k)))Object.assign(d,{[key]:text(v[key],key==='notes'?4000:1000)});
 if(v.proposal!==undefined){if(kind!=='proposal')throw new Error('Chỉ PĐX có thông tin mẫu đề xuất.');const p=obj(v.proposal);if(Object.keys(p).some(k=>!(proposalKeys as readonly string[]).includes(k)))throw new Error('Thông tin đề xuất không hợp lệ.');for(const [key,choices] of [['plans',proposalPlans],['evidence',proposalEvidence]] as const){if(p[key]!==undefined&&(typeof p[key]!=='string'||(p[key] as string).split(';').filter(Boolean).some(x=>!choices.includes(x))))throw new Error('Lựa chọn nhiều mục không hợp lệ.');}d.proposal={};for(const [k,val] of Object.entries(p))Object.assign(d.proposal,{[k]:text(val,4000)});for(const [,fields] of proposalSections)for(const f of fields){const val=d.proposal[f[0]]??'',type:string=f.length>2?(f[2]??''):'';if(val&&type.includes('|')&&!type.split('|').includes(val))throw new Error('Lựa chọn đề xuất không hợp lệ.');if(type==='amount')scaledDecimal(val,3,f[1],true);}}
 if(!['purchase','issue','transfer','repair'].includes(d.proposal_type))throw new Error('Loại đề xuất không hợp lệ.');
 if(!['equipment_transfer','rotation','proposal','external_repair'].includes(kind)&&!d.warehouse_id)throw new Error('Chọn kho.');
 if(kind==='proposal'&&!d.department_id)throw new Error('Chọn bộ phận đề xuất.');
 if(kind==='warehouse_transfer'&&(!d.to_warehouse_id||d.warehouse_id===d.to_warehouse_id))throw new Error('Kho đi và kho đến phải khác nhau.');
 const ids=new Set<string>(),serials=new Set<string>();
 d.lines=v.lines.map((raw,index)=>{const l=obj(raw);if(Object.keys(l).some(k=>!lineKeys.includes(k)&&!['proposal_side','proposal_description','proposal_condition','proposal_source','proposal_location','proposal_destination','proposal_link'].includes(k)))throw new Error('Dòng vật tư có trường không được hỗ trợ.');
  const row=Object.fromEntries(lineKeys.map(key=>[key,text(l[key],key==='notes'?1000:256)])) as unknown as DraftLine;
  for(const k of ['proposal_side','proposal_description','proposal_condition','proposal_source','proposal_location','proposal_destination','proposal_link'])if(l[k]!==undefined){if(kind!=='proposal')throw new Error('Trường chỉ dùng cho đề xuất.');Object.assign(row,{[k]:text(l[k],1000)});}if(row.proposal_side&&!['remove','install'].includes(row.proposal_side))throw new Error('Bảng vật tư không hợp lệ.');
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(row.id)||ids.has(row.id))throw new Error('ID dòng bị trùng hoặc không hợp lệ.');ids.add(row.id);
  if(!row.part_id)throw new Error('Dòng '+(index+1)+': chọn vật tư.');if(scaledDecimal(row.quantity,3,'Số lượng')!<=0n)throw new Error('Số lượng phải lớn hơn 0.');
  for(const key of ['document_quantity','unit_price','retread_cost','odo','hours'] as const)scaledDecimal(row[key],3,key,true);
  if(!Object.hasOwn(stockStates,row.stock_state)||!['vehicle','equipment'].includes(row.target_type))throw new Error('Trạng thái hàng hoặc loại thiết bị không hợp lệ.');
  if(kind==='receipt'&&row.stock_state!=='new')throw new Error('PN nhận Hàng mới; hàng đã dùng đi qua phiếu thu hồi.');
  if(kind==='opening'&&row.stock_state==='pending_scrap')throw new Error('Số dư đầu kỳ dùng Hàng mới hoặc Hàng thu hồi.');
  if(kind==='issue'&&row.stock_state==='pending_scrap')throw new Error('PX chỉ xuất Hàng mới hoặc Hàng thu hồi.');
  if(kind==='recovery'&&row.stock_state==='new')throw new Error('Thu hồi chỉ nhận Hàng thu hồi hoặc chờ thanh lý.');
  if(kind==='liquidation'&&row.stock_state!=='pending_scrap')throw new Error('Thanh lý chỉ dùng Hàng thu hồi chờ thanh lý.');
  if(kind==='retread'&&row.stock_state!=='recovered')throw new Error('Gửi đắp chỉ dùng Hàng thu hồi.');
  if(row.serial){const serial=row.serial.normalize('NFC').toLocaleUpperCase('vi-VN');if(serials.has(serial))throw new Error('Serial trùng trong phiếu: '+row.serial);serials.add(serial);if(scaledDecimal(row.quantity,3,'Số lượng')!==1000n)throw new Error('Dòng có Serial phải có số lượng 1.');}
  if(!documentKinds[kind].priced&&row.unit_price!=='')throw new Error('Giá vốn phải được xác định từ nguồn khi ghi sổ.');
  if(kind==='opening'&&scaledDecimal(row.vat_rate,2,'VAT')!==0n)throw new Error('Số dư đầu kỳ không cộng VAT mua hàng.');
  lineTotals(row,kind);return row;
 });draftTotals(d);return d;
}
export function previewNumber(draft:DocumentDraft):string {return draft.business_at.slice(5,7)+'.'+draft.business_at.slice(2,4)+'.00001/'+documentKinds[draft.kind].code;}
/** Quoted CSV/TSV, no coercion of identifiers or serials. A fourth PN column is Gói Data. */
export function parseQuickLines(text:string):string[][] {
 const input=text.replace(/^\uFEFF/,'').trim();if(!input)return [];
 const separator=input.split(/\r?\n/,1)[0].includes('\t')?'\t':',',rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Thiếu dấu đóng ngoặc kép trong dữ liệu nhập.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length>60)throw new Error('Tối đa 60 dòng một phiếu.');return rows;
}

export function isDocumentMenu(menu:string):boolean{return menu==='ht_quy_trinh'||Object.values(documentKinds).some(kind=>kind.menu===menu);}

