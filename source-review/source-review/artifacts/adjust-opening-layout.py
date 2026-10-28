from pathlib import Path
p=Path('shared/openingVehicleLabel.ts')
p.write_text('''export function openingVehicleLabel(row: {plate_number?: unknown; type?: unknown; brand_model?: unknown}): string {
  const types: Record<string,string> = {tractor:"Đầu kéo",trailer:"Rơ moóc",office_car:"Xe văn phòng",rented_truck:"Xe tải"};
  return String(row.plate_number ?? "") + " — " + (types[String(row.type)] ?? String(row.brand_model ?? "Phương tiện"));
}
''',encoding='utf-8')
p=Path('src/documents/CatalogPicker.tsx');s=p.read_text(encoding='utf-8');s=s.replace('  includeInactive = false,','  includeInactive = false,\n  formatLabel = catalogLabel,');s=s.replace('  staffType?: "employee" | "driver";','  formatLabel?: (row: CatalogRow) => string;\n  staffType?: "employee" | "driver";');s=s.replace(':catalogLabel(row)}',':formatLabel(row)}');p.write_text(s,encoding='utf-8')
p=Path('src/documents/OpeningUsageLines.tsx');s=p.read_text(encoding='utf-8');s='import {openingVehicleLabel} from "../../shared/openingVehicleLabel";\n'+s;a=s.index('      <p className="rounded-lg border border-blue-200');b=s.index('      <div className="flex flex-wrap',a);s=s[:a]+s[b:];s=s.replace('Xe/rơmooc hoặc thiết bị','Biển số / loại phương tiện');s=s.replace('>Xe / rơmooc</option>','>Biển số — Đầu kéo / Rơ moóc</option>');s=s.replace('label={"Đối tượng đang sử dụng dòng " + (index + 1)}','formatLabel={item.target_type === "vehicle" ? openingVehicleLabel : undefined}\n                      label={"Đối tượng đang sử dụng dòng " + (index + 1)}');p.write_text(s,encoding='utf-8')
p=Path('src/documents/DocumentEditor.tsx');s=p.read_text(encoding='utf-8');s='import {openingVehicleLabel} from "../../shared/openingVehicleLabel";\n'+s;s=s.replace('[resource + ":" + id]: catalogLabel(row),','[resource + ":" + id]: openingInUse && resource === "vehicles" ? openingVehicleLabel(row) : catalogLabel(row),');s=s.replace('sm:grid-cols-2 lg:grid-cols-3">{headerFields}', 'sm:grid-cols-2 "+(openingInUse?"lg:grid-cols-[0.85fr_1fr_1fr_1.5fr]":"lg:grid-cols-3")}>{headerFields}') if False else s
s=s.replace('<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{headerFields}</div>','<div className={"grid gap-3 sm:grid-cols-2 "+(openingInUse?"lg:grid-cols-[0.85fr_1fr_1fr_1.5fr]":"lg:grid-cols-3")}>{headerFields}</div>');p.write_text(s,encoding='utf-8')
p=Path('worker/src/documents.ts');s=p.read_text(encoding='utf-8');s='import {openingVehicleLabel} from "../../shared/openingVehicleLabel";\n'+s;s=s.replace('labels[table + ":" + id] =\n        String(row.plate_number ?? row.code)', 'labels[table + ":" + id] =\n        draft.kind === "opening" && draft.opening_mode === "in_use" && targetType === "vehicle" ? openingVehicleLabel(row) : String(row.plate_number ?? row.code)');needle='  const savedLabels = JSON.parse(String(row.labels_json));';s=s.replace(needle,needle+'''
  if(header.kind === "opening" && header.opening_mode === "in_use"){
    const vehicles = await env.DB.prepare("SELECT DISTINCT v.id,v.plate_number,v.type,v.brand_model FROM document_draft_lines dl JOIN vehicles v ON v.id=json_extract(dl.line_json,'$.target_id') AND json_extract(dl.line_json,'$.target_type')='vehicle' WHERE dl.document_id=?").bind(row.id).all<Row>();
    for(const vehicle of vehicles.results)savedLabels["vehicles:"+String(vehicle.id)]=openingVehicleLabel(vehicle);
  }
''');p.write_text(s,encoding='utf-8')
