# Catalog Database Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the local Mobbin crawler catalog into the Supabase database used by the UI, then restart all four resumable workers with the correct database environment.

**Architecture:** A one-off TypeScript utility reads crawler-owned rows from local PostgreSQL and applies batched, idempotent natural-key upserts to Supabase. Existing target metadata and published versions are preserved; source images are attached to the target app-platform's active draft. Workers remain stopped from backup through verification and restart with Node's native `--env-file=.env` support.

**Tech Stack:** TypeScript, Node.js, `pg`, PostgreSQL, Node test runner, `pg_dump`, existing Astryx schema and crawler state files.

---

### Task 1: Specify the merge invariants

**Files:**
- Create: `scripts/merge-catalog-databases.test.ts`
- Create: `scripts/merge-catalog-databases.ts`

- [ ] **Step 1: Write the failing unit tests**

Test pure helpers for chunking, source/target identity rejection, and natural-key audit differences. The tests must prove duplicate keys collapse and missing source keys are reported.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test scripts/merge-catalog-databases.test.ts`

Expected: FAIL because the merge module does not yet exist.

- [ ] **Step 3: Implement the pure helpers only**

Export `chunks`, `assertDifferentDatabases`, and `missingKeys` from `scripts/merge-catalog-databases.ts` with no database writes.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --import tsx --test scripts/merge-catalog-databases.test.ts`

Expected: all focused tests pass.

### Task 2: Implement the idempotent catalog merge

**Files:**
- Modify: `scripts/merge-catalog-databases.ts`
- Modify: `scripts/merge-catalog-databases.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a failing plan/audit test**

Test that the dry-run summary includes apps, app-platforms, images, referenced objects, and flow sets, and that apply mode is impossible without a distinct target URL.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test scripts/merge-catalog-databases.test.ts`

Expected: FAIL because the catalog reader and merge entry point are missing.

- [ ] **Step 3: Implement source reads and batched target upserts**

Read and merge only `apps`, `platforms`, `stored_objects` referenced by images, `images`, active draft `app_versions`/`version_images`, and `app_flows`. Use JSONB recordsets in bounded batches. Reject object-key metadata conflicts. Preserve target non-null app/image metadata and all target published versions.

- [ ] **Step 4: Add scripts**

Add:

```json
"catalog-db:audit": "node --env-file=.env --import tsx scripts/merge-catalog-databases.ts --dry-run",
"catalog-db:merge": "node --env-file=.env --import tsx scripts/merge-catalog-databases.ts --apply"
```

The source defaults to `postgres://postgres:postgres@localhost:5432/astryx`; the target is `DATABASE_URL` loaded from `.env`.

- [ ] **Step 5: Run focused tests and TypeScript validation**

Run:

```bash
node --import tsx --test scripts/merge-catalog-databases.test.ts
npx tsc --noEmit
```

Expected: focused tests pass and TypeScript exits 0.

### Task 3: Back up and merge live data

**Files:**
- Create runtime backups under: `data/backups/catalog-db-repair-<timestamp>/`

- [ ] **Step 1: Verify all four workers have exited**

Run: `ps -p 88605,88607,88606,88604`

Expected: no matching worker processes.

- [ ] **Step 2: Back up local PostgreSQL and Supabase**

Use `pg_dump --format=custom` for both databases. Verify both backup files are non-empty with `pg_restore --list`.

- [ ] **Step 3: Run dry-run audit**

Run: `npm run catalog-db:audit`

Expected: reports missing target natural keys and performs zero writes.

- [ ] **Step 4: Apply the merge**

Run: `npm run catalog-db:merge`

Expected: exits 0 with per-table merged counts.

- [ ] **Step 5: Rerun dry-run audit**

Run: `npm run catalog-db:audit`

Expected: zero source app-platform, image, object, and flow keys missing from Supabase.

### Task 4: Restart workers on Supabase and verify the UI path

**Files:**
- Runtime only: existing state and log files under `data/`

- [ ] **Step 1: Restart exactly four workers with `.env` loaded**

Start each existing state partition with `node --env-file=.env --import tsx scripts/catalog-import.ts`, preserving `WORKER_ID=1..4`, existing profile directories, and existing log files.

- [ ] **Step 2: Verify worker environments without printing credentials**

Check each PID environment contains `DATABASE_URL` and confirm active database sockets are not connected to `localhost:5432`.

- [ ] **Step 3: Verify API/UI count**

Compare the Supabase distinct app count with authenticated `/api/apps` output. The API count must include every source app natural key merged from local PostgreSQL.

- [ ] **Step 4: Verify resumability**

Confirm every worker log says it resumed its existing partition and starts only pending jobs. Confirm four processes remain alive after one monitor interval.

- [ ] **Step 5: Run final checks**

Run:

```bash
node --import tsx --test scripts/merge-catalog-databases.test.ts
npx tsc --noEmit
git diff --check
```

Expected: tests pass, TypeScript exits 0, and no whitespace errors are introduced.

