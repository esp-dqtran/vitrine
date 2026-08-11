import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './apiFetch.ts';
import type { DiscoveryFacet } from './discoveryTypes.ts';
import {
  parseCatalogDiscoveryPage,
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
const CATALOG_REQUEST_TIMEOUT_MS = 8_000;
const catalogPageCache = new Map<string, {
  expiresAt: number;
  page: CatalogPage;
}>();

/**
 * Catalog previews can change when an admin selects a new AppCard image.
 * Keep the short in-memory cache for ordinary navigation, but let that action
 * explicitly discard its old entry before the user returns to the Apps grid.
 */
export function invalidateCatalogPageCache(): void {
  catalogPageCache.clear();
}

function catalogRequestSignal(signal?: AbortSignal): {
  signal: AbortSignal;
  dispose(): void;
} {
  // Callers that own cancellation (the discovery controller, pagination, and
  // tests) must receive their exact signal. Wrapping it changes observable
  // cancellation identity and breaks the adapter contract.
  if (signal) return { signal, dispose() {} };
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort(new DOMException(
      'Catalog is taking longer than expected. Try again.',
      'TimeoutError',
    ));
  }, CATALOG_REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    dispose() {
      globalThis.clearTimeout(timeout);
    },
  };
}

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
  // Apple imports and admin preview selection can replace a card's media at
  // any time. Never let the browser's HTTP cache keep an old/unservable
  // catalog response after a reload; the bounded in-memory cache above still
  // avoids duplicate requests within the current view.
  const request = catalogRequestSignal(signal);
  try {
    const response = await apiFetch(endpoint, { signal: request.signal, cache: 'no-store' });
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
  } finally {
    request.dispose();
  }
}

export function refreshCatalogPage(
  endpoint: string,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  return fetchCatalogPage(endpoint, signal, { bypassCache: true });
}

export function useApps(
  role: 'admin' | 'user' | undefined,
  enabled: boolean,
  query = '',
) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalApps, setTotalApps] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const trimmedQuery = query.trim();
  const querySuffix = trimmedQuery ? `?query=${encodeURIComponent(trimmedQuery)}` : '';
  // This hook only ever reads the app list, but /api/catalog ships its full
  // facet payload by default — ~75k entries / 5.4MB, which measured as 14x
  // slower than the same request with facets=summary (2.89s vs 0.21s).
  const catalogSuffix = trimmedQuery
    ? `?facets=summary&query=${encodeURIComponent(trimmedQuery)}`
    : '?facets=summary';

  const refresh = useCallback((signal?: AbortSignal) => {
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    const generation = ++requestGenerationRef.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    return (async () => {
      // No admin branch: /api/apps is now the public Apps grid, so the old
      // admin listing it used to serve is gone. Everyone reads the catalog.
      const page = await refreshCatalogPage(`/api/catalog${catalogSuffix}`, signal);
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
  }, [role, querySuffix, catalogSuffix]);

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
      const cursor = `cursor=${encodeURIComponent(nextCursor)}`;
      const endpoint = `/api/catalog${catalogSuffix}&${cursor}`;
      const response = await apiFetch(endpoint, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
      const page = parseCatalogDiscoveryPage(await response.json());
      const nextApps = catalogApps(page as CatalogResponse);
      if (generation !== requestGenerationRef.current) return;
      setApps((current) => appendUniqueApps(current ?? [], nextApps));
      setNextCursor(page.nextCursor);
      if (Number.isFinite((page as CatalogResponse).totalCount)) {
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
  }, [nextCursor, role, querySuffix, catalogSuffix]);

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
