# Mobbin Sites Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import one Mobbin Sites version URL through Astryx's existing `/api/jobs` control plane, process it on an isolated RabbitMQ queue and crawler, and expose the durable Site/page/section result in a minimal Sites browser.

**Architecture:** Keep authorization, `POST /api/jobs`, the `jobs` table, PostgreSQL, object-storage configuration, and the RabbitMQ deployment shared. Route only `import-site` through `mobbin-sites-jobs` into `sites-import-worker`; keep the Apps queue, pipeline, browser profile, progress state, and import behavior unchanged.

**Tech Stack:** TypeScript, Node.js 22, Express 5, PostgreSQL/Supabase migrations, RabbitMQ/amqplib, Playwright Chromium, S3-compatible `ObjectStore`, React 19, Vite, Node test runner, TSX component tests, Docker Compose

---

## File map and execution constraints

New focused modules:

- `src/sites.ts`, `src/sitesSource.ts` — URL, domain, validation, and captured RSC decoding.
- `src/sitesStore.ts`, `migrations/0011_sites.sql` — transactional persistence and ready-only reads.
- `src/sitesQueue.ts` — isolated publisher, consumer, retry, and DLQ.
- `src/sitesCrawler.ts` — authenticated capture, bounded media download, object writes, and one ready commit.
- `services/sites-import-worker/` — separate startup, pipeline, production wiring, and image.
- `services/api/src/sites.ts` — ready list/detail/media routes.
- `src/vitrine/sitesApi.ts` and `src/vitrine/components/Site*.tsx` — URL submission and inspection UI.

Narrow existing seams:

- `src/objectStore.ts`, `src/crawler.ts`, `services/api/src/app.ts`, `src/vitrine/App.tsx`, `src/vitrine/router.ts`, `src/vitrine/components/Sidebar.tsx`, `src/vitrine/types.ts`, `package.json`, and `docker-compose.yml`.

Implementation rules:

- Start in a dedicated worktree from `90fe0d4` or later.
- Never commit cookies, storage-state JSON, signed query values, source OCR text, or customer content.
- Keep the existing 64 MiB object ceiling. Reject declared or downloaded assets above it; if the V7 fixture exceeds it, pause for a design revision instead of raising the limit silently.
- The Sites page performs zero `GET /api/jobs` requests. Shared job monitoring remains on its existing administrative surface.
- Cancelling a Sites job must never call the Apps crawler's shared `requestCancel()` path.

### Task 1: Define the canonical Sites contract and sanitized fixture

**Files:**
- Create: `src/sites.ts`
- Create: `src/sites.test.ts`
- Create: `tests/fixtures/mobbin-sites-v7-rsc.txt`

- [ ] **Step 1: Capture and sanitize the exact source fixture**

With the isolated authenticated Mobbin profile, open:

```text
https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview
```

Save the successful `text/x-component` response containing the page/section graph. Replace OCR values with `ocr-0001` through `ocr-3146` and replace asset hosts/queries with fixture URLs while preserving field names, IDs, arrays, dimensions, crops, and timestamps. Before staging, run:

```bash
rg -ni "cookie|authorization|token=|signature=|x-amz-" tests/fixtures/mobbin-sites-v7-rsc.txt
```

Expected: no matches.

- [ ] **Step 2: Write failing URL and graph tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalMobbinSitesUrl, parseSiteImport } from "./sites.ts";

const approved = "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview";

test("canonicalizes the approved URL", () => {
  assert.deepEqual(canonicalMobbinSitesUrl(approved + "/"), {
    canonicalUrl: approved,
    sourceSiteId: "v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09",
    sourceVersionId: "f4e176f7-aeb6-4f9a-9689-e4379fc357b1",
  });
});

test("rejects unsafe and unsupported URLs", () => {
  for (const value of ["http://mobbin.com/sites/a/b/preview", approved + "?token=x", approved + "#x", "https://example.com/sites/a/b/preview", "https://mobbin.com/apps/a/b/screens"]) {
    assert.throws(() => canonicalMobbinSitesUrl(value), /invalid Mobbin Sites URL/i);
  }
});

