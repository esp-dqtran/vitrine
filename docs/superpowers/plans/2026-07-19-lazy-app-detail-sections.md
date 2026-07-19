# Lazy App Detail Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an app-detail route load only lightweight app metadata initially, then load Screens, UI Elements, Flows, Design System, Export, and Review data only when the user opens the corresponding section.

**Architecture:** Split the existing mixed app-detail response into a metadata endpoint and three dedicated section endpoints. Keep a request-aware, per-detail-visit store in the frontend for versions, evidence pages, and flows; keep design-system data behind its own existing endpoint. `ScreenDetail` becomes an orchestrator that activates only the dependency set for the visible section, retains successful section data while navigating within the app, and isolates loading, retry, pagination, and cancellation by cache key.

**Tech Stack:** TypeScript, Express, PostgreSQL/Supabase, React 19, Vite, Node test runner, TSX tests, in-app browser verification

---

### Task 1: Define metadata-only and paged section contracts

**Files:**
- Modify: `src/vitrine/types.ts`
- Modify: `src/gallery.ts`
- Modify: `src/gallery.test.ts`

- [ ] **Step 1: Write failing gallery contract tests**

Add tests that make the boundary explicit:

```ts
test('buildAppMetadata returns aggregate metadata without section payloads', () => {
  const app = buildAppMetadata({
    app: 'claude',
    icon_url: 'https://cdn.example/claude.png',
    category: 'AI',
    total_screens: 120,
    total_ui_elements: 31,
    total_flows: 7,
    analyzed_screens: 115,
    last_captured_at: '2026-07-19T00:00:00.000Z',
    available_platforms: ['ios', 'android'],
  });

  assert.equal(app.app, 'Claude');
  assert.equal(app.totalScreens, 120);
  assert.equal(app.totalUiElements, 31);
  assert.equal(app.totalFlows, 7);
  assert.deepEqual(app.platforms, ['ios', 'android']);
  assert.equal('screens' in app, false);
});

test('buildEvidencePage maps one limited row page and preserves its cursor', () => {
  const result = buildEvidencePage({ rows: [screenRow], nextCursor: 'image-2' });
  assert.equal(result.screens.length, 1);
  assert.equal(result.nextCursor, 'image-2');
});
```

Import the not-yet-created `buildAppMetadata` and `buildEvidencePage` symbols so the first run fails for the intended missing contract.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test src/gallery.test.ts`

Expected: FAIL because `buildAppMetadata` and `buildEvidencePage` are not exported yet.

- [ ] **Step 3: Split metadata from gallery data types**

In `src/vitrine/types.ts`, add a metadata type that contains no section arrays:

```ts
export interface AppSummary {
  id: string;
  app: string;
  cat: string;
  accent: string;
  totalScreens: number;
  platforms?: Platform[];
  analyzedScreens?: number;
  lastCapturedAt?: string | null;
  websiteUrl?: string | null;
  iconUrl?: string | null;
}

export interface AppMetadata extends AppSummary {
  totalUiElements: number;
  totalFlows: number;
}

export interface App extends AppSummary {
  screens: Screen[];
}
```

Keep `App` for gallery/list consumers that already receive screen previews without forcing new aggregate fields onto every gallery fixture. Move all detail-route props and responses introduced in later tasks to `AppMetadata`.

- [ ] **Step 4: Add explicit builders in `src/gallery.ts`**

Export the backend-facing input types and builders:

```ts
export interface CatalogAppMetadata {
  id: string;
  app: string;
  cat: string;
  accent: string;
  totalScreens: number;
  totalUiElements: number;
  totalFlows: number;
  platforms: string[];
  analyzedScreens: number;
  lastCapturedAt: string | null;
  websiteUrl: string | null;
  iconUrl: string | null;
}

export interface AppMetadataRecord {
  app: string;
  icon_url: string | null;
  category: string | null;
  total_screens: number;
  total_ui_elements: number;
  total_flows: number;
  analyzed_screens: number;
  last_captured_at: string | null;
  available_platforms: string[];
}

export interface EvidencePageRecord {
  rows: CrawledImage[];
  nextCursor: string | null;
}

