# App Category Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `apps.category` string with first-class Categories and an App-to-Category many-to-many relationship, including import persistence, catalog/search consumers, and a minimal admin management surface.

**Architecture:** Migration `0033` expands the schema, backfills the current 28 values, and keeps `apps.category` as a temporary rollback field. A focused `categoryStore` owns Category CRUD and App assignments; all application reads return ordered `Category[]` values and never infer a primary Category. The legacy column is removed only in a later migration after production verification, not as part of this implementation.

**Tech Stack:** PostgreSQL migrations, Node.js/TypeScript, Express 5, React 19, `@astryxdesign/core`, Node test runner, Vite.

---

## Project constraints

- Work directly on `main`; do not create a branch or worktree.
- Preserve the existing dirty worktree.
- Do not commit or push unless the user explicitly requests it.
- Do not run `npm run db:migrate` against the configured database without a separate explicit approval.
- Do not add confidence, evidence, source, status, primary, ordering, hierarchy, aliases, merge state, or AI metadata to either Category table.

## File map

### Create

- `migrations/0033_app_categories.sql` — create and backfill `categories` and `app_categories`; enqueue search updates when relationships change.
- `src/categoryStore.ts` — shared Category types, validation, CRUD, assignment, and name-based ingestion helpers.
- `src/categoryStore.test.ts` — store SQL contracts, validation, conflict behavior, and relationship tests.
- `src/vitrine/categoriesApi.ts` — public Category discovery and admin Category-management HTTP client.
- `src/vitrine/categoriesApi.test.ts` — public/admin endpoint and payload tests.
- `src/vitrine/components/CategoriesPage.tsx` — minimal Category CRUD and App-assignment page.
- `src/vitrine/CategoriesPage.test.tsx` — management-page behavior and accessibility tests.

### Modify

- `src/migrations.test.ts` — lock migration `0033` schema/backfill contracts.
- `scripts/verify-migrations.ts` — expect the two new tables and verify upgrade backfill.
- `src/db.ts` — persist Category relationships and aggregate them in App, gallery, published-media, and search-source reads.
- `src/dbAppDetailQueries.test.ts`, `src/adminAppPageQuery.test.ts`, `src/catalogDisplayNamePersistence.test.ts` — query contract coverage.
- `src/publicPageStore.ts`, `src/publicPageStore.test.ts` — persist public-page Category relationships in the existing transaction.
- `src/publicCatalogStore.ts`, `src/publicCatalogStore.test.ts` — return ordered Category objects without multiplying catalog counts.
- `src/publicFacetPreviewStore.ts`, `src/publicFacetPreviewStore.test.ts` — filter Category previews through the join tables.
- `src/publicFacetPreview.ts`, `src/publicFacetPreviewStore.test.ts` — keep static non-Category taxonomy strict while accepting database-backed Category values.
- `src/gallery.ts`, `src/gallery.test.ts` — replace `cat` with `categories`.
- `src/searchProjection.ts`, `src/searchProjection.test.ts` — project all assigned Category names.
- `src/searchStore.ts`, `src/searchStore.test.ts` — keep App filtering on Category arrays and stop hydrating a scalar App Category.
- `src/searchIndexStore.ts`, `src/searchIndexStore.test.ts` — persist `catalog_categories` and leave legacy `app_category` null for App documents.
- `src/catalogResearch.ts`, `src/catalogResearch.test.ts` — make legacy search Category data multi-valued.
- `src/researchSuggestions.ts`, `src/researchSuggestions.test.ts` — score all App Category names.
- `services/api/src/app.ts`, `services/api/src/app.test.ts` — add admin management endpoints and return Category arrays.
- `services/search-index-worker/src/pipeline.test.ts` — update the published search-source fixture.
- `src/vitrine/types.ts` — add `Category`; replace `AppSummary.cat` with `categories`.
- `src/vitrine/appsDiscovery.ts`, `src/vitrine/AppsDiscovery.test.tsx` — search and filter across all assigned Categories.
- `src/vitrine/useApps.ts`, `src/vitrine/App.tsx`, `src/vitrine/components/AppsDiscoveryPage.tsx` — load and render the database-backed public Category list.
- `src/vitrine/components/AppCard.tsx`, `src/vitrine/AppCard.test.tsx` — use Category names as the description fallback.
- `src/vitrine/components/AppOverviewPanel.tsx`, `src/vitrine/AppOverviewPanel.test.tsx` — render every assigned Category badge.
- `src/vitrine/components/CommandPalette.tsx` — count and search every Category assignment.
- `src/vitrine/components/ImportDialog.tsx`, `src/vitrine/ImportDialog.test.tsx` — display Category arrays in import rows.
- `src/vitrine/components/ScreenDetail.tsx`, `src/vitrine/ScreenDetail.test.tsx` — render multiple Category names in metadata.
- `src/vitrine/useCatalogPreview.ts`, `src/vitrine/useCatalogPreview.test.ts` — map preview Categories without selecting a primary value.
- `src/vitrine/appsApi.test.ts`, `src/vitrine/appDetailPrefetch.test.ts` — update App metadata fixtures.
- `src/vitrine/AdminDashboard.tsx`, `src/vitrine/AdminDashboard.test.tsx` — switch between Users and Categories.
- `src/vitrine/components/AdminSidebar.tsx`, `src/vitrine/AdminSidebar.test.tsx` — add a Categories navigation item.
- `src/vitrine/styles.css` — Category-management layout using existing tokens.

## Task 1: Expand and backfill the database schema

**Files:**

- Create: `migrations/0033_app_categories.sql`
- Modify: `src/migrations.test.ts`
- Modify: `scripts/verify-migrations.ts`

- [ ] **Step 1: Add the failing migration contract test**

Append this definition to `migrationDefinitions` in `src/migrations.test.ts`:

```typescript
{
  file: "0033_app_categories.sql",
  patterns: [
    /CREATE TABLE categories/,
    /CREATE TABLE app_categories/,
    /PRIMARY KEY \(app_id, category_id\)/,
    /REFERENCES apps\(id\) ON DELETE CASCADE/,
    /REFERENCES categories\(id\) ON DELETE CASCADE/,
    /INSERT INTO categories/,
    /INSERT INTO app_categories/,
    /CREATE TRIGGER sync_apps_category_to_relationship/,
    /CREATE TRIGGER app_categories_search_queue/,
    /CREATE TRIGGER categories_search_queue/,
  ],
},
```

- [ ] **Step 2: Run the migration contract test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: FAIL because `migrations/0033_app_categories.sql` does not exist.

- [ ] **Step 3: Create the expand migration**

Create `migrations/0033_app_categories.sql` with:

