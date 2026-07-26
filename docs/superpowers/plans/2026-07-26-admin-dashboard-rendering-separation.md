# Admin Dashboard Rendering Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `/admin` through an isolated Users-only Admin dashboard while every normal product route keeps one role-independent application layout.

**Architecture:** Extend the pure root route policy with an `admin-dashboard` decision and lazy-load a dedicated `AdminDashboard` entry from `main.tsx`. The normal `App` renderer keeps role-based capabilities but loses all Admin shell and Users-page ownership; its `ApplicationSurface` becomes a page-plus-overlays boundary with no optional role frame.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, `react-dom/server`, `@astryxdesign/core`

---

## Working constraints

- Work directly on `main`.
- Preserve every unrelated dirty-worktree change.
- Do not create a branch or worktree.
- Do not commit or push unless the user explicitly requests it.
- Use `apply_patch` for edits.
- Run each RED test before its implementation.

## File map

### Create

- `src/vitrine/components/AdminSidebar.tsx` — Users-only Admin navigation and visible account controls.
- `src/vitrine/AdminSidebar.test.tsx` — rendered Admin navigation behavior.
- `src/vitrine/AdminDashboard.tsx` — isolated Admin shell and lazy Users outlet.
- `src/vitrine/AdminDashboard.test.tsx` — rendered shell and source-boundary isolation.

### Modify

- `src/vitrine/routeDecision.ts` — add the explicit `admin-dashboard` root result.
- `src/vitrine/routeDecision.test.ts` — cover admin access and shared normal-route decisions.
- `src/vitrine/main.tsx` — lazy-load and render `AdminDashboard`.
- `src/vitrine/mainBoundary.test.ts` — verify the top-level chunk and decision boundary.
- `src/vitrine/App.tsx` — remove Users, Sidebar, and Admin frame ownership.
- `src/vitrine/App.boundary.test.ts` — verify normal-renderer isolation.
- `src/vitrine/components/ApplicationSurface.tsx` — remove the now-unused optional side navigation.
- `src/vitrine/ApplicationSurface.test.tsx` — verify the role-independent persistent surface.
- `src/vitrine/ReferenceTypeTabs.test.tsx` — remove the obsolete product-sidebar assertion.
- `src/vitrine/favicon.test.ts` — point the Admin mark assertion at `AdminSidebar`.

### Delete

- `src/vitrine/components/Sidebar.tsx` — superseded mixed product/Admin navigation.

## Task 1: Add the Admin dashboard route decision

**Files:**

- Modify: `src/vitrine/routeDecision.test.ts`
- Modify: `src/vitrine/routeDecision.ts`

- [ ] **Step 1: Write the failing Admin decision tests**

Replace the current Admin-access test and add the shared-renderer test:

```ts
test('selects the isolated Admin dashboard only for an admin session', () => {
  assert.deepEqual(decideRootRoute({ name: 'admin' }, guest), { kind: 'signin' });
  assert.deepEqual(decideRootRoute({ name: 'admin' }, member), {
    kind: 'denied',
    title: 'Admin access required',
  });
  assert.deepEqual(decideRootRoute({ name: 'admin' }, admin), {
    kind: 'admin-dashboard',
  });
});

test('uses the same application renderer for members and admins on normal routes', () => {
  const routes: Route[] = [
    { name: 'apps' },
    { name: 'sites' },
    { name: 'app', appId: 'linear' },
    { name: 'site-version', siteId: 1, versionId: 2 },
    { name: 'search' },
    { name: 'projects' },
    { name: 'project', projectId: 7 },
    { name: 'feature-document', documentId: 9 },
    { name: 'settings-billing' },
  ];

  for (const route of routes) {
    assert.deepEqual(decideRootRoute(route, member), { kind: 'application' }, `member ${route.name}`);
    assert.deepEqual(decideRootRoute(route, admin), { kind: 'application' }, `admin ${route.name}`);
  }
});
```

- [ ] **Step 2: Run the decision tests and verify RED**

Run:

```bash
node --test --import tsx src/vitrine/routeDecision.test.ts
```

Expected: FAIL because Admin `/admin` still returns `{ kind: 'application' }`.

- [ ] **Step 3: Add the explicit decision type and result**

Add this member to `RootRouteDecision`:

```ts
  | { kind: 'admin-dashboard' }
```

Replace the `admin` case with:

```ts
    case 'admin':
      if (context.auth === 'guest') return { kind: 'signin' };
      return context.auth === 'admin'
        ? { kind: 'admin-dashboard' }
        : { kind: 'denied', title: 'Admin access required' };
```

