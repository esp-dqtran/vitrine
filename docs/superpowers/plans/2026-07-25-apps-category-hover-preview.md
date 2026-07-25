# Apps Category Hover Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reveal a representative loaded App screenshot beside the pointer when a desktop user hovers an Apps taxonomy value.

**Architecture:** Add a pure selector in `appsDiscovery.ts` that maps a facet/platform pair to one loaded screen, then isolate all imperative GSAP work in a new `useCategoryHoverPreview` hook. `AppsDiscoveryPage` remains responsible for rendering and click-to-filter state; the hook owns only the decorative preview element, pointer coordinates, reveal/crossfade tweens, responsive activation, and cleanup.

**Tech Stack:** React 19, TypeScript, GSAP 3.15, CSS, Node test runner, server-rendered React boundary tests.

---

## File Structure

- Modify `src/vitrine/appsDiscovery.ts`: add deterministic facet-to-screen preview selection.
- Create `src/vitrine/useCategoryHoverPreview.ts`: own GSAP setup, pointer motion, image swaps, reduced-motion behavior, and cleanup.
- Modify `src/vitrine/components/AppsDiscoveryPage.tsx`: compute preview metadata, attach pointer handlers, and render one decorative floating preview.
- Modify `src/vitrine/AppsDiscovery.test.tsx`: test selection, rendered integration, GSAP lifecycle boundary, and preview CSS.
- Modify `src/vitrine/styles.css`: position and contain the floating preview without changing taxonomy layout.

Do not stage or modify `scripts/login-wait.png`; it is unrelated user-owned work.

### Task 1: Deterministic Facet Preview Selection

**Files:**
- Modify: `src/vitrine/appsDiscovery.ts`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write failing selection tests**

Add the import:

```ts
import { filterAndSortApps, previewForAppsFacet } from './appsDiscovery.ts';
```

Add these tests after the existing filtering test:

```ts
test('selects the first loaded matching screen for an Apps facet preview', () => {
  const apps = [
    makeApp({
      id: 'wrong-platform',
      app: 'Wrong Platform',
      cat: 'Finance',
      platforms: ['ios'],
      screens: [{
        ...makeApp().screens[0]!,
        id: 2,
        platform: 'ios',
        url: '/ios-finance.png',
      }],
    }),
    makeApp({
      id: 'finance',
      app: 'Finance Web',
      cat: 'Finance',
      screens: [{
        ...makeApp().screens[0]!,
        id: 3,
        platform: 'web',
        url: '/finance-full.png',
        thumbnailUrl: '/finance-thumb.png',
      }],
    }),
  ];

  assert.deepEqual(
    previewForAppsFacet(apps, { group: 'categories', value: 'Finance' }, 'web'),
    {
      app: 'Finance Web',
      screenType: 'Dashboard',
      url: '/finance-thumb.png',
    },
  );
});

test('returns no Apps facet preview without a matching loaded screen', () => {
  assert.equal(
    previewForAppsFacet(
      [makeApp()],
      { group: 'screens', value: 'Signup' },
      'web',
    ),
    null,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because `previewForAppsFacet` is not exported.

- [ ] **Step 3: Add the minimal selector**

In `src/vitrine/appsDiscovery.ts`, add the following immediately after `screenFacetText`:

```ts
export interface AppsFacetPreview {
  app: string;
  screenType: string;
  url: string;
}

const screenMatchesFacet = (screen: Screen, facet: AppsFacet): boolean =>
  screenFacetText(screen, facet.group).includes(facet.value.toLowerCase());

