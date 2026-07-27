import { fetchAppMetadata } from './appsApi.ts';
import type { AppMetadata } from './types.ts';

type Requester = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const prefetchedDetails = new Map<string, Promise<AppMetadata>>();

export function prefetchAppDetail(
  appId: string,
  request: Requester = fetch,
): Promise<AppMetadata> {
  const existing = prefetchedDetails.get(appId);
  if (existing) return existing;
  const pending = fetchAppMetadata(appId, undefined, request).catch((cause: unknown) => {
    if (prefetchedDetails.get(appId) === pending) prefetchedDetails.delete(appId);
    throw cause;
  });
  prefetchedDetails.set(appId, pending);
  return pending;
}

export function loadAppDetail(
  appId: string,
  signal?: AbortSignal,
  request: Requester = fetch,
): Promise<AppMetadata> {
  return prefetchedDetails.get(appId) ?? fetchAppMetadata(appId, signal, request);
}

export function clearAppDetailPrefetch(): void {
  prefetchedDetails.clear();
}
