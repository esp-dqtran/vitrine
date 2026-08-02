import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadFlowCatalogPage,
  parseFlowCatalogPage,
} from './flowCatalogApi.ts';

const item = {
  category: 'Account Management',
  title: 'Creating Account',
  count: 727,
  preview: {
    appId: 'linear',
    appName: 'Linear',
    appIconUrl: null,
    versionId: 7,
    version: 3,
    sourceFlowId: 'creating-account',
    screenCount: 1,
    flow: {
      id: 'linear:71',
      title: 'Creating Account',
      category: 'Account Management',
      description: '',
      tags: ['onboarding'],
      steps: [{
        label: 'Open account',
        evidence: [{
          imageId: 1,
          imageUrl: '/api/catalog/flow-media/linear/web/7/71/1?variant=full',
          thumbnailUrl: '/api/catalog/flow-media/linear/web/7/71/1?variant=thumb',
          description: 'Open account',
        }],
      }],
    },
  },
};
const envelope = {
  items: [item],
  nextCursor: null,
  totalCount: 12,
  facets: [{ group: 'flowGroups', value: 'Account Management', count: 4 }],
};

test('loads one canonical cacheable Flow request with stable filters', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const page = await loadFlowCatalogPage(
    {
      platform: 'web',
      cursor: 'next page',
      limit: 40,
      order: 'grouped',
      flowGroups: ['Account Management', 'Security'],
    },
    undefined,
    async (input, init) => {
      calls.push({ input, init });
      return Response.json(envelope);
    },
  );

  assert.deepEqual(page, envelope);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.input,
    '/api/catalog/flows?platform=web&limit=40&facets=summary&sort=grouped'
      + '&filter=flowGroups.Account+Management&filter=flowGroups.Security&cursor=next+page',
  );
  assert.equal(calls[0]?.init?.cache, undefined);
});

test('uses canonical popular sort for typed Flow suggestions', async () => {
  const calls: string[] = [];
  await loadFlowCatalogPage(
    { platform: 'android', query: 'log in' },
    undefined,
    async (input) => {
      calls.push(input);
      return Response.json({ ...envelope, items: [] });
    },
  );
  assert.deepEqual(calls, [
    '/api/catalog/flows?platform=android&limit=80&facets=summary&query=log+in&sort=popular',
  ]);
});

test('strictly parses every envelope, item, preview, Flow, step, evidence, and facet field', () => {
  assert.deepEqual(parseFlowCatalogPage(envelope), envelope);
  const malformed: unknown[] = [
    { ...envelope, extra: true },
    { ...envelope, totalCount: -1 },
    { ...envelope, facets: [{ ...envelope.facets[0], group: 'flows' }] },
    { ...envelope, facets: [{ ...envelope.facets[0], count: 1.5 }] },
    { ...envelope, items: [{ ...item, count: '727' }] },
    { ...envelope, items: [{ ...item, preview: { ...item.preview, version: 0 } }] },
    { ...envelope, items: [{ ...item, preview: { ...item.preview, screenCount: -1 } }] },
    { ...envelope, items: [{ ...item, preview: {
      ...item.preview,
      flow: { ...item.preview.flow, tags: ['ok', 1] },
    } }] },
    { ...envelope, items: [{ ...item, preview: {
      ...item.preview,
      flow: { ...item.preview.flow, steps: [{ label: 'Bad', evidence: 'no' }] },
    } }] },
    { ...envelope, items: [{ ...item, preview: {
      ...item.preview,
      flow: {
        ...item.preview.flow,
        steps: [{
          label: 'Bad',
          evidence: [{ ...item.preview.flow.steps[0]!.evidence[0], imageId: 0 }],
        }],
      },
    } }] },
  ];
  for (const value of malformed) {
    assert.throws(() => parseFlowCatalogPage(value), /invalid Flow catalog response/);
  }
});

test('rejects malformed responses and a retry can recover', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return Response.json(calls === 1
      ? { items: [], nextCursor: null }
      : envelope);
  };
  await assert.rejects(
    () => loadFlowCatalogPage({ platform: 'ios' }, undefined, fetcher),
    /invalid Flow catalog response/,
  );
  assert.deepEqual(
    await loadFlowCatalogPage({ platform: 'ios' }, undefined, fetcher),
    envelope,
  );
  assert.equal(calls, 2);
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
