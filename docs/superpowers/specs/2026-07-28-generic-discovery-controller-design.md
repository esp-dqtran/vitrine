# Generic Discovery Controller Design

## Status

Approved direction, pending written-spec review before implementation planning.

## Goal

Migrate the Apps, Sites, and Flows discovery pages onto one generic layout,
controller, URL-state contract, cursor-pagination contract, and infinite-scroll
behavior while preserving each resource's specialized taxonomy, preview, card,
copy, navigation, and actions.

After all three pages migrate, verify every filter path in component, API, and
browser tests. Measure the three catalog APIs and optimize any confirmed warm
request slower than 500 ms without weakening cursor correctness, facet
correctness, or public/private route boundaries.

## Current State

The codebase already contains three useful shared presentation boundaries:

- `ReferenceDiscoveryPageShell` owns the common page order and structural
  classes.
- `ReferenceDiscoveryTopNav` owns the shared identity, reference tabs, search
  slot, and account-control slot.
- `DiscoveryFilterBar` owns the shared platform, filter, count, and sort
  controls.

The pages still own incompatible state and data-loading models:

- Apps uses URL-backed discovery state, server-assisted filtering, cursor
  pagination, and an intersection sentinel.
- Sites loads the complete catalog, filters and sorts in the browser, and
  reveals client-side batches through an intersection sentinel.
- Flows uses local state, a cursor API, and an explicit Load more button.

Filter options are also sourced differently. Apps builds options from catalog
data, Sites combines static defaults and preview pools, and Flows derives Flow
groups from the currently loaded items. Deriving facets from a page is
incorrect once every resource uses server pagination.

## Decisions

1. Use a headless generic controller with typed resource adapters.
2. Standardize platform, query, filters, sort, and view as URL-backed state.
3. Keep loaded pages, cursors, in-flight requests, and incremental errors as
   transient controller state rather than URL state.
4. Use cursor-based server pagination for Apps, Sites, and Flows.
5. Use automatic infinite scroll for Apps, Sites, and Flows.
6. Return authoritative `totalCount` and complete facet metadata independently
   of the current page.
7. Preserve resource-specific cards, previews, copy, routes, and actions.
8. Migrate and verify one page at a time: Apps, then Sites, then Flows.
9. Profile before optimizing. Do not add caches or indexes without measured
   evidence of a slow path.

## Architecture

The final composition has three layers:

```text
DiscoveryPageLayout
└── DiscoveryPage
    └── useDiscoveryController
        └── DiscoveryAdapter
```

### `DiscoveryPageLayout`

`DiscoveryPageLayout` is the presentation-only evolution of
`ReferenceDiscoveryPageShell`. It owns DOM order, accessibility landmarks,
responsive structure, spacing, and structural class names.

```tsx
<DiscoveryPageLayout
  kind="apps"
  header={header}
  discovery={taxonomy}
  preview={preview}
  filterBar={filterBar}
  results={results}
/>
```

Its slots are:

- `header`: shared discovery navigation and search.
- `discovery`: visible taxonomy/facet shortcuts.
- `preview`: optional hover preview overlay.
- `filterBar`: shared platform, filters, count, and sort controls.
- `results`: result state, cards, and infinite-scroll sentinel.

The layout retains the existing `data-apps-discovery`,
`data-sites-discovery`, `data-flows-discovery`, and
`data-reference-gallery-shell` attributes during migration. Tests and CSS can
move to generic `discovery-*` classes without breaking current browser
annotations or route-level assertions.

### `DiscoveryPage`

`DiscoveryPage` joins the generic layout to a typed controller result. It does
not inspect resource records.

```ts
interface DiscoveryPageConfig<TItem, TFacet> {
  kind: "apps" | "sites" | "flows";
  adapter: DiscoveryAdapter<TItem, TFacet>;
  taxonomy: DiscoveryTaxonomyConfig<TFacet>[];
  renderItem(item: TItem): ReactNode;
  getItemKey(item: TItem): string;
  resultLayout: "cards" | "screens" | "flows";
  emptyCopy: DiscoveryEmptyCopy;
  renderPreview?: DiscoveryPreviewRenderer<TFacet>;
}
```

The resource page supplies taxonomy configuration, item keys, card rendering,
optional preview rendering, and route-specific copy. `DiscoveryPage` supplies
the shared header, filter bar, result-state frame, and sentinel.

### `useDiscoveryController`

The controller owns:

- parsing, validating, canonicalizing, and serializing URL state;
- platform, query, filters, sort, and view transitions;
- query debouncing;
- initial loading, refreshing, empty state, and retry;
- cursor pagination and infinite-scroll state;
- item deduplication;
- authoritative total count and facets;
- request cancellation and stale-generation protection;
- preservation of loaded items during incremental failures;
- suppression of duplicate initial and sentinel requests.

The controller is generic over item and facet types. It must not import `App`,
`SiteSummary`, `FlowCatalogItem`, `AppCard`, `SiteCard`, or `FlowCard`.

### `DiscoveryAdapter`

