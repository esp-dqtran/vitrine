# App Taxonomy Hover Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each Apps taxonomy group a dedicated, pointer-following preview: app icons for Categories, screens for Screens, component crops for UI Elements, and animated flow steps for Flows.

**Architecture:** Add a strict shared facet contract and a bounded PostgreSQL reader for the latest published app/platform versions. Expose lazy public metadata and rank-based protected media routes, then cache responses in the Apps client and render each preview kind through the existing GSAP follower.

**Tech Stack:** TypeScript, PostgreSQL, Express, React, GSAP, Node test runner

---

## File Structure

- Create `src/publicFacetPreview.ts`: shared allowlist, request parsing, and public response types.
- Create `src/publicFacetPreviewStore.ts`: bounded latest-published facet and media resolution.
- Create `src/publicFacetPreviewStore.test.ts`: SQL boundaries and result mapping.
- Modify `src/objectStoreDb.ts`: resolve one allowlisted facet media rank to protected object metadata.
- Modify `src/objectStoreDb.test.ts`: publication, app, facet, and rank scoping tests.
- Modify `services/api/src/app.ts`: public facet metadata and media routes.
- Modify `services/api/src/app.test.ts`: route validation, response bounds, and media delivery tests.
- Create `src/vitrine/facetPreviewApi.ts`: lazy request cache and response validation.
- Create `src/vitrine/facetPreviewApi.test.ts`: cache and malformed-response tests.
- Modify `src/vitrine/appsDiscovery.ts`: remove the old screen-only preview selector.
- Modify `src/vitrine/useCategoryHoverPreview.ts`: render/follow/cycle typed previews with viewport clamping.
- Modify `src/vitrine/components/AppsDiscoveryPage.tsx`: load the hovered facet preview and render its media frames.
- Modify `src/vitrine/AppsDiscovery.test.tsx`: four preview variants and hover-boundary tests.
- Modify `src/vitrine/styles.css`: compact icon, screen/component, and flow-frame presentation.

### Task 1: Shared facet contract and bounded PostgreSQL reader

**Files:**
- Create: `src/publicFacetPreview.ts`
- Create: `src/publicFacetPreviewStore.ts`
- Create: `src/publicFacetPreviewStore.test.ts`

- [ ] **Step 1: Write failing contract and store tests**

Test that only the 20 values in `APPS_DISCOVERY_FACETS` are accepted, platform is
`ios` or `web`, Category results contain an icon and no media, Screen/UI Element
results contain one media rank, and Flow results contain at most three ordered
ranks. Assert the SQL contains latest-published scoping and a hard `LIMIT`.

```ts
assert.equal(parsePublicFacet({ group: "elements", value: "Dialog", platform: "web" })?.group, "elements");
assert.equal(parsePublicFacet({ group: "elements", value: "Unknown", platform: "web" }), null);
assert.deepEqual(await publishedFacetPreview(validFlow, runQuery), {
  kind: "flow",
  app: "linear",
  label: "Setting Up",
  iconUrl: null,
  mediaCount: 3,
});
assert.match(capturedSql, /status = 'published'/);
assert.match(capturedSql, /LIMIT 3/);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/publicFacetPreviewStore.test.ts`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement the shared allowlist**

Define:

```ts
export type PublicFacetGroup = "categories" | "screens" | "elements" | "flows";
export type PublicFacetPlatform = "ios" | "web";
export interface PublicFacetInput {
  group: PublicFacetGroup;
  value: string;
  platform: PublicFacetPlatform;
}
export interface PublicFacetPreview {
  kind: "icon" | "screen" | "component" | "flow";
  app: string;
  label: string;
  iconUrl: string | null;
  mediaCount: number;
}
```

Keep the allowlist in this backend-safe module and have the frontend taxonomy
constant import it so the two surfaces cannot drift.

- [ ] **Step 4: Implement the bounded reader**

Use one latest-published CTE per request:

```sql
SELECT DISTINCT ON (av.app_id)
  av.id AS version_id, av.app_id
FROM app_versions av
WHERE av.status = 'published' AND av.platform = $1
ORDER BY av.app_id, av.version_number DESC
```

Resolve Categories by exact category and non-null icon, Screens from
`images.kind = 'screen'`, UI Elements from `images.kind = 'ui_element'`, and
Flows by flattening matching `app_flow_versions.flows` evidence in step order.
Only count object-backed candidates and cap Flow media at three.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test src/publicFacetPreviewStore.test.ts`

Expected: PASS.

```bash
git add src/publicFacetPreview.ts src/publicFacetPreviewStore.ts src/publicFacetPreviewStore.test.ts
git commit -m "feat: resolve published taxonomy previews"
```

### Task 2: Protected public facet media routes

**Files:**
- Modify: `src/objectStoreDb.ts`
- Modify: `src/objectStoreDb.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing object and route tests**

Add tests for:

```ts
GET /catalog/facet-preview?group=elements&value=Dialog&platform=web
GET /catalog/facet-media/linear/elements/Dialog/web/1
```

