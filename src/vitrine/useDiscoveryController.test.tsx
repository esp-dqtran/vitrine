import assert from 'node:assert/strict';
import test from 'node:test';
import { StrictMode, act, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  DiscoveryAdapter,
  DiscoveryFacet,
  DiscoveryPage,
  DiscoveryState,
} from './discoveryTypes.ts';
import { createDiscoveryController, useDiscoveryController } from './useDiscoveryController.ts';
import { useAppsDiscoveryPageController } from './components/AppsDiscoveryPage.tsx';
import type { AppsFacet } from './appsDiscovery.ts';

type Sort = 'latest' | 'trending';
type Item = { id: string };

interface PendingRequest {
  state: DiscoveryState<Sort>;
  cursor: string | null;
  signal: AbortSignal;
  resolve(page: DiscoveryPage<Item>): void;
  reject(error: Error): void;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function page(items: string[], nextCursor: string | null, totalCount = items.length): DiscoveryPage<Item> {
  return {
    items: items.map((id) => ({ id })),
    nextCursor,
    totalCount,
    facets: [{ group: 'category', value: 'Commerce', count: totalCount }],
  };
}

function settle() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

class FakeObserver {
  target: Element | null = null;
  constructor(private readonly callback: (entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void) {}

  observe(target: Element) {
    this.target = target;
  }

  disconnect() {
    this.target = null;
  }

  intersect(isIntersecting = true) {
    this.callback([{ isIntersecting }]);
  }
}

class FakeDomNode {
  readonly nodeType = 1;
  readonly nodeName: string;
  readonly tagName: string;
  readonly style = {};
  readonly childNodes: FakeDomNode[] = [];
  parentNode: FakeDomNode | null = null;
  textContent = '';
  ownerDocument!: FakeDomDocument;
  constructor(name: string, document: FakeDomDocument) {
    this.nodeName = name.toUpperCase();
    this.tagName = this.nodeName;
    this.ownerDocument = document;
  }
  appendChild(node: FakeDomNode) { node.parentNode = this; this.childNodes.push(node); return node; }
  insertBefore(node: FakeDomNode, before: FakeDomNode | null) {
    node.parentNode = this;
    const index = before ? this.childNodes.indexOf(before) : -1;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    return node;
  }
  removeChild(node: FakeDomNode) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; return node; }
  addEventListener() {}
  removeEventListener() {}
  setAttribute() {}
  removeAttribute() {}
}

class FakeDomDocument {
  readonly nodeType = 9;
  readonly documentElement: FakeDomNode;
  readonly body: FakeDomNode;
  activeElement: FakeDomNode | null = null;
  defaultView: unknown;
  constructor() {
    this.documentElement = new FakeDomNode('html', this);
    this.body = new FakeDomNode('body', this);
  }
  createElement(name: string) { return new FakeDomNode(name, this); }
  createTextNode(text: string) { const node = new FakeDomNode('#text', this); node.textContent = text; return node; }
  addEventListener() {}
  removeEventListener() {}
}

function installFakeDom() {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    reactAct: (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
  };
  const document = new FakeDomDocument();
  const window = {
    document,
    HTMLElement: FakeDomNode,
    HTMLIFrameElement: FakeDomNode,
    addEventListener() {},
    removeEventListener() {},
  };
  document.defaultView = window;
  Object.assign(globalThis, {
    document,
    window,
    HTMLElement: FakeDomNode,
    HTMLIFrameElement: FakeDomNode,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return {
    container: new FakeDomNode('div', document),
    restore() {
      Object.assign(globalThis, original);
    },
  };
}

function installFakeTimers() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const callbacks = new Map<number, () => void>();
  let nextId = 0;
  globalThis.setTimeout = ((handler: TimerHandler) => {
    const id = ++nextId;
    callbacks.set(id, handler as () => void);
    return id as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => callbacks.delete(id)) as typeof clearTimeout;
  return {
    runAll() {
      for (const callback of [...callbacks.values()]) callback();
      callbacks.clear();
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

function fixture(search = '?platform=web&sort=latest', queryDebounceMs?: number) {
  const requests: PendingRequest[] = [];
  const navigations: Array<{ search: string; mode: 'push' | 'replace' }> = [];
  let observer: FakeObserver | null = null;
  let observerFactoryCalls = 0;
  const adapter: DiscoveryAdapter<Item, Sort> = {
    defaults: { platform: 'web', sort: 'latest', query: '', filters: [] },
    parse(input) {
      const params = new URLSearchParams(input);
      return {
        platform: params.get('platform') === 'ios' ? 'ios' : 'web',
        sort: params.get('sort') === 'trending' ? 'trending' : 'latest',
        query: params.get('query') ?? '',
        filters: params.getAll('filter').map((token) => {
          const [group, value] = token.split('.');
          return { group, value };
        }),
      };
    },
    serialize(state) {
      const params = new URLSearchParams();
      params.set('platform', state.platform);
      params.set('sort', state.sort);
      if (state.query) params.set('query', state.query);
      for (const filter of state.filters) params.append('filter', `${filter.group}.${filter.value}`);
      return params.toString();
    },
    request(state, cursor, signal) {
      const pending = deferred<DiscoveryPage<Item>>();
      requests.push({ state, cursor, signal, ...pending });
      return pending.promise;
    },
    itemKey: (item) => item.id,
  };
  const observerFactory = (callback: (entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void) => {
    observerFactoryCalls += 1;
    observer = new FakeObserver(callback);
    return observer;
  };
  const controller = createDiscoveryController({
    adapter,
    locationSearch: search,
    onNavigate: (nextSearch, mode) => navigations.push({ search: nextSearch, mode }),
    ...(queryDebounceMs === undefined ? {} : { queryDebounceMs }),
    observerFactory,
  });
  return {
    controller,
    adapter,
    observerFactory,
    requests,
    navigations,
    observer: () => observer,
    observerFactoryCalls: () => observerFactoryCalls,
  };
}

test('keeps the mounted hook live after StrictMode effect replay', async () => {
  const dom = installFakeDom();
  const setup = fixture();
  const sentinel = {} as HTMLDivElement;
  let exposed: ReturnType<typeof useDiscoveryController<Item, Sort>> | null = null;
  function Probe() {
    const controller = useDiscoveryController({
      adapter: setup.adapter,
      locationSearch: '?platform=web&sort=latest',
      onNavigate: () => undefined,
      observerFactory: setup.observerFactory,
    });
    const [, rerender] = useState(0);
    useEffect(() => {
      controller.sentinelRef.current = sentinel;
      exposed = controller;
      rerender(1);
    }, [controller]);
    return null;
  }
  const root = createRoot(dom.container as never);
  try {
    await act(async () => {
      root.render(<StrictMode><Probe /></StrictMode>);
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.ok(exposed);
    assert.equal(setup.requests.length, 1);
    assert.equal(setup.requests.at(-1)?.signal.aborted, false);
    assert.equal(setup.observer()?.target, sentinel);
  } finally {
    await act(async () => root.unmount());
    dom.restore();
  }
});

test('does not start a hook-owned request when unmounted before the deferred start', async () => {
  const dom = installFakeDom();
  const setup = fixture();
  function Probe() {
    useDiscoveryController({
      adapter: setup.adapter,
      locationSearch: '?platform=web&sort=latest',
      onNavigate: () => undefined,
      observerFactory: setup.observerFactory,
    });
    return null;
  }
  const root = createRoot(dom.container as never);
  try {
    act(() => {
      root.render(<Probe />);
      root.unmount();
    });
    await Promise.resolve();
    assert.equal(setup.requests.length, 0);
  } finally {
    dom.restore();
  }
});

test('loads the parsed initial page with a null cursor', async () => {
  const { controller, requests } = fixture('?platform=ios&sort=trending&query=wallet');
  controller.start();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].cursor, null);
  assert.deepEqual(requests[0].state, {
    platform: 'ios', sort: 'trending', query: 'wallet', filters: [],
  });
  requests[0].resolve(page(['one'], 'next', 4));
  await settle();

  assert.deepEqual(controller.snapshot().items, [{ id: 'one' }]);
  assert.equal(controller.snapshot().hasMore, true);
  assert.equal(controller.snapshot().totalCount, 4);
  assert.deepEqual(controller.snapshot().facets, [{ group: 'category', value: 'Commerce', count: 4 }]);
});

test('deduplicates duplicate keys in a first-page response', async () => {
  const { controller, requests } = fixture();
  controller.start();
  requests[0].resolve(page(['one', 'one', 'two'], null));
  await settle();

  assert.deepEqual(controller.snapshot().items, [{ id: 'one' }, { id: 'two' }]);
});

test('hydrates back-forward URL changes without navigating back', async () => {
  const { controller, requests, navigations } = fixture();
  controller.start();
  requests[0].resolve(page(['web'], null));
  await settle();

  controller.hydrate('?platform=ios&sort=trending&query=back');
  assert.equal(navigations.length, 0);
  assert.deepEqual(controller.snapshot().state, {
    platform: 'ios', sort: 'trending', query: 'back', filters: [],
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].cursor, null);
});

test('hydrates a debounced query when its matching first page has not started', async () => {
  const { controller, requests, navigations } = fixture(undefined, 10);
  controller.start();
  requests[0].resolve(page(['stale'], null));
  await settle();

  controller.public.setQuery('checkout');
  controller.hydrate('?platform=web&sort=latest&query=checkout');

  assert.equal(requests.length, 2);
  assert.equal(requests[1].cursor, null);
  assert.equal(requests[1].state.query, 'checkout');
  assert.deepEqual(navigations, []);
  requests[1].resolve(page(['fresh'], null));
  await settle();
  assert.deepEqual(controller.snapshot().items, [{ id: 'fresh' }]);
});

test('hydrates back to completed canonical state during a pending query without requesting again', async () => {
  const { controller, requests, navigations } = fixture(undefined, 10);
  controller.start();
  requests[0].resolve(page(['old'], 'old-cursor', 7));
  await settle();

  controller.public.setQuery('new');
  assert.equal(controller.snapshot().hasMore, false);
  controller.hydrate('?platform=web&sort=latest');

  assert.equal(requests.length, 1);
  assert.equal(controller.snapshot().state.query, '');
  assert.deepEqual(controller.snapshot().items, [{ id: 'old' }]);
  assert.equal(controller.snapshot().hasMore, true);
  assert.equal(controller.snapshot().totalCount, 7);
  assert.deepEqual(navigations, []);
});

test('aborts a stale first page before restoring a cached canonical page', async () => {
  const { controller, requests } = fixture();
  controller.start();
  requests[0].resolve(page(['a'], null));
  await settle();

  controller.public.setPlatform('ios');
  assert.equal(requests.length, 2);
  controller.hydrate('?platform=web&sort=latest');
  assert.equal(requests[1].signal.aborted, true);
  requests[1].resolve(page(['b'], null));
  await settle();

  assert.equal(controller.snapshot().state.platform, 'web');
  assert.deepEqual(controller.snapshot().items, [{ id: 'a' }]);
});

test('updates query immediately then replaces the URL and requests after the debounce', async () => {
  const { controller, requests, navigations } = fixture(undefined, 10);
  controller.start();
  requests[0].resolve(page(['one'], null));
  await settle();

  const timers = installFakeTimers();
  try {
    controller.public.setQuery('checkout');
    assert.equal(controller.snapshot().state.query, 'checkout');
    assert.equal(navigations.length, 0);
    timers.runAll();
  } finally {
    timers.restore();
  }

  assert.deepEqual(navigations, [{
    search: 'platform=web&sort=latest&query=checkout', mode: 'replace',
  }]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].state.query, 'checkout');
});

test('uses an exact 180ms query debounce by default', () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let delay: number | undefined;
  let callback: (() => void) | undefined;
  const timer = {} as ReturnType<typeof setTimeout>;
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    delay = timeout;
    callback = handler as () => void;
    return timer;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;

  try {
    const { controller, requests, navigations } = fixture();
    controller.start();
    controller.public.setQuery('checkout');
    assert.equal(delay, 180);
    callback?.();
    assert.deepEqual(navigations, [{
      search: 'platform=web&sort=latest&query=checkout', mode: 'replace',
    }]);
    assert.equal(requests.length, 2);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('pushes explicit platform, sort, exact filter toggles, and group clears', () => {
  const { controller, requests, navigations } = fixture();
  controller.start();
  controller.public.setPlatform('ios');
  controller.public.setSort('trending');
  controller.public.toggleFilter({ group: 'category', value: 'Commerce' });
  controller.public.toggleFilter({ group: 'category', value: 'Commerce' });
  controller.public.toggleFilter({ group: 'screen', value: 'Checkout' });
  controller.public.clearFilterGroup('screen');

  assert.equal(requests.length, 7);
  assert.deepEqual(navigations.map(({ mode }) => mode), ['push', 'push', 'push', 'push', 'push', 'push']);
  assert.deepEqual(controller.snapshot().state.filters, []);
});

test('aborts and ignores a stale first page when discovery state changes', async () => {
  const { controller, requests } = fixture();
  controller.start();
  controller.public.setPlatform('ios');
  assert.equal(requests[0].signal.aborted, true);

  requests[0].resolve(page(['stale'], null));
  requests[1].resolve(page(['fresh'], null));
  await settle();
  assert.deepEqual(controller.snapshot().items, [{ id: 'fresh' }]);
});

test('suppresses an equivalent first-page request while it is already in flight', () => {
  const { controller, requests } = fixture();
  controller.start();
  controller.hydrate('?platform=web&sort=latest');
  controller.public.retry();

  assert.equal(requests.length, 1);
});

test('appends and deduplicates the next page through its single sentinel observer', async () => {
  const { controller, requests, observer } = fixture();
  controller.start();
  requests[0].resolve(page(['one', 'two'], 'cursor-2', 3));
  await settle();

  controller.observeSentinel({} as HTMLDivElement);
  observer()?.intersect();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].cursor, 'cursor-2');
  requests[1].resolve(page(['three', 'three', 'four'], null, 12));
  await settle();

  assert.deepEqual(controller.snapshot().items, [{ id: 'one' }, { id: 'two' }, { id: 'three' }, { id: 'four' }]);
  assert.equal(controller.snapshot().totalCount, 12);
  assert.deepEqual(controller.snapshot().facets, [{ group: 'category', value: 'Commerce', count: 12 }]);
});

test('retries the correct initial page and resets prior results on explicit changes', async () => {
  const { controller, requests } = fixture();
  controller.start();
  requests[0].reject(new Error('offline'));
  await settle();
  assert.equal(controller.snapshot().error, 'offline');

  controller.public.retry();
  assert.equal(requests.length, 2);
  requests[1].resolve(page(['one'], 'cursor-2'));
  await settle();
  controller.public.setSort('trending');

  assert.deepEqual(controller.snapshot().items, []);
  assert.equal(controller.snapshot().hasMore, false);
  assert.equal(requests.length, 3);
});

test('keeps prior items on a load-more failure and retries that cursor', async () => {
  const { controller, requests, observer } = fixture();
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2', 2));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);
  observer()?.intersect();
  requests[1].reject(new Error('more offline'));
  await settle();

  assert.deepEqual(controller.snapshot().items, [{ id: 'one' }]);
  assert.equal(controller.snapshot().error, null);
  assert.equal(controller.snapshot().loadMoreError, 'more offline');
  controller.public.retryLoadMore();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].cursor, 'cursor-2');
});

test('does not duplicate a next-page request while the sentinel remains visible', async () => {
  const { controller, requests, observer } = fixture();
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2', 2));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);
  observer()?.intersect();
  observer()?.intersect();

  assert.equal(requests.length, 2);
  assert.equal(requests[1].cursor, 'cursor-2');
});

test('invalidates an old cursor immediately while a query is debouncing', async () => {
  const { controller, requests, observer } = fixture(undefined, 10);
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2'));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);

  controller.public.setQuery('checkout');
  observer()?.intersect();

  assert.equal(controller.snapshot().hasMore, false);
  assert.deepEqual(controller.snapshot().items, []);
  assert.deepEqual(controller.snapshot().facets, []);
  assert.equal(controller.snapshot().totalCount, null);
  assert.equal(controller.snapshot().error, null);
  assert.equal(requests.length, 1);
  controller.dispose();
});

test('re-arms successive cursors without overfetching until a fresh observer callback', async () => {
  const { controller, requests, observer } = fixture();
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2'));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);
  observer()?.intersect();
  assert.equal(requests[1].cursor, 'cursor-2');

  requests[1].resolve(page(['two'], 'cursor-3'));
  await settle();
  assert.equal(requests.length, 2);
  observer()?.intersect(false);
  assert.equal(requests.length, 2);
  observer()?.intersect(true);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].cursor, 'cursor-3');
  requests[2].resolve(page(['three'], null));
  await settle();
  assert.deepEqual(controller.snapshot().items, [{ id: 'one' }, { id: 'two' }, { id: 'three' }]);
});

test('ignores a queued observer callback after disposal', async () => {
  const { controller, requests, observer } = fixture();
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2'));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);
  const retainedObserver = observer();
  controller.dispose();
  retainedObserver?.intersect();

  assert.equal(requests.length, 1);
});

test('makes every public interaction a no-op after disposal', async () => {
  const { controller, requests, navigations, observer, observerFactoryCalls } = fixture(undefined, 10);
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2'));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);
  const before = controller.snapshot();
  const observerCount = observerFactoryCalls();
  controller.dispose();

  controller.public.setPlatform('ios');
  controller.public.setSort('trending');
  controller.public.setQuery('ignored');
  controller.public.toggleFilter({ group: 'category', value: 'Commerce' });
  controller.public.clearFilterGroup('category');
  controller.public.retry();
  controller.public.retryLoadMore();
  controller.hydrate('?platform=ios&sort=trending&query=ignored');
  controller.observeSentinel({} as HTMLDivElement);
  observer()?.intersect(true);

  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(navigations, []);
  assert.equal(requests.length, 1);
  assert.equal(observerFactoryCalls(), observerCount);
});

test('creates one observer while its sentinel target changes', () => {
  const { controller, observer, observerFactoryCalls } = fixture();
  const firstTarget = {} as HTMLDivElement;
  const secondTarget = {} as HTMLDivElement;
  controller.observeSentinel(firstTarget);
  controller.observeSentinel(firstTarget);
  controller.observeSentinel(secondTarget);

  assert.equal(observerFactoryCalls(), 1);
  assert.equal(observer()?.target, secondTarget);
  controller.dispose();
});

test('cleanup aborts work, clears a pending query, and disconnects its observer', () => {
  const { controller, requests, navigations, observer } = fixture(undefined, 10);
  controller.start();
  controller.observeSentinel({} as HTMLDivElement);
  const timers = installFakeTimers();
  try {
    controller.public.setQuery('checkout');
    controller.dispose();
    timers.runAll();
  } finally {
    timers.restore();
  }

  assert.equal(requests[0].signal.aborted, true);
  assert.equal(observer()?.target, null);
  assert.equal(requests.length, 1);
  assert.deepEqual(navigations, []);
});

test('cleanup aborts an active initial request', () => {
  const { controller, requests } = fixture();
  controller.start();
  controller.dispose();

  assert.equal(requests[0].signal.aborted, true);
});

test('cleanup aborts an active load-more request', async () => {
  const { controller, requests, observer } = fixture();
  controller.start();
  requests[0].resolve(page(['one'], 'cursor-2'));
  await settle();
  controller.observeSentinel({} as HTMLDivElement);
  observer()?.intersect();
  controller.dispose();

  assert.equal(requests[1].signal.aborted, true);
});

test('preserves a typed state subtype through hydration and granular state spreads', async () => {
  interface AppsState extends DiscoveryState<Sort> {
    contentType: 'apps' | 'screens';
  }
  const requests: Array<{ state: AppsState; cursor: string | null }> = [];
  const navigations: Array<{ search: string; mode: 'push' | 'replace' }> = [];
  const adapter: DiscoveryAdapter<Item, Sort, AppsState> = {
    defaults: {
      platform: 'web',
      sort: 'latest',
      query: '',
      filters: [],
      contentType: 'screens',
    },
    parse(search) {
      const params = new URLSearchParams(search);
      return {
        ...this.defaults,
        platform: params.get('platform') === 'ios' ? 'ios' : 'web',
        contentType: params.get('content_type') === 'apps' ? 'apps' : 'screens',
      };
    },
    serialize(state) {
      return `platform=${state.platform}&content_type=${state.contentType}&sort=${state.sort}`;
    },
    request(state, cursor) {
      requests.push({ state, cursor });
      return Promise.resolve(page([], null));
    },
    itemKey: (item) => item.id,
  };
  const controller = createDiscoveryController<Item, Sort, AppsState>({
    adapter,
    locationSearch: '?platform=web&content_type=screens',
    onNavigate: (search, mode) => navigations.push({ search, mode }),
  });
  controller.start();
  await settle();

  controller.public.setPlatform('ios');
  await settle();
  assert.equal(requests.at(-1)?.state.contentType, 'screens');
  controller.public.toggleFilter({ group: 'screens', value: 'Checkout' });
  await settle();
  assert.equal(requests.at(-1)?.state.contentType, 'screens');
  controller.public.setQuery('wallet');
  assert.equal(controller.snapshot().state.contentType, 'screens');
  controller.hydrate('?platform=web&content_type=apps');
  await settle();
  assert.equal(controller.snapshot().state.contentType, 'apps');
  assert.equal(requests.at(-1)?.state.contentType, 'apps');
  assert.ok(navigations.every(({ search }) => search.includes('content_type=screens')));
  controller.dispose();
});

test('sets a typed state atomically with one push navigation and one request', async () => {
  interface AppsState extends DiscoveryState<Sort> {
    contentType: 'apps' | 'screens';
  }
  const requests: AppsState[] = [];
  const navigations: Array<{ search: string; mode: 'push' | 'replace' }> = [];
  const defaults: AppsState = {
    platform: 'web',
    sort: 'latest',
    query: '',
    filters: [],
    contentType: 'apps',
  };
  const adapter: DiscoveryAdapter<Item, Sort, AppsState> = {
    defaults,
    parse: () => defaults,
    serialize: (state) =>
      `platform=${state.platform}&content_type=${state.contentType}&sort=${state.sort}`,
    request(state) {
      requests.push(state);
      return Promise.resolve(page([], null));
    },
    itemKey: (item) => item.id,
  };
  const controller = createDiscoveryController<Item, Sort, AppsState>({
    adapter,
    locationSearch: '',
    onNavigate: (search, mode) => navigations.push({ search, mode }),
  });
  controller.start();
  await settle();
  const next: AppsState = {
    ...controller.snapshot().state,
    contentType: 'screens',
    filters: [{ group: 'screens', value: 'Checkout' }],
  };
  controller.public.setState(next);
  await settle();

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], next);
  assert.deepEqual(navigations, [{
    search: 'platform=web&content_type=screens&sort=latest',
    mode: 'push',
  }]);
  controller.dispose();
});

