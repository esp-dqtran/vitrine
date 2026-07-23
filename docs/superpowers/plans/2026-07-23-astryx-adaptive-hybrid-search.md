# Astryx Adaptive Hybrid Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-request in-memory catalog matching with a feature-flagged PostgreSQL hybrid search index, then expose it through a dedicated `/search` experience and an upgraded Quick Search.

**Architecture:** PostgreSQL stores one normalized, versioned search document per published App, Screen, Flow, UI Element, or Pattern, with a generated full-text vector and a 1,536-dimension semantic vector. A database-backed worker projects and embeds changed published app/platform versions; the API combines exact/full-text and vector candidates with deterministic reciprocal-rank fusion, applies access constraints before counts, and falls back to keyword retrieval when embeddings fail. The frontend keeps Quick Search for grouped top results and adds a URL-driven Advanced Search page for multi-select filters, cursor pagination, previews, collections, projects, and comparison.

**Tech Stack:** TypeScript, Node.js, PostgreSQL 17, Supabase pgvector, `pg`, Express 5, React 19, Vite 8, `@astryxdesign/core`, Node test runner, React server rendering

---

## Execution Preconditions

- Execute this plan in a dedicated worktree created with `superpowers:using-git-worktrees`. Do not execute it in the current dirty main checkout.
- Base the worktree on the commit containing this plan and the approved design.
- Preserve the current deterministic `searchCatalog()` path until Task 14 completes the rollback gate.
- Do not add Sites, tokens, project-document search, personalized ranking, uploaded-image search, or conversational answers.
- Do not add `GET /api/jobs` reads to Apps or Search UI.
- Confirm the target Supabase database allows `CREATE EXTENSION vector` before applying migration `0017`.
- Set production embedding credentials through secrets; never commit API keys.

## File Map

### Database and indexing

- Modify `docker-compose.yml`: use a PostgreSQL image with pgvector for the local rollback database and add the search-index worker.
- Create `migrations/0017_adaptive_search.sql`: vector extension, search documents, index queue, indexes, and queue triggers.
- Create `src/searchTypes.ts`: shared search request, response, document, cursor, and facet contracts.
- Create `src/searchTypes.test.ts`: normalization, filter semantics, cursor, and rank-fusion tests.
- Create `src/searchProjection.ts`: pure published-version-to-document projection.
- Create `src/searchProjection.test.ts`: App, Screen, Flow, UI Element, and Pattern projection fixtures.
- Create `src/searchEmbedding.ts`: embedding provider interface, OpenAI-compatible adapter, batching, and vector validation.
- Create `src/searchEmbedding.test.ts`: adapter, dimension, batching, and failure tests.
- Create `src/searchConfig.ts`: validated shared Advanced Search and embedding configuration.
- Create `src/searchConfig.test.ts`: feature-flag, URL, key, and model configuration tests.
- Create `src/searchIndexStore.ts`: queue claiming, published-source loading, document replacement, retry, and backfill.
- Create `src/searchIndexStore.test.ts`: PostgreSQL integration tests for index lifecycle and queue safety.
- Create `services/search-index-worker/src/pipeline.ts`: one-job indexing pipeline.
- Create `services/search-index-worker/src/pipeline.test.ts`: success, stale version, embedding failure, and retry tests.
- Create `services/search-index-worker/src/start.ts`: worker lifecycle.
- Create `services/search-index-worker/src/startup.test.ts`: migration-before-consume startup contract.
- Create `services/search-index-worker/src/index.ts`: environment wiring.
- Create `services/search-index-worker/Dockerfile`: production worker image.
- Create `scripts/search-index-backfill.ts`: restartable enqueue-only backfill.

### Retrieval and API

- Create `src/searchStore.ts`: exact/full-text/vector retrieval, authorized facets, suggestions, cursor pagination, and index health.
- Create `src/searchStore.test.ts`: PostgreSQL integration tests for ranking, filters, facets, cursor stability, and authorization.
- Create `services/api/src/search.ts`: request parsing, feature switch, fallback orchestration, and safe telemetry.
- Create `services/api/src/search.test.ts`: service-level hybrid/fallback tests.
- Modify `services/api/src/index.ts`: construct search dependencies.
- Modify `services/api/src/app.ts`: route `/search` and `/search/suggestions` through the new service behind the backend flag.
- Modify `services/api/src/app.test.ts`: endpoint validation, plan gate, fallback, no-leak, and pagination tests.

### Frontend

- Create `src/vitrine/searchState.ts`: query-string parsing, canonical serialization, applied/draft filters, and local history.
- Create `src/vitrine/searchState.test.ts`: URL and local-history model tests.
- Create `src/vitrine/advancedSearchApi.ts`: typed search and suggestion clients.
- Create `src/vitrine/advancedSearchApi.test.ts`: repeated filter, cursor, abort, and error tests.
- Modify `src/vitrine/router.ts`: add `/search`.
- Modify `src/vitrine/router.test.ts`: search route tests.
- Create `src/vitrine/useAdvancedSearch.ts`: cancellation, debounce, stale-response protection, append, and retry state.
- Create `src/vitrine/useAdvancedSearch.test.ts`: request state-machine tests.
- Create `src/vitrine/components/AdvancedSearchPage.tsx`: URL-driven page coordinator.
- Create `src/vitrine/AdvancedSearchPage.test.tsx`: page contract and state restoration tests.
- Create `src/vitrine/components/AdvancedSearchFilters.tsx`: desktop multi-select filter groups.
- Create `src/vitrine/components/AdvancedSearchFilterDrawer.tsx`: narrow-screen draft/apply behavior.
- Create `src/vitrine/components/ActiveSearchFilters.tsx`: removable filter chips and Clear all.
- Create `src/vitrine/components/AdvancedSearchResults.tsx`: ranked stream, empty/error states, and Load more.
- Create `src/vitrine/components/SearchResultCard.tsx`: type-specific factual cards.
- Create `src/vitrine/AdvancedSearchComponents.test.tsx`: component rendering and accessibility contracts.
- Create `src/vitrine/components/AdvancedSearchPreview.tsx`: preview, related evidence, and source navigation.
- Create `src/vitrine/components/SearchResearchActions.tsx`: collection, project/lane, and comparison actions.
- Create `src/vitrine/SearchResearchActions.test.tsx`: mutation payload and entitlement tests.
- Create `src/vitrine/components/QuickSearch.tsx`: recent searches, suggestions, grouped results, and View all.
- Create `src/vitrine/QuickSearch.test.tsx`: keyboard, history, and handoff tests.
- Modify `src/vitrine/App.tsx`: render `/search`, wire Quick Search, and remove page-level ownership of legacy search state when the frontend flag is on.
- Modify `src/vitrine/App.boundary.test.ts`: enforce component boundaries and prohibit Search-page job polling.
- Modify `src/vitrine/components/SearchTrigger.tsx`: open Quick Search under the frontend flag.
- Modify `src/vitrine/components/Sidebar.tsx`: add Search navigation under the frontend flag.
- Modify `src/vitrine/styles.css`: responsive search grid, drawer, preview, tray, focus, and reduced-motion styles.

### Verification and operations

- Create `data/search-relevance-benchmark.json`: curated exact, intent, flow, visible-text, zero-result, and authorization cases.
- Create `scripts/verify-search-relevance.ts`: benchmark runner and 85% top-five gate.
- Create `scripts/benchmark-search-performance.ts`: production-shaped search and suggestion latency runner.
- Create `src/searchBenchmark.test.ts`: fixture/schema tests.
- Modify `package.json`: worker, backfill, and relevance scripts.
- Modify `.env.example`: backend/frontend flags and embedding configuration.
- Modify `README.md`: indexing, backfill, verification, rollout, and rollback commands.

## Task 1: Add the Versioned pgvector Search Schema

**Files:**

- Create: `migrations/0017_adaptive_search.sql`
- Modify: `docker-compose.yml`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write the failing migration integration test**

Add this test after the existing current-schema assertions in `src/migrations.test.ts`:

```ts
test("adaptive search migration creates versioned documents and a deduplicated queue", async (t) => {
  if (postgresSkipReason) return t.skip(postgresSkipReason);
  await applyMigrations(pool);

  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'search_documents' ORDER BY column_name`,
  );
  assert.ok(columns.rows.some(({ column_name }) => column_name === "embedding"));
  assert.ok(columns.rows.some(({ column_name }) => column_name === "search_vector"));

  const queueKey = await pool.query<{ constraint_name: string }>(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_name = 'search_index_queue' AND constraint_type = 'PRIMARY KEY'`,
  );
  assert.equal(queueKey.rowCount, 1);
});
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: FAIL because `search_documents` does not exist.

- [ ] **Step 3: Use pgvector in the local PostgreSQL service**

In `docker-compose.yml`, replace:

```yaml
image: postgres:17-alpine
```

with:

```yaml
image: pgvector/pgvector:pg17
```

This affects only the opt-in `legacy-db` profile. Supabase remains the live database.

- [ ] **Step 4: Create the migration**

Create `migrations/0017_adaptive_search.sql` with:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE search_documents (
  document_id TEXT NOT NULL,
  index_version INTEGER NOT NULL DEFAULT 1 CHECK (index_version > 0),
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('app', 'screen', 'flow', 'component', 'pattern')),
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  aliases TEXT[] NOT NULL DEFAULT '{}',
  visible_text TEXT NOT NULL DEFAULT '',
  page_type TEXT,
  product_area TEXT,
  flow_id TEXT,
  flow_name TEXT,
  flow_step_index INTEGER CHECK (flow_step_index IS NULL OR flow_step_index >= 0),
  components TEXT[] NOT NULL DEFAULT '{}',
  states TEXT[] NOT NULL DEFAULT '{}',
  theme TEXT CHECK (theme IS NULL OR theme IN ('light', 'dark', 'mixed')),
  layout_patterns TEXT[] NOT NULL DEFAULT '{}',
  app_category TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ,
  media_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_payload) = 'object'),
  search_text TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED,
  embedding VECTOR(1536),
  source_revision TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (index_version, document_id),
  UNIQUE (index_version, entity_type, source_id)
);

CREATE INDEX search_documents_vector_hnsw_idx
  ON search_documents USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
CREATE INDEX search_documents_fts_idx ON search_documents USING gin (search_vector);
CREATE INDEX search_documents_type_idx ON search_documents(index_version, entity_type);
CREATE INDEX search_documents_app_idx ON search_documents(index_version, app_id, platform);
CREATE INDEX search_documents_components_idx ON search_documents USING gin (components);
CREATE INDEX search_documents_states_idx ON search_documents USING gin (states);
CREATE INDEX search_documents_layouts_idx ON search_documents USING gin (layout_patterns);
CREATE INDEX search_documents_filters_idx
  ON search_documents(index_version, platform, app_category, page_type, product_area, theme);

CREATE TABLE search_index_queue (
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, platform)
);
CREATE INDEX search_index_queue_claim_idx
  ON search_index_queue(status, next_attempt_at, requested_at);

CREATE OR REPLACE FUNCTION enqueue_search_index(target_app_id INTEGER, target_platform TEXT)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO search_index_queue (app_id, platform, status, attempts, next_attempt_at, requested_at, updated_at)
  VALUES (target_app_id, target_platform, 'queued', 0, now(), now(), now())
  ON CONFLICT (app_id, platform) DO UPDATE SET
    status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    locked_by = NULL,
    locked_at = NULL,
    last_error = NULL,
    requested_at = now(),
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION enqueue_search_from_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM enqueue_search_index(OLD.app_id, OLD.platform);
    RETURN OLD;
  END IF;
  PERFORM enqueue_search_index(NEW.app_id, NEW.platform);
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON app_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version();

CREATE OR REPLACE FUNCTION enqueue_search_from_version_child()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_version_id INTEGER := COALESCE(NEW.version_id, OLD.version_id);
  target_app_id INTEGER;
  target_platform TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_version_id := OLD.version_id;
  ELSE
    target_version_id := NEW.version_id;
  END IF;
  SELECT app_id, platform INTO target_app_id, target_platform FROM app_versions WHERE id = target_version_id;
  IF target_app_id IS NOT NULL THEN
    PERFORM enqueue_search_index(target_app_id, target_platform);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER version_images_search_queue
AFTER INSERT OR UPDATE OR DELETE ON version_images
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();
CREATE TRIGGER design_system_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON design_system_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();
CREATE TRIGGER app_flow_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON app_flow_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();

CREATE OR REPLACE FUNCTION enqueue_search_from_image()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_image_id INTEGER;
  target RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN target_image_id := OLD.id; ELSE target_image_id := NEW.id; END IF;
  FOR target IN
    SELECT DISTINCT av.app_id, av.platform
    FROM version_images vi JOIN app_versions av ON av.id = vi.version_id
    WHERE vi.image_id = target_image_id AND av.status = 'published'
  LOOP
    PERFORM enqueue_search_index(target.app_id, target.platform);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER images_search_queue
AFTER UPDATE OF description, analysis, kind ON images
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_image();

CREATE OR REPLACE FUNCTION enqueue_search_from_app()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_platform TEXT;
BEGIN
  FOR target_platform IN SELECT DISTINCT platform FROM app_versions WHERE app_id = NEW.id
  LOOP
    PERFORM enqueue_search_index(NEW.id, target_platform);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER apps_search_queue
AFTER UPDATE OF name, category ON apps
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_app();

INSERT INTO search_index_queue (app_id, platform)
SELECT DISTINCT app_id, platform FROM app_versions WHERE status = 'published'
ON CONFLICT (app_id, platform) DO NOTHING;
```

- [ ] **Step 5: Run migration verification**

Run:

```bash
npm run db:check
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations/0017_adaptive_search.sql docker-compose.yml src/migrations.test.ts
git commit -m "feat: add adaptive search schema"
```

## Task 2: Define Search Contracts, Filter Semantics, Cursors, and Rank Fusion

**Files:**

- Create: `src/searchTypes.ts`
- Create: `src/searchTypes.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `src/searchTypes.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeSearchCursor,
  encodeSearchCursor,
  fuseSearchRanks,
  normalizeSearchRequest,
} from "./searchTypes.ts";

test("normalizes OR values within filter groups without changing the visible query", () => {
  const request = normalizeSearchRequest({
    q: " dark mobile checkout ",
    type: "all",
    platform: ["ios", "android", "ios"],
    component: ["Modal", "Bottom sheet"],
    limit: "500",
  });
  assert.equal(request.query, "dark mobile checkout");
  assert.deepEqual(request.filters.platform, ["android", "ios"]);
  assert.deepEqual(request.filters.component, ["Bottom sheet", "Modal"]);
  assert.equal(request.limit, 48);
});

test("cursor binds search state and final sort values", () => {
  const encoded = encodeSearchCursor({
    fingerprint: "abc",
    indexVersion: 1,
    sort: "relevance",
    values: [0.75, "screen:7"],
  });
  assert.deepEqual(decodeSearchCursor(encoded), {
    fingerprint: "abc",
    indexVersion: 1,
    sort: "relevance",
    values: [0.75, "screen:7"],
  });
});

