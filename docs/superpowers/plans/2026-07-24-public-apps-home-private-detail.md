# Public Apps Home with Private App Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/apps` Vitrine's public Home/catalog page while keeping every App-detail route and API private and leaving `src/vitrine/Home.tsx` unchanged.

**Architecture:** Keep one Apps gallery implementation in `App.tsx`. Add a small, testable route-access policy used by `Root`, render the existing catalog in guest mode, and gate authenticated controls and requests by capability. Preserve `/api/catalog` as the public data source and keep all `/api/apps/:app...` routes behind the existing API authentication middleware.

**Tech Stack:** React 19, TypeScript, Vite, `@astryxdesign/core`, Node test runner, React server rendering tests, Express API tests.

**Design specification:** `docs/superpowers/specs/2026-07-24-public-apps-home-private-detail-design.md`

---

## File Structure

### Create

- `src/vitrine/routeAccess.ts` — pure public/private route policy for logged-out visitors.
- `src/vitrine/routeAccess.test.ts` — table-driven unit coverage for every route name.
- `src/vitrine/components/GuestCatalogControls.tsx` — public catalog authentication actions.
- `src/vitrine/GuestCatalogControls.test.tsx` — rendered labels and action wiring.
- `src/vitrine/publicAppsBoundary.test.ts` — guest-capability and Landing-file boundaries that do not overlap the currently modified `App.boundary.test.ts`.

### Modify

- `src/vitrine/main.tsx` — render `/apps` for guests, keep detail routes private, and send public Browse actions to `/apps`.
- `src/vitrine/mainBoundary.test.ts` — verify Root uses the route policy and public Browse wiring.
- `src/vitrine/App.tsx` — derive guest capabilities, render guest controls, and prevent protected search/collection requests.
- `services/api/src/app.test.ts` — prove the public catalog/private detail HTTP boundary remains intact.

### Must Not Modify

- `src/vitrine/Home.tsx` — the existing logged-out Landing component.
- Database schema or migrations.
- App-detail API route implementations.
- Existing dirty Sites, database, and design-QA files outside this feature.

---

### Task 1: Make the `/apps` route publicly renderable

**Files:**
- Create: `src/vitrine/routeAccess.ts`
- Create: `src/vitrine/routeAccess.test.ts`
- Modify: `src/vitrine/main.tsx:1-68`
- Modify: `src/vitrine/mainBoundary.test.ts`

- [ ] **Step 1: Write the failing route-access tests**

Create `src/vitrine/routeAccess.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresAuthentication } from './routeAccess.ts';
import type { Route } from './router.ts';

const privateRoutes: Route[] = [
  { name: 'signin' },
  { name: 'billing-success' },
  { name: 'settings-billing' },
  { name: 'search' },
  { name: 'app', appId: 'linear' },
  { name: 'sites' },
  { name: 'site-version', siteId: 1, versionId: 1 },
  { name: 'projects' },
  { name: 'project', projectId: 1 },
  { name: 'feature-document', documentId: 1 },
  { name: 'admin' },
];

const publicRoutes: Route[] = [
  { name: 'landing' },
  { name: 'build-in-public' },
  { name: 'pricing' },
  { name: 'apps' },
  { name: 'feature-document-share', token: 'public-token' },
];

test('keeps Apps public while App details and member routes require authentication', () => {
  for (const route of privateRoutes) {
    assert.equal(requiresAuthentication(route), true, route.name);
  }
  for (const route of publicRoutes) {
    assert.equal(requiresAuthentication(route), false, route.name);
  }
});
```

- [ ] **Step 2: Run the test and verify the missing policy fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/routeAccess.test.ts
```

Expected: FAIL because `src/vitrine/routeAccess.ts` does not exist.

- [ ] **Step 3: Implement the route-access policy**

Create `src/vitrine/routeAccess.ts`:

```typescript
import type { Route } from './router.ts';