test('keeps the Apps adapter stable when a single facet synchronization path echoes into its wrapper', async () => {
  const dom = installFakeDom();
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let facetCallbacks = 0;
  let exposed: ReturnType<typeof useAppsDiscoveryPageController> | null = null;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(JSON.stringify({
      items: [{
        id: `wrapper-${requests.length}`,
        app: 'Wrapper App',
        categories: [{ id: 1, name: 'Business', slug: 'business' }],
        accent: '#123456',
        totalScreens: 1,
        platforms: ['web'],
        analyzedScreens: 1,
        lastCapturedAt: '2026-07-20T00:00:00.000Z',
        iconUrl: null,
        previewScreens: [{
          id: 1,
          type: 'Dashboard',
          productArea: 'Workspace',
          theme: 'dark',
          visibleStates: [],
          platform: 'web',
          description: null,
          url: '/wrapper.png',
        }],
      }],
      nextCursor: null,
      totalCount: 1,
      facets: [{ group: 'screens', value: 'Dashboard', count: 1 }],
    }), { status: 200 });
  }) as typeof fetch;

  function Wrapper() {
    const [facet, setFacet] = useState<AppsFacet | null>(null);
    const [search, setSearch] = useState(
      '?platform=web&content_type=screens&sort=trending'
      + '&query=wrapper-loop&filter=screens.Dashboard',
    );
    const synchronizeFacet = useCallback((next: typeof facet) => {
      facetCallbacks += 1;
      setFacet(next);
    }, []);
    exposed = useAppsDiscoveryPageController({
      isAdmin: false,
      locationSearch: search,
      initialPlatform: 'ios',
      initialFacet: facet,
      initialQuery: '',
      onFacetChange: synchronizeFacet,
      onNavigate: (next) => setSearch(`?${next}`),
    });
    return null;
  }

  const root = createRoot(dom.container as never);
  try {
    await act(async () => {
      root.render(<Wrapper />);
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    const mounted = exposed;
    assert.ok(mounted);
    assert.equal(requests.length, 1);
    assert.equal(facetCallbacks, 1);
    assert.equal(mounted.state.platform, 'web');

    await act(async () => {
      mounted.setState({
        ...mounted.state,
        filters: [
          ...mounted.state.filters,
          { group: 'screens', value: 'Settings' },
        ],
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    assert.equal(requests.length, 2);
    assert.equal(facetCallbacks, 2);
    assert.match(requests[1] ?? '', /filter=screens.Dashboard/);
    assert.match(requests[1] ?? '', /filter=screens.Settings/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.restore();
  }
});
