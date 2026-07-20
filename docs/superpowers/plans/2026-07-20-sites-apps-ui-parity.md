# Sites and Apps UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Sites gallery and Site detail experience through reusable Apps UI primitives while preserving Sites domain semantics and all import/runtime boundaries.

**Architecture:** Add bounded page previews to ready Site summaries, extract the current Apps preview card, gallery toolbar, detail shell, media card, and lightbox into domain-neutral components, then compose Sites-specific adapters over those primitives. Keep Apps behavior unchanged and keep Sites import, queue, worker, storage, and job submission untouched.

**Tech Stack:** React 19, TypeScript, Framer Motion, GSAP, `@astryxdesign/core`, Express, PostgreSQL, Node test runner, server-rendered TSX tests, Vite.

**Execution location:** Work in `/Users/kai/works/eastplayers/Astryx` as requested. Do not create a worktree. Preserve and never stage unrelated changes in `src/vitrine/Home.tsx` and `src/vitrine/main.tsx`.

---

## File Map

### Create

- `src/vitrine/components/PreviewCarouselCard.tsx` — domain-neutral Apps-style preview carousel card.
- `src/vitrine/components/SiteCard.tsx` — maps a `SiteSummary` into the shared carousel card.
- `src/vitrine/components/GalleryToolbar.tsx` — shared sticky gallery toolbar frame used by Apps and Sites.
- `src/vitrine/components/ReferenceDetailShell.tsx` — shared Apps-style detail hero, metadata, actions, tabs, and content frame.
- `src/vitrine/components/MediaGridCard.tsx` — shared image/video grid-card presentation.
- `src/vitrine/PreviewCarouselCard.test.tsx` — preview cap, accessible rendering, and lazy-activation contract.
- `src/vitrine/ReferenceDetailShell.test.tsx` — detail-shell hero and accessible tab contract.
- `src/vitrine/router.test.ts` — Site detail base and tab route coverage.

### Modify

- `src/sitesStore.ts` — add the first five ordered page previews to ready Site summaries.
- `src/sitesStore.test.ts` — verify preview order, cap, and authenticated media paths.
- `services/api/src/sites.test.ts` — verify `/sites` returns page previews without extra detail reads.
- `src/vitrine/types.ts` — add `SitePagePreview` and `SiteSummary.previews`.
- `src/vitrine/sitesApi.ts` — validate and normalize Site page previews.
- `src/vitrine/sitesApi.test.ts` — verify preview parsing and zero Jobs reads.
- `src/vitrine/components/AppCard.tsx` — become a thin adapter over `PreviewCarouselCard`.
- `src/vitrine/App.tsx` — use `GalleryToolbar` and export/reuse the shared card skeleton without changing Apps behavior.
- `src/vitrine/components/SitesPage.tsx` — Apps-style sticky search, counts, skeletons, and `SiteCard` grid.
- `src/vitrine/components/ScreenDetail.tsx` — use the shared detail shell and media primitives while retaining Apps hooks and sections.
- `src/vitrine/components/ScreenGridCard.tsx` — become an Apps adapter over `MediaGridCard`.
- `src/vitrine/components/Lightbox.tsx` — support shared image and video media while preserving the current Screen API.
- `src/vitrine/components/SiteVersionPage.tsx` — compose Overview, Pages, and Sections in the shared detail shell.
- `src/vitrine/router.ts` — preserve Site detail tab state in the URL.
- `src/vitrine/Sites.test.tsx` — cover gallery parity, search, tabs, filters, order, media, and OCR privacy.
- `src/vitrine/ScreenDetail.test.tsx` — protect current Apps detail behavior after extraction.

---

### Task 1: Expose bounded Site page previews

