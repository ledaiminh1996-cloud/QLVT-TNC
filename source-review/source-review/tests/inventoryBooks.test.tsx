import test,{afterEach} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {JSDOM} from "jsdom";
import {unzipSync,strFromU8} from "fflate";
import type {BookFilter,BookGroup,BookMovement,BookPage} from "../shared/inventoryBooks";
import {createBookClient} from "../src/books/bookClient";
import {buildBookWorkbook,bookPrintMarkup} from "../src/books/bookOutput";
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:"https://test.invalid"});
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle,innerWidth:1440,innerHeight:900,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
const {render,screen,fireEvent,waitFor,cleanup,within}=await import("@testing-library/react");
const {InventoryBooks}=await import("../src/books/InventoryBooks");const {createDocumentPreview}=await import("../src/documents/previewStore");
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false};
afterEach(()=>cleanup());
const group:BookGroup={part_id:"part-tire",sku:"0000123",part_name:"Vỏ xe <mẫu>",unit:"Cái",warehouse_id:"wh-1",warehouse_code:"KH01",warehouse_name:"Kho chính",stock_state:"new",last_at:"2026-10-24T10:00",pending_lines:0,transfer_in_quantity_milli:1000,transfer_in_value_vnd:1000,transfer_out_quantity_milli:2000,transfer_out_value_vnd:2000,first_movement_at:"2026-10-01T08:00",last_movement_at:"2026-10-24T10:00",opening_quantity_milli:10000,opening_value_vnd:10000,in_quantity_milli:5000,in_value_vnd:5000,out_quantity_milli:3000,out_value_vnd:3000,closing_quantity_milli:12000,closing_value_vnd:12000};
const movement:BookMovement={target_label:"51R-047.31",target_kind:"Rơ moóc",odo:"123456.5",hours:"12.25",movement_id:"m1",part_id:group.part_id,sku:group.sku,part_name:group.part_name,unit:"Cái",warehouse_id:group.warehouse_id,warehouse_code:group.warehouse_code,warehouse_name:group.warehouse_name,stock_state:"new",business_at:"2026-10-24T10:00",document_id:"root",draft_id:"document",code:"10.26.00001/PN",kind:"receipt",purpose:"=1+1",notes:"<script>alert(1)</script>",serials:"00001; 00002",in_quantity_milli:5000,in_value_vnd:5000,out_quantity_milli:0,out_value_vnd:0,balance_quantity_milli:15000,balance_value_vnd:15000,valuation_pending:false};
function page(f:BookFilter):BookPage{return {book:f.book,from:f.from,to:f.to,data:f.book!=="summary"?[{...movement}]:[{...group}],groups:f.book==="card"?[{...group}]:[],totals:{transfer_in_value_vnd:1000,transfer_out_value_vnd:2000,group_count:1,pending_groups:0,opening_value_vnd:10000,in_value_vnd:5000,out_value_vnd:3000,closing_value_vnd:12000},pagination:{page:f.page??1,page_size:f.page_size??25,total:1}}}
async function preview(){const p=createDocumentPreview(()=>({id:"preview-admin",display_name:"Quản trị",role:"admin"}));await p.ready;return p}

