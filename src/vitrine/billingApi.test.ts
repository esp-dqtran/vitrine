import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckout, createPortal, loadSubscription } from './billingApi.ts';

test('loads the safe subscription view', async () => {
  const expected = {
    plan: 'free' as const,
    status: null,
    interval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    graceExpiresAt: null,
    hasBillingCustomer: false,
    freeUnlocks: ['linear'],
    freeUnlocksRemaining: 2,
    exportUsage: { used: 0, limit: 20 as const, resetAt: null },
  };
  const fetcher = async () => new Response(JSON.stringify(expected), { status: 200 });
  assert.deepEqual(await loadSubscription(fetcher), expected);
});

test('creates checkout and portal sessions with the selected interval', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ url: `https://billing.example/${calls.length}` }), { status: 200 });
  };

  assert.equal((await createCheckout('year', fetcher)).url, 'https://billing.example/1');
  assert.equal((await createPortal(fetcher)).url, 'https://billing.example/2');
  assert.equal(calls[0].url, '/api/billing/checkout');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { interval: 'year' });
  assert.equal(calls[1].url, '/api/billing/portal');
});

test('surfaces the billing API error message', async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: 'Billing is unavailable' }), { status: 503 });
  await assert.rejects(createCheckout('month', fetcher), /Billing is unavailable/);
});
