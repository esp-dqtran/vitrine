# Generic Discovery Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Apps, Sites, and Flows to one URL-backed discovery controller, one shared page layout/filter bar contract, cursor-based infinite scrolling, and one-request filter responses with complete facets and totals.

**Architecture:** Add a headless generic `useDiscoveryController` whose behavior is supplied by a typed page adapter. The adapter owns page-specific URL defaults, filter groups, request serialization, response validation, identity selection, and result rendering. The server returns the same envelope shape for all three catalogs while each store retains its domain-specific query. `DiscoveryPageLayout` owns the stable header/discovery/filter/results/sentinel skeleton; each page supplies taxonomy, filter definitions, and result cards.

**Tech Stack:** React 18, TypeScript, Express, PostgreSQL, Node test runner, React Testing Library, Vite, Playwright/in-app browser

**Execution constraints:** Work directly on `main` per project rules. Do not create a branch or worktree. Preserve all unrelated dirty files. Before every commit, stage only the paths named in that task and inspect `git diff --cached --stat`.

---

## Shared target contract

```ts
export interface DiscoveryFilter {
  group: string;
  value: string;
}

export interface DiscoveryState<Sort extends string> {
  platform: Platform;
  sort: Sort;
  query: string;
  filters: DiscoveryFilter[];
}

export interface DiscoveryFacet {
  group: string;
  value: string;
  count: number;
  section?: string;
}

export interface DiscoveryPage<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
  facets: DiscoveryFacet[];
}

export interface DiscoveryAdapter<T, Sort extends string> {
  defaults: DiscoveryState<Sort>;
  parse(search: string): DiscoveryState<Sort>;
  serialize(state: DiscoveryState<Sort>): string;
  request(state: DiscoveryState<Sort>, cursor: string | null, signal: AbortSignal):
    Promise<DiscoveryPage<T>>;
  itemKey(item: T): string;
}
```

Canonical query parameters:

```text
platform=web
sort=latest
query=settings
filter=categories.Finance
filter=flows.Logging%20out
```

Rules:

- Repeated values in one group use OR semantics.
- Different groups use AND semantics.
- Apps accepts its legacy underscore-delimited `filter` and `content_type` form on read, but every subsequent write uses repeated canonical `filter` values.
- Filter, platform, sort, and query changes replace history only while typing the query; explicit filter/sort/platform actions push history.
- The cursor never appears in the browser URL.
- Each response contains complete facets for the current query/platform with the facet's own group omitted, so users can continue refining without extra API calls.

## Task 1: Add shared discovery contracts and URL codec

**Files:**

- Create: `src/vitrine/discoveryTypes.ts`
- Create: `src/vitrine/discoveryState.ts`
- Create: `src/vitrine/discoveryState.test.ts`
- Modify: `src/vitrine/appsDiscoveryState.ts`
- Modify: `src/vitrine/appsDiscoveryState.test.ts`

- [ ] Write failing tests for canonical parsing, stable serialization order, duplicate removal, invalid values, OR/AND grouping, and Apps legacy query parsing.

```ts
test('round trips repeated filters in stable group/value order', () => {
  const state = parseDiscoveryState(
    '?platform=web&filter=flows.Logging%20out&filter=categories.Finance&filter=flows.Logging%20out',
    defaults,
    definition,
  );
  assert.equal(
    serializeDiscoveryState(state, definition),
    'platform=web&sort=latest&filter=categories.Finance&filter=flows.Logging+out',
  );
});
```

- [ ] Run the focused tests and confirm RED because the shared codec does not exist.

```bash
npx tsx --test src/vitrine/discoveryState.test.ts src/vitrine/appsDiscoveryState.test.ts
```

- [ ] Implement the shared types exactly as shown in the target contract and a codec driven by:

```ts
export interface DiscoveryStateDefinition<Sort extends string> {
  platforms: readonly Platform[];
  sorts: readonly Sort[];
  filterGroups: readonly string[];
  maxQueryLength?: number;
}
```

