import type { App } from './types.ts';
import { apiFetch } from './apiFetch.ts';
import type {
  DiscoveryAdapter,
  DiscoveryFilter,
  DiscoveryState,
} from './discoveryTypes.ts';
import {
  appsDiscoveryFacets,
  defaultAppsDiscoveryState,
  parseAppsDiscoveryState,
  type AppsDiscoveryContent,
  type AppsDiscoveryFilterState,
  type AppsDiscoverySort,
} from './appsDiscoveryState.ts';
import type { AppsFacet, AppsPlatform } from './appsDiscovery.ts';
import { normalizeDiscoveryFilters } from './discoveryState.ts';
import { fetchCatalogPage } from './useApps.ts';
import { parseAdminAppsPage } from './catalogPageParser.ts';
import {
  appendFacetSearchParams,
  loadDiscoveryFacets,
} from './discoveryFacetsApi.ts';

const FILTER_GROUPS: AppsFacet['group'][] = [
  'categories',
  'screens',
  'elements',
  'flows',
];

const STATE_DEFINITION = {
  platforms: ['web', 'ios', 'android'] as const,
  sorts: ['latest', 'trending'] as const,
  filterGroups: FILTER_GROUPS,
};

export interface AppsDiscoveryControllerState
  extends DiscoveryState<AppsDiscoverySort> {
  contentType: AppsDiscoveryContent;
}

export interface AppsDiscoveryAdapterDefaults {
  platform?: AppsPlatform;
  facet?: AppsFacet | null;
  query?: string;
  source?: 'catalog' | 'admin';
}

const groupedFilters = (
  filters: readonly DiscoveryFilter[],
): AppsDiscoveryFilterState['filters'] =>
  filters.reduce<AppsDiscoveryFilterState['filters']>((result, filter) => {
    const group = filter.group as AppsFacet['group'];
    result[group] = [...(result[group] ?? []), filter.value];
    return result;
  }, {});

const normalizeState = (
  state: AppsDiscoveryControllerState,
): AppsDiscoveryControllerState => ({
  ...state,
  query: state.query.trim().slice(0, 120),
  filters: normalizeDiscoveryFilters(state.filters, STATE_DEFINITION),
});

export function appsCatalogRequestPath(
  rawState: AppsDiscoveryControllerState,
  cursor: string | null,
  source: 'catalog' | 'admin' = 'catalog',
): string {
  const state = normalizeState(rawState);
  const params = new URLSearchParams();
  params.set('platform', state.platform);
  params.set('facets', 'summary');
  if (state.query) params.set('query', state.query);
  params.set('sort', state.sort);
  for (const filter of state.filters) {
    params.append('filter', `${filter.group}.${filter.value}`);
  }
  if (cursor) params.set('cursor', cursor);
  return `/api/apps?${params.toString()}`;
}

export function loadAppsDiscoveryFacets(
  rawState: AppsDiscoveryControllerState,
  group: string,
  query: string,
  selected: readonly string[],
  source: 'catalog' | 'admin',
  signal?: AbortSignal,
) {
  const state = normalizeState(rawState);
  const params = new URLSearchParams({ platform: state.platform });
  if (state.query) params.set('query', state.query);
  for (const filter of state.filters) {
    params.append('filter', `${filter.group}.${filter.value}`);
  }
  appendFacetSearchParams(params, { group, query, selected });
  const path = source === 'admin' ? '/api/admin/catalog/facets' : '/api/catalog/facets';
  return loadDiscoveryFacets(`${path}?${params.toString()}`, signal);
}

export function createAppsDiscoveryAdapter(
  initial: AppsDiscoveryAdapterDefaults = {},
): DiscoveryAdapter<App, AppsDiscoverySort, AppsDiscoveryControllerState> {
  const legacyDefaults = defaultAppsDiscoveryState(
    initial.platform ?? 'web',
    initial.facet ?? null,
  );
  const defaults: AppsDiscoveryControllerState = {
    platform: legacyDefaults.platform,
    contentType: legacyDefaults.contentType,
    sort: legacyDefaults.sort,
    query: initial.query?.trim().slice(0, 120) ?? '',
    filters: appsDiscoveryFacets(legacyDefaults),
  };

  return {
    defaults,
    parse(search) {
      const parsed = parseAppsDiscoveryState(search, {
        platform: defaults.platform,
        contentType: defaults.contentType,
        sort: defaults.sort,
        filters: groupedFilters(defaults.filters),
      });
      const params = new URLSearchParams(search);
      const rawQuery = params.get('query');
      const query = rawQuery === null
        ? defaults.query
        : rawQuery.trim().length <= 120 ? rawQuery.trim() : defaults.query;
      return normalizeState({
        platform: parsed.platform,
        contentType: parsed.contentType,
        sort: parsed.sort,
        query,
        filters: appsDiscoveryFacets(parsed),
      });
    },
    serialize(rawState) {
      const state = normalizeState(rawState);
      const params = new URLSearchParams();
      params.set('platform', state.platform);
      params.set('content_type', state.contentType);
      params.set('sort', state.sort);
      if (state.query) params.set('query', state.query);
      for (const filter of state.filters) {
        params.append('filter', `${filter.group}.${filter.value}`);
      }
      return params.toString();
    },
    async request(state, cursor, signal) {
      if (initial.source === 'admin') {
        const endpoint = appsCatalogRequestPath(state, cursor, 'admin');
        const response = await apiFetch(endpoint, { signal });
        if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
        const page = parseAdminAppsPage(await response.json());
        return {
          items: page.apps,
          nextCursor: page.nextCursor,
          totalCount: page.total,
          facets: page.facets,
        };
      }
      const page = await fetchCatalogPage(
        appsCatalogRequestPath(state, cursor),
        signal,
      );
      return {
        items: page.apps,
        nextCursor: page.nextCursor,
        totalCount: page.totalCount,
        facets: page.facets,
      };
    },
    itemKey: (app) => app.id,
  };
}
