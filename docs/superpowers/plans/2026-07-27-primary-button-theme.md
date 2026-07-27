# Vitrine Primary Button Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every Vitrine primary button with a white fill and black content on the product's black background.

**Architecture:** Keep `@astryxdesign/core` as the component implementation and add one Vitrine theme override keyed by its emitted `data-variant="primary"` attribute. Remove the conflicting App-detail color override while leaving component geometry and non-primary variants unchanged.

**Tech Stack:** React 19, `@astryxdesign/core`, CSS, Node test runner, Vite

---

### Task 1: Define and verify the shared Vitrine primary-button treatment

**Files:**
- Modify: `src/vitrine/ReferenceDetailShell.test.tsx:71-80`
- Modify: `src/vitrine/styles.css:4-10`
- Modify: `src/vitrine/styles.css:1735-1739`

- [x] **Step 1: Write the failing CSS contract test**

Replace the existing App-detail-only test with:

```tsx
test('renders Vitrine primary actions as white buttons with black content', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const primaryActionRule = styles.match(
    /button\[data-variant='primary'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(primaryActionRule, /border-color:\s*#fff\s*!important/);
  assert.match(primaryActionRule, /background:\s*#fff\s*!important/);
  assert.match(primaryActionRule, /color:\s*#111\s*!important/);
  assert.doesNotMatch(
    styles,
    /\.reference-detail\[data-reference-detail='app'\] button\[data-variant='primary'\]/,
  );
});
```

- [x] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: the primary-button test fails because the shared white/black rule is
absent and the App-detail black/white override still exists.

- [x] **Step 3: Add the shared primary-button colors**

Add after `.vitrine-page`:

```css
button[data-variant='primary'] {
  border-color: #fff !important;
  background: #fff !important;
  color: #111 !important;
}

button[data-variant='primary']:hover:not(:disabled) {
  border-color: #f1f1f1 !important;
  background: #f1f1f1 !important;
}

button[data-variant='primary']:active:not(:disabled) {
  border-color: #e5e5e5 !important;
  background: #e5e5e5 !important;
}
```

Delete the narrower rule:

```css
.reference-detail[data-reference-detail='app'] button[data-variant='primary'] {
  border-color: #111 !important;
  background: #111 !important;
  color: #fff !important;
}
```

- [x] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: all tests in the file pass.

- [x] **Step 5: Run the Vitrine regression suite and production build**

Run:

```bash
npx tsx --test src/vitrine/*.test.tsx
npm run build
git diff --check
```

Expected: zero test failures, a successful Vite build, and no whitespace errors.

Actual: the focused contract passes, the Vite build and `git diff --check`
pass, and the broader suite passes 218 of 219 tests. The remaining failure is
an unrelated pre-existing Flow assertion that expects the retired `Prototype`
label instead of the current `Document Flow` tab.

- [x] **Step 6: Verify the running UI**

Rebuild the local preview, then inspect the Apps catalog, App detail, Flow
gallery, selected Flow, and one dialog. Confirm primary buttons compute to
`rgb(255, 255, 255)` background and `rgb(17, 17, 17)` text; confirm hover and
disabled states remain readable.

No commit is included because this repository requires an explicit user request
before committing or pushing.
