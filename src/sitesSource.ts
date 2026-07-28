import { parseSiteImport, type SiteImport, type SiteOcrBox, type SiteSection } from "./sites.ts";

export class MobbinSitesSourceError extends Error {
  constructor(message = "Mobbin Sites source is unsupported") {
    super(message);
    this.name = "MobbinSitesSourceError";
  }
}

type RscRows = Map<string, unknown>;
type SourceObject = Record<string, unknown>;
const RENDERED_MEDIA_PLACEHOLDER = "https://mobbin.com/";

export function decodeMobbinSitesSource(
  raw: string,
  options: { sourceUrl?: string } = {},
): SiteImport {
  if (!raw.trim() || raw.length > 2 * 1024 * 1024) {
    throw new MobbinSitesSourceError();
  }
  try {
    const rows = decodeRscRows(raw);
    const root = resolveCapturedSitesRoot(rows);
    return parseSiteImport(mapCapturedSitesRoot(root, options));
  } catch (cause) {
    if (cause instanceof MobbinSitesSourceError) throw cause;
    throw new MobbinSitesSourceError("Mobbin Sites source changed");
  }
}

function decodeRscRows(raw: string): RscRows {
  const rows: RscRows = new Map();
  const lines = raw.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length === 0 || lines.length > 10_000) throw new MobbinSitesSourceError();

  for (const line of lines) {
    const match = /^([0-9a-f]+):([\s\S]+)$/.exec(line);
    if (!match || rows.has(match[1])) throw new MobbinSitesSourceError();
    const payload = match[2];
    if (payload.startsWith("I[")) {
      rows.set(match[1], { moduleReference: payload });
      continue;
    }
    rows.set(match[1], JSON.parse(payload));
  }
  return rows;
}

function resolveCapturedSitesRoot(rows: RscRows): unknown {
  const flightRoot = rows.get("0");
  if (!flightRoot || !hasExactReference(flightRoot, "$L4")) {
    throw new MobbinSitesSourceError();
  }
  return resolveRowReference("$L4", rows);
}

function resolveRowReference(value: string, rows: RscRows): unknown {
  const match = /^\$L?([0-9a-f]+)$/.exec(value);
  if (!match || !rows.has(match[1])) throw new MobbinSitesSourceError();
  return rows.get(match[1]);
}

function hasExactReference(value: unknown, reference: string): boolean {
  if (value === reference) return true;
  if (Array.isArray(value)) return value.some((item) => hasExactReference(item, reference));
  if (isObject(value)) {
    return Object.values(value).some((item) => hasExactReference(item, reference));
  }
  return false;
}