```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
    CHECK (name = btrim(name) AND name <> ''),
  slug TEXT NOT NULL
    CHECK (
      slug = btrim(slug)
      AND slug = lower(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
);

CREATE UNIQUE INDEX categories_name_lower_unique
  ON categories (lower(name));

CREATE UNIQUE INDEX categories_slug_lower_unique
  ON categories (lower(slug));

CREATE TABLE app_categories (
  app_id INTEGER NOT NULL
    REFERENCES apps(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL
    REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (app_id, category_id)
);

CREATE INDEX app_categories_category_id_app_id_idx
  ON app_categories (category_id, app_id);

INSERT INTO categories (name, slug)
SELECT category_name,
  trim(BOTH '-' FROM regexp_replace(lower(category_name), '[^a-z0-9]+', '-', 'g'))
FROM (
  SELECT DISTINCT btrim(category) AS category_name
  FROM apps
  WHERE category IS NOT NULL AND btrim(category) <> ''
) existing_categories
ORDER BY lower(category_name), category_name;

INSERT INTO app_categories (app_id, category_id)
SELECT a.id, c.id
FROM apps a
JOIN categories c ON lower(c.name) = lower(btrim(a.category))
WHERE a.category IS NOT NULL AND btrim(a.category) <> ''
ON CONFLICT (app_id, category_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_app_category_from_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  category_name TEXT;
  category_slug TEXT;
  target_category_id INTEGER;
BEGIN
  category_name := btrim(NEW.category);
  IF category_name IS NULL OR category_name = '' THEN RETURN NEW; END IF;
  category_slug := trim(BOTH '-' FROM regexp_replace(lower(category_name), '[^a-z0-9]+', '-', 'g'));

  SELECT id INTO target_category_id
  FROM categories
  WHERE lower(name) = lower(category_name);

  IF target_category_id IS NULL THEN
    INSERT INTO categories (name, slug)
    VALUES (category_name, category_slug)
    ON CONFLICT DO NOTHING
    RETURNING id INTO target_category_id;
  END IF;

  IF target_category_id IS NULL THEN
    SELECT id INTO target_category_id
    FROM categories
    WHERE lower(name) = lower(category_name);
  END IF;

  IF target_category_id IS NULL THEN
    RAISE EXCEPTION 'legacy app category conflicts with an existing category slug';
  END IF;

  INSERT INTO app_categories (app_id, category_id)
  VALUES (NEW.id, target_category_id)
  ON CONFLICT (app_id, category_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_apps_category_to_relationship
AFTER INSERT OR UPDATE OF category ON apps
FOR EACH ROW EXECUTE FUNCTION sync_app_category_from_legacy();

CREATE OR REPLACE FUNCTION enqueue_search_from_app_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_app_id INTEGER;
  target_platform TEXT;
BEGIN
  target_app_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.app_id ELSE NEW.app_id END;
  FOR target_platform IN
    SELECT DISTINCT platform FROM app_versions WHERE app_id = target_app_id
  LOOP
    PERFORM enqueue_search_index(target_app_id, target_platform);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_categories_search_queue
AFTER INSERT OR DELETE ON app_categories
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_app_category();

CREATE OR REPLACE FUNCTION enqueue_search_from_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_app_id INTEGER;
  target_platform TEXT;
BEGIN
  FOR target_app_id IN
    SELECT app_id FROM app_categories WHERE category_id = NEW.id
  LOOP
    FOR target_platform IN
      SELECT DISTINCT platform FROM app_versions WHERE app_id = target_app_id
    LOOP
      PERFORM enqueue_search_index(target_app_id, target_platform);
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_search_queue
AFTER UPDATE OF name, slug ON categories
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_category();

INSERT INTO search_index_queue (app_id, platform)
SELECT DISTINCT av.app_id, av.platform
FROM app_versions av
JOIN app_categories ac ON ac.app_id = av.app_id
WHERE av.status = 'published'
ON CONFLICT (app_id, platform) DO UPDATE SET
  status = 'queued',
  attempts = 0,
  next_attempt_at = now(),
  locked_by = NULL,
  locked_at = NULL,
  last_error = NULL,
  requested_at = now(),
  updated_at = now();
```

- [ ] **Step 4: Extend disposable-database verification**

In `scripts/verify-migrations.ts`, add:

```typescript
const CATEGORY_TABLES = [
  "app_categories",
  "categories",
] as const;
```

Include `...CATEGORY_TABLES` in `expectedTables`. After `applyMigrations(pool)` in `verifyUpgradeDatabase`, add:

```typescript
const categoryBackfill = await pool.query<{
  categories: number;
  relationships: number;
  missing: number;
}>(
  `SELECT
     (SELECT count(*)::integer FROM categories) AS categories,
     (SELECT count(*)::integer FROM app_categories) AS relationships,
     (
       SELECT count(*)::integer
       FROM apps a
       WHERE a.category IS NOT NULL
         AND btrim(a.category) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM app_categories ac WHERE ac.app_id = a.id
         )
     ) AS missing`,
);
assert.equal(categoryBackfill.rows[0].missing, 0, "category backfill must retain every legacy assignment");
assert.ok(categoryBackfill.rows[0].categories > 0, "upgrade fixture must create categories");
assert.ok(categoryBackfill.rows[0].relationships > 0, "upgrade fixture must create app category relationships");
```

Do not add `categories_id_seq` to `SEQUENCE_MAX_ID`, because the verifier
captures the pre-migration database before that sequence exists. Instead, after
the backfill assertion add:

```typescript
const categorySequence = await pool.query<{ last_value: string; maximum: string }>(
  `SELECT sequence_row.last_value::text,
     COALESCE((SELECT max(id) FROM categories), 0)::text AS maximum
   FROM categories_id_seq sequence_row`,
);
assert.ok(
  BigInt(categorySequence.rows[0].last_value) >= BigInt(categorySequence.rows[0].maximum),
  "categories_id_seq is behind categories.id",
);
```

- [ ] **Step 5: Run migration checks**

Run:

```bash
npm run db:check
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: both commands PASS.

If a disposable PostgreSQL maintenance database is configured, also run:

```bash
npm run db:verify
```

Expected: JSON reports migration head `33` and zero rerun migrations. The
backfill assertion guarantees zero missing assignments even though that count
is not included in the JSON result.

- [ ] **Step 6: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- migrations/0033_app_categories.sql src/migrations.test.ts scripts/verify-migrations.ts
```

Expected: no output. Do not commit.

## Task 2: Build the Category store and domain contract

**Files:**

