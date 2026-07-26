# Flow Directory Tree Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing left-side Flow navigation read as a compact directory tree while preserving its current data, routing, search, disclosure, and responsive behavior.

**Architecture:** Keep `FlowTree` as a controlled presentational component. Add only presentational root, folder, and Flow-leaf markup, then restyle the existing nested lists with compact rows and branch connectors. Verify the rendered structure before changing production code, and keep all grouping and workspace behavior unchanged.

**Tech Stack:** React, TypeScript, Astryx Design System controls, CSS, Node test runner, Vite

---

### Task 1: Specify the directory-tree structure

**Files:**
- Modify: `src/vitrine/FlowTreeNavigation.test.tsx`
- Test: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Write the failing rendered-structure assertions**

Extend `renders category disclosures, counts, nested flows, and selected state`
with assertions for the visible root total and the decorative directory
structure:

```tsx
assert.match(html, /class="flow-tree__root"/);
assert.match(html, /class="flow-tree__root-label">Flows<\/span>/);
assert.match(html, /class="flow-tree__root-count">3<\/span>/);
assert.match(html, /class="flow-tree__folder-icon"/);
assert.match(html, /class="flow-tree__leaf-icon"/);
assert.match(html, /class="flow-tree__flow-branch"/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --import tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: the first test fails because `FlowTree` does not yet render
`flow-tree__root`, root total, folder icons, leaf icons, or branch wrappers.

### Task 2: Add minimal explorer markup

**Files:**
- Modify: `src/vitrine/components/FlowTree.tsx`
- Test: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Add decorative local icons**

Add two local, `aria-hidden` SVG components:

```tsx
function FolderIcon() {
  return (
    <svg
      aria-hidden="true"
      className="flow-tree__folder-icon"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path d="M1.75 4.25h4l1.5 1.5h7v6.5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-8Z" />
      <path d="M1.75 5.75V3.5A1.25 1.25 0 0 1 3 2.25h3l1.5 2h5.25A1.5 1.5 0 0 1 14.25 5.75" />
    </svg>
  );
}

function FlowLeafIcon() {
  return (
    <svg
      aria-hidden="true"
      className="flow-tree__leaf-icon"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="4" cy="4" r="1.25" />
      <circle cx="12" cy="8" r="1.25" />
      <circle cx="4" cy="12" r="1.25" />
      <path d="M5.25 4h1.5A2.25 2.25 0 0 1 9 6.25v3.5A2.25 2.25 0 0 1 6.75 12h-1.5M9 8h1.75" />
    </svg>
  );
}
```

- [ ] **Step 2: Add the visible root summary**

Compute the visible count from the already filtered groups and render it
between search and the group list:

```tsx
const visibleFlowCount = groups.reduce(
  (total, group) => total + group.flows.length,
  0,
);
```

```tsx
<div className="flow-tree__root">
  <span aria-hidden="true" className="flow-tree__root-marker" />
  <span className="flow-tree__root-label">Flows</span>
  <span className="flow-tree__root-count">{visibleFlowCount}</span>
</div>
```

- [ ] **Step 3: Add directory markers to category and Flow rows**

Place `FolderIcon` beside the category label:

```tsx
<span className="flow-tree__group-content">
  <FolderIcon />
  <span className="flow-tree__group-label">{group.label}</span>
</span>
```

Wrap each Flow list item and pass `FlowLeafIcon` through the existing Astryx
button:

```tsx
<li className="flow-tree__flow-branch" key={flow.id}>
  <Button
    label={flow.title}
    variant="ghost"
    size="sm"
    className="flow-tree__flow-button"
    aria-current={flow.id === selectedFlowId ? 'page' : undefined}
    onClick={() => onSelectFlow(flow.id)}
    icon={<FlowLeafIcon />}
  />
</li>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --import tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: all Flow navigation tests pass.

### Task 3: Specify and implement the directory styling

**Files:**
- Modify: `src/vitrine/FlowTreeNavigation.test.tsx`
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Write failing CSS-contract assertions**

Extend `defines the desktop rail and 980px drawer transition`:

```tsx
assert.match(css, /\.flow-tree__root\s*\{[\s\S]*grid-template-columns:/);
assert.match(css, /\.flow-tree__flows::before\s*\{[\s\S]*width:\s*1px/);
assert.match(css, /\.flow-tree__flow-branch::before\s*\{[\s\S]*height:\s*1px/);
assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\][\s\S]*box-shadow:/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --import tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: the CSS-contract test fails because explorer root, connector, and
selected-row styling do not exist.

- [ ] **Step 3: Replace only the existing Flow-tree visual rules**

Update the `.flow-tree__*` rules in `src/vitrine/styles.css` to:

- render the root as a compact three-column summary;
- use 32 px category rows and 30 px Flow rows;
- keep category and Flow labels truncated;
- style folder and Flow icons with `currentColor`;
- draw one vertical connector on `.flow-tree__flows::before`;
- draw horizontal connectors on `.flow-tree__flow-branch::before`;
- use neutral full-row hover;
- use an inset accent indicator plus subdued selected background for
  `[aria-current='page']`;
- retain existing visible focus outlines;
- leave workspace, gallery, drawer, and unrelated Site/App rules unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --import tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: all Flow navigation tests pass.

### Task 4: Verify the focused change

**Files:**
- Verify: `src/vitrine/components/FlowTree.tsx`
- Verify: `src/vitrine/FlowTreeNavigation.test.tsx`
- Verify: `src/vitrine/styles.css`

- [ ] **Step 1: Run related Flow component tests**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx src/vitrine/components/FlowsPanel.test.tsx
```

Expected: all related tests pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite completes with exit code 0.

- [ ] **Step 3: Inspect the exact diff**

Run:

```bash
git diff -- \
  src/vitrine/components/FlowTree.tsx \
  src/vitrine/FlowTreeNavigation.test.tsx \
  src/vitrine/styles.css \
  docs/superpowers/specs/2026-07-25-flow-directory-tree-visual-design.md \
  docs/superpowers/plans/2026-07-25-flow-directory-tree-visual-implementation.md
```

Expected: only the approved Flow directory-tree markup, tests, focused
Flow-tree styles, and documentation appear. Existing unrelated modifications
in `styles.css` remain present and unaltered.
