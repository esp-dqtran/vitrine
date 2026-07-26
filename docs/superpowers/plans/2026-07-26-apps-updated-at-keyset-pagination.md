# Apps Updated-At Keyset Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Apps infinite scroll globally ordered by Updated At, use stable opaque keyset cursors, and render App-card skeletons while pages load.

**Architecture:** PostgreSQL selects the next 24 app identities by indexed newest-screen timestamps before running bounded summary/preview work. Both catalog endpoints return that server order and an opaque snapshot cursor; the React client appends unique pages without re-sorting the default Latest view. Initial and load-more states use a non-interactive skeleton matching the existing shared discovery card.

**Tech Stack:** PostgreSQL migrations and keyset SQL, Express 5, TypeScript, React 19, Node test runner, React static rendering, Vite.

**Repository constraints:** Work directly on `main`, preserve every unrelated dirty-worktree change, do not create a worktree or branch, and do not commit or push unless the user explicitly requests it.

---

## File map

- Create `src/catalogCursor.ts`: versioned opaque Updated At cursor codec and validation.
- Create `src/catalogCursor.test.ts`: cursor round-trip and invalid-input coverage.
- Create `migrations/0031_apps_updated_pagination_indexes.sql`: additive latest-screen lookup indexes.
- Create `src/catalogPaginationIndexes.test.ts`: migration shape regression coverage.
- Modify `src/publicCatalogStore.ts`: select public app identities by published Updated At keyset and return stable order.
- Modify `src/publicCatalogStore.test.ts`: public ordering, cursor, snapshot, and query-shape coverage.
- Modify `src/db.ts`: select admin app identities by Updated At keyset before bounded page aggregation.
- Modify `src/adminAppPageQuery.test.ts`: admin keyset/query-shape coverage.
- Modify `src/gallery.ts`: expose public `lastCapturedAt` and preserve selected page order.
- Modify `src/gallery.test.ts`: public and admin Updated At response coverage.
- Modify `services/api/src/app.ts`: validate catalog cursors and keep the existing endpoint shapes.
- Modify `services/api/src/app.test.ts`: route defaults, cursor forwarding, and invalid-cursor coverage.
- Modify `src/vitrine/useApps.ts`: append unique server-ordered pages, reject stale responses, and split load-more errors.
- Create `src/vitrine/useApps.test.ts`: pure page-merge regression coverage.
- Modify `src/vitrine/appsDiscovery.ts`: preserve server order for the default Latest view.
- Modify `src/vitrine/AppsDiscovery.test.tsx`: default-order and skeleton integration coverage.
- Create `src/vitrine/components/AppCardSkeleton.tsx`: card-shaped, non-interactive loading placeholder.
- Create `src/vitrine/AppCardSkeleton.test.tsx`: skeleton structure and accessibility coverage.
- Modify `src/vitrine/components/AppsDiscoveryPage.tsx`: initial/load-more skeleton rendering and retry state.
- Modify `src/vitrine/App.tsx`: earlier viewport prefetch and load-more retry wiring.
- Modify `src/vitrine/App.boundary.test.ts`: viewport margin, retry, and zero-`GET /api/jobs` boundaries.
- Modify `src/vitrine/styles.css`: responsive skeleton geometry and reduced-motion behavior.

Files already dirty must be patched only at the named seams. Do not replace whole files or reformat unrelated sections.

### Task 1: Add the opaque Updated At cursor codec

**Files:**
- Create: `src/catalogCursor.test.ts`
- Create: `src/catalogCursor.ts`

- [ ] **Step 1: Write failing cursor tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogCursorError,
  decodeUpdatedCatalogCursor,
  encodeUpdatedCatalogCursor,
} from "./catalogCursor.ts";

const cursor = {
  v: 1 as const,
  sort: "updated" as const,
  snapshotAt: "2026-07-26T04:00:00.000Z",
  updatedAt: "2026-07-26T03:14:54.618Z",
  appId: 123,
};