- Create: `src/categoryStore.ts`
- Create: `src/categoryStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Cover these exact behaviors in `src/categoryStore.test.ts` with this recording
query helper:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  CategoryValidationError,
  createCategoryStore,
  parseCategoryInput,
} from "./categoryStore.ts";

const result = (rows: Record<string, unknown>[] = []): QueryResult<any> => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: [],
});

test("normalizes and validates category input", () => {
  assert.deepEqual(parseCategoryInput({ name: " Health & Fitness ", slug: "health-fitness" }), {
    name: "Health & Fitness",
    slug: "health-fitness",
  });
  assert.throws(() => parseCategoryInput({ name: "", slug: "health" }), CategoryValidationError);
  assert.throws(() => parseCategoryInput({ name: "Health", slug: "Health" }), CategoryValidationError);
});

test("lists categories in name order with distinct app counts", async () => {
  const store = createCategoryStore(
    async () => result([
      { id: "2", name: "Business", slug: "business", app_count: "127" },
      { id: "7", name: "Productivity", slug: "productivity", app_count: "101" },
    ]),
    async (work) => work(async () => result()),
  );
  assert.deepEqual(await store.list(), [
    { id: 2, name: "Business", slug: "business", appCount: 127 },
    { id: 7, name: "Productivity", slug: "productivity", appCount: 101 },
  ]);
});

test("assignNames creates missing categories and inserts every relationship", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT id, name, slug FROM categories/.test(sql)) return result([]);
      if (/INSERT INTO categories/.test(sql)) {
        return result([{ id: 7, name: "Productivity", slug: "productivity" }]);
      }
      return result();
    }),
  );
  await store.assignNames(42, [" Productivity ", "productivity"], { replace: false });
  assert.equal(calls.filter(({ sql }) => /INSERT INTO categories/.test(sql)).length, 1);
  assert.match(calls.at(-1)!.sql, /INSERT INTO app_categories/);
  assert.deepEqual(calls.at(-1)!.values, [42, [7]]);
});

test("replaceAppCategories removes only stale relationships", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT id FROM categories/.test(sql)) return result([{ id: 2 }, { id: 7 }]);
      return result();
    }),
  );
  await store.replaceAppCategories(42, [7, 2, 7]);
  assert.match(calls[1].sql, /category_id <> ALL\(\$2::integer\[\]\)/);
  assert.deepEqual(calls[1].values, [42, [2, 7]]);
  assert.match(calls[2].sql, /INSERT INTO app_categories/);
});

test("removing a category returns its affected app count", async () => {
  const calls: string[] = [];
  const store = createCategoryStore(
    async () => result(),
    async (work) => work(async (sql) => {
      calls.push(sql);
      if (/SELECT id, name, slug FROM categories/.test(sql)) {
        return result([{ id: 7, name: "Productivity", slug: "productivity" }]);
      }
      if (/count\(\*\)/.test(sql)) return result([{ app_count: "101" }]);
      return result();
    }),
  );
  assert.deepEqual(await store.remove(7), {
    category: { id: 7, name: "Productivity", slug: "productivity" },
    removedAppCount: 101,
  });
  assert.match(calls[0], /FOR UPDATE/);
  assert.match(calls[2], /DELETE FROM categories/);
});
```

Use concrete fake rows in each test; do not connect to the live database.

- [ ] **Step 2: Run the store test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/categoryStore.test.ts
```

Expected: FAIL because `categoryStore.ts` does not exist.

- [ ] **Step 3: Implement the store**

Create these public contracts in `src/categoryStore.ts`:

```typescript
import type { QueryResult } from "pg";

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface CategorySummary extends Category {
  appCount: number;
}

export interface CategoryApp {
  id: number;
  slug: string;
  name: string;
}

export type CategoryQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

export type CategoryTransaction = <T>(
  work: (query: CategoryQuery) => Promise<T>,
) => Promise<T>;

export class CategoryValidationError extends Error {}
export class CategoryConflictError extends Error {}
export class CategoryNotFoundError extends Error {}

function categoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
  };
}

function categorySummaryFromRow(row: Record<string, unknown>): CategorySummary {
  return { ...categoryFromRow(row), appCount: Number(row.app_count) };
}

function slugFromName(name: string): string {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw new CategoryValidationError("category name cannot form a slug");
  return slug;
}

export function parseCategoryInput(value: unknown): { name: string; slug: string } {
  const input = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (!name || name.length > 100) throw new CategoryValidationError("invalid category name");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    throw new CategoryValidationError("invalid category slug");
  }
  return { name, slug };
}
```

Implement `createCategoryStore(runQuery, runTransaction)` with:

```typescript
return {
  async list(): Promise<CategorySummary[]> {
    const result = await runQuery(
      `SELECT c.id, c.name, c.slug, COUNT(DISTINCT ac.app_id)::integer AS app_count
       FROM categories c
       LEFT JOIN app_categories ac ON ac.category_id = c.id
       GROUP BY c.id, c.name, c.slug
       ORDER BY lower(c.name), c.id`,
    );
    return result.rows.map(categorySummaryFromRow);
  },

  async create(input: { name: string; slug: string }): Promise<Category> {
    const value = parseCategoryInput(input);
    try {
      const result = await runQuery(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         RETURNING id, name, slug`,
        [value.name, value.slug],
      );
      return categoryFromRow(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new CategoryConflictError("category name or slug already exists");
      }
      throw error;
    }
  },

  async update(id: number, input: { name: string; slug: string }): Promise<Category> {
    const value = parseCategoryInput(input);
    try {
      const result = await runQuery(
        `UPDATE categories SET name = $2, slug = $3
         WHERE id = $1
         RETURNING id, name, slug`,
        [id, value.name, value.slug],
      );
      if (!result.rows[0]) throw new CategoryNotFoundError("category not found");
      return categoryFromRow(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new CategoryConflictError("category name or slug already exists");
      }
      throw error;
    }
  },

  async remove(id: number): Promise<{ category: Category; removedAppCount: number }> {
    return runTransaction(async (tx) => {
      const existing = await tx(
        `SELECT id, name, slug FROM categories
         WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!existing.rows[0]) throw new CategoryNotFoundError("category not found");
      const count = await tx(
        `SELECT count(*)::integer AS app_count
         FROM app_categories WHERE category_id = $1`,
        [id],
      );
      await tx("DELETE FROM categories WHERE id = $1", [id]);
      return {
        category: categoryFromRow(existing.rows[0]),
        removedAppCount: Number(count.rows[0].app_count),
      };
    });
  },
};
```

Add these methods to the returned object:

```typescript
async listApps(categoryId: number): Promise<CategoryApp[]> {
  const result = await runQuery(
    `SELECT a.id, a.name AS slug, COALESCE(a.display_name, a.name) AS name
     FROM app_categories ac
     JOIN apps a ON a.id = ac.app_id
     WHERE ac.category_id = $1
     ORDER BY lower(COALESCE(a.display_name, a.name)), a.id`,
    [categoryId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
  }));
},

async attach(appSlug: string, categoryId: number): Promise<void> {
  const parents = await runQuery(
    `SELECT
       (SELECT id FROM apps WHERE name = $1) AS app_id,
       (SELECT id FROM categories WHERE id = $2) AS category_id`,
    [appSlug, categoryId],
  );
  const row = parents.rows[0];
  if (!row?.app_id || !row?.category_id) throw new CategoryNotFoundError("app or category not found");
  await runQuery(
    `INSERT INTO app_categories (app_id, category_id)
     VALUES ($1, $2)
     ON CONFLICT (app_id, category_id) DO NOTHING`,
    [Number(row.app_id), Number(row.category_id)],
  );
},

async detach(appSlug: string, categoryId: number): Promise<void> {
  const parents = await runQuery(
    `SELECT
       (SELECT id FROM apps WHERE name = $1) AS app_id,
       (SELECT id FROM categories WHERE id = $2) AS category_id`,
    [appSlug, categoryId],
  );
  const row = parents.rows[0];
  if (!row?.app_id || !row?.category_id) throw new CategoryNotFoundError("app or category not found");
  await runQuery(
    "DELETE FROM app_categories WHERE app_id = $1 AND category_id = $2",
    [Number(row.app_id), Number(row.category_id)],
  );
},

