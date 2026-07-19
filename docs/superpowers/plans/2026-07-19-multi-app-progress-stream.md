# Multi-App Progress Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one live progress row per concurrent Astryx crawler and deliver changes through SSE instead of browser polling.

**Architecture:** `src/progress.ts` becomes the file-backed progress-store boundary: each `WORKER_ID` atomically writes its own file, readers return a complete snapshot, and subscribers receive filesystem-change notifications. The admin API streams complete snapshots over SSE, while the React hook consumes one `EventSource` and the banner renders the aggregate state.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Express 5, React 19, browser EventSource, Node test runner, React server rendering.

---

## File Map

- Modify `src/progress.ts`: define aggregate progress types, scoped atomic persistence, legacy fallback, and filesystem subscriptions.
- Create `src/progress.multi.test.ts`: verify independent workers, legacy compatibility, malformed-file handling, and subscriptions.
- Modify `services/api/src/app.ts`: expose aggregate JSON and the admin-only SSE stream with cleanup.
- Modify `services/api/src/app.test.ts`: verify authorization, initial SSE snapshot, pushed replacement snapshots, and cleanup.
- Modify `src/vitrine/types.ts`: mirror the backend progress entry and snapshot contract, including `smart-crawl`.
- Modify `src/vitrine/useProgress.ts`: replace fetch/setInterval with an EventSource subscription and payload validation.
- Create `src/vitrine/useProgress.test.ts`: verify event parsing, invalid-payload retention, and close cleanup through an injected source factory.
- Modify `src/vitrine/components/ProgressBanner.tsx`: render an aggregate summary and one row per visible app.
- Create `src/vitrine/components/ProgressBanner.test.tsx`: render multiple states and verify terminal filtering and `Cancel all` labeling.

### Task 1: Scoped progress persistence

**Files:**
- Modify: `src/progress.ts`
- Create: `src/progress.multi.test.ts`

- [ ] **Step 1: Write failing independent-worker and legacy tests**

Create temporary data directories and assert the intended public API:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProgress, writeProgress, type ProgressState } from './progress.ts';

const running = (app: string): Omit<ProgressState, 'updatedAt'> => ({
  stage: 'crawl', app, done: 1, total: 4, status: 'running', message: 'Downloading',
});

test('keeps concurrent worker progress isolated', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'astryx-progress-'));
  try {
  writeProgress(running('linear'), { dataDir, workerId: '1' });
  writeProgress(running('notion'), { dataDir, workerId: '2' });
  assert.deepEqual(readProgress({ dataDir }).entries.map(({ id, app }) => ({ id, app })), [
    { id: 'worker:1', app: 'linear' },
    { id: 'worker:2', app: 'notion' },
  ]);
  } finally { rmSync(dataDir, { recursive: true, force: true }); }
});

test('uses the legacy record only before scoped workers exist', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'astryx-progress-'));
  const updatedAt = '2026-07-19T00:00:00.000Z';
  writeFileSync(join(dataDir, 'progress.json'), JSON.stringify({ ...running('legacy'), updatedAt }));
  assert.equal(readProgress({ dataDir }).entries[0].id, 'worker:legacy');
  writeProgress(running('scoped'), { dataDir, workerId: '3' });
  assert.deepEqual(readProgress({ dataDir }).entries.map(({ app }) => app), ['scoped']);
  rmSync(dataDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --experimental-strip-types --test src/progress.multi.test.ts
```

Expected: FAIL because `writeProgress` and `readProgress` do not accept options and `readProgress` does not return `entries`.

- [ ] **Step 3: Implement aggregate types and scoped atomic writes**

Add these public contracts and preserve the one-argument writer call used by existing crawlers:

```ts
export interface ProgressEntry extends ProgressState {
  id: string;
}

export interface ProgressSnapshot {
  entries: ProgressEntry[];
}

export interface ProgressStoreOptions {
  dataDir?: string;
  workerId?: string;
}

export function writeProgress(
  state: Omit<ProgressState, 'updatedAt'>,
  options: ProgressStoreOptions = {},
): void {
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? 'data';
  const scope = progressScope(options.workerId ?? process.env.WORKER_ID);
  const directory = join(dataDir, 'progress');
  mkdirSync(directory, { recursive: true });
  const entry = { ...state, id: `worker:${scope}`, updatedAt: new Date().toISOString() };
  const target = join(directory, `${scope}.json`);
  const temporary = join(directory, `.${scope}.${process.pid}.tmp`);
  writeFileSync(temporary, JSON.stringify(entry));
  renameSync(temporary, target);
}
```

Implement `readProgress(options)` by sorting valid `*.json` scoped entries by ID. If no valid scoped entry exists, parse `data/progress.json`, validate it, add `id: 'worker:legacy'`, and return it. Malformed files contribute no entry.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --experimental-strip-types --test src/progress.multi.test.ts
```

Expected: PASS for independent workers, legacy fallback, scoped precedence, and malformed-file isolation.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add src/progress.ts src/progress.multi.test.ts
git commit -m "feat: isolate concurrent crawl progress"
```

### Task 2: Filesystem progress subscriptions

**Files:**
- Modify: `src/progress.ts`
- Modify: `src/progress.multi.test.ts`

- [ ] **Step 1: Write a failing subscription test**

```ts
test('pushes a complete snapshot after a scoped progress change', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'astryx-progress-'));
  const snapshots: ProgressSnapshot[] = [];
  const unsubscribe = subscribeProgress((snapshot) => snapshots.push(snapshot), { dataDir });
  writeProgress(running('figma'), { dataDir, workerId: '4' });
  await waitForProgress(() => snapshots.some(({ entries }) => entries.some(({ app }) => app === 'figma')));
  unsubscribe();
  const count = snapshots.length;
  writeProgress(running('slack'), { dataDir, workerId: '4' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(snapshots.length, count);
  rmSync(dataDir, { recursive: true, force: true });
});

