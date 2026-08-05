import { apiFetch } from './apiFetch.ts';
import type {
  SiteSectionView,
  SiteSummary,
  SiteVersionDetail,
  SiteVersionPage,
} from './types.ts';
import { parseSiteAnalysis } from '../siteAnalysis.ts';
import type { DiscoveryPage, DiscoveryState } from './discoveryTypes.ts';
import {
  parseSiteSummary as parseDiscoverySiteSummary,
  parseSitesDiscoveryPage,
} from './sitesPageParser.ts';
import {
  appendFacetSearchParams,
  loadDiscoveryFacets,
} from './discoveryFacetsApi.ts';

export interface SitesPageResult {
  sites: SiteSummary[];
  nextOffset: number | null;
  total: number;
}

export type SitesDiscoverySort = 'latest' | 'popular';
export type SitesDiscoveryState = DiscoveryState<SitesDiscoverySort>;

export interface SitesPageOptions {
  limit?: number;
  noStore?: boolean;
  signal?: AbortSignal;
}

export function listSitesPage(
  state: SitesDiscoveryState,
  cursor?: string,
  options?: SitesPageOptions,
): Promise<DiscoveryPage<SiteSummary>>;
/** @deprecated Temporary compatibility for detail-page related references. */
export function listSitesPage(limit: number, offset: number): Promise<SitesPageResult>;
export async function listSitesPage(
  stateOrLimit: SitesDiscoveryState | number,
  cursorOrOffset?: string | number,
  options: SitesPageOptions = {},
): Promise<DiscoveryPage<SiteSummary> | SitesPageResult> {
  if (typeof stateOrLimit === 'number') {
    const limit = stateOrLimit;
    const offset = Number(cursorOrOffset);
    if (!positiveId(limit)
      || limit > 48
      || !Number.isSafeInteger(offset)
      || offset < 0) {
      throw new Error('Invalid Sites page');
    }
    const state: SitesDiscoveryState = {
      platform: 'web',
      sort: 'latest',
      query: '',
      filters: [],
    };
    if (offset === 0) {
      const page = await requestSitesDiscoveryPage(state, undefined, { limit });
      return {
        sites: page.items,
        nextOffset: page.nextCursor === null ? null : limit,
        total: page.totalCount,
      };
    }
    const sites: SiteSummary[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let total = 0;
    let hasMore = false;
    for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
      const page = await requestSitesDiscoveryPage(state, cursor, { limit });
      total = page.totalCount;
      sites.push(...page.items);
      hasMore = page.nextCursor !== null;
      if (sites.length >= offset + limit || page.nextCursor === null) break;
      if (seenCursors.has(page.nextCursor)) {
        throw new Error('Sites returned an invalid response');
      }
      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
      if (pageNumber === 99) throw new Error('Sites returned an invalid response');
    }
    const pageSites = sites.slice(offset, offset + limit);
    return {
      sites: pageSites,
      nextOffset: hasMore || offset + pageSites.length < total
        ? offset + limit
        : null,
      total,
    };
  }

  return requestSitesDiscoveryPage(
    stateOrLimit,
    typeof cursorOrOffset === 'string' ? cursorOrOffset : undefined,
    options,
  );
}

