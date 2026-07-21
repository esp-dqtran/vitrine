# Free and Pro Subscription Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a usable Stripe-backed Free-to-Pro subscription journey with customer billing management and server-enforced plan differences.

**Architecture:** Keep Stripe and effective-plan authority in the existing API, add a focused frontend billing client and shared subscription type, and make pricing, checkout success, Settings, and the authenticated app consume that contract. Enforce commercial limits at authenticated API routes so frontend state cannot bypass them.

**Tech Stack:** React 19, TypeScript, Express 5, PostgreSQL, Stripe Checkout/Customer Portal/webhooks, Node test runner, Vite

---

### Task 1: Shared billing client and billing-success route

**Files:**
- Create: `src/vitrine/billingApi.ts`
- Create: `src/vitrine/billingApi.test.ts`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/router.test.ts`

- [ ] **Step 1: Write failing tests for the subscription contract, Checkout, Portal, and billing-success route**

```ts
test('creates checkout and portal sessions from safe server URLs', async () => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({ url: `https://billing.example/${calls.length}` }), { status: 200 });
  };
  assert.equal((await createCheckout('month', fetcher)).url, 'https://billing.example/1');
  assert.equal((await createPortal(fetcher)).url, 'https://billing.example/2');
});

test('maps the billing success route', () => {
  assert.deepEqual(parseRoutePath('/billing/success'), { name: 'billing-success' });
  assert.equal(routeToPath({ name: 'billing-success' }), '/billing/success');
});
```

- [ ] **Step 2: Run the new tests and confirm they fail because the module and route do not exist**

Run: `node --experimental-strip-types --test src/vitrine/billingApi.test.ts src/vitrine/router.test.ts`

- [ ] **Step 3: Implement the focused billing API contract**

```ts
export interface SubscriptionView {
  plan: 'free' | 'pro';
  status: string | null;
  interval: 'month' | 'year' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceExpiresAt: string | null;
  hasBillingCustomer: boolean;
  freeUnlocks: string[];
  freeUnlocksRemaining: number;
  exportUsage: { used: number; limit: 20; resetAt: string | null };
}
```

Implement `loadSubscription`, `createCheckout`, and `createPortal` with JSON error propagation, and add `{ name: 'billing-success' }` to both router directions.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run: `node --experimental-strip-types --test src/vitrine/billingApi.test.ts src/vitrine/router.test.ts`

### Task 2: Working pricing Checkout actions

**Files:**
- Modify: `src/vitrine/Pricing.tsx`
- Modify: `src/vitrine/main.tsx`
- Create: `src/vitrine/Pricing.test.tsx`

- [ ] **Step 1: Write failing rendering and interaction-boundary tests**

Test that signed-out Free and Pro actions lead to sign-in, signed-in Free renders the selected monthly/yearly checkout action, busy/errors are visible, and signed-in Pro renders `Current plan` instead of creating another Checkout.

- [ ] **Step 2: Run the Pricing test and confirm the missing callbacks/state fail**

Run: `npx tsx --test src/vitrine/Pricing.test.tsx`

- [ ] **Step 3: Add authenticated pricing state and Checkout navigation**

Pass `user` from `Root`, load subscription for authenticated customers, pass an explicit action into `PlanCard`, call `createCheckout(yearly ? 'year' : 'month')`, and assign the returned HTTPS URL through an injected/default navigation function. Preserve the current pricing layout and copy.

- [ ] **Step 4: Run the Pricing test and existing frontend route tests**

Run: `npx tsx --test src/vitrine/Pricing.test.tsx && node --experimental-strip-types --test src/vitrine/router.test.ts`

### Task 3: Billing success, shared entitlement state, and Settings management

**Files:**
- Create: `src/vitrine/components/BillingSuccess.tsx`
- Create: `src/vitrine/components/BillingSuccess.test.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/SettingsPanel.tsx`
- Create: `src/vitrine/components/SettingsPanel.test.tsx`
- Modify: `src/vitrine/main.tsx`
- Modify: `src/vitrine/AppOptionalData.test.ts`

- [ ] **Step 1: Write failing tests for webhook reconciliation and billing settings**

Test a Free-to-Pro subscription sequence, bounded pending state, retry action, plan/renewal/cancellation/export labels, and the Portal action. Add a source-boundary test proving `App` handles subscription failure separately from app-detail failure.

- [ ] **Step 2: Run those tests and confirm the components and states are missing**

Run: `npx tsx --test src/vitrine/components/BillingSuccess.test.tsx src/vitrine/components/SettingsPanel.test.tsx && node --experimental-strip-types --test src/vitrine/AppOptionalData.test.ts`

- [ ] **Step 3: Implement the success reconciler and billing section**

`BillingSuccess` reloads the subscription on a bounded interval, succeeds only when `plan === 'pro'`, and offers retry/catalog navigation without treating the redirect as authority. `SettingsPanel` receives the resolved `SubscriptionView`, formats deterministic dates, calls Portal, and displays Free unlock or Pro export usage.

- [ ] **Step 4: Make entitlement load fail closed and retryable**

Replace the nullable-only App state with explicit loading/success/error state. Never request protected app detail while state is unresolved or failed; render an account-state retry instead. Pass the resolved subscription into Settings and refresh it after returning from billing.

- [ ] **Step 5: Run the focused tests**

Run: `npx tsx --test src/vitrine/components/BillingSuccess.test.tsx src/vitrine/components/SettingsPanel.test.tsx && node --experimental-strip-types --test src/vitrine/AppOptionalData.test.ts`

### Task 4: Server-enforced Free and Pro product matrix

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/pricingStore.ts`
- Modify: `src/pricingStore.test.ts`

