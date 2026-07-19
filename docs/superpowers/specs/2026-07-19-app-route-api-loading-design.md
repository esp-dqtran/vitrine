# Route-Aware Apps API Loading Design

## Status

Approved for implementation by the user's "Fix all for me" response after the live API-call review. This design supersedes the gallery-first loading approach in `2026-07-19-app-deep-link-loading-design.md`.

## Problem

The authenticated React shell currently treats the Apps gallery as the source of truth for both `/apps` and `/apps/:slug/:section`. A detail route must therefore load `GET /api/apps` before it can load the requested app. `ScreenDetail` then discovers the selected version and requests the first screen page again, eagerly requests UI elements even when another section is open, and loads the design-system snapshot once before and once after version discovery.

Live verification on `/apps/nordvpn/screens` showed ten JSON/data requests and twenty-five media requests. The critical data path was serialized through authentication, the gallery, the one-screen detail response, the version list, and finally the first 48-screen page. The Apps gallery itself was healthy: one request per required endpoint, one progress SSE connection, and no `GET /api/jobs` requests.

## Goals

- `/apps` loads the Apps gallery once and preserves it while the user visits details.
- `/apps/:slug/:section` never requests the Apps gallery merely to resolve the detail app.
- A cold detail route starts with a direct 48-screen detail request rather than a one-screen metadata request followed by another screen request.
- The selected published version is initialized from the detail response and does not trigger an identical first-page reload.
- UI-element data is requested only when the UI Elements section needs raw element crops.
- The design-system snapshot is requested once for the resolved platform and version.
- Admin sessions do not request subscription data because admin access bypasses the Free unlock gate.
- Collections load when a collections surface or picker needs them, not on every authenticated route.
- Existing entitlement enforcement, gallery pagination, platform/version switching, progress SSE behavior, imports, exports, review actions, and media authorization continue to work.

## Non-Goals

- Changing API authorization rules, pagination limits, crawl workers, import verification, or persisted catalog data.
- Combining every detail resource into a new server-side aggregate endpoint.
- Prefetching all detail sections in the background.
- Removing media requests required to render the currently selected section.

## Considered Approaches

### 1. Route-aware gallery and detail loaders — selected

Keep the existing API routes but give gallery state and detail state separate loaders. Reuse the current `GET /api/apps/:slug` response as the initial 48-screen detail page, initialize its version/platform metadata directly, and lazy-load section-specific data.

This produces the smallest backend change, preserves current authorization behavior, removes the serial gallery dependency, and makes each request owner explicit.

### 2. Keep `useApps` and parallelize the detail request

Start `GET /api/apps` and `GET /api/apps/:slug` together and merge their results. This improves cold-detail latency but still downloads gallery data that the detail route does not use, still couples detail rendering to gallery state, and still refetches when `requestedAppId` changes.

### 3. Add one aggregate detail endpoint

Create an endpoint returning app metadata, versions, screens, UI elements, and design-system data together. This minimizes request count but over-fetches every section, makes pagination and platform changes harder to cache independently, and increases backend scope without solving section ownership cleanly.

## Architecture

### Gallery ownership

`useApps` owns only gallery pages. It receives an `enabled` flag derived from `route.name === 'apps'` or from an explicit gallery consumer such as the command palette. The hook retains successful pages while disabled and does not refetch merely because the user returns from a detail route. Its existing `refresh` function remains the explicit way to force a reload.

The gallery continues to request:

- `GET /api/apps` for admins, with cursor pagination.
- `GET /api/catalog` for regular users, with its existing catalog pagination.
- `GET /api/progress/stream` only while the Apps progress banner is mounted.

It must make zero `GET /api/jobs` requests.

### Detail ownership

A new detail loader owns `/apps/:slug/*`. It calls `GET /api/apps/:slug?limit=48` directly and preserves the response metadata needed by `ScreenDetail`:

- `app`
- `screens`
- `nextCursor`
- selected `version`

The version list request may run in parallel with the direct detail request. The route renders from detail state instead of `apps.find(...)`.