test("NXT summary shows warehouse/unit as text; detail still opens the original read only",async()=>{
 const p=await preview(),calls:BookFilter[]=[];const original=await p.documents.get((await p.documents.list({kind:"receipt"})).data[0].id);const client={warehouses:async()=>[{id:"wh-1",code:"KH01",name:"Kho chính"}],read:async(f:BookFilter)=>{calls.push(f);return page(f)}};const documents={...p.documents,get:async()=>original};
 const mounted=render(<InventoryBooks book="summary" api={p.catalog} documents={documents} client={client}/>);const table=await screen.findByRole("table",{name:"Sổ tổng hợp NXT"});await waitFor(()=>assert.ok(table.textContent?.includes('0000123')));assert.equal(table.querySelectorAll('thead th').length,14);assert.deepEqual([...table.querySelectorAll('thead th')].slice(4,12).map(el=>el.textContent),['Tồn đầu','Dư đầu','SL nhập','Tiền nhập','SL xuất','Tiền xuất','Tồn cuối','Dư cuối']);assert.equal(table.querySelectorAll('tbody tr:first-child td').length,14);assert.ok(screen.getByRole('button',{name:/Xem chi tiết nhập xuất 0000123 tại KH01/}));assert.ok(table.textContent?.includes('Kho chính'));assert.ok(screen.getByRole('columnheader',{name:'Trạng thái hàng'}));assert.ok(screen.getByRole('columnheader',{name:'ĐVT'}));assert.equal(table.querySelectorAll('tbody tr:first-child td')[3].textContent,'Cái');assert.equal(screen.queryByRole('columnheader',{name:'Nhập ĐC'}),null);assert.equal(screen.queryByRole('columnheader',{name:'Xuất ĐC'}),null);assert.ok(table.textContent?.includes('01/10/2026'));assert.ok(table.textContent?.includes('24/10/2026'));const {bookOutputRows}=await import('../src/books/bookOutput');const exported=bookOutputRows(page({book:'summary',from:'2026-10-01',to:'2026-10-31'}));assert.equal(exported[3].length,16);assert.deepEqual(exported[4].slice(6,14),[10,10000,5,5000,3,3000,12,12000]);assert.equal(exported[4][14],'01/10/2026');const printed=new JSDOM(bookPrintMarkup(page({book:'summary',from:'2026-10-01',to:'2026-10-31'}))).window.document;assert.equal(printed.querySelectorAll('thead th').length,14);assert.deepEqual([...printed.querySelectorAll('thead th')].slice(4,12).map(el=>el.textContent),['Tồn đầu','Dư đầu','SL nhập','Tiền nhập','SL xuất','Tiền xuất','Tồn cuối','Dư cuối']);assert.ok(printed.body.textContent?.includes('Kho chính'));mounted.unmount();
 render(<InventoryBooks book="card" api={p.catalog} documents={documents} client={client}/>);fireEvent.focus(screen.getByRole('combobox',{name:'Vật tư *',exact:true}));fireEvent.click(await screen.findByRole('option',{name:/M-RM-LOP-0001/}));await waitFor(()=>assert.equal(calls.at(-1)?.book,'card'));assert.equal(calls.at(-1)?.part_id,'part-tire');const card=screen.getByRole('table',{name:'Sổ chi tiết NXT'});assert.equal(card.querySelectorAll('thead th').length,9);fireEvent.click(await screen.findByRole('button',{name:'10.26.00001/PN',exact:true}));await screen.findByRole('dialog');assert.equal(screen.queryByRole('button',{name:'Lưu',exact:true}),null);
});

test("book filters discard stale responses and failures clear displayed totals without cached fallback",async()=>{
 const p=await preview();let resolveOld:((p:BookPage)=>void)|undefined,oldFilter:BookFilter|undefined;let calls=0;const client={warehouses:async()=>[{id:"wh-1",code:"KH01",name:"Kho chính"}],read:async(f:BookFilter)=>{calls++;if(calls===1){oldFilter=f;return new Promise<BookPage>(resolve=>{resolveOld=resolve})}if(f.stock_state==="pending_scrap")throw new Error("offline");return page(f)}};
 render(<InventoryBooks book="summary" api={p.catalog} documents={p.documents} client={client}/>);await waitFor(()=>assert.ok(resolveOld));fireEvent.change(screen.getByLabelText("Trạng thái hàng sổ"),{target:{value:"recovered"}});await waitFor(()=>assert.ok(screen.getByText("0000123",{exact:true})));resolveOld!({...page(oldFilter!),data:[{...movement,sku:"STALE"}]});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(screen.queryByText("STALE",{exact:true}),null);fireEvent.change(screen.getByLabelText("Trạng thái hàng sổ"),{target:{value:"pending_scrap"}});await screen.findByRole("alert");assert.equal(screen.queryByText("0000123",{exact:true}),null);assert.ok((screen.getByRole("button",{name:"Xuất Excel"}) as HTMLButtonElement).disabled);
});

test("inventory book client validates unknown values, full export completeness and authenticated requests",async()=>{
 const filter:BookFilter={book:"summary",from:"2026-10-01",to:"2026-10-31",warehouse_id:"wh-1",stock_state:"new"};let requestUrl="",options:RequestInit|undefined;const client=createBookClient(async(url,init)=>{requestUrl=String(url);options=init;return Response.json(page(filter))});const result=await client.read(filter);assert.equal(result.data.length,1);assert.ok(requestUrl.includes("warehouse_id=wh-1"));assert.equal(options?.credentials,"same-origin");assert.equal(options?.cache,"no-store");
 const pending=page(filter);(pending.data[0] as BookGroup).closing_value_vnd=null;pending.totals.closing_value_vnd=null;assert.equal((await createBookClient(async()=>Response.json(pending)).read(filter)).totals.closing_value_vnd,null);
 const malformedTransfer=page(filter);malformedTransfer.totals.transfer_in_value_vnd=1.5;await assert.rejects(()=>createBookClient(async()=>Response.json(malformedTransfer)).read(filter));
 const malformed=page(filter);(malformed.data[0] as BookGroup).closing_quantity_milli=Infinity;await assert.rejects(()=>createBookClient(async()=>Response.json(malformed)).read(filter));const short=page(filter);short.pagination.total=2;await assert.rejects(()=>createBookClient(async()=>Response.json(short)).read({...filter,export:true}));await assert.rejects(()=>createBookClient(async()=>new Response("login",{status:302})).read(filter),e=>e instanceof Error&&"status" in e&&e.status===401);
});

