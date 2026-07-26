# App Card Screen-Reveal Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Apps discovery card’s current lift-only hover with a next-screen reveal that resets on pointer leave.

**Architecture:** `AppCard` will render the active preview and, when available, the next preview as two stable layers. CSS will own the pointer hover, focus, fine-pointer, and reduced-motion states, so leaving the card resets the visual state without mutating the active carousel index.

**Tech Stack:** React, TypeScript, CSS transitions, Node test runner, React server rendering, Vite.

**Project constraint:** Work directly on `main`. Do not create a worktree, commit, or push unless the user explicitly asks.

---

## File Map

- Create `src/vitrine/AppCard.test.tsx` for focused preview-layer rendering coverage.
- Modify `src/vitrine/components/AppCard.tsx` to calculate and render the next preview layer.
- Modify `src/vitrine/AppsDiscovery.test.tsx` to lock the hover, focus, pointer, and reduced-motion CSS boundaries.
- Modify `src/vitrine/styles.css` to implement the screen reveal.

### Task 1: Render Stable Active and Next Preview Layers

**Files:**
- Create: `src/vitrine/AppCard.test.tsx`
- Modify: `src/vitrine/components/AppCard.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `src/vitrine/AppCard.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppCard } from './components/AppCard.tsx';
import type { App, Screen } from './types.ts';

const screen = (id: number, url: string): Screen => ({
  id,
  type: 'Dashboard',
  productArea: 'Workspace',
  theme: 'light',
  visibleStates: [],
  platform: 'web',
  description: null,
  url,
});

const app = (screens: Screen[]): App => ({
  id: 'linear',
  app: 'Linear',
  cat: 'Productivity',
  accent: '#7957ff',
  totalScreens: screens.length,
  platforms: ['web'],
  analyzedScreens: screens.length,
  lastCapturedAt: '2026-07-25T00:00:00.000Z',
  iconUrl: null,
  description: 'Plan and build products',
  previewVideoUrl: null,
  screens,
});

test('renders active and next preview layers for a multi-screen App card', () => {
  const html = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/one.png'), screen(2, '/two.png')])} onOpen={() => undefined} />,
  );

  assert.match(html, /data-app-card-preview="active"/);
  assert.match(html, /data-app-card-preview="next"/);
  assert.match(html, /src="\/one\.png"/);
  assert.match(html, /src="\/two\.png"/);
  assert.match(html, />Next screen</);
});

