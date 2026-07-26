# Uncropped Screen Hover Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the complete original screenshot in a popover fitted to its natural aspect ratio when hovering an Apps Screen taxonomy option.

**Architecture:** Keep the existing facet-preview API and hover controller. Select the full stored object only for `screens`, then size only `data-kind="screen"` previews from the loaded image's natural dimensions within compact maximum bounds.

**Tech Stack:** TypeScript, React, PostgreSQL query generation, CSS, Node test runner.

---

### Task 1: Serve original Screen preview media

**Files:**
- Modify: `src/objectStoreDb.ts`
- Test: `src/objectStoreDb.test.ts`

- [ ] **Step 1: Write the failing test**

Add a focused assertion that calls `publishedFacetPreviewObject` with
`group: "screens"` and verifies the generated stored-object join is
`so.object_key = i.object_key`, while the existing Elements test continues to
verify `COALESCE(i.thumbnail_object_key, i.object_key)`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/objectStoreDb.test.ts
```

Expected: the Screen assertion fails because every facet currently selects the
thumbnail join.

- [ ] **Step 3: Implement the minimal query change**

In `publishedFacetPreviewObject`, choose the object variant from the facet:

```ts
const variant = input.group === "screens" ? "full" : "thumb";
```

Use `imageObjectJoin(variant)` in the stored-object join. Do not change rank,
authorization, or taxonomy matching.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/objectStoreDb.test.ts
```

Expected: all object-store database tests pass.

### Task 2: Fit Screen popovers to their loaded image

**Files:**
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write the failing style boundary test**

Read `styles.css` in the existing Apps discovery style test and assert:

```ts
assert.match(css, /\.apps-discovery__hover-preview\[data-kind='screen'\]\s*\{[\s\S]*max-width:\s*240px[\s\S]*max-height:\s*280px/);
assert.match(css, /\.apps-discovery__hover-preview\[data-kind='screen'\]\s+img\s*\{[\s\S]*object-fit:\s*contain/);
```

Keep the current generic `object-fit: cover` assertion or boundary so Components
and Flows remain unchanged.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: the new Screen-specific selectors are absent.

- [ ] **Step 3: Add the Screen-only CSS**

Add a pure `fitScreenPreviewSize(width, height)` helper that preserves the
image aspect ratio within `240 × 280`, then apply the returned inline dimensions
when the Screen image is loaded. Keep these CSS bounds:

```css
.apps-discovery__hover-preview[data-kind='screen'] {
  width: 240px;
  height: 280px;
  max-width: 240px;
  max-height: 280px;
}

.apps-discovery__hover-preview[data-kind='screen'] img {
  object-fit: contain;
}
```

Do not change the generic, Icon, or Component preview rules.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: all Apps discovery tests pass.

### Task 3: Regression and browser verification

**Files:**
- Verify only; no new files.

- [ ] **Step 1: Run focused regression tests**

```bash
node --experimental-strip-types --test src/objectStoreDb.test.ts
npx tsx --test src/vitrine/facetPreviewApi.test.ts src/vitrine/AppsDiscovery.test.tsx
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Vite exits successfully.

- [ ] **Step 3: Check the diff**

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Verify in the local browser**

Reload `/apps`, hover a Screen taxonomy option, and confirm the popover follows
the image's natural aspect ratio within `240px × 280px` without cropping.
Confirm cursor offset and viewport clamping still work.

No commit or push is included; the project requires an explicit user request.
