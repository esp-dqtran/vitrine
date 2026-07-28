# Sites Detail Apps-Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sites detail use the compact Apps detail presentation while preserving all Site-specific data, navigation, controls, and panels.

**Architecture:** Keep `ReferenceDetailShell` as the only detail-frame component. Promote the transferable Apps visual rules from App-scoped selectors into the shared shell, while retaining platform-switcher and other behavior-specific rules under `data-reference-detail="app"` and Site utilities under Site classes.

**Tech Stack:** React 19, TypeScript, CSS, `@astryxdesign/core`, Framer Motion, Node test runner through `tsx`, Vite.

---

## Repository Constraints

- Work directly on `main`.
- Do not create a branch or worktree.
- Preserve unrelated working-tree changes.
- Do not commit or push unless the user explicitly requests it.
- The design source is the current live Apps detail screen, not a newly invented visual direction.

## File Map

- Modify `src/vitrine/styles.css`
  - Own the shared compact detail-shell presentation and responsive rules.
  - Keep App-only platform-switcher rules and Site-only metadata/version utilities isolated.
- Modify `src/vitrine/ReferenceDetailShell.test.tsx`
  - Lock the shared hero, metadata, actions, navigation, tab, responsive, and boundary contracts.
- Verify `src/vitrine/Sites.test.tsx`
  - Prove Site content, actions, tabs, and Technology behavior remain intact.
- Verify `src/vitrine/AppDetailLoadingPage.test.tsx`
  - Prove the shared visual promotion does not change Apps loading-shell behavior.

No component, API, route, store, worker, or database file should change unless a
failing test demonstrates that the existing shell markup cannot express the
approved design.

### Task 1: Write the shared compact-shell regression tests

**Files:**
- Modify: `src/vitrine/ReferenceDetailShell.test.tsx:80-155`
- Test: `src/vitrine/ReferenceDetailShell.test.tsx`

- [ ] **Step 1: Replace the App-only tab-style test with a shared-shell test**

Replace `copies the Apps ordering strip style onto App detail tabs only` with:

```tsx
test('shares the compact Apps detail presentation with Sites', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const heroRule = styles.match(
    /\.reference-detail__hero-inner\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const logoRule = styles.match(
    /\.reference-detail__logo\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const headingRule = styles.match(
    /\.reference-detail__heading h1\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const descriptionRule = styles.match(
    /\.reference-detail__heading p\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const metadataRule = styles.match(
    /\.reference-detail__metadata\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const actionsRule = styles.match(
    /\.reference-detail__actions\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const navigationRule = styles.match(
    /\.reference-detail__navigation\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const tabsRule = styles.match(
    /\.reference-detail__tabs\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const tabRule = styles.match(
    /\.reference-detail__tabs > button\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const activeRule = styles.match(
    /\.reference-detail__tabs > button:hover,[\s\S]*?\.reference-detail__tabs > button\[aria-selected='true'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const indicatorRule = styles.match(
    /\.reference-detail__tab-indicator\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(heroRule, /grid-template-columns:\s*80px minmax\(0,\s*1fr\) auto/);
  assert.match(heroRule, /grid-template-areas:[\s\S]*"logo heading actions"[\s\S]*"logo metadata actions"/);
  assert.match(heroRule, /column-gap:\s*24px/);
  assert.match(heroRule, /padding-bottom:\s*28px/);

  assert.match(logoRule, /width:\s*80px/);
  assert.match(logoRule, /height:\s*80px/);
  assert.match(logoRule, /border-radius:\s*20px/);

  assert.match(headingRule, /font-size:\s*clamp\(32px,\s*3vw,\s*38px\)/);
  assert.match(descriptionRule, /color:\s*var\(--color-text-secondary\)/);
  assert.match(descriptionRule, /font-size:\s*clamp\(18px,\s*1\.7vw,\s*24px\)/);

  assert.match(metadataRule, /gap:\s*32px/);
  assert.match(metadataRule, /padding-top:\s*0/);
  assert.match(actionsRule, /grid-area:\s*actions/);
  assert.match(actionsRule, /padding:\s*0/);

  assert.match(navigationRule, /min-height:\s*56px/);
  assert.match(navigationRule, /border-top:\s*1px solid var\(--color-border-subtle\)/);
  assert.match(tabsRule, /gap:\s*25px/);
  assert.match(tabsRule, /overflow-x:\s*auto/);
  assert.match(tabsRule, /scroll-snap-type:\s*inline proximity/);
  assert.match(tabRule, /min-width:\s*max-content/);
  assert.match(tabRule, /height:\s*56px/);
  assert.match(tabRule, /font-size:\s*17px/);
  assert.match(activeRule, /background:\s*transparent/);
  assert.match(activeRule, /color:\s*var\(--color-text-primary\)/);
  assert.match(indicatorRule, /bottom:\s*0/);
  assert.match(indicatorRule, /height:\s*2px/);
  assert.match(indicatorRule, /border-radius:\s*999px/);
});
```

