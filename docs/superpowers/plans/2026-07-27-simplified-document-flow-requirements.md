# Simplified Document Flow Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Document Flow a concise feature-requirements workspace with multiple acceptance criteria and screenshot evidence for every resolved Visual Flow step.

**Architecture:** Keep the stored Feature Document schema unchanged. Extend the pure presentation model to resolve evidence IDs into Flow screenshot metadata, render only Requirements and Open questions as primary sections, and retain generation and audit information in a collapsed Technical appendix.

**Tech Stack:** TypeScript, React 19, Node test runner, server-rendered React tests, CSS, Vite.

---

## Repository constraints

- Work directly on `main`.
- Preserve all existing dirty-worktree changes.
- Do not commit or push.
- Do not fabricate acceptance criteria or evidence for existing revisions.

### Task 1: Extend the presentation model

**Files:**
- Modify: `src/vitrine/documentFlowModel.test.ts`
- Modify: `src/vitrine/documentFlowModel.ts`

- [ ] Add a second acceptance criterion to the test fixture.
- [ ] Assert that both criteria are preserved in order.
- [ ] Assert that resolved evidence contains the step label, description, and image URL.
- [ ] Run the model test and confirm it fails for the missing image metadata.
- [ ] Resolve evidence metadata from `flow.steps[stepIndex].evidence[imageIndex]`.
- [ ] Run the model test and confirm it passes.

### Task 2: Render the simplified requirements workspace

**Files:**
- Modify: `src/vitrine/FlowModes.test.tsx`
- Modify: `src/vitrine/components/DocumentFlowReadyView.tsx`
- Modify: `src/vitrine/components/SelectedFlowWorkspace.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] Add rendering assertions for `Visual Flow`, `Feature overview`, user story, business rules, two acceptance criteria, screenshot images, and `Open questions`.
- [ ] Add assertions that the Observed journey tab and old Screens label are absent.
- [ ] Run the focused rendering test and confirm the new assertions fail.
- [ ] Render screenshot evidence cards as buttons that open the matching Visual Flow step.
- [ ] Render all acceptance criteria under an explicit count.
- [ ] Render requirement user stories and preconditions as business rules.
- [ ] Reduce primary navigation to Requirements and Open questions.
- [ ] Rename the representation tab from Screens to Visual Flow.
- [ ] Keep risks, edge cases, metrics, dependencies, generation, and source mapping in the collapsed Technical appendix.
- [ ] Run the focused rendering test and confirm it passes.

### Task 3: Improve future generation

**Files:**
- Modify: `src/featureDocumentProvider.test.ts`
- Modify: `src/featureDocumentProvider.ts`

- [ ] Add a prompt assertion requiring distinct happy-path, alternate, validation, and recovery scenarios when evidence supports them.
- [ ] Run the provider test and confirm it fails.
- [ ] Add the narrow synthesis instruction without imposing artificial scenarios where evidence is absent.
- [ ] Run the provider test and confirm it passes.

### Task 4: Verify

- [ ] Run the focused model, rendering, and provider tests.
- [ ] Run the production build.
- [ ] Open Binance Onboarding in Document Flow with Chrome CDP.
- [ ] Verify the simplified section hierarchy, multiple-criteria rendering support, screenshot evidence, and evidence-to-Visual-Flow navigation.
- [ ] Capture and show the final browser result.
