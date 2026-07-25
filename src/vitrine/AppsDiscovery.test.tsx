import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppsDiscoveryPage } from './components/AppsDiscoveryPage.tsx';
import { ReferenceDiscoveryTopNav } from './components/ReferenceDiscoveryTopNav.tsx';
import type { App } from './types.ts';
import { filterAndSortApps } from './appsDiscovery.ts';

const makeApp = (overrides: Partial<App> = {}): App => ({
  id: 'base',
  app: 'Base',
  cat: 'Business',
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
      cat: 'Health & Fitness',
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
});

test('orders Apps from real capture, coverage, and animation fields', () => {
  const apps = [
    makeApp({ id: 'older', lastCapturedAt: '2026-07-01T00:00:00.000Z', totalScreens: 8 }),
    makeApp({ id: 'newer', lastCapturedAt: '2026-07-24T00:00:00.000Z', totalScreens: 2 }),
    makeApp({ id: 'motion', previewVideoUrl: '/motion.mp4', totalScreens: 4 }),
  ];
  const options = { query: '', facet: null, platform: 'web' as const };

  assert.equal(filterAndSortApps(apps, { ...options, sort: 'latest' })[0]?.id, 'newer');
  assert.equal(filterAndSortApps(apps, { ...options, sort: 'popular' })[0]?.id, 'older');
  assert.equal(filterAndSortApps(apps, { ...options, sort: 'animations' })[0]?.id, 'motion');
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

  assert.match(html, /class="apps-top-nav"/);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /aria-selected="true"/);
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
  assert.match(html, /<img src="\/favicon\.svg" alt="" aria-hidden="true" width="32" height="32"\/>/);
  assert.doesNotMatch(html, /<span aria-hidden="true">V<\/span>/);
  assert.match(html, /Categories/);
  assert.match(html, /Screens/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /iOS/);
  assert.match(html, /Web/);
  assert.match(html, /Latest/);
  assert.match(html, /Most popular/);
  assert.match(html, /Top rated/);
  assert.match(html, /Animations/);
  assert.doesNotMatch(html, />Filter</);
  assert.match(html, /data-has-app-preview="true"/);
  assert.match(html, /class="apps-discovery__hover-preview"/);
  assert.equal((html.match(/data-preview-frame=/g) ?? []).length, 3);
  assert.match(html, /data-apps-discovery-grid="true"/);
  assert.match(html, /data-app-discovery-card="true"/);
  assert.match(html, /Purpose-built tool/);
  assert.match(html, /aria-label="Open Linear"/);
});

test('styles Apps as a three-column Mobbin discovery layout with responsive fallbacks', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-discovery__taxonomy\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.apps-discovery__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.app-discovery-card__media\s*\{[\s\S]*aspect-ratio:\s*1/);
  assert.match(css, /\.app-discovery-card\s*\{[\s\S]*border-radius:\s*28px/);
  assert.match(css, /@media \(max-width:\s*1080px\)[\s\S]*\.apps-discovery__grid,\s*[\s\S]*\.apps-discovery__loading\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery__grid,\s*[\s\S]*\.apps-discovery__loading\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

test('styles Apps ordering labels gray with white hover and an animated active state', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-discovery__sort button\s*\{[\s\S]*color:\s*var\(--color-text-secondary\)\s*!important;[\s\S]*transition:\s*color/);
  assert.match(css, /\.apps-discovery__sort button:hover,[\s\S]*\.apps-discovery__sort button:focus-visible,[\s\S]*\.apps-discovery__sort button\[aria-selected='true'\]\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*color:\s*var\(--color-text-primary\)\s*!important/);
  assert.match(css, /\.apps-discovery__sort button::after\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*scaleX\([\d.]+\);[\s\S]*transition:/);
  assert.match(css, /\.apps-discovery__sort button\[aria-selected='true'\]::after\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleX\(1\)/);
});

test('animates the Apps platform pill between iOS and Web', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-discovery__platform::before\s*\{[\s\S]*transform:\s*translateX\(0\);[\s\S]*transition:\s*transform/);
  assert.match(css, /\.apps-discovery__platform:has\(button:nth-child\(2\)\[aria-checked='true'\]\)::before\s*\{[\s\S]*transform:\s*translateX\(calc\(100%\s*\+\s*2px\)\)/);
  assert.match(css, /\.apps-discovery__platform button\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*transition:\s*color/);
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

test('styles the Apps category hover preview as a non-interactive floating image', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-discovery__hover-preview\s*\{[\s\S]*position:\s*fixed;[\s\S]*pointer-events:\s*none;[\s\S]*visibility:\s*hidden;[\s\S]*will-change:\s*transform,\s*opacity/);
  assert.match(css, /\.apps-discovery__hover-preview img\s*\{[\s\S]*object-fit:\s*cover/);
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
