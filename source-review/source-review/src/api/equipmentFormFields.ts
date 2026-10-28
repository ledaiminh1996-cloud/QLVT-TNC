import type { CatalogDefinition, Field } from './catalogFields';
import { definitions } from './catalogFields';
import type { CatalogRow, Resource } from './catalogClient';

export const conditionStatus: Record<string,string> = { 'Hoạt động':'active', 'Đang hoạt động':'active', 'Hư':'maintenance', 'Bảo dưỡng':'maintenance', 'Làm kho':'stopped', 'Ngưng sử dụng':'stopped', 'Ngừng sử dụng':'stopped', 'Ngừng hoạt động':'stopped' };
export function initialCondition(row?: CatalogRow): string {
  const raw = String(row?.original_status ?? '');
  const original = ['Ngưng sử dụng','Ngừng sử dụng'].includes(raw) ? 'Ngừng hoạt động' : raw;
  if(original && (!conditionStatus[original] || !row?.status || conditionStatus[original] === row.status)) return original;
  return ({active:'Hoạt động',maintenance:'Hư',stopped:'Ngừng hoạt động'} as Record<string,string>)[String(row?.status ?? 'active')] ?? 'Hoạt động';
}
export function equipmentFormFields(resource:Resource,type:string,parameters:CatalogRow[],values:Record<string,string>):Field[] {
  const shared=['ownership_source','lessor_name','contract_number','location_unit','original_status','notes'];
  const office = type==='office_car' || values.source_group==='box_truck';
  const keys = resource==='vehicles'
    ? office ? ['source_group','plate_number','brand_model','manufacture_year','chassis_number','engine_number','load_spec','location_unit','original_status','notes']
      : type==='rented_truck' ? ['plate_number','load_spec','ownership_source','lessor_name','contract_number','original_status','notes']
      : ['plate_number','brand_model','manufacture_year','chassis_number',...(type==='trailer'?[]:['engine_number']),'load_spec',...(type==='tractor'?['route_group']:[]),...shared]
    : type==='generator' ? ['type','code','original_status','notes'] : ['type','code','container_spec','location_unit','original_status','notes'];
  const parameterGroups:Record<string,string>={route_group:'route',ownership_source:'source',original_status:'condition'};
  return keys.flatMap(key=>{
    const field=definitions[resource].fields.find(item=>item.key===key);
    if(!field)return [];
    if(key==='source_group') return [{...field,label:'Nhóm xe',required:true,choices:[['office_car','Xe văn phòng'],['box_truck','Xe tải thùng']] as [string,string][]}];
    const label = key==='brand_model'?'Nhãn hiệu':key==='manufacture_year'?'Năm SX':key==='load_spec' && type==='trailer'?'Tải trọng':key==='original_status'?'Trạng thái':key==='code'?'Mã thiết bị':key==='name'?'Tên thiết bị':field.label;
    const group=parameterGroups[key];
    if(!group)return [{...field,label}];
    const choices:[string,string][] = parameters.filter(p=>p.group_key===group && p.is_active===1).map(p=>[String(key==='route_group'?p.code:p.name),key==='route_group'?`${p.code} — ${p.name}`:String(p.name)]);
    const current=values[key];
    if(current && !choices.some(([value])=>value===current)) choices.unshift([current,`${current} (giá trị hiện tại)`]);
    if(key!=='original_status') choices.unshift(['','Chưa có thông tin']);
    return [{...field,label,required:key==='original_status',choices}];
  });
}

export function equipmentTableDefinition(base:CatalogDefinition,type?:string,sourceGroup?:string):CatalogDefinition {
  const group=sourceGroup==='generator_container'?'generator_container':sourceGroup==='office_and_box'?'office_and_box':type;
  const columns:Record<string,string[]>={
    tractor:['plate_number','brand_model','manufacture_year','chassis_number','engine_number','load_spec','route_group','status'],
    trailer:['plate_number','brand_model','manufacture_year','chassis_number','load_spec','ownership_source','lessor_name','location_unit','status'],
    generator:['code','status','notes'],
    generator_container:['code','type','container_spec','location_unit','status','notes'],
    container:['code','container_spec','location_unit','status','notes'],
    office_and_box:['plate_number','source_group','brand_model','manufacture_year','chassis_number','engine_number','load_spec','location_unit','status'],
    rented_truck:['plate_number','ownership_source','lessor_name','load_spec','status','notes'],
  };
  return {...base,columns:columns[group??'']??base.columns,fields:base.fields.map(field=>
    field.key==='brand_model'?{...field,label:'Nhãn hiệu'}:
    field.key==='manufacture_year'?{...field,label:'Năm SX'}:
    field.key==='load_spec' && group==='trailer'?{...field,label:'Tải trọng'}:
    field.key==='source_group'?{...field,label:'Nhóm xe',choices:[['office_car','Xe văn phòng'],['box_truck','Xe tải thùng']]}:field
  )};
}