const AUTHENTICATED_ROUTE_NAMES = new Set<Route['name']>([
  'signin',
  'billing-success',
  'settings-billing',
  'search',
  'app',
  'sites',
  'site-version',
  'projects',
  'project',
  'feature-document',
  'admin',
]);

export function requiresAuthentication(route: Route): boolean {
  return AUTHENTICATED_ROUTE_NAMES.has(route.name);
}
```

- [ ] **Step 4: Update Root without changing the Landing component**

In `src/vitrine/main.tsx`, import the policy:

```typescript
import { requiresAuthentication } from './routeAccess.ts';
```

Change public Browse wiring:

```tsx
if (route.name === 'pricing') {
  return <Pricing user={user} onBrowse={goApps} onSignIn={goSignIn} />;
}

if (route.name === 'build-in-public') {
  return <BuildInPublicPage onHome={goHome} onBrowse={goApps} onPricing={goPricing} />;
}
```

Replace the logged-in/private-route block with:

```tsx
if (user) return <App />;
if (route.name === 'apps') return <App />;
if (requiresAuthentication(route)) {
  return <SignIn authenticate={authenticate} register={register} onSignedIn={completeLogin} />;
}
return (
  <Home
    onBrowse={goApps}
    onPricing={goPricing}
    onBuildInPublic={goBuildInPublic}
    onLogin={goSignIn}
  />
);
```

The `/apps/:appId` location remains unchanged while `SignIn` is rendered, so `completeLogin` naturally re-renders the requested App detail.

- [ ] **Step 5: Add the Root source-boundary assertions**

Append to `src/vitrine/mainBoundary.test.ts`:

```typescript
test('renders the Apps catalog publicly while preserving private detail routing', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');

  assert.match(source, /if \(route\.name === 'apps'\) return <App \/>/);
  assert.match(source, /if \(requiresAuthentication\(route\)\)/);
  assert.ok(
    source.indexOf("route.name === 'apps'") < source.indexOf('requiresAuthentication(route)'),
  );
  assert.match(source, /<Home[\s\S]*onBrowse=\{goApps\}/);
  assert.doesNotMatch(source, /route\.name === 'apps'[\s\S]*<SignIn/);
});
```

- [ ] **Step 6: Run the focused routing tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/routeAccess.test.ts \
  src/vitrine/mainBoundary.test.ts
```

Expected: 3 tests PASS with zero failures.

- [ ] **Step 7: Commit the routing slice**

```bash
git add \
  src/vitrine/routeAccess.ts \
  src/vitrine/routeAccess.test.ts \
  src/vitrine/main.tsx \
  src/vitrine/mainBoundary.test.ts
git commit -m "feat: make apps catalog publicly accessible"
```

---

### Task 2: Render public catalog controls instead of an empty account menu

**Files:**
- Create: `src/vitrine/components/GuestCatalogControls.tsx`
- Create: `src/vitrine/GuestCatalogControls.test.tsx`
- Modify: `src/vitrine/App.tsx:1-215`

- [ ] **Step 1: Write the failing rendered-component test**

Create `src/vitrine/GuestCatalogControls.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GuestCatalogControls } from './components/GuestCatalogControls.tsx';

test('renders labelled public catalog authentication actions', () => {
  const html = renderToStaticMarkup(
    <GuestCatalogControls onSignIn={() => undefined} />,
  );

  assert.match(html, /data-guest-catalog-controls="true"/);
  assert.match(html, />Log in</);
  assert.match(html, />Get started</);
  assert.doesNotMatch(html, /Account|Collections|Settings|Log out/);
});
```

- [ ] **Step 2: Run the test and verify the missing component fails**

Run:

```bash
tsx --test src/vitrine/GuestCatalogControls.test.tsx
```

Expected: FAIL because `GuestCatalogControls.tsx` does not exist.

- [ ] **Step 3: Implement the focused guest controls**

Create `src/vitrine/components/GuestCatalogControls.tsx`:

```tsx
import { Button } from '@astryxdesign/core';

export function GuestCatalogControls({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div
      data-guest-catalog-controls="true"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
      }}
    >
      <Button label="Log in" variant="ghost" size="sm" clickAction={onSignIn} />
      <Button label="Get started" variant="primary" size="sm" clickAction={onSignIn} />
    </div>
  );
}
```

- [ ] **Step 4: Switch App account controls by authenticated capability**

In `src/vitrine/App.tsx`, import the component:

```typescript
import { GuestCatalogControls } from './components/GuestCatalogControls.tsx';
```

After reading `user`, derive guest state and the sign-in action:

```typescript
const isGuest = user === null;
const openSignIn = () => navigate({ name: 'signin' });
```

Replace the single account dropdown constant with:

```tsx
const accountControls = user ? (
  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
    <DropdownMenu
      button={{ label: user.email, size: 'sm', variant: 'ghost' }}
      hasChevron
      items={[
        ...(researchProjectsEnabled
          ? [{ label: 'Research projects', onClick: () => navigate({ name: 'projects' }) }]
          : []),
        {
          label: `Collections${collectionsLoaded && collections.length ? ` (${collections.length})` : ''}`,
          onClick: () => void openCollections(),
        },
        { label: 'Settings', onClick: () => setSettingsOpen(true) },
        { type: 'divider' },
        { label: 'Log out', onClick: logout },
      ]}
    />
  </div>
) : (
  <GuestCatalogControls onSignIn={openSignIn} />
);
```

`ReferenceGalleryShell` already accepts `memberControls`, so the loading, error, empty, and populated guest states receive the same actions without duplicating page chrome.

- [ ] **Step 5: Run the component test**

Run:

```bash
tsx --test src/vitrine/GuestCatalogControls.test.tsx
```

Expected: 1 test PASS.

- [ ] **Step 6: Commit the guest-control slice**

```bash
git add \
  src/vitrine/components/GuestCatalogControls.tsx \
  src/vitrine/GuestCatalogControls.test.tsx \
  src/vitrine/App.tsx
git commit -m "feat: add guest controls to apps home"
```

---

### Task 3: Keep guest discovery public-safe

**Files:**
- Create: `src/vitrine/publicAppsBoundary.test.ts`
- Modify: `src/vitrine/App.tsx:55-150`
- Modify: `src/vitrine/App.tsx:430-550`

- [ ] **Step 1: Write the failing guest-capability boundary tests**

Create `src/vitrine/publicAppsBoundary.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('keeps guest Apps discovery on public catalog capabilities', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const isGuest = user === null/);
  assert.match(source, /const canUseAdvancedSearch = advancedSearchEnabled && user !== null/);
  assert.match(source, /if \(user\) await ensureCollections\(\)/);
  assert.match(source, /mode=\{canUseAdvancedSearch \? 'advanced' : 'legacy'\}/);
  assert.match(source, /canUseAdvancedSearch \? \(\s*<QuickSearch/);
  assert.match(source, /\{user && collectionsOpen && <CollectionsPanel/);
  assert.match(source, /\{canUseAdvancedSearch && advancedPreview \?/);
});

test('keeps Landing implementation outside the public Apps change', async () => {
  const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');

  assert.match(home, /export function Home/);
  assert.doesNotMatch(home, /GuestCatalogControls|requiresAuthentication|isGuest/);
});
```

- [ ] **Step 2: Run the tests and verify the guest gates fail**

Run:

```bash
node --experimental-strip-types --test src/vitrine/publicAppsBoundary.test.ts
```

Expected: the guest-capability test FAILS because the new gates are not implemented yet.

- [ ] **Step 3: Prevent guest search from calling protected services**

In `src/vitrine/App.tsx`, derive:

```typescript
const canUseAdvancedSearch = advancedSearchEnabled && user !== null;
```

Change `openPalette`:

```typescript
const openPalette = async () => {
  if (user) await ensureCollections().catch(() => []);
  setPaletteOpen(true);
};
```

Use the capability for both Search triggers:

```tsx
mode={canUseAdvancedSearch ? 'advanced' : 'legacy'}
```

Derive the props that separate guest-safe local discovery from authenticated member behavior:

```typescript
const paletteCollections = user ? collections : [];
const palettePlan = user ? customerPlan : 'free';
const paletteUpgrade = user ? openPricing : openSignIn;
```

Use those capabilities when choosing the search surface:

```tsx
{paletteOpen && (
  canUseAdvancedSearch ? (
    <QuickSearch
      initialQuery=""
      recent={typeof window === 'undefined' ? [] : readRecentSearches(window.localStorage)}
      onClose={() => setPaletteOpen(false)}
      onPreview={(item) => {
        setPaletteOpen(false);
        setAdvancedPreview(item);
      }}
      onViewAll={(value) => {
        const handoff = quickSearchHandoff(value);
        setPaletteOpen(false);
        window.history.pushState(null, '', `/search${handoff.search ? `?${handoff.search}` : ''}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
    />
  ) : (
    <CommandPalette
      apps={apps ?? []}
      query={q}
      result={searchResult}
      searchLoading={searchLoading}
      searchError={searchError}
      collections={paletteCollections}
      plan={palettePlan}
      onUpgrade={paletteUpgrade}
      onCollectionsChange={user ? setCollections : () => undefined}
      onQueryChange={setQ}
      onRetrySearch={() => setSearchRetry((value) => value + 1)}
      onClose={() => setPaletteOpen(false)}
      onSelectApp={(appId) => void openApp(appId)}
      onSelectScreen={(appId) => navigate({ name: 'app', appId, section: 'screens' })}
      onSelectFlow={(appId) => navigate({ name: 'app', appId, section: 'flows' })}
      onSelectCategory={setCat}
    />
  )
)}
```

Authenticated members therefore retain their existing Collections and plan props, while guests receive empty Collections, the Free plan, and a sign-in upgrade action.

- [ ] **Step 4: Gate member-only overlays**

Change the overlay conditions in `src/vitrine/App.tsx`:

```tsx
{user && collectionsOpen && (
  <CollectionsPanel
    collections={collections}
    plan={customerPlan}
    onUpgrade={openPricing}
    onChange={setCollections}
    onClose={() => setCollectionsOpen(false)}
    onOpenApp={(appId) => void openApp(appId)}
  />
)}
```

Keep the existing Settings condition, which already requires `user`, and change advanced preview to:

```tsx
{canUseAdvancedSearch && advancedPreview ? (
  <AdvancedSearchPreview
    item={advancedPreview}
    onClose={() => setAdvancedPreview(null)}
    collections={collections}
    onCollectionsChange={setCollections}
    plan={customerPlan}
    comparison={comparison}
    onComparisonChange={setComparison}
  />
) : null}
```

- [ ] **Step 5: Run guest and existing Apps boundaries**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/publicAppsBoundary.test.ts \
  src/vitrine/App.boundary.test.ts
```

Expected: all tests PASS, including the existing zero-`GET /api/jobs` boundary.

- [ ] **Step 6: Commit the guest-discovery slice**

Because `src/vitrine/App.boundary.test.ts` already contains unrelated working-tree edits, do not stage it.

```bash
git add \
  src/vitrine/App.tsx \
  src/vitrine/publicAppsBoundary.test.ts
git commit -m "feat: keep guest apps discovery public safe"
```

---

### Task 4: Lock the public catalog/private detail API boundary

**Files:**
- Modify: `services/api/src/app.test.ts:1895-1970`

- [ ] **Step 1: Add the explicit API authorization test**

Extend the existing `"serves public catalog previews without exposing the admin gallery"` test in `services/api/src/app.test.ts`:

