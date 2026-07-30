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

export type FlowsDiscoverySort = 'popular' | 'grouped';
export type FlowsDiscoveryControllerState = DiscoveryState<FlowsDiscoverySort>;

export interface FlowsDiscoveryAdapterDefaults {
  platform?: FlowsDiscoveryControllerState['platform'];
  sort?: FlowsDiscoverySort;
  query?: string;
  filters?: DiscoveryFilter[];
}

const STATE_DEFINITION: DiscoveryStateDefinition<FlowsDiscoverySort> = {
  platforms: ['web', 'ios', 'android'],
  sorts: ['popular', 'grouped'],
  filterGroups: ['flowGroups'],
};

function normalizedDefaults(
  initial: FlowsDiscoveryAdapterDefaults,
): FlowsDiscoveryControllerState {
  return {
    platform: STATE_DEFINITION.platforms.includes(initial.platform ?? 'web')
      ? initial.platform ?? 'web'
      : 'web',
    sort: initial.sort === 'grouped' ? 'grouped' : 'popular',
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
        limit: 12,
        order: state.sort === 'grouped' ? 'grouped' : 'browse',
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
): string {
  const params = new URLSearchParams(currentSearch);
  params.set('platform', platform);
  params.set('query', query);
  const adapter = createFlowsDiscoveryAdapter();
  return adapter.serialize(adapter.parse(params.toString()));
}