test("book Excel and print preserve numeric quantities, text identifiers, blank unknown values and escaped text",()=>{
 const result=page({book:"card",from:"2026-10-01",to:"2026-10-31"});result.data=[{...movement,in_value_vnd:null,balance_value_vnd:null,valuation_pending:true}];result.totals.pending_groups=1;const files=unzipSync(buildBookWorkbook(result));const xml=strFromU8(files["xl/worksheets/sheet1.xml"]),sheet=new JSDOM(xml,{contentType:"application/xml"}).window.document;assert.equal(sheet.querySelector("parsererror"),null);assert.ok(xml.includes("00001"));assert.ok(xml.includes("00002"));assert.ok(!xml.includes("00001; 00002"));assert.ok(xml.includes("=1+1"));assert.equal(sheet.querySelectorAll("f").length,0);assert.ok(sheet.querySelectorAll("c:not([t]) v").length>0);const rows=[...sheet.querySelectorAll("row")];const transaction=rows.find(row=>row.textContent?.includes("10.26.00001/PN"))!;assert.equal(transaction.children[7].textContent,"5");assert.ok(!transaction.children[8].querySelector("v"));const html=bookPrintMarkup(result);assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("<script>"));assert.ok(html.includes("Chưa" )||html.includes("chưa xác định"));
});


test("tracking exports use the fourteen requested columns and preserve readings and serials",async()=>{
 const {bookOutputRows}=await import("../src/books/bookOutput");const result=page({book:"stock",from:"2026-10-01",to:"2026-10-31"});const rows=bookOutputRows(result);assert.deepEqual(rows[3],["Ngày phiếu","Số phiếu","Loại phiếu","Kho","Trạng thái hàng","Mã vật tư","Tên vật tư","ĐVT","SL nhập","SL xuất","Serial","Biển số","Loại thiết bị","ODO/Giờ"]);assert.equal(rows[4].length,14);assert.equal(rows[4][8],5);assert.equal(rows[4][10],"00001; 00002");assert.equal(rows[4][11],"51R-047.31");assert.equal(rows[4][13],"123.456,5 km / 12,25 giờ");const client=createBookClient(async()=>Response.json(result));assert.equal((await client.read({book:"stock",from:result.from,to:result.to})).data.length,1);const malformed=structuredClone(result);delete (malformed.data[0] as BookMovement).target_kind;await assert.rejects(()=>createBookClient(async()=>Response.json(malformed)).read({book:"stock",from:result.from,to:result.to}));
});

test("tracking target uses frozen row equipment over paired tractor, keeps zero readings and never substitutes tractor ODO",async()=>{
 const {bookTarget}=await import("../worker/src/bookTarget");const header={issue_details:{vehicle_plate:"50H-001",vehicle_group:"BNAM",odo:"999999",trailer_number:"51R-001",other:"MP001"}};const row={kind:"issue",header_json:JSON.stringify(header),labels_json:JSON.stringify({"vehicles:trailer":"51R-001 — Rơ moóc","type:vehicles:trailer":"trailer"}),line_json:JSON.stringify({id:"l",target_type:"vehicle",target_id:"trailer",odo:"",hours:"0"}),vehicle_plate_snapshot:"51R-001",vehicle_odo_km:null};assert.deepEqual(bookTarget(row),{target_label:"51R-001",target_kind:"Rơ moóc",odo:"",hours:"0"});row.line_json=JSON.stringify({id:"l",target_type:"equipment",target_id:"mp",odo:"",hours:"123.5"});row.labels_json=JSON.stringify({"equipment:mp":"MP001 — Máy phát","type:equipment:mp":"generator"});row.vehicle_plate_snapshot="";assert.deepEqual(bookTarget(row),{target_label:"MP001",target_kind:"Máy phát",odo:"",hours:"123.5"});assert.deepEqual(bookTarget({}),{target_label:"",target_kind:"",odo:"",hours:""});
});


