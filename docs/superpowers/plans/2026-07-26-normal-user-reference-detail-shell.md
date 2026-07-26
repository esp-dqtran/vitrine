# Normal-user Reference Detail Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the existing App `ReferenceDetailShell` for normal-user App and Site detail pages with the approved Mobbin-style tab sets.

**Architecture:** Generalize `ReferenceDetailShell` with reusable description, leading-navigation, class, and data hooks. Keep App and Site evidence renderers independent, but move their identity hero, metadata, actions, version control, and tabs through the same shell. Normal-user routes expose only Apps `Screens / UI Elements / Flows` and Sites `Preview / Sections`; admin routes preserve their current sections.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, Framer Motion, GSAP, Node test runner, server-rendered React tests, Vite.

**Repository constraint:** Work directly on `main`. Do not create a worktree, branch, commit, or push unless the user explicitly requests it.

---

### Task 1: Lock shared-shell and role behavior with failing tests

**Files:**
- Modify: `src/vitrine/ReferenceDetailShell.test.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/Sites.test.tsx`

- [ ] **Step 1: Extend the shell contract test**

Render a shell with `description`, `tabLeading`, `className`, and a data hook:

```tsx
<ReferenceDetailShell
  title="V7"
  description="AI-powered visual data platform."
  className="site-detail"
  dataDetailKind="site"
  tabLeading={<button>Latest</button>}
  {...requiredProps}
>
  Preview content
</ReferenceDetailShell>
```

Assert the output includes `data-reference-detail="site"`, the description,
the leading version control before the tablist, and the existing accessible
tab state.

- [ ] **Step 2: Add normal-user App tab tests**

Render `ScreenDetail` with `role="user"` and assert:

```ts
assert.match(html, /aria-label="Screens"/);
assert.match(html, /aria-label="UI Elements"/);
assert.match(html, /aria-label="Flows"/);
assert.doesNotMatch(html, /aria-label="Overview"/);
assert.doesNotMatch(html, /aria-label="Analysis"/);
assert.doesNotMatch(html, /aria-label="Design System"/);
assert.doesNotMatch(html, /aria-label="Export"/);
```

Retain the existing admin test proving the extended tabs and Review boundary.

- [ ] **Step 3: Add normal-user Site tab and shell reuse tests**

Render `SiteVersionView` for `isAdmin={false}` and assert Preview and Sections
are present while Analysis is absent. Add a source assertion that
`SiteVersionPage.tsx` imports and renders `ReferenceDetailShell`.

- [ ] **Step 4: Run focused tests and verify failure**

Run:

```bash
npx tsx --test \
  src/vitrine/ReferenceDetailShell.test.tsx \
  src/vitrine/ScreenDetail.test.tsx \
  src/vitrine/Sites.test.tsx
```

Expected: FAIL because the shell lacks the new props, normal App tabs still
include member extras, and Site still owns separate hero/tab markup.

### Task 2: Generalize the existing reference detail shell

**Files:**
- Modify: `src/vitrine/components/ReferenceDetailShell.tsx`
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/ReferenceDetailShell.test.tsx`

- [ ] **Step 1: Add focused reusable props**

Extend `ReferenceDetailShellProps`:

```ts
interface ReferenceDetailShellProps<T extends string> {
  title: string;
  description?: ReactNode;
  className?: string;
  dataDetailKind?: 'app' | 'site';
  tabLeading?: ReactNode;
  // existing identity, metadata, action, tab, and content props remain
}
```

- [ ] **Step 2: Replace duplicated inline page geometry with shell classes**

Keep the existing identity fallback and sliding indicator, but add stable
classes:

```tsx
<motion.main
  data-reference-detail={dataDetailKind}
  className={`vitrine-page reference-detail ${className ?? ''}`.trim()}
>
  <header className="reference-detail__hero">
    <div className="reference-detail__hero-inner">
      {/* back action, identity, title, description, metadata, actions */}
    </div>
    <div className="reference-detail__navigation">
      {tabLeading && <div className="reference-detail__tab-leading">{tabLeading}</div>}
      <div role="tablist" className="reference-detail__tabs">...</div>
    </div>
  </header>
  <div className="reference-detail__body">...</div>
</motion.main>
```

- [ ] **Step 3: Add responsive Apps-led styles**

Define shared desktop and compact geometry using semantic tokens:

```css
.reference-detail {
  min-height: calc(100vh - 72px);
  background: var(--color-background-body);
}

.reference-detail__hero-inner,
.reference-detail__navigation,
.reference-detail__body-inner {
  width: 100%;
  padding-right: 32px;
  padding-left: 32px;
}

@media (max-width: 720px) {
  .reference-detail__hero-inner,
  .reference-detail__navigation,
  .reference-detail__body-inner {
    padding-right: 16px;
    padding-left: 16px;
  }
}
```

Preserve focus states, the sliding underline, horizontal tab usability,
reduced-motion behavior, native media aspect ratios, and the Apps-led palette.

- [ ] **Step 4: Run the shell test**

Run:

```bash
npx tsx --test src/vitrine/ReferenceDetailShell.test.tsx
```

Expected: PASS.

### Task 3: Apply the approved normal-user App information architecture

**Files:**
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/App.tsx`
- Test: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Resolve allowed tabs by role**

