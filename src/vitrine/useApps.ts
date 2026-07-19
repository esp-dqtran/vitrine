import { useCallback, useEffect, useState } from 'react';
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

export function useApps(role: 'admin' | 'user' | undefined, enabled: boolean) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalApps, setTotalApps] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback((signal?: AbortSignal) => {
    setError(null);
    return (async () => {
      if (role === 'admin') {
        const response = await fetch('/api/apps', { signal });
        if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
        const page = await response.json() as AdminAppsResponse;
        setApps(page.apps);
        setNextCursor(page.nextCursor);
        setTotalApps(Number.isFinite(page.total) ? page.total : page.apps.length);
        return;
      }
      const results: App[] = [];
      let cursor: string | null = null;
      do {
        const response = await fetch(`/api/catalog${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
        if (!response.ok) throw new Error(`/api/catalog returned ${response.status}`);
        const page = await response.json() as CatalogResponse;
        results.push(...page.apps.map(({ previewScreens, ...app }) => ({ ...app, screens: previewScreens })));
        setApps([...results]); // paint each page as it arrives instead of awaiting the whole catalog
        setTotalApps(results.length);
        cursor = page.nextCursor;
      } while (cursor);
    })().catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
  }, [role]);

  useEffect(() => {
    if (!enabled || apps !== null) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [apps, enabled, refresh]);

  const loadMore = useCallback(async () => {
    if (role !== 'admin' || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/apps?cursor=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
      const page = await response.json() as AdminAppsResponse;
      setApps((current) => [...(current ?? []), ...page.apps]);
      setNextCursor(page.nextCursor);
      if (Number.isFinite(page.total)) setTotalApps(page.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, role]);

  return { apps, totalApps, loading: apps === null && !error, loadingMore, hasMore: nextCursor !== null, error, refresh, loadMore };
}
