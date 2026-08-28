import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl.ts';
import type { ResearchCollection } from '../../db.ts';
import type { FlowCatalogItem } from '../flowCatalogApi.ts';
import {
  createFlowsDiscoveryAdapter,
  PUBLIC_FLOW_CATALOG_LIMIT,
  type FlowsDiscoveryControllerState,
  type FlowsDiscoverySort,
} from '../flowsDiscoveryAdapter.ts';
import { updateLocation, useLocationKey } from '../router.ts';
import {
  useDiscoveryController,
  type DiscoveryController,
  type DiscoveryObserverFactory,
} from '../useDiscoveryController.ts';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
} from './AppsFilterBar.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { DiscoverySignupReveal } from './DiscoverySignupReveal.tsx';
import { FlowGallery } from './FlowGallery.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';
import type { FlowTreeGroup } from '../flowTree.ts';
import {
  loadFlowTaxonomy,
  type FlowTaxonomyCategory,
} from '../flowTaxonomyApi.ts';

function catalogFlowTitle(item: FlowCatalogItem): string { return item.title; }

const FLOW_TAXONOMY_FALLBACK: Array<Pick<FlowTaxonomyCategory, 'slug' | 'name' | 'types'>> = [
  ['authentication', 'Authentication'], ['onboarding', 'Onboarding'],
  ['discovery-navigation', 'Discovery & Navigation'], ['search', 'Search'],
  ['content-detail', 'Content & Detail'], ['creation-editing', 'Creation & Editing'],
  ['communication-collaboration', 'Communication & Collaboration'],
  ['commerce-checkout', 'Commerce & Checkout'], ['monetization', 'Monetization'],
  ['billing', 'Billing'], ['account-settings', 'Account & Settings'],
  ['retention-engagement', 'Retention & Engagement'],
  ['system-privacy-support', 'System, Privacy & Support'],
].map(([slug, name]) => ({ slug, name, types: [] }));

const FLOW_TAXONOMY_COUNTS: Readonly<Record<string, number>> = {
  authentication: 564,
  onboarding: 1339,
  'discovery-navigation': 5638,
  search: 4,
  'content-detail': 45233,
  'creation-editing': 12893,
  'communication-collaboration': 5151,
  'commerce-checkout': 2927,
  monetization: 745,
  billing: 741,
  'account-settings': 9898,
  'retention-engagement': 1409,
  'system-privacy-support': 789,
};

interface FlowsPageViewProps {
  controller: DiscoveryController<
    FlowCatalogItem,
    FlowsDiscoverySort,
    FlowsDiscoveryControllerState
  >;
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
  userRole?: 'admin' | 'user';
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
  previewVariant?: 'full' | 'public' | 'none';
  fullAccessLabel?: string;
  onRequestFullAccess?: (appId: string) => void;
  onOpenFullFlow?: (appId: string, platform: Platform, version: number, flowId: string) => void;
  collections?: ResearchCollection[];
  onCollectionsChange?: (collections: ResearchCollection[]) => void;
  taxonomy?: readonly FlowTaxonomyCategory[];
}

