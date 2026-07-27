import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAppDetailPrefetch,
  loadAppDetail,
  prefetchAppDetail,
} from './appDetailPrefetch.ts';

const metadata = {
  id: 'quora',
  app: 'Quora',
  categories: [{ id: 1, name: 'Social', slug: 'social' }],
  accent: '#b92b27',
  totalScreens: 563,
  totalUiElements: 80,
  totalFlows: 12,
  platforms: ['ios'],
};

test('reuses an entry-prefetched App metadata request in the detail hook', async (t) => {
  t.after(() => clearAppDetailPrefetch());
  let requests = 0;
  const request = async () => {
    requests += 1;
    return Response.json({ app: metadata });
  };

  const prefetched = prefetchAppDetail('quora', request);
  const loaded = loadAppDetail('quora', undefined, request);

  assert.equal(prefetched, loaded);
  assert.equal((await loaded).id, 'quora');
  assert.equal(requests, 1);
});

test('drops failed prefetches so detail loading can retry', async (t) => {
  t.after(() => clearAppDetailPrefetch());
  await assert.rejects(
    () => prefetchAppDetail('missing', async () => new Response(null, { status: 503 })),
    /503/,
  );

  const result = await loadAppDetail(
    'missing',
    undefined,
    async () => Response.json({ app: { ...metadata, id: 'missing' } }),
  );
  assert.equal(result.id, 'missing');
});