export function buildAppMetadata(row: AppMetadataRecord): CatalogAppMetadata {
  const meta = appMeta(row.app);
  return {
    id: row.app,
    app: meta.label,
    cat: row.category ?? 'Other',
    accent: meta.accent,
    totalScreens: row.total_screens,
    totalUiElements: row.total_ui_elements,
    totalFlows: row.total_flows,
    platforms: row.available_platforms,
    analyzedScreens: row.analyzed_screens,
    lastCapturedAt: row.last_captured_at,
    websiteUrl: meta.websiteUrl,
    iconUrl: row.icon_url,
  };
}

export function buildEvidencePage(page: EvidencePageRecord): {
  screens: CatalogScreen[];
  nextCursor: string | null;
} {
  return {
    screens: page.rows.map((image) => screen(image.app, image)),
    nextCursor: page.nextCursor,
  };
}
```

Reuse the existing `appMeta`, `screen`, and `CatalogScreen` helpers. Keep the app slug as `id` and the human label as `app`, matching current gallery responses. Do not import frontend `AppMetadata` or `Screen` types into the backend gallery layer; `appsApi.ts` owns the structurally compatible frontend response types.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `node --experimental-strip-types --test src/gallery.test.ts`

Expected: all gallery tests pass and the metadata assertion proves no `screens` property is present.

- [ ] **Step 6: Commit the contract split**

```bash
git add src/vitrine/types.ts src/gallery.ts src/gallery.test.ts
git commit -m "refactor: split app metadata contracts"
```

### Task 2: Add efficient database reads for metadata and section pages

**Files:**
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`
- Create: `src/dbAppDetailQueries.test.ts`

- [ ] **Step 1: Write failing database tests for bounded queries**

Extend the existing PostgreSQL integration fixture for these behaviors:

1. `appMetadata('Claude', false)` returns counts for all persisted admin-visible evidence and flows.
2. `appMetadata('Claude', true)` restricts each platform to its latest published version.
3. `appEvidencePage` requests `limit + 1`, returns at most `limit`, and derives `nextCursor` from the last returned row when an extra row exists.
4. `appEvidencePage` applies `kind`, `platform`, resolved version, and cursor predicates in SQL.
5. `getVersionFlows` returns only flows belonging to the resolved app/platform/version.
6. `flowEvidenceImages` returns only the IDs referenced by the selected flow set and enforces the same app/platform/version boundary.

Import the new functions in the existing dynamic import block. Seed one app with iOS and Android versions, screen/UI-element/flow-step images, version flow JSON, and an older published version. Assert exact IDs and counts for admin scope, customer scope, kind, platform, version, cursor, and flow evidence.

Create `src/dbAppDetailQueries.test.ts` as an always-on source boundary test. Read `src/db.ts`, extract the `appEvidencePage` function body, and assert it contains a SQL `LIMIT` parameter fed with `limit + 1`; also assert the body does not call `appImages(` or `versionImages(`. This preserves the bounded-query guarantee even when local PostgreSQL is unavailable and the integration suite skips.

- [ ] **Step 2: Run the database tests and verify RED**

Run: `node --experimental-strip-types --test src/db.test.ts src/dbAppDetailQueries.test.ts`

Expected: FAIL because the new database functions and bounded-query source contract do not exist.

- [ ] **Step 3: Add database result contracts and opaque cursor helpers**

Add these exports near the existing app image/version functions:

```ts
export interface AppMetadataRow {
  app: string;
  icon_url: string | null;
  category: string | null;
  total_screens: number;
  total_ui_elements: number;
  total_flows: number;
  analyzed_screens: number;
  last_captured_at: string | null;
  available_platforms: Platform[];
}

export interface AppEvidencePage {
  rows: CrawledImage[];
  nextCursor: string | null;
}

function encodeImageCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}

function decodeImageCursor(cursor: string): number {
  const id = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('invalid image cursor');
  return id;
}
```

Reject an empty or malformed decoded cursor with the existing bad-input error type rather than silently starting from page one.

- [ ] **Step 4: Implement one-query metadata aggregation**

Implement:

```ts
export async function appMetadata(
  app: string,
  publishedOnly: boolean,
): Promise<AppMetadataRow | null>
```

Use a CTE that creates an `eligible_versions` set. For customer access, select the latest published `app_versions` row per platform; for admin access, include current persisted evidence regardless of publication. Aggregate from eligible rows without returning image payloads:

- `count(*) filter (where kind = 'screen')` as `total_screens`
- `count(*) filter (where kind = 'ui_element')` as `total_ui_elements`
- distinct flow count as `total_flows`
- screen analysis count as `analyzed_screens`
- `max(captured_at)` as `last_captured_at`
- ordered distinct platforms as `available_platforms`

