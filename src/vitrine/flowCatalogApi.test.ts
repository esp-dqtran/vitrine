import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFlowCatalogPage } from './flowCatalogApi.ts';

test('loads one paginated Flow catalog request for the selected platform', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const page = await loadFlowCatalogPage(
    { platform: 'web', cursor: 'next page', limit: 40 },
    undefined,
    async (input, init) => {
      calls.push({ input, init });
      return Response.json({
        items: [{ category: 'Onboarding', title: 'Creating Account', count: 727 }],
        nextCursor: null,
      });
    },
  );

  assert.deepEqual(page.items, [
    { category: 'Onboarding', title: 'Creating Account', count: 727 },
  ]);
  assert.equal(
    calls[0]?.input,
    '/api/catalog/flows?platform=web&limit=40&cursor=next+page',
  );
});

test('scopes Flow suggestions to the typed query without using broad catalog search', async () => {
  const calls: string[] = [];
  await loadFlowCatalogPage(
    { platform: 'android', query: 'log in' },
    undefined,
    async (input) => {
      calls.push(input);
      return Response.json({ items: [], nextCursor: null });
    },
  );

  assert.deepEqual(calls, [
    '/api/catalog/flows?platform=android&limit=80&query=log+in',
  ]);
});

test('requests interleaved groups only for the first-class Flows page', async () => {
  const calls: string[] = [];
  await loadFlowCatalogPage(
    { platform: 'web', order: 'browse' },
    undefined,
    async (input) => {
      calls.push(input);
      return Response.json({ items: [], nextCursor: null });
    },
  );

  assert.deepEqual(calls, [
    '/api/catalog/flows?platform=web&limit=80&view=browse',
  ]);
});

test('surfaces Flow catalog response failures', async () => {
  await assert.rejects(
    () => loadFlowCatalogPage(
      { platform: 'ios' },
      undefined,
      async () => new Response(null, { status: 503 }),
    ),
    /Flow catalog returned 503/,
  );
});
