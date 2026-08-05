import { useEffect, useState } from 'react';
import { apiFetch } from './apiFetch.ts';

// Apps carry a marketing website_url; the Sites catalog has full-page captures
// of many of those same domains. Joining them gives the Apps grid a consistent,
// branded thumbnail instead of an arbitrary product screen. Resolved in one
// batched request rather than inside /api/catalog, which is already the slowest
// read in the product.

export function websiteHost(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null;
  try {
    const { hostname, protocol } = new URL(websiteUrl);
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

// App-store listings are not the product's website — crawling or previewing
// them yields a store page, so they should fall back to the screen capture.
const NON_PRODUCT_HOSTS = new Set(['apps.apple.com', 'play.google.com']);

export function sitePreviewHosts(
  apps: ReadonlyArray<{ websiteUrl?: string | null }>,
): string[] {
  const hosts = new Set<string>();
  for (const app of apps) {
    const host = websiteHost(app.websiteUrl);
    if (host && !NON_PRODUCT_HOSTS.has(host)) hosts.add(host);
  }
  return [...hosts];
}

const cache = new Map<string, string | null>();

export function useSitePreviews(
  apps: ReadonlyArray<{ websiteUrl?: string | null }>,
): Map<string, string> {
  const hosts = sitePreviewHosts(apps);
  const missing = hosts.filter((host) => !cache.has(host));
  // Key on the unresolved hosts so the effect re-runs as pages stream in, but
  // not on every render once everything is already cached.
  const missingKey = missing.join(',');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!missingKey) return;
    const controller = new AbortController();
    const requested = missingKey.split(',');
    apiFetch(`/api/site-previews?hosts=${encodeURIComponent(missingKey)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { previews: {} }))
      .then((body: { previews?: Record<string, string> }) => {
        const previews = body.previews ?? {};
        // Cache misses too, so an uncrawled host isn't re-requested every page.
        for (const host of requested) cache.set(host, previews[host] ?? null);
        setRevision((value) => value + 1);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [missingKey]);

  void revision;
  const resolved = new Map<string, string>();
  for (const host of hosts) {
    const url = cache.get(host);
    if (url) resolved.set(host, url);
  }
  return resolved;
}
