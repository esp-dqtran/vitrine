# Vitrines pricing model

## Free — $0

- Three permanently unlocked applications with complete evidence, screens,
  flows, components, and tokens.
- One personal collection and public catalog previews.

## Pro — $8.99/month or $79.99/year

- Full catalog access, search, comparison, unlimited personal collections, and
  research notes.
- Twenty controlled export operations per subscription month.

## Team — $29/editor/month, billed annually

- Three-editor minimum: **$1,044/year** at launch.
- Every editor receives Pro catalog access.
- Shared organization workspaces, research projects, and member management.
- All current organization members are editors and therefore seat-bearing. A
  viewer role is deliberately deferred until it is technically enforced.

Team checkout creates an organization-scoped Paddle transaction with the
current editor count (minimum three) and a dedicated recurring Price. Do not
convert a personal Pro subscription into Team access client-side; only a
verified Paddle subscription webhook may grant Team entitlements.

## Billing logic

1. Vitrines creates the Paddle transaction server-side, selecting the Price ID
   from the requested plan and billing period. The browser receives only the
   one-time checkout URL.
2. The transaction carries immutable application identifiers in `custom_data`:
   `vitrinesUserId` for Pro, or `vitrinesOrganizationId` plus
   `vitrinesBillingOwnerId` for Team. Paddle copies this data to the resulting
   subscription.
3. Paddle's signed subscription events are idempotently stored and are the
   sole entitlement authority. The return page polls the account entitlement;
   it never grants access based on a checkout query parameter.
4. For a past-due subscription, Vitrines keeps Pro access for seven days. A
   cancellation, pause, or failed renewal is reflected by the next signed
   subscription event.
5. Billing management opens a newly-created, short-lived Paddle customer
   portal session. Portal URLs are never stored.

## Production activation checklist

Before enabling Team sales, configure the production environment with
`PADDLE_ENVIRONMENT=production`, a production API key with
`transaction.write` and `customer_portal_session.write`, the three approved
recurring Price IDs, and `TEAMS_ENABLED=true`. In Paddle, create a notification
destination at `https://api.vitrines.ai/billing/webhook` for
`subscription.created`, `subscription.activated`, `subscription.updated`,
`subscription.canceled`, `subscription.past_due`, and `subscription.paused`.
Store that destination's secret as `PADDLE_WEBHOOK_SECRET`.

The webhook is the entitlement authority. The success page waits for it, but
never grants access from query parameters alone. Complete Paddle's live-account
business verification and checkout-domain approval before publishing live
Prices or taking live payments.

## Sandbox verification

Set the sandbox variables in `.env`, then run:

```bash
npm run billing:paddle:sandbox:verify
```

This read-only preflight verifies that all three active recurring prices match
the approved $8.99/month, $79.99/year, and $348/editor/year model. Append
`-- --checkout` to create an isolated sandbox Checkout URL. A complete
application E2E still requires an authenticated test user and a publicly
reachable sandbox notification destination: buy through Vitrines with Paddle's
test card, wait for the success page to report Pro, verify the corresponding
subscription record, then open the Paddle customer portal from Settings.
