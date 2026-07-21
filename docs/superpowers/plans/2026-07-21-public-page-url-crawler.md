# Public Page URL Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import one arbitrary public website URL into the existing Apps experience with App metadata, a full-page Screen, HTML-derived UI Element sections, a continuous-scroll preview, and immutable capture versions.

**Architecture:** Add a dedicated `public-page-jobs` RabbitMQ queue and browser worker. The worker renders and analyzes one page, uploads deterministic objects, and completes a new page/version schema while also creating existing App Screen and UI Element evidence rows. The Apps API and UI remain the presentation layer; Mobbin Apps and Mobbin Sites queues and workers stay unchanged.

**Tech Stack:** TypeScript, Node 22, Playwright Chromium, Sharp, PostgreSQL, RabbitMQ/amqplib, S3-compatible object storage, Express 5, React 19, Node test runner.

---

## File map

### Create

- `src/publicPage.ts` — public URL identity, extracted metadata, section and capture contracts.
- `src/publicPage.test.ts` — URL normalization and capture contract tests.
- `src/publicPageBrowser.ts` — isolated Playwright rendering, DOM analysis, screenshot/crops, and scroll recording.
- `src/publicPageBrowser.test.ts` — local fixture browser tests.
- `src/publicPageCrawler.ts` — object upload and store orchestration.
- `src/publicPageCrawler.test.ts` — all-or-nothing and idempotent crawler tests.
- `src/publicPageQueue.ts` — isolated RabbitMQ contract.
- `src/publicPageQueue.test.ts` — parser, durable queue, retry, and isolation tests.
- `src/publicPageStore.ts` — page/version persistence and preview-object lookup.
- `src/publicPageStore.test.ts` — transactional completion and immutable version tests.
- `migrations/0012_public_page_captures.sql` — App metadata and public-page capture tables.
- `services/public-page-import-worker/Dockerfile` — Chromium worker image.
- `services/public-page-import-worker/src/index.ts` — production wiring.
- `services/public-page-import-worker/src/pipeline.ts` — job lifecycle and retries.
- `services/public-page-import-worker/src/pipeline.test.ts` — terminal/transient/cancel behavior.
- `services/public-page-import-worker/src/start.ts` — migration/storage startup gates.
- `services/public-page-import-worker/src/startup.test.ts` — startup ordering.
- `src/vitrine/components/PublicPageImportDialog.tsx` — URL-only Apps import form.
- `src/vitrine/PublicPageImportDialog.test.tsx` — component contract.

### Modify

- `src/objectStore.ts`, `src/objectStore.test.ts`, `src/s3ObjectStore.ts`, `src/s3ObjectStore.test.ts` — allow verified WebM objects and public-page keys.
- `src/db.ts`, `src/gallery.ts`, and their tests — expose stored App source metadata and ready preview URL.
- `services/api/src/app.ts`, `services/api/src/app.test.ts` — accept, publish, cancel, and serve public-page captures.
- `src/vitrine/jobsApi.ts`, `src/vitrine/jobsApi.test.ts` — submit the new job without listing jobs.
- `src/vitrine/App.tsx`, `src/vitrine/App.boundary.test.ts` — mount the URL-only import path without polling.
- `src/vitrine/types.ts`, `src/vitrine/components/AppOverviewPanel.tsx`, `src/vitrine/ScreenDetail.test.tsx` — render the ready preview video.
- `package.json` — add the worker service script.
- `docker-compose.yml` — add the isolated worker service and profile volume.

## Task 1: Define public-page contracts and safe URL identity

**Files:**
- Create: `src/publicPage.test.ts`
- Create: `src/publicPage.ts`

- [ ] **Step 1: Write the failing URL and contract tests**

```ts
test("canonicalizes one public page and derives a stable App identity", () => {
  assert.deepEqual(canonicalPublicPageUrl("https://www.Example.com/pricing?plan=pro#faq"), {
    requestedUrl: "https://www.example.com/pricing?plan=pro",
    sourceDomain: "example.com",
    appSlug: "example-com",
  });
});

test("rejects credentials, localhost, and literal private addresses", () => {
  for (const url of [
    "https://user:secret@example.com/",
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
  ]) assert.throws(() => canonicalPublicPageUrl(url), PublicPageValidationError);
});

test("normalizes one ordered rendered capture", () => {
  const capture = parsePublicPageCapture({
    requestedUrl: "https://example.com/pricing",
    canonicalUrl: "https://example.com/pricing",
    metadata: { name: "Example", description: "Plans", category: "Website", accent: "#112233" },
    viewport: { width: 1440, height: 900 },
    document: { width: 1440, height: 3000 },
    html: "<html></html>",
    sections: [{ position: 0, selector: "main > section", tagName: "section", heading: "Pricing", text: "Pricing", bounds: { x: 0, y: 100, width: 1440, height: 600 } }],
  });
  assert.equal(capture.sections[0].position, 0);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --experimental-strip-types --test src/publicPage.test.ts
```

