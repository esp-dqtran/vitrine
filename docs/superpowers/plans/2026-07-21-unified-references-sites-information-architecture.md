# Unified References and Sites Information Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present Apps and Sites in one References discovery area while making Preview and Sections—not Pages—the designer-facing Site model.

**Architecture:** Keep `/apps` and `/sites`, their APIs, persistence models, and import workers separate, but render one shared References type switch and keep the existing Apps gallery/detail behavior intact. Enrich Site detail responses with ready-version options and normalized section patterns, then compose a Site-specific Preview/Sections experience and Section/Full-page inspector from existing Astryx design primitives.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, Framer Motion, GSAP, Express 5, PostgreSQL, Node test runner, server-rendered TSX tests, Vite.

**Execution location:** Work in `/Users/kai/works/eastplayers/Astryx` as requested. Do not create a worktree. Preserve and never stage the unrelated changes currently in `src/bulkDownload.test.ts`, `src/bulkDownload.ts`, `src/vitrine/Home.tsx`, and `src/vitrine/main.tsx`.

---

## Scope boundary

This plan changes the designer-facing References navigation, Site gallery copy, Site detail information architecture, Site version selection, and section inspection. It adds pattern metadata to future Site imports and exposes existing ready versions through the current detail endpoint.

It does not change `POST /api/jobs`, the `import-site` payload, RabbitMQ routing, `mobbin-sites-jobs`, the Sites worker service, object keys, watermark/source-overlay crop processing, or the no-polling architecture. Existing versions without persisted patterns remain usable and appear as `Unclassified`; this plan does not force a destructive recrawl or backfill.

## File map

### Create

- `src/vitrine/components/ReferenceTypeTabs.tsx` — accessible Apps/Sites type switch shared by both References galleries.
- `src/vitrine/ReferenceTypeTabs.test.tsx` — type-tab semantics and single-sidebar-item contract.
- `src/vitrine/components/SiteSectionInspector.tsx` — Site-specific fullscreen Section/Full-page context inspector.
- `src/vitrine/SiteSectionInspector.test.tsx` — focused/full-page media, metadata, and navigation contract.

### Modify

- `src/sitesSource.ts` — retain source section patterns inside `sourceMetadata` for future imports.
- `src/sitesSource.test.ts` — verify V7 patterns are decoded without changing page/section/media counts.
- `src/sitesStore.ts` — add ready-version options to Site detail responses.
- `src/sitesStore.test.ts` — verify ready-version ordering and pattern/source metadata passthrough.
- `services/api/src/sites.test.ts` — protect the enriched Site detail response and existing media routes.
- `src/vitrine/types.ts` — add `SiteVersionOption` and normalized `SiteSectionView.patterns`.
- `src/vitrine/sitesApi.ts` — parse ready versions and safe pattern strings from the existing detail endpoint.
- `src/vitrine/sitesApi.test.ts` — verify enriched detail parsing and zero Jobs reads.
- `src/vitrine/components/Sidebar.tsx` — replace separate Apps/Sites entries with one References entry.
- `src/vitrine/App.tsx` — render the Apps type tab, retain Apps state, and own Sites query state across type switches.
- `src/vitrine/components/SitesPage.tsx` — render the Sites type tab and use designer-facing Site copy.
- `src/vitrine/components/SiteCard.tsx` — remove internal page counts and Pages-oriented CTA copy.
- `src/vitrine/components/SiteVersionPage.tsx` — replace Overview/Pages/Sections with Preview/Sections, version selection, section filtering, and the new inspector.
- `src/vitrine/Sites.test.tsx` — replace old Pages assertions with the approved Site model.
- `src/vitrine/router.test.ts` — cover Preview/Sections routes and safe legacy tab fallback.
- `src/vitrine/App.boundary.test.ts` — protect unified navigation and zero Apps/Sites Jobs polling.

### Explicitly unchanged

- `src/vitrine/components/ScreenDetail.tsx`
- `src/vitrine/components/AppCard.tsx`
- `src/vitrine/components/ReferenceDetailShell.tsx`
- `src/vitrine/components/PreviewCarouselCard.tsx`
- `src/vitrine/components/Lightbox.tsx`
- `src/sitesQueue.ts`
- `services/sites-import-worker/**`
- `docker-compose.yml`
- all object-store and media-key code

---

### Task 1: Enrich the Site detail contract with patterns and ready versions