- [ ] Adapt `parseAppsDiscoveryState` and `serializeAppsDiscoveryState` to delegate canonical behavior to the codec while retaining legacy reads and the Apps `contentType` compatibility field.
- [ ] Re-run the focused tests and confirm GREEN.
- [ ] Run `npm run build`.
- [ ] Commit only these files.

```bash
git add src/vitrine/discoveryTypes.ts src/vitrine/discoveryState.ts \
  src/vitrine/discoveryState.test.ts src/vitrine/appsDiscoveryState.ts \
  src/vitrine/appsDiscoveryState.test.ts
git diff --cached --stat
git commit -m "refactor: standardize discovery URL state"
```

## Task 2: Build the headless discovery controller with TDD

**Files:**

- Create: `src/vitrine/useDiscoveryController.ts`
- Create: `src/vitrine/useDiscoveryController.test.tsx`
- Reference: `src/vitrine/useAdvancedSearch.ts`

- [ ] Write failing controller tests for initial load, URL hydration, debounced query replacement, explicit filter history push, aborting stale requests, append-with-deduplication, retry, reset on state change, and no duplicate request while the sentinel remains visible.

```tsx
const adapter: DiscoveryAdapter<Item, Sort> = {
  defaults,
  parse,
  serialize,
  request,
  itemKey: ({ id }) => id,
};

const { result } = renderHook(() => useDiscoveryController({
  adapter,
  locationSearch,
  onNavigate,
}));
```

- [ ] Run and confirm RED.

```bash
npx tsx --test src/vitrine/useDiscoveryController.test.tsx
```

- [ ] Implement this public result:

```ts
export interface DiscoveryController<T, Sort extends string> {
  state: DiscoveryState<Sort>;
  items: T[];
  facets: DiscoveryFacet[];
  totalCount: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  setPlatform(platform: Platform): void;
  setSort(sort: Sort): void;
  setQuery(query: string): void;
  toggleFilter(filter: DiscoveryFilter): void;
  clearFilterGroup(group: string): void;
  retry(): void;
  retryLoadMore(): void;
}
```

- [ ] Use `AbortController`, a monotonically increasing generation, and an in-flight cursor key. Use one `IntersectionObserver` owned by the hook. Append only items whose `itemKey` is unseen.
- [ ] Keep the query debounce at 180 ms; do not debounce platform, sort, or filters.
- [ ] Re-run the focused tests, then `npm run build`.
- [ ] Commit only the controller and test.

```bash
git add src/vitrine/useDiscoveryController.ts src/vitrine/useDiscoveryController.test.tsx
git diff --cached --stat
git commit -m "feat: add generic discovery controller"
```

## Task 3: Extract the shared discovery page layout and result states

**Files:**

- Create: `src/vitrine/components/DiscoveryPageLayout.tsx`
- Create: `src/vitrine/DiscoveryPageLayout.test.tsx`
- Modify: `src/vitrine/components/ReferenceDiscoveryPageShell.tsx`
- Modify: `src/vitrine/components/AppsFilterBar.tsx`
- Modify: `src/vitrine/AppsFilterBar.test.tsx`
- Modify: `src/vitrine/referenceDiscovery.css`

- [ ] Write failing component tests proving one stable order:

```text
ReferenceDiscoveryTopNav
taxonomy/discovery
DiscoveryFilterBar
result count + sort
results
loading/error/empty state
infinite-scroll sentinel
```

- [ ] Test that the result noun is supplied (`apps`, `sites`, or `flows`), selected filter counts render consistently, and load-more failures render an inline retry without replacing prior results.
- [ ] Run and confirm RED.

```bash
npx tsx --test src/vitrine/DiscoveryPageLayout.test.tsx src/vitrine/AppsFilterBar.test.tsx
```

- [ ] Implement `DiscoveryPageLayout` as a composition component, not a data hook:

```tsx
interface DiscoveryPageLayoutProps {
  kind: 'apps' | 'sites' | 'flows';
  header: ReactNode;
  taxonomyLabel: string;
  taxonomy: ReactNode;
  toolbar: ReactNode;
  resultLabel: string;
  totalCount: number | null;
  loading: boolean;
  error: string | null;
  loadMoreError: string | null;
  onRetry: () => void;
  onRetryLoadMore: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}
```

