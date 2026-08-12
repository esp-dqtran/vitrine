import {
  normalizeDiscoveryFilters,
  parseDiscoveryState,
  serializeDiscoveryState,
  type DiscoveryStateDefinition,
} from './discoveryState.ts';
import type {
  DiscoveryAdapter,
  DiscoveryFilter,
  DiscoveryState,
} from './discoveryTypes.ts';
import {
  flowCatalogItemKey,
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from './flowCatalogApi.ts';
/** Number of flow cards shown to Free-plan visitors. */
export const PUBLIC_FLOW_CATALOG_LIMIT = 6;

export type FlowsDiscoverySort = 'grouped';
export type FlowsDiscoveryControllerState = DiscoveryState<FlowsDiscoverySort>;

export interface FlowsDiscoveryAdapterDefaults {
  platform?: FlowsDiscoveryControllerState['platform'];
  sort?: FlowsDiscoverySort;
  query?: string;
  filters?: DiscoveryFilter[];
  isGuest?: boolean;
}

const STATE_DEFINITION: DiscoveryStateDefinition<FlowsDiscoverySort> = {
  platforms: ['web', 'ios', 'android'],
  sorts: ['grouped'],
  filterGroups: ['flowGroups'],
};

function normalizedDefaults(
  initial: FlowsDiscoveryAdapterDefaults,
): FlowsDiscoveryControllerState {
  return {
    platform: STATE_DEFINITION.platforms.includes(initial.platform ?? 'web')
      ? initial.platform ?? 'web'
      : 'web',
    sort: 'grouped',
    query: initial.query?.trim().slice(0, 120) ?? '',
    filters: normalizeDiscoveryFilters(initial.filters ?? [], STATE_DEFINITION),
  };
}

export function createFlowsDiscoveryAdapter(
  initial: FlowsDiscoveryAdapterDefaults = {},
): DiscoveryAdapter<
  FlowCatalogItem,
  FlowsDiscoverySort,
  FlowsDiscoveryControllerState
> {
  const defaults = normalizedDefaults(initial);

  return {
    defaults,
    parse(search) {
      return parseDiscoveryState(search, defaults, STATE_DEFINITION);
    },
    serialize(state) {
      return serializeDiscoveryState(state, STATE_DEFINITION);
    },
    request(state, cursor, signal) {
      return loadFlowCatalogPage({
        platform: state.platform,
        query: state.query || undefined,
        cursor: cursor ?? undefined,
        limit: initial.isGuest ? PUBLIC_FLOW_CATALOG_LIMIT : 12,
        flowGroups: state.filters
          .filter(({ group }) => group === 'flowGroups')
          .map(({ value }) => value),
      }, signal);
    },
    itemKey: flowCatalogItemKey,
  };
}

export function selectedFlowDiscoverySearch(
  currentSearch: string,
  query: string,
  platform: FlowsDiscoveryControllerState['platform'],
  flowGroup?: string,
): string {
  const adapter = createFlowsDiscoveryAdapter();
  const current = adapter.parse(currentSearch);
  return adapter.serialize({
    ...current,
    platform,
    query,
    filters: flowGroup
      ? [{ group: 'flowGroups', value: flowGroup }]
      : current.filters,
  });
}