The loader is disabled for a locked Free account until entitlement data resolves. Admin detail loading starts immediately and never waits for subscription data. API authorization remains the final enforcement layer.

### Entitlements and collections

`GET /api/billing/subscription` runs only for non-admin users because only those users can be Free-gated. A direct locked deep link opens the unlock flow without first downloading the Apps gallery.

Collections are represented by an unloaded/loaded state rather than treating an empty array as both states. `ensureCollections()` deduplicates an in-flight request and is called before opening the Collections panel or a collection picker. The account UI omits the count until collections are loaded. Saving or creating a collection refreshes the loaded collection state as it does today.

### Screen, version, and platform data

`ScreenDetail` accepts the initial selected version and next cursor from the direct detail response. It does not immediately call `selectVersion` for the same version.

When the user selects a different version or platform, the component requests that platform/version's first 48 screens and updates its cursor. Subsequent screen pages remain cursor-driven and load only while the Screens section sentinel is active.

### UI Elements

Raw UI-element crops are not requested during Overview, Screens, Flows, Design System, Export, or Review. On the first visit to UI Elements:

- If the versioned design-system snapshot already contains analyzed components, render those components and do not request raw crops.
- Otherwise request `kind=ui_element&limit=48` for the active platform/version.
- Preserve loaded element pages while switching sections.
- Reset and reload element state only when platform or version changes.

### Design system

The design-system loader waits until the initial detail version is known. It requests exactly one of:

- `GET /api/design-systems/:slug?platform=:platform&version=:version` when a version exists.
- `GET /api/design-systems/:slug?platform=:platform` when the app has no version.

Changing platform or version aborts the stale request and loads the new exact snapshot once.

## Error Handling

- Gallery and detail errors are independent; a failed detail request cannot discard a preserved gallery page.
- Aborted route, platform, version, and section requests do not surface as user errors or update stale state.
- Non-abort failures remain visible and retryable; they are not converted into empty successful data.
- UI-element failures affect only the UI Elements section.
- A `403` detail response for a regular user remains protected by the entitlement/unlock flow and API authorization.

## Expected Request Contracts

### Cold admin Apps route

- One `GET /api/auth/me` from authentication bootstrap.
- One `GET /api/apps` for the first gallery page.
- One `GET /api/progress/stream` SSE connection while progress is displayed.
- Visible thumbnail media requests.
- No subscription, collections, detail, design-system, UI-element, or jobs request until the matching feature is used.

### Cold admin Screens detail route

- One `GET /api/auth/me` from authentication bootstrap.
- One direct `GET /api/apps/:slug?limit=48`.
- One `GET /api/apps/:slug/versions?platform=:platform`, run without waiting for the gallery.
- One versioned design-system request.
- Visible screen thumbnail media requests.
- No `GET /api/apps`, subscription, collections, UI-element, progress-stream, or jobs request.

### Detail section changes

- UI Elements: at most one raw UI-element page request if analyzed components are unavailable, plus visible media.
- Flows: no JSON/data request; visible evidence media may load.
- Design System, Export, and Review: no request merely from selecting the section.
- Explicit export, review, collection, version, platform, unlock, or pagination actions retain their own existing requests.

## Testing

Automated tests will prove:

- Gallery loading does not issue a detail request and detail loading does not issue a gallery request.
- Disabling and re-enabling a loaded gallery does not refetch it.
- Admin sessions skip subscription loading; regular users retain it.
- Collections are absent from cold Apps/detail loads and deduplicated when opened.
- A detail response initializes 48-screen state, selected version, and cursor without reloading the same first screen page.
- UI elements load only on the UI Elements section and only when raw crops are needed.
- The design system receives the resolved version on its first and only initial request.
- Platform/version changes abort stale work and request only the newly selected resources.
- Existing pagination, deep-link, access-gate, Apps no-jobs, and duplicate-request regression tests remain green.

Live verification will capture browser network events for `/apps`, `/apps/:slug/screens`, and each detail section. Completion requires the request contracts above, a successful production build, and the relevant automated test suites passing.