async function waitForProgress(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for progress notification');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
```

- [ ] **Step 2: Run the subscription test and confirm RED**

Run:

```bash
node --experimental-strip-types --test src/progress.multi.test.ts
```

Expected: FAIL because `subscribeProgress` is not exported.

- [ ] **Step 3: Implement the watcher subscription**

```ts
export function subscribeProgress(
  listener: (snapshot: ProgressSnapshot) => void,
  options: ProgressStoreOptions = {},
): () => void {
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? 'data';
  const directory = join(dataDir, 'progress');
  mkdirSync(directory, { recursive: true });
  let active = true;
  let queued = false;
  const notify = () => {
    if (!active || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (active) listener(readProgress({ ...options, dataDir }));
    });
  };
  const scopedWatcher = watch(directory, notify);
  const legacyWatcher = watch(dataDir, (_event, filename) => {
    if (String(filename ?? '') === 'progress.json') notify();
  });
  return () => {
    active = false;
    scopedWatcher.close();
    legacyWatcher.close();
  };
}
```

- [ ] **Step 4: Run progress tests and confirm GREEN**

Run:

```bash
node --experimental-strip-types --test src/progress.multi.test.ts
```

Expected: all progress-store tests PASS and the post-unsubscribe write produces no notification.

- [ ] **Step 5: Commit the subscription slice**

```bash
git add src/progress.ts src/progress.multi.test.ts
git commit -m "feat: stream progress store changes"
```

### Task 3: Admin SSE endpoint

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing authorization and stream lifecycle tests**

Inject `readProgress` and `subscribeProgress` into `createApiApp`. Verify a normal user receives 403 without subscribing. For an admin, read the first stream chunk and assert:

```ts
async function readSseChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const result = await reader.read();
  if (result.done) throw new Error('SSE stream closed before an event arrived');
  return new TextDecoder().decode(result.value);
}

assert.match(firstChunk, /event: progress/);
assert.match(firstChunk, /"app":"linear"/);
subscriptionListener?.({ entries: [{ ...entry, app: 'notion' }] });
assert.match(await readSseChunk(reader), /"app":"notion"/);
controller.abort();
await waitForProgress(() => unsubscribeCalls === 1);
```

- [ ] **Step 2: Run the focused API tests and confirm RED**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern='progress stream' services/api/src/app.test.ts
```

Expected: FAIL with 404 for `/progress/stream` or a missing `subscribeProgress` dependency.

- [ ] **Step 3: Implement the SSE route**

Add `subscribeProgress` to API defaults and mount this route beside `GET /progress`:

```ts
app.get('/progress/stream', requireAdmin, (_req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = (snapshot = deps.readProgress()) => {
    res.write(`event: progress\ndata: ${JSON.stringify(snapshot)}\n\n`);
  };
  send();
  const unsubscribe = deps.subscribeProgress(send);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  res.once('close', cleanup);
});
```

- [ ] **Step 4: Run the focused API tests and confirm GREEN**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern='progress stream' services/api/src/app.test.ts
```

Expected: admin stream and cleanup tests PASS; non-admin access is 403 and never subscribes.

- [ ] **Step 5: Commit the API slice**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: push crawl progress over SSE"
```

### Task 4: EventSource frontend subscription

**Files:**
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/useProgress.ts`
- Create: `src/vitrine/useProgress.test.ts`

- [ ] **Step 1: Write failing EventSource behavior tests**

Use a fake source with recorded listeners:

```ts
test('subscribes to pushed progress and closes cleanly', () => {
  const updates: ProgressSnapshot[] = [];
  const fake = new FakeEventSource();
  const close = subscribeToProgress((snapshot) => updates.push(snapshot), () => fake);
  fake.emit('progress', JSON.stringify({ entries: [entry] }));
  fake.emit('progress', '{bad json');
  assert.deepEqual(updates, [{ entries: [entry] }]);
  close();
  assert.equal(fake.closed, true);
});

class FakeEventSource {
  closed = false;
  private listeners = new Map<string, (event: MessageEvent<string>) => void>();
  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener as (event: MessageEvent<string>) => void);
  }
  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
  close(): void { this.closed = true; }
}
```

- [ ] **Step 2: Run the focused hook tests and confirm RED**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useProgress.test.ts
```

