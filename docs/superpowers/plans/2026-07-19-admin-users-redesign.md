# Admin Users Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin Users table with the approved Option 2 member-first directory and compact Growth pulse while preserving the current API contract.

**Architecture:** Keep `useUsersGrowth` as the route data source. Move deterministic search, filter, grouping, and formatting behavior into a small pure model module, then render the selected two-column layout from `UsersPage` with responsive classes in the existing Vitrine stylesheet. No backend, database, route, or shell changes are required.

**Tech Stack:** React 19, TypeScript, Recharts, `@astryxdesign/core`, Node test runner, React server rendering, Vite CSS.

---

## File Map

- Create `src/vitrine/usersPageModel.ts`: pure user-directory filters, groups, and labels.
- Create `src/vitrine/usersPageModel.test.ts`: unit coverage for the pure model.
- Modify `src/vitrine/components/UsersPage.tsx`: approved member-first layout, controls, chart, and states.
- Create `src/vitrine/components/UsersPage.test.tsx`: static-render and responsive-style contract tests.
- Modify `src/vitrine/styles.css`: scoped `.admin-users-*` layout and responsive rules.

### Task 1: User directory presentation model

**Files:**
- Create: `src/vitrine/usersPageModel.ts`
- Test: `src/vitrine/usersPageModel.test.ts`

- [ ] **Step 1: Write the failing model tests**

Create fixtures for an admin, Free member, Pro member, and disabled member. Assert case-insensitive email search, every filter, grouped administrator/member results, deterministic initials, plan labels, date fallback, and conversion formatting:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminUser } from "./types.ts";
import {
  filterAdminUsers,
  formatConversion,
  formatJoinedDate,
  groupAdminUsers,
  userInitial,
  userPlanLabel,
} from "./usersPageModel.ts";

const users: AdminUser[] = [
  { id: 1, email: "admin@gmail.com", role: "admin", active: true, created_at: "2026-07-13T00:00:00.000Z", subscription_status: null },
  { id: 2, email: "free@example.com", role: "user", active: true, created_at: "2026-07-14T00:00:00.000Z", subscription_status: null },
  { id: 3, email: "pro@example.com", role: "user", active: true, created_at: "2026-07-15T00:00:00.000Z", subscription_status: "active" },
  { id: 4, email: "disabled@example.com", role: "user", active: false, created_at: "invalid", subscription_status: "canceled" },
];

test("searches and filters users with composable real-data rules", () => {
  assert.deepEqual(filterAdminUsers(users, "PRO@", "all").map(({ id }) => id), [3]);
  assert.deepEqual(filterAdminUsers(users, "", "admin").map(({ id }) => id), [1]);
  assert.deepEqual(filterAdminUsers(users, "", "pro").map(({ id }) => id), [3]);
  assert.deepEqual(filterAdminUsers(users, "", "free").map(({ id }) => id), [1, 2, 4]);
  assert.deepEqual(filterAdminUsers(users, "", "disabled").map(({ id }) => id), [4]);
});

test("groups the all-members view and keeps filtered results together", () => {
  assert.deepEqual(groupAdminUsers(users, "all").map(({ label, users }) => [label, users.length]), [["Administrators", 1], ["Members", 3]]);
  assert.deepEqual(groupAdminUsers([users[2]], "pro").map(({ label, users }) => [label, users.length]), [["Pro members", 1]]);
});

test("formats only deterministic values available in the API", () => {
  assert.equal(userInitial("admin@gmail.com"), "A");
  assert.equal(userInitial("growth.smoke@example.com"), "GS");
  assert.equal(userPlanLabel(users[2]), "Pro");
  assert.equal(userPlanLabel(users[3]), "Free");
  assert.equal(formatJoinedDate("invalid"), "Unknown join date");
  assert.equal(formatConversion(2, 8), "25.0%");
  assert.equal(formatConversion(0, 0), "—");
});
```

- [ ] **Step 2: Run the model tests and verify the expected failure**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersPageModel.test.ts
```

Expected: FAIL because `usersPageModel.ts` does not exist.

- [ ] **Step 3: Implement the pure presentation model**

Create `UserFilter`, `UserGroup`, a filter-label map, and the functions used by the tests. Filtering must treat only `subscription_status === "active"` as Pro; all other statuses are Free. `groupAdminUsers` must split All into Administrators/Members and use one correctly labeled result group for narrower filters. Date formatting must return `Unknown join date` for invalid values.