- [ ] **Step 2: Replace the App-only text-scale test with shared and boundary assertions**

Replace `matches App detail metadata and navigation text to the Flow directory scale` with:

```tsx
test('shares metadata and action scale without leaking App controls into Sites', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const metadataLabelRule = styles.match(
    /\.reference-detail__metadata-item > span\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const metadataValueRule = styles.match(
    /\.reference-detail__metadata-item > strong\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const actionRule = styles.match(
    /\.reference-detail__actions button\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const leadingRule = styles.match(
    /\.reference-detail__tab-leading\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(metadataLabelRule, /font-size:\s*16px/);
  assert.match(metadataValueRule, /font-size:\s*17px/);
  assert.match(actionRule, /min-height:\s*44px/);
  assert.match(actionRule, /font-size:\s*16px/);
  assert.match(leadingRule, /padding-bottom:\s*0/);

  assert.match(
    styles,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__metadata-item \.apps-platform-switcher/,
  );
  assert.doesNotMatch(
    styles,
    /\.reference-detail\[data-reference-detail='site'\][^{]*\.apps-platform-switcher/,
  );
});
```

- [ ] **Step 3: Add a responsive shared-shell assertion**

Append:

```tsx
test('stacks the shared compact detail shell at the mobile breakpoint', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const keyframesStart = styles.indexOf('@keyframes vtDraw');
  const mobileStart = styles.lastIndexOf('@media (max-width: 760px)', keyframesStart);
  assert.notEqual(mobileStart, -1);
  assert.notEqual(keyframesStart, -1);
  const mobile = styles.slice(mobileStart, keyframesStart);

  assert.match(
    mobile,
    /\.reference-detail__hero-inner\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/,
  );
  assert.match(
    mobile,
    /\.reference-detail__metadata\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    mobile,
    /\.reference-detail__actions\s*\{[^}]*width:\s*100%/,
  );
});
```

If the existing mobile media query uses a different exact breakpoint, use that
existing breakpoint in the test instead of introducing another breakpoint.

- [ ] **Step 4: Add loading and failure gutter assertions**

Append:

```tsx
test('aligns Site loading and failure states with the shared page gutters', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const stateRule = styles.match(
    /\.site-detail--loading,\s*\.site-detail--failure\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const keyframesStart = styles.indexOf('@keyframes vtDraw');
  const mobileStart = styles.lastIndexOf('@media (max-width: 760px)', keyframesStart);
  assert.notEqual(mobileStart, -1);
  assert.notEqual(keyframesStart, -1);
  const mobile = styles.slice(mobileStart, keyframesStart);

  assert.match(stateRule, /width:\s*100%/);
  assert.match(stateRule, /padding:\s*24px 32px 80px/);
  assert.match(
    mobile,
    /\.site-detail--loading,[\s\S]*?\.site-detail--failure\s*\{[^}]*padding:\s*24px 16px 80px/,
  );
});
```

- [ ] **Step 5: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: the new shared-selector assertions fail because the compact rules are
still scoped to `data-reference-detail="app"`.

- [ ] **Step 6: Inspect the diff without committing**

Run:

```bash
git diff -- src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: only the intended regression-test changes are present.

### Task 2: Promote the transferable Apps presentation into the shared shell

**Files:**
- Modify: `src/vitrine/styles.css:1920-2275`
- Modify: `src/vitrine/styles.css:2590-2675`
- Test: `src/vitrine/ReferenceDetailShell.test.tsx`

- [ ] **Step 1: Make the shared desktop hero use the current Apps geometry**

Replace the generic hero, logo, heading, metadata, and action blocks with the
following shared rules:

```css
.reference-detail__hero {
  min-height: auto;
  border: 0;
  background: var(--color-background-body);
}

.reference-detail__hero-inner {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) auto;
  grid-template-areas:
    "logo heading actions"
    "logo metadata actions";
  align-items: start;
  column-gap: 24px;
  row-gap: 18px;
  padding-top: 32px;
  padding-bottom: 28px;
}

.reference-detail__logo {
  position: relative;
  grid-area: logo;
  display: grid;
  width: 80px;
  height: 80px;
  margin-bottom: 0;
  overflow: hidden;
  place-items: center;
  border-radius: 20px;
}

.reference-detail__heading {
  grid-area: heading;
  max-width: 760px;
}

