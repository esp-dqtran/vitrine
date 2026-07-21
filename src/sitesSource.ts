import { parseSiteImport, type SiteImport, type SiteOcrBox, type SiteSection } from "./sites.ts";

export class MobbinSitesSourceError extends Error {
  constructor(message = "Mobbin Sites source is unsupported") {
    super(message);
    this.name = "MobbinSitesSourceError";
  }
}

type RscRows = Map<string, unknown>;
type SourceObject = Record<string, unknown>;

export function decodeMobbinSitesSource(raw: string): SiteImport {
  if (!raw.trim() || raw.length > 2 * 1024 * 1024) {
    throw new MobbinSitesSourceError();
  }
  try {
    const rows = decodeRscRows(raw);
    const root = resolveCapturedSitesRoot(rows);
    return parseSiteImport(mapCapturedSitesRoot(root));
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

function mapCapturedSitesRoot(value: unknown): SiteImport {
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
  const publishedAt = string(sourceVersion.published_at);
  if (
    string(sourceVersion.id) !== siteVersionId ||
    !siteSlug.endsWith(`-${sourceSiteId}`)
  ) {
    throw new MobbinSitesSourceError();
  }

  const groupedPages: Array<{
    sourceId: string;
    url: string;
    fullPageImageUrl: string;
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
    let pageIndex = pageIndexes.get(pageId);
    if (pageIndex === undefined) {
      pageIndex = groupedPages.length;
      pageIndexes.set(pageId, pageIndex);
      groupedPages.push({
        sourceId: pageId,
        url: string(sourceSection.page_url),
        fullPageImageUrl: string(sourceSection.page_image_url),
        sections: [],
      });
    } else if (activePageId !== pageId) {
      throw new MobbinSitesSourceError();
    }
    activePageId = pageId;

    const page = groupedPages[pageIndex];
    if (
      string(sourceSection.page_url) !== page.url ||
      string(sourceSection.page_image_url) !== page.fullPageImageUrl ||
      integer(sourceSection.display_order) !== page.sections.length
    ) {
      throw new MobbinSitesSourceError();
    }
    page.sections.push(mapSection(sourceSection));
  }

  const firstVideo = sourceSections.find((section) => section.type === "page_video");
  if (!firstVideo) throw new MobbinSitesSourceError();
  const sourceUrl = new URL(groupedPages[0].url).origin;

  return {
    site: {
      sourceId: sourceSiteId,
      name: siteName,
      slug: siteSlug,
      sourceUrl,
    },
    version: {
      sourceId: siteVersionId,
      label: versionLabel(publishedAt),
      isLatest: true,
      previewVideoUrl: string(firstVideo.page_video_url),
    },
    pages: groupedPages.map((page, position) => ({
      sourceId: page.sourceId,
      title: pageTitle(page.url, position),
      url: page.url,
      position,
      fullPageImageUrl: page.fullPageImageUrl,
      sections: page.sections,
    })),
  };
}

function mapSection(source: SourceObject): SiteSection {
  const type = string(source.type);
  const sourceId = string(source.id);
  const position = integer(source.display_order);
  const patterns = sectionPatterns(source);
  if (type === "page_image") {
    const metadata = object(source.metadata);
    const width = positiveNumber(metadata.width);
    const height = positiveNumber(metadata.height);
    return {
      sourceId,
      position,
      mediaKind: "image",
      mediaUrl: string(source.page_image_url),
      cropTop: nonNegativeNumber(source.image_position_y_start),
      cropBottom: positiveNumber(source.image_position_y_end),
      ocrBoxes: array(metadata.boundingBoxes).map(mapOcrBox),
      sourceMetadata: {
        sourceType: type,
        sourceWidth: width,
        sourceHeight: height,
        patterns,
      },
    };
  }
  if (type === "page_video") {
    return {
      sourceId,
      position,
      mediaKind: "video",
      mediaUrl: string(source.page_video_url),
      posterUrl: string(source.page_image_url),
      videoStartSeconds: nonNegativeNumber(source.video_timestamp_start_ms) / 1_000,
      videoEndSeconds: positiveNumber(source.video_timestamp_end_ms) / 1_000,
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
