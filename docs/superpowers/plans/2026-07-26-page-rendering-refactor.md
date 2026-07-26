# Page Rendering Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Vitrine page rendering exhaustive, persistent, behavior-tested, and route-lazy without changing the public catalog contract.

**Architecture:** Add a pure route-decision boundary and a single application frame around an exhaustive page outlet. Keep the existing typed router, centralize history notifications, extract the App-detail loading surface, and lazy-load route pages.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, `@astryxdesign/core`

---

### Task 1: Exhaustive route decisions

**Files:**
- Create: `src/vitrine/routeDecision.ts`
- Create: `src/vitrine/routeDecision.test.ts`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/main.tsx`

- [ ] Write table-driven tests for guest, member, and admin decisions across every `Route['name']`, including authenticated landing/sign-in redirects, Admin denial, disabled Search/Projects, and not-found.
- [ ] Run `node --test --import tsx src/vitrine/routeDecision.test.ts` and verify the missing module or decision cases fail.
- [ ] Implement `RouteDecisionContext`, the discriminated `RouteDecision` result, and an exhaustive `decideRoute()` switch.
- [ ] Add a `not-found` route and preserve unknown path information.
- [ ] Render public, sign-in, redirect, unavailable, denied, and application outcomes from `Root`.
- [ ] Re-run the focused decision and router tests and verify they pass.

### Task 2: Persistent application frame

**Files:**
- Create: `src/vitrine/components/ApplicationOverlays.tsx`
- Create: `src/vitrine/ApplicationFrame.test.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] Write rendered tests that open Settings and Collections from Site detail and an Admin-framed page.
- [ ] Run the focused tests and verify the overlays are absent with the current branch-specific renderer.
- [ ] Extract overlay rendering into `ApplicationOverlays`.
- [ ] Render the application page outlet and overlays as siblings exactly once.
- [ ] Keep the Admin `AppShell` around only the routes intended to use the sidebar, while keeping overlays outside it.
- [ ] Re-run the focused frame tests and existing catalog-boundary tests.

### Task 3: Exhaustive application outlet

**Files:**
- Create: `src/vitrine/appRouteDecision.ts`
- Create: `src/vitrine/appRouteDecision.test.ts`
- Modify: `src/vitrine/App.tsx`

- [ ] Write tests covering every application route and its explicit page state.
- [ ] Verify disabled, unauthorized, and unsupported states fail before implementation.
- [ ] Replace the `if` chain and empty-detail fallback with an exhaustive page-decision switch.
- [ ] Preserve route-scoped `useApps` and `useAppDetail` enablement.
- [ ] Verify every application decision renders content.

### Task 4: Shared App-detail loading shell

**Files:**
- Create: `src/vitrine/components/AppDetailLoadingPage.tsx`
- Create: `src/vitrine/AppDetailLoadingPage.test.tsx`
- Modify: `src/vitrine/components/ReferenceDetailShell.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] Write a rendered test requiring the loading page to expose both the Apps navigation and shared `data-reference-detail="app"` shell.
- [ ] Verify the new component test fails before implementation.
- [ ] Add a loading-compatible identity/metadata/body contract to `ReferenceDetailShell`.
- [ ] Move the loading composition out of `App.tsx`.
- [ ] Re-run detail-shell and App boundary tests.

### Task 5: Lazy route modules and navigation notifications

**Files:**
- Modify: `src/vitrine/main.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/components/AdvancedSearchPage.tsx`
- Modify: `src/vitrine/components/QuickSearch.tsx`
- Create: `src/vitrine/routerNavigation.test.ts`

- [ ] Write tests proving location updates dispatch the shared navigation event and Advanced Search responds to Back/Forward state.
- [ ] Verify the tests fail with direct `history.pushState` ownership.
- [ ] Add `updateLocation()` and use it from typed and query-string navigation.
- [ ] Subscribe Advanced Search to location state instead of initializing it only once.
- [ ] Convert route page imports to `React.lazy` with one shared page fallback.
- [ ] Build and inspect Vite output for multiple route chunks.

### Task 6: Behavior-focused boundary tests and verification

**Files:**
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/mainBoundary.test.ts`
- Modify: relevant `.test.tsx` files

- [ ] Replace assertions that require data attributes or components to live in a specific source file with rendered assertions against the shared shell.
- [ ] Run all focused Vitrine route, shell, catalog, and navigation tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Review `git diff --stat` and confirm only requested renderer, tests, and documentation were changed.
