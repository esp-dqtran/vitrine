# Public Apps Home with Private App Details

## Goal

Make `/apps` Vitrine's public Home/catalog page so visitors can browse published apps without signing in, while keeping every app-detail route and detail API private.

The existing logged-out Landing experience remains unchanged.

## Product Boundary

Public visitors can:

- open `/apps` directly;
- browse published App cards and preview media;
- use the catalog's public search and category filtering;
- continue through progressive catalog pagination;
- follow navigation to pricing, sign-in, or registration.

Public visitors cannot:

- view `/apps/:appId` or any nested app-detail section;
- load full Screens, UI Elements, Flows, extracted design systems, or Feature Documents;
- use Collections, account settings, exports, unlocks, or other member actions;
- use admin import, lifecycle, or progress controls.

Opening an App card as a visitor preserves the intended `/apps/:appId` URL and presents sign-in. After authentication, the existing route is still active, so the user continues to the requested App detail.

## Route and Authentication Design

`Root` in `src/vitrine/main.tsx` becomes explicit about the three public surfaces:

1. the existing Landing and marketing routes;
2. the `/apps` public catalog;
3. public Feature Document share links.

When no user is authenticated:

- `route.name === "apps"` renders the catalog application in guest mode;
- `route.name === "app"` and all other member routes continue to render `SignIn`;
- the current path is not rewritten, which preserves post-authentication continuation;
- `/landing` and other marketing-route rendering remain unchanged.

Authenticated members and admins continue to enter the existing application behavior. The change must not add a second catalog route or duplicate the App gallery.

## Shared Catalog and Guest Mode

`App` remains the owner of the Apps gallery. It derives a guest state from the absence of an authenticated user and passes only public-safe capabilities to the gallery.

Guest mode:

- loads `/api/catalog` through the existing `useApps(undefined, true)` path;
- renders real published previews through `ReferenceGalleryShell` and `AppCard`;
- replaces the empty account dropdown with explicit **Log in** and **Get started** actions;
- keeps local catalog search, category filtering, result counts, and progressive pagination available;
- avoids loading entitlements, Collections, settings, projects, admin progress, or import state;
- does not expose advanced previews, comparison, save, export, unlock, or collection actions.

The member and admin modes keep their current controls. Guest branching must be capability-based and narrowly placed around controls or requests that require authentication; it must not fork the complete gallery implementation.

## Search Behavior

Guest search operates on the published catalog data already returned by `/api/catalog`.

- Text and category filtering remain available.
- Opening the search surface must not call protected Collections or entitlement endpoints.
- If advanced semantic search requires authentication, the guest surface presents the public catalog search and offers sign-in for the advanced capability instead of issuing a protected request.
- Search selection follows the same private-detail transition as clicking an App card.

This preserves a useful public discovery experience without making private research or saved-library data public.

## Private Detail Enforcement

Frontend routing is not the security boundary. The API continues to enforce authentication before app-detail endpoints.

The public route boundary stays above the authentication middleware for:

- `GET /catalog`;
- published preview media used by catalog cards;
- public catalog statistics where already supported.

The following remain below authentication middleware and must return `401` without a valid session:

- `GET /apps/:app`;
- `GET /apps/:app/screens`;
- `GET /apps/:app/ui-elements`;
- `GET /apps/:app/flows`;
- version, page-preview, design-system, export, unlock, and other app-detail endpoints.

Existing entitlement checks, published-version filtering, traversal limits, referral recording, and protected-media URLs remain unchanged after authentication.

## Interaction Lifecycle

### Visitor opens `/apps`

1. `Root` recognizes the public catalog route.
2. `App` renders in guest mode.
3. `useApps` fetches the first published catalog page.
4. Filtering and progressive loading operate on public catalog data.

### Visitor opens an App

1. The App card navigates to `/apps/:appId`.
2. `Root` sees a private route without a user.
3. `SignIn` renders without replacing the intended URL.
4. Successful authentication re-renders `Root`.
5. The existing authenticated App-detail lifecycle loads entitlements and authorized detail data.

### Member logs out from `/apps`

1. Authentication state becomes anonymous.
2. The route remains `/apps`.
3. The catalog switches to guest controls instead of redirecting to Landing.

### Visitor opens a private deep link

An anonymous request to `/apps/:appId`, including a nested section or query context, renders sign-in and preserves the full location for continuation after authentication.

## Loading and Error States

- Guest loading uses the existing gallery shell and App-card skeletons.
- A public catalog failure keeps the guest navigation and offers the existing retry action.
- An empty published catalog uses public-facing copy and never offers Import.
- A protected detail API returning `401` after session expiry transitions through the existing authentication/session handling rather than leaking partial detail data.
- Progressive-loading failures preserve already loaded public cards and expose a retry path without requiring sign-in.

## Accessibility

- **Log in** and **Get started** are labelled controls, not icon-only actions.
- App cards retain their existing accessible App names.
- Sign-in remains a distinct page transition when a visitor chooses a private App.
- Focus returns to a predictable catalog control after closing any guest search surface.
- Guest-only messaging explains that App details require an account without implying that the catalog itself is locked.

## Testing

Follow test-driven development.

### Routing

- Anonymous `/apps` renders the Apps gallery, not `SignIn` or `Home`.
- Anonymous `/apps/:appId` renders `SignIn`.
- Anonymous nested App-detail URLs preserve their path and query.
- Successful login on a private App URL renders that App detail.
- `/landing`, pricing, build-in-public, and public share behavior remain unchanged.

### Guest catalog

- Guest mode requests `/api/catalog` and never `/api/apps`.
- Guest loading, populated, empty, error, filtered-empty, and progressive-loading states render correctly.
- Guest controls show **Log in** and **Get started** and omit account, Collections, Settings, Import, progress, unlock, and admin actions.
- Opening guest search does not request protected Collections, entitlements, jobs, or advanced-search endpoints.
- Selecting an App transitions to the private App route.

### API boundary

- `/catalog` and its published preview media remain public.
- Metadata, Screens, UI Elements, Flows, versions, previews, and other App-detail endpoints return `401` without a session.
- Authenticated entitlement and admin behavior retain their current responses.

### Regression verification

- Focused routing and Apps-gallery tests pass.
- API authorization tests pass.
- Existing zero-`GET /api/jobs` Apps-screen boundary remains enforced.
- TypeScript, Vite production build, and `git diff --check` pass.
- The final implementation diff contains no changes to `src/vitrine/Home.tsx`.

## Non-Goals

- Redesigning or editing the Landing page.
- Making App details or evidence media public.
- Making Collections, Feature Documents, exports, projects, or settings public.
- Replacing the current entitlement model.
- Creating a duplicate public-catalog component or API.
- Changing Site visibility.
- Deploying, migrating the database, or changing published catalog data.
