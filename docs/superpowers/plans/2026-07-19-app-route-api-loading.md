# Route-Aware Apps API Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Apps and App Detail routes request only the data they own, preserve gallery state across navigation, and lazy-load optional detail resources.

**Architecture:** Keep gallery pagination in `useApps`, add an independent `useAppDetail` hook backed by a richer detail-page API client, and pass the initial version/cursor into `ScreenDetail`. Gate optional data by role, route, and active section so admin detail loads never request the gallery, billing, collections, or UI elements.

**Tech Stack:** React 19 hooks, TypeScript, Node test runner, React server rendering tests, Express API contracts, Vite, browser CDP verification.

---

### Task 1: Detail-page API contract

**Files:**
- Modify: `src/vitrine/appsApi.ts`
- Modify: `src/vitrine/appsApi.test.ts`

- [ ] **Step 1: Write the failing API contract tests**

Replace the one-screen expectation with a page contract and add an error test:

```ts
test('loads the first 48 detail screens with version and cursor metadata', async () => {
  let requested = '';
  const detail = await fetchAppDetailPage('quora mobile', undefined, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({
      app: { id: 'quora mobile', app: 'Quora', cat: 'Social', accent: '#b92b27', totalScreens: 563 },
      screens: [screen],
      nextCursor: 'next-screen',
      version: { id: 7, app: 'quora mobile', platform: 'ios', version_number: 3, status: 'published' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(requested, '/api/apps/quora%20mobile?limit=48');
  assert.equal(detail.app.screens.length, 1);
  assert.equal(detail.nextCursor, 'next-screen');
  assert.equal(detail.version?.version_number, 3);
});

test('reports a detail API failure without converting it to empty data', async () => {
  await assert.rejects(
    () => fetchAppDetailPage('missing', undefined, async () => new Response(null, { status: 404 })),
    /\/api\/apps\/missing returned 404/,
  );
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts`

Expected: FAIL because `fetchAppDetailPage` does not exist.

- [ ] **Step 3: Implement the page client**

Implement this public client shape in `appsApi.ts`:

```ts
import type { AppVersion } from '../db';

export interface AppDetailPage {
  app: App;
  nextCursor: string | null;
  version: AppVersion | null;
}

export async function fetchAppDetailPage(
  appId: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<AppDetailPage> {
  const response = await request(`/api/apps/${encodeURIComponent(appId)}?limit=48`, { signal });
  if (!response.ok) throw new Error(`/api/apps/${appId} returned ${response.status}`);
  const body = await response.json() as {
    app: Omit<App, 'screens'>;
    screens: App['screens'];
    nextCursor: string | null;
    version: AppVersion | null;
  };
  return { app: { ...body.app, screens: body.screens }, nextCursor: body.nextCursor, version: body.version };
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated client/hook change**

```bash
git add src/vitrine/appsApi.ts src/vitrine/appsApi.test.ts
git commit -m "refactor: expose app detail page loading"
```

### Task 2: Route-owned gallery and detail state

**Files:**
- Create: `src/vitrine/useAppDetail.ts`
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write failing route-boundary tests**

Replace the old gallery-merge deep-link test with source-boundary assertions that express the route contract:

```ts
test('separates gallery and detail route loaders', async () => {
  const [appSource, gallerySource, detailSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
    readFile(new URL('./useAppDetail.ts', import.meta.url), 'utf8').catch(() => ''),
  ]);

  assert.match(appSource, /useApps\(user\?\.role, route\.name === 'apps'\)/);
  assert.match(appSource, /useAppDetail\(route\.name === 'app' \? route\.appId : undefined/);
  assert.doesNotMatch(gallerySource, /requestedAppId|fetchAppDetail|mergeApp/);
  assert.doesNotMatch(detailSource, /['"]\/api\/apps['"]/);
});

test('does not reload a retained gallery merely because it is re-enabled', async () => {
  const source = await readFile(new URL('./useApps.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!enabled \|\| apps !== null\) return/);
});
```

- [ ] **Step 2: Run the boundary test and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/App.boundary.test.ts`

Expected: FAIL because `App` still passes a requested app id into the gallery hook.

- [ ] **Step 3: Make the gallery hook route-aware**

Create `useAppDetail.ts` with independent `detail`, `loading`, and `error` state. Its effect must abort stale requests and must not call the gallery client:

```ts
export function useAppDetail(appId: string | undefined, enabled: boolean) {
  const [detail, setDetail] = useState<AppDetailPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !appId) return;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    fetchAppDetailPage(appId, controller.signal)
      .then(setDetail)
      .catch((cause: Error) => { if (cause.name !== 'AbortError') setError(cause.message); });
    return () => controller.abort();
  }, [appId, enabled]);

  return { detail, loading: enabled && detail === null && error === null, error };
}
```

Change the signature to `useApps(role, enabled)`; remove `requestedAppId`, `fetchAppDetail`, and `mergeApp`. Preserve successful state while disabled and load only when enabled with no retained page:

```ts
useEffect(() => {
  if (!enabled || apps !== null) return;
  const controller = new AbortController();
  void refresh(controller.signal);
  return () => controller.abort();
}, [apps, enabled, refresh]);
```

Keep cursor pagination and explicit `refresh()` unchanged.

- [ ] **Step 4: Render detail state without `apps.find`**

In `App.tsx`, call the hooks independently:

```ts
const galleryEnabled = route.name === 'apps';
const { apps, loading: appsLoading, loadingMore, hasMore, error: appsError, loadMore } = useApps(user?.role, galleryEnabled);
const detailEnabled = route.name === 'app' && (isAdmin || (entitlements !== null && !isFreeGated(route.appId)));
const { detail, loading: detailLoading, error: detailError } = useAppDetail(
  route.name === 'app' ? route.appId : undefined,
  detailEnabled,
);
```

Use `detail?.app` for `ScreenDetail`, pass its initial version/cursor, and make loading/error branches route-specific. A direct detail route must never fall through to rendering the gallery.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/appsApi.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the route ownership change**

```bash
git add src/vitrine/useAppDetail.ts src/vitrine/useApps.ts src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "fix: load app routes without gallery requests"
```

### Task 3: Initial version/cursor reuse and lazy UI elements

**Files:**
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/useDesignSystem.ts`
- Modify: `src/vitrine/useDesignSystem.test.ts`

- [ ] **Step 1: Write failing detail-resource boundary tests**

Add tests proving the initial metadata is accepted and eager element loading is absent:

```ts
test('reuses initial detail version and cursor', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /initialVersion/);
  assert.match(source, /initialNextCursor/);
  assert.match(source, /useState<number \| undefined>\(initialVersion\?\.version_number\)/);
});

test('loads raw UI elements only from the elements section', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /section !== 'elements'/);
  assert.match(source, /designSystemStatus === 'loading'/);
  assert.doesNotMatch(source, /Promise\.all\(\[\s*fetch\([^\]]+loadElements/);
});
```

Extend the design-system client test to capture the exact first URL:

```ts
test('loads the resolved version in the first design-system request', async () => {
  let requested = '';
  await loadDesignSystem('linear', 'web', undefined, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify(snapshot), { status: 200 });
  }, 4);
  assert.equal(requested, '/api/design-systems/linear?platform=web&version=4');
});
```

- [ ] **Step 2: Run detail tests and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/useDesignSystem.test.ts && tsx --test src/vitrine/ScreenDetail.test.tsx`

Expected: FAIL because `ScreenDetail` has no initial version/cursor props and still eagerly calls `loadElements` from `selectVersion`.

- [ ] **Step 3: Initialize detail state from the direct response**

Add props and initialize state:

```ts
initialVersion?: AppVersion | null;
initialNextCursor?: string | null;
```

```ts
const [selectedVersion, setSelectedVersion] = useState<number | undefined>(initialVersion?.version_number);
const [versionScreens, setVersionScreens] = useState<App['screens'] | null>(app.screens);
const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
```

When `listAppVersions` resolves, call `selectVersion` only if no selected version exists. `selectVersion` must request screens only; remove `loadElements` from its `Promise.all`.

- [ ] **Step 4: Load raw elements only when required**

Add an abortable effect:

```ts
useEffect(() => {
  if (section !== 'elements' || designSystemStatus === 'loading' || components.length > 0 || elementImages !== null) return;
  const controller = new AbortController();
  void loadElements(selectedVersion, controller.signal);
  return () => controller.abort();
}, [section, designSystemStatus, components.length, elementImages, selectedPlatform, selectedVersion]);
```