- [ ] **Step 1: Write failing API tests for Free restrictions and Pro access**

Add tests proving: Free structured search returns `403 upgrade_required`; Pro search succeeds; Free may create its first empty-description collection but a second returns `403 plan_limit`; Free non-empty descriptions/item notes/patch notes return `403 upgrade_required`; Pro retains all collection and note operations; active Pro cannot call the Free unlock endpoint.

- [ ] **Step 2: Run the named API and store tests and confirm the new assertions fail**

Run: `node --experimental-strip-types --test --test-name-pattern='Free collection|Pro collection|structured search|unlock while Pro' services/api/src/app.test.ts src/pricingStore.test.ts`

- [ ] **Step 3: Add narrow pricing-store helpers**

Implement `isProUser(userId, now?)` through `effectivePlan(getSubscription(userId))` and `countCollections(userId)` with a bounded PostgreSQL count. Expose both through API dependencies for deterministic route tests.

- [ ] **Step 4: Enforce plan policy at authenticated API routes**

Require Pro before `/search`; check collection count and description before creating a Free collection; reject non-empty item notes and note patches for Free; reject `/apps/:app/unlock` when the effective plan is Pro. Return stable JSON codes (`upgrade_required`, `plan_limit`) and do not rely on UI state.

- [ ] **Step 5: Expose only safe billing-customer presence**

Add `hasBillingCustomer: Boolean(view.subscription?.stripe_customer_id)` to `/billing/subscription` without returning Stripe IDs.

- [ ] **Step 6: Run the focused API/store tests**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts src/pricingStore.test.ts`

### Task 5: Frontend plan-aware discovery and collections

**Files:**
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/CommandPalette.tsx`
- Modify: `src/vitrine/components/CollectionsPanel.tsx`
- Modify: `src/vitrine/components/CollectionPicker.tsx`
- Modify: `src/vitrine/ResearchTools.test.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write failing tests for Free UI limits**

Test that Free sees an upgrade action instead of structured search/filter results, cannot create a second collection, and cannot enter notes; Pro retains existing controls.

- [ ] **Step 2: Run the frontend tests and confirm existing unrestricted controls fail the expectations**

Run: `npx tsx --test src/vitrine/ResearchTools.test.tsx && node --experimental-strip-types --test src/vitrine/App.boundary.test.ts`

- [ ] **Step 3: Thread the resolved plan through the existing components**

Use `plan` and collection count to disable/hide Pro-only controls and navigate upgrade actions to `/pricing`. Preserve ordinary catalog browsing, unlocked-app opening, and entitled comparison behavior.

- [ ] **Step 4: Run the focused frontend tests**

Run: `npx tsx --test src/vitrine/ResearchTools.test.tsx && node --experimental-strip-types --test src/vitrine/App.boundary.test.ts`

### Task 6: Complete verification and documentation reconciliation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.env.example` only if the live config contract is missing a required Stripe setting

- [ ] **Step 1: Reconcile architecture documentation against final routes and UI behavior**

Document Checkout initiation, webhook-authoritative success reconciliation, Customer Portal, the exact Free/Pro limits, and safe subscription response fields.

- [ ] **Step 2: Run formatting and migration checks**

Run: `git diff --check && npm run db:check`

- [ ] **Step 3: Run TypeScript and production build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Run the complete automated test suite**

Run: `npm test`

- [ ] **Step 5: Audit every design requirement against current source and test evidence**

Confirm checkout, success reconciliation, portal, Settings state, Free app/collection/search/note limits, Pro catalog/collection/export access, two-session behavior, webhook authority, and protected media. Record any unverified live Stripe dependency explicitly; do not claim a real payment succeeded without test-mode Stripe credentials and webhook delivery evidence.
