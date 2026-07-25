# Mobbin-style Apps Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/apps` gallery's old constrained shell with the same full-width discovery hierarchy used by Sites, styled and populated like Mobbin's Web Apps catalog.

**Architecture:** Keep `useApps`, search, import, entitlements, overlays, and lazy pagination in `App.tsx`. Move Apps-only filtering/sorting into a pure `appsDiscovery.ts` model and Apps-only rendering into `AppsDiscoveryPage.tsx`; extract the Sites top-nav markup into a shared `ReferenceDiscoveryTopNav` without changing Sites output. Restyle the existing `AppCard` as the Mobbin-style media-first card so App detail navigation and real catalog media remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, `@astryxdesign/core`, Framer Motion, Node test runner, `tsx`, Chrome MCP.

---

## File structure

- Create `src/vitrine/appsDiscovery.ts`: pure Apps facet, platform, and ordering derivations.
- Create `src/vitrine/AppsDiscovery.test.tsx`: render and model coverage for the new Apps gallery.
- Create `src/vitrine/components/ReferenceDiscoveryTopNav.tsx`: shared Apps/Sites discovery navigation geometry.
- Create `src/vitrine/components/AppsDiscoveryPage.tsx`: Apps-only full-width gallery frame and local view state.
- Modify `src/vitrine/components/SitesTopNav.tsx`: delegate unchanged Sites markup to the shared top nav.
- Modify `src/vitrine/components/AppCard.tsx`: render the media-first Mobbin card with real App media and status.
- Modify `src/vitrine/ImportDialog.test.tsx`: preserve status-card behavior while asserting the new card semantics.
- Modify `src/vitrine/App.tsx`: route `/apps` through `AppsDiscoveryPage` outside the admin `AppShell`.
- Modify `src/vitrine/App.boundary.test.ts`: replace the obsolete shared-shell assertions and preserve imports, pagination, and zero job reads.
- Modify `src/vitrine/styles.css`: add the measured Apps layout and responsive rules, sharing only top-nav geometry with Sites.

### Task 1: Apps discovery model

**Files:**
- Create: `src/vitrine/appsDiscovery.ts`
- Create: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write the failing filtering and ordering test**

Create `src/vitrine/AppsDiscovery.test.tsx` with representative Web and iOS Apps:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from './types.ts';
import { filterAndSortApps } from './appsDiscovery.ts';

