# Astryx Flow Tree Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, searchable category-to-Flow tree to the left side of the app-detail Flows workspace while preserving the visual gallery, Flow viewer, deep links, and Feature Document creation.

**Architecture:** Normalize the existing `DesignFlow.category` values in a pure model module, render the hierarchy through a presentational `FlowTree`, and keep search, disclosure, mobile-drawer, and gallery state inside a focused `FlowsWorkspace`. Route selection remains controlled by `App`, with `ScreenDetail` forwarding the active platform/version context and `FlowViewer` reporting step changes.

**Tech Stack:** TypeScript, React 19, `@astryxdesign/core`, CSS, Node test runner, React server rendering, Vite

---

## Execution preflight

The primary checkout currently contains unrelated edits, including
`src/vitrine/App.tsx` and `src/vitrine/styles.css`. Execute this plan in an
isolated worktree created from the latest committed `main`; do not reset, move,
or copy the unrelated dirty state. Before integration, rebase the feature
branch onto the then-current `main` and reconcile only genuine overlap in those
two files.

The approved specification is:

`docs/superpowers/specs/2026-07-24-astryx-flow-tree-navigation-design.md`

## File structure

### Create

- `src/vitrine/flowTree.ts` — pure category normalization, filtering, and
  effective-expansion rules.
- `src/vitrine/flowTree.test.ts` — model coverage that runs in the existing
  Node TypeScript suite.
- `src/vitrine/components/FlowTree.tsx` — accessible presentational tree.
- `src/vitrine/components/FlowGallery.tsx` — existing grouped, progressively
  rendered card gallery extracted from `FlowsPanel`.
- `src/vitrine/components/FlowsWorkspace.tsx` — desktop two-pane layout,
  shared search/expansion state, and mobile drawer.
- `src/vitrine/FlowTreeNavigation.test.tsx` — rendered contracts for the tree,
  workspace, drawer, selected state, and unavailable route.

### Modify

- `src/vitrine/components/FlowsPanel.tsx` — reduce to normalization, controlled
  route selection, empty state, and workspace composition.
- `src/vitrine/components/FlowsPanel.test.tsx` — preserve the existing gallery,
  batching, category-total, and Feature Document contracts after extraction.
- `src/vitrine/components/FlowViewer.tsx` — report lightbox step changes and
  rename Back to **Back to all flows**.
- `src/vitrine/components/ScreenDetail.tsx` — pass controlled Flow selection
  and active platform/version context.
- `src/vitrine/ScreenDetail.test.tsx` — lock the new callback boundary.
- `src/vitrine/App.tsx` — serialize Flow/step changes through the existing app
  route.
- `src/vitrine/App.boundary.test.ts` — lock the route callback wiring without
  mounting the whole authenticated application.
- `src/vitrine/styles.css` — desktop rail, tree rows, selected state, drawer,
  and the 980 px responsive transition.

No API, database, import, or Feature Document files change.

---

### Task 1: Build the pure Flow-tree model

**Files:**

- Create: `src/vitrine/flowTree.ts`
- Create: `src/vitrine/flowTree.test.ts`

- [ ] **Step 1: Write the failing normalization and filtering tests**

Create `src/vitrine/flowTree.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import {
  buildFlowTreeGroups,
  effectiveExpandedFlowGroupIds,
  filterFlowTreeGroups,
  STANDALONE_FLOW_GROUP_ID,
  toggleFlowGroup,
} from './flowTree.ts';

const flow = (
  id: string,
  title: string,
  category?: string,
): DesignFlow<EvidenceView> => ({
  id,
  title,
  ...(category === undefined ? {} : { category }),
  description: '',
  tags: [],
  steps: [],
});

test('normalizes categories, keeps standalone flows first, and preserves flow source order', () => {
  const groups = buildFlowTreeGroups([
    flow('standalone', 'Home'),
    flow('second', 'Second action', ' Settings '),
    flow('first', 'First action', 'Settings'),
    flow('auth', 'Log in', 'Authentication'),
    flow('blank', 'Blank category', '   '),
  ]);

  assert.deepEqual(groups.map(({ id, label }) => ({ id, label })), [
    { id: STANDALONE_FLOW_GROUP_ID, label: 'Standalone flows' },
    { id: 'category:Authentication', label: 'Authentication' },
    { id: 'category:Settings', label: 'Settings' },
  ]);
  assert.deepEqual(groups[0].flows.map(({ id }) => id), ['standalone', 'blank']);
  assert.deepEqual(groups[2].flows.map(({ id }) => id), ['second', 'first']);
});

test('category matches retain all children while title matches retain only matching flows', () => {
  const groups = buildFlowTreeGroups([
    flow('invite', 'Inviting a team member', 'Onboarding'),
    flow('trial', 'Starting a trial', 'Onboarding'),
    flow('setup', 'Complete setup', 'Dashboard'),
  ]);

  assert.deepEqual(
    filterFlowTreeGroups(groups, 'onboard')[0].flows.map(({ id }) => id),
    ['invite', 'trial'],
  );
  assert.deepEqual(
    filterFlowTreeGroups(groups, 'trial')[0].flows.map(({ id }) => id),
    ['trial'],
  );
  assert.deepEqual(filterFlowTreeGroups(groups, 'missing'), []);
});

test('search and routed selection derive expansion without mutating user choices', () => {
  const groups = buildFlowTreeGroups([
    flow('invite', 'Inviting a team member', 'Onboarding'),
    flow('setup', 'Complete setup', 'Dashboard'),
  ]);
  const userExpanded = new Set(['category:Dashboard']);

  const effective = effectiveExpandedFlowGroupIds({
    groups,
    visibleGroups: filterFlowTreeGroups(groups, 'invite'),
    userExpanded,
    selectedFlowId: 'setup',
    searching: true,
  });

  assert.deepEqual([...effective].sort(), ['category:Dashboard', 'category:Onboarding']);
  assert.deepEqual([...userExpanded], ['category:Dashboard']);
  assert.deepEqual([...toggleFlowGroup(userExpanded, 'category:Dashboard')], []);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/flowTree.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/vitrine/flowTree.ts`.

