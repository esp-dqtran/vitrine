# Sign-in Showcase Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the desktop sign-in showcase from real catalog screenshots and app icons without cropping, while suppressing only `Unclassified` type badges.

**Architecture:** Keep the existing public `/api/catalog` hook, carousel state, and animation. Add small pure rendering and mapping seams inside `SignIn.tsx` so icon propagation, image fitting, and type-label filtering can be tested without mocking React effects or network requests.

**Tech Stack:** React 19, TypeScript, server-rendered component tests with `node:test` and `react-dom/server`, Vite.

---

## File map

- Modify `src/vitrine/SignIn.tsx`: retain `iconUrl` in showcase slides, render real app icons, contain screenshots, and suppress unclassified badges.
- Modify `src/vitrine/SignIn.test.tsx`: add focused regression coverage for the real-data mapper and showcase renderers.
- No API, database, CSS, shared card, or catalog-hook files change.

### Task 1: Add failing showcase real-data tests

**Files:**

- Modify: `src/vitrine/SignIn.test.tsx`
- Test: `src/vitrine/SignIn.test.tsx`

- [ ] **Step 1: Import the focused showcase seams**

Replace the existing `SignIn.tsx` import with:

```tsx
import {
  AppPill,
  ReferralInviteNotice,
  SignIn,
  SlidePlaceholder,
  resolveReferralInvite,
  showcaseTypeLabel,
  toShowcaseSlide,
} from "./SignIn.tsx";
```

- [ ] **Step 2: Add mapper and rendering regressions**

Add these tests after the main page-rendering test:

```tsx
test("maps real catalog identity into a showcase slide", () => {
  const slide = toShowcaseSlide({
    id: "linear",
    name: "Linear",
    accent: "#5e6ad2",
    category: "Productivity",
    iconUrl: "/icons/linear.svg",
    screens: [{ url: "/api/preview-media/linear/1", type: "Dashboard" }],
  });

  assert.deepEqual(slide, {
    id: "linear",
    app: "Linear",
    accent: "#5e6ad2",
    type: "Dashboard",
    image: "/api/preview-media/linear/1",
    iconUrl: "/icons/linear.svg",
  });
});

test("renders the full showcase image and the real app icon", () => {
  const slide = {
    id: "linear",
    app: "Linear",
    accent: "#5e6ad2",
    type: "Dashboard",
    image: "/api/preview-media/linear/1",
    iconUrl: "/icons/linear.svg",
  };

  const preview = renderToStaticMarkup(<SlidePlaceholder {...slide} />);
  const pill = renderToStaticMarkup(<AppPill slide={slide} />);

  assert.match(preview, /object-fit:contain/);
  assert.match(pill, /src="\/icons\/linear\.svg"/);
  assert.match(pill, /alt=""/);
});

test("suppresses only unclassified showcase type labels", () => {
  assert.equal(showcaseTypeLabel("Unclassified"), null);
  assert.equal(showcaseTypeLabel(" unclassified "), null);
  assert.equal(showcaseTypeLabel("Dashboard"), "Dashboard");
  assert.equal(showcaseTypeLabel(" Sign in "), "Sign in");
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/SignIn.test.tsx
```

Expected: FAIL because `AppPill`, `SlidePlaceholder`,
`showcaseTypeLabel`, and `toShowcaseSlide` are not exported yet.

### Task 2: Implement real-data showcase rendering

**Files:**

- Modify: `src/vitrine/SignIn.tsx`
- Test: `src/vitrine/SignIn.test.tsx`

- [ ] **Step 1: Import the preview app type**

Change the catalog-preview import to:

```tsx
import { useCatalogPreview, type PreviewApp } from './useCatalogPreview';
```

- [ ] **Step 2: Extend slides and add pure mapping/filtering seams**

Replace the current `Slide` declaration and add the two helpers:

```tsx
export interface Slide {
  id: string;
  app: string;
  accent: string;
  type: string;
  image?: string;
  iconUrl?: string | null;
}

export function toShowcaseSlide(app: PreviewApp): Slide {
  return {
    id: app.id,
    app: app.name,
    accent: app.accent,
    type: app.screens[0].type,
    image: app.screens[0].url,
    iconUrl: app.iconUrl,
  };
}

export function showcaseTypeLabel(type: string): string | null {
  const label = type.trim();
  return !label || label.toLowerCase() === 'unclassified' ? null : label;
}
```

- [ ] **Step 3: Make the preview renderer testable and uncropped**

Export `SlidePlaceholder` and change its image fit:

```tsx
export function SlidePlaceholder({ accent, app, type, image }: Slide) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg,${accent}33,#101012 68%)` }} />
      {image ? (
        <img
          src={image}
          alt={`${app} — ${type}`}
          loading="lazy"
          decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          {app} {type.toLowerCase()}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Add the real-icon pill with the existing fallback**

Add this component near `SlidePlaceholder`:

```tsx
export function AppPill({ slide }: { slide: Slide }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 4px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.94)',
        animation: 'vtFadeUp .4s cubic-bezier(.16,1,.3,1) .15s both',
      }}
    >
      {slide.iconUrl ? (
        <img
          src={slide.iconUrl}
          alt=""
          loading="lazy"
          style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'contain' }}
        />
      ) : (
        <div style={{ width: 18, height: 18, borderRadius: 5, background: slide.accent }} />
      )}
      <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{slide.app}</span>
    </div>
  );
}
```

- [ ] **Step 5: Use the helpers in `Showcase`**

Replace the real-slide mapping:

```tsx
const slides: Slide[] = realApps && realApps.length
  ? realApps.slice(0, 5).map(toShowcaseSlide)
  : SHOWCASE;
```

After computing `active`, add:

```tsx
const activeTypeLabel = showcaseTypeLabel(active.type);
```

Replace the current bottom-left pill with:

```tsx
<AppPill key={'pill-' + index} slide={active} />
```

Replace the unconditional top-right badge with:

```tsx
{activeTypeLabel ? (
  <div key={'badge-' + index} style={{ position: 'absolute', top: 12, right: 12, zIndex: 4, animation: 'vtFadeUp .4s cubic-bezier(.16,1,.3,1) .15s both' }}>
    <span style={{ display: 'inline-block', padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)' }}>
      {activeTypeLabel}
    </span>
  </div>
) : null}
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/SignIn.test.tsx
```

Expected: all `SignIn.test.tsx` tests PASS.

### Task 3: Verify the narrow change

**Files:**

- Verify: `src/vitrine/SignIn.tsx`
- Verify: `src/vitrine/SignIn.test.tsx`

- [ ] **Step 1: Run the related catalog-preview tests**

Run:

```bash
npx tsx --test src/vitrine/useCatalogPreview.test.ts src/vitrine/SignIn.test.tsx
```

Expected: all related tests PASS with no warnings or errors.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite completes successfully and writes the production bundle.

- [ ] **Step 3: Check formatting and the scoped diff**

Run:

```bash
git diff --check -- src/vitrine/SignIn.tsx src/vitrine/SignIn.test.tsx
git diff -- src/vitrine/SignIn.tsx src/vitrine/SignIn.test.tsx
```

Expected: `git diff --check` prints nothing. The diff contains only the
showcase icon, image-fit, type-label, and regression-test changes alongside
the user's pre-existing sign-in edits.

- [ ] **Step 4: Leave changes uncommitted**

Do not stage, commit, or push. Astryx project rules require direct work on
`main` and prohibit automatic commit/push unless the user explicitly requests
it.
