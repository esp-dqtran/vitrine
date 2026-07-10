# Astryx Free and Pro Pricing Design

**Date:** 2026-07-10

**Status:** Approved conversational design; awaiting written-spec review

## Goal

Launch Astryx with a simple adoption-first subscription model for individual
designers. Free users can evaluate the complete product on a small number of
applications, while Pro users pay for ongoing access to the full evidence-backed
catalog and controlled exports.

The launch model contains only Free and Pro. Team, Enterprise, seat billing,
shared workspaces, and collaboration are not advertised or implemented until
the corresponding product features exist.

## Product and Pricing Position

Astryx is not selling individual AI analysis jobs. It is selling access to a
continuously maintained research library of observed application design systems,
including screens, flows, components, foundation tokens, evidence, comparison,
collections, and selected editable exports.

The catalog is analyzed and curated once, then reused by many subscribers. The
launch target is 25-100 complete applications. The smaller catalog is offset by
greater depth than a screenshot-only inspiration library: each application is
reconstructed into an evidence-backed observed design system.

Current market anchors reviewed on 2026-07-10:

- Mobbin lists Pro at $10/month and Team at $16/member/month when billed yearly:
  <https://mobbin.com/pricing>
- Page Flows lists individual access at $8.25/month when billed yearly:
  <https://pageflows.com/pricing>

Astryx deliberately launches below those individual price points to prioritize
adoption while the catalog is between 25 and 100 applications.

## Launch Plans

### Free

Price: **$0**

Free includes:

- public catalog metadata and limited previews;
- permanent full access to any three applications selected by the user;
- complete screens, flows, components, tokens, and evidence for those three
  applications;
- one personal collection;
- no exports.

Selecting an application is explicit. Opening a preview does not consume an
unlock. The user confirms an `Unlock this app` action and sees how many unlocks
remain. An unlocked application cannot be exchanged for another application.

### Pro

Price:

- **$7 per month**, billed monthly; or
- **$70 per year**, billed yearly.

Monthly and yearly Pro subscriptions have identical entitlements. Pro includes:

- every current and future published application while the subscription is
  active;
- complete screens, flows, components, foundation tokens, and evidence;
- full catalog search, filters, and cross-application comparison;
- unlimited personal collections and research notes;
- selected editable exports within the fair-use policy.

Pro does not include a raw API, database export, bulk catalog download, complete
offline catalog, or complete application-system export.

### Deferred Plans

The following are explicitly outside the launch scope:

- Team or Enterprise pricing;
- seat minimums and seat-based billing;
- shared collections, team notes, or team administration;
- complete application-system exports;
- private or user-submitted application analysis;
- usage credits for AI analysis.

Private application analysis may later become a separate credit-based add-on.
It must not be mixed into the initial catalog subscription.

## Access Model

### Visitors

Unauthenticated visitors may view:

- the public pricing page;
- catalog application names, categories, branding, and summary counts;
- a small fixed number of preview screens per application;
- a high-level summary of the available observed design system.

Visitors cannot unlock applications, load complete screen sets, inspect complete
design-system data, or export assets.

### Free Accounts

Free application unlocks are recorded durably and enforced transactionally. A
unique `(user_id, app_id)` record represents an unlock. Allocation must lock the
user's current unlock set or use an equivalent atomic constraint so concurrent
requests can never allocate a fourth application.

All protected API routes enforce the unlock. Frontend visibility is never the
authorization mechanism.

### Pro Accounts

An active Pro subscription grants access to every published application. The API
still evaluates entitlement for every application, design-system, media, and
export request so a future plan change does not require a new authorization
architecture.

### Cancellation and Downgrade

Cancelling Pro retains Pro access until the paid period ends. At the end of the
period:

- a user who previously selected three Free applications regains those same
  three applications;
- a user who joined directly as Pro selects up to three Free applications after
  downgrade;
- collections and notes remain stored but items from locked applications are
  read-only previews until the user resubscribes;
- unused export allowance is not retained.

## Export Policy

Pro exports are deliberately useful for ordinary design work without offering a
one-click path to clone an entire application or catalog.

One export operation may contain exactly one of:

- one component family;
- one foundation category; or
- up to ten selected screens.

Each Pro account receives **20 export operations per subscription month**. The
allowance resets on the account's monthly subscription anniversary. For yearly
subscriptions it resets monthly on the day-of-month derived from the yearly
subscription start. When that day does not exist in a shorter month, the window
starts on that month's final calendar day. Unused operations do not roll over.

Every export is authenticated, authorized, logged, and attributed to the account.
Generated assets include an ownership and license notice in their documentation
cover and account-identifying metadata where the export format supports it.
Visible design values must never be modified to create a fingerprint.

The product license permits using exported assets as research input in the
subscriber's own design work. It prohibits redistribution, resale, publishing a
substitute catalog, automated extraction, and using the catalog as training data
for a competing product.

