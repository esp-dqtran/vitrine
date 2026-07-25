# Mobbin Sites Variant Repair Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import valid Mobbin Sites source variants and process current failed Sites with one isolated repair worker.

**Architecture:** Keep the source identity and storage safety gates strict while treating optional Mobbin section media fields as incomplete capture data. Enrich the decoded graph with rendered section media, video posters, and page image fallbacks before storage. Route failed jobs through a fixed repair queue consumed by a second Sites worker with its own browser profile.

**Tech Stack:** TypeScript, Node test runner, Playwright, PostgreSQL, RabbitMQ, Docker Compose.

---

### Task 1: Decode current Mobbin section variants

**Files:**
- Modify: `src/sitesSource.test.ts`
- Modify: `src/sitesSource.ts`
- Modify: `src/sites.test.ts`
- Modify: `src/sites.ts`

- [ ] **Step 1: Write the failing decoder tests**

Add a fixture mutator that parses the `$L4` row, changes one image section to
`custom_image`, and removes `page_image_url` plus timestamp fields from a video
section. Assert that decoding preserves `sourceType`, maps the custom image to
`mediaKind: "image"`, and omits unavailable video boundaries.

- [ ] **Step 2: Run the decoder tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/sitesSource.test.ts src/sites.test.ts
```

Expected: failures showing `custom_image` and missing video boundaries are
rejected by the current implementation.

- [ ] **Step 3: Implement the minimal tolerant mapping**

In `mapSection`, map both `page_image` and `custom_image` to image sections,
make image metadata/crops optional, and include video poster/timestamps only
when present as valid pairs. Use a public source URL placeholder for source
media that the rendered-media resolver will replace. Update `parseSiteImport`
so video timestamp fields may be both present or both absent.

- [ ] **Step 4: Run the decoder tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

### Task 2: Resolve rendered section, poster, and page media

**Files:**
- Modify: `src/sitesCrawler.test.ts`
- Modify: `src/sitesCrawler.ts`

- [ ] **Step 1: Write failing rendered-media tests**

Extend the virtualized Sections test to return image URLs, video URLs, and
video posters. Assert that collection returns:

```ts
{
  sectionMediaUrls: { "section-a": "https://cdn.example/a.webp" },
  sectionPosterUrls: { "section-b": "https://cdn.example/b-poster.webp" },
  pageImageUrls: { "page-a": "https://cdn.example/a.webp" }
}
```

Add a resolver assertion proving a page without a source image is replaced by
the rendered page fallback before validation/storage.

- [ ] **Step 2: Run the crawler tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/sitesCrawler.test.ts
```

Expected: the current collector returns only section media URLs.

- [ ] **Step 3: Implement rendered media enrichment**

Collect each section's actual image/video URL and video poster while traversing
the virtualized grid. Build a page-to-image map using the first rendered image
or video poster belonging to each page. Resolve all section media, posters, and
page images from this snapshot; retain the current legacy source-image fallback
only when a rendered page image is not required.

- [ ] **Step 4: Run the crawler tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

### Task 3: Add the isolated repair queue

**Files:**
- Modify: `src/sitesQueue.test.ts`
- Modify: `src/sitesQueue.ts`
- Modify: `services/sites-import-worker/src/index.ts`

- [ ] **Step 1: Write failing queue-scope tests**

Assert that `repair` scope declares and publishes only:

```text
mobbin-sites-repair-jobs
mobbin-sites-repair-jobs.dlq
```

Also assert that an unsupported scope is rejected instead of becoming an
arbitrary RabbitMQ queue name.

- [ ] **Step 2: Run the queue tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/sitesQueue.test.ts
```

Expected: repair scope APIs/constants are missing.

- [ ] **Step 3: Implement fixed queue scopes**

Add `SitesQueueScope = "catalog" | "repair"`, fixed scope-to-name constants,
and scope-aware queue factories/singletons. Keep catalog as the default for
existing callers. Read `MOBBIN_SITES_QUEUE_SCOPE` in the Sites worker and reject
values other than `catalog`, `repair`, or unset.

- [ ] **Step 4: Run the queue tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

### Task 4: Queue failed Sites and define the repair worker

**Files:**
- Create: `scripts/queue-failed-mobbin-sites.ts`
- Create: `scripts/queue-failed-mobbin-sites.test.ts`
- Modify: `package.json`
- Modify: `docker-compose.yml`
- Modify: `src/sitesIsolation.test.ts`

- [ ] **Step 1: Write failing selection and isolation tests**

Test a pure failed-job selector with duplicate URLs, ready Sites, invalid
payloads, and multiple failure timestamps. Update the compose isolation test to
require a `sites-repair-worker` service with repair scope and a distinct
`sites-repair-worker-profile` volume.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --experimental-strip-types --test scripts/queue-failed-mobbin-sites.test.ts src/sitesIsolation.test.ts
```

Expected: the script and repair compose service do not exist.

- [ ] **Step 3: Implement the queue command and compose service**

Select the latest failed `import-site` row per canonical URL, skip already-ready
versions, mark each selected original job queued, publish to repair scope, and
restore `error` if publishing fails. Add:

```json
"sites:queue-failed": "node --env-file=.env --import tsx scripts/queue-failed-mobbin-sites.ts"
```

Define `sites-repair-worker` from the Sites worker Dockerfile with its own
profile volume and `MOBBIN_SITES_QUEUE_SCOPE: repair`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

### Task 5: Verify and launch

**Files:**
- Verify only; do not alter unrelated dirty files.

- [ ] **Step 1: Run focused Sites verification**

```bash
node --experimental-strip-types --test \
  src/sites.test.ts \
  src/sitesSource.test.ts \
  src/sitesCrawler.test.ts \
  src/sitesQueue.test.ts \
  src/sitesIsolation.test.ts \
  services/sites-import-worker/src/pipeline.test.ts \
  scripts/queue-failed-mobbin-sites.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run build and full tests**

```bash
npm run build
npm test
```

Expected: build exits zero; report any full-suite failures exactly and separate
pre-existing unrelated failures from this Sites slice.

- [ ] **Step 3: Inspect the live system before mutation**

Record current catalog worker container state, RabbitMQ queue/consumer counts,
and failed `import-site` count. Do not duplicate an existing repair worker.

- [ ] **Step 4: Build and start only the repair worker**

```bash
docker compose up -d --build sites-repair-worker
npm run sites:queue-failed
```

- [ ] **Step 5: Verify live repair progress**

Confirm one catalog consumer remains on `mobbin-sites-jobs`, one repair consumer
exists on `mobbin-sites-repair-jobs`, both containers are healthy/running, and
the failed queue advances. Verify Aino Agency becomes ready or report its exact
new terminal failure.

