# Readable Document Flow Implementation Plan

> **For agentic workers:** Execute inline on `main` because this repository forbids automatic worktrees and branches. Follow TDD and preserve unrelated worktree changes.

**Goal:** Replace the repetitive Document Flow output with a concise default document and a collapsed technical-details disclosure.

**Architecture:** Keep `FeatureDocumentContent` and stored revisions unchanged. Make `renderFeatureDocumentMarkdown` produce the readable four-section document, while `DocumentFlowPanelView` reads the existing structured revision to expose secondary material under native progressive disclosure.

**Tech Stack:** TypeScript, React, react-markdown, Node test runner, Vite.

---

### Task 1: Concise Markdown export

**Files:**
- Modify: `src/featureDocument.ts`
- Test: `src/featureDocument.test.ts`

- [ ] Add a failing test asserting `Summary`, `Observed steps`, `Requirements`, and `Missing evidence`.
- [ ] Assert that duplicate missing-state/open-question text appears once.
- [ ] Assert that repeated `Proposed feature`, generic user stories, repeated preconditions, and `Evidence appendix` are absent.
- [ ] Run `node --import tsx --test src/featureDocument.test.ts` and confirm the new assertions fail for the old renderer.
- [ ] Implement the minimal concise Markdown renderer while preserving inline evidence citations.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Progressive technical disclosure

**Files:**
- Modify: `src/vitrine/components/DocumentFlowPanel.tsx`
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/FlowModes.test.tsx`
- Test: `src/vitrine/FeatureDocumentWorkspace.test.tsx`

- [ ] Add a failing view test requiring a closed `Technical details` disclosure.
- [ ] Assert that risks, proposed edge cases, metrics, dependencies, and evidence mappings remain inspectable inside it.
- [ ] Run the two view tests and confirm the new test fails for the old Markdown-only view.
- [ ] Implement a small structured technical-details component using the ready revision.
- [ ] Add focused disclosure styling without changing the surrounding Flow workspace.
- [ ] Re-run the view tests and confirm they pass.

### Task 3: Regression and browser verification

**Files:**
- Verify only; no additional production files.

- [ ] Run all Feature Document and Flow mode tests.
- [ ] Run the production build.
- [ ] Open Binance Web Onboarding in Document Flow mode.
- [ ] Confirm the concise four-section hierarchy is visible by default.
- [ ] Confirm Technical details is closed by default and expands to reveal preserved evidence.
- [ ] Confirm no new application console errors.

