# Unified App Detail Galleries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Screens, UI Elements, and Flows use one shared gallery section, toolbar, grid, spacing, and media-card language without changing their data-loading behavior.

**Architecture:** Add presentation-only `ReferenceGallerySection` and `ReferenceGalleryGrid` components. Keep fetching and interaction state in `ScreenDetail` and `FlowsPanel`, then adapt `FlowCard` to the existing `MediaGridCard` with an optional title overlay.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, Node test runner, React server rendering, Vite.

---

### Task 1: Shared gallery presentation boundary

**Files:**
- Create: `src/vitrine/components/ReferenceGallerySection.tsx`
- Create: `src/vitrine/ReferenceGallerySection.test.tsx`

- [ ] **Step 1: Write the failing shared-boundary test**

```tsx
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

test('renders the shared gallery section, toolbar, grid, and sentinel slots', async () => {
  assert.equal(existsSync('src/vitrine/components/ReferenceGallerySection.tsx'), true);
  const { ReferenceGalleryGrid, ReferenceGallerySection } = await import('./components/ReferenceGallerySection.tsx');
  const html = renderToStaticMarkup(
    <ReferenceGallerySection toolbar={<button>Filter</button>} sentinel={<div>More</div>}>
      <ReferenceGalleryGrid minCardWidth={220}><article>Card</article></ReferenceGalleryGrid>
    </ReferenceGallerySection>,
  );
  assert.match(html, /data-reference-gallery="section"/);
  assert.match(html, /data-reference-gallery="toolbar"/);
  assert.match(html, /data-reference-gallery="grid"/);
  assert.match(html, /minmax\\(220px,1fr\\)/);
  assert.match(html, /data-reference-gallery="sentinel"/);
});
```

- [ ] **Step 2: Run the test to verify red**

Run: `npx tsx --test src/vitrine/ReferenceGallerySection.test.tsx`

Expected: FAIL with `false !== true` because `ReferenceGallerySection.tsx` does not exist.

- [ ] **Step 3: Implement the presentation-only components**

```tsx
import type { ReactNode } from 'react';

export function ReferenceGalleryGrid({ minCardWidth, children }: { minCardWidth: number; children: ReactNode }) {
  return (
    <div data-reference-gallery="grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${minCardWidth}px,1fr))`, gap: 20 }}>
      {children}
    </div>
  );
}

export function ReferenceGallerySection({ toolbar, children, sentinel }: { toolbar?: ReactNode; children: ReactNode; sentinel?: ReactNode }) {
  return (
    <section data-reference-gallery="section" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toolbar && <div data-reference-gallery="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>{toolbar}</div>}
      <div data-reference-gallery="content">{children}</div>
      {sentinel && <div data-reference-gallery="sentinel">{sentinel}</div>}
    </section>
  );
}
```

- [ ] **Step 4: Run the focused test to verify green**

Run: `npx tsx --test src/vitrine/ReferenceGallerySection.test.tsx`

Expected: PASS, 1 test and 0 failures.

### Task 2: Shared media-card language for Flows

**Files:**
- Modify: `src/vitrine/components/MediaGridCard.tsx`
- Modify: `src/vitrine/components/FlowCard.tsx`
- Create: `src/vitrine/FlowCard.test.tsx`

- [ ] **Step 1: Write the failing FlowCard contract test**

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowCard } from './components/FlowCard.tsx';

test('renders a flow through the shared media-card title and badge contract', () => {
  const html = renderToStaticMarkup(<FlowCard flow={{
    id: 'login',
    title: 'Login',
    description: '',
    tags: [],
    steps: [{ label: 'Submit', evidence: [{ imageId: 1, imageUrl: '/flow.png', description: null }] }],
  }} onOpen={() => {}} />);
  assert.match(html, /aria-label="Open Login flow"/);
  assert.match(html, /src="\\/flow.png"/);
  assert.match(html, /data-media-grid-card-title="true"/);
  assert.match(html, />Login</);
  assert.match(html, />1 step</);
});
```

- [ ] **Step 2: Run the test to verify red**

Run: `npx tsx --test src/vitrine/FlowCard.test.tsx`

Expected: FAIL because `MediaGridCard` has no title hook.

- [ ] **Step 3: Add an optional `title` to `MediaGridCard`**

Change `url` to `url?: string`, add `title?: string` to `MediaGridCardProps`, and read both in the function arguments. Treat `!url` like `mediaFailed` so missing evidence uses the existing `Preview unavailable` fallback. Render:

```tsx
{title && (
  <div data-media-grid-card-title="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, padding: '28px 10px 10px', background: 'linear-gradient(to top, rgba(0,0,0,.72), transparent)', color: '#fff', fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>
    {title}
  </div>
)}
```

Move the shared badge row to `top: 8`, `right: 8`, and `justifyContent: 'flex-end'` when a title is present; retain its current bottom placement when no title is supplied so Screens and UI Elements remain visually unchanged.

- [ ] **Step 4: Refactor `FlowCard` into a `MediaGridCard` adapter**

