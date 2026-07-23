import { useEffect, useState } from 'react';

export interface PreviewScreen {
  url: string;
  type: string;
}

export interface PreviewApp {
  id: string;
  name: string;
  accent: string;
  category: string;
  iconUrl: string | null;
  screens: PreviewScreen[];
}

interface CatalogAppShape {
  id: string;
  app: string;
  accent: string;
  cat: string;
  iconUrl: string | null;
  previewScreens?: Array<{ url: string | null; type: string }>;
}

// Pure mapper: only apps with a servable preview screen survive, so callers can
// fall back to their own placeholders when the result is empty.
export function toPreviewApps(page: { apps?: CatalogAppShape[] }): PreviewApp[] {
  return (page.apps ?? [])
    .map((a) => ({
      id: a.id,
      name: a.app,
      accent: a.accent,
      category: a.cat,
      iconUrl: a.iconUrl,
      screens: (a.previewScreens ?? [])
        .filter((s): s is { url: string; type: string } => Boolean(s.url))
        .map((s) => ({ url: s.url, type: s.type })),
    }))
    .filter((a) => a.screens.length > 0);
}

// `/api/catalog` is public (registered before the auth middleware), so the
// logged-out marketing pages can show real apps and real preview screenshots.
// Returns null while loading and [] when unavailable — both keep placeholders.
export function useCatalogPreview(limit = 12): PreviewApp[] | null {
  const [apps, setApps] = useState<PreviewApp[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog?limit=${limit}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((page) => setApps(toPreviewApps(page)))
      .catch((err: Error) => { if (err.name !== 'AbortError') setApps([]); });
    return () => controller.abort();
  }, [limit]);
  return apps;
}
