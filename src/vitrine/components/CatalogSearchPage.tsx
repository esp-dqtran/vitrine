import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALL_APPS_CATEGORIES, type AppsPlatform } from '../appsDiscovery.ts';
import {
  createAppsDiscoveryAdapter,
  loadAppsDiscoveryFacets,
  PUBLIC_APPS_CATALOG_LIMIT,
  type AppsDiscoveryControllerState,
} from '../appsDiscoveryAdapter.ts';
import { rankCategoryFacets } from '../categoryFacets.ts';
import type { DiscoveryFacet } from '../discoveryTypes.ts';
import type { App } from '../types.ts';
import { navigate, updateLocation, useLocationKey } from '../router.ts';
import { useDiscoveryController } from '../useDiscoveryController.ts';
import { AppCard } from './AppCard.tsx';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';

const PLATFORMS: { value: AppsPlatform; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

export interface CatalogSearchPageProps {
  isAdmin: boolean;
  isGuest?: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  onOpenApp: (appId: string) => void;
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
}

/*
 * Search on the rebuilt surface. The query lives in the URL so a result set is
 * shareable and survives a reload — the same reason the filters do — and the
 * sidebar's ⌘K row lands here rather than opening a separate palette.
 */
export function CatalogSearchPage({
  isAdmin,
  isGuest = false,
  accountControls,
  onSignIn,
  onOpenApp,
  entitlement,
  onUpgrade,
}: CatalogSearchPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?')
    ? locationKey.slice(locationKey.indexOf('?'))
    : '';
  const adapter = useMemo(() => createAppsDiscoveryAdapter({}), []);
  const controller = useDiscoveryController<
    App,
    AppsDiscoveryControllerState['sort'],
    AppsDiscoveryControllerState
  >({
    adapter,
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/browse/search${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
  });

  const query = controller.state.query;
  const [draft, setDraft] = useState(query);
  /* The field follows the URL, so back/forward and a shared link all restore
     the query someone actually searched for. */
  useEffect(() => { setDraft(query); }, [query]);

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categoryFacets, setCategoryFacets] = useState<DiscoveryFacet[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    /* Counts are unscoped by the query on purpose: the sidebar is navigation,
       not a breakdown of the current search. Scoping it made every category
       read 0 and drop its number the moment someone typed. */
    loadAppsDiscoveryFacets(
      { ...controller.state, query: '', filters: [] },
      'categories', '', [], isAdmin ? 'admin' : 'catalog', abort.signal,
    ).then(setCategoryFacets).catch(() => undefined);
    return () => abort.abort();
  }, [controller.state.platform, isAdmin]);
  const categories = useMemo(
    () => rankCategoryFacets(ALL_APPS_CATEGORIES, categoryFacets),
    [categoryFacets],
  );

  const total = controller.totalCount === null
    ? null
    : isGuest
      ? Math.min(controller.totalCount, PUBLIC_APPS_CATALOG_LIMIT)
      : controller.totalCount;

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active="apps"
          categories={categories}
          selectedCategories={[]}
          showAllCategories={showAllCategories}
          onToggleShowAll={() => setShowAllCategories((open) => !open)}
          onSelectCategory={(value) =>
            updateLocation(`/browse?filter=categories.${encodeURIComponent(value)}`)}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === 'apps') navigate({ name: 'browse' });
            else if (section === 'flows') navigate({ name: 'browse-flows' });
            else if (section === 'sites') navigate({ name: 'browse-sites' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => undefined}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-search" data-catalog-search="true">
        <form
          className="catalog-search__form"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            controller.setQuery(draft.trim());
          }}
        >
          <input
            type="search"
            value={draft}
            placeholder="Search the catalog"
            aria-label="Search the catalog"
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        <div className="catalog-browse__bar">
          <div className="catalog-browse__platforms" role="group" aria-label="Platform">
            {PLATFORMS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`catalog-browse__platform${
                  controller.state.platform === value ? ' is-active' : ''
                }`}
                aria-pressed={controller.state.platform === value}
                onClick={() => controller.setPlatform(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {query && total !== null ? (
            <p className="catalog-browse__count" aria-live="polite">
              {total} {total === 1 ? 'result' : 'results'}
            </p>
          ) : null}
        </div>

        {!query ? (
          <p className="catalog-browse__state" role="status">
            Search apps by name, description or captured screen content.
          </p>
        ) : controller.error ? (
          <p className="catalog-browse__state" role="alert">{controller.error}</p>
        ) : controller.loading && controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">Searching…</p>
        ) : controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">
            Nothing matched “{query}”. Try a broader term.
          </p>
        ) : (
          <div className="catalog-browse__grid">
            {controller.items.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                platform={controller.state.platform}
                onOpen={() => onOpenApp(app.id)}
                href={`/browse/${encodeURIComponent(app.id)}`}
              />
            ))}
          </div>
        )}

        <div ref={controller.sentinelRef} aria-hidden="true" />
      </div>
    </CatalogShell>
  );
}