- [ ] Keep `DiscoveryFilterBar` generic. Rename Apps-only prop/type names when they leak into the public interface, but retain `AppsFilterBar` as a compatibility wrapper until all three migrations pass.
- [ ] Re-run tests and `npm run build`.
- [ ] Commit the extracted layout files only.

```bash
git add src/vitrine/components/DiscoveryPageLayout.tsx \
  src/vitrine/DiscoveryPageLayout.test.tsx \
  src/vitrine/components/ReferenceDiscoveryPageShell.tsx \
  src/vitrine/components/AppsFilterBar.tsx \
  src/vitrine/AppsFilterBar.test.tsx src/vitrine/referenceDiscovery.css
git diff --cached --stat
git commit -m "refactor: share discovery page layout"
```

## Task 4: Replace Apps filter fan-out with one cursor response

**Files:**

- Modify: `src/publicCatalogStore.ts`
- Modify: `src/publicCatalogStore.test.ts`
- Modify: `src/publicFacetPreview.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/useApps.test.ts`

- [ ] Write failing store and route tests for multiple filters, OR-within/AND-across semantics, `totalCount`, complete facets, stable keyset pagination, invalid filter syntax, and a single request for a multi-filter page.
- [ ] Test the exact envelope:

```ts
{
  items: expect.any(Array),
  nextCursor: expect.anything(),
  totalCount: 21,
  facets: [
    { group: 'categories', value: 'Finance', count: 8 },
  ],
}
```

- [ ] Run and confirm RED.

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/publicCatalogStore.test.ts services/api/src/app.test.ts src/vitrine/useApps.test.ts
```

- [ ] Change `publishedCatalogPage` input from one optional facet to `filters?: DiscoveryFilter[]`, build one parameterized SQL predicate per group, and compute `totalCount` plus facets in the same request lifecycle. Never interpolate filter values into SQL.
- [ ] Update `/api/catalog` to parse repeated `filter=<group>.<value>`, while accepting `group/value/platform` during the migration.
- [ ] Make the client issue exactly one `/api/catalog?...` request per state/cursor. Remove `Promise.all` facet fan-out from `useCatalogFacetApps`.
- [ ] Re-run focused tests and `npm run build`.
- [ ] Commit only the listed Apps backend/client files.

```bash
git add src/publicCatalogStore.ts src/publicCatalogStore.test.ts \
  src/publicFacetPreview.ts services/api/src/app.ts services/api/src/app.test.ts \
  src/vitrine/useApps.ts src/vitrine/useApps.test.ts
git diff --cached --stat
git commit -m "feat: return complete app discovery pages"
```

## Task 5: Migrate Apps to the generic controller

**Files:**

- Create: `src/vitrine/appsDiscoveryAdapter.ts`
- Create: `src/vitrine/appsDiscoveryAdapter.test.ts`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] Write failing adapter tests for canonical URL state, request construction, response parsing, and `itemKey`.
- [ ] Write failing page tests showing Apps renders through `DiscoveryPageLayout`, filter changes reset pagination, the sentinel fetches the next page, and the total remains the server total.
- [ ] Run and confirm RED.

```bash
npx tsx --test src/vitrine/appsDiscoveryAdapter.test.ts \
  src/vitrine/AppsDiscovery.test.tsx
```

- [ ] Implement `appsDiscoveryAdapter`; use `App.id` as `itemKey` and `/api/catalog` as the only data endpoint.
- [ ] Replace Apps’ page-owned filtering, cursor, observer, and facet-fetch effects with `useDiscoveryController`.
- [ ] Keep existing Apps cards and detail navigation unchanged.
- [ ] Re-run focused tests, the Apps boundary test, and the build.

```bash
npx tsx --test src/vitrine/appsDiscoveryAdapter.test.ts \
  src/vitrine/AppsDiscovery.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
