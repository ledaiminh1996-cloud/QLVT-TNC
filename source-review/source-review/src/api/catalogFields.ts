import { VIETNAM_PROVINCES } from '../../shared/vietnamProvinces.ts';
import type { CatalogRow, Resource } from './catalogClient.ts';

export interface Field {
  key: string; label: string; required?: boolean; type?: 'text' | 'number' | 'email' | 'textarea';
  choices?: [string, string][]; nullable?: boolean; default?: string; min?: number; max?: number;
  scale?: number; reference?: boolean; maxLength?: number; lookup?: Resource;
}
export interface CatalogDefinition { label: string; singular: string; fields: Field[]; columns: string[] }
const active: Field = { key: 'is_active', label: 'Trạng thái', type: 'number', choices: [['1', 'Đang sử dụng'], ['0', 'Ngừng hoạt động']], default: '1' };
const notes: Field = { key: 'notes', label: 'Ghi chú', type: 'textarea', nullable: true, maxLength: 4000 };
const named = (): Field[] => [{ key: 'code', label: 'Mã', required: true, maxLength: 80 }, { key: 'name', label: 'Tên', required: true, maxLength: 256 }];
const equipmentMetadata: Field[] = [
  {key:'source_group',label:'Nhóm thiết bị',nullable:true,maxLength:1000},
  {key:'chassis_number',label:'Số khung',nullable:true,maxLength:1000},
  {key:'engine_number',label:'Số máy',nullable:true,maxLength:1000},
  {key:'load_spec',label:'Tải trọng / số chỗ',nullable:true,maxLength:1000},
  {key:'container_spec',label:'Quy cách Cont',nullable:true,maxLength:1000},
  {key:'ownership_source',label:'Nguồn',nullable:true,maxLength:1000},
  {key:'lessor_name',label:'Đơn vị cho thuê',nullable:true,maxLength:1000},
  {key:'contract_number',label:'Số hợp đồng',nullable:true,maxLength:1000},
  {key:'route_group',label:'Nhóm tuyến',nullable:true,maxLength:1000},
  {key:'location_unit',label:'Vị trí / đơn vị',nullable:true,maxLength:1000},
  {key:'generator_type',label:'Loại máy phát',nullable:true,maxLength:1000},
  {key:'original_status',label:'Tình trạng chi tiết',nullable:true,maxLength:1000},
];
export const definitions: Record<Resource, CatalogDefinition> = {
  'mount-positions': {label:'Danh mục vị trí lắp',singular:'vị trí lắp',columns:['code','name','notes','is_active'],fields:[...named(),{key:'notes',label:'Dùng cho',nullable:true,choices:[['Đầu kéo','Đầu kéo'],['Rơ moóc','Rơ moóc']]},active]},
  "vat-rates":{label:"Danh mục VAT",singular:"mức VAT",columns:["code","name","rate_pct","is_active"],fields:[...named(),{key:"rate_pct",label:"VAT (%)",type:"number",required:true,choices:[["0","0%"],["5","5%"],["8","8%"],["10","10%"]]},active,notes]},
  'equipment-pairing-sets':{label:'Ghép thiết bị',singular:'bộ ghép',columns:[],fields:[]},
  'equipment-parameters': {label:'Tham số phương tiện thiết bị',singular:'tham số',columns:['code','name','notes','is_active'],fields:[...named(),{key:'group_key',label:'Nhóm tham số',required:true,default:'route',choices:[['route','Nhóm tuyến'],['equipment_type','Loại thiết bị'],['source','Nguồn'],['condition','Trạng thái']]},notes,active]},
  'equipment-pairings': {label:'Ghép thiết bị · Bản nháp',singular:'bản ghép nháp',columns:['parent_code','child_code','pairing_type','effective_from','updated_by_name','notes','is_active'],fields:[
    {key:'parent_code',label:'Đầu kéo (biển số)',required:true,maxLength:80},
    {key:'child_code',label:'Thiết bị con (biển số / mã)',required:true,maxLength:80},
    {key:'pairing_type',label:'Loại ghép',required:true,default:'trailer',choices:[['trailer','Rơ moóc'],['generator','Máy phát'],['container','Cont']]},
    {key:'effective_from',label:'Từ ngày (YYYY-MM-DD)',nullable:true,maxLength:32},
    {key:'updated_by_name',label:'Người cập nhật',nullable:true,maxLength:256},notes,active
  ]},
  equipment: { label:'Phương tiện thiết bị',singular:'thiết bị',columns:['code','name','brand_model','serial_number','manufacture_year','operating_hours','status'],fields:[
    ...named(),{key:'type',label:'Loại thiết bị',required:true,default:'generator',choices:[['generator','Máy phát'],['container','Cont']]},
    {key:'brand_model',label:'Nhãn hiệu / dòng thiết bị',maxLength:256},
    {key:'serial_number',label:'Số serial',nullable:true,maxLength:256},
    {key:'manufacture_year',label:'Năm sản xuất',type:'number',nullable:true,min:1900,max:2100},
    {key:'operating_hours',label:'Giờ hoạt động',type:'number',default:'0',min:0},
    {key:'status',label:'Trạng thái',default:'active',choices:[['active','Đang hoạt động'],['maintenance','Bảo dưỡng'],['stopped','Ngừng hoạt động']]},...equipmentMetadata,notes
  ] },
  'part-objects': { label: 'Mã đối tượng VT-TB', singular: 'mã đối tượng', fields: [...named().map(field => field.key === 'code' ? { ...field, maxLength: 20 } : field), active], columns: ['code', 'name', 'is_active'] },
  'part-groups': { label: 'Mã nhóm VT-TB', singular: 'mã nhóm', fields: [...named().map(field => field.key === 'code' ? { ...field, maxLength: 20 } : field), active], columns: ['code', 'name', 'is_active'] },
  parts: {
    label: 'Vật tư', singular: 'vật tư', columns: ['sku', 'name', 'item_type', 'object_code', 'group_code', 'unit', 'unit_price_vnd', 'min_stock_milli', 'min_stock_unit', 'is_active'],
    fields: [
      { key: 'sku', label: 'Mã vật tư', nullable: true, maxLength: 80 },
      { key: 'item_type', label: 'Loại hàng', required: true, default: 'M', choices: [['M', 'VẬT TƯ (M)'], ['G', 'DỊCH VỤ (G)'], ['T', 'THANH LÝ (T)'], ['C', 'HÀNG CŨ (C)']] },
      { key: 'object_code', label: 'Mã đối tượng', required: true, lookup: 'part-objects' },
      { key: 'group_code', label: 'Mã nhóm', required: true, lookup: 'part-groups' },
      { key: 'name', label: 'Tên vật tư', required: true, maxLength: 256 },
      { key: 'unit', label: 'Đơn vị tính', required: true, maxLength: 32 },
      { key: 'unit_price_vnd', label: 'Đơn giá (VNĐ)', type: 'number', default: '0', min: 0 },
      { key: 'min_stock_unit', label: 'Đơn vị tồn tối thiểu', nullable: true, maxLength: 32 },
      { key: 'min_stock_milli', label: 'Tồn kho tối thiểu', type: 'number', scale: 1000, default: '0', min: 0 },
      { key: 'lifespan_km_limit', label: 'Định mức KM', type: 'number', nullable: true, min: 1 },
      { key: 'lifespan_hours_limit', label: 'Tuổi thọ (giờ)', type: 'number', nullable: true, min: 1 },
      { key: 'is_serialized', label: 'Theo dõi từng số serial', type: 'number', default: '0', choices: [['0', 'Không'], ['1', 'Có']] },
      { key:'is_fuel',label:'Nhiên liệu quản lý theo bồn',type:'number',default:'0',choices:[['0','Không'],['1','Có']] },
      { key:'needs_data_package',label:'Sử dụng gói Data',type:'number',default:'0',choices:[['0','Không'],['1','Có']] }, active, notes,
    ],
  },
  warehouses: {
    label: 'Danh mục kho', singular: 'kho', columns: ['code', 'name', 'location', 'is_active'],
    fields: [...named(), { key: 'location', label: 'Địa điểm', maxLength: 512 }, active],
  },
  'fuel-tanks': {
    label: 'Danh mục bồn dầu', singular: 'bồn dầu', columns: ['code', 'name', 'warehouse_id', 'capacity_milli', 'location', 'is_active'],
    fields: [...named(), { key: 'warehouse_id', label: 'Kho trực thuộc', required: true, lookup: 'warehouses' },
      { key: 'capacity_milli', label: 'Dung tích (lít)', type: 'number', required: true, scale: 1000, min: 0.001 },
      { key: 'location', label: 'Vị trí bồn', maxLength: 512 }, active, notes],
  },
  vehicles: {
    label: 'Phương tiện', singular: 'phương tiện', columns: ['plate_number', 'type', 'brand_model', 'current_odo_km', 'status'],
    fields: [
      { key: 'plate_number', label: 'Biển số', required: true, maxLength: 32 },
      { key: 'type', label: 'Loại phương tiện', required: true, default: 'tractor', choices: [['tractor', 'Đầu kéo'], ['trailer', 'Rơ-moóc'], ['office_car', 'Xe văn phòng'], ['rented_truck', 'Xe thuê ngoài']] },
      { key: 'brand_model', label: 'Nhãn hiệu / dòng xe', maxLength: 256 },
      { key: 'manufacture_year', label: 'Năm sản xuất', type: 'number', nullable: true, min: 1900, max: 2100 },
      { key: 'current_odo_km', label: 'ODO hiện tại (KM)', type: 'number', default: '0', min: 0 },
      { key: 'assigned_driver_id', label: 'Tài xế phụ trách', nullable: true, reference: true },
      { key: 'status', label: 'Trạng thái', default: 'active', choices: [['active', 'Đang hoạt động'], ['maintenance', 'Bảo dưỡng'], ['stopped', 'Ngừng hoạt động']] },
      { key: 'has_reefer', label: 'Có máy lạnh', type: 'number', default: '0', choices: [['0', 'Không'], ['1', 'Có']] }, ...equipmentMetadata, notes,
    ],
  },
  'org-units': { label: 'Đơn vị', singular: 'đơn vị', columns: ['code','name','is_active'], fields: [...named(), active] },
  departments: { label: 'Phòng ban', singular: 'phòng ban', columns: ['code','name','kind','is_active'], fields: [...named(), { key:'unit_id',label:'Đơn vị',required:true,lookup:'org-units' }, { key:'kind',label:'Nhóm thành viên',default:'employee',choices:[['employee','Nhân viên'],['driver','Tài xế / Đội xe']] }, active] },
  staff: {
    label: 'Danh mục nhân sự', singular: 'nhân sự', columns: ['code','name','staff_rank','job_title','phone','email','is_active'],
    fields: [...named(), { key:'staff_rank',label:'Cấp bậc',default:'Nhân viên',choices:[['Nhân viên','Nhân viên'],['Quản lý','Quản lý']] }, { key:'staff_type',label:'Nhóm nhân sự',default:'employee',choices:[['employee','Nhân viên'],['driver','Tài xế']] },
      { key:'unit_id',label:'Đơn vị',required:true,nullable:true,lookup:'org-units' }, { key:'department_id',label:'Phòng ban',required:true,nullable:true,lookup:'departments' },
      { key:'job_title',label:'Chức danh',nullable:true,maxLength:256 }, { key:'phone',label:'Số điện thoại',nullable:true,maxLength:256 },
      { key:'email',label:'Email',type:'email',nullable:true,maxLength:254 },
      { key:'vehicle_plate',label:'Đầu kéo phụ trách',nullable:true,maxLength:256 }, { key:'trailer_plate',label:'Rơ-moóc phụ trách',nullable:true,maxLength:256 }, active],
  },
  suppliers: {
    label: 'Nhà cung cấp', singular: 'nhà cung cấp', columns: ['code', 'name', 'tax_code', 'province_name', 'address', 'is_active'],
    fields: [...named(), { key: 'tax_code', label: 'Mã số thuế', nullable: true, maxLength: 256 }, { key: 'province_name', label: 'Tỉnh/Thành phố', nullable: true, choices: [['', 'Chưa có thông tin'], ...VIETNAM_PROVINCES.map(province => [province,province] as [string,string])] },
      { key: 'address', label: 'Địa chỉ (Không nhập tỉnh/thành phố ở đây)', type: 'textarea', nullable: true, maxLength: 1000 }, active],
  },
};

