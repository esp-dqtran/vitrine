# Mobbin Catalog Integrity Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every completed Mobbin catalog job provably complete for Screens, UI Elements, and Flows, repair existing dangling flow evidence, and re-import every artifact that cannot be repaired safely.

**Architecture:** Preserve the current `images`/`app_flows` schema, but make bulk image identities artifact-kind-aware so a UI element or flow step cannot collapse onto a Screen row. Every crawler stage returns observed and persisted counts; the catalog worker marks a job done only when all stages reconcile. A transactional repair script remaps legacy flow evidence through preserved object hashes, and a read-only verifier produces the re-import queue by comparing Mobbin log counts with database counts and reference integrity.

**Tech Stack:** TypeScript, Node test runner, Playwright, PostgreSQL, S3-compatible object storage.

---

### Task 1: Preserve every artifact identity

**Files:**
- Modify: `src/bulkDownload.ts`
- Test: `src/bulkDownload.test.ts`

- [ ] Add failing tests proving Screen, UI Element, and flow-step references differ for identical bytes, while repeated files within one artifact kind receive deterministic occurrence suffixes.
- [ ] Run `node --experimental-strip-types --test src/bulkDownload.test.ts` and confirm the new assertions fail because references are currently only `mobbin-bulk:<hash>`.
- [ ] Add a small exported `bulkImageReference(kind, sha256, occurrence)` helper and use it in `ingestDownloadedImages` while counting occurrences in sorted archive order.
- [ ] Run the targeted test and confirm all bulk-download tests pass.

### Task 2: Reject partial Screens, UI Elements, and Flows

**Files:**
- Modify: `src/progress.ts`
- Modify: `src/bulkDownload.ts`
- Modify: `scripts/catalog-import.ts`
- Test: `src/bulkDownload.test.ts`
- Create: `src/catalogImportGate.ts`
- Create: `src/catalogImportGate.test.ts`

- [ ] Add failing tests for a catalog-stage gate that rejects `error`, `cancelled`, or `captured < discovered`, including the observed 56/57 flow case.
- [ ] Add failing tests proving UI-element selection does not discard cards merely because their alt text does not begin with the app name, while Screen fallback selection still excludes unrelated apps.
- [ ] Run the targeted tests and confirm both failure modes reproduce.
- [ ] Extend catalog stage outcomes with `discovered` and `captured` counts; return `error` when a bulk or flow stage captures fewer artifacts than Mobbin exposed.
- [ ] Make `catalog-import.ts` require all three stage outcomes before setting `job.status = "done"`.
- [ ] Run targeted tests and confirm they pass.

### Task 3: Backfill legacy flow evidence safely

**Files:**
- Create: `src/flowEvidenceRepair.ts`
- Create: `src/flowEvidenceRepair.test.ts`
- Create: `scripts/repair-flow-evidence.ts`
- Modify: `scripts/merge-catalog-databases.ts`
- Modify: `scripts/merge-catalog-databases.test.ts`

- [ ] Add failing pure tests proving nested flow-step evidence IDs are remapped without changing other flow JSON and unresolved or ambiguous IDs abort the repair.
- [ ] Add a failing merge test proving source flow evidence is translated from source image IDs to target image IDs before `app_flows` is written.
- [ ] Implement mapping by `(app, platform, object sha256)`, require exactly one target image for every dangling source ID, and update all affected `app_flows` in one transaction.
- [ ] Add `--dry-run` and `--apply` modes to the repair script, with before/after dangling-reference counts.
- [ ] Run targeted tests and confirm they pass.
- [ ] Run the dry-run against Supabase; require `unmappable=0` and `ambiguous=0`, then apply and verify dangling references are zero.

### Task 4: Produce the authoritative re-import queue

**Files:**
- Replace: `scripts/verify-catalog-import.ts`
- Create: `scripts/verify-catalog-import.test.ts`
- Modify: `package.json`

- [ ] Add failing parser/audit tests for persisted Screen/UI Element/Flow counts, flow-step evidence validity, missing persistent logs, and exact Mobbin count mismatches.
- [ ] Implement a read-only verifier that emits JSON plus a per-worker re-import queue; it must never treat a `done` state flag as proof.
- [ ] Add `catalog:verify`, `catalog:repair-flows`, and `catalog:repair-flows:dry-run` npm scripts.
- [ ] Run tests, then run the verifier against current Supabase and the four state/log files.

### Task 5: Re-import missing data and prove no loss

**Files:**
- Modify only generated operational state under `data/` after taking timestamped backups.

- [ ] Back up all four state files and logs, then change only verifier-flagged jobs from `done`/`failed` to `pending`.
- [ ] Restart four workers with persistent log capture and verify each connects to remote PostgreSQL rather than localhost.
- [ ] Let the queue finish, retrying only explicit failures.
- [ ] Run the complete catalog verifier and require zero Screen, UI Element, Flow-count, missing-log, and dangling-evidence mismatches.
- [ ] Run object-storage verification and require every referenced full object to exist with matching metadata.
- [ ] Run the full test suite and build before declaring the repair complete.
