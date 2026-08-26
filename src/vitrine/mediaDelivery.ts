import { useEffect, useState } from 'react';
import { apiFetch } from './apiFetch.ts';

type MediaRequester = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

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

  useEffect(() => {
    setDelivery(null);
    if (!active || !protectedSource) return;

    const controller = new AbortController();
    let mounted = true;
    let deliveredUrl: string | undefined;
    let revoke = false;
    void loadProtectedMediaUrl(protectedSource, controller.signal)
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
  return {
    url: protectedSource
      ? currentDelivery?.status === 'ready' ? currentDelivery.url : undefined
      : source,
    loading: Boolean(active && protectedSource && !currentDelivery),
    failed: currentDelivery?.status === 'failed',
    protected: Boolean(protectedSource),
  };
}