Expected: FAIL because `src/publicPage.ts` does not exist.

- [ ] **Step 3: Implement the minimal contracts and validation**

Create these exported contracts in `src/publicPage.ts`:

```ts
export interface PublicPageIdentity {
  requestedUrl: string;
  sourceDomain: string;
  appSlug: string;
}

export interface PublicPageBounds { x: number; y: number; width: number; height: number }
export interface PublicPageSection {
  position: number;
  selector: string;
  tagName: string;
  role?: string;
  heading?: string;
  text: string;
  bounds: PublicPageBounds;
}

export interface PublicPageCapture {
  requestedUrl: string;
  canonicalUrl: string;
  metadata: { name: string; description: string; category: string; accent: string; iconUrl?: string };
  viewport: { width: 1440; height: 900 };
  document: { width: number; height: number };
  html: string;
  sections: PublicPageSection[];
}
```

`canonicalPublicPageUrl()` must accept only HTTP(S), strip the fragment, lowercase the host, remove a trailing dot, remove leading `www.` for `sourceDomain`, reject credentials and literal non-public IPs, and derive `appSlug` by replacing non-alphanumeric hostname runs with `-`. `parsePublicPageCapture()` must bound HTML to 2 MiB, document height to 100,000 pixels, section count to 200, text to 1,000 characters, and require ordered non-overlapping positive geometry.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the public-page contract**

```bash
git add src/publicPage.ts src/publicPage.test.ts
git commit -m "feat: define public page capture contract"
```

## Task 2: Add object and persistence support

**Files:**
- Modify: `src/objectStore.test.ts`
- Modify: `src/objectStore.ts`
- Modify: `src/s3ObjectStore.test.ts`
- Modify: `src/s3ObjectStore.ts`
- Create: `migrations/0012_public_page_captures.sql`
- Modify: `src/migrations.test.ts`
- Create: `src/publicPageStore.test.ts`
- Create: `src/publicPageStore.ts`

- [ ] **Step 1: Write failing WebM and deterministic-key tests**

```ts
test("builds isolated public-page object keys", () => {
  assert.match(publicPageObjectKey("example.com", "a".repeat(64), "preview", "page", "b".repeat(64), "webm"), /^public-pages\//);
});

test("accepts WebM while retaining the shared media ceiling", async () => {
  const body = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
  await store.put(metadata("public-pages/x/captures/y/preview/z/video.webm", body, "video/webm"));
});
```

- [ ] **Step 2: Run object-store tests and verify RED**

```bash
node --experimental-strip-types --test src/objectStore.test.ts src/s3ObjectStore.test.ts
```

Expected: FAIL because WebM and public-page keys are unsupported.

- [ ] **Step 3: Add WebM and public-page key support**

Add `video/webm` to `StoredContentType`, content-type allowlists, and `webm` to extensions. Add:

```ts
export function publicPageObjectKey(
  domain: string,
  captureHash: string,
  kind: "source" | "preview" | "page" | "section" | "icon",
  identity: string,
  sha256: string,
  extension: "json" | "png" | "jpg" | "webp" | "webm",
): string;
```

It must use the existing encoded identity parts and full SHA-256 validation.

- [ ] **Step 4: Write the failing migration/store tests**

Assert migration `0012` adds App source metadata plus `web_pages`, `web_page_versions`, and `web_page_sections`, including status checks, foreign keys to `stored_objects` and `images`, a partial unique source-domain index, and ready-version indexes.

Store tests must prove `beginCapture()` reuses an existing ready content hash, new hashes create importing versions, App metadata uses `COALESCE`, full-page evidence uses `kind='screen'`, sections use `kind='ui_element'`, ordered counts match, and a mismatch rolls back before `ready`.

- [ ] **Step 5: Run migration/store tests and verify RED**

```bash
node --experimental-strip-types --test src/migrations.test.ts src/publicPageStore.test.ts
```

Expected: FAIL because migration and store are absent.

- [ ] **Step 6: Implement migration and transactional store**

Expose:

```ts
export interface ReusedPublicPageCapture {
  reused: true;
  app: string;
  pageId: number;
  versionId: number;
}
export interface NewPublicPageCapture {
  reused: false;
  app: string;
  pageId: number;
  versionId: number;
  contentHash: string;
}
export type BeginPublicPageCapture = ReusedPublicPageCapture | NewPublicPageCapture;

export interface PublicPageStore {
  beginCapture(capture: PublicPageCapture, contentHash: string): Promise<BeginPublicPageCapture>;
  completeCapture(begin: NewPublicPageCapture, assets: PublicPageAssets, objects: ObjectMetadata[]): Promise<CompletedPublicPageCapture>;
  failCapture(versionId: number, message: string): Promise<void>;
  previewObject(app: string, versionId: number): Promise<ObjectMetadata | undefined>;
}
```

`beginCapture()` upserts the App by `source_domain`, preserves existing metadata with `COALESCE`, upserts `web_pages` by canonical URL, returns an existing ready version for the same full content hash, or inserts one importing version. `completeCapture()` inserts exact object metadata, App Web platform, Screen/UI Element image rows with `capture:` references, current App draft membership, page/section rows, then makes the web-page version ready only after persisted counts match the input.

- [ ] **Step 7: Run Task 2 tests and verify GREEN**

Run both focused commands. Expected: PASS.

- [ ] **Step 8: Commit object and store support**

```bash
git add migrations/0012_public_page_captures.sql src/migrations.test.ts src/objectStore.ts src/objectStore.test.ts src/s3ObjectStore.ts src/s3ObjectStore.test.ts src/publicPageStore.ts src/publicPageStore.test.ts
git commit -m "feat: persist immutable public page captures"
```

## Task 3: Build the rendered-DOM browser capture

**Files:**
- Create: `src/publicPageBrowser.test.ts`
- Create: `src/publicPageBrowser.ts`

- [ ] **Step 1: Write local-fixture browser tests**

Start a local HTTP fixture server, but inject an allowlisted test resolver so production SSRF policy is not weakened. Cover semantic and div-only section order, overlay/sticky removal, lazy content, crop geometry, tall-page caps, and continuous WebM recording with zero section stops.

- [ ] **Step 2: Run the browser test and verify RED**

```bash
node --experimental-strip-types --test src/publicPageBrowser.test.ts
```

Expected: FAIL because the browser capture does not exist.

- [ ] **Step 3: Implement DNS-safe rendering and metadata extraction**

`createPublicPageBrowser()` must launch an isolated Chromium context with viewport 1440 x 900, disable downloads, close popups, resolve and validate each main-frame URL before continuing, wait for DOM content plus bounded font/image settlement, and scroll once for lazy content.

The page-evaluated metadata extractor must apply the approved precedence and return bounded strings. The DOM analyzer must inspect visibility, semantic tags/roles, direct `main`/`body` children, headings, computed background/border/gap signals, then normalize one-child wrappers, nested duplicates, and undersized fragments into ordered large sections.

- [ ] **Step 4: Implement still capture, cropping, and continuous recording**

Capture one full-page PNG after disabling CSS animation/transition. Use Sharp to crop every section from the same PNG after clamping bounds to the screenshot. Restore styles, return to the top, call `page.screencast.start({ path })`, hold 1 second, scroll with `requestAnimationFrame` at about 200 CSS pixels/second without section stops, hold at the footer, then `stop()` and read the WebM bytes. Always remove the temporary recording directory and close context/browser in `finally`.

- [ ] **Step 5: Run browser tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit the browser capture**

```bash
git add src/publicPageBrowser.ts src/publicPageBrowser.test.ts
git commit -m "feat: capture rendered public page sections"
```

## Task 4: Upload and complete captures all-or-nothing

**Files:**
- Create: `src/publicPageCrawler.test.ts`
- Create: `src/publicPageCrawler.ts`

- [ ] **Step 1: Write failing crawler orchestration tests**

Cover successful deterministic uploads, unchanged-version reuse before uploads, cancellation between stages, object metadata mismatch, PNG/WebM signature rejection, and failure-state recording. The successful assertion must prove every required object is uploaded before exactly one `completeCapture()` call.

- [ ] **Step 2: Run the crawler test and verify RED**

```bash
node --experimental-strip-types --test src/publicPageCrawler.test.ts
```

Expected: FAIL because the crawler does not exist.

- [ ] **Step 3: Implement deterministic orchestration**

