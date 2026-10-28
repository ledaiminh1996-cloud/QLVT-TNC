import {catalogHistory} from './catalogHistory.ts';
import { normalizeSearch, searchPattern } from '../../shared/searchText.ts';
import { VIETNAM_PROVINCES } from '../../shared/vietnamProvinces.ts';
import { createSupplier, supplierFailure } from './supplierRules.ts';
import { ApiError, json, readJson } from './http.ts';
import { requireRole } from './auth.ts';
import type { Env, Row, User } from './types.ts';
import { createNumberedParts, validatePartCodes } from './partNumbering.ts';

type Field = {
  type: 'text' | 'integer'; required?: boolean; nullable?: boolean;
  max?: number; min?: number; default?: string | number | null;
  choices?: readonly (string | number)[]; format?: 'code' | 'email';
};
type Spec = { table: string; fields: Record<string, Field>; search: readonly string[]; active?: string; admin?: boolean };
const text = (max = 256, extra: Partial<Field> = {}): Field => ({ type: 'text', max, ...extra });
const integer = (extra: Partial<Field> = {}): Field => ({ type: 'integer', min: 0, max: Number.MAX_SAFE_INTEGER, ...extra });
const active = integer({ choices: [0, 1], default: 1 });
const code = text(80, { required: true, format: 'code' });
const name = text(256, { required: true });
const nullableText = text(256, { nullable: true, default: null });
const idRef = text(128, { nullable: true, default: null });

