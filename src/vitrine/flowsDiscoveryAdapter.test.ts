import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFlowsDiscoveryAdapter,
  selectedFlowDiscoverySearch,
  type FlowsDiscoveryControllerState,
} from './flowsDiscoveryAdapter.ts';

const apiItem = {
  category: 'Account Management',
  type: 'Sign out',
  title: 'Logging out',
  preview: {
    appId: 'whatsapp',
    appName: 'WhatsApp',
    appIconUrl: '/icons/whatsapp.png',
    versionId: 17,
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
    { group: 'flowCategories', value: 'account-settings', count: 17 },
    { group: 'flowTypes', value: 'authentication/sign-out', count: 8 },
  ],
});

test('parses and serializes URL-owned controlled Flow taxonomy filters', () => {
  const adapter = createFlowsDiscoveryAdapter();
  const state = adapter.parse(
    '?filter=flowTypes.authentication%2Fsign-out&query=%20settings%20'
      + '&platform=ios&sort=grouped&filter=flowCategories.account-settings',
  );

  assert.deepEqual(state, {
    platform: 'ios',
    sort: 'grouped',
    query: 'settings',
    filters: [
      { group: 'flowCategories', value: 'account-settings' },
      { group: 'flowTypes', value: 'authentication/sign-out' },
    ],
  });
  assert.equal(
    adapter.serialize(state),
    'platform=ios&sort=grouped&query=settings'
      + '&filter=flowCategories.account-settings'
      + '&filter=flowTypes.authentication%2Fsign-out',
  );
});

test('falls back invalid Flows state to web and category/title order', () => {
  const adapter = createFlowsDiscoveryAdapter();

  assert.deepEqual(adapter.parse(
    '?platform=desktop&sort=latest&filter=categories.Finance',
  ), {
    platform: 'web',
    sort: 'grouped',
    query: '',
    filters: [],
  });
});

test('requests one canonical Flow cursor page with category and Flow-type filters', async () => {
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
      sort: 'grouped',
      query: 'logging settings',
      filters: [
        { group: 'flowCategories', value: 'account-settings' },
        { group: 'flowTypes', value: 'authentication/sign-out' },
      ],
    };
    const page = await adapter.request(state, 'cursor /2', abort.signal);

    assert.deepEqual(calls, [{
      input: '/api/flows/search?platform=android&limit=12&facets=summary'
        + '&query=logging+settings&sort=grouped'
        + '&filter=flowCategories.account-settings'
        + '&filter=flowTypes.authentication%2Fsign-out'
        + '&cursor=cursor+%2F2',
      signal: abort.signal,
    }]);
    assert.equal(page.totalCount, 42);
    assert.equal(page.nextCursor, 'next cursor');
    assert.deepEqual(page.facets[0], {
      group: 'flowCategories',
      value: 'account-settings',
      count: 17,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('limits the public Flow catalog to twelve cards', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify(envelope()));
  }) as typeof fetch;

  try {
    await createFlowsDiscoveryAdapter({ isGuest: true }).request({
      platform: 'web',
      sort: 'grouped',
      query: '',
      filters: [],
    }, null, new AbortController().signal);
    assert.match(calls[0], /[?&]limit=12(?:&|$)/);
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

test('applies a selected Flow category, platform, and exact taxonomy filter while preserving sort', () => {
  assert.equal(
    selectedFlowDiscoverySearch(
      '?platform=web&sort=grouped&query=old'
        + '&filter=flowCategories.account-settings'
        + '&filter=flowTypes.authentication%2Fsign-out',
      'Logging out',
      'android',
      'account-settings',
    ),
    'platform=android&sort=grouped&query=Logging+out'
      + '&filter=flowCategories.account-settings',
  );
});
