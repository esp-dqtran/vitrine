# Public Catalog Login Modal Design

## Goal

Replace the two guest catalog actions, `Log in` and `Get started`, with one primary `Login` button that opens authentication in a modal without leaving Apps or Sites.

## Architecture

- Add an embedded presentation mode to the existing `SignIn` component.
- Embedded mode reuses the existing sign-in/signup state, validation, referral handling, authentication calls, and success panel, but omits the full-viewport shell and decorative showcase.
- Add a focused `LoginDialog` component that renders embedded `SignIn` inside the design-system `Dialog`.
- Let `App` own the dialog-open state and provide `authenticate`, `register`, and `completeLogin` from the existing auth context.
- Update `GuestCatalogControls` to render one primary `Login` button whose callback opens the dialog.

The standalone `/signin` route continues to render the full existing experience.

## Interaction

1. A guest clicks `Login` in either the Apps or Sites header.
2. The modal opens over the current catalog route.
3. The guest may sign in or switch to account creation using the existing form behavior.
4. Successful authentication updates the shared auth context.
5. The modal closes while the current catalog route remains selected.
6. The guest controls are replaced by the authenticated account menu.

Closing the modal through its close control, backdrop, or Escape leaves the catalog unchanged.

## Components

### `SignIn`

Add an optional `embedded` boolean. The default remains `false`, preserving `/signin`. In embedded mode, render only the reusable authentication content at modal width.

### `LoginDialog`

Accept:

- `isOpen`;
- `onClose`;
- `authenticate`;
- `register`;
- `onSignedIn`.

It owns only the design-system dialog wrapper and delegates authentication behavior to embedded `SignIn`.

### `GuestCatalogControls`

Replace both existing buttons with one primary, small `Login` button. Its callback is renamed from route-oriented `onSignIn` to modal-oriented `onLogin`.

## Testing

- Assert guest controls render exactly one primary `Login` action and no `Log in` or `Get started`.
- Assert the dialog renders embedded authentication without the full-page showcase.
- Assert `App` opens the dialog from guest controls and closes it after successful authentication.
- Preserve standalone `SignIn` tests and public Apps/Sites route behavior.
- Run guest-control, sign-in, Apps, Sites, App boundary tests, and the production build.
