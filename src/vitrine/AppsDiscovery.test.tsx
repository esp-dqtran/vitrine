import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRef, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  appsDiscoveryFacetOptions,
  AppsDiscoveryPageView,
} from './components/AppsDiscoveryPage.tsx';
import { ApplicationHeader } from './components/ApplicationHeader.tsx';
import type { App } from './types.ts';
import {
  ALL_APPS_SCREENS,
  filterAndSortApps,
  filterAppsDiscoveryScreens,
} from './appsDiscovery.ts';
import type { AppsDiscoveryControllerState } from './appsDiscoveryAdapter.ts';
import type { DiscoveryController } from './useDiscoveryController.ts';

const makeApp = (overrides: Partial<App> = {}): App => ({
  id: 'base',
  app: 'Base',
  categories: [{ id: 1, name: 'Business', slug: 'business' }],
  accent: '#777777',
  totalScreens: 1,
  platforms: ['web'],
  analyzedScreens: 1,
  lastCapturedAt: '2026-07-20T00:00:00.000Z',
  iconUrl: null,
  description: 'Business workspace',
  previewVideoUrl: null,
  screens: [{
    id: 1,
    type: 'Dashboard',
    productArea: 'Workspace',
    theme: 'dark',
    visibleStates: ['Setting Up'],
    platform: 'web',
    description: 'Navigation Menu and Card',
    url: '/base.png',
    componentNames: ['Navigation Menu', 'Card'],
    layoutPatterns: ['Dashboard'],
    capturedAt: '2026-07-20T00:00:00.000Z',
    stateContext: 'Setting Up',
    confidence: 0.8,
    matchedFacets: [
      { group: 'screens', value: 'Dashboard' },
      { group: 'elements', value: 'Navigation Menu' },
      { group: 'elements', value: 'Card' },
    ],
  }],
  ...overrides,
});

function pageController(overrides: Partial<DiscoveryController<
  App,
  AppsDiscoveryControllerState['sort'],
  AppsDiscoveryControllerState
>> = {}): DiscoveryController<
  App,
  AppsDiscoveryControllerState['sort'],
  AppsDiscoveryControllerState