- [ ] **Step 4: Run the decision tests and verify GREEN**

Run:

```bash
node --test --import tsx src/vitrine/routeDecision.test.ts
```

Expected: all route-decision tests PASS.

- [ ] **Step 5: Inspect only the scoped diff**

Run:

```bash
git diff -- src/vitrine/routeDecision.ts src/vitrine/routeDecision.test.ts
```

Expected: only the new decision and its tests appear; do not commit.

## Task 2: Create the dedicated Admin sidebar

**Files:**

- Create: `src/vitrine/AdminSidebar.test.tsx`
- Create: `src/vitrine/components/AdminSidebar.tsx`

- [ ] **Step 1: Write the failing rendered sidebar test**

Create `src/vitrine/AdminSidebar.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminSidebar } from './components/AdminSidebar.tsx';

test('renders one Users destination plus Back to Vitrine and account controls', () => {
  const html = renderToStaticMarkup(
    <AdminSidebar
      email="admin@example.com"
      onBack={() => undefined}
      onLogout={() => undefined}
    />,
  );

  assert.match(html, /Vitrine Admin/);
  assert.match(html, />Users</);
  assert.match(html, />Back to Vitrine</);
  assert.match(html, /admin@example\.com/);
  assert.match(html, />Log out</);
  assert.doesNotMatch(html, />Search</);
  assert.doesNotMatch(html, />Projects</);
  assert.doesNotMatch(html, />References</);
});
```

- [ ] **Step 2: Run the sidebar test and verify RED**

Run:

```bash
node --test --import tsx src/vitrine/AdminSidebar.test.tsx
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `AdminSidebar.tsx`.

- [ ] **Step 3: Implement the focused Admin sidebar**

Create `src/vitrine/components/AdminSidebar.tsx`:

```tsx
import { Button, SideNav, SideNavHeading, SideNavItem } from '@astryxdesign/core';

interface AdminSidebarProps {
  email: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
}

function AdminWordmarkIcon() {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        background: 'var(--color-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: 3, background: '#FFFFFF' }} />
    </div>
  );
}

export function AdminSidebar({ email, onBack, onLogout }: AdminSidebarProps) {
  return (
    <SideNav
      header={<SideNavHeading icon={<AdminWordmarkIcon />} heading="Vitrine Admin" />}
      footerIcons={(
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
            {email}
          </span>
          <Button label="Log out" variant="ghost" size="sm" onClick={onLogout} />
        </div>
      )}
    >
      <SideNavItem label="Users" isSelected onClick={() => undefined} />
      <SideNavItem label="Back to Vitrine" isSelected={false} onClick={onBack} />
    </SideNav>
  );
}
```

- [ ] **Step 4: Run the sidebar test and verify GREEN**

Run:

```bash
node --test --import tsx src/vitrine/AdminSidebar.test.tsx
```

Expected: the Admin sidebar test PASS.

- [ ] **Step 5: Inspect the rendered boundary diff**

Run:

```bash
git diff -- src/vitrine/AdminSidebar.test.tsx src/vitrine/components/AdminSidebar.tsx
```

Expected: one focused navigation component and one rendered test; do not commit.

## Task 3: Create the isolated Admin dashboard

**Files:**

- Create: `src/vitrine/AdminDashboard.test.tsx`
- Create: `src/vitrine/AdminDashboard.tsx`

- [ ] **Step 1: Write the failing shell and isolation tests**

Create `src/vitrine/AdminDashboard.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminDashboardShell } from './AdminDashboard.tsx';

test('renders the Users outlet inside the dedicated Admin shell', () => {
  const html = renderToStaticMarkup(
    <AdminDashboardShell
      email="admin@example.com"
      onBack={() => undefined}
      onLogout={() => undefined}
      page={<main data-admin-page="users">Users content</main>}
    />,
  );

  assert.match(html, /data-admin-dashboard="true"/);
  assert.match(html, /Vitrine Admin/);
  assert.match(html, /data-admin-page="users"/);
  assert.match(html, /Users content/);
});