**Files:**
- Modify: `src/sitesSource.test.ts`
- Modify: `src/sitesSource.ts:163-199`
- Modify: `src/sitesStore.test.ts`
- Modify: `src/sitesStore.ts:53-95,213-299`
- Modify: `services/api/src/sites.test.ts`
- Modify: `src/vitrine/types.ts:68-106`
- Modify: `src/vitrine/sitesApi.test.ts`
- Modify: `src/vitrine/sitesApi.ts:34-134`

- [ ] **Step 1: Write failing source-decoder and store tests**

Extend the V7 decoder test with the source pattern that is already present in the captured fixture:

```ts
assert.deepEqual(sections[0].sourceMetadata?.patterns, ["Hero Section"]);
assert.deepEqual(sections[1].sourceMetadata?.patterns, ["Navigation Section"]);
```

Add a store test that returns two ready version rows for the same Site:

```ts
test("returns ready Site versions newest-first in version detail", async () => {
  const store = createSitesStore(async (sql) => {
    if (/SELECT s\.id AS site_id, sv\.id AS version_id/.test(sql)) {
      return result([{
        site_id: 1,
        version_id: 2,
        name: "V7",
        slug: graph.site.slug,
        source_url: graph.site.sourceUrl,
        canonical_url: identity.canonicalUrl,
        label: "Jul 2026",
        is_latest: true,
      }]);
    }
    if (/SELECT sv\.id, sv\.label, sv\.is_latest, sv\.updated_at/.test(sql)) {
      return result([
        { id: 2, label: "Jul 2026", is_latest: true, updated_at: new Date("2026-07-20T00:00:00Z") },
        { id: 1, label: "Nov 2025", is_latest: false, updated_at: new Date("2025-11-20T00:00:00Z") },
      ]);
    }
    return result();
  });

  const detail = await store.readyVersionDetail(1, 2);

  assert.deepEqual(detail?.versions, [
    { id: 2, label: "Jul 2026", isLatest: true, updatedAt: "2026-07-20T00:00:00.000Z" },
    { id: 1, label: "Nov 2025", isLatest: false, updatedAt: "2025-11-20T00:00:00.000Z" },
  ]);
});
```

Update the existing section-row fixture so `source_metadata` contains:

```ts
source_metadata: { patterns: ["Hero Section"] },
```

Assert that the store returns the metadata unchanged.

- [ ] **Step 2: Run the backend contract tests and verify RED**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/sitesSource.test.ts src/sitesStore.test.ts services/api/src/sites.test.ts
```

Expected: FAIL because the decoder discards `patterns` and `SiteVersionDetail` has no `versions` property.

- [ ] **Step 3: Retain source patterns without changing the database schema**

In `mapSection()`, normalize `source.patterns` once and attach it to both image and video metadata:

```ts
function sectionPatterns(source: SourceObject): string[] {
  if (source.patterns === undefined) return [];
  return array(source.patterns).map(string);
}
```

Use the helper in both branches:

```ts
const patterns = sectionPatterns(source);

sourceMetadata: {
  sourceType: type,
  sourceWidth: width,
  sourceHeight: height,
  patterns,
},
```

```ts
sourceMetadata: { sourceType: type, patterns },
```

Do not introduce a migration: `site_sections.source_metadata` already persists this object.

- [ ] **Step 4: Add ready-version options to the store response**

Add these contracts to `src/sitesStore.ts`:

```ts
export interface SiteVersionOption {
  id: number;
  label: string;
  isLatest: boolean;
  updatedAt: string;
}
```

Add `versions: SiteVersionOption[]` to `SiteVersionDetail`.

In `readyVersionDetail()`, add a third query alongside pages and sections:

```ts
runQuery(
  `SELECT sv.id, sv.label, sv.is_latest, sv.updated_at
   FROM site_versions sv
   WHERE sv.site_id = $1 AND sv.status = 'ready'
   ORDER BY sv.is_latest DESC, sv.updated_at DESC, sv.id DESC`,
  [siteId],
),
```

Map it into the returned detail:

```ts
versions: versionResult.rows.map((row) => ({
  id: positiveId(row.id),
  label: text(row.label),
  isLatest: row.is_latest === true,
  updatedAt: isoDate(row.updated_at),
})),
```

Keep the existing header, page, and section readiness constraints unchanged.

- [ ] **Step 5: Update the API route fixture and verify backend GREEN**

Add this to the `detail` fixture in `services/api/src/sites.test.ts`:

```ts
versions: [
  { id: 2, label: "Jul 2026", isLatest: true, updatedAt: "2026-07-20T00:00:00.000Z" },
  { id: 1, label: "Nov 2025", isLatest: false, updatedAt: "2025-11-20T00:00:00.000Z" },
],
```

Assert the detail endpoint returns both entries and still returns no object keys.

Run the command from Step 2.

Expected: all focused backend tests PASS.

- [ ] **Step 6: Write failing Vitrine parsing tests**

Update the Site detail response in `src/vitrine/sitesApi.test.ts` with the `versions` array above and one section whose payload includes:

```ts
sourceMetadata: { patterns: ["Hero Section", "Features"] },
```

Assert:

```ts
assert.deepEqual(detail.versionOptions.map((version) => version.label), ["Jul 2026", "Nov 2025"]);
assert.deepEqual(detail.pages[0].sections[0].patterns, ["Hero Section", "Features"]);
assert.ok(urls.every((url) => url !== "/api/jobs"));
```

- [ ] **Step 7: Run the Vitrine parser test and verify RED**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/vitrine/sitesApi.test.ts
```

