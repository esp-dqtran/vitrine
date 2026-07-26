# Shared App Platform Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the Apps catalog Web/iOS/Android switcher in App detail and enlarge the App detail icon.

**Architecture:** Extract the inline Apps switcher into a controlled `AppsPlatformSwitcher` component. Keep platform state and side effects in each existing page, while the shared component owns ordering, accessibility, keyboard behavior, and the animated visual treatment.

**Tech Stack:** React, TypeScript, Vitrine Button, CSS, Node test runner

---

### Task 1: Define the shared switcher contract with a failing test

**Files:**
- Create: `src/vitrine/components/AppsPlatformSwitcher.test.tsx`
- Create: `src/vitrine/components/AppsPlatformSwitcher.tsx`

- [ ] **Step 1: Write the failing test**

Render a controlled switcher with `platforms={['web', 'ios']}` and assert that it renders Web and iOS as radio options, omits Android, and marks Web checked.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test src/vitrine/components/AppsPlatformSwitcher.test.tsx`

Expected: FAIL because `AppsPlatformSwitcher.tsx` does not exist.

- [ ] **Step 3: Write the minimal component**

Create a controlled component with:

```tsx
interface AppsPlatformSwitcherProps {
  value: Platform;
  platforms?: readonly Platform[];
  onChange: (platform: Platform) => void;
  ariaLabel?: string;
}
```

Order options as Web, iOS, Android, render radio semantics, set active-index/count CSS variables, and support ArrowLeft, ArrowRight, Home, and End.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test src/vitrine/components/AppsPlatformSwitcher.test.tsx`

Expected: PASS.

### Task 2: Reuse the component in Apps and App detail

**Files:**
- Modify: `src/vitrine/components/AppsDiscoveryPage.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Add failing reuse assertions**

Assert both consumer source files import and render `AppsPlatformSwitcher`; assert the detail render exposes `role="radiogroup"` and only metadata-supported platforms.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
npx tsx --test \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because both pages still render separate switcher markup.

- [ ] **Step 3: Replace both inline controls**

In Apps discovery, pass all three platforms and keep hover cleanup inside `onChange`. In App detail, pass `appPlatforms` and the existing `selectPlatform` callback. Remove detail-only platform tab refs and indicator markup.

- [ ] **Step 4: Run the focused tests**

Run the command from Step 2.

Expected: PASS.

### Task 3: Share the existing Apps visual treatment

**Files:**
- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Add a failing shared-style assertion**

Require `.apps-platform-switcher` to own the pill, animated indicator, fixed button sizing, active text color, and reduced-motion behavior.

- [ ] **Step 2: Run the Apps discovery test**

Run: `npx tsx --test src/vitrine/AppsDiscovery.test.tsx`

Expected: FAIL while CSS still targets `.apps-discovery__platform`.

- [ ] **Step 3: Move styles to the shared class**

Rename the Apps-only selectors to `.apps-platform-switcher`, use active-index/count CSS variables for one to three options, and preserve the current dimensions and easing.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx tsx --test \
  src/vitrine/components/AppsPlatformSwitcher.test.tsx \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/ScreenDetail.test.tsx
```

Expected: PASS.

### Task 4: Final verification

**Files:**
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Add and pass the App icon sizing test**

Require App detail icons to render at 120px on desktop and 80px below the existing 720px detail breakpoint, without changing Site icon sizing.

- [ ] **Step 2: Build the app**

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 3: Check patch hygiene**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 4: Verify the requested route**

Open `/apps/adobe-express/overview?platform=web&version=1`, confirm the detail switcher visually matches Apps, and switch between the supported platforms to verify content and URL updates.

No commit or push is included because this project requires an explicit user request for those actions.
