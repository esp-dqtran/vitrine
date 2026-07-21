import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillingSuccessView, waitForPro } from './BillingSuccess.tsx';
import type { SubscriptionView } from '../billingApi.ts';

const free: SubscriptionView = {
  plan: 'free', entitlementSource: 'free', promotionExpiresAt: null,
  status: null, interval: null, currentPeriodEnd: null,
  cancelAtPeriodEnd: false, graceExpiresAt: null, hasBillingCustomer: true,
  freeUnlocks: [], freeUnlocksRemaining: 3,
  exportUsage: { used: 0, limit: 20, resetAt: null },
};

test('waits for Stripe webhook authority before reporting Pro', async () => {
  let calls = 0;
  const result = await waitForPro(async () => {
    calls += 1;
    return calls === 1 ? free : { ...free, plan: 'pro', status: 'active' };
  }, { attempts: 3, delay: async () => undefined });
  assert.equal(result.plan, 'pro');
  assert.equal(calls, 2);
});

test('returns the last subscription after bounded webhook waiting', async () => {
  const result = await waitForPro(async () => free, { attempts: 2, delay: async () => undefined });
  assert.equal(result.plan, 'free');
});

test('renders checking, ready, pending, and error outcomes', () => {
  assert.match(renderToStaticMarkup(<BillingSuccessView state="checking" onRetry={() => undefined} onContinue={() => undefined} />), /Confirming your Pro plan/);
  assert.match(renderToStaticMarkup(<BillingSuccessView state="ready" onRetry={() => undefined} onContinue={() => undefined} />), /Pro is active/);
  assert.match(renderToStaticMarkup(<BillingSuccessView state="pending" onRetry={() => undefined} onContinue={() => undefined} />), /payment is complete/i);
  assert.match(renderToStaticMarkup(<BillingSuccessView state="error" error="Billing unavailable" onRetry={() => undefined} onContinue={() => undefined} />), /Billing unavailable/);
});
