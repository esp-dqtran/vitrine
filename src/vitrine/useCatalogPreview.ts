import { useEffect, useState } from 'react';
import {
  parseCatalogDiscoveryPage,
} from './catalogPageParser.ts';
import type { Category } from './types.ts';

export type PreviewPlatform = 'web' | 'ios' | 'android';

export interface PreviewScreen {
  url: string;
  type: string;
  // Drives how the landing frames the shot: portrait handset vs browser window.
  platform: PreviewPlatform;
  // Smaller variant for grid tiles; falls back to the full asset.
  thumbnailUrl: string;
}

export interface PreviewApp {
  id: string;
  name: string;
  accent: string;
  categories: Category[];
  iconUrl: string | null;
  platforms: PreviewPlatform[];
  totalScreens: number;
  screens: PreviewScreen[];
}

const PLATFORMS: PreviewPlatform[] = ['web', 'ios', 'android'];

function platform(value: unknown, fallback: PreviewPlatform): PreviewPlatform {
  return PLATFORMS.includes(value as PreviewPlatform)
    ? value as PreviewPlatform
    : fallback;
}

// Pure mapper: only apps with a servable preview screen survive, so callers can
// fall back to their own placeholders when the result is empty.
export function toPreviewApps(page: {
  items?: Array<{
    id: string;
    app: string;
    accent: string;
    categories: Category[];
    iconUrl?: string | null;
    platforms?: string[];
    totalScreens?: number;
    previewScreens?: Array<{
      url: string | null;
      type: string;
      platform?: string;
      thumbnailUrl?: string | null;
    }>;
  }>;
}): PreviewApp[] {
  return (page.items ?? [])
    .map((a) => {
      const platforms = (a.platforms ?? [])
        .map((p) => platform(p, 'web'))
        .filter((p, i, all) => all.indexOf(p) === i);
      const appPlatform = platforms[0] ?? 'web';
      return {
        id: a.id,
        name: a.app,
        accent: a.accent,
        categories: a.categories,
        iconUrl: a.iconUrl ?? null,
        platforms,
        totalScreens: a.totalScreens ?? 0,
        screens: (a.previewScreens ?? [])
          .filter((s): s is typeof s & { url: string } => Boolean(s.url))
          .map((s) => ({
            url: s.url,
            type: s.type,
            platform: platform(s.platform, appPlatform),
            thumbnailUrl: s.thumbnailUrl ?? s.url,
          })),
      };
    })
    .filter((a) => a.screens.length > 0);
}

export interface CatalogStatCounts {
  apps: number;
  screens: number;
  uiElements: number;
}

// Real headline counts for the landing page. Returns null while loading, when
// unavailable, or when the catalog is empty — all of which keep the hand-set
// marketing figures as a fallback.
export function useCatalogStats(): CatalogStatCounts | null {
  const [stats, setStats] = useState<CatalogStatCounts | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/catalog/stats', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: CatalogStatCounts) => { if (s && s.apps > 0) setStats(s); })
      .catch(() => { /* keep null → marketing fallback */ });
    return () => controller.abort();
  }, []);
  return stats;
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
      .then((page) => setApps(toPreviewApps(parseCatalogDiscoveryPage(page))))
      .catch((err: Error) => { if (err.name !== 'AbortError') setApps([]); });
    return () => controller.abort();
  }, [limit]);
  return apps;
}