export function FlowsPageView({
  controller,
  onSelectFlow,
  onSelectApp,
  userRole = 'user',
  isGuest = false,
  onGuestLimitReached,
  previewVariant = 'full',
  fullAccessLabel,
  onRequestFullAccess,
  onOpenFullFlow,
  collections,
  onCollectionsChange,
  taxonomy = FLOW_TAXONOMY_FALLBACK as FlowTaxonomyCategory[],
}: FlowsPageViewProps) {
  const flowCategories = useMemo<DiscoveryFilterGroup>(() => ({
    id: 'flowCategories',
    label: 'Categories',
    selected: controller.state.filters
      .filter(({ group }) => group === 'flowCategories')
      .map(({ value }) => value),
    options: taxonomy.map((category) => ({
      value: category.slug,
      label: category.name,
      section: 'Flow categories',
    })),
  }), [controller.state.filters, taxonomy]);
  const flowTypes = useMemo<DiscoveryFilterGroup>(() => ({
    id: 'flowTypes',
    label: 'Flow Types',
    selected: controller.state.filters
      .filter(({ group }) => group === 'flowTypes')
      .map(({ value }) => value),
    options: taxonomy.flatMap((category) => category.types.map((type) => ({
      value: `${category.slug}/${type.slug}`,
      label: type.name,
      section: category.name,
      sectionPosition: category.position,
      position: type.position,
    }))),
  }), [controller.state.filters, taxonomy]);
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

  return (
    <DiscoveryPageLayout
      kind="flows"
      header={<h1 className="visually-hidden">Flows</h1>}
      taxonomyLabel="Browse Flow categories"
      taxonomy={(
        <ReferenceDiscoveryFacetGroup
          label="Categories"
          className="flows-discovery__facet"
        >
          {taxonomy.map((category) => (
            <Button
              key={category.slug}
              label={category.name}
              aria-label={`${category.name}, ${FLOW_TAXONOMY_COUNTS[category.slug] ?? 0} flows`}
              data-flow-taxonomy-option="true"
              data-taxonomy-count={FLOW_TAXONOMY_COUNTS[category.slug] ?? 0}
              variant="ghost"
              size="sm"
              aria-pressed={flowCategories.selected.includes(category.slug)}
              onClick={() => controller.toggleFilter({
                group: flowCategories.id,
                value: category.slug,
              })}
            />
          ))}
        </ReferenceDiscoveryFacetGroup>
      )}
      preview={null}
      toolbar={(
        <DiscoveryFilterBar
          kind="flows"
          ariaLabel="Flow discovery controls"
          platform={{
            value: controller.state.platform,
            ariaLabel: 'Flow platform',
            onChange: controller.setPlatform,
          }}
          filters={[flowCategories, flowTypes]}
          resultCount={controller.items.length}
          resultLabels={['flow', 'flows']}
          showResultCount={false}
          showSort={false}
          sort={controller.state.sort}
          sortOptions={[]}
          onSortChange={() => undefined}
          onToggleFilter={(group, value) => controller.toggleFilter({ group, value })}
          onClearFilter={controller.clearFilterGroup}
        />
      )}
      showResultMeta={false}
      resultLabel="flows"
      singularResultLabel="flow"
      totalCount={isGuest
        ? Math.min(controller.totalCount, PUBLIC_FLOW_CATALOG_LIMIT)
        : controller.totalCount}
      renderedCount={controller.items.length}
      loading={controller.loading}
      loadingMore={controller.loadingMore}
      error={controller.error}
      loadMoreError={controller.loadMoreError}
      onRetry={controller.retry}
      onRetryLoadMore={controller.retryLoadMore}
      onReset={() => controller.setState({ ...controller.state, filters: [] })}
      guestLimitReached={isGuest && controller.items.length >= PUBLIC_FLOW_CATALOG_LIMIT}
      onGuestLimitReached={onGuestLimitReached}
      sentinelRef={controller.sentinelRef}
      footerReveal={<DiscoverySignupReveal />}
    >
      <FlowGallery
        groups={catalogGroups}
        ariaLabel="Flow catalog"
        paginate={false}
        platform={controller.state.platform}
        userRole={userRole}
        collections={collections}
        onCollectionsChange={onCollectionsChange}
        plan={userRole === 'admin' ? 'pro' : 'free'}
        cardPropsForFlow={(flow) => {
          const item = catalogItemsByFlowId.get(flow.id);
          if (!item) return undefined;
          return {
            screenCount: item.preview.screenCount,
            metaLabel: `${item.preview.screenCount} ${item.preview.screenCount === 1 ? 'screen' : 'screens'} · ${item.category} — ${item.type ?? 'Other content detail'}`,
            sourceAppName: item.preview.appName,
            sourceAppIconUrl: item.preview.appIconUrl,
            documentSource: {
              app: item.preview.appId,
              platform: controller.state.platform,
              version: item.preview.version,
              flowId: item.preview.sourceFlowId,
            },
            onOpenSourceApp: () => onSelectApp(item.preview.appId),
            previewVariant,
            fullAccessLabel,
            onRequestFullAccess: onRequestFullAccess
              ? () => onRequestFullAccess(item.preview.appId)
              : undefined,
            onOpen: onOpenFullFlow
              ? () => onOpenFullFlow(
                item.preview.appId,
                controller.state.platform,
                item.preview.version,
                item.preview.sourceFlowId,
              )
              : undefined,
          };
        }}
        onSelectFlow={(flowId) => {
          const item = catalogItemsByFlowId.get(flowId);
          if (item) onSelectFlow(item.title, controller.state.platform);
        }}
      />
    </DiscoveryPageLayout>
  );
}

interface FlowsPageProps {
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
  userRole?: 'admin' | 'user';
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
  previewVariant?: 'full' | 'public' | 'none';
  fullAccessLabel?: string;
  onRequestFullAccess?: (appId: string) => void;
  onOpenFullFlow?: (appId: string, platform: Platform, version: number, flowId: string) => void;
  collections?: ResearchCollection[];
  onCollectionsChange?: (collections: ResearchCollection[]) => void;
}

export function FlowsPage({
  onSelectFlow,
  onSelectApp,
  accountControls,
  userRole = 'user',
  isGuest = false,
  onGuestLimitReached,
  previewVariant = 'full',
  fullAccessLabel,
  onRequestFullAccess,
  onOpenFullFlow,
  collections,
  onCollectionsChange,
}: FlowsPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
  const [taxonomy, setTaxonomy] = useState<FlowTaxonomyCategory[]>(FLOW_TAXONOMY_FALLBACK as FlowTaxonomyCategory[]);
  useEffect(() => {
    const controller = new AbortController();
    void loadFlowTaxonomy(controller.signal)
      .then((categories) => setTaxonomy(categories))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const controller = useFlowsDiscoveryPageController({
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/flows${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
    isGuest,
  });

  return (
    <FlowsPageView
      controller={controller}
      onSelectFlow={onSelectFlow}
      onSelectApp={onSelectApp}
      accountControls={accountControls}
      userRole={userRole}
      isGuest={isGuest}
      onGuestLimitReached={onGuestLimitReached}
      previewVariant={previewVariant}
      fullAccessLabel={fullAccessLabel}
      onRequestFullAccess={onRequestFullAccess}
      onOpenFullFlow={onOpenFullFlow}
      collections={collections}
      onCollectionsChange={onCollectionsChange}
      taxonomy={taxonomy}
    />
  );
}

interface UseFlowsDiscoveryPageControllerOptions {
  locationSearch: string;
  onNavigate(search: string, mode: 'push' | 'replace'): void;
  observerFactory?: DiscoveryObserverFactory;
  isGuest: boolean;
}

export function useFlowsDiscoveryPageController({
  locationSearch,
  onNavigate,
  observerFactory,
  isGuest,
}: UseFlowsDiscoveryPageControllerOptions) {
  const adapter = useMemo(() => createFlowsDiscoveryAdapter({ isGuest }), [isGuest]);
  return useDiscoveryController({
    adapter,
    locationSearch,
    onNavigate,
    observerFactory,
  });
}
