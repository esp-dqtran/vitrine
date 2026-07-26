# App Section Total Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show full selected-version totals for Screens, UI Elements, and Flows instead of the currently loaded page size.

**Architecture:** Extend the existing `AppVersion` query result with `ui_element_count`, then resolve the active version’s three counts in a small pure helper. `ScreenDetail` uses those resolved totals for `tabTrailing`, with app metadata as the loading/missing-version fallback.

**Tech Stack:** TypeScript, React, PostgreSQL query projection, Node test runner.

---

### Task 1: Define and test selected-version total resolution

**Files:**
- Create: `src/vitrine/appSectionTotals.ts`
- Create: `src/vitrine/appSectionTotals.test.ts`

- [ ] **Step 1: Write the failing test**

Test that a selected version’s `screen_count`, `ui_element_count`, and `flow_count` override app-level fallback totals, and that the fallback is retained when no version is available.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/vitrine/appSectionTotals.test.ts`

Expected: FAIL because `appSectionTotals.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Export `resolveAppSectionTotals(app, versions, selectedVersion)` returning:

```ts
{
  screens: activeVersion?.screen_count ?? app.totalScreens,
  elements: activeVersion?.ui_element_count ?? app.totalUiElements,
  flows: activeVersion?.flow_count ?? app.totalFlows,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/vitrine/appSectionTotals.test.ts`

Expected: PASS.

### Task 2: Expose and render all three version totals

**Files:**
- Modify: `src/db.ts`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Write the failing UI/query contract tests**

Assert the version query exposes `ui_element_count`, and render a selected-section count label from full totals rather than loaded array lengths.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `node --experimental-strip-types --test src/vitrine/appSectionTotals.test.ts src/vitrine/ScreenDetail.test.tsx`

Expected: FAIL on the missing version UI-element projection and old `screens.length`/`flows.length` label.

- [ ] **Step 3: Write minimal implementation**

Add `ui_element_count` to `AppVersion` and `versionSelect`, import `resolveAppSectionTotals` into `ScreenDetail`, and use the resolved totals in `tabTrailing`.

- [ ] **Step 4: Verify focused tests and build**

Run:

```bash
node --experimental-strip-types --test src/vitrine/appSectionTotals.test.ts src/vitrine/ScreenDetail.test.tsx
npm run build
```

Expected: all focused tests PASS and build exits 0.