test("validates ordered media-specific sections", () => {
  const result = parseSiteImport({
    site: { sourceId: "site-1", name: "V7", slug: "v7", sourceUrl: "https://v7labs.com" },
    version: { sourceId: "version-1", label: "Jul 2026", isLatest: true, previewVideoUrl: "https://cdn.fixture/preview.mp4" },
    pages: [{ sourceId: "page-1", title: "Home", url: "/", position: 0, fullPageImageUrl: "https://cdn.fixture/home.webp", sections: [
      { sourceId: "section-1", position: 0, mediaKind: "image", mediaUrl: "https://cdn.fixture/hero.webp", cropTop: 0, cropBottom: 900, ocrBoxes: [] },
    ] }],
  });
  assert.equal(result.pages[0].sections[0].mediaKind, "image");
});
```

- [ ] **Step 3: Run RED**

Run: `node --experimental-strip-types --test src/sites.test.ts`

Expected: FAIL because `src/sites.ts` is absent.

- [ ] **Step 4: Implement domain types and fail-closed validators**

Export these contracts:

```ts
export interface MobbinSitesIdentity { canonicalUrl: string; sourceSiteId: string; sourceVersionId: string }
export interface SiteOcrBox { x: number; y: number; width: number; height: number; text: string }
export type SiteSection = {
  sourceId: string; position: number; mediaKind: "image" | "video"; mediaUrl: string;
  posterUrl?: string; cropTop?: number; cropBottom?: number;
  videoStartSeconds?: number; videoEndSeconds?: number;
  ocrBoxes: SiteOcrBox[]; sourceMetadata?: Record<string, unknown>;
};
export interface SitePage { sourceId: string; title: string; url: string; position: number; fullPageImageUrl: string; sections: SiteSection[] }
export interface SiteImport {
  site: { sourceId: string; name: string; slug: string; sourceUrl: string };
  version: { sourceId: string; label: string; isLatest: boolean; previewVideoUrl: string };
  pages: SitePage[];
}
```

`canonicalMobbinSitesUrl` requires HTTPS, exact host `mobbin.com`, no credentials/query/hash, and `^/sites/([a-z0-9-]+)/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/preview/?$`. `parseSiteImport` requires exact shapes, unique IDs/positions, contiguous source ordering, finite non-negative coordinates/timestamps, image crop fields only on images, increasing timestamps only on video, and public HTTPS media URLs without sensitive query keys.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/sites.test.ts`

Expected: PASS.

```bash
git add src/sites.ts src/sites.test.ts tests/fixtures/mobbin-sites-v7-rsc.txt
git commit -m "feat: define Mobbin Sites import contract"
```

### Task 2: Decode the captured RSC source exactly

**Files:**
- Create: `src/sitesSource.ts`
- Create: `src/sitesSource.test.ts`

- [ ] **Step 1: Write failing decoder tests**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeMobbinSitesSource } from "./sitesSource.ts";

test("decodes the inspected V7 graph exactly", async () => {
  const raw = await readFile(new URL("../tests/fixtures/mobbin-sites-v7-rsc.txt", import.meta.url), "utf8");
  const result = decodeMobbinSitesSource(raw);
  const sections = result.pages.flatMap((page) => page.sections);
  assert.equal(result.pages.length, 16);
  assert.equal(sections.length, 46);
  assert.equal(sections.filter((item) => item.mediaKind === "image").length, 35);
  assert.equal(sections.filter((item) => item.mediaKind === "video").length, 11);
  assert.equal(sections.flatMap((item) => item.ocrBoxes).length, 3146);
});

test("rejects truncation and source-schema drift", async () => {
  const raw = await readFile(new URL("../tests/fixtures/mobbin-sites-v7-rsc.txt", import.meta.url), "utf8");
  assert.throws(() => decodeMobbinSitesSource(raw.slice(0, raw.length / 2)), /Mobbin Sites source/i);
  assert.throws(() => decodeMobbinSitesSource(raw.replaceAll('"sections"', '"changedSections"')), /Mobbin Sites source/i);
});
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/sitesSource.test.ts`

Expected: FAIL because the decoder is absent.

- [ ] **Step 3: Implement the captured RSC grammar**

```ts
export class MobbinSitesSourceError extends Error {
  constructor(message = "Mobbin Sites source is unsupported") { super(message); }
}

export function decodeMobbinSitesSource(raw: string): SiteImport {
  if (!raw.trim() || raw.length > 2 * 1024 * 1024) throw new MobbinSitesSourceError();
  try {
    const rows = decodeRscRows(raw);
    const root = resolveCapturedSitesRoot(rows);
    return parseSiteImport(mapCapturedSitesRoot(root));
  } catch (cause) {
    if (cause instanceof MobbinSitesSourceError) throw cause;
    throw new MobbinSitesSourceError("Mobbin Sites source changed");
  }
}
```

Implement private helpers from the saved fixture's exact newline row grammar and exact `site → version → pages → sections` paths. JSON-decode rows and resolve only `$<rowId>` references. Do not use `eval`, `Function`, arbitrary brace extraction, or a recursive “find an object resembling a section” fallback.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/sites.test.ts src/sitesSource.test.ts`

