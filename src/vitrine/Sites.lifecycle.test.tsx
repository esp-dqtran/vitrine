import assert from 'node:assert/strict';
import test from 'node:test';
import { StrictMode, act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  useSitesDiscoveryPageController,
} from './components/SitesPage.tsx';
import { updateLocation, useLocationKey } from './router.ts';
import type { SitesDiscoveryControllerState } from './sitesDiscoveryAdapter.ts';
import type { DiscoveryController } from './useDiscoveryController.ts';
import type { SiteSummary } from './types.ts';

class FakeNode {
  readonly nodeType = 1;
  readonly nodeName: string;
  readonly tagName: string;
  readonly style = {};
  readonly childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  textContent = '';
  ownerDocument: FakeDocument;
  constructor(name: string, document: FakeDocument) {
    this.nodeName = name.toUpperCase();
    this.tagName = this.nodeName;
    this.ownerDocument = document;
  }
  appendChild(node: FakeNode) { node.parentNode = this; this.childNodes.push(node); return node; }
  insertBefore(node: FakeNode, before: FakeNode | null) {
    node.parentNode = this;
    const index = before ? this.childNodes.indexOf(before) : -1;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    return node;
  }
  removeChild(node: FakeNode) {
    this.childNodes.splice(this.childNodes.indexOf(node), 1);
    node.parentNode = null;
    return node;
  }
  addEventListener() {}
  removeEventListener() {}
  setAttribute() {}
  removeAttribute() {}
}

class FakeDocument {
  readonly nodeType = 9;
  readonly documentElement = new FakeNode('html', this);
  readonly body = new FakeNode('body', this);
  activeElement: FakeNode | null = null;
  defaultView: unknown;
  createElement(name: string) { return new FakeNode(name, this); }
  createTextNode(text: string) {
    const node = new FakeNode('#text', this);
    node.textContent = text;
    return node;
  }
  addEventListener() {}
  removeEventListener() {}
}

