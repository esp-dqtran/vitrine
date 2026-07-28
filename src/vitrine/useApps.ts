import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppsFacet, AppsPlatform } from './appsDiscovery.ts';
import type { App } from './types';

export interface CatalogResponse {
  apps: Array<Omit<App, 'screens'> & { previewScreens: App['screens'] }>;
  nextCursor: string | null;
}

interface AdminAppsResponse {
  apps: App[];
  nextCursor: string | null;
  total: number;
}

export function appendUniqueApps(current: App[], next: App[]): App[] {
  const seen = new Set(current.map(({ id }) => id));
  return [...current, ...next.filter(({ id }) => !seen.has(id))];
}

const catalogApps = (page: CatalogResponse): App[] =>
  page.apps.map(({ previewScreens, ...app }) => ({ ...app, screens: previewScreens }));

export function catalogFacetPath(
  facet: AppsFacet,
  platform: AppsPlatform,
  cursor?: string,
): string {
  const params = new URLSearchParams({
    group: facet.group,
    value: facet.value,
    platform,
  });
  if (cursor) params.set('cursor', cursor);
  return `/api/catalog?${params.toString()}`;
}

async function fetchCatalogPage(
  endpoint: string,
  signal?: AbortSignal,
): Promise<{ apps: App[]; nextCursor: string | null }> {
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
  const page = await response.json() as CatalogResponse;
  return { apps: catalogApps(page), nextCursor: page.nextCursor };
}

export function useCatalogFacetApps(
  facet: AppsFacet | null,
  platform: AppsPlatform,
  enabled: boolean,
) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const group = facet?.group;
  const value = facet?.value;
  const facetKey = enabled && group && value
    ? `${platform}:${group}:${value}`
    : null;

  useEffect(() => {
    const generation = ++generationRef.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setApps(null);
    setNextCursor(null);
    setResultKey(facetKey);
    if (!enabled || !group || !value) return;

    const controller = new AbortController();
    void fetchCatalogPage(
      catalogFacetPath({ group, value }, platform),
      controller.signal,
    ).then((page) => {
      if (generation !== generationRef.current) return;
      setApps(page.apps);
      setNextCursor(page.nextCursor);
    }).catch((reason: Error) => {
      if (reason.name !== 'AbortError' && generation === generationRef.current) {
        setError(reason.message);
        setApps([]);
      }
    });
    return () => controller.abort();
  }, [enabled, facetKey, group, platform, retry, value]);

  const loadMore = useCallback(async () => {
    if (!enabled || !group || !value || !nextCursor || loadingMoreRef.current) return;
    const generation = generationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await fetchCatalogPage(
        catalogFacetPath({ group, value }, platform, nextCursor),
      );
      if (generation !== generationRef.current) return;
      setApps((current) => appendUniqueApps(current ?? [], page.apps));
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (generation === generationRef.current) setLoadMoreError((reason as Error).message);
    } finally {
      if (generation === generationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [enabled, group, nextCursor, platform, value]);

  return {
    apps: resultKey === facetKey ? apps : null,
    error: resultKey === facetKey ? error : null,
    loadMoreError: resultKey === facetKey ? loadMoreError : null,
    hasMore: resultKey === facetKey && nextCursor !== null,
    loadingMore: resultKey === facetKey && loadingMore,
    loadMore,
    retry: () => setRetry((value) => value + 1),
  };
}

export function useApps(role: 'admin' | 'user' | undefined, enabled: boolean) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalApps, setTotalApps] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const requestGenerationRef = useRef(0);

  const refresh = useCallback((signal?: AbortSignal) => {
    const generation = ++requestGenerationRef.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    return (async () => {
      if (role === 'admin') {
        const response = await fetch('/api/apps', { signal });
        if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
        const page = await response.json() as AdminAppsResponse;
        if (generation !== requestGenerationRef.current) return;
        setApps(page.apps);
        setNextCursor(page.nextCursor);
        setTotalApps(Number.isFinite(page.total) ? page.total : page.apps.length);
        return;
      }
      const page = await fetchCatalogPage('/api/catalog', signal);
      const firstPage = page.apps;
      if (generation !== requestGenerationRef.current) return;
      setApps(firstPage);
      setNextCursor(page.nextCursor);
      setTotalApps(firstPage.length);
    })().catch((err: Error) => {
        if (err.name !== 'AbortError' && generation === requestGenerationRef.current) {
          setError(err.message);
        }
      });
  }, [role]);

  useEffect(() => {
    if (!enabled || apps !== null) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [apps, enabled, refresh]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    const generation = requestGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const endpoint = role === 'admin' ? `/api/apps?cursor=${encodeURIComponent(nextCursor)}`
        : `/api/catalog?cursor=${encodeURIComponent(nextCursor)}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
      const page = await response.json() as AdminAppsResponse | CatalogResponse;
      const nextApps = role === 'admin'
        ? (page as AdminAppsResponse).apps
        : catalogApps(page as CatalogResponse);
      if (generation !== requestGenerationRef.current) return;
      setApps((current) => appendUniqueApps(current ?? [], nextApps));
      setNextCursor(page.nextCursor);
      if (role === 'admin' && Number.isFinite((page as AdminAppsResponse).total)) {
        setTotalApps((page as AdminAppsResponse).total);
      }
    } catch (err) {
      if (generation === requestGenerationRef.current) {
        setLoadMoreError((err as Error).message);
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [nextCursor, role]);

  return {
    apps,
    totalApps,
    loading: apps === null && !error,
    loadingMore,
    hasMore: nextCursor !== null,
    error,
    loadMoreError,
    refresh,
    loadMore,
  };
}