Expected: PASS with exact 16/46/35/11/3146 counts.

```bash
git add src/sitesSource.ts src/sitesSource.test.ts
git commit -m "feat: decode Mobbin Sites source"
```

### Task 3: Add migration 0011 and a transactional Sites store

**Files:**
- Create: `migrations/0011_sites.sql`
- Create: `src/sitesStore.ts`
- Create: `src/sitesStore.test.ts`
- Modify: `src/migrations.test.ts`
- Modify: `scripts/verify-migrations.ts`

- [ ] **Step 1: Write failing migration/store tests**

Require all four tables, status/media checks, stored-object foreign keys, unique source identities, unique positions, and ready-only reads. With injected fake queries assert `completeImport` performs `BEGIN`, stored-object inserts, graph writes, final `status = 'ready'`, and `COMMIT`; any count mismatch ends in `ROLLBACK`.

```ts
test("loads only ready versions", async () => {
  const store = createSitesStore(fakeQuery);
  await store.listReadySites();
  assert.match(capturedSql[0], /sv\.status = 'ready'/);
});

test("media resolution is scoped to one ready Site version", async () => {
  await store.siteMediaObject({ siteId: 1, versionId: 2, kind: "section", recordId: 3 });
  assert.match(capturedSql.at(-1)!, /s\.id = \$1[\s\S]+sv\.id = \$2[\s\S]+sv\.status = 'ready'/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/migrations.test.ts src/sitesStore.test.ts`

Expected: FAIL because migration/store are absent.

- [ ] **Step 3: Create the schema**

Create `migrations/0011_sites.sql` exactly as a forward-only migration; do not edit migrations 0001–0010:

```sql
CREATE TABLE sites (
  id BIGSERIAL PRIMARY KEY,
  source_site_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_versions (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_version_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_latest BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('importing', 'ready', 'failed')),
  preview_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  source_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, source_version_id)
);

CREATE TABLE site_pages (
  id BIGSERIAL PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES site_versions(id) ON DELETE CASCADE,
  source_page_id TEXT NOT NULL,
  title TEXT NOT NULL,
  page_url TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  full_page_object_key TEXT NOT NULL REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  UNIQUE (version_id, source_page_id),
  UNIQUE (version_id, position)
);

CREATE TABLE site_sections (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  source_section_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  media_object_key TEXT NOT NULL REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  poster_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  crop_top DOUBLE PRECISION,
  crop_bottom DOUBLE PRECISION,
  video_start_seconds DOUBLE PRECISION,
  video_end_seconds DOUBLE PRECISION,
  ocr_boxes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ocr_boxes) = 'array'),
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_metadata) = 'object'),
  UNIQUE (page_id, source_section_id),
  UNIQUE (page_id, position),
  CHECK (
    (media_kind = 'image' AND crop_top IS NOT NULL AND crop_bottom IS NOT NULL AND video_start_seconds IS NULL AND video_end_seconds IS NULL)
    OR
    (media_kind = 'video' AND crop_top IS NULL AND crop_bottom IS NULL AND video_start_seconds IS NOT NULL AND video_end_seconds IS NOT NULL)
  )
);

CREATE INDEX site_versions_ready_idx ON site_versions (site_id, updated_at DESC) WHERE status = 'ready';
CREATE INDEX site_pages_version_position_idx ON site_pages (version_id, position);
CREATE INDEX site_sections_page_position_idx ON site_sections (page_id, position);
```

- [ ] **Step 4: Implement the store**

```ts
export interface SitesStore {
  readyVersionByCanonicalUrl(url: string): Promise<{ siteId: number; versionId: number } | undefined>;
  listReadySites(): Promise<SiteSummary[]>;
  readyVersionDetail(siteId: number, versionId: number): Promise<SiteVersionDetail | undefined>;
  beginImport(identity: MobbinSitesIdentity, graph: SiteImport): Promise<{ siteId: number; versionId: number }>;
  completeImport(input: CompletedSiteImport, objects: ObjectMetadata[]): Promise<{ siteId: number; versionId: number }>;
  failImport(url: string, message: string): Promise<void>;
  siteMediaObject(input: { siteId: number; versionId: number; kind: "preview" | "page" | "section" | "poster"; recordId?: number }): Promise<ObjectMetadata | undefined>;
}
```

