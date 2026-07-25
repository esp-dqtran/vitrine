# Public Catalog API Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/catalog`, `/api/catalog/stats`, and the public Apps screen load reliably against the fully published live catalog.

**Architecture:** Add a focused public-catalog store that selects an app-name page before reading metadata and three representative screens. Adapt the gallery builder and API route to consume that bounded page, extend the public preview-media resolver with the same captured-screen fallback, and replace the stats query's correlated latest-version lookup with one set-based relation.

**Tech Stack:** TypeScript, PostgreSQL, Express, React, Node test runner, Docker Compose, Vite, browser runtime verification.

---

## File Structure

- Create `src/publicCatalogStore.ts`: own bounded public app selection, page cursor handling, per-page metadata aggregation, and three-screen preview selection.
- Create `src/publicCatalogStore.test.ts`: unit-test the store with an injected query function and prove all reads are page-bounded.
- Modify `src/gallery.ts`: map bounded public catalog records into the existing `CatalogPage` JSON contract.
- Modify `src/gallery.test.ts`: verify captured preview fallback, curated ordering, cursors, and field redaction.
- Modify `services/api/src/app.ts`: route `/catalog` through the bounded store dependency.
- Modify `services/api/src/app.test.ts`: prove the public route uses only the bounded dependency and preserves public access.
- Modify `src/objectStoreDb.ts`: resolve public preview-media ranks from curated-or-captured published candidates.
- Modify `src/objectStoreDb.test.ts`: verify fallback ranking and public object access constraints.
- Modify `src/db.ts`: rewrite `catalogStats()` with a set-based latest-version CTE and allow query injection for a focused SQL test.
- Create `src/catalogStats.test.ts`: prove the stats query no longer contains a correlated latest-version lookup.

Do not stage or modify the existing discovery-toolbar files or `scripts/login-wait.png`.

### Task 1: Bounded Public Catalog Store

**Files:**
- Create: `src/publicCatalogStore.ts`
- Create: `src/publicCatalogStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

Create `src/publicCatalogStore.test.ts` with a fake `DatabaseQuery` that returns
25 app names for a requested limit of 24, then returns page metadata and ranked
preview rows. Assert:

```ts
test("selects one extra app name before reading bounded catalog metadata", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const names = Array.from({ length: 25 }, (_, index) => ({
    app: `app-${String(index + 1).padStart(2, "0")}`,
  }));
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return result(names);
    if (calls.length === 2) {
      return result(names.slice(0, 24).map(({ app }) => ({
        app,
        display_name: app.toUpperCase(),
        category: "Productivity",
        website_url: null,
        icon_url: null,
        accent_color: "#123456",
        total_screens: 12,
        available_platforms: ["web"],
      })));
    }
    return result(names.slice(0, 24).map(({ app }, index) => preview(app, index + 1)));
  };

  const page = await publishedCatalogPage({ limit: 24 }, query);

  assert.equal(page.apps.length, 24);
  assert.equal(page.previews.length, 24);
  assert.equal(decode(page.nextCursor!), "app-24");
  assert.deepEqual(calls[0].values, [null, 25]);
  assert.match(calls[0].sql, /LIMIT \$2/);
  assert.match(calls[1].sql, /ANY\(\$1::text\[\]\)/);
  assert.match(calls[2].sql, /preview_rank <= 3/);
});

