import { useEffect, useMemo, useState } from 'react';
import { ALL_APPS_CATEGORIES } from './appsDiscovery.ts';
import {
  loadAppsDiscoveryFacets,
  type AppsDiscoveryControllerState,
} from './appsDiscoveryAdapter.ts';
import type { DiscoveryFacet } from './discoveryTypes.ts';

export interface CategoryRow {
  value: string;
  count: number;
}

/*
 * The taxonomy column lists categories in whatever order the static constant
 * declares them — neither alphabetical nor by size — so finding one means
 * reading all 28. The live facet counts are already on the page
 * (`controller.facets`); this ranks the same values by them.
 *
 * Counts for a repeated value are summed. The API returns one row per category
 * today, so this is a no-op; it only matters if a group is ever split by
 * section, where the total is what a single row should show.
 */
export function rankCategoryFacets(
  values: readonly string[],
  facets: readonly DiscoveryFacet[],
  group = 'categories',
): CategoryRow[] {
  const counts = new Map<string, number>();
  for (const facet of facets) {
    if (facet.group !== group) continue;
    counts.set(facet.value, (counts.get(facet.value) ?? 0) + facet.count);
  }
  return values
    .map((value) => ({ value, count: counts.get(value) ?? 0 }))
    /* Size first, then name, so the order is stable while counts are still
       loading and every row reads 0. */
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/*
 * Collapsed, the column shows the largest `limit` categories. A selected filter
 * always survives the cut: hiding the control that is currently narrowing the
 * results leaves the reader no way to clear it.
 */
export function visibleCategoryRows(
  rows: readonly CategoryRow[],
  selected: readonly string[],
  limit: number,
  expanded: boolean,
): CategoryRow[] {
  if (expanded || rows.length <= limit) return [...rows];
  const chosen = new Set(selected);
  const head = rows.slice(0, limit);
  const pinned = rows.slice(limit).filter((row) => chosen.has(row.value));
  return [...head, ...pinned];
}

/*
 * Category counts for the catalog sidebar. They live on `/api/apps/facets` —
 * the list route asks for `facets=summary`, which skips the aggregation and
 * returns none — and they are platform-scoped, so Business leads on Web while
 * Finance leads on iOS.
 */
export function useCatalogCategories(
  state: AppsDiscoveryControllerState,
  isAdmin: boolean,
): CategoryRow[] {
  const [facets, setFacets] = useState<DiscoveryFacet[]>([]);
  /* `state` is a fresh object every render, so the scope string is the
     dependency rather than the object itself. The query belongs in it:
     `loadAppsDiscoveryFacets` sends it, so counts are search-scoped and go
     stale the moment someone types a new one. */
  const scope = [
    state.platform,
    state.query,
    ...state.filters.map(({ group, value }) => `${group}.${value}`),
  ].join('|');
  useEffect(() => {
    const abort = new AbortController();
    loadAppsDiscoveryFacets(
      state,
      'categories',
      '',
      [],
      isAdmin ? 'admin' : 'catalog',
      abort.signal,
    )
      .then(setFacets)
      /* A failed count leaves the names in place without numbers. A nav column
         does not earn an error state. */
      .catch(() => undefined);
    return () => abort.abort();
  }, [scope, isAdmin]);

  return useMemo(() => rankCategoryFacets(ALL_APPS_CATEGORIES, facets), [facets]);
}