async replaceAppCategories(appId: number, rawIds: number[]): Promise<void> {
  const categoryIds = [...new Set(rawIds)].sort((left, right) => left - right);
  await runTransaction(async (tx) => {
    const existing = categoryIds.length
      ? await tx(
          "SELECT id FROM categories WHERE id = ANY($1::integer[]) ORDER BY id",
          [categoryIds],
        )
      : { rows: [] };
    if (existing.rows.length !== categoryIds.length) {
      throw new CategoryNotFoundError("category not found");
    }
    await tx(
      `DELETE FROM app_categories
       WHERE app_id = $1
         AND category_id <> ALL($2::integer[])`,
      [appId, categoryIds],
    );
    if (categoryIds.length) {
      await tx(
        `INSERT INTO app_categories (app_id, category_id)
         SELECT $1, unnest($2::integer[])
         ON CONFLICT (app_id, category_id) DO NOTHING`,
        [appId, categoryIds],
      );
    }
  });
},

async assignNames(
  appId: number,
  rawNames: string[],
  options: { replace: boolean },
): Promise<Category[]> {
  const names = [...new Map(rawNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => [name.toLowerCase(), name] as const)).values()]
    .sort((left, right) => left.localeCompare(right));
  return runTransaction(async (tx) => {
    const categories: Category[] = [];
    for (const name of names) {
      const found = await tx(
        "SELECT id, name, slug FROM categories WHERE lower(name) = lower($1)",
        [name],
      );
      let category = found.rows[0] ? categoryFromRow(found.rows[0]) : undefined;
      if (!category) {
        try {
          const inserted = await tx(
            `INSERT INTO categories (name, slug)
             VALUES ($1, $2)
             RETURNING id, name, slug`,
            [name, slugFromName(name)],
          );
          category = categoryFromRow(inserted.rows[0]);
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new CategoryConflictError("category name or slug already exists");
          }
          throw error;
        }
      }
      categories.push(category);
    }
    const ids = categories.map(({ id }) => id);
    if (options.replace) {
      await tx(
        `DELETE FROM app_categories
         WHERE app_id = $1
           AND category_id <> ALL($2::integer[])`,
        [appId, ids],
      );
    }
    if (ids.length) {
      await tx(
        `INSERT INTO app_categories (app_id, category_id)
         SELECT $1, unnest($2::integer[])
         ON CONFLICT (app_id, category_id) DO NOTHING`,
        [appId, ids],
      );
    }
    return categories;
  });
},
```

All name arrays trim, remove blanks, deduplicate case-insensitively, and sort.
`attach` and `detach` resolve both parents and throw `CategoryNotFoundError`
instead of treating a missing App or Category as a successful operation.

- [ ] **Step 4: Run store tests**

Run:

```bash
node --experimental-strip-types --test src/categoryStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- src/categoryStore.ts src/categoryStore.test.ts
```

Expected: no output. Do not commit.

## Task 3: Persist relationships from both App ingestion paths

**Files:**

- Modify: `src/db.ts`
- Modify: `src/publicPageStore.ts`
- Modify: `src/publicPageStore.test.ts`
- Modify: `src/catalogDisplayNamePersistence.test.ts`

- [ ] **Step 1: Add failing persistence tests**

In `src/publicPageStore.test.ts`, update the transaction recorder and assert that `beginCapture`:

```typescript
const categoryInsert = calls.find(({ sql }) => /INSERT INTO categories/.test(sql));
const relationshipInsert = calls.find(({ sql }) => /INSERT INTO app_categories/.test(sql));
assert.ok(categoryInsert);
assert.ok(relationshipInsert);
assert.deepEqual(categoryInsert.values, ["Website", "website"]);
assert.deepEqual(relationshipInsert.values, [appId, [categoryId]]);
```

Add a source-contract assertion to `src/catalogDisplayNamePersistence.test.ts`:

```typescript
assert.match(dbSource, /assignNames/);
assert.match(publicPageStoreSource, /assignNames/);
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test src/publicPageStore.test.ts src/catalogDisplayNamePersistence.test.ts
```

Expected: FAIL because neither persistence path writes `app_categories`.

- [ ] **Step 3: Update Mobbin App metadata persistence**

Change `setAppMeta` in `src/db.ts` to run atomically:

```typescript
export async function setAppMeta(app: string, meta: {
  iconUrl?: string | null;
  category?: string | null;
  displayName?: string | null;
}): Promise<void> {
  await withTransaction(async (client) => {
    const updated = await client.query<{ id: number }>(
      `UPDATE apps SET icon_url = COALESCE(icon_url, $2),
         display_name = COALESCE(display_name, $3)
       WHERE name = $1
       RETURNING id`,
      [app, meta.iconUrl ?? null, meta.displayName ?? null],
    );
    const appId = updated.rows[0]?.id;
    if (appId && meta.category?.trim()) {
      await createCategoryStore(
        (sql, values) => client.query(sql, values ? [...values] : undefined),
        async (work) => work((sql, values) => client.query(sql, values ? [...values] : undefined)),
      ).assignNames(appId, [meta.category], { replace: false });
    }
  });
}
```

Do not write `apps.category` in new code.

- [ ] **Step 4: Update public-page capture persistence**

Remove `category` from the `apps` insert/update columns in `src/publicPageStore.ts`. Immediately after resolving `appId`, call the Category store with the existing transaction query:

```typescript
await createCategoryStore(
  tx,
  async (work) => work(tx),
).assignNames(appId, [capture.metadata.category], { replace: false });
```

The Category relationship and page capture must commit or roll back together.

- [ ] **Step 5: Run persistence tests**

Run:

```bash
node --experimental-strip-types --test src/publicPageStore.test.ts src/catalogDisplayNamePersistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- src/db.ts src/publicPageStore.ts src/publicPageStore.test.ts src/catalogDisplayNamePersistence.test.ts
```

Expected: no output. Do not commit.

## Task 4: Return Category arrays from database and catalog stores

**Files:**

- Modify: `src/db.ts`
- Modify: `src/dbAppDetailQueries.test.ts`
- Modify: `src/adminAppPageQuery.test.ts`
- Modify: `src/publicCatalogStore.ts`
- Modify: `src/publicCatalogStore.test.ts`
- Modify: `src/gallery.ts`
- Modify: `src/gallery.test.ts`

- [ ] **Step 1: Write failing Category-array tests**

Use this record shape in catalog and metadata fixtures:

```typescript
categories: [
  { id: 2, name: "Business", slug: "business" },
  { id: 7, name: "Productivity", slug: "productivity" },
],
```

Assert `buildAppMetadata`, `buildPublishedCatalogPage`, `buildGalleryApps`, and `buildAdminGalleryApps` preserve both entries in case-insensitive name order. Assert no returned object contains `cat`.

In SQL-contract tests, require:

```typescript
assert.match(sql, /JOIN app_categories/);
assert.match(sql, /JOIN categories/);
assert.match(sql, /jsonb_agg/);
assert.doesNotMatch(sql, /\ba\.category\b/);
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/gallery.test.ts \
  src/publicCatalogStore.test.ts \
  src/dbAppDetailQueries.test.ts \
  src/adminAppPageQuery.test.ts
