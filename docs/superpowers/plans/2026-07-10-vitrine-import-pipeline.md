# Vitrine Import Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user submit one Mobbin app from Vitrine, observe the durable crawl → caption → synthesis job chain, browse bulk-downloaded screenshots, and read the generated Markdown design system.

**Architecture:** Keep Postgres as the job/data source of truth, RabbitMQ as the durable transport, and the host import worker as the only Playwright owner. Repair the existing `mobbin-bulk:<hash>` handoff with one local-image resolver, make every worker stage return an explicit outcome, and put a thin Vitrine UI over the existing API and job tree.

**Tech Stack:** TypeScript, Node 22 test runner, Express 5, PostgreSQL, RabbitMQ/amqplib, Playwright, React 19, Vite 8, `@astryxdesign/core`.

---

## Execution note

`/Users/kai/works/eastplayers/Astryx` is not a Git repository, so a dedicated worktree and per-task commits cannot be created. Each task ends with a verification checkpoint instead. If Git is initialized before execution, commit the files named in that task after its checkpoint passes.

## File map

- Create `src/imageSource.ts`: validate app/hash values, resolve local bulk images, and convert stored references to browser URLs.
- Create `src/imageSource.test.ts`: cover local resolution and public URL mapping.
- Modify `src/db.ts`, `src/db.test.ts`: support selecting uncaptured images for one app.
- Modify `src/progress.ts`: define the shared terminal stage outcome.
- Modify `src/bulkDownload.ts`, `src/caption.ts`, `src/synthesize.ts`: return explicit outcomes and resolve local screenshots for captioning.
- Create `services/import-worker/src/pipeline.ts`, `services/import-worker/src/pipeline.test.ts`: isolate and test pipeline orchestration.
- Modify `services/import-worker/src/index.ts`: start the queue consumer with the pipeline handler.
- Create `services/api/src/app.ts`, `services/api/src/app.test.ts`: expose a testable Express app with validation, job, Markdown, and media routes.
- Modify `services/api/src/index.ts`: only start the HTTP listener.
- Modify `vite.config.ts`: map local image references and proxy job/output/media routes.
- Create `src/vitrine/jobs.ts`, `src/vitrine/jobs.test.ts`: model and group durable pipeline stages.
- Create `src/vitrine/useJobs.ts`: poll, submit, and cancel jobs.
- Create `src/vitrine/components/PipelinePanel.tsx`: import form and job-stage UI.
- Create `src/vitrine/components/DesignSystemPanel.tsx`: fetch and render Markdown.
- Modify `src/vitrine/types.ts`, `src/vitrine/useApps.ts`, `src/vitrine/App.tsx`, `src/vitrine/components/ScreenDetail.tsx`: integrate the pipeline and document UI.
- Modify `package.json`: include nested API, worker, and Vitrine tests in `npm test`.

### Task 1: Repair the bulk-image source contract

**Files:**
- Create: `src/imageSource.test.ts`
- Create: `src/imageSource.ts`

- [ ] **Step 1: Write the failing resolver tests**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bulkImageHash, findBulkImage, isAppSlug, publicImageUrl } from "./imageSource.ts";

test("validates app slugs and bulk references", () => {
  assert.equal(isAppSlug("linear-ios"), true);
  assert.equal(isAppSlug("../linear"), false);
  assert.equal(bulkImageHash("mobbin-bulk:0123456789abcdef"), "0123456789abcdef");
  assert.equal(bulkImageHash("https://cdn.example.com/a.png"), undefined);
});

test("resolves an existing local bulk image", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-image-source-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  const file = join(dataDir, "images", "linear", "0123456789abcdef.webp");
  writeFileSync(file, "image");
  assert.equal(findBulkImage(dataDir, "linear", "0123456789abcdef"), file);
  rmSync(dataDir, { recursive: true, force: true });
});

