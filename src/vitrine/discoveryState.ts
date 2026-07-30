import type { Platform } from '../platformFromUrl.ts';
import type { DiscoveryFilter, DiscoveryState } from './discoveryTypes.ts';

export type { DiscoveryFilter, DiscoveryState } from './discoveryTypes.ts';

const DEFAULT_MAX_QUERY_LENGTH = 120;
const MAX_FILTER_VALUE_LENGTH = 120;

export interface DiscoveryStateDefinition<Sort extends string> {
  platforms: readonly Platform[];
  sorts: readonly Sort[];
  filterGroups: readonly string[];
  maxQueryLength?: number;
}

const normalizedValue = (value: string, maxLength: number) => {
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
};

const maxQueryLengthFor = <Sort extends string>(definition: DiscoveryStateDefinition<Sort>) =>
  definition.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH;

export function normalizeDiscoveryFilters<Sort extends string>(
  filters: readonly DiscoveryFilter[],
  definition: DiscoveryStateDefinition<Sort>,
): DiscoveryFilter[] {
  const allowedGroups = new Set(definition.filterGroups);
  const seen = new Set<string>();
  const byGroup = new Map<string, string[]>();

  for (const filter of filters) {
    if (!allowedGroups.has(filter.group)) continue;
    const value = normalizedValue(filter.value, MAX_FILTER_VALUE_LENGTH);
    if (!value) continue;
    const key = `${filter.group}\u0000${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const values = byGroup.get(filter.group) ?? [];
    values.push(value);
    byGroup.set(filter.group, values);
  }

  return definition.filterGroups.flatMap((group) =>
    [...(byGroup.get(group) ?? [])]
      .sort()
      .map((value) => ({ group, value })),
  );
}

export function parseDiscoveryState<Sort extends string>(
  search: string,
  defaults: DiscoveryState<Sort>,
  definition: DiscoveryStateDefinition<Sort>,
): DiscoveryState<Sort> {
  const params = new URLSearchParams(search);
  const maxLength = maxQueryLengthFor(definition);
  const platform = params.get('platform');
  const sort = params.get('sort');
  const query = params.get('query');
  const parsedFilters = params.getAll('filter').flatMap((token) => {
    const separator = token.indexOf('.');
    if (separator <= 0) return [];
    return [{ group: token.slice(0, separator), value: token.slice(separator + 1) }];
  });
  const filters = normalizeDiscoveryFilters(parsedFilters, definition);

  const normalizedQuery = query === null ? null : query.trim();
  return {
    platform: platform && definition.platforms.includes(platform as Platform)
      ? platform as Platform
      : defaults.platform,
    sort: sort && definition.sorts.includes(sort as Sort) ? sort as Sort : defaults.sort,
    query: normalizedQuery === null
      ? defaults.query
      : normalizedQuery.length <= maxLength ? normalizedQuery : defaults.query,
    filters: filters.length ? filters : normalizeDiscoveryFilters(defaults.filters, definition),
  };
}

export function serializeDiscoveryState<Sort extends string>(
  state: DiscoveryState<Sort>,
  definition: DiscoveryStateDefinition<Sort>,
): string {
  const maxLength = maxQueryLengthFor(definition);
  const params = new URLSearchParams();
  const platform = definition.platforms.includes(state.platform)
    ? state.platform
    : definition.platforms[0];
  const sort = definition.sorts.includes(state.sort) ? state.sort : definition.sorts[0];

  if (platform) params.set('platform', platform);
  if (sort) params.set('sort', sort);
  const query = normalizedValue(state.query, maxLength);
  if (query) params.set('query', query);
  for (const { group, value } of normalizeDiscoveryFilters(state.filters, definition)) {
    params.append('filter', `${group}.${value}`);
  }
  return params.toString();
}