**Files:**
- Modify: `src/sitesStore.ts`
- Modify: `src/sitesStore.test.ts`
- Modify: `services/api/src/sites.test.ts`
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/sitesApi.ts`
- Modify: `src/vitrine/sitesApi.test.ts`

- [ ] **Step 1: Write failing store and client-contract tests**

Add this assertion shape to the ready-summary store test:

```ts
test("returns the first five ordered page previews in ready Site summaries", async () => {
  const previews = Array.from({ length: 6 }, (_, index) => ({
    id: index + 10,
    title: `Page ${index + 1}`,
    position: index,
  }));
  const store = createSitesStore(async () => result([{
    site_id: 1,
    version_id: 2,
    name: "V7",
    slug: graph.site.slug,
    source_url: graph.site.sourceUrl,
    label: graph.version.label,
    is_latest: true,
    updated_at: new Date("2026-07-20T00:00:00.000Z"),
    page_count: 6,
    section_count: 12,
    page_previews: previews.slice(0, 5),
  }]));

  const [site] = await store.listReadySites();

  assert.deepEqual(site.previews, previews.slice(0, 5).map((page) => ({
    ...page,
    url: `/api/sites/1/versions/2/pages/${page.id}/media`,
  })));
});
```

Update the `/api/sites` fixture and `src/vitrine/sitesApi.test.ts` fixture with:

```ts
pagePreviews: [
  { id: 10, title: 'Home', position: 0, url: '/api/sites/1/versions/2/pages/10/media' },
  { id: 11, title: 'Pricing', position: 1, url: '/api/sites/1/versions/2/pages/11/media' },
],
```

Assert `listSites()` returns the same two ordered previews and that the request list is still exactly `['/api/sites', '/api/sites/1/versions/2']` with no `GET /api/jobs`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/sitesStore.test.ts src/vitrine/sitesApi.test.ts services/api/src/sites.test.ts
```

Expected: FAIL because `SiteSummary` and `parseSummary` do not expose page previews.

- [ ] **Step 3: Implement the bounded summary query and contracts**

Add the shared contracts:

```ts
export interface SitePagePreview {
  id: number;
  title: string;
  position: number;
  url: string;
}

export interface SiteSummary {
  // existing fields stay unchanged
  previews: SitePagePreview[];
}
```

Add this selected field to `listReadySites()` after the count subqueries:

```sql
COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'id', preview.id,
    'title', preview.title,
    'position', preview.position
  ) ORDER BY preview.position)
  FROM (
    SELECT sp.id, sp.title, sp.position
    FROM site_pages sp
    WHERE sp.version_id = sv.id
    ORDER BY sp.position
    LIMIT 5
  ) preview
), '[]'::jsonb) AS page_previews
```

Map and validate the rows:

```ts
const previews = jsonArray(row.page_previews).map((value) => {
  const page = jsonObject(value);
  const id = positiveId(page.id);
  return {
    id,
    title: text(page.title),
    position: nonNegativeInteger(page.position),
    url: mediaPath(siteId, versionId, "page", id),
  };
});
```

In `src/vitrine/sitesApi.ts`, parse `pagePreviews` with existing `positiveId`, `requiredText`, `nonNegativeInteger`, and `apiPath` helpers, reject more than five items, sort by `position`, and assign the result to `previews`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2.

Expected: all focused store, API, and client tests PASS.

- [ ] **Step 5: Commit the summary slice**

```bash
git add src/sitesStore.ts src/sitesStore.test.ts services/api/src/sites.test.ts src/vitrine/types.ts src/vitrine/sitesApi.ts src/vitrine/sitesApi.test.ts
git commit -m "feat: expose Site page previews"
```

---

### Task 2: Extract the Apps preview carousel card

**Files:**
- Create: `src/vitrine/components/PreviewCarouselCard.tsx`
- Create: `src/vitrine/PreviewCarouselCard.test.tsx`
- Modify: `src/vitrine/components/AppCard.tsx`
- Modify: `src/vitrine/ImportDialog.test.tsx`

- [ ] **Step 1: Write failing shared-card and Apps-boundary tests**

Create a server-rendered test with six previews:

```tsx
const previews = Array.from({ length: 6 }, (_, index) => ({
  key: String(index),
  url: `/preview-${index}.png`,
  alt: `Preview ${index + 1}`,
}));

test('caps the shared carousel at five previews and keeps one card target', () => {
  const html = renderToStaticMarkup(
    <PreviewCarouselCard
      label="Open V7"
      identityKey="site-1"
      identityLabel="V7"
      supportingText="Jul 2026 · 16 pages · 46 sections"
      overlayLabel="View pages"
      previews={previews}
      onOpen={() => undefined}
    />,
  );
  assert.match(html, /Open V7/);
  assert.match(html, /preview-0\.png/);
  assert.doesNotMatch(html, /preview-5\.png/);
});

test('keeps deferred previews behind the activation boundary', () => {
  const source = readFileSync(new URL('./components/PreviewCarouselCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /i === 0 \|\| activated/);
  assert.match(source, /slice\(0, 5\)/);
});
```