test("round-trips a versioned Updated At cursor", () => {
  assert.deepEqual(decodeUpdatedCatalogCursor(encodeUpdatedCatalogCursor(cursor)), cursor);
});

test("rejects malformed, mismatched, and non-canonical cursor values", () => {
  for (const value of [
    "***",
    "AQ",
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, v: 2 })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, sort: "popular" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, appId: 0 })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, updatedAt: "yesterday" })).toString("base64url"),
  ]) {
    assert.throws(() => decodeUpdatedCatalogCursor(value), CatalogCursorError);
  }
});
```

- [ ] **Step 2: Run the cursor tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/catalogCursor.test.ts
```

Expected: FAIL because `src/catalogCursor.ts` does not exist.

- [ ] **Step 3: Implement the minimal cursor codec**

```ts
export interface UpdatedCatalogCursor {
  v: 1;
  sort: "updated";
  snapshotAt: string;
  updatedAt: string;
  appId: number;
}

export class CatalogCursorError extends RangeError {
  constructor(message = "invalid catalog cursor") {
    super(message);
    this.name = "CatalogCursorError";
  }
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function encodeUpdatedCatalogCursor(cursor: UpdatedCatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeUpdatedCatalogCursor(value: string): UpdatedCatalogCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new CatalogCursorError();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new CatalogCursorError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new CatalogCursorError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new CatalogCursorError();
  const item = parsed as Record<string, unknown>;
  if (
    item.v !== 1
    || item.sort !== "updated"
    || !canonicalIso(item.snapshotAt)
    || !canonicalIso(item.updatedAt)
    || !Number.isSafeInteger(item.appId)
    || Number(item.appId) < 1
  ) throw new CatalogCursorError();
  return item as unknown as UpdatedCatalogCursor;
}
```

- [ ] **Step 4: Run the cursor tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/catalogCursor.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Checkpoint without committing**

Run:

```bash
git diff --check -- src/catalogCursor.ts src/catalogCursor.test.ts
```

Expected: exit 0. Do not stage or commit.

### Task 2: Add latest-screen lookup indexes

**Files:**
- Create: `migrations/0031_apps_updated_pagination_indexes.sql`
- Create: `src/catalogPaginationIndexes.test.ts`

