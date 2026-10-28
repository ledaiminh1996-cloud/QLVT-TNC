import type { CatalogRow } from './catalogClient.ts';
export type DirectoryResource = 'staff' | 'warehouses' | 'suppliers';
export interface LegacyRow { id: string; [key: string]: unknown }
export function toLegacy(resource: DirectoryResource, row: CatalogRow): LegacyRow {
  if (resource === 'staff') return { id: row.id, name: row.name, role: row.job_title ?? '', dept: row.department ?? '', vehicle: row.vehicle_plate ?? '', trailer: row.trailer_plate ?? '', phone: row.phone ?? '', email: row.email ?? '', status: row.is_active ? 'active' : 'inactive' };
  if (resource === 'suppliers') return { id: row.id, code: row.code, tax_code: row.tax_code ?? '', province_name: row.province_name ?? '', is_linked: row.is_linked ?? 0, is_active: row.is_active, name: row.name, items: row.supplied_items ?? '', contact: row.phone ?? '', address: row.address ?? '' };
  return { id: row.id, code: row.code, name: row.name, type: row.type_label ?? ({ fuel_tank: 'Bồn dầu DO', parts: 'Kho vật tư', recovered: 'Kho thu hồi', other: 'Khác' }[String(row.kind)] ?? 'Khác'), capacity: row.capacity_milli == null ? '' : String(Number(row.capacity_milli) / 1000), current: 'Chưa kết nối sổ kho', location: row.location ?? '', status: row.is_active ? 'Hoạt động' : 'Ngừng hoạt động' };
}
export function directoryPayload(resource: DirectoryResource, row: LegacyRow, existing?: CatalogRow): Record<string, string | number | null> {
  const str = (key: string) => String(row[key] ?? '').trim();
  const code = existing?.code ?? `${resource === 'staff' ? 'NS' : 'NCC'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  if (resource === 'staff') return { code, name: str('name'), job_title: str('role') || null, department: str('dept') || null, vehicle_plate: str('vehicle') || null, trailer_plate: str('trailer') || null, phone: str('phone') || null, email: str('email') || null };
  if (resource === 'suppliers') return { ...(existing ? {code: existing.code} : {}), name: str('name'), province_name: str('province_name') || null, tax_code: str('tax_code') || null, supplied_items: str('items') || null, address: str('address') || null };
  const capacity = str('capacity');
  const number = capacity ? Number(capacity) : null;
  if (number !== null && (!Number.isFinite(number) || number <= 0 || !Number.isSafeInteger(Math.round(number * 1000)) || Math.abs(number * 1000 - Math.round(number * 1000)) > 0.000001)) throw new Error('Sức chứa phải là số dương, tối đa 3 chữ số thập phân; không nhập kèm đơn vị.');
  const type = str('type').toLowerCase();
  return { code: str('code'), name: str('name'), kind: existing?.kind ?? (type.includes('bồn') || type.includes('dầu') ? 'fuel_tank' : type.includes('thu hồi') ? 'recovered' : 'parts'), type_label: str('type') || null, capacity_milli: number === null ? null : Math.round(number * 1000), location: str('location') };
}
