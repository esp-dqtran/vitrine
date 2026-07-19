import type { App } from './types';
import type { AppVersion } from '../db';

export interface AppDetailPage {
  app: App;
  nextCursor: string | null;
  version: AppVersion | null;
}

export async function fetchAppDetailPage(
  appId: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<AppDetailPage> {
  const response = await request(`/api/apps/${encodeURIComponent(appId)}?limit=48`, { signal });
  if (!response.ok) throw new Error(`/api/apps/${appId} returned ${response.status}`);
  const body = await response.json() as {
    app: Omit<App, 'screens'>;
    screens: App['screens'];
    nextCursor: string | null;
    version: AppVersion | null;
  };
  return {
    app: { ...body.app, screens: body.screens },
    nextCursor: body.nextCursor,
    version: body.version,
  };
}

interface AppDetailResponse {
  app: Omit<App, 'screens'>;
  screens: App['screens'];
}

export async function fetchAppDetail(
  appId: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<App> {
  const response = await request(`/api/apps/${encodeURIComponent(appId)}?limit=1`, { signal });
  if (!response.ok) throw new Error(`/api/apps/${appId} returned ${response.status}`);
  const { app, screens } = await response.json() as AppDetailResponse;
  return { ...app, screens };
}

export function mergeApp(apps: App[], requested: App): App[] {
  return apps.some(({ id }) => id === requested.id) ? apps : [...apps, requested];
}
