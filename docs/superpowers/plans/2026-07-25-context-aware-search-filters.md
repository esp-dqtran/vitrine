# Context-Aware Search Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one context-aware, filter-capable search experience that defaults to Apps or Sites, can expand to All, preserves compatible session filters, and hands the same state to the full Search page.

**Architecture:** Extend the canonical advanced-search request and index with an explicit `scope` plus Site documents and Site facets. Keep one `SearchSessionState` in the application, derive context-specific quick filters from API facets, and reuse the same state serializer in Quick Search and the full Search page. Implement in the current working tree as requested, staging only task-owned files and preserving unrelated changes.

**Tech Stack:** React 19, TypeScript, Node test runner through `tsx`, Express, PostgreSQL/pgvector, Vite, existing Astryx design-system controls.

---

## File Structure

### Create

- `migrations/0030_context_aware_search.sql` — extend the search index for Site documents, Site facets, and a Site indexing queue.
- `src/siteSearchProjection.ts` — project one ready Site version into a canonical search document.
- `src/searchScope.ts` — define scopes, compatibility rules, quick-filter configuration, and filter pruning.
- `src/vitrine/searchSession.ts` — create and update the in-memory search session without coupling it to React.
- `src/vitrine/components/QuickSearchFilters.tsx` — render scope tabs, quick-filter menus, active pills, and More filters.
- `src/siteSearchProjection.test.ts` — cover Site document projection.
- `src/searchScope.test.ts` — cover scope compatibility and filter pruning.
- `src/searchIndexStore.test.ts` — cover App/Site queue claiming and scope replacement.
- `src/searchStore.test.ts` — cover scoped SQL, authorization, facets, and result hydration.
- `src/vitrine/searchSession.test.ts` — cover session persistence and context switching.
- `src/vitrine/QuickSearchFilters.test.tsx` — cover accessible filter interaction markup.
- `src/vitrine/SearchTrigger.test.tsx` — cover active-filter count rendering.

### Modify

- `src/searchTypes.ts` and `src/searchTypes.test.ts` — add scope, Site result type, Site filter fields, and generic catalog identity.
- `src/searchProjection.ts` and `src/searchProjection.test.ts` — mark App documents with the Apps scope.
- `src/db.ts` — load the latest ready Site version and its searchable metadata.
- `src/searchIndexStore.ts` and its tests — claim and replace both App and Site index jobs.
- `services/search-index-worker/src/pipeline.ts` and `pipeline.test.ts` — route App and Site jobs through the correct projector.
- `src/searchStore.ts` — apply scope-aware authorization, filters, facets, result hydration, and counts.
- `services/api/src/search.ts` and `search.test.ts` — validate scope and new filters.
- `services/api/src/app.ts` — continue mounting the same authorized search service; no new public bypass route.
- `src/vitrine/searchState.ts` and `searchState.test.ts` — serialize scope and Site filters in shareable Search URLs.
- `src/vitrine/advancedSearchApi.ts` and `advancedSearchApi.test.ts` — send scope and new filter values.
- `src/vitrine/useAdvancedSearch.ts` and `useAdvancedSearch.test.ts` — retain previous results while replacement requests load.
- `src/vitrine/components/QuickSearch.tsx` and `src/vitrine/QuickSearch.test.tsx` — use shared state, facets, immediate filtering, Retry, and More filters.
- `src/vitrine/components/AdvancedSearchFilters.tsx` — render only fields compatible with the active scope.
- `src/vitrine/components/AdvancedSearchFilterDrawer.tsx` — apply changes immediately and remove the draft Apply flow.
- `src/vitrine/components/ActiveSearchFilters.tsx` — share filter pills with Quick Search.
- `src/vitrine/components/AdvancedSearchPage.tsx` and `AdvancedSearchPage.test.tsx` — parse and render the same scoped state.
- `src/vitrine/components/SearchTrigger.tsx` and its tests — show the active-filter count.
- `src/vitrine/components/SearchResultCard.tsx` — render Site identity and preview routes.
- `src/vitrine/components/AdvancedSearchResults.tsx` — prevent App-only comparison actions on Sites.
- `src/vitrine/components/SearchResearchActions.tsx` — keep App comparison types guarded.
- `src/vitrine/components/AppsDiscoveryPage.tsx` — open Search with Apps context and map the active taxonomy/platform.
- `src/vitrine/components/SitesPage.tsx` — open Search with Sites context and map the active taxonomy.
- `src/vitrine/App.tsx` and `App.boundary.test.ts` — own the session and pass one state to both search surfaces.
- `src/vitrine/styles.css` — style scope tabs, quick chips, menus, pills, retained-results loading, and responsive More filters.

## Task 1: Canonical Scope and Filter Compatibility

**Files:**

- Create: `src/searchScope.ts`
- Create: `src/searchScope.test.ts`
- Modify: `src/searchTypes.ts`
- Modify: `src/searchTypes.test.ts`

- [ ] **Step 1: Write failing type-normalization and compatibility tests**

Add tests that assert scope normalization, new Site fields, and deterministic pruning:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchRequest } from "./searchTypes.ts";
import {
  compatibleSearchFilters,
  quickFilterKeys,
} from "./searchScope.ts";

test("normalizes Sites scope and Site filters", () => {
  const request = normalizeSearchRequest({
    scope: "sites",
    type: "site",
    siteSection: ["Pricing", "FAQ", "Pricing"],
    siteStyle: "Minimal",
  });

  assert.equal(request.scope, "sites");
  assert.equal(request.type, "site");
  assert.deepEqual(request.filters.siteSection, ["FAQ", "Pricing"]);
  assert.deepEqual(request.filters.siteStyle, ["Minimal"]);
});