Add an Apps regression assertion to `ImportDialog.test.tsx` that `AppCard` still renders `View screens`, the App name, and the incomplete-status badge.

- [ ] **Step 2: Run the focused TSX tests and verify RED**

Run:

```bash
tsx --test src/vitrine/PreviewCarouselCard.test.tsx src/vitrine/ImportDialog.test.tsx
```

Expected: FAIL because `PreviewCarouselCard.tsx` does not exist.

- [ ] **Step 3: Implement `PreviewCarouselCard` and adapt `AppCard`**

Use this public interface:

```tsx
export interface PreviewCarouselItem {
  key: string;
  url?: string;
  alt: string;
}

interface PreviewCarouselCardProps {
  label: string;
  identityKey: string;
  identityLabel: string;
  identityImageUrl?: string | null;
  accent?: string;
  supportingText?: string;
  overlayLabel: string;
  previews: PreviewCarouselItem[];
  cornerBadge?: ReactNode;
  onOpen: () => void;
}
```

Move the current `AppCard` frame, hover state, `activated` boundary, modulo navigation, dots, arrows, identity pill, overlay, motion values, `contentVisibility`, and shadows into this component. Use `const items = previews.slice(0, 5)` and render an unavailable `PlaceholderImage` when the array is empty.

Reduce `AppCard` to domain mapping:

```tsx
return (
  <PreviewCarouselCard
    label={`Open ${app.app}`}
    identityKey={`app-icon-${app.id}`}
    identityLabel={app.app}
    identityImageUrl={app.iconUrl}
    accent={app.accent}
    supportingText={progressLabel && status !== 'Complete' ? progressLabel : undefined}
    overlayLabel="View screens"
    previews={app.screens.map((screen, index) => ({
      key: String(screen.id ?? index),
      url: screen.url,
      alt: `${app.app} screen ${index + 1}`,
    }))}
    cornerBadge={status && status !== 'Complete' ? <Badge label={status} variant={STATUS_VARIANT[status]} /> : undefined}
    onOpen={onOpen}
  />
);
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2.

Expected: both TSX test files PASS and Apps labels remain unchanged.

- [ ] **Step 5: Commit the shared-card extraction**

```bash
git add src/vitrine/components/PreviewCarouselCard.tsx src/vitrine/PreviewCarouselCard.test.tsx src/vitrine/components/AppCard.tsx src/vitrine/ImportDialog.test.tsx
git commit -m "refactor: share preview carousel cards"
```

---

### Task 3: Render Sites through the Apps gallery UI

**Files:**
- Create: `src/vitrine/components/GalleryToolbar.tsx`
- Create: `src/vitrine/components/SiteCard.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/SitesPage.tsx`
- Modify: `src/vitrine/Sites.test.tsx`

- [ ] **Step 1: Write failing Sites gallery tests**

Extend the Site fixture with ordered previews and replace the old video-card assertion:

```tsx
previews: [
  { id: 10, title: 'Home', position: 0, url: '/api/sites/1/versions/2/pages/10/media' },
  { id: 11, title: 'Pricing', position: 1, url: '/api/sites/1/versions/2/pages/11/media' },
],
```

Add tests:

```tsx
test('renders Sites with Apps gallery cards instead of preview-video cards', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin query="" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Search sites, versions, and pages/);
  assert.match(html, /View pages/);
  assert.match(html, /Home/);
  assert.match(html, /16 pages · 46 sections/);
  assert.doesNotMatch(html, /<video/);
});

test('filters Sites by name, version, and preview page title', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin={false} query="Pricing" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Showing 1 of 1 sites/);
});
```

- [ ] **Step 2: Run the Sites TSX test and verify RED**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx
```

Expected: FAIL because the Sites gallery still renders preview videos and has no query contract.

- [ ] **Step 3: Extract the gallery toolbar and add `SiteCard`**

Create the shared toolbar frame:

```tsx
export function GalleryToolbar({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--color-border)', padding: '22px 28px 14px',
      margin: '0 -28px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {children}
    </div>
  );
}
```

Replace only the equivalent sticky wrapper in `App.tsx` with `GalleryToolbar`; keep its existing `SearchTrigger`, account controls, margins, and children unchanged.

Create `SiteCard`:

```tsx
export function SiteCard({ site, onOpen }: { site: SiteSummary; onOpen: () => void }) {
  return (
    <PreviewCarouselCard
      label={`Open ${site.name}`}
      identityKey={`site-icon-${site.id}`}
      identityLabel={site.name}
      accent="var(--color-accent)"
      supportingText={`${site.label} · ${site.pageCount} pages · ${site.sectionCount} sections`}
      overlayLabel="View pages"
      previews={site.previews.map((page) => ({ key: String(page.id), url: page.url, alt: `${site.name} ${page.title}` }))}
      onOpen={onOpen}
    />
  );
}
```

- [ ] **Step 4: Implement Sites search, count, skeletons, and grid**

Keep query state in `SitesPage`, pass it into the pure view, and filter with:

```ts
const needle = query.trim().toLowerCase();
const visibleSites = sites.filter((site) => !needle || [
  site.name,
  site.label,
  ...site.previews.map((page) => page.title),
].join(' ').toLowerCase().includes(needle));
```

Inside `GalleryToolbar`, render `SearchInput` with placeholder `Search sites, versions, and pages…`. Use the Apps grid exactly: `repeat(auto-fill,minmax(320px,1fr))`, gap `22`, and bottom padding `72`. Replace the centered loading spinner with nine copies of the Apps card-skeleton markup in the stable Sites page shell.

- [ ] **Step 5: Run Sites and Apps gallery tests and verify GREEN**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx src/vitrine/ImportDialog.test.tsx
```

Expected: PASS. The Sites output has no gallery `<video>`, while Apps card behavior remains covered.

- [ ] **Step 6: Commit the gallery parity slice**

```bash
git add src/vitrine/components/GalleryToolbar.tsx src/vitrine/components/SiteCard.tsx src/vitrine/components/SitesPage.tsx src/vitrine/Sites.test.tsx src/vitrine/App.tsx
git commit -m "feat: render Sites with Apps gallery UI"
```

---

### Task 4: Preserve Site tab state in routes

**Files:**
- Modify: `src/vitrine/router.ts`
- Create: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Write failing route tests**

```ts
test('round-trips Site detail tabs and keeps the base route stable', () => {
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/pages'), { name: 'site-version', siteId: 1, versionId: 2, section: 'pages' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/sections'), { name: 'site-version', siteId: 1, versionId: 2, section: 'sections' });
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2 }), '/sites/1/versions/2');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2, section: 'pages' }), '/sites/1/versions/2/pages');
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/router.test.ts
```

Expected: FAIL because the Site route does not carry `section`.

- [ ] **Step 3: Add optional Site section routing**

Change the route type and parser:

```ts
| { name: 'site-version'; siteId: number; versionId: number; section?: string }

const siteMatch = path.match(/^\/sites\/([1-9]\d*)\/versions\/([1-9]\d*)(?:\/([^/]+))?$/);
// Return section: decodeURIComponent(siteMatch[3]) only when present.
```

Update `routeToPath` to append an encoded section. Pass `route.section` and an `onSectionChange` callback from `App.tsx` to `SiteVersionPage`, mirroring the current Apps detail navigation.

- [ ] **Step 4: Run the route test and verify GREEN**

Run the command from Step 2.

Expected: PASS for base and section routes.

- [ ] **Step 5: Commit the routing slice**

```bash
git add src/vitrine/router.ts src/vitrine/router.test.ts src/vitrine/App.tsx
git commit -m "feat: route Site detail tabs"
```

---

### Task 5: Extract the Apps detail shell

**Files:**
- Create: `src/vitrine/components/ReferenceDetailShell.tsx`
- Create: `src/vitrine/ReferenceDetailShell.test.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Write failing shell and Apps-boundary tests**

```tsx
test('renders the Apps-style hero, actions, metadata, and accessible tabs', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailShell
      title="V7"
      identityKey="site-icon-1"
      identityLabel="V"
      backLabel="Back to all sites"
      onBack={() => undefined}
      metadata={[{ label: 'Version', value: 'Jul 2026' }, { label: 'Pages', value: '16' }]}
      actions={<button>Visit site</button>}
      tabs={[{ id: 'overview', label: 'Overview' }, { id: 'pages', label: 'Pages', count: 16 }]}
      activeTab="overview"
      onTabChange={() => undefined}
    >Overview content</ReferenceDetailShell>,
  );
  assert.match(html, /Back to all sites/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"/);
  assert.match(html, /Visit site/);
});
```

