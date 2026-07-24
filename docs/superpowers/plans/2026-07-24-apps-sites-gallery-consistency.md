# Apps and Sites Gallery Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/apps` and `/sites` render the same reference-gallery shell while retaining their route-specific data, search, import, cards, and pagination behavior.

**Architecture:** Add one presentation-only `ReferenceGalleryShell` that owns the shared header, member identity row, tabs, sticky toolbar, result metadata, grid, and page-state layout. Keep App and Site loading/fetching in their current owners, passing specialized controls and content into the shell as React slots.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, Node test runner, React server rendering, Vite

---

## File Map

- Create `src/vitrine/components/ReferenceGalleryShell.tsx`: shared Apps/Sites gallery chrome, skeletons, state region, and grid.
- Create `src/vitrine/ReferenceGalleryShell.test.tsx`: focused rendering contract for admin/member chrome and loading/empty states.
- Modify `src/vitrine/components/SitesPage.tsx`: render Site controls and states through the shared shell.
- Modify `src/vitrine/Sites.test.tsx`: preserve Site-specific behavior and prove member/admin shell parity.
- Modify `src/vitrine/App.tsx`: render Apps loading, error, empty, and populated gallery through the shared shell.
- Modify `src/vitrine/App.boundary.test.ts`: require both route owners to use the shared shell and preserve the zero-jobs-read boundary.

### Task 1: Build the Shared Reference Gallery Shell

**Files:**
- Create: `src/vitrine/ReferenceGalleryShell.test.tsx`
- Create: `src/vitrine/components/ReferenceGalleryShell.tsx`

- [ ] **Step 1: Write the failing shell rendering tests**

Create `src/vitrine/ReferenceGalleryShell.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@astryxdesign/core';
import { ReferenceGalleryShell } from './components/ReferenceGalleryShell.tsx';

test('renders the member identity, controls, tabs, count, and shared grid', () => {
  const html = renderToStaticMarkup(
    <ReferenceGalleryShell
      active="sites"
      isAdmin={false}
      toolbar={<div>Site search</div>}
      memberControls={<button type="button">Account</button>}
      countLabel="2 sites"
    >
      <article>Site card</article>
    </ReferenceGalleryShell>,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.match(html, /data-reference-gallery-identity="true"/);
  assert.match(html, />Vitrine</);
  assert.match(html, />Account</);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /2 sites/);
  assert.match(html, /data-reference-gallery-grid="true"/);
  assert.doesNotMatch(html, /<h1[^>]*>References<\/h1>/);
});

test('renders the admin header action without the member identity', () => {
  const html = renderToStaticMarkup(
    <ReferenceGalleryShell
      active="apps"
      isAdmin
      headerAction={<Button variant="primary" label="Import from URL" clickAction={() => undefined} />}
      toolbar={<div>App search</div>}
      countLabel="3 apps"
    >
      <article>App card</article>
    </ReferenceGalleryShell>,
  );

  assert.match(html, /<h1[^>]*>References<\/h1>/);
  assert.match(html, /Browse app and website design references/);
  assert.match(html, /Import from URL/);
  assert.doesNotMatch(html, /data-reference-gallery-identity="true"/);
});

test('renders loading and message states inside the shared shell', () => {
  const loading = renderToStaticMarkup(
    <ReferenceGalleryShell active="sites" isAdmin toolbar={<div>Search</div>} loading />,
  );
  const empty = renderToStaticMarkup(
    <ReferenceGalleryShell
      active="sites"
      isAdmin={false}
      toolbar={<div>Search</div>}
      state={{ title: 'No Sites imported yet', description: 'No ready website references are available yet.' }}
    />,
  );

  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-label="Loading Sites"/);
  assert.equal((loading.match(/data-reference-gallery-skeleton="true"/g) ?? []).length, 9);
  assert.match(empty, /No Sites imported yet/);
  assert.match(empty, /No ready website references are available yet/);
  assert.match(empty, /aria-label="Reference type"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/ReferenceGalleryShell.test.tsx
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./components/ReferenceGalleryShell.tsx`.

- [ ] **Step 3: Implement the minimal shared shell**