test("removes filters incompatible with the next scope", () => {
  const filters = normalizeSearchRequest({
    platform: "web",
    appCategory: "Finance",
    siteSection: "Pricing",
    siteStyle: "Minimal",
  }).filters;

  assert.deepEqual(compatibleSearchFilters("apps", filters).siteSection, []);
  assert.deepEqual(compatibleSearchFilters("apps", filters).siteStyle, []);
  assert.deepEqual(compatibleSearchFilters("apps", filters).platform, ["web"]);
  assert.deepEqual(quickFilterKeys("sites"), ["appCategory", "siteSection", "siteStyle"]);
});
```

- [ ] **Step 2: Run the tests and verify the missing behavior**

Run:

```bash
npx tsx --test src/searchTypes.test.ts src/searchScope.test.ts
```

Expected: FAIL because `scope`, `site`, `siteSection`, `siteStyle`, and `searchScope.ts` do not exist.

- [ ] **Step 3: Extend the canonical types**

In `src/searchTypes.ts`, add:

```ts
export const SEARCH_SCOPES = ["apps", "sites", "all"] as const;
export type SearchScope = typeof SEARCH_SCOPES[number];

export const SEARCH_ENTITY_TYPES = [
  "app",
  "site",
  "screen",
  "flow",
  "component",
  "pattern",
] as const;

export interface SearchFilters {
  platform: string[];
  app: string[];
  appCategory: string[];
  pageType: string[];
  productArea: string[];
  flow: string[];
  component: string[];
  state: string[];
  theme: string[];
  layout: string[];
  siteSection: string[];
  siteStyle: string[];
}

export interface NormalizedSearchRequest {
  query: string;
  scope: SearchScope;
  type: SearchType;
  filters: SearchFilters;
  sort: SearchSort;
  cursor?: string;
  limit: number;
}
```

Add `scope`, `catalogScope`, optional `siteId`, and optional `siteVersionId` to search documents/results. Make App-only identifiers optional while keeping `catalogName` required:

```ts
export interface SearchDocument {
  documentId: string;
  indexVersion: 1;
  catalogScope: Exclude<SearchScope, "all">;
  catalogName: string;
  versionId?: number;
  appId?: number;
  appName?: string;
  siteId?: number;
  siteVersionId?: number;
  catalogCategories: string[];
  siteSections: string[];
  siteStyles: string[];
  // retain the existing remaining fields
}
```

Update `normalizeSearchRequest` to accept only known scopes, default to `all`, and normalize the two new filter arrays through the existing `values` helper.

- [ ] **Step 4: Implement scope configuration and pruning**

Create `src/searchScope.ts`:

```ts
import type { SearchFilters, SearchScope } from "./searchTypes.ts";

const ALL_KEYS = [
  "platform", "app", "appCategory", "pageType", "productArea",
  "flow", "component", "state", "theme", "layout",
  "siteSection", "siteStyle",
] as const satisfies ReadonlyArray<keyof SearchFilters>;

const COMPATIBLE: Record<SearchScope, ReadonlySet<keyof SearchFilters>> = {
  apps: new Set([
    "platform", "app", "appCategory", "pageType", "productArea",
    "flow", "component", "state", "theme", "layout",
  ]),
  sites: new Set(["appCategory", "siteSection", "siteStyle", "theme", "layout"]),
  all: new Set(ALL_KEYS),
};

const QUICK: Record<SearchScope, Array<keyof SearchFilters>> = {
  apps: ["platform", "appCategory", "pageType", "component", "flow"],
  sites: ["appCategory", "siteSection", "siteStyle"],
  all: ["platform", "app", "theme"],
};

export const quickFilterKeys = (scope: SearchScope) => [...QUICK[scope]];

export function compatibleSearchFilters(
  scope: SearchScope,
  filters: SearchFilters,
): SearchFilters {
  return Object.fromEntries(
    ALL_KEYS.map((key) => [key, COMPATIBLE[scope].has(key) ? [...filters[key]] : []]),
  ) as SearchFilters;
}