test('NXT summary has no serial column; detail opens individual serials and exports without duplicate amounts',async()=>{
 const p=await preview(),filters:BookFilter[]=[];const client={warehouses:async()=>[{id:'wh-1',code:'KH01',name:'Kho chính'}],read:async(f:BookFilter)=>{filters.push(f);return page(f)}};const summaryView=render(<InventoryBooks book="summary" api={p.catalog} documents={p.documents} client={client}/>);await screen.findByText('0000123');assert.equal(screen.queryByText('Serial',{exact:true}),null);summaryView.unmount();render(<InventoryBooks book="card" api={p.catalog} documents={p.documents} client={client}/>);fireEvent.focus(screen.getByRole('combobox',{name:'Vật tư *',exact:true}));fireEvent.click(await screen.findByRole('option',{name:/M-RM-LOP-0001/}));const open=await screen.findByRole('button',{name:/Mở Serial/});fireEvent.click(open);await screen.findByRole('button',{name:'00001',exact:true});await screen.findByRole('button',{name:'00002',exact:true});fireEvent.click(screen.getByRole('button',{name:'00001',exact:true}));await waitFor(()=>assert.equal(filters.at(-1)?.q,'00001'));assert.equal(filters.at(-1)?.page_size,50);fireEvent.click(screen.getByRole('button',{name:'Cột hiển thị'}));assert.ok(screen.getByLabelText('Mật độ sổ'));assert.ok(screen.getByLabelText('Giá trị (đ)'));
 const result=page({book:'card',from:'2026-10-01',to:'2026-10-31'});const {bookOutputRows}=await import('../src/books/bookOutput');const rows=bookOutputRows(result),header=rows.findIndex(r=>r.includes('Serial')),serialColumn=rows[header].indexOf('Serial');const children=rows.slice(header+1).filter(r=>r[serialColumn]==='00001'||r[serialColumn]==='00002');assert.equal(children.length,2);assert.ok(children.every(r=>r[7]===''&&r[8]===''));assert.equal(rows.slice(header+1).filter(r=>r.includes('10.26.00001/PN')).length,1);assert.ok(bookPrintMarkup(result).includes('00001'));
});


test('summary keeps a single filter row, zero dashes and full-filter monetary totals distinct from page and unknown values',async()=>{
 const p=await preview();const client={warehouses:async()=>[],read:async(f:BookFilter)=>{const result=page(f);result.data=[{...group,opening_quantity_milli:0,opening_value_vnd:0,in_value_vnd:1020000123,out_value_vnd:null}];result.pagination.total=75;result.totals={...result.totals,opening_value_vnd:987654321,in_value_vnd:2345678901,out_value_vnd:null};return result}};
 render(<InventoryBooks book="summary" api={p.catalog} documents={p.documents} client={client}/>);
 const footer=await screen.findByLabelText('Tổng giá trị theo toàn bộ bộ lọc');
 assert.equal(screen.queryByRole('combobox',{name:'Vật tư',exact:true}),null);
 assert.equal(screen.queryByRole('button',{name:/Bộ lọc khác/}),null);
 assert.equal(screen.queryByText('Đã ghi sổ',{exact:true}),null);
 assert.ok(screen.getByLabelText('Trạng thái hàng sổ'));
 assert.ok(screen.getByRole('columnheader',{name:'Phát sinh đầu',exact:true}));
 assert.ok(screen.getByRole('columnheader',{name:'Phát sinh cuối',exact:true}));
 const table=screen.getByRole('table',{name:'Sổ tổng hợp NXT'}),cells=table.querySelectorAll('tbody tr:first-child td');
 assert.equal(cells[4].textContent,'–');assert.equal(cells[7].textContent,'1.020.000.123 đ');
 assert.ok(cells[7].querySelector('wbr'));assert.equal(cells[9].querySelector('.nxt-unknown')?.getAttribute('title'),'Chưa xác định giá trị');
 assert.equal(footer.querySelector('[aria-label="Dư đầu"]')?.textContent,'987.654.321 đ');
 assert.equal(footer.querySelector('[aria-label="Tiền nhập"]')?.textContent,'2.345.678.901 đ');
 assert.equal(footer.querySelector('[aria-label="Tiền xuất"] .nxt-unknown')?.textContent,'–');assert.equal(footer.querySelectorAll('.nxt-summary-total-value').length,4);
 assert.equal(table.querySelectorAll('.text-right').length,0);
 fireEvent.click(screen.getByRole('button',{name:'Cột hiển thị'}));fireEvent.click(screen.getByLabelText('Giá trị (đ)'));
 assert.equal(screen.queryByLabelText('Tổng giá trị theo toàn bộ bộ lọc'),null);assert.equal(table.querySelectorAll('thead th').length,10);assert.equal(table.querySelectorAll('.nxt-summary-money-cell').length,0);
});


