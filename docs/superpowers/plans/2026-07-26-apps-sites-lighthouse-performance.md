# Apps and Sites Lighthouse Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and execute each task inline on `main`.

**Goal:** Remove the measured initial-load bottlenecks on public `/apps` and `/sites`, then compare fresh mobile Lighthouse results.

**Architecture:** Keep the current public route and response contracts. Optimize the catalog identity SQL at its maintained-data source, make taxonomy media interaction-driven, progressively render Site cards, and remove redundant Site media authorization work plus the remote font dependency.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Node test runner, Vite, Lighthouse

---

### Task 1: Optimize public Apps identity selection

**Files:**
- Modify: `src/publicCatalogStore.test.ts`
- Modify: `src/publicCatalogStore.ts`

- [ ] Add assertions that the identity query uses maintained version `captured_at` and positive `screen_count`, without `JOIN LATERAL` or an `images` join.
- [ ] Run `node --experimental-strip-types --test src/publicCatalogStore.test.ts` and confirm the new assertions fail.
- [ ] Replace the lateral Screen lookup with `MAX(latest.captured_at)` over latest versions having `screen_count > 0`.
- [ ] Rerun the focused test and time the live store call.

### Task 2: Make Apps taxonomy previews interaction-driven

**Files:**
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`

- [ ] Replace the eager-prefetch expectation with a no-initial-prefetch contract.
- [ ] Run the focused test and confirm it fails against the idle prefetch effect.
- [ ] Remove the idle effect and visible-facet prefetch helper while retaining pointer-entry caching.
- [ ] Rerun the focused test.

### Task 3: Remove redundant Site media summary reads

**Files:**
- Modify: `services/api/src/publicSites.test.ts`
- Modify: `services/api/src/sites.ts`

- [ ] Record ready-summary reads and assert public media requests perform zero list reads.
- [ ] Run the focused test and confirm the assertion fails.
- [ ] Remove the summary lookup from `sendPublicCatalogMedia`; rely on the ready-version and record-scoped `siteMediaObject` query.
- [ ] Rerun public and private Sites route tests.

### Task 4: Defer Site taxonomy media and progressively render cards

**Files:**
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/components/SitesPage.tsx`

- [ ] Assert the source has no idle taxonomy prefetch and a 30-Site server render contains only 24 cards.
- [ ] Run the focused test and confirm both expectations fail.
- [ ] Remove the idle taxonomy prefetch effect.
- [ ] Add a 24-card progressive render boundary and a near-viewport observer sentinel that resets after filter or sort changes.
- [ ] Rerun the focused Sites tests.

### Task 5: Remove the remote font render block

**Files:**
- Modify: `src/vitrine/favicon.test.ts`
- Modify: `index.html`

- [ ] Assert the HTML shell contains no Google Fonts hosts.
- [ ] Run the focused test and confirm it fails.
- [ ] Remove the remote font stylesheet and preconnect links.
- [ ] Rerun the focused test.

### Task 6: Verify and benchmark

**Files:**
- Verify all modified files

- [ ] Run focused tests for every changed subsystem.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Serve the production bundle with the live API.
- [ ] Run standard mobile Lighthouse for `/apps` and `/sites`.
- [ ] Compare scores, web vitals, requests, payload, DOM size, and API timings to the saved baseline.
