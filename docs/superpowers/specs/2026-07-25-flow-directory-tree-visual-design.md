# Flow Directory Tree Visual Design

**Date:** 2026-07-25
**Status:** Approved

## Purpose

Refine the existing app-detail Flow navigation so it reads as a compact
directory tree instead of a stack of menu buttons. Keep the tree on the left
and preserve the existing Flow gallery and viewer on the right.

This is a visual and semantic refinement of the approved persistent Flow-tree
workspace. It does not change imported Flow data, grouping, routing, or the
right-pane content.

## Product outcome

The left rail should resemble a familiar file explorer:

```text
Search flows…

Flows                                      12
├─ ▾ Onboarding                             3
│  ├─ Inviting a team member
│  ├─ Starting a trial
│  └─ Completing setup
├─ ▸ Account settings                       5
└─ ▾ Standalone flows                       4
   └─ Resetting a password
```

The hierarchy remains category to Flow. Lines and icons communicate that
hierarchy without implying that categories or Flows are actual filesystem
objects.

## Visual hierarchy

### Root

- Add a compact root header labelled **Flows** above the category list.
- Show the total visible Flow count at the far right.
- The root is presentational and is not collapsible.
- Keep the search field directly above the root.

### Category rows

- Use a chevron disclosure icon followed by a folder icon.
- Keep the category label on one line with ellipsis overflow.
- Keep the child count aligned to the far right in muted text.
- Use a 32 px row height and modest horizontal padding.
- Do not render category rows as pills or cards.
- Hover uses a subtle neutral background across the full row.

### Flow rows

- Indent Flow rows beneath their category.
- Add a small Flow/document icon before the title.
- Draw a subtle vertical branch line from the category and a short horizontal
  connector into each Flow row.
- Use a 30 px row height, one-line title, and ellipsis overflow.
- The selected Flow uses one subdued full-width highlight, stronger text, and
  a narrow accent indicator at the left edge of the row.
- Hover and focus must remain distinguishable from selection.

## Layout

- Keep the desktop tree as the first column of the existing workspace.
- Retain the current 280 px rail and flexible right pane.
- Preserve the sticky, independently scrolling desktop rail.
- Do not add a card border or elevated container around the entire tree.
- Keep the same directory presentation inside the existing mobile drawer.

## Interaction and accessibility

- Preserve the existing nested-list structure.
- Category rows remain native disclosure buttons with `aria-expanded` and
  `aria-controls`.
- Flow rows remain native buttons with `aria-current="page"` for selection.
- Do not introduce `role="tree"` because the application does not implement
  the complete ARIA tree keyboard model.
- Search continues to expand matching groups without replacing saved user
  expansion state.
- Selecting a Flow continues to update the route and render it in the right
  pane.
- Existing mobile drawer behavior remains unchanged.

## Implementation boundary

Expected production changes:

- `src/vitrine/components/FlowTree.tsx`
  - add the root summary row;
  - add category folder icons and Flow leaf icons;
  - add structural classes needed for branch connectors.
- `src/vitrine/styles.css`
  - restyle only the Flow-tree selectors into compact explorer rows;
  - leave unrelated existing edits untouched.

Expected verification changes:

- `src/vitrine/FlowTreeNavigation.test.tsx`
  - verify the root label and total;
  - verify folder and Flow-leaf structure;
  - retain disclosure, selection, responsive, and Astryx-control assertions.

No changes are expected in:

- Flow grouping or filtering;
- API or database schemas;
- URL serialization;
- `FlowViewer`, Flow cards, or evidence rendering;
- imported category and Flow records.

## Acceptance criteria

- The desktop navigation is visibly a left-side directory tree.
- Categories have chevrons, folder treatment, child counts, and nested branch
  lines.
- Flows appear as compact leaf rows rather than independent menu buttons.
- The active Flow is immediately identifiable without a pill-style treatment.
- Long category and Flow labels truncate safely.
- Search, expansion, route selection, mobile drawer behavior, and keyboard
  focus remain functional.
- Focused Flow-navigation tests and the production build pass.