test('summary opens the existing detail view with row scope, preserves the summary, and closes nested documents independently',async()=>{
 const p=await preview(),calls:BookFilter[]=[];const original=await p.documents.get((await p.documents.list({kind:'receipt'})).data[0].id);
 const client={warehouses:async()=>[{id:'wh-1',code:'KH01',name:'Kho chính'}],read:async(f:BookFilter)=>{calls.push({...f});const r=page(f);r.data=f.book==='summary'?[{...group,stock_state:'recovered'}]:[{...movement,stock_state:'recovered'}];r.groups=f.book==='card'?[{...group,stock_state:'recovered'}]:[];return r}};
 render(<InventoryBooks book="summary" api={p.catalog} documents={{...p.documents,get:async()=>original}} client={client}/>);
 await screen.findByRole('button',{name:/Xem chi tiết nhập xuất 0000123/});
 fireEvent.change(screen.getByLabelText('Tìm sổ NXT'),{target:{value:'Vỏ'}});fireEvent.click(screen.getByRole('button',{name:'Mã A → Z',exact:true}));
 await waitFor(()=>assert.equal(calls.at(-1)?.direction,'desc'));const parentFilter={...calls.at(-1)!},parentCalls=calls.length;
 const link=await screen.findByRole('button',{name:/Xem chi tiết nhập xuất 0000123/});link.focus();fireEvent.click(link);
 const dialog=await screen.findByRole('dialog',{name:'Chi tiết nhập xuất vật tư trong kỳ'}),popup=within(dialog);
 await popup.findByRole('button',{name:'10.26.00001/PN',exact:true});const f=calls.at(-1)!;
 assert.deepEqual(f,{book:'card',from:parentFilter.from,to:parentFilter.to,part_id:'part-tire',warehouse_id:'wh-1',stock_state:'recovered',direction:'asc',page:1,page_size:50});assert.equal(f.q,undefined);assert.equal(f.kind,undefined);
 assert.ok(popup.getByLabelText('Phạm vi chi tiết').textContent?.includes('Hàng thu hồi'));
 assert.ok(popup.getByText('Tồn đầu kỳ',{exact:true}));assert.ok(popup.getByText('Tồn cuối kỳ',{exact:true}));
 fireEvent.click(popup.getByRole('button',{name:/Mở Serial/}));await popup.findByRole('button',{name:'00001',exact:true});
 fireEvent.click(popup.getByRole('button',{name:'Cột hiển thị'}));fireEvent.keyDown(popup.getByLabelText('Mật độ sổ'),{key:'Escape'});
 assert.equal(popup.queryByLabelText('Mật độ sổ'),null);assert.ok(screen.getByRole('dialog',{name:'Chi tiết nhập xuất vật tư trong kỳ'}));
 fireEvent.click(popup.getByRole('button',{name:'10.26.00001/PN',exact:true}));
 const doc=await screen.findByRole('dialog',{name:/Chi tiết \/ sửa/});assert.equal(within(doc).queryByRole('button',{name:'Lưu',exact:true}),null);
 fireEvent.keyDown(within(doc).getByRole('button',{name:'Đóng phiếu'}),{key:'Escape'});await waitFor(()=>assert.equal(screen.queryByRole('dialog',{name:/Chi tiết \/ sửa/}),null));assert.ok(screen.getByRole('dialog',{name:'Chi tiết nhập xuất vật tư trong kỳ'}));
 fireEvent.keyDown(popup.getByRole('button',{name:'Đóng chi tiết nhập xuất'}),{key:'Escape'});
 await waitFor(()=>assert.equal(screen.queryByRole('dialog',{name:'Chi tiết nhập xuất vật tư trong kỳ'}),null));
 assert.equal(document.activeElement,link);assert.equal((screen.getByLabelText('Tìm sổ NXT') as HTMLInputElement).value,'Vỏ');assert.ok(screen.getByRole('button',{name:'Mã Z → A',exact:true}));assert.equal(calls.filter(c=>c.book==='summary').length,parentCalls);assert.equal(screen.getAllByRole('table').length,1);
});

