import { useEffect, useState } from 'react';
import { Button, Heading, Spinner, Text } from '@astryxdesign/core';
import { loadSubscription, type SubscriptionView } from '../billingApi';

type BillingSuccessState = 'checking' | 'ready' | 'pending' | 'error';

export async function waitForPro(
  load: () => Promise<SubscriptionView>,
  options: { attempts?: number; delay?: () => Promise<void> } = {},
): Promise<SubscriptionView> {
  const attempts = options.attempts ?? 8;
  const delay = options.delay ?? (() => new Promise<void>((resolve) => window.setTimeout(resolve, 1000)));
  let latest = await load();
  for (let attempt = 1; latest.plan !== 'pro' && attempt < attempts; attempt += 1) {
    await delay();
    latest = await load();
  }
  return latest;
}

export function BillingSuccessView({ state, error = '', onRetry, onContinue }: {
  state: BillingSuccessState;
  error?: string;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const title = state === 'ready'
    ? 'Pro is active'
    : state === 'checking'
      ? 'Confirming your Pro plan'
      : state === 'pending'
        ? 'Payment received'
        : 'Could not confirm your plan';
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: 'min(520px, 100%)', padding: 32, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-surface)', textAlign: 'center' }}>
        {state === 'checking' && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Spinner size="lg" /></div>}
        <Heading level={2}>{title}</Heading>
        <div style={{ marginTop: 12 }}>
          <Text color="secondary">
            {state === 'ready'
              ? 'Your full catalog and Pro exports are ready.'
              : state === 'checking'
                ? 'Stripe has returned you to Astryx. We are waiting for the signed subscription update.'
                : state === 'pending'
                  ? 'Your payment is complete, but the signed subscription update is still arriving. Retry in a moment.'
                  : error || 'Billing is temporarily unavailable.'}
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
          {(state === 'pending' || state === 'error') && <Button label="Retry" variant="secondary" clickAction={onRetry} />}
          {state !== 'checking' && <Button label="Continue to catalog" variant="primary" clickAction={onContinue} />}
        </div>
      </section>
    </main>
  );
}

export function BillingSuccess({ onContinue }: { onContinue: () => void }) {
  const [state, setState] = useState<BillingSuccessState>('checking');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setState('checking');
    setError('');
    void waitForPro(() => loadSubscription())
      .then((subscription) => { if (active) setState(subscription.plan === 'pro' ? 'ready' : 'pending'); })
      .catch((reason: Error) => { if (active) { setError(reason.message); setState('error'); } });
    return () => { active = false; };
  }, [revision]);

  return <BillingSuccessView state={state} error={error} onRetry={() => setRevision((value) => value + 1)} onContinue={onContinue} />;
}