Each resource adapter translates generic controller requests into its catalog
endpoint and validates the returned resource payload.

```ts
interface DiscoveryAdapter<TItem, TFacet> {
  kind: "apps" | "sites" | "flows";
  defaultState: DiscoveryUrlState;
  allowedPlatforms: readonly Platform[];
  allowedSorts: readonly string[];
  allowedViews: readonly string[];
  parseItem(value: unknown): TItem;
  parseFacet(value: unknown): TFacet;
  loadPage(
    request: DiscoveryPageRequest,
    signal: AbortSignal,
  ): Promise<DiscoveryPageResponse<TItem, TFacet>>;
}
```

The adapters are `appsDiscoveryAdapter`, `sitesDiscoveryAdapter`, and
`flowsDiscoveryAdapter`.

## URL State

Every discovery route uses the same parameter model:

```text
/{apps|sites|flows}
?platform=web
&query=settings
&filter=categories.AI
&filter=screens.Profile
&sort=latest
&view=grid
```

The typed state is:

```ts
interface DiscoveryUrlState {
  platform: Platform;
  query: string;
  filters: Record<string, string[]>;
  sort: string;
  view: string;
}
```

Rules:

- Multiple values within a group use OR.
- Different groups combine with AND.
- Values are trimmed, length-bounded, deduplicated, and serialized in stable
  group/value order.
- Canonical URLs use one repeated `filter=<group>.<value>` parameter per
  selected value. The parser continues accepting the existing Apps
  single-parameter underscore format and the Apps `content_type` parameter, then
  rewrites them to the canonical repeated-filter and `view` representation.
- Unknown platforms, filter groups, sorts, and views fall back to the adapter's
  defaults and are removed by canonical serialization.
- A platform, query, filter, sort, or view change aborts the current request,
  clears transient pages and cursors, and loads the first page.
- Browser back and forward restore the complete shareable state.
- Cursor values and loaded-page count are not serialized.

## Catalog API Contract

Apps, Sites, and Flows use the same request parameters:

```ts
interface DiscoveryPageRequest {
  platform: Platform;
  query?: string;
  filters: Record<string, string[]>;
  sort: string;
  view: string;
  cursor?: string;
  limit: number;
}
```

All endpoints return:

```ts
interface DiscoveryFacetValue {
  value: string;
  label: string;
  count: number;
}

interface DiscoveryPageResponse<TItem, TFacet> {
  items: TItem[];
  nextCursor: string | null;
  totalCount: number;
  facets: Record<string, TFacet[]>;
}
```

Contract requirements:

- Cursors use a deterministic, unique tie-breaker and remain stable for a
  fixed filter/sort snapshot.
- `totalCount` describes the complete filtered result set, not the current
  page.
- `facets` describes all permitted values for the active resource and platform,
  independently of page size. A group is calculated after authorization,
  platform, query, and every other active filter group are applied, but before
  that group's own selected values are applied. This keeps alternative values
  visible within a multi-select group. Selected values remain in the response
  even when their current count is zero.
- Every resource facet extends `DiscoveryFacetValue`. Resource-only preview
  metadata remains in the page adapter or preview loader rather than becoming a
  mandatory cross-resource API field.
- The server applies OR within a filter group and AND between groups.
- Items required for rendering a result card are returned in the catalog page;
  cards must not issue an N+1 request.
- Public discovery endpoints expose only the existing public catalog fields and
  preserve current authorization filtering before counts or facets are
  calculated.

Facet computation may use a short-lived server cache keyed by resource,
platform, authorization scope, query, and filters only after profiling proves
it necessary. Cursor-only page requests may reuse the cached facet result, but
the response contract continues returning `facets`.

## Results and Infinite Scroll

`DiscoveryResults` owns the shared result-state frame and one sentinel:

```ts
interface DiscoveryResultsProps<TItem> {
  status: "initial-loading" | "ready" | "empty" | "initial-error";
  items: TItem[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError?: string;
  onRetry(): void;
  onRetryLoadMore(): void;
  onLoadMore(): void;
  renderItem(item: TItem): ReactNode;
  getItemKey(item: TItem): string;
  layout: "cards" | "screens" | "flows";
}
```

The sentinel observes only when the page is ready, `hasMore` is true, and no
initial or incremental request is active. It disconnects during request
transitions and invokes `onLoadMore` once for the current cursor.

The layouts remain resource-specific:

- Apps renders `AppCard` or `AppsDiscoveryScreenCard`.
- Sites renders `SiteCard`.
- Flows renders `FlowCard`.

The generic results component chooses structural layout classes but never
branches on record contents.

## Error Handling

The generic controller and results frame distinguish:

- **Initial loading:** keep Header, Discovery, and FilterBar mounted while
  showing the shared catalog loader.
- **Initial error:** keep page chrome mounted and show resource-specific copy
  with Retry.
- **Incremental error:** keep loaded cards visible and show an inline retry
  below them.
- **Empty catalog:** no public records exist for the resource/platform.
- **No matches:** records exist but the current query and filters match none.

