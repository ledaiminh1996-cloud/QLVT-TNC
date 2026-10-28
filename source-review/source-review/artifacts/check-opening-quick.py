from pathlib import Path
p=Path('src/documents/DocumentQuickImport.tsx');s=p.read_text(encoding='utf-8').replace('normalizeSearch(values.target_type??""),code=', 'normalizeSearch(values.target_type??"").replace(/[\\u0300-\\u036f]/g,"").replace(/đ/g,"d").trim(),code=');s=s.replace('line.mount_position_id=matches[0].id;line.to_position=', 'if(kind==="issue")line.mount_position_id=matches[0].id;line.to_position=');p.write_text(s,encoding='utf-8')
p=Path('tests/documents.test.tsx');s=p.read_text(encoding='utf-8').replace('fireEvent.change(screen.getByLabelText("Căn cứ xác nhận đầu kỳ dòng 1"),{target:{value:"Biên bản DK-01"}});','assert.equal(screen.queryByLabelText("Căn cứ xác nhận đầu kỳ dòng 1"),null);').replace('assert.equal(saved?.lines[0].opening_confirmation_basis,"Biên bản DK-01");','assert.equal(saved?.lines[0].opening_assessor,"Kỹ thuật mẫu");');s+='''

test("mounted opening quick import maps reordered headers, copies contents, resolves targets and defaults catalog prices without stock or VAT",async()=>{
 const p=await preview();let copied="";let applied:DraftLine[]|undefined;
 const descriptor=Object.getOwnPropertyDescriptor(navigator,"clipboard");
 Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{copied=text;}}});
 try{
  render(<DocumentQuickImport api={p.catalog} kind="opening" openingInUse onApply={lines=>{applied=lines}} onClose={()=>{}}/>);
  const paste=(text:string)=>fireEvent.paste(screen.getByLabelText("Mã vật tư nhập nhanh dòng 1"),{clipboardData:{getData:()=>text}});
  paste("Serial\\tBiển số / mã thiết bị\\tLoại phương tiện\\tTỷ lệ còn lại (%)\\tNgười xác nhận\\tSố lượng\\tVị trí lắp\\tMã vật tư\\nOLD-QUICK-001\\t51R-456.78\\tRơ moóc\\t20\\tKỹ thuật mẫu\\t1\\tT1TT\\tM-RM-LOP-0001");
  fireEvent.click(screen.getByRole("button",{name:"Sao chép bảng kèm tiêu đề"}));await waitFor(()=>assert.ok(copied.startsWith("Mã vật tư\\tLoại phương tiện\\tBiển số / mã thiết bị")));assert.ok(copied.includes("OLD-QUICK-001"));assert.ok(!copied.includes("VAT"));
  fireEvent.click(screen.getByRole("button",{name:"Xem trước"}));await waitFor(()=>assert.equal((screen.getByRole("button",{name:"Thêm vào phiếu"})as HTMLButtonElement).disabled,false));
  fireEvent.click(screen.getByRole("button",{name:"Thêm vào phiếu"}));assert.equal(applied?.[0].target_id,"trailer-1");assert.equal(applied?.[0].opening_current_unit_price,"8500000");assert.equal(applied?.[0].opening_quality_percent,"20");assert.equal(applied?.[0].unit_price,"");assert.equal(applied?.[0].mount_position_id,undefined);assert.ok(applied?.[0].to_position.includes("Trục 1"));
  const draft={...emptyDraft("opening"),opening_mode:"in_use" as const,warehouse_id:"wh-1",lines:applied!};assert.equal(parseDraft(draft).lines[0].target_id,"trailer-1");
  paste("Mã vật tư\\tSố lượng\\nM-RM-LOP-0001\\t1");assert.ok(screen.getByRole("alert").textContent?.includes("Biển số"));assert.equal((screen.getByRole("button",{name:"Thêm vào phiếu"})as HTMLButtonElement).disabled,true);
  paste("Mã vật tư\\tBiển số / mã thiết bị\\tLoại phương tiện\\tSố lượng\\tSerial\\nM-RM-LOP-0001\\t51R-456.78\\tĐầu kéo\\t1\\tOLD-QUICK-001");fireEvent.click(screen.getByRole("button",{name:"Xem trước"}));await waitFor(()=>assert.ok(screen.getByRole("alert").textContent?.includes("không khớp")));
 }finally{if(descriptor)Object.defineProperty(navigator,"clipboard",descriptor);else Reflect.deleteProperty(navigator,"clipboard");}
});
''';# DraftLine existing import check
if 'type DraftLine' not in s and 'import type {DraftLine}' not in s:s='import type {DraftLine} from "../shared/documents";\n'+s
p.write_text(s,encoding='utf-8')