```

Expected: FAIL on the old scalar `category`/`cat` contracts.

- [ ] **Step 3: Change shared record types**

Import `Category` from `src/categoryStore.ts`. Replace scalar fields with:

```typescript
categories: Category[];
```

Apply this to `CrawledImage`, `AdminGalleryImage`, `AppMetadataRow`, `AppMetadataRecord`, `PublishedPreviewImage`, and `PublishedCatalogAppRecord` wherever Category data is carried.

- [ ] **Step 4: Aggregate Categories without multiplying counts**

For every App-level query in `src/db.ts` and `src/publicCatalogStore.ts`, add this correlated projection:

```sql
COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object('id', category_rows.id, 'name', category_rows.name, 'slug', category_rows.slug)
    ORDER BY lower(category_rows.name), category_rows.id
  )
  FROM (
    SELECT c.id, c.name, c.slug
    FROM app_categories ac
    JOIN categories c ON c.id = ac.category_id
    WHERE ac.app_id = a.id
  ) category_rows
), '[]'::jsonb) AS categories
```

Use the applicable App alias (`a`, `t`, or `pa`) in each query. Do not join the Category tables into the outer count aggregate.

Update these `src/db.ts` functions:

- `appMetadata`
- `legacyAppMetadata` only if it remains; otherwise remove the obsolete fallback after confirming current migrations are required
- `allImages`
- `adminAppPage`
- `appImages`
- `publishedImages`
- `publishedPreviewImages`

Update `publishedCatalogPage` metadata and preview queries in `src/publicCatalogStore.ts`.

- [ ] **Step 5: Replace gallery `cat` output with `categories`**

In `src/gallery.ts`, remove `cat` from `APP_META`, `CatalogApp`, and `CatalogAppMetadata`. Map database Categories directly:

```typescript
categories: row.categories,
```

For grouped image builders:

```typescript
categories: images[0]?.categories ?? [],
```

Do not synthesize `Design inspiration` as a Category.

- [ ] **Step 6: Run database/catalog tests**

Run:

```bash
node --experimental-strip-types --test \
  src/gallery.test.ts \
  src/publicCatalogStore.test.ts \
  src/dbAppDetailQueries.test.ts \
  src/adminAppPageQuery.test.ts
```

Expected: PASS.

- [ ] **Step 7: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- src/db.ts src/gallery.ts src/publicCatalogStore.ts
```

Expected: no output. Do not commit.

## Task 5: Migrate the App API and Vitrine consumers

**Files:**

- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/vitrine/types.ts`
- Modify: every `cat` file listed in the File map

- [ ] **Step 1: Update failing API and component fixtures**

Replace every fixture such as:

```typescript
cat: "Productivity",
```

with:

```typescript
categories: [{ id: 7, name: "Productivity", slug: "productivity" }],
```

Add a two-Category fixture and assert:

```typescript
assert.deepEqual(body.app.categories.map(({ name }: { name: string }) => name), [
  "Business",
  "Productivity",
]);
assert.equal("cat" in body.app, false);
```

- [ ] **Step 2: Run API and Vitrine tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  services/api/src/app.test.ts \
  src/vitrine/appsApi.test.ts \
  src/vitrine/appDetailPrefetch.test.ts
tsx --test \
  src/vitrine/AppCard.test.tsx \
  src/vitrine/AppOverviewPanel.test.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/ImportDialog.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL until production types and renderers use `categories`.

- [ ] **Step 3: Replace the Vitrine data contract**

In `src/vitrine/types.ts`:

```typescript
export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface AppSummary {
  id: string;
  app: string;
  categories: Category[];
  accent: string;
  totalScreens: number;
  platforms?: Platform[];
  analyzedScreens?: number;
  lastCapturedAt?: string | null;
  websiteUrl?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  previewVideoUrl?: string | null;
}
```

Remove `cat` entirely.

- [ ] **Step 4: Update discovery and display behavior**

Use all Category names:

```typescript
const categoryNames = (app: AppSummary): string[] =>
  app.categories.map(({ name }) => name);
```

Apply these rules:

- `appsDiscovery.ts`: include `...categoryNames(app)` in text search; Category facet matches when `app.categories.some(({ name }) => name.toLowerCase() === needle)`.
- `AppCard.tsx`: description fallback is `categoryNames(app).join(", ")`.
- `AppOverviewPanel.tsx`: render one badge per Category; render no Category badge for an empty array.
- `CommandPalette.tsx`: count every `(App, Category)` assignment once and search all names.
- `ImportDialog.tsx`: show joined names or `Uncategorized`.
- `ScreenDetail.tsx`: metadata value is all names joined by `, `.
- `useCatalogPreview.ts`: change `PreviewApp.category` to `categories: Category[]`.

- [ ] **Step 5: Update API response construction**

`buildAppMetadata`, `buildPublishedCatalogPage`, `buildGalleryApps`, and `buildAdminGalleryApps` now already return `categories`; keep `/catalog`, `/apps`, and `/apps/:app` pass-through behavior and delete remaining destructuring of `cat` in `services/api/src/app.ts`.

- [ ] **Step 6: Prove the scalar contract is gone**

Run:

```bash
rg -n '\bcat\b' src services
```

Expected: no App-category contract matches. Any unrelated prose match must be inspected; do not suppress genuine App usages.

- [ ] **Step 7: Run API and Vitrine tests**

Run the commands from Step 2 again.

Expected: PASS.

- [ ] **Step 8: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- services/api/src/app.ts services/api/src/app.test.ts src/vitrine
```

Expected: no output. Do not commit.

## Task 6: Make search and research multi-Category

**Files:**

- Modify: `src/db.ts`
- Modify: `src/searchProjection.ts`
- Modify: `src/searchProjection.test.ts`
- Modify: `src/searchStore.ts`
- Modify: `src/searchStore.test.ts`
- Modify: `src/searchIndexStore.ts`
- Modify: `src/searchIndexStore.test.ts`
- Modify: `src/catalogResearch.ts`
- Modify: `src/catalogResearch.test.ts`
- Modify: `src/researchSuggestions.ts`
- Modify: `src/researchSuggestions.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/search-index-worker/src/pipeline.test.ts`

- [ ] **Step 1: Add failing two-Category projection tests**

Change `PublishedSearchSource.version` fixtures to:

```typescript
categories: ["Business", "Productivity"],
```

Assert every App document has:

```typescript
assert.deepEqual(document.catalogCategories, ["Business", "Productivity"]);
assert.match(document.searchText, /Business/);
assert.match(document.searchText, /Productivity/);
assert.equal("appCategory" in document, false);
```

Update legacy catalog-research fixtures to `Record<string, string[]>`; assert filtering by either assigned Category returns the same App.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/searchProjection.test.ts \
  src/searchStore.test.ts \
  src/searchIndexStore.test.ts \
  src/catalogResearch.test.ts \
  src/researchSuggestions.test.ts \
  services/search-index-worker/src/pipeline.test.ts