export function initialValues(resource: Resource, row?: CatalogRow): Record<string, string> {
  return Object.fromEntries(definitions[resource].fields.map(field => {
    const raw = row?.[field.key];
    return [field.key, raw == null ? field.default ?? '' : String(field.scale ? Number(raw) / field.scale : raw)];
  }));
}

export function formPayload(resource: Resource, values: Record<string, string>, existing?: CatalogRow): Record<string, string | number | null> {
  return Object.fromEntries(definitions[resource].fields.filter(field => !(resource === 'parts' && existing && !existing.item_type && ['item_type', 'object_code', 'group_code'].includes(field.key))).map(field => {
    const value = (values[field.key] ?? '').trim();
    if (!value && field.required && !(resource === 'staff' && values.staff_type === 'driver' && ['unit_id','department_id'].includes(field.key))) throw new Error(`Vui lòng nhập ${field.label.toLowerCase()}.`);
    if (!value && field.nullable) return [field.key, null];
    if (field.type === 'number') {
      const number = Number(value);
      const scaled = field.scale ? Math.round(number * field.scale) : number;
      if (!value || !Number.isFinite(number) || !Number.isSafeInteger(scaled) || (field.scale && Math.abs(number * field.scale - scaled) > 0.000001) || number < (field.min ?? 0) || number > (field.max ?? Number.MAX_SAFE_INTEGER)) {
        throw new Error(`${field.label}: vui lòng nhập số hợp lệ${field.scale ? ', tối đa 3 chữ số thập phân' : ', không có phần thập phân'}.`);
      }
      return [field.key, scaled];
    }
    return [field.key, value];
  }));
}

export function displayValue(resource: Resource, key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'load_spec' && /^\d+(?:[.,]\d+)?$/.test(String(value).trim())) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(String(value).trim().replace(',', '.'))));
  }
  if (key === 'manufacture_year') return String(value);
  const field = definitions[resource].fields.find(f => f.key === key);
  const choice = field?.choices?.find(([id]) => id === String(value));
  if (choice) return choice[1];
  if (field?.type === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value) / (field.scale ?? 1));
  return String(value);
}
