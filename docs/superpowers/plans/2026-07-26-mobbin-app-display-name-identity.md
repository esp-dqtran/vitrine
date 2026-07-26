# Mobbin App Display Name Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the human Mobbin app name while retaining UUID-disambiguated internal slugs for routes and database identity.

**Architecture:** Reuse the existing nullable `apps.display_name` column and existing API/gallery preference for that field. Capture the visible Mobbin app heading during bulk imports, persist it through `setAppMeta`, and backfill existing rows from the authoritative catalog state without renaming route keys.

**Tech Stack:** TypeScript, Node test runner, PostgreSQL, Playwright, Vite.

---

### Task 1: Lock the display-name persistence contract

**Files:**
- Create: `src/catalogDisplayNamePersistence.test.ts`
- Modify: `src/db.ts`
- Modify: `src/bulkDownload.ts`

- [ ] Write a failing source-contract test proving `setAppMeta` accepts `displayName`, updates `apps.display_name`, and bulk import captures the visible heading.
- [ ] Run `node --experimental-strip-types --test src/catalogDisplayNamePersistence.test.ts` and confirm it fails because display-name persistence is absent.
- [ ] Extend `setAppMeta` with `displayName?: string | null`, retain existing non-null curated values with `COALESCE`, and pass the visible Mobbin heading from `crawlBulkDownload`.
- [ ] Run the focused test and confirm it passes.

### Task 2: Lock route/display separation

**Files:**
- Modify: `src/gallery.test.ts`

- [ ] Add a test where `app` is `aboard-ea683077-aadb-47c5-a771-d21fd9676510` and `display_name` is `Aboard`.
- [ ] Assert the API result keeps the UUID slug as `id` and preview route while returning `Aboard` as the visible app name.
- [ ] Run `node --experimental-strip-types --test src/gallery.test.ts`.

### Task 3: Backfill live catalog names

**Files:**
- Read: `data/catalog-import-state.json`

- [ ] Build a slug-to-`appName` mapping from the authoritative catalog state.
- [ ] Preview affected database rows and preserve existing non-null curated `display_name` values.
- [ ] Update null display names for matching catalog apps in one transaction.
- [ ] Fill the five legacy unmapped slugs with their verified human names: Aboard, Atlassian, Gamma, LangChain, and Threads.
- [ ] Verify every UUID-disambiguated app has a non-null human display name and that internal `apps.name` values remain unchanged.

### Task 4: Verify

**Files:**
- Test: `src/catalogDisplayNamePersistence.test.ts`
- Test: `src/gallery.test.ts`

- [ ] Run the focused tests.
- [ ] Run `npm run build`.
- [ ] Query all Aboard rows and verify `display_name = 'Aboard'` while the three route slugs remain unchanged.
- [ ] Verify the public catalog response returns visible `Aboard` with the UUID route key.