Define `CompletedSiteImport` in `src/sitesStore.ts` as `{ identity: MobbinSitesIdentity; graph: SiteImport; objectKeys: { source: string; preview: string; pages: Record<string, string>; sections: Record<string, { media: string; poster?: string }> } }`. Define backend `SiteSummary` and `SiteVersionDetail` response types in the same module with numeric database IDs and API media URLs. Follow `createResearchProjectStore` dependency injection. `beginImport` upserts the Site/version source identities and resets a previous failed attempt to `importing`; it never exposes that row through ready reads. `completeImport` inserts metadata with equality-checked conflict handling, replaces the version's pages/sections, verifies counts, and marks ready only as the transaction's final write. `failImport` stores a redacted bounded message and changes only the matching non-ready version to `failed`. List/detail/media always require `status = 'ready'`; responses expose API media paths, never S3 keys.

- [ ] **Step 5: Update migration verification, run GREEN, and commit**

Add all four tables to `scripts/verify-migrations.ts`; add immutable migration assertions in `src/migrations.test.ts`.

Run: `node --experimental-strip-types --test src/migrations.test.ts src/sitesStore.test.ts`

Expected: PASS (PostgreSQL cases pass when disposable DB opt-in is enabled).

```bash
git add migrations/0011_sites.sql src/sitesStore.ts src/sitesStore.test.ts src/migrations.test.ts scripts/verify-migrations.ts
git commit -m "feat: persist imported Sites versions"
```

### Task 4: Support bounded Sites media in ObjectStore

**Files:**
- Modify: `src/objectStore.ts`
- Modify: `src/objectStore.test.ts`

- [ ] **Step 1: Write failing MP4/key tests**

```ts
test("builds isolated Sites object keys", () => {
  const hash = "a".repeat(64);
  assert.match(siteObjectKey("site-1", "version-1", "section", "section-1", hash, "mp4"), /^sites\/.+\.mp4$/);
});

test("accepts MP4 but retains the 64 MiB ceiling", async () => {
  const body = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70]);
  await store.put({ key: siteObjectKey("s", "v", "preview", "preview", sha256(body), "mp4"), body, byteSize: body.length, sha256: sha256(body), contentType: "video/mp4", accessClass: "protected" });
  const tooLarge = Buffer.alloc(64 * 1024 * 1024 + 1);
  await assert.rejects(store.put({ key: siteObjectKey("s", "v", "preview", "large", sha256(tooLarge), "mp4"), body: tooLarge, byteSize: tooLarge.length, sha256: sha256(tooLarge), contentType: "video/mp4", accessClass: "protected" }), /64 MiB/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/objectStore.test.ts`

Expected: FAIL for unsupported MP4/key helper.

- [ ] **Step 3: Implement support without changing MAX_BYTES**

Add `video/mp4` to `StoredContentType`/allowlist and `mp4` to extensions. Export:

```ts
export function siteObjectKey(siteId: string, versionId: string, kind: "source" | "preview" | "page" | "section" | "poster", identity: string, sha256: string, extension: "json" | "png" | "jpg" | "webp" | "mp4"): string {
  if (!SHA256_PATTERN.test(sha256)) throw new Error("Invalid Site object identity");
  return `sites/${encodeKeyPart(siteId)}/versions/${encodeKeyPart(versionId)}/${kind}/${encodeKeyPart(identity)}/${sha256}.${checkedExtension(extension)}`;
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/objectStore.test.ts src/s3ObjectStore.test.ts`

Expected: PASS and 64 MiB + 1 remains rejected.

```bash
git add src/objectStore.ts src/objectStore.test.ts
git commit -m "feat: store bounded Sites video media"
```

### Task 5: Add the isolated Sites queue and DLQ

**Files:**
- Create: `src/sitesQueue.ts`
- Create: `src/sitesQueue.test.ts`
- Test: `src/queue.test.ts`

- [ ] **Step 1: Write failing parser/fake-channel tests**

Require mutual parser rejection (`parseJob` rejects `import-site`; `parseSitesJob` rejects `import-app`) and exact constants:

```ts
export const SITES_QUEUE_NAME = "mobbin-sites-jobs";
export const SITES_DLQ_NAME = "mobbin-sites-jobs.dlq";
export const SITES_MAX_ATTEMPTS = 3;
```

