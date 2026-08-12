import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appsCatalogRequestPath,
  createAppsDiscoveryAdapter,
  type AppsDiscoveryControllerState,
} from './appsDiscoveryAdapter.ts';
import { createDiscoveryController } from './useDiscoveryController.ts';

const apiItem = {
  id: 'linear',
  app: 'Linear',
  categories: [{ id: 1, name: 'Business', slug: 'business' }],
  accent: '#5e6ad2',
  totalScreens: 1,
  platforms: ['web'],
  analyzedScreens: 1,
  lastCapturedAt: '2026-07-20T00:00:00.000Z',
  iconUrl: null,
  description: 'Issue tracking',
  previewVideoUrl: null,
  previewScreens: [{
    id: 10,
    type: 'Dashboard',
    productArea: 'Workspace',
    theme: 'dark',
    visibleStates: ['Signed in'],
    platform: 'web',
    description: 'Dashboard',
    url: '/linear.png',
    capturedAt: '2026-07-20T00:00:00.000Z',
  }],
};

test('parses canonical Apps discovery state and serializes it in canonical order', () => {
  const adapter = createAppsDiscoveryAdapter();
  const state = adapter.parse(
    '?filter=flows.Checkout&query=%20billing%20&platform=ios&content_type=flows&sort=trending&filter=categories.Finance',
  );

  assert.deepEqual(state, {
    platform: 'ios',
    contentType: 'flows',
    sort: 'latest',
    query: 'billing',
    filters: [
      { group: 'categories', value: 'Finance' },
      { group: 'flows', value: 'Checkout' },
    ],
  });
  assert.equal(
    adapter.serialize(state),
    'platform=ios&content_type=flows&query=billing&filter=categories.Finance&filter=flows.Checkout',
  );
});

test('reads legacy Apps filters and content_type but writes repeated canonical filters', () => {
  const adapter = createAppsDiscoveryAdapter();
  const state = adapter.parse(
    '?platform=web&content_type=screens&filter=appCategories.Business_screenPatterns.Dashboard',
  );

  assert.equal(state.contentType, 'screens');
  assert.deepEqual(state.filters, [
    { group: 'categories', value: 'Business' },
    { group: 'screens', value: 'Dashboard' },
  ]);
  assert.equal(
    adapter.serialize(state),
    'platform=web&content_type=screens&filter=categories.Business&filter=screens.Dashboard',
  );
});

test('builds one newest-only Apps request with platform, query, repeated filters, and cursor', () => {
  const state: AppsDiscoveryControllerState = {
    platform: 'android',
    contentType: 'screens',
    sort: 'trending',
    query: 'checkout',
    filters: [
      { group: 'categories', value: 'Shopping' },
      { group: 'screens', value: 'Cart' },
    ],
  };

  assert.equal(
    appsCatalogRequestPath(state, 'cursor /2'),
    '/api/apps/search?platform=android&facets=summary&query=checkout&filter=categories.Shopping&filter=screens.Cart&cursor=cursor+%2F2',
  );
});

test('caps the public Apps catalog request at twelve cards', () => {
  const state: AppsDiscoveryControllerState = {
    platform: 'web',
    contentType: 'apps',
    sort: 'latest',
    query: '',
    filters: [],
  };

  assert.equal(
    appsCatalogRequestPath(state, null, 'catalog', true),
    '/api/apps?platform=web&facets=summary&limit=12',
  );
});

test('requests and parses one runtime catalog envelope, converting previews to App screens', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string; signal: AbortSignal | null }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), signal: init?.signal ?? null });
    return new Response(JSON.stringify({
      items: [apiItem],
      nextCursor: 'next',
      totalCount: 42,
      facets: [{ group: 'categories', value: 'Business', count: 7, section: 'Work' }],
    }), { status: 200 });
  }) as typeof fetch;
  const controller = new AbortController();
  try {
    const adapter = createAppsDiscoveryAdapter();
    const page = await adapter.request(adapter.defaults, null, controller.signal);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.input, '/api/apps?platform=web&facets=summary');
    assert.equal(calls[0]?.signal, controller.signal);
    assert.equal(page.items[0]?.screens[0]?.url, '/linear.png');
    assert.equal(page.nextCursor, 'next');
    assert.equal(page.totalCount, 42);
    assert.deepEqual(page.facets, [
      { group: 'categories', value: 'Business', count: 7, section: 'Work' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects malformed catalog envelopes and keys Apps by id', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    items: [{ ...apiItem, id: '' }],
    nextCursor: null,
    totalCount: 1,
    facets: [],
  }), { status: 200 })) as typeof fetch;
  try {
    const adapter = createAppsDiscoveryAdapter();
    await assert.rejects(
      adapter.request(
        { ...adapter.defaults, query: 'malformed-envelope' },
        null,
        new AbortController().signal,
      ),
      /invalid catalog response: item/,
    );
    assert.equal(adapter.itemKey({ id: 'app-id' } as never), 'app-id');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('drives one initial request and one reset filter request through the generic controller', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      items: [{ ...apiItem, id: `controller-${calls.length}` }],
      nextCursor: null,
      totalCount: 1,
      facets: [{ group: 'categories', value: 'Business', count: 1 }],
    }), { status: 200 });
  }) as typeof fetch;
  const navigations: Array<{ search: string; mode: 'push' | 'replace' }> = [];
  const adapter = createAppsDiscoveryAdapter({ query: 'controller-integration' });
  const controller = createDiscoveryController({
    adapter,
    locationSearch: '',
    onNavigate: (search, mode) => navigations.push({ search, mode }),
  });
  try {
    controller.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.public.setState({
      ...controller.snapshot().state,
      contentType: 'screens',
      filters: [{ group: 'screens', value: 'Dashboard' }],
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(calls, [
      '/api/apps/search?platform=web&facets=summary&query=controller-integration',
      '/api/apps/search?platform=web&facets=summary&query=controller-integration&filter=screens.Dashboard',
    ]);
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0]?.mode, 'push');
    assert.match(navigations[0]?.search ?? '', /content_type=screens/);
    assert.deepEqual(controller.snapshot().items.map(({ id }) => id), ['controller-2']);
  } finally {
    controller.dispose();
    globalThis.fetch = originalFetch;
  }
});

test('uses the shared published Apps envelope for admin viewers and preserves progress fields', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      items: [{
        ...apiItem,
        id: 'draft',
        app: 'Draft',
        categories: [],
        accent: '#123456',
        totalScreens: 5,
        analyzedScreens: 2,
      }],
      nextCursor: null,
      totalCount: 1,
      facets: [{ group: 'screens', value: 'Dashboard', count: 1 }],
    }), { status: 200 });
  }) as typeof fetch;
  try {
    const adapter = createAppsDiscoveryAdapter({ source: 'admin' });
    const page = await adapter.request({
      ...adapter.defaults,
      filters: [{ group: 'screens', value: 'Dashboard' }],
    }, null, new AbortController().signal);

    assert.deepEqual(calls, [
      '/api/apps?platform=web&facets=summary&filter=screens.Dashboard',
    ]);
    assert.equal(page.items[0]?.analyzedScreens, 2);
    assert.deepEqual(page.facets, [
      { group: 'screens', value: 'Dashboard', count: 1 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