Create `src/vitrine/components/ReferenceGalleryShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { EmptyState } from '@astryxdesign/core';
import { GalleryCardSkeleton, GalleryToolbar } from './GalleryToolbar.tsx';
import { PageHeader } from './PageHeader.tsx';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ReferenceGalleryState {
  title: string;
  description: string;
  actions?: ReactNode;
  role?: 'alert' | 'status';
}

interface ReferenceGalleryShellProps {
  active: ReferenceType;
  isAdmin: boolean;
  headerAction?: ReactNode;
  toolbar: ReactNode;
  memberControls?: ReactNode;
  beforeCount?: ReactNode;
  countLabel?: string;
  loading?: boolean;
  state?: ReferenceGalleryState;
  children?: ReactNode;
  trailing?: ReactNode;
}

export function ReferenceGalleryShell({
  active,
  isAdmin,
  headerAction,
  toolbar,
  memberControls,
  beforeCount,
  countLabel,
  loading = false,
  state,
  children,
  trailing,
}: ReferenceGalleryShellProps) {
  const label = active === 'apps' ? 'Apps' : 'Sites';

  return (
    <main
      data-reference-gallery-shell={active}
      style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px 72px' }}
    >
      {isAdmin ? (
        <PageHeader
          title="References"
          description="Browse app and website design references."
          action={headerAction}
        />
      ) : null}
      <ReferenceTypeTabs active={active} />
      <GalleryToolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {!isAdmin ? (
            <div
              data-reference-gallery-identity="true"
              style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 11, height: 11, borderRadius: 3, background: '#FFFFFF' }} />
              </div>
              <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Vitrine
              </span>
            </div>
          ) : null}
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>{toolbar}</div>
          {!isAdmin ? memberControls : null}
        </div>
      </GalleryToolbar>
      {beforeCount}
      {countLabel ? (
        <div style={{ padding: '6px 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {countLabel}
        </div>
      ) : null}
      {loading ? (
        <div role="status" aria-label={`Loading ${label}`}>
          <div
            data-reference-gallery-grid="true"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}
          >
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} data-reference-gallery-skeleton="true">
                <GalleryCardSkeleton index={index} />
              </div>
            ))}
          </div>
        </div>
      ) : state ? (
        <div role={state.role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, padding: 24 }}>
          <EmptyState title={state.title} description={state.description} actions={state.actions} />
        </div>
      ) : (
        <>
          <div
            data-reference-gallery-grid="true"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}
          >
            {children}
          </div>
          {trailing}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/ReferenceGalleryShell.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit the shared shell**

```bash
git add src/vitrine/ReferenceGalleryShell.test.tsx src/vitrine/components/ReferenceGalleryShell.tsx
git commit -m "feat: add shared reference gallery shell"
```

### Task 2: Move Sites onto the Shared Shell

**Files:**
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/components/SitesPage.tsx`

- [ ] **Step 1: Add failing Sites shell tests**

Extend `src/vitrine/Sites.test.tsx` with:

```tsx
test('renders member Sites with the Apps gallery identity and account-control slots', () => {
  const html = renderToStaticMarkup(
    <SitesPageView
      sites={[site]}
      isAdmin={false}
      query=""
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
      memberControls={<button type="button">Account</button>}
    />,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.match(html, /data-reference-gallery-identity="true"/);
  assert.match(html, />Vitrine</);
  assert.match(html, />Account</);
  assert.doesNotMatch(html, /<h1[^>]*>References<\/h1>/);
});

test('keeps shared Sites chrome visible for errors and no-result searches', () => {
  const error = renderToStaticMarkup(
    <SitesPageView
      sites={[]}
      isAdmin
      error="network down"
      query=""
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
    />,
  );
  const noResults = renderToStaticMarkup(
    <SitesPageView
      sites={[site]}
      isAdmin={false}
      query="missing"
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
    />,
  );

  assert.match(error, /aria-label="Reference type"/);
  assert.match(error, /Could not load Sites/);
  assert.match(error, /network down/);
  assert.match(error, />Retry</);
  assert.match(noResults, /aria-label="Reference type"/);
  assert.match(noResults, /No Sites match this search/);
});
```

- [ ] **Step 2: Run the focused Sites tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx
```

Expected: FAIL because `SitesPageViewProps` does not accept `memberControls` and the shared shell landmarks are absent.

- [ ] **Step 3: Refactor Sites through `ReferenceGalleryShell`**

In `src/vitrine/components/SitesPage.tsx`:

1. Import `type { ReactNode }` alongside the React hooks.
2. Remove direct imports of `EmptyState`, `PageHeader`, `GalleryCardSkeleton`, `GalleryToolbar`, and `ReferenceTypeTabs`.
3. Import `ReferenceGalleryShell`.
4. Add `memberControls?: ReactNode` to `SitesPageViewProps` and `SitesPageProps`.
5. Pass `memberControls` from `SitesPage` into `SitesPageView`.
6. Replace the current page markup with:

```tsx
const toolbar = (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ flex: '1 1 auto', maxWidth: 420 }}>
      <SearchInput value={query} onChange={onQueryChange} placeholder="Search sites, versions, and sections…" />
    </div>
    <Button variant="ghost" label={error ? 'Retry' : 'Refresh'} clickAction={onRefresh} />
  </div>
);

