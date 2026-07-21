# Fast Public Page Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce long public-page preview recordings to about 21 seconds while leaving screenshots and section capture unchanged.

**Architecture:** Keep the current Playwright screencast and continuous `requestAnimationFrame` scroll. Calculate duration with a pure, testable helper that preserves the configured minimum speed but caps long-page scrolling at 20 seconds; reduce default endpoint holds to 500 ms.

**Tech Stack:** TypeScript, Node test runner, Playwright, Vite

---

### Task 1: Add capped continuous-scroll timing

**Files:**
- Modify: `src/publicPageBrowser.test.ts`
- Modify: `src/publicPageBrowser.ts`

- [ ] **Step 1: Write the failing duration test**

Import `publicPageScrollDurationMs` in `src/publicPageBrowser.test.ts` and add:

```typescript
test("caps long previews without slowing short pages", () => {
  assert.equal(publicPageScrollDurationMs(1_000, 200), 5_000);
  assert.equal(publicPageScrollDurationMs(9_925, 200), 20_000);
  assert.equal(publicPageScrollDurationMs(100_000, 200, 20_000), 20_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/publicPageBrowser.test.ts
```

Expected: FAIL because `publicPageScrollDurationMs` is not exported.

- [ ] **Step 3: Add the duration option and helper**

In `src/publicPageBrowser.ts`, add `maxScrollDurationMs?: number` to `PublicPageBrowserOptions`. Default it to `20_000` and change the default `holdMs` to `500` in `createPublicPageBrowser`:

```typescript
maxScrollDurationMs: options.maxScrollDurationMs ?? 20_000,
holdMs: options.holdMs ?? 500,
```

Include `maxScrollDurationMs` in the required capture options and pass its validated value to `recordContinuousScroll` as `maxDurationMs`.

Add the pure timing helper:

```typescript
export function publicPageScrollDurationMs(
  distance: number,
  pixelsPerSecond: number,
  maxDurationMs = 20_000,
): number {
  const safeDistance = checkedNonNegative(distance, "scroll distance");
  const speed = checkedPositive(pixelsPerSecond, "scroll speed");
  const maximum = checkedPositive(maxDurationMs, "maximum scroll duration");
  return Math.min(maximum, Math.round(safeDistance / speed * 1_000));
}
```

Change `recordContinuousScroll` to accept `maxDurationMs` and calculate duration with this helper. Do not change its animation, WebM recording, or returned shape.

- [ ] **Step 4: Run both supported browser-test runtimes**

Run:

```bash
node --experimental-strip-types --test src/publicPageBrowser.test.ts
npx tsx --test src/publicPageBrowser.test.ts
```

Expected: both commands PASS, including the real Playwright WebM test.

- [ ] **Step 5: Run focused regression tests and build**

Run:

```bash
npx tsx --test src/publicPageBrowser.test.ts src/publicPageCrawler.test.ts services/public-page-import-worker/src/*.test.ts
node --experimental-strip-types --test src/publicPageQueue.test.ts src/publicPageStore.test.ts src/publicPageIsolation.test.ts services/api/src/app.test.ts
npm run build
```

Expected: all tests PASS and the production build exits 0.

- [ ] **Step 6: Commit only the timing implementation**

```bash
git add src/publicPageBrowser.ts src/publicPageBrowser.test.ts
git commit -m "perf: speed up public page previews"
```

### Task 2: Verify the Mobbin.com E2E duration

**Files:**
- No repository files modified

- [ ] **Step 1: Start isolated local dependencies**

Create a disposable local PostgreSQL database and object-store directory, then apply migrations:

```bash
docker compose exec -T postgres createdb -U postgres astryx_public_page_fast_e2e
mkdir -p /tmp/astryx-public-page-fast-e2e
env DATABASE_URL='postgres://postgres:postgres@localhost:5432/astryx_public_page_fast_e2e' npm run db:migrate
```

Start the API on port 3011 and the public-page worker in separate terminals with explicit local overrides; do not load production Supabase or S3 values from `.env`:

```bash
env DATABASE_URL='postgres://postgres:postgres@localhost:5432/astryx_public_page_fast_e2e' RABBITMQ_URL='amqp://localhost' OBJECT_STORE_BACKEND='local' OBJECT_STORE_LOCAL_ROOT='/tmp/astryx-public-page-fast-e2e' ADMIN_EMAIL='e2e-admin@localhost.test' ADMIN_PASSWORD='astryx-e2e-admin-password' PORT='3011' NODE_ENV='development' npm run service:api
```

```bash
env DATABASE_URL='postgres://postgres:postgres@localhost:5432/astryx_public_page_fast_e2e' RABBITMQ_URL='amqp://localhost' OBJECT_STORE_BACKEND='local' OBJECT_STORE_LOCAL_ROOT='/tmp/astryx-public-page-fast-e2e' NODE_ENV='development' npm run service:public-page-import-worker
```

- [ ] **Step 2: Submit and inspect a real Mobbin crawl**

Authenticate to the isolated API and submit the exact job:

```bash
curl -fsS -c /tmp/astryx-public-page-fast-e2e.cookie -H 'content-type: application/json' -d '{"email":"e2e-admin@localhost.test","password":"astryx-e2e-admin-password"}' http://127.0.0.1:3011/auth/login
curl -fsS -b /tmp/astryx-public-page-fast-e2e.cookie -H 'content-type: application/json' -d '{"type":"crawl-public-page","url":"https://mobbin.com/"}' http://127.0.0.1:3011/jobs
```

Read `GET /jobs` with the same cookie until the isolated job reaches `done`, then fetch `/apps/mobbin-com` and its reported `/apps/mobbin-com/page-preview/:versionId` URL.

- [ ] **Step 3: Measure the generated WebM**

Run `ffprobe` and `file` against the locally stored artifacts:

```bash
ffprobe -v error -show_entries format=duration,size -of json /tmp/astryx-public-page-fast-e2e/public-pages/*/captures/*/preview/*/*.webm
file /tmp/astryx-public-page-fast-e2e/public-pages/*/captures/*/page/*/*.png
```

Verify:

- duration is less than 20 seconds;
- content type is `video/webm`;
- the App still exposes one full-page Screen and its HTML-derived UI Elements;
- the full-page PNG remains 1440 px wide and retains the complete document height.

- [ ] **Step 4: Clean up isolated resources**

Stop the isolated API and worker, then clean up the exact test resources:

```bash
docker compose exec -T postgres dropdb -U postgres astryx_public_page_fast_e2e
docker compose exec -T rabbitmq rabbitmqctl purge_queue public-page-jobs.dlq
mv /tmp/astryx-public-page-fast-e2e /Users/kai/.Trash/astryx-public-page-fast-e2e
mv /tmp/astryx-public-page-fast-e2e.cookie /Users/kai/.Trash/astryx-public-page-fast-e2e.cookie
```
