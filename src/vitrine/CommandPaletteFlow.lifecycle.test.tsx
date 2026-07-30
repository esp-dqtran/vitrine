import assert from 'node:assert/strict';
import test from 'node:test';
import { act, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { FlowCatalogItem, FlowCatalogPage } from './flowCatalogApi.ts';
import {
  useCommandPaletteFlowCatalog,
  type FlowCatalogObserverFactory,
  type FlowCatalogPageLoader,
} from './useCommandPaletteFlowCatalog.ts';

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
  const document = new FakeDocument();
  const window = { document, HTMLElement: FakeNode, HTMLIFrameElement: FakeNode };
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
    restore: () => Object.assign(globalThis, original),
  };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

const item = (
  title: string,
  sourceFlowId: string,
  count = 1,
): FlowCatalogItem => ({
  category: 'Account Management',
  title,
  count,
  preview: {
    appId: 'whatsapp',
    appName: 'WhatsApp',
    appIconUrl: '/icons/whatsapp.png',
    version: 7,
    sourceFlowId,
    screenCount: 1,
    flow: {
      id: `whatsapp:${sourceFlowId}`,
      title,
      category: 'Account Management',
      description: '',
      tags: [],
      steps: [],
    },
  },
});

const page = (
  items: FlowCatalogItem[],
  nextCursor: string | null,
): FlowCatalogPage => ({
  items,
  nextCursor,
  totalCount: items.length,
  facets: [],
});

interface Snapshot {
  items: FlowCatalogItem[];
  loading: boolean;
  cursor: string | null;
  error: string;
}

function Harness({
  query,
  loadPage,
  observerFactory,
  onSnapshot,
  onControl,
}: {
  query: string;
  loadPage: FlowCatalogPageLoader;
  observerFactory: FlowCatalogObserverFactory;
  onSnapshot: (snapshot: Snapshot) => void;
  onControl: (control: {
    cancel: () => void;
    retry: () => void;
  }) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const catalog = useCommandPaletteFlowCatalog({
    enabled: true,
    platform: 'web',
    query,
    rootRef,
    sentinelRef,
    loadPage,
    observerFactory,
    debounceMs: 0,
  });
  useEffect(() => {
    onSnapshot({
      items: catalog.items,
      loading: catalog.loading,
      cursor: catalog.cursor,
      error: catalog.error,
    });
    onControl({ cancel: catalog.cancel, retry: catalog.retry });
  }, [
    catalog.cancel,
    catalog.cursor,
    catalog.error,
    catalog.items,
    catalog.loading,
    catalog.retry,
    onControl,
    onSnapshot,
  ]);
  return <div ref={rootRef}><div ref={sentinelRef} /></div>;
}

test('guards, deduplicates, aborts, and ignores stale Flow cursor requests', async () => {
  const dom = installDom();
  const first = item('Logging out', '7230');
  const second = item('Deleting account', 'delete');
  const replacement = item('Onboarding', 'onboarding');
  const stale = item('Stale result', 'stale');
  const requests: Array<{
    query?: string;
    cursor?: string;
    signal: AbortSignal;
  }> = [];
  let intersection:
    | ((entries: readonly Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void)
    | undefined;
  const pending = new Map<string, (value: FlowCatalogPage) => void>();
  let failedCursorAttempts = 0;
  const loadPage: FlowCatalogPageLoader = async (params, signal) => {
    requests.push({ query: params.query, cursor: params.cursor, signal });
    if (!params.cursor) {
      if (params.query === 'failure') {
        return page([replacement], 'failed-more');
      }
      return params.query === 'onboarding'
        ? page([replacement], 'replacement-more')
        : page([first], 'page-2');
    }
    if (params.cursor === 'failed-more') {
      failedCursorAttempts += 1;
      if (failedCursorAttempts === 1) throw new Error('cursor failed');
    }
    return new Promise<FlowCatalogPage>((resolve) => {
      pending.set(params.cursor ?? '', resolve);
    });
  };
  const observerFactory: FlowCatalogObserverFactory = (callback) => {
    intersection = callback;
    return { observe: () => undefined, disconnect: () => undefined };
  };
  let latest: Snapshot = {
    items: [],
    loading: false,
    cursor: null,
    error: '',
  };
  let control: { cancel: () => void; retry: () => void } | undefined;
  const root = createRoot(dom.container as never);
  const render = (query: string) => (
    <Harness
      query={query}
      loadPage={loadPage}
      observerFactory={observerFactory}
      onSnapshot={(snapshot) => { latest = snapshot; }}
      onControl={(nextControl) => { control = nextControl; }}
    />
  );

  try {
    await act(async () => {
      root.render(render(''));
      await settle();
      await settle();
    });

    assert.equal(latest.cursor, 'page-2');
    assert.ok(intersection);
    await act(async () => {
      intersection?.([{ isIntersecting: true }]);
      intersection?.([{ isIntersecting: true }]);
      await settle();
    });
    assert.equal(requests.filter(({ cursor }) => cursor === 'page-2').length, 1);

    await act(async () => {
      pending.get('page-2')?.(page([first, second], 'page-3'));
      await settle();
    });
    assert.deepEqual(latest.items.map(({ title }) => title), [
      'Logging out',
      'Deleting account',
    ]);
    await act(async () => {
      intersection?.([{ isIntersecting: true }]);
      intersection?.([{ isIntersecting: true }]);
      await settle();
    });
    const staleRequest = requests.find(({ cursor }) => cursor === 'page-3');
    assert.ok(staleRequest);
    assert.equal(
      requests.filter(({ cursor }) => cursor === 'page-3').length,
      1,
    );

    await act(async () => {
      root.render(render('onboarding'));
      await settle();
      await settle();
    });
    assert.equal(staleRequest.signal.aborted, true);
    assert.deepEqual(latest.items.map(({ title }) => title), ['Onboarding']);

    await act(async () => {
      pending.get('page-3')?.(page([stale], null));
      await settle();
    });
    assert.deepEqual(latest.items.map(({ title }) => title), ['Onboarding']);

    const queuedAfterClose = intersection;
    assert.ok(control);
    await act(async () => {
      control?.cancel();
      queuedAfterClose?.([{ isIntersecting: true }]);
      await settle();
    });
    assert.equal(
      requests.filter(({ cursor }) => cursor === 'replacement-more').length,
      0,
    );

    await act(async () => {
      root.render(render('failure'));
      await settle();
      await settle();
    });
    assert.equal(latest.cursor, 'failed-more');
    const failedObserver = intersection;
    await act(async () => {
      failedObserver?.([{ isIntersecting: true }]);
      await settle();
    });
    assert.equal(latest.error, 'cursor failed');
    assert.equal(
      requests.filter(({ cursor }) => cursor === 'failed-more').length,
      1,
    );

    await act(async () => {
      failedObserver?.([{ isIntersecting: true }]);
      await settle();
    });
    assert.equal(
      requests.filter(({ cursor }) => cursor === 'failed-more').length,
      1,
    );

    await act(async () => {
      control?.retry();
      await settle();
      await settle();
    });
    await act(async () => {
      intersection?.([{ isIntersecting: true }]);
      await settle();
    });
    const replacementMore = requests.filter(
      ({ cursor }) => cursor === 'failed-more',
    )[1];
    assert.ok(replacementMore);
    await act(async () => root.unmount());
    assert.equal(replacementMore.signal.aborted, true);
  } finally {
    if (dom.container.childNodes.length) {
      await act(async () => root.unmount());
    }
    dom.restore();
  }
});
