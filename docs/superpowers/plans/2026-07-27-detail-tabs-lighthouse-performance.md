# Detail Tabs Lighthouse Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and execute each task inline on `main`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authenticated App and Site detail tab load with a repeatable mobile Lighthouse Performance score of 99.

**Architecture:** Preserve the current private detail application and role-aware tab sets. Remove the measured waterfalls at shared boundaries: route bootstrap, gallery media variants, Flow hydration, bounded related Sites, viewport-driven Site section media, and shared accessible chrome.

**Tech Stack:** React 19, TypeScript, Express, PostgreSQL, Vite, Node test runner, Lighthouse.

**Repository constraint:** Work directly on `main`. Preserve unrelated dirty changes. Do not commit or push unless the user explicitly asks.

---

### Task 1: Make App evidence galleries thumbnail-first

**Files:**
- Modify: `src/vitrine/ScreenGridCard.test.tsx`
- Modify: `src/vitrine/components/ScreenGridCard.tsx`

- [ ] Change the card test to expect `/media/thumb-screen.webp`, reject the
  full image in card markup, and retain `object-fit: contain`.
- [ ] Run `npx tsx --test src/vitrine/ScreenGridCard.test.tsx` and confirm it
  fails because `preferFullImage` is still enabled.
- [ ] Remove `preferFullImage` from `ScreenGridCard`; do not change the Screen
  object passed to the lightbox.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Add Flow thumbnail hydration and bounded initial rendering

**Files:**
- Modify: `src/designSystem.test.ts`
- Modify: `src/designSystem.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/vitrine/FlowCard.test.tsx`
- Modify: `src/vitrine/components/FlowCard.tsx`
- Modify: `src/vitrine/FlowGallery.test.tsx`
- Modify: `src/vitrine/components/FlowGallery.tsx`

- [ ] Add a hydration test expecting:

```ts
{
  imageUrl: "/api/media/linear/hash",
  thumbnailUrl: "/api/media/linear/hash?variant=thumb",
}
```

- [ ] Run the focused design-system test and confirm `thumbnailUrl` is missing.
- [ ] Extend `EvidenceView` with `thumbnailUrl?: string`; extend the hydrator
  resolver to accept `variant?: "thumb"` and populate both URLs.
- [ ] Add an API assertion proving authenticated Flow evidence exposes the
  thumbnail URL without changing the full URL.
- [ ] Change `FlowCard` to pass
  `evidence?.thumbnailUrl ?? evidence?.imageUrl` to its gallery image.
- [ ] Add a Flow gallery test proving only the first eight Flows render before
  the sentinel advances.
- [ ] Change `FLOW_BATCH_SIZE` from 24 to 8 and rerun focused Flow tests.

### Task 3: Bound and defer related Site media

**Files:**
- Modify: `src/vitrine/sitesApi.test.ts`
- Modify: `src/vitrine/sitesApi.ts`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/components/SiteCard.tsx`
- Modify: `src/vitrine/components/SiteVersionPage.tsx`

- [ ] Add `listSitesPage(limit, offset)` coverage for the existing bounded
  `{ sites, nextOffset, total }` response.
- [ ] Run the API-helper test and confirm the helper is missing.
- [ ] Implement the bounded helper using `/api/sites?limit=4&offset=0`, reusing
  the existing `parseSummary`.
- [ ] Add a `deferMediaUntilIntent` SiteCard test proving no initial `<img>` or
  `<video src>` is rendered while the card identity remains available.
- [ ] Add the prop and activate related media on pointer entry or focus.
- [ ] Replace `listSites()` in `SiteVersionPage` with `listSitesPage(4, 0)` and
  pass `deferMediaUntilIntent` to the three related cards.
- [ ] Rerun focused Site tests.

### Task 4: Activate Site section media near the viewport

**Files:**
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/SiteSectionVideoCard.test.tsx`
- Modify: `src/vitrine/components/MediaGridCard.tsx`
- Modify: `src/vitrine/components/SiteSectionVideoCard.tsx`
- Modify: `src/vitrine/components/SiteVersionPage.tsx`

- [ ] Add tests proving deferred image cards omit `src`, and deferred video
  cards omit both `src` and `poster` until their activation callback runs.
- [ ] Run the tests and confirm the current eager media markup fails them.
- [ ] Add a reusable near-viewport activation hook with a `300px` root margin
  and an immediate fallback when `IntersectionObserver` is unavailable.
- [ ] Add `deferMedia` to `MediaGridCard` and `SiteSectionVideoCard`; preserve
  card geometry with the existing neutral placeholder.
- [ ] Enable `deferMedia` for every Site Sections media card.
- [ ] Rerun focused Site tests.

### Task 5: Remove the authenticated detail LCP waterfall

**Files:**
- Modify: `src/vitrine/publicCatalogEntry.test.ts`
- Modify: `src/vitrine/entry.ts`
- Modify: `src/vitrine/appDetailPrefetch.test.ts`
- Create: `src/vitrine/appDetailPrefetch.ts`
- Modify: `src/vitrine/useAppDetail.ts`
- Modify: `src/vitrine/components/ReferenceDetailShell.tsx`

- [ ] Add an entry test proving App detail paths start an authenticated metadata
  prefetch without importing the private application surface eagerly.
- [ ] Add a cache test proving `useAppDetail` reuses the same in-flight metadata
  promise and discards rejected entries.
- [ ] Implement a route-keyed metadata prefetch cache using `fetchAppMetadata`.
- [ ] Start the prefetch from `entry.ts` for `/apps/:appId/:section` while
  `main.tsx` loads, and consume it from `useAppDetail`.
- [ ] Mark the initial detail identity image eager with
  `fetchPriority="high"` while retaining explicit dimensions and fallback.
- [ ] Rerun focused entry, cache, and shell tests.

### Task 6: Repair shared detail accessibility

**Files:**
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/SearchTrigger.test.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/components/ReferenceDiscoveryTopNav.tsx`
- Modify: `src/vitrine/components/SearchTrigger.tsx`
- Modify: `src/vitrine/components/SiteCard.tsx`
- Modify: `src/vitrine/referenceDiscovery.css`
- Modify: `src/vitrine/styles.css`

- [ ] Add rendered assertions for the brand name, visible-text-compatible search
  name, and related Site link name.
- [ ] Add focused style assertions for the failing action and metadata colors.
- [ ] Run the tests and confirm the current names/colors fail.
- [ ] Apply semantic names and AA contrast tokens; set the design-system empty
  state to the correct heading level.
- [ ] Rerun focused accessibility tests.

### Task 7: Verify every active tab

**Files:**
- Verify all modified files.

- [ ] Run all focused tests changed by Tasks 1-6.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Start the current local API and production preview.
- [ ] Browser-check all ten admin tabs and the five normal-user tab states at
  desktop and mobile widths.
- [ ] Run three clean standard-mobile Lighthouse audits per admin tab.
- [ ] Confirm every median is 99/100/100/100 with no runtime errors or warnings.
- [ ] Stop temporary services and remove the temporary authenticated session.