async function requestSitesDiscoveryPage(
  state: SitesDiscoveryState,
  cursor: string | undefined,
  options: SitesPageOptions,
): Promise<DiscoveryPage<SiteSummary>> {
  const limit = options.limit ?? 24;
  if (state.platform !== 'web'
    || (state.sort !== 'latest' && state.sort !== 'popular')
    || typeof state.query !== 'string'
    || state.query.length > 120
    || !Array.isArray(state.filters)
    || state.filters.length > 40
    || !positiveId(limit)
    || limit > 48
    || (cursor !== undefined
      && (typeof cursor !== 'string' || !cursor || cursor.length > 2_048))) {
    throw new Error('Invalid Sites page');
  }
  const params = new URLSearchParams({
    platform: state.platform,
    sort: state.sort,
    facets: 'summary',
  });
  const query = state.query.trim();
  if (query) params.set('query', query);
  for (const filter of state.filters) {
    if ((filter.group !== 'categories'
      && filter.group !== 'sections'
      && filter.group !== 'styles')
      || typeof filter.value !== 'string'
      || !filter.value.trim()
      || filter.value.length > 120) {
      throw new Error('Invalid Sites page');
    }
    params.append('filter', `${filter.group}.${filter.value.trim()}`);
  }
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  if (options.noStore) params.set('refresh', '1');
  const response = await apiFetch(`/api/sites?${params.toString()}`, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.noStore ? { cache: 'no-store' as const } : {}),
  });
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Sites returned ${response.status}`));
  return parseSitesDiscoveryPage(body);
}

export function loadSitesDiscoveryFacets(
  state: SitesDiscoveryState,
  group: string,
  query: string,
  selected: readonly string[],
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    platform: state.platform,
    sort: state.sort,
  });
  const search = state.query.trim();
  if (search) params.set('query', search);
  for (const filter of state.filters) {
    params.append('filter', `${filter.group}.${filter.value}`);
  }
  appendFacetSearchParams(params, { group, query, selected });
  return loadDiscoveryFacets(`/api/sites/facets?${params.toString()}`, signal);
}

export async function getSiteVersion(siteId: number, versionId: number): Promise<SiteVersionDetail> {
  if (!positiveId(siteId) || !positiveId(versionId)) throw new Error('Invalid Site version reference');
  return requestSiteVersion(`/api/sites/${siteId}/versions/${versionId}`, { siteId, versionId });
}

export async function getSiteVersionBySlug(
  siteSlug: string,
  versionId?: number,
): Promise<SiteVersionDetail> {
  if (!siteSlug || siteSlug.length > 240 || siteSlug.includes('/')) {
    throw new Error('Invalid Site name');
  }
  if (versionId !== undefined && !positiveId(versionId)) {
    throw new Error('Invalid Site version reference');
  }
  const versionQuery = versionId ? `?version=${versionId}` : '';
  return requestSiteVersion(
    `/api/sites/${encodeURIComponent(siteSlug)}${versionQuery}`,
    { siteSlug, ...(versionId ? { versionId } : {}) },
  );
}

async function requestSiteVersion(
  path: string,
  expected: { siteId: number; versionId: number } | { siteSlug: string; versionId?: number },
): Promise<SiteVersionDetail> {
  const response = await apiFetch(path);
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Site version returned ${response.status}`));
  if (!isRecord(body) || !positiveId(body.siteId) || !positiveId(body.versionId)) {
    throw new Error('Site version returned an invalid response');
  }
  const siteId = body.siteId;
  const versionId = body.versionId;
  if (
    ('siteId' in expected
      && (siteId !== expected.siteId || versionId !== expected.versionId))
    || ('siteSlug' in expected
      && (!isCanonicalOrLegacyDuplicateSlug(expected.siteSlug, body.routeSlug)
        || (expected.versionId !== undefined && versionId !== expected.versionId)))
  ) throw new Error('Site version returned an invalid response');
  const name = requiredText(body.name);
  const slug = requiredText(body.slug);
  const sourceUrl = requiredText(body.sourceUrl);
  const label = requiredText(body.label);
  const previewUrl = mediaPath(body.previewUrl);
  const analysisStatus = body.analysisStatus === undefined
    ? 'evidence-only'
    : body.analysisStatus;
  if (analysisStatus !== 'ready' && analysisStatus !== 'evidence-only') {
    throw new Error('Site version returned an invalid response');
  }
  const analysis = body.analysis === undefined || body.analysis === null
    ? null
    : parseSiteAnalysis(body.analysis);
  if (!Array.isArray(body.versions) || !Array.isArray(body.pages)) {
    throw new Error('Site version returned an invalid response');
  }
  const versionOptions = body.versions.map((value) => {
    if (!isRecord(value) || !positiveId(value.id)) {
      throw new Error('Site version returned an invalid response');
    }
    const updatedAt = requiredText(value.updatedAt);
    if (Number.isNaN(Date.parse(updatedAt))) {
      throw new Error('Site version returned an invalid response');
    }
    return {
      id: value.id,
      label: requiredText(value.label),
      isLatest: value.isLatest === true,
      updatedAt,
    };
  });
  return {
    routeSlug: requiredText(body.routeSlug),
    site: {
      id: siteId,
      name,
      slug,
      sourceUrl,
      ...optionalTextField(body, 'description'),
      ...optionalNullableTextField(body, 'logoUrl'),
      ...optionalStringArrayField(body, 'categories'),
      ...optionalStringArrayField(body, 'styles'),
      ...(body.popularity === undefined ? {} : { popularity: nonNegativeNumber(body.popularity) }),
    },
    version: {
      id: versionId,
      label,
      isLatest: body.isLatest === true,
      previewUrl,
      ...(typeof body.posterUrl === 'string' && body.posterUrl.startsWith('/assets/')
        ? { posterUrl: body.posterUrl }
        : {}),
      previewMediaKind: parsePreviewMediaKind(body.previewMediaKind),
    },
    versionOptions,
    canonicalUrl: requiredText(body.canonicalUrl),
    analysisStatus,
    analysis,
    ...(body.analysisModel === undefined
      ? {}
      : { analysisModel: requiredText(body.analysisModel) }),
    ...(body.mobilePageUrl === undefined
      ? {}
      : { mobilePageUrl: apiPath(body.mobilePageUrl) }),
    pages: body.pages.map(parsePage),
  };
}

