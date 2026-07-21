# Mobbin-Style Site Video Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mobbin-style, visibility-controlled video previews to Site section cards without changing App cards or Site image cards.

**Architecture:** Introduce a focused `SiteSectionVideoCard` component that owns video presentation, hover/focus state, media failure state, and viewport playback. `SiteVersionPage` selects it only for Site video sections and leaves image sections on the shared `MediaGridCard` path; the existing inspector callback remains the sole navigation behavior.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, `IntersectionObserver`, Node test runner, React server rendering, Vite, Chrome.

---

## File Map

- Create `src/vitrine/components/SiteSectionVideoCard.tsx`: Site-only video card and visibility playback binding.
- Create `src/vitrine/SiteSectionVideoCard.test.tsx`: focused playback binding tests that run without a browser DOM.
- Modify `src/vitrine/components/SiteVersionPage.tsx`: route only Site video sections through the new card.
- Modify `src/vitrine/Sites.test.tsx`: lock the Site video markup and preserve the image/shared-card path.
- Create `design-qa.md`: record the same-state Mobbin/Astryx Chrome comparison and final gate result.

### Task 1: Add the Site-only video presentation

**Files:**
- Modify: `src/vitrine/Sites.test.tsx`
- Create: `src/vitrine/components/SiteSectionVideoCard.tsx`
- Modify: `src/vitrine/components/SiteVersionPage.tsx:1-245`

- [ ] **Step 1: Write the failing integration test**

Render `SiteVersionView` with `section="sections"` and assert that the video section has Mobbin-style static behavior while the image remains on the shared path:

```tsx
test('renders Site videos as Mobbin-style section actions without changing image cards', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="sections" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
  );
  const video = html.match(/<video[^>]+src="\/video"[^>]*>/)?.[0] ?? '';
  assert.match(video, /poster="\/poster"/);
  assert.match(video, /loop=""/);
  assert.match(video, /playsinline=""/);
  assert.doesNotMatch(video, /controls=/);
  assert.match(html, /View section/);
  assert.match(html, /data-site-section-video-card="true"/);
  assert.match(html, /<img[^>]+src="\/image"/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx
```

Expected: FAIL because the current shared video card still renders `controls` and has no `View section` action or Site-only marker.

- [ ] **Step 3: Add the minimal Site video card and integration**

Create `SiteSectionVideoCard` with this public interface:

```tsx
interface SiteSectionVideoCardProps {
  label: string;
  url: string;
  posterUrl?: string;
  badges?: string[];
  delay?: number;
  onOpen: () => void;
}
```

Render an outer grid containing an 8 px-radius, 16:10 `ClickableCard` media frame and a separate badge row. The `<video>` uses `muted`, `loop`, `playsInline`, `preload="metadata"`, `poster`, `objectFit: 'contain'`, and `pointerEvents: 'none'`; omit `controls`. Hover or focus displays an absolute `rgba(0,0,0,.1)` veil and a 44 px white `View section` pill inset 16 px, transitioning opacity and `translateY(16px)` over 300 ms. Do not add transform lift, media scaling, selection, Save, or overflow controls.

In `SectionsPanel`, choose the component explicitly:

```tsx
const badges = [...patterns.slice(0, 2), item.mediaKind === 'image' ? 'Image' : 'Video'];
return item.mediaKind === 'video'
  ? <SiteSectionVideoCard key={item.id} label={`Open ${patterns[0]} from ${page.title}`} url={item.mediaUrl} posterUrl={item.posterUrl} badges={badges} delay={delay} onOpen={() => onOpen(visibleIndex)} />
  : <MediaGridCard key={item.id} label={`Open ${patterns[0]} from ${page.title}`} kind="image" url={item.mediaUrl} badges={badges} delay={delay} onOpen={() => onOpen(visibleIndex)} />;
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx
```

Expected: all `Sites.test.tsx` tests PASS.

- [ ] **Step 5: Commit the static presentation slice**

```bash
git add src/vitrine/Sites.test.tsx src/vitrine/components/SiteSectionVideoCard.tsx src/vitrine/components/SiteVersionPage.tsx
git commit -m "feat: add Site video section card"
```

### Task 2: Add visibility-controlled playback

**Files:**
- Create: `src/vitrine/SiteSectionVideoCard.test.tsx`
- Modify: `src/vitrine/components/SiteSectionVideoCard.tsx`

- [ ] **Step 1: Write the failing playback test**

Use a dynamic import so the test fails as an assertion until the playback export exists, then exercise the callback with plain test doubles:

```tsx
test('plays at 35% visibility, pauses below it, and disconnects on cleanup', async () => {
  const module = await import('./components/SiteSectionVideoCard.tsx');
  assert.equal(typeof module.observeSiteVideoPlayback, 'function');

  let callback: IntersectionObserverCallback | undefined;
  let playCalls = 0;
  let pauseCalls = 0;
  let disconnectCalls = 0;
  const video = {
    play: async () => { playCalls += 1; },
    pause: () => { pauseCalls += 1; },
  };
  const target = {} as Element;
  const cleanup = module.observeSiteVideoPlayback(video, target, (next, options) => {
    callback = next;
    assert.deepEqual(options, { threshold: 0.35 });
    return { observe: (value) => assert.equal(value, target), disconnect: () => { disconnectCalls += 1; } };
  });

  callback?.([{ isIntersecting: true, intersectionRatio: 0.35 } as IntersectionObserverEntry], {} as IntersectionObserver);
  await Promise.resolve();
  assert.equal(playCalls, 1);
  callback?.([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver);
  assert.equal(pauseCalls, 1);
  cleanup();
  assert.equal(disconnectCalls, 1);
});
```

Add a second test that proves a rejected autoplay promise is consumed without blocking cleanup:

```tsx
test('consumes rejected autoplay without blocking cleanup', async () => {
  const { observeSiteVideoPlayback } = await import('./components/SiteSectionVideoCard.tsx');
  let callback: IntersectionObserverCallback | undefined;
  let disconnectCalls = 0;
  const cleanup = observeSiteVideoPlayback(
    { play: async () => { throw new Error('autoplay denied'); }, pause: () => undefined },
    {} as Element,
    (next) => {
      callback = next;
      return { observe: () => undefined, disconnect: () => { disconnectCalls += 1; } };
    },
  );

  callback?.([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver);
  await new Promise<void>((resolve) => setImmediate(resolve));
  cleanup();
  assert.equal(disconnectCalls, 1);
});
```

- [ ] **Step 2: Run the playback test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/SiteSectionVideoCard.test.tsx
```

Expected: FAIL at `typeof module.observeSiteVideoPlayback` because the export does not exist.

- [ ] **Step 3: Implement the playback binding and component effect**

Export a factory-injected helper with a fixed threshold:

```tsx
export const SITE_VIDEO_VISIBILITY_THRESHOLD = 0.35;

export function observeSiteVideoPlayback(
  video: Pick<HTMLVideoElement, 'play' | 'pause'>,
  target: Element,
  createObserver: VisibilityObserverFactory = (callback, options) => new IntersectionObserver(callback, options),
) {
  const observer = createObserver((entries) => {
    const entry = entries[0];
    if (entry?.isIntersecting && entry.intersectionRatio >= SITE_VIDEO_VISIBILITY_THRESHOLD) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, { threshold: SITE_VIDEO_VISIBILITY_THRESHOLD });
  observer.observe(target);
  return () => observer.disconnect();
}
```

Attach it in `useEffect` through a video ref. When `IntersectionObserver` is unavailable, leave the video paused and return no cleanup. Disconnect on unmount.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/SiteSectionVideoCard.test.tsx src/vitrine/Sites.test.tsx
```

Expected: all focused tests PASS with no unhandled rejection.

- [ ] **Step 5: Commit visibility playback**

```bash
git add src/vitrine/SiteSectionVideoCard.test.tsx src/vitrine/components/SiteSectionVideoCard.tsx
git commit -m "feat: autoplay visible Site section videos"
```

### Task 3: Regression and visual verification

**Files:**
- Create: `design-qa.md`
- Modify only if QA exposes a mismatch: `src/vitrine/components/SiteSectionVideoCard.tsx`

- [ ] **Step 1: Run automated verification**

```bash
npm test
npm run build
git diff --check
```

Expected: complete test suite PASS, Vite production build succeeds, and no whitespace errors are reported.

- [ ] **Step 2: Run the app and inspect in the selected Chrome browser**

Open the authenticated Site detail Sections tab at the same desktop viewport used for Mobbin. Confirm visible videos play muted, off-screen videos pause, the media has no native controls, and clicking `View section` opens `SiteSectionInspector`.

- [ ] **Step 3: Perform blocking visual comparison**

Capture Astryx in both default and hover states. Compare each same-state capture side by side with:

```text
mobbin-video-card/02-mobbin-video-card-default.png
mobbin-video-card/03-mobbin-video-card-hover.png
```

Check the 16:10 frame, 8 px radius, `contain` fit, 10% veil, 44 px pill, 16 px inset, 300 ms transition end state, and absence of hover lift. Fix every P0/P1/P2 mismatch and repeat the comparison.

- [ ] **Step 4: Record the design QA gate**

Create `design-qa.md` containing the reference and Astryx capture paths, interaction checks, issue severities, fixes, and the exact line:

```text
final result: passed
```

If authentication or capture prevents the comparison, write `final result: blocked` and report that blocker instead of claiming completion.

- [ ] **Step 5: Commit the verified QA artifact and any visual fixes**

```bash
git add design-qa.md src/vitrine/components/SiteSectionVideoCard.tsx
git commit -m "test: verify Site video card design"
```