`crawlPublicPage(url, deps)` must call the browser capture, hash normalized HTML plus full PNG for version identity, call `beginCapture()`, return immediately for an existing ready hash, validate PNG/WebM signatures and the 64 MiB ceiling, upload source JSON as internal and visual assets as protected, verify returned metadata exactly, then call `completeCapture()`. Cancellation is checked between every expensive stage. Any post-begin error calls `failCapture()` with a bounded redacted message.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the crawler orchestrator**

```bash
git add src/publicPageCrawler.ts src/publicPageCrawler.test.ts
git commit -m "feat: orchestrate public page imports"
```

## Task 5: Add the isolated RabbitMQ worker

**Files:**
- Create: `src/publicPageQueue.test.ts`
- Create: `src/publicPageQueue.ts`
- Create: `services/public-page-import-worker/src/pipeline.test.ts`
- Create: `services/public-page-import-worker/src/pipeline.ts`
- Create: `services/public-page-import-worker/src/startup.test.ts`
- Create: `services/public-page-import-worker/src/start.ts`
- Create: `services/public-page-import-worker/src/index.ts`
- Create: `services/public-page-import-worker/Dockerfile`
- Modify: `package.json`
- Modify: `docker-compose.yml`
- Modify: `src/sitesIsolation.test.ts`

- [ ] **Step 1: Write failing queue isolation and retry tests**

Require the exact identifier-only payload `{ type: "crawl-public-page", url, jobId }`. Assert queue names `public-page-jobs` and `public-page-jobs.dlq`, durable declarations, persistent publish, `prefetch(1)`, retry headers 1 to 3, final dead-lettering, and rejection by both existing Apps and Sites parsers.

- [ ] **Step 2: Run queue tests and verify RED**

```bash
node --experimental-strip-types --test src/publicPageQueue.test.ts src/queue.test.ts src/sitesQueue.test.ts src/sitesIsolation.test.ts
```

Expected: FAIL because the queue is absent.

- [ ] **Step 3: Implement the queue**

Follow `src/sitesQueue.ts` but validate URLs with `canonicalPublicPageUrl()` and never accept Mobbin-specific types. Export `publishPublicPageJob`, `consumePublicPageJobs`, and `closePublicPageQueue`.

- [ ] **Step 4: Write failing pipeline and startup tests**

Assert queued to running to done, pre-cancelled no-op, permanent validation terminal without retry, transient failure rethrow through attempt two, final-attempt terminal message, cancellation no worker error, and migrations/storage checked before consume.

- [ ] **Step 5: Run worker tests and verify RED**

```bash
node --experimental-strip-types --test services/public-page-import-worker/src/*.test.ts
```

Expected: FAIL because the worker files are absent.

- [ ] **Step 6: Implement pipeline, startup, production wiring, and Compose service**

Use safe progress messages with no URL. Wire the browser, crawler, store, object store, job store, migration assertion, and storage readiness. Add `service:public-page-import-worker` and a Compose service with its own Chromium profile volume, RabbitMQ/database/object-store environment, and no Mobbin credentials.

- [ ] **Step 7: Run Task 5 tests and Compose validation**

```bash
node --experimental-strip-types --test src/publicPageQueue.test.ts src/queue.test.ts src/sitesQueue.test.ts src/sitesIsolation.test.ts services/public-page-import-worker/src/*.test.ts
docker compose config --quiet
```

Expected: PASS.

- [ ] **Step 8: Commit the isolated worker**

```bash
git add src/publicPageQueue.ts src/publicPageQueue.test.ts src/sitesIsolation.test.ts services/public-page-import-worker package.json docker-compose.yml
git commit -m "feat: add isolated public page worker"
```

## Task 6: Accept imports and serve authenticated previews

**Files:**
- Modify: `services/api/src/app.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`
- Modify: `src/gallery.ts`
- Modify: `src/gallery.test.ts`

- [ ] **Step 1: Write failing API tests**

Add injected `publishPublicPageJob` and `publicPageStore` dependencies. Cover one public URL routed only to the isolated publisher, non-admin rejection, private/literal IP rejection before job creation, storage readiness before publication, safe broker errors, public-page cancellation without Apps/Sites cancellation, and authenticated preview media that never exposes object keys.

- [ ] **Step 2: Run API tests and verify RED**

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: FAIL because the job type and preview route are absent.

- [ ] **Step 3: Add API job and preview route**

Add `crawl-public-page` to `JOB_TYPES`. In `/jobs`, canonicalize the URL, require object storage, create the durable job, publish only through `publishPublicPageJob`, sanitize failure text, and return 201. Keep Apps/Sites routes unchanged. Add an authenticated App-scoped preview route that resolves `publicPageStore.previewObject(app, versionId)` and uses the existing signed-object response seam.

