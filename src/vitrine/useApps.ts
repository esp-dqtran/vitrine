import { useCallback, useEffect, useState } from 'react';
import type { App } from './types';

export function useApps() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setError(null);
    return fetch('/api/apps')
      .then((res) => {
        if (!res.ok) throw new Error(`/api/apps returned ${res.status}`);
        return res.json();
      })
      .then((data: App[]) => {
        setApps(data);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { apps, loading: apps === null && !error, error, refresh };
}
