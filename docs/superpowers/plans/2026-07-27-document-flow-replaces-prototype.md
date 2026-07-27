# Document Flow Replaces Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Prototype submode with the existing Document Flow representation and expose one `Screens | Document Flow` tab row.

**Architecture:** Keep `flowView=visual|document` as the canonical route state. Relabel the selected-workspace representation tabs and make `VisualFlowPanel` screens-only; continue rendering `DocumentFlowPanel` for the document route.

**Tech Stack:** React, TypeScript, Node test runner, Vite

---

### Task 1: Consolidate selected Flow representations

**Files:**
- Modify: `src/vitrine/FlowModes.test.tsx`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`
- Modify: `src/vitrine/components/SelectedFlowWorkspace.tsx`
- Modify: `src/vitrine/components/VisualFlowPanel.tsx`

- [ ] **Step 1: Write failing representation tests**

Update focused assertions to require one `Screens | Document Flow` tab row and reject `Visual Flow`, `Prototype`, and prototype controls.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx tsx --test --test-name-pattern="selected Flow uses Screens and Document Flow as its only representation tabs|VisualFlowPanel renders a screens-only flow stage" src/vitrine/FlowModes.test.tsx src/vitrine/components/FlowsPanel.test.tsx
```

Expected: FAIL because the current UI still renders `Visual Flow` and `Prototype`.

- [ ] **Step 3: Implement the minimal consolidation**

In `SelectedFlowWorkspace.tsx`, label the `visual` route as `Screens` and retain `Document Flow` for `document`.

In `VisualFlowPanel.tsx`, preserve the existing screenshot carousel and the uncommitted `scrollToAdjacentFlowScreen` integration, but remove local mode state, prototype index state, prototype navigation, prototype stage, restart action, and the inner submode buttons.

- [ ] **Step 4: Verify focused behavior and build**

Run:

```bash
npx tsx --test src/vitrine/FlowModes.test.tsx
npx tsx --test --test-name-pattern="VisualFlowPanel renders a screens-only flow stage" src/vitrine/components/FlowsPanel.test.tsx
npm run build
git diff --check
```

Expected: focused tests pass, Vite builds successfully, and the diff has no whitespace errors.
