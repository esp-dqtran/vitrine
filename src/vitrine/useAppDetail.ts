import { useEffect, useState } from 'react';
import { fetchAppDetailPage, type AppDetailPage } from './appsApi';

export function useAppDetail(appId: string | undefined, enabled: boolean) {
  const [detail, setDetail] = useState<AppDetailPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !appId) return;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    fetchAppDetailPage(appId, controller.signal)
      .then(setDetail)
      .catch((cause: Error) => {
        if (cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, [appId, enabled]);

  return { detail, loading: enabled && detail === null && error === null, error };
}
