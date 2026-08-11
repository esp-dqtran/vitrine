import type { AppMetadata, Screen } from './types.ts';

type Requester = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface PublicAppPreview {
  app: AppMetadata;
  previewScreens: Screen[];
  previewUiElements: Array<{
    type: string;
    group: string;
    count: number;
    thumbnailUrl: string;
  }>;
  previewFlows: Array<{
    id: string;
    title: string;
    description: string | null;
    stepCount: number;
    screens: Array<{
      label: string;
      thumbnailUrl: string;
    }>;
  }>;
}

async function responseJson<T>(response: Response, endpoint: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `${endpoint} returned ${response.status}`);
  return body;
}

export function loadPublicAppPreview(
  appId: string,
  signal?: AbortSignal,
  request: Requester = fetch,
): Promise<PublicAppPreview> {
  const endpoint = `/api/apps/${encodeURIComponent(appId)}/preview?v=2`;
  return request(endpoint, { signal }).then((response) =>
    responseJson<PublicAppPreview>(response, endpoint));
}

export async function trackAppFunnelEvent(
  appId: string,
  action: 'unlock_clicked' | 'paywall_viewed',
  request: Requester = fetch,
): Promise<void> {
  const endpoint = `/api/apps/${encodeURIComponent(appId)}/funnel-events`;
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
}