const makeApp = (overrides: Partial<App>): App => ({
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
      screens: [{ ...makeApp({}).screens[0]!, id: 2, platform: 'ios', type: 'Signup' }],
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
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL with `Cannot find module './appsDiscovery.ts'`.

- [ ] **Step 3: Implement the pure model**

Create `src/vitrine/appsDiscovery.ts`:

```ts
import type { Platform } from '../platformFromUrl.ts';
import type { App, Screen } from './types.ts';

export type AppsFacet = {
  group: 'categories' | 'screens' | 'elements' | 'flows';
  value: string;
};
export type AppsSort = 'latest' | 'popular' | 'rated' | 'animations';
export type AppsPlatform = Extract<Platform, 'ios' | 'web'>;

export const APPS_DISCOVERY_FACETS = [
  { group: 'categories', label: 'Categories', values: ['Productivity', 'Business', 'Finance', 'Health & Fitness', 'Developer Tools'] },
  { group: 'screens', label: 'Screens', values: ['Filter & Sort', 'Chat Bot', 'Signup', 'Settings & Preferences', 'Charts'] },
  { group: 'elements', label: 'UI Elements', values: ['Navigation Menu', 'Dialog', 'Card', 'Dropdown Menu', 'Text Field'] },
  { group: 'flows', label: 'Flows', values: ['Setting Up', 'Searching & Finding', 'Filtering & Sorting', 'Resetting Password', 'Reporting'] },
] as const;

const text = (values: Array<string | null | undefined>) =>
  values.filter(Boolean).join(' ').toLowerCase();

const screenText = (screen: Screen, facet: AppsFacet['group']) => {
  if (facet === 'screens') return text([screen.type, screen.productArea]);
  if (facet === 'elements') return text([...(screen.componentNames ?? []), ...(screen.layoutPatterns ?? [])]);
  return text([...(screen.visibleStates ?? []), screen.stateContext, screen.description]);
};

const confidence = (app: App) => {
  const values = app.screens.flatMap((screen) => screen.confidence == null ? [] : [screen.confidence]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

const capturedAt = (app: App) => Date.parse(app.lastCapturedAt ?? '') || 0;

export function filterAndSortApps(
  apps: App[],
  options: { query: string; facet: AppsFacet | null; platform: AppsPlatform; sort: AppsSort },
): App[] {
  const query = options.query.trim().toLowerCase();
  return apps
    .map((app, index) => ({ app, index }))
    .filter(({ app }) => {
      const platforms = app.platforms ?? app.screens.map((screen) => screen.platform as Platform);
      if (!platforms.includes(options.platform)) return false;
      if (query && !text([
        app.app,
        app.cat,
        app.description,
        ...app.screens.flatMap((screen) => [
          screen.type,
          screen.productArea,
          screen.description,
          ...(screen.componentNames ?? []),
          ...(screen.layoutPatterns ?? []),
          ...(screen.visibleStates ?? []),
        ]),
      ]).includes(query)) return false;
      if (!options.facet) return true;
      const needle = options.facet.value.toLowerCase();
      if (options.facet.group === 'categories') return app.cat.toLowerCase() === needle;
      return app.screens.some((screen) => screenText(screen, options.facet!.group).includes(needle));
    })
    .sort((a, b) => {
      if (options.sort === 'latest') return capturedAt(b.app) - capturedAt(a.app) || a.index - b.index;
      if (options.sort === 'popular') return b.app.totalScreens - a.app.totalScreens || a.index - b.index;
      if (options.sort === 'rated') {
        return confidence(b.app) - confidence(a.app)
          || (b.app.analyzedScreens ?? 0) - (a.app.analyzedScreens ?? 0)
          || a.index - b.index;
      }
      return Number(Boolean(b.app.previewVideoUrl)) - Number(Boolean(a.app.previewVideoUrl)) || a.index - b.index;
    })
    .map(({ app }) => app);
}
```

- [ ] **Step 4: Run the model tests to verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the model**

```bash
git add src/vitrine/appsDiscovery.ts src/vitrine/AppsDiscovery.test.tsx
git commit -m "feat: add Apps discovery model"
```

### Task 2: Shared discovery top navigation

**Files:**
- Create: `src/vitrine/components/ReferenceDiscoveryTopNav.tsx`
- Modify: `src/vitrine/components/SitesTopNav.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Add failing shared-nav render assertions**

Append an SSR test to `src/vitrine/AppsDiscovery.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceDiscoveryTopNav } from './components/ReferenceDiscoveryTopNav.tsx';

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
  assert.match(html, /aria-selected="true"[^>]*>.*Apps/s);
  assert.match(html, /Search on Web/);
  assert.match(html, /Import App/);
});
```

In `src/vitrine/Sites.test.tsx`, keep the current Sites assertions and add:

```tsx
assert.match(html, /class="sites-top-nav"/);
assert.match(html, /Search Sites/);
assert.equal((html.match(/>Import Site</g) ?? []).length, 1);
```

- [ ] **Step 2: Run both render suites to verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: Apps test FAILS because `ReferenceDiscoveryTopNav.tsx` does not exist; existing Sites tests remain green.

- [ ] **Step 3: Add the shared top nav**

Create `src/vitrine/components/ReferenceDiscoveryTopNav.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ReferenceDiscoveryTopNavProps {
  active: ReferenceType;
  className: string;
  search: ReactNode;
  isAdmin: boolean;
  importLabel: string;
  onImport: () => void;
  accountControls?: ReactNode;
}

