# Sites Detail Apps-Style Presentation

Date: 2026-07-27
Status: Approved direction

## Summary

Apply the compact visual language of the Apps detail screen to the Sites detail
screen through the existing `ReferenceDetailShell`. Preserve every Site-specific
route, tab, action, selector, data request, and content panel.

The result should make Apps and Sites feel like two reference types in one
product without pretending that their data models are identical.

## Problem

Apps detail currently presents its identity, metadata, actions, navigation, and
content in a compact hierarchy. Sites detail uses the same shell but retains a
taller, looser presentation:

- the logo, title, description, metadata, and actions consume more vertical space;
- the version selector and tabs feel visually separate from the hero;
- content begins much lower on the page;
- shared shell elements have different type scale, spacing, and control treatment.

This makes Sites feel like a separate product even though Apps and Sites share
navigation and the same detail-shell architecture.

## Goals

- Make Sites detail visually follow the current Apps detail screen.
- Reuse the shared `ReferenceDetailShell` instead of creating a parallel Site shell.
- Keep the Site description visible in a quieter, compact treatment.
- Preserve the Site version selector, Preview, Sections, and Technology tabs.
- Preserve Save and Visit Site actions.
- Preserve existing responsive behavior and improve mobile visual consistency.
- Keep Apps-specific controls, including the platform switcher and Figma action,
  isolated from Sites.

## Non-Goals

- No API, database, queue, crawler, or persistence changes.
- No route or authorization changes.
- No tab renaming, reordering, addition, or removal.
- No changes to Preview, Sections, Technology, inspector, filtering, or related
  Sites behavior.
- No attempt to make Site data structurally identical to App data.
- No new visual assets.

## Existing Architecture

`ReferenceDetailShell.tsx` owns the shared hero, identity, metadata, actions,
tabs, navigation, and body frame. `ScreenDetail.tsx` supplies Apps content and
state. `SiteVersionPage.tsx` supplies Sites content and state.

The shell already emits `data-reference-detail="app"` or
`data-reference-detail="site"`. Current Apps presentation rules are primarily
scoped to the App value, which is why the two screens look different despite
sharing markup.

## Design

### Shared compact shell

Move only transferable detail-screen presentation into shared
`ReferenceDetailShell` styles. These shared rules cover:

- hero height and horizontal alignment;
- identity mark size and radius;
- title and secondary-description typography;
- metadata label/value scale and spacing;
- action alignment and pill sizing;
- navigation height, tab spacing, muted/active colors, and underline;
- body start position and horizontal page gutters.

Keep rules that encode App behavior scoped to
`[data-reference-detail="app"]`, including the platform switcher and any
App-only action treatment. Keep Site-only metadata links and the version menu
scoped to Site classes.

Do not duplicate the entire Apps rule set under Site selectors. The shared
shell should own the common visual language so future tuning stays synchronized.

### Desktop hero

At desktop widths, Sites detail follows the live Apps composition:

- the Site logo sits at the left at the same visual size as the App logo;
- the Site name aligns beside the logo using the Apps title scale;
- the description remains below the title as one restrained secondary line,
  wrapping only when necessary;
- Category, Style, Pages, Sections, and Last Updated form the same compact
  metadata row used by Apps;
- Save and Visit Site sit at the far right using the same control height,
  radius, and visual weight as the Apps primary action.

The second Site action remains visually secondary. Both actions retain their
existing click behavior.

### Navigation

The version selector remains at the leading edge of the Site navigation. It is
styled as a quiet utility control so Preview, Sections, and Technology remain
the dominant navigation choices.

The Site tabs adopt the Apps tab typography, spacing, hover state, active color,
underline geometry, and horizontal overflow behavior. The existing sliding
indicator logic remains unchanged.

### Body

The active Site panel begins at the same visual rhythm as Apps content. Preview
retains its single large captured-page stage. Sections retains its toolbar,
selection behavior, grid, and inspector. Technology retains its current
evidence and package presentation. Related Sites remains below the active
panel.

Only outer spacing and alignment change; panel internals and data are unchanged.

### Responsive behavior

At narrower widths:

- identity and title remain the first visual group;
- metadata wraps without changing order or meaning;
- actions stay reachable and use full-width layout only when required;
- the version selector and tabs remain horizontally scrollable;
- no tab label is truncated;
- existing Site media and section grids continue using their current breakpoints.

The mobile result should feel like the same compact detail system, not a
desktop header squeezed into one row.

## Data Flow and Behavior

`SiteVersionPage` continues to request the selected Site version and related
Sites exactly as it does today. `SiteVersionView` continues to resolve the
active section, filters, saved state, inspector state, version changes, and
external Site navigation.

The presentation change does not introduce new state, effects, fetches, cache
invalidation, or navigation paths.

## Loading and Error States

Site loading and failure states should use the same page gutters and vertical
rhythm as the updated detail shell. Their messages, retry behavior, and back
navigation remain unchanged.

Long titles, missing logos, missing descriptions, sparse metadata, and multiple
versions must continue to render without collapsing the hero or overlapping
actions.

## Testing

- Add a focused style regression test proving Site detail receives the shared
  compact hero and tab treatment.
- Preserve an explicit boundary test proving App-only platform and action rules
  do not leak into Sites.
- Keep existing `SiteVersionView` rendering and interaction tests unchanged
  except where presentation assertions intentionally change.
- Run the focused ReferenceDetailShell, Apps detail, and Sites detail suites.
- Run the production build.
- Compare Apps and Sites detail at the same desktop viewport.
- Verify Sites detail at a mobile viewport, including tab overflow, metadata
  wrapping, actions, Preview, Sections, and Technology.

## Acceptance Criteria

- Apps and Sites detail visibly share one header, metadata, action, tab, and
  body-spacing system.
- Site description, metadata, version selector, actions, and all three current
  tabs remain present.
- Preview, Sections, Technology, version changes, Save, Visit Site, related
  Sites, loading, failure, and inspector behavior remain functional.
- Apps detail remains visually unchanged.
- No App-only control styling leaks into Sites.
- Desktop and mobile layouts have no clipping, overlap, or unintended overflow.
