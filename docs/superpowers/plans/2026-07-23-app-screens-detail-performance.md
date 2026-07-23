# App Screens Detail Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repeated heavy version aggregation from the app-detail Screens critical path and start the first Screens request concurrently with version metadata.

**Architecture:** Resolve one section version with a focused database query, while the complete versions endpoint uses pre-aggregated counts. Let the frontend request the `latest` section key immediately and rely on the existing resolved-version cache alias.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Node test runner

---

### Task 1: Start section data concurrently

**Files:**
- Modify: `src/vitrine/useAppSectionData.ts`
- Test: `src/vitrine/useAppSectionData.test.ts`

- [ ] Add a failing pure-function test proving Screens produces a `latest` cache key before versions load.
- [ ] Run `npm test -- src/vitrine/useAppSectionData.test.ts` and confirm the new assertion fails.
- [ ] Extract the active-key calculation so data sections no longer wait for the versions response.
- [ ] Run the focused test and existing section-store tests.

### Task 2: Resolve section versions without the full list query

**Files:**
- Modify: `src/db.ts`
- Modify: `services/api/src/app.ts`
- Test: `services/api/src/app.test.ts`
- Test: `src/db.test.ts`

- [ ] Add a failing route test proving Screens calls a focused version resolver while `listAppVersions` is unavailable.
- [ ] Add database coverage for published visibility, explicit versions, and returned counts.
- [ ] Run the focused API test and confirm failure because the dependency does not exist.
- [ ] Implement `resolveAppVersion` and use it from app section routes.
- [ ] Refactor `listAppVersions` to join pre-aggregated image counts instead of grouping joined JSON payloads.
- [ ] Run focused API and database tests.

### Task 3: Verify the user flow

**Files:**
- Modify only relevant files if verification exposes a regression.

- [ ] Run all unit/integration tests and the production build.
- [ ] Rebuild the local API and record `/versions`, first 48 Screens, and next 48 Screens timings.
- [ ] Run authenticated browser E2E: app detail, Screens, 48 cards, scroll to 96.
- [ ] Confirm one `/versions`, two paged `/screens`, and zero `/api/jobs` requests.
- [ ] Review the diff and preserve unrelated working-tree changes.