- [ ] **Step 3: Implement the complete pure model**

Create `src/vitrine/flowTree.ts`:

```ts
import type { DesignFlow, EvidenceView } from '../designSystem.ts';

export const STANDALONE_FLOW_GROUP_ID = 'standalone';
export const STANDALONE_FLOW_GROUP_LABEL = 'Standalone flows';

export interface FlowTreeGroup {
  id: string;
  label: string;
  flows: DesignFlow<EvidenceView>[];
  standalone: boolean;
}

const normalizedCategory = (flow: DesignFlow<EvidenceView>): string =>
  flow.category?.trim() ?? '';

export function buildFlowTreeGroups(
  flows: DesignFlow<EvidenceView>[],
): FlowTreeGroup[] {
  const grouped = new Map<string, FlowTreeGroup>();

  for (const flow of flows) {
    const category = normalizedCategory(flow);
    const id = category ? `category:${category}` : STANDALONE_FLOW_GROUP_ID;
    const existing = grouped.get(id);
    if (existing) {
      existing.flows.push(flow);
      continue;
    }
    grouped.set(id, {
      id,
      label: category || STANDALONE_FLOW_GROUP_LABEL,
      flows: [flow],
      standalone: !category,
    });
  }

  const standalone = grouped.get(STANDALONE_FLOW_GROUP_ID);
  const categorized = [...grouped.values()]
    .filter(({ standalone: itemStandalone }) => !itemStandalone)
    .sort((left, right) => left.label.localeCompare(right.label));
  return standalone ? [standalone, ...categorized] : categorized;
}

export function filterFlowTreeGroups(
  groups: FlowTreeGroup[],
  query: string,
): FlowTreeGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    if (group.label.toLocaleLowerCase().includes(normalizedQuery)) return [group];
    const matchingFlows = group.flows.filter(({ title }) =>
      title.toLocaleLowerCase().includes(normalizedQuery)
    );
    return matchingFlows.length ? [{ ...group, flows: matchingFlows }] : [];
  });
}

export function toggleFlowGroup(
  expanded: ReadonlySet<string>,
  groupId: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  return next;
}

export function effectiveExpandedFlowGroupIds({
  groups,
  visibleGroups,
  userExpanded,
  selectedFlowId,
  searching,
}: {
  groups: FlowTreeGroup[];
  visibleGroups: FlowTreeGroup[];
  userExpanded: ReadonlySet<string>;
  selectedFlowId?: string;
  searching: boolean;
}): Set<string> {
  const effective = new Set(userExpanded);
  if (searching) {
    for (const group of visibleGroups) effective.add(group.id);
  }
  if (selectedFlowId) {
    const selectedGroup = groups.find(({ flows }) =>
      flows.some(({ id }) => id === selectedFlowId)
    );
    if (selectedGroup) effective.add(selectedGroup.id);
  }
  return effective;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node --experimental-strip-types --test src/vitrine/flowTree.test.ts
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the model**

```bash
git add src/vitrine/flowTree.ts src/vitrine/flowTree.test.ts
git commit -m "feat: add flow tree model"
```

---

### Task 2: Render the accessible Flow tree

**Files:**

- Create: `src/vitrine/components/FlowTree.tsx`
- Create: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Write the failing presentational component test**

Create `src/vitrine/FlowTreeNavigation.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import { FlowTree } from './components/FlowTree.tsx';
import { buildFlowTreeGroups } from './flowTree.ts';

const flow = (
  id: string,
  title: string,
  category?: string,
): DesignFlow<EvidenceView> => ({
  id,
  title,
  ...(category ? { category } : {}),
  description: '',
  tags: [],
  steps: [],
});

