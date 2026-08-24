import { useMemo, useState, type ReactNode } from 'react';
import type { AppsPlatform } from '../appsDiscovery.ts';
import type { FlowCatalogItem } from '../flowCatalogApi.ts';
import {
  createFlowsDiscoveryAdapter,
  PUBLIC_FLOW_CATALOG_LIMIT,
  type FlowsDiscoveryControllerState,
} from '../flowsDiscoveryAdapter.ts';
import { useCatalogCategories } from '../categoryFacets.ts';
import { navigate, updateLocation, useLocationKey } from '../router.ts';
import { useDiscoveryController } from '../useDiscoveryController.ts';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';
import { FlowGallery } from './FlowGallery.tsx';
import type { FlowTreeGroup } from '../flowTree.ts';

const PLATFORMS: { value: AppsPlatform; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

export interface CatalogFlowsPageProps {
  isAdmin: boolean;
  isGuest?: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  onOpenApp: (appId: string) => void;
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
}

/*
 * Flows on the rebuilt surface. The rows and shell are new; the flow cards
 * themselves are the product's own FlowGallery, so this page and v1 cannot
 * drift apart on how a captured flow is presented.
 */
function catalogFlowTitle(item: FlowCatalogItem): string {
  if (
    item.category === 'Other Flows'
    || item.category.trim().toLowerCase() === item.title.trim().toLowerCase()
  ) {
    return item.title;
  }
  return `${item.title} from ${item.category}`;
}

export function CatalogFlowsPage({
  isAdmin,
  isGuest = false,
  accountControls,
  onSignIn,
  onOpenApp,
  entitlement,
  onUpgrade,
}: CatalogFlowsPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?')
    ? locationKey.slice(locationKey.indexOf('?'))
    : '';
  const adapter = useMemo(() => createFlowsDiscoveryAdapter({ isGuest }), [isGuest]);
  const controller = useDiscoveryController<
    FlowCatalogItem,
    FlowsDiscoveryControllerState['sort'],
    FlowsDiscoveryControllerState
  >({
    adapter,
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/browse/flows${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
  });

  const [showAllCategories, setShowAllCategories] = useState(false);
  const categories = useCatalogCategories(
    {
      platform: controller.state.platform,
      contentType: 'apps',
      sort: 'latest',
      query: '',
      filters: [],
    },
    isAdmin,
  );

  /* The same shape v1's flows page builds: one standalone group holding
     every loaded flow, titled the way that page titles them. */
  const catalogItemsByFlowId = useMemo(
    () => new Map(controller.items.map((item) => [item.preview.flow.id, item])),
    [controller.items],
  );
  const catalogGroups = useMemo<FlowTreeGroup[]>(() => [{
    id: 'flow-catalog',
    label: 'Flow catalog',
    standalone: true,
    flows: controller.items.map((item) => ({
      ...item.preview.flow,
      title: catalogFlowTitle(item),
    })),
  }], [controller.items]);

  const displayedTotal = controller.totalCount === null
    ? null
    : isGuest
      ? Math.min(controller.totalCount, PUBLIC_FLOW_CATALOG_LIMIT)
      : controller.totalCount;

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active="flows"
          categories={categories}
          selectedCategories={[]}
          showAllCategories={showAllCategories}
          onToggleShowAll={() => setShowAllCategories((open) => !open)}
          onSelectCategory={(value) =>
            updateLocation(`/browse?filter=categories.${encodeURIComponent(value)}`)}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === 'flows') return;
            if (section === 'apps') navigate({ name: 'browse' });
            else if (section === 'sites') navigate({ name: 'browse-sites' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => navigate({ name: 'browse-search' })}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-flows" data-catalog-flows="true">
        <div className="catalog-browse__bar">
          <h1 className="catalog-browse__title">Flows</h1>
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
          {displayedTotal !== null ? (
            <p className="catalog-browse__count" aria-live="polite">
              {displayedTotal} {displayedTotal === 1 ? 'flow' : 'flows'}
            </p>
          ) : null}
        </div>

        {controller.error ? (
          <p className="catalog-browse__state" role="alert">{controller.error}</p>
        ) : controller.loading && controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">Loading flows…</p>
        ) : controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">No flows match these filters.</p>
        ) : (
          <FlowGallery
            groups={catalogGroups}
            ariaLabel="Flow catalog"
            paginate={false}
            platform={controller.state.platform}
            cardPropsForFlow={(flow) => {
              const item = catalogItemsByFlowId.get(flow.id);
              if (!item) return undefined;
              return {
                screenCount: item.preview.screenCount,
                metaLabel: `${item.preview.screenCount} ${
                  item.preview.screenCount === 1 ? 'screen' : 'screens'
                }`,
                sourceAppName: item.preview.appName,
                sourceAppIconUrl: item.preview.appIconUrl,
                /* Resolves the step media — without it the card renders its
                   frame and no captures. */
                documentSource: {
                  app: item.preview.appId,
                  platform: controller.state.platform,
                  version: item.preview.version,
                  flowId: item.preview.sourceFlowId,
                },
                onOpenSourceApp: () => onOpenApp(item.preview.appId),
              };
            }}
            onSelectFlow={(flowId) => {
              const item = catalogItemsByFlowId.get(flowId);
              if (item) onOpenApp(item.preview.appId);
            }}
          />
        )}

        <div ref={controller.sentinelRef} aria-hidden="true" />
      </div>
    </CatalogShell>
  );
}