## Anti-Scraping and Data Protection

Astryx cannot prevent a legitimate subscriber from copying information rendered
in their browser. The protection goal is to preserve normal research while
making bulk automated extraction expensive, detectable, attributable, and
enforceable.

### API Shape

The current authenticated `GET /apps` response returns every application with up
to 120 screens per application. That shape must not become the paid-product
contract.

Replace it with:

- a metadata-only, cursor-paginated catalog endpoint;
- an entitled application-summary endpoint;
- cursor-paginated application screen endpoints;
- entitled design-system endpoints;
- entitled media delivery;
- server-generated export jobs.

No response may contain the complete catalog or a bulk list of protected media
URLs. Opaque identifiers are useful for stable references but are not treated as
authorization.

### Media Delivery

Protected images use short-lived signed URLs tied to the authenticated account,
application, and expiry. A client may refresh an expired URL only while the
underlying entitlement remains valid. Responses prevent shared caching of
account-specific URLs and reject cross-application substitutions.

Signed URLs reduce hotlinking and replay; they do not claim to prevent a browser
that is allowed to view an image from saving its bytes.

### Abuse Controls

Apply layered controls by account, session, and IP:

- configurable request-rate and media-volume limits;
- cursor traversal and catalog-coverage monitoring;
- a maximum of two concurrent Pro sessions;
- reauthentication or bot verification after suspicious activity;
- session suspension for severe automated traversal;
- account review and revocation for confirmed abuse.

Ordinary browsing should not encounter a challenge. Soft thresholds should be
tuned from real usage before hard limits are lowered. Disabling right-click,
obfuscating frontend code, or relying on hidden URLs is explicitly rejected.

When a Pro user signs in while two sessions are already active, Astryx revokes
the oldest session and creates the new session. The affected session receives a
clear `signed_in_elsewhere` response on its next authenticated request.

### Audit Events

Record security-relevant events with user, session, IP summary, application,
action, volume, outcome, and timestamp. Events include:

- application unlocks;
- protected application and design-system access;
- media volume aggregates;
- export creation and download;
- rate-limit and verification challenges;
- session suspension and administrative review.

Do not log Stripe payment details, passwords, raw session tokens, signed media
tokens, or complete exported content.

## Stripe Billing Architecture

Stripe Checkout collects payment and Stripe Customer Portal handles payment
methods, invoices, billing-cycle changes, and cancellation. Astryx stores the
local subscription state used by its entitlement checks.

```text
Free user -> Stripe Checkout -> signed Stripe webhook
                                      |
                                      v
                             local subscription state
                                      |
                                      v
                             server-side entitlement
```

The browser's checkout success redirect never grants Pro access. Only a verified
Stripe webhook may activate or change a subscription.

### Billing Endpoints

- `POST /billing/checkout` accepts `monthly` or `yearly`; the server maps that
  value to a configured Stripe Price ID.
- `POST /billing/portal` creates a Stripe Customer Portal session for the
  authenticated user.
- `POST /billing/webhook` is public only to Stripe, verifies the signature from
  the raw request body, and applies supported events idempotently.
- `GET /billing/subscription` returns the safe plan, status, interval, current
  period end, and export usage required by the UI.

Client-supplied amounts, currencies, Price IDs, customer IDs, subscription IDs,
or plan names are never trusted.

The webhook route must be registered with Stripe's raw-body parser before the
application-wide JSON parser. Parsing and reserializing the body before signature
verification is not permitted.

### Billing State

The pricing model is separate from authorization roles. The existing
`admin | user` role continues to control administrative actions; it must not be
overloaded to represent Free or Pro.

Add conceptual records for:

- `subscriptions`: user, Stripe customer and subscription references, interval,
  status, current period end, cancellation state, failed-payment grace expiry,
  and timestamps;
- `free_app_unlocks`: permanent Free application selections;
- `stripe_events`: processed webhook IDs and timestamps;
- `export_usage`: period and consumed export count;
- `access_events`: security audit events.

Only active subscriptions and subscriptions inside the failed-payment grace
period grant Pro. A failed payment receives a seven-day grace period. After the
grace period, the account returns to Free unless Stripe reports recovery.

Webhook handling is idempotent and resilient to duplicate, delayed, and
out-of-order events. Updates compare Stripe's authoritative subscription state
and event timing rather than blindly applying arrival order.

## Pricing and Upgrade Experience

The public pricing page contains two cards only:

- **Free** — `Explore three complete applications`;
- **Pro** — `Explore every observed design system`.

A monthly/yearly toggle displays `$7/month` or `$70/year`. No Team, Enterprise,
trial, credits, or custom pricing appears at launch.

Upgrade prompts appear when a Free user:

- attempts to open a fourth complete application; or
- attempts an export.

The prompt keeps the application's permitted preview visible and clearly states
what Pro unlocks. Protected data must not be loaded and then hidden after the
fact.

