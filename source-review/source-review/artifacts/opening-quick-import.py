from pathlib import Path
p=Path('src/documents/OpeningUsageAssessment.tsx');s=p.read_text(encoding='utf-8');a=s.index('<textarea');b=s.index('/>',a)+2;s=s[:a]+s[b:];p.write_text(s,encoding='utf-8')
p=Path('shared/quickImportTable.ts');s=p.read_text(encoding='utf-8').replace('  | "sku"','  | "target_type" | "target_code" | "opening_current_unit_price" | "opening_quality_percent" | "opening_assessor"\n  | "sku"',1);s=s.replace('  kind: DocumentKind,\n)', '  kind: DocumentKind,\n  openingInUse = false,\n)',1);needle='  const incoming =';a=s.index(needle);s=s[:a]+'''  if(kind === "opening" && openingInUse)return [
    {key:"sku",label:"Mã vật tư",required:true},
    {key:"target_type",label:"Loại phương tiện"},
    {key:"target_code",label:"Biển số / mã thiết bị",required:true},
    {key:"position",label:"Vị trí lắp"},
    {key:"quantity",label:"Số lượng",required:true},
    {key:"serial",label:"Serial"},
    {key:"opening_current_unit_price",label:"Nguyên giá"},
    {key:"opening_quality_percent",label:"Tỷ lệ còn lại (%)"},
    {key:"opening_assessor",label:"Người xác nhận"},
    {key:"notes",label:"Ghi chú"},
  ];
'''+s[a:];s=s.replace('  mavattu: "sku",','  loaiphuongtien:"target_type",\n  biensomathietbi:"target_code",\n  bienso:"target_code",\n  nguyengia:"opening_current_unit_price",\n  tyleconlai:"opening_quality_percent",\n  nguoixacnhan:"opening_assessor",\n  mavattu: "sku",');s=s.replace('parseQuickTable(text: string, kind: DocumentKind)','parseQuickTable(text: string, kind: DocumentKind, openingInUse = false)').replace('quickTableText(rows: QuickRow[], kind: DocumentKind)','quickTableText(rows: QuickRow[], kind: DocumentKind, openingInUse = false)').replace('quickColumns(kind),','quickColumns(kind, openingInUse),');p.write_text(s,encoding='utf-8')
p=Path('src/documents/DocumentQuickImport.tsx');s=p.read_text(encoding='utf-8');s='import {openingUsageAssessment} from "../../shared/openingUsageAssessment";\nimport {openingVehicleLabel} from "../../shared/openingVehicleLabel";\n'+s;s=s.replace('  warehouseId,\n','  warehouseId,\n  openingInUse = false,\n',1).replace('  warehouseId?:string;','  warehouseId?:string;\n  openingInUse?:boolean;').replace('onApply: (lines: DraftLine[], parts: CatalogRow[]) => void;','onApply: (lines: DraftLine[], parts: CatalogRow[], targets?:{resource:"vehicles"|"equipment";row:CatalogRow}[]) => void;');s=s.replace('      parts: CatalogRow[];','      parts: CatalogRow[];\n      targets:{resource:"vehicles"|"equipment";row:CatalogRow}[];');s=s.replace('["receipt", "proposal", "opening"].includes(kind)','["receipt", "proposal", "opening"].includes(kind)&&!openingInUse').replace('quickColumns(kind)','quickColumns(kind,openingInUse)').replace('parseQuickTable(text,kind)','parseQuickTable(text,kind,openingInUse)').replace('quickTableText(rows,kind)','quickTableText(rows,kind,openingInUse)');s=s.replace('      const scopedParts=', '      const targets:{resource:"vehicles"|"equipment";row:CatalogRow}[]=[];\n      const scopedParts=');s=s.replace('if(!incoming&&!state)','if(!incoming&&!openingInUse&&!state)');s=s.replace('          if (incoming) {','''          if(openingInUse){
            if(part.is_fuel===1)throw new Error("Không khai báo dầu tiêu hao trong vật tư đang sử dụng đầu kỳ.");
            const type=normalizeSearch(values.target_type??""),code=values.target_code?.trim()??"";
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
            if(line.opening_quality_percent&&!/^\\d{1,3}(?:\\.\\d{1,2})?$/.test(line.opening_quality_percent))throw new Error("Tỷ lệ còn lại từ 0 đến 100%, tối đa 2 số lẻ.");
            openingUsageAssessment(line);
            if(part.is_serialized===1&&line.quantity!=="1")throw new Error("Vật tư Serial: mỗi dòng nhập 1 cái và 1 Serial.");
          }else if (incoming) {''');s=s.replace('          if(kind==="issue"){\n            const purpose=', '          if(openingInUse&&part.is_serialized===1&&serials.length!==1)throw new Error("Vật tư Serial cần 1 Serial thực tế trên mỗi dòng.");\n          if(kind==="issue"){\n            const purpose=');needle='            if(values.position?.trim())';a=s.index(needle);b=s.index('          if (\n            part.is_serialized',a);block=s[a:b];# move position handling to apply opening too
s=s[:a]+'          }\n          if(kind==="issue"||openingInUse){\n'+block+s[b:];s=s.replace('setPreview({ lines, parts })','setPreview({ lines, parts, targets })');s=s.replace('onApply(preview.lines, preview.parts)','onApply(preview.lines, preview.parts, preview.targets)');s=s.replace('{incoming ? "Đơn giá / Gói Data" : "Trạng thái / Serial"}','{openingInUse?"Phương tiện / Nguyên giá / Tỷ lệ còn lại":incoming ? "Đơn giá / Gói Data" : "Trạng thái / Serial"}');s=s.replace('{incoming\n                        ? line.unit_price','{openingInUse ? ((()=>{const target=preview.targets.find(t=>t.row.id===line.target_id&&t.resource===(line.target_type==="vehicle"?"vehicles":"equipment"));return target?(line.target_type==="vehicle"?openingVehicleLabel(target.row):catalogLabel(target.row)):"—"})())+" · "+(line.opening_current_unit_price||"—")+" · "+(line.opening_quality_percent||"—")+"% · "+(line.serials??[]).join("; ") : incoming\n                        ? line.unit_price');p.write_text(s,encoding='utf-8')
p=Path('src/documents/DocumentEditor.tsx');s=p.read_text(encoding='utf-8').replace('{!openingInUse&&<button','<button').replace('Nhập nhanh dòng\n                      </button>}','Nhập nhanh dòng\n                      </button>');s=s.replace('            warehouseId={draft.warehouse_id}\n','            warehouseId={draft.warehouse_id}\n            openingInUse={openingInUse}\n');s=s.replace('onApply={(rows, parts) => {','onApply={(rows, parts, targets) => {').replace('              parts.forEach((p) => remember("parts", p.id, p));','              parts.forEach((p) => remember("parts", p.id, p));\n              targets?.forEach(({resource,row})=>remember(resource,row.id,row));');p.write_text(s,encoding='utf-8')
