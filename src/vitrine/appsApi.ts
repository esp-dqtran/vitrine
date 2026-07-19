import type { App } from './types';

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
