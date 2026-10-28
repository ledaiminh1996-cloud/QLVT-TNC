export type Resource = 'parts' | 'part-objects' | 'part-groups' | 'warehouses' | 'fuel-tanks' | 'vehicles' | 'equipment' | 'equipment-parameters' | 'equipment-pairings' | 'equipment-pairing-sets' | 'staff' | 'org-units' | 'departments' | 'suppliers';
export type CatalogRow = Record<string, string | number | null> & { id: string; version: number };
export interface Session {
  identity: { subject: string; email: string };
  user: { id: string; display_name: string; role: 'admin' | 'accountant' | 'warehouse' | 'viewer' } | null;
  access_granted: boolean;
}
export interface PairingStats {total:number;complete:number;missing_trailer:number;missing_generator:number;missing_driver:number;reviewed:number;filtered_complete:number}
export interface Page {
  stats?: PairingStats;
  supplier_next_code?: string;
  data: CatalogRow[];
  pagination: { page: number; page_size: number; total: number };
}

export class CatalogApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function accessMessage(error: unknown): string {
  if (error instanceof CatalogApiError) {
    if (error.code === 'LOGIN_REQUIRED') return 'Cần đăng nhập Cloudflare. Khi phần đăng nhập được cấu hình, hãy tải lại trang để đăng nhập.';
    if (error.status === 401) return 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn. Dữ liệu trên máy không được dùng thay thế; hãy thử lại sau khi phần đăng nhập sẵn sàng.';
    if (error.status === 403) return 'Tài khoản chưa được cấp quyền hoặc đã ngừng hoạt động. Hãy liên hệ người quản trị.';
    if (error.code === 'AUTH_NOT_CONFIGURED') return 'Phần đăng nhập Cloudflare chưa được cấu hình. Có thể tiếp tục sau khi thiết lập đăng nhập hoàn tất.';
    if (error.status === 409 && error.code === 'VERSION_CONFLICT') return 'Bản ghi đã được người khác cập nhật. Đóng biểu mẫu, tải lại danh sách rồi mở bản mới để đối chiếu.';
    if (error.code === 'INVALID_RESPONSE') return 'Chưa nhận được dữ liệu từ máy chủ ứng dụng. Hãy kiểm tra kết nối API hoặc thử lại.';
    return error.message;
  }
  return 'Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại; chưa có dữ liệu nào được xác nhận đã lưu.';
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never { throw new CatalogApiError(502, 'INVALID_RESPONSE', 'Phản hồi không hợp lệ.'); }
function row(value: unknown): value is CatalogRow {
  return object(value) && typeof value.id === 'string' && Number.isSafeInteger(value.version) && Number(value.version) > 0;
}

export function createCatalogClient(fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
  async function request(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await fetcher(`/api${path}`, {
      ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      throw new CatalogApiError(401, 'LOGIN_REQUIRED', 'Cần đăng nhập.');
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) return invalid();
    let payload: unknown;
    try { payload = await response.json(); } catch { return invalid(); }
    if (!object(payload)) return invalid();
    if (!response.ok) {
      const error = object(payload.error) ? payload.error : {};
      throw new CatalogApiError(response.status, typeof error.code === 'string' ? error.code : 'API_ERROR',
        typeof error.message === 'string' ? error.message : 'Không thể xử lý yêu cầu.',
        typeof error.request_id === 'string' ? error.request_id : undefined);
    }
    return payload;
  }
  return {
    async importParts(rows: Record<string, string | number | null>[], batchId: string): Promise<CatalogRow[]> {
      const { data } = await request('/parts/import', { method: 'POST', body: JSON.stringify({ rows, batch_id: batchId }) });
      if (!Array.isArray(data) || !data.every(row)) return invalid();
      return data;
    },
    async session(signal?: AbortSignal): Promise<Session> {
      const { data } = await request('/auth/me', { signal });
      if (!object(data) || !object(data.identity) || typeof data.identity.subject !== 'string' || typeof data.identity.email !== 'string' || typeof data.access_granted !== 'boolean') return invalid();
      if (data.user !== null && (!object(data.user) || typeof data.user.id !== 'string' || typeof data.user.display_name !== 'string' || !['admin', 'accountant', 'warehouse', 'viewer'].includes(String(data.user.role)))) return invalid();
      if (data.access_granted && data.user === null) return invalid();
      return data as unknown as Session;
    },
    async list(resource: Resource, options: { page?: number; pageSize?: number; view?: string; parent_id?: string; entity_id?: string; filter?: string; route_group?: string; sort?: string; direction?: string; type?: string; source_group?: string; group_key?: string; q?: string; status?: string; original_status?: string; warehouse_id?: string; unit_id?: string; department_id?: string; staff_type?: string; unassigned?: string; kind?: string; signal?: AbortSignal } = {}): Promise<Page> {
      const params = new URLSearchParams({ page: String(options.page ?? 1), page_size: String(options.pageSize ?? 25) });
      if (options.q?.trim()) params.set('q', options.q.trim());
      for (const key of ['view','parent_id','entity_id','filter','route_group','sort','direction','unit_id','department_id','staff_type','unassigned','kind','type','source_group','group_key','original_status'] as const) if (options[key]) params.set(key,options[key]!);
      if (options.warehouse_id) params.set('warehouse_id', options.warehouse_id);
      if (options.status) params.set(['vehicles','equipment'].includes(resource) ? 'status' : 'is_active', options.status);
      const result = await request(`/${resource}?${params}`, { signal: options.signal });
      const p = result.pagination;
      if (!Array.isArray(result.data) || !result.data.every(row) || !object(p) || !Number.isSafeInteger(p.page) || Number(p.page) < 1 || !Number.isSafeInteger(p.page_size) || Number(p.page_size) < 1 || !Number.isSafeInteger(p.total) || Number(p.total) < 0) return invalid();
      if (result.stats !== undefined && (!object(result.stats) || !['total','complete','missing_trailer','missing_generator','missing_driver','reviewed','filtered_complete'].every(key=>Number.isSafeInteger((result.stats as Record<string,unknown>)[key]) && Number((result.stats as Record<string,unknown>)[key])>=0))) return invalid();
      return result as unknown as Page;
    },
    async save(resource: Resource, values: Record<string, string | number | null>, existing?: CatalogRow): Promise<CatalogRow> {
      const { data } = await request(`/${resource}${existing ? `/${encodeURIComponent(existing.id)}` : ''}`, {
        method: existing ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...values, ...(existing ? { version: existing.version } : {}) }),
      });
      if (!row(data)) return invalid();
      return data;
    },
  };
}
export type CatalogClient = ReturnType<typeof createCatalogClient>;
