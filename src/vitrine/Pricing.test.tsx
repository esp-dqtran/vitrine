import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PricingView } from './Pricing.tsx';
import type { SubscriptionView } from './billingApi.ts';

const free: SubscriptionView = {
  plan: 'free', status: null, interval: null, currentPeriodEnd: null,
  cancelAtPeriodEnd: false, graceExpiresAt: null, hasBillingCustomer: false,
  freeUnlocks: [], freeUnlocksRemaining: 3,
  exportUsage: { used: 0, limit: 20, resetAt: null },
};
const pro: SubscriptionView = {
  ...free, plan: 'pro', status: 'active', interval: 'month',
  currentPeriodEnd: '2026-08-21T00:00:00.000Z', hasBillingCustomer: true,
  exportUsage: { used: 4, limit: 20, resetAt: '2026-08-21T00:00:00.000Z' },
};

test('shows sign-in actions to a visitor', () => {
  const html = renderToStaticMarkup(<PricingView user={null} subscription={null} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(html, /Start free/);
  assert.match(html, /Upgrade to Pro/);
});

test('marks the effective customer plan and keeps only the valid upgrade action', () => {
  const freeHtml = renderToStaticMarkup(<PricingView user={{ id: 1, email: 'free@example.com', role: 'user' }} subscription={free} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(freeHtml, /Current Free plan/);
  assert.match(freeHtml, /Upgrade to Pro/);

  const proHtml = renderToStaticMarkup(<PricingView user={{ id: 2, email: 'pro@example.com', role: 'user' }} subscription={pro} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(proHtml, /Included with Pro/);
  assert.match(proHtml, /Current Pro plan/);
});

test('wires the selected interval to Checkout and exposes billing errors', () => {
  const source = readFileSync(new URL('./Pricing.tsx', import.meta.url), 'utf8');
  assert.match(source, /createCheckout\(yearly \? 'year' : 'month'\)/);
  assert.match(source, /clickAction=\{user \? onCheckout : onSignIn\}/);
  const html = renderToStaticMarkup(<PricingView user={{ id: 1, email: 'free@example.com', role: 'user' }} subscription={free} error="Billing is unavailable" onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(html, /Billing is unavailable/);
});
