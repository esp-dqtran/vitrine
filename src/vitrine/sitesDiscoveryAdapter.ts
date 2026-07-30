import {
  normalizeDiscoveryFilters,
  parseDiscoveryState,
  serializeDiscoveryState,
  type DiscoveryStateDefinition,
} from './discoveryState.ts';
import type { DiscoveryAdapter, DiscoveryFilter } from './discoveryTypes.ts';
import {
  listSitesPage,
  type SitesDiscoverySort,
  type SitesDiscoveryState,
} from './sitesApi.ts';
import type { SiteSummary } from './types.ts';

export type SitesDiscoveryControllerState = SitesDiscoveryState;

export interface SitesDiscoveryAdapterDefaults {
  sort?: SitesDiscoverySort;
  query?: string;
  filters?: DiscoveryFilter[];
}

const FILTER_GROUPS = ['categories', 'sections', 'styles'] as const;

const STATE_DEFINITION: DiscoveryStateDefinition<SitesDiscoverySort> = {
  platforms: ['web'],
  sorts: ['latest', 'popular'],
  filterGroups: FILTER_GROUPS,
};

const LEGACY_KEYS: Record<(typeof FILTER_GROUPS)[number], readonly string[]> = {
  categories: ['category', 'categories', 'appCategory'],
  sections: ['section', 'sections', 'siteSection'],
  styles: ['style', 'styles', 'siteStyle'],
};

const normalizedDefaults = (
  initial: SitesDiscoveryAdapterDefaults,
): SitesDiscoveryControllerState => ({
  platform: 'web',
  sort: initial.sort === 'popular' ? 'popular' : 'latest',
  query: initial.query?.trim().slice(0, 120) ?? '',
  filters: normalizeDiscoveryFilters(initial.filters ?? [], STATE_DEFINITION),
});

const canonicalFiltersPresent = (params: URLSearchParams) =>
  params.getAll('filter').some((token) => {
    const separator = token.indexOf('.');
    return separator > 0
      && FILTER_GROUPS.includes(token.slice(0, separator) as (typeof FILTER_GROUPS)[number]);
  });

const legacyFilters = (params: URLSearchParams): DiscoveryFilter[] =>
  normalizeDiscoveryFilters(
    FILTER_GROUPS.flatMap((group) =>
      LEGACY_KEYS[group].flatMap((key) =>
        params.getAll(key).flatMap((rawValue) =>
          rawValue.split(',').map((value) => ({ group, value })))),
    ),
    STATE_DEFINITION,
  );

export function createSitesDiscoveryAdapter(
  initial: SitesDiscoveryAdapterDefaults = {},
): DiscoveryAdapter<
  SiteSummary,
  SitesDiscoverySort,
  SitesDiscoveryControllerState
> {
  const defaults = normalizedDefaults(initial);

  return {
    defaults,
    parse(search) {
      const params = new URLSearchParams(search);
      const parsed = parseDiscoveryState(search, defaults, STATE_DEFINITION);
      const legacy = canonicalFiltersPresent(params) ? [] : legacyFilters(params);
      return {
        ...parsed,
        platform: 'web',
        filters: legacy.length ? legacy : parsed.filters,
      };
    },
    serialize(state) {
      return serializeDiscoveryState({
        ...state,
        platform: 'web',
      }, STATE_DEFINITION);
    },
    request(state, cursor, signal) {
      return listSitesPage(
        {
          ...state,
          platform: 'web',
          filters: normalizeDiscoveryFilters(state.filters, STATE_DEFINITION),
        },
        cursor ?? undefined,
        { signal },
      );
    },
    itemKey: (site) => `${site.id}:${site.versionId}`,
  };
}
