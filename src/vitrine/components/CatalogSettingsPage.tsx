import { useEffect, useState, type ReactNode } from 'react';
import { createPortal, loadSubscription, type SubscriptionView } from '../billingApi.ts';
import { PRO_PRICE_CENTS } from '../../pricing.ts';
import { CatalogShell } from './CatalogShell.tsx';

export interface CatalogSettingsPageProps {
  accountControls?: ReactNode;
  email?: string | null;
  onSignIn?: () => void;
  onUpgrade: () => void;
  onBrowse: () => void;
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function when(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : DATE.format(parsed);
}

export function CatalogSettingsPage(props: CatalogSettingsPageProps) {
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadSubscription()
      .then((view) => { if (live) setSubscription(view); })
      .catch((cause: Error) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, []);

  return (
    <CatalogSettingsView
      {...props}
      subscription={subscription}
      error={error}
      loading={subscription === null && error === null}
      onManageBilling={async () => {
        const { url } = await createPortal();
        window.location.assign(url);
      }}
    />
  );
}

/* Split so every plan state renders in a test — billing needs auth and Stripe. */
export function CatalogSettingsView({
  accountControls,
  email,
  onSignIn,
  onUpgrade,
  onBrowse,
  subscription,
  loading,
  error,
  onManageBilling,
}: CatalogSettingsPageProps & {
  subscription: SubscriptionView | null;
  loading: boolean;
  error: string | null;
  onManageBilling: () => void;
}) {
  const used = subscription?.freeUnlocks?.length ?? 0;
  const total = used + (subscription?.freeUnlocksRemaining ?? 0);
  const renews = when(subscription?.currentPeriodEnd);

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={<div className="catalog-pricing__rail" aria-hidden="true" />}
    >
      <div className="catalog-settings" data-catalog-settings="true">
        <div className="catalog-browse__bar">
          <h1 className="catalog-browse__title">Account</h1>
        </div>

        {error ? (
          <p className="catalog-browse__state" role="alert">{error}</p>
        ) : loading || !subscription ? (
          <p className="catalog-browse__state" role="status">Loading account…</p>
        ) : (
          <div className="catalog-settings__cards">
            <section className="catalog-settings__card">
              <span className="catalog-app__label">Signed in as</span>
              <p className="catalog-settings__value">{email ?? '—'}</p>
            </section>

            <section className="catalog-settings__card">
              <span className="catalog-app__label">Plan</span>
              <p className="catalog-settings__value">
                {subscription.plan === 'pro' ? 'Pro' : 'Free'}
                {subscription.plan === 'pro' && subscription.interval ? (
                  <small>
                    ${(PRO_PRICE_CENTS[subscription.interval] / 100).toFixed(2)}
                    {subscription.interval === 'year' ? ' a year' : ' a month'}
                  </small>
                ) : null}
              </p>
              {subscription.plan === 'pro' ? (
                <>
                  {/* Cancelling is not the same as having lapsed — say which,
                      and when access actually ends. */}
                  {renews ? (
                    <p className="catalog-settings__note">
                      {subscription.cancelAtPeriodEnd
                        ? `Access ends ${renews}`
                        : `Renews ${renews}`}
                    </p>
                  ) : null}
                  {subscription.hasBillingCustomer ? (
                    <button
                      type="button"
                      className="catalog-pricing__cta catalog-pricing__cta--ghost"
                      onClick={onManageBilling}
                    >
                      Manage billing
                    </button>
                  ) : null}
                </>
              ) : (
                <button type="button" className="catalog-pricing__cta" onClick={onUpgrade}>
                  Upgrade to Pro
                </button>
              )}
            </section>

            {subscription.plan === 'free' ? (
              <section className="catalog-settings__card">
                <span className="catalog-app__label">App unlocks</span>
                <p className="catalog-settings__value">
                  {total - used} of {total}<small>remaining, permanent</small>
                </p>
                {(subscription.freeUnlocks?.length ?? 0) > 0 ? (
                  <ul className="catalog-settings__unlocks">
                    {(subscription.freeUnlocks ?? []).map((appId) => (
                      <li key={appId}>{appId}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="catalog-settings__note">
                    None used yet.{' '}
                    <button type="button" className="catalog-settings__link" onClick={onBrowse}>
                      Browse the catalog
                    </button>
                  </p>
                )}
              </section>
            ) : null}

            <section className="catalog-settings__card">
              <span className="catalog-app__label">Exports</span>
              <p className="catalog-settings__value">
                {subscription.exportUsage?.used ?? 0} of {subscription.exportUsage?.limit ?? 20}
                <small>
                  used{when(subscription.exportUsage?.resetAt ?? null)
                    ? `, resets ${when(subscription.exportUsage.resetAt)}`
                    : ''}
                </small>
              </p>
            </section>
          </div>
        )}
      </div>
    </CatalogShell>
  );
}

