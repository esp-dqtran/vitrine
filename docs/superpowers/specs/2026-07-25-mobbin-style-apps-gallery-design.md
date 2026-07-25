# Mobbin-style Apps gallery design

Date: 2026-07-25
Status: Approved

## Goal

Make the Astryx Apps gallery visually consistent with:

1. Mobbin's live Web Apps discovery screen.
2. Astryx's current Sites discovery screen.

This is a layout-only change for the `/apps` gallery. It must not redesign App
detail pages or change how Apps are loaded, searched, imported, paginated, or
opened.

## Visual sources

The design is grounded in fresh Chrome captures taken at a 1512 x 834 viewport:

- `artifacts/apps-ui-comparison/01-mobbin-apps.png`
- `artifacts/apps-ui-comparison/02-astryx-apps-current.png`

Measured Mobbin desktop characteristics:

- 72 px full-width top navigation.
- 32 px page gutters.
- Four equal discovery columns: Categories, Screens, UI Elements, and Flows.
- Platform and ordering controls directly above the gallery.
- Three gallery columns at 1512 px.
- 472 x 472 px media panels with 28 px corner radii.
- Dark `rgb(20, 20, 20)` page background and subtle translucent card surfaces.

The Astryx Sites page already implements the intended structural hierarchy:

- full-width sticky top navigation;
- centered search;
- Apps/Sites navigation;
- discovery taxonomy;
- ordering and filter row;
- responsive media-first grid;
- loading, empty, filtered-empty, and error states inside the same frame.

## Chosen approach

Use the Sites discovery structure as the rendering model for Apps, while keeping
Apps-specific data and interactions separate.

Extract the existing Sites top-navigation geometry into a shared reference
discovery top nav, then use it from both routes. Share the discovery-frame
spacing and responsive grid rules through explicit Apps/Sites selectors. Keep
taxonomy, ordering, filtering, cards, and state copy in route-specific
components. Existing Sites render tests must remain byte-for-byte compatible
for its visible labels and semantic markers.

The existing `ReferenceGalleryShell` is not the Apps gallery target because its
constrained header and toolbar hierarchy do not match Mobbin or the current
Sites screen.

## Apps gallery structure

### Top navigation

The Apps route uses the same full-width top-navigation geometry as Sites:

- Vitrine identity at the left.
- Apps and Sites controls beside the identity, with Apps selected.
- centered App search control.
- account controls at the right.
- an admin-only import action remains available in the right action group.

The Apps screen must not render the admin sidebar around this route. This
matches the way the Sites route currently owns its full-width discovery frame.

### Discovery taxonomy

The desktop taxonomy contains four columns:

- Categories: Productivity, Business, Finance, Health & Fitness, Developer Tools.
- Screens: Filter & Sort, Chat Bot, Signup, Settings & Preferences, Charts.
- UI Elements: Navigation Menu, Dialog, Card, Dropdown Menu, Text Field.
- Flows: Setting Up, Searching & Finding, Filtering & Sorting, Resetting Password,
  Reporting.

Each item is an interactive filter backed by existing App metadata:

- Categories match `app.cat`.
- Screens match `screen.type` and `screen.productArea`.
- UI Elements match `screen.componentNames` and `screen.layoutPatterns`.
- Flows match `screen.visibleStates`, `screen.stateContext`, and screen
  descriptions.

No new API or database field is required.

Only one taxonomy item is active at a time. Selecting the active item clears it.

### Ordering and filters

The control row follows Mobbin's hierarchy:

- platform selector with iOS and Web;
- ordering controls: Latest, Most popular, Top rated, Animations;
- Filter action aligned to the far right.

Platform selection uses the App data already returned by the catalog. Ordering
uses available local fields:

- Latest: descending `lastCapturedAt`, preserving API order when dates match or
  are absent.
- Most popular: descending `totalScreens`.
- Top rated: descending mean of available `screen.confidence` values, followed
  by analyzed coverage and current API order.