export function ReferenceDiscoveryTopNav({
  active,
  className,
  search,
  isAdmin,
  importLabel,
  onImport,
  accountControls,
}: ReferenceDiscoveryTopNavProps) {
  return (
    <header className={className}>
      <div className={`${className}__left`}>
        <a
          href={active === 'apps' ? '/apps' : '/sites'}
          className={`${className}__brand`}
          data-reference-gallery-identity="true"
          onClick={(event) => {
            event.preventDefault();
            navigate(active === 'apps' ? { name: 'apps' } : { name: 'sites' });
          }}
        >
          <span aria-hidden="true">V</span>
          <strong>Vitrine</strong>
        </a>
        <ReferenceTypeTabs active={active} className={`${className}__types`} />
      </div>
      <div className={`${className}__search`}>{search}</div>
      <div className={`${className}__actions`}>
        {isAdmin ? <Button variant="ghost" size="sm" label={importLabel} onClick={onImport} /> : null}
        {accountControls}
      </div>
    </header>
  );
}
```

Replace the duplicated header in `SitesTopNav.tsx` with:

```tsx
export function SitesTopNav(props: SitesTopNavProps) {
  return (
    <ReferenceDiscoveryTopNav
      active="sites"
      className="sites-top-nav"
      search={<SearchInput value={props.query} onChange={props.onQueryChange} placeholder="Search Sites" />}
      isAdmin={props.isAdmin}
      importLabel="Import Site"
      onImport={props.onImport}
      accountControls={props.accountControls}
    />
  );
}
```

- [ ] **Step 4: Run both render suites to verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: shared-nav test and all current Sites tests pass.

- [ ] **Step 5: Commit the shared navigation**

```bash
git add src/vitrine/components/ReferenceDiscoveryTopNav.tsx src/vitrine/components/SitesTopNav.tsx src/vitrine/Sites.test.tsx src/vitrine/AppsDiscovery.test.tsx
git commit -m "refactor: share reference discovery navigation"
```

### Task 3: Mobbin-style Apps page and cards

**Files:**
- Create: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/components/AppCard.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/ImportDialog.test.tsx`

- [ ] **Step 1: Add a failing populated Apps render test**

Append to `src/vitrine/AppsDiscovery.test.tsx`:

```tsx
import { AppsDiscoveryPage } from './components/AppsDiscoveryPage.tsx';

test('renders the Mobbin Apps taxonomy, controls, grid, and media-first card', () => {
  const app = makeApp({
    id: 'linear-web',
    app: 'Linear',
    description: 'Purpose-built tool for planning and building products',
    iconUrl: '/linear.svg',
    screens: [
      makeApp({}).screens[0]!,
      { ...makeApp({}).screens[0]!, id: 2, url: '/linear-2.png' },
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
  assert.match(html, /data-apps-discovery-grid="true"/);
  assert.match(html, /data-app-discovery-card="true"/);
  assert.match(html, /Purpose-built tool/);
  assert.match(html, /aria-label="Open Linear"/);
});
```

- [ ] **Step 2: Run the render test to verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because `AppsDiscoveryPage.tsx` and the Apps card markers do not exist.

- [ ] **Step 3: Implement `AppsDiscoveryPage`**

Create `src/vitrine/components/AppsDiscoveryPage.tsx` with:

```tsx
import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import type { App } from '../types.ts';
import {
  APPS_DISCOVERY_FACETS,
  filterAndSortApps,
  type AppsFacet,
  type AppsPlatform,
  type AppsSort,
} from '../appsDiscovery.ts';
import { AppCard } from './AppCard.tsx';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

interface AppsDiscoveryPageProps {
  apps: App[] | null;
  isAdmin: boolean;
  query: string;
  facet: AppsFacet | null;
  onFacetChange: (facet: AppsFacet | null) => void;
  onOpenSearch: () => void;
  searchMode: 'legacy' | 'advanced';
  onImport: () => void;
  onOpenApp: (appId: string) => void;
  onRetry: () => void;
  totalApps: number | null;
  error?: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  accountControls?: ReactNode;
  beforeGrid?: ReactNode;
}

export function AppsDiscoveryPage(props: AppsDiscoveryPageProps) {
  const [platform, setPlatform] = useState<AppsPlatform>('web');
  const [sort, setSort] = useState<AppsSort>('latest');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const visibleApps = useMemo(
    () => filterAndSortApps(props.apps ?? [], {
      query: props.query,
      facet: props.facet,
      platform,
      sort,
    }),
    [platform, props.apps, props.facet, props.query, sort],
  );
  const state = props.error
    ? { title: 'Could not load crawled screens', description: `The catalog could not be loaded: ${props.error}`, role: 'alert' as const }
    : props.apps && props.apps.length === 0
      ? { title: 'No screens crawled yet', description: props.isAdmin ? 'Import captured web screens to build the first observed design system.' : 'No curated web apps have been published yet.', role: 'status' as const }
      : props.apps !== null && visibleApps.length === 0
        ? { title: 'No Apps match these filters', description: 'Try a different search, taxonomy, or platform.', role: 'status' as const }
        : null;

  return (
    <main data-apps-discovery="true" data-reference-gallery-shell="apps" className="apps-discovery">
      <ReferenceDiscoveryTopNav
        active="apps"
        className="apps-top-nav"
        search={
          <SearchTrigger
            label={props.query || props.facet ? `${visibleApps.length} apps · search or filter…` : 'Search on Web...'}
            activeCategory={props.facet?.value ?? 'All'}
            onOpen={props.onOpenSearch}
            onClearCategory={() => props.onFacetChange(null)}
            mode={props.searchMode}
          />
        }
        isAdmin={props.isAdmin}
        importLabel="Import App"
        onImport={props.onImport}
        accountControls={props.accountControls}
      />
      <div className="apps-discovery__content">
        {filtersOpen ? (
          <div className="apps-discovery__taxonomy" aria-label="App discovery filters">
            {APPS_DISCOVERY_FACETS.map((group) => (
              <section key={group.group} className={`apps-discovery__facet apps-discovery__facet--${group.group}`}>
                <h2>{group.label}</h2>
                <div>{group.values.map((value) => {
                  const selected = props.facet?.group === group.group && props.facet.value === value;
                  return <Button key={value} label={value} variant="ghost" size="sm" aria-pressed={selected} onClick={() => props.onFacetChange(selected ? null : { group: group.group, value })} />;
                })}</div>
              </section>
            ))}
          </div>
        ) : null}
        <div className="apps-discovery__toolbar">
          <div role="radiogroup" aria-label="App platform" className="apps-discovery__platform">
            {(['ios', 'web'] as const).map((value) => <Button key={value} label={value === 'ios' ? 'iOS' : 'Web'} variant="ghost" size="sm" role="radio" aria-checked={platform === value} onClick={() => setPlatform(value)} />)}
          </div>
          <div role="tablist" aria-label="App ordering" className="apps-discovery__sort">
            {([['latest', 'Latest'], ['popular', 'Most popular'], ['rated', 'Top rated'], ['animations', 'Animations']] as const).map(([value, label]) => <Button key={value} label={label} variant="ghost" size="sm" role="tab" aria-selected={sort === value} onClick={() => setSort(value)} />)}
          </div>
          <Button variant="ghost" size="sm" label="Filter" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)} />
        </div>
        {props.beforeGrid}
        {state ? (
          <div className="apps-discovery__state" role={state.role}>
            <EmptyState title={state.title} description={state.description} actions={props.error ? <Button variant="primary" label="Retry" onClick={props.onRetry} /> : undefined} />
          </div>
        ) : props.apps === null ? (
          <div className="apps-discovery__loading" role="status" aria-label="Loading Apps">{Array.from({ length: 6 }, (_, index) => <div key={index} />)}</div>
        ) : (
          <>
            <div data-apps-discovery-grid="true" className="apps-discovery__grid">
              {visibleApps.map((app) => <AppCard key={app.id} app={app} onOpen={() => props.onOpenApp(app.id)} status={props.isAdmin ? (app.analyzedScreens ?? 0) >= app.totalScreens ? 'Complete' : 'In progress' : undefined} progressLabel={`${app.analyzedScreens ?? 0}/${app.totalScreens} analyzed`} />)}
            </div>
            {props.hasMore ? <div ref={props.sentinelRef} aria-hidden="true" className="apps-discovery__sentinel" /> : null}
            {props.loadingMore ? <div role="status" aria-label="Loading" className="apps-discovery__loading-more"><Spinner size="sm" aria-hidden="true" /></div> : null}
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rewrite `AppCard` as the media-first card**

Keep the current `AppCardProps`, status badge mapping, and on-open behavior, but replace its `PreviewCarouselCard` output with semantic markup:

```tsx
const [index, setIndex] = useState(0);
const screens = app.screens.slice(0, 5);
const active = screens[index];
const go = (offset: number) => setIndex((value) => (value + offset + screens.length) % screens.length);