const equipmentMetadata: Record<string,Field> = Object.fromEntries(["source_group", "chassis_number", "engine_number", "load_spec", "container_spec", "ownership_source", "lessor_name", "contract_number", "route_group", "location_unit", "generator_type", "original_status"].map(key=>[key,text(1000,{nullable:true,default:null})]));
export const catalogs: Record<string, Spec> = {
  "vat-rates":{table:"vat_rates",search:["code","name"],active:"is_active",fields:{code,name,rate_pct:integer({required:true,choices:[0,5,8,10]}),is_active:active,notes:text(4000,{nullable:true,default:null})}},
  'mount-positions': {table:'mount_positions',search:['code','name','notes'],active:'is_active',fields:{code,name,notes:text(256,{nullable:true,default:null,choices:['Đầu kéo','Rơ moóc']}),is_active:active}},
  'equipment-parameters': {table:'equipment_parameters',search:['code','name'],active:'is_active',fields:{group_key:text(32,{required:true,choices:['route','equipment_type','source','condition']}),code:text(80,{required:true}),name,notes:text(4000,{nullable:true,default:null}),is_active:active}},
  'equipment-pairings': {table:'equipment_pairing_drafts',search:['parent_code','child_code','updated_by_name'],active:'is_active',fields:{parent_code:text(80,{required:true,format:'code'}),child_code:text(80,{required:true,format:'code'}),pairing_type:text(32,{required:true,choices:['trailer','generator','container']}),effective_from:text(32,{nullable:true,default:null}),updated_by_name:nullableText,notes:text(4000,{nullable:true,default:null}),is_active:active}},

  equipment: { table:'equipment', search:['code','name','brand_model','serial_number'], active:'status', fields:{ ...equipmentMetadata, 
    code, name, type:text(32,{required:true,choices:['generator','container']}), brand_model:text(256,{default:''}), serial_number:nullableText,
    manufacture_year:integer({nullable:true,default:null,min:1900,max:2100}), operating_hours:integer({default:0}),
    status:text(32,{default:'active',choices:['active','maintenance','stopped']}), notes:text(4000,{nullable:true,default:null})
  } },
  'part-objects': { table: 'part_objects', search: ['code', 'name'], active: 'is_active', fields: { code: text(20, { required: true, format: 'code' }), name, is_active: active } },
  'part-groups': { table: 'part_groups', search: ['code', 'name'], active: 'is_active', fields: { code: text(20, { required: true, format: 'code' }), name, is_active: active } },
  parts: {
    table: 'parts', search: ['sku', 'name'], active: 'is_active',
    fields: {
      sku: { ...code, required: false, nullable: true, default: null },
      item_type: text(1, { nullable: true, default: null, choices: ['M', 'G', 'T', 'C'] }),
      object_code: text(20, { nullable: true, default: null, format: 'code' }),
      group_code: text(20, { nullable: true, default: null, format: 'code' }),
      name, category: text(32, { default: 'accessories', choices: ['tires', 'lubricants', 'filters', 'brake', 'suspension', 'coupling', 'electrical', 'engine_trans', 'accessories'] }),
      unit: text(32, { required: true }), applicable_for: text(16, { default: 'both', choices: ['tractor', 'trailer', 'both'] }),
      unit_price_vnd: integer({ default: 0 }), min_stock_milli: integer({ default: 0 }), min_stock_unit: text(32, { nullable: true, default: null }),
      lifespan_hours_limit: integer({ min: 1, nullable: true, default: null }),
      specifications: text(2000, { default: '' }), lifespan_km_limit: integer({ min: 1, nullable: true, default: null }),
      lifespan_days_limit: integer({ min: 1, nullable: true, default: null }), is_serialized: integer({ choices: [0, 1], default: 0 }), is_fuel: integer({ choices:[0,1],default:0 }), needs_data_package: integer({ choices:[0,1],default:0 }),
      is_active: active, notes: text(4000, { nullable: true, default: null }),
    },
  },
  'fuel-tanks': {
    table: 'fuel_tanks', search: ['code', 'name', 'location'], active: 'is_active',
    fields: { code, name, warehouse_id: text(128, { required: true }), capacity_milli: integer({ required: true, min: 1 }), location: text(512, { default: '' }), is_active: active, notes: text(4000, { nullable: true, default: null }) },
  },
  warehouses: {
    table: 'warehouses', search: ['code', 'name', 'location'], active: 'is_active',
    fields: {
      code, name, kind: text(32, { default: 'parts', choices: ['parts', 'recovered', 'other'] }),
      location: text(512, { default: '' }), type_label: text(256, { nullable: true, default: null }), capacity_milli: integer({ min: 1, nullable: true, default: null }), is_active: active,
    },
  },
  vehicles: {
    table: 'vehicles', search: ['plate_number', 'brand_model'], active: 'status',
    fields: {
      ...equipmentMetadata,  plate_number: text(32, { required: true, format: 'code' }), type: text(32, { required: true, choices: ['tractor', 'trailer', 'office_car', 'rented_truck'] }),
      brand_model: text(256, { default: '' }), manufacture_year: integer({ min: 1900, max: 2100, nullable: true, default: null }),
      current_odo_km: integer({ default: 0 }), assigned_driver_id: idRef,
      status: text(32, { choices: ['active', 'maintenance', 'stopped'], default: 'active' }),
      has_reefer: integer({ choices: [0, 1], default: 0 }), notes: text(4000, { nullable: true, default: null }),
    },
  },
  'org-units': { table: 'org_units', search: ['code','name'], active: 'is_active', fields: { code, name, is_active: active } },
  departments: { table: 'departments', search: ['code','name'], active: 'is_active', fields: { code, name, unit_id: text(128, { required: true }), kind: text(16, { default: 'employee', choices: ['employee','driver'] }), is_active: active } },
  staff: {
    table: 'staff', search: ['code', 'name', 'phone'], active: 'is_active',
    fields: {
      code, name, phone: nullableText, email: text(254, { nullable: true, default: null, format: 'email' }),
      staff_rank: text(256, { default: 'Nhân viên', choices: ['Nhân viên','Quản lý'] }),
      staff_type: text(16, { default: 'employee', choices: ['employee','driver'] }), unit_id: idRef, department_id: idRef,
      department: nullableText, job_title: nullableText, vehicle_plate: nullableText, trailer_plate: nullableText, is_active: active,
    },
  },
  suppliers: {
    table: 'suppliers', search: ['code', 'name', 'tax_code'], active: 'is_active',
    fields: { code: { ...code, required: false, nullable: true, default: null }, name, province_name: text(80, { nullable: true, default: null, choices: VIETNAM_PROVINCES }), tax_code: nullableText, phone: nullableText, supplied_items: text(2000, { nullable: true, default: null }), address: text(1000, { nullable: true, default: null }), is_active: active },
  },
  users: {
    table: 'app_users', search: ['email', 'display_name'], active: 'is_active', admin: true,
    fields: {
      auth_subject: text(256, { required: true }), email: text(254, { required: true, format: 'email' }), display_name: name,
      role: text(32, { required: true, choices: ['admin', 'accountant', 'warehouse', 'viewer'] }), is_active: active,
    },
  },
};