Expected: FAIL because `SiteVersionDetail.versionOptions` and `SiteSectionView.patterns` do not exist.

- [ ] **Step 8: Implement strict client-side normalization**

Add to `src/vitrine/types.ts`:

```ts
export interface SiteVersionOption {
  id: number;
  label: string;
  isLatest: boolean;
  updatedAt: string;
}
```

Add `patterns: string[]` to `SiteSectionView` and `versionOptions: SiteVersionOption[]` to `SiteVersionDetail`.

In `getSiteVersion()`, require `body.versions` to be an array and map it with:

```ts
const versionOptions = body.versions.map((value) => {
  if (!isRecord(value) || !positiveId(value.id)) {
    throw new Error('Site version returned an invalid response');
  }
  const updatedAt = requiredText(value.updatedAt);
  if (Number.isNaN(Date.parse(updatedAt))) {
    throw new Error('Site version returned an invalid response');
  }
  return {
    id: value.id,
    label: requiredText(value.label),
    isLatest: value.isLatest === true,
    updatedAt,
  };
});
```

Return `versionOptions` and normalize section patterns in `parseSection()`:

```ts
const sourceMetadata = value.sourceMetadata;
const rawPatterns = sourceMetadata.patterns;
const patterns = rawPatterns === undefined
  ? []
  : Array.isArray(rawPatterns) && rawPatterns.every((item) => typeof item === 'string' && item)
    ? [...new Set(rawPatterns)]
    : (() => { throw new Error('Site version returned an invalid response'); })();
```

Assign both `patterns` and `sourceMetadata` to the returned section.

- [ ] **Step 9: Run all Task 1 tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/sitesSource.test.ts src/sitesStore.test.ts services/api/src/sites.test.ts src/vitrine/sitesApi.test.ts
```

Expected: all tests PASS.

- [ ] **Step 10: Commit the Site detail contract**

```bash
git add src/sitesSource.ts src/sitesSource.test.ts src/sitesStore.ts src/sitesStore.test.ts services/api/src/sites.test.ts src/vitrine/types.ts src/vitrine/sitesApi.ts src/vitrine/sitesApi.test.ts
git commit -m "feat: enrich Site reference metadata"
```

---

### Task 2: Introduce one References navigation and type switch

**Files:**
- Create: `src/vitrine/components/ReferenceTypeTabs.tsx`
- Create: `src/vitrine/ReferenceTypeTabs.test.tsx`
- Modify: `src/vitrine/components/Sidebar.tsx:4-11`
- Modify: `src/vitrine/App.tsx:31-66,184-221,284-340`
- Modify: `src/vitrine/components/SitesPage.tsx:12-92`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write the failing References navigation tests**

Create `src/vitrine/ReferenceTypeTabs.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceTypeTabs } from './components/ReferenceTypeTabs.tsx';

