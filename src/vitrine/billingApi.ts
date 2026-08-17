import { apiFetch } from './apiFetch.ts';

export interface SubscriptionView {
  plan: 'free' | 'pro';
  entitlementSource: 'paid' | 'team' | 'promotion' | 'admin_grant' | 'free';
  promotionExpiresAt: string | null;
  status: string | null;
  interval: 'month' | 'year' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceExpiresAt: string | null;
  hasBillingCustomer: boolean;
  team?: { organizationId: number; organizationName: string; seats: number } | null;
  freeUnlocks: string[];
  freeUnlocksRemaining: number;
  exportUsage: { used: number; limit: number; resetAt: string | null };
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Billing returned ${response.status}`);
  return body as T;
}

export function loadSubscription(fetcher: Fetcher = apiFetch): Promise<SubscriptionView> {
  return fetcher('/api/billing/subscription').then(jsonOrError<SubscriptionView>);
}

export function createCheckout(interval: 'month' | 'year', fetcher: Fetcher = apiFetch): Promise<{ transactionId: string }> {
  return fetcher('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interval }),
  }).then(jsonOrError<{ transactionId: string }>);
}

export function createTeamCheckout(organizationId: number, fetcher: Fetcher = apiFetch): Promise<{ transactionId: string }> {
  return fetcher('/api/billing/team/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId }),
  }).then(jsonOrError<{ transactionId: string }>);
}

export function createPortal(
  organizationIdOrFetcher?: number | Fetcher,
  suppliedFetcher?: Fetcher,
): Promise<{ url: string }> {
  const organizationId = typeof organizationIdOrFetcher === 'number' ? organizationIdOrFetcher : undefined;
  const fetcher = typeof organizationIdOrFetcher === 'function'
    ? organizationIdOrFetcher
    : suppliedFetcher ?? apiFetch;
  return fetcher('/api/billing/portal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(organizationId ? { organizationId } : {}),
  }).then(jsonOrError<{ url: string }>);
}

export function reconcileCheckoutSession(sessionId: string, fetcher: Fetcher = apiFetch): Promise<{ status: 'processed' | 'pending' }> {
  return fetcher(`/api/billing/checkout-sessions/${encodeURIComponent(sessionId)}`).then(jsonOrError<{ status: 'processed' | 'pending' }>);
}
