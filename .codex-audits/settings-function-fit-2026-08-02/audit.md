# Settings UI and function-fit audit — 2026-08-02

## Audit scope

- Surface: authenticated Vitrine Settings workspace at `/settings/billing`.
- Goal: confirm that every visible section and control represents a real Vitrine capability and communicates its actual state.
- Mode: combined UX and accessibility review, grounded in current-run browser captures and implementation/API inspection.
- State: `admin@gmail.com`, Administrator, dark theme, 1512 × 778 desktop viewport.

## Overall verdict

The core section set is directionally right: Teams, password change, billing actions, referrals, and theme selection all connect to real functions. The highest-risk mismatch is Billing: the current Administrator account is treated as Pro by the application but rendered as Free with an Upgrade action in Settings. Settings navigation also looks like routable pages but is only local component state, and the header exposes Help and Notifications buttons that do nothing.

## Steps

### 1. Billing — needs correction

Evidence: `01-billing.png`

- The visible account is an Administrator, but Settings shows `Free`, `0 of 3 apps unlocked`, and `Upgrade`.
- Application access logic treats administrators as Pro while deliberately leaving `entitlements` null. Settings converts a null subscription to Free, so it displays a false plan and false CTA.
- The same null fallback also makes a member's subscription loading/error state look like Free instead of showing progress, error, and Retry.
- The available subscription model includes status, renewal/cancellation date, grace expiry, and export usage; the full-page Settings table hides most of those useful states.
- Strength: Upgrade and billing portal actions are connected to the real pricing and portal flows, and the HTTPS redirect is checked.
- Accessibility: table semantics and the action's accessible name are present.

### 2. Profile — partial match

Evidence: `02-profile.png`

- Email, role, and plan are real account values, but `Manage your Vitrine account details` implies edit capability while the section is read-only.
- `text-transform: capitalize` is applied to every definition value, visually changing `admin@gmail.com` to `Admin@Gmail.Com`. Account identifiers must never be cosmetically rewritten.
- The displayed Free plan repeats the Administrator billing mismatch.
- Strength: the account summary uses a clear definition-list structure.

### 3. Teams — functional but too implementation-shaped

Evidence: `03-teams.png`

- Team list, create Team, list members, add member by registered email, role selection, and removal are backed by real organization APIs with server-side owner/admin permission checks.
- `Teams` appears twice as H1 and H3, skipping H2 and weakening the hierarchy.
- The initial request starts with an empty list, so the UI can briefly show `Create your first Team` before data arrives. When Teams is disabled, the component returns nothing and leaves an unexplained blank section.
- Create and membership forms are always expanded across the full page. The functionality would read more clearly as a Team list plus explicit `Create Team` and `Invite member` actions that open focused dialogs.
- Removing a member has no confirmation step.
- Strength: input labels, disabled states, error alerts, and permission-based management controls are implemented.

### 4. Security — good function match

Evidence: `04-security.png`

- The form maps directly to the real current-password/new-password endpoint.
- Client and server both enforce the eight-character minimum, with disabled, loading, success, and error states.
- A confirmation field or reveal control would reduce accidental password typos, but it is an improvement rather than a missing backend function.

### 5. Appearance — good function match

Evidence: `05-appearance.png`

- Light, Dark, and System map directly to the real persisted theme preference.
- `Choose how Vitrine looks on this device` accurately communicates local persistence.
- The controls expose a labeled radio group and a checked state.

### 6. Global navigation — needs correction

- Profile, Teams, Security, and Appearance all leave the URL at `/settings/billing`. Refreshing from Appearance returned the user to Billing.
- Buttons use page-like selected styling and `aria-current="page"`, but there are no corresponding routes or browser-history entries.
- Help and Notifications are labeled interactive buttons, but current-run clicks produced no navigation, panel, dialog, or state change.
- Create Team opens the Teams section, but does not focus the Team-name action it advertises.

## Highest-impact recommendations

1. Make Settings consume an explicit account-access view: `loading | error | admin | subscription`, never infer Free from missing subscription data.
2. Add real section routes (`/settings/profile`, `/settings/teams`, `/settings/billing`, `/settings/security`, `/settings/appearance`) and derive the selected section from the route.
3. Remove Help and Notifications until their real destinations exist, or wire them to current product surfaces.
4. Make Profile honest: change its copy to `View your account details` now, and only restore `Manage` after editable profile functions exist. Remove capitalization from raw values.
5. Reshape Teams around its user tasks: Team selector/list, `Create Team`, and `Invite member`, with loading, unavailable, empty, and confirmation states.
6. Show the billing data Vitrine already owns: entitlement source, renewal/end date, past-due/grace state, and export usage.

## Evidence limits

- The audit did not submit a password change, create or remove a Team, start checkout, open Stripe billing, copy a referral link, or activate a reward because those actions mutate account or external state.
- Their client handlers and server endpoints were inspected, but successful production integration was not exercised.
- Screenshot and semantic inspection can identify accessibility risks, but this is not a full WCAG conformance claim or complete assistive-technology test.
- Browser console contained no errors during the captured flow.
