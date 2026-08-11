import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSitesDiscoveryAdapter,
  type SitesDiscoveryControllerState,
} from './sitesDiscoveryAdapter.ts';
import { invalidateSitesPageCache } from './sitesApi.ts';
import { createDiscoveryController } from './useDiscoveryController.ts';

const apiItem = {
  siteId: 1,
  versionId: 2,
  name: 'V7',
  slug: 'v-7',
  routeSlug: 'v7',
  sourceUrl: 'https://v7labs.com/',
  description: 'AI-powered visual data platform.',
  logoUrl: '/logo.png',
  categories: ['Business'],
  styles: ['Minimal'],
  popularity: 91,
  label: 'Jul 2026',
  isLatest: true,
  pageCount: 16,
  sectionCount: 46,
  previewUrl: '/api/sites/1/versions/2/media/preview',
  previewMediaKind: 'video',
  previews: [{
    id: 10,
    title: 'Pricing',
    position: 0,
    url: '/api/sites/1/versions/2/pages/10/media',
  }],
  updatedAt: '2026-07-20T00:00:00.000Z',
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
    { group: 'categories', value: 'Business', count: 7, section: 'Industry' },
    { group: 'sections', value: 'Pricing', count: 4, section: 'Conversion' },
    { group: 'styles', value: 'Minimal', count: 3, section: 'Aesthetic' },
  ],
});

test('parses and serializes canonical Sites discovery state with repeated filters', () => {
  const adapter = createSitesDiscoveryAdapter();
  const state = adapter.parse(
    '?filter=styles.Minimal&query=%20billing%20&platform=web&sort=popular'
      + '&filter=categories.Finance&filter=sections.Pricing',
  );

  assert.deepEqual(state, {
    platform: 'web',
    sort: 'popular',
    query: 'billing',
    filters: [
      { group: 'categories', value: 'Finance' },
      { group: 'sections', value: 'Pricing' },
      { group: 'styles', value: 'Minimal' },
    ],
  });
  assert.equal(
    adapter.serialize(state),
    'platform=web&sort=popular&query=billing'
      + '&filter=categories.Finance&filter=sections.Pricing&filter=styles.Minimal',
  );
});

test('reads legacy Sites URL fields and initial query fallback but writes canonical filters', () => {
  const adapter = createSitesDiscoveryAdapter({ query: 'landing handoff' });

  assert.deepEqual(adapter.parse(
    '?category=Business&section=Pricing&style=Minimal&sort=popular',
  ), {
    platform: 'web',
    sort: 'popular',
    query: 'landing handoff',
    filters: [
      { group: 'categories', value: 'Business' },
      { group: 'sections', value: 'Pricing' },
      { group: 'styles', value: 'Minimal' },
    ],
  });
  assert.equal(
    adapter.serialize(adapter.parse('?category=Business&section=Pricing&style=Minimal')),
    'platform=web&sort=latest&query=landing+handoff'
      + '&filter=categories.Business&filter=sections.Pricing&filter=styles.Minimal',
  );
});

