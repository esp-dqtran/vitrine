# Sites Crawl Fail-and-Continue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every per-Site crawl error terminal for that Site while keeping the Sites worker alive and consuming the next queued job.

**Architecture:** Replace the response listener's prematurely rejected Promise with a latch that resolves to a success-or-error value and throws only when read inside the crawler call stack. Simplify the Sites pipeline failure boundary so every non-cancellation crawl exception records a safe `error` status and returns normally, allowing RabbitMQ to acknowledge the message and deliver the next Site.

**Tech Stack:** TypeScript, Node.js test runner, Playwright, RabbitMQ, PostgreSQL, Docker Compose

---

### Task 1: Keep response-capture failures inside the crawler call stack

**Files:**
- Modify: `src/sitesCrawler.ts:479-518`
- Test: `src/sitesCrawler.test.ts`

- [ ] **Step 1: Write the failing latch regression test**

Add `createSiteCaptureLatch` to the import list and add:

```typescript
test("defers a source-capture failure until the crawler reads it", async () => {
  const latch = createSiteCaptureLatch();
  const error = new PermanentSiteImportError("Mobbin Sites source changed");

  latch.fail(error);
  await new Promise<void>((resolve) => setImmediate(resolve));

  await assert.rejects(latch.read(), error);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/sitesCrawler.test.ts
```

Expected: FAIL because `createSiteCaptureLatch` is not exported.

- [ ] **Step 3: Implement the non-rejecting capture latch**

Add near the crawler error types:

```typescript
type SiteCaptureOutcome =
  | { ok: true; graph: SiteImport }
  | { ok: false; error: Error };

export function createSiteCaptureLatch() {
  let settle!: (outcome: SiteCaptureOutcome) => void;
  const outcome = new Promise<SiteCaptureOutcome>((resolve) => {
    settle = resolve;
  });

  return {
    succeed(graph: SiteImport) {
      settle({ ok: true, graph });
    },
    fail(error: Error) {
      settle({ ok: false, error });
    },
    async read(): Promise<SiteImport> {
      const result = await outcome;
      if (!result.ok) throw result.error;
      return result.graph;
    },
  };
}
```

In `captureSitesSource`, replace the manually rejected `captured` Promise with the latch:

```typescript
const capture = createSiteCaptureLatch();
```

Settle it from the response listener:

```typescript
finish(() => capture.fail(new PermanentSiteImportError("Mobbin authentication required")));
finish(() => capture.succeed(graph));
finish(() => capture.fail(new PermanentSiteImportError("Mobbin Sites source changed")));
```

Replace both reads of `await captured` with:

```typescript
await capture.read()
```

- [ ] **Step 4: Run the focused crawler tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/sitesCrawler.test.ts
```

Expected: all `sitesCrawler` tests pass with no unhandled rejection.

- [ ] **Step 5: Commit the capture-boundary fix**

```bash
git add src/sitesCrawler.ts src/sitesCrawler.test.ts
git commit -m "fix: contain Sites source capture failures"
```

### Task 2: Mark every crawl error failed without retrying

**Files:**
- Modify: `services/sites-import-worker/src/pipeline.ts:43-78`
- Test: `services/sites-import-worker/src/pipeline.test.ts`

- [ ] **Step 1: Replace the retry expectation with a fail-and-continue test**

Replace `transient failures rethrow and become terminal only on the final attempt` with:

```typescript
test("every crawl failure becomes terminal without queue retry", async () => {
  const statuses: Array<[number, string, string | undefined]> = [];
  const handler = createSitesPipelineHandler({
    getJob: async () => ({ id: 42, type: "import-site", status: "queued" }) as never,
    setJobStatus: async (id, status, message) => { statuses.push([id, status, message]); },
    crawl: async () => { throw new Error("upstream included https://secret.example/token"); },
  });

  await handler(job, { attempt: 1, maxAttempts: 3 });

  assert.deepEqual(statuses, [
    [42, "running", "Inspecting Site"],
    [42, "error", "upstream included [redacted-url]"],
  ]);
});
```

- [ ] **Step 2: Run the pipeline test and verify RED**

Run:

```bash
node --experimental-strip-types --test services/sites-import-worker/src/pipeline.test.ts
```

Expected: FAIL because a generic crawl exception is still rethrown.

- [ ] **Step 3: Implement immediate terminal handling**

Remove the permanent-error-only and final-attempt branches. Keep cancellation unchanged, then record every other crawl exception and return:

```typescript
    } catch (error) {
      if (error instanceof SiteImportCancelledError) return;
      await deps.setJobStatus(
        job.jobId,
        "error",
        safeFailureMessage(error instanceof Error ? error.message : ""),
      );
    }
```

Rename `safePermanentMessage` to `safeFailureMessage` and retain its URL redaction, trimming, length ceiling, and safe fallback. Remove the now-unused `PermanentSiteImportError` import.

- [ ] **Step 4: Run focused worker and crawler tests**

Run:

```bash
node --experimental-strip-types --test \
  src/sitesCrawler.test.ts \
  services/sites-import-worker/src/pipeline.test.ts \
  src/sitesQueue.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the pipeline behavior**

```bash
git add services/sites-import-worker/src/pipeline.ts services/sites-import-worker/src/pipeline.test.ts
git commit -m "fix: fail Sites jobs and continue"
```

### Task 3: Verify the live worker advances

**Files:**
- Runtime only: `sites-import-worker`

- [ ] **Step 1: Rebuild and restart only the Sites worker**

Run:

```bash
docker compose up -d --build --no-deps sites-import-worker
```

Expected: `sites-import-worker` is running and RabbitMQ reports one consumer.

- [ ] **Step 2: Verify Biograph becomes terminal and the next Site starts**

Use read-only database queries to confirm:

```sql
SELECT id, status, payload->>'url' AS url, message, updated_at
FROM jobs
WHERE type = 'import-site'
ORDER BY id
LIMIT 20;
```

Expected: Biograph is `error` with a safe message; a later queued Site is `running` or `done`.

- [ ] **Step 3: Verify queue and container health**

Run:

```bash
docker compose ps sites-import-worker
docker exec astryx-rabbitmq-1 rabbitmqctl list_queues \
  name messages_ready messages_unacknowledged consumers
```

Expected: worker remains running, `mobbin-sites-jobs` has one consumer, and ready messages decrease as work advances.

- [ ] **Step 4: Check the scoped diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing worktree changes remain untouched.