const state = error
  ? {
      title: 'Could not load Sites',
      description: error,
      actions: <Button variant="primary" label="Retry" clickAction={onRefresh} />,
      role: 'alert' as const,
    }
  : sites.length === 0
    ? {
        title: 'No Sites imported yet',
        description: isAdmin
          ? 'Import a Mobbin Sites preview URL to create the first website reference.'
          : 'No ready website references are available yet.',
      }
    : visibleSites.length === 0
      ? {
          title: 'No Sites match this search',
          description: 'Try a Site name, version, or section keyword.',
        }
      : undefined;

return (
  <ReferenceGalleryShell
    active="sites"
    isAdmin={isAdmin}
    headerAction={isAdmin ? <Button variant="primary" label="Import Site" clickAction={onImport} /> : undefined}
    toolbar={toolbar}
    memberControls={memberControls}
    countLabel={`Showing ${visibleSites.length} of ${sites.length} sites`}
    state={state}
  >
    {visibleSites.map((site) => (
      <SiteCard
        key={`${site.id}:${site.versionId}`}
        site={site}
        onOpen={() => onOpen(site)}
      />
    ))}
  </ReferenceGalleryShell>
);
```

For the loading branch, render:

```tsx
return (
  <ReferenceGalleryShell
    active="sites"
    isAdmin={isAdmin}
    toolbar={<SearchInput value="" onChange={() => undefined} placeholder="Search sites, versions, and sections…" />}
    memberControls={memberControls}
    loading
  />
);
```

- [ ] **Step 4: Run the focused shell and Sites tests**

Run:

```bash
npx tsx --test src/vitrine/ReferenceGalleryShell.test.tsx src/vitrine/Sites.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the Sites migration**

```bash
git add src/vitrine/Sites.test.tsx src/vitrine/components/SitesPage.tsx
git commit -m "fix: align Sites with the reference gallery shell"
```

### Task 3: Move Apps onto the Shared Shell

**Files:**
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Add a failing Apps/Sites ownership boundary**

Add this test to `src/vitrine/App.boundary.test.ts`:

```ts
test('renders Apps and Sites through the shared reference gallery shell', async () => {
  const [appSource, sitesSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /from ['"]\.\/components\/ReferenceGalleryShell['"]/);
  assert.match(appSource, /<ReferenceGalleryShell[\s\S]*active="apps"/);
  assert.match(sitesSource, /<ReferenceGalleryShell[\s\S]*active="sites"/);
});
```

- [ ] **Step 2: Run the boundary test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: FAIL because `App.tsx` does not import or render `ReferenceGalleryShell`.

- [ ] **Step 3: Pass member controls into Sites**

Change the Sites route branch in `src/vitrine/App.tsx` to:

```tsx
if (route.name === 'sites') {
  return frame(
    <SitesPage
      isAdmin={isAdmin}
      query={siteQuery}
      onQueryChange={setSiteQuery}
      memberControls={!isAdmin ? accountControls : undefined}
    />,
  );
}
```

- [ ] **Step 4: Render Apps loading through the shared shell**

Split the current combined loading condition so App-detail loading retains its existing fallback and Apps-gallery loading renders:

```tsx
if (route.name === 'apps' && appsLoading) {
  return frame(
    <ReferenceGalleryShell
      active="apps"
      isAdmin={isAdmin}
      toolbar={<Skeleton width={isAdmin ? 420 : 260} height={38} radius={2} />}
      memberControls={!isAdmin ? accountControls : undefined}
      loading
    />,
  );
}
```

Keep the current `route.name === 'app' && (detailGateLoading || detailLoading)` behavior separate so this gallery-only change does not alter detail loading.

- [ ] **Step 5: Render Apps error and empty states through the shared shell**

Replace the Apps error/empty early return with:

```tsx
if (route.name === 'apps' && (appsError || !apps || apps.length === 0)) {
  return frame(
    <ReferenceGalleryShell
      active="apps"
      isAdmin={isAdmin}
      headerAction={isAdmin ? <Button variant="primary" label="Import from URL" clickAction={() => setImportOpen(true)} /> : undefined}
      toolbar={
        <SearchTrigger
          label="Search apps, screens, UI elements, flows…"
          activeCategory={cat}
          onOpen={() => void openPalette()}
          onClearCategory={() => setCat('All')}
          mode={advancedSearchEnabled ? 'advanced' : 'legacy'}
        />
      }
      memberControls={!isAdmin ? accountControls : undefined}
      beforeCount={isAdmin ? <ProgressBanner /> : undefined}
      state={{
        title: appsError ? 'Could not load crawled screens' : 'No screens crawled yet',
        description: appsError
          ? `The catalog could not be loaded: ${appsError}`
          : isAdmin
            ? 'Import captured web screens to build the first observed design system.'
            : 'No curated web apps have been published yet.',
        role: appsError ? 'alert' : undefined,
      }}
    />,
  );
}
```

