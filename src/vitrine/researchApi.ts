import type { CatalogComparison, CatalogSearchResult, CatalogSearchResultItem, CatalogEntityKind } from '../catalogResearch';
import type { CollectionItemKind, ResearchCollection } from '../db';
import type { AppVersion } from '../db';
import type { ExportFormat, ExportScope } from '../exportEngine';
import type { CuratorAction } from '../curatorReview';
import type { DesignSystemSnapshot } from '../designSystem';
import type { CrawlPlan } from '../crawlPlan';
import type { Platform } from '../platformFromUrl';
import type {
  CrawlPlanView,
  CrawlRepairRequest,
  CrawlRepairView,
  CrawlResearchProvider,
  CrawlRetryMode,
  CrawlRunDetailView,
  CrawlRunView,
  CreateAutonomousRunRequest,
  AutonomousRunDetailView,
  CrawlSessionView,
  CreateCrawlRunRequest,
} from './types';
import { relatedSearchQuery } from './inspirationSearch.ts';

export interface SearchFilters {
  kind: CatalogEntityKind | 'all';
  theme?: string;
  pageType?: string;
  productArea?: string;
  state?: string;
  layout?: string;
  component?: string;
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
  if (filters.appCategory) params.set('appCategory', filters.appCategory);
  return json(`/api/search?${params}`, { signal });
}

export async function searchRelatedCatalog(item: CatalogSearchResultItem, signal?: AbortSignal): Promise<CatalogSearchResultItem[]> {
  const params = new URLSearchParams({
    q: relatedSearchQuery(item),
    kind: 'all',
    limit: '12',
  });
  const result = await json<CatalogSearchResult>(`/api/search?${params}`, { signal });
  return result.items.filter((candidate) => candidate.id !== item.id).slice(0, 6);
}

export function compareCatalogApps(apps: string[], signal?: AbortSignal): Promise<CatalogComparison> {
  const params = new URLSearchParams({ apps: apps.join(',') });
  return json<CatalogComparison>(`/api/compare?${params}`, { signal });
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

export const loadFlowDoc = (app: string, platform: Platform): Promise<{ body: string; saved: boolean; updatedAt?: string }> =>
  json(`/api/design-systems/${app}/flow-doc?platform=${platform}`);
export const saveFlowDoc = (app: string, platform: Platform, body: string): Promise<{ saved: true; updatedAt: string }> =>
  json(`/api/design-systems/${app}/flow-doc`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ platform, body }) });

export async function requestExport(app: string, platform: Platform, format: ExportFormat, selection: ExportScope): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/design-systems/${app}/exports`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({ format, platform, selection }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Export returned ${response.status}`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${app}-export`;
  return { blob: await response.blob(), filename };
}

export const listAppVersions = (app: string, platform: Platform, signal?: AbortSignal): Promise<AppVersion[]> =>
  json(`/api/apps/${app}/versions?platform=${platform}`, { signal });
export const createAppVersion = (app: string, platform: Platform, sourceUrl: string): Promise<AppVersion> =>
  json(`/api/apps/${app}/versions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ platform, sourceUrl }) });
export const getVersionBlockers = (versionId: number): Promise<{ blockers: Array<{ code: string; message: string }> }> => json(`/api/versions/${versionId}/blockers`);
export const submitVersion = (versionId: number): Promise<AppVersion> => json(`/api/versions/${versionId}/submit`, { method: 'POST' });
export const publishVersion = (versionId: number): Promise<AppVersion> => json(`/api/versions/${versionId}/publish`, { method: 'POST' });
export const applyReviewAction = (app: string, platform: Platform, action: CuratorAction): Promise<DesignSystemSnapshot> =>
  json(`/api/apps/${app}/review-actions?platform=${platform}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(action) });

const crawlPath = (value: string) => encodeURIComponent(value);

export const researchCrawlApp = (app: string, homepageUrl: string, provider?: CrawlResearchProvider): Promise<{ jobId: number; app: string; homepageUrl: string }> =>
  json(`/api/crawl/apps/${crawlPath(app)}/research`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ homepageUrl, provider }),
  });

export const listCrawlPlans = (app: string): Promise<CrawlPlanView[]> =>
  json(`/api/crawl/apps/${crawlPath(app)}/plans`);
export const getCrawlPlan = (planId: string): Promise<CrawlPlanView> =>
  json(`/api/crawl/plans/${crawlPath(planId)}`);
export const saveCrawlPlan = (planId: string, plan: CrawlPlan): Promise<CrawlPlanView> =>
  json(`/api/crawl/plans/${crawlPath(planId)}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(plan) });
export const approveCrawlPlan = (planId: string): Promise<CrawlPlanView> =>
  json(`/api/crawl/plans/${crawlPath(planId)}/approve`, { method: 'POST' });

export const createCrawlRun = (app: string, request: CreateCrawlRunRequest): Promise<CrawlRunView> =>
  json(`/api/crawl/apps/${crawlPath(app)}/runs`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(request) });
export const listCrawlRuns = (app: string): Promise<CrawlRunView[]> =>
  json(`/api/crawl/apps/${crawlPath(app)}/runs`);
export const getCrawlRun = (runId: string): Promise<CrawlRunDetailView> =>
  json(`/api/crawl/runs/${crawlPath(runId)}`);
export const cancelCrawlRun = (runId: string): Promise<CrawlRunView> =>
  json(`/api/crawl/runs/${crawlPath(runId)}/cancel`, { method: 'POST' });
export const retryCrawlRun = (runId: string, mode: CrawlRetryMode): Promise<CrawlRunView> =>
  json(`/api/crawl/runs/${crawlPath(runId)}/retry`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ mode }) });

export const createAutonomousRun = (app: string, request: CreateAutonomousRunRequest): Promise<CrawlRunView> =>
  json(`/api/crawl/apps/${crawlPath(app)}/autonomous-runs`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(request) });
export const getAutonomousRun = (runId: string): Promise<AutonomousRunDetailView> =>
  json(`/api/crawl/autonomous-runs/${crawlPath(runId)}`);
export const pauseAutonomousRun = (runId: string): Promise<AutonomousRunDetailView> =>
  json(`/api/crawl/autonomous-runs/${crawlPath(runId)}/pause`, { method: 'POST' });
export const cancelAutonomousRun = (runId: string): Promise<CrawlRunView> =>
  json(`/api/crawl/autonomous-runs/${crawlPath(runId)}/cancel`, { method: 'POST' });
export const resumeAutonomousRun = (runId: string, allowAllAcknowledged: boolean): Promise<AutonomousRunDetailView> =>
  json(`/api/crawl/autonomous-runs/${crawlPath(runId)}/resume`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({ allowAllAcknowledged }),
  });
export const saveCrawlSession = (app: string, storageState: unknown): Promise<CrawlSessionView> =>
  json(`/api/crawl/apps/${crawlPath(app)}/session`, {
    method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ storageState }),
  });
export const getCrawlSession = (app: string): Promise<CrawlSessionView> =>
  json(`/api/crawl/apps/${crawlPath(app)}/session`);

export const requestCrawlRepair = (runId: string, request: CrawlRepairRequest): Promise<CrawlRepairView> =>
  json(`/api/crawl/runs/${crawlPath(runId)}/repairs`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(request) });
export const applyCrawlRepair = (repairId: string): Promise<CrawlRepairView> =>
  json(`/api/crawl/repairs/${crawlPath(repairId)}/apply`, { method: 'POST' });
export const rejectCrawlRepair = (repairId: string): Promise<CrawlRepairView> =>
  json(`/api/crawl/repairs/${crawlPath(repairId)}/reject`, { method: 'POST' });
