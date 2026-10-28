import type { CatalogRow } from '../api/catalogClient';
export interface PairingLink {id:string;child_code:string;pairing_type:string;asset_id?:string;status?:string}
export function pairingLinks(row:CatalogRow):PairingLink[] {
 const value:unknown=JSON.parse(String(row.links_json??'[]'));
 if(!Array.isArray(value)||!value.every(item=>item&&typeof item==='object'&&typeof item.child_code==='string'&&typeof item.pairing_type==='string'))throw new Error('Dữ liệu ghép không hợp lệ.');
 return value as PairingLink[];
}
export function pairingWarnings(row:CatalogRow):string[]{
 const links=pairingLinks(row),warnings:string[]=[];
 if(row.route_group!=='DCANG'&&!links.some(l=>l.pairing_type==='trailer'))warnings.push('Thiếu rơ moóc');
 if(row.route_group!=='DCANG'&&!links.some(l=>l.pairing_type==='generator'))warnings.push('Thiếu máy phát');
 if(!row.assigned_driver_id)warnings.push('Chưa có tài xế');
 if(Number(row.duplicate_driver)>0)warnings.push('Trùng tài xế');
 if(Number(row.bad_devices)>0||links.some(l=>l.status&&l.status!=='active'))warnings.push('Thiết bị ngừng hoạt động / bảo dưỡng');
 if(row.tractor_status&&row.tractor_status!=='active')warnings.push('Đầu kéo ngừng hoạt động');
 if(row.assigned_driver_id&&row.driver_active===0)warnings.push('Tài xế ngừng hoạt động');
 return warnings;
}
export const pairingButton='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40';
export const pairingInput='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
export const pairingActions:Record<string,string>={assemble:'Ghép mới',replace_trailer:'Đổi rơ moóc',replace_generator:'Đổi máy phát',replace_driver:'Đổi tài xế',detach:'Tách',history:'Xem lịch sử'};
export function localDateTime(){const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}

export function pairingSnapshot(value:unknown):string {
 try {
  const data:unknown=JSON.parse(String(value));
  if(!data||typeof data!=='object'||Array.isArray(data))return 'Chưa có thông tin';
  const row=data as Record<string,unknown>,raw=Array.isArray(row.links)?row.links:[];
  const links=raw.filter((item):item is Record<string,unknown>=>!!item&&typeof item==='object');
  const codes=(type:string)=>links.filter(l=>(l.type??l.pairing_type)===type).map(l=>String(l.code??l.child_code??'')).join(', ')||'Chưa ghép';
  return `Tài xế: ${row.driver_name??(row.driver_id?'Đã gán tài xế':'Chưa ghép')}${row.driver_code?' · '+row.driver_code:''}\nRơ moóc: ${codes('trailer')}\nMáy phát: ${codes('generator')}`;
 }catch{return 'Chưa có thông tin';}
}
