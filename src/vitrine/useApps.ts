import { useCallback, useEffect, useState } from 'react';
import { fetchAppDetail, mergeApp } from './appsApi';
import type { App } from './types';

interface CatalogResponse {
  apps: Array<Omit<App, 'screens'> & { previewScreens: App['screens'] }>;
  nextCursor: string | null;
}

export function useApps(role: 'admin' | 'user' | undefined, requestedAppId?: string) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback((signal?: AbortSignal) => {
    setError(null);
    return (async () => {
      if (role === 'admin') {
        const response = await fetch('/api/apps', { signal });
        if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
        const page = await response.json() as { apps: App[]; nextCursor: string | null };
        const requestedApp = requestedAppId && !page.apps.some(({ id }) => id === requestedAppId)
          ? await fetchAppDetail(requestedAppId, signal)
          : undefined;
        setApps(requestedApp ? mergeApp(page.apps, requestedApp) : page.apps);
        setNextCursor(page.nextCursor);
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
        cursor = page.nextCursor;
      } while (cursor);
    })().catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
  }, [requestedAppId, role]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (role !== 'admin' || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/apps?cursor=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
      const page = await response.json() as { apps: App[]; nextCursor: string | null };
      setApps((current) => [...(current ?? []), ...page.apps]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, role]);

  return { apps, loading: apps === null && !error, loadingMore, hasMore: nextCursor !== null, error, refresh, loadMore };
}
