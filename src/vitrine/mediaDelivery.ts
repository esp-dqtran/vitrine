import { useEffect, useState } from 'react';
import { apiFetch } from './apiFetch.ts';

type MediaRequester = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const protectedMediaUrlCache = new Map<string, { url: string; expiresAt: number }>();
const protectedMediaUrlCacheLifetimeMs = 60_000;

export function isProtectedMediaUrl(url: string | undefined): url is string {
  return Boolean(url?.startsWith('/api/media/'));
}

export function inlineMediaUrl(url: string): string {
  if (!isProtectedMediaUrl(url)) return url;
  const target = new URL(url, 'http://localhost');
  target.searchParams.set('delivery', 'inline');
  return `${target.pathname}${target.search}${target.hash}`;
}

export function signedMediaRequestUrl(url: string): string {
  if (!isProtectedMediaUrl(url)) return url;
  const target = new URL(url, 'http://localhost');
  target.searchParams.set('delivery', 'url');
  return `${target.pathname}${target.search}${target.hash}`;
}

export async function loadProtectedMediaUrl(
  url: string,
  signal: AbortSignal,
  request: MediaRequester = apiFetch,
): Promise<string> {
  const response = await request(signedMediaRequestUrl(url), { signal });
  if (!response.ok) throw new Error(`Signed media request failed with ${response.status}`);
  const payload = await response.json() as { url?: unknown };
  if (typeof payload.url !== 'string') throw new Error('Signed media response has no URL');
  const signed = new URL(payload.url);
  if (signed.protocol !== 'https:' || signed.username || signed.password) {
    throw new Error('Signed media response has an invalid URL');
  }
  return signed.toString();
}

export function cachedProtectedMediaUrl(
  source: string,
  now = Date.now(),
): string | undefined {
  const cached = protectedMediaUrlCache.get(source);
  if (!cached) return undefined;
  if (cached.expiresAt <= now) {
    protectedMediaUrlCache.delete(source);
    return undefined;
  }
  return cached.url;
}

export async function loadCachedProtectedMediaUrl(
  source: string,
  signal: AbortSignal,
  request: MediaRequester = apiFetch,
): Promise<string> {
  const cached = cachedProtectedMediaUrl(source);
  if (cached) return cached;
  const url = await loadProtectedMediaUrl(source, signal, request);
  protectedMediaUrlCache.set(source, {
    url,
    expiresAt: Date.now() + protectedMediaUrlCacheLifetimeMs,
  });
  return url;
}

export async function loadProtectedMediaObjectUrl(
  url: string,
  signal: AbortSignal,
  request: MediaRequester = apiFetch,
  createObjectUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
): Promise<string> {
  const response = await request(inlineMediaUrl(url), { signal });
  if (!response.ok) throw new Error(`Media request failed with ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.toLowerCase().startsWith('image/')) {
    throw new Error('Media response is not an image');
  }
  return createObjectUrl(blob);
}

type ProtectedMediaDelivery =
  | { source: string; status: 'ready'; url: string; revoke: boolean }
  | { source: string; status: 'failed' };

export function useDeliveredImageUrl(source: string | undefined, active = true) {
  const protectedSource = isProtectedMediaUrl(source) ? source : undefined;
  const [delivery, setDelivery] = useState<ProtectedMediaDelivery | null>(null);
  const cachedUrl = protectedSource ? cachedProtectedMediaUrl(protectedSource) : undefined;

  useEffect(() => {
    setDelivery(null);
    if (!active || !protectedSource) return;

    const cached = cachedProtectedMediaUrl(protectedSource);
    if (cached) {
      setDelivery({ source: protectedSource, status: 'ready', url: cached, revoke: false });
      return;
    }

    const controller = new AbortController();
    let mounted = true;
    let deliveredUrl: string | undefined;
    let revoke = false;
    void loadCachedProtectedMediaUrl(protectedSource, controller.signal)
      .catch(async () => {
        revoke = true;
        return loadProtectedMediaObjectUrl(protectedSource, controller.signal);
      })
      .then((loadedUrl) => {
        deliveredUrl = loadedUrl;
        if (!mounted) {
          if (revoke) URL.revokeObjectURL(loadedUrl);
          return;
        }
        setDelivery({ source: protectedSource, status: 'ready', url: loadedUrl, revoke });
      })
      .catch((cause: unknown) => {
        if (mounted && (!(cause instanceof Error) || cause.name !== 'AbortError')) {
          setDelivery({ source: protectedSource, status: 'failed' });
        }
      });

    return () => {
      mounted = false;
      controller.abort();
      if (revoke && deliveredUrl) URL.revokeObjectURL(deliveredUrl);
    };
  }, [active, protectedSource]);

  const currentDelivery = delivery?.source === protectedSource ? delivery : null;
  const readyUrl = currentDelivery?.status === 'ready' ? currentDelivery.url : cachedUrl;
  return {
    url: protectedSource
      ? readyUrl
      : source,
    loading: Boolean(active && protectedSource && !readyUrl && !currentDelivery),
    failed: currentDelivery?.status === 'failed',
    protected: Boolean(protectedSource),
  };
}
