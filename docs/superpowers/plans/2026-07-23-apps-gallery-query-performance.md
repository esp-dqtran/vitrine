# Apps Gallery Query Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Apps gallery's repeated per-preview image scans with one page-scoped materialized fact set so cold and warm `/api/apps` requests perform bounded database work.

**Architecture:** Keep the existing `adminAppPage` interface and response contract. Rewrite only its SQL to select the app page first, materialize narrow screen facts once, aggregate app statistics and platforms from that relation, and fetch full image columns only for five preview identifiers per app.

**Tech Stack:** TypeScript, Node.js test runner, PostgreSQL CTEs/window functions, Express, authenticated in-app browser E2E.

---

### Task 1: Lock the query-shape and response contracts with failing tests

**Files:**
- Create: `src/adminAppPageQuery.test.ts`
- Modify: `src/db.test.ts:30-220`
- Test: `src/adminAppPageQuery.test.ts`
- Test: `src/db.test.ts`

- [ ] **Step 1: Add a structural regression test that rejects the correlated platform subquery**

Create `src/adminAppPageQuery.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const start = source.indexOf("export async function adminAppPage");
const end = source.indexOf("export async function appImages", start);
const adminAppPageSource = source.slice(start, end);

test("admin app page aggregates screen facts once per selected page", () => {
  assert.match(adminAppPageSource, /page_image_facts AS MATERIALIZED/);
  assert.match(adminAppPageSource, /app_platforms AS/);
  assert.doesNotMatch(adminAppPageSource, /WHERE p2\.app_id = ri\.app_id/);
});
```

- [ ] **Step 2: Extend the database integration fixture before changing production SQL**

Add `adminAppPage` to the destructured imports from `./db.ts` in `src/db.test.ts`. After the existing `scope-app` metadata assertions, add:

```ts
  const scopeGallery = await adminAppPage(undefined, 24);
  assert.equal(scopeGallery.total, 1);
  assert.equal(scopeGallery.nextCursor, null);
  assert.deepEqual(scopeGallery.images.map(({ id }) => id), [scopedWebImage, scopedIosImage]);
  assert.ok(scopeGallery.images.every(({ total_screens }) => total_screens === 2));
  assert.ok(scopeGallery.images.every(({ analyzed_screens }) => analyzed_screens === 2));
  assert.ok(scopeGallery.images.every(({ available_platforms }) =>
    JSON.stringify(available_platforms) === JSON.stringify(["web", "ios"])));
```

After the existing `airbnb` and `linear` image inserts, add:

```ts
  const firstGalleryPage = await adminAppPage(undefined, 1);
  assert.equal(firstGalleryPage.total, 2);
  assert.equal(firstGalleryPage.nextCursor, "airbnb");
  assert.deepEqual([...new Set(firstGalleryPage.images.map(({ app }) => app))], ["airbnb"]);

  const secondGalleryPage = await adminAppPage(firstGalleryPage.nextCursor ?? undefined, 1);
  assert.equal(secondGalleryPage.total, 2);
  assert.equal(secondGalleryPage.nextCursor, null);
  assert.deepEqual([...new Set(secondGalleryPage.images.map(({ app }) => app))], ["linear"]);
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/adminAppPageQuery.test.ts src/db.test.ts
```

Expected: `src/db.test.ts` passes its behavioral assertions, while `src/adminAppPageQuery.test.ts` fails because `page_image_facts AS MATERIALIZED` and `app_platforms AS` do not yet exist. This is the performance-regression failure that proves the test detects the old query shape.

### Task 2: Rewrite `adminAppPage` as a page-scoped set query

**Files:**
- Modify: `src/db.ts:493-558`
- Test: `src/adminAppPageQuery.test.ts`
- Test: `src/db.test.ts`

- [ ] **Step 1: Replace only the SQL passed to `query<AdminGalleryPageRow>`**

Keep the existing limit normalization and return mapping. Replace the template literal with:

```ts
    `WITH eligible_apps AS (
       SELECT a.id, a.name, a.icon_url, a.category,
              a.display_name, a.website_url, a.accent_color,
              COUNT(*) OVER()::integer AS total_apps
       FROM apps a
       WHERE EXISTS (
         SELECT 1
         FROM platforms p
         JOIN images i ON i.platform_id = p.id AND i.kind = 'screen'
         WHERE p.app_id = a.id
       )
     ), candidate_apps AS (
       SELECT *
       FROM eligible_apps
       WHERE ($1::text IS NULL OR name > $1)
       ORDER BY name
       LIMIT ($2::integer + 1)
     ), page_apps AS (
       SELECT * FROM candidate_apps ORDER BY name LIMIT $2
     ), page_image_facts AS MATERIALIZED (
       SELECT pa.id AS app_id, p.name AS platform, i.id AS image_id,
              i.created_at, (i.analysis IS NOT NULL) AS analyzed
       FROM page_apps pa
       JOIN platforms p ON p.app_id = pa.id
       JOIN images i ON i.platform_id = p.id AND i.kind = 'screen'
     ), app_counts AS (
       SELECT app_id, COUNT(*)::integer AS total_screens,
              COUNT(*) FILTER (WHERE analyzed)::integer AS analyzed_screens,
              MAX(created_at) AS last_captured_at
       FROM page_image_facts
       GROUP BY app_id
     ), app_platforms AS (
       SELECT app_id,
              ARRAY_AGG(platform ORDER BY
                CASE platform WHEN 'web' THEN 1 WHEN 'ios' THEN 2 WHEN 'android' THEN 3 ELSE 4 END,
                platform
              ) AS available_platforms
       FROM (
         SELECT DISTINCT app_id, platform FROM page_image_facts
       ) distinct_platforms
       GROUP BY app_id
     ), ranked_preview_ids AS (
       SELECT app_id, platform, image_id,
              ROW_NUMBER() OVER (
                PARTITION BY app_id ORDER BY created_at ASC, image_id ASC
              ) AS preview_rank
       FROM page_image_facts
     ), preview_ids AS (
       SELECT app_id, platform, image_id, preview_rank
       FROM ranked_preview_ids
       WHERE preview_rank <= 5
     )
     SELECT i.id, pa.name AS app, pi.platform, i.image_url, i.kind,
            i.description, i.analysis, pa.icon_url, pa.category,
            pa.display_name, pa.website_url, pa.accent_color,
            i.image_url AS capture_url, i.created_at AS captured_at,
            c.total_screens, c.analyzed_screens, c.last_captured_at,
            pa.total_apps, ap.available_platforms,
            ((SELECT COUNT(*) FROM candidate_apps) > $2)::boolean AS has_more
     FROM preview_ids pi
     JOIN page_apps pa ON pa.id = pi.app_id
     JOIN images i ON i.id = pi.image_id
     JOIN app_counts c ON c.app_id = pi.app_id
     JOIN app_platforms ap ON ap.app_id = pi.app_id
     ORDER BY pa.name, pi.preview_rank`,
```

- [ ] **Step 2: Run the focused tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 src/adminAppPageQuery.test.ts src/db.test.ts
```

Expected: both test files pass. The integration assertions prove the query preserves totals, cursor behavior, preview ordering, counts, and platform ordering.

- [ ] **Step 3: Check the focused diff**

Run:

```bash
git diff --check -- src/db.ts src/db.test.ts src/adminAppPageQuery.test.ts
git diff -- src/db.ts src/db.test.ts src/adminAppPageQuery.test.ts
```

Expected: no whitespace errors and no files outside the three listed paths.

- [ ] **Step 4: Commit the query rewrite without staging unrelated workspace changes**

Run:

```bash
git add src/db.ts src/db.test.ts src/adminAppPageQuery.test.ts
git commit -m "perf: bound apps gallery database work"
```

Expected: the commit contains only the gallery query and its regression coverage.

### Task 3: Verify the live query plan and decide against or for an index

**Files:**
- Inspect: `src/db.ts:493-570`
- Modify only if evidence requires it: `src/migrations.ts`
- Test only if a migration is required: `src/migrations.test.ts`

- [ ] **Step 1: Run `EXPLAIN (ANALYZE, BUFFERS)` against the configured Supabase database**

Use the API container's `DATABASE_URL` without printing it. Extract the production SQL from `src/db.ts`, prefix it with `EXPLAIN`, execute with `[null, 24]`, and report planning time, execution time, shared hit/read blocks, and repeated plan nodes.

Expected acceptance criteria:

```text
Execution time: < 300 ms warm
Shared hit + read blocks: <= 57,444 (60% below the 143,611 baseline)
No platform/image subplan with 120 loops
```

- [ ] **Step 2: Apply the index decision from the approved design**

If the plan meets all three acceptance criteria, add no index and record the evidence. If it misses the buffer target because screen rows are still read through `images_platform_image_url_uidx`, stop and present the exact plan evidence before adding a million-row index; index creation is outside this query-only implementation unless separately approved.

### Task 4: Run regression and authenticated E2E verification

**Files:**
- Verify: `src/db.ts`
- Verify: `src/db.test.ts`
- Verify: `src/adminAppPageQuery.test.ts`

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, the Vite production build succeeds, and `git diff --check` reports no errors. Preserve any existing build warning about chunk size unless a new error appears.

- [ ] **Step 2: Restart only the local API service with the committed query**

Run:

```bash
docker compose up -d --build api
docker compose ps api
```

Expected: `astryx-api-1` becomes healthy on port 3010. Do not restart crawler or import workers.

- [ ] **Step 3: Measure five authenticated API requests**

Log in using the API container's configured admin credentials without printing them, then request `/apps?limit=24` five times and record status, TTFB, total duration, byte size, returned app count, total, and cursor.

Expected acceptance criteria:

```text
First observed request: < 1,500 ms
Repeated requests: < 500 ms
HTTP status: 200
Apps returned: 24
Total: 1179 (or the current live total if imports changed it)
```

- [ ] **Step 4: Repeat the exact Apps browser flow**

Open the authenticated Apps page, wait for the first 24 cards, open one app detail, and inspect the network log. Confirm the Apps screen made one initial `/api/apps?limit=24` request and zero `GET /api/jobs` requests.

Expected: Apps renders successfully, gallery metadata and previews match the API response, and the no-polling boundary remains intact.

- [ ] **Step 5: Report results and preserve unrelated work**

Run:

```bash
git status --short
git show --stat --oneline HEAD
```

Expected: the performance commit contains only `src/db.ts`, `src/db.test.ts`, and `src/adminAppPageQuery.test.ts`; pre-existing Apps/Home edits and `docs/design-extracts/` remain uncommitted and untouched.