Add a source boundary test to `ScreenDetail.test.tsx` asserting `ScreenDetail.tsx` imports and renders `ReferenceDetailShell`, while the existing Platform, Overview, Screens, UI Elements, Flows, Design System, Export, and admin Review assertions remain.

- [ ] **Step 2: Run the focused detail tests and verify RED**

Run:

```bash
tsx --test src/vitrine/ReferenceDetailShell.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because the shared shell does not exist.

- [ ] **Step 3: Implement the generic detail shell**

Use a string-generic contract so each domain keeps its own tab union:

```tsx
export interface DetailTab<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface ReferenceDetailShellProps<T extends string> {
  title: string;
  identityKey: string;
  identityLabel: string;
  identityImageUrl?: string | null;
  accent?: string;
  backLabel: string;
  onBack: () => void;
  metadata: Array<{ label: string; value: string; content?: ReactNode }>;
  actions?: ReactNode;
  heroControls?: ReactNode;
  tabs: Array<DetailTab<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  tabControls?: ReactNode;
  bodyBackground?: string;
  children: ReactNode;
}
```

Move only presentation from `ScreenDetail`: outer Framer Motion frame, back button, identity block, heading, metadata layout, hero actions, tab row, sliding indicator, body background, max widths, and content transition container. Keep platform state, section state, data hooks, filters, version panel, and section rendering inside `ScreenDetail` and pass them through the slots above.

- [ ] **Step 4: Run focused detail tests and verify GREEN**

Run the command from Step 2.

Expected: PASS with all prior Apps detail assertions unchanged.

- [ ] **Step 5: Commit the detail-shell extraction**

```bash
git add src/vitrine/components/ReferenceDetailShell.tsx src/vitrine/ReferenceDetailShell.test.tsx src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetail.test.tsx
git commit -m "refactor: share Apps detail shell"
```

---

### Task 6: Share media grid cards and lightbox

**Files:**
- Create: `src/vitrine/components/MediaGridCard.tsx`
- Modify: `src/vitrine/components/ScreenGridCard.tsx`
- Modify: `src/vitrine/components/Lightbox.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/Sites.test.tsx`

- [ ] **Step 1: Write failing image/video media tests**

Add a shared media fixture contract:

```tsx
test('renders images and native videos through the shared media primitives', () => {
  const image = renderToStaticMarkup(<MediaGridCard label="Open Home" kind="image" url="/home.png" badges={['Home']} onOpen={() => undefined} />);
  const video = renderToStaticMarkup(<MediaGridCard label="Open Hero video" kind="video" url="/hero.mp4" posterUrl="/hero.webp" badges={['Home', 'Video']} onOpen={() => undefined} />);
  assert.match(image, /home\.png/);
  assert.match(video, /<video[^>]+controls=""[^>]+poster="\/hero\.webp"/);
});

