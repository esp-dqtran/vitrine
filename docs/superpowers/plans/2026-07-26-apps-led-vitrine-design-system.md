# Apps-led Vitrine Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Apps discovery screen the shared visual and component system for Apps, Sites, and the surrounding Vitrine member chrome.

**Architecture:** Preserve `@astryxdesign/core` as the foundation. Add stable generic class contracts to the existing shared React components, move Apps-derived gallery rules into one late-loaded stylesheet, and make Apps and Sites opt into the same shell, taxonomy, toolbar, card, state, and responsive contracts.

**Tech Stack:** React, TypeScript, Astryx Design Core, CSS custom properties, Node test runner, Vite.

---

### Task 1: Lock the Apps visual contract

**Files:**
- Create: `src/vitrine/referenceDiscovery.css`
- Modify: `src/vitrine/main.tsx`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write a failing contract test**

Add assertions that `referenceDiscovery.css` defines the Apps-derived semantic
aliases and geometry:

```ts
const referenceCss = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
assert.match(referenceCss, /--reference-font-family:\s*'Figtree',\s*system-ui,\s*sans-serif/);
assert.match(referenceCss, /--reference-nav-height:\s*72px/);
assert.match(referenceCss, /--reference-content-padding:\s*32px/);
assert.match(referenceCss, /--reference-facet-size:\s*24px/);
assert.match(referenceCss, /--reference-card-radius:\s*24px/);
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: fail because `referenceDiscovery.css` does not exist.

- [ ] **Step 3: Add the shared foundation stylesheet**

Create the stylesheet with Apps-derived aliases:

```css
:root {
  --reference-font-family: 'Figtree', system-ui, sans-serif;
  --reference-nav-height: 72px;
  --reference-content-padding: 32px;
  --reference-taxonomy-top: 29px;
  --reference-taxonomy-bottom: 73px;
  --reference-taxonomy-gap: 48px;
  --reference-toolbar-height: 64px;
  --reference-facet-size: 24px;
  --reference-card-radius: 24px;
  --reference-media-radius: 14px;
  --reference-logo-radius: 12px;
}
```

Import it after `styles.css` in `main.tsx` so the shared contract overrides old
page forks without changing evidence/demo styling.

- [ ] **Step 4: Run the test and verify GREEN**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: pass.

### Task 2: Give shared components stable class contracts

**Files:**
- Modify: `src/vitrine/components/ReferenceDiscoveryTopNav.tsx`
- Modify: `src/vitrine/components/SearchTrigger.tsx`
- Modify: `src/vitrine/components/ReferenceDiscoveryToolbar.tsx`
- Modify: `src/vitrine/components/DiscoveryCard.tsx`
- Test: `src/vitrine/AppsDiscovery.test.tsx`
- Test: `src/vitrine/Sites.test.tsx`

- [ ] **Step 1: Write failing shared-component boundary tests**

Assert rendered Apps and Sites markup contains:

```ts
assert.match(html, /class="[^"]*reference-discovery-nav/);
assert.match(html, /class="[^"]*reference-search-trigger/);
assert.match(html, /class="[^"]*reference-discovery-toolbar/);
assert.match(html, /class="[^"]*discovery-card/);
```

Also read `SearchTrigger.tsx` and assert it no longer contains
`maxWidth: 420`.

- [ ] **Step 2: Run the tests and verify RED**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: fail because the generic navigation and search-trigger classes are
missing and SearchTrigger still owns inline width constraints.

- [ ] **Step 3: Add generic classes**

`ReferenceDiscoveryTopNav` emits both its generic and compatibility classes:

```tsx
<header className={`reference-discovery-nav ${className}`}>
  <div className={`reference-discovery-nav__left ${className}__left`}>
  <a className={`reference-discovery-nav__brand ${className}__brand`}>
  <div className={`reference-discovery-nav__types ${className}__types`}>
  <div className={`reference-discovery-nav__search ${className}__search`}>
  <div className={`reference-discovery-nav__actions ${className}__actions`}>
```

`SearchTrigger` replaces layout inline styles with:

```tsx
<div className="reference-search-trigger">
```

and gives its main button `className="reference-search-trigger__button"`.
Keep only dynamic or component-specific inline values.

`ReferenceDiscoveryToolbar` and `DiscoveryCard` retain their existing generic
classes; add `data-reference-component` markers for focused boundaries without
changing semantics.

- [ ] **Step 4: Run the tests and verify GREEN**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: pass.

### Task 3: Put Apps and Sites on one gallery shell

**Files:**
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/components/SitesPage.tsx`
- Modify: `src/vitrine/referenceDiscovery.css`
- Test: `src/vitrine/AppsDiscovery.test.tsx`
- Test: `src/vitrine/Sites.test.tsx`

- [ ] **Step 1: Write failing shell parity tests**

Assert both rendered pages include:

```ts
assert.match(html, /class="[^"]*reference-discovery[^"]*"/);
assert.match(html, /class="[^"]*reference-discovery__content[^"]*"/);
assert.match(html, /class="[^"]*reference-discovery__taxonomy[^"]*"/);
assert.match(html, /class="[^"]*reference-discovery__facet[^"]*"/);
assert.match(html, /class="[^"]*reference-discovery__grid[^"]*"/);
```