Abort errors are silent. Responses from stale generations are ignored. Retrying
an incremental failure uses the same cursor; retrying an initial failure uses
the current canonical URL state.

## Resource Migrations

### 1. Apps

- Move current URL parsing and serialization into the common state module.
- Adapt existing public catalog and facet loading to the response contract.
- Move current cursor and sentinel behavior into `useDiscoveryController`.
- Preserve Apps content views, App and Screen card renderers, status/progress
  metadata, hover preview loading, public/private route boundaries, and the
  prohibition on Apps-screen `GET /api/jobs` polling.
- Pass the Apps migration gate before touching Sites.

### 2. Sites

- Add deterministic server-side cursor pagination to the Sites catalog API.
- Move query, Categories, Sections, Styles, sort, and view to common URL state.
- Return complete Site facets and filtered total count from the server.
- Replace client-side full-catalog filtering and batch slicing with the generic
  controller and sentinel.
- Preserve Web-only platform support, Site cards, preview pools, Site routes,
  ready/public visibility, and existing Site detail behavior.
- Pass the Sites migration gate before touching Flows.

### 3. Flows

- Move platform, query, Flow groups, order, and view to common URL state.
- Adapt the existing cursor endpoint to the common response contract.
- Return authoritative Flow groups rather than deriving them from loaded items.
- Replace the Load more button with the shared sentinel.
- Preserve Flow title hierarchy, real app identity, preview modal/document
  behavior, Flow cards, and source-App navigation.
- Pass the Flows migration gate before cross-page verification.

## Filter Verification

### Shared state tests

- Parse and serialize canonical URL state.
- Reject unknown or overlong values.
- Deduplicate repeated values.
- Preserve OR-within-group and AND-across-groups.
- Reset transient pagination after any shareable state change.
- Restore state through browser back and forward.

### Apps

- Platform, query, Categories, Screens, UI Elements, Flows, sort, and view.
- Multiple values in one group and simultaneous values across groups.
- Clearing one group and clearing all groups.
- Refresh and history restoration.
- Infinite-scroll continuation with no repeated App or Screen result.

### Sites

- Query, Categories, Sections, Styles, sort, and view.
- Multiple values in one group and simultaneous values across groups.
- Clearing one group and clearing all groups.
- Refresh and history restoration.
- Cursor continuity and no repeated Site result.
- Facets and total count remain correct at a small page size.

### Flows

- Platform, query, Flow groups, sort/order, and view.
- Multiple Flow-group values.
- Clearing Flow groups.
- Refresh and history restoration.
- Cursor continuity and no repeated Flow result.
- Complete Flow groups remain available when the first page omits a group.

### Browser verification

For each page:

1. Open the page with default state.
2. Open every filter group and select a value.
3. Select a second value in the same group where available.
4. Select a value in another group where available.
5. Confirm URL, result count, visible cards, and selected pills.
6. Clear one group and confirm the others remain.
7. Refresh and confirm state restoration.
8. Use browser back and forward.
9. Scroll across at least two page boundaries.
10. Confirm one request per boundary and no duplicate cards.

Run the browser checks at desktop and the existing compact breakpoint so the
shared filter bar and sentinel do not introduce horizontal overflow or hidden
controls.

## Performance Audit

The three catalog APIs are measured before optimization. For the default route,
one representative filter per group, a multi-group filter, and two cursor
continuations, record:

- server duration;
- database query count;
- database execution plan;
- response payload bytes;
- item and facet counts;
- browser request count;
- time from navigation/state change to visible results.

For each measured state, run one warm-up request followed by ten recorded
requests. A local p95 above 500 ms is a slow path requiring investigation. The
threshold is an investigation gate, not permission to weaken correctness.

Allowed evidence-driven optimizations include:

- composite or partial indexes matching confirmed filter/sort predicates;
- stable keyset cursor predicates instead of offset scans;
- removal of N+1 record or media lookups;
- selecting only card fields;
- bounded facet aggregation;
- short-lived facet caching with authorization scope in the key;
- sharing one database snapshot between items, total count, and facets where
  supported;
- payload compression and removal of duplicate metadata.

Every optimization must include before/after measurements and retain cursor,
count, facet, authorization, and filter tests.

## Migration Gates

Each page must satisfy all of the following before migration proceeds:

- focused component and controller tests pass;
- API contract and cursor tests pass;
- filter behavior passes in the browser;
- refresh and history restoration pass;
- two automatic page boundaries load without duplicates;
- request count shows no fan-out;
- production build passes;
- `git diff --check` passes;
- unrelated dirty-worktree changes remain preserved.

The final completion audit repeats these gates across Apps, Sites, and Flows
together and includes performance evidence for all three endpoints.

## Non-Goals

- Combining Apps, Sites, and Flows into one database table.
- Replacing resource-specific cards with a universal card.
- Changing detail pages.
- Changing public/private route policy.
- Restoring disabled product imports or Apps-screen job polling.
- Adding speculative caches or indexes before measuring.
- Rebuilding the current visual design.
