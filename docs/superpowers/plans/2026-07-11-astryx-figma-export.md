# Astryx Figma-First Export Implementation Plan

**Goal:** Export the complete reviewed, observed design system—or a selected subset—as an editable Figma development plugin, with secondary token and code formats generated from the same snapshot.

**Architecture:** A pure export engine filters one structured snapshot by scope and renders deterministic artifacts. The primary artifact is a ZIP containing a Figma development-plugin manifest and executable Plugin API code that creates variable collections, styles/documentation, editable auto-layout component/variant sets, and evidence-reference frames. Express validates entitlement/scope, reserves usage, and streams the artifact. React presents Figma first and secondary formats underneath.

**Evidence rule:** The engine exports only tokens, components, variants, screens, and flows already present in the reviewed snapshot/capture set. It labels unavailable reconstruction detail explicitly and never creates a missing state.

---

## Task 1: Export domain and artifacts

**Files:** Create `src/exportEngine.ts`, `src/exportEngine.test.ts`.

1. Write failing tests for full and scoped exports, deterministic names, CSS/JSON/Tailwind/component-spec outputs, and a Figma ZIP containing manifest/code.
2. Implement scope validation/filtering, safe token naming, secondary renderers, stored-ZIP output, and Figma Plugin API code generation.
3. Assert every exported token/variant retains evidence references and no unsupported item appears.

## Task 2: Export API

**Files:** Modify `services/api/src/app.ts`, `services/api/src/app.test.ts`.

1. Write failing tests for Figma and secondary downloads, whole-system scope, entitlement, and invalid scope/format.
2. Add `POST /design-systems/:app/exports`, reuse access and export-usage enforcement, and return download metadata headers.
3. Keep the prior reservation route compatible.

## Task 3: Designer export UI

**Files:** Create `src/vitrine/components/ExportPanel.tsx`; modify `src/vitrine/components/ScreenDetail.tsx`, `src/vitrine/researchApi.ts`, and focused TSX tests.

1. Write a failing render test proving Figma is the primary action and secondary formats are visually subordinate.
2. Add full-system export from the app overview and scoped export controls from foundations/components.
3. Download the server artifact, display entitlement/errors, and document importing the generated development plugin into Figma.

## Task 4: Verification

Run focused tests, `npm test`, `npx tsc --noEmit`, `npm run build`, and scan generated code for invented component variants.