For Sites, assert the Sections group keeps
`reference-discovery__facet--wide`.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: fail because the generic shell classes are not present.

- [ ] **Step 3: Add shared shell classes and canonical styles**

Add generic classes alongside compatibility classes in both pages. Implement
the Apps source values in `referenceDiscovery.css`:

```css
.reference-discovery {
  min-height: 100vh;
  background: var(--color-background-body);
  color: var(--color-text-primary);
  font-family: var(--reference-font-family);
}

.reference-discovery__content {
  padding-inline: var(--reference-content-padding);
}

.reference-discovery__taxonomy {
  display: grid;
  gap: var(--reference-taxonomy-gap);
  padding: var(--reference-taxonomy-top) 0 var(--reference-taxonomy-bottom);
}

.reference-discovery__facet h2 {
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.reference-discovery__facet button {
  width: max-content !important;
  min-width: 0 !important;
  height: 32px !important;
  justify-content: flex-start !important;
  padding: 0 !important;
  color: var(--color-text-primary) !important;
  font-size: var(--reference-facet-size) !important;
  font-weight: 600 !important;
  line-height: 32px !important;
  letter-spacing: -.025em;
}
```

Apps uses four taxonomy columns. Sites uses the same column rhythm with three
groups; Sections keeps a two-column option layout. Both use the same desktop,
tablet, and compact breakpoints.

Remove the duplicate `activeFilterCount` prop from `SitesPage`.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: pass.

### Task 4: Standardize navigation, search, toolbar, cards, and states

**Files:**
- Modify: `src/vitrine/referenceDiscovery.css`
- Test: `src/vitrine/AppsDiscovery.test.tsx`
- Test: `src/vitrine/Sites.test.tsx`
- Test: `src/vitrine/SearchTrigger.test.tsx`

- [ ] **Step 1: Write failing CSS-boundary tests**

Assert the shared stylesheet defines:

```ts
assert.match(referenceCss, /\.reference-discovery-nav\s*\{[^}]*height:\s*var\(--reference-nav-height\)/);
assert.match(referenceCss, /\.reference-discovery-nav__search\s+\.reference-search-trigger\s*\{[^}]*max-width:\s*none/);
assert.match(referenceCss, /\.reference-discovery-toolbar\s*\{[^}]*min-height:\s*var\(--reference-toolbar-height\)/);
assert.match(referenceCss, /\.discovery-card\s*\{[^}]*border-radius:\s*var\(--reference-card-radius\)/);
assert.match(referenceCss, /\.reference-discovery__state\s*\{[^}]*min-height:\s*360px/);
```

- [ ] **Step 2: Run tests and verify RED**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx src/vitrine/SearchTrigger.test.tsx
```

Expected: fail because the canonical shared rules do not exist yet.

- [ ] **Step 3: Implement canonical component styling**

Move the Apps-derived top-nav grid, full-width search, identity tabs, 64px
toolbar, text states, underline motion, shared card anatomy, focus treatment,
grid, loading, and state rules into `referenceDiscovery.css`. Use only Astryx
semantic color tokens. Preserve App mobile-media and Site video behavior as
kind-specific rules.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx src/vitrine/SearchTrigger.test.tsx
```

Expected: pass.

### Task 5: Audit the rest of Vitrine chrome

**Files:**
- Modify only member-facing files proven by the audit.
- Test the same focused component boundary that each edit affects.

- [ ] **Step 1: Produce a literal-style inventory**

Run:

```bash
rg -n "font-family|#[0-9A-Fa-f]{3,8}|rgb\\(" src/vitrine \
  -g '*.tsx' -g '*.css'
```

Classify each result as member chrome or external evidence/demo content.

- [ ] **Step 2: Replace member-chrome literals**

For member chrome, use `--color-*`, `--font-family-*`, `--spacing-*`, and
`--radius-*` tokens or the shared reference aliases. Do not change imported
design-system samples, screenshots, evidence visualizations, or third-party
brand content.

- [ ] **Step 3: Run affected tests**

Run the focused tests for every touched component. Expected: pass.

### Task 6: Regression and visual comparison

**Files:**
- Verify only.

- [ ] **Step 1: Run focused regression tests**

```bash
npx tsx --test \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/Sites.test.tsx \
  src/vitrine/SearchTrigger.test.tsx \
  src/vitrine/AppCard.test.tsx
```

Expected: zero failures.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Vite exits successfully.

- [ ] **Step 3: Check the diff**

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Compare matching browser captures**

Capture Apps and Sites at the same desktop and compact viewports. Confirm:

- identical neutral chrome colors and Figtree typography;
- identical navigation height, search width, tabs, content padding, facet
  headings/options, toolbar states, and card identity;
- Sites retains only content-driven variations;
- no cropped media, hidden core controls, or horizontal overflow.

No commit or push is included because the project requires an explicit request.