test("reciprocal-rank fusion rewards candidates present in both lists", () => {
  const fused = fuseSearchRanks([
    ["screen:exact", "screen:both"],
    ["screen:both", "screen:semantic"],
  ]);
  assert.equal(fused[0].documentId, "screen:both");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/searchTypes.test.ts
```

Expected: FAIL because `searchTypes.ts` does not exist.

- [ ] **Step 3: Add the complete shared contracts**

Create `src/searchTypes.ts` with these exported types and constants:

```ts
import { createHash } from "node:crypto";

export const SEARCH_ENTITY_TYPES = ["app", "screen", "flow", "component", "pattern"] as const;
export type SearchEntityType = typeof SEARCH_ENTITY_TYPES[number];
export type SearchType = SearchEntityType | "all";
export type SearchSort = "relevance" | "recent" | "app-az";

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
}

export interface NormalizedSearchRequest {
  query: string;
  type: SearchType;
  filters: SearchFilters;
  sort: SearchSort;
  cursor?: string;
  limit: number;
}

export interface SearchDocument {
  documentId: string;
  indexVersion: 1;
  versionId: number;
  appId: number;
  appName: string;
  platform: string;
  entityType: SearchEntityType;
  sourceId: string;
  title: string;
  description: string;
  aliases: string[];
  visibleText: string;
  pageType?: string;
  productArea?: string;
  flowId?: string;
  flowName?: string;
  flowStepIndex?: number;
  components: string[];
  states: string[];
  theme?: "light" | "dark" | "mixed";
  layoutPatterns: string[];
  appCategory?: string;
  publishedAt: string;
  capturedAt?: string;
  mediaImageId?: number;
  sourcePayload: Record<string, unknown>;
  searchText: string;
  sourceRevision: string;
}

export interface SearchResultItem extends Omit<SearchDocument, "searchText" | "sourceRevision"> {
  imageUrl?: string;
  thumbnailUrl?: string;
  matchedContext: Array<{ kind: "text" | "component" | "flow" | "productArea"; value: string }>;
}

export interface SearchFacetOption { value: string; count: number }
export type SearchFacets = { [K in keyof SearchFilters]: SearchFacetOption[] };

export interface AdvancedSearchResult {
  requestId: string;
  items: SearchResultItem[];
  facets: SearchFacets;
  typeCounts: Record<SearchEntityType, number>;
  nextCursor: string | null;
  hasMore: boolean;
  degraded: boolean;
}
```

Implement:

```ts
const EMPTY_FILTERS: SearchFilters = {
  platform: [], app: [], appCategory: [], pageType: [], productArea: [],
  flow: [], component: [], state: [], theme: [], layout: [],
};

const values = (value: unknown): string[] =>
  [...new Set((Array.isArray(value) ? value : value ? [value] : [])
    .map(String).map((item) => item.trim()).filter(Boolean))].sort();

export function normalizeSearchRequest(input: Record<string, unknown>): NormalizedSearchRequest {
  const type = SEARCH_ENTITY_TYPES.includes(input.type as SearchEntityType) ? input.type as SearchEntityType : "all";
  const sort = ["relevance", "recent", "app-az"].includes(String(input.sort)) ? input.sort as SearchSort : "relevance";
  return {
    query: String(input.q ?? "").trim().slice(0, 500),
    type,
    filters: {
      ...EMPTY_FILTERS,
      platform: values(input.platform),
      app: values(input.app),
      appCategory: values(input.appCategory),
      pageType: values(input.pageType),
      productArea: values(input.productArea),
      flow: values(input.flow),
      component: values(input.component),
      state: values(input.state),
      theme: values(input.theme),
      layout: values(input.layout),
    },
    sort,
    ...(input.cursor ? { cursor: String(input.cursor) } : {}),
    limit: Math.min(48, Math.max(1, Number(input.limit) || 24)),
  };
}

export function searchFingerprint(request: Omit<NormalizedSearchRequest, "cursor" | "limit">): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("base64url");
}

export interface SearchCursor {
  fingerprint: string;
  indexVersion: number;
  sort: SearchSort;
  values: Array<string | number>;
}

export const encodeSearchCursor = (cursor: SearchCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export function decodeSearchCursor(value: string): SearchCursor {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SearchCursor;
  if (!parsed.fingerprint || parsed.indexVersion !== 1 || !Array.isArray(parsed.values)) {
    throw new Error("invalid search cursor");
  }
  return parsed;
}

export function fuseSearchRanks(lists: string[][], k = 60) {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((documentId, index) =>
    scores.set(documentId, (scores.get(documentId) ?? 0) + 1 / (k + index + 1)));
  return [...scores].map(([documentId, score]) => ({ documentId, score }))
    .sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId));
}
```

- [ ] **Step 4: Run the contract tests**

Run:

```bash
node --experimental-strip-types --test src/searchTypes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/searchTypes.ts src/searchTypes.test.ts
git commit -m "feat: define adaptive search contracts"
```

## Task 3: Project Published Versions into Search Documents

**Files:**

- Create: `src/searchProjection.ts`
- Create: `src/searchProjection.test.ts`

- [ ] **Step 1: Write failing projection tests**

Create fixtures that include one screen, one `ui_element`, one design-system component, one layout pattern, and one two-step flow. Assert stable IDs:

```ts
test("projects every v1 entity type with stable source identity", () => {
  const documents = projectSearchDocuments(sourceFixture);
  assert.deepEqual(
    documents.map(({ entityType, sourceId }) => [entityType, sourceId]),
    [
      ["app", "app:linear:web"],
      ["screen", "screen:101"],
      ["component", "ui-element:102"],
      ["component", "design-component:linear:web:button"],
      ["pattern", "pattern:linear:web:sidebar"],
      ["flow", "flow:linear:web:sign-in"],
    ],
  );
});

