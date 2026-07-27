# Document Flow Markdown Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom Document Flow narrative with the exact saved revision rendered as formatted Markdown.

**Architecture:** Keep `DocumentFlowPanel` responsible for exact-source document lookup and lifecycle states. Add a small ready-state renderer that fetches the existing Markdown export for the selected revision and renders it through `react-markdown` with `remark-gfm`.

**Tech Stack:** React 19, TypeScript, `react-markdown`, `remark-gfm`, Node test runner, Vite

---

### Task 1: Specify the Markdown ready state

**Files:**
- Modify: `src/vitrine/FlowModes.test.tsx`
- Modify: `src/vitrine/FeatureDocumentWorkspace.test.tsx`
- Modify: `src/vitrine/components/DocumentFlowPanel.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write the failing component test**

Render the ready Document Flow view through a small exported Markdown renderer
with Markdown containing a heading, list, and GFM table. Assert that semantic
HTML is produced and that `Overview`, `Trigger`, `Ordered steps`, `Outcome`,
`Alternate and error paths`, and `Edit Document Flow` are absent.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx --test --test-name-pattern="renders only the saved revision Markdown" src/vitrine/FlowModes.test.tsx
```

Expected: FAIL because the Markdown renderer does not exist and the current
ready state renders the custom five-section narrative.

- [ ] **Step 3: Add Markdown dependencies**

Run:

```bash
npm install react-markdown remark-gfm
```

This updates `package.json` and `package-lock.json`.

- [ ] **Step 4: Implement the minimal ready-state renderer**

In `DocumentFlowPanel.tsx`:

- import `getFeatureDocumentMarkdown`, `Markdown`, and `remarkGfm`;
- remove the narrative model, claim renderer, selected-step scrolling, editor,
  and ready-state edit controls;
- add a focused component that fetches by `documentId` and `revisionId`;
- render `<Markdown remarkPlugins={[remarkGfm]}>`;
- show a spinner while loading and an inline retry state on failure;
- preserve the document lifecycle and generation states.

In `styles.css`, add a focused document surface with readable typography and
overflow handling for code blocks and GFM tables.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test --test-name-pattern="renders only the saved revision Markdown" src/vitrine/FlowModes.test.tsx
```

Expected: PASS.

### Task 2: Verify integration

**Files:**
- Verify: `src/vitrine/FlowModes.test.tsx`
- Verify: `src/vitrine/FeatureDocumentWorkspace.test.tsx`
- Verify: `src/vitrine/FlowTreeNavigation.test.tsx`
- Verify: `src/vitrine/components/DocumentFlowPanel.tsx`

- [ ] **Step 1: Run the relevant Flow tests**

```bash
npx tsx --test src/vitrine/FlowModes.test.tsx src/vitrine/FeatureDocumentWorkspace.test.tsx src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Build the production client**

```bash
npm run build
```

Expected: Vite exits successfully.

- [ ] **Step 3: Validate the final diff**

```bash
git diff --check
git diff -- src/vitrine/components/DocumentFlowPanel.tsx src/vitrine/FlowModes.test.tsx package.json package-lock.json
```

Expected: no whitespace errors and only the intended Markdown-rendering changes.

- [ ] **Step 4: Leave changes uncommitted**

Per the project rules, do not commit or push unless the user asks.