function isCanonicalOrLegacyDuplicateSlug(
  requestedSlug: string,
  responseSlug: unknown,
): boolean {
  if (typeof responseSlug !== 'string') return false;
  if (responseSlug === requestedSlug) return true;
  const match = requestedSlug.match(/^(.+)-([2-9]\d*)$/);
  return Boolean(match && responseSlug === match[1]);
}

function parsePage(value: unknown): SiteVersionPage {
  if (!isRecord(value) || !positiveId(value.id) || !Array.isArray(value.sections)) {
    throw new Error('Site version returned an invalid response');
  }
  return {
    id: value.id,
    sourceId: requiredText(value.sourceId),
    title: requiredText(value.title),
    url: requiredText(value.url),
    position: nonNegativeInteger(value.position),
    fullPageImageUrl: apiPath(value.fullPageImageUrl),
    sections: value.sections.map(parseSection),
  };
}

function parsePreviewMediaKind(value: unknown): 'image' | 'video' {
  if (value === undefined) return 'video';
  if (value === 'image' || value === 'video') return value;
  throw new Error('Sites returned an invalid response');
}

function parseSection(value: unknown): SiteSectionView {
  if (
    !isRecord(value) || !positiveId(value.id) ||
    (value.mediaKind !== 'image' && value.mediaKind !== 'video') ||
    !Array.isArray(value.ocrBoxes) || !isRecord(value.sourceMetadata)
  ) throw new Error('Site version returned an invalid response');
  const sourceMetadata = value.sourceMetadata;
  const section: SiteSectionView = {
    id: value.id,
    sourceId: requiredText(value.sourceId),
    position: nonNegativeInteger(value.position),
    mediaKind: value.mediaKind,
    mediaUrl: apiPath(value.mediaUrl),
    patterns: optionalStringArray(sourceMetadata.patterns),
    searchText: typeof value.searchText === 'string'
      ? value.searchText
      : value.ocrBoxes
          .filter(isRecord)
          .map((box) => typeof box.text === 'string' ? box.text : '')
          .join(' '),
    ocrBoxes: value.ocrBoxes.map((box) => {
      if (!isRecord(box)) throw new Error('Site version returned an invalid response');
      return {
        x: finiteNumber(box.x), y: finiteNumber(box.y),
        width: finiteNumber(box.width), height: finiteNumber(box.height),
        text: typeof box.text === 'string' ? box.text : '',
      };
    }),
    sourceMetadata,
  };
  if (typeof value.posterUrl === 'string') section.posterUrl = apiPath(value.posterUrl);
  if (value.cropTop !== undefined) section.cropTop = finiteNumber(value.cropTop);
  if (value.cropBottom !== undefined) section.cropBottom = finiteNumber(value.cropBottom);
  if (value.videoStartSeconds !== undefined) section.videoStartSeconds = finiteNumber(value.videoStartSeconds);
  if (value.videoEndSeconds !== undefined) section.videoEndSeconds = finiteNumber(value.videoEndSeconds);
  return section;
}

function optionalStringArray(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) {
    throw new Error('Site version returned an invalid response');
  }
  return [...new Set(value)];
}

function optionalStringArrayField(value: Record<string, any>, key: string): Record<string, string[]> {
  if (value[key] === undefined) return {};
  return { [key]: optionalStringArray(value[key]) };
}

async function responseBody(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return undefined; }
}

function errorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === 'string' && value.error ? value.error : fallback;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function positiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Sites returned an invalid response');
  return Number(value);
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Site version returned an invalid response');
  return value;
}

function nonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Sites returned an invalid response');
  }
  return value;
}

function optionalTextField(value: Record<string, any>, key: string): Record<string, string> {
  const field = value[key];
  if (field === undefined) return {};
  if (typeof field !== 'string' || !field.trim()) throw new Error('Sites returned an invalid response');
  return { [key]: field.trim() };
}

function optionalNullableTextField(value: Record<string, any>, key: string): Record<string, string | null> {
  const field = value[key];
  if (field === undefined) return {};
  if (field === null) return { [key]: null };
  if (typeof field !== 'string' || !field.trim()) throw new Error('Sites returned an invalid response');
  return { [key]: field.trim() };
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Sites returned an invalid response');
  return value;
}

function apiPath(value: unknown): string {
  const path = requiredText(value);
  if (!path.startsWith('/api/sites/')) throw new Error('Sites returned an invalid response');
  return path;
}

// Public catalog media (preview, poster) is served from R2 by the Worker, so it
// is an /assets path; everything entitlement-checked still comes from the API.
function mediaPath(value: unknown): string {
  const path = requiredText(value);
  if (!path.startsWith('/assets/') && !path.startsWith('/api/sites/')) {
    throw new Error('Sites returned an invalid response');
  }
  return path;
}