test('contains image and video failures inside one media card', () => {
  const source = readFileSync(new URL('./components/MediaGridCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /onError/);
  assert.match(source, /mediaFailed/);
  assert.match(source, /Preview unavailable/);
});
```

Add a `Lightbox` test using `{ kind: 'video', url: '/hero.mp4', posterUrl: '/hero.webp', type: 'Video', caption: 'Home hero' }` and assert native video controls plus `1 of 1`.

- [ ] **Step 2: Run focused TSX tests and verify RED**

Run:

```bash
tsx --test src/vitrine/ScreenDetail.test.tsx src/vitrine/Sites.test.tsx
```

Expected: FAIL because `MediaGridCard` and video-capable Lightbox contracts do not exist.

- [ ] **Step 3: Implement `MediaGridCard` and preserve `ScreenGridCard`**

Use this contract:

```tsx
interface MediaGridCardProps {
  label: string;
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl?: string | null;
  posterUrl?: string;
  accent?: string;
  aspectRatio?: string | number;
  badges?: string[];
  delay?: number;
  onOpen: () => void;
}
```

Move the current `ScreenGridCard` hover, shadow, animation, image zoom, and badge presentation into it. Render `PlaceholderImage` for images and `<video controls muted playsInline preload="metadata">` for videos. Reduce `ScreenGridCard` to a prop adapter so Apps output remains unchanged.

Keep `mediaFailed` state inside each `MediaGridCard`. Both image and video `onError` handlers set it, and only that card replaces its media with a neutral `Preview unavailable` surface. Do not lift media failure into the page or detail shell.

- [ ] **Step 4: Extend `Lightbox` without breaking Apps**

Extend `LightboxItem`:

```ts
interface LightboxItem {
  url?: string;
  seed?: string;
  kind?: 'image' | 'video';
  posterUrl?: string;
  type: string;
  caption: string;
  platform?: string;
}
```

Default `kind` to `image`. Keep the current Dialog, close button, arrows, caption, modulo navigation supplied by callers, and Screen aspect-ratio behavior. For videos render:

```tsx
<video src={item.url} poster={item.posterUrl} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2.

Expected: PASS for current Apps image cards and new Site video media.

- [ ] **Step 6: Commit the media-primitives slice**

```bash
git add src/vitrine/components/MediaGridCard.tsx src/vitrine/components/ScreenGridCard.tsx src/vitrine/components/Lightbox.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/Sites.test.tsx
git commit -m "refactor: share detail media primitives"
```

---

### Task 7: Compose the Site detail experience

**Files:**
- Modify: `src/vitrine/components/SiteVersionPage.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Write failing Overview, Pages, Sections, and privacy tests**

Render `SiteVersionView` for each tab through an explicit controlled contract:

```tsx
<SiteVersionView
  detail={detail}
  isAdmin
  section="pages"
  onSectionChange={() => undefined}
  onBack={() => undefined}
  onImport={() => undefined}
/>
```

Add assertions:

```ts
assert.match(overviewHtml, /Overview/);
assert.match(overviewHtml, /<video[^>]+controls=""[^>]+preload="metadata"/);
assert.match(pagesHtml, /Open Home page/);
assert.match(pagesHtml, /Full-page capture/);
assert.match(sectionsHtml, /All media/);
assert.match(sectionsHtml, /Images/);
assert.match(sectionsHtml, /Videos/);
assert.ok(sectionsHtml.indexOf('/image') < sectionsHtml.indexOf('/video'));
assert.doesNotMatch(sectionsHtml, /Secret visible copy/);
```

Add a test that an unknown `section` renders Overview and emits no error.

Add loading/error source-boundary assertions that `SiteVersionPage` renders the shared detail-frame skeleton while loading and keeps Back plus Retry actions inside a stable detail frame after a request failure.

- [ ] **Step 2: Run the Sites TSX test and verify RED**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx
```

Expected: FAIL because the current Site detail has page buttons and a two-column layout instead of Apps-style tabs and media grids.

- [ ] **Step 3: Implement the controlled Site detail shell**

Define:

```ts
type SiteDetailSection = 'overview' | 'pages' | 'sections';

function resolveSiteSection(value?: string): SiteDetailSection {
  return value === 'pages' || value === 'sections' ? value : 'overview';
}
```

`SiteVersionView` receives `section?: string` and `onSectionChange(section: SiteDetailSection)`. Sort pages and sections with copies so props are never mutated. Compose `ReferenceDetailShell` with:

```tsx
metadata={[
  { label: 'Version', value: `${detail.version.label}${detail.version.isLatest ? ' · Latest' : ''}` },
  { label: 'Pages', value: String(pages.length) },
  { label: 'Sections', value: String(sectionCount) },
]}
tabs={[
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages', count: pages.length },
  { id: 'sections', label: 'Sections', count: sectionCount },
]}
```

Actions are `Visit site` and admin-only `Import Site`. Use `window.open(detail.site.sourceUrl, '_blank', 'noopener,noreferrer')` for Visit site.

- [ ] **Step 4: Implement the three Site panels**

- Overview: preview video with native controls, Site URL, version label, and count summary.
- Pages: `MediaGridCard` for every page using `fullPageImageUrl`, page-title badge, and shared `Lightbox`.
- Sections: flatten `{ page, section }` pairs in page/section order, then filter with controlled `Selector` values for page and media kind. Image sections use `MediaGridCard`; video sections use native media and poster URLs.

Use one lightbox state:

```ts
type SiteLightbox = { items: Array<{ kind: 'image' | 'video'; url: string; posterUrl?: string; type: string; caption: string }>; index: number } | null;
```

Escape closes through `Dialog`; ArrowLeft and ArrowRight call modulo navigation. Do not render `section.ocrBoxes[*].text`.

- [ ] **Step 5: Connect route-controlled tabs in `SiteVersionPage`**

Accept `initialSection?: string` and `onSectionChange?: (section: SiteDetailSection) => void`, matching `ScreenDetail`. Pass these from the `App.tsx` route branch. Keep fetch abort/active protection, Retry, import dialog, and duplicate-existing navigation intact.

Replace the centered loading and failure blocks with the same `1360px` detail frame and hero/content proportions used by `ReferenceDetailShell`. Loading uses `Skeleton` blocks for back action, identity, heading, metadata, tabs, and the first media row. Failure keeps `Back to all sites`, the Site-version frame, the existing error message, and Retry visible. These states must not open the import dialog or read Jobs.

- [ ] **Step 6: Run Sites tests and verify GREEN**

Run:

```bash
tsx --test src/vitrine/Sites.test.tsx
node --experimental-strip-types --test src/vitrine/sitesApi.test.ts src/vitrine/router.test.ts
```

Expected: all tests PASS; raw OCR text is absent; no Jobs GET appears.

- [ ] **Step 7: Commit the Site detail slice**

```bash
git add src/vitrine/components/SiteVersionPage.tsx src/vitrine/Sites.test.tsx src/vitrine/App.tsx
git commit -m "feat: render Site detail with Apps UI"
```

---

### Task 8: Complete regression and live verification

**Files:**
- Modify only if a verification failure requires a scoped correction.

- [ ] **Step 1: Run focused UI and boundary tests**

```bash
tsx --test src/vitrine/PreviewCarouselCard.test.tsx src/vitrine/ReferenceDetailShell.test.tsx src/vitrine/ImportDialog.test.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/Sites.test.tsx
node --experimental-strip-types --test --test-concurrency=1 src/sitesStore.test.ts src/vitrine/sitesApi.test.ts src/vitrine/router.test.ts services/api/src/sites.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 2: Run the complete automated suite**

```bash
npm test
```

Expected: both the Node and TSX phases finish with zero failures.

- [ ] **Step 3: Build the production frontend**

```bash
npm run build
```

Expected: Vite build succeeds. The existing chunk-size warning is acceptable; new TypeScript or bundling errors are not.

- [ ] **Step 4: Verify the scoped diff and dirty-worktree boundary**

```bash
git diff --check
git status --short
```

Expected: `git diff --check` prints nothing. `src/vitrine/Home.tsx` and `src/vitrine/main.tsx` remain unstaged user changes; only scoped parity files may be staged by any corrective commit.

- [ ] **Step 5: Browser-verify Apps and Sites**

Using the authenticated local Vitrine session:

1. Open `/apps`; confirm card size, carousel controls, search trigger, counts, and hover behavior are unchanged.
2. Open one App; confirm Platform, Overview, Screens, UI Elements, Flows, Design System, Export, and admin Review remain usable.
3. Open `/sites`; confirm cards use page screenshots, Apps proportions, sticky search, filtered counts, arrows, and dots.
4. Search by `V7`, `Jul 2026`, and `Home`; confirm the same Site remains visible.
5. Open V7; confirm the hero and Overview, Pages, and Sections tabs.
6. Open a page lightbox and navigate with arrows/Escape.
7. Filter Sections by page, Images, and Videos; play a native video and confirm image/poster media loads.
8. Inspect requests and confirm neither gallery issues `GET /api/jobs`.

Expected: no broken images/videos, no console errors from the extraction, and the existing V7 data remains 16 pages and 46 sections.

- [ ] **Step 6: Resolve verification failures at their owning task boundary**

If verification exposes a failure, return to the task that owns that file, add a failing focused test, make the smallest correction there, rerun that task's focused command, and stage only the explicit files listed by that task. If verification is green, do not create an empty commit.

---

## Completion Criteria

- Sites and Apps use the same carousel-card, sticky-toolbar, detail-shell, media-card, and lightbox foundations.
- Apps output, routes, data loading, gates, sections, and Jobs behavior are unchanged.
- Sites gallery previews page screenshots and never uses its preview video as the card face.
- Site detail provides Overview, Pages, and Sections with ordered image/video media and accessible lightboxes.
- Ready Site summaries contain no more than five ordered page previews from one list request.
- No crawler, queue, worker, object-store, watermark, import, or canonical URL code changes.
- No Apps or Sites gallery `GET /api/jobs` requests.
- Focused tests, complete tests, production build, and authenticated browser checks pass.
- Unrelated `Home.tsx` and `main.tsx` changes remain untouched and unstaged.
