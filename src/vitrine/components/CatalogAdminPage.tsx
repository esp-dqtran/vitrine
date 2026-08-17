import { useEffect, useState, type ReactNode } from 'react';
import { fetchGrowth, type GrowthResponse } from '../usersApi.ts';
import { PRO_PRICE_CENTS } from '../../pricing.ts';
import { CatalogShell } from './CatalogShell.tsx';

export interface CatalogAdminPageProps {
  accountControls?: ReactNode;
  onSignIn?: () => void;
}

export function CatalogAdminPage(props: CatalogAdminPageProps) {
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchGrowth()
      .then((value) => { if (live) setGrowth(value); })
      .catch((cause: Error) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, []);

  return (
    <CatalogAdminView
      {...props}
      growth={growth}
      error={error}
      loading={growth === null && error === null}
    />
  );
}

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/* Split so the populated dashboard renders in a test — admin needs auth. */
export function CatalogAdminView({
  accountControls,
  onSignIn,
  growth,
  loading,
  error,
}: CatalogAdminPageProps & {
  growth: GrowthResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const stats = growth?.stats;
  /* MRR from the plan mix, since Stripe only ever hands the app price IDs.
     Yearly is amortised so the two lines are comparable. */
  const mrrCents = stats
    ? stats.active_monthly * PRO_PRICE_CENTS.month
      + Math.round(stats.active_yearly * PRO_PRICE_CENTS.year / 12)
    : 0;

  const peak = Math.max(1, ...(growth?.dailySignups ?? []).map((point) => point.signups));

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={<div className="catalog-pricing__rail" aria-hidden="true" />}
    >
      <div className="catalog-admin" data-catalog-admin="true">
        <div className="catalog-browse__bar">
          <h1 className="catalog-browse__title">Insights</h1>
        </div>

        {error ? (
          <p className="catalog-browse__state" role="alert">{error}</p>
        ) : loading || !stats ? (
          <p className="catalog-browse__state" role="status">Loading insights…</p>
        ) : (
          <>
            <div className="catalog-admin__stats">
              {([
                ['Total users', stats.total_users.toLocaleString('en-US'), 'excludes admin accounts'],
                ['New this week', stats.new_users_7d.toLocaleString('en-US'), 'last 7 days'],
                ['Subscribers', stats.active_subscribers.toLocaleString('en-US'),
                  `${stats.active_monthly} monthly · ${stats.active_yearly} yearly`],
                ['MRR', money(mrrCents), 'yearly amortised'],
                ['Daily active', stats.dau.toLocaleString('en-US'), `${stats.wau.toLocaleString('en-US')} weekly`],
                ['Free unlocks used', stats.total_free_unlocks.toLocaleString('en-US'), 'across all accounts'],
                ['Cancelled', stats.canceled_30d.toLocaleString('en-US'), 'last 30 days'],
              ] as const).map(([label, value, note]) => (
                <section key={label} className="catalog-admin__stat">
                  <span className="catalog-app__label">{label}</span>
                  <p className="catalog-settings__value">{value}<small>{note}</small></p>
                </section>
              ))}
            </div>

            {growth && growth.dailySignups.length > 0 ? (
              <section className="catalog-admin__chart" aria-label="Daily signups">
                <span className="catalog-app__label">Daily signups</span>
                {/* Bars carry their own number in the accessible name — a chart
                    nobody can read is decoration. */}
                <ol className="catalog-admin__bars">
                  {growth.dailySignups.map((point) => (
                    <li
                      key={point.day}
                      style={{ height: `${Math.round((point.signups / peak) * 100)}%` }}
                      aria-label={`${point.day}: ${point.signups} ${point.signups === 1 ? 'signup' : 'signups'}`}
                      title={`${point.day}: ${point.signups}`}
                    />
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        )}
      </div>
    </CatalogShell>
  );
}