export function previewForAppsFacet(
  apps: App[],
  facet: AppsFacet,
  platform: AppsPlatform,
): AppsFacetPreview | null {
  for (const app of apps) {
    const platformScreens = app.screens.filter((screen) => screen.platform === platform);
    if (platformScreens.length === 0) continue;
    if (facet.group === 'categories' && app.cat.toLowerCase() !== facet.value.toLowerCase()) continue;

    const screen = facet.group === 'categories'
      ? platformScreens[0]
      : platformScreens.find((candidate) => screenMatchesFacet(candidate, facet));
    if (!screen) continue;

    const url = screen.thumbnailUrl || screen.url;
    if (url) return { app: app.app, screenType: screen.type, url };
  }
  return null;
}
```

Keep `screenFacetText` private; both filtering and preview selection reuse it inside the same module.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: all Apps discovery tests PASS.

- [ ] **Step 5: Commit the selector**

```bash
git add src/vitrine/appsDiscovery.ts src/vitrine/AppsDiscovery.test.tsx
git commit -m "feat: select Apps category hover previews"
```

### Task 2: Isolated GSAP Hover Motion

**Files:**
- Create: `src/vitrine/useCategoryHoverPreview.ts`
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write the failing GSAP lifecycle boundary test**

Add this test:

```ts
test('scopes Apps category hover motion to fine pointers with GSAP cleanup', async () => {
  const source = await readFile(new URL('./useCategoryHoverPreview.ts', import.meta.url), 'utf8');

  assert.match(source, /gsap\.matchMedia\(\)/);
  assert.match(source, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(source, /\(prefers-reduced-motion: reduce\)/);
  assert.equal((source.match(/gsap\.quickTo\(/g) ?? []).length, 2);
  assert.equal((source.match(/\.tween\.kill\(\)/g) ?? []).length, 2);
  assert.match(source, /matchMedia\.revert\(\)/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL with `ENOENT` because `useCategoryHoverPreview.ts` does not exist.

- [ ] **Step 3: Create the focused GSAP hook**

Create `src/vitrine/useCategoryHoverPreview.ts`:

```ts
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { AppsFacetPreview } from './appsDiscovery.ts';

interface CategoryPreviewMotion {
  show: (preview: AppsFacetPreview, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

export function useCategoryHoverPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<CategoryPreviewMotion | null>(null);

  useLayoutEffect(() => {
    const element = previewRef.current;
    const image = element?.querySelector('img');
    if (!element || !image) return;

    const matchMedia = gsap.matchMedia();
    matchMedia.add(
      {
        finePointer: '(hover: hover) and (pointer: fine)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { finePointer, reduceMotion } = context.conditions as {
          finePointer: boolean;
          reduceMotion: boolean;
        };
        if (!finePointer) return;

        gsap.set(element, {
          autoAlpha: 0,
          scale: reduceMotion ? 1 : 0.92,
          xPercent: -50,
          yPercent: -50,
        });
        const duration = reduceMotion ? 0 : 0.35;
        const xTo = gsap.quickTo(element, 'x', { duration, ease: 'power3.out' });
        const yTo = gsap.quickTo(element, 'y', { duration, ease: 'power3.out' });
        let imageTween: gsap.core.Tween | null = null;
        let visibilityTween: gsap.core.Tween | null = null;

        motionRef.current = {
          show: (preview, x, y) => {
            image.src = preview.url;
            image.dataset.app = preview.app;
            xTo(x + 28);
            yTo(y + 24);
            imageTween?.kill();
            visibilityTween?.kill();
            imageTween = gsap.fromTo(
              image,
              { autoAlpha: reduceMotion ? 1 : 0.3, scale: reduceMotion ? 1 : 1.03 },
              { autoAlpha: 1, scale: 1, duration: reduceMotion ? 0 : 0.18, overwrite: 'auto' },
            );
            visibilityTween = gsap.to(element, {
              autoAlpha: 1,
              scale: 1,
              duration: reduceMotion ? 0 : 0.2,
              overwrite: 'auto',
            });
          },
          move: (x, y) => {
            xTo(x + 28);
            yTo(y + 24);
          },
          hide: () => {
            visibilityTween?.kill();
            visibilityTween = gsap.to(element, {
              autoAlpha: 0,
              scale: reduceMotion ? 1 : 0.96,
              duration: reduceMotion ? 0 : 0.16,
              overwrite: 'auto',
            });
          },
        };

        return () => {
          xTo.tween.kill();
          yTo.tween.kill();
          imageTween?.kill();
          visibilityTween?.kill();
          motionRef.current = null;
        };
      },
    );

    return () => {
      motionRef.current = null;
      matchMedia.revert();
    };
  }, []);

  return {
    previewRef,
    showPreview: (preview: AppsFacetPreview, x: number, y: number) =>
      motionRef.current?.show(preview, x, y),
    movePreview: (x: number, y: number) => motionRef.current?.move(x, y),
    hidePreview: () => motionRef.current?.hide(),
  };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: the lifecycle boundary test PASS.

- [ ] **Step 5: Write the failing rendered integration test**

In the existing `renders the Mobbin Apps taxonomy...` test, add:

```ts
assert.match(html, /data-has-app-preview="true"/);
assert.match(html, /class="apps-discovery__hover-preview"/);
assert.match(html, /<img alt="" aria-hidden="true"\/>/);
```

- [ ] **Step 6: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because the taxonomy buttons and floating preview are not rendered.

- [ ] **Step 7: Integrate preview metadata and motion into AppsDiscoveryPage**

Update the React import:

```ts
import { useMemo, useState, type ReactNode, type RefObject } from 'react';
```

Update the Apps discovery import and add the hook:

```ts
import {
  APPS_DISCOVERY_FACETS,
  filterAndSortApps,
  previewForAppsFacet,
  type AppsFacet,
  type AppsPlatform,
  type AppsSort,
} from '../appsDiscovery.ts';
import { useCategoryHoverPreview } from '../useCategoryHoverPreview.ts';
```

Inside `AppsDiscoveryPage`, after the platform/sort state, add:

```ts
const { previewRef, showPreview, movePreview, hidePreview } = useCategoryHoverPreview();
```

Inside the taxonomy `group.values.map`, compute the preview:

```ts
const facet = { group: group.group, value } satisfies AppsFacet;
const preview = previewForAppsFacet(props.apps ?? [], facet, platform);
```

Update the taxonomy `Button`:

```tsx
<Button
  key={value}
  label={value}
  variant="ghost"
  size="sm"
  aria-pressed={selected}
  data-has-app-preview={preview ? 'true' : undefined}
  onPointerEnter={preview
    ? (event) => showPreview(preview, event.clientX, event.clientY)
    : undefined}
  onPointerMove={preview
    ? (event) => movePreview(event.clientX, event.clientY)
    : undefined}
  onPointerLeave={preview ? hidePreview : undefined}
  onClick={() => props.onFacetChange(selected ? null : facet)}
/>
```

Render one preview immediately after the taxonomy:

```tsx
<div ref={previewRef} className="apps-discovery__hover-preview" aria-hidden="true">
  <img alt="" aria-hidden="true" />
</div>
```

- [ ] **Step 8: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: all Apps discovery tests PASS.

- [ ] **Step 9: Commit the motion boundary**

```bash
git add src/vitrine/useCategoryHoverPreview.ts src/vitrine/components/AppsDiscoveryPage.tsx src/vitrine/AppsDiscovery.test.tsx
git commit -m "feat: animate Apps category hover previews"
```

### Task 3: Preview Styling and Full Verification

**Files:**
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write the failing CSS boundary test**

Add:

```ts
test('styles the Apps category hover preview as a non-interactive floating image', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-discovery__hover-preview\s*\{[\s\S]*position:\s*fixed;[\s\S]*pointer-events:\s*none;[\s\S]*visibility:\s*hidden;[\s\S]*will-change:\s*transform,\s*opacity/);
  assert.match(css, /\.apps-discovery__hover-preview img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(css, /@media \(hover:\s*none\),\s*\(pointer:\s*coarse\)[\s\S]*\.apps-discovery__hover-preview\s*\{[\s\S]*display:\s*none/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because `.apps-discovery__hover-preview` has no CSS.

- [ ] **Step 3: Add bounded preview styles**

Add after `.apps-discovery__taxonomy`:

```css
.apps-discovery__hover-preview {
  position: fixed;
  z-index: 40;
  top: 0;
  left: 0;
  width: clamp(190px, 18vw, 260px);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: var(--color-background-surface);
  box-shadow: 0 20px 54px rgb(0 0 0 / 28%);
  pointer-events: none;
  visibility: hidden;
  will-change: transform, opacity;
}

.apps-discovery__hover-preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  will-change: transform, opacity;
}

@media (hover: none), (pointer: coarse) {
  .apps-discovery__hover-preview {
    display: none;
  }
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: all Apps discovery tests PASS.

- [ ] **Step 5: Run the production build and whitespace checks**

Run:

```bash
npm run build
git diff --check
```

Expected: Vite build exits 0 and `git diff --check` prints nothing. The existing bundle-size advisory may remain; it is not introduced by this feature.

- [ ] **Step 6: Inspect the final scoped diff**

Run:

```bash
git diff -- \
  src/vitrine/appsDiscovery.ts \
  src/vitrine/useCategoryHoverPreview.ts \
  src/vitrine/components/AppsDiscoveryPage.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/styles.css
```

Confirm:

- No API, polling, database, router, or catalog-fetch code changed.
- Existing taxonomy click handlers remain present.
- The preview uses loaded thumbnail/full URLs only.
- Fine-pointer and reduced-motion conditions are present.
- Cleanup calls `matchMedia.revert()`.
- `scripts/login-wait.png` is absent from the diff.

- [ ] **Step 7: Commit the verified styling**

```bash
git add src/vitrine/styles.css src/vitrine/AppsDiscovery.test.tsx
git commit -m "style: finish Apps category hover preview"
```
