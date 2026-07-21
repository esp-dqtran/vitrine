# Free and Pro Subscription Experience Design

## Outcome

Astryx customers can start on Free, deliberately unlock three permanent applications, upgrade to Pro through Stripe Checkout, see their current billing state, manage the subscription through Stripe Customer Portal, and immediately receive the correct server-enforced Pro capabilities after Stripe confirms the subscription.

## Plan contract

Astryx has two customer plans. The existing `admin` role remains operational and is not a paid plan.

- Free costs $0 and includes public catalog browsing, limited previews, three permanent application unlocks, complete evidence for those applications, and one personal collection without editable research notes.
- Pro costs $7 monthly or $70 yearly and includes every published application, full structured search and filters, cross-application comparison, unlimited personal collections with research notes, and twenty export operations per subscription month.
- Team, Enterprise, shared workspaces, private application analysis, raw API access, and bulk catalog export remain out of scope.

## Billing journey

The pricing page adapts to authentication and entitlement state. A signed-out visitor can start Free by signing up. A signed-in Free customer can choose monthly or yearly Pro, POST the interval to `/api/billing/checkout`, and navigate to the server-provided Stripe Checkout URL. An active Pro customer sees the current plan rather than another checkout action.

Stripe redirects successful checkout to `/billing/success`. That page does not grant Pro locally. It refreshes `/api/billing/subscription` until the signed Stripe webhook has made Pro authoritative, then returns the customer to the catalog. A bounded pending state explains webhook delay and offers a retry.

Settings shows plan, subscription status, billing interval, current period end, cancellation-at-period-end state, past-due grace information, Free unlock usage, and Pro export usage. Customers with a Stripe customer record can POST `/api/billing/portal` and navigate to the returned portal URL.

## Entitlement enforcement

The API is authoritative. Frontend gates exist for clarity only.

- Free app detail, protected media, collection items, and other app-scoped evidence require a permanent unlock.
- Free can create only one collection. Pro can create unlimited collections.
- Collection descriptions and item notes are Pro-only. Free requests containing non-empty note text are rejected.
- Structured catalog search and filters are Pro-only. Free continues to use the ordinary catalog browse endpoint and its public preview data.
- Comparison requires entitlement to every selected app, so it naturally supports unlocked Free apps and the full Pro catalog.
- Export generation is Pro-only and limited to twenty operations in the Stripe subscription month.
- The permanent-unlock endpoint rejects active Pro accounts so paid customers cannot bank hidden Free unlocks before cancellation. A canceled customer may choose remaining Free unlocks only after the effective plan returns to Free.

## Failure behavior

Entitlement loading fails closed in the frontend: protected detail is not requested until subscription state resolves. A failed entitlement request presents a retryable account-state error rather than a generic missing-app error. Checkout, portal, unlock, collection, search, and export errors preserve the API message and use explicit upgrade or retry actions where relevant.

Stripe webhooks remain idempotent and authoritative. Checkout success, URL parameters, and frontend state never grant Pro. Existing past-due grace behavior remains unchanged.

## Boundaries

Frontend billing HTTP calls live in one focused client module. Subscription state is represented by one shared type and refreshed by the authenticated app and billing screens. Existing route parsing gains a billing-success route without changing unrelated app, Sites, crawler, or admin behavior.

Server-side plan checks reuse `effectivePlan`, `getAccountEntitlements`, and `canAccessApp`. Collection and search policies are enforced at the API boundary, where the authenticated user and effective plan are both available.

## Verification

- Unit tests cover checkout URL navigation, portal navigation, pricing CTA state, subscription-success reconciliation, Settings billing state, and entitlement-load failure.
- API tests prove Free collection/search/note restrictions, Pro access, and rejection of unlock banking while Pro.
- Existing pricing-store and Stripe webhook tests continue to prove three atomic unlocks, twenty monthly exports, active/past-due plan calculation, and webhook authority.
- TypeScript, the complete automated test suite, Vite build, and migration checks must pass.
