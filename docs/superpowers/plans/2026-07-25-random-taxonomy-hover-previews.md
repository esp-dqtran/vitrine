# Random Taxonomy Hover Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Randomly select a different published taxonomy preview on each hover without polling or making a request per hover.

**Architecture:** The public preview store and API return a stable pool of at most six eligible apps for one facet. The client lazily caches that pool, selects from it with an injectable random source, and remembers the previous app per platform/group/value so consecutive hovers differ when possible. Existing protected media routes and GSAP rendering remain unchanged.

**Tech Stack:** TypeScript, PostgreSQL, Express, React, GSAP, Node test runner

---

## File Structure

- `src/publicFacetPreviewStore.ts`: returns bounded candidate metadata pools.
- `src/publicFacetPreviewStore.test.ts`: verifies distinct bounded candidates and media counts.
- `services/api/src/app.ts`: exposes safe candidate pools and existing media URLs.
- `services/api/src/app.test.ts`: verifies the public pool contract and input validation.
- `src/vitrine/facetPreviewApi.ts`: validates, caches, and randomly selects candidates.
- `src/vitrine/facetPreviewApi.test.ts`: verifies deduplication, randomness, repeat avoidance, and recovery.
- `src/vitrine/components/AppsDiscoveryPage.tsx`: requests a random cached candidate on pointer entry.
- `src/vitrine/AppsDiscovery.test.tsx`: protects the no-polling, lazy-hover wiring.

### Task 1: Return a bounded published candidate pool

**Files:**
- Modify: `src/publicFacetPreviewStore.ts`
- Modify: `src/publicFacetPreviewStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

Add tests that provide multiple rows and require a pool:

```ts
test("maps at most six distinct published facet candidates", async () => {
  const previews = await publishedFacetPreviews(flowFacet, async () => ({
    rows: Array.from({ length: 7 }, (_, index) => ({
      app: `app-${index}`,
      icon_url: null,
      media_count: index === 0 ? 8 : 2,
    })),
  } as never));

  assert.equal(previews.length, 6);
  assert.equal(previews[0]?.mediaCount, 3);
  assert.equal(new Set(previews.map(({ app }) => app)).size, 6);
});

