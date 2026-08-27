import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRef, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  appsDiscoveryFacetOptions,
  appsPlatformTransitionDirection,
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
  createdAt: new Date().toISOString(),
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

test('renders the editorial Apps hero alongside the compact filter bar', () => {
  const html = renderAppsPage();
  assert.match(html, /data-apps-filterbar="true"/);
  assert.match(html, /aria-label="Open Categories filters"/);
  assert.match(html, /aria-label="Open Screens filters"/);
  assert.doesNotMatch(html, /aria-label="Open UI Elements filters"/);
  assert.doesNotMatch(html, /aria-label="Open Flows filters"/);
  assert.doesNotMatch(html, /aria-label="More filters"/);
  assert.match(html, /aria-label="Vitrines app inspiration"/);
  assert.match(html, /data-apps-discovery-hero="true"/);
  assert.match(html, /The details behind/);
  assert.match(html, /the world’s best APPS\./);
  assert.match(html, /Explore the screens and patterns/);
  assert.match(html, />Explore apps</);
  assert.match(html, /aria-label="Featured app icons"/);
  assert.doesNotMatch(html, /products indexed/);
  assert.match(html, />Categories</);
  assert.match(html, />Screens</);
  assert.doesNotMatch(html, /data-taxonomy-count=/);
  assert.doesNotMatch(html, />UI Elements</);
  assert.doesNotMatch(html, />Navigation Menu</);
  assert.doesNotMatch(html, />Flows</);
  assert.match(html, /data-discovery-signup-reveal="true"/);
  assert.match(html, /data-melius-source-component="FooterEasterEgg"/);
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

test('keeps the featured App icon proof for public visitors without a duplicate result meta row', () => {
  const html = renderAppsPage(
    pageController({ totalCount: 40 }),
    { isGuest: true },
  );

  assert.match(html, /Featured app icons/);
  assert.doesNotMatch(html, /products indexed/);
  assert.doesNotMatch(html, /reference-discovery__result-meta/);
  assert.doesNotMatch(html, /40 apps/);
  assert.doesNotMatch(html, /data-guest-catalog-limit/);
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

test('maps platform travel to the shortest circular switcher direction', () => {
  assert.equal(appsPlatformTransitionDirection('web', 'ios'), 'right');
  assert.equal(appsPlatformTransitionDirection('ios', 'android'), 'right');
  assert.equal(appsPlatformTransitionDirection('android', 'web'), 'right');
  assert.equal(appsPlatformTransitionDirection('ios', 'web'), 'left');
  assert.equal(appsPlatformTransitionDirection('android', 'ios'), 'left');
  assert.equal(appsPlatformTransitionDirection('web', 'android'), 'left');
  assert.equal(appsPlatformTransitionDirection('ios', 'ios'), 'neutral');
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

  assert.match(html, /role="radio"[^>]*aria-checked="true"[^>]*aria-label="iOS"/);
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
  assert.match(html, /data-reference-active="apps"/);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-label="Vitrines Apps"/);
  assert.match(html, /data-reference-mobile-switcher="true"/);
  assert.match(html, /aria-label="Switch reference type: Apps"/);
  assert.doesNotMatch(html, /<strong>Vitrine<\/strong>/);
  assert.match(html, /Search on Web/);
  assert.doesNotMatch(html, /Import App/);
});

test('links the shared Colors navigation identity to the plural canonical route', () => {
  const html = renderToStaticMarkup(
    <ApplicationHeader
      active="color"
      className="apps-top-nav"
      search={<button>Search Colors…</button>}
    />,
  );

  assert.match(html, /href="\/colors"/);
  assert.match(html, /aria-label="Vitrines Colors"/);
});

test('keeps the Apps search compact on desktop and in the mobile header', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const discoveryCss = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const responsiveCss = await readFile(new URL('./productResponsive.css', import.meta.url), 'utf8');

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
    /\.reference-discovery-nav\s*\{[^}]*border-bottom:\s*0;/,
  );
  assert.match(
    discoveryCss,
    /\[data-sticky-chrome\] \.reference-discovery-nav\.apps-top-nav\s*\{[^}]*border-bottom:\s*0;/,
  );
  assert.match(
    responsiveCss,
    /@media \(min-width:\s*721px\) and \(max-width:\s*1100px\)[\s\S]*grid-template-columns:\s*minmax\(360px,\s*1fr\)\s*minmax\(220px,\s*294px\)\s*minmax\(72px,\s*1fr\)/,
  );
  assert.match(
    responsiveCss,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-discovery-nav\.apps-top-nav\s*\{[^}]*grid-template-columns:\s*28px minmax\(120px,\s*1fr\) minmax\(44px,\s*72px\) 44px/,
  );
  assert.match(
    responsiveCss,
    /@media \(min-width:\s*721px\) and \(max-width:\s*900px\)[\s\S]*\.reference-discovery-nav\.apps-top-nav\s*\{[^}]*grid-template-columns:\s*32px minmax\(220px,\s*1fr\) minmax\(44px,\s*72px\) 44px/,
  );
  assert.match(
    responsiveCss,
    /\.reference-discovery-nav\.apps-top-nav \.apps-top-nav__search\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;[^}]*width:\s*100%/,
  );
  assert.match(responsiveCss, /\.apps-top-nav \.reference-discovery-nav__types\s*\{[^}]*display:\s*none/);
  assert.match(responsiveCss, /\.apps-top-nav \.reference-discovery-nav__mobile-switcher\s*\{[^}]*grid-column:\s*4/);
  assert.match(discoveryCss, /\.reference-discovery-nav__mobile-switcher\s*\{[^}]*display:\s*none/);
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
  assert.doesNotMatch(html, /data-facet-preview="categories"/);
  assert.doesNotMatch(html, /data-facet-preview="screens"/);
  assert.doesNotMatch(html, /data-facet-preview="elements"/);
  assert.doesNotMatch(html, /data-facet-preview="flows"/);
  assert.match(html, /data-apps-discovery-hero="true"/);
  assert.doesNotMatch(html, /apps-discovery__hover-preview/);
  assert.match(html, /role="radiogroup" aria-label="App platform"/);
  const platformMarkup = html.slice(
    html.indexOf('aria-label="App platform"'),
    html.indexOf('aria-label="Open Categories filters"'),
  );
  assert.match(platformMarkup, /role="radiogroup"/);
  assert.match(platformMarkup, /role="radio"[^>]*aria-checked="true"[^>]*aria-label="Web"/);
  assert.doesNotMatch(html, /aria-label="Sort:/);
  assert.doesNotMatch(html, /Popular/);
  assert.match(html, /Featured app icons/);
  assert.doesNotMatch(html, /products indexed/);
  assert.doesNotMatch(html, /reference-discovery__result-meta/);
  assert.doesNotMatch(html, /Most popular/);
  assert.match(html, /data-apps-discovery-grid="true"/);
  assert.match(html, /class="[^"]*reference-discovery__grid[^"]*"/);
  assert.match(html, /data-app-discovery-card="true"/);
  assert.doesNotMatch(html, /apps-discovery__count/);
  assert.match(html, /Purpose-built tool/);
  assert.match(html, /<a[^>]+href="\/apps\/linear-web"[^>]+class="discovery-card__link app-discovery-card__link"/);
});

test('uses quiet progress instead of card skeletons while the initial App page loads', () => {
  const html = renderAppsPage(pageController({
    items: [],
    totalCount: null,
    loading: true,
  }), { isAdmin: true });

  assert.match(html, /data-discovery-initial-loading="apps"/);
  assert.match(html, /aria-label="Loading apps"/);
  assert.doesNotMatch(html, /data-app-card-skeleton="true"/);
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

test('keeps the fixed hero icon proof independent from server totals and preserves screen content mode semantics', () => {
  const appsMode = renderAppsPage(pageController({
    totalCount: 12,
    items: [makeApp()],
  }));
  assert.match(appsMode, /Featured app icons/);
  assert.doesNotMatch(appsMode, /products indexed/);
  assert.doesNotMatch(appsMode, /reference-discovery__result-meta/);
  assert.match(appsMode, /data-apps-results-mode="apps"/);
  assert.match(appsMode, /data-apps-results-transition-direction="neutral"/);
  assert.match(appsMode, /apps-discovery__results-transition/);
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
  assert.match(screenMode, /data-apps-results-mode="screens"/);
  assert.doesNotMatch(screenMode, /data-discovery-result-count="screen"/);
  assert.match(screenMode, /data-apps-discovery-screen-card="true"/);
  assert.doesNotMatch(screenMode, /reference-discovery__result-meta/);
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
  assert.doesNotMatch(flowOnly, /reference-discovery__result-meta/);
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
  assert.match(html, /<span class="discovery-card__badge app-discovery-card__status">New<\/span>/);
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
  assert.match(css, /--reference-nav-height:\s*56px/);
  assert.match(css, /--reference-content-padding:\s*32px/);
  assert.match(css, /--reference-facet-size:\s*24px/);
  assert.match(css, /--reference-card-radius:\s*24px/);
  assert.match(css, /\.reference-discovery-nav\s*\{[^}]*height:\s*var\(--reference-nav-height\)/);
  assert.match(css, /\.reference-discovery-nav\s*\{[^}]*background:\s*color-mix\([^}]*--reference-chrome-bg[^}]*92%/);
  assert.match(css, /\.reference-discovery-nav\s*\{[^}]*backdrop-filter:\s*blur\(18px\)/);
  assert.match(css, /\.reference-discovery-nav__types button\s*\{[^}]*background:\s*transparent\s*!important/);
  assert.match(css, /\.reference-discovery-nav__types button\[aria-selected="true"\]\s*\{/);
  assert.match(css, /\.reference-discovery-nav__search\s+\.reference-search-trigger\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.astryx-input-text\s*\{[^}]*background:\s*var\(--reference-chrome-surface-raised\)\s*!important/);
  assert.match(css, /\.reference-search-trigger__shortcut\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.reference-discovery-nav\.apps-top-nav \.apps-top-nav__search \.reference-search-trigger__button::before\s*\{[^}]*background:\s*linear-gradient\([^}]*background-position:\s*120% center;[^}]*animation:\s*apps-search-ambient-sweep 8s ease-in-out infinite/);
  assert.match(css, /\.reference-discovery-nav\[data-reference-active='flows'\] \.apps-top-nav__search \.reference-search-trigger\s*\{[^}]*--reference-search-trigger-hover-ring:\s*rgb\(255 255 255 \/ 24%\)/);
  assert.match(css, /\.reference-discovery-nav\[data-reference-active='flows'\] \.apps-top-nav__search \.reference-search-trigger__button::before\s*\{[^}]*content:\s*none/);
  assert.match(css, /@keyframes apps-search-ambient-sweep[\s\S]*background-position:\s*120% center[\s\S]*background-position:\s*-120% center/);
  assert.match(css, /\.reference-discovery-nav\.apps-top-nav \.apps-top-nav__search \.reference-search-trigger__button:hover,[\s\S]*:focus-visible\s*\{[^}]*transform:\s*translateY\(-1px\)/);
  assert.match(css, /\.reference-search-trigger__button:hover::before,[\s\S]*:focus-visible::before\s*\{[^}]*background-position:\s*-120% center;[^}]*animation:\s*none/);
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

  assert.match(discoveryCss, /\.reference-discovery__taxonomy--apps\s*\{[^}]*--reference-taxonomy-top:\s*0;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(discoveryCss, /\.reference-discovery__taxonomy--apps\s*\{[^}]*display:\s*none/);
  assert.match(discoveryCss, /--reference-discovery-hero-height:\s*clamp\(430px,[^;]*560px\);/);
  assert.match(discoveryCss, /\.apps-discovery-hero,\s*\.sites-discovery-hero\s*\{[^}]*min-height:\s*var\(--reference-discovery-hero-height\)/);
  assert.match(discoveryCss, /\.apps-discovery-hero\s*\{[^}]*place-items:\s*center/);
  assert.match(discoveryCss, /\.apps-discovery-hero__content\s*\{[^}]*min-width:\s*0;[^}]*box-sizing:\s*border-box/);
  assert.match(discoveryCss, /\.apps-discovery-hero h1\s*\{[^}]*width:\s*min\(100%,\s*560px\);[^}]*font-family:\s*'Instrument Serif'[^}]*font-size:\s*clamp\(48px,\s*6vw,\s*76px\)/);
  assert.match(discoveryCss, /\.apps-discovery-hero__headline\s*\{[^}]*width:\s*100%;[^}]*flex-direction:\s*column;[^}]*align-items:\s*center/);
  assert.match(discoveryCss, /\.apps-discovery-hero__headline-line--rotating\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*100%;[^}]*flex-wrap:\s*nowrap;[^}]*white-space:\s*nowrap/);
  assert.match(discoveryCss, /\.apps-discovery-hero__headline-line--rotating > span\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(discoveryCss, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery-hero h1\s*\{[^}]*max-width:\s*100%;[^}]*font-size:\s*clamp\(32px,\s*10vw,\s*48px\)/);
  assert.match(discoveryCss, /@media \(max-width:\s*420px\)[\s\S]*\.apps-discovery-hero h1\s*\{[^}]*font-size:\s*clamp\(32px,\s*10vw,\s*42px\)/);
  assert.match(discoveryCss, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery-hero__actions\s*\{[^}]*width:\s*min\(100%,\s*320px\);[^}]*flex-direction:\s*column/);
  assert.match(discoveryCss, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery-hero__proof\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*justify-content:\s*center/);
  assert.match(discoveryCss, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery-hero__icons\s*\{[^}]*width:\s*min\(132px,\s*38vw\)/);
  assert.match(discoveryCss, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.apps-discovery-hero__actions > \.astryx-button \.astryx-icon\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateX\(-6px\)/);
  assert.match(discoveryCss, /\.apps-discovery-hero__actions > \.astryx-button:hover \.astryx-icon,[\s\S]*:focus-visible \.astryx-icon\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*translateX\(0\)/);
  assert.match(discoveryCss, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.apps-discovery-hero__actions > \.astryx-button > span:first-child > span:first-child\s*\{[^}]*transform:\s*translateX\(12px\)/);
  assert.match(discoveryCss, /\.apps-discovery-hero__actions > \.astryx-button:hover > span:first-child > span:first-child,[\s\S]*:focus-visible > span:first-child > span:first-child\s*\{[^}]*transform:\s*translateX\(0\)/);
  assert.match(
    discoveryCss,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.apps-discovery-hero__actions > \.astryx-button \.astryx-icon,\s*[\s\S]*\.apps-discovery-hero__actions > \.astryx-button > span:first-child > span:first-child\s*\{[^}]*transition:\s*none/,
  );
  assert.match(discoveryCss, /\.apps-discovery__grid,[\s\S]*\.apps-discovery__screen-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(discoveryCss, /\.apps-discovery-screen-card__media\s*\{[^}]*position:\s*relative/);
  assert.match(discoveryCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1080px\)[\s\S]*\.apps-discovery__grid,[\s\S]*\.apps-discovery__screen-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mediaRule, /aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(cardRule, /border-radius:\s*24px/);
  assert.doesNotMatch(css, /\.apps-discovery__count\s*\{/);
  assert.match(discoveryCss, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery__grid,[\s\S]*\.apps-discovery__screen-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

test('renders App information below a self-contained media tile', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.discovery-card\s*\{[\s\S]*border:\s*1px solid var\(--color-border\)[\s\S]*border-radius:\s*24px[\s\S]*background:\s*var\(--color-background-surface\)/);
  assert.match(css, /\.discovery-card__media\s*\{[\s\S]*width:\s*min\(calc\(100% - 32px\),\s*384px\)[\s\S]*margin:\s*16px auto 0/);
  assert.match(css, /\.app-discovery-card\.discovery-card\s*\{[\s\S]*border:\s*0[\s\S]*background:\s*transparent/);
  assert.match(css, /\.app-discovery-card__link\s*\{[\s\S]*gap:\s*16px/);
  assert.match(css, /\.app-discovery-card__media\s*\{[\s\S]*width:\s*100%[\s\S]*aspect-ratio:\s*1\s*\/\s*1[\s\S]*margin:\s*0[\s\S]*background:\s*var\(--color-background-surface\)/);
  assert.match(css, /\.app-discovery-card__identity\s*\{[\s\S]*padding:\s*0 2px/);
  assert.match(css, /\.app-discovery-card__desktop-preview\s*\{[\s\S]*width:\s*82%[\s\S]*aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(css, /\.app-discovery-card__slider-arrow\s*\{[\s\S]*top:\s*calc\(50%\s*-\s*30px\)[\s\S]*width:\s*32px[\s\S]*height:\s*32px[\s\S]*opacity:\s*0[\s\S]*pointer-events:\s*none[\s\S]*transition:/);
  assert.match(css, /\.app-discovery-card__slider-arrow--previous\s*\{[\s\S]*left:\s*calc\(9%\s*\+\s*8px\)/);
  assert.match(css, /\.app-discovery-card__slider-arrow--next\s*\{[\s\S]*right:\s*calc\(9%\s*\+\s*8px\)/);
  assert.match(css, /\.app-discovery-card:hover \.app-discovery-card__slider-arrow,[\s\S]*\.app-discovery-card:focus-within \.app-discovery-card__slider-arrow,[\s\S]*opacity:\s*1[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /\.app-discovery-card__slider-status\s*\{[\s\S]*top:\s*calc\(75\.625%\s*\+\s*10px\)[\s\S]*opacity:\s*0[\s\S]*transform:\s*translate\(-50%,\s*4px\)[\s\S]*transition:/);
  assert.match(css, /\.app-discovery-card:hover \.app-discovery-card__slider-status,[\s\S]*\.app-discovery-card:focus-within \.app-discovery-card__slider-status\s*\{[\s\S]*opacity:\s*1/);
  assert.match(css, /\.app-discovery-card__slider-status i\s*\{[\s\S]*transform:\s*scale\(0\.82\)[\s\S]*transition:/);
  assert.match(css, /\.app-discovery-card__slider-status i\[data-active='true'\]\s*\{[\s\S]*transform:\s*scale\(1\)/);
  assert.match(css, /\.app-discovery-card\.discovery-card:hover \.app-discovery-card__media,[\s\S]*transform:\s*none/);
  // Portrait follows the rendered image, not the app's platform: an iOS app
  // showing a crawled website is a desktop page and keeps the standard frame.
  assert.match(css, /\.app-discovery-card\[data-preview-shape="phone"\] \.app-discovery-card__media[\s\S]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(css, /\.app-discovery-card\[data-preview-shape="phone"\] \.app-discovery-card__slider-status\s*\{[\s\S]*bottom:\s*16px/);
  assert.doesNotMatch(css, /data-preview-platform=['"](?:ios|android)['"]\] \.app-discovery-card__media/);
  assert.match(css, /\.app-discovery-card__phone-preview\s*\{[\s\S]*aspect-ratio:\s*6\s*\/\s*13[\s\S]*overflow:\s*hidden[\s\S]*border-radius:\s*12\.22%\s*\/\s*5\.65%/);
  assert.match(css, /\.discovery-card:hover \.discovery-card__media,[\s\S]*\.discovery-card:focus-within \.discovery-card__media\s*\{[\s\S]*transform:\s*scale\(1\.012\)/);
  assert.doesNotMatch(css, /\.app-discovery-card__preview/);
  assert.doesNotMatch(css, /\.app-discovery-card__overlay/);
});

test('keeps Apps catalog cards visually still on hover', async () => {
  const motionCss = await readFile(new URL('./productMotion.css', import.meta.url), 'utf8');

  assert.match(
    motionCss,
    /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.apps-discovery \.app-discovery-card:hover\s*\{[^}]*box-shadow:\s*var\(--shadow-low\);[^}]*transform:\s*translateY\(0\) scale\(1\)/,
  );
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

test('slides a calm active pill across the Apps platforms', async () => {
  const [css, switcherSource] = await Promise.all([
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsPlatformSwitcher.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(css, /\.apps-platform-switcher\s*\{[\s\S]*width:\s*188px;[\s\S]*display:\s*inline-flex;[\s\S]*border:\s*0;/);
  assert.match(css, /\.apps-platform-switcher button\s*\{[\s\S]*position:\s*relative;/);
  assert.match(css, /\.apps-platform-switcher__active-pill\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*background:\s*var\(--color-text-primary\)/);
  assert.match(css, /\.apps-platform-switcher button\[aria-checked=["']true["']\]\s*\{[\s\S]*color:\s*var\(--color-background-body\)\s*!important/);
  assert.match(switcherSource, /import \{ LayoutGroup, motion, useReducedMotion, type PanInfo \} from 'motion\/react'/);
  assert.match(switcherSource, /<LayoutGroup id="apps-platform-switcher">/);
  assert.match(switcherSource, /<motion\.button/);
  assert.match(switcherSource, /<motion\.div[\s\S]*drag=\{prefersReducedMotion \? false : 'x'\}/);
  assert.match(switcherSource, /Math\.abs\(info\.offset\.x\) >= 22/);
  assert.match(switcherSource, /onDragEnd=\{selectBySwipe\}/);
  assert.match(switcherSource, /className="apps-platform-switcher__active-pill"/);
  assert.match(switcherSource, /layoutId="apps-platform-active-pill"/);
  assert.match(switcherSource, /className="apps-platform-switcher__label"[\s\S]*PLATFORM_LABEL\[platform\]/);
  assert.match(switcherSource, /<motion\.button[\s\S]*layout[\s\S]*transition=\{prefersReducedMotion/);
  assert.match(switcherSource, /type: 'spring'[\s\S]*stiffness: 420[\s\S]*damping: 34/);
  assert.match(switcherSource, /prefersReducedMotion \? \{ duration: 0 \}/);
});

test('renders the Apps platform as a smooth segmented switcher', async () => {
  const [source, switcherSource, discoveryCss] = await Promise.all([
    readFile(new URL('./components/AppsFilterBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsPlatformSwitcher.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /kind === 'apps'[\s\S]*<AppsPlatformSwitcher/);
  assert.match(source, /ariaLabel=\{platform\.ariaLabel\}/);
  assert.match(switcherSource, /className="apps-platform-switcher__option"/);
  assert.doesNotMatch(switcherSource, /platformSlot|data-platform-slot|data-platform-wrap|orbitDirection/);
  assert.match(switcherSource, /title=\{PLATFORM_LABEL\[platform\]\}/);
  assert.doesNotMatch(switcherSource, /import \{ Button \}/);
  assert.match(switcherSource, /GlobeSimple/);
  assert.match(switcherSource, /AppleLogo/);
  assert.match(switcherSource, /AndroidLogo/);
  assert.match(
    discoveryCss,
    /\.apps-filterbar__filter--platform\s*\{[\s\S]*min-width:\s*184px;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;/,
  );
  assert.match(discoveryCss, /\.apps-filterbar \.apps-platform-switcher\s*\{[^}]*width:\s*184px;[^}]*height:\s*var\(--vitrine-control-height\);[^}]*padding:\s*2px;[^}]*overflow:\s*hidden;[^}]*border:\s*0;[^}]*background:\s*var\(--reference-chrome-surface-raised\);[^}]*box-shadow:\s*none/);
  assert.match(discoveryCss, /\.apps-filterbar \.apps-platform-switcher__active-pill\s*\{[^}]*background:\s*#fff/);
  assert.match(discoveryCss, /\.apps-filterbar \.apps-platform-switcher button\[aria-checked='true'\]\s*\{[^}]*color:\s*var\(--color-background-body\)\s*!important/);
  assert.match(discoveryCss, /\.apps-filterbar \.apps-platform-switcher button\s*\{[^}]*width:\s*38px\s*!important;[^}]*height:\s*36px\s*!important;[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center/);
  assert.match(discoveryCss, /\.apps-filterbar \.apps-platform-switcher button\[aria-checked='true'\]\s*\{[^}]*width:\s*100px\s*!important;[^}]*flex-basis:\s*100px/);
  assert.match(discoveryCss, /\.apps-filterbar \.apps-platform-switcher__icon\s*\{[^}]*width:\s*17px;[^}]*height:\s*17px/);
  assert.match(
    discoveryCss,
    /\.apps-filterbar__search\s*\{[\s\S]*min-height:\s*var\(--vitrine-form-input-height\);/,
  );
  assert.match(source, /startIcon=\{<Icon icon="search" size="sm" \/>\}/);
  assert.match(source, /hasClear/);
});

test('replays a staggered card entrance when the Apps platform changes', async () => {
  const [pageSource, motionCss] = await Promise.all([
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./productMotion.css', import.meta.url), 'utf8'),
  ]);

  assert.match(pageSource, /AnimatePresence,[\s\S]*arc,[\s\S]*motion,[\s\S]*useReducedMotion,[\s\S]*type Variants,[\s\S]*from 'motion\/react'/);
  assert.match(pageSource, /key=\{`apps-results:\$\{controller\.state\.platform\}`\}/);
  assert.match(pageSource, /key=\{`screen-results:\$\{controller\.state\.platform\}`\}/);
  assert.match(pageSource, /data-apps-results-transition-direction=\{resultsTransitionDirection\}/);
  assert.match(pageSource, /<AnimatePresence[\s\S]*mode="popLayout"[\s\S]*custom=\{resultsTransitionDirection\}/);
  assert.match(pageSource, /<motion\.div[\s\S]*className="reference-discovery__grid apps-discovery__grid apps-discovery__results-transition"/);
  assert.match(pageSource, /const appsResultsMotionVariants: Variants = \{[\s\S]*initial: \(direction:[\s\S]*exit: \(direction:/);
  assert.match(pageSource, /custom=\{resultsTransitionDirection\}[\s\S]*variants=\{appsResultsMotionVariants\}[\s\S]*exit=\{prefersReducedMotion \? \{ opacity: 0 \} : 'exit'\}/);
  assert.match(pageSource, /className="apps-discovery__motion-card"/);
  assert.match(pageSource, /delay: Math\.min\(index, 6\) \* 0\.035/);
  assert.match(pageSource, /arc\(\{ direction: 'cw', strength: 0\.18, rotate: 0\.1 \}\)/);
  assert.match(pageSource, /type: 'spring' as const,[\s\S]*stiffness: 250,[\s\S]*damping: 29/);
  assert.match(motionCss, /\.apps-discovery__motion-card\s*\{[^}]*min-width:\s*0;[^}]*transform-origin:\s*50% 120%/);
  assert.doesNotMatch(motionCss, /@keyframes apps-discovery-card-enter/);
});

test('replaces the animated taxonomy preview with the editorial hero', async () => {
  const [pageSource, css] = await Promise.all([
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(pageSource, /data-apps-discovery-hero="true"/);
  assert.match(pageSource, /data-apps-hero-rotating-text="true"/);
  assert.match(pageSource, /const APPS_HERO_ROTATING_WORDS = \['APPS\.', 'SCREENS\.', 'FLOWS\.'\] as const/);
  assert.match(pageSource, /<AnimatePresence initial=\{false\} mode="wait">/);
  assert.match(pageSource, /setWordIndex\(\(current\) => \(current \+ 1\) % APPS_HERO_ROTATING_WORDS\.length\)/);
  assert.match(pageSource, /if \(prefersReducedMotion\) \{[\s\S]*setWordIndex\(0\)/);
  assert.match(pageSource, /stiffness: 240,[\s\S]*damping: 28,[\s\S]*mass: 0\.82/);
  assert.match(pageSource, /className="apps-discovery-hero__icon-track"/);
  assert.match(pageSource, /const AppsDiscoveryHero = memo\(function AppsDiscoveryHero/);
  assert.match(pageSource, /const APPS_HERO_PROOF_APPS = \[/);
  assert.match(pageSource, /name: 'Aboard',[\s\S]*name: 'Twingate'/);
  assert.match(pageSource, /aria-label="Featured app icons"/);
  assert.doesNotMatch(pageSource, /products indexed/);
  assert.match(pageSource, /APPS_HERO_PROOF_APPS\.map\(\(app\) =>/);
  assert.match(pageSource, /<AppsDiscoveryHero\s+onExplore=\{exploreCatalog\}/);
  assert.doesNotMatch(pageSource, /currentProofApps|heroProof|stableHeroProofApps|proofApps/);
  assert.doesNotMatch(pageSource, /proofTotal/);
  assert.match(pageSource, /const proofCycleDuration = Math\.max\(7, APPS_HERO_PROOF_APPS\.length \* 1\.1\);/);
  assert.match(pageSource, /style=\{\{ animationDuration: `\$\{proofCycleDuration\}s` \}\}/);
  assert.match(pageSource, /const exploreCatalog = useCallback\(\(\) => \{/);
  assert.match(pageSource, /\[0, 1\]\.map\(\(copyIndex\)/);
  assert.match(pageSource, /scrollIntoView/);
  assert.doesNotMatch(pageSource, /useCategoryHoverPreview/);
  assert.doesNotMatch(pageSource, /prefetchAppFacetPreview/);
  assert.match(css, /\.apps-discovery-hero__icons \.app-icon\s*\{[^}]*margin-left:\s*-8px/);
  assert.match(css, /\.apps-discovery-hero__icons\s*\{[^}]*width:\s*146px/);
  assert.match(css, /\.apps-discovery-hero__rotating-slot\s*\{[^}]*padding:\s*0 \.12em;[^}]*overflow:\s*hidden[^}]*background:\s*#fff;[^}]*color:\s*var\(--color-background-body\)/);
  assert.doesNotMatch(css, /\.apps-discovery-hero__rotating-slot\s*\{[^}]*min-width:/);
  assert.match(css, /\.apps-discovery-hero__rotating-word\s*\{[^}]*position:\s*relative;[^}]*top:\s*\.04em;[^}]*white-space:\s*nowrap/);
  assert.match(css, /@keyframes apps-hero-proof-icons[\s\S]*translateX\(-50%\)[\s\S]*translateX\(0\)/);
  assert.match(css, /\.apps-discovery-hero__icons\s*\{[^}]*overflow:\s*hidden;[^}]*mask-image:\s*linear-gradient/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.apps-discovery-hero__rotating-character\s*\{[^}]*opacity:\s*1 !important;[^}]*transform:\s*none !important/);
});
