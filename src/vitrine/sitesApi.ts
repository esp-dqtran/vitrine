import type {
  SiteImportResult,
  SiteSectionView,
  SiteSummary,
  SiteVersionDetail,
  SiteVersionPage,
} from './types.ts';

export async function submitSiteImport(url: string): Promise<SiteImportResult> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'import-site', url }),
  });
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Site import returned ${response.status}`));
  if (response.status === 200 && isRecord(body) && body.existing === true && positiveId(body.siteId) && positiveId(body.versionId)) {
    return { existing: true, siteId: body.siteId, versionId: body.versionId };
  }
  if (response.status === 201 && isRecord(body) && positiveId(body.id)) {
    return { existing: false, id: body.id };
  }
  throw new Error('Site import returned an invalid response');
}

export async function listSites(): Promise<SiteSummary[]> {
  const response = await fetch('/api/sites');
  const body = await responseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, `Sites returned ${response.status}`));
  if (!Array.isArray(body)) throw new Error('Sites returned an invalid response');
  return body.map(parseSummary);
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
  if (!Array.isArray(body.pages)) throw new Error('Site version returned an invalid response');
  return {
    site: { id: siteId, name, slug, sourceUrl },
    version: { id: versionId, label, isLatest: body.isLatest === true, previewUrl },
    canonicalUrl: requiredText(body.canonicalUrl),
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
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error('Sites returned an invalid response');
  return {
    id: value.siteId,
    versionId: value.versionId,
    name: requiredText(value.name),
    slug: requiredText(value.slug),
    sourceUrl: requiredText(value.sourceUrl),
    label: requiredText(value.label),
    isLatest: value.isLatest === true,
    pageCount,
    sectionCount,
    previewUrl: apiPath(value.previewUrl),
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

function parseSection(value: unknown): SiteSectionView {
  if (
    !isRecord(value) || !positiveId(value.id) ||
    (value.mediaKind !== 'image' && value.mediaKind !== 'video') ||
    !Array.isArray(value.ocrBoxes) || !isRecord(value.sourceMetadata)
  ) throw new Error('Site version returned an invalid response');
  const section: SiteSectionView = {
    id: value.id,
    sourceId: requiredText(value.sourceId),
    position: nonNegativeInteger(value.position),
    mediaKind: value.mediaKind,
    mediaUrl: apiPath(value.mediaUrl),
    ocrBoxes: value.ocrBoxes.map((box) => {
      if (!isRecord(box)) throw new Error('Site version returned an invalid response');
      return {
        x: finiteNumber(box.x), y: finiteNumber(box.y),
        width: finiteNumber(box.width), height: finiteNumber(box.height),
        text: typeof box.text === 'string' ? box.text : '',
      };
    }),
    sourceMetadata: value.sourceMetadata,
  };
  if (typeof value.posterUrl === 'string') section.posterUrl = apiPath(value.posterUrl);
  if (value.cropTop !== undefined) section.cropTop = finiteNumber(value.cropTop);
  if (value.cropBottom !== undefined) section.cropBottom = finiteNumber(value.cropBottom);
  if (value.videoStartSeconds !== undefined) section.videoStartSeconds = finiteNumber(value.videoStartSeconds);
  if (value.videoEndSeconds !== undefined) section.videoEndSeconds = finiteNumber(value.videoEndSeconds);
  return section;
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

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Sites returned an invalid response');
  return value;
}

function apiPath(value: unknown): string {
  const path = requiredText(value);
  if (!path.startsWith('/api/sites/')) throw new Error('Sites returned an invalid response');
  return path;
}
