# Admin Dashboard Rendering Separation Design

## Goal

Separate the Admin dashboard renderer from the normal Vitrine application renderer without changing how regular product pages look based on role.

Normal users and admins must see the same page structure on Apps, Sites, Search, Projects, App detail, Site detail, Feature Documents, Settings, and Billing routes. A role may enable additional actions, such as Import, but it must not select a different layout for those routes.

The `/admin` route is the only separate Admin dashboard experience in this scope. Its only page is Users.

## Boundaries

- Keep `/apps` and `/sites` public.
- Keep the existing private-route and feature-flag behavior.
- Keep `/admin` private and admin-only.
- Do not add an admin preview or role-switching mode.
- Do not move Import, crawler management, Search, Projects, or Feature Documents into the Admin dashboard.
- Do not add additional Admin dashboard routes.
- Do not add a routing dependency.
- Preserve the current dirty `main` worktree.
- Do not commit or push unless the user requests it.

## Architecture

### Root render decision

The root route decision gains an explicit Admin dashboard result. For an authenticated admin on `/admin`, it returns `admin-dashboard` rather than the normal `application` result.

The resulting top-level render choices are:

- public page;
- sign-in;
- normal application;
- Admin dashboard;
- redirect;
- loading;
- denied or unavailable state.

A guest opening `/admin` still receives sign-in. An authenticated non-admin still receives the existing access-denied state. The Admin dashboard module is not loaded for either case.

### Normal application renderer

`App` becomes the renderer for normal product routes only:

- Apps and App detail;
- Sites and Site detail;
- Search;
- Projects and Project detail;
- Feature Documents;
- Settings and Billing-related application state.

`App` no longer imports or renders `UsersPage`, selects an Admin sidebar, tracks `useAdminFrame`, or owns an `/admin` page branch.

Admins entering any normal product route use this same renderer and page composition as normal users. Existing permission checks may still expose authorized actions or data, but role cannot change the application shell.

### Admin dashboard renderer

A lazy-loaded `AdminDashboard` owns the `/admin` experience. It receives the authenticated admin identity and logout behavior from the root boundary.

The dashboard contains:

- a dedicated Admin shell;
- an Admin sidebar with Vitrine identity;
- one selected navigation item, Users;
- a Back to Vitrine action that navigates to `/apps`;
- account identity and Log out controls;
- the existing lazy-loaded `UsersPage` as its page outlet.

The dashboard must not initialize the normal application's catalog, App detail, subscription, collections, search-session, overlay, or dialog state.

The existing general `Sidebar` is not reused because it mixes product navigation with Admin navigation. A focused `AdminSidebar` makes the dashboard boundary explicit and avoids adding conditionals to a shared navigation component.

### Shared components

The separation applies to render ownership, not to low-level visual primitives. The Admin dashboard may continue using Astryx design-system components such as `AppShell`, `SideNav`, buttons, menus, spinners, and theme tokens.

`UsersPage` retains its current ownership of Users analytics, directory data, loading, error, retry, and responsive content layout. This refactor does not redesign Users.

## Data and navigation flow

1. `Root` reads the typed route and authentication state.
2. `decideRootRoute` returns `admin-dashboard` only for `/admin` plus an admin session.
3. `Root` lazy-loads `AdminDashboard`.
4. `AdminDashboard` renders its shell and lazy Users outlet.
5. `UsersPage` loads only its existing Users dependencies.
6. Back to Vitrine uses typed navigation to `{ name: 'apps' }`.
7. Log out uses the existing authentication provider behavior.

Normal product routes continue through `App` and its persistent application surface. No normal route passes through `AdminDashboard`.

## Loading and error handling

- Root authentication loading retains the full-page loading state.
- Lazy Admin dashboard loading uses the root Suspense fallback.
- Lazy Users-page loading uses a dashboard-local page fallback so the Admin shell remains visible.
- Users data-loading, error, and retry behavior stays inside `UsersPage`.
- Guest `/admin` access renders sign-in.
- Non-admin `/admin` access renders Admin access required.
- No role or route may fall through to an empty page.

## Testing

### Route decisions

- Admin `/admin` returns `admin-dashboard`.
- Member `/admin` returns denied.
- Guest `/admin` returns sign-in.
- Admin and member sessions return the same `application` decision for every normal application route.

### Render boundaries

- Root lazy-loads `AdminDashboard` separately from `App`.
- `App` contains no `UsersPage`, Admin sidebar, `useAdminFrame`, or `/admin` rendering branch.
- `AdminDashboard` renders its dedicated shell, Users navigation, Back to Vitrine action, account identity, and Users outlet.
- The dashboard keeps its shell mounted while the Users page is suspended.

### Isolation

- Rendering the Admin dashboard does not initialize Apps catalog, App detail, collections, subscription, search-session, application overlays, or application dialogs.
- Existing capability-based Admin actions on normal pages remain available.
- Existing public Apps/Sites behavior and private detail boundaries remain unchanged.

### Verification

- Run focused route-decision and render-boundary tests.
- Run existing Apps, Sites, authentication, Users, and Admin access tests.
- Run the production build and inspect the Admin chunk boundary.
- Run the complete project suite and separate unrelated baseline failures from regressions.
- Run `git diff --check`.

## Migration sequence

1. Add failing tests for the new root decision and render isolation.
2. Add the explicit `admin-dashboard` decision.
3. Create `AdminSidebar` and `AdminDashboard`.
4. Route `/admin` from `Root` to the lazy Admin dashboard entry.
5. Remove Admin dashboard rendering from `App`.
6. Update affected boundary tests.
7. Run focused and full verification.
