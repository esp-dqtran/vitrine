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
    preview: {
      appId: 'linear',
      appName: 'Linear',
      appIconUrl: '/icons/linear.png',
      versionId: 3,
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
          { label: 'Enter email', evidence: [{ imageId: 1, imageUrl: '/flow/1', thumbnailUrl: '/flow/1', description: 'Enter email' }] },
          { label: 'Submit', evidence: [{ imageId: 2, imageUrl: '/flow/2', thumbnailUrl: '/flow/2', description: 'Submit' }] },
        ],
      },
    },
  },
  {
    category: 'New User Experience',
    title: 'Onboarding',
    preview: {
      appId: 'notion',
      appName: 'Notion',
      appIconUrl: '/icons/notion.png',
      versionId: 2,
      version: 2,
      sourceFlowId: 'onboarding',
      screenCount: 1,
      flow: {
        id: 'notion:2',
        title: 'Onboarding',
        category: 'New User Experience',
        description: '',
        tags: [],
        steps: [{ label: 'Welcome', evidence: [{ imageId: 1, imageUrl: '/flow/1', thumbnailUrl: '/flow/1', description: 'Welcome' }] }],
      },
    },
  },
  {
    category: 'Account Management',
    title: 'Resetting password',
    preview: {
      appId: 'linear',
      appName: 'Linear',
      appIconUrl: null,
      versionId: 3,
      version: 3,
      sourceFlowId: 'resetting-password',
      screenCount: 1,
      flow: {
        id: 'linear:3',
        title: 'Resetting password',
        category: 'Account Management',
        description: '',
        tags: [],
        steps: [{ label: 'Reset', evidence: [{ imageId: 1, imageUrl: '/flow/1', thumbnailUrl: '/flow/1', description: 'Reset' }] }],
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
      sort: 'grouped',
      query: '',
      filters: [],
    },
    items,
    facets: [
      { group: 'flowCategories', value: 'account-settings', count: 12 },
      { group: 'flowTypes', value: 'onboarding/create-account', count: 8 },
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
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.match(html, /data-flows-discovery="true"/);
  assert.match(html, /<h1 class="visually-hidden">Flows<\/h1>/);
  assert.doesNotMatch(html, /reference-discovery-nav/);
  assert.match(html, />Categories</);
  assert.doesNotMatch(html, /Browse by category/);
  assert.match(html, /data-flows-filterbar="true"/);
  assert.match(html, /aria-label="Flow discovery controls"/);
  assert.match(html, /role="radiogroup"[^>]*aria-label="Flow platform"/);
  assert.match(html, /role="radio"[^>]*aria-checked="true"[^>]*aria-label="Web"/);
  assert.match(html, /role="radio"[^>]*aria-label="iOS"/);
  assert.match(html, /role="radio"[^>]*aria-label="Android"/);
  assert.match(html, /Open Categories filters/);
  assert.match(html, /Open Flow Types filters/);
  assert.doesNotMatch(html, /reference-discovery__result-meta/);
  assert.doesNotMatch(html, /23 flows/);
  assert.doesNotMatch(html, />Popular|>Grouped</);
  assert.doesNotMatch(html, /data-reference-discovery-toolbar="true"/);
  assert.match(html, />Authentication</);
  assert.match(html, />Monetization</);
  assert.match(html, /aria-label="Preview Logging in flow screens"/);
  assert.match(html, /<h2>Logging in<\/h2>/);
  assert.match(html, /aria-label="Open Linear app"/);
  assert.match(html, /<img src="\/icons\/linear\.png" alt=""/);
  assert.doesNotMatch(html, /flows-discovery__flow-heading/);
  assert.doesNotMatch(html, /Previewed from/);
  assert.doesNotMatch(html, /observed in/);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /class="flow-gallery" aria-label="Flow catalog"/);
  assert.match(html, /class="flow-gallery__strips"/);
  assert.doesNotMatch(html, /flows-discovery__gallery/);
  assert.doesNotMatch(html, /flows-discovery__flow/);
  assert.match(html, /data-discovery-page-layout="flows"/);
  assert.match(html, /data-discovery-sentinel="flows"/);
  assert.match(html, /data-discovery-signup-reveal="true"/);
  assert.match(html, /data-melius-source-component="FooterEasterEgg"/);
  assert.doesNotMatch(html, /Load more Flows/);
});

test('leaves Flow search to the shared header trigger', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({
        state: {
          platform: 'web',
          sort: 'grouped',
          query: 'reset password',
          filters: [],
        },
      })}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /data-flows-search="true"/);
  assert.doesNotMatch(html, /Search flows by name or group/);
});

test('hides the server total independently of loaded cards', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({
        items: items.slice(0, 1),
        totalCount: 40,
        state: {
          platform: 'web',
        sort: 'grouped',
          query: '',
          filters: [{ group: 'flowCategories', value: 'discovery-navigation' }],
        },
      })}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /reference-discovery__result-meta/);
  assert.doesNotMatch(html, /40 flows/);
  assert.doesNotMatch(html, /Load more Flows/);
});

test('hides the capped Flow result total for public visitors', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ totalCount: 40 })}
      isGuest
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /reference-discovery__result-meta/);
  assert.doesNotMatch(html, /12 flows|40 flows/);
});

test('keeps the controlled 13-category Flow taxonomy independent from response facets', () => {
  const facets = Array.from({ length: 5_880 }, (_, index) => ({
    group: 'flowCategories',
    value: `Flow group ${String(index).padStart(4, '0')}`,
    count: 5_880 - index,
  }));
  const html = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ facets })}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );

  const taxonomy = html.match(/data-reference-component="facet-group"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.equal((taxonomy.match(/data-flow-taxonomy-option="true"/g) ?? []).length, 13);
  assert.match(taxonomy, />Authentication</);
  assert.match(taxonomy, />System, Privacy &amp; Support</);
  assert.match(taxonomy, /aria-label="Content &amp; Detail, 45233 flows"/);
  assert.match(taxonomy, /data-taxonomy-count="4"/);
  assert.doesNotMatch(taxonomy, /Flow group 0000/);
});

test('delegates initial, empty, and load-more error states to the shared layout', () => {
  const loading = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ items: [], totalCount: null, loading: true })}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
    />,
  );
  const empty = renderToStaticMarkup(
    <FlowsPageView
      controller={controller({ items: [], totalCount: 0, hasMore: false })}
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
        sort: 'grouped',
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