test('keeps a single-screen App card free from an empty next layer', () => {
  const html = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/only.png')])} onOpen={() => undefined} />,
  );

  assert.match(html, /data-app-card-preview="active"/);
  assert.doesNotMatch(html, /data-app-card-preview="next"/);
  assert.match(html, />View screens</);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppCard.test.tsx
```

Expected: both tests fail because the preview data attributes, next layer, and dynamic overlay label do not exist.

- [ ] **Step 3: Implement the minimal preview-layer structure**

In `src/vitrine/components/AppCard.tsx`, calculate the next screen without changing `index`:

```tsx
const active = screens[index];
const next = screens.length > 1 ? screens[(index + 1) % screens.length] : undefined;
```

Replace the current preview and overlay with:

```tsx
<span
  className="app-discovery-card__preview app-discovery-card__preview--active"
  data-app-card-preview="active"
>
  <PlaceholderImage src={active?.thumbnailUrl ?? active?.url} accent={app.accent} />
</span>
{next ? (
  <span
    className="app-discovery-card__preview app-discovery-card__preview--next"
    data-app-card-preview="next"
    aria-hidden="true"
  >
    <PlaceholderImage src={next.thumbnailUrl ?? next.url} accent={app.accent} />
  </span>
) : null}
```

Render the overlay label as:

```tsx
<span className="app-discovery-card__overlay">
  {next ? 'Next screen' : 'View screens'}
</span>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppCard.test.tsx
```

Expected: 2 tests pass.

### Task 2: Implement the Fine-Pointer Screen-Reveal Motion

**Files:**
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write the failing CSS boundary test**

Add to `src/vitrine/AppsDiscovery.test.tsx`:

```tsx
test('reveals the next App screen on fine-pointer hover with reduced-motion support', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.app-discovery-card__preview\s*\{[\s\S]*transition:\s*transform 420ms cubic-bezier\(\.16,\s*1,\s*\.3,\s*1\)/);
  assert.match(css, /\.app-discovery-card__preview--next\s*\{[\s\S]*transform:\s*translateX\(110%\)/);
  assert.match(css, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.app-discovery-card:hover \.app-discovery-card__media\s*\{[\s\S]*translateY\(-4px\)/);
  assert.match(css, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.app-discovery-card:hover \.app-discovery-card__preview--active\s*\{[\s\S]*scale\(\.98\)/);
  assert.match(css, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.app-discovery-card:hover \.app-discovery-card__preview--next\s*\{[\s\S]*translateX\(0\)/);
  assert.match(css, /\.app-discovery-card:focus-visible \.app-discovery-card__overlay\s*\{[\s\S]*opacity:\s*1/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.app-discovery-card__preview[\s\S]*transition-duration:\s*0\.01ms/);
});
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: the new test fails because the reveal layer and media-query rules are absent.

- [ ] **Step 3: Implement the base preview layers**

Update the existing preview rule in `src/vitrine/styles.css`:

```css
.app-discovery-card__preview {
  position: absolute;
  inset: 22px;
  display: block;
  overflow: hidden;
  border-radius: 18px;
  background: var(--color-background-muted);
  box-shadow: 0 18px 42px rgb(0 0 0 / 24%);
  transition: transform 420ms cubic-bezier(.16, 1, .3, 1);
  will-change: transform;
}

.app-discovery-card__preview--active {
  z-index: 1;
  transform: scale(1);
}

.app-discovery-card__preview--next {
  z-index: 2;
  transform: translateX(110%);
}
```

- [ ] **Step 4: Implement hover, focus, and reduced-motion states**

Replace the global media lift hover with fine-pointer rules:

```css
.app-discovery-card__media {
  /* retain existing declarations */
  transition:
    transform 420ms cubic-bezier(.16, 1, .3, 1),
    box-shadow 420ms cubic-bezier(.16, 1, .3, 1);
}

@media (hover: hover) and (pointer: fine) {
  .app-discovery-card:hover .app-discovery-card__media {
    transform: translateY(-4px);
    box-shadow: 0 22px 50px rgb(0 0 0 / 28%);
  }

  .app-discovery-card:hover .app-discovery-card__preview--active {
    transform: scale(.98);
  }

  .app-discovery-card:hover .app-discovery-card__preview--next {
    transform: translateX(0);
  }

  .app-discovery-card:hover .app-discovery-card__overlay {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-discovery-card:focus-visible .app-discovery-card__overlay {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .app-discovery-card__media,
  .app-discovery-card__preview,
  .app-discovery-card__overlay {
    transition-duration: 0.01ms;
  }
}
```

Leaving hover naturally restores the base transforms, so the active `index` remains unchanged.

- [ ] **Step 5: Run the focused Apps tests and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppCard.test.tsx src/vitrine/AppsDiscovery.test.tsx
```

Expected: all App card and Apps discovery tests pass.

### Task 3: Regression Verification

**Files:**
- Verify only; no additional source changes expected.

- [ ] **Step 1: Run the relevant public catalog suite**

Run:

```bash
npx tsx --test \
  src/vitrine/AppCard.test.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/Sites.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite finishes successfully. The existing chunk-size advisory may remain.

- [ ] **Step 3: Validate the workspace diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Preserve all unrelated existing changes, including `scripts/login-wait.png`.

- [ ] **Step 4: Report completion without committing**

Summarize the implemented interaction, test totals, build result, and remaining uncommitted files. Commit or push only after a separate explicit user request.

### Task 4: Show the Complete Screenshot at a Smaller Size

**Files:**
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Add the failing CSS boundary assertions**

Extend the App-card reveal test to require a 32px preview inset and contained images:

```tsx
assert.match(css, /\.app-discovery-card__preview\s*\{[\s\S]*inset:\s*32px/);
assert.match(css, /\.app-discovery-card__preview img\s*\{[\s\S]*object-fit:\s*contain\s*!important/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: the reveal test fails because the preview still uses a 22px inset and `object-fit: cover`.

- [ ] **Step 3: Apply the minimal CSS change**

Update `src/vitrine/styles.css`:

```css
.app-discovery-card__preview {
  inset: 32px;
}

.app-discovery-card__preview img {
  object-fit: contain !important;
}
```

Keep the existing media aspect ratio, preview layers, and hover transforms unchanged.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx tsx --test src/vitrine/AppCard.test.tsx src/vitrine/AppsDiscovery.test.tsx
npm run build
git diff --check
```

Expected: all focused tests pass, Vite builds successfully, and the diff has no whitespace errors.
