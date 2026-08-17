import type { ReactNode } from 'react';
import { navigate } from '../router.ts';
import { CatalogShell } from './CatalogShell.tsx';

/*
 * The small standalone pages, rebuilt on the shell so they carry the same
 * header and measure as the rest of the catalog. Each has no taxonomy to
 * show, so the sidebar slot is an empty rail — the shell's two-column grid
 * still needs a left cell to keep the main column on the shared measure.
 */
function StaticShell({
  accountControls,
  onSignIn,
  children,
}: {
  accountControls?: ReactNode;
  onSignIn?: () => void;
  children: ReactNode;
}) {
  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={<div className="catalog-pricing__rail" aria-hidden="true" />}
    >
      {children}
    </CatalogShell>
  );
}

export interface CatalogStaticPageProps {
  accountControls?: ReactNode;
  onSignIn?: () => void;
}

/* ---------- Not found ---------- */

export function CatalogNotFoundPage({
  pathname,
  ...shell
}: CatalogStaticPageProps & { pathname?: string }) {
  return (
    <StaticShell {...shell}>
      <div className="catalog-static" data-catalog-not-found="true">
        <h1>That page isn&#8217;t here.</h1>
        {/* Naming the path is the difference between "something went wrong"
            and a reader realising they mistyped one character. */}
        {pathname ? <p className="catalog-static__path">{pathname}</p> : null}
        <p>
          It may have moved, or the link may be wrong. The catalog is the best
          place to pick the thread back up.
        </p>
        <div className="catalog-static__actions">
          <button
            type="button"
            className="catalog-static__cta"
            onClick={() => navigate({ name: 'browse' })}
          >
            Browse the catalog
          </button>
          <button
            type="button"
            className="catalog-static__cta catalog-static__cta--ghost"
            onClick={() => navigate({ name: 'browse-search' })}
          >
            Search instead
          </button>
        </div>
      </div>
    </StaticShell>
  );
}

/* ---------- Billing success ---------- */

export function CatalogBillingSuccessPage(props: CatalogStaticPageProps) {
  return (
    <StaticShell {...props}>
      <div className="catalog-static" data-catalog-billing-success="true">
        <span className="catalog-static__eyebrow">Payment received</span>
        <h1>You&#8217;re on Pro.</h1>
        <p>
          The whole catalog is open — every current and future published
          application, full search and comparison, unlimited collections, and
          the exports covered by the fair-use policy.
        </p>
        {/* Stripe's webhook lands separately from this redirect, so the plan
            can read Free for a moment. Saying so beats a reader thinking the
            payment failed. */}
        <p className="catalog-static__note">
          If your plan still reads Free, give it a moment and reload — the
          receipt and this page arrive by different routes.
        </p>
        <div className="catalog-static__actions">
          <button
            type="button"
            className="catalog-static__cta"
            onClick={() => navigate({ name: 'browse' })}
          >
            Start browsing
          </button>
          <button
            type="button"
            className="catalog-static__cta catalog-static__cta--ghost"
            onClick={() => navigate({ name: 'browse-settings' })}
          >
            View account
          </button>
        </div>
      </div>
    </StaticShell>
  );
}

/* ---------- Build in public ---------- */

const ENGINES = [
  {
    step: '01',
    name: 'What we capture',
    description: 'Application and site captures, collected at scale and versioned.',
    now: 'Broadening platform coverage across iOS, Android and Web',
  },
  {
    step: '02',
    name: 'What we learn',
    description: 'Raw captures become structured design intelligence: flows, elements, design systems.',
    now: 'Normalizing flows into a browsable hierarchy',
  },
  {
    step: '03',
    name: 'What we build',
    description: 'The evidence surfaces in the product as features you can use today.',
    now: 'Unifying discovery across Apps, Sites and Flows',
  },
];

const AHEAD = [
  {
    label: 'Up next',
    title: 'Public launch and feedback loop',
    description: 'Finish the public-facing experience, validate the launch path, and open a deliberate channel for early users.',
  },
  {
    label: 'Exploring',
    title: 'Collaborative research and integrations',
    description: 'Shared evidence comparisons, decision trails, team handoff, and external integrations once the core is stable.',
  },
];

export function CatalogBuildInPublicPage(props: CatalogStaticPageProps) {
  return (
    <StaticShell {...props}>
      <div className="catalog-static catalog-static--wide" data-catalog-build-in-public="true">
        <span className="catalog-static__eyebrow">Build in public</span>
        <h1>Building the design intelligence workspace in the open.</h1>
        <p>
          Three engines, one pipeline: what we capture, what we learn from it,
          and what that becomes in the product.
        </p>

        <section className="catalog-static__section" aria-label="How it runs">
          <h2>Three engines, one pipeline</h2>
          <ol className="catalog-static__engines">
            {ENGINES.map((engine) => (
              <li key={engine.step}>
                <span className="catalog-static__step">{engine.step}</span>
                <div>
                  <h3>{engine.name}</h3>
                  <p>{engine.description}</p>
                  <p className="catalog-static__now">Now: {engine.now}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="catalog-static__section" aria-label="The road ahead">
          <h2>Where this is going</h2>
          <div className="catalog-static__ahead">
            {AHEAD.map((item) => (
              <article key={item.title}>
                <span className="catalog-static__label">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
          {/* The v1 page carries this line and it should survive the rebuild:
              a roadmap that reads as a commitment is a promise nobody made. */}
          <p className="catalog-static__note">
            Future entries describe intent, not a delivery promise. The useful
            parts are already here.
          </p>
        </section>

        <div className="catalog-static__actions">
          <button
            type="button"
            className="catalog-static__cta"
            onClick={() => navigate({ name: 'browse' })}
          >
            Browse the catalog
          </button>
          <button
            type="button"
            className="catalog-static__cta catalog-static__cta--ghost"
            onClick={() => navigate({ name: 'browse-pricing' })}
          >
            See pricing
          </button>
        </div>
      </div>
    </StaticShell>
  );
}