test('lazy-loads Users without importing normal application state', async () => {
  const source = await readFile(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');

  assert.match(source, /lazy\(\(\) => import\(['"]\.\/components\/UsersPage['"]\)/);
  assert.match(source, /<Suspense fallback=\{<AdminPageSpinner \/>}/);
  assert.doesNotMatch(
    source,
    /useApps|useAppDetail|useCollections|createSearchSession|loadSubscription|ApplicationSurface|ImportDialog/,
  );
});
```

- [ ] **Step 2: Run the dashboard tests and verify RED**

Run:

```bash
node --test --import tsx src/vitrine/AdminDashboard.test.tsx
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `AdminDashboard.tsx`.

- [ ] **Step 3: Implement the Admin dashboard shell and lazy Users outlet**

Create `src/vitrine/AdminDashboard.tsx`:

```tsx
import { lazy, Suspense, type ReactNode } from 'react';
import { AppShell, Spinner } from '@astryxdesign/core';
import type { AuthUser } from './authApi.ts';
import { navigate } from './router.ts';
import { AdminSidebar } from './components/AdminSidebar.tsx';

const UsersPage = lazy(() => import('./components/UsersPage').then((module) => ({
  default: module.UsersPage,
})));

interface AdminDashboardShellProps {
  email: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
  page: ReactNode;
}

export function AdminDashboardShell({
  email,
  onBack,
  onLogout,
  page,
}: AdminDashboardShellProps) {
  return (
    <div data-admin-dashboard="true" style={{ display: 'contents' }}>
      <AppShell
        variant="section"
        sideNav={(
          <AdminSidebar
            email={email}
            onBack={onBack}
            onLogout={onLogout}
          />
        )}
      >
        {page}
      </AppShell>
    </div>
  );
}

export function AdminDashboard({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <AdminDashboardShell
      email={user.email}
      onBack={() => navigate({ name: 'apps' })}
      onLogout={onLogout}
      page={(
        <Suspense fallback={<AdminPageSpinner />}>
          <UsersPage />
        </Suspense>
      )}
    />
  );
}

function AdminPageSpinner() {
  return (
    <main
      className="vitrine-page admin-users-state"
      role="status"
      aria-label="Loading users"
    >
      <Spinner size="lg" />
    </main>
  );
}
```

- [ ] **Step 4: Run the dashboard and sidebar tests and verify GREEN**

Run:

```bash
node --test --import tsx \
  src/vitrine/AdminSidebar.test.tsx \
  src/vitrine/AdminDashboard.test.tsx
```

Expected: all Admin shell tests PASS.

- [ ] **Step 5: Inspect the Admin entry diff**

Run:

```bash
git diff -- src/vitrine/AdminDashboard.tsx src/vitrine/AdminDashboard.test.tsx
```

Expected: the Admin entry depends only on auth identity, typed navigation, its sidebar, Users, and design-system primitives; do not commit.

## Task 4: Wire the Admin entry at the root renderer

**Files:**

- Modify: `src/vitrine/mainBoundary.test.ts`
- Modify: `src/vitrine/main.tsx`

- [ ] **Step 1: Write the failing root-boundary assertions**

Update the decision-boundary test to include:

```ts
  assert.match(source, /case 'admin-dashboard':[\s\S]{0,220}return user\?\.role === 'admin'/);
  assert.match(source, /<AdminDashboard user=\{user\} onLogout=\{logout\} \/>/);
```

Update the lazy-boundary test to include:

```ts
  assert.match(source, /lazy\(\(\) => import\(['"]\.\/AdminDashboard['"]\)/);
```

- [ ] **Step 2: Run the root-boundary test and verify RED**

Run:

```bash
node --test --import tsx src/vitrine/mainBoundary.test.ts
```

Expected: FAIL because `main.tsx` has no Admin lazy entry or render case.

- [ ] **Step 3: Add the lazy Admin entry and render decision**

Add beside the lazy `App` declaration:

```tsx
const AdminDashboard = lazy(() => import('./AdminDashboard').then((module) => ({
  default: module.AdminDashboard,
})));
```

Include `logout` in the `useAuth` destructuring:

```tsx
  const { user, loading, authenticate, register, completeLogin, logout } = useAuth();
```

Add this switch branch immediately after `application`:

```tsx
    case 'admin-dashboard':
      return user?.role === 'admin'
        ? <AdminDashboard user={user} onLogout={logout} />
        : <RouteStatusPage title="Admin access required" onBack={goApps} />;
```

- [ ] **Step 4: Run root and route tests and verify GREEN**

Run:

```bash
node --test --import tsx \
  src/vitrine/routeDecision.test.ts \
  src/vitrine/mainBoundary.test.ts
```

Expected: all root policy and boundary tests PASS.

- [ ] **Step 5: Inspect the root wiring**

Run:

```bash
git diff -- src/vitrine/main.tsx src/vitrine/mainBoundary.test.ts
```

Expected: `/admin` has one isolated lazy entry and normal `application` still returns `<App />`; do not commit.

## Task 5: Remove Admin layout ownership from the normal application

**Files:**

- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/ApplicationSurface.test.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/ApplicationSurface.tsx`

- [ ] **Step 1: Write the failing normal-renderer isolation test**

Add to `src/vitrine/App.boundary.test.ts`:

```ts
test('keeps Admin dashboard ownership out of the normal application renderer', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /components\/UsersPage/);
  assert.doesNotMatch(source, /components\/Sidebar/);
  assert.doesNotMatch(source, /\buseAdminFrame\b/);
  assert.doesNotMatch(source, /\badminSideNav\b/);
  assert.doesNotMatch(source, /<UsersPage/);
  assert.doesNotMatch(source, /sideNav=/);
});
```

Replace the second test in `src/vitrine/ApplicationSurface.test.tsx` with:

```tsx
test('keeps the normal application surface independent from user role', () => {
  const html = renderToStaticMarkup(
    <ApplicationSurface
      page={<main data-current-page="apps">Apps</main>}
      overlays={<aside data-application-overlays="true">Collections</aside>}
      dialogs={<div data-application-dialogs="true">Import</div>}
    />,
  );

  assert.match(html, /data-application-surface="true"/);
  assert.match(html, /data-current-page="apps"/);
  assert.match(html, /data-application-overlays="true"/);
  assert.doesNotMatch(html, /data-admin-dashboard/);
});
```

- [ ] **Step 2: Run the isolation tests and verify RED**

Run:

```bash
node --test --import tsx \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/ApplicationSurface.test.tsx
```

Expected: FAIL because `App` still imports Users and Sidebar, tracks the Admin frame, and passes `sideNav`.

- [ ] **Step 3: Simplify `ApplicationSurface`**

Replace `src/vitrine/components/ApplicationSurface.tsx` with:

```tsx
import type { ReactNode } from 'react';

interface ApplicationSurfaceProps {
  page: ReactNode;
  overlays: ReactNode;
  dialogs: ReactNode;
}

export function ApplicationSurface({
  page,
  overlays,
  dialogs,
}: ApplicationSurfaceProps) {
  return (
    <div data-application-surface="true" style={{ display: 'contents' }}>
      {page}
      {overlays}
      {dialogs}
    </div>
  );
}
```

- [ ] **Step 4: Remove Admin shell symbols from `App`**

Delete these imports and declarations:

```tsx
import { Sidebar } from './components/Sidebar';
```

```tsx
const UsersPage = lazy(() => import('./components/UsersPage').then((module) => ({
  default: module.UsersPage,
})));
```

Delete the complete `adminSideNav` block.

Replace:

```tsx
  let page: ReactNode;
  let useAdminFrame = false;
```

with:

```tsx
  let page: ReactNode;
```

Delete every assignment:

```tsx
      useAdminFrame = isAdmin;
```

Remove the Admin dashboard page case:

```tsx
    case 'admin':
      useAdminFrame = isAdmin;
      page = isAdmin
        ? <UsersPage />
        : <ApplicationStatusPage title="Admin access required" />;
      break;
```

Add `admin` to the existing out-of-application group:

```tsx
    case 'admin':
    case 'landing':
    case 'not-found':
    case 'build-in-public':
    case 'pricing':
    case 'billing-success':
    case 'signin':
    case 'feature-document-share':
      page = <ApplicationStatusPage title="This page is outside the application" />;
      break;
```

Replace the final surface render with:

```tsx
  return (
    <ApplicationSurface
      page={<Suspense fallback={<ApplicationPageSpinner />}>{page}</Suspense>}
      overlays={discoveryOverlays}
      dialogs={dialogs}
    />
  );
```

- [ ] **Step 5: Run the normal-renderer tests and verify GREEN**

Run:

```bash
node --test --import tsx \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/ApplicationSurface.test.tsx \
  src/vitrine/publicAppsBoundary.test.ts
```

Expected: all normal application surface and public overlay tests PASS.

- [ ] **Step 6: Inspect the normal renderer diff**

Run:

```bash
git diff -- src/vitrine/App.tsx src/vitrine/components/ApplicationSurface.tsx
```

Expected: role-based capabilities such as `isAdmin` and Import remain; only Admin page/layout ownership is removed. Do not commit.

## Task 6: Retire the mixed sidebar and update affected contracts

**Files:**

- Delete: `src/vitrine/components/Sidebar.tsx`
- Modify: `src/vitrine/ReferenceTypeTabs.test.tsx`
- Modify: `src/vitrine/favicon.test.ts`

- [ ] **Step 1: Remove the obsolete mixed-navigation assertion**

Delete this test from `src/vitrine/ReferenceTypeTabs.test.tsx`:

```ts
test('uses one References sidebar item for App and Site routes', () => {
  const source = readFileSync(new URL('./components/Sidebar.tsx', import.meta.url), 'utf8');
  assert.match(source, /label: 'References'/);
  assert.doesNotMatch(source, /label: 'Apps'/);
  assert.doesNotMatch(source, /label: 'Sites'/);
  assert.match(source, /r\.name === 'site-version'/);
  assert.match(source, /r\.name === 'app'/);
});
```

Also remove the now-unused `readFileSync` import:

```ts
import { readFileSync } from 'node:fs';
```

- [ ] **Step 2: Point the brand-mark contract at the new Admin sidebar**

In `src/vitrine/favicon.test.ts`, replace:

```ts
    ['./components/Sidebar.tsx', 9],
```

with:

```ts
    ['./components/AdminSidebar.tsx', 9],
```

- [ ] **Step 3: Delete the superseded Sidebar**

Delete:

```text
src/vitrine/components/Sidebar.tsx
```

- [ ] **Step 4: Run the affected navigation and Admin tests**

Run:

```bash
node --test --import tsx \
  src/vitrine/ReferenceTypeTabs.test.tsx \
  src/vitrine/AdminSidebar.test.tsx \
  src/vitrine/AdminDashboard.test.tsx
```

Expected: all selected tests PASS.

Run the favicon contract separately:

```bash
node --test --import tsx src/vitrine/favicon.test.ts
```

Expected: the AdminSidebar path is valid. If the existing App mark assertion still fails, record it as the known unrelated baseline; do not change normal-page visuals in this refactor.

- [ ] **Step 5: Confirm no production imports target the deleted file**

Run:

```bash
rg -n "components/Sidebar|<Sidebar" src/vitrine
```

Expected: no matches.

## Task 7: Focused integration verification

**Files:**

- Test: `src/vitrine/routeDecision.test.ts`
- Test: `src/vitrine/mainBoundary.test.ts`
- Test: `src/vitrine/AdminSidebar.test.tsx`
- Test: `src/vitrine/AdminDashboard.test.tsx`
- Test: `src/vitrine/App.boundary.test.ts`
- Test: `src/vitrine/ApplicationSurface.test.tsx`
- Test: `src/vitrine/publicAppsBoundary.test.ts`
- Test: `src/vitrine/ReferenceTypeTabs.test.tsx`

- [ ] **Step 1: Run the complete focused rendering set**

Run:

```bash
node --test --import tsx \
  src/vitrine/routeDecision.test.ts \
  src/vitrine/mainBoundary.test.ts \
  src/vitrine/AdminSidebar.test.tsx \
  src/vitrine/AdminDashboard.test.tsx \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/ApplicationSurface.test.tsx \
  src/vitrine/publicAppsBoundary.test.ts \
  src/vitrine/ReferenceTypeTabs.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run existing Users behavior tests**

Run:

```bash
node --test --import tsx src/vitrine/components/UsersPage.test.tsx
```

Expected: the existing Users page tests PASS.

- [ ] **Step 3: Run route and access regression tests**

Run:

```bash
node --test --import tsx \
  src/vitrine/router.test.ts \
  src/vitrine/routerNavigation.test.ts \
  src/vitrine/routeAccess.test.ts
```

Expected: all route and access tests PASS.

- [ ] **Step 4: Check formatting and scoped status**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits zero. Confirm all unrelated dirty files are still present and untouched.

## Task 8: Production and repository verification

**Files:**

- Verify only; no planned production edits.

- [ ] **Step 1: Build the production bundle**

Run:

```bash
npm run build
```

Expected: Vite exits zero and emits separate `AdminDashboard` and `UsersPage` chunks. The normal entry must not eagerly absorb Users.

- [ ] **Step 2: Run the full repository suite**

Run:

```bash
npm test
```

Expected: no new failure beyond the current unrelated baselines:

- `src/legacyFlowMdRemoval.test.ts`
- `src/vitrine/astryxComponentCompliance.test.ts`
- the existing App mark assertion in `src/vitrine/favicon.test.ts`

If any different test fails, stop and diagnose it before completion.

- [ ] **Step 3: Run final diff checks**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected: clean diff validation, no accidental generated files, and all pre-existing unrelated changes preserved.

- [ ] **Step 4: Report the result without committing**

Report:

- the isolated `/admin` renderer;
- normal-role layout parity;
- focused test count;
- production chunk evidence;
- full-suite result with any unchanged baselines;
- confirmation that no commit or push occurred.