```

Expected: FAIL on scalar Category assumptions.

- [ ] **Step 3: Load Category names for published search sources**

Change `PublishedSearchSource.version.category?: string` to:

```typescript
categories: string[];
```

In `publishedSearchSource`, project:

```sql
COALESCE((
  SELECT array_agg(c.name ORDER BY lower(c.name), c.id)
  FROM app_categories ac
  JOIN categories c ON c.id = ac.category_id
  WHERE ac.app_id = av.app_id
), ARRAY[]::text[]) AS categories
```

Map it directly into the returned `version`.

- [ ] **Step 4: Project all Category names**

In `baseDocument`:

```typescript
catalogCategories: source.version.categories,
```

Replace every `source.version.category` occurrence in search text with
`source.version.categories`. Remove `appCategory` from the App projection.
Keep the optional `SearchDocument.appCategory` property and the database
`app_category` column for the existing Site projection, which is outside this
App Category change. No App document may populate the scalar property.

- [ ] **Step 5: Update search persistence and hydration**

In `searchIndexStore.ts`, keep:

```typescript
app_category: document.appCategory ?? null,
```

Add an assertion in `src/searchIndexStore.test.ts` that App documents write
`app_category: null`. In `searchStore.ts`, continue filtering `appCategory`
against `d.catalog_categories`; do not derive an App primary Category in
`rowToItem`. Site documents may retain their existing scalar compatibility
field.

- [ ] **Step 6: Update legacy catalog search and research suggestions**

Change:

```typescript
appCategories?: Record<string, string[]>;
```

Each catalog item carries `appCategories: string[]`. Build facets with:

```typescript
appCategories: unique(index.flatMap(({ appCategories }) => appCategories)).sort(),
```

Filter with:

```typescript
!options.appCategory || item.appCategories.includes(options.appCategory)
```

Change `ResearchSuggestionCandidate.appCategory?: string` to `appCategories: string[]`; the existing `matchingTokenCount` already accepts arrays. In `services/api/src/app.ts`, pass `image.categories?.map(({ name }) => name) ?? []`.

- [ ] **Step 7: Run search tests**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 8: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- src/searchProjection.ts src/searchStore.ts src/searchIndexStore.ts src/catalogResearch.ts src/researchSuggestions.ts services
```

Expected: no output. Do not commit.

## Task 7: Make public Category discovery database-backed

**Files:**

- Modify: `src/categoryStore.ts`
- Modify: `src/categoryStore.test.ts`
- Modify: `src/publicFacetPreview.ts`
- Modify: `src/publicFacetPreviewStore.ts`
- Modify: `src/publicFacetPreviewStore.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Create: `src/vitrine/categoriesApi.ts`
- Create: `src/vitrine/categoriesApi.test.ts`
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/appsDiscovery.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Add failing public-list and facet tests**

Add a `listPublished` store test requiring a distinct count of Apps that have
at least one published version and excluding zero-count Categories.

For Category previews, require:

```typescript
assert.match(capturedSql, /JOIN app_categories ac ON ac\.app_id = a\.id/);
assert.match(capturedSql, /JOIN categories c ON c\.id = ac\.category_id/);
assert.match(capturedSql, /lower\(c\.name\) = lower\(\$2\)/);
assert.doesNotMatch(capturedSql, /a\.category/);
```

In `src/publicFacetPreviewStore.test.ts`, keep strict rejection for unknown
Screens, UI Elements, and Flows, but assert a syntactically valid database
Category is accepted:

```typescript
assert.deepEqual(
  parsePublicFacet({ group: "categories", value: "New Category", platform: "web" }),
  { group: "categories", value: "New Category", platform: "web" },
);
assert.equal(
  parsePublicFacet({ group: "categories", value: "   ", platform: "web" }),
  null,
);
```

Add an API test for `GET /catalog/categories` expecting ordered objects with
`appCount`, plus a Vitrine client test for the same route.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  src/categoryStore.test.ts \
  src/publicFacetPreviewStore.test.ts \
  services/api/src/app.test.ts \
  src/vitrine/categoriesApi.test.ts
```

Expected: FAIL because the public Category list and dynamic parsing do not
exist and the preview query still compares `apps.category`.

- [ ] **Step 3: Add the published Category query**

Add this method to `createCategoryStore`:

```typescript
async listPublished(): Promise<CategorySummary[]> {
  const result = await runQuery(
    `SELECT c.id, c.name, c.slug,
       COUNT(DISTINCT published.app_id)::integer AS app_count
     FROM categories c
     JOIN app_categories ac ON ac.category_id = c.id
     JOIN (
       SELECT DISTINCT app_id
       FROM app_versions
       WHERE published_at IS NOT NULL
     ) published ON published.app_id = ac.app_id
     GROUP BY c.id, c.name, c.slug
     HAVING COUNT(DISTINCT published.app_id) > 0
     ORDER BY lower(c.name), c.id`,
  );
  return result.rows.map(categorySummaryFromRow);
},
```

- [ ] **Step 4: Accept dynamic Category facet values**

Change `src/publicFacetPreview.ts` so `PUBLIC_APP_STATIC_FACETS` contains only
Screens, UI Elements, and Flows. Keep `PublicFacetGroup` as the explicit union:

```typescript
export type PublicFacetGroup = "categories" | "screens" | "elements" | "flows";
```

In `parsePublicFacet`, validate Categories by shape:

```typescript
if (input.group === "categories") {
  const value = input.value.trim();
  if (!value || value.length > 100) return null;
  return { group: "categories", value, platform: input.platform };
}
```

For the other three groups, retain exact membership validation against the
static definitions.

In `src/vitrine/appsDiscovery.ts`, replace the old constant export with:

```typescript
export const APPS_DISCOVERY_STATIC_FACETS = PUBLIC_APP_STATIC_FACETS;
```

- [ ] **Step 5: Replace the Category preview query**

Use:

```sql
WITH latest AS MATERIALIZED (${latestPublished})
SELECT a.name AS app, a.icon_url, 0::int AS media_count
FROM latest
JOIN apps a ON a.id = latest.app_id
JOIN app_categories ac ON ac.app_id = a.id
JOIN categories c ON c.id = ac.category_id
WHERE lower(c.name) = lower($2) AND a.icon_url IS NOT NULL
GROUP BY a.id, a.name, a.icon_url
ORDER BY a.name
LIMIT 6
```

- [ ] **Step 6: Expose the public Category list**

Add the public route before authentication middleware in `services/api/src/app.ts`:

```typescript
app.get("/catalog/categories", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ categories: await deps.categoryStore.listPublished() });
});
```

Create `src/vitrine/categoriesApi.ts` with:

```typescript
import type { Category } from "./types.ts";

export interface CategorySummary extends Category {
  appCount: number;
}

type Requester = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

async function json<T>(
  url: string,
  init: RequestInit | undefined,
  request: Requester,
): Promise<T> {
  const response = await request(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${url} returned ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function fetchCatalogCategories(
  signal?: AbortSignal,
  request: Requester = fetch,
): Promise<CategorySummary[]> {
  const body = await json<{ categories: CategorySummary[] }>(
    "/api/catalog/categories",
    { signal },
    request,
  );
  return body.categories;
}
```

- [ ] **Step 7: Feed database Categories into Apps discovery**

In `useApps.ts`, add `categories: CategorySummary[] | null` state. During the
first refresh, load `/api/catalog/categories` in parallel with `/api/catalog`
or `/api/apps`; store the result and return it from the hook.

Pass that value through `src/vitrine/App.tsx` to
`AppsDiscoveryPage`. Add this prop:

```typescript
categories: CategorySummary[] | null;
```

Build the displayed taxonomy in `AppsDiscoveryPage`:

```typescript
const facets = [
  {
    group: "categories" as const,
    label: "Categories",
    values: (props.categories ?? []).map(({ name }) => name),
  },
  ...APPS_DISCOVERY_STATIC_FACETS,
];
```

Render `facets` instead of the old hard-coded Category values. Show no empty
Categories group while the list is unavailable or empty.

