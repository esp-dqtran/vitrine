import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PricingView } from './Pricing.tsx';
import type { SubscriptionView } from './billingApi.ts';

const free: SubscriptionView = {
  plan: 'free', entitlementSource: 'free', promotionExpiresAt: null,
  status: null, interval: null, currentPeriodEnd: null,
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
  assert.match(html, /Choose the depth/);
  assert.match(html, /Vitrines pricing comparison/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/refunds"/);
});

test('includes the selected board treatment for light and dark themes', () => {
  const styles = readFileSync(new URL('./Pricing.css', import.meta.url), 'utf8');
  assert.match(styles, /\.pricing-v2__board/);
  assert.match(styles, /@media \(prefers-color-scheme: dark\)/);
  assert.match(styles, /\.pricing-v2__billing-toggle/);
  assert.match(styles, /\[aria-checked='true'\]/);
});

test('shows the approved monthly and yearly launch prices', () => {
  const monthly = renderToStaticMarkup(<PricingView user={null} subscription={null} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(monthly, /\$8\.99/);
  assert.match(monthly, /\/month/);

  const yearly = renderToStaticMarkup(<PricingView user={null} subscription={null} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} yearly />);
  assert.match(yearly, /\$79\.99/);
  assert.match(yearly, /\/year/);
  assert.match(yearly, /save 26%/i);
});

test('shows the annual Team model with its editor minimum', () => {
  const html = renderToStaticMarkup(<PricingView user={null} subscription={null} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(html, /Team/);
  assert.match(html, /\$29/);
  assert.match(html, /3 editors/);
  assert.match(html, /\$1,044\/year/);
});

test('marks the effective customer plan and keeps only the valid upgrade action', () => {
  const freeHtml = renderToStaticMarkup(<PricingView user={{ id: 1, email: 'free@example.com', role: 'user' }} subscription={free} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(freeHtml, /Current Free plan/);
  assert.match(freeHtml, /Upgrade to Pro/);

  const proHtml = renderToStaticMarkup(<PricingView user={{ id: 2, email: 'pro@example.com', role: 'user' }} subscription={pro} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(proHtml, /Included with Pro/);
  assert.match(proHtml, /Current Pro plan/);
});

test('personalizes the pricing page with permanent Free unlock usage', () => {
  const oneUsed: SubscriptionView = {
    ...free,
    freeUnlocks: ['linear'],
    freeUnlocksRemaining: 2,
  };
  const html = renderToStaticMarkup(<PricingView user={{ id: 1, email: 'free@example.com', role: 'user' }} subscription={oneUsed} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(html, /Your Free access/);
  assert.match(html, /1 of 3 permanent app unlocks used/);
  assert.match(html, /2 remaining/);
  assert.match(html, /Browse public previews freely/);
});

test('turns exhausted Free usage into a full-catalog upsell without removing owned apps', () => {
  const exhausted: SubscriptionView = {
    ...free,
    freeUnlocks: ['linear', 'figma', 'notion'],
    freeUnlocksRemaining: 0,
  };
  const html = renderToStaticMarkup(<PricingView user={{ id: 1, email: 'free@example.com', role: 'user' }} subscription={exhausted} onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(html, /3 of 3 permanent app unlocks used/);
  assert.match(html, /All unlocks used/);
  assert.match(html, /unlocked apps stay available forever/i);
  assert.match(html, /Open the full catalog/);
});

test('wires the selected interval to Checkout and exposes billing errors', () => {
  const source = readFileSync(new URL('./Pricing.tsx', import.meta.url), 'utf8');
  assert.match(source, /createCheckout\(yearly \? 'year' : 'month'\)/);
  assert.match(source, /openPaddleCheckout\(\(await createCheckout/);
  assert.match(source, /createTeamCheckout\(team\.id\)\)\.transactionId/);
  assert.match(source, /clickAction=\{user \? onCheckout : onSignIn\}/);
  const html = renderToStaticMarkup(<PricingView user={{ id: 1, email: 'free@example.com', role: 'user' }} subscription={free} error="Billing is unavailable" onBrowse={() => undefined} onSignIn={() => undefined} onCheckout={() => undefined} />);
  assert.match(html, /Billing is unavailable/);
});