test('closing detail aborts its pending read and ignores late data without replacing summary',async()=>{
 const p=await preview();let signal:AbortSignal|undefined,resolve:((r:BookPage)=>void)|undefined,detailFilter:BookFilter|undefined;
 const client={warehouses:async()=>[],read:async(f:BookFilter,s?:AbortSignal)=>{if(f.book==='summary')return page(f);signal=s;detailFilter=f;return new Promise<BookPage>(done=>{resolve=done})}};
 render(<InventoryBooks book="summary" api={p.catalog} documents={p.documents} client={client}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Xem chi tiết nhập xuất 0000123/}));await waitFor(()=>assert.ok(resolve));
 fireEvent.click(screen.getByRole('button',{name:'Đóng chi tiết nhập xuất'}));assert.ok(signal?.aborted);
 resolve!({...page(detailFilter!),data:[{...movement,code:'LATE-DETAIL'}]});await new Promise(done=>setTimeout(done,20));
 assert.equal(screen.queryByText('LATE-DETAIL'),null);assert.ok(screen.getByRole('table',{name:'Sổ tổng hợp NXT'}));assert.equal(screen.queryByRole('dialog'),null);
});


test('exact Serial scope renders single quantities and exports the same scope without a batch parent',async()=>{
 const p=await preview();const result=page({book:'card',from:'2026-10-01',to:'2026-10-31'});result.serial_filter='B65006700';result.groups=[{...group,opening_quantity_milli:0,opening_value_vnd:0,in_quantity_milli:1000,in_value_vnd:3703704,out_quantity_milli:1000,out_value_vnd:3703704,closing_quantity_milli:0,closing_value_vnd:0}];result.totals={group_count:1,pending_groups:0,opening_value_vnd:0,in_value_vnd:3703704,out_value_vnd:3703704,closing_value_vnd:0};result.data=[{...movement,serials:'B65006700',in_quantity_milli:1000,in_value_vnd:3703704,balance_quantity_milli:1000,balance_value_vnd:3703704},{...movement,movement_id:'m2',kind:'issue',code:'10.26.00002/PX',serials:'B65006700',in_quantity_milli:0,in_value_vnd:0,out_quantity_milli:1000,out_value_vnd:3703704,balance_quantity_milli:0,balance_value_vnd:0}];result.pagination.total=2;
 const client={warehouses:async()=>[],read:async(f:BookFilter)=>({...result,from:f.from,to:f.to})};render(<InventoryBooks book="card" api={p.catalog} documents={p.documents} client={client} initialFilter={{from:result.from,to:result.to,part_id:group.part_id}}/>);
 await screen.findByText('Serial: B65006700 · Tính riêng nhập / xuất / tồn');assert.equal(screen.queryByRole('button',{name:/Mở Serial/}),null);const table=screen.getByRole('table',{name:'Sổ chi tiết NXT'});assert.equal(table.querySelectorAll('tbody tr').length,4);assert.equal(table.querySelectorAll('tbody tr')[1].children[6].textContent,'13.703.704 đ');assert.equal(table.querySelectorAll('tbody tr')[3].children[8].textContent,'00 đ');assert.equal(document.body.textContent?.includes('Thẻ kho'),false);
 const {bookOutputRows}=await import('../src/books/bookOutput');const rows=bookOutputRows(result),header=rows.findIndex(r=>r.includes('Serial')&&r.includes('Nhập · SL')),entries=rows.slice(header+1).filter(r=>r.includes('B65006700'));assert.equal(entries.length,2);assert.deepEqual(entries.map(r=>[r[7],r[9],r[11]]),[[1,0,1],[0,1,0]]);assert.ok(rows.some(r=>r[0]==='Serial'&&r[1]==='B65006700'));assert.ok(bookPrintMarkup(result).includes('Nhập / xuất / tồn tính riêng Serial'));const xml=strFromU8(unzipSync(buildBookWorkbook(result))['xl/worksheets/sheet1.xml']);assert.ok(xml.includes('B65006700'));assert.equal(xml.includes('Thẻ kho'),false);
 const filter:BookFilter={book:'card',from:result.from,to:result.to,part_id:group.part_id,q:'B65006700'};assert.equal((await createBookClient(async()=>Response.json(result)).read(filter)).serial_filter,'B65006700');await assert.rejects(()=>createBookClient(async()=>Response.json({...result,serial_filter:42})).read(filter));
});