```ts
import type { AdminUser } from "./types.ts";

export type UserFilter = "all" | "admin" | "pro" | "free" | "disabled";
export interface UserGroup { key: string; label: string; users: AdminUser[] }

export const USER_FILTER_LABELS: Record<UserFilter, string> = {
  all: "All members",
  admin: "Administrators",
  pro: "Pro members",
  free: "Free members",
  disabled: "Disabled",
};

export function userPlanLabel(user: AdminUser) {
  return user.subscription_status === "active" ? "Pro" : "Free";
}

export function filterAdminUsers(users: AdminUser[], query: string, filter: UserFilter) {
  const needle = query.trim().toLocaleLowerCase();
  return users.filter((user) => {
    const matchesQuery = !needle || user.email.toLocaleLowerCase().includes(needle);
    const matchesFilter = filter === "all"
      || (filter === "admin" && user.role === "admin")
      || (filter === "pro" && userPlanLabel(user) === "Pro")
      || (filter === "free" && userPlanLabel(user) === "Free")
      || (filter === "disabled" && !user.active);
    return matchesQuery && matchesFilter;
  });
}

export function groupAdminUsers(users: AdminUser[], filter: UserFilter): UserGroup[] {
  if (filter !== "all") {
    return users.length ? [{ key: filter, label: USER_FILTER_LABELS[filter], users }] : [];
  }
  const administrators = users.filter(({ role }) => role === "admin");
  const members = users.filter(({ role }) => role === "user");
  return [
    { key: "administrators", label: "Administrators", users: administrators },
    { key: "members", label: "Members", users: members },
  ].filter((group) => group.users.length > 0);
}

export function userInitial(email: string) {
  const localPart = email.trim().split("@")[0] ?? "";
  const parts = localPart.split(/[._+-]+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  return localPart.slice(0, 1).toUpperCase() || "?";
}

export function formatJoinedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown join date"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatConversion(activeSubscribers: number, totalUsers: number) {
  return totalUsers > 0 ? `${((activeSubscribers / totalUsers) * 100).toFixed(1)}%` : "—";
}
```

- [ ] **Step 4: Run the model tests and verify they pass**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersPageModel.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit the model slice**

```bash
git add src/vitrine/usersPageModel.ts src/vitrine/usersPageModel.test.ts
git commit -m "feat: add admin user directory model"
```

### Task 2: Approved Users page structure and states

**Files:**
- Modify: `src/vitrine/components/UsersPage.tsx`
- Create: `src/vitrine/components/UsersPage.test.tsx`

- [ ] **Step 1: Write the failing component contract tests**

Export a pure `UsersPageView` and statically render it with real `AdminUser`, `GrowthStats`, and `DailySignupPoint` fixtures. Assert the approved hierarchy, accessible controls, grouped rows, four Growth pulse metrics, no fake activity/invitation copy, and no design-system Table role:

```tsx
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UsersPageView } from "./UsersPage.tsx";

test("renders the member-first Option 2 hierarchy from real API fields", () => {
  const html = renderToStaticMarkup(<UsersPageView
    users={[
      { id: 1, email: "admin@gmail.com", role: "admin", active: true, created_at: "2026-07-13T00:00:00.000Z", subscription_status: null },
      { id: 2, email: "pro@example.com", role: "user", active: true, created_at: "2026-07-15T00:00:00.000Z", subscription_status: "active" },
    ]}
    growth={{ stats: { total_users: 2, new_users_7d: 1, active_subscribers: 1, dau: 0, wau: 1, total_free_unlocks: 0 }, dailySignups: [{ day: "2026-07-19", signups: 1 }] }}
  />);

  assert.match(html, /<h1[^>]*>Users<\/h1>/);
  assert.match(html, /Manage members and monitor growth/);
  assert.match(html, /aria-label="Search members"/);
  assert.match(html, /aria-label="Filter members"/);
  assert.match(html, /Administrators/);
  assert.match(html, /Members/);
  assert.match(html, /Growth pulse/);
  assert.match(html, /Total users/);
  assert.match(html, /New this week/);
  assert.match(html, /Pro members/);
  assert.match(html, /Conversion/);
  assert.doesNotMatch(html, /Invited|Active .* ago|role="table"/);
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: FAIL because `UsersPageView` is not exported and the current page still renders the table-first design.

- [ ] **Step 3: Implement the member-first split view**

Replace the current StatTile/Table composition with:

- `UsersPageView({ users, growth })` owning `query` and `filter` state.
- A compact header with member count.
- `MemberDirectory` with search, native select, result count, groups, and clear-filters empty state.
- `MemberRow` with deterministic avatar, email, formatted joined date, role badge, plan badge, and textual account state.
- `GrowthPulse` with the existing 30-day Recharts series and four metric rows.
- `UsersPage` as the hook wrapper, passing `refresh` to a native Retry button in the error state.

Use semantic structure:

```tsx
<main className="admin-users-page">
  <header className="admin-users-header">...</header>
  <div className="admin-users-layout">
    <section className="admin-users-directory" aria-labelledby="admin-users-directory-title">...</section>
    <GrowthPulse stats={growth.stats} dailySignups={growth.dailySignups} />
  </div>
