# GetDesign-Style Design System Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Astryx web design-system detail page a specimen-first styleguide with Preview/DESIGN.md views and whole-canvas theme switching.

**Architecture:** Keep the existing `DesignSystemSnapshot` data boundary and redesign only `DesignSystemPanel`. Add pure formatting/rendering helpers in the same component module and scoped responsive classes in the existing Vitrine stylesheet.

**Tech Stack:** React 19, TypeScript, Astryx Design Core, Node test runner, server-side React rendering, Vite.

---

### Task 1: Lock the interaction contract with failing tests

**Files:**
- Modify: `src/vitrine/DesignSystemPanel.test.tsx`

- [ ] Add a test that expects `Preview` and `DESIGN.md` controls, Preview selected by default, and Light/Dark controls on an evidence-free imported snapshot.
- [ ] Add a test that expects accessible section names, token roles, and readable component specimen text.
- [ ] Export and test `designSystemMarkdown(snapshot)` so the generated document contains the app title, grouped foundations, component variants, and rules.
- [ ] Run `npx tsx --test src/vitrine/DesignSystemPanel.test.tsx` and confirm the new assertions fail because the controls and formatter do not exist.

### Task 2: Build the specimen-first panel

**Files:**
- Modify: `src/vitrine/components/DesignSystemPanel.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] Add `view` and `stage` state, accessible segmented buttons, and a complete themed preview canvas.
- [ ] Add `designSystemMarkdown` as a pure snapshot formatter and render it in the secondary tab.
- [ ] Replace dense foundation cards with grouped swatches, type specimens, spacing/radius/border/effect demonstrations, and supporting token metadata.
- [ ] Render component variants on a roomy stage, using reconstruction data when present and readable fallback labels when it is absent.
- [ ] Preserve observed evidence and review metadata below the specimen rather than making it the primary visual.
- [ ] Add responsive scoped styles for canvas, section grids, component rows, tab controls, and the markdown surface.
- [ ] Run `npx tsx --test src/vitrine/DesignSystemPanel.test.tsx` and confirm all targeted tests pass.

### Task 3: Verify behavior and visual fidelity

**Files:**
- Create: `design-qa.md`

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Open the exact GetDesign Binance reference and the local Astryx Binance design-system route at the same desktop viewport.
- [ ] Exercise Preview/DESIGN.md and Light/Dark controls and check browser console errors.
- [ ] Capture both pages, create a side-by-side comparison, and record any P0/P1/P2 differences in `design-qa.md`.
- [ ] Fix blocking visual differences, recapture, and repeat until `design-qa.md` says `final result: passed`.
- [ ] Commit the intended files on `main` and push `main` to the configured remote.
