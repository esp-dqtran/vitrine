# Build in Public Simple Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-heavy Build in Public screen with one compact, responsive vertical timeline while preserving its route, content, and navigation callbacks.

**Architecture:** Keep the static roadmap data and `BuildInPublicPage` boundary in `src/vitrine/BuildInPublic.tsx`. Simplify `RoadmapItem` into a semantic ordered-list entry with state-specific marker styling and remove every page section that is not navigation, introduction, or timeline.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, Node test runner, React server rendering, Vite.

---

## File map

- Modify `src/vitrine/BuildInPublic.test.tsx`: define the minimal timeline contract and guard against the removed dashboard and promotional sections.
- Modify `src/vitrine/BuildInPublic.tsx`: render the minimal navigation, introduction, responsive timeline, and accessible state treatments.

### Task 1: Lock the minimal screen contract

**Files:**
- Modify: `src/vitrine/BuildInPublic.test.tsx`
- Test: `src/vitrine/BuildInPublic.test.tsx`

- [ ] **Step 1: Replace the editorial timeline assertions with the minimal timeline contract**

Update the first test to assert the compact title, ordered timeline, state labels, and plain crawl evidence while explicitly rejecting the removed sections:

```tsx
test('renders a minimal public roadmap as one accessible timeline', () => {
  const html = renderToStaticMarkup(
    <BuildInPublicPage onHome={() => undefined} onBrowse={() => undefined} onPricing={() => undefined} />,
  );

  assert.match(html, /<h1[^>]*>Build in public<\/h1>/);
  assert.match(html, /Follow what Astryx has shipped, what we are building now, and what comes next\./);
  assert.match(html, /Last updated July 23, 2026/);
  assert.match(html, /<ol[^>]*aria-label="Astryx product timeline"/);
  assert.match(html, /Building now/);
  assert.match(html, /Shipped/);
  assert.match(html, /Up next/);
  assert.match(html, /Exploring/);
  assert.match(html, /465 apps · 137K\+ screens · 647 UI elements/);
  assert.doesNotMatch(html, /Current catalog snapshot/);
  assert.doesNotMatch(html, /Browse the library/);
  assert.doesNotMatch(html, /See pricing/);
  assert.doesNotMatch(html, /The useful parts are already here/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/BuildInPublic.test.tsx
```

Expected: FAIL because the current heading is “Building the design intelligence workspace in the open” and the removed dashboard and promotional content still render.

- [ ] **Step 3: Commit the failing contract**

```bash
git add src/vitrine/BuildInPublic.test.tsx
git commit -m "test: define minimal build in public timeline"
```

### Task 2: Replace the card stack with one timeline

**Files:**
- Modify: `src/vitrine/BuildInPublic.tsx`
- Test: `src/vitrine/BuildInPublic.test.tsx`

- [ ] **Step 1: Remove dashboard-only dependencies and constants**

Remove `Divider`, the `SNAPSHOT` constant, and the status `soft` colors. Keep the roadmap status type, roadmap data, navigation props, and static no-API data model.

Use this smaller status contract:

```tsx
const STATUS: Record<RoadmapStatus, { label: string; color: string; marker: string }> = {
  building: { label: 'Building now', color: '#2f64e9', marker: '●' },
  shipped: { label: 'Shipped', color: 'var(--color-text-secondary)', marker: '✓' },
  next: { label: 'Up next', color: 'var(--color-text-secondary)', marker: '○' },
  exploring: { label: 'Exploring', color: 'var(--color-text-tertiary, var(--color-text-secondary))', marker: '◇' },
};
```

- [ ] **Step 2: Make each roadmap item a compact semantic milestone**

Render every item as an `<li>` with a desktop date column, an `aria-hidden` marker attached to the shared rail, and an unboxed content column. Apply a subtle accent background only when `item.status === 'building'`. Render evidence as a single supporting line joined with ` · `:

```tsx
{item.evidence && (
  <Text type="supporting" color="secondary">{item.evidence.join(' · ')}</Text>
)}
```

Keep the written status label visible next to the date so color and marker shape are never the only status signal.

- [ ] **Step 3: Reduce the page to navigation, introduction, and timeline**

Keep the existing public navigation callbacks but remove its pricing action, leaving the Vitrine home action and Browse action. Replace the hero with a left-aligned introduction:

```tsx
<header className="bip-intro">
  <Text type="supporting" color="secondary">ASTRYX ROADMAP</Text>
  <Heading level={1}>Build in public</Heading>
  <Text type="body" color="secondary">
    Follow what Astryx has shipped, what we are building now, and what comes next.
  </Text>
  <Text type="supporting" color="secondary">Last updated July 23, 2026</Text>
</header>
```

Render the roadmap directly after the introduction:

```tsx
<ol className="bip-timeline" aria-label="Astryx product timeline">
  {ROADMAP_ITEMS.map((item) => (
    <RoadmapItem key={`${item.status}-${item.title}`} item={item} />
  ))}
</ol>
```

Delete the snapshot section, roadmap marketing heading, closing call to action, decorative glow, and footer.

- [ ] **Step 4: Add compact responsive timeline CSS**

Use a 900px maximum page width. On desktop, each item uses `112px 24px minmax(0, 1fr)` columns for date, marker, and content. Draw one continuous one-pixel rail through the marker column. Give entries approximately 32px vertical separation and no card border or shadow.

Below 680px, collapse to `24px minmax(0, 1fr)`, hide the separate desktop date column, show the date inside the content column, and keep the shared rail aligned to the marker. Preserve comfortable 20px page gutters and ensure long descriptions wrap without horizontal overflow.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/BuildInPublic.test.tsx
```

Expected: all three Build in Public tests PASS.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/vitrine/BuildInPublic.tsx
git commit -m "feat: simplify build in public timeline"
```

### Task 3: Verify the integrated page

**Files:**
- Verify: `src/vitrine/BuildInPublic.tsx`
- Verify: `src/vitrine/BuildInPublic.test.tsx`

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
```

Expected: every test passes with no new warnings or failures.

- [ ] **Step 2: Build the production bundle**

Run:

```bash
npm run build
```

Expected: Vite exits successfully and emits the production bundle.

- [ ] **Step 3: Verify desktop layout in the browser**

Open `http://127.0.0.1:5173/build-in-public` at a desktop viewport. Confirm the screen contains only the minimal navigation, introduction, and a single continuous timeline; the current milestone is the only highlighted entry; and no content appears as a card stack.

- [ ] **Step 4: Verify mobile layout in the browser**

Set the viewport near 390px wide. Confirm dates move into the content column, the rail remains aligned, text does not overflow, and all milestones remain readable in chronological order.

- [ ] **Step 5: Review the final diff and integrate**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only the intended timeline files differ from the plan baseline. Merge the feature branch into `main` without staging or modifying the user's unrelated dirty files.
