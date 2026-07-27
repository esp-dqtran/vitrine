# Document Flow Replaces Prototype

**Date:** 2026-07-27
**Status:** Approved

## Goal

Present a selected Flow through one tab row: `Screens | Document Flow`.

## Design

- Remove the redundant `Visual Flow | Document Flow` labels.
- Remove the Visual Flow `Screens | Prototype` submode and Prototype carousel.
- Use the selected Flow workspace's existing URL-backed representation state:
  - `flowView=visual` renders `Screens`.
  - `flowView=document` renders the existing `DocumentFlowPanel`.
- Preserve the selected Flow, selected step, exact source lookup, Document Flow generation states, and `View visual step` synchronization.
- Keep `VisualFlowPanel` responsible only for the ordered screenshot stage.
- Do not change Feature Document storage, generation, revision, or API behavior.

## Verification

- The selected Flow renders exactly one representation tab row.
- The row contains `Screens` and `Document Flow`.
- `Prototype`, `Restart prototype`, and prototype navigation are absent.
- Existing visual-step and Document Flow route synchronization remains covered.
- Focused tests and the production build pass.
