import { ApiError, json, readJson } from './http.ts';
import { requireRole } from './auth.ts';
import { catalogs, validate } from './catalogs.ts';
import type { Env, Row, User } from './types.ts';

export async function validatePartCodes(env: Env, values: Row) {
  if (!['M', 'G', 'T', 'C'].includes(String(values.item_type)) || !/^[A-Z0-9]{1,20}$/.test(String(values.object_code ?? '')) || !/^[A-Z0-9]{1,20}$/.test(String(values.group_code ?? ''))) {
    throw new ApiError(400, 'PART_CODES_REQUIRED', 'Cần chọn Loại hàng, Mã đối tượng và Mã nhóm hợp lệ.');
  }
  const results = await env.DB.batch([
    env.DB.prepare('SELECT code FROM part_objects WHERE code = ? AND is_active = 1').bind(values.object_code),
    env.DB.prepare('SELECT code FROM part_groups WHERE code = ? AND is_active = 1').bind(values.group_code),
  ]);
  if (!results[0].results.length || !results[1].results.length) throw new ApiError(409, 'INACTIVE_PART_CODE', 'Mã đối tượng hoặc mã nhóm chưa có trong danh mục, hoặc đã ngừng sử dụng.');
  const prefix = `${values.item_type}-${values.object_code}-${values.group_code}-`;
  if (values.sku && (!String(values.sku).startsWith(prefix) || !/^[0-9]{4}$/.test(String(values.sku).slice(prefix.length)) || Number(String(values.sku).slice(prefix.length)) < 1)) {
    throw new ApiError(400, 'SKU_FORMAT', `Mã có sẵn phải theo dạng ${prefix}0001, với số từ 0001 đến 9999.`);
  }
}

export async function createNumberedParts(env: Env, user: User, rows: Row[], requestId: string, batch?: { id: string; hash: string }): Promise<Response> {
  const statements: D1PreparedStatement[] = [];
  const resultIndexes: number[] = [];
  const ids = rows.map(() => crypto.randomUUID());
  if (batch) statements.push(env.DB.prepare('INSERT INTO part_import_batches (id, request_hash, created_by, row_ids_json) VALUES (?, ?, ?, ?)').bind(batch.id, batch.hash, user.id, JSON.stringify(ids)));
  rows.forEach((values, index) => {
    const prefix = `${values.item_type}-${values.object_code}-${values.group_code}-`;
    if (!values.sku) {
      statements.push(env.DB.prepare(`INSERT INTO part_sku_sequences (prefix, last_value)
        SELECT ?, COALESCE(MAX(CAST(substr(sku, -4) AS INTEGER)), 0) + 1 FROM parts
        WHERE substr(sku, 1, length(?)) = ? COLLATE NOCASE AND length(sku) = length(?) + 4 AND substr(sku, -4) NOT GLOB '*[^0-9]*'
        ON CONFLICT(prefix) DO UPDATE SET last_value = MAX(part_sku_sequences.last_value, excluded.last_value - 1) + 1`).bind(prefix, prefix, prefix, prefix));
    }
    const keys = Object.keys(values).filter(key => key !== 'sku');
    const expressions = keys.map(key => key === 'object_code'
      ? "CASE WHEN EXISTS (SELECT 1 FROM part_objects WHERE code = ? AND is_active = 1) THEN ? ELSE '__INACTIVE__' END"
      : key === 'group_code' ? "CASE WHEN EXISTS (SELECT 1 FROM part_groups WHERE code = ? AND is_active = 1) THEN ? ELSE '__INACTIVE__' END" : '?');
    const args = keys.flatMap(key => ['object_code', 'group_code'].includes(key) ? [values[key], values[key]] : [values[key]]);
    resultIndexes.push(statements.length);
    statements.push(env.DB.prepare(`INSERT INTO parts (id, ${keys.join(', ')}, sku)
      SELECT ?, ${expressions.join(', ')}, ${values.sku ? '?' : "? || printf('%04d', (SELECT last_value FROM part_sku_sequences WHERE prefix = ?))"} RETURNING *`)
      .bind(ids[index], ...args, ...(values.sku ? [values.sku] : [prefix, prefix])));
    const snapshotKeys = ['id', 'sku', ...keys, 'version'];
    const snapshot = snapshotKeys.map(key => `'${key}', ${key}`).join(', ');
    statements.push(env.DB.prepare(`INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, after_json, request_id)
      SELECT ?, ?, 'catalog.create', 'parts', id, json_object(${snapshot}), ? FROM parts WHERE id = ?`)
      .bind(crypto.randomUUID(), user.id, requestId, ids[index]));
  });
  try {
    const results = await env.DB.batch(statements);
    const data = resultIndexes.map(index => results[index].results[0]);
    return json(batch ? { data, imported: data.length, batch_id: batch.id } : { data: data[0] }, 201);
  } catch (error) {
    if (batch) {
      const replay = await getReplay(env, user, batch.id, batch.hash);
      if (replay) return replay;
    }
    if (error instanceof Error && /last_value BETWEEN 1 AND 9999/i.test(error.message)) throw new ApiError(409, 'SKU_EXHAUSTED', 'Bộ mã này đã đạt 9999. Cần bổ sung quy tắc mở rộng trước khi tạo tiếp.');
    throw error;
  }
}

async function getReplay(env: Env, user: User, id: string, hash: string): Promise<Response | null> {
  const old = await env.DB.prepare('SELECT request_hash, created_by, row_ids_json FROM part_import_batches WHERE id = ?').bind(id).first<{ request_hash: string; created_by: string; row_ids_json: string }>();
  if (!old) return null;
  if (old.request_hash !== hash || old.created_by !== user.id) throw new ApiError(409, 'IMPORT_KEY_CONFLICT', 'Mã lượt nhập đã được dùng với nội dung hoặc tài khoản khác.');
  const ids = JSON.parse(old.row_ids_json) as string[];
  const results = await env.DB.batch(ids.map(value => env.DB.prepare('SELECT * FROM parts WHERE id = ?').bind(value)));
  return json({ data: results.map(result => result.results[0]), imported: ids.length, batch_id: id, replayed: true });
}

export async function importParts(request: Request, env: Env, user: User, requestId: string) {
  requireRole(user, ['admin', 'accountant']);
  const body = await readJson(request, 512 * 1024);
  if (Object.keys(body).some(key => !['rows', 'batch_id'].includes(key)) || typeof body.batch_id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.batch_id) || !Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 100) {
    throw new ApiError(400, 'INVALID_IMPORT', 'Mỗi lượt nhập cần 1–100 dòng và mã lượt nhập hợp lệ.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body.rows)));
  const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const replay = await getReplay(env, user, body.batch_id, hash);
  if (replay) return replay;
  const rows: Row[] = [];
  for (let index = 0; index < body.rows.length; index++) {
    try {
      const raw = body.rows[index];
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.hasOwn(raw, 'version')) throw new ApiError(400, 'INVALID_ROW', 'Dòng dữ liệu không hợp lệ.');
      const values = validate(raw as Record<string, unknown>, catalogs.parts, false);
      await validatePartCodes(env, values);
      rows.push(values);
    } catch (error) {
      if (error instanceof ApiError) throw new ApiError(error.status, error.code, `Dòng ${index + 2}: ${error.message}`);
      throw error;
    }
  }
  return createNumberedParts(env, user, rows, requestId, { id: body.batch_id, hash });
}
