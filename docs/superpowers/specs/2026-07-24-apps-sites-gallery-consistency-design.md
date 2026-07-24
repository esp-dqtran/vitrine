# Apps and Sites Gallery Consistency

## Goal

Make the Sites gallery use the same visual shell and page-state structure as the Apps gallery while preserving each reference type's specialized behavior.

## Scope

The change covers the `/apps` and `/sites` gallery routes.

Both routes will share:

- the admin `References` header placement and description;
- the member-facing Vitrine identity and account-controls placement;
- reference-type tabs;
- the sticky toolbar container and spacing;
- result-count placement;
- gallery grid dimensions and spacing;
- loading, error, no-results, and empty-catalog page-state structure.

Apps will retain:

- its search trigger and advanced-search handoff;
- category filtering;
- progressive catalog loading and sentinel;
- import progress and App status badges;
- its existing import dialog and entitlement behavior;
- zero `GET /api/jobs` requests from the Apps screen.

Sites will retain:

- its direct text search;
- refresh behavior;
- Site cards and Site-specific metadata;
- its Site import dialog and navigation;
- its existing Site API and lifecycle.

The change does not merge App and Site routes, APIs, database models, version models, ingestion, or lifecycle state.

## Design

Introduce a small shared gallery-shell component in `src/vitrine/components`. It owns only the common page chrome and state layout. Its inputs are compositional slots and simple state metadata, including:

- active reference type;
- optional admin header action;
- toolbar content;
- optional status content;
- result count;
- loading skeleton state;
- error and empty-state content;
- gallery children and optional trailing pagination content.

The shell must not fetch data or understand App or Site records. `App.tsx` continues to own App data, search, entitlements, pagination, and navigation. `SitesPage.tsx` continues to own Site loading, search, refresh, import, and navigation.

Member identity and account controls are supplied to the shell by the route owner. `SitesPage` therefore receives the same member-header content that Apps already renders, without moving authentication or account state into the Sites module.

Specialized controls remain specialized: Apps supplies `SearchTrigger`; Sites supplies `SearchInput` plus refresh. The controls occupy the same toolbar region and follow the same spacing, but their behavior is not artificially unified.

## Page States

Loading keeps the shared header or member identity, tabs, toolbar placeholder, and nine gallery skeletons visible.

Load errors keep the shared shell and tabs visible, then show the route-specific error message and retry action in the shared state region.

An empty catalog uses the shared state region with route-specific copy. A non-empty catalog with no matching Site search uses the same region with the current Site-specific no-results copy.

Apps progressive loading remains below the grid and does not change its current cursor or sentinel behavior.

## Accessibility

- Preserve the `Reference type` tablist and selected-tab semantics.
- Preserve the loading status label and retry/import button labels.
- Keep search controls labelled by their existing components.
- Do not remove route-specific card labels such as `Open <name>`.

## Testing

Follow test-driven development:

1. Add focused rendering tests that fail against the current mismatch.
2. Assert Apps and Sites use the same gallery-shell landmarks and ordering.
3. Assert member Sites receives the Vitrine identity/account-controls slot and omits the admin page header.
4. Assert admin Sites retains `Import Site`, refresh, direct search, and Site cards.
5. Assert loading, error, empty, and no-results states retain tabs and shared chrome.
6. Preserve the existing Apps boundary test that prohibits `GET /api/jobs`.
7. Run focused Vitrine tests, the relevant full test command, and the production build.

## Non-Goals

- A shared App/Site database abstraction.
- A combined App/Site API endpoint.
- Identical search behavior.
- Changes to detail pages.
- New pagination for Sites.
- Restyling cards beyond their already-shared `PreviewCarouselCard` foundation.