- [ ] **Step 1: Write the failing migration-shape test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("indexes the newest admin and published screen lookup paths", async () => {
  const migration = await readFile(
    new URL("../migrations/0031_apps_updated_pagination_indexes.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS images_screen_platform_created_idx[\s\S]*images\s*\(platform_id,\s*created_at DESC,\s*id DESC\)[\s\S]*WHERE kind = 'screen'/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS version_images_version_captured_idx[\s\S]*version_images\s*\(version_id,\s*captured_at DESC,\s*image_id DESC\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS app_versions_published_snapshot_idx[\s\S]*app_versions\s*\(app_id,\s*platform,\s*published_at DESC,\s*version_number DESC\)[\s\S]*WHERE published_at IS NOT NULL/,
  );
});
```

- [ ] **Step 2: Run the migration test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/catalogPaginationIndexes.test.ts
```

Expected: FAIL because migration 0031 does not exist.

- [ ] **Step 3: Add the additive migration**

```sql
CREATE INDEX IF NOT EXISTS images_screen_platform_created_idx
  ON images (platform_id, created_at DESC, id DESC)
  WHERE kind = 'screen';

CREATE INDEX IF NOT EXISTS version_images_version_captured_idx
  ON version_images (version_id, captured_at DESC, image_id DESC);

CREATE INDEX IF NOT EXISTS app_versions_published_snapshot_idx
  ON app_versions (app_id, platform, published_at DESC, version_number DESC)
  WHERE published_at IS NOT NULL;
```

- [ ] **Step 4: Run the migration test and migration checker**

Run:

```bash
node --experimental-strip-types --test src/catalogPaginationIndexes.test.ts
node --experimental-strip-types --input-type=module -e "import { discoverMigrations } from './src/migrations.ts'; const files = await discoverMigrations(); if (files.at(-1)?.version !== 31) process.exit(1); console.log(files.at(-1)?.filename)"
```

Expected: the focused test passes and the read-only migration discovery prints `0031_apps_updated_pagination_indexes.sql`. Do not run `npm run db:check`: it connects to the configured `DATABASE_URL`. Do not apply migrations to the configured Vitrine database during local verification.

- [ ] **Step 5: Checkpoint without committing**

Run:

```bash
git diff --check -- migrations/0031_apps_updated_pagination_indexes.sql src/catalogPaginationIndexes.test.ts
```

Expected: exit 0.

### Task 3: Convert the member catalog to Updated At keyset selection

**Files:**
- Modify: `src/publicCatalogStore.test.ts`
- Modify: `src/publicCatalogStore.ts`
- Modify: `src/gallery.test.ts`
- Modify: `src/gallery.ts`

- [ ] **Step 1: Add failing public page-selection tests**

Extend `src/publicCatalogStore.test.ts` with a first query returning `limit + 1` identity rows:

```ts
const selected = [
  { app_id: 91, app: "alltrails", updated_at: "2026-07-26T03:14:54.618Z" },
  { app_id: 42, app: "ipsy", updated_at: "2026-07-26T03:03:57.624Z" },
  { app_id: 17, app: "tubi", updated_at: "2026-07-26T02:57:07.457Z" },
];

const page = await publishedCatalogPage(
  { limit: 2, now: new Date("2026-07-26T04:00:00.000Z") },
  query,
);

assert.deepEqual(page.apps.map(({ app }) => app), ["alltrails", "ipsy"]);
assert.equal(page.apps[0]?.last_captured_at, selected[0]?.updated_at);
assert.ok(page.nextCursor);
assert.match(calls[0]?.sql ?? "", /ORDER BY updated_at DESC,\s*app_id DESC/);
assert.match(calls[0]?.sql ?? "", /JOIN LATERAL/);
assert.match(calls[0]?.sql ?? "", /av\.published_at <= \$1::timestamptz/);
assert.match(calls[0]?.sql ?? "", /vi\.captured_at <= \$1::timestamptz/);
assert.doesNotMatch(calls[0]?.sql ?? "", /av\.status = 'published'/);
assert.doesNotMatch(calls[0]?.sql ?? "", /GROUP BY[\s\S]*MAX\(i\.created_at\)/);
```

Decode `page.nextCursor` and assert:

```ts
assert.deepEqual(decodeUpdatedCatalogCursor(page.nextCursor!), {
  v: 1,
  sort: "updated",
  snapshotAt: "2026-07-26T04:00:00.000Z",
  updatedAt: "2026-07-26T03:03:57.624Z",
  appId: 42,
});
```

Add a second-page test that passes that cursor and asserts the first SQL parameter set contains the same snapshot plus the prior `updatedAt` and `appId`.

- [ ] **Step 2: Run public store tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/publicCatalogStore.test.ts
```

Expected: FAIL because the store still selects and cursors by app name.

- [ ] **Step 3: Replace the name selector with an indexed published selector**

Update the store input and records:

```ts
export interface PublishedCatalogAppRecord {
  app_id: number;
  app: string;
  // existing metadata fields
  last_captured_at: string;
}

export async function publishedCatalogPage(
  input: { cursor?: string; limit?: number; now?: Date } = {},
  runQuery: DatabaseQuery = query,
): Promise<PublishedCatalogPageRecord> {
```

Decode or initialize the window:

```ts
const decoded = input.cursor ? decodeUpdatedCatalogCursor(input.cursor) : undefined;
const snapshotAt = decoded?.snapshotAt ?? (input.now ?? new Date()).toISOString();
const afterUpdatedAt = decoded?.updatedAt ?? null;
const afterAppId = decoded?.appId ?? null;
```

The selector SQL must follow this shape:

```sql
WITH latest AS MATERIALIZED (
  SELECT DISTINCT ON (av.app_id, av.platform)
    av.id AS version_id, av.app_id, av.platform, av.screen_count
  FROM app_versions av
  WHERE av.published_at IS NOT NULL
    AND av.published_at <= $1::timestamptz
  ORDER BY av.app_id, av.platform, av.published_at DESC, av.version_number DESC
),
app_updates AS (
  SELECT latest.app_id,
    MAX(newest.captured_at) AS updated_at
  FROM latest
  JOIN LATERAL (
    SELECT vi.captured_at
    FROM version_images vi
    JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
    WHERE vi.version_id = latest.version_id
      AND vi.captured_at <= $1::timestamptz
    ORDER BY vi.captured_at DESC, vi.image_id DESC
    LIMIT 1
  ) newest ON true
  GROUP BY latest.app_id
),
eligible AS (
  SELECT a.id AS app_id, a.name AS app, app_updates.updated_at
  FROM app_updates
  JOIN apps a ON a.id = app_updates.app_id
  WHERE (
      $2::timestamptz IS NULL
      OR (app_updates.updated_at, a.id) < ($2::timestamptz, $3::integer)
    )
)
SELECT app_id, app, updated_at
FROM eligible
ORDER BY updated_at DESC, app_id DESC
LIMIT $4
```

Pass `[snapshotAt, afterUpdatedAt, afterAppId, limit + 1]`.

Use only the first `limit` identity rows for metadata and preview queries. Every later `latest` CTE must reconstruct the same version set with `published_at <= snapshotAt`, and every `version_images` read must use `captured_at <= snapshotAt`; do not rerun against only the current `status = 'published'` rows. Preserve identity order in JavaScript with a map rather than relying on a later SQL `ORDER BY app.name`. Build `nextCursor` from the last returned identity when the extra row exists.

Use `latest.screen_count` for published totals and return the selected identity's timestamp as `last_captured_at`.

- [ ] **Step 4: Add failing public gallery response coverage**

In `src/gallery.test.ts`, build a published page whose apps are already in Updated At order and assert:

```ts
const result = buildPublishedCatalogPage(page);
assert.deepEqual(result.apps.map(({ id }) => id), ["alltrails", "ipsy"]);
assert.equal(result.apps[0]?.lastCapturedAt, "2026-07-26T03:14:54.618Z");
```

- [ ] **Step 5: Populate public `lastCapturedAt`**

In `buildPublishedCatalogPage`, add:

```ts
lastCapturedAt: row.last_captured_at,
```

Do not sort `page.apps` in the builder.

- [ ] **Step 6: Run public store and gallery tests**

Run:

```bash
node --experimental-strip-types --test src/catalogCursor.test.ts src/publicCatalogStore.test.ts src/gallery.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 7: Checkpoint without committing**

Run:

```bash
git diff --check -- src/publicCatalogStore.ts src/publicCatalogStore.test.ts src/gallery.ts src/gallery.test.ts
```

Expected: exit 0.

### Task 4: Convert the admin catalog to Updated At keyset selection

**Files:**
- Modify: `src/adminAppPageQuery.test.ts`
- Modify: `src/db.ts`

- [ ] **Step 1: Add failing admin query-shape tests**

Extend `src/adminAppPageQuery.test.ts`:

```ts
test("admin app page selects identities by indexed Updated At keyset", () => {
  assert.match(adminAppPageSource, /JOIN LATERAL/);
  assert.match(adminAppPageSource, /i\.created_at <= \$1::timestamptz/);
  assert.match(adminAppPageSource, /ORDER BY updated_at DESC,\s*app_id DESC/);
  assert.match(adminAppPageSource, /\(updated_at,\s*app_id\)\s*<\s*\(\$2::timestamptz,\s*\$3::integer\)/);
  assert.match(adminAppPageSource, /encodeUpdatedCatalogCursor/);
  assert.doesNotMatch(adminAppPageSource, /WHERE \(\$1::text IS NULL OR name > \$1\)/);
});

test("admin app page aggregates only the selected page identities", () => {
  assert.ok(adminAppPageSource.indexOf("candidate_apps AS") < adminAppPageSource.indexOf("page_image_facts AS MATERIALIZED"));
  assert.match(adminAppPageSource, /JOIN page_apps pa ON pa\.app_id = p\.app_id/);
  assert.match(adminAppPageSource, /page_image_facts AS MATERIALIZED[\s\S]*i\.created_at <= \$1::timestamptz/);
});
```

- [ ] **Step 2: Run the admin query test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/adminAppPageQuery.test.ts
```

Expected: the new Updated At assertions fail.

- [ ] **Step 3: Change `adminAppPage` to an input object**

Use:

```ts
export async function adminAppPage(input: {
  cursor?: string;
  limit?: number;
  now?: Date;
} = {}): Promise<AdminAppPage>
```

Decode the cursor with the shared codec, bound `limit` to 1–48, and create `snapshotAt` exactly as in the public store.

- [ ] **Step 4: Add indexed admin identity selection**

Replace the alphabetical `eligible_apps`/`candidate_apps` selector with:

```sql
WITH eligible_apps AS (
  SELECT a.id AS app_id, a.name, a.icon_url, a.category,
    a.display_name, a.website_url, a.accent_color,
    newest.updated_at,
    COUNT(*) OVER()::integer AS total_apps
  FROM apps a
  JOIN LATERAL (
    SELECT latest.created_at AS updated_at
    FROM platforms p
    JOIN LATERAL (
      SELECT i.created_at
      FROM images i
      WHERE i.platform_id = p.id AND i.kind = 'screen'
        AND i.created_at <= $1::timestamptz
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT 1
    ) latest ON true
    WHERE p.app_id = a.id
    ORDER BY latest.created_at DESC
    LIMIT 1
  ) newest ON true
),
candidate_apps AS (
  SELECT *
  FROM eligible_apps
  WHERE (
    $2::timestamptz IS NULL
    OR (updated_at, app_id) < ($2::timestamptz, $3::integer)
  )
  ORDER BY updated_at DESC, app_id DESC
  LIMIT ($4::integer + 1)
),
page_apps AS (
  SELECT *
  FROM candidate_apps
  ORDER BY updated_at DESC, app_id DESC
  LIMIT $4
)
```

Keep the existing `page_image_facts`, counts, platforms, and preview CTEs after `page_apps`, but join via `page_apps.app_id` and add `i.created_at <= $1::timestamptz` to `page_image_facts` so counts, previews, and `last_captured_at` describe the same snapshot. Order the final rows by:

```sql
ORDER BY pa.updated_at DESC, pa.app_id DESC, pi.preview_rank
```

Return `page_app_id` and `page_updated_at` on each row so the next cursor is created from the last distinct page app. Use `[snapshotAt, afterUpdatedAt, afterAppId, limit]`.

- [ ] **Step 5: Run admin query tests**

Run:

```bash
node --experimental-strip-types --test src/adminAppPageQuery.test.ts
```

Expected: all admin query-shape tests pass.

- [ ] **Step 6: Checkpoint without committing**

Run:

```bash
git diff --check -- src/db.ts src/adminAppPageQuery.test.ts
```

Expected: exit 0.

### Task 5: Enforce cursor behavior at the HTTP boundary

**Files:**
- Modify: `services/api/src/app.test.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Add failing route tests**

For `/catalog`, capture the object passed to `publishedCatalogPage` and assert omission defaults to Updated At:

```ts
assert.deepEqual(input, { cursor: undefined, limit: 3 });
```

Add invalid-cursor coverage:

```ts
assert.equal((await fetch(`${base}/catalog?cursor=***`)).status, 400);
assert.deepEqual(await response.json(), { error: "invalid catalog cursor" });
```

For admin `/apps`, update the dependency stub to accept one input object and assert:

```ts
assert.deepEqual(input, { cursor: validCursor, limit: 12 });
```

Also assert invalid admin cursors return `400`.

- [ ] **Step 2: Run the targeted API tests and verify RED**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: failures around the old positional admin arguments and unhandled cursor errors.

- [ ] **Step 3: Update both routes**

Use object inputs:

```ts
const page = await deps.publishedCatalogPage({ cursor, limit });
```

and:

```ts
const page = await deps.adminAppPage({ cursor, limit });
```

Wrap only cursor/page parsing in:

```ts
try {
  // page call and response
} catch (error) {
  if (error instanceof CatalogCursorError) {
    res.status(400).json({ error: error.message });
    return;
  }
  throw error;
}
```

Do not change authentication, caching, or `/jobs` routes.

- [ ] **Step 4: Run API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: all API tests pass.

- [ ] **Step 5: Checkpoint without committing**

Run:

```bash
git diff --check -- services/api/src/app.ts services/api/src/app.test.ts
```

Expected: exit 0.

### Task 6: Preserve server order and safely merge Apps pages

**Files:**
- Create: `src/vitrine/useApps.test.ts`
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/appsDiscovery.ts`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write a failing unique-page merge test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { appendUniqueApps } from "./useApps.ts";

test("appends server-ordered pages without duplicates or reordering", () => {
  const current = [{ id: "tubi" }, { id: "ipsy" }];
  const next = [{ id: "ipsy" }, { id: "zip" }];
  assert.deepEqual(
    appendUniqueApps(current as never[], next as never[]).map(({ id }) => id),
    ["tubi", "ipsy", "zip"],
  );
});
```

- [ ] **Step 2: Add a failing default-order discovery test**

In `src/vitrine/AppsDiscovery.test.tsx`, pass apps whose timestamps are intentionally out of order and assert `filterAndSortApps(..., { sort: "latest" })` preserves the supplied server order. Keep the existing Most popular assertion sorting by `totalScreens`.

- [ ] **Step 3: Run the frontend unit tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useApps.test.ts
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: missing helper and old Latest client-sort assertions fail.

- [ ] **Step 4: Implement unique append and synchronous overlap protection**

Add:

```ts
export function appendUniqueApps(current: App[], next: App[]): App[] {
  const seen = new Set(current.map(({ id }) => id));
  return [...current, ...next.filter(({ id }) => !seen.has(id))];
}
```

Use `useRef` for a synchronous `loadingMoreRef` and a request-generation number. A page response may update apps/cursor only when its generation still matches. Reset `loadMoreError` before retrying and always clear the synchronous lock in `finally`.

Split errors:

```ts
const [error, setError] = useState<string | null>(null);
const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
```

First-page failures set `error`; later-page failures set `loadMoreError` and preserve loaded apps.

- [ ] **Step 5: Preserve server order for Latest**

In `filterAndSortApps`, filter first and then:

```ts
if (options.sort === "latest") return filtered;
return filtered.sort((a, b) => b.app.totalScreens - a.app.totalScreens || a.index - b.index);
```

Do not parse or compare `lastCapturedAt` in the default branch because the API already owns that ordering.

- [ ] **Step 6: Run the focused frontend tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useApps.test.ts
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: focused tests pass.

- [ ] **Step 7: Checkpoint without committing**

Run:

```bash
git diff --check -- src/vitrine/useApps.ts src/vitrine/useApps.test.ts src/vitrine/appsDiscovery.ts src/vitrine/AppsDiscovery.test.tsx
```

Expected: exit 0.

### Task 7: Add App-card skeletons and earlier viewport prefetch

**Files:**
- Create: `src/vitrine/components/AppCardSkeleton.tsx`
- Create: `src/vitrine/AppCardSkeleton.test.tsx`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write the failing skeleton component test**

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppCardSkeleton } from "./components/AppCardSkeleton.tsx";

test("matches App card geometry without becoming interactive", () => {
  const html = renderToStaticMarkup(<AppCardSkeleton index={0} />);
  assert.match(html, /data-app-card-skeleton="true"/);
  assert.match(html, /app-card-skeleton__media/);
  assert.match(html, /app-card-skeleton__logo/);
  assert.match(html, /app-card-skeleton__title/);
  assert.match(html, /app-card-skeleton__description/);
  assert.match(html, /app-card-skeleton__metadata/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /tabindex|role="link"|<button|<a/);
});
```

- [ ] **Step 2: Add failing page integration assertions**

Render `AppsDiscoveryPage` with `apps={null}` and assert six skeleton markers. Render with apps plus `loadingMore` and assert three skeleton markers, one `role="status"` labelled `Loading more Apps`, and no `Spinner` markup.

Update `App.boundary.test.ts` to require:

```ts
assert.match(appSource, /rootMargin: '900px 0px'/);
assert.doesNotMatch(pageSource, /<Spinner size="sm"/);
assert.doesNotMatch(`${appSource}\n${pageSource}`, /fetch\(\s*['"]\/api\/jobs['"]/);
```

- [ ] **Step 3: Run skeleton tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppCardSkeleton.test.tsx src/vitrine/AppsDiscovery.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: missing skeleton component, spinner, and old 600px margin failures.

- [ ] **Step 4: Implement `AppCardSkeleton`**

Use the shared Skeleton primitive:

```tsx
import { Skeleton } from "@astryxdesign/core";

export function AppCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <article
      className="discovery-card app-discovery-card app-card-skeleton"
      data-app-card-skeleton="true"
      aria-hidden="true"
    >
      <span className="discovery-card__media app-discovery-card__media app-card-skeleton__media">
        <Skeleton width="100%" height="100%" radius="rounded" index={index} />
      </span>
      <span className="discovery-card__identity app-discovery-card__identity">
        <span className="discovery-card__logo app-discovery-card__logo app-card-skeleton__logo">
          <Skeleton width="100%" height="100%" radius="rounded" index={index} />
        </span>
        <span className="discovery-card__copy app-discovery-card__copy">
          <span className="app-card-skeleton__title"><Skeleton width="44%" height={16} radius={2} index={index} /></span>
          <span className="app-card-skeleton__description"><Skeleton width="76%" height={14} radius={2} index={index} /></span>
          <span className="app-card-skeleton__metadata"><Skeleton width="58%" height={12} radius={2} index={index} /></span>
        </span>
      </span>
    </article>
  );
}
```

- [ ] **Step 5: Replace initial placeholders and the load-more spinner**

Initial state:

```tsx
<div className="reference-discovery__grid apps-discovery__grid apps-discovery__loading" role="status" aria-label="Loading Apps">
  {Array.from({ length: 6 }, (_, index) => <AppCardSkeleton key={index} index={index} />)}
</div>
```

Loaded grid:

```tsx
{visibleApps.map(/* existing AppCard */)}
{props.loadingMore
  ? Array.from({ length: 3 }, (_, index) => (
      <AppCardSkeleton key={`loading-${index}`} index={index} />
    ))
  : null}
```

After the grid, render:

```tsx
{props.loadingMore ? <div className="visually-hidden" role="status">Loading more Apps</div> : null}
```

Pass `loadMoreError` and an `onRetryLoadMore` callback so later failures keep the grid and show a compact retry action.

- [ ] **Step 6: Add skeleton CSS and increase the observer margin**

Use:

```css
.app-card-skeleton {
  cursor: default;
  pointer-events: none;
}

.app-card-skeleton__media {
  overflow: hidden;
}

.app-card-skeleton__title,
.app-card-skeleton__description,
.app-card-skeleton__metadata {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .app-card-skeleton *,
  .app-card-skeleton *::before,
  .app-card-skeleton *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

Reuse `.apps-discovery__grid` responsive rules rather than maintaining a second column definition. Change the observer to:

```ts
{ rootMargin: '900px 0px' }
```

- [ ] **Step 7: Run the focused skeleton and boundary tests**

Run:

```bash
npx tsx --test src/vitrine/AppCardSkeleton.test.tsx src/vitrine/AppsDiscovery.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: skeleton and observer assertions pass. If the existing unrelated Sites assertion in `App.boundary.test.ts` still fails from the dirty worktree, record it separately; the Apps assertions must pass.

- [ ] **Step 8: Checkpoint without committing**

Run:

```bash
git diff --check -- src/vitrine/components/AppCardSkeleton.tsx src/vitrine/AppCardSkeleton.test.tsx src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/AppsDiscovery.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts src/vitrine/styles.css
```

Expected: exit 0.

### Task 8: Verify behavior, performance, and scope

**Files:**
- Verify only; fix only defects introduced by Tasks 1–7.

- [ ] **Step 1: Run the complete focused regression set**

Run:

```bash
node --experimental-strip-types --test \
  src/catalogCursor.test.ts \
  src/catalogPaginationIndexes.test.ts \
  src/publicCatalogStore.test.ts \
  src/adminAppPageQuery.test.ts \
  src/gallery.test.ts \
  src/vitrine/useApps.test.ts \
  src/vitrine/App.boundary.test.ts \
  services/api/src/app.test.ts

npx tsx --test \
  src/vitrine/AppCard.test.tsx \
  src/vitrine/AppCardSkeleton.test.tsx \
  src/vitrine/AppsDiscovery.test.tsx
```

Expected: all task-specific assertions pass. Record unrelated dirty-worktree failures separately instead of changing their scope.

- [ ] **Step 2: Run static and build verification**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: TypeScript and build exit 0; the existing Vite large-chunk warning may remain.

- [ ] **Step 3: Run the full suite**

Run:

```bash
npm test
```

Expected: exit 0. If pre-existing dirty-worktree tests fail, capture the exact names and confirm the new focused tests remain green.

- [ ] **Step 4: Validate migration discovery without connecting to a database**

Run:

```bash
node --experimental-strip-types --input-type=module -e "import { discoverMigrations } from './src/migrations.ts'; const files = await discoverMigrations(); if (files.at(-1)?.version !== 31) process.exit(1); console.log(files.at(-1)?.filename)"
```

Expected: the contiguous migration sequence ends at `0031_apps_updated_pagination_indexes.sql`. Do not run `npm run db:check` because it reads the configured `DATABASE_URL`; do not run `db:migrate` or otherwise touch the configured Vitrine database without separate authorization.

- [ ] **Step 5: Verify the Apps page in the authenticated local browser**

Reload `/apps`, capture request timing, and verify:

1. The first 24 apps include current Updated At leaders across the alphabet.
2. Card timestamps are monotonically descending.
3. Scrolling near the sentinel emits exactly one `/api/apps?cursor=...` request.
4. Three skeleton cards are visible while that request is pending.
5. Appended cards remain below earlier Updated At cards.
6. Reload and scroll produce zero `GET /api/jobs` requests.

Use temporary browser network latency only for observing the skeleton, then restore normal conditions before finishing.

- [ ] **Step 6: Compare query plans only after index availability**

Do not apply migration 0031 automatically. If the user separately authorizes applying it to a disposable or named environment, run `EXPLAIN (ANALYZE, BUFFERS)` for the admin and member identity selectors and compare against the measured 7.35-second unindexed global aggregate.

Success criteria:

- no full historical image aggregate before selecting 24 apps;
- index-backed latest-screen lookup;
- stable keyset comparison;
- identity selection materially below the old aggregate time.

- [ ] **Step 7: Review the final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- \
  migrations/0031_apps_updated_pagination_indexes.sql \
  src/catalogCursor.ts \
  src/catalogCursor.test.ts \
  src/catalogPaginationIndexes.test.ts \
  src/publicCatalogStore.ts \
  src/publicCatalogStore.test.ts \
  src/db.ts \
  src/adminAppPageQuery.test.ts \
  src/gallery.ts \
  src/gallery.test.ts \
  services/api/src/app.ts \
  services/api/src/app.test.ts \
  src/vitrine/useApps.ts \
  src/vitrine/useApps.test.ts \
  src/vitrine/appsDiscovery.ts \
  src/vitrine/components/AppCardSkeleton.tsx \
  src/vitrine/AppCardSkeleton.test.tsx \
  src/vitrine/components/AppsDiscoveryPage.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/App.tsx \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/styles.css
```

Confirm that no unrelated dirty changes were reverted, staged, committed, or pushed.