.reference-detail__heading h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(32px, 3vw, 38px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -.045em;
}

.reference-detail__heading p {
  max-width: 720px;
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: clamp(18px, 1.7vw, 24px);
  font-weight: 520;
  line-height: 1.25;
  letter-spacing: -.035em;
}

.reference-detail__metadata {
  grid-area: metadata;
  display: flex;
  gap: 32px;
  padding-top: 0;
  flex-wrap: wrap;
}

.reference-detail__metadata-item {
  display: grid;
  align-content: start;
  gap: 4px;
}

.reference-detail__metadata-item > span {
  color: var(--color-text-secondary);
  font-size: 16px;
  font-weight: 400;
}

.reference-detail__metadata-item > strong {
  color: var(--color-text-primary);
  font-size: 17px;
  font-weight: 600;
}

.reference-detail__actions {
  grid-area: actions;
  align-self: center;
  display: flex;
  gap: 8px;
  padding: 0;
  flex-wrap: wrap;
}

.reference-detail__actions button {
  min-height: 44px;
  font-size: 16px !important;
}

.reference-detail__actions button span {
  font-size: 16px !important;
}
```

Delete the now-identical App-scoped duplicates for hero height, hero grid,
logo, heading, metadata scale, and actions. Keep every selector containing
`.apps-platform-switcher`.

- [ ] **Step 2: Make the navigation and rendered tab buttons shared**

Use the emitted child-button selector because `ToggleButton` does not forward
`reference-detail__tab` to the DOM:

```css
.reference-detail__navigation {
  min-width: 0;
  min-height: 56px;
  display: flex;
  align-self: stretch;
  align-items: center;
  gap: 25px;
  overflow-x: auto;
  border-top: 1px solid var(--color-border-subtle);
  flex: 0 0 auto;
}

.reference-detail__tab-leading {
  display: flex;
  align-items: center;
  align-self: stretch;
  padding-bottom: 0;
  flex: 0 0 auto;
}

.reference-detail__tabs {
  position: relative;
  min-width: 0;
  display: flex;
  align-self: stretch;
  align-items: center;
  gap: 25px;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
  scroll-snap-type: inline proximity;
}

.reference-detail__tabs > button {
  position: relative;
  min-width: max-content !important;
  height: 56px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  color: var(--color-text-secondary) !important;
  font-size: 17px !important;
  flex: 0 0 auto;
  scroll-snap-align: start;
  white-space: nowrap;
  transition: color 180ms ease;
}

.reference-detail__tabs > button span {
  font-size: 17px !important;
}

.reference-detail__tabs > button:hover,
.reference-detail__tabs > button:focus-visible,
.reference-detail__tabs > button[aria-selected='true'] {
  background: transparent !important;
  color: var(--color-text-primary) !important;
}

.reference-detail__tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--color-text-primary);
  pointer-events: none;
}

.reference-detail__tab-trailing {
  padding-bottom: 0;
  font-size: 16px;
  flex: 0 0 auto;
}
```

Remove the equivalent App-scoped navigation, tab-button, active-state,
indicator, and trailing-count blocks. Leave `useSlidingIndicator` and
`ReferenceDetailShell.tsx` unchanged.

- [ ] **Step 3: Match Site metadata links to shared metadata values**

Update only the font-size line:

```css
.site-detail__meta-links a {
  color: var(--color-text-primary);
  font-size: 17px;
  font-weight: 600;
  text-decoration: none;
}
```

- [ ] **Step 4: Promote the existing Apps mobile composition to the shared shell**

Inside the existing mobile breakpoint, replace the App-scoped layout rules with:

```css
.reference-detail__hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 24px;
  padding-bottom: 20px;
}

.reference-detail__logo {
  width: 64px;
  height: 64px;
  margin-bottom: 0;
  border-radius: 16px;
}

.reference-detail__heading h1 {
  font-size: clamp(28px, 9vw, 34px);
}

.reference-detail__heading p {
  font-size: 20px;
}

.reference-detail__metadata {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
  padding-top: 20px;
}

.reference-detail__actions {
  width: 100%;
  padding: 18px 0 0;
}

.reference-detail__actions > * {
  flex: 1 1 148px;
}

.reference-detail__navigation {
  min-height: 56px;
}

