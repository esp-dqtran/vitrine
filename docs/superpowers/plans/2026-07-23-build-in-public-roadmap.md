# Build in Public Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed-out-accessible `/build-in-public` page that communicates Astryx's shipped, current, next, and exploratory roadmap through a responsive editorial timeline.

**Architecture:** Extend the existing client router with one public route, render the page in `Root` before authentication loading and sign-in gates, and keep the typed static roadmap data next to its only consumer. Reuse Astryx design-system primitives and the existing landing navigation callbacks; add no API, database table, CMS, or dependency.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, the existing history-based client router, Node test runner, React server rendering, Vite.

---

## File map

- Create `src/vitrine/BuildInPublic.tsx`: typed roadmap data, public header/footer, snapshot, timeline, and CTA.
- Create `src/vitrine/BuildInPublic.test.tsx`: server-rendered semantic/content tests plus source boundaries for typed static data.
- Modify `src/vitrine/router.ts`: add the `build-in-public` route and path mapping.
- Modify `src/vitrine/router.test.ts`: prove parsing and serialization.
- Modify `src/vitrine/main.tsx`: render the public page before auth loading and provide navigation callbacks.
- Modify `src/vitrine/Home.tsx`: expose the roadmap from desktop navigation, compact navigation, and footer.
- Modify `src/vitrine/Home.test.ts`: retain the completed-crawl stats assertions and add the landing navigation contract.

### Task 1: Add the public route contract