With a fake channel assert durable declarations, persistent messages, `prefetch(1)`, headers 1→2→3, ack after republish, and final `nack(msg, false, false)`.

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/queue.test.ts src/sitesQueue.test.ts`

Expected: Apps tests pass; Sites module is missing.

- [ ] **Step 3: Implement a separate queue factory**

```ts
export type SitesJob = { type: "import-site"; url: string; jobId: number };
export interface SitesAttempt { attempt: number; maxAttempts: number }
export function parseSitesJob(value: unknown): SitesJob;
export function createSitesQueue(connect: typeof amqp.connect, url?: string): {
  publish(job: SitesJob): Promise<void>;
  consume(handler: (job: SitesJob, context: SitesAttempt) => Promise<void>): Promise<void>;
  close(): Promise<void>;
};
```

Do not import `src/queue.ts`. The module owns its connection/channel and exports production wrappers `publishSitesJob`, `consumeSitesJobs`, and `closeSitesQueue`.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/queue.test.ts src/sitesQueue.test.ts`

Expected: PASS, including mutual parser rejection.

```bash
git add src/sitesQueue.ts src/sitesQueue.test.ts src/queue.test.ts
git commit -m "feat: isolate Sites queue and retries"
```

### Task 6: Build the bounded, idempotent Sites crawler

**Files:**
- Create: `src/sitesCrawler.ts`
- Create: `src/sitesCrawler.test.ts`
- Modify: `src/crawler.ts`
- Modify: `src/catalogImportBrowser.test.ts`

- [ ] **Step 1: Write failing browser-option/crawler tests**

Prove no-argument Apps calls retain `MOBBIN_PROFILE_DIR` and `MOBBIN_STORAGE_STATE_PATH`, while Sites options override both. Test a fixture crawl stores normalized JSON, preview, 16 page images, and 46 section media before exactly one complete commit. Missing media or cancellation must produce zero complete commits. Test image/MP4 magic bytes, redirect/public-host checks, declared/body size limits, SHA-256, and metadata byte size.

```ts
await crawlMobbinSite(approvedUrl, {
  captureSource: async () => fixtureImport,
  download: async (url) => fixtureAsset(url),
  objectStore: memoryObjectStore,
  sitesStore: fakeSitesStore,
  isCancelled: async () => false,
});
assert.equal(completeCalls.length, 1);
assert.equal(putCalls.every((call) => call.key.startsWith("sites/")), true);
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/catalogImportBrowser.test.ts src/sitesCrawler.test.ts`

Expected: FAIL because options/crawler are absent.

- [ ] **Step 3: Add explicit browser options without changing Apps defaults**

```ts
export interface MobbinContextOptions { profileDir?: string; storageStatePath?: string; headless?: boolean }
export async function launchMobbinContext(options: MobbinContextOptions = {}): Promise<BrowserContext> {
  const profileDir = options.profileDir ?? process.env.MOBBIN_PROFILE_DIR ?? "data/browser-profile-mobbin";
  const context = await chromium.launchPersistentContext(profileDir, { headless: options.headless ?? process.env.HEADLESS === "true" });
  const state = options.storageStatePath ?? process.env.MOBBIN_STORAGE_STATE_PATH;
  if (state && existsSync(state)) await context.setStorageState(state);
  return context;
}
```

- [ ] **Step 4: Implement capture/download/commit ports**

```ts
export class SiteImportCancelledError extends Error {}
export class PermanentSiteImportError extends Error {}
export interface SitesCrawlerDependencies {
  captureSource(url: string): Promise<SiteImport>;
  download(url: string): Promise<{ body: Buffer; contentType: string; contentLength?: number }>;
  objectStore: ObjectStore;
  sitesStore: Pick<SitesStore, "beginImport" | "completeImport" | "failImport">;
  isCancelled(): Promise<boolean>;
  report?(message: string): Promise<void>;
}
export async function crawlMobbinSite(url: string, deps: SitesCrawlerDependencies): Promise<{ siteId: number; versionId: number; pageCount: number; sectionCount: number }>;
```

