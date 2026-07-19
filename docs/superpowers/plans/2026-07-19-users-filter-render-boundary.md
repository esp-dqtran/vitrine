# Users Filter Render Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep search and filter updates from rerendering or replacing the full Users page.

**Architecture:** Extract directory state, fetching, selection, and account actions into a self-contained `UsersDirectoryContainer`. `UsersPage` retains only insights state and renders the stable page shell; the directory keeps existing rows visible while a filtered request is pending.

**Tech Stack:** React 19, TypeScript, Node test runner, server-rendered React tests, Vite

---

### Task 1: Lock the directory render boundary

**Files:**
- Modify: `src/vitrine/components/UsersPage.test.tsx`
- Create: `src/vitrine/components/UsersDirectoryContainer.tsx`
- Modify: `src/vitrine/components/UsersPage.tsx`

- [ ] **Step 1: Write the failing boundary test**

Add a test that always reads `UsersPage.tsx` and conditionally reads `UsersDirectoryContainer.tsx` as an empty string until it exists. Assert that the page does not reference `useUsersDirectory` and does render `UsersDirectoryContainer`, while the container owns `useState('')`, `useState<UserFilter>('all')`, and `useUsersDirectory(query, filter)`. This guarantees the RED run is an expected assertion failure instead of a missing-file error.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/vitrine/components/UsersPage.test.tsx`

Expected: FAIL on the render-boundary assertion because `UsersPage` still owns `useUsersDirectory`.

- [ ] **Step 3: Implement the isolated container**

Create `UsersDirectoryContainer` with the directory hook, search/filter state, selected-user dialog, pagination, and enable/disable logic. Replace the directory props in `UsersPageView` with a `directory: ReactNode` slot, render `<UsersDirectoryContainer />` from `UsersPage`, and keep insights state in the page.

- [ ] **Step 4: Keep refresh loading local**

Render the initial loading and error states inside `UsersDirectoryContainer`. Once rows exist, keep rendering `UserDirectory` during `directory.loading` and pass `refreshing={directory.loading}` so the directory exposes a local updating status without unmounting the rows.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npx tsx --test src/vitrine/components/UsersPage.test.tsx`

Expected: all Users page component tests pass.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/vitrine/components/UsersPage.test.tsx src/vitrine/components/UsersPage.tsx src/vitrine/components/UserDirectory.tsx src/vitrine/components/UsersDirectoryContainer.tsx
git commit -m "fix: isolate admin user filters"
```

### Task 2: Verify the complete application

**Files:**
- Verify: `src/vitrine/components/UsersPage.test.tsx`
- Verify: `src/vitrine/components/UsersPage.tsx`
- Verify: `src/vitrine/components/UserDirectory.tsx`
- Verify: `src/vitrine/components/UsersDirectoryContainer.tsx`

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: both Node and TSX suites report zero failures.

- [ ] **Step 2: Build production assets**

Run: `npm run build`

Expected: Vite exits with status 0.

- [ ] **Step 3: Check the exact diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only the planned files are changed.