Join the existing app catalog/source table for the canonical app name, icon, and category. Return `null` when the app has neither a catalog row nor accessible published data.

- [ ] **Step 5: Implement bounded evidence pagination**

Add:

```ts
export async function appEvidencePage(input: {
  app: string;
  kind: 'screen' | 'ui_element';
  platform: Platform;
  versionNumber: number | null;
  cursor: string | null;
  limit: number;
  publishedOnly: boolean;
}): Promise<AppEvidencePage>
```

The SQL must use deterministic `i.id` ordering, an `i.id > cursorId` continuation predicate, and `LIMIT input.limit + 1`. Remove the extra row before mapping and encode the last returned image ID as `nextCursor` only when the extra row exists. Keep the public limit constrained to 1–48 in the API task; the database function receives an already validated value.

- [ ] **Step 6: Implement version-scoped flow retrieval**

Add:

```ts
export async function getVersionFlows(
  app: string,
  platform: Platform,
  versionNumber: number | null,
  publishedOnly: boolean,
): Promise<DesignFlow[]>;
```

Use the same resolved version boundary as `appEvidencePage`. Return only stored flow definitions and references. Do not load design-system tokens, components, layouts, or unrelated screenshots in this function.

Also add:

```ts
export async function flowEvidenceImages(input: {
  app: string;
  platform: Platform;
  versionNumber: number | null;
  imageIds: number[];
  publishedOnly: boolean;
}): Promise<CrawledImage[]>;
```

Collect and deduplicate numeric evidence IDs from the flow set before calling this function. The SQL must combine `id = ANY($ids)` with the same app/platform/version/publication restrictions, preventing a stored cross-app ID from exposing unrelated media.

- [ ] **Step 7: Run the database tests and verify GREEN**

Run: `node --experimental-strip-types --test src/db.test.ts src/dbAppDetailQueries.test.ts`

Expected: the integration assertions pass when PostgreSQL is available, and the always-on source boundary confirms bounded SQL without full-image helper calls.

- [ ] **Step 8: Commit database reads**

```bash
git add src/db.ts src/db.test.ts src/dbAppDetailQueries.test.ts
git commit -m "feat: add paged app section queries"
```