test("maps only local bulk references to the media API", () => {
  assert.equal(publicImageUrl("linear", "mobbin-bulk:0123456789abcdef"), "/api/media/linear/0123456789abcdef");
  assert.equal(publicImageUrl("linear", "https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node --experimental-strip-types --test src/imageSource.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/imageSource.ts`.

- [ ] **Step 3: Implement the minimal shared resolver**

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";

const APP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BULK_REF = /^mobbin-bulk:([0-9a-f]{16})$/;
const BULK_HASH = /^[0-9a-f]{16}$/;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export function isAppSlug(value: string): boolean {
  return APP_SLUG.test(value);
}

export function bulkImageHash(source: string): string | undefined {
  return source.match(BULK_REF)?.[1];
}

export function findBulkImage(dataDir: string, app: string, hash: string): string | undefined {
  if (!isAppSlug(app) || !BULK_HASH.test(hash)) return undefined;
  for (const extension of IMAGE_EXTENSIONS) {
    const path = join(dataDir, "images", app, `${hash}.${extension}`);
    if (existsSync(path)) return path;
  }
  return undefined;
}

export function publicImageUrl(app: string, source: string): string {
  const hash = bulkImageHash(source);
  return hash && isAppSlug(app) ? `/api/media/${app}/${hash}` : source;
}
```

- [ ] **Step 4: Run the resolver tests**

Run: `node --experimental-strip-types --test src/imageSource.test.ts`

Expected: 3 tests pass.

### Task 2: Scope caption selection to one application

**Files:**
- Modify: `src/db.test.ts`
- Modify: `src/db.ts:131`

- [ ] **Step 1: Add a failing database test for application filtering**

Append inside the existing database test after the first two Airbnb inserts:

```typescript
await insertImage("linear", "web", "https://cdn.example.com/linear.png");

const airbnbPending = await uncaptionedImages("airbnb");
assert.equal(airbnbPending.length, 2);
assert.ok(airbnbPending.every((image) => image.app === "airbnb"));

const allPending = await uncaptionedImages();
assert.equal(allPending.length, 3);
```

Update the later saves to iterate over `allPending`, then retain the final zero assertion:

```typescript
for (const image of allPending) {
  await saveDescription(image.id, `Caption for ${image.app}`);
}
assert.equal((await uncaptionedImages()).length, 0);
```

- [ ] **Step 2: Run the database test and confirm the signature fails**

Run: `node --experimental-strip-types --test src/db.test.ts`

Expected: FAIL because `uncaptionedImages` does not accept an app argument and returns Linear as well.

- [ ] **Step 3: Add the optional SQL filter**

Replace `uncaptionedImages` with:

```typescript
export async function uncaptionedImages(app?: string): Promise<{ id: number; app: string; image_url: string }[]> {
  const res = await query<{ id: number; app: string; image_url: string }>(
    `SELECT i.id, a.name AS app, i.image_url FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE i.description IS NULL
       AND ($1::text IS NULL OR a.name = $1)
     ORDER BY i.id`,
    [app ?? null]
  );
  return res.rows;
}
```

- [ ] **Step 4: Run the database test**

Run: `node --experimental-strip-types --test src/db.test.ts`

Expected: PASS when local Postgres is running; otherwise the existing explicit Postgres skip is reported.

### Task 3: Make crawl, caption, and synthesis outcomes explicit

**Files:**
- Modify: `src/progress.ts`
- Modify: `src/bulkDownload.ts`
- Modify: `src/caption.ts`
- Modify: `src/synthesize.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add the shared terminal outcome type**

Add to `src/progress.ts` after `ProgressState`:

```typescript
export interface StageOutcome {
  status: "done" | "cancelled" | "error";
  message?: string;
}
```

- [ ] **Step 2: Return outcomes from bulk crawling**

Change the signature to:

```typescript
export async function crawlBulkDownload(appUrl: string, appName: string): Promise<StageOutcome> {
```

Import `StageOutcome` from `progress.ts`. Return these values at the existing terminal branches:

```typescript
return { status: "cancelled", message: "Cancelled by user" };
```

```typescript
return { status: "error", message: "No download started" };
```

```typescript
return { status: "done" };
```

- [ ] **Step 3: Make captioning app-scoped and local-file aware**

Import `bulkImageHash`, `findBulkImage`, and `StageOutcome`. Change `withDownloaded` so local bulk images bypass `fetch`:

```typescript
async function withDownloaded<T>(app: string, imageUrl: string, fn: (filePath: string) => Promise<T>): Promise<T> {
  const hash = bulkImageHash(imageUrl);
  if (hash) {
    const localPath = findBulkImage(process.env.DATA_DIR ?? "data", app, hash);
    if (!localPath) throw new Error(`Missing local image for ${imageUrl}`);
    return fn(localPath);
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch ${imageUrl}: HTTP ${res.status}`);
  const ext = (res.headers.get("content-type") ?? "image/webp").split("/")[1].split(";")[0];
  const dir = mkdtempSync(`${tmpdir()}/astryx-caption-`);
  const filePath = `${dir}/image.${ext}`;
  writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  try {
    return await fn(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
```

Change the public signature and selection:

```typescript
export async function caption(providerName: string, limit?: number, app?: string): Promise<StageOutcome> {
  clearCancel();
  const images = (await uncaptionedImages(app)).slice(0, limit);
  if (images.length === 0) {
    console.log("Nothing to caption — every selected image already has a description.");
    return { status: "done" };
  }
```

Track the first item failure and pass `image.app` into `withDownloaded`:

```typescript
let failureMessage: string | undefined;
// inside the pool callback
const description = await withDownloaded(image.app, image.image_url, (filePath) =>
  session.ask(CAPTION_PROMPT, filePath)
);
// inside catch
failureMessage ??= message;
```

Replace the current final progress branch with one outcome that is also written to `progress.json`:

```typescript
const outcome: StageOutcome = isCancelRequested()
  ? { status: "cancelled", message: "Cancelled by user" }
  : loggedOut || failureMessage
    ? { status: "error", message: failureMessage ?? `Logged out of ${providerName}` }
    : { status: "done" };
writeProgress({
  stage: "caption",
  app: images[images.length - 1].app,
  done,
  total: images.length,
  status: outcome.status,
  message: outcome.message,
});
await closeAll();
return outcome;
```

- [ ] **Step 4: Return outcomes from synthesis**

Change the signature to `Promise<StageOutcome>`, import the type, and return:

```typescript
return { status: "done" };
```

when no images exist, because the stage is idempotently complete; return this from the cancellation branch:

```typescript
return { status: "cancelled", message: "Cancelled by user" };
```

Return this from the caught chat failure:

```typescript
return { status: "error", message };
```

Return `{ status: "done" }` after closing the successful session.

- [ ] **Step 5: Keep CLI behavior compatible**

The CLI may ignore returned outcomes, but pass its existing arguments unchanged:

```typescript
await caption(provider, limit);
await synthesize(app, provider ?? "chatgpt");
```

No additional CLI flags are added.

- [ ] **Step 6: Type-check the outcome changes**

Run: `npx tsc --noEmit`

Expected: PASS. Existing callers may ignore the returned outcomes until Task 4 wires them into orchestration.

### Task 4: Isolate and test durable worker orchestration

**Files:**
- Create: `services/import-worker/src/pipeline.test.ts`
- Create: `services/import-worker/src/pipeline.ts`
- Modify: `services/import-worker/src/index.ts`

- [ ] **Step 1: Write failing orchestration tests**

Create fakes that record created jobs, publications, and statuses, then cover successful and failed import outcomes:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPipelineHandler } from "./pipeline.ts";
import type { Job } from "../../../src/queue.ts";

function harness(crawlStatus: "done" | "cancelled" | "error") {
  const created: Array<{ type: string; parentId?: number }> = [];
  const published: Job[] = [];
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createPipelineHandler({
    discoverApps: async () => [],
    appHasImages: async () => false,
    crawlBulkDownload: async () => ({ status: crawlStatus, message: crawlStatus === "done" ? undefined : crawlStatus }),
    caption: async () => ({ status: "done" }),
    synthesize: async () => ({ status: "done" }),
    createJob: async (type, _payload, parentId) => {
      created.push({ type, parentId });
      return 100 + created.length;
    },
    publishJob: async (job) => { published.push(job); },
    getJob: async () => ({ status: "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
  });
  return { handler, created, published, statuses };
}

test("successful import creates a caption child linked to the import", async () => {
  const h = harness("done");
  await h.handler({ type: "import-app", name: "linear", url: "https://mobbin.com/apps/a/b/screens", jobId: 7 });
  assert.deepEqual(h.created, [{ type: "caption-app", parentId: 7 }]);
  assert.deepEqual(h.published, [{ type: "caption-app", name: "linear", jobId: 101 }]);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "done"]);
});

test("failed import does not create a caption child and remains retryable", async () => {
  const h = harness("error");
  await assert.rejects(
    h.handler({ type: "import-app", name: "linear", url: "https://mobbin.com/apps/a/b/screens", jobId: 7 }),
    /error/
  );
  assert.equal(h.created.length, 0);
  assert.equal(h.published.length, 0);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "error"]);
});

test("cancelled import does not advance or retry", async () => {
  const h = harness("cancelled");
  await h.handler({ type: "import-app", name: "linear", url: "https://mobbin.com/apps/a/b/screens", jobId: 7 });
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.statuses.map(([, status]) => status), ["running", "cancelled"]);
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node --experimental-strip-types --test services/import-worker/src/pipeline.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `pipeline.ts`.

- [ ] **Step 3: Implement a dependency-injected pipeline handler**

Move job orchestration out of the process entry point. The implementation must use this shape:

```typescript
import { appHasImages, createJob, getJob, setJobStatus } from "../../../src/db.ts";
import { discoverApps } from "../../../src/discoverApps.ts";
import { crawlBulkDownload } from "../../../src/bulkDownload.ts";
import { caption } from "../../../src/caption.ts";
import { synthesize } from "../../../src/synthesize.ts";
import { publishJob, type Job } from "../../../src/queue.ts";
import type { StageOutcome } from "../../../src/progress.ts";

const DEFAULT_PROVIDER = "chatgpt";

const defaults = { appHasImages, createJob, getJob, setJobStatus, discoverApps, crawlBulkDownload, caption, synthesize, publishJob };
type PipelineDeps = typeof defaults;

export function createPipelineHandler(overrides: Partial<PipelineDeps> = {}) {
  const deps = { ...defaults, ...overrides };

  async function enqueue(job: Job, parentId?: number): Promise<void> {
    const { type, jobId: _ignored, ...payload } = job;
    const jobId = await deps.createJob(type, payload, parentId);
    await deps.publishJob({ ...job, jobId });
  }

  async function handle(job: Job): Promise<StageOutcome> {
    if (job.type === "discover-catalog") {
      const apps = await deps.discoverApps();
      for (const target of apps) {
        if (!(await deps.appHasImages(target.name))) {
          await enqueue({ type: "import-app", name: target.name, url: target.url }, job.jobId);
        }
      }
      return { status: "done" };
    }
    if (job.type === "import-app") {
      const outcome = await deps.crawlBulkDownload(job.url, job.name);
      if (outcome.status === "done") await enqueue({ type: "caption-app", name: job.name }, job.jobId);
      return outcome;
    }
    if (job.type === "caption-app") {
      const outcome = await deps.caption(DEFAULT_PROVIDER, undefined, job.name);
      if (outcome.status === "done") await enqueue({ type: "synthesize-app", name: job.name }, job.jobId);
      return outcome;
    }
    return deps.synthesize(job.name, DEFAULT_PROVIDER);
  }

  return async function trackedHandleJob(job: Job): Promise<void> {
    if (job.jobId != null) {
      const record = await deps.getJob(job.jobId);
      if (record?.status === "cancelled") return;
      await deps.setJobStatus(job.jobId, "running");
    }
    try {
      const outcome = await handle(job);
      if (outcome.status === "error") throw new Error(outcome.message ?? `${job.type} failed`);
      if (job.jobId != null) await deps.setJobStatus(job.jobId, outcome.status, outcome.message);
    } catch (error) {
      if (job.jobId != null) await deps.setJobStatus(job.jobId, "error", (error as Error).message);
      throw error;
    }
  };
}
```

- [ ] **Step 4: Reduce the worker entry point to process startup**

Replace `services/import-worker/src/index.ts` with:

```typescript
import { consumeJobs } from "../../../src/queue.ts";
import { createPipelineHandler } from "./pipeline.ts";

console.log("[import-worker] Waiting for jobs...");
await consumeJobs(createPipelineHandler());
```

- [ ] **Step 5: Run worker tests and type checking**

Run: `node --experimental-strip-types --test services/import-worker/src/pipeline.test.ts`

Expected: 3 tests pass.

Run: `npx tsc --noEmit`

Expected: PASS.

### Task 5: Make the API testable and add safe job/output/media routes

**Files:**
- Create: `services/api/src/app.test.ts`
- Create: `services/api/src/app.ts`
- Modify: `services/api/src/index.ts`

- [ ] **Step 1: Write failing HTTP tests**

Use a random local port and injected job dependencies so RabbitMQ is not required:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApiApp } from "./app.ts";

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

test("rejects an invalid Mobbin import before creating a job", async (t) => {
  let created = false;
  const { base, server } = await serve(createApiApp({ createJob: async () => { created = true; return 1; } }));
  t.after(() => server.close());
  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "import-app", name: "../linear", url: "http://example.com" }),
  });
  assert.equal(response.status, 400);
  assert.equal(created, false);
});

test("marks a created job error when RabbitMQ publication fails", async (t) => {
  const statuses: string[] = [];
  const { base, server } = await serve(createApiApp({
    createJob: async () => 42,
    publishJob: async () => { throw new Error("broker down"); },
    setJobStatus: async (_id, status) => { statuses.push(status); },
  }));
  t.after(() => server.close());
  const response = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "import-app", name: "linear", url: "https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/version/screens" }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(statuses, ["error"]);
});

test("serves generated Markdown and local bulk media", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-api-"));
  mkdirSync(join(dataDir, "design-systems"), { recursive: true });
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "design-systems", "linear.md"), "# Linear");
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const { base, server } = await serve(createApiApp({ dataDir }));
  t.after(() => { server.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const markdown = await fetch(`${base}/design-systems/linear`);
  assert.equal(markdown.status, 200);
  assert.equal(await markdown.text(), "# Linear");
  assert.match(markdown.headers.get("content-type") ?? "", /text\/markdown/);
  assert.equal((await fetch(`${base}/design-systems/bad_slug`)).status, 400);
  assert.equal((await fetch(`${base}/media/linear/0123456789abcdef`)).status, 200);
  assert.equal((await fetch(`${base}/media/linear/not-a-hash`)).status, 400);
});
```

- [ ] **Step 2: Run the API tests and confirm the app factory is missing**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `app.ts`.

- [ ] **Step 3: Create the Express app factory**

Move the current routes into `createApiApp`, preserve `/health`, `/apps`, `/images`, `/progress`, `/jobs`, and `/jobs/:id/cancel`, and add the validated paths. The key implementation is:

```typescript
import express from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { query, createJob, listJobs, getJob, setJobStatus } from "../../../src/db.ts";
import { publishJob, type Job } from "../../../src/queue.ts";
import { readProgress, requestCancel } from "../../../src/progress.ts";
import { findBulkImage, isAppSlug } from "../../../src/imageSource.ts";

const JOB_TYPES = ["discover-catalog", "import-app", "caption-app", "synthesize-app"] as const;
const defaults = { query, createJob, listJobs, getJob, setJobStatus, publishJob, readProgress, requestCancel, dataDir: process.env.DATA_DIR ?? "data" };
type ApiDeps = typeof defaults;

function validMobbinScreensUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "mobbin.com" || url.hostname === "www.mobbin.com")
      && /^\/apps\/[^/]+\/[^/]+\/screens\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function createApiApp(overrides: Partial<ApiDeps> = {}) {
  const deps = { ...defaults, ...overrides };
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/apps", async (_req, res) => {
    const rows = await deps.query(
      `SELECT a.name AS app, COUNT(*) as "imageCount", COUNT(i.description) as "captionedCount"
       FROM images i
       JOIN platforms p ON p.id = i.platform_id
       JOIN apps a ON a.id = p.app_id
       GROUP BY a.name ORDER BY a.name`
    );
    res.json(rows.rows);
  });

  app.get("/images", async (req, res) => {
    const appName = String(req.query.app ?? "");
    if (!appName) return void res.status(400).json({ error: "app query param required" });
    const rows = await deps.query(
      `SELECT i.id, a.name AS app, i.image_url, i.description, i.created_at
       FROM images i
       JOIN platforms p ON p.id = i.platform_id
       JOIN apps a ON a.id = p.app_id
       WHERE a.name = $1 ORDER BY i.created_at ASC`,
      [appName]
    );
    res.json(rows.rows);
  });

  app.get("/progress", (_req, res) => res.json(deps.readProgress()));

  app.post("/jobs", async (req, res) => {
    const { type, name, url } = req.body ?? {};
    if (!JOB_TYPES.includes(type)) return void res.status(400).json({ error: `type must be one of: ${JOB_TYPES.join(", ")}` });
    if (type === "import-app" && (!isAppSlug(name) || !validMobbinScreensUrl(url))) {
      return void res.status(400).json({ error: "import-app requires a lowercase app slug and an HTTPS Mobbin screens URL" });
    }
    if ((type === "caption-app" || type === "synthesize-app") && !isAppSlug(name)) {
      return void res.status(400).json({ error: `${type} requires a lowercase app slug` });
    }
    const payload = { name, url };
    const id = await deps.createJob(type, payload);
    try {
      await deps.publishJob({ type, name, url, jobId: id } as Job);
    } catch (error) {
      const message = (error as Error).message;
      await deps.setJobStatus(id, "error", message);
      return void res.status(503).json({ id, error: message });
    }
    res.status(201).json({ id });
  });

  app.get("/jobs", async (_req, res) => res.json(await deps.listJobs()));

  app.post("/jobs/:id/cancel", async (req, res) => {
    const id = Number(req.params.id);
    const job = await deps.getJob(id);
    if (!job) return void res.status(404).json({ error: "job not found" });
    if (job.status === "queued" || job.status === "running") {
      if (job.status === "running") deps.requestCancel();
      await deps.setJobStatus(id, "cancelled", "Cancelled by user");
    }
    res.json(await deps.getJob(id));
  });

  app.get("/design-systems/:app", (req, res) => {
    const appSlug = req.params.app;
    if (!isAppSlug(appSlug)) return void res.status(400).json({ error: "invalid app slug" });
    try {
      const markdown = readFileSync(resolve(deps.dataDir, "design-systems", `${appSlug}.md`), "utf8");
      res.type("text/markdown").send(markdown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return void res.status(404).json({ error: "design system not found" });
      throw error;
    }
  });

  app.get("/media/:app/:hash", (req, res) => {
    const path = findBulkImage(deps.dataDir, req.params.app, req.params.hash);
    if (!isAppSlug(req.params.app) || !/^[0-9a-f]{16}$/.test(req.params.hash)) {
      return void res.status(400).json({ error: "invalid media reference" });
    }
    if (!path) return void res.status(404).json({ error: "image not found" });
    res.sendFile(resolve(path));
  });

  return app;
}
```

- [ ] **Step 4: Make the API entry point start the factory**

```typescript
import { createApiApp } from "./app.ts";

const PORT = Number(process.env.PORT ?? 3000);
createApiApp().listen(PORT, () => console.log(`[api] listening on :${PORT}`));
```

- [ ] **Step 5: Run API tests and type checking**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts`

Expected: 3 tests pass.

Run: `npx tsc --noEmit`

Expected: PASS.

### Task 6: Connect Vite data and proxy routes

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Map stored image references for browser rendering**

Import the helper:

```typescript
import { publicImageUrl } from './src/imageSource.ts';
```

Replace the screen URL assignment inside `vitrineDataPlugin`:

```typescript
url: publicImageUrl(app, img.image_url),
```

- [ ] **Step 2: Add three narrow API proxies**

Add this `server` property to `defineConfig`:

```typescript
server: {
  proxy: Object.fromEntries(
    ['/api/jobs', '/api/design-systems', '/api/media'].map((prefix) => [
      prefix,
      {
        target: 'http://localhost:3000',
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
    ]),
  ),
},
```

Do not proxy `/api/apps` or `/api/progress`; the existing Vite middleware continues to own those paths.

- [ ] **Step 3: Verify helper tests and the frontend build**

Run: `node --experimental-strip-types --test src/imageSource.test.ts`

Expected: 3 tests pass.

Run: `npm run build`

Expected: Vite completes successfully.

### Task 7: Model, poll, submit, and display job pipelines

**Files:**
- Modify: `src/vitrine/types.ts`
- Create: `src/vitrine/jobs.test.ts`
- Create: `src/vitrine/jobs.ts`
- Create: `src/vitrine/useJobs.ts`
- Create: `src/vitrine/components/PipelinePanel.tsx`
- Modify: `src/vitrine/useApps.ts`
- Modify: `src/vitrine/App.tsx`

- [ ] **Step 1: Add the durable job type**

```typescript
export interface Job {
  id: number;
  parent_id: number | null;
  type: 'discover-catalog' | 'import-app' | 'caption-app' | 'synthesize-app';
  payload: { name?: string; url?: string };
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  message: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface JobPipeline {
  root: Job;
  stages: Job[];
}
```

- [ ] **Step 2: Write a failing pure grouping test**

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupPipelines } from './jobs.ts';
import type { Job } from './types.ts';

const job = (id: number, parent_id: number | null, type: Job['type']): Job => ({
  id, parent_id, type, payload: { name: 'linear' }, status: 'done', message: null,
  created_at: `2026-07-10T00:00:0${id}Z`, updated_at: null,
});

test('groups import, caption, and synthesis into one ordered pipeline', () => {
  const pipelines = groupPipelines([
    job(3, 2, 'synthesize-app'), job(2, 1, 'caption-app'), job(1, null, 'import-app'),
  ]);
  assert.equal(pipelines.length, 1);
  assert.deepEqual(pipelines[0].stages.map((stage) => stage.type), ['import-app', 'caption-app', 'synthesize-app']);
});
```

- [ ] **Step 3: Run the test and confirm the helper is missing**

Run: `node --experimental-strip-types --test src/vitrine/jobs.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `jobs.ts`.

- [ ] **Step 4: Implement pipeline grouping**

```typescript
import type { Job, JobPipeline } from './types.ts';

export function groupPipelines(jobs: Job[]): JobPipeline[] {
  const byParent = new Map<number, Job[]>();
  for (const job of jobs) {
    if (job.parent_id == null) continue;
    const siblings = byParent.get(job.parent_id) ?? [];
    siblings.push(job);
    byParent.set(job.parent_id, siblings);
  }
  const descend = (job: Job): Job[] => [
    job,
    ...(byParent.get(job.id) ?? [])
      .sort((a, b) => a.id - b.id)
      .flatMap(descend),
  ];
  return jobs
    .filter((job) => job.parent_id == null && job.type === 'import-app')
    .sort((a, b) => b.id - a.id)
    .map((root) => ({ root, stages: descend(root) }));
}
```

- [ ] **Step 5: Implement the polling hook**

`useJobs` must fetch immediately, poll every 1.5 seconds only while any job is queued/running, and expose `submitImport` and `cancelJob`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import type { Job } from './types';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/jobs');
    if (!response.ok) throw new Error(`/api/jobs returned ${response.status}`);
    setJobs(await response.json());
    setError(null);
  }, []);
  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
    const id = window.setInterval(() => {
      if (jobs.some((job) => job.status === 'queued' || job.status === 'running')) {
        refresh().catch((e: Error) => setError(e.message));
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [jobs, refresh]);
  const submitImport = async (name: string, url: string) => {
    const response = await fetch('/api/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'import-app', name, url }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `Import returned ${response.status}`);
    await refresh();
  };
  const cancelJob = async (id: number) => {
    const response = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
    if (!response.ok) throw new Error(`Cancel returned ${response.status}`);
    await refresh();
  };
  return { jobs, error, refresh, submitImport, cancelJob };
}
```

- [ ] **Step 6: Build the import and status panel**

Create `PipelinePanel.tsx` with the complete form, completion refresh, and stage list:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Text, TextInput } from '@astryxdesign/core';
import { groupPipelines } from '../jobs';
import type { Job } from '../types';
import { useJobs } from '../useJobs';

const STAGE_LABEL: Record<Job['type'], string> = {
  'import-app': 'Import screenshots',
  'caption-app': 'Caption screens',
  'synthesize-app': 'Synthesize design system',
  'discover-catalog': 'Discover catalog',
};
const STATUS_VARIANT: Record<Job['status'], 'neutral' | 'info' | 'success' | 'error'> = {
  queued: 'neutral', running: 'info', done: 'success', error: 'error', cancelled: 'neutral',
};

export function PipelinePanel({ onPipelineDone }: { onPipelineDone: () => void | Promise<void> }) {
  const { jobs, error, submitImport, cancelJob } = useJobs();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const seenDone = useRef(new Set<number>());
  const pipelines = groupPipelines(jobs);

  useEffect(() => {
    for (const job of jobs) {
      if (job.type === 'synthesize-app' && job.status === 'done' && !seenDone.current.has(job.id)) {
        seenDone.current.add(job.id);
        void onPipelineDone();
      }
    }
  }, [jobs, onPipelineDone]);

  const submit = async () => {
    setSubmitError(null);
    try {
      await submitImport(name.trim(), url.trim());
      setUrl('');
    } catch (cause) {
      setSubmitError((cause as Error).message);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text weight="semibold">Import a Mobbin app</Text>
          <Text type="supporting" color="secondary">Crawl screenshots, caption them, and synthesize a design system.</Text>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.35fr) minmax(320px, 1fr) auto', gap: 12, alignItems: 'end' }}>
          <TextInput label="App name" value={name} onChange={setName} placeholder="linear" isRequired hasClear />
          <TextInput
            label="Mobbin screens URL"
            value={url}
            onChange={setUrl}
            placeholder="https://mobbin.com/apps/.../screens"
            isRequired
            hasClear
            status={submitError ? { type: 'error', message: submitError } : undefined}
          />
          <Button label="Import app" variant="primary" clickAction={submit} isDisabled={!name.trim() || !url.trim()} />
        </div>
        {error ? <div style={{ color: '#b42318', fontSize: 13 }}>{error}</div> : null}
        {pipelines.slice(0, 5).map((pipeline) => (
          <div key={pipeline.root.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <Text weight="semibold">{pipeline.root.payload.name ?? `Pipeline ${pipeline.root.id}`}</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {pipeline.stages.map((stage) => (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge label={stage.status} variant={STATUS_VARIANT[stage.status]} />
                  <Text type="supporting">{STAGE_LABEL[stage.type]}</Text>
                  {stage.message ? <Text type="supporting" color="secondary">{stage.message}</Text> : null}
                  <div style={{ flex: 1 }} />
                  {stage.status === 'queued' || stage.status === 'running' ? (
                    <Button label="Cancel" size="sm" variant="destructive" clickAction={() => cancelJob(stage.id)} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 7: Make gallery data refreshable**

Replace the single-run effect in `useApps` with a `useCallback` refresh function and return it:

```typescript
const refresh = useCallback(() => {
  setError(null);
  return fetch('/api/apps')
    .then((res) => { if (!res.ok) throw new Error(`/api/apps returned ${res.status}`); return res.json(); })
    .then((data: App[]) => setApps(data))
    .catch((err: Error) => setError(err.message));
}, []);
useEffect(() => { void refresh(); }, [refresh]);
return { apps, loading: apps === null && !error, error, refresh };
```

- [ ] **Step 8: Integrate the panel into every App state**

Add the import and destructure the refresh callback:

```typescript
import { PipelinePanel } from './components/PipelinePanel';
```

```typescript
const { apps, loading, error, refresh } = useApps();
```

In the empty/error layout, replace the existing top progress container with:

```tsx
<div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 28px 0', width: '100%' }}>
  <PipelinePanel onPipelineDone={refresh} />
  <ProgressBanner />
</div>
```

In the populated gallery, insert this immediately after the sticky header container and before `ProgressBanner`:

```tsx
<PipelinePanel onPipelineDone={refresh} />
```

Replace the empty-state description with:

```typescript
'Submit a Mobbin application above to import screenshots and build its design system.'
```

- [ ] **Step 9: Run job tests and build**

Run: `node --experimental-strip-types --test src/vitrine/jobs.test.ts`

Expected: 1 test passes.

Run: `npx tsc --noEmit && npm run build`

Expected: both commands pass.

### Task 8: Display synthesized Markdown in application detail

**Files:**
- Create: `src/vitrine/components/DesignSystemPanel.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`

- [ ] **Step 1: Add the document component**

```tsx
import { useEffect, useState } from 'react';
import { EmptyState, Markdown, Spinner } from '@astryxdesign/core';

export function DesignSystemPanel({ appId }: { appId: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/design-systems/${appId}`)
      .then(async (response) => {
        if (response.status === 404) { if (!cancelled) setMissing(true); return null; }
        if (!response.ok) throw new Error(`Design system returned ${response.status}`);
        return response.text();
      })
      .then((text) => { if (!cancelled && text != null) setMarkdown(text); })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [appId]);
  if (missing) return <EmptyState title="No design system yet" description="Complete the synthesis stage to generate this document." />;
  if (markdown === null) return <Spinner size="lg" />;
  return <Markdown contentWidth={760}>{markdown}</Markdown>;
}
```

- [ ] **Step 2: Add the Design System detail tab**

Extend the section type:

```typescript
type Section = 'screens' | 'elements' | 'flows' | 'design-system';
```

Initialize `tabRefs` with a `design-system` key and add the tab tuple:

```typescript
const tabRefs = useRef<Record<Section, HTMLButtonElement | null>>({
  screens: null,
  elements: null,
  flows: null,
  'design-system': null,
});
```

```tsx
['design-system', 'Design System'],
```

Import the component:

```typescript
import { DesignSystemPanel } from './DesignSystemPanel';
```

Replace the opening `{section === 'flows' ? (` in the content area with:

```tsx
{section === 'design-system' ? (
  <DesignSystemPanel appId={app.id} />
) : section === 'flows' ? (
```

Keep the remainder of the current flows/screens/elements ternary after that opening. Add the document label as the first branch of the header-count expression:

```typescript
section === 'design-system'
  ? 'Design system document'
  : section === 'screens'
```

Use the element padding for the new section by replacing the padding expression with:

```typescript
section === 'screens'
  ? '32px 40px 72px'
  : section === 'elements' || section === 'design-system'
    ? '8px 40px 80px'
    : '32px 40px 80px'
```

- [ ] **Step 3: Type-check and build the complete UI**

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

### Task 9: Full automated and manual verification

**Files:**
- Modify: `package.json`
- Verify: all files named above

- [ ] **Step 1: Make the repository test command include nested tests**

Replace the test script with:

```json
"test": "node --experimental-strip-types --test src/*.test.ts src/vitrine/*.test.ts services/api/src/*.test.ts services/import-worker/src/*.test.ts"
```

- [ ] **Step 2: Run every automated check**

```sh
npm test
npx tsc --noEmit
npm run build
docker compose config --quiet
```

Expected: all tests pass, TypeScript exits 0, Vite builds, and Compose validation exits 0.

- [ ] **Step 3: Start infrastructure**

Run: `docker compose up -d postgres rabbitmq`

Expected: both services become healthy.

- [ ] **Step 4: Start the three host processes in separate terminals**

```sh
npm run service:api
npm run service:import-worker
npm run dev
```

Expected: API listens on 3000, worker waits for jobs, and Vite prints its local URL.

- [ ] **Step 5: Exercise the acceptance path**

In Vitrine:

1. submit a lowercase app name and its HTTPS Mobbin screens URL;
2. confirm import, caption, and synthesis appear under one job chain;
3. confirm each stage reaches `done` in order;
4. open the app and verify local bulk screenshots render;
5. open the Design System tab and verify Markdown renders;
6. submit the same app again and verify image rows are not duplicated;
7. cancel a fresh run and verify no successor stage appears.

- [ ] **Step 6: Record the verification evidence**

Capture the exact test counts, build output summary, created root job ID, child job IDs, generated Markdown path, and any DLQ messages. Do not claim completion unless the entire automated suite and one real Mobbin acceptance run succeed.