test('renders category disclosures, counts, nested flows, and selected state', () => {
  const groups = buildFlowTreeGroups([
    flow('invite', 'Inviting a team member', 'Onboarding'),
    flow('trial', 'Starting a trial', 'Onboarding'),
    flow('home', 'Home'),
  ]);
  const html = renderToStaticMarkup(
    <FlowTree
      idPrefix="desktop"
      groups={groups}
      query=""
      expandedGroupIds={new Set(groups.map(({ id }) => id))}
      selectedFlowId="trial"
      onQueryChange={() => undefined}
      onToggleGroup={() => undefined}
      onSelectFlow={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Flows"/);
  assert.match(html, /placeholder="Search flows…"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Onboarding/);
  assert.match(html, />2<\/span>/);
  assert.match(html, /Inviting a team member/);
  assert.match(html, /aria-current="page"[^>]*>Starting a trial/);
  assert.match(html, /Standalone flows/);
  assert.match(html, /id="desktop-flow-group-/);
});

test('renders a local no-match status without replacing the workspace', () => {
  const html = renderToStaticMarkup(
    <FlowTree
      idPrefix="drawer"
      groups={[]}
      query="missing"
      expandedGroupIds={new Set()}
      onQueryChange={() => undefined}
      onToggleGroup={() => undefined}
      onSelectFlow={() => undefined}
    />,
  );
  assert.match(html, /role="status"/);
  assert.match(html, /No flows match your search/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for
`src/vitrine/components/FlowTree.tsx`.

- [ ] **Step 3: Implement the presentational tree**

Create `src/vitrine/components/FlowTree.tsx`:

```tsx
import { Icon } from '@astryxdesign/core';
import type { FlowTreeGroup } from '../flowTree.ts';
import { SearchInput } from './SearchInput.tsx';

export interface FlowTreeProps {
  idPrefix: string;
  groups: FlowTreeGroup[];
  query: string;
  expandedGroupIds: ReadonlySet<string>;
  selectedFlowId?: string;
  onQueryChange(query: string): void;
  onToggleGroup(groupId: string): void;
  onSelectFlow(flowId: string): void;
}

export function FlowTree({
  idPrefix,
  groups,
  query,
  expandedGroupIds,
  selectedFlowId,
  onQueryChange,
  onToggleGroup,
  onSelectFlow,
}: FlowTreeProps) {
  return (
    <nav className="flow-tree" aria-label="Flows">
      <div className="flow-tree__search">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Search flows…"
        />
      </div>
      {groups.length === 0 ? (
        <p className="flow-tree__empty" role="status">
          No flows match your search
        </p>
      ) : (
        <ul className="flow-tree__groups">
          {groups.map((group, groupIndex) => {
            const expanded = expandedGroupIds.has(group.id);
            const childId = `${idPrefix}-flow-group-${groupIndex}`;
            return (
              <li className="flow-tree__group" key={group.id}>
                <button
                  type="button"
                  className="flow-tree__group-button"
                  aria-expanded={expanded}
                  aria-controls={childId}
                  onClick={() => onToggleGroup(group.id)}
                >
                  <Icon
                    icon={expanded ? 'chevronDown' : 'chevronRight'}
                    size="sm"
                  />
                  <span className="flow-tree__group-label">{group.label}</span>
                  <span className="flow-tree__count">{group.flows.length}</span>
                </button>
                {expanded && (
                  <ul className="flow-tree__flows" id={childId}>
                    {group.flows.map((flow) => (
                      <li key={flow.id}>
                        <button
                          type="button"
                          className="flow-tree__flow-button"
                          aria-current={flow.id === selectedFlowId ? 'page' : undefined}
                          onClick={() => onSelectFlow(flow.id)}
                        >
                          {flow.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
```

The installed design-system icon registry defines both `chevronDown` and
`chevronRight`; use those exact semantic names.

- [ ] **Step 4: Run the focused tests and typecheck**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx
npx tsc --noEmit
```

Expected: 2 tests pass, and TypeScript exits 0.

- [ ] **Step 5: Commit the presentational tree**

```bash
git add src/vitrine/components/FlowTree.tsx src/vitrine/FlowTreeNavigation.test.tsx
git commit -m "feat: render accessible flow tree"
```

---

### Task 3: Preserve the existing visual gallery behind a focused component

**Files:**

- Create: `src/vitrine/components/FlowGallery.tsx`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`

- [ ] **Step 1: Add a failing extraction boundary test**

Add this test to `src/vitrine/components/FlowsPanel.test.tsx`:

```tsx
import { FlowGallery } from './FlowGallery.tsx';
import { buildFlowTreeGroups } from '../flowTree.ts';

test('FlowGallery keeps card batching and complete category totals independent from tree navigation', () => {
  const flows = Array.from(
    { length: 30 },
    (_, index) => ({
      ...loginFlow,
      id: `settings-${index}`,
      title: `Settings ${index + 1}`,
      category: 'Settings',
    }),
  );
  const html = renderToStaticMarkup(
    <FlowGallery
      groups={buildFlowTreeGroups(flows)}
      onSelectFlow={() => undefined}
    />,
  );

  assert.equal((html.match(/aria-label="Open Settings \d+ flow"/g) ?? []).length, 24);
  assert.match(html, />Settings<\/span><span[^>]*>30<\/span>/);
  assert.doesNotMatch(html, /Open Settings 25 flow/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for
`src/vitrine/components/FlowGallery.tsx`.

- [ ] **Step 3: Extract the gallery without changing its behavior**

Create `src/vitrine/components/FlowGallery.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { FlowTreeGroup } from '../flowTree.ts';
import { FlowCard } from './FlowCard.tsx';
import {
  ReferenceGalleryGrid,
  ReferenceGallerySection,
} from './ReferenceGallerySection.tsx';

const FLOW_BATCH_SIZE = 24;

export function FlowGallery({
  groups,
  onSelectFlow,
}: {
  groups: FlowTreeGroup[];
  onSelectFlow(flowId: string): void;
}) {
  const [visibleCount, setVisibleCount] = useState(FLOW_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const ordered = groups.flatMap(({ flows }) => flows);
  const visibleIds = new Set(
    ordered.slice(0, visibleCount).map(({ id }) => id),
  );
  const visibleGroups = groups.flatMap((group) => {
    const visibleFlows = group.flows.filter(({ id }) => visibleIds.has(id));
    return visibleFlows.length
      ? [{ ...group, flows: visibleFlows, totalCount: group.flows.length }]
      : [];
  });
  const hasMore = visibleCount < ordered.length;

  useEffect(() => setVisibleCount(FLOW_BATCH_SIZE), [groups]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount((current) =>
          Math.min(current + FLOW_BATCH_SIZE, ordered.length)
        );
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, ordered.length]);

  return (
    <ReferenceGallerySection
      sentinel={hasMore
        ? <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
        : undefined}
    >
      <div className="flow-gallery">
        {visibleGroups.map((group) => (
          <section className="flow-gallery__group" key={group.id}>
            {!group.standalone && (
              <div className="flow-gallery__heading">
                <span>{group.label}</span>
                <span>{group.totalCount}</span>
              </div>
            )}
            <ReferenceGalleryGrid minCardWidth={220}>
              {group.flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onOpen={() => onSelectFlow(flow.id)}
                />
              ))}
            </ReferenceGalleryGrid>
          </section>
        ))}
      </div>
    </ReferenceGallerySection>
  );
}
```

- [ ] **Step 4: Run the existing gallery regression tests**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx src/vitrine/FlowCard.test.tsx
```

Expected: all tests pass, including 24-card batching and the full category
total.

- [ ] **Step 5: Commit the gallery extraction**

```bash
git add src/vitrine/components/FlowGallery.tsx src/vitrine/components/FlowsPanel.test.tsx
git commit -m "refactor: isolate flow gallery rendering"
```

---

### Task 4: Compose the persistent desktop workspace and mobile drawer

**Files:**

- Create: `src/vitrine/components/FlowsWorkspace.tsx`
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Modify: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Add failing workspace contracts**

Append to `src/vitrine/FlowTreeNavigation.test.tsx`:

```tsx
import { FlowsPanel } from './components/FlowsPanel.tsx';
import { FlowsWorkspaceLoading } from './components/FlowsWorkspace.tsx';

test('keeps the tree mounted beside a selected Flow viewer', () => {
  const flows = [
    flow('invite', 'Inviting a team member', 'Onboarding'),
    {
      ...flow('trial', 'Starting a trial', 'Onboarding'),
      steps: [{
        label: 'Choose a plan',
        evidence: [{
          imageId: 1,
          imageUrl: '/trial.png',
          description: 'Plan selection',
        }],
      }],
    },
  ];
  const html = renderToStaticMarkup(
    <FlowsPanel
      flows={flows}
      selectedFlowId="trial"
      selectedStep={1}
      onSelectionChange={() => undefined}
    />,
  );

  assert.match(html, /data-flow-workspace="true"/);
  assert.match(html, /aria-label="Flows"/);
  assert.match(html, /aria-current="page"[^>]*>Starting a trial/);
  assert.match(html, /Back to all flows/);
  assert.match(html, /Choose a plan/);
  assert.match(html, /Browse flows/);
  assert.match(html, /class="[^"]*flow-tree-drawer/);
  assert.match(html, /desktop-flow-group-/);
  assert.match(html, /drawer-flow-group-/);
});

test('keeps invalid routed Flow recovery inside the normal gallery workspace', () => {
  const html = renderToStaticMarkup(
    <FlowsPanel
      flows={[flow('invite', 'Inviting a team member', 'Onboarding')]}
      selectedFlowId="deleted-flow"
      onSelectionChange={() => undefined}
    />,
  );
  assert.match(html, /role="status"/);
  assert.match(html, /Flow unavailable/);
  assert.match(html, /Open Inviting a team member flow/);
});

test('renders Flow navigation skeletons beside the existing loading state', () => {
  const html = renderToStaticMarkup(<FlowsWorkspaceLoading />);
  assert.match(html, /data-flow-workspace-loading="true"/);
  assert.match(html, /aria-label="Loading flows navigation"/);
  assert.equal((html.match(/flow-tree__skeleton/g) ?? []).length, 7);
  assert.match(html, /aria-label="Loading flows"/);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: FAIL because `FlowsPanel` does not accept controlled selection and
does not render the workspace.

- [ ] **Step 3: Implement `FlowsWorkspace`**

Create `src/vitrine/components/FlowsWorkspace.tsx` with this public contract:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, EmptyState, Spinner } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import {
  effectiveExpandedFlowGroupIds,
  filterFlowTreeGroups,
  toggleFlowGroup,
  type FlowTreeGroup,
} from '../flowTree.ts';
import { FlowGallery } from './FlowGallery.tsx';
import { FlowTree } from './FlowTree.tsx';
import { FlowViewer } from './FlowViewer.tsx';

export interface FlowsWorkspaceProps {
  groups: FlowTreeGroup[];
  selectedFlow?: DesignFlow<EvidenceView>;
  selectedFlowId?: string;
  selectedStep?: number;
  invalidFlowId?: string;
  app?: string;
  platform?: Platform;
  version?: number;
  onSelectionChange(flowId?: string, step?: number): void;
}

export function FlowsWorkspaceLoading() {
  return (
    <div className="flow-workspace" data-flow-workspace-loading="true">
      <aside
        className="flow-workspace__rail flow-workspace__rail--loading"
        aria-label="Loading flows navigation"
      >
        {Array.from({ length: 7 }, (_, index) => (
          <span className="flow-tree__skeleton" key={index} />
        ))}
      </aside>
      <main
        className="flow-workspace__content flow-workspace__content--loading"
        role="status"
        aria-label="Loading flows"
      >
        <Spinner size="lg" />
      </main>
    </div>
  );
}

export function FlowsWorkspace({
  groups,
  selectedFlow,
  selectedFlowId,
  selectedStep,
  invalidFlowId,
  app,
  platform,
  version,
  onSelectionChange,
}: FlowsWorkspaceProps) {
  const groupSignature = groups.map(({ id }) => id).join('\u0000');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.map(({ id }) => id)),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setExpanded(new Set(groups.map(({ id }) => id)));
  }, [groupSignature]);

  const visibleGroups = useMemo(
    () => filterFlowTreeGroups(groups, query),
    [groups, query],
  );
  const effectiveExpanded = useMemo(
    () => effectiveExpandedFlowGroupIds({
      groups,
      visibleGroups,
      userExpanded: expanded,
      selectedFlowId,
      searching: Boolean(query.trim()),
    }),
    [expanded, groups, query, selectedFlowId, visibleGroups],
  );

  const selectFlow = (flowId: string) => {
    setDrawerOpen(false);
    onSelectionChange(flowId, undefined);
  };
  const treeProps = {
    groups: visibleGroups,
    query,
    expandedGroupIds: effectiveExpanded,
    selectedFlowId,
    onQueryChange: setQuery,
    onToggleGroup: (groupId: string) =>
      setExpanded((current) => toggleFlowGroup(current, groupId)),
    onSelectFlow: selectFlow,
  };

  return (
    <div className="flow-workspace" data-flow-workspace="true">
      <aside className="flow-workspace__rail">
        <FlowTree idPrefix="desktop" {...treeProps} />
      </aside>
      <main className="flow-workspace__content">
        <Button
          className="flow-workspace__browse"
          label="Browse flows"
          variant="secondary"
          size="sm"
          clickAction={() => setDrawerOpen(true)}
        />
        {invalidFlowId && (
          <div className="flow-workspace__notice" role="status">
            <span>Flow unavailable</span>
            <Button
              label="Dismiss"
              size="sm"
              variant="ghost"
              clickAction={() => onSelectionChange(undefined, undefined)}
            />
          </div>
        )}
        {selectedFlow ? (
          <FlowViewer
            flow={selectedFlow}
            app={app}
            platform={platform}
            version={version}
            initialStep={selectedStep}
            onBack={() => onSelectionChange(undefined, undefined)}
          />
        ) : visibleGroups.length ? (
          <FlowGallery groups={visibleGroups} onSelectFlow={selectFlow} />
        ) : (
          <EmptyState
            title="No flows match your search"
            description={`Nothing found for "${query}".`}
          />
        )}
      </main>
      <Dialog
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        purpose="info"
        width={320}
        maxHeight="100vh"
        position={{ top: 0, bottom: 0, left: 0 }}
        padding={0}
        className="flow-tree-drawer"
      >
        <div className="flow-tree-drawer__header">
          <strong>Flows</strong>
          <Button
            label="Close"
            size="sm"
            variant="ghost"
            clickAction={() => setDrawerOpen(false)}
          />
        </div>
        <FlowTree idPrefix="drawer" {...treeProps} />
      </Dialog>
    </div>
  );
}
```

Use `Dialog` rather than a custom overlay. The installed core dialog already
provides modal focus containment, Escape dismissal, body scroll locking, and
focus restoration to **Browse flows**.

- [ ] **Step 4: Reduce `FlowsPanel` to the composition boundary**

Replace the local search, batching, and `selectedId` state in
`src/vitrine/components/FlowsPanel.tsx` with:

```tsx
import { useMemo } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { buildFlowTreeGroups } from '../flowTree.ts';
import { FlowsWorkspace } from './FlowsWorkspace.tsx';
import { ReferenceGallerySection } from './ReferenceGallerySection.tsx';

export function FlowsPanel({
  flows,
  app,
  platform,
  version,
  selectedFlowId,
  selectedStep,
  onSelectionChange = () => undefined,
}: {
  flows: DesignFlow<EvidenceView>[];
  app?: string;
  platform?: Platform;
  version?: number;
  selectedFlowId?: string;
  selectedStep?: number;
  onSelectionChange?(flowId?: string, step?: number): void;
}) {
  const groups = useMemo(() => buildFlowTreeGroups(flows), [flows]);
  const selectedFlow = selectedFlowId
    ? flows.find(({ id }) => id === selectedFlowId)
    : undefined;
  const invalidFlowId = selectedFlowId && !selectedFlow
    ? selectedFlowId
    : undefined;

  if (flows.length === 0) {
    return (
      <ReferenceGallerySection>
        <EmptyState
          title="No captured flows yet"
          description="Import a curator-reviewed flow manifest to publish ordered evidence."
        />
      </ReferenceGallerySection>
    );
  }

  return (
    <FlowsWorkspace
      groups={groups}
      selectedFlow={selectedFlow}
      selectedFlowId={selectedFlowId}
      selectedStep={selectedStep}
      invalidFlowId={invalidFlowId}
      app={app}
      platform={platform}
      version={version}
      onSelectionChange={onSelectionChange}
    />
  );
}
```

- [ ] **Step 5: Run the workspace and existing gallery tests**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/FlowCard.test.tsx
npx tsc --noEmit
```

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the workspace composition**

```bash
git add src/vitrine/components/FlowsWorkspace.tsx src/vitrine/components/FlowsPanel.tsx src/vitrine/FlowTreeNavigation.test.tsx
git commit -m "feat: add persistent flow workspace"
```

---

### Task 5: Make Flow and step selection URL-controlled

**Files:**

- Modify: `src/vitrine/components/FlowViewer.tsx`
- Modify: `src/vitrine/components/FlowsWorkspace.tsx`
- Modify: `src/vitrine/components/FlowsPanel.test.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Add failing FlowViewer step-mapping tests**

In `src/vitrine/components/FlowsPanel.test.tsx`, import
`flowStepItems` from `FlowViewer.tsx` and add:

```tsx
test('maps lightbox items back to source step numbers when some steps lack evidence', () => {
  const items = flowStepItems({
    ...loginFlow,
    steps: [
      { label: 'Missing', evidence: [] },
      loginFlow.steps[0],
      loginFlow.steps[1],
    ],
  });
  assert.deepEqual(items.map(({ stepNumber }) => stepNumber), [2, 3]);
});

test('labels the viewer return action for the persistent workspace', () => {
  const html = renderToStaticMarkup(
    <FlowViewer flow={loginFlow} onBack={() => undefined} />,
  );
  assert.match(html, /Back to all flows/);
});
```

- [ ] **Step 2: Add failing route-boundary tests**

Add to `src/vitrine/ScreenDetail.test.tsx`:

```ts
test('forwards controlled Flow route state and an exact selection callback', () => {
  const source = readFileSync(
    new URL('./components/ScreenDetail.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /selectedFlowId=\{initialFlow\}/);
  assert.match(source, /selectedStep=\{initialStep\}/);
  assert.match(source, /onSelectionChange=\{\(flow, step\) => onFlowChange\?\.\(/);
  assert.match(source, /selectedPlatform/);
  assert.match(source, /sectionData\.resolvedVersion/);
  assert.match(source, /section === 'flows' \? <FlowsWorkspaceLoading/);
});
```

Add to `src/vitrine/App.boundary.test.ts`:

```ts
test('serializes Flow and step selection through the controlled App route', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /onFlowChange=\{\(flow, step, platform, version\) => navigate\(\{/);
  assert.match(source, /section: 'flows'/);
  assert.match(source, /\.\.\.\(flow \? \{ flow \} : \{\}\)/);
  assert.match(source, /\.\.\.\(step \? \{ step \} : \{\}\)/);
});
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx src/vitrine/ScreenDetail.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: FAIL because `flowStepItems`, the controlled Flow props, and
`onFlowChange` do not exist.

- [ ] **Step 4: Synchronize FlowViewer lightbox state with routed steps**

In `src/vitrine/components/FlowViewer.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';

export function flowStepItems(flow: DesignFlow<EvidenceView>) {
  return flow.steps.flatMap((step, stepIndex) => {
    const evidence = step.evidence[0];
    return evidence ? [{ evidence, stepNumber: stepIndex + 1 }] : [];
  });
}
```

Add the optional callback to both the destructured arguments and prop type:

```tsx
export function FlowViewer({
  flow,
  app,
  platform,
  version,
  initialStep,
  onBack,
  onStepChange,
}: {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  initialStep?: number;
  onBack: () => void;
  onStepChange?: (step?: number) => void;
}) {
```

Replace `stepImages` with:

```tsx
const stepItems = useMemo(() => flowStepItems(flow), [flow]);
const initialLightboxIndex = initialStep
  ? stepItems.findIndex(({ stepNumber }) => stepNumber === initialStep)
  : -1;
const [lightbox, setLightbox] = useState<LightboxState>(
  initialLightboxIndex >= 0 ? { index: initialLightboxIndex } : null,
);

useEffect(() => {
  const index = initialStep
    ? stepItems.findIndex(({ stepNumber }) => stepNumber === initialStep)
    : -1;
  setLightbox(index >= 0 ? { index } : null);
}, [flow.id, initialStep, stepItems]);
```

Open a step with:

```tsx
const openStep = (stepNumber: number) => {
  const index = stepItems.findIndex((item) => item.stepNumber === stepNumber);
  if (index < 0) return;
  setLightbox({ index });
  onStepChange?.(stepNumber);
};
```

Replace the existing step-card click handler with the source step number:

```tsx
onClick={() => openStep(index + 1)}
```

Close and navigate with:

```tsx
onClose={() => {
  setLightbox(null);
  onStepChange?.(undefined);
}}
onNavigate={(requestedIndex) => {
  const index = ((requestedIndex % stepItems.length) + stepItems.length)
    % stepItems.length;
  setLightbox({ index });
  onStepChange?.(stepItems[index].stepNumber);
}}
```

Replace the lightbox item lookup with:

```tsx
const item = stepItems[lightbox.index]?.evidence;
if (!item) return null;
```

Render `item.imageUrl` and `item.description` through the existing `Lightbox`
props, then change the back label to **Back to all flows**.

Pass the new callback from `FlowsWorkspace`:

```tsx
<FlowViewer
  flow={selectedFlow}
  app={app}
  platform={platform}
  version={version}
  initialStep={selectedStep}
  onBack={() => onSelectionChange(undefined, undefined)}
  onStepChange={(step) => onSelectionChange(selectedFlow.id, step)}
/>
```

- [ ] **Step 5: Add the ScreenDetail callback boundary**

Import the loading workspace beside `FlowsPanel`:

```tsx
import { FlowsWorkspaceLoading } from './FlowsWorkspace.tsx';
```

Extend `ScreenDetailProps`:

```ts
onFlowChange?: (
  flow: string | undefined,
  step: number | undefined,
  platform: Platform,
  version?: number,
) => void;
```

Destructure `onFlowChange`, then replace the FlowsPanel call with:

```tsx
<FlowsPanel
  flows={flows}
  app={app.id}
  platform={selectedPlatform}
  version={sectionData.resolvedVersion}
  selectedFlowId={initialFlow}
  selectedStep={initialStep}
  onSelectionChange={(flow, step) =>
    onFlowChange?.(
      flow,
      step,
      selectedPlatform,
      sectionData.resolvedVersion,
    )}
/>
```

Replace the generic loading branch with a Flow-specific workspace skeleton while
retaining the existing spinner for every other section:

```tsx
: sectionLoading
  ? section === 'flows'
    ? <FlowsWorkspaceLoading />
    : (
      <div
        role="status"
        aria-label="Loading section"
        style={{ display: 'flex', justifyContent: 'center', padding: 48 }}
      >
        <Spinner size="lg" />
      </div>
    )
```

- [ ] **Step 6: Serialize controlled selection in App**

Add this prop to the existing `ScreenDetail` call in `src/vitrine/App.tsx`:

```tsx
onFlowChange={(flow, step, platform, version) => navigate({
  name: 'app',
  appId: detailApp.id,
  section: 'flows',
  platform,
  version,
  ...(flow ? { flow } : {}),
  ...(step ? { step } : {}),
})}
```

Do not change `router.ts`; its existing allowlist and round-trip coverage already
support `flow` and `step`.

- [ ] **Step 7: Run focused routing and Flow tests**

Run:

```bash
npx tsx --test src/vitrine/components/FlowsPanel.test.tsx src/vitrine/FlowTreeNavigation.test.tsx src/vitrine/ScreenDetail.test.tsx
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/router.test.ts
npx tsc --noEmit
```

Expected: all focused tests pass; the existing route round trip remains
`/apps/15five/flows?platform=web&version=1&flow=onboarding&step=3`.

- [ ] **Step 8: Commit controlled route selection**

```bash
git add src/vitrine/components/FlowViewer.tsx src/vitrine/components/FlowsWorkspace.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "feat: sync flow navigation with routes"
```

---

### Task 6: Add responsive layout and visual states

**Files:**

- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/FlowTreeNavigation.test.tsx`

- [ ] **Step 1: Add a failing CSS boundary test**

Append to `src/vitrine/FlowTreeNavigation.test.tsx`:

```tsx
import { readFileSync } from 'node:fs';

test('defines the desktop rail and 980px drawer transition', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.flow-workspace\s*\{[\s\S]*grid-template-columns:\s*280px minmax\(0,\s*1fr\)/);
  assert.match(css, /\.flow-workspace__rail\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\]/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.flow-workspace__rail\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.flow-workspace__browse\s*\{[\s\S]*display:/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx
```

Expected: FAIL because the Flow workspace CSS does not exist.

- [ ] **Step 3: Add the dedicated Flow workspace styles**

Add one colocated block to `src/vitrine/styles.css`:

```css
.flow-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}

.flow-workspace__rail {
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.flow-workspace__rail--loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-workspace__content {
  min-width: 0;
}

.flow-workspace__content--loading {
  display: grid;
  min-height: 320px;
  place-items: center;
}

.flow-workspace__browse {
  display: none;
  margin-bottom: 16px;
}

.flow-workspace__notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-container);
  background: var(--color-background-muted);
}

.flow-tree {
  min-width: 0;
}

.flow-tree__search {
  margin-bottom: 12px;
}

.flow-tree__groups,
.flow-tree__flows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow-tree__group + .flow-tree__group {
  margin-top: 4px;
}

.flow-tree__group-button,
.flow-tree__flow-button {
  width: 100%;
  border: 0;
  color: var(--color-text-secondary);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.flow-tree__group-button {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  min-height: 38px;
  padding: 6px 8px;
  border-radius: 8px;
  font-weight: 700;
}

.flow-tree__group-label,
.flow-tree__flow-button {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-tree__count {
  color: var(--color-text-disabled);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.flow-tree__flows {
  padding-left: 24px;
}

.flow-tree__flow-button {
  min-height: 34px;
  padding: 6px 10px;
  border-radius: 8px;
}

.flow-tree__group-button:hover,
.flow-tree__flow-button:hover {
  color: var(--color-text-primary);
  background: var(--color-background-muted);
}

.flow-tree__group-button:focus-visible,
.flow-tree__flow-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.flow-tree__flow-button[aria-current='page'] {
  color: var(--color-text-primary);
  background: var(--color-background-selected, var(--color-background-muted));
  font-weight: 700;
}

.flow-tree__empty {
  margin: 16px 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.flow-tree__skeleton {
  display: block;
  width: calc(100% - 16px);
  height: 34px;
  margin-inline: 8px;
  border-radius: 8px;
  background: var(--color-background-muted);
  animation: flow-tree-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes flow-tree-pulse {
  from { opacity: 0.45; }
  to { opacity: 1; }
}

.flow-gallery {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.flow-gallery__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flow-gallery__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.flow-gallery__heading span:last-child {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
}

.flow-tree-drawer {
  border-radius: 0 var(--radius-container) var(--radius-container) 0;
}

.flow-tree-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.flow-tree-drawer .flow-tree {
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
}

@media (max-width: 980px) {
  .flow-workspace {
    display: block;
  }

  .flow-workspace__rail {
    display: none;
  }

  .flow-workspace__browse {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flow-tree__skeleton {
    animation: none;
  }
}
```

Use existing token names from `src/vitrine/styles.css`. If
`--color-background-selected` is not defined, keep the shown fallback rather
than adding a new global token.

- [ ] **Step 4: Run focused render and CSS tests**

Run:

```bash
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx src/vitrine/components/FlowsPanel.test.tsx
npx tsc --noEmit
```

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the responsive presentation**

```bash
git add src/vitrine/styles.css src/vitrine/FlowTreeNavigation.test.tsx
git commit -m "style: add responsive flow tree workspace"
```

---

### Task 7: Verify the complete Flow navigation slice

**Files:**

- Modify only files already in this plan if verification exposes a scoped
  regression.

- [ ] **Step 1: Run every focused Flow and route test**

Run:

```bash
node --experimental-strip-types --test src/vitrine/flowTree.test.ts src/vitrine/router.test.ts src/vitrine/App.boundary.test.ts
npx tsx --test src/vitrine/FlowTreeNavigation.test.tsx src/vitrine/FlowCard.test.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/components/FlowsPanel.test.tsx
```

Expected: all focused tests pass with 0 failures.

- [ ] **Step 2: Run repository verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected:

- `npm test`: exits 0 with no failed tests.
- TypeScript: exits 0.
- Vite production build: exits 0; the existing large-chunk warning is allowed.
- `git diff --check`: no output.

- [ ] **Step 3: Perform authenticated desktop browser acceptance**

Start the existing local API and Vite app using the repository's normal
development environment. Open an app/platform/version with at least two
categories and several Flows.

Verify:

1. The 280 px tree is visible to the left of the card gallery.
2. Category counts equal the number of child Flow rows.
3. Categories expand and collapse without changing the URL.
4. Category search displays every child; Flow-title search displays only
   matching leaves and cards.
5. Selecting a Flow keeps the tree mounted, highlights the Flow, and adds
   `flow=<id>` to the URL.
6. Opening, navigating, and closing step media updates or removes `step=<n>`.
7. Refresh restores the selected Flow and step.
8. **Back to all flows** removes Flow and step while preserving app, platform,
   and version.
9. **Create Feature Document** still receives the exact app, platform, version,
   and Flow.
10. No tree interaction makes a new network request.

- [ ] **Step 4: Perform narrow-layout browser acceptance**

At 980 px and below, verify:

1. The desktop rail is hidden.
2. **Browse flows** opens a left-positioned modal drawer.
3. Escape and backdrop click close the drawer.
4. Focus returns to **Browse flows**.
5. Search and disclosure state survive drawer close and reopen.
6. Selecting a Flow closes the drawer and opens the right-side viewer.
7. The page has no horizontal overflow.

- [ ] **Step 5: Review the integration diff**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
git log --oneline --decorate main..HEAD
```

Confirm:

- Only the files listed by this plan changed.
- No API, database, import, or Feature Document files changed.
- No unrelated dirty-worktree files were staged.
- Commit history contains the model, tree, gallery, workspace, route, and style
  checkpoints.

- [ ] **Step 6: Commit any verification-only fix**

Only if Steps 1–5 required a scoped correction:

```bash
git add -- src/vitrine/flowTree.ts src/vitrine/flowTree.test.ts src/vitrine/components/FlowTree.tsx src/vitrine/components/FlowGallery.tsx src/vitrine/components/FlowsWorkspace.tsx src/vitrine/components/FlowsPanel.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/components/FlowViewer.tsx src/vitrine/FlowTreeNavigation.test.tsx src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetail.test.tsx src/vitrine/App.tsx src/vitrine/App.boundary.test.ts src/vitrine/styles.css
git commit -m "fix: harden flow tree navigation"
```

If no correction was necessary, do not create an empty commit.