Update `loadElements(version, signal)` to throw on non-success, ignore abort errors, and set section-local error state for other failures. Reset element state on platform/version changes.

- [ ] **Step 5: Run detail tests and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/useDesignSystem.test.ts && tsx --test src/vitrine/ScreenDetail.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit detail-resource loading**

```bash
git add src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/useDesignSystem.ts src/vitrine/useDesignSystem.test.ts
git commit -m "fix: lazy load app detail resources"
```

### Task 4: Role-aware billing and lazy collections

**Files:**
- Create: `src/vitrine/useCollections.ts`
- Create: `src/vitrine/useCollections.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write failing billing and collection tests**

Add boundary assertions:

```ts
test('loads subscription only for regular users and collections on demand', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(user\?\.role !== 'user'\)/);
  assert.match(source, /ensureCollections/);
  assert.doesNotMatch(source, /void listCollections\(\)\.then/);
});
```

Test an exported in-flight deduplicator from `useCollections.ts`:

```ts
test('deduplicates concurrent collection loads', async () => {
  let calls = 0;
  const resource = createCollectionsResource(async () => {
    calls += 1;
    return [];
  });
  const [left, right] = await Promise.all([resource.load(), resource.load()]);
  assert.equal(calls, 1);
  assert.deepEqual(left, right);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/useCollections.test.ts src/vitrine/App.boundary.test.ts`

Expected: FAIL because the lazy collections resource does not exist and `App` still loads collections/subscription unconditionally.

- [ ] **Step 3: Implement the lazy collections resource/hook**

Implement a small resource with cached and in-flight states:

```ts
export function createCollectionsResource(loadCollections = listCollections) {
  let value: ResearchCollection[] | null = null;
  let pending: Promise<ResearchCollection[]> | null = null;
  return {
    load() {
      if (value) return Promise.resolve(value);
      if (pending) return pending;
      pending = loadCollections().then((items) => (value = items)).finally(() => { pending = null; });
      return pending;
    },
    replace(items: ResearchCollection[]) { value = items; },
  };
}
```

`useCollections` owns one resource in a ref, exposes `collections`, `loaded`, `ensureCollections`, and `setCollections`, and updates React state when the resource resolves.

- [ ] **Step 4: Gate billing and collection surfaces**

In `App.tsx`, request `/api/billing/subscription` only when `user?.role === 'user'`; admin sets entitlement loading complete without an HTTP request. Replace direct `setCollectionsOpen(true)` and `setPaletteOpen(true)` handlers with async handlers that call `ensureCollections()` first. Pass `collections ?? []` to existing consumers and omit account counts until `loaded` is true.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/useCollections.test.ts src/vitrine/App.boundary.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit optional global-data loading**

```bash
git add src/vitrine/useCollections.ts src/vitrine/useCollections.test.ts src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "fix: lazy load optional app shell data"
```

### Task 5: Focused regression and production verification

**Files:**
- Modify only if a failing regression reveals an in-scope defect.

- [ ] **Step 1: Run all Vitrine unit and rendering tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/*.test.ts
tsx --test src/vitrine/*.test.tsx
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run the full repository test suite**

Run: `npm test`

Expected: exit code 0 with zero failed tests.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits 0 and emits the production bundle.

- [ ] **Step 4: Verify the cold Apps route in the authenticated browser**

Capture CDP network events for `http://localhost:5173/apps`. Verify exactly one `/api/apps`, one progress SSE connection, no `/api/jobs`, no subscription for admin, no collections, and no detail/design-system/UI-element requests.

- [ ] **Step 5: Verify the cold Screens detail route**

Capture events for `http://localhost:5173/apps/nordvpn/screens`. Verify no `/api/apps` gallery request, one `?limit=48` detail request, one versions request, one versioned design-system request, no subscription, no collections, no UI-element request, and no progress/jobs connection.

- [ ] **Step 6: Verify all detail section transitions**

Open UI Elements, Flows, Design System, Export, and Review. Verify UI Elements makes at most one raw-element data request when no analyzed components exist; other section changes make no JSON/data request. Media requests required for visible evidence are allowed.

- [ ] **Step 7: Inspect the final scoped diff**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~4..HEAD
```

Expected: no whitespace errors; unrelated pre-existing changes remain unstaged and uncommitted.