- Animations: Apps with `previewVideoUrl` first, then current API order.

The Filter action collapses or expands the taxonomy, matching the Sites
interaction. It does not open a new modal.

### App cards

Cards remain backed by Astryx App data and real captured media.

Desktop cards use Mobbin's media-first proportions:

- three columns at the measured desktop viewport;
- a large square rounded media surface;
- screenshots centered without stretching or fabricated imagery;
- New, Updated, or existing import-status badges when real status data exists;
- App logo, name, and description below the media surface;
- the full card opens the existing App detail route;
- existing carousel behavior remains available when an App has several screens.

Cards must use existing icons, screenshots, videos, logos, and Astryx design
tokens. No placeholder art, handcrafted SVG, or copied Mobbin asset is added.

## State and data flow

`useApps` remains the only Apps catalog loader. The page consumes:

- `apps`
- `totalApps`
- `loading`
- `loadingMore`
- `hasMore`
- `error`
- `refresh`
- `loadMore`

The existing near-viewport sentinel continues lazy pagination. Search,
taxonomy, platform, and ordering are view-level derivations of the loaded Apps;
they do not add catalog polling or replace pagination.

The gallery frame covers:

- initial loading skeletons;
- API error with retry;
- no published Apps;
- no Apps matching current filters;
- populated results;
- loading-more sentinel.

The import dialog continues to submit directly through `submitUrlImport`.

## Responsive behavior

- Desktop: four taxonomy columns and three App columns.
- Medium screens: taxonomy wraps to two columns and the gallery becomes two
  columns.
- Mobile: navigation wraps with full-width search, taxonomy becomes one column,
  the control row remains horizontally understandable, and the gallery becomes
  one column.

The existing Sites breakpoints and spacing rules are the baseline. Apps-specific
rules may differ only where the App card's square media treatment requires it.

## Accessibility

- Apps/Sites and ordering controls expose selected state.
- Platform controls use a labelled single-selection control.
- Taxonomy filters expose pressed state.
- The full card has a clear accessible name.
- Search, import, account, filter, retry, and pagination states remain keyboard
  accessible.
- Loading and empty states retain status or alert semantics.

## Behavior boundaries

The implementation must preserve:

- zero `GET /api/jobs` requests from the Apps screen;
- direct import submission through `POST /api/jobs`;
- member `/api/catalog` versus admin `/api/apps` loading;
- lazy pagination through the existing sentinel;
- App detail navigation and entitlement gating;
- search palette and advanced-search handoff;
- collection, settings, and account overlays.

The implementation must not change:

- App detail pages;
- Sites visual output or behavior;
- crawler/admin monitoring surfaces;
- database schema or catalog APIs;
- authentication, billing, collections, or research projects.

## Verification

Use test-first implementation:

1. Add a failing Apps boundary/render test for the Sites-style discovery frame,
   Mobbin taxonomy, platform/order controls, and media-first grid.
2. Confirm the test fails because the current `ReferenceGalleryShell` output
   lacks those elements.
3. Implement the minimum Apps layout change.
4. Run focused Apps, Sites, import, pagination, and no-job-polling tests.
5. Run the build.
6. Capture the rendered Apps screen in Chrome at the same 1512 x 834 viewport.
7. Compare the Mobbin reference and Astryx result together, fix visible layout
   mismatches, and capture the final result.

## Acceptance criteria

- `/apps` visibly follows Mobbin's Apps discovery hierarchy.
- `/apps` and `/sites` share the same Astryx discovery-frame language.
- Desktop layout matches the measured 72 px nav, 32 px gutters, four taxonomy
  columns, three media-card columns, and large rounded card treatment.
- Apps-specific controls work with existing data.
- Existing App behavior boundaries remain intact.
- Sites output remains unchanged.
- Focused tests and the production build pass.
- Chrome comparison confirms the final rendered state rather than only code or
  unit-test output.