function mapCapturedSitesRoot(
  value: unknown,
  options: { sourceUrl?: string },
): SiteImport {
  if (!Array.isArray(value) || value.length !== 4 || value[0] !== "$" || value[2] !== null) {
    throw new MobbinSitesSourceError();
  }
  const props = object(value[3]);
  const siteSlug = string(props.siteSlug);
  const siteVersionId = string(props.siteVersionId);
  const sourceSections = array(props.sections).map(object);
  if (sourceSections.length === 0) throw new MobbinSitesSourceError();

  const firstSource = sourceSections[0];
  const sourceVersion = object(firstSource.site_version);
  const sourceSite = object(sourceVersion.site);
  const sourceSiteId = string(sourceSite.id);
  const siteName = string(sourceSite.name);
  const description = optionalString(sourceSite.tagline);
  const logoUrl = sourceSite.logoCdnImgSources === undefined
    ? undefined
    : string(object(sourceSite.logoCdnImgSources).src);
  const styles = sourceSite.styles === undefined ? [] : array(sourceSite.styles).map(string);
  const publishedAt = string(sourceVersion.published_at);
  if (
    string(sourceVersion.id) !== siteVersionId ||
    !siteSlug.endsWith(`-${sourceSiteId}`)
  ) {
    throw new MobbinSitesSourceError();
  }

  const groupedPages: Array<{
    sourceId: string;
    title: string;
    url: string;
    fullPageImageUrl: string;
    sourcePageImageUrl?: string;
    lastSourceDisplayOrder: number;
    sections: SiteSection[];
  }> = [];
  const pageIndexes = new Map<string, number>();
  let activePageId: string | undefined;

  for (const sourceSection of sourceSections) {
    assertSameVersion(sourceSection, {
      siteVersionId,
      sourceSiteId,
      siteName,
      publishedAt,
    });
    const pageId = string(sourceSection.site_page_id);
    const sourcePageImageUrl = optionalString(sourceSection.page_image_url);
    const capturedPageUrl = normalizeCapturedPageUrl(
      optionalString(sourceSection.page_url),
      options.sourceUrl,
    );
    const sourceDisplayOrder = integer(sourceSection.display_order);
    const pageUrl = capturedPageUrl ?? options.sourceUrl;
    if (!pageUrl) throw new MobbinSitesSourceError();
    let pageIndex = pageIndexes.get(pageId);
    if (pageIndex === undefined) {
      pageIndex = groupedPages.length;
      pageIndexes.set(pageId, pageIndex);
      groupedPages.push({
        sourceId: pageId,
        title: capturedPageUrl ? pageTitle(pageUrl, pageIndex) : `Page ${pageIndex + 1}`,
        url: pageUrl,
        fullPageImageUrl:
          sourcePageImageUrl ??
          optionalString(sourceSection.page_video_url) ??
          RENDERED_MEDIA_PLACEHOLDER,
        ...(sourcePageImageUrl ? { sourcePageImageUrl } : {}),
        lastSourceDisplayOrder: sourceDisplayOrder,
        sections: [],
      });
    } else if (activePageId !== pageId) {
      throw new MobbinSitesSourceError();
    }
    activePageId = pageId;

    const page = groupedPages[pageIndex];
    if (sourcePageImageUrl) {
      if (page.sourcePageImageUrl && sourcePageImageUrl !== page.sourcePageImageUrl) {
        throw new MobbinSitesSourceError();
      }
      page.sourcePageImageUrl = sourcePageImageUrl;
      page.fullPageImageUrl = sourcePageImageUrl;
    }
    if (
      pageUrl !== page.url ||
      (page.sections.length > 0 && sourceDisplayOrder <= page.lastSourceDisplayOrder)
    ) {
      throw new MobbinSitesSourceError();
    }
    page.lastSourceDisplayOrder = sourceDisplayOrder;
    page.sections.push(mapSection(sourceSection, page.sections.length));
  }

  const firstVideo = sourceSections.find(
    (section) =>
      section.type === "page_video" &&
      optionalString(section.page_video_url) !== undefined,
  );
  const firstImage = sourceSections.find(
    (section) =>
      optionalString(section.custom_image_url) !== undefined ||
      optionalString(section.page_image_url) !== undefined,
  );
  const preview = firstVideo ?? firstImage;
  if (!preview) throw new MobbinSitesSourceError();
  const previewMediaKind = firstVideo ? "video" : "image";
  const previewMediaUrl = firstVideo
    ? string(firstVideo.page_video_url)
    : optionalString(preview.custom_image_url) ??
      optionalString(preview.page_image_url);
  if (!previewMediaUrl) throw new MobbinSitesSourceError();
  const sourceUrl = options.sourceUrl ?? new URL(groupedPages[0].url).origin;

  return {
    site: {
      sourceId: sourceSiteId,
      name: siteName,
      slug: siteSlug,
      sourceUrl,
      ...(description ? { description } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      categories: [],
      styles,
      popularity: sourceSections.reduce(
        (total, section) => total + optionalNonNegativeNumber(section.popularity_metric),
        0,
      ),
    },
    version: {
      sourceId: siteVersionId,
      label: versionLabel(publishedAt),
      isLatest: true,
      previewVideoUrl: previewMediaUrl,
      previewMediaKind,
    },
    pages: groupedPages.map((page, position) => ({
      sourceId: page.sourceId,
      title: page.title,
      url: page.url,
      position,
      fullPageImageUrl: page.fullPageImageUrl,
      sections: page.sections,
    })),
  };
}

function mapSection(source: SourceObject, position: number): SiteSection {
  const type = string(source.type);
  const sourceId = string(source.id);
  const patterns = sectionPatterns(source);
  if (type === "page_image" || type === "custom_image") {
    const metadata =
      source.metadata === undefined ||
      source.metadata === null ||
      source.metadata === "$undefined"
      ? undefined
      : object(source.metadata);
    const width = metadata === undefined ? undefined : optionalPositiveNumber(metadata.width);
    const height = metadata === undefined ? undefined : optionalPositiveNumber(metadata.height);
    const cropTop = optionalNonNegativeNumberValue(source.image_position_y_start);
    const cropBottom = optionalPositiveNumber(source.image_position_y_end);
    return {
      sourceId,
      position,
      mediaKind: "image",
      mediaUrl:
        optionalString(source.custom_image_url) ??
        optionalString(source.page_image_url) ??
        RENDERED_MEDIA_PLACEHOLDER,
      ...(cropTop !== undefined && cropBottom !== undefined && cropBottom > cropTop
        ? { cropTop, cropBottom }
        : {}),
      ocrBoxes: metadata?.boundingBoxes === undefined
        ? []
        : array(metadata.boundingBoxes).map(mapOcrBox),
      sourceMetadata: {
        sourceType: type,
        ...(width === undefined ? {} : { sourceWidth: width }),
        ...(height === undefined ? {} : { sourceHeight: height }),
        patterns,
      },
    };
  }
  if (type === "page_video") {
    const posterUrl = optionalString(source.page_image_url);
    const videoStartMilliseconds = optionalNonNegativeNumberValue(
      source.video_timestamp_start_ms,
    );
    const videoEndMilliseconds = optionalPositiveNumber(
      source.video_timestamp_end_ms,
    );
    return {
      sourceId,
      position,
      mediaKind: "video",
      mediaUrl:
        optionalString(source.page_video_url) ??
        posterUrl ??
        RENDERED_MEDIA_PLACEHOLDER,
      ...(posterUrl ? { posterUrl } : {}),
      ...(videoStartMilliseconds !== undefined &&
      videoEndMilliseconds !== undefined &&
      videoEndMilliseconds > videoStartMilliseconds
        ? {
            videoStartSeconds: videoStartMilliseconds / 1_000,
            videoEndSeconds: videoEndMilliseconds / 1_000,
          }
        : {}),
      ocrBoxes: [],
      sourceMetadata: { sourceType: type, patterns },
    };
  }
  throw new MobbinSitesSourceError();
}

function sectionPatterns(source: SourceObject): string[] {
  if (source.patterns === undefined) return [];
  return array(source.patterns).map(string);
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : string(value);
}

function optionalNonNegativeNumber(value: unknown): number {
  return value === undefined || value === null ? 0 : nonNegativeNumber(value);
}

function optionalNonNegativeNumberValue(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : nonNegativeNumber(value);
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : positiveNumber(value);
}

function mapOcrBox(value: unknown): SiteOcrBox {
  const source = object(value);
  const bbox = object(source.bbox);
  const x0 = nonNegativeNumber(bbox.x0);
  const y0 = nonNegativeNumber(bbox.y0);
  const x1 = positiveNumber(bbox.x1);
  const y1 = positiveNumber(bbox.y1);
  if (x1 <= x0 || y1 <= y0) throw new MobbinSitesSourceError();
  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    text: string(source.text),
  };
}