return (
<article
  data-app-discovery-card="true"
  className="app-discovery-card"
  role="link"
  tabIndex={0}
  aria-label={`Open ${app.app}`}
  onClick={onOpen}
  onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }}
>
    <span className="app-discovery-card__media">
      <span className="app-discovery-card__preview">
        <PlaceholderImage src={active?.thumbnailUrl ?? active?.url} accent={app.accent} />
      </span>
      {status && status !== 'Complete' ? <span className="app-discovery-card__badge"><Badge label={status} variant={STATUS_VARIANT[status]} /></span> : null}
      {screens.length > 1 ? (
        <>
          <ArrowButton direction="left" visible onClick={() => go(-1)} />
          <ArrowButton direction="right" visible onClick={() => go(1)} />
        </>
      ) : null}
    </span>
    <span className="app-discovery-card__identity">
      <span className="app-discovery-card__logo">{app.iconUrl ? <img src={app.iconUrl} alt="" /> : app.app.slice(0, 1).toUpperCase()}</span>
      <span className="app-discovery-card__copy">
        <strong>{app.app}</strong>
        <span>{app.description || app.cat}</span>
        {progressLabel && status && status !== 'Complete' ? <small>{progressLabel}</small> : null}
      </span>
    </span>
</article>
);
```

Update imports to use `useState`, `PlaceholderImage`, and `ArrowButton`, and
remove the `PreviewCarouselCard` import.

Use the existing `PlaceholderImage` for real screenshots and its established failure fallback. Do not add copied Mobbin images or fabricated assets.

- [ ] **Step 5: Run render and status tests to verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/ImportDialog.test.tsx
```

Expected: the new discovery render test passes; existing in-progress badge coverage remains green.

- [ ] **Step 6: Commit the page and card**

```bash
git add src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/components/AppCard.tsx src/vitrine/AppsDiscovery.test.tsx src/vitrine/ImportDialog.test.tsx
git commit -m "feat: add Mobbin-style Apps discovery page"
```

### Task 4: Integrate the Apps route without changing behavior

**Files:**
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Replace the obsolete shell boundary with failing Apps discovery assertions**

Change the old `keeps Apps on the shared gallery shell...` test to:

```ts
test('renders Apps through its discovery page outside the admin AppShell', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /from ['"]\.\/components\/AppsDiscoveryPage\.tsx['"]/);
  assert.match(source, /if \(route\.name === 'apps'\) \{[\s\S]*?<AppsDiscoveryPage/);
  assert.doesNotMatch(source, /if \(route\.name === 'apps'\) \{[\s\S]{0,160}?return frame\(/);
});
```

Update retry, terminal filtering, and count assertions to target
`AppsDiscoveryPage` props and `filterAndSortApps`. Keep the existing tests for:

- no `useJobs`;
- no `fetch('/api/jobs')`;
- `IntersectionObserver`;
- `appsSentinelRef`;
- `loadMore`;
- `/api/catalog` versus `/api/apps`;
- search and overlay state;
- independent Sites state.

- [ ] **Step 2: Run the boundary suite to verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: FAIL because `App.tsx` still imports and renders `ReferenceGalleryShell` for Apps.

- [ ] **Step 3: Route `/apps` through `AppsDiscoveryPage`**

In `App.tsx`:

1. Import `AppsDiscoveryPage` and `AppsFacet`.
2. Replace `cat` with:

```tsx
const [appFacet, setAppFacet] = useState<AppsFacet | null>(null);
```

3. Change Command Palette category handoff to:

```tsx
onSelectCategory={(value) => setAppFacet(value === 'All' ? null : { group: 'categories', value })}
```

4. Keep `appsSentinelRef`, the `IntersectionObserver`, `refreshApps`, `loadMore`,
   import dialog, search results, and discovery overlays unchanged.
5. Replace the three Apps shell branches with one route-owned branch:

```tsx
if (route.name === 'apps') {
  return (
    <>
      <AppsDiscoveryPage
        apps={appsLoading ? null : apps}
        isAdmin={isAdmin}
        query={q}
        facet={appFacet}
        onFacetChange={setAppFacet}
        onOpenSearch={() => void openPalette()}
        searchMode={canUseAdvancedSearch ? 'advanced' : 'legacy'}
        onImport={() => setImportOpen(true)}
        onOpenApp={(appId) => void openApp(appId)}
        onRetry={() => void refreshApps()}
        totalApps={totalApps}
        error={appsError}
        hasMore={hasMore}
        loadingMore={loadingMore}
        sentinelRef={appsSentinelRef}
        accountControls={accountControls}
        beforeGrid={
          <>
            {isAdmin ? <ProgressBanner /> : null}
            {searchError ? <div role="alert" className="apps-discovery__search-error">{searchError}</div> : null}
            {q.trim() && searchResult ? <SearchResults result={searchResult} filters={filters} onFiltersChange={setFilters} onOpen={(appId) => void openApp(appId)} collections={collections} onCollectionsChange={setCollections} /> : null}
          </>
        }
      />
      {discoveryOverlays}
      {isAdmin ? <ImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} submitImport={submitUrlImport} /> : null}
      {unlockTarget && entitlements ? <UnlockModal appId={unlockTarget} remaining={entitlements.freeUnlocksRemaining} onConfirm={confirmUnlock} onClose={() => setUnlockTarget(null)} onUpgrade={() => { setUnlockTarget(null); navigate({ name: 'pricing' }); }} /> : null}
    </>
  );
}
```

6. Leave the App detail return inside `frame(...)`; only the Apps gallery bypasses
   the admin shell.

- [ ] **Step 4: Run focused behavior tests to verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/appsApi.test.ts src/vitrine/jobsApi.test.ts
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/ImportDialog.test.tsx src/vitrine/Sites.test.tsx
```

Expected: all focused tests pass with zero Apps job-read assertion failures.

- [ ] **Step 5: Commit route integration**

```bash
git add src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "feat: render Apps in discovery layout"
```

### Task 5: Measured styling, responsive checks, and visual QA

**Files:**
- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Output: `artifacts/apps-ui-comparison/03-astryx-apps-final.png`
- Output: `artifacts/apps-ui-comparison/04-apps-side-by-side.png`

- [ ] **Step 1: Add failing CSS boundary assertions**

Append:

```tsx
import { readFileSync } from 'node:fs';

test('keeps the measured Mobbin Apps desktop geometry and responsive grid', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.apps-top-nav[\s\S]*height:\s*72px/);
  assert.match(css, /\.apps-discovery__content[\s\S]*padding:\s*0 32px/);
  assert.match(css, /\.apps-discovery__taxonomy[\s\S]*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.apps-discovery__grid[\s\S]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.app-discovery-card__media[\s\S]*aspect-ratio:\s*1/);
  assert.match(css, /\.app-discovery-card[\s\S]*border-radius:\s*28px/);
  assert.match(css, /@media \(max-width:\s*1080px\)[\s\S]*\.apps-discovery__grid[\s\S]*repeat\(2/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.apps-discovery__grid[\s\S]*grid-template-columns:\s*1fr/);
});
```

- [ ] **Step 2: Run the CSS test to verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because the Apps discovery selectors are absent.

- [ ] **Step 3: Add the measured Apps CSS**

Add a single `/* Mobbin Apps fidelity — source measured at 1512px. */` block
after the Sites fidelity block. It must encode:

```css
.apps-discovery {
  width: 100%;
  min-height: 100vh;
  padding: 0 0 96px;
  background: var(--color-background-body);
}

.apps-top-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 72px;
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(320px, 512px) minmax(300px, 1fr);
  align-items: center;
  gap: 32px;
  padding: 0 32px;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background-body) 96%, transparent);
  backdrop-filter: blur(18px);
}