export function validate(body: Record<string, unknown>, spec: Spec, partial: boolean): Row {
  for (const key of Object.keys(body)) {
    if (key !== 'version' && !Object.hasOwn(spec.fields, key)) throw new ApiError(400, 'UNKNOWN_FIELD', `Trường không được hỗ trợ: ${key}`);
  }
  const result: Row = {};
  for (const [key, field] of Object.entries(spec.fields)) {
    let value = body[key];
    if (value === undefined && partial) continue;
    if (value === undefined) {
      if (field.required) throw new ApiError(400, 'VALIDATION_ERROR', `Thiếu trường ${key}.`);
      value = field.default ?? null;
    }
    if (key === 'province_name' && typeof value === 'string' && !value.trim()) value = null;
    if (value === null && field.nullable) { result[key] = null; continue; }
    if (field.type === 'text') {
      if (typeof value !== 'string' || value.length > (field.max ?? 256) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `${key} phải là chuỗi hợp lệ, tối đa ${field.max} ký tự.`);
      }
      let normalized = value.trim();
      if (field.required && !normalized) throw new ApiError(400, 'VALIDATION_ERROR', `${key} không được để trống.`);
      if (field.format === 'code') {
        normalized = normalized.toUpperCase();
        if (/\s/.test(normalized)) throw new ApiError(400, 'VALIDATION_ERROR', `${key} không được chứa khoảng trắng.`);
      }
      if (field.format === 'email') {
        normalized = normalized.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new ApiError(400, 'VALIDATION_ERROR', `${key} không phải email hợp lệ.`);
      }
      value = normalized;
    } else if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (field.min ?? 0) || value > (field.max ?? Number.MAX_SAFE_INTEGER)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `${key} phải là số nguyên trong khoảng cho phép.`);
    }
    if (field.choices && !field.choices.includes(value as string | number)) throw new ApiError(400, 'VALIDATION_ERROR', `${key} có giá trị không được hỗ trợ.`);
    result[key] = value as string | number;
  }
  return result;
}

function pagination(url: URL) {
  const parse = (key: string, fallback: number, max: number) => {
    const raw = url.searchParams.get(key);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) throw new ApiError(400, 'INVALID_PAGINATION', `${key} không hợp lệ.`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new ApiError(400, 'INVALID_PAGINATION', `${key} nằm ngoài phạm vi cho phép.`);
    return value;
  };
  return { page: parse('page', 1, 1000000), pageSize: parse('page_size', 25, 100) };
}