After checkout, the success screen shows payment confirmation separately from
entitlement activation. It waits or polls briefly for the verified webhook, then
returns the user to the application or export they attempted to access. If the
webhook is delayed, the screen explains that activation is pending and provides
a safe retry path.

Billing settings show plan, interval, renewal date, cancellation state, export
usage, and a Stripe management action. Cancellation copy names the exact final
day of Pro access.

## Error Handling

- Stripe checkout creation failure leaves the account unchanged and returns a
  retryable billing error.
- A valid payment with a delayed webhook displays pending activation; it does
  not optimistically grant Pro.
- Invalid webhook signatures return an error without mutating billing state.
- Duplicate webhook events are acknowledged without applying the transition
  twice.
- Locked resources return a stable `upgrade_required` response without protected
  fields.
- Expired signed media URLs return an expiry-specific error and can be refreshed
  only after a new entitlement check.
- Rate-limited requests return `429` with retry information.
- Severe scraping suspends the affected session first; confirmed abuse may
  suspend the account.
- The twenty-first export operation in a subscription month returns the usage
  limit and reset date without consuming another operation.
- Billing-provider outages do not immediately revoke an already-valid local
  subscription. Reconciliation resumes when Stripe becomes available.

## Unit Economics and Price Review

Recognized monthly subscription revenue is:

```text
monthly Pro subscribers * $7
+ active yearly Pro subscribers * ($70 / 12)
```

Contribution margin must subtract:

- Stripe processing and billing fees;
- storage, media delivery, database, and application hosting;
- amortized capture and AI-analysis cost for new and refreshed applications;
- curator review labor;
- customer support and abuse review.

The current architecture estimates batch AI processing at roughly $8 for a
450-screen application before curator labor. This must be remeasured against the
production model and actual screen distribution rather than treated as a fixed
forecast.

Review the $7 launch price when any of these triggers occurs:

- the catalog exceeds 100 complete applications;
- export or media delivery materially reduces contribution margin;
- curator labor becomes the dominant cost;
- conversion data shows the product is materially underpriced;
- a higher-value private-analysis feature is introduced.

The launch price is not described as a lifetime price. Future price changes must
be communicated before renewal and must not change a paid annual term already in
progress.

## Testing

### Entitlements

- a visitor can load metadata and previews but not protected data;
- a Free user can unlock exactly three applications;
- concurrent unlock attempts cannot allocate a fourth application;
- a Free user can fully access only their selected applications;
- Pro can access every application while active;
- downgrade restores the original Free selections;
- direct-Pro downgrade allows selecting up to three Free applications;
- administrative authorization remains independent of plan.

### Billing

- monthly and yearly checkout use only the configured server-side Price IDs;
- checkout failure does not change entitlement;
- webhook signatures are required;
- duplicate, delayed, and out-of-order events are safe;
- cancellation retains access through the period end;
- payment recovery inside grace retains Pro;
- an unresolved failed payment reverts to Free after seven days;
- Customer Portal sessions belong to the authenticated Stripe customer.

### Data Protection

- no endpoint returns the complete protected catalog in one response;
- cursor pagination cannot bypass entitlement checks;
- signed media URLs expire and reject account or application substitution;
- normal browsing remains below abuse thresholds;
- catalog-wide sequential traversal triggers verification or suspension;
- a third concurrent Pro login revokes the oldest session and reports
  `signed_in_elsewhere` to that session on its next request;
- export contents and monthly usage limits are enforced server-side;
- the twentieth export succeeds and the twenty-first is blocked.

### User Experience

- the pricing page shows only Free and Pro;
- the monthly/yearly toggle shows $7 and $70 correctly;
- previewing does not consume a Free unlock;
- unlock confirmation shows the remaining count;
- an upgrade flow returns to the interrupted application or export;
- pending activation, cancellation, grace, and downgrade states are understandable
  and accessible.

## Success Criteria

- A new user can evaluate three complete applications without payment.
- A user can subscribe for $7/month or $70/year through Stripe.
- Pro is granted only after a verified Stripe webhook.
- Pro can use the complete catalog and selected exports without ordinary browsing
  friction.
- Free and downgraded users cannot retrieve applications outside their permanent
  selections.
- No API response provides a one-request protected catalog dump.
- Automated catalog traversal is detected, challenged, logged, and suspendable.
- Exports are scoped, counted, attributable, and licensed against redistribution.
- Billing failures, cancellation, and downgrade preserve a predictable user
  experience and never leak protected data.
- Existing administrator and catalog-pipeline behavior remains unchanged.

## Implementation Boundary

This document defines pricing, entitlements, billing, and data-protection
behavior. The current repository only has a seeded administrator authentication
flow. A normal-user identity and account-registration design is a prerequisite
for implementing Free and Pro, but its signup, email verification, password
recovery, and social-login choices are intentionally not invented in this pricing
specification.