npm run build
```

- [ ] Commit only the Apps adapter/page/router files.

```bash
git add src/vitrine/appsDiscoveryAdapter.ts src/vitrine/appsDiscoveryAdapter.test.ts \
  src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/App.tsx
git diff --cached --stat
git commit -m "refactor: migrate apps discovery controller"
```

## Task 6: Add server cursor pagination and facets for Sites

**Files:**

- Modify: `src/sitesStore.ts`
- Modify: `src/sitesStore.test.ts`
- Modify: `services/api/src/sites.ts`
- Modify: `services/api/src/sites.test.ts`
- Modify: `src/vitrine/sitesApi.ts`
- Modify: `src/vitrine/sitesApi.test.ts`

- [ ] Write failing tests for `(updated_at, site_id)` keyset pagination, filters (`categories`, `sections`, `styles`), query, sort, total, facets, invalid/tampered cursor, and no duplicates if rows are added between requests.
- [ ] Run and confirm RED.

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/sitesStore.test.ts services/api/src/sites.test.ts src/vitrine/sitesApi.test.ts
```

- [ ] Add `listReadySitesPage` to `SitesStore`:

```ts
listReadySitesPage(input: {
  cursor?: string;
  limit?: number;
  platform: Platform;
  sort: 'latest' | 'popular';
  query?: string;
  filters?: DiscoveryFilter[];
}): Promise<DiscoveryPage<SiteSummary>>;
```

- [ ] Encode a signed-shape opaque cursor containing `snapshotAt`, `updatedAt`, and `siteId`; reject wrong types or impossible values with `SitesCursorError`.
- [ ] Replace the public `/api/sites?limit&offset` response with the shared envelope. Keep the unpaged array only for authenticated/internal callers that still require it during migration.
- [ ] Update `listSitesPage` to accept state plus an opaque cursor and parse `items`, `nextCursor`, `totalCount`, and `facets`.
- [ ] Re-run focused tests and `npm run build`.
- [ ] Commit only the Sites store/API files.

```bash
git add src/sitesStore.ts src/sitesStore.test.ts services/api/src/sites.ts \
  services/api/src/sites.test.ts src/vitrine/sitesApi.ts src/vitrine/sitesApi.test.ts
git diff --cached --stat
git commit -m "feat: paginate site discovery with cursors"
```

## Task 7: Migrate Sites to the generic controller

**Files:**

- Create: `src/vitrine/sitesDiscoveryAdapter.ts`
- Create: `src/vitrine/sitesDiscoveryAdapter.test.ts`
- Modify: `src/vitrine/components/SitesPage.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] Write failing adapter/page tests for URL-backed category/section/style filters, platform and sort changes, query debounce, server totals, sentinel loading, retry, and deduplicated appended Site cards.
- [ ] Run and confirm RED.

```bash
npx tsx --test src/vitrine/sitesDiscoveryAdapter.test.ts src/vitrine/Sites.test.tsx
```

- [ ] Implement `sitesDiscoveryAdapter`; use `${site.id}:${site.versionId}` as `itemKey`.
- [ ] Remove `listSites()` full-catalog loading, local filtering, `renderedCount`, and the page-owned observer from `SitesPage`.
- [ ] Render the same header/discovery/filterbar/meta sequence as Apps through `DiscoveryPageLayout`; keep existing Site cards and detail navigation.
- [ ] Re-run focused tests and `npm run build`.
- [ ] Commit only the Sites adapter/page files.

```bash
git add src/vitrine/sitesDiscoveryAdapter.ts src/vitrine/sitesDiscoveryAdapter.test.ts \
  src/vitrine/components/SitesPage.tsx src/vitrine/Sites.test.tsx src/vitrine/App.tsx
git diff --cached --stat
git commit -m "refactor: migrate sites discovery controller"
```

## Task 8: Stabilize Flow cursors and return complete discovery metadata

**Files:**

- Modify: `src/flowCatalogStore.ts`
- Modify: `src/flowCatalogStore.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/vitrine/flowCatalogApi.ts`
- Modify: `src/vitrine/flowCatalogApi.test.ts`

- [ ] Write failing tests for multi-level flow-name search (parent and child), Flow group filters, stable keyset pagination, total count, facets, sort, invalid cursor, and one request per state/cursor.
- [ ] Run and confirm RED.

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/flowCatalogStore.test.ts services/api/src/app.test.ts \
  src/vitrine/flowCatalogApi.test.ts
```

