# Astryx Curator Versioning and Publication Plan

**Goal:** Preserve dated capture history and prevent unreviewed or unsupported analysis from entering the product-designer catalog.

**Architecture:** `app_versions` owns capture/review/publication state; `version_images`, `design_system_versions`, and `app_flow_versions` freeze the evidence and structured artifacts for each version. Flat app-level tables remain the working draft used by the existing pipeline. Starting a recapture creates a draft version cloned from the latest evidence; new captures attach to that draft. Publishing validates the working draft, snapshots it into version tables, and atomically marks it published. Public/customer reads resolve only published versions; admins can inspect drafts and review issues.

---

## Task 1: Version domain and publication gate

Create `src/versioning.ts` and tests for evidence validation, status transitions, counts, and publication blockers.

## Task 2: Versioned persistence

Modify `src/db.ts` and `src/db.test.ts` to add version/history/review tables; backfill existing apps as published v1; add create/list/submit/publish/version-read helpers; attach new captures to the active draft without overwriting published history.

## Task 3: Admin curator API and published catalog reads

Modify API tests and `services/api/src/app.ts` with admin-only create/submit/publish/version routes. Public catalog and customer detail/design-system reads resolve published data; admin reads can select a draft version. Return explicit blockers rather than publishing incomplete evidence.

## Task 4: Curator UI and version switching

Create `VersionPanel` and tests. Admins can start recapture, inspect counts/blockers, submit review, publish, and switch versions. Product designers see published version/date/capture counts and can switch among published historical versions.

## Task 5: Verification

Run all tests, TypeScript, production build, and verify a failed publication leaves the previous published version unchanged.
