# Hide Version Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Capture versions panel from the app-detail UI without deleting or changing versioning data and API behavior.

**Architecture:** `ScreenDetail` is the only app-detail render seam for `VersionPanel`. Remove that import and JSX block while leaving `useAppSectionData` and its version-aware loading unchanged.

**Tech Stack:** React, TypeScript, Node test runner

---

### Task 1: Remove the app-detail VersionPanel surface

**Files:**
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`

- [ ] **Step 1: Write the failing test**

Add a source-boundary assertion proving `ScreenDetail.tsx` neither imports nor renders `VersionPanel`:

```tsx
test('does not expose capture version controls in app detail', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import \{ VersionPanel \}/);
  assert.doesNotMatch(source, /<VersionPanel/);
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx
```

Expected: the new test fails because `ScreenDetail.tsx` still imports and renders `VersionPanel`.

- [ ] **Step 3: Implement the minimal removal**

Delete the `VersionPanel` import and the conditional `<VersionPanel ... />` block from `ScreenDetail.tsx`. Do not change `useAppSectionData`, its version resolution, or the version APIs.

- [ ] **Step 4: Verify green and repository health**

Run:

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx
npx tsc --noEmit
git diff --check
```

Expected: all focused tests pass, TypeScript exits successfully, and the diff has no whitespace errors.
