import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogClient } from '../src/api/catalogClient';
import { loadCatalogRows } from '../src/api/loadCatalogRows';

test('432 suppliers load in five larger requests, with bounded parallelism and stable order', async () => {
  let active = 0; let peak = 0; const calls: number[] = [];
  const client = createCatalogClient((async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    assert.equal(url.searchParams.get('page_size'), '100');
    assert.equal(init?.credentials, 'same-origin');
    const page = Number(url.searchParams.get('page')); calls.push(page);
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, (6 - page) * 2)); active--;
    return Response.json({ data: Array.from({ length: Math.min(100, 432 - (page - 1) * 100) }, (_, i) => ({ id: String((page - 1) * 100 + i), version: 1 })), pagination: { page, page_size: 100, total: 432 } });
  }) as typeof fetch);
  const rows = await loadCatalogRows(client, 'suppliers', new AbortController().signal);
  assert.deepEqual(calls, [1,2,3,4,5]); assert.equal(peak,4);
  assert.deepEqual(rows.map(row => row.id), Array.from({length:432}, (_,i) => String(i)));
});

test('full directory loading rejects failed or inconsistent pages and respects cancellation', async () => {
  for (const mode of ['failure','changed','duplicate']) {
    const client = createCatalogClient((async input => {
      const page = Number(new URL(String(input),'http://localhost').searchParams.get('page'));
      if (page === 2 && mode === 'failure') throw new TypeError('offline');
      return Response.json({ data: [{ id: mode === 'duplicate' ? 'same' : String(page), version: 1 }], pagination: {page,page_size:1,total:page === 2 && mode === 'changed' ? 3 : 2} });
    }) as typeof fetch);
    await assert.rejects(loadCatalogRows(client,'suppliers',new AbortController().signal));
  }
  let called = false;
  const client = createCatalogClient((async () => { called=true; return Response.json({}); }) as typeof fetch);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadCatalogRows(client,'suppliers',controller.signal)); assert.equal(called,false);
});