Use role-specific defaults and tabs:

```ts
const MEMBER_SECTIONS: DetailSection[] = ['screens', 'elements', 'flows'];

const resolveSection = (initialSection: string | undefined, role: 'admin' | 'user') => {
  const allowed = role === 'admin'
    ? SECTIONS
    : MEMBER_SECTIONS;
  const fallback: DetailSection = role === 'admin' ? 'overview' : 'screens';
  return allowed.includes(initialSection as DetailSection)
    ? initialSection as DetailSection
    : fallback;
};

const tabs = role === 'admin'
  ? ADMIN_TABS
  : MEMBER_TABS;
```

- [ ] **Step 2: Keep normal-user actions inside the approved IA**

Render Export to Figma only for admins because selecting it would otherwise
route to a hidden tab. Keep the external website action when `websiteUrl`
exists.

- [ ] **Step 3: Supply Mobbin-style App identity data to the shared shell**

Pass `dataDetailKind="app"`, the App description, category, total screens,
last-captured time when available, platform controls, and the selected
section count. Keep the current `VersionPanel`, galleries, Flows panel,
lightbox, infinite loading, and GSAP content transition unchanged.

- [ ] **Step 4: Reuse discovery navigation for normal App detail**

Pass the existing account controls and Apps search opener from `App.tsx`, then
render `ReferenceDiscoveryTopNav` plus `SearchTrigger` only for normal users.
Admins continue receiving `AppShell` through `frame()`.

- [ ] **Step 5: Run App tests**

Run:

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx src/vitrine/App.boundary.test.ts
```

Expected: PASS.

### Task 4: Render Site detail through the same shell

**Files:**
- Modify: `src/vitrine/components/SiteVersionPage.tsx`
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/Sites.test.tsx`

- [ ] **Step 1: Keep Site access and route behavior role-aware**

Resolve Analysis only for admins:

```ts
function resolveSiteSection(value: string | undefined, isAdmin: boolean): SiteDetailSection {
  if (value === 'sections') return 'sections';
  if (value === 'analysis' && isAdmin) return 'analysis';
  return 'preview';
}

const tabs = isAdmin
  ? SITE_ADMIN_TABS
  : SITE_MEMBER_TABS;
```

- [ ] **Step 2: Replace the duplicated Site hero and tabs**

Render:

```tsx
<ReferenceDetailShell
  dataDetailKind="site"
  className="site-detail"
  title={detail.site.name}
  description={description}
  identityKey={`site-icon-${detail.site.id}`}
  identityLabel={detail.site.name.slice(0, 1).toUpperCase()}
  identityImageUrl={detail.site.logoUrl}
  backLabel="Back to all sites"
  onBack={onBack}
  metadata={siteMetadata}
  actions={siteActions}
  tabLeading={versionMenu}
  tabs={tabs}
  activeTab={activeSection}
  onTabChange={onSectionChange}
>
  {body}
  {relatedSitesContent}
</ReferenceDetailShell>
```

Keep `SitePreview`, `SectionsPanel`, `SiteSectionInspector`, related `SiteCard`
rendering, safe external navigation, and version routing intact.

- [ ] **Step 3: Remove only obsolete duplicated Site chrome styles**

Delete or narrow the old `.site-detail__hero`, `.site-detail__identity`,
`.site-detail__heading`, `.site-detail__meta`, `.site-detail__actions`,
`.site-detail__navigation`, and `.site-detail__tabs` rules now owned by the
shared shell. Preserve preview stage, sections grid, inspector, related grid,
loading, and failure styles.

- [ ] **Step 4: Run Site tests**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx
```

Expected: PASS.

### Task 5: Verify the integrated result

**Files:**
- Modify if visual QA exposes a mismatch:
  `src/vitrine/components/ReferenceDetailShell.tsx`
- Modify if visual QA exposes a mismatch:
  `src/vitrine/styles.css`

- [ ] **Step 1: Run all focused detail tests**

```bash
npx tsx --test \
  src/vitrine/ReferenceDetailShell.test.tsx \
  src/vitrine/ScreenDetail.test.tsx \
  src/vitrine/Sites.test.tsx \
  src/vitrine/App.boundary.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Vite exits successfully.

- [ ] **Step 3: Verify normal-user App and Site detail in the local browser**

At desktop and 390px mobile widths, compare Astryx against the Mobbin captures
under `.superpowers/references/2026-07-26-mobbin-detail/`. Confirm:

- shared navigation and hero hierarchy;
- approved tabs only for normal users;
- preserved admin sections;
- no clipped metadata or actions;
- no stretched or cropped evidence;
- correct responsive spacing, text, border, and radius;
- working tabs, version selection, external actions, and inspectors.

- [ ] **Step 4: Run `git diff --check`**

```bash
git diff --check
```

Expected: no whitespace errors.
