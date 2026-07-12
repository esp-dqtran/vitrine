import type { CatalogComparison, CatalogSearchResult, CatalogEntityKind } from '../catalogResearch';
import type { CollectionItemKind, ResearchCollection } from '../db';
import type { AppVersion } from '../db';
import type { ExportFormat, ExportScope } from '../exportEngine';
import type { CuratorAction } from '../curatorReview';
import type { DesignSystemSnapshot } from '../designSystem';

export interface SearchFilters {
  kind: CatalogEntityKind | 'all';
  theme?: string;
  pageType?: string;
  productArea?: string;
  state?: string;
  layout?: string;
  component?: string;
  viewport?: string;
  appCategory?: string;
}

export interface SaveReference {
  kind: CollectionItemKind;
  app: string;
  referenceId: string;
  title: string;
  notes?: string;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `${url} returned ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const jsonHeaders = { 'content-type': 'application/json' };

export function searchCatalog(query: string, filters: SearchFilters, signal?: AbortSignal): Promise<CatalogSearchResult> {
  const params = new URLSearchParams({ q: query, kind: filters.kind });
  if (filters.theme) params.set('theme', filters.theme);
  if (filters.pageType) params.set('pageType', filters.pageType);
  if (filters.productArea) params.set('productArea', filters.productArea);
  if (filters.state) params.set('state', filters.state);
  if (filters.layout) params.set('layout', filters.layout);
  if (filters.component) params.set('component', filters.component);
  if (filters.viewport) params.set('viewport', filters.viewport);
  if (filters.appCategory) params.set('appCategory', filters.appCategory);
  return json(`/api/search?${params}`, { signal });
}

export function compareApps(apps: string[]): Promise<CatalogComparison> {
  return json(`/api/compare?apps=${encodeURIComponent(apps.join(','))}`);
}

export const listCollections = (): Promise<ResearchCollection[]> => json('/api/collections');
export const createCollection = (name: string, description = ''): Promise<ResearchCollection> =>
  json('/api/collections', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name, description }) });
export const deleteCollection = (id: number): Promise<void> => json(`/api/collections/${id}`, { method: 'DELETE' });
export const saveCollectionItem = (collectionId: number, reference: SaveReference): Promise<unknown> =>
  json(`/api/collections/${collectionId}/items`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(reference) });
export const updateCollectionItemNotes = (collectionId: number, itemId: number, notes: string): Promise<unknown> =>
  json(`/api/collections/${collectionId}/items/${itemId}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ notes }) });
export const removeCollectionItem = (collectionId: number, itemId: number): Promise<void> =>
  json(`/api/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' });

export async function requestExport(app: string, format: ExportFormat, selection: ExportScope): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/design-systems/${app}/exports`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({ format, selection }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Export returned ${response.status}`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${app}-export`;
  return { blob: await response.blob(), filename };
}

export const listAppVersions = (app: string): Promise<AppVersion[]> => json(`/api/apps/${app}/versions`);
export const createAppVersion = (app: string, sourceUrl: string): Promise<AppVersion> =>
  json(`/api/apps/${app}/versions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ sourceUrl }) });
export const getVersionBlockers = (versionId: number): Promise<{ blockers: Array<{ code: string; message: string }> }> => json(`/api/versions/${versionId}/blockers`);
export const submitVersion = (versionId: number): Promise<AppVersion> => json(`/api/versions/${versionId}/submit`, { method: 'POST' });
export const publishVersion = (versionId: number): Promise<AppVersion> => json(`/api/versions/${versionId}/publish`, { method: 'POST' });
export const applyReviewAction = (app: string, action: CuratorAction): Promise<DesignSystemSnapshot> =>
  json(`/api/apps/${app}/review-actions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(action) });
