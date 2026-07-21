import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillingSettings, ReferralSettings } from './SettingsPanel.tsx';
import type { SubscriptionView } from '../billingApi.ts';

const free: SubscriptionView = {
  plan: 'free', status: null, interval: null, currentPeriodEnd: null,
  entitlementSource: 'free', promotionExpiresAt: null,
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
    ...free, plan: 'pro', entitlementSource: 'paid', status: 'active', interval: 'year',
    currentPeriodEnd: '2026-08-21T00:00:00.000Z', hasBillingCustomer: true,
    exportUsage: { used: 4, limit: 20, resetAt: '2026-08-21T00:00:00.000Z' },
  };
  const html = renderToStaticMarkup(<BillingSettings subscription={subscription} onUpgrade={() => undefined} onManage={() => undefined} />);
  assert.match(html, /Pro plan/);
  assert.match(html, /Yearly billing/);
  assert.match(html, /4 of 20 exports used/);
  assert.match(html, /Manage billing/);
});

test('shows promotional Pro without claiming it is billed', () => {
  const subscription: SubscriptionView = {
    ...free,
    plan: 'pro',
    entitlementSource: 'promotion',
    promotionExpiresAt: '2026-08-20T10:00:00.000Z',
  };
  const html = renderToStaticMarkup(<BillingSettings subscription={subscription} onUpgrade={() => undefined} onManage={() => undefined} />);
  assert.match(html, /Promotional Pro/);
  assert.match(html, /Access ends Aug 20, 2026/);
  assert.match(html, /Upgrade to Pro/);
  assert.doesNotMatch(html, /Monthly billing/);
});

test('shows referral progress and lets Free users activate a banked Pro Month', () => {
  const html = renderToStaticMarkup(<ReferralSettings
    summary={{
      campaign: { id: 'launch-2026', active: true, endsAt: '2026-10-19T00:00:00.000Z' },
      referralCount: 2,
      activatedCount: 1,
      earnedCount: 1,
      availableMonths: 1,
      referrals: [{ id: '1', state: 'rewarded' }, { id: '2', state: 'joined' }],
    }}
    currentPro={false}
    activationExpiresAt="2026-08-20T10:00:00.000Z"
    onCopy={() => undefined}
    onActivate={() => undefined}
  />);
  assert.match(html, /Invite friends/);
  assert.match(html, /1 of 3 rewards earned/);
  assert.match(html, /1 Pro Month ready/);
  assert.match(html, /Activate 1 Pro Month/);
  assert.match(html, /Oct 19, 2026/);
  assert.match(html, /Rewarded/);
  assert.match(html, /Joined/);
});

test('keeps a banked month unavailable during current Pro access', () => {
  const html = renderToStaticMarkup(<ReferralSettings
    summary={{
      campaign: { id: 'launch-2026', active: false, endsAt: '2026-10-19T00:00:00.000Z' },
      referralCount: 1,
      activatedCount: 1,
      earnedCount: 1,
      availableMonths: 1,
      referrals: [{ id: '1', state: 'rewarded' }],
    }}
    currentPro
    activationExpiresAt="2026-08-20T10:00:00.000Z"
    onCopy={() => undefined}
    onActivate={() => undefined}
  />);
  assert.match(html, /Available after your current Pro access ends/);
  assert.doesNotMatch(html, /Copy referral link/);
});