test("uses a decoded app-name cursor and clamps the page size", async () => {
  const calls: Array<{ values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (_sql, values) => {
    calls.push({ values });
    return result([]);
  };

  await publishedCatalogPage({ cursor: encode("linear"), limit: 500 }, query);

  assert.deepEqual(calls[0].values, ["linear", 25]);
});

test("treats malformed cursors as the first page", async () => {
  const calls: Array<{ values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (_sql, values) => {
    calls.push({ values });
    return result([]);
  };

  await publishedCatalogPage({ cursor: "***", limit: 3 }, query);

  assert.deepEqual(calls[0].values, [null, 4]);
});
```

The test helpers must return PostgreSQL-shaped `{ rows, rowCount }` results and
complete `PublishedPreviewImage` fields.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/publicCatalogStore.test.ts
```

Expected: FAIL because `src/publicCatalogStore.ts` does not exist.

- [ ] **Step 3: Implement the bounded store**

Create `src/publicCatalogStore.ts` with:

```ts
import { query, type CrawledImage, type PublishedPreviewImage } from "./db.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<{ rows: unknown[]; rowCount?: number | null }>;

export interface PublishedCatalogAppRecord {
  app: string;
  display_name: string | null;
  category: string | null;
  website_url: string | null;
  icon_url: string | null;
  accent_color: string | null;
  total_screens: number;
  available_platforms: string[];
}

export interface PublishedCatalogPageRecord {
  apps: PublishedCatalogAppRecord[];
  previews: PublishedPreviewImage[];
  nextCursor: string | null;
}

const encodeCursor = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

function decodeCursor(value?: string): string | undefined {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  return decoded && Buffer.from(decoded, "utf8").toString("base64url") === value
    ? decoded
    : undefined;
}

const limit = (requested = 24): number =>
  Math.min(Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 24, 1), 24);
```

Implement `publishedCatalogPage(input, runQuery = query)` with three bounded
queries:

1. A `latest` CTE using
   `DISTINCT ON (av.app_id, av.platform)`, an app-name cursor, a published
   screen `EXISTS`, alphabetical ordering, and `LIMIT $2`.
2. A metadata query restricted by `a.name = ANY($1::text[])` that counts
   published screens and aggregates available platforms.
3. A preview query restricted by the same names. It deduplicates by app and
   image, orders curated ranks before captured fallback rows, ranks with
   `ROW_NUMBER()`, and returns only `preview_rank <= 3`.

Use `limit + 1` only for the name query, remove the extra name before metadata
and preview reads, and encode the final returned app name only when the extra
row exists. If the page has no names, return empty arrays without executing the
other queries.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/publicCatalogStore.test.ts
```

Expected: all public catalog store tests PASS.

- [ ] **Step 5: Commit the bounded store**

```bash
git add src/publicCatalogStore.ts src/publicCatalogStore.test.ts
git commit -m "perf: page published Apps in PostgreSQL"
```

### Task 2: Existing Catalog Response Contract

**Files:**
- Modify: `src/gallery.ts`
- Modify: `src/gallery.test.ts`

- [ ] **Step 1: Write failing bounded-page builder tests**

Import `buildPublishedCatalogPage` and add a test with two
`PublishedCatalogAppRecord` rows and preview candidates. Assert that:

```ts
const page = buildPublishedCatalogPage({
  apps: [{
    app: "linear",
    display_name: "Linear",
    category: "Productivity",
    website_url: "https://linear.app",
    icon_url: "https://linear.app/icon.png",
    accent_color: "#5E6AD2",
    total_screens: 236,
    available_platforms: ["web", "ios"],
  }],
  previews: [
    { ...image, app: "linear", preview_rank: 1 },
    { ...image, id: 2, app: "linear", preview_rank: 2 },
  ],
  nextCursor: "next",
});

assert.equal(page.apps[0].totalScreens, 236);
assert.deepEqual(page.apps[0].platforms, ["web", "ios"]);
assert.deepEqual(
  page.apps[0].previewScreens.map(({ url }) => url),
  ["/api/preview-media/linear/1", "/api/preview-media/linear/2"],
);
assert.equal(page.nextCursor, "next");
assert.doesNotMatch(JSON.stringify(page), /image_url|object_key|capture:/);
```

- [ ] **Step 2: Run the gallery test and verify RED**

Run:

```bash
npx tsx --test src/gallery.test.ts
```

Expected: FAIL because `buildPublishedCatalogPage` is not exported.

- [ ] **Step 3: Add the bounded page mapper**

In `src/gallery.ts`, import `PublishedCatalogPageRecord` and add:

```ts
export function buildPublishedCatalogPage(
  page: PublishedCatalogPageRecord,
): CatalogPage {
  const previewsByApp = groups(page.previews);
  return {
    apps: page.apps.map((row) => {
      const meta = appMeta(row.app);
      return {
        id: row.app,
        app: row.display_name ?? meta.label,
        cat: row.category ?? meta.cat,
        accent: row.accent_color ?? meta.accent,
        totalScreens: row.total_screens,
        platforms: row.available_platforms,
        previewScreens: (previewsByApp.get(row.app) ?? [])
          .sort((left, right) => left.preview_rank - right.preview_rank)
          .map((image) => screen(row.app, image, image.preview_rank)),
        websiteUrl: row.website_url ?? meta.websiteUrl,
        iconUrl: row.icon_url,
      };
    }),
    nextCursor: page.nextCursor,
  };
}
```

Keep the legacy `buildCatalogPage` export for callers and tests outside the
public route until a separate cleanup proves it is unused.

- [ ] **Step 4: Run the gallery test and verify GREEN**

Run:

```bash
npx tsx --test src/gallery.test.ts
```

Expected: all gallery tests PASS.

- [ ] **Step 5: Commit the response mapper**

```bash
git add src/gallery.ts src/gallery.test.ts
git commit -m "refactor: build bounded public catalog pages"
```

### Task 3: Public API Route Uses Only Bounded Reads

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write the failing route regression test**

Replace the legacy public-catalog fixture with a bounded dependency and add
guards that throw if the full readers are called:

```ts
test("serves the public catalog from one bounded page dependency", async (t) => {
  let input: { cursor?: string; limit?: number } | undefined;
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async (next) => {
      input = next;
      return catalogPageRecord;
    },
    publishedImages: async () => {
      throw new Error("legacy full-catalog reader called");
    },
    publishedPreviewImages: async () => {
      throw new Error("legacy full-preview reader called");
    },
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/catalog?cursor=bGluZWFy&limit=3`);

  assert.equal(response.status, 200);
  assert.deepEqual(input, { cursor: "bGluZWFy", limit: 3 });
  const body = await response.json();
  assert.equal(body.apps[0].previewScreens.length, 1);
  assert.doesNotMatch(JSON.stringify(body), /image_url|mobbin-bulk/);
});
```

- [ ] **Step 2: Run the focused API test and verify RED**

Run:

```bash
npx tsx --test --test-name-pattern "bounded page dependency|catalog public" services/api/src/app.test.ts
```

Expected: FAIL because `publishedCatalogPage` is not an API dependency and the
route still calls the legacy readers.

- [ ] **Step 3: Wire the bounded store into the route**

In `services/api/src/app.ts`:

```ts
import { publishedCatalogPage } from "../../../src/publicCatalogStore.ts";
import {
  buildAdminGalleryApps,
  buildAppMetadata,
  buildEvidencePage,
  buildGalleryApps,
  buildPublishedCatalogPage,
} from "../../../src/gallery.ts";
```

Add `publishedCatalogPage` to `defaults`. Replace the route body with:

```ts
app.get("/catalog", async (req, res) => {
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const page = await deps.publishedCatalogPage({ cursor, limit });
  res.setHeader("Cache-Control", "private, max-age=280");
  res.json(buildPublishedCatalogPage(page));
});
```

Remove the `publishedImages` compatibility override from `createApiApp` after
updating all catalog route tests to inject `publishedCatalogPage`. Do not remove
the legacy DB export until repository-wide references are checked.

- [ ] **Step 4: Run the focused API test and verify GREEN**

Run:

```bash
npx tsx --test --test-name-pattern "bounded page dependency|catalog public" services/api/src/app.test.ts
```

Expected: focused public catalog tests PASS.

- [ ] **Step 5: Commit the route change**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts
git commit -m "perf: bound public catalog API reads"
```

### Task 4: Captured-Screen Preview Media Fallback

**Files:**
- Modify: `src/objectStoreDb.ts`
- Modify: `src/objectStoreDb.test.ts`

- [ ] **Step 1: Write a failing fallback lookup test**

Update the preview lookup test to assert its SQL:

```ts
assert.match(captured!.sql, /DISTINCT ON \(a\.id, i\.id\)/);
assert.match(captured!.sql, /api\.rank IS NULL/);
assert.match(captured!.sql, /ROW_NUMBER\(\) OVER/);
assert.match(captured!.sql, /preview_rank = \$2/);
assert.match(captured!.sql, /so\.access_class IN \('protected', 'public-preview'\)/);
```

Retain rank validation tests for 0 and 4.

- [ ] **Step 2: Run the object-store test and verify RED**

Run:

```bash
npx tsx --test --test-name-pattern "published preview|preview lookup" src/objectStoreDb.test.ts
```

Expected: FAIL because the query requires an `app_preview_images` row.

- [ ] **Step 3: Implement curated-or-captured rank resolution**

Replace the inner-join-only query in `publishedPreviewObject()` with CTEs that:

1. Resolve latest published versions with
   `DISTINCT ON (app_id, platform)`.
2. Select published screen images for the requested app.
3. Left join `app_preview_images`.
4. Deduplicate by app and image ID.
5. Rank curated rows first by curated rank, then fallback rows by capture time
   and image ID.
6. Join the ranked image to `stored_objects` through the thumbnail object and
   select `preview_rank = $2`.

Keep the existing `protected` and `public-preview` access classes and rank
validation.

- [ ] **Step 4: Run the object-store test and verify GREEN**

Run:

```bash
npx tsx --test --test-name-pattern "published preview|preview lookup" src/objectStoreDb.test.ts
```

Expected: focused object-store tests PASS.

- [ ] **Step 5: Commit the media fallback**

```bash
git add src/objectStoreDb.ts src/objectStoreDb.test.ts
git commit -m "fix: serve captured public App previews"
```

### Task 5: Set-Based Catalog Stats

**Files:**
- Modify: `src/db.ts`
- Create: `src/catalogStats.test.ts`

- [ ] **Step 1: Write the failing stats SQL test**

Create `src/catalogStats.test.ts`:

```ts
test("counts the latest published app-platform versions without a correlated lookup", async () => {
  let captured = "";
  const runQuery = async (sql: string) => {
    captured = sql;
    return { rows: [{ apps: 1192, screens: 120000, ui_elements: 0 }] };
  };

  assert.deepEqual(await catalogStats(runQuery as never), {
    apps: 1192,
    screens: 120000,
    uiElements: 0,
  });
  assert.match(captured, /DISTINCT ON \(av\.app_id, av\.platform\)/);
  assert.doesNotMatch(captured, /SELECT MAX\(latest\.version_number\)/);
});
```

- [ ] **Step 2: Run the focused stats test and verify RED**

Run:

```bash
npx tsx --test src/catalogStats.test.ts
```

Expected: FAIL because `catalogStats()` does not accept an injected query and
still contains the correlated lookup.

- [ ] **Step 3: Rewrite the stats query**

Change the signature to accept the existing DB query shape:

```ts
export async function catalogStats(
  runQuery: typeof query = query,
): Promise<CatalogStats> {
  const res = await runQuery<{ apps: number; screens: number; ui_elements: number }>(
    `WITH latest AS MATERIALIZED (
       SELECT DISTINCT ON (av.app_id, av.platform) av.id AS version_id, av.app_id
       FROM app_versions av
       WHERE av.status = 'published'
       ORDER BY av.app_id, av.platform, av.version_number DESC
     )
     SELECT COUNT(DISTINCT latest.app_id)::int AS apps,
       COUNT(*) FILTER (WHERE i.kind = 'screen')::int AS screens,
       COUNT(*) FILTER (WHERE i.kind = 'ui_element')::int AS ui_elements
     FROM latest
     LEFT JOIN version_images vi ON vi.version_id = latest.version_id
     LEFT JOIN images i ON i.id = vi.image_id`,
  );
```

Keep the existing zero defaults in the return value.

- [ ] **Step 4: Run the focused stats test and verify GREEN**

Run:

```bash
npx tsx --test src/catalogStats.test.ts
```

Expected: stats SQL test PASS.

- [ ] **Step 5: Commit the stats optimization**

```bash
git add src/db.ts src/catalogStats.test.ts
git commit -m "perf: optimize public catalog stats"
```

### Task 6: Integrated Verification and Live Repair

**Files:**
- Verify: `src/publicCatalogStore.ts`
- Verify: `src/gallery.ts`
- Verify: `src/objectStoreDb.ts`
- Verify: `src/db.ts`
- Verify: `services/api/src/app.ts`

- [ ] **Step 1: Run focused backend tests**

```bash
npx tsx --test \
  src/publicCatalogStore.test.ts \
  src/gallery.test.ts \
  src/objectStoreDb.test.ts \
  src/catalogStats.test.ts \
  services/api/src/app.test.ts
```

Expected: all selected tests PASS with zero failures.

- [ ] **Step 2: Run frontend boundary tests**

```bash
npx tsx --test \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/publicAppsBoundary.test.ts
```

Expected: all Apps pagination, public-boundary, and discovery tests PASS.

- [ ] **Step 3: Run type and build verification**

```bash
npm run typecheck
npm run build
git diff --check
```

If `package.json` has no `typecheck` script, run:

```bash
npx tsc --noEmit
```

Expected: TypeScript and Vite build exit 0. The existing large-chunk advisory is
non-fatal.

- [ ] **Step 4: Rebuild the API container**

Resolve the Compose service from the current checkout:

```bash
docker compose config --services
docker compose up -d --build api
docker compose ps api
```

Expected: the API service is running and port 3010 responds.

- [ ] **Step 5: Verify live API latency and pagination**

```bash
curl -sS --max-time 30 \
  -w '\nstatus=%{http_code} time=%{time_total}s\n' \
  'http://127.0.0.1:3010/catalog?limit=3'

curl -sS --max-time 30 \
  -w '\nstatus=%{http_code} time=%{time_total}s\n' \
  'http://127.0.0.1:3010/catalog/stats'
```

Parse the first response, request its `nextCursor`, and prove the second page
contains different app IDs.

Expected: both endpoints return 200 within 30 seconds; first and second catalog
pages each contain at most three apps.

- [ ] **Step 6: Verify the real Apps screen**

Open `http://127.0.0.1:5173/apps` in the browser. Confirm:

- The loading state resolves into app cards.
- There is no `/api/catalog` 500 or 502.
- The browser console has no catalog error.
- Scrolling near the sentinel requests the next cursor page rather than
  refetching the full catalog.
- Hovering a taxonomy value with a loaded matching app shows the GSAP preview.

- [ ] **Step 7: Commit any final integration adjustments**

Stage only files named in this plan:

```bash
git add \
  src/publicCatalogStore.ts \
  src/publicCatalogStore.test.ts \
  src/gallery.ts \
  src/gallery.test.ts \
  src/objectStoreDb.ts \
  src/objectStoreDb.test.ts \
  src/db.ts \
  src/catalogStats.test.ts \
  services/api/src/app.ts \
  services/api/src/app.test.ts
git commit -m "fix: load the published Apps catalog efficiently"
```

Skip the commit when the working tree has no uncommitted changes from this
plan.

- [ ] **Step 8: Push the current main branch**

```bash
git push origin main
```

Expected: `main` is synchronized with `origin/main`; unrelated dirty UI files
remain unstaged.
