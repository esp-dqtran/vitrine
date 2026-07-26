# App Detail App-Ordering Tab Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make App detail section tabs visually match the Apps screen's `App ordering` strip without sharing components or changing behavior.

**Architecture:** Keep `ReferenceDetailShell` and `useSlidingIndicator` unchanged. Add App-only CSS overrides under `data-reference-detail='app'`, targeting the rendered child buttons because the design-system `ToggleButton` does not forward the supplied detail-tab class. Protect the change with a focused style-boundary test that checks the ordering strip's defining measurements and interaction states while proving Site detail is not selected.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner, `tsx`, Vite

---

## File Map

- Modify `src/vitrine/ReferenceDetailShell.test.tsx`: define the App-only visual contract and guard the Site-detail boundary.
- Modify `src/vitrine/styles.css`: add App-scoped tab-strip parity styles; do not alter Apps discovery or Site detail rules.
- Verify `src/vitrine/components/ReferenceDetailShell.tsx`: no implementation change; its existing `data-reference-detail` attribute and sliding indicator are the seam.

### Task 1: Lock the App-only Style Contract

**Files:**
- Modify: `src/vitrine/ReferenceDetailShell.test.tsx:48-58`
- Verify: `src/vitrine/components/ReferenceDetailShell.tsx:68-142`

- [x] **Step 1: Replace the broad navigation test with a failing App-only parity test**

Replace the current `uses the discovery sort-strip layout for detail navigation` test with:

```tsx
test('copies the Apps ordering strip style onto App detail tabs only', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const tabsRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const tabRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const activeRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button:hover,[\s\S]*?\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button\[aria-selected='true'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const indicatorRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tab-indicator\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(tabsRule, /align-self:\s*stretch/);
  assert.match(tabsRule, /gap:\s*25px/);
  assert.match(tabsRule, /overflow-x:\s*auto/);

  assert.match(tabRule, /min-width:\s*max-content/);
  assert.match(tabRule, /height:\s*64px/);
  assert.match(tabRule, /color:\s*var\(--color-text-secondary\)/);
  assert.match(tabRule, /font-size:\s*14px/);
  assert.match(tabRule, /transition:\s*color 180ms ease/);

  assert.match(activeRule, /background:\s*transparent/);
  assert.match(activeRule, /color:\s*var\(--color-text-primary\)/);

  assert.match(indicatorRule, /bottom:\s*13px/);
  assert.match(indicatorRule, /height:\s*2px/);
  assert.match(indicatorRule, /border-radius:\s*999px/);

  assert.doesNotMatch(styles, /\.reference-detail\[data-reference-detail='site'\] \.reference-detail__tabs > button/);
});
```

- [x] **Step 2: Run the focused test and verify the new contract fails**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: FAIL in `copies the Apps ordering strip style onto App detail tabs only` because the App-scoped rules do not exist yet.

### Task 2: Copy the Ordering-Strip Style to App Detail

**Files:**
- Modify: `src/vitrine/styles.css:1836-1869`
- Test: `src/vitrine/ReferenceDetailShell.test.tsx`

- [x] **Step 1: Add the minimal App-scoped CSS overrides**

Add these rules after the existing generic `.reference-detail__tab-indicator` rule:

```css
.reference-detail[data-reference-detail='app'] .reference-detail__tabs {
  align-self: stretch;
  gap: 25px;
  overflow-x: auto;
}

.reference-detail[data-reference-detail='app'] .reference-detail__tabs > button {
  position: relative;
  min-width: max-content !important;
  height: 64px !important;
  color: var(--color-text-secondary) !important;
  font-size: 14px !important;
  transition: color 180ms ease;
}

.reference-detail[data-reference-detail='app'] .reference-detail__tabs > button:hover,
.reference-detail[data-reference-detail='app'] .reference-detail__tabs > button:focus-visible,
.reference-detail[data-reference-detail='app'] .reference-detail__tabs > button[aria-selected='true'] {
  background: transparent !important;
  color: var(--color-text-primary) !important;
}

.reference-detail[data-reference-detail='app'] .reference-detail__tab-indicator {
  bottom: 13px;
  height: 2px;
  border-radius: 999px;
}
```

Do not edit `ReferenceDiscoveryToolbar.tsx`, the Apps discovery toolbar rules, or `ReferenceDetailShell.tsx`.

- [x] **Step 2: Run the focused test and verify it passes**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: all `ReferenceDetailShell` tests PASS.

- [ ] **Step 3: Run the adjacent Apps and App-detail tests**

Run:

```bash
npx tsx --test \
  src/vitrine/ReferenceDetailShell.test.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
```

Expected: all selected tests PASS with the Apps ordering toolbar behavior and App detail behavior unchanged.

Execution note: the focused App-detail tests passed. The combined command also reached an unrelated dirty-worktree failure in `AppsDiscovery.test.tsx`, which expects `AppsDiscoveryPage.tsx` to import `ReferenceDiscoveryPageShell`; this style-only change does not modify either file.

### Task 3: Verify the Narrow Change

**Files:**
- Verify: `src/vitrine/ReferenceDetailShell.test.tsx`
- Verify: `src/vitrine/styles.css`

- [x] **Step 1: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite exits with status 0 and writes the production bundle to `dist/`.

- [x] **Step 2: Inspect the scoped diff**

Run:

```bash
git diff -- \
  src/vitrine/ReferenceDetailShell.test.tsx \
  src/vitrine/styles.css \
  docs/superpowers/specs/2026-07-26-app-detail-app-ordering-tab-style-design.md \
  docs/superpowers/plans/2026-07-26-app-detail-app-ordering-tab-style.md
```

Expected: only the focused test, App-scoped CSS, and the approved design/plan documents appear. Existing unrelated working-tree changes remain untouched.

- [ ] **Step 3: Perform browser QA when an authenticated App detail route is available**

Open one App detail page and verify:

- The section tabs have the same 64px rhythm, 14px labels, 25px spacing, muted inactive color, primary active color, and rounded 2px underline as `App ordering`.
- Hover and keyboard focus use the same primary-text treatment.
- Narrow viewports scroll the tab row horizontally without wrapping.
- Changing sections still updates the active section and content.
- Site detail retains its existing tab presentation.

If no authenticated route is available, report browser QA as unavailable rather than claiming it passed.

Execution note: authenticated desktop and 390px-wide App-detail QA passed, including computed style measurements, horizontal overflow, and section routing. Site detail was protected by the App-only selector and automated boundary assertion but was not opened in browser QA.

- [x] **Step 4: Report completion without committing**

Report the focused test results, build result, browser result or authentication limitation, and the exact files changed. Do not stage, commit, or push unless the user explicitly requests it.