</main>
```

Do not show DAU, WAU, Free unlocks, invitations, last-active timestamps, row actions, or bulk selection.

- [ ] **Step 4: Run model and component tests**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersPageModel.test.ts
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: all tests pass. Recharts may emit its known static-render sizing warning, but there must be no test failure.

- [ ] **Step 5: Commit the component slice**

```bash
git add src/vitrine/components/UsersPage.tsx src/vitrine/components/UsersPage.test.tsx
git commit -m "feat: redesign admin users workspace"
```

### Task 3: Faithful responsive styling

**Files:**
- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/components/UsersPage.test.tsx`

- [ ] **Step 1: Add a failing stylesheet contract test**

Read `../styles.css` and assert the selected split grid and both responsive breakpoints:

```ts
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
assert.match(css, /\.admin-users-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 2fr\) minmax\(300px, 1fr\);/s);
assert.match(css, /@media \(max-width:\s*1100px\)[\s\S]*?\.admin-users-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.admin-users-toolbar\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/);
```

- [ ] **Step 2: Run the component test and verify the CSS contract fails**

Run:

```bash
npx tsx --test src/vitrine/components/UsersPage.test.tsx
```

Expected: FAIL because `.admin-users-layout` is not yet defined in `styles.css`.

- [ ] **Step 3: Add scoped visual styles**

Append an `Admin users workspace` section to `styles.css` using only `.admin-users-*` selectors. Implement:

- `max-width: 1360px`, centered page, `32px 28px 64px` padding.
- Compact header and supporting member count.
- Desktop grid `minmax(0, 2fr) minmax(300px, 1fr)`.
- Directory right padding and Growth pulse left border/padding.
- Native search/select surfaces that reuse Astryx background, border, text, blue focus, 14px type, and 10–12px radii.
- Group labels, thin row separators, 48px circular avatars, and quiet badge/status alignment.
- Minimal chart and metric typography without metric cards.
- `1100px` stacked layout with the Growth pulse below the directory.
- `640px` compact padding, stacked toolbar, wrapping member rows, and no horizontal overflow.

Use existing CSS variables such as `--color-background-body`, `--color-background-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border`, and `--color-accent`. Do not add gradients, shadows, or new font imports.

- [ ] **Step 4: Run focused tests and the build**

Run:

```bash
node --experimental-strip-types --test src/vitrine/usersPageModel.test.ts
npx tsx --test src/vitrine/components/UsersPage.test.tsx
npm run build
```

Expected: focused tests pass and Vite reports a successful production build.

- [ ] **Step 5: Commit the responsive styling**

```bash
git add src/vitrine/styles.css src/vitrine/components/UsersPage.test.tsx
git commit -m "style: polish admin users workspace"
```

### Task 4: Browser fidelity and interaction verification

**Files:**
- Modify only files from Tasks 1–3 if a verified mismatch requires correction.

- [ ] **Step 1: Open the signed-in `/admin` Users surface at the normal desktop viewport**

Verify the member directory is visually primary, the Growth pulse is narrow, text is not clipped, the sidebar remains unchanged, and the result resembles the approved Option 2 reference.

- [ ] **Step 2: Verify the core interactions**

Use the real search and filter controls to confirm:

- Search narrows by email.
- Administrator, Pro, Free, and Disabled filters show only matching real users.
- Clear filters restores all users and grouping.
- No interaction makes a new network request after the page data loads.

- [ ] **Step 3: Verify the narrow layout**

At a phone-width viewport, verify the directory remains first, Growth pulse stacks below, rows wrap without overlap, controls stack, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 4: Compare implementation and selected visual together**

Capture the coded desktop page. Compare it with `docs/superpowers/specs/assets/2026-07-19-admin-users-option-2.png` in one visual review. Fix only visible hierarchy, spacing, wrapping, border, radius, or typography mismatches that remain within the approved scope.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: full test suite passes, production build succeeds, and no whitespace errors are reported. Confirm unrelated dirty files were not staged or modified by this feature.