export const activeFilterCount = (filters: SearchFilters) =>
  ALL_KEYS.reduce((total, key) => total + filters[key].length, 0);
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx tsx --test src/searchTypes.test.ts src/searchScope.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/searchTypes.ts src/searchTypes.test.ts src/searchScope.ts src/searchScope.test.ts
git commit -m "feat: define scoped search filters"
```

## Task 2: Database Support and Site Projection

**Files:**

- Create: `migrations/0030_context_aware_search.sql`
- Create: `src/siteSearchProjection.ts`
- Create: `src/siteSearchProjection.test.ts`
- Modify: `src/searchProjection.ts`
- Modify: `src/searchProjection.test.ts`
- Modify: `src/db.ts`

- [ ] **Step 1: Write failing Site projection tests**

Create a fixture containing a ready Site, pages, section patterns, categories, and styles. Assert one `site` document:

```ts
test("projects a ready Site into a published search document", () => {
  const [document] = projectSiteSearchDocuments({
    site: {
      id: 7,
      versionId: 11,
      name: "V7",
      description: "Visual data platform",
      categories: ["Business"],
      styles: ["Minimal", "Dark"],
      updatedAt: "2026-07-25T00:00:00.000Z",
    },
    pages: [
      { title: "Pricing", sectionPatterns: ["Hero", "Social Proof"] },
      { title: "FAQ", sectionPatterns: ["FAQ"] },
    ],
  });

  assert.equal(document.entityType, "site");
  assert.equal(document.catalogScope, "sites");
  assert.equal(document.catalogName, "V7");
  assert.equal(document.siteId, 7);
  assert.equal(document.siteVersionId, 11);
  assert.deepEqual(document.siteSections, ["FAQ", "Hero", "Pricing", "Social Proof"]);
  assert.deepEqual(document.siteStyles, ["Dark", "Minimal"]);
  assert.match(document.searchText, /Visual data platform/);
});
```

Extend the existing App projection assertion:

```ts
assert.equal(appDocument.catalogScope, "apps");
assert.equal(appDocument.catalogName, sourceFixture.version.app);
```

- [ ] **Step 2: Run projection tests and verify failure**

Run:

```bash
npx tsx --test src/searchProjection.test.ts src/siteSearchProjection.test.ts
```

Expected: FAIL because Site projection and generic catalog identity do not exist.

- [ ] **Step 3: Add migration 0030**

Create a migration that:

```sql
ALTER TABLE search_documents
  ALTER COLUMN version_id DROP NOT NULL,
  ALTER COLUMN app_id DROP NOT NULL,
  ADD COLUMN catalog_scope TEXT NOT NULL DEFAULT 'apps'
    CHECK (catalog_scope IN ('apps', 'sites')),
  ADD COLUMN catalog_name TEXT,
  ADD COLUMN site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
  ADD COLUMN site_version_id BIGINT REFERENCES site_versions(id) ON DELETE CASCADE,
  ADD COLUMN catalog_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN site_sections TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN site_styles TEXT[] NOT NULL DEFAULT '{}';

UPDATE search_documents SET catalog_name = app_name WHERE catalog_name IS NULL;
UPDATE search_documents
SET catalog_categories = CASE
  WHEN app_category IS NULL THEN '{}'
  ELSE ARRAY[app_category]
END;
ALTER TABLE search_documents ALTER COLUMN catalog_name SET NOT NULL;

ALTER TABLE search_documents DROP CONSTRAINT search_documents_entity_type_check;
ALTER TABLE search_documents ADD CONSTRAINT search_documents_entity_type_check
  CHECK (entity_type IN ('app', 'site', 'screen', 'flow', 'component', 'pattern'));

ALTER TABLE search_documents ADD CONSTRAINT search_documents_source_identity_check CHECK (
  (catalog_scope = 'apps' AND version_id IS NOT NULL AND app_id IS NOT NULL
    AND site_id IS NULL AND site_version_id IS NULL)
  OR
  (catalog_scope = 'sites' AND version_id IS NULL AND app_id IS NULL
    AND site_id IS NOT NULL AND site_version_id IS NOT NULL)
);

CREATE INDEX search_documents_scope_idx
  ON search_documents(index_version, catalog_scope, entity_type);
CREATE INDEX search_documents_site_sections_idx
  ON search_documents USING gin(site_sections);
CREATE INDEX search_documents_site_styles_idx
  ON search_documents USING gin(site_styles);

