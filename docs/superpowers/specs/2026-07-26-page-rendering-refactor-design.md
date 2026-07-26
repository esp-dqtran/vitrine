# Page Rendering Refactor Design

## Goal

Refactor Vitrine page rendering so every route produces an explicit page, redirect, loading state, or access-denied state; application-wide controls work on every member page; and unrelated pages do not ship in the initial route bundle.

## Boundaries

- Keep `/apps`, `/sites`, pricing, build-in-public, landing, and Feature Document shares public.
- Keep App detail, Site detail, Search, Projects, Feature Documents, Settings, Billing success, and Admin private.
- Preserve the existing typed `Route`, `navigate`, and `useRoute` API.
- Do not add React Router or another routing dependency.
- Do not change page visuals except where a previously blank or disconnected state becomes explicit.
- Preserve the current `main` worktree and do not commit or push.

## Architecture

### Route decisions

A pure route-decision function accepts the current route, authentication state, user role, and feature flags. It returns one exhaustive decision:

- render a public page;
- render an application page;
- render sign-in;
- redirect to a canonical route;
- render not-found or unavailable.

The decision function uses a `switch` over the typed route name and an `assertNever` fallback. Authorization and feature-flag handling therefore live beside page selection instead of being split between `main.tsx`, `routeAccess.ts`, and fall-through branches in `App.tsx`.

Authenticated landing/sign-in routes redirect to Apps. Non-admin Admin access renders an access-denied state. Disabled Search and Research Projects routes render an unavailable state. Unknown URL paths produce an explicit not-found route rather than silently becoming landing.

### Application frame

`App` continues to own authenticated catalog-wide state during this refactor, but it renders one stable application frame around a page outlet. The frame owns:

- the optional Admin sidebar;
- Collections and Settings panels;
- Quick Search or Command Palette;
- advanced-result preview;
- login, import, and unlock dialogs.

Pages no longer opt into these overlays by manually appending them to individual return branches. A control that changes frame state will therefore always have a mounted consumer.

### Page outlet

The application page outlet is an exhaustive switch that renders one page component for each application route. Route-specific data remains enabled only for its relevant route.

The App-detail loading UI moves to `AppDetailLoadingPage`. It composes the existing discovery top navigation with a loading mode of the shared detail shell, so loading and loaded layouts use the same structural boundary.

### Code loading

Marketing and application page modules use `React.lazy` at route boundaries with one shared full-page `Suspense` fallback. Small frame primitives and overlays that must remain interactive across page changes stay eager.

### Navigation

All history writes go through a shared location-update helper. Typed route navigation keeps using `navigate`. Search pages may update query strings without changing the route name, but use the same helper so subscribers receive one consistent location event.

## Error handling

- Authentication loading has an explicit full-page loading state.
- Unknown paths render Not Found.
- Unauthorized roles render Access Denied.
- Disabled feature routes render Feature Unavailable.
- App entitlement and data failures keep their existing retry/error content.
- No route may fall through to an empty fragment.

## Testing

1. Table-driven pure tests cover every route for guest, member, and admin contexts.
2. Behavior tests verify authenticated landing/sign-in redirects, non-admin Admin denial, and disabled-feature states.
3. Rendered frame tests verify Collections and Settings remain mounted for Site detail and framed Admin pages.
4. Shell tests verify App-detail loading uses the shared detail boundary.
5. Navigation tests verify query updates notify route subscribers.
6. Existing source-regex tests that assert component location are replaced with rendered behavior assertions.
7. Focused tests, the complete project suite, Vite build, and `git diff --check` are required before completion.
