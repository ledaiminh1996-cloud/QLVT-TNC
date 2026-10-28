import type { CatalogClient, CatalogRow, Resource } from './catalogClient';

/** Full directory reads: larger server pages, at most four requests in flight. */
export async function loadCatalogRows(api: CatalogClient, resource: Resource, signal: AbortSignal, status?: string): Promise<CatalogRow[]> {
  const options = { pageSize: 100, status, signal };
  signal.throwIfAborted();
  const first = await api.list(resource, { ...options, page: 1 });
  signal.throwIfAborted();
  const pages = Math.max(1, Math.ceil(first.pagination.total / first.pagination.page_size));
  if (pages > 1000) throw new Error('Danh mục vượt giới hạn tải.');
  const rows = [...first.data];
  for (let start = 2; start <= pages; start += 4) {
    signal.throwIfAborted();
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - start + 1) }, (_, offset) => api.list(resource, { ...options, page: start + offset })));
    signal.throwIfAborted();
    for (const result of batch) {
      if (result.pagination.total !== first.pagination.total || result.pagination.page_size !== first.pagination.page_size) throw new Error('Danh mục vừa thay đổi. Vui lòng tải lại.');
      rows.push(...result.data);
    }
  }
  if (rows.length !== first.pagination.total || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Không thể tải đầy đủ danh mục. Vui lòng tải lại.');
  return rows;
}
