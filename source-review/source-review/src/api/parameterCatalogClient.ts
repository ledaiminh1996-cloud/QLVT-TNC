import { searchIncludes } from '../../shared/searchText';
import type { CatalogClient, CatalogRow } from './catalogClient';
import { loadCatalogRows } from './loadCatalogRows';

/** Scoped to the open parameter screen. No persistence and no failed-request fallback. */
export function createParameterCatalogClient(api: CatalogClient, now = Date.now) {
  let pending: Promise<CatalogRow[]> | undefined;
  let expires = 0;
  const controller = new AbortController();
  const clear = () => { pending = undefined; expires = 0; };
  async function rows() {
    if (!pending || now() >= expires) {
      expires = Infinity;
      const request = loadCatalogRows(api, 'equipment-parameters', controller.signal);
      pending = request;
      request.then(() => { if (pending === request) expires = now() + 30_000; }, () => { if (pending === request) clear(); });
    }
    return pending!;
  }
  const client: CatalogClient = { ...api,
    async list(resource, options = {}) {
      if (resource !== 'equipment-parameters' || options.view) return api.list(resource, options);
      options.signal?.throwIfAborted();
      const all = await rows();
      options.signal?.throwIfAborted();
      const query = options.q?.trim();
      const filtered = all.filter(row => (!options.group_key || row.group_key === options.group_key) &&
        (!options.status || String(row.is_active) === options.status) &&
        (!query || [row.code, row.name].some(value => searchIncludes(value,query))));
      const page = options.page ?? 1; const size = options.pageSize ?? 25;
      return { data: filtered.slice((page - 1) * size, page * size), pagination: { page, page_size: size, total: filtered.length } };
    },
    async save(resource, values, existing) {
      try { return await api.save(resource, values, existing); }
      finally { if (resource === 'equipment-parameters') clear(); }
    },
  };
  return { client, clear, dispose: () => { controller.abort(); clear(); } };
}
