import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFlowsDiscoveryAdapter,
  selectedFlowDiscoverySearch,
  type FlowsDiscoveryControllerState,
} from './flowsDiscoveryAdapter.ts';

const apiItem = {
  category: 'Account Management',
  title: 'Logging out',
  count: 12,
  preview: {
    appId: 'whatsapp',
    appName: 'WhatsApp',
    appIconUrl: '/icons/whatsapp.png',
    version: 7,
    sourceFlowId: '7230',
    screenCount: 4,
    flow: {
      id: 'whatsapp:7230',
      title: 'Logging out',
      category: 'Account Management',
      description: '',
      tags: ['Settings'],
      steps: [{
        label: 'Open settings',
        evidence: [{
          imageId: 1,
          imageUrl: '/api/media/1',
          thumbnailUrl: '/api/media/1?thumbnail=1',
          description: 'Settings',
        }],
      }],
    },
  },
};

const envelope = (
  items: unknown[] = [apiItem],
  nextCursor: string | null = null,
  totalCount = items.length,
) => ({
  items,
  nextCursor,
  totalCount,
  facets: [
    { group: 'flowGroups', value: 'Account Management', count: 17 },
    { group: 'flowGroups', value: 'New User Experience', count: 8 },
  ],
});

test('parses and serializes URL-owned Flows state with repeated Flow groups', () => {
  const adapter = createFlowsDiscoveryAdapter();
  const state = adapter.parse(
    '?filter=flowGroups.New%20User%20Experience&query=%20settings%20'
      + '&platform=ios&sort=grouped&filter=flowGroups.Account%20Management',
  );

  assert.deepEqual(state, {
    platform: 'ios',
    sort: 'grouped',
    query: 'settings',
    filters: [
      { group: 'flowGroups', value: 'Account Management' },
      { group: 'flowGroups', value: 'New User Experience' },
    ],
  });
  assert.equal(
    adapter.serialize(state),
    'platform=ios&sort=grouped&query=settings'
      + '&filter=flowGroups.Account+Management'
      + '&filter=flowGroups.New+User+Experience',
  );
});

test('falls back invalid Flows state to web and Popular', () => {
  const adapter = createFlowsDiscoveryAdapter();

  assert.deepEqual(adapter.parse(
    '?platform=desktop&sort=latest&filter=categories.Finance',
  ), {
    platform: 'web',
    sort: 'popular',
    query: '',
    filters: [],
  });
});

test('requests one canonical Flow cursor page with OR Flow-group filters', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string; signal: AbortSignal | null }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), signal: init?.signal ?? null });
    return new Response(JSON.stringify(envelope([apiItem], 'next cursor', 42)), {
      status: 200,
    });
  }) as typeof fetch;
  const abort = new AbortController();

  try {
    const adapter = createFlowsDiscoveryAdapter();
    const state: FlowsDiscoveryControllerState = {
      platform: 'android',
      sort: 'popular',
      query: 'logging settings',
      filters: [
        { group: 'flowGroups', value: 'Account Management' },
        { group: 'flowGroups', value: 'New User Experience' },
      ],
    };
    const page = await adapter.request(state, 'cursor /2', abort.signal);

    assert.deepEqual(calls, [{
      input: '/api/catalog/flows?platform=android&limit=12&facets=summary'
        + '&query=logging+settings&sort=popular'
        + '&filter=flowGroups.Account+Management'
        + '&filter=flowGroups.New+User+Experience'
        + '&cursor=cursor+%2F2',
      signal: abort.signal,
    }]);
    assert.equal(page.totalCount, 42);
    assert.equal(page.nextCursor, 'next cursor');
    assert.deepEqual(page.facets[0], {
      group: 'flowGroups',
      value: 'Account Management',
      count: 17,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses preview identity and title as the Flow item key', () => {
  const adapter = createFlowsDiscoveryAdapter();

  assert.equal(
    adapter.itemKey(apiItem),
    'whatsapp:7:7230:Logging out',
  );
});

test('applies a selected Flow and platform while preserving canonical sort and filters', () => {
  assert.equal(
    selectedFlowDiscoverySearch(
      '?platform=web&sort=grouped&query=old'
        + '&filter=flowGroups.Account%20Management'
        + '&filter=flowGroups.New%20User%20Experience',
      'Logging out',
      'android',
    ),
    'platform=android&sort=grouped&query=Logging+out'
      + '&filter=flowGroups.Account+Management'
      + '&filter=flowGroups.New+User+Experience',
  );
});