**Files:**
- Modify: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/router.ts`

- [ ] **Step 1: Write the failing route test**

Append:

```ts
test('round-trips the public build-in-public route', () => {
  assert.deepEqual(parseRoutePath('/build-in-public'), { name: 'build-in-public' });
  assert.deepEqual(parseRoutePath('/build-in-public/'), { name: 'build-in-public' });
  assert.equal(routeToPath({ name: 'build-in-public' }), '/build-in-public');
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/router.test.ts`

Expected: TypeScript or assertion failure because `build-in-public` is not part of `Route` and is parsed as `landing`.

- [ ] **Step 3: Implement the route**

Add the route member and mappings:

```ts
export type Route =
  | { name: 'landing' }
  | { name: 'build-in-public' }
  // existing routes remain unchanged
```

```ts
if (path === '/build-in-public') return { name: 'build-in-public' };
```

```ts
case 'build-in-public': return '/build-in-public';
```

- [ ] **Step 4: Run the route test and verify GREEN**

Run: `node --experimental-strip-types --test src/vitrine/router.test.ts`

Expected: all router tests pass.

- [ ] **Step 5: Commit the route slice**

```bash
git add src/vitrine/router.ts src/vitrine/router.test.ts
git commit -m "feat: route build in public roadmap"
```

### Task 2: Build the typed editorial timeline

**Files:**
- Create: `src/vitrine/BuildInPublic.test.tsx`
- Create: `src/vitrine/BuildInPublic.tsx`

- [ ] **Step 1: Write the failing page test**

Create a test that imports the missing component and renders it:

```tsx
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildInPublicPage } from './BuildInPublic.tsx';

test('renders the public roadmap as an accessible editorial timeline', () => {
  const html = renderToStaticMarkup(
    <BuildInPublicPage onHome={() => undefined} onBrowse={() => undefined} onPricing={() => undefined} />,
  );

  assert.match(html, /<h1[^>]*>Building the design intelligence workspace in the open<\/h1>/);
  assert.match(html, /Last updated July 23, 2026/);
  assert.match(html, /<ol/);
  assert.match(html, /Building now/);
  assert.match(html, /Shipped/);
  assert.match(html, /Up next/);
  assert.match(html, /Exploring/);
  assert.match(html, />465</);
  assert.match(html, />137K\+</);
  assert.match(html, />647</);
  assert.match(html, /Browse the library/);
});

test('keeps roadmap content typed, static, and independent from APIs', () => {
  const source = readFileSync(new URL('./BuildInPublic.tsx', import.meta.url), 'utf8');
  assert.match(source, /type RoadmapStatus = 'building' \| 'shipped' \| 'next' \| 'exploring'/);
  assert.match(source, /const ROADMAP_ITEMS: readonly RoadmapItemData\[\]/);
  assert.doesNotMatch(source, /fetch\(|useEffect|setInterval|setTimeout/);
});
```

- [ ] **Step 2: Run the page test and verify RED**

Run: `node --import tsx --test src/vitrine/BuildInPublic.test.tsx`

Expected: module-not-found failure for `./BuildInPublic.tsx`.

- [ ] **Step 3: Implement typed data and page composition**

Create `BuildInPublic.tsx` with these public contracts:

```tsx
type RoadmapStatus = 'building' | 'shipped' | 'next' | 'exploring';

interface RoadmapItemData {
  status: RoadmapStatus;
  date: string;
  title: string;
  description: string;
  evidence?: readonly string[];
}

const ROADMAP_ITEMS: readonly RoadmapItemData[] = [
  {
    status: 'building',
    date: 'July 2026',
    title: 'Product polish and production hardening',
    description: 'Improving reliability, responsive behavior, catalog presentation, and the path from evidence to a developer-ready artifact.',
    evidence: ['Current focus'],
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Flow-to-feature developer handoff',
    description: 'Turned observed product flows into reviewable feature documents with evidence navigation, revision state, export, and read-only sharing.',
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Design-system reconstruction',
    description: 'Made imported and reconstructed systems explorable through specimens, tokens, components, variants, usage guidance, and source material.',
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Full catalog crawl',
    description: 'Completed the current catalog pass and made its scale visible across apps, screens, and UI elements.',
    evidence: ['465 apps', '137K+ screens', '647 UI elements'],
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Evidence and catalog foundation',
    description: 'Established versioned Apps, Screens, UI Elements, Flows, protected media, search, collections, and evidence-aware publication boundaries.',
  },
  {
    status: 'next',
    date: 'Next',
    title: 'Public launch and feedback loop',
    description: 'Finish the public-facing experience, validate the production launch path, and establish a deliberate channel for learning from early users.',
  },
  {
    status: 'exploring',
    date: 'Later',
    title: 'Collaborative research and integrations',
    description: 'Explore shared evidence comparisons, decision trails, team handoff, and external integrations after the core public workflow is stable.',
  },
];

export function BuildInPublicPage(props: {
  onHome: () => void;
  onBrowse: () => void;
  onPricing: () => void;
}) {
  // Compose semantic header, main, snapshot, <ol>, RoadmapItem entries, CTA, and footer.
}
```

Use `Button`, `Divider`, `Heading`, and `Text` from `@astryxdesign/core`. Keep page styles in focused `CSSProperties` constants. Render each milestone as `<li>` with its visible status text; mark the decorative rail and dot `aria-hidden="true"`. Use `gridTemplateColumns: 'minmax(0, 1fr)'` on narrow-safe containers and `flexWrap` on action/navigation rows so the page remains usable at 320 CSS pixels.

- [ ] **Step 4: Run the page test and verify GREEN**

Run: `node --import tsx --test src/vitrine/BuildInPublic.test.tsx`

Expected: both page tests pass.

- [ ] **Step 5: Commit the page slice**

```bash
git add src/vitrine/BuildInPublic.tsx src/vitrine/BuildInPublic.test.tsx
git commit -m "feat: add build in public timeline"
```

### Task 3: Expose the page from the public shell

**Files:**
- Modify: `src/vitrine/Home.test.ts`
- Modify: `src/vitrine/Home.tsx`
- Modify: `src/vitrine/main.tsx`
- Test: `src/vitrine/BuildInPublic.test.tsx`

- [ ] **Step 1: Write failing public-shell boundary tests**

Extend `Home.test.ts`:

```ts
test('exposes Build in public from every landing navigation mode', async () => {
  const source = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
  assert.match(source, /onBuildInPublic: \(\) => void/);
  assert.equal((source.match(/label: 'Build in public'/g) ?? []).length, 1);
  assert.equal((source.match(/label="Build in public"/g) ?? []).length, 2);
});
```

Extend `BuildInPublic.test.tsx` with a source boundary:

```tsx
test('renders the roadmap before authentication gates', () => {
  const source = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf("route.name === 'build-in-public'") < source.indexOf('if (loading)'));
  assert.match(source, /<BuildInPublicPage/);
});
```

- [ ] **Step 2: Run the shell tests and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/Home.test.ts && node --import tsx --test src/vitrine/BuildInPublic.test.tsx`

Expected: assertions fail because the new callback, navigation labels, and `Root` branch are absent.

- [ ] **Step 3: Wire landing navigation**

Change the Home signature:

```tsx
export function Home({ onBrowse, onPricing, onBuildInPublic, onLogin }: {
  onBrowse: () => void;
  onPricing: () => void;
  onBuildInPublic: () => void;
  onLogin: () => void;
})
```

Add `Build in public` once to compact dropdown items, once to desktop navigation, and once to the footer. Keep Browse, Pricing, Log in, and Sign in behavior unchanged.

- [ ] **Step 4: Render the public route before authentication**

In `main.tsx`, import the page and define route actions:

```tsx
import { BuildInPublicPage } from './BuildInPublic';

const goHome = () => navigate({ name: 'landing' });
const goBuildInPublic = () => navigate({ name: 'build-in-public' });
```

Inside `Root`, before `if (loading)`, add:

```tsx
if (route.name === 'build-in-public') {
  return <BuildInPublicPage onHome={goHome} onBrowse={user ? goApps : goSignIn} onPricing={goPricing} />;
}
```

Pass `onBuildInPublic={goBuildInPublic}` to `Home`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/vitrine/router.test.ts src/vitrine/Home.test.ts
node --import tsx --test src/vitrine/BuildInPublic.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit the public-shell integration**

```bash
git add src/vitrine/Home.tsx src/vitrine/Home.test.ts src/vitrine/main.tsx
git commit -m "feat: expose public roadmap"
```

### Task 4: Verify behavior, accessibility, and responsive layout

**Files:**
- Modify only if verification exposes an issue: `src/vitrine/BuildInPublic.tsx`, `src/vitrine/BuildInPublic.test.tsx`, `src/vitrine/Home.tsx`, `src/vitrine/Home.test.ts`, `src/vitrine/main.tsx`, `src/vitrine/router.ts`, `src/vitrine/router.test.ts`

- [ ] **Step 1: Run whitespace and focused verification**

Run:

```bash
git diff --check
node --experimental-strip-types --test src/vitrine/router.test.ts src/vitrine/Home.test.ts
node --import tsx --test src/vitrine/BuildInPublic.test.tsx
```

Expected: no whitespace errors and all focused tests pass.

- [ ] **Step 2: Run the full automated suite**

Run: `npm test`

Expected: the complete backend, API, worker, and Vitrine test suite passes.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite succeeds. The existing main-chunk size warning is allowed; no new warning or error is introduced by this page.

- [ ] **Step 4: Verify in the signed-out browser**

Run the Vite app, open `http://127.0.0.1:5173/build-in-public`, and verify:

- the route renders without authentication;
- header and footer navigation work;
- browser back/forward preserves the route;
- all four status labels and all three snapshot metrics are visible;
- the ordered timeline has no horizontal overflow at desktop and 320-pixel widths;
- the page remains legible in light and dark themes.

- [ ] **Step 5: Commit verification fixes if needed**

If browser or automated verification required changes:

```bash
git add src/vitrine/BuildInPublic.tsx src/vitrine/BuildInPublic.test.tsx src/vitrine/Home.tsx src/vitrine/Home.test.ts src/vitrine/main.tsx src/vitrine/router.ts src/vitrine/router.test.ts
git commit -m "fix: polish public roadmap experience"
```

If no files changed, do not create an empty commit.