### Task 3: Split the app-detail API into metadata, screens, UI elements, and flows

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/gallery.ts`

- [ ] **Step 1: Write failing metadata isolation tests**

In `services/api/src/app.test.ts`, replace mixed-detail expectations with an explicit dependency trap:

```ts
test('GET /apps/:app returns metadata without invoking section dependencies', async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    canAccessApp: async () => true,
    appMetadata: async () => claudeMetadataRow,
    listAppVersions: async () => { throw new Error('must not load versions'); },
    appEvidencePage: async () => { throw new Error('must not load evidence'); },
    getVersionFlows: async () => { throw new Error('must not load flows'); },
    getVersionDesignSystem: async () => { throw new Error('must not load design system'); },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/claude`, { headers: adminCookie });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.app.app, 'Claude');
  assert.equal('screens' in body.app, false);
  assert.equal('version' in body, false);
  assert.equal('nextCursor' in body, false);
});
```

Also test that `GET /apps/claude?limit=48` returns 400. This removes the old mixed-response compatibility path instead of allowing an accidental eager request to continue working.

- [ ] **Step 2: Write failing section endpoint tests**

Add route tests that assert exact dependency use and response shape:

- `/apps/claude/screens?platform=ios&version=12&limit=48` calls `appEvidencePage` with `kind: 'screen'` and returns `{screens,nextCursor,version}`.
- `/apps/claude/ui-elements?platform=ios&version=12&limit=48` calls it with `kind: 'ui_element'`.
- `/apps/claude/flows?platform=ios&version=12` calls `getVersionFlows`, hydrates its evidence references, and returns `{flows,version}` without invoking `getVersionDesignSystem`.
- all three endpoints retain slug traversal rejection, entitlement checks, customer publication boundaries, and admin fallback.
- invalid `limit`, cursor, platform, and version values return 400.

For each test, make unrelated dependency overrides throw `must not load …` errors.

- [ ] **Step 3: Run the focused API tests and verify RED**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern='metadata without|screens endpoint|UI elements endpoint|flows endpoint|old mixed detail query' services/api/src/app.test.ts
```

Expected: FAIL because the endpoint split and new dependencies are not implemented.

- [ ] **Step 4: Replace the mixed `/apps/:app` route**

Import `appMetadata`, `appEvidencePage`, `getVersionFlows`, and `flowEvidenceImages` into the API defaults. Make `/apps/:app`:

1. Validate the decoded slug and reject traversal.
2. Reject `limit`, `cursor`, `kind`, `platform`, or `version` query parameters.
3. Resolve authentication and app entitlement exactly once.
4. Call `deps.appMetadata(appName, !isAdmin)`.
5. Return `{ app: buildAppMetadata(row) }`.

Keep existing audit events and the current 401/403/404 semantics. Delete the old route logic that loads versions/images and calls `buildAppDetailPage`.

- [ ] **Step 5: Add a shared section request parser**

Inside `services/api/src/app.ts`, add a route-local parser:

```ts
function parseAppSectionQuery(query: Request['query'], paged: boolean): {
  platform: Platform | null;
  versionNumber: number | null;
  cursor: string | null;
  limit: number;
} {
  return {
    platform: parseOptionalPlatform(query.platform),
    versionNumber: parseOptionalPositiveInteger(query.version),
    cursor: paged ? parseOptionalCursor(query.cursor) : null,
    limit: paged ? parseLimit(query.limit, 48) : 48,
  };
}
```

Use the existing validation helpers where available. `parseOptionalPlatform` must return `null` for an omitted value and reject unknown values. Do not make platform optional at the database layer: resolve the first accessible platform after entitlement/version lookup and return that resolved platform/version in the response.

- [ ] **Step 6: Implement the screens and UI-elements endpoints**

Register:

```ts
app.get('/apps/:app/screens', appSectionEvidenceHandler('screen'));
app.get('/apps/:app/ui-elements', appSectionEvidenceHandler('ui_element'));
```

The common handler must run the same access guard as metadata, resolve the accessible platform/version, call exactly one `appEvidencePage`, transform it with `buildEvidencePage`, and return:

```ts
{
  screens: page.screens,
  nextCursor: page.nextCursor,
  platform: resolvedPlatform,
  version: resolvedVersion,
}
```

The `screens` property remains the generic evidence-view array for both routes so existing panels can consume `Screen[]`; the endpoint name and query kind establish whether the records are screens or UI elements.

- [ ] **Step 7: Implement the flow-only endpoint**

Register `app.get('/apps/:app/flows', ...)`. Resolve access/platform/version, call `getVersionFlows`, collect its numeric evidence IDs, and call `flowEvidenceImages` for only those IDs. Reuse `hydrateDesignSystem` with an empty token/component shell, then return only its hydrated `flows`. Return:

```ts
{
  flows: hydratedFlows,
  platform: resolvedPlatform,
  version: resolvedVersion,
}
```

Do not call `getVersionDesignSystem`; opening Flows must not fetch tokens, components, layouts, or the full design-system snapshot.

- [ ] **Step 8: Remove the obsolete mixed API builder**

After every API caller is migrated, remove `buildAppDetailPage` and its obsolete response interface from `src/gallery.ts`. Keep gallery-list builders unchanged.

- [ ] **Step 9: Run focused and complete API tests**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern='metadata without|screens endpoint|UI elements endpoint|flows endpoint|old mixed detail query' services/api/src/app.test.ts
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: the new isolation tests and all existing API authorization/audit tests pass.

- [ ] **Step 10: Commit the API split**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts src/gallery.ts
git commit -m "feat: split app detail section APIs"
```

### Task 4: Replace mixed frontend requests with explicit API clients and a per-visit store

**Files:**
- Modify: `src/vitrine/appsApi.ts`
- Modify: `src/vitrine/appsApi.test.ts`
- Create: `src/vitrine/appSectionStore.ts`
- Create: `src/vitrine/appSectionStore.test.ts`

- [ ] **Step 1: Write failing exact-URL client tests**

Replace the tests that expect `/api/apps/:app?limit=48` with exact URL assertions:

```ts
test('fetchAppMetadata requests metadata without a section query', async () => {
  await fetchAppMetadata('claude', { signal });
  assert.equal(fetchCalls[0].url, '/api/apps/claude');
});

test('section clients use dedicated endpoints', async () => {
  await fetchAppScreens('claude', params);
  await fetchAppUiElements('claude', params);
  await fetchAppFlows('claude', flowParams);
  assert.deepEqual(fetchCalls.map(call => call.pathname), [
    '/api/apps/claude/screens',
    '/api/apps/claude/ui-elements',
    '/api/apps/claude/flows',
  ]);
});
```

Assert that evidence clients include only `platform`, `version`, `cursor`, and `limit`, while flows omit `cursor` and `limit`.

- [ ] **Step 2: Run client tests and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts`

Expected: FAIL because the explicit clients do not exist.

- [ ] **Step 3: Implement explicit frontend API contracts**

In `appsApi.ts`, export:

```ts
export interface EvidenceSectionPage {
  screens: Screen[];
  nextCursor: string | null;
  platform: Platform;
  version: number;
}

export interface FlowSectionResult {
  flows: DesignFlow<EvidenceView>[];
  platform: Platform;
  version: number;
}

export async function fetchAppMetadata(
  appId: string,
  options: { signal?: AbortSignal } = {},
): Promise<AppMetadata>;

export async function fetchAppScreens(
  appId: string,
  input: EvidenceSectionRequest,
): Promise<EvidenceSectionPage>;

export async function fetchAppUiElements(
  appId: string,
  input: EvidenceSectionRequest,
): Promise<EvidenceSectionPage>;

export async function fetchAppFlows(
  appId: string,
  input: FlowSectionRequest,
): Promise<FlowSectionResult>;
```

URL-encode the app ID and query values. Pass the supplied abort signal to `fetch`. Remove `fetchAppDetailPage`, `fetchAppDetail`, `AppDetailPage`, and mixed-detail merge logic once no callers remain.

- [ ] **Step 4: Run client tests and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts`

Expected: all client tests pass and no test contains `?limit=48` on the metadata URL.

- [ ] **Step 5: Write failing store behavior tests**

Create `appSectionStore.test.ts` with injected fake request functions and deferred promises. Cover:

1. two concurrent loads for the same app/section/platform/version return one promise and cause one request;
2. returning to a fulfilled key causes no request;
3. screen and UI-element pages use distinct keys;
4. changing platform or version requests only the asked section;
5. `loadNext` appends unique IDs and ignores duplicate records;
6. a failed section remains retryable without clearing successful sections;
7. aborting a pending load records neither a user-visible error nor partial data;
8. `latest` is aliased to the concrete version returned by the server.

- [ ] **Step 6: Run store tests and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/appSectionStore.test.ts`

Expected: FAIL because `createAppSectionStore` does not exist.

- [ ] **Step 7: Implement the per-visit store**

Create a pure TypeScript store with no React imports:

```ts
export type EvidenceSection = 'screens' | 'ui-elements';
export type DataSection = EvidenceSection | 'flows';

export interface SectionState<T> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T | null;
  error: Error | null;
}