function installDom() {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    reactAct: (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
  };
  const listeners = new Map<string, Set<() => void>>();
  const document = new FakeDocument();
  const location = { pathname: '/sites', search: '' };
  const historyCalls: Array<{ mode: 'push' | 'replace'; path: string }> = [];
  const applyPath = (path: string) => {
    const url = new URL(path, 'https://astryx.test');
    location.pathname = url.pathname;
    location.search = url.search;
  };
  const window = {
    document,
    HTMLElement: FakeNode,
    HTMLIFrameElement: FakeNode,
    location,
    history: {
      pushState(_state: unknown, _title: string, path: string) {
        historyCalls.push({ mode: 'push' as const, path });
        applyPath(path);
      },
      replaceState(_state: unknown, _title: string, path: string) {
        historyCalls.push({ mode: 'replace' as const, path });
        applyPath(path);
      },
    },
    addEventListener(type: string, listener: () => void) {
      const entries = listeners.get(type) ?? new Set();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener());
      return true;
    },
  };
  document.defaultView = window;
  Object.assign(globalThis, {
    document,
    window,
    HTMLElement: FakeNode,
    HTMLIFrameElement: FakeNode,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return {
    container: new FakeNode('div', document),
    historyCalls,
    pop(path: string) {
      applyPath(path);
      window.dispatchEvent(new Event('popstate'));
    },
    restore: () => Object.assign(globalThis, original),
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

const apiItem = {
  siteId: 1,
  versionId: 2,
  name: 'V7',
  slug: 'v-7',
  routeSlug: 'v7',
  sourceUrl: 'https://v7labs.com/',
  categories: ['Business'],
  styles: ['Minimal'],
  popularity: 91,
  label: 'Jul 2026',
  isLatest: true,
  pageCount: 16,
  sectionCount: 46,
  previewUrl: '/api/sites/1/versions/2/media/preview',
  previewMediaKind: 'video',
  previews: [],
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const response = () => new Response(JSON.stringify({
  items: [apiItem],
  nextCursor: null,
  totalCount: 1,
  facets: [{ group: 'categories', value: 'Business', count: 1 }],
}));

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('mounts one StrictMode Sites controller and keeps query, filter, and popstate requests singular', async () => {
  const dom = installDom();
  const timers = installFakeTimers();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; signal: AbortSignal | null }> = [];
  const queryChanges: string[] = [];
  let controller: DiscoveryController<
    SiteSummary,
    SitesDiscoveryControllerState['sort'],
    SitesDiscoveryControllerState
  > | null = null;
  let setExternalQuery: ((query: string) => void) | null = null;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), signal: init?.signal ?? null });
    if (String(input).includes('query=pending')) {
      return new Promise<Response>(() => undefined);
    }
    return response();
  }) as typeof fetch;

  function Probe() {
    const [query, setQuery] = useState('initial');
    setExternalQuery = setQuery;
    const locationKey = useLocationKey();
    const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
    controller = useSitesDiscoveryPageController({
      query,
      onQueryChange: (value) => {
        queryChanges.push(value);
        setQuery(value);
      },
      locationSearch: search,
      onNavigate: (nextSearch, mode) => {
        updateLocation(`/sites${nextSearch ? `?${nextSearch}` : ''}`, {
          replace: mode === 'replace',
        });
      },
    });
    useEffect(() => undefined, [controller]);
    return null;
  }

  const root = createRoot(dom.container as never);
  try {
    await act(async () => {
      root.render(<StrictMode><Probe /></StrictMode>);
      await settle();
    });
    assert.deepEqual(requests.map(({ url }) => url), [
      '/api/sites/search?platform=web&sort=latest&facets=summary&query=initial&limit=24',
    ]);

    await act(async () => {
      setExternalQuery?.('pricing');
      await settle();
    });
    await act(async () => {
      timers.runAll();
      await settle();
    });
    assert.equal(requests.length, 2);
    assert.equal(
      requests[1]?.url,
      '/api/sites/search?platform=web&sort=latest&facets=summary&query=pricing&limit=24',
    );
    assert.deepEqual(dom.historyCalls, [{
      mode: 'replace',
      path: '/sites?platform=web&sort=latest&query=pricing',
    }]);

    await act(async () => {
      controller?.toggleFilter({ group: 'categories', value: 'Business' });
      await settle();
    });
    assert.equal(requests.length, 3);
    assert.equal(
      requests[2]?.url,
      '/api/sites/search?platform=web&sort=latest&facets=summary&query=pricing'
        + '&filter=categories.Business&limit=24',
    );
    assert.equal(dom.historyCalls[1]?.mode, 'push');

    await act(async () => {
      dom.pop(
        '/sites?platform=web&sort=popular&query=back'
          + '&filter=sections.Pricing&filter=styles.Minimal',
      );
      await settle();
    });
    assert.equal(requests.length, 4);
    assert.equal(
      requests[3]?.url,
      '/api/sites/search?platform=web&sort=popular&facets=summary&query=back'
        + '&filter=sections.Pricing&filter=styles.Minimal&limit=24',
    );
    assert.deepEqual(queryChanges, ['back']);

    await act(async () => {
      setExternalQuery?.('pending');
      await settle();
    });
    await act(async () => {
      timers.runAll();
      await Promise.resolve();
    });
    assert.equal(requests.length, 5);
    assert.equal(requests[4]?.signal?.aborted, false);
    await act(async () => root.unmount());
    assert.equal(requests[4]?.signal?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
    dom.restore();
  }
});

test('unmounting Sites before the query debounce prevents a later request', async () => {
  const dom = installDom();
  const timers = installFakeTimers();
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let setExternalQuery: ((query: string) => void) | null = null;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    return response();
  }) as typeof fetch;

  function Probe() {
    const [query, setQuery] = useState('');
    setExternalQuery = setQuery;
    useSitesDiscoveryPageController({
      query,
      onQueryChange: setQuery,
      locationSearch: '',
      onNavigate: () => undefined,
    });
    return null;
  }

  const root = createRoot(dom.container as never);
  try {
    await act(async () => {
      root.render(<Probe />);
      await settle();
    });
    assert.equal(requests.length, 1);
    await act(async () => {
      setExternalQuery?.('too-late');
      await Promise.resolve();
      root.unmount();
    });
    timers.runAll();
    await settle();
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
    dom.restore();
  }
});