.apps-discovery__content { padding: 0 32px; }
.apps-discovery__taxonomy {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px;
  padding: 29px 0 72px;
}
.apps-discovery__facet h2 {
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
}
.apps-discovery__facet > div { display: grid; }
.apps-discovery__facet button {
  width: max-content !important;
  height: 32px !important;
  justify-content: flex-start !important;
  padding: 0 !important;
  font-size: 24px !important;
  font-weight: 600 !important;
}
.apps-discovery__toolbar {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 24px;
  border-top: 1px solid var(--color-border);
}
.apps-discovery__platform,
.apps-discovery__sort { display: flex; align-items: center; gap: 4px; }
.apps-discovery__sort { gap: 25px; }
.apps-discovery__toolbar > button:last-child { margin-left: auto; }
.apps-discovery__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 16px;
}
.app-discovery-card {
  min-width: 0;
  overflow: hidden;
  border-radius: 28px;
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}
.app-discovery-card {
  padding: 16px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.app-discovery-card__media {
  position: relative;
  aspect-ratio: 1;
  display: block;
  overflow: hidden;
  border-radius: 20px;
  background: var(--color-background-muted);
}
.app-discovery-card__preview {
  position: absolute;
  inset: 18% 8% 8%;
  overflow: hidden;
  border-radius: 12px;
}
.app-discovery-card__identity {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 12px;
  padding: 18px 2px 4px;
}
```

Group Apps top-nav descendant geometry with the equivalent Sites selectors, so
brand, type tabs, search, and account actions stay visually identical without
changing the Sites values.

Add 1080 px two-column/two-column taxonomy rules and 720 px one-column/wrapped
navigation rules matching the approved spec.

- [ ] **Step 4: Run focused tests and the production build**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx src/vitrine/ImportDialog.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/appsApi.test.ts src/vitrine/jobsApi.test.ts
npm run build
git diff --check
```

Expected: all tests pass, Vite build exits 0, and diff check is clean.

- [ ] **Step 5: Verify in Chrome at the source viewport**

Using the already selected Chrome MCP:

1. Open Mobbin `https://mobbin.com/discover/apps/web/latest`.
2. Open the local `/apps` route.
3. Set both to 1512 x 834 only for this comparison.
4. Confirm the local shell is stable; reject loading, error, blank, or wrong-route captures.
5. Save `artifacts/apps-ui-comparison/03-astryx-apps-final.png`.
6. Inspect the saved file.
7. Compare it beside `01-mobbin-apps.png` and save `04-apps-side-by-side.png`.
8. Check nav height, 32 px gutters, taxonomy column positions, control-row position,
   card count, card radius, media crop, logo/description alignment, and empty/error
   state placement.
9. Fix visible mismatches and repeat focused tests plus the comparison capture.
10. Reset the temporary viewport override and keep the final local Apps tab open.

Expected: the local Apps hierarchy and proportions match the reference while
using Astryx data and components.

- [ ] **Step 6: Commit the styling and verified output**

```bash
git add src/vitrine/styles.css src/vitrine/AppsDiscovery.test.tsx
git commit -m "style: match Mobbin Apps discovery layout"
```

## Final verification

- [ ] Run the complete frontend behavior slice without touching the application database:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/appsApi.test.ts src/vitrine/jobsApi.test.ts src/vitrine/router.test.ts src/vitrine/routeAccess.test.ts
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/ImportDialog.test.tsx src/vitrine/Sites.test.tsx src/vitrine/PreviewCarouselCard.test.tsx
```

Expected: all selected frontend and API-boundary tests pass. Do not run
database-backed suites against the configured Vitrine application database.

- [ ] Run a final production build:

```bash
npm run build
```

Expected: exit 0.

- [ ] Recheck the behavior boundaries:

```bash
rg -n "useJobs|fetch\\(.?/api/jobs|setInterval" src/vitrine/App.tsx src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/appsDiscovery.ts
```

Expected: no output.

- [ ] Review the complete diff:

```bash
git diff HEAD~5 -- src/vitrine/App.tsx src/vitrine/appsDiscovery.ts src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/components/ReferenceDiscoveryTopNav.tsx src/vitrine/components/SitesTopNav.tsx src/vitrine/components/AppCard.tsx src/vitrine/styles.css src/vitrine/App.boundary.test.ts src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx src/vitrine/ImportDialog.test.tsx
```

Expected: only the approved Apps gallery, shared nav extraction, tests, and
measured styling are present; Sites visible behavior is unchanged.