test('renders Apps and Sites as accessible reference-type tabs', () => {
  const html = renderToStaticMarkup(
    <ReferenceTypeTabs active="sites" onChange={() => undefined} />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /Apps/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"/);
  assert.match(html, /Sites/);
});

test('uses one References sidebar item for App and Site routes', () => {
  const source = readFileSync(new URL('./components/Sidebar.tsx', import.meta.url), 'utf8');
  assert.match(source, /label: 'References'/);
  assert.doesNotMatch(source, /label: 'Apps'/);
  assert.doesNotMatch(source, /label: 'Sites'/);
  assert.match(source, /r\.name === 'site-version'/);
  assert.match(source, /r\.name === 'app'/);
});
```

Add boundary assertions in `App.boundary.test.ts` for `ReferenceTypeTabs active="apps"` and controlled Site query props.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
tsx --test src/vitrine/ReferenceTypeTabs.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: FAIL because the shared type-tab component and References sidebar item do not exist.

- [ ] **Step 3: Create the accessible type-tab component**

Implement `ReferenceTypeTabs.tsx` with this public interface:

```tsx
import { ToggleButton } from '@astryxdesign/core';
import { navigate } from '../router.ts';

export type ReferenceType = 'apps' | 'sites';

interface ReferenceTypeTabsProps {
  active: ReferenceType;
  onChange?: (value: ReferenceType) => void;
}

export function ReferenceTypeTabs({
  active,
  onChange = (value) => navigate({ name: value }),
}: ReferenceTypeTabsProps) {
  return (
    <div role="tablist" aria-label="Reference type" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
      {(['apps', 'sites'] as const).map((value) => (
        <ToggleButton
          key={value}
          label={value === 'apps' ? 'Apps' : 'Sites'}
          isPressed={active === value}
          onPressedChange={() => onChange(value)}
          role="tab"
          aria-pressed={undefined}
          aria-selected={active === value}
          size="sm"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Collapse the sidebar to one References entry**

Replace the first two `NAV_ITEMS` with:

```ts
{
  label: 'References',
  route: { name: 'apps' },
  match: (r) => r.name === 'apps' || r.name === 'app' || r.name === 'sites' || r.name === 'site-version',
},
```

Do not change Projects, Users, account controls, or the responsive `SideNav` behavior.

- [ ] **Step 5: Render the type tabs and preserve independent search state**

In `App`, add:

```ts
const [siteQuery, setSiteQuery] = useState('');
```

Pass it to Sites:

```tsx
<SitesPage
  isAdmin={isAdmin}
  query={siteQuery}
  onQueryChange={setSiteQuery}
/>
```

Render `<ReferenceTypeTabs active="apps" />` above the Apps `GalleryToolbar`, including the Apps loading state. Keep the existing `q`, category, infinite-loading, entitlements, command palette, and import dialog logic unchanged.

Change the admin Apps gallery and loading headers to:

```tsx
<PageHeader
  title="References"
  description="Browse app and website design references."
  action={<Button variant="primary" label="Import from URL" clickAction={() => setImportOpen(true)} />}
/>
```

The action remains the existing App importer because Apps is the selected type.

Change `SitesPage` to accept controlled query props:

```ts
interface SitesPageProps {
  isAdmin: boolean;
  query: string;
  onQueryChange: (value: string) => void;
}
```

Remove its local query state, pass the controlled values into `SitesPageView`, and render `<ReferenceTypeTabs active="sites" />` above its `GalleryToolbar` in ready and loading states.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run the commands from Step 2 plus:

```bash
tsx --test src/vitrine/Sites.test.tsx
```

Expected: all focused tests PASS, and Apps/Sites remain separate routes.

- [ ] **Step 7: Commit unified References navigation**

```bash
git add src/vitrine/components/ReferenceTypeTabs.tsx src/vitrine/ReferenceTypeTabs.test.tsx src/vitrine/components/Sidebar.tsx src/vitrine/App.tsx src/vitrine/components/SitesPage.tsx src/vitrine/App.boundary.test.ts
git commit -m "feat: unify Apps and Sites navigation"
```

---

### Task 3: Remove Pages language from the Sites gallery

**Files:**
- Modify: `src/vitrine/Sites.test.tsx:36-51`
- Modify: `src/vitrine/components/SiteCard.tsx:4-21`
- Modify: `src/vitrine/components/SitesPage.tsx:23-58,75-83`

- [ ] **Step 1: Replace the old gallery expectations with designer-facing copy**

Update the first Sites gallery test to assert:

```ts
assert.match(html, /References/);
assert.match(html, /Search sites, versions, and sections/);
assert.match(html, /46 sections/);
assert.match(html, /View site/);
assert.doesNotMatch(html, /16 pages/);
assert.doesNotMatch(html, /View pages/);
assert.doesNotMatch(html, /page by page/);
```

Keep the assertions that the page screenshot preview renders, Import Site remains admin-only, and no preview `<video>` is placed inside gallery cards.

Keep the page-title search test as an internal source-matching behavior, but rename it to `filters Sites by name, version, and source page title` so the test does not imply Pages are a visible primary object.

- [ ] **Step 2: Run the Sites TSX test and verify RED**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx
```

Expected: FAIL on the old Pages-oriented copy and page count.

- [ ] **Step 3: Update the Site card adapter**

Change only the Site-specific mapping:

```tsx
supportingText={`${site.label} · ${site.sectionCount} sections`}
overlayLabel="View site"
```

Keep the existing bounded full-page screenshot previews, shared carousel behavior, route target, lazy activation, and failure handling.

- [ ] **Step 4: Update Sites gallery copy without changing its API behavior**

Use:

```tsx
<PageHeader
  title="References"
  description="Browse captured websites and reusable interface sections."
  action={isAdmin ? <Button variant="primary" label="Import Site" clickAction={onImport} /> : undefined}
/>
```

Change the search placeholder to `Search sites, versions, and sections…` and the no-match guidance to `Try a Site name, version, or section keyword.`

Do not remove `SiteSummary.pageCount` from the API contract in this task; merely stop rendering it. Do not add any Jobs request or timer.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx src/vitrine/PreviewCarouselCard.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 6: Commit the Sites gallery semantics**

```bash
git add src/vitrine/Sites.test.tsx src/vitrine/components/SiteCard.tsx src/vitrine/components/SitesPage.tsx
git commit -m "feat: make Sites gallery section-first"
```

---

### Task 4: Build the Section and Full-page context inspector

**Files:**
- Create: `src/vitrine/components/SiteSectionInspector.tsx`
- Create: `src/vitrine/SiteSectionInspector.test.tsx`

- [ ] **Step 1: Write failing inspector tests**

Create a fixture and render both controlled views:

```tsx
const item = {
  id: 12,
  kind: 'image' as const,
  sectionUrl: '/api/sites/1/versions/2/sections/12/media',
  fullPageUrl: '/api/sites/1/versions/2/pages/10/media',
  pageTitle: 'Home',
  pageUrl: 'https://v7labs.com/',
  patterns: ['Hero Section'],
  caption: 'Home · Section 1',
};

test('renders the focused Site section with context controls', () => {
  const html = renderToStaticMarkup(
    <SiteSectionInspector
      item={item}
      index={0}
      total={2}
      view="section"
      onViewChange={() => undefined}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );
  assert.match(html, /Section/);
  assert.match(html, /Full page/);
  assert.match(html, /Hero Section/);
  assert.match(html, /https:\/\/v7labs\.com\//);
  assert.match(html, /sections\/12\/media/);
});

test('renders parent full-page media when Full page is selected', () => {
  const html = renderToStaticMarkup(
    <SiteSectionInspector
      item={item}
      index={0}
      total={2}
      view="full-page"
      onViewChange={() => undefined}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );
  assert.match(html, /pages\/10\/media/);
  assert.doesNotMatch(html, /<video/);
});
```

Add a video fixture and assert Section view renders native muted controls with its poster while Full page still renders the parent image.

- [ ] **Step 2: Run the inspector test and verify RED**

Run:

```bash
tsx --test src/vitrine/SiteSectionInspector.test.tsx
```

Expected: FAIL because `SiteSectionInspector.tsx` does not exist.

- [ ] **Step 3: Implement the controlled inspector contract**

Export these types:

```tsx
export type SiteInspectorView = 'section' | 'full-page';

export interface SiteInspectorItem {
  id: number;
  kind: 'image' | 'video';
  sectionUrl: string;
  posterUrl?: string;
  fullPageUrl: string;
  pageTitle: string;
  pageUrl: string;
  patterns: string[];
  caption: string;
}
```

Implement the component with `Dialog` in fullscreen mode, `FilterChips` for `Section` and `Full page`, `PlaceholderImage` for images, native `<video controls muted playsInline>` for a video section, and the existing `ArrowButton` controls for previous/next.

Map the human-readable chip labels to the controlled view type explicitly:

```tsx
const selectedView = view === 'section' ? 'Section' : 'Full page';
<FilterChips
  options={['Section', 'Full page'] as const}
  value={selectedView}
  onChange={(value) => onViewChange(value === 'Section' ? 'section' : 'full-page')}
/>
```

Select media with:

```ts
const isFullPage = view === 'full-page';
const mediaKind = isFullPage ? 'image' : item.kind;
const mediaUrl = isFullPage ? item.fullPageUrl : item.sectionUrl;
```

Render pattern labels, `pageTitle`, `pageUrl`, and `${index + 1} of ${total}` below the media. Use an ordinary protected API URL link for Download; do not expose object keys or signed storage URLs.

The component remains controlled: it does not own the selected item, view, or keyboard listener. This lets `SiteVersionView` keep ordered navigation and reset to Section view when a new card opens.

- [ ] **Step 4: Run the inspector tests and verify GREEN**

Run the command from Step 2.

Expected: all inspector tests PASS.

- [ ] **Step 5: Commit the inspector component**

```bash
git add src/vitrine/components/SiteSectionInspector.tsx src/vitrine/SiteSectionInspector.test.tsx
git commit -m "feat: add Site section context inspector"
```

---

### Task 5: Replace Site Overview and Pages with Preview and Sections

**Files:**
- Modify: `src/vitrine/Sites.test.tsx:90-129`
- Modify: `src/vitrine/components/SiteVersionPage.tsx:1-299`
- Modify: `src/vitrine/router.test.ts`

- [ ] **Step 1: Write the approved detail-view tests**

Update the `detail` fixture with:

```ts
versionOptions: [
  { id: 2, label: 'Jul 2026', isLatest: true, updatedAt: '2026-07-20T00:00:00.000Z' },
  { id: 1, label: 'Nov 2025', isLatest: false, updatedAt: '2025-11-20T00:00:00.000Z' },
],
```

Give the image section `patterns: ['Hero Section']` and the video section `patterns: ['Navigation Section']`.

Replace the old detail tests with these contracts:

```ts
test('renders Preview and Sections without exposing Pages as a primary object', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView
      detail={detail}
      isAdmin
      section="preview"
      onSectionChange={() => undefined}
      onVersionChange={() => undefined}
      onBack={() => undefined}
      onImport={() => undefined}
    />,
  );
  assert.match(html, /Preview/);
  assert.match(html, /Sections/);
  assert.match(html, /Jul 2026/);
  assert.match(html, /<video[^>]+media\/preview/);
  assert.doesNotMatch(html, />Overview</);
  assert.doesNotMatch(html, />Pages</);
  assert.doesNotMatch(html, /16 pages/);
});

test('filters Sections by keyword, pattern, and media without rendering OCR text', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView
      detail={detail}
      isAdmin={false}
      section="sections"
      initialSectionQuery="Hero"
      onSectionChange={() => undefined}
      onVersionChange={() => undefined}
      onBack={() => undefined}
      onImport={() => undefined}
    />,
  );
  assert.match(html, /Search sections/);
  assert.match(html, /Hero Section/);
  assert.match(html, /All patterns/);
  assert.match(html, /Images/);
  assert.doesNotMatch(html, /Secret visible copy/);
});
```

Also read `SiteVersionPage.tsx` as source and assert it maps `detail.versionOptions` into the version menu. The client parser test from Task 1 already verifies both `Jul 2026` and `Nov 2025`; do not depend on a closed dropdown rendering all menu items into server markup.

Keep loading/failure frame coverage, but assert `Back to Sites` instead of `Back to all sites` if the copy is changed.

- [ ] **Step 2: Add route tests for the new and legacy tab states**

Use these expectations in `router.test.ts`:

```ts
assert.deepEqual(parseRoutePath('/sites/1/versions/2/preview'), {
  name: 'site-version', siteId: 1, versionId: 2, section: 'preview',
});
assert.deepEqual(parseRoutePath('/sites/1/versions/2/sections'), {
  name: 'site-version', siteId: 1, versionId: 2, section: 'sections',
});
assert.deepEqual(parseRoutePath('/sites/1/versions/2/pages'), {
  name: 'site-version', siteId: 1, versionId: 2, section: 'pages',
});
```

The router continues parsing legacy strings. The view resolver—not the router—maps `overview`, `pages`, missing, and unknown values to Preview, preserving old deep links without adding redirects.

- [ ] **Step 3: Run the detail tests and verify RED**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx
node --experimental-strip-types --test src/vitrine/router.test.ts
```

Expected: FAIL because the view still renders Overview, Pages, page counts, and the generic Lightbox.

- [ ] **Step 4: Reduce Site detail state to Preview and Sections**

Replace the section type and resolver:

```ts
export type SiteDetailSection = 'preview' | 'sections';

function resolveSiteSection(value?: string): SiteDetailSection {
  return value === 'sections' ? 'sections' : 'preview';
}
```

Add `initialSectionQuery?: string` to `SiteVersionViewProps` so the server-rendered filtering test can supply deterministic initial search state without a DOM event harness.

Remove `pageLightboxItems`, `PagesPanel`, page-count metadata, the Page selector, crop/timing badges, and all `activeSection === 'pages'` branches.

Change the shell, loading, and failure back labels to `Back to Sites` while retaining the same navigation target `{ name: 'sites' }`.

Rename `SiteOverview` to `SitePreview`. Keep the protected preview recording and source/version summary, but replace the captured-reference line with:

```tsx
<div>{sectionCount} reusable sections</div>
```

Configure the shell with:

```tsx
metadata={[{ label: 'Sections', value: String(sectionCount) }]}
tabs={[
  { id: 'preview', label: 'Preview' },
  { id: 'sections', label: 'Sections', count: sectionCount },
]}
activeTab={activeSection}
tabTrailing={activeSection === 'sections'
  ? <span>{visibleSections.length} sections</span>
  : undefined}
```

- [ ] **Step 5: Add ready-version selection to the hero**

Import `DropdownMenu` and pass this through `ReferenceDetailShell.heroControls`:

```tsx
<DropdownMenu
  button={{
    label: `${detail.version.label}${detail.version.isLatest ? ' · Latest' : ''}`,
    size: 'sm',
    variant: 'secondary',
  }}
  items={detail.versionOptions.map((version) => ({
    label: `${version.label}${version.isLatest ? ' · Latest' : ''}`,
    onClick: () => onVersionChange(version.id),
  }))}
/>
```

Add `onVersionChange(versionId: number)` to `SiteVersionViewProps`. In `SiteVersionPage`, pass:

```ts
onVersionChange={(nextVersionId) => navigate({
  name: 'site-version',
  siteId,
  versionId: nextVersionId,
})}
```

Do not add a version-list endpoint; the current detail response carries the bounded ready-version options.

- [ ] **Step 6: Implement keyword, pattern, and media filtering**

Add state:

```ts
const [sectionQuery, setSectionQuery] = useState(initialSectionQuery ?? '');
const [patternFilter, setPatternFilter] = useState('All patterns');
const [mediaFilter, setMediaFilter] = useState('All media');
```

Normalize patterns and filter without rendering OCR text:

```ts
const sectionItems = pages.flatMap((page) => page.sections.map((item, index) => ({
  page,
  item,
  index,
  patterns: item.patterns.length ? item.patterns : ['Unclassified'],
})));
const patternOptions = ['All patterns', ...new Set(sectionItems.flatMap((entry) => entry.patterns))];
const needle = sectionQuery.trim().toLowerCase();
const visibleSections = sectionItems.filter(({ page, item, patterns }) => {
  const searchable = [
    page.title,
    page.url,
    ...patterns,
    ...item.ocrBoxes.map((box) => box.text),
  ].join(' ').toLowerCase();
  return (!needle || searchable.includes(needle))
    && (patternFilter === 'All patterns' || patterns.includes(patternFilter))
    && (mediaFilter === 'All media'
      || (mediaFilter === 'Images' ? item.mediaKind === 'image' : item.mediaKind === 'video'));
});
```

Render `SearchInput`, Pattern `Selector`, and Media `Selector`. Cards show pattern and media-kind badges only; page title/path moves to the inspector as context.

- [ ] **Step 7: Integrate the Site-specific inspector**

Replace `SiteLightbox` with:

```ts
type SiteInspectorState = {
  items: SiteInspectorItem[];
  index: number;
  view: SiteInspectorView;
} | null;
```

Map every visible section to an inspector item:

```ts
const inspectorItems = visibleSections.map(({ page, item, index, patterns }) => ({
  id: item.id,
  kind: item.mediaKind,
  sectionUrl: item.mediaUrl,
  posterUrl: item.posterUrl,
  fullPageUrl: page.fullPageImageUrl,
  pageTitle: page.title,
  pageUrl: page.url,
  patterns,
  caption: `${page.title} · Section ${index + 1}`,
}));
```

Opening a card sets `{ items: inspectorItems, index, view: 'section' }`. Render `SiteSectionInspector` for the selected item. Keep the existing Escape/ArrowLeft/ArrowRight listener, and update it to operate on the inspector state. Switching items preserves ordered navigation; opening a new card starts in Section view.

- [ ] **Step 8: Run focused UI tests and verify GREEN**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx src/vitrine/SiteSectionInspector.test.tsx src/vitrine/ReferenceDetailShell.test.tsx
node --experimental-strip-types --test src/vitrine/router.test.ts src/vitrine/App.boundary.test.ts
```

Expected: all focused tests PASS, raw OCR text is absent from markup, and Pages is absent as a primary Site tab/count.

- [ ] **Step 9: Commit the Site detail information architecture**

```bash
git add src/vitrine/Sites.test.tsx src/vitrine/components/SiteVersionPage.tsx src/vitrine/router.test.ts
git commit -m "feat: make Site detail section-first"
```

---

### Task 6: Verify domain isolation, production build, and live Chrome behavior

**Files:**
- Modify only if a boundary assertion is missing: `src/vitrine/App.boundary.test.ts`
- No crawler, queue, worker, object-store, or unrelated dirty-file changes.

- [ ] **Step 1: Protect the no-polling and separate-route boundaries**

Ensure `App.boundary.test.ts` asserts all of the following source files contain no direct `GET /api/jobs` read or `useJobs()` call:

```ts
const referenceSources = `${appSource}\n${sitesSource}\n${sitesApiSource}`;
assert.doesNotMatch(referenceSources, /\buseJobs\s*\(/);
assert.doesNotMatch(referenceSources, /fetch\(\s*['"]\/api\/jobs['"]\s*\)/);
assert.doesNotMatch(sitesSource, /setInterval/);
```

Also assert the import client still contains exactly:

```ts
body: JSON.stringify({ type: 'import-site', url }),
```

Do not modify the Sites queue or worker to satisfy a UI test.

- [ ] **Step 2: Run the complete automated suite**

Run:

```bash
npm test
```

Expected: all Node and TSX tests PASS. Record the actual totals in the implementation handoff.

- [ ] **Step 3: Build the production Vitrine bundle**

Run:

```bash
npm run build
```

Expected: Vite exits 0. The existing chunk-size warning is acceptable; new compile errors or warnings from this feature are not.

- [ ] **Step 4: Check the scoped diff and dirty-worktree boundary**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. The pre-existing modifications in `src/bulkDownload.test.ts`, `src/bulkDownload.ts`, `src/vitrine/Home.tsx`, and `src/vitrine/main.tsx` remain unstaged and unchanged by this work.

- [ ] **Step 5: Rebuild only the local services needed for browser verification**

If the local API or Vitrine bundle is stale, run:

```bash
docker compose up -d --build api
npm run dev
```

Use the existing signed-in Chrome session. Do not switch to another browser or create a new Mobbin login flow.

- [ ] **Step 6: Verify Apps and References navigation in Chrome**

Open `/apps` and verify:

- the sidebar has one References item selected;
- Apps and Sites type tabs are visible and Apps is selected;
- existing App cards, search, import, pagination, and one App detail remain unchanged;
- switching Apps → Sites → Apps preserves Apps search/category state;
- the network log contains no `GET /api/jobs` from the Apps gallery.

- [ ] **Step 7: Verify the V7 Site gallery and detail in Chrome**

Open `/sites` and the imported V7 detail route. Verify:

- References remains selected and Sites is the active type;
- the V7 card shows its version and 46 sections, with no `16 pages` text or View Pages CTA;
- Site detail has Preview and Sections only;
- Preview plays the protected recording;
- the ready-version control lists every ready imported V7 version;
- Sections search filters OCR-backed keywords without displaying raw OCR text;
- pattern and media filters update the count and grid;
- a section opens in Section view and toggles to its stored Full-page context;
- Escape closes the inspector and arrow keys navigate sections;
- narrow viewport tabs and filters remain reachable without clipping;
- the Sites gallery performs no `GET /api/jobs` request.

- [ ] **Step 8: Commit any final boundary-test adjustment**

If Step 1 required a test-only change:

```bash
git add src/vitrine/App.boundary.test.ts
git commit -m "test: protect References runtime boundaries"
```

If no change was required, do not create an empty commit.

---

## Completion checklist

- [ ] One References sidebar item selects App and Site routes.
- [ ] Apps and Sites galleries expose accessible type tabs.
- [ ] Apps behavior and URLs remain unchanged.
- [ ] Sites cards show section counts and no page counts.
- [ ] Site detail exposes Preview and Sections only.
- [ ] Legacy Overview, Pages, missing, and unknown detail states fall back to Preview.
- [ ] Ready Site versions are selectable without a new endpoint.
- [ ] New imports retain source section patterns; old metadata safely becomes Unclassified.
- [ ] Keyword search can use OCR internally without rendering raw OCR strings.
- [ ] Section inspection switches between focused media and the stored parent full-page capture.
- [ ] Apps/Sites galleries perform zero `GET /api/jobs` reads.
- [ ] The Sites RabbitMQ queue, worker, crop processing, and object-store namespace remain unchanged.
- [ ] Full tests, production build, diff check, and Chrome verification pass.
- [ ] Unrelated dirty files remain unmodified and unstaged.