CREATE TABLE site_search_index_queue (
  site_id BIGINT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_search_index_queue_claim_idx
  ON site_search_index_queue(status, next_attempt_at, requested_at);

CREATE OR REPLACE FUNCTION enqueue_site_search_index(target_site_id BIGINT)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO site_search_index_queue(site_id)
  VALUES (target_site_id)
  ON CONFLICT (site_id) DO UPDATE SET
    status = 'queued', attempts = 0, next_attempt_at = now(),
    locked_by = NULL, locked_at = NULL, last_error = NULL,
    requested_at = now(), updated_at = now();
$$;

CREATE OR REPLACE FUNCTION enqueue_site_search_from_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_site_id BIGINT;
BEGIN
  target_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  PERFORM enqueue_site_search_index(target_site_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON site_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_version();

CREATE OR REPLACE FUNCTION enqueue_site_search_from_content()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_version_id BIGINT;
  target_page_id BIGINT;
  target_site_id BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'site_pages' THEN
    target_version_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  ELSE
    target_page_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.page_id ELSE NEW.page_id END;
    SELECT version_id INTO target_version_id FROM site_pages WHERE id = target_page_id;
  END IF;
  SELECT site_id INTO target_site_id FROM site_versions WHERE id = target_version_id;
  IF target_site_id IS NOT NULL THEN
    PERFORM enqueue_site_search_index(target_site_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_pages_search_queue
AFTER INSERT OR UPDATE OR DELETE ON site_pages
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_content();

CREATE TRIGGER site_sections_search_queue
AFTER INSERT OR UPDATE OR DELETE ON site_sections
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_content();

CREATE OR REPLACE FUNCTION enqueue_site_search_from_site()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM enqueue_site_search_index(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sites_search_queue
AFTER UPDATE OF name, description, categories, styles ON sites
FOR EACH ROW EXECUTE FUNCTION enqueue_site_search_from_site();

INSERT INTO site_search_index_queue(site_id)
SELECT DISTINCT site_id FROM site_versions WHERE status = 'ready'
ON CONFLICT (site_id) DO NOTHING;
```

- [ ] **Step 4: Implement the Site source loader and projector**

Add `publishedSiteSearchSource(siteId)` to `src/db.ts`. It must select only the newest `site_versions.status = 'ready'` row and return Site metadata, page titles, and section patterns from `source_metadata->'patterns'`.

Create `src/siteSearchProjection.ts` with:

```ts
export interface PublishedSiteSearchSource {
  site: {
    id: number;
    versionId: number;
    name: string;
    description: string;
    categories: string[];
    styles: string[];
    updatedAt: string;
  };
  pages: Array<{ title: string; sectionPatterns: string[] }>;
}

export function projectSiteSearchDocuments(
  source: PublishedSiteSearchSource,
): SearchDocument[] {
  const sections = unique(source.pages.flatMap(({ title, sectionPatterns }) => [
    title,
    ...sectionPatterns,
  ]));
  const document = {
    documentId: `site:${source.site.id}`,
    indexVersion: 1 as const,
    catalogScope: "sites" as const,
    catalogName: source.site.name,
    siteId: source.site.id,
    siteVersionId: source.site.versionId,
    platform: "web",
    entityType: "site" as const,
    sourceId: `site:${source.site.id}`,
    title: source.site.name,
    description: source.site.description,
    aliases: [],
    visibleText: "",
    components: [],
    states: [],
    layoutPatterns: [],
    appCategory: source.site.categories[0],
    catalogCategories: unique(source.site.categories),
    siteSections: sections,
    siteStyles: unique(source.site.styles),
    publishedAt: source.site.updatedAt,
    sourcePayload: { siteId: source.site.id, siteVersionId: source.site.versionId },
    searchText: text(
      source.site.name,
      source.site.description,
      source.site.categories,
      source.site.styles,
      sections,
    ),
  };
  return [{ ...document, sourceRevision: revision(document) }];
}
```

Export or share the small deterministic `unique`, `text`, and `revision` helpers from `searchProjection.ts` rather than duplicating them.

- [ ] **Step 5: Update App projection and run tests**

Ensure `baseDocument` sets:

```ts
catalogScope: "apps",
catalogName: source.version.app,
appName: source.version.app,
catalogCategories: source.version.category ? [source.version.category] : [],
siteSections: [],
siteStyles: [],
```

Run:

```bash
npx tsx --test src/searchProjection.test.ts src/siteSearchProjection.test.ts
```

Expected: PASS.

Commit:

```bash
git add migrations/0030_context_aware_search.sql src/db.ts src/searchProjection.ts src/searchProjection.test.ts src/siteSearchProjection.ts src/siteSearchProjection.test.ts
git commit -m "feat: index published Sites for search"
```

## Task 3: Index App and Site Jobs

**Files:**

- Modify: `src/searchIndexStore.ts`
- Create: `src/searchIndexStore.test.ts`
- Modify: `services/search-index-worker/src/pipeline.ts`
- Modify: `services/search-index-worker/src/pipeline.test.ts`
- Modify: `scripts/search-index-backfill.ts`

- [ ] **Step 1: Write failing union-job tests**

Define expected jobs:

```ts
const appJob = {
  kind: "app" as const,
  appId: 3,
  platform: "ios",
  attempts: 1,
  workerId: "worker-1",
};
const siteJob = {
  kind: "site" as const,
  siteId: 7,
  attempts: 1,
  workerId: "worker-1",
};
```

Assert the pipeline calls `projectSearchDocuments` for `appJob`, `projectSiteSearchDocuments` for `siteJob`, and replaces the matching scope without deleting the other catalog scope.

- [ ] **Step 2: Run worker/store tests and verify failure**

Run:

```bash
npx tsx --test src/searchIndexStore.test.ts services/search-index-worker/src/pipeline.test.ts
```

Expected: FAIL because only App jobs are supported.

- [ ] **Step 3: Generalize jobs and scopes**

Use discriminated unions:

```ts
export type SearchIndexJob =
  | { kind: "app"; appId: number; platform: string; attempts: number; workerId: string }
  | { kind: "site"; siteId: number; attempts: number; workerId: string };

export type SearchIndexScope =
  | { kind: "app"; appId: number; platform: string; indexVersion: 1 }
  | { kind: "site"; siteId: number; indexVersion: 1 };
```

`claim` first attempts the existing App queue transaction. If none is available, claim one row from `site_search_index_queue` with the same retry semantics. `loadSource`, `replaceDocuments`, `complete`, and `fail` branch only on `job.kind`.

For a Site scope, replace documents with:

```sql
DELETE FROM search_documents
WHERE catalog_scope = 'sites' AND site_id = $1 AND index_version = $2
```

Extend the JSON recordset insert with nullable App/Site identity, `catalog_scope`, `catalog_name`, `site_sections`, and `site_styles`.
Include `catalog_categories` in the same insert so every App and Site category participates in the existing `appCategory` request filter.

- [ ] **Step 4: Route pipeline projection**

In `processSearchIndexJob`:

```ts
const source = await input.store.loadSource(input.job);
const documents = !source
  ? []
  : input.job.kind === "app"
    ? projectSearchDocuments(source)
    : projectSiteSearchDocuments(source);
```

Update `scripts/search-index-backfill.ts` to enqueue both all published App versions and all ready Sites, reporting both counts.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx tsx --test src/searchIndexStore.test.ts services/search-index-worker/src/pipeline.test.ts services/search-index-worker/src/startup.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/searchIndexStore.ts src/searchIndexStore.test.ts services/search-index-worker/src/pipeline.ts services/search-index-worker/src/pipeline.test.ts scripts/search-index-backfill.ts
git commit -m "feat: process Site search index jobs"
```

## Task 4: Scope-Aware Search API, Authorization, and Facets

**Files:**

- Modify: `src/searchStore.ts`
- Create: `src/searchStore.test.ts`
- Modify: `services/api/src/search.ts`
- Modify: `services/api/src/search.test.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Write failing request and authorization tests**

Add API parsing tests:

```ts
test("accepts scoped Site filters", () => {
  const request = searchRequestFromExpressQuery({
    q: "pricing",
    scope: "sites",
    type: "site",
    siteSection: ["Pricing"],
    siteStyle: "Minimal",
  });
  assert.equal(request.scope, "sites");
  assert.deepEqual(request.filters.siteSection, ["Pricing"]);
});

test("rejects unknown search scope", () => {
  assert.throws(
    () => searchRequestFromExpressQuery({ scope: "private" }),
    /invalid search scope/,
  );
});
```

Add store SQL tests that assert:

- `scope=apps` includes `d.catalog_scope = 'apps'`.
- `scope=sites` includes `d.catalog_scope = 'sites'`.
- `scope=all` contains neither scope restriction.
- `publishedOnly` authorizes App documents through published `app_versions` and Site documents through ready `site_versions`.
- `allowedAppIds` does not remove authorized Site documents.
- Site facets use `site_sections` and `site_styles`.

- [ ] **Step 2: Run API/store tests and verify failure**

Run:

```bash
npx tsx --test services/api/src/search.test.ts src/searchStore.test.ts
```

Expected: FAIL because scope and Site filter columns are unsupported.

- [ ] **Step 3: Extend request validation**

Add `siteSection` and `siteStyle` to `FILTER_KEYS`. Validate `scope` against `SEARCH_SCOPES`.

Include scope in telemetry and cursor fingerprints:

```ts
export interface SearchTelemetryEvent {
  requestId: string;
  action: "adaptive-search";
  scope: SearchScope;
  // retain existing fields
}
```

- [ ] **Step 4: Implement authorized scope/filter SQL**

Extend `FILTER_COLUMNS`, and point the existing category filter at the normalized category array:

```ts
appCategory: { expression: "d.catalog_categories", array: true },
siteSection: { expression: "d.site_sections", array: true },
siteStyle: { expression: "d.site_styles", array: true },
```

At the beginning of `authorizedWhere`, add:

```ts
if (request.scope !== "all") {
  clauses.push(`d.catalog_scope = ${parameters.add(request.scope)}`);
}
```

Replace the published-only clause with:

```sql
(
  (d.catalog_scope = 'apps' AND EXISTS (
    SELECT 1 FROM app_versions av
    WHERE av.id = d.version_id AND av.status = 'published'
  ))
  OR
  (d.catalog_scope = 'sites' AND EXISTS (
    SELECT 1 FROM site_versions sv
    WHERE sv.id = d.site_version_id AND sv.status = 'ready'
  ))
)
```

When `allowedAppIds` exists, use:

```sql
(d.catalog_scope = 'sites' OR d.app_id = ANY($n::integer[]))
```

Map optional App/Site identifiers in `rowToItem`, and use `catalog_name` for sorting and display. Return zero-filled type counts including `site`.

Extend `hydrateSearchMedia` so a Site result receives the existing authorized preview route without storing a private object key:

```ts
const siteImageUrl = item.catalogScope === "sites" && item.siteId && item.siteVersionId
  ? `/api/sites/${item.siteId}/versions/${item.siteVersionId}/media/preview`
  : undefined;
```

Use this route for `imageUrl` and `thumbnailUrl`. Continue stripping URL/object-key fields from `sourcePayload`.

- [ ] **Step 5: Verify API and public boundary**

Run:

```bash
npx tsx --test services/api/src/search.test.ts src/searchStore.test.ts src/searchTypes.test.ts
```

Expected: PASS, including the test proving public Site facets are computed only from ready Site versions.

Commit:

```bash
git add src/searchStore.ts src/searchStore.test.ts services/api/src/search.ts services/api/src/search.test.ts services/api/src/app.ts
git commit -m "feat: search Apps and Sites by scoped facets"
```

## Task 5: Shared Search URL and Client API

**Files:**

- Modify: `src/vitrine/searchState.ts`
- Modify: `src/vitrine/searchState.test.ts`
- Modify: `src/vitrine/advancedSearchApi.ts`
- Modify: `src/vitrine/advancedSearchApi.test.ts`
- Modify: `src/vitrine/useAdvancedSearch.ts`
- Modify: `src/vitrine/useAdvancedSearch.test.ts`

- [ ] **Step 1: Write failing state and request tests**

Add:

```ts
test("round-trips scope and Site filters", () => {
  const state: SearchPageState = {
    ...defaultSearchState,
    query: "pricing",
    scope: "sites",
    type: "site",
    filters: {
      ...emptySearchFilters,
      siteSection: ["FAQ", "Pricing"],
      siteStyle: ["Minimal"],
    },
  };
  assert.deepEqual(parseSearchState(serializeSearchState(state)), state);
});

test("sends scope and repeated Site filters", async () => {
  await searchAdvancedCatalog({
    ...defaultSearchState,
    scope: "sites",
    filters: {
      ...emptySearchFilters,
      siteSection: ["FAQ", "Pricing"],
    },
  });
  assert.equal(
    requested,
    "/api/search?scope=sites&type=all&siteSection=FAQ&siteSection=Pricing&sort=relevance&limit=24",
  );
});
```

Add a controller test proving `view.result` remains the previous result while `loading` becomes true for a replacement request.

- [ ] **Step 2: Run client tests and verify failure**

Run:

```bash
npx tsx --test src/vitrine/searchState.test.ts src/vitrine/advancedSearchApi.test.ts src/vitrine/useAdvancedSearch.test.ts
```

Expected: FAIL because scope/Site fields are not serialized and replacement searches discard their loading context.

- [ ] **Step 3: Extend shared state and API serialization**

Add `scope: SearchScope` to `SearchPageState` and default it to `all`. Include `scope` in `parseSearchState` and `serializeSearchState`.

Add the two Site filter keys to both `emptySearchFilters` and the client `filterKeys` list. Always send `scope` in `searchAdvancedCatalog`.

Change the search controller replacement update to:

```ts
update({
  revision,
  error: "",
  loading: !append,
  loadingMore: append,
  result: view.result,
});
```

This explicitly retains current results while a replacement request is in flight.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npx tsx --test src/vitrine/searchState.test.ts src/vitrine/advancedSearchApi.test.ts src/vitrine/useAdvancedSearch.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/searchState.ts src/vitrine/searchState.test.ts src/vitrine/advancedSearchApi.ts src/vitrine/advancedSearchApi.test.ts src/vitrine/useAdvancedSearch.ts src/vitrine/useAdvancedSearch.test.ts
git commit -m "feat: share scoped search URL state"
```

## Task 6: In-Memory Search Session and Gallery Handoff

**Files:**

- Create: `src/vitrine/searchSession.ts`
- Create: `src/vitrine/searchSession.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/components/SitesPage.tsx`

- [ ] **Step 1: Write failing session tests**

Add:

```ts
test("opens in gallery context and preserves compatible filters", () => {
  const session = createSearchSession({
    ...defaultSearchState,
    scope: "apps",
    filters: {
      ...emptySearchFilters,
      platform: ["web"],
      appCategory: ["Finance"],
    },
  });

  session.open("sites", {
    appCategory: ["Finance"],
    siteSection: ["Pricing"],
  });

  assert.equal(session.snapshot().open, true);
  assert.equal(session.snapshot().state.scope, "sites");
  assert.deepEqual(session.snapshot().state.filters.appCategory, ["Finance"]);
  assert.deepEqual(session.snapshot().state.filters.platform, []);
  assert.deepEqual(session.snapshot().state.filters.siteSection, ["Pricing"]);
});

test("closing and reopening retains session filters", () => {
  const session = createSearchSession(defaultSearchState);
  session.open("apps", { platform: ["ios"] });
  session.close();
  session.open("apps");
  assert.deepEqual(session.snapshot().state.filters.platform, ["ios"]);
});
```

- [ ] **Step 2: Run session and boundary tests**

Run:

```bash
npx tsx --test src/vitrine/searchSession.test.ts src/vitrine/App.boundary.test.ts
```

Expected: FAIL because the shared session and context handoff do not exist.

- [ ] **Step 3: Implement the framework-neutral session**

Create a small observable store with:

```ts
export interface SearchSessionSnapshot {
  open: boolean;
  state: SearchPageState;
}

export function createSearchSession(initial: SearchPageState) {
  let snapshot = { open: false, state: initial };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    snapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(scope: SearchScope, seed: Partial<SearchFilters> = {}) {
      const filters = compatibleSearchFilters(scope, snapshot.state.filters);
      snapshot = {
        open: true,
        state: {
          ...snapshot.state,
          scope,
          filters: { ...filters, ...seed },
        },
      };
      emit();
    },
    update(state: SearchPageState) {
      snapshot = { ...snapshot, state };
      emit();
    },
    close() {
      snapshot = { ...snapshot, open: false };
      emit();
    },
  };
}
```

Normalize seeded arrays through a shared canonical filter helper before storing them.

- [ ] **Step 4: Own the session in App and seed gallery context**

Replace separate palette-open/search-state coordination with one stable session instance. Pass:

```tsx
onOpenSearch={(seed) => searchSession.open("apps", seed)}
```

from Apps and:

```tsx
onOpenSearch={(seed) => searchSession.open("sites", seed)}
```

from Sites.

Apps seeds current platform and taxonomy. Sites seeds its active taxonomy. Do not make either gallery own the other gallery's filters.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx tsx --test src/vitrine/searchSession.test.ts src/vitrine/App.boundary.test.ts src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: PASS for session ownership, default contexts, and gallery isolation.

Commit:

```bash
git add src/vitrine/searchSession.ts src/vitrine/searchSession.test.ts src/vitrine/App.tsx src/vitrine/App.boundary.test.ts src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/components/SitesPage.tsx
git commit -m "feat: share search session across galleries"
```

## Task 7: Quick Search Filter Controls

**Files:**

- Create: `src/vitrine/components/QuickSearchFilters.tsx`
- Create: `src/vitrine/QuickSearchFilters.test.tsx`
- Modify: `src/vitrine/components/QuickSearch.tsx`
- Modify: `src/vitrine/QuickSearch.test.tsx`
- Modify: `src/vitrine/components/ActiveSearchFilters.tsx`
- Modify: `src/vitrine/components/AdvancedSearchFilters.tsx`
- Modify: `src/vitrine/components/AdvancedSearchFilterDrawer.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing accessible markup tests**

Render the controls with facet counts and assert:

```ts
assert.match(html, /role="tablist" aria-label="Search scope"/);
assert.match(html, /role="tab"[^>]+aria-selected="true"[^>]*>Apps/);
assert.match(html, />Platform</);
assert.match(html, />Category</);
assert.match(html, />More filters</);
assert.match(html, /aria-label="Active search filters"/);
assert.match(html, />Clear all</);
```

Add Quick Search behavior tests with a fake client:

- Selecting Platform=iOS immediately calls the client with `filters.platform = ["ios"]`.
- Scope switching to Sites removes Platform and reveals Sections/Styles.
- A failed replacement preserves the previous results, selected filters, and Retry action.
- Retry uses the exact current state.

- [ ] **Step 2: Run component tests and verify failure**

Run:

```bash
npx tsx --test src/vitrine/QuickSearchFilters.test.tsx src/vitrine/QuickSearch.test.tsx
```

Expected: FAIL because Quick Search has no scope or filters.

- [ ] **Step 3: Build context-aware filter controls**

`QuickSearchFilters` receives:

```ts
interface QuickSearchFiltersProps {
  state: SearchPageState;
  facets: SearchFacets;
  onChange(state: SearchPageState): void;
  onOpenMore(): void;
}
```

Render three scope buttons with `role="tab"`. Render only `quickFilterKeys(state.scope)`. Each chip opens a menu containing facet options with counts. Updating a value calls:

```ts
onChange({
  ...state,
  filters: {
    ...state.filters,
    [key]: toggleFilterValue(state.filters[key], value),
  },
});
```

Reuse `ActiveSearchFilters` for removable pills and Clear all. Extend `AdvancedSearchFilters` with an optional `keys` prop so the More filters drawer can pass only compatible fields.

When scope is `all`, render Result type as a separate quick chip backed by `result.typeCounts`; it updates `state.type` rather than a `SearchFilters` key. Add `site: "Sites"` to the grouped-result labels.

- [ ] **Step 4: Integrate immediate filtered search**

Change `QuickSearch` to receive controlled session state:

```ts
interface QuickSearchProps {
  state: SearchPageState;
  onStateChange(state: SearchPageState): void;
  onClose(): void;
  onPreview(item: SearchResultItem): void;
  onViewAll(state: SearchPageState): void;
}
```

Use `useAdvancedSearch(state)` so existing debounce, cancellation, retained results, Retry, and facets are shared with the full page. Remove Quick Search's duplicate query/result/loading/error fetch state.

Open `AdvancedSearchFilterDrawer` from More filters. Apply every drawer change immediately by calling `onStateChange`; close is the only footer action.

- [ ] **Step 5: Add responsive styles**

Add focused classes:

```css
.quick-search__scope,
.quick-search__quick-filters,
.quick-search__active-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
}

.quick-search__filter-chip,
.quick-search__scope button,
.quick-search__active-filters button {
  white-space: nowrap;
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.quick-search__results[aria-busy='true'] {
  opacity: .72;
}
```

At narrow widths, keep chips horizontally scrollable and render More filters as the final stable chip. Honor the existing reduced-motion rules.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npx tsx --test src/vitrine/QuickSearchFilters.test.tsx src/vitrine/QuickSearch.test.tsx src/vitrine/AdvancedSearchComponents.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/components/QuickSearchFilters.tsx src/vitrine/QuickSearchFilters.test.tsx src/vitrine/components/QuickSearch.tsx src/vitrine/QuickSearch.test.tsx src/vitrine/components/ActiveSearchFilters.tsx src/vitrine/components/AdvancedSearchFilters.tsx src/vitrine/components/AdvancedSearchFilterDrawer.tsx src/vitrine/styles.css
git commit -m "feat: filter Quick Search by gallery context"
```

## Task 8: Trigger Count and Full Search Handoff

**Files:**

- Modify: `src/vitrine/components/SearchTrigger.tsx`
- Create: `src/vitrine/SearchTrigger.test.tsx`
- Modify: `src/vitrine/components/AdvancedSearchPage.tsx`
- Modify: `src/vitrine/AdvancedSearchPage.test.tsx`
- Modify: `src/vitrine/components/QuickSearch.tsx`
- Modify: `src/vitrine/QuickSearch.test.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/SearchResultCard.tsx`
- Modify: `src/vitrine/components/AdvancedSearchResults.tsx`
- Modify: `src/vitrine/components/SearchResearchActions.tsx`

- [ ] **Step 1: Write failing trigger and handoff tests**

Assert:

```ts
const html = renderToStaticMarkup(
  <SearchTrigger
    label="Search on Web..."
    activeCategory="All"
    activeFilterCount={3}
    onOpen={() => undefined}
    onClearCategory={() => undefined}
  />,
);
assert.match(html, /Search on Web\.\.\. · 3 filters/);
```

Extend `quickSearchHandoff`:

```ts
const handoff = quickSearchHandoff({
  ...defaultSearchState,
  query: "pricing",
  scope: "sites",
  filters: {
    ...emptySearchFilters,
    siteSection: ["Pricing"],
  },
});
assert.equal(handoff.route.name, "search");
assert.match(handoff.search, /scope=sites/);
assert.match(handoff.search, /siteSection=Pricing/);
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npx tsx --test src/vitrine/SearchTrigger.test.tsx src/vitrine/QuickSearch.test.tsx src/vitrine/AdvancedSearchPage.test.tsx
```

Expected: FAIL because the trigger lacks a count and the handoff serializes only query text.

- [ ] **Step 3: Show active filter count**

Add `activeFilterCount?: number` to `SearchTrigger`. Build the display label without changing the accessible action name:

```ts
const displayLabel = activeFilterCount
  ? `${label} · ${activeFilterCount} ${activeFilterCount === 1 ? "filter" : "filters"}`
  : label;
```

Apps and Sites pass `activeFilterCount(searchSession.state.filters)`.

- [ ] **Step 4: Serialize complete handoff**

Change:

```ts
export function quickSearchHandoff(state: SearchPageState) {
  return { route: { name: "search" } as const, search: serializeSearchState(state) };
}
```

`AdvancedSearchPage` initializes from the serialized URL and uses the same scope-aware filter keys and active pills. Scope tabs and More filters must render the same selected values after reload.

Add Sites to the result-type tabs and render Site result cards with `catalogName` plus the Site preview route. App-only compare controls render only when `item.catalogScope === "apps"` and `item.appId` is defined; Site results never enter `addComparisonSelection`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx tsx --test src/vitrine/SearchTrigger.test.tsx src/vitrine/QuickSearch.test.tsx src/vitrine/AdvancedSearchPage.test.tsx src/vitrine/searchState.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/components/SearchTrigger.tsx src/vitrine/SearchTrigger.test.tsx src/vitrine/components/AdvancedSearchPage.tsx src/vitrine/AdvancedSearchPage.test.tsx src/vitrine/components/QuickSearch.tsx src/vitrine/QuickSearch.test.tsx src/vitrine/App.tsx src/vitrine/components/SearchResultCard.tsx src/vitrine/components/AdvancedSearchResults.tsx src/vitrine/components/SearchResearchActions.tsx
git commit -m "feat: preserve filtered search handoff"
```

## Task 9: End-to-End Security and Regression Verification

**Files:**

- Modify: `services/api/src/search.test.ts`
- Modify: `src/searchStore.test.ts`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `docs/superpowers/specs/2026-07-25-context-aware-search-filters-design.md` only if implementation reveals a necessary correction

- [ ] **Step 1: Add final boundary tests**

Cover:

```ts
test("public All scope excludes unpublished Apps and non-ready Sites", async () => {
  const result = await service.search(
    normalizeSearchRequest({ scope: "all", q: "" }),
    { publishedOnly: true },
  );
  assert.deepEqual(
    result.items.map(({ catalogScope, catalogName }) => [catalogScope, catalogName]),
    [["apps", "Published App"], ["sites", "Ready Site"]],
  );
});
```

Add gallery boundary assertions that opening from Apps passes Apps scope/platform/taxonomy, opening from Sites passes Sites scope/taxonomy, and neither gallery receives the other gallery's local state.

- [ ] **Step 2: Run the complete targeted suite**

Run:

```bash
npx tsx --test \
  src/searchTypes.test.ts \
  src/searchScope.test.ts \
  src/searchProjection.test.ts \
  src/siteSearchProjection.test.ts \
  src/searchIndexStore.test.ts \
  src/searchStore.test.ts \
  services/api/src/search.test.ts \
  services/search-index-worker/src/pipeline.test.ts \
  src/vitrine/searchState.test.ts \
  src/vitrine/searchSession.test.ts \
  src/vitrine/advancedSearchApi.test.ts \
  src/vitrine/useAdvancedSearch.test.ts \
  src/vitrine/QuickSearchFilters.test.tsx \
  src/vitrine/QuickSearch.test.tsx \
  src/vitrine/AdvancedSearchPage.test.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/Sites.test.tsx \
  src/vitrine/App.boundary.test.ts
```

Expected: all targeted tests PASS with zero failures.

- [ ] **Step 3: Run production verification**

Run:

```bash
npm run build
git diff --check
```

Expected: Vite build exits 0. The existing large-chunk warning is acceptable; no new build errors or whitespace errors are acceptable.

- [ ] **Step 4: Verify the local interaction**

At `http://127.0.0.1:5173/apps`:

1. Open Search and confirm Apps is selected.
2. Select iOS and one Category; confirm results update without clearing current results during loading.
3. Close and reopen; confirm filters remain and the trigger reports two active filters.
4. Switch to Sites; confirm Platform is removed and Sections/Styles appear.
5. Select Pricing, use View all, and confirm `/search` contains `scope=sites&siteSection=Pricing`.
6. Reload and confirm the full Search page restores the same scope and filter.
7. Use a guest session and confirm unpublished Apps and non-ready Sites never appear in results or facet counts.

- [ ] **Step 5: Commit final regression coverage**

```bash
git add services/api/src/search.test.ts src/searchStore.test.ts src/vitrine/App.boundary.test.ts src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
git commit -m "test: verify context-aware search boundaries"
```

## Completion Checklist

- [ ] Search defaults to Apps when opened from Apps.
- [ ] Search defaults to Sites when opened from Sites.
- [ ] All scope searches authorized Apps and Sites.
- [ ] Quick chips are context-sensitive and facet-backed.
- [ ] More filters exposes every compatible canonical field.
- [ ] Filter changes update immediately.
- [ ] Current results remain visible while replacements load.
- [ ] Retry retains query, scope, filters, and previous results.
- [ ] Closing and reopening retains session state.
- [ ] Scope switching removes only incompatible filters.
- [ ] Trigger displays the active-filter count.
- [ ] View all serializes the complete state.
- [ ] Full Search restores the state after reload.
- [ ] Public results and facet counts exclude unpublished content.
- [ ] Apps and Sites gallery-local state remain isolated.
- [ ] Targeted tests, production build, and `git diff --check` pass.