export async function handleCatalog(request: Request, env: Env, user: User, resource: string, id: string | undefined, requestId: string): Promise<Response> {
  if(resource==='equipment-pairings' && request.method!=='GET') throw new ApiError(405,'PAIRING_WORKFLOW_REQUIRED','Dùng thao tác Ghép thiết bị để ghi ngày giờ, lý do và nhật ký.');
  const spec = Object.hasOwn(catalogs, resource) ? catalogs[resource] : undefined;
  if (!spec) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API.');
  if (spec.admin) requireRole(user, ['admin']);
  if(request.method==='GET' && new URL(request.url).searchParams.get('view')==='history') return catalogHistory(new URL(request.url),env,resource,spec.table);
  const table = spec.table; // Identifiers come exclusively from the static specification.
  const columns = ['id', ...Object.keys(spec.fields), 'version'];
  let selection = columns.join(', ') + (resource === 'suppliers' ? ', EXISTS(SELECT 1 FROM inventory_documents WHERE supplier_id=suppliers.id) AS is_linked' : '') + (resource==='parts'?(user.role==='warehouse'?', NULL AS current_stock_milli':', COALESCE((SELECT sum(quantity_milli) FROM stock_balances b WHERE b.part_id=parts.id),0) AS current_stock_milli'):'');
  const url = new URL(request.url);

  if (request.method === 'GET' && !id) {
    const { page, pageSize } = pagination(url);
    const conditions: string[] = [];
    const selectionArgs: (string | number)[] = [];
    const args: (string | number)[] = [];
    if (resource === 'parts' && url.searchParams.has('stock_state')) {
      const state = url.searchParams.get('stock_state')!;
      const warehouse = url.searchParams.get('warehouse_id') ?? '';
      if (!['new','recovered'].includes(state) || !/^[a-zA-Z0-9_-]{1,128}$/.test(warehouse))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Chọn kho và trạng thái hàng hợp lệ.');
      if (user.role === 'warehouse') {
        const access = await env.DB.prepare('SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?').bind(user.id,warehouse).first();
        if (!access) throw new ApiError(403, 'WAREHOUSE_FORBIDDEN', 'Bạn không có quyền xem tồn kho này.');
      }
      conditions.push('EXISTS(SELECT 1 FROM stock_buckets b WHERE b.part_id=parts.id AND b.warehouse_id=? AND b.stock_state=? AND b.quantity_milli>0)');
      args.push(warehouse,state);
      selection = columns.join(', ') + ', (SELECT b.quantity_milli FROM stock_buckets b WHERE b.part_id=parts.id AND b.warehouse_id=? AND b.stock_state=?) AS current_stock_milli';
      selectionArgs.push(warehouse,state);
    }
    const q = url.searchParams.get('q')?.trim();
    if (q) {
      if (q.length > 200) throw new ApiError(400, 'VALIDATION_ERROR', 'Từ khóa quá dài.');
      const taxQuery=resource==='suppliers'&&/^[\d\s-]+$/.test(q)?q.replace(/[\s-]/g,''):'';
      const indexedSearch=`EXISTS(SELECT 1 FROM catalog_search s WHERE s.resource=? AND s.entity_id=${table}.id AND s.normalized_text LIKE ? ESCAPE '\\')`;
      conditions.push(taxQuery?`(${indexedSearch} OR replace(replace(trim(tax_code),'-',''),' ','') LIKE ? ESCAPE '\\')`:indexedSearch);
      args.push(resource,searchPattern(q),...(taxQuery?['%'+taxQuery+'%']:[]));
    }
    if (['vehicles','equipment'].includes(resource) && url.searchParams.has('type')) {
      const type = url.searchParams.get('type')!;
      const choices = resource === 'vehicles' ? ['tractor','trailer','office_car','rented_truck'] : ['generator','container'];
      if (!choices.includes(type)) throw new ApiError(400,'VALIDATION_ERROR','Loại phương tiện thiết bị không hợp lệ.');
      conditions.push('type = ?'); args.push(type);
    }
    if (resource === 'vehicles' && url.searchParams.has('source_group')) {
      const group=url.searchParams.get('source_group')!;
      if(!['tractor','trailer','office_car','rented_truck','box_truck','office_and_box'].includes(group)) throw new ApiError(400,'VALIDATION_ERROR','Nhóm xe không hợp lệ.');
      if(group==='office_and_box')conditions.push("COALESCE(source_group,type) IN ('office_car','box_truck')");
      else {conditions.push('COALESCE(source_group,type)=?');args.push(group);}
    }
    if(resource==='equipment-parameters' && url.searchParams.has('group_key')) {
      const group=url.searchParams.get('group_key')!;
      if(!['route','equipment_type','source','condition'].includes(group)) throw new ApiError(400,'VALIDATION_ERROR','Nhóm tham số không hợp lệ.');
      conditions.push('group_key=?');args.push(group);
    }
    if(['vehicles','equipment'].includes(resource) && url.searchParams.has('original_status')) {
      const value=url.searchParams.get('original_status')!;
      if(!value || value.length>1000)throw new ApiError(400,'VALIDATION_ERROR','Trạng thái không hợp lệ.');
      const fallback="CASE status WHEN 'active' THEN 'Hoạt động' WHEN 'maintenance' THEN 'Hư' WHEN 'stopped' THEN 'Ngừng hoạt động' END";
      const stale="(original_status IN ('Hoạt động','Đang hoạt động') AND status!='active') OR (original_status IN ('Hư','Bảo dưỡng') AND status!='maintenance') OR (original_status IN ('Làm kho','Ngưng sử dụng','Ngừng sử dụng','Ngừng hoạt động') AND status!='stopped')";
      conditions.push(`(CASE WHEN NULLIF(TRIM(original_status),'') IS NULL OR ${stale} THEN ${fallback} ELSE original_status END)=?`);
      args.push(value);
    }
    const filter = url.searchParams.get(spec.active === 'status' ? 'status' : 'is_active');
    if (filter !== null) {
      if (spec.active === 'status') {
        if (!['active', 'maintenance', 'stopped'].includes(filter)) throw new ApiError(400, 'VALIDATION_ERROR', 'status không hợp lệ.');
        args.push(filter);
      } else {
        if (!['0', '1'].includes(filter)) throw new ApiError(400, 'VALIDATION_ERROR', 'is_active phải là 0 hoặc 1.');
        args.push(Number(filter));
      }
      conditions.push(`${spec.active} = ?`);
    }
    if (resource === 'fuel-tanks' && url.searchParams.has('warehouse_id')) {
      const warehouseId = url.searchParams.get('warehouse_id')!;
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(warehouseId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Mã định danh kho không hợp lệ.');
      conditions.push('warehouse_id = ?'); args.push(warehouseId);
    }
    for (const key of resource === 'staff' ? ['unit_id','department_id','staff_type'] : resource === 'departments' ? ['unit_id','kind'] : []) {
      const value = url.searchParams.get(key);
      if (value === null) continue;
      if (['staff_type','kind'].includes(key) ? !['employee','driver'].includes(value) : !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new ApiError(400,'VALIDATION_ERROR','Bộ lọc nhân sự không hợp lệ.');
      conditions.push(key + ' = ?'); args.push(value);
    }
    if (resource === 'staff' && url.searchParams.get('unassigned') === '1') conditions.push('department_id IS NULL');
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const results = await env.DB.batch([
      env.DB.prepare(`SELECT ${selection} FROM ${table}${where} ORDER BY ${resource==='vat-rates'?'rate_pct,id':'id'} LIMIT ? OFFSET ?`).bind(...selectionArgs, ...args, pageSize, (page - 1) * pageSize),
      env.DB.prepare(`SELECT count(*) AS total FROM ${table}${where}`).bind(...args),
      ...(resource === 'suppliers' ? [env.DB.prepare("SELECT 'NCC'||printf('%05d',MAX(COALESCE((SELECT MAX(CAST(substr(code,4) AS INTEGER)) FROM suppliers WHERE length(code)=8 AND code GLOB 'NCC[0-9][0-9][0-9][0-9][0-9]'),0),COALESCE((SELECT last_value FROM supplier_code_sequence WHERE id=1),0))+1) AS next_code")] : []),
    ]);
    return json({ ...(resource === 'suppliers' ? {supplier_next_code: (results[2].results[0] as {next_code:string}).next_code} : {}), data: results[0].results, pagination: { page, page_size: pageSize, total: (results[1].results[0] as { total: number }).total } });
  }

  const before = id ? await env.DB.prepare(`SELECT ${selection} FROM ${table} WHERE id = ?`).bind(id).first<Row>() : null;
  if (id && !before) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi.');
  if (request.method === 'GET' && before) return json({ data: before });
  if (!((request.method === 'POST' && !id) || (request.method === 'PATCH' && id))) {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Dùng GET, POST hoặc PATCH; không xóa cứng danh mục.');
  }
  requireRole(user, spec.admin ? ['admin'] : ['admin', 'accountant']);
  const body = await readJson(request);
  const values = validate(body, spec, !!id);
  if(['vehicles','equipment'].includes(resource)) {
    for(const [key,group,column] of [['route_group','route','code'],['ownership_source','source','name'],['original_status','condition','name']] as const) {
      const value=values[key];
      if(value && value!==before?.[key]) {
        const parameter=await env.DB.prepare(`SELECT id FROM equipment_parameters WHERE group_key=? AND ${column}=? AND is_active=1`).bind(group,value).first();
        if(!parameter)throw new ApiError(400,'INVALID_PARAMETER','Chọn giá trị đang sử dụng trong danh mục tham số.');
      }
    }
    if(values.original_status && values.original_status!==before?.original_status) {
      const mapped:Record<string,string>={'Hoạt động':'active','Đang hoạt động':'active','Hư':'maintenance','Bảo dưỡng':'maintenance','Làm kho':'stopped','Ngưng sử dụng':'stopped','Ngừng sử dụng':'stopped','Ngừng hoạt động':'stopped'};
      const status=mapped[String(values.original_status)];
      if(status)values.status=status;
    }
  }
  if(resource==='equipment-pairings' && values.effective_from) {
    const date=String(values.effective_from);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new ApiError(400,'VALIDATION_ERROR','Ngày hiệu lực phải là ngày hợp lệ YYYY-MM-DD.');
  }
  if(resource==='suppliers') {
    if(values.code && (!/^NCC[0-9]{5}$/.test(String(values.code)) || String(values.code)==='NCC00000'))throw new ApiError(400,'INVALID_SUPPLIER_CODE','Mã NCC phải đúng định dạng NCC00001 (5 chữ số).');
    if(before && values.code===null)throw new ApiError(400,'INVALID_SUPPLIER_CODE','Mã NCC không được trống.');
    if(typeof values.tax_code==='string')values.tax_code=values.tax_code.replace(/\s+/g,'')||null;
    if(values.is_active===0 && before?.is_linked)throw new ApiError(409,'SUPPLIER_HAS_DOCUMENTS','NCC đã liên kết chứng từ hoặc có phát sinh dữ liệu, không được xóa.');
    if(!id){if(body.version!==undefined)throw new ApiError(400,'VALIDATION_ERROR','Không gửi version khi tạo mới.');return createSupplier(env,user,values,requestId);}
  }
  if (resource === 'part-objects' || resource === 'part-groups') {
    if (values.code && !/^[A-Z0-9]{1,20}$/.test(String(values.code))) throw new ApiError(400, 'INVALID_CODE', 'Mã chỉ gồm chữ A–Z và số, tối đa 20 ký tự.');
  }
  if (resource === 'parts') {
    if (before) {
      for (const key of ['sku', 'item_type', 'object_code', 'group_code']) {
        if (values[key] !== undefined && values[key] !== before[key]) throw new ApiError(409, 'IMMUTABLE_SKU', 'Không đổi cấu trúc mã của vật tư đã tạo. Hãy tạo mã mới nếu phân loại thay đổi.');
      }
    } else if (!values.sku || values.item_type || values.object_code || values.group_code) {
      await validatePartCodes(env, values);
      return createNumberedParts(env, user, [values], requestId);
    }
  }
  if (id && (!Number.isSafeInteger(body.version) || Number(body.version) < 1)) {
    throw new ApiError(400, 'VERSION_REQUIRED', 'Cần gửi version hiện tại để cập nhật.');
  }
  if (!id && body.version !== undefined) throw new ApiError(400, 'VALIDATION_ERROR', 'Không gửi version khi tạo mới.');
  if (id && Object.keys(values).length === 0) throw new ApiError(400, 'EMPTY_UPDATE', 'Chưa có trường cần cập nhật.');
  if (before && body.version !== before.version) throw new ApiError(409, 'VERSION_CONFLICT', 'Dữ liệu đã thay đổi; hãy tải lại trước khi sửa.');
  if (before && resource === 'equipment' && values.operating_hours !== undefined && Number(values.operating_hours) < Number(before.operating_hours)) throw new ApiError(400,'VALIDATION_ERROR','Giờ hoạt động không được giảm.');
  if (before && resource === 'vehicles' && values.current_odo_km !== undefined && Number(values.current_odo_km) < Number(before.current_odo_km)) {
    throw new ApiError(409, 'ODO_DECREASE', 'ODO không được giảm; cần quy trình điều chỉnh riêng.');
  }
  if (resource === 'vehicles' && values.assigned_driver_id) {
    const driver = await env.DB.prepare('SELECT is_active,staff_type FROM staff WHERE id = ?').bind(values.assigned_driver_id).first<{ is_active: number; staff_type: string }>();
    if (!driver || driver.is_active !== 1 || driver.staff_type !== 'driver') throw new ApiError(409, 'INVALID_REFERENCE', 'Tài xế không tồn tại hoặc đã ngừng hoạt động.');
  }
  if (resource === 'staff' || resource === 'departments') {
    const next = { ...(before ?? {}), ...values };
    if (next.unit_id) {
      const unit = await env.DB.prepare('SELECT is_active FROM org_units WHERE id=?').bind(next.unit_id).first<Row>();
      if (!unit || (next.is_active === 1 && unit.is_active !== 1)) throw new ApiError(409,'ORG_INVALID_PARENT','Đơn vị không tồn tại hoặc đã ngừng sử dụng.');
    }
    if (resource === 'staff' && next.department_id) {
      const dept = await env.DB.prepare('SELECT unit_id,kind,is_active FROM departments WHERE id=?').bind(next.department_id).first<Row>();
      if (!dept || dept.unit_id !== next.unit_id || dept.kind !== next.staff_type || (next.is_active === 1 && dept.is_active !== 1)) throw new ApiError(409,'ORG_INVALID_PARENT','Chọn phòng ban thuộc đúng đơn vị; tài xế phải thuộc Đội xe.');
    }
  }
  if (resource === 'fuel-tanks') {
    const next = { ...(before ?? {}), ...values };
    if (!before || values.warehouse_id !== undefined || values.is_active === 1) {
      const warehouse = await env.DB.prepare('SELECT is_active,kind FROM warehouses WHERE id = ?').bind(next.warehouse_id).first<Row>();
      if (!warehouse || warehouse.kind === 'fuel_tank' || (next.is_active === 1 && warehouse.is_active !== 1)) throw new ApiError(409, 'INVALID_WAREHOUSE', 'Chọn kho đang sử dụng để lưu bồn dầu.');
    }
  }
  if (resource === 'warehouses' && values.is_active === 0 && before) {
    const tank = await env.DB.prepare('SELECT id FROM fuel_tanks WHERE warehouse_id = ? AND is_active = 1 LIMIT 1').bind(before.id).first();
    if (tank) throw new ApiError(409, 'WAREHOUSE_HAS_ACTIVE_TANKS', 'Kho còn bồn đang sử dụng. Chuyển bồn sang kho khác hoặc ngừng sử dụng các bồn trước khi xóa kho.');
  }
  // An administrator cannot accidentally remove their own ability to manage users.
  if (before && resource === 'users' && before.id === user.id &&
      ((values.role !== undefined && values.role !== 'admin') || values.is_active === 0 ||
       (values.auth_subject !== undefined && values.auth_subject !== before.auth_subject) ||
       (values.email !== undefined && values.email !== before.email))) {
    throw new ApiError(409, 'SELF_ADMIN_CHANGE', 'Không thể tự thu hồi hoặc thay đổi danh tính quản trị đang đăng nhập.');
  }
  const rowId = id ?? crypto.randomUUID();
  const keys = Object.keys(values);
  const after: Row = { ...(before ?? {}), ...values, id: rowId, version: Number(before?.version ?? 0) + 1 };
  const mutation = id
    ? env.DB.prepare(`UPDATE ${table} SET ${keys.map(key => `${key} = ?`).join(', ')}, version = version + 1 WHERE id = ? AND version = ? RETURNING id`).bind(...keys.map(key => values[key]), rowId, Number(body.version))
    : env.DB.prepare(`INSERT INTO ${table} (id, ${keys.join(', ')}) VALUES (${['?', ...keys.map(() => '?')].join(', ')}) RETURNING id`).bind(rowId, ...keys.map(key => values[key]));
  const audit = env.DB.prepare(`INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_json, after_json, request_id)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`).bind(
    crypto.randomUUID(), user.id, id ? 'catalog.update' : 'catalog.create', resource, rowId,
    before ? JSON.stringify(before) : null, JSON.stringify(after), requestId,
  );
  let result;
  try {
    const statements = [mutation, audit];
    if(resource==='mount-positions') statements.push(env.DB.prepare("INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'mount-positions',?,'all',? WHERE changes()=1 ON CONFLICT(resource,entity_id,field_key) DO UPDATE SET normalized_text=excluded.normalized_text").bind(rowId,normalizeSearch([after.code,after.name,after.notes].join(' '))));
    result = await env.DB.batch<{id:string}>(statements);
  }
  catch (failure) {
    if(resource==='mount-positions'&&String(failure).includes('UNIQUE'))throw new ApiError(409,'DUPLICATE_POSITION','Mã vị trí lắp đã tồn tại.');
    if(resource==='vat-rates'&&String(failure).includes('UNIQUE'))throw new ApiError(409,'DUPLICATE_VAT','Mã hoặc mức VAT đã tồn tại.');
    if(resource==='suppliers')supplierFailure(failure);
    const message = String(failure);
    if (message.includes('ORG_INVALID_PARENT')) throw new ApiError(409,'ORG_INVALID_PARENT','Đơn vị/phòng ban không phù hợp hoặc đã ngừng sử dụng. Tài xế đang được phân công xe phải được giữ ở nhóm tài xế.');
    if (message.includes('ORG_HAS_MEMBERS')) throw new ApiError(409,'ORG_HAS_MEMBERS','Đơn vị/phòng ban còn thành viên hoặc cấp dưới. Hãy chuyển hoặc ngừng sử dụng các bản ghi liên quan trước.');
    if (message.includes('TANK_WAREHOUSE_INACTIVE')) throw new ApiError(409, 'INVALID_WAREHOUSE', 'Kho đã ngừng sử dụng hoặc không tồn tại. Hãy chọn lại kho.');
    if (message.includes('WAREHOUSE_HAS_ACTIVE_TANKS')) throw new ApiError(409, 'WAREHOUSE_HAS_ACTIVE_TANKS', 'Kho còn bồn đang sử dụng. Chuyển hoặc ngừng sử dụng bồn trước khi xóa kho.');
    throw failure;
  }
  if (result[0].results.length !== 1 || result[0].results[0].id !== rowId) throw new ApiError(409, 'VERSION_CONFLICT', 'Dữ liệu đã thay đổi; hãy tải lại trước khi sửa.');
  return json({ data: after }, id ? 200 : 201);
}