> {
  return {
    state: {
      platform: 'web',
      contentType: 'apps',
      sort: 'latest',
      query: '',
      filters: [],
    },
    items: [makeApp()],
    facets: [
      { group: 'categories', value: 'Business', count: 1, section: 'Categories' },
      { group: 'screens', value: 'Dashboard', count: 1, section: 'Workspace' },
    ],
    totalCount: 1,
    loading: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
    hasMore: false,
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

function renderAppsPage(
  controller = pageController(),
  overrides: Partial<ComponentProps<typeof AppsDiscoveryPageView>> = {},
) {
  return renderToStaticMarkup(
    <AppsDiscoveryPageView
      controller={controller}
      isAdmin={false}
      onOpenSearch={() => undefined}
      searchMode="legacy"
      onOpenApp={() => undefined}
      {...overrides}
    />,
  );
}

test('renders the full Apps taxonomy alongside the compact filter bar', () => {
  const html = renderAppsPage();
  assert.match(html, /data-apps-filterbar="true"/);
  assert.match(html, /aria-label="Open Categories filters"/);
  assert.match(html, /aria-label="Open Screens filters"/);
  assert.doesNotMatch(html, /aria-label="Open UI Elements filters"/);
  assert.doesNotMatch(html, /aria-label="Open Flows filters"/);
  assert.doesNotMatch(html, /aria-label="More filters"/);
  assert.match(html, /aria-label="App discovery filters"/);
  assert.match(html, />Categories</);
  assert.match(html, />AI</);
  assert.match(html, />Screens</);
  assert.doesNotMatch(html, />UI Elements</);
  assert.doesNotMatch(html, />Navigation Menu</);
  assert.doesNotMatch(html, />Flows</);
});

test('limits the Storybook chrome review without attaching infinite pagination', () => {
  const html = renderAppsPage(
    pageController({
      items: [
        makeApp({ id: 'aboard', app: 'Aboard' }),
        makeApp({ id: 'linear', app: 'Linear' }),
      ],
      totalCount: 452,
    }),
    { reviewItemLimit: 1 },
  );

  assert.match(html, /Aboard/);
  assert.doesNotMatch(html, /Linear/);
  assert.doesNotMatch(html, /data-discovery-sentinel="apps"/);
});

test('caps the visible App result total for public visitors', () => {
  const html = renderAppsPage(
    pageController({ totalCount: 40 }),
    { isGuest: true },
  );

  assert.match(html, /Showing<\/small> <strong>6 apps/);
  assert.doesNotMatch(html, /40 apps/);
});

test('filters Apps across Mobbin taxonomy fields and platform', () => {
  const apps = [
    makeApp({ id: 'web', app: 'Web App' }),
    makeApp({
      id: 'ios',
      app: 'iOS App',
      categories: [
        { id: 2, name: 'Health & Fitness', slug: 'health-fitness' },
        { id: 3, name: 'Wellness', slug: 'wellness' },
      ],
      platforms: ['ios'],
      screens: [{ ...makeApp().screens[0]!, id: 2, platform: 'ios', type: 'Signup' }],
    }),
  ];

  assert.deepEqual(
    filterAndSortApps(apps, {
      query: '',
      facet: { group: 'screens', value: 'Signup' },
      platform: 'ios',
      sort: 'latest',
    }).map((app) => app.id),
    ['ios'],
  );
  assert.deepEqual(
    filterAndSortApps(apps, {
      query: '',
      facet: { group: 'elements', value: 'Navigation Menu' },
      platform: 'web',
      sort: 'latest',
    }).map((app) => app.id),
    ['web'],
  );
  assert.deepEqual(
    filterAndSortApps(apps, {
      query: 'wellness',
      facet: null,
      platform: 'ios',
      sort: 'latest',
    }).map((app) => app.id),
    ['ios'],
  );
  assert.deepEqual(
    filterAndSortApps(apps, {
      query: '',
      facet: { group: 'categories', value: 'Wellness' },
      platform: 'ios',
      sort: 'latest',
    }).map((app) => app.id),
    ['ios'],
  );
});

test('finds screen results from visible UI text and state context', () => {
  const app = makeApp({
    screens: [{
      ...makeApp().screens[0]!,
      type: 'Unclassified',
      productArea: 'Unclassified',
      visibleText: ['Invite a teammate'],
      stateContext: 'Empty state',
      visibleStates: [],
    }],
  });

  for (const query of ['invite', 'empty state']) {
    assert.deepEqual(
      filterAndSortApps([app], { query, platform: 'web', sort: 'latest' }).map(({ id }) => id),
      ['base'],
    );
    assert.deepEqual(
      filterAppsDiscoveryScreens([app], { query, facets: [], platform: 'web', sort: 'latest' })
        .map(({ screen }) => screen.id),
      [1],
    );
  }
});

test('shows only Apps that contain the active platform', () => {
  const apps = [
    makeApp({ id: 'web', app: 'Web App', platforms: ['web'] }),
    makeApp({ id: 'ios', app: 'iOS App', platforms: ['ios'] }),
    makeApp({ id: 'android', app: 'Android App', platforms: ['android'] }),
  ];

  for (const platform of ['web', 'ios', 'android'] as const) {
    assert.deepEqual(
      filterAndSortApps(apps, {
        query: '',
        facet: null,
        platform,
        sort: 'latest',
      }).map((app) => app.id),
      [platform],
    );
  }
});

test('seeds Preview and Wallpaper as screen-level filters, not app categories', () => {
  assert.ok(ALL_APPS_SCREENS.includes('Preview'));
  assert.ok(ALL_APPS_SCREENS.includes('Wallpaper'));
});

test('maps the Mobbin My Account & Profile filter to Astryx account settings screens', () => {
  const accountApp = makeApp({
    screens: [{
      ...makeApp().screens[0]!,
      type: 'Settings & Preferences',
      productArea: 'Account',
    }],
  });

  assert.deepEqual(
    filterAndSortApps([accountApp], {
      query: '',
      facet: { group: 'screens', value: 'My Account & Profile' },
      platform: 'web',
      sort: 'trending',
    }).map(({ id }) => id),
    ['base'],
  );
});

test('combines multiple values with OR inside a filter group and AND across groups', () => {
  const profileApp = makeApp({
    id: 'shopping-profile',
    categories: [{ id: 10, name: 'Shopping', slug: 'shopping' }],
    screens: [{
      ...makeApp().screens[0]!,
      id: 10,
      type: 'My Account & Profile',
      productArea: 'Account',
    }],
  });
  const settingsApp = makeApp({
    id: 'ai-settings',
    categories: [{ id: 11, name: 'AI', slug: 'ai' }],
    screens: [{
      ...makeApp().screens[0]!,
      id: 11,
      type: 'Settings & Preferences',
      productArea: 'Account',
    }],
  });
  const wrongCategory = makeApp({
    id: 'finance-profile',
    categories: [{ id: 12, name: 'Finance', slug: 'finance' }],
    screens: [{
      ...makeApp().screens[0]!,
      id: 12,
      type: 'My Account & Profile',
    }],
  });
  const wrongScreen = makeApp({
    id: 'shopping-dashboard',
    categories: [{ id: 13, name: 'Shopping', slug: 'shopping' }],
  });
  const apps = [profileApp, settingsApp, wrongCategory, wrongScreen];
  const facets = [
    { group: 'categories' as const, value: 'Shopping' },
    { group: 'categories' as const, value: 'AI' },
    { group: 'screens' as const, value: 'My Account & Profile' },
    { group: 'screens' as const, value: 'Settings & Preferences' },
  ];

  assert.deepEqual(
    filterAndSortApps(apps, {
      query: '',
      facets,
      platform: 'web',
      sort: 'latest',
    }).map(({ id }) => id),
    ['shopping-profile', 'ai-settings'],
  );
  assert.deepEqual(
    filterAppsDiscoveryScreens(apps, {
      query: '',
      facets,
      platform: 'web',
      sort: 'latest',
    }).map(({ app }) => app.id).sort(),
    ['ai-settings', 'shopping-profile'],
  );
});

test('accepts a Flow-search platform handoff as the selected App platform', () => {
  const html = renderAppsPage(pageController({
    state: {
      platform: 'ios',
      contentType: 'flows',
      sort: 'trending',
      query: '',
      filters: [{ group: 'flows', value: 'Logging in' }],
    },
    items: [makeApp({ platforms: ['ios'] })],
  }), { isAdmin: true });

  assert.match(html, /aria-label="App platform: iOS"/);
});

test('shows an active Category as a removable filter-bar pill', () => {
  const html = renderAppsPage(pageController({
    state: {
      platform: 'web',
      contentType: 'apps',
      sort: 'trending',
      query: '',
      filters: [{ group: 'categories', value: 'AI' }],
    },
  }), { activeFilterCount: 3 });

  assert.match(html, /AI/);
  assert.match(html, /aria-label="Clear Categories filter"/);
  assert.match(html, /data-apps-filterbar="true"/);
  assert.doesNotMatch(html, /reference-discovery-nav/);
});

test('preserves server order for Latest and orders Most popular by coverage', () => {
  const apps = [
    makeApp({ id: 'older', lastCapturedAt: '2026-07-01T00:00:00.000Z', totalScreens: 8 }),
    makeApp({ id: 'newer', lastCapturedAt: '2026-07-24T00:00:00.000Z', totalScreens: 2 }),
  ];
  const options = { query: '', facet: null, platform: 'web' as const };

  assert.deepEqual(
    filterAndSortApps(apps, { ...options, sort: 'latest' }).map(({ id }) => id),
    ['older', 'newer'],
  );
  assert.equal(filterAndSortApps(apps, { ...options, sort: 'popular' })[0]?.id, 'older');
});

test('renders the shared full-width discovery navigation for Apps', () => {
  const html = renderToStaticMarkup(
    <ApplicationHeader
      active="apps"
      className="apps-top-nav"
      search={<button>Search on Web...</button>}
    />,
  );

  assert.match(html, /class="[^"]*reference-discovery-nav[^"]*apps-top-nav[^"]*"/);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-label="Vitrines Apps"/);
  assert.doesNotMatch(html, /<strong>Vitrine<\/strong>/);
  assert.match(html, /Search on Web/);
  assert.doesNotMatch(html, /Import App/);
});

test('keeps the Apps search compact on desktop and in the mobile header', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const discoveryCss = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.reference-discovery-nav\.apps-top-nav \.apps-top-nav__search\s*\{[^}]*width:\s*min\(280px,\s*100%\);[^}]*justify-self:\s*center/,
  );
  assert.match(
    css,
    /\.apps-top-nav__search > div > button:first-child\s*\{[^}]*height:\s*40px\s*!important/,
  );
  assert.match(
    discoveryCss,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-discovery-nav\.apps-top-nav\s*\{[^}]*grid-template-rows:\s*58px 38px/,
  );
  assert.match(
    discoveryCss,
    /\.reference-discovery-nav\.apps-top-nav \.apps-top-nav__search\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;[^}]*width:\s*min\(190px,\s*100%\)/,
  );
});

