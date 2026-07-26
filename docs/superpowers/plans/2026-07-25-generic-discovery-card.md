# Generic Discovery Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one reusable discovery-card shell and use it for both Apps and Sites.

**Architecture:** `DiscoveryCard` owns shared markup, classes, and slots. `AppCard` and `SiteCard` remain thin behavior-specific wrappers, so screenshot carousel logic and website video logic do not leak into the generic component.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner, React server rendering

---

### Task 1: Define the shared-card contract with tests

**Files:**
- Create: `src/vitrine/components/DiscoveryCard.tsx`
- Modify: `src/vitrine/AppCard.test.tsx`
- Modify: `src/vitrine/Sites.test.tsx`

- [ ] Add assertions that both rendered card types include `data-discovery-card="true"` and the shared `discovery-card` classes.
- [ ] Run `npx tsx --test src/vitrine/AppCard.test.tsx src/vitrine/Sites.test.tsx` and confirm the new assertions fail because the shared component does not exist.
- [ ] Implement `DiscoveryCard` with typed media, logo, description, metadata, wrapper, and event-handler slots.
- [ ] Migrate `AppCard` and `SiteCard` to render their existing behavior through `DiscoveryCard`.
- [ ] Re-run the focused tests and confirm all assertions pass.

### Task 2: Share the Sites visual shell

**Files:**
- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] Add CSS assertions for the shared bordered 24px shell, inset media, identity spacing, and hover scale.
- [ ] Run `npx tsx --test src/vitrine/AppsDiscovery.test.tsx` and confirm the shared-selector assertion fails.
- [ ] Consolidate the Sites shell rules under `.discovery-card` class names and retain App-only contained screenshot rules.
- [ ] Re-run `npx tsx --test src/vitrine/AppCard.test.tsx src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx`.

### Task 3: Verify the migration

**Files:**
- Verify: `src/vitrine/components/DiscoveryCard.tsx`
- Verify: `src/vitrine/components/AppCard.tsx`
- Verify: `src/vitrine/components/SiteCard.tsx`
- Verify: `src/vitrine/styles.css`

- [ ] Run the focused tests.
- [ ] Run `npm run build`.
- [ ] Inspect `git diff` and confirm only the generic-card slice plus pre-existing user changes are present.
