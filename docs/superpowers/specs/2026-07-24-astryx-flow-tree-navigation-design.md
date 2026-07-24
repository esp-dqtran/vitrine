# Astryx Flow Tree Navigation Design

**Date:** 2026-07-24
**Status:** Approved design, pending written-spec review

## Purpose

Render the imported Flow hierarchy as persistent navigation on the left side of
the app-detail **Flows** section. Keep Astryx's visual Flow gallery and detailed
Flow workspace on the right.

The result should feel familiar to someone using an IDE explorer without
turning Flows into a filesystem or introducing arbitrary folders.

## Verified current state

- `DesignFlow.category` stores the parent grouping imported from Mobbin.
- Flows without a category are valid.
- `FlowsPanel` already groups Flow cards by category, searches Flow titles, and
  progressively renders cards in batches.
- Selecting a Flow currently replaces the whole `FlowsPanel` with `FlowViewer`.
- App routes already carry optional Flow and step identifiers.
- Feature Document creation remains an action inside `FlowViewer`.
- The Flow catalog is already loaded as one section result, so rendering a
  text-only navigation tree does not require another API request.

Mobbin's current Flow page uses collapsible category nodes containing selectable
Flow leaves. Category nodes are organizational groups rather than parent Flow
records. Astryx will preserve that distinction.

## Product outcome

The app-detail Flows section becomes a two-pane workspace:

```text
┌──────────────────────────┬──────────────────────────────────────┐
│ Search flows…            │ Flow gallery or selected Flow       │
│                          │                                      │
│ ▾ Onboarding          2  │ Existing visual Flow cards           │
│   Inviting a member      │ or                                   │
│   Starting a trial       │ existing FlowViewer                  │
│                          │                                      │
│ ▾ Dashboard           1  │                                      │
│   Complete setup         │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

The tree remains mounted while the right pane changes between the gallery and a
selected Flow.

## Scope

### Included

- One category-to-Flow hierarchy derived from existing Flow data.
- Persistent desktop tree navigation in the Flows section.
- A mobile tree drawer.
- Category expansion and collapse.
- Category and Flow-title search.
- Selected Flow highlighting.
- URL-backed Flow and step selection.
- Existing gallery, progressive rendering, Flow viewer, and Feature Document
  creation preserved in the right pane.
- Recovery when a routed Flow no longer exists.
- An extension point for later displaying Feature Document state beside a Flow.

### Not included

- Database or API schema changes.
- Arbitrary user-created folders.
- Drag-and-drop reorganization.
- Moving imported Flows between categories.
- More than one category nesting level.
- Aggregate Feature Documents for categories.
- Feature Document revisions in the tree.
- Cross-app or cross-platform navigation.
- Replacing the visual gallery with a text-only explorer.

## Information architecture

The hierarchy is:

```text
App
└── Current platform and version
    └── Category
        └── Flow
```

The app, platform, and version remain controlled by the existing app-detail
page. The new tree begins at category level because it is scoped to the active
Flows section.

The trimmed `DesignFlow.category` value is the category identity. This merges
otherwise identical labels that differ only by surrounding whitespace. Flows
with a missing, empty, or whitespace-only category appear under **Standalone
flows**. Categories sort by label using locale-aware ascending order. Flows
retain their source order inside each category.

Category names are not routes and are not treated as Flow IDs.

## Component design

`FlowsPanel` becomes the state and routing boundary for a new workspace:

```text
FlowsPanel
└── FlowsWorkspace
    ├── FlowTree
    │   ├── FlowTreeSearch
    │   ├── FlowGroup
    │   └── FlowTreeItem
    └── FlowWorkspaceContent
        ├── Existing ReferenceGallerySection
        └── Existing FlowViewer
