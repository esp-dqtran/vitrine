# Lazy App Detail Sections Design

## Problem

Opening `/apps/:app` currently requests a page of screens and then starts version and design-system requests even when the user only wants app information. The route couples lightweight app identity and aggregate metadata to potentially large section payloads. That makes the first render slower, obscures request ownership, and allows inactive sections to consume database and network capacity.

## Goal

Make the default app Overview metadata-only. Screens, UI Elements, Flows, Design System, Export, and Review load their own data only after the user opens the corresponding section. Returning to a section during the same app-detail visit reuses its cached data.

## Non-goals

- Changing the Apps gallery pagination or search behavior.
- Changing app access, entitlement, or administrator permissions.
- Prefetching likely sections in the background.
- Combining unrelated section data into a new general-purpose query API.
- Persisting section caches across a browser reload or a different app-detail visit.

## API boundaries

### App metadata

`GET /api/apps/:app` returns only app information:

- stable app slug and display name;
- icon, category, website, and accent metadata;
- supported platforms that have persisted evidence;
- aggregate screen, UI-element, and flow counts;
- analysis and last-captured summaries when available.

The metadata response contains no screen, UI-element, flow, design-system, or version arrays. It accepts no `limit`, `cursor`, `kind`, `platform`, or `version` query parameters.

### Screens

`GET /api/apps/:app/screens?platform=:platform&version=:version&cursor=:cursor&limit=:limit`

Returns a paginated screen page, the next cursor, and the resolved version. The server clamps `limit` to the existing safe range of 1–48. When `version` is omitted, the endpoint resolves the latest accessible version for the requested platform, with the existing administrator fallback for unversioned imported evidence.

### UI Elements

`GET /api/apps/:app/ui-elements?platform=:platform&version=:version&cursor=:cursor&limit=:limit`

Uses the same pagination and version rules as Screens but returns only persisted `ui_element` evidence.

### Flows

`GET /api/apps/:app/flows?platform=:platform&version=:version`

Returns only flows for the resolved platform and version. It does not hydrate or return tokens, components, or the complete design-system snapshot.

### Versions and design system

The existing `GET /api/apps/:app/versions` route remains the version-selector source, but the client calls it only after opening a data-bearing section. The existing design-system route is called only for Design System, Export, or Review. Export and Review may reuse the same in-memory design-system result.

All endpoints retain the current authentication, entitlement, traversal-limit, protected-media URL, and audit-event behavior.

## Client data flow

1. Navigating to `/apps/:app` calls only the metadata endpoint.
2. Overview renders the metadata response. It contains no screen preview carousel and does not start version or design-system effects.
3. Opening a data-bearing section resolves the default platform from metadata, loads versions for that platform if needed, and loads that section's data.
4. Screens and UI Elements append cursor pages and deduplicate records by evidence ID.
5. Changing platform or version requests only the active section for the new selection.
6. Browser Back and Forward synchronize the active section before deciding what to load.
7. Leaving the app route aborts outstanding metadata, version, and section requests.

## Cache ownership

The app-detail component owns an in-memory cache for the current visit:

- metadata key: app slug;
- versions key: app slug plus platform;
- section key: app slug plus section plus platform plus resolved version;
- paginated pages are stored under the same section key with the latest next cursor.

Opening a previously loaded section with the same platform and version makes no request. A platform or version change selects a different cache key rather than clearing unrelated cached sections. A successful curator mutation invalidates only the affected app, platform, version, and section keys.

## Loading and failure behavior

- Metadata has route-level loading, not-found, access-denied, error, and retry states.
- Section loading appears inside the active section and never hides already loaded app metadata.
- A section error is isolated to that cache key and offers an inline retry.
- Retrying replaces only the failed request; successfully loaded sections remain cached.
- Aborted requests do not render errors or populate the cache.
- Empty Screens, UI Elements, or Flows responses render an explicit section-specific empty state.
- A missing requested version renders the existing unavailable-version state rather than falling back to data from another platform.

## Compatibility and migration

The current mixed `/api/apps/:app?limit=...` response is replaced rather than retained as a hidden compatibility path because the only supported client is updated in the same change. Shared database helpers may power the three section endpoints, but their public responses remain distinct. The unused `fetchAppDetail` helper and mixed response types are removed so future callers cannot accidentally restore eager screen loading.

## Verification

Automated tests must prove:

- `/api/apps/:app` returns metadata and no section arrays;
- metadata counts are aggregate database values and do not require loading all evidence rows;
- each section endpoint returns only its declared data and enforces access controls;
- opening Overview makes exactly one app-metadata request and zero versions, screens, UI-elements, flows, design-system, collection, billing-for-admin, or jobs requests;
- opening each section starts only its own required requests;
- returning to a cached section makes no request;
- platform and version changes reload only the active section;
- pagination requests one next page and deduplicates appended evidence;
- section failures remain local and retry only the failed section;
- route changes and browser history abort or reuse requests correctly;
- Apps continues to make zero `GET /api/jobs` requests.

Browser verification must capture request traces for cold Overview, first opening of every section, tab revisits, platform switching, pagination, Back/Forward navigation, and one failed-section retry.

## Acceptance criteria

- A cold visit to `/apps/claude` makes one app-metadata API request before user interaction.
- The Overview displays app identity, supported platforms, and aggregate counts without screen previews.
- No section data is requested until its section becomes active.
- Reopening a loaded section during the same visit is instantaneous and makes no duplicate request.
- Screens, UI Elements, and Flows have independent payloads, loading states, errors, retries, and caches.
- Existing access controls, protected media, pagination limits, version selection, and curator workflows continue to work.
