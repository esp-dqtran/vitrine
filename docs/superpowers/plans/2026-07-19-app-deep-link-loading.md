# App Deep-Link Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated admin deep links such as `/apps/quora/screens` open the requested app even when it is outside the first paginated Apps response.

**Architecture:** Add a small Vitrine API helper that converts the existing app-detail response into the frontend `App` shape. Pass the routed app slug into `useApps`; for admins, load the first gallery page and the requested app together, then merge them by slug before publishing hook state. Non-admin catalog loading and the existing detail/access-control flow remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, existing Express `/api/apps/:app` endpoint.

---

### Task 1: Add the app-detail loader contract

**Files:**
- Create: `src/vitrine/appsApi.ts`
- Create: `src/vitrine/appsApi.test.ts`

- [ ] **Step 1: Write the failing API-helper tests**

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAppDetail, mergeApp } from './appsApi.ts';

test('loads an app detail by encoded slug and maps its screens', async () => {
  let requested = '';
  const app = await fetchAppDetail('quora mobile', undefined, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({
      app: { id: 'quora mobile', app: 'Quora', cat: 'Social', accent: '#b92b27', totalScreens: 563 },
      screens: [{ id: 1, type: 'Home', productArea: 'Feed', theme: 'light', visibleStates: [], platform: 'ios', description: null, url: '/media/1' }],
      nextCursor: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(requested, '/api/apps/quora%20mobile?limit=1');
  assert.equal(app.id, 'quora mobile');
  assert.equal(app.screens.length, 1);
});

test('mergeApp adds a missing deep-linked app without duplicating an existing app', () => {
  const linear = { id: 'linear', app: 'Linear', cat: 'Productivity', accent: '#000', totalScreens: 1, screens: [] };
  const quora = { id: 'quora', app: 'Quora', cat: 'Social', accent: '#b92b27', totalScreens: 1, screens: [] };
  assert.deepEqual(mergeApp([linear], quora).map(({ id }) => id), ['linear', 'quora']);
  assert.equal(mergeApp([linear, quora], quora).length, 2);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts`

Expected: FAIL because `src/vitrine/appsApi.ts` does not exist.

- [ ] **Step 3: Implement the minimal API helper**

```typescript
import type { App } from './types';

interface AppDetailResponse {
  app: Omit<App, 'screens'>;
  screens: App['screens'];
}

export async function fetchAppDetail(
  appId: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<App> {
  const response = await request(`/api/apps/${encodeURIComponent(appId)}?limit=1`, { signal });
  if (!response.ok) throw new Error(`/api/apps/${appId} returned ${response.status}`);
  const { app, screens } = await response.json() as AppDetailResponse;
  return { ...app, screens };
}

export function mergeApp(apps: App[], requested: App): App[] {
  return apps.some(({ id }) => id === requested.id) ? apps : [...apps, requested];
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts`

Expected: 2 passing tests and 0 failures.

### Task 2: Bootstrap requested admin apps in the catalog hook

**Files:**
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/App.tsx:38-44`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write the failing boundary regression test**

Append a test which reads `App.tsx` and `useApps.ts` and asserts that `App` passes the routed slug to `useApps`, the hook fetches a missing requested admin app through `fetchAppDetail`, and merges it before setting app state:

```typescript
test('bootstraps an admin app deep link outside the first gallery page', async () => {
  const [appSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /useApps\(user\?\.role, route\.name === 'app' \? route\.appId : undefined\)/);
  assert.match(hookSource, /fetchAppDetail\(requestedAppId/);
  assert.match(hookSource, /mergeApp\(page\.apps, requestedApp\)/);
});
```

- [ ] **Step 2: Run the boundary test and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/App.boundary.test.ts`

Expected: FAIL on the new deep-link assertions.

- [ ] **Step 3: Implement requested-app loading**

Change `useApps` to accept `requestedAppId?: string`. In the admin branch, fetch `/api/apps` and, only when `requestedAppId` is absent from `page.apps`, call `fetchAppDetail(requestedAppId)` and pass `mergeApp(page.apps, requestedApp)` to `setApps`. Include `requestedAppId` in the refresh callback dependency list. Keep the non-admin catalog loop unchanged.

Change `App.tsx` so `useRoute()` runs before `useApps()`, then call:

```typescript
const route = useRoute();
const { apps, loading, loadingMore, hasMore, error, loadMore } = useApps(
  user?.role,
  route.name === 'app' ? route.appId : undefined,
);
```

- [ ] **Step 4: Run focused Vitrine tests and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/appsApi.test.ts src/vitrine/App.boundary.test.ts`

Expected: all focused tests pass with 0 failures.

- [ ] **Step 5: Commit the implementation slice**

```bash
git add src/vitrine/appsApi.ts src/vitrine/appsApi.test.ts src/vitrine/useApps.ts src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "fix: load app deep links outside first page"
```

### Task 3: Verify the regression and local Quora route

**Files:**
- No additional code changes expected.

- [ ] **Step 1: Run the complete Vitrine test set**

Run: `node --experimental-strip-types --test src/vitrine/*.test.ts && npx tsx --test src/vitrine/*.test.tsx`

Expected: all Vitrine tests pass with 0 failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite exits 0 and writes the production bundle.

- [ ] **Step 3: Verify the authenticated browser route**

Open `http://localhost:5173/apps/quora/screens` in the authenticated browser and confirm the page heading/app identity is Quora and the Screens section is selected rather than the Apps gallery.

- [ ] **Step 4: Review the final diff**

Run: `git status --short` and `git diff HEAD^ -- src/vitrine/appsApi.ts src/vitrine/appsApi.test.ts src/vitrine/useApps.ts src/vitrine/App.tsx src/vitrine/App.boundary.test.ts`

Expected: the committed slice contains only the deep-link loader and regression coverage; pre-existing unrelated worktree changes remain unstaged.