- [ ] **Step 4: Expose persisted App metadata**

Extend `AppMetadataRow` and its query with `display_name`, `description`, `website_url`, `accent_color`, and the latest ready public-page preview version ID. Update gallery mapping to prefer those database fields and otherwise keep the existing built-in/fallback metadata.

- [ ] **Step 5: Run API, DB, and gallery tests and verify GREEN**

```bash
node --experimental-strip-types --test services/api/src/app.test.ts src/db.test.ts src/gallery.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the API slice**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts src/db.ts src/db.test.ts src/gallery.ts src/gallery.test.ts
git commit -m "feat: expose public page imports in Apps"
```

## Task 7: Add URL-only import and Overview preview UI

**Files:**
- Modify: `src/vitrine/jobsApi.test.ts`
- Modify: `src/vitrine/jobsApi.ts`
- Create: `src/vitrine/PublicPageImportDialog.test.tsx`
- Create: `src/vitrine/components/PublicPageImportDialog.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/components/AppOverviewPanel.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Write failing client and dialog tests**

Assert `submitPublicPageImport(url)` sends exactly one POST to `/api/jobs` with `{ type: 'crawl-public-page', url }` and makes zero GET requests. Render the dialog and assert one URL input, public-page explanation, submit disabled when empty, error display, and close/reset after 201.

- [ ] **Step 2: Run focused UI tests and verify RED**

```bash
node --experimental-strip-types --test src/vitrine/jobsApi.test.ts
npx tsx --test src/vitrine/PublicPageImportDialog.test.tsx
```

Expected: FAIL because helper and component are absent.

- [ ] **Step 3: Implement URL-only submission**

Add `submitPublicPageImport(url)` to send the new job. Create the dialog with heading `Capture public website`, label `Public page URL`, and helper copy explaining exact-page desktop capture. Mount it from the Apps `Import from URL` action without removing the existing Mobbin App import workflow; use a small choice in the existing import entry surface rather than a second gallery button.

- [ ] **Step 4: Write failing App Overview preview tests**

Extend `AppMetadata` with `description?: string | null` and `previewVideoUrl?: string | null`. Assert Overview renders `<video controls playsInline>` only when the URL is present and existing Apps render no empty video shell.

- [ ] **Step 5: Run Overview tests and verify RED**

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because preview fields and video are absent.

- [ ] **Step 6: Implement the preview and protect no-polling behavior**

Render the continuous-scroll preview at the top of `AppOverviewPanel` with native controls, muted default, `playsInline`, and accessible label. Extend `App.boundary.test.ts` to require the public-page dialog and continue asserting zero `GET /api/jobs` calls from Apps.

- [ ] **Step 7: Run all Task 7 tests and verify GREEN**

```bash
node --experimental-strip-types --test src/vitrine/jobsApi.test.ts src/vitrine/App.boundary.test.ts
npx tsx --test src/vitrine/PublicPageImportDialog.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit the Vitrine slice**

```bash
git add src/vitrine/jobsApi.ts src/vitrine/jobsApi.test.ts src/vitrine/components/PublicPageImportDialog.tsx src/vitrine/PublicPageImportDialog.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts src/vitrine/types.ts src/vitrine/components/AppOverviewPanel.tsx src/vitrine/ScreenDetail.test.tsx
git commit -m "feat: add public page import experience"
```

## Task 8: Complete verification

**Files:**
- Modify only files required by failures introduced by Tasks 1-7.

- [ ] **Step 1: Run focused public-page tests**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/publicPage.test.ts src/publicPageBrowser.test.ts src/publicPageCrawler.test.ts src/publicPageQueue.test.ts src/publicPageStore.test.ts services/public-page-import-worker/src/*.test.ts services/api/src/app.test.ts
npx tsx --test src/vitrine/PublicPageImportDialog.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run migration checks**

```bash
npm run db:check
node --experimental-strip-types --test src/migrations.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full automated verification**

```bash
npm test
npx tsc --noEmit
npm run build
docker compose config --quiet
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Inspect the final diff boundary**

```bash
git status --short
git diff --stat main...HEAD
git log --oneline main..HEAD
```

Expected: only public-page crawler, worker, API, persistence, object-store, UI, tests, spec, and plan files are present; no unrelated main-workspace changes appear.

- [ ] **Step 5: Commit any verification-only fixes**

Stage only files changed by verification and commit them with `test: verify public page crawler`.
