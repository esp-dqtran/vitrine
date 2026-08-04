import {
  useMemo,
  type ReactNode,
} from 'react';
import { Button } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl.ts';
import {
  type FlowCatalogItem,
  loadFlowCatalogFacets,
} from '../flowCatalogApi.ts';
import {
  createFlowsDiscoveryAdapter,
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
import { FlowGallery } from './FlowGallery.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';
import type { FlowTreeGroup } from '../flowTree.ts';

function catalogFlowTitle(item: FlowCatalogItem): string {
  if (
    item.category === 'Other Flows'
    || item.category.trim().toLowerCase() === item.title.trim().toLowerCase()
  ) {
    return item.title;
  }
  return `${item.title} from ${item.category}`;
}

const FLOW_TAXONOMY_OPTION_LIMIT = 15;

function flowTaxonomyOptions(group: DiscoveryFilterGroup) {
  const defaults = group.options.slice(0, FLOW_TAXONOMY_OPTION_LIMIT);
  const defaultValues = new Set(defaults.map(({ value }) => value));
  const deepSelected = group.options.filter(({ value }) =>
    group.selected.includes(value) && !defaultValues.has(value));
  return [
    ...defaults.slice(0, Math.max(0, FLOW_TAXONOMY_OPTION_LIMIT - deepSelected.length)),
    ...deepSelected.slice(0, FLOW_TAXONOMY_OPTION_LIMIT),
  ];
}

interface FlowsPageViewProps {
  controller: DiscoveryController<
    FlowCatalogItem,
    FlowsDiscoverySort,
    FlowsDiscoveryControllerState
  >;
  onOpenSearch: () => void;
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
  userRole?: 'admin' | 'user';
}

export function FlowsPageView({
  controller,
  onSelectFlow,
  onSelectApp,
  userRole = 'user',
}: FlowsPageViewProps) {
  const flowGroups = useMemo<DiscoveryFilterGroup>(() => ({
    id: 'flowGroups',
    label: 'Flow groups',
    selected: controller.state.filters
      .filter(({ group }) => group === 'flowGroups')
      .map(({ value }) => value),
    options: controller.facets
      .filter(({ group }) => group === 'flowGroups')
      .map((facet) => ({
        value: facet.value,
        section: facet.section?.trim() || 'Flow groups',
        count: facet.count,
      })),
    loadOptions: async (query, signal) => {
      const selected = controller.state.filters
        .filter(({ group }) => group === 'flowGroups')
        .map(({ value }) => value);
      const facets = await loadFlowCatalogFacets({
        platform: controller.state.platform,
        query: controller.state.query,
        flowGroups: selected,
      }, query, selected, signal);
      return facets.map((facet) => ({
        value: facet.value,
        section: facet.section?.trim() || 'Flow groups',
        count: facet.count,
      }));
    },
  }), [
    controller.facets,
    controller.state.filters,
    controller.state.platform,
    controller.state.query,
  ]);
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
      header={null}
      taxonomyLabel="Flow discovery filters"
      taxonomy={(
        <ReferenceDiscoveryFacetGroup
          label="Flow groups"
          wide
          className="flows-discovery__facet"
        >
          {flowTaxonomyOptions(flowGroups).map((option) => (
            <Button
              key={option.value}
              label={option.value}
              data-flow-taxonomy-option="true"
              variant="ghost"
              size="sm"
              aria-pressed={flowGroups.selected.includes(option.value)}
              onClick={() => controller.toggleFilter({
                group: flowGroups.id,
                value: option.value,
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
          filters={[flowGroups]}
          resultCount={controller.items.length}
          resultLabels={['flow', 'flows']}
          showResultCount={false}
          sort={controller.state.sort}
          sortOptions={[
            { value: 'popular', label: 'Popular' },
            { value: 'grouped', label: 'Grouped' },
          ]}
          onSortChange={(value) => controller.setSort(value as FlowsDiscoverySort)}
          onToggleFilter={(group, value) => controller.toggleFilter({ group, value })}
          onClearFilter={controller.clearFilterGroup}
        />
      )}
      resultLabel="flows"
      singularResultLabel="flow"
      totalCount={controller.totalCount}
      renderedCount={controller.items.length}
      loading={controller.loading}
      loadingMore={controller.loadingMore}
      error={controller.error}
      loadMoreError={controller.loadMoreError}
      onRetry={controller.retry}
      onRetryLoadMore={controller.retryLoadMore}
      onReset={() => controller.setState({ ...controller.state, filters: [] })}
      sentinelRef={controller.sentinelRef}
    >
      <FlowGallery
        groups={catalogGroups}
        ariaLabel="Flow catalog"
        paginate={false}
        platform={controller.state.platform}
        userRole={userRole}
        cardPropsForFlow={(flow) => {
          const item = catalogItemsByFlowId.get(flow.id);
          if (!item) return undefined;
          return {
            screenCount: item.preview.screenCount,
            metaLabel: `${item.preview.screenCount} ${item.preview.screenCount === 1 ? 'screen' : 'screens'} · observed in ${item.count} ${item.count === 1 ? 'app' : 'apps'}`,
            sourceAppName: item.preview.appName,
            sourceAppIconUrl: item.preview.appIconUrl,
            documentSource: {
              app: item.preview.appId,
              platform: controller.state.platform,
              version: item.preview.version,
              flowId: item.preview.sourceFlowId,
            },
            onOpenSourceApp: () => onSelectApp(item.preview.appId),
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
  onOpenSearch: () => void;
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
  userRole?: 'admin' | 'user';
}

export function FlowsPage({
  onOpenSearch,
  onSelectFlow,
  onSelectApp,
  accountControls,
  userRole = 'user',
}: FlowsPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
  const controller = useFlowsDiscoveryPageController({
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/flows${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
  });

  return (
    <FlowsPageView
      controller={controller}
      onOpenSearch={onOpenSearch}
      onSelectFlow={onSelectFlow}
      onSelectApp={onSelectApp}
      accountControls={accountControls}
      userRole={userRole}
    />
  );
}

interface UseFlowsDiscoveryPageControllerOptions {
  locationSearch: string;
  onNavigate(search: string, mode: 'push' | 'replace'): void;
  observerFactory?: DiscoveryObserverFactory;
}

export function useFlowsDiscoveryPageController({
  locationSearch,
  onNavigate,
  observerFactory,
}: UseFlowsDiscoveryPageControllerOptions) {
  const adapter = useMemo(() => createFlowsDiscoveryAdapter(), []);
  return useDiscoveryController({
    adapter,
    locationSearch,
    onNavigate,
    observerFactory,
  });
}