Expected: FAIL because `subscribeToProgress` and `ProgressSnapshot` do not exist.

- [ ] **Step 3: Implement the typed EventSource boundary**

Update the frontend type to include `id`, `smart-crawl`, and `ProgressSnapshot`. Export a pure `subscribeToProgress` helper that creates `/api/progress/stream`, listens only for named `progress` events, validates the full payload, ignores invalid events, and returns `source.close`.

Replace the hook effect with:

```ts
export function useProgress() {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  useEffect(() => subscribeToProgress(setSnapshot), []);
  return snapshot;
}
```

Do not retain `POLL_MS`, `fetch`, `setInterval`, or a manual reconnect timer.

- [ ] **Step 4: Run hook tests and confirm GREEN**

Run:

```bash
node --experimental-strip-types --test src/vitrine/useProgress.test.ts
```

Expected: valid progress events update state, invalid events do not clear state, and cleanup closes the source.

- [ ] **Step 5: Commit the frontend transport slice**

```bash
git add src/vitrine/types.ts src/vitrine/useProgress.ts src/vitrine/useProgress.test.ts
git commit -m "feat: consume progress with EventSource"
```

### Task 5: Multi-app progress presentation

**Files:**
- Modify: `src/vitrine/components/ProgressBanner.tsx`
- Create: `src/vitrine/components/ProgressBanner.test.tsx`

- [ ] **Step 1: Write failing rendered-output tests**

Render an exported `ProgressBannerView` with two running entries, one error, and one done entry. Assert the HTML contains `2 apps crawling`, both running apps, the error app and message, and `Cancel all`, but not the done app.

- [ ] **Step 2: Run the component test and confirm RED**

Run:

```bash
tsx --test src/vitrine/components/ProgressBanner.test.tsx
```

Expected: FAIL because `ProgressBannerView` does not exist and the current component accepts only one progress record.

- [ ] **Step 3: Implement aggregate rendering**

```tsx
export function ProgressBannerView({ snapshot }: { snapshot: ProgressSnapshot | null }) {
  const entries = (snapshot?.entries ?? [])
    .filter(({ status }) => status !== 'done' && status !== 'idle')
    .sort(compareProgressEntries);
  if (!entries.length) return null;
  const running = entries.filter(({ status }) => status === 'running');
  return (
    <div aria-label="Crawl progress">
      <div>{running.length ? `${running.length} ${running.length === 1 ? 'app' : 'apps'} crawling` : 'Crawl progress'}</div>
      {running.length ? <Button label="Cancel all" variant="destructive" size="sm" clickAction={cancel} /> : null}
      {entries.map((entry) => <ProgressRow key={entry.id} entry={entry} />)}
    </div>
  );
}

export function ProgressBanner() {
  return <ProgressBannerView snapshot={useProgress()} />;
}
```

Keep the current Astryx `ProgressBar` variants and indeterminate behavior. Include `message` in the visible row label when present.

- [ ] **Step 4: Run the component test and confirm GREEN**

Run:

```bash
tsx --test src/vitrine/components/ProgressBanner.test.tsx
```

Expected: all multi-app presentation tests PASS.

- [ ] **Step 5: Commit the presentation slice**

```bash
git add src/vitrine/components/ProgressBanner.tsx src/vitrine/components/ProgressBanner.test.tsx
git commit -m "feat: show concurrent app crawl progress"
```

### Task 6: Full verification and live-safety audit

**Files:**
- Verify only; do not restart workers or mutate catalog state.

- [ ] **Step 1: Run all focused progress tests together**

```bash
node --experimental-strip-types --test src/progress.multi.test.ts src/vitrine/useProgress.test.ts services/api/src/app.test.ts
tsx --test src/vitrine/components/ProgressBanner.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run repository verification**

```bash
npm test
npm run build
git diff --check
```

Expected: tests and build exit 0. The existing Vite large-chunk advisory may remain, but no new error is accepted.

- [ ] **Step 3: Verify polling is gone and crawler processes are untouched**

```bash
rg -n "POLL_MS|setInterval\(tick|fetch\('/api/progress'\)" src/vitrine/useProgress.ts
ps -axo pid,ppid,etime,command | rg "scripts/catalog-import.ts" | rg -v "rg "
```

Expected: the source search returns no matches and the six catalog-import worker PIDs remain active.

- [ ] **Step 4: Review the implementation against the design**

Confirm every design success criterion has a corresponding passing test or read-only runtime check. Confirm no active worker was restarted and no data file was modified manually.

- [ ] **Step 5: Commit any final test-only corrections**

```bash
git add src/progress.ts src/progress.multi.test.ts services/api/src/app.ts services/api/src/app.test.ts src/vitrine/types.ts src/vitrine/useProgress.ts src/vitrine/useProgress.test.ts src/vitrine/components/ProgressBanner.tsx src/vitrine/components/ProgressBanner.test.tsx
git commit -m "test: verify multi-app progress stream"
```

Skip this commit if verification requires no correction.
