import { useCallback, useEffect, useRef, useState } from 'react';
import type { App } from './types';

interface CatalogResponse {
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
      const response = await fetch('/api/catalog', { signal });
      if (!response.ok) throw new Error(`/api/catalog returned ${response.status}`);
      const page = await response.json() as CatalogResponse;
      const firstPage = page.apps.map(({ previewScreens, ...app }) => ({ ...app, screens: previewScreens }));
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
        : (page as CatalogResponse).apps.map(({ previewScreens, ...app }) => ({ ...app, screens: previewScreens }));
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