test('requests one canonical Sites cursor page and parses the runtime envelope', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string; signal: AbortSignal | null }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), signal: init?.signal ?? null });
    return new Response(JSON.stringify(envelope([apiItem], 'next cursor', 42)), { status: 200 });
  }) as typeof fetch;
  const abort = new AbortController();
  try {
    const adapter = createSitesDiscoveryAdapter();
    const state: SitesDiscoveryControllerState = {
      platform: 'web',
      sort: 'popular',
      query: 'pricing',
      filters: [
        { group: 'categories', value: 'Business' },
        { group: 'sections', value: 'Pricing' },
        { group: 'styles', value: 'Minimal' },
      ],
    };
    const page = await adapter.request(state, 'cursor /2', abort.signal);

    assert.deepEqual(calls, [{
      input: '/api/sites/search?platform=web&sort=popular&facets=summary&query=pricing'
        + '&filter=categories.Business&filter=sections.Pricing&filter=styles.Minimal'
        + '&cursor=cursor+%2F2&limit=24',
      signal: abort.signal,
    }]);
    assert.equal(page.items[0]?.routeSlug, 'v7');
    assert.equal(page.nextCursor, 'next cursor');
    assert.equal(page.totalCount, 42);
    assert.deepEqual(page.facets[1], {
      group: 'sections',
      value: 'Pricing',
      count: 4,
      section: 'Conversion',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects malformed Sites envelopes and keys each Site version', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(
    envelope([{ ...apiItem, routeSlug: '' }]),
  ), { status: 200 })) as typeof fetch;
  try {
    const adapter = createSitesDiscoveryAdapter();
    await assert.rejects(
      adapter.request(adapter.defaults, null, new AbortController().signal),
      /Sites returned an invalid response/,
    );
    assert.equal(
      adapter.itemKey({ id: 7, versionId: 11 } as never),
      '7:11',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('makes one initial request, one filter reset, and one cursor append with version dedupe', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let intersection:
    | ((entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void)
    | undefined;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('filter=categories.Business') && !url.includes('cursor=')) {
      return new Response(JSON.stringify(envelope(
        [{ ...apiItem, siteId: 2, versionId: 3, routeSlug: 'filtered' }],
        'page-2',
        3,
      )), { status: 200 });
    }
    if (url.includes('cursor=page-2')) {
      return new Response(JSON.stringify(envelope([
        { ...apiItem, siteId: 2, versionId: 3, routeSlug: 'duplicate' },
        { ...apiItem, siteId: 2, versionId: 4, routeSlug: 'new-version' },
      ], null, 3)), { status: 200 });
    }
    return new Response(JSON.stringify(envelope([apiItem], null, 1)), { status: 200 });
  }) as typeof fetch;

  const navigations: Array<{ search: string; mode: 'push' | 'replace' }> = [];
  const controller = createDiscoveryController({
    adapter: createSitesDiscoveryAdapter(),
    locationSearch: '',
    onNavigate: (search, mode) => navigations.push({ search, mode }),
    observerFactory: (callback) => {
      intersection = callback;
      return { observe: () => undefined, disconnect: () => undefined };
    },
  });
  try {
    controller.observeSentinel({} as HTMLDivElement);
    controller.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.public.toggleFilter({ group: 'categories', value: 'Business' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    intersection?.([{ isIntersecting: true }]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(calls, [
      '/api/sites?platform=web&sort=latest&facets=summary&limit=24',
      '/api/sites?platform=web&sort=latest&facets=summary&filter=categories.Business&limit=24',
      '/api/sites?platform=web&sort=latest&facets=summary&filter=categories.Business&cursor=page-2&limit=24',
    ]);
    assert.deepEqual(navigations, [{
      search: 'platform=web&sort=latest&filter=categories.Business',
      mode: 'push',
    }]);
    assert.deepEqual(
      controller.snapshot().items.map(({ id, versionId }) => `${id}:${versionId}`),
      ['2:3', '2:4'],
    );
    assert.equal(controller.snapshot().totalCount, 3);
  } finally {
    controller.dispose();
    globalThis.fetch = originalFetch;
  }
});

test('hydrates Sites sort and all facet groups across back-forward state without navigation', async () => {
  const originalFetch = globalThis.fetch;
  invalidateSitesPageCache();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify(envelope([{
      ...apiItem,
      siteId: calls.length,
      versionId: calls.length,
    }], null, 1)), { status: 200 });
  }) as typeof fetch;
  const navigations: string[] = [];
  const controller = createDiscoveryController({
    adapter: createSitesDiscoveryAdapter(),
    locationSearch: '?platform=web&sort=latest',
    onNavigate: (search) => navigations.push(search),
  });
  try {
    controller.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.hydrate(
      '?platform=web&sort=popular'
        + '&filter=categories.Finance&filter=sections.Pricing&filter=styles.Minimal',
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.hydrate('?platform=web&sort=latest');
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.ok(calls.length >= 2);
    assert.ok(calls.includes(
      '/api/sites?platform=web&sort=popular&facets=summary'
        + '&filter=categories.Finance&filter=sections.Pricing&filter=styles.Minimal&limit=24',
    ));
    assert.deepEqual(controller.snapshot().state, {
      platform: 'web',
      sort: 'latest',
      query: '',
      filters: [],
    });
    assert.deepEqual(navigations, []);
  } finally {
    controller.dispose();
    globalThis.fetch = originalFetch;
    invalidateSitesPageCache();
  }
});

test('replaces Sites query URL state and issues one debounced query request', async () => {
  const originalFetch = globalThis.fetch;
  invalidateSitesPageCache();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify(envelope()), { status: 200 });
  }) as typeof fetch;
  const navigations: Array<{ search: string; mode: 'push' | 'replace' }> = [];
  const controller = createDiscoveryController({
    adapter: createSitesDiscoveryAdapter(),
    locationSearch: '',
    queryDebounceMs: 0,
    onNavigate: (search, mode) => navigations.push({ search, mode }),
  });
  try {
    controller.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.public.setQuery(' pricing ');
    await new Promise<void>((resolve) => setTimeout(resolve, 5));

    assert.deepEqual(calls, [
      '/api/sites?platform=web&sort=latest&facets=summary&limit=24',
      '/api/sites/search?platform=web&sort=latest&facets=summary&query=pricing&limit=24',
    ]);
    assert.deepEqual(navigations, [{
      search: 'platform=web&sort=latest&query=pricing',
      mode: 'replace',
    }]);
  } finally {
    controller.dispose();
    globalThis.fetch = originalFetch;
    invalidateSitesPageCache();
  }
});