.reference-detail__tab-leading {
  min-height: 56px;
}
```

Delete the now-identical App-scoped mobile duplicates. Keep mobile
`.apps-platform-switcher` rules App-scoped if any exist.

- [ ] **Step 5: Align Site loading and failure gutters**

Replace the existing state wrapper with:

```css
.site-detail--loading,
.site-detail--failure {
  width: 100%;
  margin: 0;
  padding: 24px 32px 80px;
}
```

Inside the shared mobile breakpoint, add:

```css
.site-detail--loading,
.site-detail--failure {
  padding: 24px 16px 80px;
}
```

Do not change the loading skeleton, retry action, back action, or state messages.

- [ ] **Step 6: Run the shared-shell test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: all `ReferenceDetailShell` tests pass.

- [ ] **Step 7: Inspect the CSS diff without committing**

Run:

```bash
git diff --check
git diff -- src/vitrine/styles.css src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: no whitespace errors; only shared detail presentation and its tests
changed.

### Task 3: Verify Site behavior and the Apps boundary

**Files:**
- Verify: `src/vitrine/Sites.test.tsx`
- Verify: `src/vitrine/AppDetailLoadingPage.test.tsx`
- Verify: `src/vitrine/components/SiteVersionPage.tsx`
- Verify: `src/vitrine/components/ScreenDetail.tsx`

- [ ] **Step 1: Run the Site detail behavior suite**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx
```

Expected: all tests pass, including the Site hierarchy, Save, Visit Site,
version selector, Preview, Sections, Technology, member visibility, inspector,
and Wappalyzer-result assertions.

- [ ] **Step 2: Run the Apps loading and shared-shell suites together**

Run:

```bash
npx tsx --test \
  src/vitrine/ReferenceDetailShell.test.tsx \
  src/vitrine/AppDetailLoadingPage.test.tsx
```

Expected: all tests pass and App loading markup remains unchanged.

- [ ] **Step 3: Confirm no behavior files changed**

Run:

```bash
git diff --exit-code -- \
  src/vitrine/components/ReferenceDetailShell.tsx \
  src/vitrine/components/SiteVersionPage.tsx \
  src/vitrine/components/ScreenDetail.tsx
```

Expected: exit code `0`. If this fails, stop and explain why component changes
were required before continuing.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite completes successfully and emits the production bundle.

- [ ] **Step 5: Review the complete uncommitted slice**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: the implementation slice contains `src/vitrine/styles.css`,
`src/vitrine/ReferenceDetailShell.test.tsx`, the approved spec, and this plan,
plus any pre-existing unrelated user changes.

### Task 4: Perform desktop and mobile visual QA

**Files:**
- Verify only: `src/vitrine/styles.css`
- Reference: `docs/superpowers/specs/2026-07-27-sites-detail-apps-style-design.md`

- [ ] **Step 1: Start the existing API and Vite preview**

In separate terminals, run:

```bash
node --env-file=.env --import tsx services/api/src/index.ts
```

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

Expected: the API listens on port `3010` and Vite listens on port `5174`.

- [ ] **Step 2: Compare the authenticated desktop screens at the same viewport**

Open:

```text
http://127.0.0.1:5174/apps/15five/screens?platform=web
http://127.0.0.1:5174/sites/19/versions/19/preview
```

At the same desktop viewport, capture both screens and compare them together.
Verify:

- logo size, title scale, metadata scale, action height, navigation height,
  tab gap, active underline, and body start visibly match;
- the Site description remains visible but subordinate;
- Latest, Preview, Sections, Technology, Save, and Visit Site remain present;
- Apps is visually unchanged from the reference capture.

- [ ] **Step 3: Exercise the Site detail controls**

On the Site screen:

1. Open Latest and select another version when available.
2. Open Preview.
3. Open Sections and verify its toolbar and cards.
4. Open Technology and verify technology icons and groups.
5. Verify Save toggles its label.
6. Verify Visit Site remains the external secondary action without navigating
   away from the QA tab.

Expected: every existing interaction behaves as before.

- [ ] **Step 4: Verify the Site screen at a mobile viewport**

Use a `390 x 844` viewport and verify:

- logo and title lead the page;
- description does not overlap metadata;
- metadata uses a readable two-column wrap;
- Save and Visit Site remain reachable;
- Latest and all tabs can be reached through horizontal scrolling;
- no tab label, preview media, section card, or Technology card is clipped.

- [ ] **Step 5: Fix only visible mismatches and repeat the focused checks**

If visual QA finds a mismatch, adjust only `src/vitrine/styles.css`, then rerun:

```bash
npx tsx --test \
  src/vitrine/ReferenceDetailShell.test.tsx \
  src/vitrine/Sites.test.tsx \
  src/vitrine/AppDetailLoadingPage.test.tsx
npm run build
git diff --check
```

Expected: all focused tests and the build pass, with no whitespace errors.

- [ ] **Step 6: Leave the verified changes uncommitted**

Do not commit or push. Report the changed files, focused test counts, build
result, desktop/mobile QA result, and any unrelated pre-existing failures to
the user.
