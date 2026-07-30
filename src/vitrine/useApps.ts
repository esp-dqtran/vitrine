import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscoveryFacet } from './discoveryTypes.ts';
import {
  parseAdminAppsPage,
  parseCatalogDiscoveryPage,
  type AdminAppsResponse,
  type CatalogDiscoveryResponse,
} from './catalogPageParser.ts';
import type { App } from './types';

export type CatalogResponse = CatalogDiscoveryResponse;

interface CatalogPage {
  apps: App[];
  nextCursor: string | null;
  totalCount: number;
  facets: DiscoveryFacet[];
}

const CATALOG_PAGE_CACHE_MS = 280_000;
const catalogPageCache = new Map<string, {
  expiresAt: number;
  page: CatalogPage;
}>();

export function appendUniqueApps(current: App[], next: App[]): App[] {
  const seen = new Set(current.map(({ id }) => id));
  return [...current, ...next.filter(({ id }) => !seen.has(id))];
}

const catalogApps = (page: CatalogResponse): App[] =>
  page.items.map(({ previewScreens, ...app }) => ({
    ...app,
    screens: previewScreens.filter(
      (screen): screen is App['screens'][number] => typeof screen.url === 'string',
    ),
  }));

function cachedCatalogPage(endpoint: string): CatalogPage | null {
  const cached = catalogPageCache.get(endpoint);
  if (!cached) return null;
  if (cached.expiresAt > Date.now()) return cached.page;
  catalogPageCache.delete(endpoint);
  return null;
}

export async function fetchCatalogPage(
  endpoint: string,
  signal?: AbortSignal,
  options: { bypassCache?: boolean } = {},
): Promise<CatalogPage> {
  if (!options.bypassCache) {
    const cached = cachedCatalogPage(endpoint);
    if (cached) return cached;
  }
  const response = await fetch(endpoint, {
    signal,
    ...(options.bypassCache ? { cache: 'no-store' as const } : {}),
  });
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
  const page = parseCatalogDiscoveryPage(await response.json());
  const result = {
    apps: catalogApps(page),
    nextCursor: page.nextCursor,
    totalCount: page.totalCount,
    facets: page.facets,
  };
  catalogPageCache.set(endpoint, {
    expiresAt: Date.now() + CATALOG_PAGE_CACHE_MS,
    page: result,
  });
  return result;
}

export function refreshCatalogPage(
  endpoint: string,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  return fetchCatalogPage(endpoint, signal, { bypassCache: true });
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
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback((signal?: AbortSignal) => {
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    const generation = ++requestGenerationRef.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    return (async () => {
      if (role === 'admin') {
        const response = await fetch('/api/apps', { signal });
        if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
        const page = parseAdminAppsPage(await response.json());
        if (generation !== requestGenerationRef.current) return;
        setApps(page.apps);
        setNextCursor(page.nextCursor);
        setTotalApps(Number.isFinite(page.total) ? page.total : page.apps.length);
        return;
      }
      const page = await refreshCatalogPage('/api/catalog', signal);
      const firstPage = page.apps;
      if (generation !== requestGenerationRef.current) return;
      setApps(firstPage);
      setNextCursor(page.nextCursor);
      setTotalApps(page.totalCount);
    })().catch((err: Error) => {
        if (err.name !== 'AbortError' && generation === requestGenerationRef.current) {
          setError(err.message);
        }
      });
  }, [role]);

  useEffect(() => () => {
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    requestGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setApps(null);
    setNextCursor(null);
    setTotalApps(null);
    if (!enabled) return () => controller.abort();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [enabled, refresh]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    const generation = requestGenerationRef.current;
    loadingMoreRef.current = true;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const endpoint = role === 'admin' ? `/api/apps?cursor=${encodeURIComponent(nextCursor)}`
        : `/api/catalog?cursor=${encodeURIComponent(nextCursor)}`;
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
      const page = role === 'admin'
        ? parseAdminAppsPage(await response.json())
        : parseCatalogDiscoveryPage(await response.json());
      const nextApps = role === 'admin'
        ? (page as AdminAppsResponse).apps
        : catalogApps(page as CatalogResponse);
      if (generation !== requestGenerationRef.current) return;
      setApps((current) => appendUniqueApps(current ?? [], nextApps));
      setNextCursor(page.nextCursor);
      if (role === 'admin' && Number.isFinite((page as AdminAppsResponse).total)) {
        setTotalApps((page as AdminAppsResponse).total);
      } else if (role !== 'admin' && Number.isFinite((page as CatalogResponse).totalCount)) {
        setTotalApps((page as CatalogResponse).totalCount);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError'
        && generation === requestGenerationRef.current) {
        setLoadMoreError((err as Error).message);
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        if (loadMoreControllerRef.current === controller) {
          loadMoreControllerRef.current = null;
        }
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
