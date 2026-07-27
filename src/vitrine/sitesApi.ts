import type {
  SiteSectionView,
  SiteSummary,
  SiteVersionDetail,
  SiteVersionPage,
} from './types.ts';
import { parseSiteAnalysis } from '../siteAnalysis.ts';

export async function listSites(): Promise<SiteSummary[]> {
  const response = await fetch('/api/sites');
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Sites returned ${response.status}`));
  if (!Array.isArray(body)) throw new Error('Sites returned an invalid response');
  return body.map(parseSummary);
}

export interface SitesPageResult {
  sites: SiteSummary[];
  nextOffset: number | null;
  total: number;
}

export async function listSitesPage(limit: number, offset: number): Promise<SitesPageResult> {
  if (!positiveId(limit) || limit > 48 || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Invalid Sites page');
  }
  const response = await fetch(`/api/sites?limit=${limit}&offset=${offset}`);
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Sites returned ${response.status}`));
  if (!isRecord(body) || !Array.isArray(body.sites)) {
    throw new Error('Sites returned an invalid response');
  }
  const nextOffset = body.nextOffset === null ? null : nonNegativeInteger(body.nextOffset);
  return {
    sites: body.sites.map(parseSummary),
    nextOffset,
    total: nonNegativeInteger(body.total),
  };
}

export async function getSiteVersion(siteId: number, versionId: number): Promise<SiteVersionDetail> {
  if (!positiveId(siteId) || !positiveId(versionId)) throw new Error('Invalid Site version reference');
  const response = await fetch(`/api/sites/${siteId}/versions/${versionId}`);
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Site version returned ${response.status}`));
  if (!isRecord(body) || body.siteId !== siteId || body.versionId !== versionId) {
    throw new Error('Site version returned an invalid response');
  }
  const name = requiredText(body.name);
  const slug = requiredText(body.slug);
  const sourceUrl = requiredText(body.sourceUrl);
  const label = requiredText(body.label);
  const previewUrl = apiPath(body.previewUrl);
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

function parseSummary(value: unknown): SiteSummary {
  if (!isRecord(value) || !positiveId(value.siteId) || !positiveId(value.versionId)) {
    throw new Error('Sites returned an invalid response');
  }
  const pageCount = nonNegativeInteger(value.pageCount);
  const sectionCount = nonNegativeInteger(value.sectionCount);
  const updatedAt = requiredText(value.updatedAt);
  if (Number.isNaN(Date.parse(updatedAt)) || !Array.isArray(value.previews) || value.previews.length > 5) {
    throw new Error('Sites returned an invalid response');
  }
  const previews = value.previews.map((preview) => {
    if (!isRecord(preview) || !positiveId(preview.id)) throw new Error('Sites returned an invalid response');
    return {
      id: preview.id,
      title: requiredText(preview.title),
      position: nonNegativeInteger(preview.position),
      url: apiPath(preview.url),
    };
  }).sort((a, b) => a.position - b.position);
  return {
    id: value.siteId,
    versionId: value.versionId,
    name: requiredText(value.name),
    slug: requiredText(value.slug),
    sourceUrl: requiredText(value.sourceUrl),
    ...optionalTextField(value, 'description'),
    ...optionalNullableTextField(value, 'logoUrl'),
    ...optionalStringArrayField(value, 'categories'),
    ...optionalStringArrayField(value, 'styles'),
    ...(value.popularity === undefined ? {} : { popularity: nonNegativeNumber(value.popularity) }),
    label: requiredText(value.label),
    isLatest: value.isLatest === true,
    pageCount,
    sectionCount,
    previewUrl: apiPath(value.previewUrl),
    previewMediaKind: parsePreviewMediaKind(value.previewMediaKind),
    previews,
    updatedAt,
  };
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