- [ ] Replace offset cursor encoding with a cursor containing the complete deterministic sort tuple:

```ts
interface FlowCursor {
  snapshotAt: string;
  categoryOther: 0 | 1;
  categoryRank: number;
  categoryCount: number;
  category: string;
  count: number;
  title: string;
}
```

- [ ] Apply tuple comparison after ranking instead of `OFFSET`; preserve `browse` and `grouped` ordering.
- [ ] Return `{items,nextCursor,totalCount,facets}` and accept canonical repeated filters. Search must match child title, parent title, and normalized variants.
- [ ] Update the client parser and URL builder.
- [ ] Re-run focused tests and `npm run build`.
- [ ] Commit only the Flow store/API files.

```bash
git add src/flowCatalogStore.ts src/flowCatalogStore.test.ts \
  services/api/src/app.ts services/api/src/app.test.ts \
  src/vitrine/flowCatalogApi.ts src/vitrine/flowCatalogApi.test.ts
git diff --cached --stat
git commit -m "feat: stabilize flow discovery pagination"
```

## Task 9: Migrate Flows to the generic controller

**Files:**

- Create: `src/vitrine/flowsDiscoveryAdapter.ts`
- Create: `src/vitrine/flowsDiscoveryAdapter.test.ts`
- Modify: `src/vitrine/components/FlowsPage.tsx`
- Modify: `src/vitrine/Flows.test.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] Write failing adapter/page tests for URL hydration, parent/child Flow filters, platform, Popular/Grouped sort, infinite scroll, error recovery, and preserving the existing Flow preview dialog navigation.
- [ ] Run and confirm RED.

```bash
npx tsx --test src/vitrine/flowsDiscoveryAdapter.test.ts src/vitrine/Flows.test.tsx
```

- [ ] Implement `flowsDiscoveryAdapter`; use `${preview.appId}:${preview.version}:${preview.sourceFlowId}:${title}` as `itemKey`.
- [ ] Remove the explicit Load More button and all page-owned request/generation/cursor state.
- [ ] Render Flows through `DiscoveryPageLayout` while retaining `FlowCard`, app-icon navigation, and `FlowPreviewDialog`.
- [ ] Re-run Flow tests and `npm run build`.
- [ ] Commit only the Flow adapter/page files.

```bash
git add src/vitrine/flowsDiscoveryAdapter.ts src/vitrine/flowsDiscoveryAdapter.test.ts \
  src/vitrine/components/FlowsPage.tsx src/vitrine/Flows.test.tsx src/vitrine/App.tsx
git diff --cached --stat
git commit -m "refactor: migrate flows discovery controller"
```

## Task 10: Browser-test every filter and measure/optimize API latency

**Files:**

- Create: `scripts/benchmark-discovery-api.ts`
- Create: `scripts/benchmark-discovery-api.test.ts`
- Modify if evidence requires: the specific store/API files identified by `EXPLAIN (ANALYZE, BUFFERS)`
- Modify if evidence requires: a new numbered migration under `migrations/`
- Modify: `package.json`

- [ ] Write a failing unit test for percentile calculation and benchmark route generation.
- [ ] Implement a script that performs one warm-up plus ten timed requests for representative unfiltered, single-filter, multi-filter, query, and second-page URLs on Apps, Sites, and Flows; report min/median/p95/max, payload bytes, and status.
- [ ] Add:

```json
"discovery:benchmark": "node --env-file-if-exists=.env --import tsx scripts/benchmark-discovery-api.ts"
```

- [ ] Run focused test, full tests, and build:

```bash
npx tsx --test scripts/benchmark-discovery-api.test.ts
npm test
npm run build
```

- [ ] In the in-app browser at `http://127.0.0.1:5176`, verify:

```text
/apps
  Web/iOS/Android
  Categories
  Screens
  UI Elements
  Flows
  multi-select within one group
  combined filters across two groups
  Latest/Trending
  query and URL reload/back/forward
  infinite-scroll second page

/sites
  Web
  Categories
  Sections
  Styles
  multi-select and combined filters
  Latest/Popular
  query and URL reload/back/forward
  infinite-scroll second page

/flows
  Web/iOS/Android
  Flow groups
  parent and child Flow-name query
  Popular/Grouped
  URL reload/back/forward
  infinite-scroll second page
  card opens Flow preview; app icon opens App
```

- [ ] Capture Network evidence that each state change makes one catalog request and scrolling makes one request per cursor. Confirm zero `/api/design-systems/{app}` fan-out.
- [ ] Run the benchmark. If any warm p95 exceeds 500 ms, run the corresponding SQL with `EXPLAIN (ANALYZE, BUFFERS)`, optimize only the evidenced bottleneck, add a regression test/index migration, and rerun the same benchmark.
- [ ] Save benchmark results and browser screenshots in `design-qa.md`; do not commit transient screenshots unless the user requests them.
- [ ] Commit the benchmark harness and any evidence-driven optimization.

```bash
git add scripts/benchmark-discovery-api.ts scripts/benchmark-discovery-api.test.ts \
  package.json design-qa.md
# Add only explicitly created migration/store/API paths after inspecting them.
git diff --cached --stat
git commit -m "test: verify discovery filters and performance"
```

## Task 11: Remove migration shims and run the final regression gate

**Files:**

- Modify: `src/vitrine/components/AppsFilterBar.tsx`
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/sitesApi.ts`
- Modify: `services/api/src/sites.ts`
- Modify: tests covering removed compatibility paths

- [ ] Confirm no page owns an `IntersectionObserver`, cursor, append reducer, or filter URL codec:

```bash
rg -n "IntersectionObserver|nextCursor|renderedCount|serialize.*Discovery|parse.*Discovery" \
  src/vitrine/components/AppsDiscoveryPage.tsx \
  src/vitrine/components/SitesPage.tsx \
  src/vitrine/components/FlowsPage.tsx
```

- [ ] Remove the `AppsFilterBar` compatibility wrapper, unused `useCatalogFacetApps` fan-out path, `listSites()` page path, and offset pagination compatibility after all callers have migrated.
- [ ] Confirm the three adapters are the only page-specific discovery request builders:

```bash
rg -n "/api/(catalog|sites)|loadFlowCatalogPage|listSitesPage" src/vitrine
```

- [ ] Run the final verification suite:

```bash
npm test
npm run build
npm run discovery:benchmark
```

- [ ] Repeat the browser checklist from Task 10 at desktop and narrow viewport.
- [ ] Inspect the final diff against the design spec and verify no unrelated dirty files are staged.
- [ ] Commit only cleanup files.

```bash
git add src/vitrine/components/AppsFilterBar.tsx src/vitrine/useApps.ts \
  src/vitrine/sitesApi.ts services/api/src/sites.ts \
  src/vitrine/AppsFilterBar.test.tsx src/vitrine/useApps.test.ts \
  src/vitrine/sitesApi.test.ts services/api/src/sites.test.ts
git diff --cached --stat
git commit -m "refactor: finish discovery page migration"
```

## Final acceptance criteria

- Apps, Sites, and Flows use the same `DiscoveryPageLayout`, `DiscoveryFilterBar`, URL codec, `useDiscoveryController`, infinite-scroll sentinel, and response envelope.
- Page-specific adapters contain domain choices; the generic controller contains no Apps/Sites/Flows branches.
- All filter states survive reload and browser back/forward.
- One UI state/cursor causes one catalog request; there is no per-App design-system request fan-out.
- All three APIs use stable opaque cursors and return complete `totalCount` and `facets`.
- Every filter and sort is browser-tested on its actual page.
- One warm-up plus ten samples are recorded for each representative endpoint; any warm p95 over 500 ms has an evidence-backed optimization or a documented blocker.
- `npm test` and `npm run build` pass from the final worktree.
