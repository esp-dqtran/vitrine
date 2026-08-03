import { useEffect, useState } from 'react';
import { loadPublicAppPreview, type PublicAppPreview } from './publicAppPreviewApi.ts';

export function usePublicAppPreview(appId: string | undefined, enabled: boolean) {
  const [preview, setPreview] = useState<PublicAppPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !appId) {
      setPreview(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setPreview(null);
    setError(null);
    loadPublicAppPreview(appId, controller.signal)
      .then(setPreview)
      .catch((cause: Error) => {
        if (cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, [appId, enabled]);

  return {
    preview,
    loading: enabled && preview === null && error === null,
    error,
  };
}