function assertSameVersion(
  section: SourceObject,
  expected: {
    siteVersionId: string;
    sourceSiteId: string;
    siteName: string;
    publishedAt: string;
  },
): void {
  const version = object(section.site_version);
  const site = object(version.site);
  if (
    string(version.id) !== expected.siteVersionId ||
    string(version.published_at) !== expected.publishedAt ||
    string(site.id) !== expected.sourceSiteId ||
    string(site.name) !== expected.siteName
  ) {
    throw new MobbinSitesSourceError();
  }
}

function pageTitle(value: string, position: number): string {
  const pathname = new URL(value).pathname.replace(/\/$/, "");
  const raw = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "home")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!raw) return position === 0 ? "Home" : `Page ${position + 1}`;
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCapturedPageUrl(
  value: string | undefined,
  renderedSourceUrl: string | undefined,
): string | undefined {
  if (!value || !renderedSourceUrl) return value;
  const captured = new URL(value);
  const rendered = new URL(renderedSourceUrl);
  if (
    captured.protocol === "http:" &&
    rendered.protocol === "https:" &&
    normalizedHostname(captured.hostname) === normalizedHostname(rendered.hostname)
  ) {
    captured.protocol = "https:";
    return captured.toString();
  }
  return value;
}

function normalizedHostname(value: string): string {
  return value.toLowerCase().replace(/^www\./, "");
}

function versionLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new MobbinSitesSourceError();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function object(value: unknown): SourceObject {
  if (!isObject(value)) throw new MobbinSitesSourceError();
  return value;
}

function isObject(value: unknown): value is SourceObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new MobbinSitesSourceError();
  return value;
}

function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new MobbinSitesSourceError();
  return value;
}

function integer(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new MobbinSitesSourceError();
  return value as number;
}

function nonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new MobbinSitesSourceError();
  }
  return value;
}

function positiveNumber(value: unknown): number {
  const result = nonNegativeNumber(value);
  if (result === 0) throw new MobbinSitesSourceError();
  return result;
}