```tsx
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { MediaGridCard } from './MediaGridCard';

export function FlowCard({ flow, onOpen }: { flow: DesignFlow<EvidenceView>; onOpen: () => void }) {
  const thumb = flow.steps[0]?.evidence[0];
  return (
    <MediaGridCard
      label={`Open ${flow.title} flow`}
      kind="image"
      url={thumb?.imageUrl}
      title={flow.title}
      badges={[`${flow.steps.length} ${flow.steps.length === 1 ? 'step' : 'steps'}`]}
      onOpen={onOpen}
    />
  );
}
```

- [ ] **Step 5: Run focused media-card tests**

Run: `npx tsx --test src/vitrine/FlowCard.test.tsx src/vitrine/MediaPrimitives.test.tsx`

Expected: PASS with 0 failures and unchanged existing media behavior.

### Task 3: Integrate the shared section into all three tabs

**Files:**
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`

- [ ] **Step 1: Write failing integration assertions**

In `src/vitrine/ScreenDetail.test.tsx`, assert the Screens and UI Elements server-rendered states contain `data-reference-gallery="section"` and `data-reference-gallery="grid"`.

In `src/vitrine/components/FlowsPanel.test.tsx`, extend the compact-card test with:

```tsx
assert.match(html, /data-reference-gallery="section"/);
assert.match(html, /data-reference-gallery="grid"/);
```

- [ ] **Step 2: Run the focused tests to verify red**

Run: `npx tsx --test src/vitrine/ScreenDetail.test.tsx src/vitrine/components/FlowsPanel.test.tsx`

Expected: FAIL because the three sections do not yet use the shared gallery components.

- [ ] **Step 3: Wrap Screens and UI Elements**

Import `ReferenceGalleryGrid` and `ReferenceGallerySection` in `ScreenDetail.tsx`.

Replace the inline evidence grid with:

```tsx
<ReferenceGallerySection
  toolbar={section === 'screens' ? screenFilterControls : undefined}
  sentinel={nextCursor ? <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>{loadingMore && <Spinner size="sm" />}</div> : undefined}
>
  <ReferenceGalleryGrid minCardWidth={section === 'elements' ? 200 : 280}>
    {(section === 'screens' ? filtered : items).map((screen, index) => (
      <ScreenGridCard key={screen.id} screen={screen} accent={app.accent} delay={Math.min(index * 0.04, 0.32)} onOpen={() => setLightbox({ index: screens.indexOf(screen) })} />
    ))}
  </ReferenceGalleryGrid>
</ReferenceGallerySection>
```

Rename the current `tabControls` JSX value to `screenFilterControls`, remove the `tabControls` prop from `ReferenceDetailShell`, and set:

```tsx
bodyPadding={section === 'screens' || section === 'elements' || section === 'flows' ? '32px 40px 72px' : '8px 40px 80px'}
```

- [ ] **Step 4: Wrap Flows**

Import the shared section and grid in `FlowsPanel.tsx`. Replace its outer layout with `ReferenceGallerySection`, pass search and FLOW.md controls through `toolbar`, render each category's cards through `ReferenceGalleryGrid minCardWidth={220}`, and pass the existing intersection target through `sentinel`.

Keep filtering before the visible limit, the 24-card batch size, category totals, and the observer dependencies unchanged.

- [ ] **Step 5: Run all focused tests**

Run: `npx tsx --test src/vitrine/ReferenceGallerySection.test.tsx src/vitrine/FlowCard.test.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/components/FlowsPanel.test.tsx`

Expected: PASS with 0 failures.

### Task 4: Full verification and delivery

**Files:**
- Verify all files from Tasks 1-3.

- [ ] **Step 1: Check formatting and scope**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; unrelated existing App gallery files remain unstaged.

- [ ] **Step 2: Run the complete suite**

Run: `npm test`

Expected: both test phases pass with 0 failures.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit 0; the existing large-chunk warning may remain.

- [ ] **Step 4: Run browser acceptance**

Open `http://127.0.0.1:5173/apps/15five` with the configured local admin session and verify:

- Screens, UI Elements, and Flows share the same body inset and gallery shell.
- Screens filters and Flow search/actions align in the same toolbar position.
- UI Elements loads 48 then 96 items at the sentinel.
- Flows renders 24 then 48 cards and full-dataset search finds `Uploading company logo`.

- [ ] **Step 5: Commit only scoped implementation files**

```bash
git add \
  docs/superpowers/plans/2026-07-23-unified-app-detail-galleries.md \
  src/vitrine/components/ReferenceGallerySection.tsx \
  src/vitrine/ReferenceGallerySection.test.tsx \
  src/vitrine/components/MediaGridCard.tsx \
  src/vitrine/components/FlowCard.tsx \
  src/vitrine/FlowCard.test.tsx \
  src/vitrine/components/ScreenDetail.tsx \
  src/vitrine/components/FlowsPanel.tsx \
  src/vitrine/ScreenDetail.test.tsx \
  src/vitrine/components/FlowsPanel.test.tsx
git commit -m "refactor: unify app detail galleries"
```

Expected: one commit containing only the unified gallery plan, implementation, and focused tests.
