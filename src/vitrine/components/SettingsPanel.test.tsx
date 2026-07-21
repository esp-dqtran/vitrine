import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillingSettings } from './SettingsPanel.tsx';
import type { SubscriptionView } from '../billingApi.ts';

const free: SubscriptionView = {
  plan: 'free', status: null, interval: null, currentPeriodEnd: null,
  cancelAtPeriodEnd: false, graceExpiresAt: null, hasBillingCustomer: false,
  freeUnlocks: ['linear'], freeUnlocksRemaining: 2,
  exportUsage: { used: 0, limit: 20, resetAt: null },
};

test('shows Free plan usage and an upgrade action', () => {
  const html = renderToStaticMarkup(<BillingSettings subscription={free} onUpgrade={() => undefined} onManage={() => undefined} />);
  assert.match(html, /Free plan/);
  assert.match(html, /1 of 3 apps unlocked/);
  assert.match(html, /Upgrade to Pro/);
});

test('shows Pro renewal, export usage, and billing management', () => {
  const subscription: SubscriptionView = {
    ...free, plan: 'pro', status: 'active', interval: 'year',
    currentPeriodEnd: '2026-08-21T00:00:00.000Z', hasBillingCustomer: true,
    exportUsage: { used: 4, limit: 20, resetAt: '2026-08-21T00:00:00.000Z' },
  };
  const html = renderToStaticMarkup(<BillingSettings subscription={subscription} onUpgrade={() => undefined} onManage={() => undefined} />);
  assert.match(html, /Pro plan/);
  assert.match(html, /Yearly billing/);
  assert.match(html, /4 of 20 exports used/);
  assert.match(html, /Manage billing/);
});