```typescript
test("keeps the catalog public and every App detail endpoint private", async (t) => {
  const { base, server } = await serve(createApiApp({
    allImages: async () => catalogImages,
    publishedPreviewImages: async () => [{ ...catalogImages[0], preview_rank: 1 }],
    resolveSession: async () => undefined,
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/catalog`)).status, 200);
  assert.equal((await fetch(`${base}/preview-media/linear/1`)).status, 503);

  const privatePaths = [
    '/apps/linear',
    '/apps/linear/versions',
    '/apps/linear/screens?platform=web',
    '/apps/linear/ui-elements?platform=web',
    '/apps/linear/flows?platform=web',
    '/apps/linear/page-preview/1',
  ];

  for (const path of privatePaths) {
    assert.equal((await fetch(`${base}${path}`)).status, 401, path);
  }
});
```

The preview route returns `503` in this fixture because no object store is configured; reaching that public handler instead of returning `401` is the boundary assertion.

- [ ] **Step 2: Run the focused API test**

Run:

```bash
node --experimental-strip-types --test \
  --test-name-pattern="keeps the catalog public and every App detail endpoint private" \
  services/api/src/app.test.ts
```

Expected: 1 matching test PASS; unrelated tests are skipped by the name pattern.

- [ ] **Step 3: Confirm no API implementation moved across middleware**

Run:

```bash
git diff -- services/api/src/app.ts
```

Expected: no output. The existing middleware already protects App details, so this task adds a regression test only.

- [ ] **Step 4: Commit the API boundary test**

```bash
git add services/api/src/app.test.ts
git commit -m "test: lock private app detail boundary"
```

---

### Task 5: Verify behavior and the Landing no-touch boundary

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Run focused tests**

```bash
node --experimental-strip-types --test \
  src/vitrine/routeAccess.test.ts \
  src/vitrine/mainBoundary.test.ts \
  src/vitrine/publicAppsBoundary.test.ts \
  src/vitrine/App.boundary.test.ts
tsx --test \
  src/vitrine/GuestCatalogControls.test.tsx \
  src/vitrine/ReferenceGalleryShell.test.tsx
node --experimental-strip-types --test \
  --test-name-pattern="catalog public|public catalog previews|private data without a session" \
  services/api/src/app.test.ts
```

Expected: all selected tests PASS with zero failures.

- [ ] **Step 2: Run the full automated verification**

```bash
npm test
npm run build
git diff --check
```

Expected:

- `npm test` exits 0;
- the Vite production build exits 0;
- `git diff --check` prints no whitespace errors.

- [ ] **Step 3: Verify the final file boundary**

Record the pre-implementation blob for the Landing component from the design commit:

```bash
git rev-parse 5acc4fb:src/vitrine/Home.tsx
git hash-object src/vitrine/Home.tsx
```

Expected: both object IDs are identical.

Check the feature commits:

```bash
git diff --name-only 5acc4fb..HEAD
```

Expected feature files:

```text
services/api/src/app.test.ts
src/vitrine/App.tsx
src/vitrine/GuestCatalogControls.test.tsx
src/vitrine/components/GuestCatalogControls.tsx
src/vitrine/main.tsx
src/vitrine/mainBoundary.test.ts
src/vitrine/publicAppsBoundary.test.ts
src/vitrine/routeAccess.test.ts
src/vitrine/routeAccess.ts
```

`src/vitrine/Home.tsx` must not appear.

- [ ] **Step 4: Run browser acceptance in the in-app browser**

Start the existing development services, then verify:

1. Clear or omit the authentication cookie.
2. Open `/apps`.
3. Confirm the real published catalog, guest **Log in** and **Get started** controls, search trigger, category filtering, and progressive loading are visible.
4. Open an App card and confirm SignIn appears while `/apps/:appId` remains in the address bar.
5. Complete authentication with a test account and confirm the requested App detail loads.
6. Log out from `/apps` and confirm the catalog remains visible with guest controls.
7. Open `/landing` and compare it with the pre-change screenshot to confirm the Landing page is unchanged.
8. Inspect network requests while opening guest search and confirm there are no calls to Collections, entitlements, jobs, advanced search, or App-detail endpoints.
