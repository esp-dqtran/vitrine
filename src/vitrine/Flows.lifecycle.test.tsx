import assert from 'node:assert/strict';
import test from 'node:test';
import { StrictMode, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  useFlowsDiscoveryPageController,
} from './components/FlowsPage.tsx';
import { updateLocation, useLocationKey } from './router.ts';
import type { FlowsDiscoveryControllerState } from './flowsDiscoveryAdapter.ts';
import type {
  DiscoveryController,
  DiscoveryObserverFactory,
} from './useDiscoveryController.ts';
import type { FlowCatalogItem } from './flowCatalogApi.ts';

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

function installDom(initialPath: string) {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    reactAct: (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
  };
  const listeners = new Map<string, Set<() => void>>();
  const document = new FakeDocument();
  const initial = new URL(initialPath, 'https://astryx.test');
  const location = { pathname: initial.pathname, search: initial.search };
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
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => callbacks.delete(id)) as unknown as typeof clearTimeout;
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

const flowItem = (
  title = 'Logging out',
  sourceFlowId = '7230',
): Record<string, unknown> => ({
  category: 'Account Management',
  title,
  preview: {
    appId: 'whatsapp',
    appName: 'WhatsApp',
    appIconUrl: '/icons/whatsapp.png',
    versionId: 17,
    version: 7,
    sourceFlowId,
    screenCount: 1,
    flow: {
      id: `whatsapp:${sourceFlowId}`,
      title,
      category: 'Account Management',
      description: '',
      tags: [],
      steps: [{
        label: title,
        evidence: [{
          imageId: 1,
          imageUrl: '/api/media/1',
          thumbnailUrl: '/api/media/1?thumbnail=1',
          description: null,
        }],
      }],
    },
  },
});

const response = (
  items: Record<string, unknown>[] = [flowItem()],
  nextCursor: string | null = null,
) => new Response(JSON.stringify({
  items,
  nextCursor,
  totalCount: 2,
  facets: [
    { group: 'flowGroups', value: 'Account Management', count: 1 },
    { group: 'flowGroups', value: 'New User Experience', count: 1 },
  ],
}));

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('mounts one StrictMode Flows controller with URL hydration, infinite scroll, history, and popstate', async () => {
  const dom = installDom(
    '/flows?platform=ios&sort=grouped&query=settings'
      + '&filter=flowGroups.Account%20Management',
  );
  const timers = installFakeTimers();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; signal: AbortSignal | null }> = [];
  let intersection:
    | ((entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void)
    | undefined;
  const observerFactory: DiscoveryObserverFactory = (callback) => {
    intersection = callback;
    return { observe: () => undefined, disconnect: () => undefined };
  };
  let controller: DiscoveryController<
    FlowCatalogItem,
    FlowsDiscoveryControllerState['sort'],
    FlowsDiscoveryControllerState
  > | null = null;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, signal: init?.signal ?? null });
    if (url.includes('query=pending')) return new Promise<Response>(() => undefined);
    if (url.includes('cursor=page-2')) {
      return response([
        flowItem(),
        flowItem('Onboarding', 'onboarding'),
      ]);
    }
    return response([flowItem()], requests.length === 1 ? 'page-2' : null);
  }) as typeof fetch;

  function Probe() {
    const locationKey = useLocationKey();
    const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
    controller = useFlowsDiscoveryPageController({
      locationSearch: search,
      onNavigate: (nextSearch, mode) => {
        updateLocation(`/flows${nextSearch ? `?${nextSearch}` : ''}`, {
          replace: mode === 'replace',
        });
      },
      observerFactory,
    });
    useEffect(() => undefined, [controller]);
    return <div ref={controller.sentinelRef} />;
  }

  const root = createRoot(dom.container as never);
  try {
    await act(async () => {
      root.render(<StrictMode><Probe /></StrictMode>);
      await settle();
    });
    assert.deepEqual(requests.map(({ url }) => url), [
      '/api/flows/search?platform=ios&limit=12&facets=summary&query=settings&sort=grouped'
        + '&filter=flowGroups.Account+Management',
    ]);

    await act(async () => {
      intersection?.([{ isIntersecting: true }]);
      await settle();
    });
    assert.equal(
      requests[1]?.url,
      '/api/flows/search?platform=ios&limit=12&facets=summary&query=settings&sort=grouped'
        + '&filter=flowGroups.Account+Management&cursor=page-2',
    );
    assert.deepEqual(
      (controller as DiscoveryController<
        FlowCatalogItem,
        FlowsDiscoveryControllerState['sort'],
        FlowsDiscoveryControllerState
      > | null)?.items.map(({ title }) => title),
      ['Logging out', 'Onboarding'],
    );

    await act(async () => {
      controller?.setQuery('onboarding');
      await Promise.resolve();
    });
    await act(async () => {
      timers.runAll();
      await settle();
    });
    assert.equal(requests.length, 3);
    assert.equal(
      requests[2]?.url,
      '/api/flows/search?platform=ios&limit=12&facets=summary&query=onboarding&sort=grouped'
        + '&filter=flowGroups.Account+Management',
    );
    assert.equal(dom.historyCalls[0]?.mode, 'replace');

    await act(async () => {
      controller?.toggleFilter({
        group: 'flowGroups',
        value: 'New User Experience',
      });
      await settle();
    });
    assert.equal(requests.length, 4);
    assert.match(requests[3]?.url ?? '', /filter=flowGroups.Account\+Management/);
    assert.match(requests[3]?.url ?? '', /filter=flowGroups.New\+User\+Experience/);
    assert.equal(dom.historyCalls[1]?.mode, 'push');

    await act(async () => {
      dom.pop(
        '/flows?platform=android&sort=popular&query=back'
          + '&filter=flowGroups.New%20User%20Experience',
      );
      await settle();
    });
    assert.equal(requests.length, 5);
    assert.equal(
      requests[4]?.url,
      '/api/flows/search?platform=android&limit=12&facets=summary&query=back&sort=grouped'
        + '&filter=flowGroups.New+User+Experience',
    );

    await act(async () => {
      controller?.setQuery('');
      await Promise.resolve();
    });
    await act(async () => {
      timers.runAll();
      await settle();
    });
    assert.equal(requests.length, 6);
    assert.equal(
      requests[5]?.url,
      '/api/flows?platform=android&limit=12&facets=summary&sort=grouped'
        + '&filter=flowGroups.New+User+Experience',
    );
    assert.equal(dom.historyCalls.at(-1)?.mode, 'replace');
    assert.doesNotMatch(dom.historyCalls.at(-1)?.path ?? '', /query=/);

    await act(async () => {
      controller?.setQuery('pending');
      await Promise.resolve();
    });
    await act(async () => {
      timers.runAll();
      await Promise.resolve();
    });
    assert.equal(requests.length, 7);
    assert.equal(requests[6]?.signal?.aborted, false);
    await act(async () => root.unmount());
    assert.equal(requests[6]?.signal?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
    dom.restore();
  }
});

test('unmounting Flows before query debounce prevents a later request', async () => {
  const dom = installDom('/flows');
  const timers = installFakeTimers();
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let controller: DiscoveryController<
    FlowCatalogItem,
    FlowsDiscoveryControllerState['sort'],
    FlowsDiscoveryControllerState
  > | null = null;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    return response();
  }) as typeof fetch;

  function Probe() {
    controller = useFlowsDiscoveryPageController({
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
      controller?.setQuery('too-late');
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
