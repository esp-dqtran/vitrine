# Remove Legacy FLOW.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy app-level FLOW.md feature without changing flow browsing or Feature Documents.

**Architecture:** Delete the legacy UI and client API first, then remove its export and server boundaries, and finally retire persistence with a forward migration. Keep historical migrations immutable and validate the preserved Feature Document entry point throughout.

**Tech Stack:** React, TypeScript, Node test runner, Express, PostgreSQL migrations, Vite

---

### Task 1: Add a removal boundary regression test

**Files:**
- Create: `src/legacyFlowMdRemoval.test.ts`

- [ ] **Step 1: Write the failing test**

Create a source-boundary test that asserts the legacy UI labels, API paths, export format, database functions, and editor file no longer exist while `Create Feature Document` remains.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/legacyFlowMdRemoval.test.ts`

Expected: FAIL because the current implementation still contains `Open FLOW.md`, `flow-md`, `flow-doc`, and `FlowDocEditor`.

- [ ] **Step 3: Keep the failing test unchanged while implementing Tasks 2-4**

The test becomes green only when all legacy seams are removed.

### Task 2: Remove legacy client UI and API calls

**Files:**
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Delete: `src/vitrine/components/FlowDocEditor.tsx`
- Delete: `src/vitrine/markdownToHtml.ts`
- Delete: `src/vitrine/markdownToHtml.test.ts`
- Modify: `src/vitrine/components/ExportPanel.tsx`
- Modify: `src/vitrine/researchApi.ts`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`
- Modify: `src/vitrine/ResearchTools.test.tsx`

- [ ] **Step 1: Remove FlowDocEditor state, import, and toolbar action**

Delete the now-unused Markdown preview helper and keep search and progressive flow rendering unchanged.

- [ ] **Step 2: Remove the FLOW.md export card and client request helpers**

Keep Figma and secondary formats unchanged.

- [ ] **Step 3: Replace positive legacy UI assertions with absence and Feature Document preservation assertions**

Run: `node --experimental-strip-types --test src/vitrine/components/FlowsPanel.test.tsx src/vitrine/ResearchTools.test.tsx`

Expected: PASS.

### Task 3: Remove the export and server routes

**Files:**
- Modify: `src/exportEngine.ts`
- Modify: `src/exportEngine.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Remove `flow-md` from `ExportFormat` and the renderer**

Delete the unused `flowMd` function and its focused tests.

- [ ] **Step 2: Remove `flow-md` from the API allow-list and remove editable flow-doc routes**

Remove the associated API dependency hooks.

- [ ] **Step 3: Add API assertions for the retired contract**

Verify `flow-md` export requests return `400` and `/flow-doc` requests return `404`.

- [ ] **Step 4: Run focused export and API tests**

Run: `node --experimental-strip-types --test src/exportEngine.test.ts services/api/src/app.test.ts`

Expected: PASS.

### Task 4: Retire legacy persistence

**Files:**
- Modify: `src/db.ts`
- Modify: `scripts/verify-migrations.ts`
- Modify: `README.md`
- Create: `migrations/0020_drop_flow_documents.sql`

- [ ] **Step 1: Remove `getFlowDocument` and `saveFlowDocument`**

No Feature Document storage helpers are changed.

- [ ] **Step 2: Add the forward migration**

Use `DROP TABLE IF EXISTS flow_documents;` and leave `0009_flow_documents.sql` unchanged.

- [ ] **Step 3: Remove the retired table from migration verification and the retired feature from README**

Keep the Feature Document documentation unchanged.

- [ ] **Step 4: Run the removal boundary test**

Run: `node --experimental-strip-types --test src/legacyFlowMdRemoval.test.ts`

Expected: PASS.

### Task 5: Verify the complete change

**Files:**
- Verify all modified files

- [ ] **Step 1: Search for unexpected legacy references**

Run: `rg -n "FLOW\\.md|flow-md|flow-doc|FlowDocEditor|loadFlowDoc|saveFlowDoc|getFlowDocument|saveFlowDocument" src services migrations --glob '!migrations/0009_flow_documents.sql' --glob '!migrations/0020_drop_flow_documents.sql'`

Expected: no results outside the removal test’s forbidden-pattern declarations.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: build completes successfully.

- [ ] **Step 4: Validate the patch**

Run: `git diff --check`

Expected: no whitespace errors.
