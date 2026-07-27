import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppsDiscoveryPage } from './components/AppsDiscoveryPage.tsx';
import * as AppsDiscoveryPageModule from './components/AppsDiscoveryPage.tsx';
import { ReferenceDiscoveryTopNav } from './components/ReferenceDiscoveryTopNav.tsx';
import type { App } from './types.ts';
import { filterAndSortApps } from './appsDiscovery.ts';
import * as HoverPreviewModule from './useCategoryHoverPreview.ts';

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
  }],
  ...overrides,
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
    <ReferenceDiscoveryTopNav
      active="apps"
      className="apps-top-nav"
      search={<button>Search on Web...</button>}
      isAdmin
      importLabel="Import App"
      onImport={() => undefined}
    />,
  );

  assert.match(html, /class="[^"]*reference-discovery-nav[^"]*apps-top-nav[^"]*"/);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-label="Vitrine Apps"/);
  assert.match(html, /Search on Web/);
  assert.match(html, /Import App/);
});

test('renders the Mobbin Apps taxonomy, controls, grid, and media-first card', () => {
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
  const html = renderToStaticMarkup(
    <AppsDiscoveryPage
      apps={[app]}
      categories={[
        { id: 1, name: 'Business', slug: 'business', appCount: 1 },
        { id: 7, name: 'Productivity', slug: 'productivity', appCount: 1 },
      ]}
      isAdmin
      query=""
      facet={null}
      onFacetChange={() => undefined}
      onOpenSearch={() => undefined}
      searchMode="legacy"
      onImport={() => undefined}
      onOpenApp={() => undefined}
      onRetry={() => undefined}
      totalApps={1}
      hasMore={false}
      loadingMore={false}
    />,
  );

  assert.match(html, /data-apps-discovery="true"/);
  assert.match(html, /class="[^"]*reference-discovery[^"]*reference-discovery--apps[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__content[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__taxonomy[^"]*reference-discovery__taxonomy--apps[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__facet[^"]*"/);
  assert.match(html, /class="[^"]*reference-search-trigger[^"]*"/);
  assert.match(html, /<img src="\/favicon\.svg" alt="" aria-hidden="true" width="32" height="32"\/>/);
  assert.doesNotMatch(html, /<span aria-hidden="true">V<\/span>/);
  assert.match(html, /Categories/);
  assert.match(html, /Productivity/);
  assert.match(html, /Screens/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /iOS/);
  assert.match(html, /Web/);
  assert.match(html, /Android/);
  const platformMarkup = html.slice(
    html.indexOf('aria-label="App platform"'),
    html.indexOf('aria-label="App ordering"'),
  );
  assert.ok(platformMarkup.indexOf('Web') < platformMarkup.indexOf('iOS'));
  assert.ok(platformMarkup.indexOf('iOS') < platformMarkup.indexOf('Android'));
  assert.match(html, /Latest/);
  assert.match(html, /Most popular/);
  assert.doesNotMatch(html, /Top rated/);
  assert.doesNotMatch(html, /Animations/);
  assert.doesNotMatch(html, />Filter</);
  assert.match(html, /data-reference-discovery-toolbar="true"/);
  assert.match(html, /class="reference-discovery-toolbar__sort"/);
  assert.match(html, /aria-label="App ordering"/);
  assert.match(html, /data-facet-preview="categories"/);
  assert.match(html, /data-facet-preview="screens"/);
  assert.match(html, /data-facet-preview="elements"/);
  assert.match(html, /data-facet-preview="flows"/);
  assert.match(html, /class="apps-discovery__hover-preview"/);
  assert.equal((html.match(/data-preview-frame=/g) ?? []).length, 3);
  assert.match(html, /data-apps-discovery-grid="true"/);
  assert.match(html, /class="[^"]*reference-discovery__grid[^"]*"/);
  assert.match(html, /data-app-discovery-card="true"/);
  assert.doesNotMatch(html, /apps-discovery__count/);
  assert.match(html, /Purpose-built tool/);
  assert.match(html, /aria-label="Open Linear"/);
});

test('renders six App card skeletons while the initial page loads', () => {
  const html = renderToStaticMarkup(
    <AppsDiscoveryPage
      apps={null}
      categories={null}
      isAdmin
      query=""
      facet={null}
      onFacetChange={() => undefined}
      onOpenSearch={() => undefined}
      searchMode="legacy"
      onImport={() => undefined}
      onOpenApp={() => undefined}
      onRetry={() => undefined}
      totalApps={null}
      hasMore={false}
      loadingMore={false}
    />,
  );

  assert.equal((html.match(/data-app-card-skeleton="true"/g) ?? []).length, 6);
  assert.match(html, /aria-label="Loading Apps"/);
});

test('appends three App card skeletons while loading another page', () => {
  const html = renderToStaticMarkup(
    <AppsDiscoveryPage
      apps={[makeApp()]}
      categories={[]}
      isAdmin
      query=""
      facet={null}
      onFacetChange={() => undefined}
      onOpenSearch={() => undefined}
      searchMode="legacy"
      onImport={() => undefined}
      onOpenApp={() => undefined}
      onRetry={() => undefined}
      totalApps={2}
      hasMore
      loadingMore
    />,
  );

  assert.equal((html.match(/data-app-card-skeleton="true"/g) ?? []).length, 3);
  assert.match(html, /role="status"[^>]*>Loading more Apps</);
});

test('composes Apps through the shared reference discovery shell', async () => {
  const source = await readFile(
    new URL('./components/AppsDiscoveryPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /import \{ ReferenceDiscoveryPageShell \} from '\.\/ReferenceDiscoveryPageShell\.tsx';/);
  assert.match(source, /<ReferenceDiscoveryPageShell[\s\S]*kind="apps"/);
});

test('defines the Apps-led shared discovery design contract', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');

  assert.match(css, /--reference-font-family:\s*'Figtree',\s*system-ui,\s*sans-serif/);
  assert.match(css, /--reference-nav-height:\s*72px/);
  assert.match(css, /--reference-content-padding:\s*32px/);
  assert.match(css, /--reference-facet-size:\s*24px/);
  assert.match(css, /--reference-card-radius:\s*24px/);
  assert.match(css, /\.reference-discovery-nav\s*\{[^}]*height:\s*var\(--reference-nav-height\)/);
  assert.match(css, /\.reference-discovery-nav__search\s+\.reference-search-trigger\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.reference-discovery-toolbar\s*\{[^}]*min-height:\s*var\(--reference-toolbar-height\)/);
  assert.match(css, /\.reference-discovery__facet h2\s*\{[^}]*font-family:\s*var\(--reference-font-family\)/);
  assert.match(css, /\.discovery-card\s*\{[^}]*border-radius:\s*var\(--reference-card-radius\)/);
  assert.match(css, /\.reference-discovery__state\s*\{[^}]*min-height:\s*360px/);
});

test('styles Apps as a three-column Mobbin discovery layout with responsive fallbacks', async () => {
  const [css, discoveryCss] = await Promise.all([
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);
  const cardRule = css.match(/\.discovery-card\s*\{[^}]+\}/)?.[0] ?? '';
  const mediaRule = css.match(/\.discovery-card__media\s*\{[^}]+\}/)?.[0] ?? '';

  assert.match(css, /\.apps-discovery__taxonomy\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(discoveryCss, /\.reference-discovery__taxonomy--apps\s*\{[^}]*--reference-taxonomy-bottom:\s*48px/);
  assert.match(css, /\.apps-discovery__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mediaRule, /aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(cardRule, /border-radius:\s*24px/);
  assert.doesNotMatch(css, /\.apps-discovery__count\s*\{/);
  assert.match(css, /@media \(max-width:\s*1080px\)[\s\S]*\.apps-discovery__grid,\s*[\s\S]*\.apps-discovery__loading\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery__grid,\s*[\s\S]*\.apps-discovery__loading\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

test('renders App media directly through the shared discovery frame', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.discovery-card\s*\{[\s\S]*border:\s*1px solid var\(--color-border\)[\s\S]*border-radius:\s*24px[\s\S]*background:\s*var\(--color-background-surface\)/);
  assert.match(css, /\.discovery-card__media\s*\{[\s\S]*width:\s*min\(calc\(100% - 32px\),\s*384px\)[\s\S]*margin:\s*16px auto 0/);
  assert.match(css, /\.app-discovery-card__media\s*\{[\s\S]*background:\s*transparent/);
  assert.match(css, /\.app-discovery-card\[data-preview-platform=['"](?:ios|android)['"]\] \.app-discovery-card__media[\s\S]*aspect-ratio:\s*3\s*\/\s*4/);
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
  assert.match(css, /\.reference-discovery-toolbar__sort button:hover,[\s\S]*\.reference-discovery-toolbar__sort button:focus-visible,[\s\S]*\.reference-discovery-toolbar__sort button\[aria-selected='true'\]\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*color:\s*var\(--color-text-primary\)\s*!important/);
  assert.match(css, /\.reference-discovery-toolbar__sort button::after\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*scaleX\([\d.]+\);[\s\S]*transition:/);
  assert.match(css, /\.reference-discovery-toolbar__sort button\[aria-selected='true'\]::after\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleX\(1\)/);
});

test('animates the Apps platform pill across Web, iOS, and Android', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-platform-switcher::before\s*\{[\s\S]*width:\s*var\(--apps-platform-indicator-width\);[\s\S]*transform:\s*translateX\(var\(--apps-platform-indicator-shift\)\);[\s\S]*transition:\s*transform/);
  assert.match(css, /\.apps-platform-switcher button\s*\{[\s\S]*width:\s*96px\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*transition:\s*color/);
  assert.match(css, /\.apps-platform-switcher button\[aria-checked='true'\]\s*\{[\s\S]*color:\s*var\(--color-background-body\)\s*!important/);
});

test('scopes taxonomy hover motion to fine pointers with viewport clamping and GSAP cleanup', async () => {
  const source = await readFile(new URL('./useCategoryHoverPreview.ts', import.meta.url), 'utf8');

  assert.match(source, /gsap\.matchMedia\(\)/);
  assert.match(source, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(source, /\(prefers-reduced-motion: reduce\)/);
  assert.equal((source.match(/gsap\.quickTo\(/g) ?? []).length, 2);
  assert.equal((source.match(/\.tween\.kill\(\)/g) ?? []).length, 2);
  assert.match(source, /window\.innerWidth - element\.offsetWidth/);
  assert.match(source, /window\.innerHeight - element\.offsetHeight/);
  assert.match(source, /gsap\.timeline\(\{ repeat: -1 \}\)/);
  assert.match(source, /matchMedia\.revert\(\)/);
});

test('fits Screen hover previews to the image aspect ratio within compact bounds', () => {
  const fitScreenPreviewSize = (
    HoverPreviewModule as typeof HoverPreviewModule & {
      fitScreenPreviewSize?: (
        width: number,
        height: number,
      ) => { width: number; height: number } | null;
    }
  ).fitScreenPreviewSize;

  assert.equal(typeof fitScreenPreviewSize, 'function');
  if (!fitScreenPreviewSize) return;
  assert.deepEqual(fitScreenPreviewSize(480, 300), { width: 240, height: 150 });
  assert.deepEqual(fitScreenPreviewSize(1170, 2532), { width: 129, height: 280 });
  assert.equal(fitScreenPreviewSize(0, 300), null);
});

test('styles the Apps category hover preview as a non-interactive floating image', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const screenFrameRule = css.match(
    /\.apps-discovery__hover-preview\[data-kind='screen'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const screenImageRule = css.match(
    /\.apps-discovery__hover-preview\[data-kind='screen'\] img\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(css, /\.apps-discovery__hover-preview\s*\{[\s\S]*position:\s*fixed;[\s\S]*pointer-events:\s*none;[\s\S]*visibility:\s*hidden;[\s\S]*will-change:\s*transform,\s*opacity/);
  assert.match(css, /\.apps-discovery__hover-preview img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(screenFrameRule, /max-width:\s*240px/);
  assert.match(screenFrameRule, /max-height:\s*280px/);
  assert.match(screenImageRule, /object-fit:\s*contain/);
  assert.match(css, /@media \(hover:\s*none\),\s*\(pointer:\s*coarse\)[\s\S]*\.apps-discovery__hover-preview\s*\{[\s\S]*display:\s*none/);
});

test('requests a random cached taxonomy candidate on pointer entry', async () => {
  const source = await readFile(
    new URL('./components/AppsDiscoveryPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /fetchRandomFacetPreview\(\{ \.\.\.facet, platform \}\)/);
  assert.doesNotMatch(source, /fetchFacetPreview\(\{ \.\.\.facet, platform \}\)/);
});

test('loads App taxonomy previews only after pointer entry', async () => {
  const source = await readFile(
    new URL('./components/AppsDiscoveryPage.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /requestIdleCallback/);
  assert.doesNotMatch(source, /prefetchVisibleAppFacetPreviews/);
  assert.doesNotMatch(source, /visibleAppFacetInputs/);
  assert.match(source, /readyAppFacetPreviews\.get/);
  assert.match(source, /if \(readyPreview\) showPreview\(/);
  assert.match(source, /void prefetchAppFacetPreview\(/);
  assert.doesNotMatch(source, /await prefetchAppFacetPreview/);
});

test('renders the Apps platform filter through the shared platform switcher', async () => {
  const source = await readFile(
    new URL('./components/AppsDiscoveryPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /import \{ AppsPlatformSwitcher \} from '.\/AppsPlatformSwitcher'/);
  assert.match(source, /<AppsPlatformSwitcher/);
});