export function sectionCacheKey(input: {
  appId: string;
  section: DataSection;
  platform: Platform;
  version: number | 'latest';
}): string {
  return [input.appId, input.section, input.platform, input.version].join('|');
}
```

`createAppSectionStore(clients)` owns `Map<string, SectionState>`, `Map<string, Promise<unknown>>`, and a subscriber set. Its `load`, `loadNext`, `retry`, `get`, `subscribe`, and `invalidate` methods must:

- return cached success immediately;
- return the in-flight promise for a duplicate key;
- replace only the requested key's loading/error state;
- dedupe appended `Screen` records by ID;
- preserve the first-seen order;
- alias a `latest` result to the returned concrete version key;
- treat `AbortError` as idle/cancelled, not as a retry error;
- emit after each state transition.

The store instance must be created by the detail component/hook, not at module scope, so leaving an app releases the visit cache.

- [ ] **Step 8: Run store and client tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/vitrine/appsApi.test.ts src/vitrine/appSectionStore.test.ts
```

Expected: all request URL, cache, deduplication, retry, and abort tests pass.

- [ ] **Step 9: Commit the client/store layer**

```bash
git add src/vitrine/appsApi.ts src/vitrine/appsApi.test.ts src/vitrine/appSectionStore.ts src/vitrine/appSectionStore.test.ts
git commit -m "feat: add lazy app section client store"
```

### Task 5: Make the detail route metadata-only and activate one section at a time

