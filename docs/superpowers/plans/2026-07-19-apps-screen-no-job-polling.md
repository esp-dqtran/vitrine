# Apps Screen Without Job Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Apps screen from making any `GET /api/jobs` requests while preserving import creation through `POST /api/jobs`.

**Architecture:** Introduce a focused import-command function that only enqueues an import. The Apps component uses that command directly and derives its grid exclusively from persisted app data, while the existing `useJobs` hook remains available to crawler-specific monitoring surfaces.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner

---

### Task 1: Define the import-only API boundary

**Files:**
- Create: `src/vitrine/jobsApi.ts`
- Create: `src/vitrine/jobsApi.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/vitrine/jobsApi.test.ts` with a fake fetch implementation that records calls, invokes `submitImportJob("linear", "https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/screens", "web")`, and asserts that the only request is `POST /api/jobs` with the expected JSON body.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --experimental-strip-types --test src/vitrine/jobsApi.test.ts`

Expected: FAIL because `src/vitrine/jobsApi.ts` does not exist.

- [x] **Step 3: Implement the import command**

Create `src/vitrine/jobsApi.ts` exporting:

```ts
export async function submitImportJob(name: string, url: string, platform: Platform): Promise<void> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'import-app', name, url, platform }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Import returned ${response.status}`);
}
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node --experimental-strip-types --test src/vitrine/jobsApi.test.ts`

Expected: PASS with one test and zero failures.

### Task 2: Remove job loading from the Apps component

**Files:**
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/useJobs.ts`

- [x] **Step 1: Replace the Apps job hook**

In `src/vitrine/App.tsx`:

- Remove the `useJobs` import and invocation.
- Import `submitImportJob` from `./jobsApi` and pass it to `ImportDialog`.
- Remove the synthesized-job observer and its `seenSynthesized` ref.
- Build rows with `apps.map(appRow)`, ensuring the grid is based only on persisted apps.
- Remove now-unused React imports.

- [x] **Step 2: Reuse the command in the monitoring hook**

In `src/vitrine/useJobs.ts`, replace the duplicated import `POST` implementation with `await submitImportJob(name, url, platform)`, followed by its existing explicit `refresh()` for monitoring consumers.

- [x] **Step 3: Run focused UI and API tests**

Run: `node --experimental-strip-types --test src/vitrine/jobsApi.test.ts src/vitrine/jobs.test.ts && npx tsx --test src/vitrine/ImportDialog.test.tsx`

Expected: all tests pass with zero failures.

### Task 3: Verify the frontend

**Files:**
- Verify only; no additional files expected.

- [x] **Step 1: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [x] **Step 2: Build the production frontend**

Run: `npm run build`

Expected: Vite exits successfully and writes the frontend bundle.

- [x] **Step 3: Review the final diff**

Run: `git diff --check && git diff -- src/vitrine/App.tsx src/vitrine/useJobs.ts src/vitrine/jobsApi.ts src/vitrine/jobsApi.test.ts`

Expected: no whitespace errors; only the approved Apps polling removal and import-command extraction appear.
