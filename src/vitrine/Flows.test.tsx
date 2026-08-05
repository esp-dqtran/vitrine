import assert from 'node:assert/strict';
import test from 'node:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowsPageView } from './components/FlowsPage.tsx';
import type { FlowsDiscoveryControllerState } from './flowsDiscoveryAdapter.ts';
import type { DiscoveryController } from './useDiscoveryController.ts';

const items = [
  {
    category: 'Account Management',
    title: 'Logging in',
    count: 12,
    preview: {
      appId: 'linear',
      appName: 'Linear',
      appIconUrl: '/icons/linear.png',
      version: 3,
      sourceFlowId: 'logging-in',
      screenCount: 2,
      flow: {
        id: 'linear:1',
        title: 'Logging in',
        category: 'Account Management',
        description: '',
        tags: [],
        steps: [
          { label: 'Enter email', evidence: [{ imageId: 1, imageUrl: '/flow/1', description: 'Enter email' }] },
          { label: 'Submit', evidence: [{ imageId: 2, imageUrl: '/flow/2', description: 'Submit' }] },
        ],
      },
    },
  },
  {
    category: 'New User Experience',
    title: 'Onboarding',
    count: 8,
    preview: {
      appId: 'notion',
      appName: 'Notion',
      appIconUrl: '/icons/notion.png',
      version: 2,
      sourceFlowId: 'onboarding',
      screenCount: 1,
      flow: {
        id: 'notion:2',
        title: 'Onboarding',
        category: 'New User Experience',
        description: '',
        tags: [],
        steps: [{ label: 'Welcome', evidence: [{ imageId: 1, imageUrl: '/flow/1', description: 'Welcome' }] }],
      },
    },
  },
  {
    category: 'Account Management',
    title: 'Resetting password',
    count: 5,
    preview: {
      appId: 'linear',
      appName: 'Linear',
      appIconUrl: null,
      version: 3,
      sourceFlowId: 'resetting-password',
      screenCount: 1,
      flow: {
        id: 'linear:3',
        title: 'Resetting password',
        category: 'Account Management',
        description: '',
        tags: [],
        steps: [{ label: 'Reset', evidence: [{ imageId: 1, imageUrl: '/flow/1', description: 'Reset' }] }],
      },
    },
  },
];

function controller(
  overrides: Partial<DiscoveryController<
    (typeof items)[number],
    FlowsDiscoveryControllerState['sort'],
    FlowsDiscoveryControllerState
  >> = {},
): DiscoveryController<
  (typeof items)[number],
  FlowsDiscoveryControllerState['sort'],
  FlowsDiscoveryControllerState
> {
  return {
    state: {
      platform: 'web',
      sort: 'popular',
      query: '',
      filters: [],
    },
    items,
    facets: [
      { group: 'flowGroups', value: 'Account Management', count: 12 },
      { group: 'flowGroups', value: 'New User Experience', count: 8 },
    ],
    totalCount: 23,
    loading: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
    hasMore: true,
    sentinelRef: createRef<HTMLDivElement>(),
    setState: () => undefined,
    setPlatform: () => undefined,
    setSort: () => undefined,
    setQuery: () => undefined,
    toggleFilter: () => undefined,
    clearFilterGroup: () => undefined,
    retry: () => undefined,
    retryLoadMore: () => undefined,
    ...overrides,
  };
}

test('renders a first-class searchable Flow catalog beside Apps and Sites', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller()}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.match(html, /data-flows-discovery="true"/);
  assert.doesNotMatch(html, /reference-discovery-nav/);
  assert.match(html, /aria-label="Flow discovery filters"/);
  assert.match(html, /Flow groups/);
  assert.match(html, /data-flows-filterbar="true"/);
  assert.match(html, /aria-label="Flow discovery controls"/);
  assert.match(html, /aria-label="Flow platform: Web"/);
  assert.doesNotMatch(html, /role="radiogroup"[^>]*aria-label="Flow platform"/);
  assert.match(html, /Open Flow groups filters/);
  assert.match(html, /Showing<\/small> <strong>23 flows/);
  assert.equal((html.match(/23 flows/g) ?? []).length, 1);
  assert.match(html, />Popular</);
  assert.doesNotMatch(html, /data-reference-discovery-toolbar="true"/);
  assert.match(html, />Settings</);
  assert.match(html, />Home</);
  assert.match(html, /aria-label="Preview Logging in from Account Management flow screens"/);
  assert.match(
    html,
    /<h2>Logging in <span class="flow-strip-card__title-connector">from<\/span> Account Management<\/h2>/,
  );
  assert.match(html, /aria-label="Open Linear app"/);
  assert.match(html, /<img src="\/icons\/linear\.png" alt=""/);
  assert.doesNotMatch(html, /flows-discovery__flow-heading/);
  assert.doesNotMatch(html, /Previewed from/);
  assert.match(html, /observed in 12 apps/);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /class="flow-gallery" aria-label="Flow catalog"/);
  assert.match(html, /class="flow-gallery__strips"/);
  assert.doesNotMatch(html, /flows-discovery__gallery/);
  assert.doesNotMatch(html, /flows-discovery__flow/);
  assert.match(html, /data-discovery-page-layout="flows"/);
  assert.match(html, /data-discovery-sentinel="flows"/);
  assert.doesNotMatch(html, /Load more Flows/);
});

test('shows the server total independently of loaded cards', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({
        items: items.slice(0, 1),
        totalCount: 40,
        state: {
          platform: 'web',
          sort: 'popular',
          query: '',
          filters: [{ group: 'flowGroups', value: 'Home' }],
        },
      })}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.match(html, /40 flows/);
  assert.doesNotMatch(html, /Load more Flows/);
});

test('keeps the top Flow taxonomy a fixed 5-item list regardless of API facets', () => {
  const facets = Array.from({ length: 5_880 }, (_, index) => ({
    group: 'flowGroups',
    value: `Flow group ${String(index).padStart(4, '0')}`,
    count: 5_880 - index,
  }));
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ facets })}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  const taxonomy = html.match(/data-reference-component="facet-group"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.equal((taxonomy.match(/data-flow-taxonomy-option="true"/g) ?? []).length, 5);
  assert.match(taxonomy, />Settings</);
  assert.match(taxonomy, />Logging in</);
  assert.doesNotMatch(taxonomy, /Flow group 0000/);
});

test('delegates initial, empty, and load-more error states to the shared layout', () => {
  const loading = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ items: [], totalCount: null, loading: true })}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );
  const empty = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ items: [], totalCount: 0, hasMore: false })}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );
  const loadMoreError = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ loadMoreError: 'Timed out' })}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.match(loading, /aria-label="Loading flows"/);
  assert.match(empty, /No flows found/);
  assert.match(loadMoreError, /Could not load more flows: Timed out/);
  assert.match(loadMoreError, /data-flow-strip-card="true"/);
});

test('keeps the canonical Flow query in route state while the shared header is app-owned', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({
        state: {
          platform: 'web',
          sort: 'popular',
          query: 'settings',
          filters: [],
        },
      })}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /reference-search-trigger__category/);
  assert.doesNotMatch(html, /reference-discovery-nav/);
});