Assert invalid group/value/platform/rank returns 400, missing media returns 404,
missing object storage returns 503, metadata never contains object keys, and
the media resolver requires the exact latest published version and app.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx tsx --test src/objectStoreDb.test.ts services/api/src/app.test.ts
```

Expected: FAIL with missing dependency/routes.

- [ ] **Step 3: Implement object lookup**

Add:

```ts
publishedFacetPreviewObject(
  input: PublicFacetInput & { app: string; rank: number },
  runQuery?: DatabaseQuery,
): Promise<ObjectMetadata | undefined>
```

Reuse the same deterministic candidate ordering as the metadata reader, join
`stored_objects` through the thumbnail/full object association, and accept only
`protected` or `public-preview` access classes.

- [ ] **Step 4: Implement Express routes**

The metadata route returns:

```json
{
  "kind": "flow",
  "app": "linear",
  "label": "Setting Up",
  "iconUrl": null,
  "media": [
    "/api/catalog/facet-media/linear/flows/Setting%20Up/web/1",
    "/api/catalog/facet-media/linear/flows/Setting%20Up/web/2",
    "/api/catalog/facet-media/linear/flows/Setting%20Up/web/3"
  ]
}
```

Set a short public cache header. Build media URLs server-side and never return
image IDs, object keys, source paths, or storage configuration.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx tsx --test src/publicFacetPreviewStore.test.ts src/objectStoreDb.test.ts services/api/src/app.test.ts
```

Expected: PASS.

```bash
git add src/objectStoreDb.ts src/objectStoreDb.test.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: serve protected taxonomy preview media"
```

### Task 3: Lazy client cache and typed hover rendering

**Files:**
- Create: `src/vitrine/facetPreviewApi.ts`
- Create: `src/vitrine/facetPreviewApi.test.ts`
- Modify: `src/vitrine/appsDiscovery.ts`
- Modify: `src/vitrine/useCategoryHoverPreview.ts`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write failing client tests**

Assert two loads of the same group/value/platform perform one fetch, malformed
responses become `null`, stale hover promises do not reopen a preview after
pointer leave, and the four groups render `icon`, `screen`, `component`, and
`flow` variants.

```ts
const first = loadFacetPreview(facet, "web", fetcher);
const second = loadFacetPreview(facet, "web", fetcher);
assert.equal(first, second);
assert.equal(calls, 1);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/facetPreviewApi.test.ts src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because the loader and typed markup are absent.

- [ ] **Step 3: Implement lazy caching**

Cache promises by `${platform}:${group}:${value}` and validate the response:

```ts
export interface FacetPreviewView {
  kind: "icon" | "screen" | "component" | "flow";
  app: string;
  label: string;
  iconUrl: string | null;
  media: string[];
}
```

Do not poll and do not preload the 20 facets.

- [ ] **Step 4: Wire hover lifecycle**

On pointer enter, capture a monotonically increasing request token, await the
cached preview, and call `showPreview` only if the pointer is still over the
same facet. Pointer leave invalidates that token and hides immediately.

Render an image list inside the existing floating container; use `iconUrl` for
`icon`, and `media` for all other kinds.

- [ ] **Step 5: Implement GSAP clamping and Flow cycling**

Use a bottom-right offset and the rendered preview dimensions:

```ts
const place = (x: number, y: number) => {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  xTo(Math.min(x + 18, window.innerWidth - width - 12));
  yTo(Math.min(y + 18, window.innerHeight - height - 12));
};
```

Cycle Flow frames with a GSAP timeline; kill it on leave, preview replacement,
effect cleanup, and reduced-motion mode. Reduced motion keeps frame zero.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npx tsx --test src/vitrine/facetPreviewApi.test.ts src/vitrine/AppsDiscovery.test.tsx
```

Expected: PASS.

```bash
git add src/vitrine/facetPreviewApi.ts src/vitrine/facetPreviewApi.test.ts src/vitrine/appsDiscovery.ts src/vitrine/useCategoryHoverPreview.ts src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/AppsDiscovery.test.tsx
git commit -m "feat: render typed taxonomy hover previews"
```

### Task 4: Preview styling, integration, and live verification

**Files:**
- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write failing style assertions**

Require a compact rounded icon variant, screen/component aspect handling,
overlaid Flow frames, fixed non-interactive positioning, and coarse-pointer
suppression.

- [ ] **Step 2: Run the style test and verify RED**

Run: `npx tsx --test src/vitrine/AppsDiscovery.test.tsx`

Expected: FAIL on the new variant selectors.

- [ ] **Step 3: Add minimal variant styles**

Use data attributes:

```css
.apps-discovery__hover-preview[data-preview-kind='icon'] { width: 72px; height: 72px; }
.apps-discovery__hover-preview[data-preview-kind='icon'] img { border-radius: 18px; }
.apps-discovery__hover-preview[data-preview-kind='screen'] { width: 220px; }
.apps-discovery__hover-preview[data-preview-kind='component'] { width: 180px; }
.apps-discovery__hover-preview[data-preview-kind='flow'] img { position: absolute; inset: 0; }
```

- [ ] **Step 4: Run focused and build verification**

Run:

```bash
npx tsx --test src/publicFacetPreviewStore.test.ts src/objectStoreDb.test.ts services/api/src/app.test.ts src/vitrine/facetPreviewApi.test.ts src/vitrine/AppsDiscovery.test.tsx
npm run build
```

Expected: all focused tests pass and Vite exits 0.

- [ ] **Step 5: Profile and verify locally**

Apply no migration unless `EXPLAIN (ANALYZE, BUFFERS)` proves an index gap.
Rebuild only the API service, open `http://127.0.0.1:5173/apps`, and verify:

- Category icon at bottom-right of pointer.
- Screen preview uses a screen image.
- UI Element preview uses a stored component crop.
- Flow preview cycles through up to three ordered steps.
- No API, media, or console errors.

- [ ] **Step 6: Commit and push when requested**

```bash
git add src/vitrine/styles.css src/vitrine/AppsDiscovery.test.tsx
git commit -m "style: present taxonomy hover previews"
git push origin main
```