**Files:**
- Modify: `src/vitrine/useAppDetail.ts`
- Create: `src/vitrine/useAppSectionData.ts`
- Create: `src/vitrine/useAppSectionData.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetailLoading.test.ts`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Create: `src/vitrine/components/AppOverviewPanel.tsx`
- Delete: `src/vitrine/components/OverviewPanel.tsx`

- [ ] **Step 1: Write the failing route-boundary test**

Update `App.boundary.test.ts` to assert:

- `App.tsx` calls `useAppDetail` for the detail route;
- `useAppDetail.ts` imports `fetchAppMetadata` and does not import `fetchAppDetailPage`;
- `App.tsx` passes only `app`, `initialSection`, navigation callbacks, and permissions to `ScreenDetail`;
- `App.tsx` does not pass `initialVersion` or `initialNextCursor`.

- [ ] **Step 2: Write failing section activation tests**

In `src/vitrine/ScreenDetailLoading.test.ts`, add request-observer tests or source-boundary assertions that prove:

- Overview activates no version, screens, UI elements, flows, or design-system request;
- Screens activates versions plus `fetchAppScreens`, not the other section clients;
- UI Elements activates versions plus `fetchAppUiElements`;
- Flows activates versions plus `fetchAppFlows`;
- switching back to a cached section reuses the store;
- platform/version changes call only the active section loader;
- component cleanup aborts the active request.

In `src/vitrine/ScreenDetail.test.tsx`, render Overview from metadata and assert category, platform badges, screen/UI-element/flow aggregate counts, analyzed count, last capture, and website/icon fallback. Assert that no version selector or section-derived token/component/flow content appears on Overview.

- [ ] **Step 3: Run the focused frontend tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/ScreenDetailLoading.test.ts
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because the detail hook still uses the mixed response and Overview still uses section data.

- [ ] **Step 4: Convert `useAppDetail` to metadata only**

Change the hook state to `AppMetadata | null`, call `fetchAppMetadata(appId, { signal })`, and retain its current route-level loading, not-found, retry, and abort behavior. The hook must make exactly one app request per app ID and must not accept section, platform, version, or pagination inputs.

- [ ] **Step 5: Add the section activation hook**

Create `useAppSectionData` around one `createAppSectionStore` instance held in `useRef`. The hook inputs are:

```ts
interface UseAppSectionDataInput {
  appId: string;
  activeSection: DetailSection;
  platform: Platform;
  version: number | 'latest';
}
```

Behavior:

1. If `activeSection === 'overview'`, return before loading versions or data.
2. Load versions only when a data-bearing section first opens.
3. Map `screens`, `ui-elements`, and `flows` to the matching store loader.
4. Treat `export` as two lazy dependencies: design-system data and the first screen page, because the existing selected-screen export UI needs both.
5. Leave `design-system` and `review` section evidence idle; they consume only design-system data in Task 6.
6. Create an `AbortController` for each active key and abort it on key change or unmount.
7. Expose `loadNext`, `retry`, and active-key state without clearing other cache entries.

Keep the list of section-to-dependency mappings in one function and test it directly:

```ts
export function sectionDependencies(section: DetailSection): DataDependency[] {
  switch (section) {
    case 'screens': return ['versions', 'screens'];
    case 'elements': return ['versions', 'ui-elements'];
    case 'flows': return ['versions', 'flows'];
    case 'design-system': return ['versions', 'design-system'];
    case 'export': return ['versions', 'design-system', 'screens'];
    case 'review': return ['versions', 'design-system'];
    case 'overview': return [];
  }
}
```

- [ ] **Step 6: Replace Overview with metadata-only presentation**

Create `AppOverviewPanel.tsx` accepting `{ app: AppMetadata }`. Render only metadata:

- category and available platforms;
- total Screens, UI Elements, and Flows;
- analyzed screen count and last capture timestamp when present;
- website and icon/fallback.

Delete `OverviewPanel.tsx` after removing its only import. Do not pass a design-system snapshot, screens array, or flows array into the new component.

- [ ] **Step 7: Refactor `ScreenDetail` around active state**

Change the prop to `app: AppMetadata`; remove `initialVersion` and `initialNextCursor`. Replace `app.screens` fallback logic with `app.platforms`. Render:

- `AppOverviewPanel` immediately for Overview;
- `VersionPanel` only after a non-Overview section activates and its version list is available;
- a section-local skeleton while that section key is loading;
- a section-local error with a retry action when that key fails;
- cached content immediately when revisiting a successful key;
- `loadNext` only when the active evidence page has `nextCursor`.

