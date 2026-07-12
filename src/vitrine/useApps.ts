import { useCallback, useEffect, useState } from 'react';
import type { App } from './types';

interface CatalogResponse {
  apps: Array<Omit<App, 'screens'> & { previewScreens: App['screens'] }>;
  nextCursor: string | null;
}

export function useApps(role: 'admin' | 'user' | undefined) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setError(null);
    return (async () => {
      if (role === 'admin') {
        const response = await fetch('/api/apps');
        if (!response.ok) throw new Error(`/api/apps returned ${response.status}`);
        setApps(await response.json() as App[]);
        return;
      }
      const results: App[] = [];
      let cursor: string | null = null;
      do {
        const response = await fetch(`/api/catalog${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (!response.ok) throw new Error(`/api/catalog returned ${response.status}`);
        const page = await response.json() as CatalogResponse;
        results.push(...page.apps.map(({ previewScreens, ...app }) => ({ ...app, screens: previewScreens })));
        cursor = page.nextCursor;
      } while (cursor);
      setApps(results);
    })().catch((err: Error) => {
        setError(err.message);
      });
  }, [role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { apps, loading: apps === null && !error, error, refresh };
}
