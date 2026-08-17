import { useState, type ReactNode } from 'react';
import { PRO_PRICE_CENTS } from '../../pricing.ts';
import { CatalogShell } from './CatalogShell.tsx';

/* Same entitlements the product enforces — kept here so the rebuilt page never
   drifts from `src/pricing.ts` on price, and from the API on limits. */
const FREE_FEATURES = [
  'Public catalog metadata and limited previews',
  '3 applications, unlocked permanently',
  'Complete screens, flows, components, tokens and evidence for those apps',
  '1 personal collection',
];

const PRO_FEATURES = [
  'Every current and future published application while subscribed',
  'Complete screens, flows, components, foundation tokens and evidence',
  'Full catalog search, filters and cross-application comparison',
  'Unlimited personal collections and research notes',
  'Selected editable exports within the fair-use policy',
];

const COMPARE: [string, string, string][] = [
  ['Catalog access', '3 apps, chosen by you', 'Every app, current and future'],
  ['Screens, flows, tokens, evidence', 'Full depth on your 3 apps', 'Full depth across the catalog'],
  ['Search and comparison', 'Basic browse', 'Full search, filters, cross-app comparison'],
  ['Personal collections', '1', 'Unlimited'],
  ['Research notes', '—', 'Included'],
  ['Editable exports', '—', 'Selected, fair-use'],
];

const FAQS: [string, string][] = [
  [
    'What happens after I use my 3 free unlocks?',
    'Nothing is taken away — your 3 unlocked applications stay fully accessible for good. To reach the rest of the catalog, upgrade to Pro.',
  ],
  [
    'Can I swap an unlocked app for a different one?',
    'No. Unlocking is a deliberate choice: you confirm the action and see how many unlocks remain. Once unlocked, an app cannot be exchanged.',
  ],
  [
    'Does opening a preview use an unlock?',
    'No. Browsing public catalog previews never consumes an unlock — only the explicit unlock confirmation does.',
  ],
  [
    'What is the difference between monthly and yearly Pro?',
    'Only the price. Both carry identical entitlements; yearly is billed once a year at a lower effective rate.',
  ],
];

export interface CatalogPricingPageProps {
  plan?: 'free' | 'pro' | null;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  onCheckout: (interval: 'month' | 'year') => void;
  onBrowse: () => void;
  loading?: boolean;
  error?: string | null;
}

export function CatalogPricingPage({
  plan = null,
  accountControls,
  onSignIn,
  onCheckout,
  onBrowse,
  loading = false,
  error = null,
}: CatalogPricingPageProps) {
  const [yearly, setYearly] = useState(false);
  const interval = yearly ? 'year' : 'month';
  const price = (PRO_PRICE_CENTS[interval] / 100).toFixed(2);
  /* Yearly is billed once; showing it as a monthly figure without saying so
     would misstate what gets charged. */
  const priceNote = yearly ? `billed $${price} once a year` : 'per month';

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={<div className="catalog-pricing__rail" aria-hidden="true" />}
    >
      <div className="catalog-pricing" data-catalog-pricing="true">
        <header className="catalog-pricing__head">
          <h1>Free to explore. ${(PRO_PRICE_CENTS.month / 100).toFixed(2)} a month to go deeper.</h1>
          <p>
            Three applications are yours permanently, at no cost. Pro opens the
            rest of the catalog for as long as you subscribe.
          </p>
          <div className="catalog-pricing__toggle" role="group" aria-label="Billing interval">
            <button
              type="button"
              aria-pressed={!yearly}
              className={!yearly ? 'is-active' : undefined}
              onClick={() => setYearly(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={yearly}
              className={yearly ? 'is-active' : undefined}
              onClick={() => setYearly(true)}
            >
              Yearly
            </button>
          </div>
        </header>

        {error ? <p className="catalog-browse__state" role="alert">{error}</p> : null}

        <div className="catalog-pricing__plans">
          <section className="catalog-pricing__plan">
            <h2>Free</h2>
            <p className="catalog-pricing__price">$0<small>forever</small></p>
            <ul>
              {FREE_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <button
              type="button"
              className="catalog-pricing__cta catalog-pricing__cta--ghost"
              onClick={onBrowse}
            >
              {plan ? 'Browse the catalog' : 'Start free'}
            </button>
          </section>

          <section className="catalog-pricing__plan catalog-pricing__plan--pro">
            <h2>Pro <span>Full catalog</span></h2>
            <p className="catalog-pricing__price">${price}<small>{priceNote}</small></p>
            <ul>
              {PRO_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <button
              type="button"
              className="catalog-pricing__cta"
              disabled={loading || plan === 'pro'}
              onClick={() => (plan ? onCheckout(interval) : onSignIn?.())}
            >
              {plan === 'pro' ? 'Current plan' : loading ? 'Opening checkout…' : 'Upgrade to Pro'}
            </button>
          </section>
        </div>

        <section className="catalog-pricing__section" aria-label="Plan comparison">
          <h2>What changes</h2>
          <div className="catalog-pricing__tablewrap">
            <table className="catalog-pricing__table">
              <thead>
                <tr><th scope="col">&nbsp;</th><th scope="col">Free</th><th scope="col">Pro</th></tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, free, pro]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{free}</td>
                    <td>{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="catalog-pricing__section" aria-label="Questions">
          <h2>Questions</h2>
          <dl className="catalog-pricing__faq">
            {FAQS.map(([question, answer]) => (
              <div key={question}>
                <dt>{question}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </CatalogShell>
  );
}

