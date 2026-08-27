import type { AppsFacet, AppsPlatform } from './appsDiscovery.ts';
import {
  normalizeDiscoveryFilters,
  parseDiscoveryState,
  serializeDiscoveryState,
  type DiscoveryState,
  type DiscoveryStateDefinition,
} from './discoveryState.ts';

export type AppsDiscoveryContent = 'apps' | 'screens' | 'elements' | 'flows';
// Kept as a compatibility type for callers holding an older Apps state. The
// parser and adapter normalize every value to newest-only before it reaches UI
// or the API.
export type AppsDiscoverySort = 'latest' | 'trending';

export interface AppsDiscoveryFilterState {
  platform: AppsPlatform;
  contentType: AppsDiscoveryContent;
  sort: AppsDiscoverySort;
  filters: Partial<Record<AppsFacet['group'], string[]>>;
}

const LEGACY_FILTER_KEY_BY_GROUP: Record<AppsFacet['group'], string> = {
  categories: 'appCategories',
  screens: 'screenPatterns',
  elements: 'uiElements',
  flows: 'flows',
};

const GROUP_BY_FILTER_KEY = Object.fromEntries(
  Object.entries(LEGACY_FILTER_KEY_BY_GROUP).map(([group, key]) => [key, group]),
) as Record<string, AppsFacet['group']>;

const GROUP_ORDER: AppsFacet['group'][] = ['categories', 'screens', 'elements', 'flows'];

const APPS_DISCOVERY_DEFINITION: DiscoveryStateDefinition<AppsDiscoverySort> = {
  platforms: ['web', 'ios', 'android'],
  sorts: ['latest'],
  filterGroups: GROUP_ORDER,
};

const validContentType = (value: string | null): value is AppsDiscoveryContent =>
  value === 'apps' || value === 'screens' || value === 'elements' || value === 'flows';

const flattenedFilters = (filters: AppsDiscoveryFilterState['filters']) =>
  GROUP_ORDER.flatMap((group) =>
    (filters[group] ?? []).map((value) => ({ group, value })),
  );

const groupedFilters = (filters: DiscoveryState<AppsDiscoverySort>['filters']) =>
  filters.reduce<AppsDiscoveryFilterState['filters']>((result, { group, value }) => {
    const appsGroup = group as AppsFacet['group'];
    const values = result[appsGroup] ?? [];
    result[appsGroup] = [...values, value];
    return result;
  }, {});

const legacyFilters = (params: URLSearchParams): AppsDiscoveryFilterState['filters'] => {
  const filters: AppsDiscoveryFilterState['filters'] = {};
  for (const serializedFilters of params.getAll('filter')) {
    for (const token of serializedFilters.split(/_(?=(?:appCategories|screenPatterns|uiElements|flows)\.)/)) {
      const separator = token.indexOf('.');
      if (separator <= 0) continue;
      const group = GROUP_BY_FILTER_KEY[token.slice(0, separator)];
      const value = token.slice(separator + 1).trim();
      if (group && value && value.length <= 120) {
        const values = filters[group] ?? [];
        if (!values.includes(value)) filters[group] = [...values, value];
      }
    }
  }
  return filters;
};

export function defaultAppsDiscoveryState(
  platform: AppsPlatform = 'web',
  facet: AppsFacet | null = null,
): AppsDiscoveryFilterState {
  const contentType = facet && facet.group !== 'categories' ? facet.group : 'apps';
  return {
    platform,
    contentType,
    sort: 'latest',
    filters: facet ? { [facet.group]: [facet.value] } : {},
  };
}

export function parseAppsDiscoveryState(
  search: string,
  fallback: AppsDiscoveryFilterState = defaultAppsDiscoveryState(),
): AppsDiscoveryFilterState {
  const params = new URLSearchParams(search);
  const requestedContentType = params.get('content_type');
  const contentType = validContentType(requestedContentType)
    ? requestedContentType
    : fallback.contentType;
  const sharedDefaults: DiscoveryState<AppsDiscoverySort> = {
    platform: fallback.platform,
    sort: 'latest',
    query: '',
    filters: [],
  };
  const parsed = parseDiscoveryState(search, sharedDefaults, APPS_DISCOVERY_DEFINITION);
  const canonicalFilters = groupedFilters(parsed.filters);
  const parsedLegacyFilters = legacyFilters(params);
  const filters = Object.keys(canonicalFilters).length
    ? canonicalFilters
    : Object.keys(parsedLegacyFilters).length
      ? parsedLegacyFilters
      : groupedFilters(normalizeDiscoveryFilters(
        flattenedFilters(fallback.filters),
        APPS_DISCOVERY_DEFINITION,
      ));

  return {
    platform: parsed.platform,
    contentType,
    sort: parsed.sort,
    filters,
  };
}

export function serializeAppsDiscoveryState(state: AppsDiscoveryFilterState): string {
  const serializedState = serializeDiscoveryState(
    { platform: state.platform, sort: state.sort, query: '', filters: flattenedFilters(state.filters) },
    APPS_DISCOVERY_DEFINITION,
  );
  const sharedParams = new URLSearchParams(serializedState);
  const params = new URLSearchParams();
  params.set('platform', sharedParams.get('platform') ?? state.platform);
  params.set('content_type', validContentType(state.contentType) ? state.contentType : 'apps');
  for (const filter of sharedParams.getAll('filter')) params.append('filter', filter);
  return params.toString();
}

export function appsDiscoveryPath(state: AppsDiscoveryFilterState): string {
  return `/apps?${serializeAppsDiscoveryState(state)}`;
}

export function appsDiscoveryFacets(state: AppsDiscoveryFilterState): AppsFacet[] {
  return GROUP_ORDER.flatMap((group) =>
    (state.filters[group] ?? []).map((value) => ({ group, value })));
}

export function setAppsDiscoveryFacet(
  state: AppsDiscoveryFilterState,
  facet: AppsFacet,
): AppsDiscoveryFilterState {
  const contentType = facet.group === 'categories' ? state.contentType : facet.group;
  const current = state.filters[facet.group] ?? [];
  return {
    ...state,
    contentType,
    sort: 'latest',
    filters: {
      ...state.filters,
      [facet.group]: current.includes(facet.value) ? current : [...current, facet.value],
    },
  };
}

export function toggleAppsDiscoveryFacet(
  state: AppsDiscoveryFilterState,
  facet: AppsFacet,
): AppsDiscoveryFilterState {
  const current = state.filters[facet.group] ?? [];
  if (current.includes(facet.value)) {
    const filters = { ...state.filters };
    const next = current.filter((value) => value !== facet.value);
    if (next.length) filters[facet.group] = next;
    else delete filters[facet.group];
    return {
      ...state,
      contentType: next.length === 0 && facet.group === state.contentType
        ? 'apps'
        : state.contentType,
      filters,
    };
  }
  return setAppsDiscoveryFacet(state, facet);
}

export function clearAppsDiscoveryFacet(
  state: AppsDiscoveryFilterState,
  group: AppsFacet['group'],
): AppsDiscoveryFilterState {
  const filters = { ...state.filters };
  delete filters[group];
  return {
    ...state,
    contentType: group === state.contentType ? 'apps' : state.contentType,
    filters,
  };
}
