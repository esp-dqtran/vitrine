import type { ReactNode } from 'react';
import { navigate, updateLocation, type Route } from '../router.ts';

export type CatalogHeaderTab = 'explore' | 'latest' | 'collections';

/* The reference puts content views in the header and taxonomy in the sidebar.
   These are views of the catalog, not the sections the sidebar already owns —
   repeating Apps/Flows/Sites up here would be duplication, not structure. */
const TABS: { id: CatalogHeaderTab; label: string; go: () => void }[] = [
  { id: 'explore', label: 'Explore', go: () => navigate({ name: 'browse' }) },
  {
    id: 'latest',
    label: 'Latest additions',
    go: () => updateLocation('/browse?sort=latest'),
  },
  {
    id: 'collections',
    label: 'Collections',
    go: () => navigate({ name: 'browse-collections' } as Route),
  },
];

export interface CatalogShellProps {
  /* Rendered in the left column. Pages own their own sidebar wiring because
     each one selects and filters differently. */
  sidebar: ReactNode;
  /* Which header view is current; omit on pages that are not a catalog view. */
  activeTab?: CatalogHeaderTab;
  /* Account menu when signed in; the shell falls back to a Sign in button. */
  accountControls?: ReactNode;
  onSignIn?: () => void;
  children: ReactNode;
}

/*
 * Chrome for the rebuilt catalog surfaces: a full-width header over a
 * sidebar + content split, matching the reference's organisation.
 */
export function CatalogShell({
  sidebar,
  activeTab,
  accountControls,
  onSignIn,
  children,
}: CatalogShellProps) {
  return (
    <div className="catalog-shell" data-catalog-shell="true">
      {/* The sidebar is the full-height column and carries the brand; the
          header sits only above the content, the way the reference does it. */}
      {sidebar}
      <header className="catalog-shell__header">
        <nav className="catalog-shell__tabs" aria-label="Catalog views">
          {TABS.map(({ id, label, go }) => (
            <button
              key={id}
              type="button"
              className={`catalog-shell__tab${activeTab === id ? ' is-active' : ''}`}
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={go}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="catalog-shell__actions">
          {accountControls ?? (onSignIn ? (
            <>
              <button
                type="button"
                className="catalog-shell__signin"
                onClick={onSignIn}
              >
                Log in
              </button>
              <button
                type="button"
                className="catalog-shell__signup"
                onClick={onSignIn}
              >
                Sign up
              </button>
            </>
          ) : null)}
        </div>
      </header>
      <div className="catalog-shell__main">{children}</div>
    </div>
  );
}