```

### `FlowsWorkspace`

- Owns the two-pane desktop layout and mobile drawer.
- Owns search text and the user's expanded-category set so the tree and gallery
  consume the same filtered Flow set.
- Keeps the tree mounted when right-pane content changes.
- Does not own Flow grouping or route serialization.

### `FlowTree`

- Receives normalized category groups, search text, expansion state, and the
  selected Flow ID.
- Reports search, disclosure, and selection actions to `FlowsWorkspace`.
- Renders every Flow name because the tree is lightweight text navigation.
- Uses nested lists with disclosure buttons and ordinary selectable Flow
  buttons.
- Exposes selection through a callback; it does not render `FlowViewer`.

### `FlowWorkspaceContent`

- Renders the existing gallery when no valid Flow is selected.
- Renders the existing `FlowViewer` for a valid selection.
- Keeps gallery progressive rendering independent from the tree.

### Existing components

- `FlowCard` keeps its current visual behavior.
- `FlowViewer` keeps step rendering and Feature Document creation.
- `ReferenceGallerySection` and `ReferenceGalleryGrid` remain the gallery
  primitives.

## State and routing

### Route state

The existing app route is the source of truth for selected Flow and step.

- Selecting a Flow updates the current route's Flow identifier.
- Selecting a step updates its step identifier through the existing route
  serializer.
- Selecting **Back to all flows** clears Flow and step identifiers while
  retaining app, section, platform, and version.
- A refresh or copied URL restores the same Flow and step.
- Local `selectedId` state must not compete with route state.

If the route refers to a Flow that is absent from the loaded result:

1. Render the normal gallery.
2. Show a non-blocking **Flow unavailable** notice.
3. Keep app, platform, and version unchanged.
4. Clear the invalid Flow and step identifiers when the user dismisses the
   notice or selects another Flow.

### Expansion state

- Category expansion is local UI state.
- Categories are expanded on first render to match the source hierarchy's
  discoverability.
- User changes are preserved while the mounted app/platform/version workspace
  remains active.
- The category containing a routed Flow always expands.
- Search uses a derived expansion view and must not overwrite the user's saved
  expansion set.
- Clearing search restores the pre-search expansion state.

### Search state

Search is local to the active Flows workspace and is not written to the URL.

- Matching is case-insensitive after trimming the query.
- A category match shows the category and all its child Flows.
- A Flow-title match shows that Flow and its category.
- Matching categories expand automatically.
- Selecting a result preserves the query.
- No matches render an empty result inside the tree while leaving a selected
  Flow visible in the right pane.
- When no Flow is selected, the gallery uses the same filtered Flow set as the
  tree.

## Interaction design

### Categories

- The whole category row is a disclosure control.
- The row contains its label, child count, and expanded/collapsed indicator.
- Activating it changes expansion only; it does not open an aggregate page.

### Flows

- A Flow row is a selectable button identified by Flow ID.
- Selection opens the Flow in the right pane and updates the route.
- The selected row has a persistent active background and
  `aria-current="page"`.
- Duplicate titles remain safe because identity is never title-based.

### Returning to the gallery

`FlowViewer`'s existing back action becomes **Back to all flows**. It clears the
route selection and changes only the right pane. The tree, search query, and
category expansion remain intact.

## Responsive layout

### Desktop

At widths above the existing 980 px app-detail breakpoint:

- The tree column is 280 px wide.
- The right pane uses the remaining width with `min-width: 0`.
- The panes have a 32 px gap.
- The tree is sticky within the Flows section and has its own vertical scroll
  when its content exceeds the viewport.
- Scrolling Flow cards or Flow steps does not remove the tree.

### Mobile and narrow layouts

At 980 px and below:

- The right pane uses the full available width.
- A **Browse flows** button opens the tree in a drawer.
- The drawer contains the same search and tree components as desktop.
- Selecting a Flow closes the drawer and opens the Flow.
- Search and expansion state survive drawer close and reopen for the mounted
  workspace.
- Focus returns to **Browse flows** when the drawer closes.

## Accessibility

Use nested list and disclosure semantics rather than `role="tree"`. A full ARIA
tree would require an additional arrow-key and focus-management contract that
is outside this slice.

- Category controls are buttons with `aria-expanded` and an associated child
  list.
- Flow buttons expose the selected state.
- Every control has a visible focus treatment.
- Enter and Space activate focused buttons using native behavior.
- The mobile drawer traps focus while open, closes with Escape, and restores
  focus to its trigger.
- Selection changes do not move keyboard focus into the right pane
  automatically.
- The unavailable-route notice uses a non-interruptive status announcement.

## Loading, empty, and failure behavior

- While Flow data loads, show lightweight tree-row skeletons beside the
  existing content loading state.
- If the catalog has no Flows, retain the current **No captured flows yet**
  empty state and do not render an empty desktop rail.
- If search finds no matches, show **No flows match your search** in the tree.
- A missing category is normalized into **Standalone flows**.
- A category with no children is never rendered.
- Rendering the tree does not introduce another network request or its own
  retry state.

## Performance

- Group and normalize Flows once per loaded Flow array.
- Apply search and derived expansion from the normalized groups.
- Render all tree labels; do not apply the gallery's card batching to the tree.
- Preserve `FLOW_BATCH_SIZE` and the existing intersection observer for Flow
  cards.
- Do not preload evidence media from tree rows.

## Verification

### Unit and component coverage

- Normalizes categorized, blank-category, and uncategorized Flows.
- Sorts categories and preserves Flow source order.
- Renders category counts and nested Flow rows.
- Expands and collapses categories.
- Automatically expands the category of a routed Flow.
- Search matches category labels and Flow titles.
- Clearing search restores user expansion state.
- Selecting a Flow updates route state and keeps the tree mounted.
- Back clears Flow and step state while preserving the workspace.
- A routed step restores the correct `FlowViewer` state.
- A missing routed Flow renders the gallery and unavailable notice.
- Duplicate Flow titles select by ID.
- The existing empty state and progressive gallery sentinel remain intact.
- Feature Document creation still receives exact app, platform, version, and
  Flow context.

### Accessibility coverage

- Category controls expose their expanded state.
- The selected Flow exposes `aria-current="page"`.
- Keyboard activation works for category and Flow buttons.
- Drawer focus is trapped and restored.

### Responsive and browser acceptance

- Desktop shows a fixed-width left tree and flexible right pane.
- The tree stays available while browsing and viewing a Flow.
- Narrow layouts use the drawer without horizontal overflow.
- Deep links restore Flow and step selection after refresh.
- Search and expansion survive mobile drawer close and reopen.

## Rollout boundary

This change is a navigation and layout refactor inside the Flows section. It
does not change imported Flow records, generation jobs, Feature Documents, or
database state.

After this slice is verified, a later design can add a Feature Document status
indicator or child action to each Flow row without changing the hierarchy.
