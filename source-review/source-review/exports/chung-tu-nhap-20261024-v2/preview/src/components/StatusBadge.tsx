import React from 'react';
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
const palettes: Record<StatusTone,string> = {
  success:'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning:'border-amber-200 bg-amber-50 text-amber-800',
  danger:'border-rose-200 bg-rose-50 text-rose-700',
  neutral:'border-slate-200 bg-slate-50 text-slate-600',
  info:'border-blue-200 bg-blue-50 text-blue-700',
};
const states: Record<string,[string,StatusTone]> = {
  '1':['Hoạt động','success'],true:['Hoạt động','success'],active:['Hoạt động','success'], 'hoạt động':['Hoạt động','success'], 'đang hoạt động':['Hoạt động','success'], 'đang sử dụng':['Hoạt động','success'],
  '0':['Ngừng hoạt động','neutral'],false:['Ngừng hoạt động','neutral'],inactive:['Ngừng hoạt động','neutral'],stopped:['Ngừng hoạt động','neutral'], 'ngừng sử dụng':['Ngừng hoạt động','neutral'], 'ngừng hoạt động':['Ngừng hoạt động','neutral'],
  'hư':['Hư','warning'], 'làm kho':['Làm kho','info'], 'ngưng sử dụng':['Ngừng hoạt động','neutral'],
  maintenance:['Bảo dưỡng','warning'],pending:['Chờ duyệt','warning'],returned:['Trả về','warning'],draft:['Nháp','neutral'],approved:['Đã duyệt','success'],posted:['Đã ghi sổ','success'],fulfilled:['Đã cấp đủ','success'],rejected:['Từ chối','danger'],cancelled:['Đã hủy','danger'],canceled:['Đã hủy','danger'],voided:['Đã hủy','danger'],
  'đã tạo':['Đã tạo','info'],'chờ tạo':['Chờ tạo','warning'],'hoàn thành':['Hoàn thành','success'],'đã hủy':['Đã hủy','danger'],
  'online (đang phát sóng)':['Online (Đang phát sóng)','success'],new:['Mới','info'],
  running:['Đang chạy','success'],retreaded:['Đã đắp vỏ','warning'],recovered:['Chờ xử lý','neutral'],scrapped:['Thanh lý','neutral'],replaced:['Đã thay thế','neutral'],overdue:['Quá hạn','danger'],
};
export function StatusBadge({ value, label, tone }: { value?: unknown; label?: string; tone?: StatusTone }) {
  const raw = value == null ? '' : String(value).trim();
  const state = states[raw.toLocaleLowerCase('vi-VN')];
  const color = tone ?? state?.[1] ?? 'neutral';
  return <span data-status-tone={color} className={'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 '+palettes[color]}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{label ?? state?.[0] ?? (raw || 'Chưa có trạng thái')}</span>;
}