The selected platform/version state remains in `ScreenDetail`. When either changes, call only the current section loader. Pagination must append through the store, never by concatenating component state directly.

For UI Elements, always render the dedicated `/ui-elements` evidence result. Remove the current fallback that waits for design-system components or substitutes `snapshot.components`; opening UI Elements must not activate the design-system request.

- [ ] **Step 8: Remove eager props from `App.tsx`**

Pass the metadata result to `ScreenDetail` and remove all references to detail response `version` and `nextCursor`. Keep the route-level spinner/error for the metadata request only. Section failures must never replace that route-level content.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/ScreenDetailLoading.test.ts src/vitrine/useAppSectionData.test.ts
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: all tests pass, including zero section dependencies for Overview and metadata-only rendering.

- [ ] **Step 10: Commit detail activation**

```bash
git add src/vitrine/useAppDetail.ts src/vitrine/useAppSectionData.ts src/vitrine/useAppSectionData.test.ts src/vitrine/App.tsx src/vitrine/App.boundary.test.ts src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetailLoading.test.ts src/vitrine/ScreenDetail.test.tsx src/vitrine/components/AppOverviewPanel.tsx src/vitrine/components/OverviewPanel.tsx
git commit -m "feat: lazy load app detail sections"
```

### Task 6: Gate and cache Design System, Export, and Review data

**Files:**
- Modify: `src/vitrine/useDesignSystem.ts`
- Modify: `src/vitrine/useDesignSystem.test.ts`
- Create: `src/vitrine/designSystemStore.ts`
- Create: `src/vitrine/designSystemStore.test.ts`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetailLoading.test.ts`
- Modify: `src/vitrine/components/VersionPanel.tsx`

- [ ] **Step 1: Write failing design-system cache tests**

Keep the URL/response tests in `useDesignSystem.test.ts` and create `designSystemStore.test.ts` for:

1. `enabled: false` performs zero requests and retains previously cached data;
2. the first enabled load performs one `/api/design-systems/:app` request;
3. switching among Design System, Export, and Review with the same app/platform/version performs no second request;
4. leaving those sections and returning reuses the successful result;
5. changing platform or version performs one new request;
6. an aborted load is silent and a real error is retryable.

Add a `ScreenDetailLoading` assertion that opening Export triggers design-system plus the first Screens page, while Review triggers only design-system.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useDesignSystem.test.ts src/vitrine/designSystemStore.test.ts src/vitrine/ScreenDetailLoading.test.ts
```

Expected: FAIL because the current hook clears/refetches data across disabled transitions and `ScreenDetail` enables it eagerly.

- [ ] **Step 3: Make `useDesignSystem` cache successful keys per detail visit**

Create a pure `createDesignSystemStore` with fulfilled, failed, and in-flight maps keyed by `appId|platform|version`. Give it `load`, `get`, `retry`, `invalidate`, and `subscribe` methods using the same state semantics as the evidence store. `useDesignSystem` accepts this store as an argument. `ScreenDetail` creates exactly one store in `useRef` and passes it to the hook. When `enabled` is false, do not clear a successful entry. When enabled with a fulfilled key, return it without a network request. Keep in-flight deduplication, abort cleanup, key-local errors, and an explicit `retry` that clears only the failed key.

Do not create a module-global cache; data must be released when the user leaves the app detail visit.

- [ ] **Step 4: Wire exact dependencies in `ScreenDetail`**

Set design-system enablement to:

```ts
const needsDesignSystem =
  section === 'design-system' ||
  section === 'export' ||
  section === 'review';
```

Pass the resolved selected version only after versions are loaded. `FlowsPanel` must receive the dedicated `fetchAppFlows` result, never `snapshot.flows`. `ExportPanel` receives the design-system snapshot plus the lazily loaded Screens page. `CuratorReviewPanel` receives only the snapshot and its existing mutation callbacks.

- [ ] **Step 5: Invalidate cache entries after version mutations**

Extend `VersionPanel`'s successful publish/unpublish/delete callbacks to report the affected platform/version. On a mutation:

- refresh the versions list;
- invalidate only cached entries for the affected app/platform/version;
- keep unrelated platform/version section caches;
- if the current selection was deleted, select the newly resolved latest version and load only the active section.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useDesignSystem.test.ts src/vitrine/designSystemStore.test.ts src/vitrine/ScreenDetailLoading.test.ts
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: all design-system gating, cache, Export dependency, Review dependency, and render tests pass.

- [ ] **Step 7: Commit design-system gating**

```bash
git add src/vitrine/useDesignSystem.ts src/vitrine/useDesignSystem.test.ts src/vitrine/designSystemStore.ts src/vitrine/designSystemStore.test.ts src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetailLoading.test.ts src/vitrine/components/VersionPanel.tsx
git commit -m "fix: gate app design system requests"
```

### Task 7: Remove compatibility paths and verify exact request counts

**Files:**
- Modify: `src/vitrine/appsApi.test.ts`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/ScreenDetailLoading.test.ts`
- Modify: `services/api/src/app.test.ts`
- Verify: `src/vitrine/appsApi.ts`
- Verify: `src/vitrine/useAppDetail.ts`
- Verify: `src/vitrine/useAppSectionData.ts`
- Verify: `src/vitrine/components/ScreenDetail.tsx`
- Verify: `services/api/src/app.ts`

- [ ] **Step 1: Add a compatibility-path deletion test**

Add source/API assertions that fail if any of these return:

- `fetchAppDetailPage`
- `fetchAppDetail`
- `AppDetailPage`
- `/api/apps/${appId}?limit=`
- app metadata response `screens`, `nextCursor`, or `version`
- Overview calls to `listAppVersions`, section clients, or design-system clients

Use exact symbol/URL assertions, not broad snapshot tests.

- [ ] **Step 2: Run focused tests and remove remaining old paths**

Run:

```bash
node --experimental-strip-types --test src/vitrine/appsApi.test.ts src/vitrine/App.boundary.test.ts src/vitrine/ScreenDetailLoading.test.ts services/api/src/app.test.ts
```

Expected: first run exposes any remaining old helper or response assumptions. Remove those usages and rerun until all focused tests pass.

- [ ] **Step 3: Run the complete automated verification gate**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all Node/TSX tests pass, Vite production build succeeds, and `git diff --check` prints no errors.

- [ ] **Step 4: Rebuild/restart the local app if the dev server serves stale assets**

Use the repository's existing local development command. Confirm `http://localhost:5173` serves the new build before browser verification. Do not start a duplicate server when the existing process is healthy.

- [ ] **Step 5: Verify request counts in the signed-in browser**

Open a known app detail URL and inspect the browser network log. Record the URL, method, and count for each checkpoint:

| Action | Expected new requests |
|---|---|
| Open `/apps/claude` | exactly one `GET /api/apps/claude`; zero versions, screens, UI elements, flows, or design-system calls |
| Open Screens | one versions request and one `/api/apps/claude/screens` request |
| Return to Overview | zero new data requests |
| Return to Screens | zero new Screens requests for the cached key |
| Open UI Elements | exactly one `/api/apps/claude/ui-elements` request |
| Open Flows | exactly one `/api/apps/claude/flows` request and zero design-system requests |
| Open Design System | exactly one `/api/design-systems/claude` request |
| Switch Design System → Review | zero new design-system requests |
| Open Export after DS is cached | one Screens request only if its key is not already cached; zero new design-system requests |
| Change platform/version in Screens | one Screens request; zero UI-element, flow, or design-system requests |
| Load next Screens page | one cursor request; no duplicate rendered screen IDs |
| Navigate to another app before a slow response completes | old request is aborted and cannot overwrite the new app |

- [ ] **Step 6: Verify isolated error and retry behavior**

Temporarily force one section endpoint to fail using the browser request override or the existing API test fixture. Confirm:

- the app header and Overview remain accessible;
- only that section shows an error;
- retry calls only the failed endpoint;
- already successful sections stay cached;
- an abort caused by navigation does not show an error toast or stale content.

Remove the failure override immediately after the check.

- [ ] **Step 7: Commit the verification hardening**

```bash
git add src/vitrine/appsApi.test.ts src/vitrine/App.boundary.test.ts src/vitrine/ScreenDetailLoading.test.ts services/api/src/app.test.ts
git commit -m "test: verify lazy app detail requests"
```

- [ ] **Step 8: Confirm the final branch state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: the worktree is clean and the planned commits follow the approved design commit. Do not push until the user explicitly requests it.
