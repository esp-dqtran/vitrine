import { useMemo, useState, type ReactNode } from 'react';
import {
  createSitesDiscoveryAdapter,
  PUBLIC_SITES_CATALOG_LIMIT,
  type SitesDiscoveryControllerState,
} from '../sitesDiscoveryAdapter.ts';
import type { SiteSummary } from '../types.ts';
import { useCatalogCategories } from '../categoryFacets.ts';
import { navigate, updateLocation, useLocationKey } from '../router.ts';
import { useDiscoveryController } from '../useDiscoveryController.ts';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';
import { SiteCard } from './SiteCard.tsx';

export interface CatalogSitesPageProps {
  isAdmin: boolean;
  isGuest?: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  onOpenSite: (site: SiteSummary) => void;
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
}

/*
 * Sites on the rebuilt surface. Site captures are wide, and many carry a
 * scroll video rather than a still — the card leads with whichever the record
 * actually has instead of forcing a poster frame.
 */
export function CatalogSitesPage({
  isAdmin,
  isGuest = false,
  accountControls,
  onSignIn,
  onOpenSite,
  entitlement,
  onUpgrade,
}: CatalogSitesPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?')
    ? locationKey.slice(locationKey.indexOf('?'))
    : '';
  const adapter = useMemo(() => createSitesDiscoveryAdapter({ isGuest }), [isGuest]);
  const controller = useDiscoveryController<
    SiteSummary,
    SitesDiscoveryControllerState['sort'],
    SitesDiscoveryControllerState
  >({
    adapter,
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/browse/sites${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
  });

  const [showAllCategories, setShowAllCategories] = useState(false);
  const categories = useCatalogCategories(
    { platform: 'web', contentType: 'apps', sort: 'latest', query: '', filters: [] },
    isAdmin,
  );

  const displayedTotal = controller.totalCount === null
    ? null
    : isGuest
      ? Math.min(controller.totalCount, PUBLIC_SITES_CATALOG_LIMIT)
      : controller.totalCount;

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active="sites"
          categories={categories}
          selectedCategories={[]}
          showAllCategories={showAllCategories}
          onToggleShowAll={() => setShowAllCategories((open) => !open)}
          onSelectCategory={(value) =>
            updateLocation(`/browse?filter=categories.${encodeURIComponent(value)}`)}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === 'sites') return;
            if (section === 'apps') navigate({ name: 'browse' });
            else if (section === 'flows') navigate({ name: 'browse-flows' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => navigate({ name: 'browse-search' })}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-sites" data-catalog-sites="true">
        <div className="catalog-browse__bar">
          <h1 className="catalog-browse__title">Sites</h1>
          {displayedTotal !== null ? (
            <p className="catalog-browse__count" aria-live="polite">
              {displayedTotal} {displayedTotal === 1 ? 'site' : 'sites'}
            </p>
          ) : null}
        </div>

        {controller.error ? (
          <p className="catalog-browse__state" role="alert">{controller.error}</p>
        ) : controller.loading && controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">Loading sites…</p>
        ) : controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">No sites match these filters.</p>
        ) : (
          <div className="reference-discovery__grid sites-discovery__grid">
            {controller.items.map((site) => (
              <SiteCard
                key={`${site.id}:${site.versionId}`}
                site={site}
                onOpen={() => onOpenSite(site)}
              />
            ))}
          </div>
        )}

        <div ref={controller.sentinelRef} aria-hidden="true" />
      </div>
    </CatalogShell>
  );
}