Production capture registers a response listener before navigation and accepts only a successful same-version `text/x-component` response that passes `decodeMobbinSitesSource`. Login redirects/401/403 become `PermanentSiteImportError("Mobbin authentication required")`. After validated capture, call `beginImport` before media work. Download through the browser context request client; check cancellation before navigation, each asset, and commit. Enforce 64 MiB before/after buffering, verify MIME signatures, hash, put objects, then call `completeImport` once. On any error after `beginImport`, call `failImport` with a redacted message before rethrowing; the version stays invisible because all reads require `ready`.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/catalogImportBrowser.test.ts src/sitesCrawler.test.ts src/objectStore.test.ts`

Expected: PASS, including no-partial-ready behavior.

```bash
git add src/crawler.ts src/catalogImportBrowser.test.ts src/sitesCrawler.ts src/sitesCrawler.test.ts
git commit -m "feat: crawl and store Mobbin Sites"
```

### Task 7: Add the dedicated Sites worker

**Files:**
- Create: `services/sites-import-worker/src/start.ts`
- Create: `services/sites-import-worker/src/startup.test.ts`
- Create: `services/sites-import-worker/src/pipeline.ts`
- Create: `services/sites-import-worker/src/pipeline.test.ts`
- Create: `services/sites-import-worker/src/index.ts`
- Create: `services/sites-import-worker/Dockerfile`

- [ ] **Step 1: Write failing startup/lifecycle tests**

Require startup order `migrations → storage → consume`. Pipeline tests require queued/running/done, pre-cancelled no-op, permanent auth failure acknowledged as error, attempts 1–2 transient rethrow without terminal error, and attempt 3 error then rethrow. `isCancelled` must read the job row by ID; it must not use Apps progress cancellation.

```ts
await handler({ type: "import-site", url: approvedUrl, jobId: 42 }, { attempt: 1, maxAttempts: 3 });
assert.deepEqual(statuses, [[42, "running", "Inspecting Site"], [42, "done", undefined]]);
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test services/sites-import-worker/src/*.test.ts`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement startup and tracked handler**

```ts
export async function startSitesImportWorker(deps: { assertMigrations(): Promise<void>; assertObjectStorage(): Promise<void>; consume(): Promise<void> }): Promise<void> {
  await deps.assertMigrations();
  await deps.assertObjectStorage();
  await deps.consume();
}
```

`createSitesPipelineHandler` receives `getJob`, `setJobStatus`, and `crawl`. It maps progress to `setJobStatus(id, "running", message)`, handles cancellation/permanent errors without retry, and rethrows transient errors for the queue. On the final transient attempt, set job error before rethrowing.

- [ ] **Step 4: Wire production and Docker**

Create object/Sites stores, verify gates, then consume `consumeSitesJobs(createSitesPipelineHandler(...))`. Pass explicit `MOBBIN_SITES_PROFILE_DIR`, `MOBBIN_SITES_STORAGE_STATE_PATH`, and `HEADLESS` to browser capture. The Dockerfile mirrors the existing Playwright worker but copies and launches only the Sites service.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --experimental-strip-types --test services/sites-import-worker/src/*.test.ts`

Expected: PASS.

```bash
git add services/sites-import-worker
git commit -m "feat: add isolated Sites import worker"
```

### Task 8: Reuse the jobs API and add ready Site routes

**Files:**
- Create: `services/api/src/sites.ts`
- Create: `services/api/src/sites.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing control-plane tests**

Assert admin requirement, invalid URL before job creation, new job uses `createJob("import-site", {url})` plus only `publishSitesJob`, duplicate returns `200 {existing:true,siteId,versionId}` without a job, broker failure marks error/returns 503, Sites cancellation never calls `requestCancel`, and Apps cancellation still does.

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts services/api/src/sites.test.ts`

Expected: new assertions fail.

- [ ] **Step 3: Add the routing branch**

Add `import-site` to API `JOB_TYPES`, not to the Apps `Job` union. Add `publishSitesJob` and `sitesStore` dependencies. Use:

```ts
if (type === "import-site") {
  const identity = canonicalMobbinSitesUrl(url);
  const existing = await deps.sitesStore.readyVersionByCanonicalUrl(identity.canonicalUrl);
  if (existing) { res.status(200).json({ existing: true, ...existing }); return; }
  if (!await requireStorageReady(res)) return;
  const id = await deps.createJob(type, { url: identity.canonicalUrl });
  try { await deps.publishSitesJob({ type, url: identity.canonicalUrl, jobId: id }); }
  catch (error) { const message = safeSiteJobError(error); await deps.setJobStatus(id, "error", message); res.status(503).json({ id, error: message }); return; }
  res.status(201).json({ id });
  return;
}
```

Add a local `safeSiteJobError(error)` that converts unknown errors to `"Sites queue unavailable"`, removes every `https?://` non-whitespace substring as `[redacted-url]`, truncates to 500 characters, and falls back to the generic message if the result is empty. In cancellation, call Apps `requestCancel()` only for a running job whose type is not `import-site`.

- [ ] **Step 4: Mount authenticated list/detail/media routes**

Create:

```text
GET /sites
GET /sites/:siteId/versions/:versionId
GET /sites/:siteId/versions/:versionId/media/preview
GET /sites/:siteId/versions/:versionId/pages/:pageId/media
GET /sites/:siteId/versions/:versionId/sections/:sectionId/media
GET /sites/:siteId/versions/:versionId/sections/:sectionId/poster
```

All positive IDs are validated. Store reads enforce ready status. Missing/internal media returns 404; protected media is sent through existing stored-object delivery without exposing keys. Import stays admin-only; ready browsing uses the app's authenticated active-user middleware.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts services/api/src/sites.test.ts`

Expected: PASS.

```bash
git add services/api/src/app.ts services/api/src/app.test.ts services/api/src/sites.ts services/api/src/sites.test.ts
git commit -m "feat: route Sites imports through jobs API"
```

### Task 9: Add Sites import and inspection UI without polling

**Files:**
- Create: `src/vitrine/sitesApi.ts`
- Create: `src/vitrine/sitesApi.test.ts`
- Create: `src/vitrine/components/SiteImportDialog.tsx`
- Create: `src/vitrine/components/SitesPage.tsx`
- Create: `src/vitrine/components/SiteVersionPage.tsx`
- Create: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/components/Sidebar.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write failing API/router/render tests**

```ts
await submitSiteImport(approvedUrl);
assert.deepEqual(requests, [{ url: "/api/jobs", method: "POST", body: JSON.stringify({ type: "import-site", url: approvedUrl }) }]);
assert.deepEqual(parseRoutePath("/sites"), { name: "sites" });
assert.deepEqual(parseRoutePath("/sites/1/versions/2"), { name: "site-version", siteId: 1, versionId: 2 });
```

Test 201 queued and 200 existing responses; list/detail request only `/api/sites...`; no GET `/api/jobs`. Render tests require URL-only dialog, page count/selector, ordered image/video support, native `<video controls>`, lazy images, and accessible back/import actions.

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/vitrine/sitesApi.test.ts src/vitrine/App.boundary.test.ts && tsx --test src/vitrine/Sites.test.tsx`

Expected: FAIL because Sites frontend is absent.

- [ ] **Step 3: Add contracts and API helpers**

```ts
export interface SiteSummary { id: number; name: string; slug: string; versionId: number; label: string; pageCount: number; sectionCount: number; previewUrl: string }
export interface SiteOcrBox { x: number; y: number; width: number; height: number; text: string }
export interface SiteSectionView { id: number; position: number; mediaKind: "image" | "video"; mediaUrl: string; posterUrl?: string; cropTop?: number; cropBottom?: number; videoStartSeconds?: number; videoEndSeconds?: number; ocrBoxes: SiteOcrBox[] }
export interface SiteVersionPage { id: number; title: string; url: string; position: number; fullPageImageUrl: string; sections: SiteSectionView[] }
export interface SiteVersionDetail { site: { id: number; name: string; slug: string }; version: { id: number; label: string; isLatest: boolean; previewUrl: string }; pages: SiteVersionPage[] }
export type SiteImportResult = { existing: true; siteId: number; versionId: number } | { existing: false; id: number };
```

Implement `listSites`, `getSiteVersion`, and `submitSiteImport` with checked responses and no jobs listing.

- [ ] **Step 4: Add routes/dialog/gallery/detail**

Add `{name:"sites"}` and `{name:"site-version",siteId,versionId}` routes and Sites sidebar navigation. `SiteImportDialog` mirrors Apps busy/error/reset/close behavior with only `Mobbin Sites URL`; existing result navigates immediately, queued result closes without polling.

`SitesPage` fetches once on mount and has explicit Retry/Refresh. Admin sees import; authenticated users see ready results. `SiteVersionPage` orders pages/sections, shows page selection/full-page reference, uses `<img loading="lazy">` and `<video controls preload="metadata">`, and displays crop/time metadata without rendering all OCR text.

Wire routes before Apps loading/detail branches so Apps hooks remain inactive. Extend the boundary test to reject `useJobs()` and GET `/api/jobs` on Sites.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/vitrine/sitesApi.test.ts src/vitrine/App.boundary.test.ts && tsx --test src/vitrine/Sites.test.tsx`

Expected: PASS.

```bash
git add src/vitrine/types.ts src/vitrine/router.ts src/vitrine/sitesApi.ts src/vitrine/sitesApi.test.ts src/vitrine/components/SiteImportDialog.tsx src/vitrine/components/SitesPage.tsx src/vitrine/components/SiteVersionPage.tsx src/vitrine/Sites.test.tsx src/vitrine/components/Sidebar.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "feat: browse imported Sites versions"
```

### Task 10: Wire Compose and assert hard isolation

**Files:**
- Modify: `package.json`
- Modify: `docker-compose.yml`
- Create: `src/sitesIsolation.test.ts`

- [ ] **Step 1: Write the failing static boundary test**

Read queue modules, worker entrypoints, and Compose. Assert Apps contains only `mobbin-jobs`; Sites contains only `mobbin-sites-jobs`; Sites never imports `consumeJobs`, `requestCancel`, or progress-file code; worker commands launch their own entrypoints; both depend on the same RabbitMQ service but mount distinct profile volumes.

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/sitesIsolation.test.ts`

Expected: FAIL until package/Compose wiring exists.

- [ ] **Step 3: Add scripts/test discovery and Compose service**

Add `"service:sites-import-worker": "tsx services/sites-import-worker/src/index.ts"` and include `services/sites-import-worker/src/*.test.ts` in `npm test`.

Add `sites-import-worker` using its Dockerfile, shared object-store env, DB, and `amqp://rabbitmq`, but:

```yaml
MOBBIN_SITES_PROFILE_DIR: /app/browser-profile
MOBBIN_SITES_STORAGE_STATE_PATH: /app/secrets/mobbin-storage-state.json
```

Mount `sites-import-worker-profile:/app/browser-profile`, the read-only portable storage state, and read-only AWS config. Do not mount `import-worker-profile`. Add only the new profile volume.

- [ ] **Step 4: Run GREEN/build and commit**

Run: `node --experimental-strip-types --test src/sitesIsolation.test.ts`

Run: `docker compose config --services`

Expected: one `rabbitmq`, plus `import-worker` and `sites-import-worker` once each.

Run: `docker compose build sites-import-worker`

Expected: image builds successfully.

```bash
git add package.json docker-compose.yml src/sitesIsolation.test.ts
git commit -m "chore: deploy isolated Sites worker"
```

### Task 11: Full verification and authenticated V7 acceptance

**Files:**
- Verify: every file above

- [ ] **Step 1: Run complete automated verification**

Run: `npm test`

Expected: all existing and new tests pass; new Sites contract tests are not skipped.

Run: `npm run build`

Expected: Vite build passes.

Run: `npm run db:check`

Expected: migration 0011 is discovered; active DB is current or reports exactly the expected pending migration before intentional apply.

Run against the disposable migration database: `npm run db:verify`

Expected: empty install, upgrade, rerun, and object-reference preservation pass at head 11.

- [ ] **Step 2: Start both workers and inspect queue ownership**

```bash
docker compose up -d rabbitmq migrate api import-worker sites-import-worker
docker compose exec rabbitmq rabbitmqctl list_queues name consumers messages_ready messages_unacknowledged
```

Expected: distinct Apps/Sites queues and DLQs; each main queue has only its intended consumer.

- [ ] **Step 3: Import the approved V7 URL through Sites UI**

Sign in as admin, submit the approved URL, and monitor through the existing admin job surface or read-only DB/queue inspection—not `GET /api/jobs` from Sites.

Expected ready result:

```text
site versions:    1 matching source version
pages:            16
sections:         46
image sections:   35
video sections:   11
OCR boxes:        3146
```

Every required object reference must join to `stored_objects`, exist in the configured backend with matching SHA-256/size/type, and render via Astryx API media URLs rather than Mobbin delivery URLs.

- [ ] **Step 4: Verify duplicate and failure isolation**

Submit the same URL again. Expected: 200 existing response, immediate navigation, no new job, no queue message.

Stop only `sites-import-worker`, run an Apps import fixture, and verify Apps continues on `mobbin-jobs`. Restart Sites and verify its pending job resumes. Do not stop RabbitMQ or Apps worker.

- [ ] **Step 5: Review final scope**

```bash
git diff --check
git status --short
git log --oneline --decorate -12
```

Expected: no formatting warnings, secrets, storage-state, unsanitized content, unrelated edits, or empty commits.
