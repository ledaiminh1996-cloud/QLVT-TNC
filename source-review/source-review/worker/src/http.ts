export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function readJson(request: Request, limit = 32 * 1024): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'JSON_REQUIRED', 'Nội dung phải có định dạng application/json.');
  }
  if (Number(request.headers.get('content-length')) > limit) {
    throw new ApiError(413, 'BODY_TOO_LARGE', `Dữ liệu gửi lên vượt quá ${limit / 1024} KB.`);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'INVALID_JSON', 'Thiếu nội dung JSON.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, 'BODY_TOO_LARGE', `Dữ liệu gửi lên vượt quá ${limit / 1024} KB.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); }
  catch { throw new ApiError(400, 'INVALID_JSON', 'JSON không hợp lệ.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_JSON', 'Nội dung phải là một đối tượng JSON.');
  }
  return body as Record<string, unknown>;
}