test("returns an empty candidate pool when no published media exists", async () => {
  assert.deepEqual(
    await publishedFacetPreviews(flowFacet, async () => ({ rows: [] } as never)),
    [],
  );
});
```

- [ ] **Step 2: Run the store test and verify RED**

Run:

```bash
npx tsx --test src/publicFacetPreviewStore.test.ts
```

Expected: FAIL because `publishedFacetPreviews` is not exported.

- [ ] **Step 3: Implement the bounded store query**

Replace the singular store function with:

```ts
export async function publishedFacetPreviews(
  input: PublicFacetInput,
  runQuery: FacetDatabaseQuery = query,
): Promise<PublicFacetPreview[]> {
  // Keep the existing latest-published and exact-facet joins.
  // Change both category and media SQL limits to LIMIT 6.
  const result = await runQuery(sql, [input.platform, input.value]);
  return result.rows.slice(0, 6).flatMap((raw) => {
    const row = raw as FacetPreviewRow;
    const mediaCount = kind === "flow"
      ? Math.min(Math.max(Number(row.media_count) || 0, 0), 3)
      : kind === "icon" ? 0 : 1;
    if (kind === "icon" ? !row.icon_url : mediaCount === 0) return [];
    return [{
      kind,
      app: row.app,
      label: input.value,
      iconUrl: row.icon_url,
      mediaCount,
    }];
  });
}
```

Keep stable `ORDER BY a.name` and add `LIMIT 6`; do not introduce
`ORDER BY random()`.

- [ ] **Step 4: Run the store tests and verify GREEN**

Run:

```bash
npx tsx --test src/publicFacetPreviewStore.test.ts
```

Expected: all store tests PASS.

- [ ] **Step 5: Commit the store pool**

```bash
git add src/publicFacetPreviewStore.ts src/publicFacetPreviewStore.test.ts
git commit -m "feat: return published taxonomy preview pools"
```

### Task 2: Serve safe candidate pools from the public API

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write the failing API test**

Update the facet metadata test so the dependency returns two candidates and the
route returns a bounded `previews` array:

```ts
publishedFacetPreviews: async () => [
  {
    kind: "flow",
    app: "linear",
    label: "Setting Up",
    iconUrl: null,
    mediaCount: 3,
  },
  {
    kind: "flow",
    app: "notion",
    label: "Setting Up",
    iconUrl: null,
    mediaCount: 2,
  },
],
```

Assert that the response is:

```ts
{
  previews: [
    {
      kind: "flow",
      app: "linear",
      label: "Setting Up",
      iconUrl: null,
      media: [
        "/api/catalog/facet-media/linear/flows/Setting%20Up/web/1",
        "/api/catalog/facet-media/linear/flows/Setting%20Up/web/2",
        "/api/catalog/facet-media/linear/flows/Setting%20Up/web/3",
      ],
    },
    {
      kind: "flow",
      app: "notion",
      label: "Setting Up",
      iconUrl: null,
      media: [
        "/api/catalog/facet-media/notion/flows/Setting%20Up/web/1",
        "/api/catalog/facet-media/notion/flows/Setting%20Up/web/2",
      ],
    },
  ],
}
```

- [ ] **Step 2: Run the API test and verify RED**

Run:

```bash
npx tsx --test --test-name-pattern="taxonomy previews" services/api/src/app.test.ts
```

Expected: FAIL because the route still uses the singular dependency and
response.

- [ ] **Step 3: Implement the API pool response**

Rename the dependency to `publishedFacetPreviews`, then map every store
candidate through the existing safe media URL builder:

```ts
const previews = await deps.publishedFacetPreviews(facet);
if (previews.length === 0) {
  res.status(404).json({ error: "facet preview not found" });
  return;
}
res.setHeader("Cache-Control", "public, max-age=300");
res.json({
  previews: previews.slice(0, 6).map((preview) => ({
    kind: preview.kind,
    app: preview.app,
    label: preview.label,
    iconUrl: preview.iconUrl,
    media: Array.from({ length: preview.mediaCount }, (_, index) =>
      facetMediaPath(preview.app, facet, index + 1)),
  })),
});
```

Keep `GET /catalog/facet-media/:app/:group/:value/:platform/:rank` unchanged.

- [ ] **Step 4: Run API and object-access tests**

Run:

```bash
npx tsx --test src/objectStoreDb.test.ts services/api/src/app.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the API contract**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: serve taxonomy preview pools"
```

### Task 3: Randomly select from one lazy cached pool

**Files:**
- Modify: `src/vitrine/facetPreviewApi.ts`
- Modify: `src/vitrine/facetPreviewApi.test.ts`

- [ ] **Step 1: Write failing client selection tests**

Replace the singular-response fixture with `{ previews: [...] }` and add:

```ts
test("selects again on every hover without immediately repeating an app", async () => {
  clearFacetPreviewCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return jsonResponse({
      previews: [
        componentPreview("Linear"),
        componentPreview("Notion"),
        componentPreview("Slack"),
      ],
    });
  };
  const input = { group: "elements", value: "Dialog", platform: "web" } as const;

  const first = await fetchRandomFacetPreview(input, fetcher, () => 0);
  const second = await fetchRandomFacetPreview(input, fetcher, () => 0);

  assert.equal(first?.app, "Linear");
  assert.equal(second?.app, "Notion");
  assert.equal(calls, 1);
});

test("keeps a single-candidate pool stable", async () => {
  clearFacetPreviewCache();
  const input = { group: "screens", value: "Signup", platform: "web" } as const;
  const fetcher = async () => jsonResponse({ previews: [screenPreview("Linear")] });
  assert.equal((await fetchRandomFacetPreview(input, fetcher, () => 0))?.app, "Linear");
  assert.equal((await fetchRandomFacetPreview(input, fetcher, () => 0.9))?.app, "Linear");
});
```

Retain the existing malformed-response, 404, concurrent deduplication, and
failed-request retry assertions.

- [ ] **Step 2: Run the client test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/facetPreviewApi.test.ts
```

Expected: FAIL because `fetchRandomFacetPreview` does not exist.

- [ ] **Step 3: Implement validation, caching, and repeat avoidance**

Use one pool cache and one previous-app map:

```ts
const previewPoolCache = new Map<string, Promise<FacetPreview[]>>();
const previousApp = new Map<string, string>();

export async function fetchRandomFacetPreview(
  input: PublicFacetInput,
  fetcher: typeof fetch = fetch,
  random: () => number = Math.random,
): Promise<FacetPreview | null> {
  const key = facetKey(input);
  const pool = await fetchFacetPreviewPool(input, fetcher);
  if (pool.length === 0) return null;
  const previous = previousApp.get(key);
  const eligible = pool.length > 1
    ? pool.filter(({ app }) => app !== previous)
    : pool;
  const index = Math.min(
    eligible.length - 1,
    Math.max(0, Math.floor(random() * eligible.length)),
  );
  const selected = eligible[index] ?? null;
  if (selected) previousApp.set(key, selected.app);
  return selected;
}
```

`fetchFacetPreviewPool` validates a maximum of six candidates, caches 404 and
malformed responses as `[]`, and deletes the cache entry when a request throws.
`clearFacetPreviewCache` clears both maps.

- [ ] **Step 4: Run the client tests and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/facetPreviewApi.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit random client selection**

```bash
git add src/vitrine/facetPreviewApi.ts src/vitrine/facetPreviewApi.test.ts
git commit -m "feat: randomize cached taxonomy previews"
```

### Task 4: Wire random selection into hover entry

**Files:**
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write the failing wiring test**

Add a source-boundary assertion:

```ts
test("requests a random cached taxonomy candidate on pointer entry", async () => {
  const source = await readFile(
    new URL("./components/AppsDiscoveryPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /fetchRandomFacetPreview\(\{ \.\.\.facet, platform \}\)/);
  assert.doesNotMatch(source, /fetchFacetPreview\(\{ \.\.\.facet, platform \}\)/);
});
```

- [ ] **Step 2: Run the Apps discovery test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because pointer entry still calls `fetchFacetPreview`.

- [ ] **Step 3: Switch the pointer-entry dependency**

In `AppsDiscoveryPage.tsx`, import and call:

```ts
import { fetchRandomFacetPreview } from "../facetPreviewApi.ts";

void fetchRandomFacetPreview({ ...facet, platform })
  .then((preview) => {
    if (preview && request === hoverRequestRef.current) {
      const point = hoverPointRef.current;
      showPreview(preview, point.x, point.y);
    }
  })
  .catch(() => undefined);
```

Keep the stale request token, pointer tracking, leave behavior, GSAP hook, and
three rendered image frames unchanged.

- [ ] **Step 4: Run frontend tests and build**

Run:

```bash
npx tsx --test src/vitrine/facetPreviewApi.test.ts src/vitrine/AppsDiscovery.test.tsx
npm run build
```

Expected: all selected tests PASS and Vite exits successfully.

- [ ] **Step 5: Commit hover wiring**

Stage only the random-preview hunks because the working tree contains unrelated
UI work:

```bash
git add -p src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/AppsDiscovery.test.tsx
git commit -m "feat: rotate taxonomy previews on hover"
```

### Task 5: Live verification and delivery

**Files:**
- No source changes expected.

- [ ] **Step 1: Verify migrations remain current**

Run:

```bash
node --env-file=.env --experimental-strip-types scripts/check-migrations.ts
```

Expected: `{"status":"ok","current":true}`.

- [ ] **Step 2: Rebuild the local API and verify the pool**

Run:

```bash
docker compose up -d --build api
curl -sS \
  "http://127.0.0.1:5173/api/catalog/facet-preview?group=flows&value=Setting%20Up&platform=web"
```

Expected: HTTP 200 with `previews`, two or more candidates when live published
data provides them, and one to three protected media URLs per flow.

- [ ] **Step 3: Run the complete focused regression**

Run:

```bash
npx tsx --test \
  src/publicFacetPreviewStore.test.ts \
  src/objectStoreDb.test.ts \
  services/api/src/app.test.ts \
  src/vitrine/facetPreviewApi.test.ts \
  src/vitrine/AppsDiscovery.test.tsx
npm run build
```

Expected: all selected tests PASS and Vite exits successfully.

- [ ] **Step 4: Browser-check repeated hover**

At `http://127.0.0.1:5173/apps`, hover away from and back to one item in each
group. Verify the app changes on consecutive hovers when its pool has multiple
candidates, the preview remains bottom-right of the cursor, and Flows continue
cycling at most three frames.

- [ ] **Step 5: Push the completed commits**

```bash
git push origin main
```

Expected: `origin/main` resolves to the same commit as local `HEAD`.
