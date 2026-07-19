# App Deep-Link Loading Design

## Problem

The admin Apps catalog initially loads 24 apps. A direct URL such as
`/apps/quora/screens` parses correctly, but the detail view looks for `quora`
only in that first page. Pagination is disabled while an app route is active,
so an app outside the first page can never resolve and the gallery is rendered
instead.

## Design

Extend the Apps data hook with an optional requested app slug. After the normal
catalog page loads, if that slug is not present, request the existing
`GET /api/apps/:slug` endpoint and convert its `{ app, screens }` response into
the same `App` shape used by the gallery. Merge the requested app into local
state without replacing or duplicating the catalog page.

`App.tsx` will pass the route slug only when the current route is an app route.
The existing `detailApp` lookup, access controls, unlock gate, platform/version
loading, and ScreenDetail rendering remain unchanged.

## Error Handling

- A missing app (`404`) leaves the gallery available and records a detail-load
  error rather than discarding the successfully loaded catalog.
- Authorization responses continue to be enforced by the existing API route.
- Route changes cancel or ignore stale deep-link requests so an older response
  cannot open the wrong app.

## Testing

Add a regression test around the Apps data-loading boundary proving that an app
slug absent from the first admin page triggers a direct detail request and is
merged into the available apps. Also verify that an app already present in the
first page is not fetched twice. Run the focused Vitrine tests, TypeScript/build
checks, and then confirm `/apps/quora/screens` renders Quora in the authenticated
local UI.

## Scope

This change only repairs direct app deep links. It does not change page size,
gallery pagination, publication state, crawl data, or import workers.
