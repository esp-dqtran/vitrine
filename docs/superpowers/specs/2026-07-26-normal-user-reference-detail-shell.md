# Normal-user Reference Detail Shell

## Decision

Normal users receive a shared, Mobbin-inspired detail shell for Apps and
Sites. The shell reuses Astryx data, assets, actions, and routes; it does not
copy Mobbin catalog content. Admin detail pages and admin navigation remain
unchanged.

The approved normal-user information architecture is intentionally simple:

- App: `Screens`, `UI Elements`, `Flows`
- Site: `Preview`, `Sections`

Astryx-only analysis, design-system, review, pipeline, and export surfaces are
not shown as primary normal-user tabs in this iteration.

## Source reference

Chrome CDP captures from 2026-07-26 are stored in:

`.superpowers/references/2026-07-26-mobbin-detail/`

The source establishes these shared behaviors:

- one global discovery navigation and search;
- a large identity hero with logo, name, description, metadata, and actions;
- version selection followed by content tabs;
- dense visual content immediately below the tabs;
- related references after the primary content;
- a compact mobile layout that preserves content and actions.

## Shared normal-user shell

Reuse and generalize the existing `ReferenceDetailShell`, which already renders
the App detail experience. `ScreenDetail` keeps consuming it and
`SiteVersionView` moves its duplicated hero and tab chrome into the same
component. The shared shell is used for the normal-user App and Site routes and
owns:

- the existing Astryx Apps/Sites discovery navigation;
- responsive page padding and maximum content width;
- identity logo, title, optional description, metadata, and action slots;
- optional version selector;
- accessible tab navigation;
- content and related-reference slots;
- loading, empty, and error presentation.

The shell uses the existing Apps-led Vitrine color and typography tokens. It
must not introduce another gray palette or duplicate top-navigation styling.

## App detail

The App hero shows the app icon, display name, description when available,
platform, category, last-updated time, and screen count. Existing normal-user
actions remain available when supported by the current permissions.

The content tabs are:

1. `Screens`: the current screen gallery, preserving platform/version context.
2. `UI Elements`: component crops and UI-element evidence.
3. `Flows`: flow groups and ordered screen sequences.

The selected tab is route-backed so refresh, back/forward navigation, and deep
links preserve the active section.

## Site detail

The Site hero shows the site logo, display name, description when available,
category/style metadata, last-updated time, page/section counts, and the
existing safe external-site action.

The content tabs are:

1. `Preview`: the full-page captured preview.
2. `Sections`: the current section gallery and section inspection entry points.

The existing Site version selection and captured evidence remain the source of
truth. The shared shell replaces duplicated member-facing page chrome, not the
Site data model.

## Responsive behavior

- Desktop keeps the oversized identity hero and full-width evidence grid.
- Tablet reduces hero scale and grid columns without hiding metadata.
- Mobile uses the compact Mobbin hierarchy: smaller identity, horizontally
  usable tabs, stacked or scrollable metadata, and single-column media.
- No metadata or action may be clipped off-screen.
- Media uses its native aspect ratio; screenshots are never stretched.

## Access and role boundaries

- Public discovery remains public.
- Detail routes remain available only under the project’s existing normal-user
  access rules.
- Admin users continue to receive the existing admin shell and admin-only tabs.
- No admin-only action becomes visible through the shared normal-user shell.

## Accessibility and motion

- Tabs retain semantic links or tablist behavior and visible focus states.
- Navigation and actions have accessible names.
- Content remains usable without hover.
- Existing short Vitrine transitions are reused and reduced-motion preferences
  are honored.

## Verification

- Unit tests cover role-based shell selection and approved tab visibility.
- App tests cover Screens, UI Elements, and Flows routes.
- Site tests cover Preview and Sections routes.
- Admin regression tests confirm the admin shell and admin-only controls are
  unchanged.
- The production build succeeds.
- Desktop and mobile screenshots are compared against the captured Mobbin
  hierarchy and checked for clipping, image distortion, spacing, typography,
  border, and radius mismatches.
