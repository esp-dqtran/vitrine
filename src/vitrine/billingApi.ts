export interface SubscriptionView {
  plan: 'free' | 'pro';
  entitlementSource: 'paid' | 'promotion' | 'free';
  promotionExpiresAt: string | null;
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

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Billing returned ${response.status}`);
  return body as T;
}

export function loadSubscription(fetcher: Fetcher = fetch): Promise<SubscriptionView> {
  return fetcher('/api/billing/subscription').then(jsonOrError<SubscriptionView>);
}

export function createCheckout(interval: 'month' | 'year', fetcher: Fetcher = fetch): Promise<{ url: string }> {
  return fetcher('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interval }),
  }).then(jsonOrError<{ url: string }>);
}

export function createPortal(fetcher: Fetcher = fetch): Promise<{ url: string }> {
  return fetcher('/api/billing/portal', { method: 'POST' }).then(jsonOrError<{ url: string }>);
}