test("keeps visible text searchable without exposing it as generated interpretation", () => {
  const screen = projectSearchDocuments(sourceFixture).find(({ entityType }) => entityType === "screen")!;
  assert.match(screen.searchText, /Continue with email/);
  assert.equal(screen.sourcePayload.visibleTextCount, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/searchProjection.test.ts
```

Expected: FAIL because the projector does not exist.

- [ ] **Step 3: Implement the pure projector**

Create `src/searchProjection.ts`.

Export:

```ts
export interface PublishedSearchSource {
  version: {
    id: number; appId: number; app: string; platform: string;
    category?: string; publishedAt: string;
  };
  images: CrawledImage[];
  system?: DesignSystemSnapshot;
  flows: DesignFlow[];
}

export function projectSearchDocuments(source: PublishedSearchSource): SearchDocument[];
```

Implementation rules:

- Emit one App document using the app/platform identity.
- Emit Screen documents for `kind === "screen"` and UI Element documents for `kind === "ui_element"`.
- Emit Flow documents from `source.flows`.
- Emit component documents from both UI Element evidence and `source.system.components`.
- Emit one Pattern document per unique layout pattern observed in analyzed screens.
- Do not emit token documents.
- Store `versionId`, `mediaImageId`, `flowId`, and `flowStepIndex` in `sourcePayload` where available.
- Build `searchText` from factual source strings only: title, aliases, description, app, category, platform, visible text, page type, product area, flow, components, states, theme, and layouts.
- Use `createHash("sha256")` over canonical source fields for `sourceRevision`.
- Sort by entity-type order and `sourceId` so backfills are deterministic.

Use this canonical helper:

```ts
const text = (...parts: unknown[]) =>
  parts.flat(Infinity).filter((value) => typeof value === "string" && value.trim())
    .map((value) => (value as string).trim()).join(" ");
```

- [ ] **Step 4: Run focused projection tests**

Run:

```bash
node --experimental-strip-types --test src/searchProjection.test.ts src/catalogResearch.test.ts
```

Expected: PASS. Existing catalog research tests remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/searchProjection.ts src/searchProjection.test.ts
git commit -m "feat: project published catalog search documents"
```

## Task 4: Add a Validated OpenAI-Compatible Embedding Adapter

**Files:**

- Create: `src/searchEmbedding.ts`
- Create: `src/searchEmbedding.test.ts`
- Create: `src/searchConfig.ts`
- Create: `src/searchConfig.test.ts`

- [ ] **Step 1: Write failing embedding and configuration tests**

Cover:

```ts
test("embeds text in bounded batches and validates 1536 dimensions", async () => {
  const calls: unknown[] = [];
  const provider = new OpenAICompatibleSearchEmbeddingProvider({
    baseUrl: "https://example.test/v1",
    apiKey: "secret",
    model: "text-embedding-3-small",
    fetch: async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({
        data: [
          { index: 0, embedding: Array(1536).fill(0.1) },
          { index: 1, embedding: Array(1536).fill(0.2) },
        ],
      }), { status: 200 });
    },
  });
  assert.equal((await provider.embed(["one", "two"])).length, 2);
  assert.equal(calls.length, 1);
});

test("advancedSearchConfigFromEnv disables semantic retrieval without a key", () => {
  assert.deepEqual(advancedSearchConfigFromEnv({ ADVANCED_SEARCH_ENABLED: "true" }), {
    enabled: true,
    indexVersion: 1,
    embedding: null,
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test src/searchEmbedding.test.ts src/searchConfig.test.ts
```

Expected: FAIL because the adapter and config do not exist.

- [ ] **Step 3: Implement the provider**

Create `src/searchEmbedding.ts`:

```ts
export const SEARCH_EMBEDDING_DIMENSIONS = 1536;

export interface SearchEmbeddingProvider {
  readonly model: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export class OpenAICompatibleSearchEmbeddingProvider implements SearchEmbeddingProvider {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetch: typeof fetch;

  constructor(input: {
    baseUrl: string; apiKey: string; model: string; fetch?: typeof fetch;
  }) {
    this.baseUrl = input.baseUrl.replace(/\/$/, "");
    this.apiKey = input.apiKey;
    this.model = input.model;
    this.fetch = input.fetch ?? globalThis.fetch;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > 96) throw new Error("search embedding batch exceeds 96 documents");
    const response = await this.fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts }),
      signal,
    });
    if (!response.ok) throw new Error(`search embeddings returned ${response.status}`);
    const body = await response.json() as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    const ordered = [...body.data].sort((a, b) => a.index - b.index).map(({ embedding }) => embedding);
    if (ordered.length !== texts.length || ordered.some((vector) =>
      vector.length !== SEARCH_EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value)))) {
      throw new Error("search embedding response has invalid dimensions");
    }
    return ordered;
  }
}
```

Add a `batchEmbeddings(texts, provider, signal)` helper that chunks at 96 entries.

- [ ] **Step 4: Add validated server configuration**

Create `src/searchConfig.ts` and export:

```ts
export interface AdvancedSearchConfig {
  enabled: boolean;
  indexVersion: 1;
  embedding: null | { baseUrl: string; apiKey: string; model: "text-embedding-3-small" };
}

export function advancedSearchConfigFromEnv(
  env: Record<string, string | undefined>,
): AdvancedSearchConfig {
  const enabled = env.ADVANCED_SEARCH_ENABLED === "true";
  const apiKey = env.SEARCH_EMBEDDING_API_KEY?.trim();
  if (!apiKey) return { enabled, indexVersion: 1, embedding: null };
  const baseUrl = (env.SEARCH_EMBEDDING_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseUrl)) {
    throw new Error("SEARCH_EMBEDDING_BASE_URL must use HTTPS or loopback HTTP");
  }
  const model = env.SEARCH_EMBEDDING_MODEL ?? "text-embedding-3-small";
  if (model !== "text-embedding-3-small") {
    throw new Error("SEARCH_EMBEDDING_MODEL must be text-embedding-3-small for vector(1536)");
  }
  return { enabled, indexVersion: 1, embedding: { baseUrl, apiKey, model } };
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --experimental-strip-types --test src/searchEmbedding.test.ts src/searchConfig.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/searchEmbedding.ts src/searchEmbedding.test.ts src/searchConfig.ts src/searchConfig.test.ts
git commit -m "feat: add adaptive search embeddings"
```

## Task 5: Implement the Index Queue and PostgreSQL Search Repository

**Files:**

- Create: `src/searchIndexStore.ts`
- Create: `src/searchIndexStore.test.ts`
- Modify: `src/db.ts`

- [ ] **Step 1: Write failing PostgreSQL store tests**

Using the existing migration-test database pattern, cover:

```ts
test("claims each app and platform once with skip locked", async () => {
  await store.enqueue(appId, "web");
  const first = await store.claim("worker-1");
  const second = await store.claim("worker-2");
  assert.equal(first?.appId, appId);
  assert.equal(second, null);
});

test("replaces one app-platform document set atomically", async () => {
  await store.replaceDocuments({ appId, platform: "web", indexVersion: 1 }, firstDocuments);
  await store.replaceDocuments({ appId, platform: "web", indexVersion: 1 }, secondDocuments);
  assert.deepEqual((await store.documentsFor(appId, "web")).map(({ documentId }) => documentId),
    secondDocuments.map(({ documentId }) => documentId));
});

test("requeues a failed job with bounded backoff and a sanitized error", async () => {
  await store.fail(job, new Error("https://secret.test/token abc"));
  const row = await pool.query(`SELECT status, attempts, last_error FROM search_index_queue`);
  assert.equal(row.rows[0].status, "queued");
  assert.doesNotMatch(row.rows[0].last_error, /secret\.test/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/searchIndexStore.test.ts
```

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Add a one-version source loader in `src/db.ts`**

Export:

```ts
export async function publishedSearchSource(
  appId: number,
  platform: string,
): Promise<PublishedSearchSource | undefined>
```

The query must:

- Select the latest `published` `app_versions` row for the exact app/platform.
- Load both `screen` and `ui_element` images attached through `version_images`.
- Load `design_system_versions.snapshot` and `app_flow_versions.flows` for that version.
- Return `undefined` when no published version remains.
- Never fall back to mutable `design_systems` or `app_flows`.

- [ ] **Step 4: Implement queue and document operations**

In `src/searchIndexStore.ts`, export `PostgresSearchIndexStore` with:

```ts
claim(workerId: string): Promise<SearchIndexJob | null>;
loadSource(job: SearchIndexJob): Promise<PublishedSearchSource | undefined>;
replaceDocuments(scope: SearchIndexScope, documents: SearchDocument[], embeddings?: number[][]): Promise<void>;
complete(job: SearchIndexJob): Promise<void>;
fail(job: SearchIndexJob, error: unknown): Promise<void>;
enqueue(appId: number, platform: string): Promise<void>;
enqueueAllPublished(): Promise<number>;
```

Claim with one transaction:

```sql
SELECT app_id, platform, attempts
FROM search_index_queue
WHERE status IN ('queued', 'failed') AND next_attempt_at <= now()
ORDER BY requested_at
FOR UPDATE SKIP LOCKED
LIMIT 1
```

Then mark it `running`, increment attempts, and assign `locked_by`.

`replaceDocuments()` must:

1. Lock the queue scope.
2. Delete active-version documents for that app/platform/index version.
3. Bulk insert the new documents and optional embeddings.
4. Commit all documents together.

When no published source exists, delete documents for the scope and complete the queue row.

Retry delays are `5s`, `30s`, and `5m`. After three failures, store `status = 'failed'` and `next_attempt_at = now() + interval '1 hour'`.

- [ ] **Step 5: Run focused database tests**

Run:

```bash
node --experimental-strip-types --test src/searchIndexStore.test.ts src/db.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/searchIndexStore.ts src/searchIndexStore.test.ts src/db.ts
git commit -m "feat: add search index repository"
```

## Task 6: Add the Search Index Worker and Restartable Backfill

**Files:**

- Create: `services/search-index-worker/src/pipeline.ts`
- Create: `services/search-index-worker/src/pipeline.test.ts`
- Create: `services/search-index-worker/src/start.ts`
- Create: `services/search-index-worker/src/startup.test.ts`
- Create: `services/search-index-worker/src/index.ts`
- Create: `services/search-index-worker/Dockerfile`
- Create: `scripts/search-index-backfill.ts`
- Modify: `package.json`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write failing pipeline tests**

Cover:

```ts
test("indexes one claimed app-platform version", async () => {
  const report = await processSearchIndexJob({
    job,
    store: fakeStore(sourceFixture),
    embedder: fakeEmbedder,
  });
  assert.deepEqual(report, { appId: job.appId, platform: "web", documents: 6, embedded: 6 });
});

test("keeps keyword documents when embeddings fail", async () => {
  const store = fakeStore(sourceFixture);
  await processSearchIndexJob({
    job,
    store,
    embedder: { model: "fixture", embed: async () => { throw new Error("offline"); } },
  });
  assert.equal(store.replacedEmbeddings, undefined);
  assert.equal(store.completed, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test services/search-index-worker/src/pipeline.test.ts
```

Expected: FAIL because the worker does not exist.

- [ ] **Step 3: Implement one-job processing**

Create `processSearchIndexJob()`:

```ts
export async function processSearchIndexJob(input: {
  job: SearchIndexJob;
  store: SearchIndexWorkerStore;
  embedder: SearchEmbeddingProvider | null;
  signal?: AbortSignal;
}) {
  const source = await input.store.loadSource(input.job);
  const documents = source ? projectSearchDocuments(source) : [];
  let embeddings: number[][] | undefined;
  if (input.embedder && documents.length) {
    try {
      embeddings = await batchEmbeddings(documents.map(({ searchText }) => searchText), input.embedder, input.signal);
    } catch {
      embeddings = undefined;
    }
  }
  await input.store.replaceDocuments(
    { appId: input.job.appId, platform: input.job.platform, indexVersion: 1 },
    documents,
    embeddings,
  );
  await input.store.complete(input.job);
  return {
    appId: input.job.appId,
    platform: input.job.platform,
    documents: documents.length,
    embedded: embeddings?.length ?? 0,
  };
}
```

An embedding outage is not an indexing failure. Source loading or database replacement failures are indexing failures and must call `store.fail()`.

- [ ] **Step 4: Implement worker startup**

Follow the existing service startup pattern:

- Assert migrations before claiming work.
- Use `SEARCH_INDEX_WORKER_ID` or a hostname-derived ID.
- Claim one job at a time.
- Poll every two seconds when idle.
- Stop claiming on `SIGTERM`/`SIGINT`.
- Finish the current transaction before process exit.
- Construct the optional embedding provider from the validated Advanced Search config.
- Run indexing even while `ADVANCED_SEARCH_ENABLED=false`; the flag switches API reads, not projection maintenance.

- [ ] **Step 5: Add the enqueue-only backfill**

Create `scripts/search-index-backfill.ts`:

```ts
import { pool } from "../src/db.ts";
import { PostgresSearchIndexStore } from "../src/searchIndexStore.ts";

const store = new PostgresSearchIndexStore(pool);
const count = await store.enqueueAllPublished();
console.log(JSON.stringify({ queuedAppPlatforms: count }));
await pool.end();
```

The script must not generate embeddings itself. It is safe to rerun because the queue key is `(app_id, platform)`.

- [ ] **Step 6: Wire scripts, image, and Compose service**

Add:

```json
"service:search-index-worker": "tsx services/search-index-worker/src/index.ts",
"search:index:backfill": "node --env-file=.env --import tsx scripts/search-index-backfill.ts"
```

Add a `search-index-worker` Compose service using the new Dockerfile, `DATABASE_URL`, and:

```yaml
ADVANCED_SEARCH_ENABLED: ${ADVANCED_SEARCH_ENABLED:-false}
SEARCH_EMBEDDING_BASE_URL: ${SEARCH_EMBEDDING_BASE_URL:-https://api.openai.com/v1}
SEARCH_EMBEDDING_API_KEY: ${SEARCH_EMBEDDING_API_KEY:-}
SEARCH_EMBEDDING_MODEL: ${SEARCH_EMBEDDING_MODEL:-text-embedding-3-small}
```

It depends on successful migrations, not RabbitMQ.

- [ ] **Step 7: Run worker tests and build**

Run:

```bash
node --experimental-strip-types --test services/search-index-worker/src/*.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/search-index-worker scripts/search-index-backfill.ts package.json docker-compose.yml
git commit -m "feat: add adaptive search index worker"
```

## Task 7: Implement Hybrid Retrieval, Facets, Suggestions, and Cursor Pagination

**Files:**

- Create: `src/searchStore.ts`
- Create: `src/searchStore.test.ts`

- [ ] **Step 1: Write failing retrieval tests**

Seed documents with exact, keyword-only, semantic-only, filtered, and inaccessible fixtures. Cover:

```ts
test("exact title wins while cross-list matches beat semantic-only results", async () => {
  const result = await store.search(request({ q: "Linear checkout" }), queryVector, access);
  assert.equal(result.items[0].sourceId, "app:linear:web");
});

test("uses AND across groups and OR within a group", async () => {
  const result = await store.search(request({
    platform: ["ios", "android"],
    productArea: ["Checkout"],
    component: ["Modal", "Bottom sheet"],
  }), undefined, access);
  assert.ok(result.items.every((item) =>
    ["ios", "android"].includes(item.platform) && item.productArea === "Checkout"));
});

test("excluded documents never affect facets or type counts", async () => {
  const result = await store.search(request({}), undefined, proPublishedAccess);
  assert.equal(result.facets.app.some(({ value }) => value === "Draft Secret"), false);
  assert.equal(Object.values(result.typeCounts).reduce((sum, count) => sum + count, 0), publishedCount);
});

test("rejects a cursor bound to different filters", async () => {
  const first = await store.search(request({ platform: ["web"] }), undefined, access);
  await assert.rejects(
    () => store.search(request({ platform: ["ios"], cursor: first.nextCursor! }), undefined, access),
    /search cursor does not match request/,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/searchStore.test.ts
```

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement authorized candidate retrieval**

Create `PostgresSearchStore`.

Keyword candidates:

```sql
SELECT document_id,
       ts_rank_cd(search_vector, websearch_to_tsquery('english', $query)) AS text_rank,
       CASE
         WHEN lower(title) = lower($query) THEN 4
         WHEN lower(app_name) = lower($query) THEN 4
         WHEN lower($query) = ANY(SELECT lower(unnest(aliases))) THEN 3
         WHEN title ILIKE $prefix THEN 2
         ELSE 0
       END AS exact_boost
FROM search_documents
WHERE index_version = $indexVersion
  AND ($query = '' OR search_vector @@ websearch_to_tsquery('english', $query)
       OR title ILIKE $contains OR app_name ILIKE $contains)
  AND <authorized structured filters>
ORDER BY exact_boost DESC, text_rank DESC, document_id
LIMIT 240
```

Vector candidates:

```sql
SELECT document_id, 1 - (embedding <=> $vector::vector) AS semantic_rank
FROM search_documents
WHERE index_version = $indexVersion
  AND embedding IS NOT NULL
  AND <authorized structured filters>
ORDER BY embedding <=> $vector::vector, document_id
LIMIT 240
```

Build every filter from parameterized SQL. Never interpolate filter values or sort input.

- [ ] **Step 4: Implement deterministic fusion and sorting**

- Fuse keyword and vector IDs with `fuseSearchRanks()`.
- Add bounded exact boosts before final sorting.
- Use `document_id` as the final stable tie-breaker.
- Apply cursor values after rank calculation.
- Fetch `limit + 1`; return at most `limit`.
- Generate the next cursor only when the extra row exists.
- Return `degraded: true` only when semantic retrieval was requested but unavailable.

- [ ] **Step 5: Implement facets and type counts**

Facet counts use the same authorized base filter but omit their own group, so users can add another OR value within that group. For example, component counts apply every active group except `component`.

Return at most:

- 100 Apps
- 50 values for other groups

Sort facet options by count descending, then value ascending. Exclude zero counts.

- [ ] **Step 6: Implement taxonomy suggestions**

`suggest(prefix, access, limit = 10)` queries:

- App names
- Titles
- Aliases
- Page types
- Product areas
- Flow names
- Components
- Layout patterns

Return factual `{ kind, value, resultCount }` rows. Apply the same published/plan access base before counts. Do not query access events or personal history.

- [ ] **Step 7: Run retrieval tests**

Run:

```bash
node --experimental-strip-types --test src/searchStore.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/searchStore.ts src/searchStore.test.ts
git commit -m "feat: add hybrid catalog retrieval"
```

## Task 8: Route Search Through a Feature-Flagged API Service

**Files:**

- Create: `services/api/src/search.ts`
- Create: `services/api/src/search.test.ts`
- Modify: `services/api/src/index.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing search-service tests**

Cover:

```ts
test("returns keyword results with degraded true when query embeddings fail", async () => {
  const service = createSearchService({
    store,
    embedder: { model: "fixture", embed: async () => { throw new Error("offline"); } },
  });
  const result = await service.search(request, access);
  assert.equal(result.degraded, true);
  assert.equal(result.items.length, 1);
});

test("does not record raw query text", async () => {
  await service.search({ ...request, query: "private acquisition research" }, access);
  assert.deepEqual(telemetry.events[0], {
    requestId: telemetry.events[0].requestId,
    action: "adaptive-search",
    resultCount: 1,
    degraded: false,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test services/api/src/search.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement `createSearchService()`**

The service:

- Normalizes and validates requests.
- Rejects malformed cursors with status-safe `SearchRequestError`.
- Creates one query embedding when a non-empty query and embedder are available.
- Calls the store with `undefined` vector when embedding fails.
- Produces a UUID request ID.
- Records latency, count, zero-result, filter-group count, sort, and degraded state.
- Never records raw query, matched text, private project data, or screenshot text.

- [ ] **Step 4: Add new route dependencies**

Extend `ApiDeps` with:

```ts
advancedSearchEnabled: boolean;
adaptiveSearch: ReturnType<typeof createSearchService>;
```

Construct the store and optional embedder in `services/api/src/index.ts` from `advancedSearchConfigFromEnv(process.env)`.

- [ ] **Step 5: Feature-switch the existing endpoint**

At the beginning of `app.get("/search")`:

```ts
if (deps.advancedSearchEnabled) {
  if (await effectiveCustomerPlan(res) !== "pro") {
    res.status(403).json({ error: "Upgrade required", code: "upgrade_required" });
    return;
  }
  try {
    const request = searchRequestFromExpressQuery(req.query);
    const result = await deps.adaptiveSearch.search(request, {
      userId: res.locals.user.id,
      role: res.locals.user.role,
      plan: "pro",
      publishedOnly: true,
    });
    res.json(hydrateSearchMedia(result));
  } catch (error) {
    sendSearchError(res, error);
  }
  return;
}
```

Keep the legacy body after this branch unchanged for rollback.

Add `GET /search/suggestions` behind the same flag and Pro gate. Cap prefix length at 100 and limit at 10.

Implement `hydrateSearchMedia()` in `services/api/src/search.ts`. It may translate `mediaImageId` into the existing authenticated `/api/media/:app/:hash` and thumbnail paths, but it must remove internal object keys, `searchText`, `embedding`, and `sourceRevision` from every response.

- [ ] **Step 6: Add endpoint tests**

Verify:

- Flag off uses the existing deterministic route.
- Flag on does not call `allImages()`, `publishedImages()`, `listDesignSystems()`, or `listAppFlowSets()` per request.
- Free users receive the existing upgrade response.
- Invalid type, filter, sort, limit, and cursor return 400.
- Keyword fallback returns 200 with `degraded: true`.
- Cursor pagination does not duplicate items.
- Suggestions do not expose draft fixtures.
- Responses contain protected API media paths, never storage keys or signed S3 URLs.

- [ ] **Step 7: Run API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/search.test.ts services/api/src/app.test.ts src/searchConfig.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/api/src/search.ts services/api/src/search.test.ts services/api/src/index.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: expose adaptive search API"
```

## Task 9: Add URL Search State, Client Contracts, and the `/search` Route

**Files:**

- Create: `src/vitrine/searchState.ts`
- Create: `src/vitrine/searchState.test.ts`
- Create: `src/vitrine/advancedSearchApi.ts`
- Create: `src/vitrine/advancedSearchApi.test.ts`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/router.test.ts`

- [ ] **Step 1: Write failing URL and API-client tests**

Cover:

```ts
test("round trips canonical multi-select search state", () => {
  const state = parseSearchState("?q=dark+checkout&platform=ios&platform=android&sort=recent");
  assert.equal(serializeSearchState(state),
    "q=dark+checkout&platform=android&platform=ios&sort=recent");
});

test("does not encode the pagination cursor in the URL", () => {
  assert.equal(serializeSearchState({ ...defaultSearchState, cursor: "secret" } as never), "");
});

test("requests repeated filter parameters and an opaque cursor", async () => {
  await searchAdvancedCatalog({
    ...defaultSearchState,
    filters: { ...emptySearchFilters, platform: ["ios", "android"] },
  }, "cursor-1");
  assert.equal(requested,
    "/api/search?type=all&platform=android&platform=ios&sort=relevance&cursor=cursor-1&limit=24");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test src/vitrine/searchState.test.ts src/vitrine/advancedSearchApi.test.ts src/vitrine/router.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement canonical URL state**

In `searchState.ts`, export:

```ts
export interface SearchPageState {
  query: string;
  type: SearchType;
  filters: SearchFilters;
  sort: SearchSort;
}

export const defaultSearchState: SearchPageState;
export function parseSearchState(search: string): SearchPageState;
export function serializeSearchState(state: SearchPageState): string;
export function readRecentSearches(storage: Storage): string[];
export function recordRecentSearch(storage: Storage, query: string): string[];
export function clearRecentSearches(storage: Storage): void;
```

Use key `astryx:recent-searches:v1`, keep ten unique submitted queries, and tolerate corrupt storage by returning `[]`.

- [ ] **Step 4: Implement the typed client**

`advancedSearchApi.ts` exports:

```ts
searchAdvancedCatalog(state: SearchPageState, cursor?: string, signal?: AbortSignal): Promise<AdvancedSearchResult>;
loadSearchSuggestions(prefix: string, signal?: AbortSignal): Promise<SearchSuggestion[]>;
```

Append one query parameter per selected filter value. Preserve the existing JSON error shape and `AbortError`.

- [ ] **Step 5: Add the route**

Add `{ name: "search" }` to `Route`, map `/search` in `parseRoutePath()`, and return `/search` from `routeToPath()`. Query parameters remain owned by `searchState.ts`, not `router.ts`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/searchState.test.ts src/vitrine/advancedSearchApi.test.ts src/vitrine/router.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/vitrine/searchState.ts src/vitrine/searchState.test.ts src/vitrine/advancedSearchApi.ts src/vitrine/advancedSearchApi.test.ts src/vitrine/router.ts src/vitrine/router.test.ts
git commit -m "feat: add advanced search route state"
```

## Task 10: Build the Cancellable Advanced Search State Machine

**Files:**

- Create: `src/vitrine/useAdvancedSearch.ts`
- Create: `src/vitrine/useAdvancedSearch.test.ts`

- [ ] **Step 1: Write failing state-machine tests**

Test the pure controller exported alongside the hook:

```ts
test("discards an older response after search state changes", async () => {
  const requests = deferredSearchRequests();
  const controller = createAdvancedSearchController(requests.client);
  const first = controller.search(state({ query: "checkout" }));
  const second = controller.search(state({ query: "onboarding" }));
  requests.resolve(0, result("old"));
  requests.resolve(1, result("new"));
  await Promise.all([first, second]);
  assert.equal(controller.snapshot().items[0].title, "new");
});

test("appends cursor results without duplicates", async () => {
  const client = async (_state: SearchPageState, cursor?: string) =>
    cursor
      ? resultPage(["screen:2", "screen:3"], null)
      : resultPage(["screen:1", "screen:2"], "next-1");
  const controller = createAdvancedSearchController(client);
  await controller.search(state({ query: "checkout" }));
  await controller.loadMore();
  assert.deepEqual(controller.snapshot().result?.items.map(({ documentId }) => documentId),
    ["screen:1", "screen:2", "screen:3"]);
});

test("facet failure preserves previously loaded items", async () => {
  let fail = false;
  const client = async () => {
    if (fail) throw new Error("search unavailable");
    return resultPage(["screen:1"], null);
  };
  const controller = createAdvancedSearchController(client);
  await controller.search(state({ query: "checkout" }));
  fail = true;
  await controller.retry();
  assert.deepEqual(controller.snapshot().result?.items.map(({ documentId }) => documentId), ["screen:1"]);
  assert.equal(controller.snapshot().error, "search unavailable");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useAdvancedSearch.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement controller and hook**

The controller state contains:

```ts
interface AdvancedSearchViewState {
  result: AdvancedSearchResult | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  revision: number;
}
```

Behavior:

- Debounce query/filter/type/sort changes by 180 ms.
- Abort the previous request.
- Increment a request revision and accept only the latest revision.
- Replace results for a new state.
- Append unique document IDs for `loadMore()`.
- Preserve the last successful result on complete failure.
- Expose `retry()` and `loadMore()`.
- Reset scroll only when query or primary type changes; the page component performs the actual scroll.

- [ ] **Step 4: Run the state tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useAdvancedSearch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vitrine/useAdvancedSearch.ts src/vitrine/useAdvancedSearch.test.ts
git commit -m "feat: add advanced search request state"
```

## Task 11: Build the Advanced Search Page, Filters, and Ranked Result Stream

**Files:**

- Create: `src/vitrine/components/AdvancedSearchPage.tsx`
- Create: `src/vitrine/AdvancedSearchPage.test.tsx`
- Create: `src/vitrine/components/AdvancedSearchFilters.tsx`
- Create: `src/vitrine/components/AdvancedSearchFilterDrawer.tsx`
- Create: `src/vitrine/components/ActiveSearchFilters.tsx`
- Create: `src/vitrine/components/AdvancedSearchResults.tsx`
- Create: `src/vitrine/components/SearchResultCard.tsx`
- Create: `src/vitrine/AdvancedSearchComponents.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing component contract tests**

Server-render fixtures and assert:

```ts
test("renders one ranked All stream instead of grouped sections", () => {
  const html = renderToStaticMarkup(<AdvancedSearchResults {...resultProps} />);
  assert.ok(html.indexOf("Checkout screen") < html.indexOf("Checkout flow"));
  assert.doesNotMatch(html, /<h2[^>]*>Screens<\/h2>/);
});

test("renders factual matched context without semantic scores", () => {
  const html = renderToStaticMarkup(<SearchResultCard item={screenResult} onPreview={() => {}} />);
  assert.match(html, /Matched text: Continue securely/);
  assert.doesNotMatch(html, /similarity|0\.8|semantic/i);
});

test("desktop filters expose authorized counts and zero values are disabled", () => {
  const html = renderToStaticMarkup(<AdvancedSearchFilters {...filterProps} />);
  assert.match(html, /iOS.*12/);
  assert.doesNotMatch(html, />Android.*0</);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
tsx --test src/vitrine/AdvancedSearchPage.test.tsx src/vitrine/AdvancedSearchComponents.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement type-specific cards**

`SearchResultCard` selects a focused body by `entityType`:

- Screen: large thumbnail, app, platform, page type, matched context.
- Flow: ordered preview from `sourcePayload.steps`, app, platform, flow name, step count.
- Component: cropped thumbnail, component name, state, app.
- Pattern: representative media, pattern name, represented-app count.
- App: icon/identity, category, platforms, matching-content summary.

Use `PlaceholderImage` for media errors and existing `/api/media/:app/:hash` URL construction only.

- [ ] **Step 4: Implement filters**

`AdvancedSearchFilters`:

- Renders one multi-select group for every v1 facet.
- Applies changes immediately.
- Uses facet counts.
- Omits zero-count values.

`AdvancedSearchFilterDrawer`:

- Copies applied filters into draft state on open.
- Mutates only draft state while open.
- `Show results` applies the draft.
- Close/Cancel discards the draft.

`ActiveSearchFilters`:

- Removes one selected value.
- `Clear all` empties filters without changing query.

- [ ] **Step 5: Implement the page coordinator**

`AdvancedSearchPage`:

- Reads initial state from `window.location.search`.
- Uses `history.replaceState()` for debounced typing changes and `pushState()` for submitted searches, type changes, filter application, and sort changes.
- Renders tabs: All, Screens, Flows, UI Elements, Patterns, Apps.
- Renders Relevance, Recently added, and App A–Z sorts.
- Uses `useAdvancedSearch()`.
- Renders inline retry while preserving prior results.
- Uses `Load more`, never infinite polling.
- Opens preview without replacing route state.
- Records a recent query only on Enter, suggestion selection, or View all handoff.

- [ ] **Step 6: Add responsive and reduced-motion CSS**

Add classes under `.advanced-search-*`:

- Desktop sidebar plus result grid.
- Drawer below the existing narrow breakpoint.
- Card focus-visible outlines.
- Sticky selection tray safe-area padding.
- Preview overlay focus containment.
- `@media (prefers-reduced-motion: reduce)` disables nonessential transitions.

- [ ] **Step 7: Run focused component tests and build**

Run:

```bash
tsx --test src/vitrine/AdvancedSearchPage.test.tsx src/vitrine/AdvancedSearchComponents.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/vitrine/components/AdvancedSearchPage.tsx src/vitrine/AdvancedSearchPage.test.tsx src/vitrine/components/AdvancedSearchFilters.tsx src/vitrine/components/AdvancedSearchFilterDrawer.tsx src/vitrine/components/ActiveSearchFilters.tsx src/vitrine/components/AdvancedSearchResults.tsx src/vitrine/components/SearchResultCard.tsx src/vitrine/AdvancedSearchComponents.test.tsx src/vitrine/styles.css
git commit -m "feat: add advanced search page"
```

## Task 12: Add Preview, Collections, Projects, Flow Context, and Comparison

**Files:**

- Create: `src/vitrine/components/AdvancedSearchPreview.tsx`
- Create: `src/vitrine/components/SearchResearchActions.tsx`
- Create: `src/vitrine/SearchResearchActions.test.tsx`
- Modify: `src/vitrine/advancedSearchApi.ts`
- Modify: `src/vitrine/advancedSearchApi.test.ts`

- [ ] **Step 1: Write failing research-action tests**

Cover:

```ts
test("saves the stable source identity to a collection", async () => {
  renderActionHarness(screenResult);
  await click("Save to collection");
  assert.deepEqual(savedReference, {
    kind: "screen",
    app: "Linear",
    referenceId: "screen:101",
    title: "Checkout",
  });
});

test("adds catalog evidence to the selected project lane", async () => {
  await addResultToProject(screenResult, projectFixture, laneFixture.id);
  assert.equal(added.catalog.versionId, 7);
  assert.equal(added.catalog.imageId, 101);
  assert.equal(added.sourceKind, "catalog_screen");
});

test("comparison enforces two to five distinct apps", () => {
  const next = addComparisonSelection(existingFour, fifthAppResult);
  assert.equal(next.length, 5);
  assert.throws(() => addComparisonSelection(next, sixthAppResult), /five/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
tsx --test src/vitrine/SearchResearchActions.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Add related-result API support**

Add:

```ts
export function loadRelatedSearchResults(
  sourceId: string,
  signal?: AbortSignal,
): Promise<AdvancedSearchResult>
```

Call `/api/search?relatedTo=<encoded source ID>&type=all&limit=12`. Extend the API service to retrieve the selected document's factual metadata and run the same authorized hybrid search, excluding that document.

- [ ] **Step 4: Implement the preview**

`AdvancedSearchPreview`:

- Opens in-page.
- Saves and restores result-scroll position.
- Returns focus to the originating card.
- Shows protected media, factual metadata, surrounding flow, and related results.
- Distinguishes loading, empty, media failure, related failure, and inaccessible evidence.
- Uses existing source navigation for Apps, Screens, and Flows.

- [ ] **Step 5: Implement collection and project actions**

Reuse:

- `CollectionPicker`
- `listResearchProjects()`
- `getResearchProject()`
- `addResearchItem()`

The project action requires the user to choose a project and target lane. Build the payload from `sourcePayload.versionId`, `mediaImageId`, `flowId`, and `flowStepIndex`. Disable Add when the selected result lacks the required stable catalog identifiers.

This is the V1 **Add to research project** path; it must not create a new project implicitly.

- [ ] **Step 6: Implement comparison selection**

- Select two to five distinct apps.
- Preserve selection across preview and pagination.
- Show a sticky tray.
- Reuse `/api/compare` for the comparison view.
- Clear only through explicit Clear or after navigating away.

- [ ] **Step 7: Run action and API tests**

Run:

```bash
tsx --test src/vitrine/SearchResearchActions.test.tsx
node --experimental-strip-types --test src/vitrine/advancedSearchApi.test.ts services/api/src/search.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/vitrine/components/AdvancedSearchPreview.tsx src/vitrine/components/SearchResearchActions.tsx src/vitrine/SearchResearchActions.test.tsx src/vitrine/advancedSearchApi.ts src/vitrine/advancedSearchApi.test.ts services/api/src/search.ts services/api/src/search.test.ts
git commit -m "feat: connect search to research actions"
```

## Task 13: Upgrade Quick Search and Wire the Frontend Feature Flag

**Files:**

- Create: `src/vitrine/components/QuickSearch.tsx`
- Create: `src/vitrine/QuickSearch.test.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/components/SearchTrigger.tsx`
- Modify: `src/vitrine/components/Sidebar.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing Quick Search tests**

Cover:

```ts
test("shows recent searches only before the user types", () => {
  const html = renderToStaticMarkup(<QuickSearch {...props({ query: "", recent: ["checkout"] })} />);
  assert.match(html, /checkout/);
});

test("groups only top Quick Search results by entity type", () => {
  const html = renderToStaticMarkup(<QuickSearch {...props({ result })} />);
  assert.match(html, /Screens/);
  assert.match(html, /Flows/);
  assert.match(html, /UI Elements/);
});

test("View all hands the exact query to /search", () => {
  assert.deepEqual(quickSearchHandoff("dark checkout"), {
    route: { name: "search" },
    search: "q=dark+checkout",
  });
});

test("Arrow keys, Enter, Escape, Tab, and Shift-Tab preserve the modal contract", () => {
  assert.equal(quickSearchKeyAction("ArrowDown", 0, 3), 1);
  assert.equal(quickSearchKeyAction("ArrowUp", 0, 3), 2);
  assert.equal(quickSearchKeyAction("Enter", 1, 3), "open:1");
  assert.equal(quickSearchKeyAction("Escape", 1, 3), "close");
  assert.equal(quickSearchKeyAction("Tab", 1, 3), "native-tab");
  assert.equal(quickSearchKeyAction("Shift+Tab", 1, 3), "native-tab");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
tsx --test src/vitrine/QuickSearch.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Quick Search**

Quick Search:

- Loads suggestions only after two characters.
- Displays device-local recent searches when empty.
- Displays existing inspiration prompts when empty and no history exists.
- Shows at most five results per entity group.
- Supports keyboard navigation through the flattened visible order.
- Opens the existing preview and research actions.
- Offers `View all results`.
- Does not expose the complete Advanced Search filter sidebar.

Export pure `quickSearchHandoff()` and `quickSearchKeyAction()` helpers from `QuickSearch.tsx` so the handoff and keyboard contract remain testable without browser-global mutation.

- [ ] **Step 4: Add the frontend feature flag**

Use:

```ts
const advancedSearchEnabled =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_ADVANCED_SEARCH_ENABLED === "true";
```

When enabled:

- SearchTrigger opens `QuickSearch`.
- `/search` renders `AdvancedSearchPage`.
- Sidebar includes Search.
- `App` no longer owns Advanced Search result/filter state.

When disabled:

- Existing `CommandPalette`, `SearchResults`, `searchCatalog()`, and Apps behavior remain unchanged.

- [ ] **Step 5: Add boundary tests**

Assert:

- `AdvancedSearchPage` and `QuickSearch` own their state boundaries.
- `App.tsx` does not call `GET /api/jobs` for Search.
- The legacy path remains present behind the disabled flag.
- Search does not import crawler/admin job clients.

- [ ] **Step 6: Run frontend tests and build**

Run:

```bash
tsx --test src/vitrine/QuickSearch.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/router.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/vitrine/components/QuickSearch.tsx src/vitrine/QuickSearch.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts src/vitrine/components/SearchTrigger.tsx src/vitrine/components/Sidebar.tsx src/vitrine/styles.css
git commit -m "feat: add adaptive quick search"
```

## Task 14: Add Relevance, Accessibility, Performance, and Rollout Gates

**Files:**

- Create: `data/search-relevance-benchmark.json`
- Create: `scripts/verify-search-relevance.ts`
- Create: `scripts/benchmark-search-performance.ts`
- Create: `src/searchBenchmark.test.ts`
- Modify: `package.json`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write the failing benchmark schema test**

Create `src/searchBenchmark.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("search benchmark covers every release category", async () => {
  const rows = JSON.parse(await readFile("data/search-relevance-benchmark.json", "utf8")) as Array<{
    id: string; category: string; query: string; expectedSourceIds: string[];
  }>;
  const categories = new Set(rows.map(({ category }) => category));
  assert.deepEqual([...categories].sort(), [
    "ambiguous", "authorization", "exact", "flow", "intent", "visible-text", "zero-result",
  ]);
  assert.ok(rows.every(({ id, query, expectedSourceIds }) =>
    id && typeof query === "string" && Array.isArray(expectedSourceIds)));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/searchBenchmark.test.ts
```

Expected: FAIL because the benchmark does not exist.

- [ ] **Step 3: Create the curated benchmark**

Create at least 35 reviewed rows, with at least five in each category. Use only source IDs present in the seeded verification catalog. Zero-result rows use an empty `expectedSourceIds` array. Authorization rows include an `excludedSourceIds` array.

Each row follows:

```json
{
  "id": "intent-dark-mobile-checkout",
  "category": "intent",
  "query": "dark mobile checkout with trust signals",
  "filters": { "platform": ["ios", "android"] },
  "expectedSourceIds": ["screen:101", "flow:linear:ios:checkout"],
  "excludedSourceIds": []
}
```

- [ ] **Step 4: Implement the release-gate runner**

`scripts/verify-search-relevance.ts`:

- Loads the benchmark.
- Calls the search service against the verification database.
- Counts a pass when any expected source ID appears in the top five.
- Counts an expected zero-result pass only when no result is returned.
- Fails immediately if an excluded source ID appears anywhere.
- Prints per-category and overall JSON.
- Exits nonzero below `0.85` overall top-five recall.
- Separately exits nonzero when an exact-title fixture is not first.

Add:

```json
"search:verify-relevance": "node --env-file=.env --import tsx scripts/verify-search-relevance.ts",
"search:benchmark": "node --env-file=.env --import tsx scripts/benchmark-search-performance.ts"
```

- [ ] **Step 5: Add performance and accessibility assertions**

Add focused tests that assert:

- Search SQL always includes bounded candidate and page limits.
- Suggestion limit never exceeds ten.
- No result response contains `searchText`, `embedding`, or raw storage keys.
- Search input has combobox semantics.
- Tabs and filter groups expose selected state and counts.
- Result updates use a polite live region.
- Preview returns focus to the origin.
- Comparison selection is announced in text.
- Reduced-motion CSS covers preview, drawer, and tray transitions.

- [ ] **Step 6: Verify local rollback configuration**

In `docker-compose.yml`, ensure:

- Both Advanced Search flags default to `false`.
- API and worker use the same embedding model and index version.
- Search worker can be stopped without stopping API.
- Disabling the backend flag routes `/search` to the deterministic implementation.
- Disabling the frontend flag retains the existing Command Palette.

- [ ] **Step 7: Document environment, backfill, and rollback**

Add these names to `.env.example` with empty secrets and disabled flags:

```dotenv
ADVANCED_SEARCH_ENABLED=false
VITE_ADVANCED_SEARCH_ENABLED=false
SEARCH_EMBEDDING_BASE_URL=https://api.openai.com/v1
SEARCH_EMBEDDING_API_KEY=
SEARCH_EMBEDDING_MODEL=text-embedding-3-small
SEARCH_INDEX_WORKER_ID=
```

In `README.md`, document this exact rollout order:

1. Confirm the target database supports `CREATE EXTENSION vector`.
2. Apply and verify migrations.
3. Deploy the search-index worker with both feature flags disabled.
4. Run `npm run search:index:backfill`.
5. Wait for the queue to drain and run relevance/performance verification.
6. Enable `ADVANCED_SEARCH_ENABLED` for API cohorts.
7. Build the frontend with `VITE_ADVANCED_SEARCH_ENABLED=true` only after backend gates pass.

Document rollback as disabling the two flags and leaving `search_documents` intact for diagnosis.

- [ ] **Step 8: Run the complete verification suite**

Run:

```bash
npm test
npm run build
npm run db:check
npm run search:verify-relevance
npm run search:benchmark
docker compose config --quiet
```

Expected:

- All tests PASS.
- Vite build exits 0.
- Migration check exits 0.
- Relevance output reports at least `0.85` overall top-five recall, all authorization cases safe, and all exact-name cases first.
- Performance output reports search p95 below 750 ms and suggestion p95 below 250 ms.
- Compose configuration exits 0.

- [ ] **Step 9: Run a production-shaped smoke test**

With an isolated verification database, enqueue and process the backfill:

```bash
ADVANCED_SEARCH_ENABLED=true npm run search:index:backfill
ADVANCED_SEARCH_ENABLED=true npm run service:search-index-worker
```

Wait until `search_index_queue` has no `queued` or `running` rows, then run:

```bash
npm run search:benchmark
```

`scripts/benchmark-search-performance.ts` must:

- Execute at least 100 requests sampled evenly from the relevance benchmark.
- Execute at least 100 suggestion prefixes.
- Use the real `PostgresSearchStore` and service wiring.
- Report p50, p95, and maximum latency as JSON.
- Exit nonzero when search p95 is 750 ms or higher.
- Exit nonzero when suggestion p95 is 250 ms or higher.
- Print per-entity document counts so an incomplete backfill is visible.

- [ ] **Step 10: Commit**

```bash
git add data/search-relevance-benchmark.json scripts/verify-search-relevance.ts scripts/benchmark-search-performance.ts src/searchBenchmark.test.ts package.json docker-compose.yml .env.example README.md
git commit -m "test: gate adaptive search rollout"
```

## Task 15: Final Review and Integration Readiness

**Files:**

- Review every file changed by Tasks 1–14.

- [ ] **Step 1: Verify spec coverage**

Check each section in:

```text
docs/superpowers/specs/2026-07-23-astryx-adaptive-hybrid-search-design.md
```

Map it to a passing test or explicit implementation. Pay particular attention to:

- Invisible query interpretation
- AND-across/OR-within filters
- Published/access filtering before facets
- URL state without cursor
- Device-local recent searches
- Research actions
- Semantic fallback
- No raw-query telemetry
- Evidence published or repaired within five minutes is searchable
- Feature-flag rollback

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: only Adaptive Hybrid Search implementation, tests, migration, configuration, and approved documentation changes are present. No unrelated main-workspace files appear.

- [ ] **Step 3: Run fresh final verification**

Run:

```bash
npm test
npm run build
npm run db:check
npm run search:verify-relevance
npm run search:benchmark
docker compose config --quiet
```

Expected: every command exits 0.

- [ ] **Step 4: Request code review**

Invoke `superpowers:requesting-code-review`. Resolve correctness, authorization, data-leak, cursor, migration, accessibility, and rollback findings before integration.

- [ ] **Step 5: Prepare integration choices**

Invoke `superpowers:finishing-a-development-branch` and offer merge, pull request, keep-worktree, or cleanup choices. Do not merge or push without the user's requested integration action.