- [ ] **Step 6: Render the populated Apps gallery through the shared shell**

Import `ReferenceGalleryShell`, remove the duplicated admin header/member identity/tabs/toolbar/count/grid markup, and render the current App-specific content through:

```tsx
<ReferenceGalleryShell
  active="apps"
  isAdmin={isAdmin}
  headerAction={isAdmin ? <Button variant="primary" label="Import from URL" clickAction={() => setImportOpen(true)} /> : undefined}
  toolbar={
    <SearchTrigger
      label={q.trim() || cat !== 'All' ? `${list.length} apps · search or filter…` : 'Search apps, screens, UI elements, flows…'}
      activeCategory={cat}
      onOpen={() => void openPalette()}
      onClearCategory={() => setCat('All')}
      mode={advancedSearchEnabled ? 'advanced' : 'legacy'}
    />
  }
  memberControls={!isAdmin ? accountControls : undefined}
  beforeCount={
    <>
      {isAdmin ? <ProgressBanner /> : null}
      {searchError ? <div role="alert" style={{ margin: '10px 0', color: 'var(--color-text-danger)' }}>{searchError}</div> : null}
      {q.trim() && searchResult ? (
        <SearchResults
          result={searchResult}
          filters={filters}
          onFiltersChange={setFilters}
          onOpen={(appId) => void openApp(appId)}
          collections={collections}
          onCollectionsChange={setCollections}
        />
      ) : null}
    </>
  }
  countLabel={
    isAdmin && !q.trim() && cat === 'All' && totalApps !== null
      ? `Showing ${list.length} of ${totalApps} apps`
      : `${list.length} apps`
  }
  trailing={
    <>
      {hasMore ? <div ref={appsSentinelRef} aria-hidden="true" style={{ height: 1 }} /> : null}
      {loadingMore ? (
        <div role="status" aria-label="Loading" style={{ display: 'flex', justifyContent: 'center', padding: '0 0 40px' }}>
          <Spinner size="sm" aria-hidden="true" />
        </div>
      ) : null}
    </>
  }
>
  {list.map((row) => (
    <AppCard
      key={row.slug}
      app={row.app!}
      onOpen={() => void openApp(row.slug)}
      status={isAdmin ? row.status : undefined}
      progressLabel={`${row.analyzed}/${row.captured} analyzed`}
    />
  ))}
</ReferenceGalleryShell>
```

Keep the surrounding `motion.div` and modal `AnimatePresence` ownership unchanged.

- [ ] **Step 7: Run focused boundary and rendering tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
npx tsx --test src/vitrine/ReferenceGalleryShell.test.tsx src/vitrine/Sites.test.tsx
```

Expected: all focused tests pass, including the existing no-`/api/jobs` assertions.

- [ ] **Step 8: Commit the Apps migration**

```bash
git add src/vitrine/App.boundary.test.ts src/vitrine/App.tsx
git commit -m "fix: align Apps with the reference gallery shell"
```

### Task 4: Verify the Complete Change

**Files:**
- Verify only; fix failures in the files owned by Tasks 1-3.

- [ ] **Step 1: Run all Vitrine component tests**

Run:

```bash
npx tsx --test src/vitrine/*.test.tsx
```

Expected: all Vitrine TSX tests pass.

- [ ] **Step 2: Run the complete repository test command**

Run:

```bash
npm test
```

Expected: all tests pass. If an unrelated pre-existing dirty-worktree test fails, record its exact test name and failure without changing unrelated files.

- [ ] **Step 3: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits successfully; the existing large-chunk warning is acceptable.

- [ ] **Step 4: Check formatting and the scoped diff**

Run:

```bash
git diff --check
git status --short
git diff -- src/vitrine/components/ReferenceGalleryShell.tsx src/vitrine/ReferenceGalleryShell.test.tsx src/vitrine/components/SitesPage.tsx src/vitrine/Sites.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
```

Expected: no whitespace errors; only the requested gallery files and pre-existing unrelated worktree changes appear.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required a correction in the owned files:

```bash
git add src/vitrine/components/ReferenceGalleryShell.tsx src/vitrine/ReferenceGalleryShell.test.tsx src/vitrine/components/SitesPage.tsx src/vitrine/Sites.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "test: verify consistent reference galleries"
```

If no correction was required, do not create an empty commit.