- [ ] **Step 8: Run the public discovery tests**

Run:

```bash
node --experimental-strip-types --test \
  src/categoryStore.test.ts \
  src/publicFacetPreviewStore.test.ts \
  services/api/src/app.test.ts \
  src/vitrine/categoriesApi.test.ts
tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- src/categoryStore.ts src/publicFacetPreview.ts src/publicFacetPreviewStore.ts services/api/src/app.ts src/vitrine/categoriesApi.ts src/vitrine/useApps.ts src/vitrine/appsDiscovery.ts src/vitrine/App.tsx src/vitrine/components/AppsDiscoveryPage.tsx
```

Expected: no output. Do not commit.

## Task 8: Add admin Category CRUD and relationship endpoints

**Files:**

- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Add tests for:

```text
GET    /admin/categories
POST   /admin/categories
PATCH  /admin/categories/:categoryId
DELETE /admin/categories/:categoryId
GET    /admin/categories/:categoryId/apps
POST   /admin/categories/:categoryId/apps
DELETE /admin/categories/:categoryId/apps/:app
```

Assert:

- non-admin users receive `403`;
- duplicate normalized name/slug receives `409`;
- malformed IDs and bodies receive `400`;
- missing App or Category receives `404`;
- delete returns `{ category, removedAppCount }`;
- repeated attach is `200` and creates no duplicate;
- repeated detach is `204`.

- [ ] **Step 2: Run the endpoint tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: FAIL with `404` for the new endpoints.

- [ ] **Step 3: Add the store to API dependencies**

Construct the default store once:

```typescript
const categoryStore = createCategoryStore(
  (sql, values) => query(sql, values ? [...values] : undefined),
  (work) => withTransaction((client) =>
    work((sql, values) => client.query(sql, values ? [...values] : undefined))),
);
```

Add `categoryStore` to `defaults` so tests can override it.

- [ ] **Step 4: Implement the routes**

Use `requireAdmin`, `positiveId`, `exactBody`, and the Category error classes:

```typescript
function sendCategoryError(res: express.Response, error: unknown): void {
  if (error instanceof CategoryValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof CategoryConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof CategoryNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  throw error;
}

app.get("/admin/categories", requireAdmin, async (_req, res) => {
  res.json({ categories: await deps.categoryStore.list() });
});

app.post("/admin/categories", requireAdmin, async (req, res) => {
  const body = exactBody(req.body, ["name", "slug"]);
  if (!body) {
    res.status(400).json({ error: "invalid category" });
    return;
  }
  try {
    res.status(201).json(await deps.categoryStore.create(
      body as { name: string; slug: string },
    ));
  } catch (error) {
    sendCategoryError(res, error);
  }
});

app.patch("/admin/categories/:categoryId", requireAdmin, async (req, res) => {
  const categoryId = positiveId(req.params.categoryId);
  const body = exactBody(req.body, ["name", "slug"]);
  if (!categoryId || !body) {
    res.status(400).json({ error: "invalid category" });
    return;
  }
  try {
    res.json(await deps.categoryStore.update(
      categoryId,
      body as { name: string; slug: string },
    ));
  } catch (error) {
    sendCategoryError(res, error);
  }
});

app.delete("/admin/categories/:categoryId", requireAdmin, async (req, res) => {
  const categoryId = positiveId(req.params.categoryId);
  if (!categoryId) {
    res.status(400).json({ error: "invalid category id" });
    return;
  }
  try {
    res.json(await deps.categoryStore.remove(categoryId));
  } catch (error) {
    sendCategoryError(res, error);
  }
});

app.get("/admin/categories/:categoryId/apps", requireAdmin, async (req, res) => {
  const categoryId = positiveId(req.params.categoryId);
  if (!categoryId) {
    res.status(400).json({ error: "invalid category id" });
    return;
  }
  try {
    res.json({ apps: await deps.categoryStore.listApps(categoryId) });
  } catch (error) {
    sendCategoryError(res, error);
  }
});

app.post("/admin/categories/:categoryId/apps", requireAdmin, async (req, res) => {
  const categoryId = positiveId(req.params.categoryId);
  const body = exactBody(req.body, ["app"]);
  const appSlug = typeof body?.app === "string" && isAppSlug(body.app)
    ? body.app
    : undefined;
  if (!categoryId || !appSlug) {
    res.status(400).json({ error: "invalid category assignment" });
    return;
  }
  try {
    await deps.categoryStore.attach(appSlug, categoryId);
    res.json({ app: appSlug, categoryId });
  } catch (error) {
    sendCategoryError(res, error);
  }
});

app.delete("/admin/categories/:categoryId/apps/:app", requireAdmin, async (req, res) => {
  const categoryId = positiveId(req.params.categoryId);
  if (!categoryId || !isAppSlug(req.params.app)) {
    res.status(400).json({ error: "invalid category assignment" });
    return;
  }
  try {
    await deps.categoryStore.detach(req.params.app, categoryId);
    res.status(204).end();
  } catch (error) {
    sendCategoryError(res, error);
  }
});
```

- [ ] **Step 5: Run API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: PASS.

- [ ] **Step 6: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- services/api/src/app.ts services/api/src/app.test.ts
```

Expected: no output. Do not commit.

## Task 9: Add the minimal admin Category-management page

**Files:**

- Modify: `src/vitrine/categoriesApi.ts`
- Modify: `src/vitrine/categoriesApi.test.ts`
- Create: `src/vitrine/components/CategoriesPage.tsx`
- Create: `src/vitrine/CategoriesPage.test.tsx`
- Modify: `src/vitrine/AdminDashboard.tsx`
- Modify: `src/vitrine/AdminDashboard.test.tsx`
- Modify: `src/vitrine/components/AdminSidebar.tsx`
- Modify: `src/vitrine/AdminSidebar.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing API-client tests**

Assert the client calls the exact endpoints and methods:

```typescript
await listCategories(request);                    // GET /api/admin/categories
await createCategory({ name, slug }, request);   // POST /api/admin/categories
await updateCategory(id, { name, slug }, request); // PATCH /api/admin/categories/:id
await deleteCategory(id, request);                // DELETE /api/admin/categories/:id
await listCategoryApps(id, request);              // GET /api/admin/categories/:id/apps
await attachCategoryApp(id, app, request);        // POST .../:id/apps
await detachCategoryApp(id, app, request);        // DELETE .../:id/apps/:app
```

- [ ] **Step 2: Implement the API client**

Keep the `json` and `fetchCatalogCategories` functions from Task 7. Add:

```typescript
export interface CategoryApp {
  id: number;
  slug: string;
  name: string;
}

const jsonHeaders = { "content-type": "application/json" };

export async function listCategories(request: Requester = fetch): Promise<CategorySummary[]> {
  return (await json<{ categories: CategorySummary[] }>(
    "/api/admin/categories",
    undefined,
    request,
  )).categories;
}

export function createCategory(
  input: { name: string; slug: string },
  request: Requester = fetch,
): Promise<Category> {
  return json("/api/admin/categories", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }, request);
}

export function updateCategory(
  id: number,
  input: { name: string; slug: string },
  request: Requester = fetch,
): Promise<Category> {
  return json(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }, request);
}

export function deleteCategory(
  id: number,
  request: Requester = fetch,
): Promise<{ category: Category; removedAppCount: number }> {
  return json(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }, request);
}

export async function listCategoryApps(
  id: number,
  request: Requester = fetch,
): Promise<CategoryApp[]> {
  return (await json<{ apps: CategoryApp[] }>(
    `/api/admin/categories/${encodeURIComponent(id)}/apps`,
    undefined,
    request,
  )).apps;
}

export function attachCategoryApp(
  id: number,
  app: string,
  request: Requester = fetch,
): Promise<{ app: string; categoryId: number }> {
  return json(`/api/admin/categories/${encodeURIComponent(id)}/apps`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ app }),
  }, request);
}

export function detachCategoryApp(
  id: number,
  app: string,
  request: Requester = fetch,
): Promise<void> {
  return json(
    `/api/admin/categories/${encodeURIComponent(id)}/apps/${encodeURIComponent(app)}`,
    { method: "DELETE" },
    request,
  );
}
```

- [ ] **Step 3: Write failing page and navigation tests**

Assert:

- sidebar exposes `Users` and `Categories`, with exactly one selected;
- selecting Categories renders the page without navigating away from admin;
- list rows show name, slug, and distinct App count;
- create requires both fields;
- editing the slug displays `Changing this slug may break saved Category URLs.`;
- deleting displays the affected App count before confirmation;
- selecting a Category lists assigned Apps;
- attaching by App slug and removing an App refreshes the selected Category.

- [ ] **Step 4: Implement the page**

Use existing `Button`, `Card`, `TextInput`, `Spinner`, `Badge`, and `AlertDialog` components. Keep the page state local:

```typescript
type CategoryDraft = { name: string; slug: string };

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategorySummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [apps, setApps] = useState<CategoryApp[]>([]);
  const [draft, setDraft] = useState<CategoryDraft>({ name: "", slug: "" });
  const [editing, setEditing] = useState<CategorySummary | null>(null);
  const [deleting, setDeleting] = useState<CategorySummary | null>(null);
  const [appSlug, setAppSlug] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const next = await listCategories();
    setCategories(next);
    setSelectedId((current) =>
      current && next.some(({ id }) => id === current)
        ? current
        : next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void refresh().catch((cause: Error) => setError(cause.message));
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setApps([]);
      return;
    }
    void listCategoryApps(selectedId)
      .then(setApps)
      .catch((cause: Error) => setError(cause.message));
  }, [selectedId]);

  const create = async () => {
    setError("");
    await createCategory({ name: draft.name.trim(), slug: draft.slug.trim() });
    setDraft({ name: "", slug: "" });
    await refresh();
  };

  const save = async () => {
    if (!editing) return;
    setError("");
    await updateCategory(editing.id, {
      name: editing.name.trim(),
      slug: editing.slug.trim(),
    });
    setEditing(null);
    await refresh();
  };

  const remove = async () => {
    if (!deleting) return;
    setError("");
    await deleteCategory(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const attach = async () => {
    if (!selectedId || !appSlug.trim()) return;
    setError("");
    await attachCategoryApp(selectedId, appSlug.trim());
    setApps(await listCategoryApps(selectedId));
    setAppSlug("");
    await refresh();
  };

  const detach = async (app: CategoryApp) => {
    if (!selectedId) return;
    setError("");
    await detachCategoryApp(selectedId, app.slug);
    setApps(await listCategoryApps(selectedId));
    await refresh();
  };
}
```

Render one list/detail layout:

- top header and create form;
- Category list with name, slug, and App count;
- selected Category detail with assigned Apps;
- edit dialog;
- delete alert containing the count;
- empty states for zero Categories and zero assigned Apps.

Do not add confidence, review, status, primary, hierarchy, or AI controls.

- [ ] **Step 5: Wire admin navigation**

In `AdminDashboard.tsx`, use:

```typescript
type AdminSection = "users" | "categories";
const [section, setSection] = useState<AdminSection>("users");
```

Lazy-load `CategoriesPage`. Pass `section` and `onSectionChange` to `AdminSidebar`; render only the selected page. `Back to Vitrine` remains unchanged.

- [ ] **Step 6: Add focused styling**

Add only token-based classes under `.admin-categories-*` in `src/vitrine/styles.css`. Use the existing `vitrine-page` width/padding, a responsive two-column list/detail layout, `var(--color-border)`, `var(--color-bg-*)`, and existing typography variables. At narrow widths, stack the list above the selected Category detail.

- [ ] **Step 7: Run Category-management UI tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/categoriesApi.test.ts
tsx --test \
  src/vitrine/CategoriesPage.test.tsx \
  src/vitrine/AdminDashboard.test.tsx \
  src/vitrine/AdminSidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Record the no-commit checkpoint**

Run:

```bash
git diff --check -- src/vitrine/categoriesApi.ts src/vitrine/components/CategoriesPage.tsx src/vitrine/AdminDashboard.tsx src/vitrine/components/AdminSidebar.tsx src/vitrine/styles.css
```

Expected: no output. Do not commit.

## Task 10: Verify the complete expand rollout

**Files:**

- Verify all modified files
- Do not create the contract migration yet

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite exits successfully with no TypeScript or bundling error.

- [ ] **Step 3: Run migration verification**

Run:

```bash
npm run db:check
```

Expected: migration sequence is contiguous through `0033` and checksums are valid.

If the disposable migration environment is configured:

```bash
npm run db:verify
```

Expected: empty install and legacy upgrade both pass.

- [ ] **Step 4: Prove legacy application reads are gone**

Run:

```bash
rg -n 'apps\.category|a\.category|t\.category|pa\.category|\bcat\b' src services
```

Expected: no App Category read/write remains. A migration compatibility reference or unrelated Component/Flow/Site Category must be inspected and is allowed only when it is outside App Category scope.

- [ ] **Step 5: Review the diff and preserve unrelated changes**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: no whitespace errors; only intended Category files are attributed to this implementation. Do not stage or commit.

- [ ] **Step 6: Stop before live mutation**

Report the tests, build, migration checks, and exact pending migration. Ask for explicit approval before:

```bash
npm run db:backup
npm run db:migrate
npm run search:index:backfill
```

Do not run those commands in the implementation turn without approval.

## Later contract rollout: intentionally deferred

After `0033` and the application changes are deployed and verified in production:

1. Query live invariants:

```sql
SELECT count(*) FROM categories;
SELECT count(*) FROM apps;
SELECT count(DISTINCT app_id) FROM app_categories;
SELECT count(*) FROM apps a
WHERE NOT EXISTS (SELECT 1 FROM app_categories ac WHERE ac.app_id = a.id);
SELECT app_id, category_id, count(*)
FROM app_categories
GROUP BY app_id, category_id
HAVING count(*) > 1;
```

2. Confirm expected current values: 28 Categories, 1,190 Apps, 1,190 Apps with at least one Category, zero missing Apps, zero duplicate relationships.
3. Confirm imports no longer update `apps.category`.
4. Confirm `/api/catalog`, `/api/apps/:app`, public Category facets, legacy search, and advanced search read from the relationship tables.
5. Only then create a new immutable migration that drops `apps.category` and the obsolete scalar `app_category` use for App search documents.

This later contract migration is not bundled with `0033`; keeping it separate is required for rollback safety.
