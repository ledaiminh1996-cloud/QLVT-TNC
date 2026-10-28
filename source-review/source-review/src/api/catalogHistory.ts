import type {CatalogRow,Resource} from './catalogClient';
import {definitions,displayValue} from './catalogFields';
interface Snapshot{[key:string]:unknown}
export interface HistoryChange{key:string;label:string;before:string;after:string}
const extraLabels:Record<string,string>={supplied_items:'Mặt hàng cung ứng',driver_id:'Tài xế',driver_name:'Tên tài xế',driver_code:'Mã nhân viên',parent_code:'Đầu kéo',links:'Thiết bị ghép',links_json:'Thiết bị ghép',phone:'Số điện thoại',department:'Bộ phận',vehicle_plate:'Đầu kéo phụ trách',trailer_plate:'Rơ moóc phụ trách'};
const refs:Record<string,string>={warehouse_id:'warehouses',unit_id:'org_units',department_id:'departments',assigned_driver_id:'staff',driver_id:'staff'};
export function snapshot(value:unknown):Snapshot|null{try{const data:unknown=JSON.parse(String(value??'null'));return data&&typeof data==='object'&&!Array.isArray(data)?data as Snapshot:null;}catch{return null;}}
function format(resource:Resource,key:string,value:unknown,labels:Snapshot):string{
 if(value==null||value==='')return '—';
 if(refs[key])return String(labels[`${refs[key]}:${value}`]??'Bản ghi liên kết không còn trong danh mục');
 if(key==='is_active')return Number(value)===1?'Hoạt động':'Ngừng hoạt động';
 if(key==='links'||key==='links_json'){
  let list:unknown=value;try{if(typeof list==='string')list=JSON.parse(list);}catch{return 'Chưa có thông tin';}
  if(!Array.isArray(list))return 'Chưa có thông tin';
  return list.filter((item):item is Snapshot=>!!item&&typeof item==='object').map(item=>`${({trailer:'Rơ moóc',generator:'Máy phát',container:'Cont'} as Record<string,string>)[String(item.type??item.pairing_type)]??'Thiết bị'}: ${item.code??item.child_code??'—'}`).join('\n')||'Chưa ghép';
 }
 if(typeof value==='object')return 'Thông tin bổ sung';
 return displayValue(resource,key,value);
}
export function historyChanges(resource:Resource,event:CatalogRow):HistoryChange[]{
 let before=snapshot(event.before_json);const after=snapshot(event.after_json),labels=snapshot(event.references_json)??{};
 if(before&&after){before={...before};if(Object.hasOwn(after,'driver_id')&&Object.hasOwn(before,'assigned_driver_id'))before.driver_id=before.assigned_driver_id;if(Object.hasOwn(after,'links')&&Object.hasOwn(before,'links_json')){try{before.links=JSON.parse(String(before.links_json));}catch{/* Retain the captured data if the legacy snapshot is incomplete. */}}}
 const keys=Object.keys(after??before??{}),fields=definitions[resource].fields;
 const changed:HistoryChange[]=[];
 for(const key of keys){const label=fields.find(field=>field.key===key)?.label??extraLabels[key];if(!label)continue;
  const old=before?.[key],next=after?.[key];if(JSON.stringify(old??null)===JSON.stringify(next??null))continue;
  const previous=format(resource,key,old,labels),current=format(resource,key,next,labels);if(previous===current)continue;
  changed.push({key,label,before:previous,after:current});
 }
 return changed;
}
export function historyAction(event:CatalogRow):string{
 const action=String(event.action??'');
 if(action==='pairing.review')return 'Xác nhận đã rà soát';
 if(action.startsWith('driver.'))return 'Cập nhật tài xế / xe phụ trách';
 if(action.startsWith('pairing.'))return 'Thay đổi ghép thiết bị';
 if(/delete|deactivat/.test(action))return 'Xóa / ngừng hoạt động';
 if(/import/.test(action))return 'Nhập dữ liệu';
 if(/create/.test(action))return 'Thêm mới';
 return 'Cập nhật';
}