test('renders the Mobbin-style Apps filter bar, grid, and media-first card', () => {
  const app = makeApp({
    id: 'linear-web',
    app: 'Linear',
    description: 'Purpose-built tool for planning and building products',
    iconUrl: '/linear.svg',
    screens: [
      makeApp().screens[0]!,
      { ...makeApp().screens[0]!, id: 2, url: '/linear-2.png' },
    ],
  });
  const html = renderAppsPage(pageController({ items: [app] }), { isAdmin: true });

  assert.match(html, /data-apps-discovery="true"/);
  assert.match(html, /class="[^"]*reference-discovery[^"]*reference-discovery--apps[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__content[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__taxonomy[^"]*reference-discovery__taxonomy--apps[^"]*"/);
  assert.match(html, /data-apps-filterbar="true"/);
  assert.doesNotMatch(html, /reference-discovery-nav/);
  assert.doesNotMatch(html, /Import App/);
  assert.match(html, /Categories/);
  assert.match(html, /Screens/);
  assert.doesNotMatch(html, /UI Elements/);
  assert.doesNotMatch(html, /Flows/);
  assert.match(html, /data-facet-preview="categories"/);
  assert.doesNotMatch(html, /data-facet-preview="screens"/);
  assert.doesNotMatch(html, /data-facet-preview="elements"/);
  assert.doesNotMatch(html, /data-facet-preview="flows"/);
  assert.match(html, /class="apps-discovery__hover-preview"/);
  assert.equal((html.match(/data-preview-frame=/g) ?? []).length, 3);
  assert.match(html, /aria-label="App platform: Web"/);
  const platformMarkup = html.slice(
    html.indexOf('aria-label="App platform"'),
    html.indexOf('aria-label="Open Categories filters"'),
  );
  assert.doesNotMatch(platformMarkup, /role="radiogroup"/);
  assert.doesNotMatch(html, /aria-label="Sort:/);
  assert.doesNotMatch(html, /Popular/);
  assert.match(html, /1 app/);
  assert.doesNotMatch(html, /Most popular/);
  assert.match(html, /data-apps-discovery-grid="true"/);
  assert.match(html, /class="[^"]*reference-discovery__grid[^"]*"/);
  assert.match(html, /data-app-discovery-card="true"/);
  assert.doesNotMatch(html, /apps-discovery__count/);
  assert.match(html, /Purpose-built tool/);
  assert.match(html, /<a[^>]+href="\/apps\/linear-web"[^>]+class="discovery-card__link app-discovery-card__link"/);
});

test('renders the approved shared skeleton while the initial App page loads', () => {
  const html = renderAppsPage(pageController({
    items: [],
    totalCount: null,
    loading: true,
  }), { isAdmin: true });

  assert.match(html, /discovery-page-layout__skeleton-grid/);
  assert.match(html, /aria-label="Loading apps"/);
  assert.equal((html.match(/data-app-card-skeleton="true"/g) ?? []).length, 3);
});

test('keeps App cards stable and shows compact progress while loading another page', () => {
  const html = renderAppsPage(pageController({
    totalCount: 2,
    hasMore: true,
    loadingMore: true,
  }), { isAdmin: true });

  assert.match(html, /data-app-discovery-card="true"/);
  assert.match(html, /discovery-page-layout__loading-more/);
  assert.match(html, /Loading more apps/);
  assert.doesNotMatch(html, /data-app-card-skeleton="true"/);
});

test('shows the server App total once and preserves screen content mode semantics', () => {
  const appsMode = renderAppsPage(pageController({
    totalCount: 12,
    items: [makeApp()],
  }));
  assert.equal((appsMode.match(/12 apps/g) ?? []).length, 1);
  assert.doesNotMatch(appsMode, /apps-filterbar__count/);

  const screenMode = renderAppsPage(pageController({
    state: {
      platform: 'web',
      contentType: 'screens',
      sort: 'trending',
      query: '',
      filters: [{ group: 'screens', value: 'Dashboard' }],
    },
    totalCount: 12,
    items: [makeApp()],
  }));
  assert.match(screenMode, /data-apps-discovery-screen-grid="true"/);
  assert.match(screenMode, /data-apps-discovery-screen-card="true"/);
  assert.match(screenMode, /1 screen/);
  assert.doesNotMatch(screenMode, /12 apps/);
});

test('keeps every server-matched App visible for flow-only results', () => {
  const flowOnly = renderAppsPage(pageController({
    state: {
      platform: 'web',
      contentType: 'flows',
      sort: 'trending',
      query: '',
      filters: [{ group: 'flows', value: 'Checkout' }],
    },
    totalCount: 2,
    items: [
      makeApp({ id: 'first', app: 'First' }),
      makeApp({ id: 'second', app: 'Second' }),
    ],
  }));

  assert.match(flowOnly, /data-apps-discovery-grid="true"/);
  assert.equal((flowOnly.match(/data-app-discovery-card="true"/g) ?? []).length, 2);
  assert.doesNotMatch(flowOnly, /data-apps-discovery-screen-grid="true"/);
  assert.match(flowOnly, /2 apps/);
  assert.doesNotMatch(flowOnly, /0 flows/);
});

test('preserves app navigation affordance, admin status, and beforeGrid content', () => {
  const html = renderAppsPage(pageController({
    items: [makeApp({ analyzedScreens: 0, totalScreens: 2 })],
  }), {
    isAdmin: true,
    beforeGrid: <aside data-before-grid="true">Import progress</aside>,
  });

  assert.match(html, /data-before-grid="true"/);
  assert.match(html, /<a[^>]+href="\/apps\/base"[^>]+class="discovery-card__link app-discovery-card__link"/);
  assert.doesNotMatch(html, />In progress</);
  assert.doesNotMatch(html, /0\/2 analyzed/);
  assert.match(html, /<span class="discovery-card__badge">New<\/span>/);
});

test('uses controller facets and has no page-owned catalog fan-out or pagination observer', async () => {
  const options = appsDiscoveryFacetOptions([{
      group: 'categories',
      value: 'Server-only category',
      count: 14,
      section: 'Server Categories',
    }], []);
  assert.deepEqual(
    options.categories.find(({ value }) => value === 'Server-only category'),
    {
      value: 'Server-only category',
      section: 'Server Categories',
      count: 14,
      previewUrl: undefined,
      previewLabel: 'Server-only category',
    },
  );

  const source = await readFile(
    new URL('./components/AppsDiscoveryPage.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /useDiscoveryController/);
  assert.doesNotMatch(source, /useCatalogFacetApps/);
  assert.doesNotMatch(source, /facetSentinelRef/);
  assert.doesNotMatch(source, /new IntersectionObserver/);
  assert.doesNotMatch(source, /filterAndSortApps/);
  assert.doesNotMatch(source, /\/api\/design-systems\//);
});

test('composes Apps through the shared reference discovery shell', async () => {
  const source = await readFile(
    new URL('./components/AppsDiscoveryPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /import \{ DiscoveryPageLayout \} from '\.\/DiscoveryPageLayout\.tsx';/);
  assert.match(source, /<DiscoveryPageLayout[\s\S]*kind="apps"/);
});

test('defines the Apps-led shared discovery design contract', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const legacyCss = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /--reference-font-family:\s*var\(--font-family-body\)/);
  assert.match(css, /--reference-nav-height:\s*72px/);
  assert.match(css, /--reference-content-padding:\s*32px/);
  assert.match(css, /--reference-facet-size:\s*24px/);
  assert.match(css, /--reference-card-radius:\s*24px/);
  assert.match(css, /\.reference-discovery-nav\s*\{[^}]*height:\s*var\(--reference-nav-height\)/);
  assert.match(css, /\.reference-discovery-nav\s*\{[^}]*background:\s*var\(--reference-chrome-bg,\s*var\(--color-background-body\)\)/);
  assert.match(css, /\.reference-discovery-nav__types button\s*\{[^}]*background:\s*transparent\s*!important/);
  assert.match(css, /\.reference-discovery-nav__types button\[aria-selected="true"\]\s*\{/);
  assert.match(css, /\.reference-discovery-nav__search\s+\.reference-search-trigger\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.astryx-input-text\s*\{[^}]*background:\s*var\(--reference-chrome-surface-raised\)\s*!important/);
  assert.match(css, /\.reference-search-trigger__shortcut\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.reference-discovery-toolbar\s*\{[^}]*min-height:\s*var\(--reference-toolbar-height\)/);
  assert.match(css, /\.reference-discovery__facet h2\s*\{[^}]*font-family:\s*inherit\s*!important/);
  assert.match(css, /\.reference-discovery__facet button\s*\{[^}]*transition:[^}]*transform/);
  assert.match(css, /\.reference-discovery__facet button:hover,[\s\S]*\.reference-discovery__facet button:focus-visible\s*\{[^}]*transform:\s*translateX\(4px\)/);
  assert.match(css, /\.discovery-card\s*\{[^}]*border-radius:\s*var\(--reference-card-radius\)/);
  assert.match(css, /\.reference-discovery__state\s*\{[^}]*min-height:\s*360px/);
  assert.match(legacyCss, /\.apps-top-nav\s*\{[^}]*background:\s*var\(--color-background-body\);[^}]*backdrop-filter:\s*none;/s);
});

test('styles Apps as the three-column Mobbin results layout with a mobile fallback', async () => {
  const [css, discoveryCss] = await Promise.all([
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);
  const cardRule = css.match(/\.discovery-card\s*\{[^}]+\}/)?.[0] ?? '';
  const mediaRule = css.match(/\.discovery-card__media\s*\{[^}]+\}/)?.[0] ?? '';

  assert.match(discoveryCss, /\.reference-discovery__taxonomy--apps\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(discoveryCss, /\.reference-discovery__taxonomy--apps\s*\{[^}]*display:\s*none/);
  assert.match(discoveryCss, /\.apps-discovery__grid,[\s\S]*\.apps-discovery__screen-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(discoveryCss, /\.apps-discovery-screen-card__media\s*\{[^}]*position:\s*relative/);
  assert.match(discoveryCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1080px\)[\s\S]*\.apps-discovery__grid,[\s\S]*\.apps-discovery__screen-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mediaRule, /aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(cardRule, /border-radius:\s*24px/);
  assert.doesNotMatch(css, /\.apps-discovery__count\s*\{/);
  assert.match(discoveryCss, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery__grid,[\s\S]*\.apps-discovery__screen-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

test('renders App media directly through the shared discovery frame', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.discovery-card\s*\{[\s\S]*border:\s*1px solid var\(--color-border\)[\s\S]*border-radius:\s*24px[\s\S]*background:\s*var\(--color-background-surface\)/);
  assert.match(css, /\.discovery-card__media\s*\{[\s\S]*width:\s*min\(calc\(100% - 32px\),\s*384px\)[\s\S]*margin:\s*16px auto 0/);
  assert.match(css, /\.app-discovery-card__media\s*\{[\s\S]*background:\s*transparent/);
  // Portrait follows the rendered image, not the app's platform: an iOS app
  // showing a crawled website is a desktop page and keeps the standard frame.
  assert.match(css, /\.app-discovery-card\[data-preview-shape="phone"\] \.app-discovery-card__media[\s\S]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.doesNotMatch(css, /data-preview-platform=['"](?:ios|android)['"]\] \.app-discovery-card__media/);
  assert.match(css, /\.app-discovery-card__phone-preview\s*\{[\s\S]*aspect-ratio:\s*6\s*\/\s*13[\s\S]*overflow:\s*hidden[\s\S]*border-radius:\s*12\.22%\s*\/\s*5\.65%/);
  assert.match(css, /\.discovery-card:hover \.discovery-card__media,[\s\S]*\.discovery-card:focus-within \.discovery-card__media\s*\{[\s\S]*transform:\s*scale\(1\.012\)/);
  assert.doesNotMatch(css, /\.app-discovery-card__preview/);
  assert.doesNotMatch(css, /\.app-discovery-card__overlay/);
});

test('shares animated discovery ordering styles without toolbar borders', async () => {
  const [css, discoveryCss] = await Promise.all([
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);
  const toolbarRules = [css, discoveryCss].map((stylesheet) => (
    stylesheet.match(/\.reference-discovery-toolbar\s*\{[^}]+\}/)?.[0] ?? ''
  ));

  toolbarRules.forEach((toolbarRule) => {
    assert.doesNotMatch(toolbarRule, /border-top/);
    assert.doesNotMatch(toolbarRule, /border-bottom/);
  });
  assert.match(css, /\.reference-discovery-toolbar__sort button\s*\{[\s\S]*color:\s*var\(--color-text-secondary\)\s*!important;[\s\S]*transition:\s*color/);
  assert.match(css, /\.reference-discovery-toolbar__sort button:hover,[\s\S]*\.reference-discovery-toolbar__sort button:focus-visible,[\s\S]*\.reference-discovery-toolbar__sort button\[aria-selected=["']true["']\]\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*color:\s*var\(--color-text-primary\)\s*!important/);
  assert.match(css, /\.reference-discovery-toolbar__sort button::after\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*scaleX\([\d.]+\);[\s\S]*transition:/);
  assert.match(css, /\.reference-discovery-toolbar__sort button\[aria-selected=["']true["']\]::after\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleX\(1\)/);
});

test('animates the Apps platform pill across Web, iOS, and Android', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-platform-switcher::before\s*\{[\s\S]*width:\s*var\(--apps-platform-indicator-width\);[\s\S]*transform:\s*translateX\(var\(--apps-platform-indicator-shift\)\);[\s\S]*transition:\s*transform/);
  assert.match(css, /\.apps-platform-switcher button\s*\{[\s\S]*width:\s*96px\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*transition:\s*color/);
  assert.match(css, /\.apps-platform-switcher button\[aria-checked=["']true["']\]\s*\{[\s\S]*color:\s*var\(--color-background-body\)\s*!important/);
});

test('renders the Apps platform as a single-select filter using the shared dropdown shell', async () => {
  const [source, discoveryCss] = await Promise.all([
    readFile(new URL('./components/AppsFilterBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /<AstryxDropdown[\s\S]*type: 'platform'/);
  assert.match(source, /<DiscoveryPlatformFilterOptions/);
  assert.match(
    discoveryCss,
    /\.apps-filterbar__filter--platform\s*\{[\s\S]*min-width:\s*104px;[\s\S]*background:\s*transparent;/,
  );
  assert.match(source, /triggerVariant="primary"/);
  assert.match(
    discoveryCss,
    /\.apps-filterbar__search\s*\{[\s\S]*min-height:\s*var\(--vitrine-form-input-height\);/,
  );
  assert.match(source, /startIcon=\{<Icon icon="search" size="sm" \/>\}/);
  assert.match(source, /hasClear/);
});

test('restores the animated Apps taxonomy hover preview without eager requests', async () => {
  const [pageSource, motionSource, css] = await Promise.all([
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useCategoryHoverPreview.ts', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(pageSource, /useCategoryHoverPreview\(\)/);
  assert.match(pageSource, /readyAppFacetPreviews\.get/);
  assert.match(pageSource, /onPointerEnter=/);
  assert.match(pageSource, /onPointerMove=/);
  assert.match(pageSource, /onPointerLeave=/);
  assert.match(pageSource, /void prefetchAppFacetPreview\(/);
  assert.doesNotMatch(pageSource, /prefetchVisibleAppFacetPreviews/);
  assert.match(motionSource, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(motionSource, /gsap\.quickTo/);
  assert.match(motionSource, /matchMedia\.revert\(\)/);
  assert.match(
    css,
    /\.apps-discovery__hover-preview\s*\{[\s\S]*position:\s*fixed;[\s\S]*pointer-events:\s*none;[\s\S]*visibility:\s*hidden;/,
  );
});
