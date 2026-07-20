import { isIP } from "node:net";

export interface MobbinSitesIdentity {
  canonicalUrl: string;
  sourceSiteId: string;
  sourceVersionId: string;
}

export interface SiteOcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export type SiteSection = {
  sourceId: string;
  position: number;
  mediaKind: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  cropTop?: number;
  cropBottom?: number;
  videoStartSeconds?: number;
  videoEndSeconds?: number;
  ocrBoxes: SiteOcrBox[];
  sourceMetadata?: Record<string, unknown>;
};

export interface SitePage {
  sourceId: string;
  title: string;
  url: string;
  position: number;
  fullPageImageUrl: string;
  sections: SiteSection[];
}

export interface SiteImport {
  site: {
    sourceId: string;
    name: string;
    slug: string;
    sourceUrl: string;
  };
  version: {
    sourceId: string;
    label: string;
    isLatest: boolean;
    previewVideoUrl: string;
  };
  pages: SitePage[];
}

const SITE_PATH =
  /^\/sites\/([a-z0-9-]+)\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/preview\/?$/;

const SENSITIVE_QUERY_KEY =
  /(?:auth|credential|enc|expires|key|password|policy|secret|signature|token)/i;

const INVALID_SITE_IMPORT = "Invalid Mobbin Sites import";

export function hasDisallowedSiteMediaQuery(parsed: URL): boolean {
  return [...parsed.searchParams.keys()].some((key) => {
    if (!SENSITIVE_QUERY_KEY.test(key)) return false;
    return !(
      key.toLowerCase() === "enc" &&
      parsed.origin === "https://bytescale.mobbin.com" &&
      /^\/FW25bBB\/(?:video|image)\/mobbin\.com\/prod\/file\.(?:mp4|webp)$/.test(
        parsed.pathname,
      ) &&
      Boolean(parsed.searchParams.get(key))
    );
  });
}

export function canonicalMobbinSitesUrl(value: string): MobbinSitesIdentity {
  try {
    const parsed = new URL(value);
    const match = SITE_PATH.exec(parsed.pathname);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "mobbin.com" ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !match
    ) {
      throw new Error();
    }
    return {
      canonicalUrl: `https://mobbin.com${parsed.pathname.replace(/\/$/, "")}`,
      sourceSiteId: match[1],
      sourceVersionId: match[2],
    };
  } catch {
    throw new Error("Invalid Mobbin Sites URL");
  }
}

export function parseSiteImport(value: unknown): SiteImport {
  try {
    const root = exactObject(value, ["site", "version", "pages"]);
    const site = exactObject(root.site, ["sourceId", "name", "slug", "sourceUrl"]);
    const version = exactObject(root.version, [
      "sourceId",
      "label",
      "isLatest",
      "previewVideoUrl",
    ]);
    const pagesValue = array(root.pages);
    if (pagesValue.length === 0) throw new Error();

    const pageIds = new Set<string>();
    const sectionIds = new Set<string>();
    const pages = pagesValue.map((pageValue, pageIndex) => {
      const page = exactObject(pageValue, [
        "sourceId",
        "title",
        "url",
        "position",
        "fullPageImageUrl",
        "sections",
      ]);
      const sourceId = uniqueId(page.sourceId, pageIds);
      const position = contiguousPosition(page.position, pageIndex);
      const sectionsValue = array(page.sections);
      if (sectionsValue.length === 0) throw new Error();

      const sections = sectionsValue.map((sectionValue, sectionIndex) => {
        const section = exactObject(
          sectionValue,
          ["sourceId", "position", "mediaKind", "mediaUrl", "ocrBoxes"],
          [
            "posterUrl",
            "cropTop",
            "cropBottom",
            "videoStartSeconds",
            "videoEndSeconds",
            "sourceMetadata",
          ],
        );
        const mediaKind = enumValue(section.mediaKind, ["image", "video"] as const);
        const result: SiteSection = {
          sourceId: uniqueId(section.sourceId, sectionIds),
          position: contiguousPosition(section.position, sectionIndex),
          mediaKind,
          mediaUrl: publicHttpsUrl(section.mediaUrl),
          ocrBoxes: array(section.ocrBoxes).map(parseOcrBox),
        };

        if (section.sourceMetadata !== undefined) {
          result.sourceMetadata = jsonObject(section.sourceMetadata);
        }
        if (mediaKind === "image") {
          if (
            section.posterUrl !== undefined ||
            section.videoStartSeconds !== undefined ||
            section.videoEndSeconds !== undefined ||
            (section.cropTop === undefined) !== (section.cropBottom === undefined)
          ) {
            throw new Error();
          }
          if (section.cropTop !== undefined && section.cropBottom !== undefined) {
            result.cropTop = nonNegativeNumber(section.cropTop);
            result.cropBottom = nonNegativeNumber(section.cropBottom);
            if (result.cropBottom <= result.cropTop) throw new Error();
          }
        } else {
          if (
            section.cropTop !== undefined ||
            section.cropBottom !== undefined ||
            section.videoStartSeconds === undefined ||
            section.videoEndSeconds === undefined
          ) {
            throw new Error();
          }
          result.videoStartSeconds = nonNegativeNumber(section.videoStartSeconds);
          result.videoEndSeconds = nonNegativeNumber(section.videoEndSeconds);
          if (result.videoEndSeconds <= result.videoStartSeconds) throw new Error();
          if (section.posterUrl !== undefined) {
            result.posterUrl = publicHttpsUrl(section.posterUrl);
          }
        }
        return result;
      });

      return {
        sourceId,
        title: nonEmptyString(page.title),
        url: sourcePageUrl(page.url),
        position,
        fullPageImageUrl: publicHttpsUrl(page.fullPageImageUrl),
        sections,
      } satisfies SitePage;
    });

    if (typeof version.isLatest !== "boolean") throw new Error();
    return {
      site: {
        sourceId: nonEmptyString(site.sourceId),
        name: nonEmptyString(site.name),
        slug: nonEmptyString(site.slug),
        sourceUrl: publicHttpsUrl(site.sourceUrl),
      },
      version: {
        sourceId: nonEmptyString(version.sourceId),
        label: nonEmptyString(version.label),
        isLatest: version.isLatest,
        previewVideoUrl: publicHttpsUrl(version.previewVideoUrl),
      },
      pages,
    };
  } catch {
    throw new Error(INVALID_SITE_IMPORT);
  }
}

function parseOcrBox(value: unknown): SiteOcrBox {
  const box = exactObject(value, ["x", "y", "width", "height", "text"]);
  const width = nonNegativeNumber(box.width);
  const height = nonNegativeNumber(box.height);
  if (width === 0 || height === 0) throw new Error();
  return {
    x: nonNegativeNumber(box.x),
    y: nonNegativeNumber(box.y),
    width,
    height,
    text: nonEmptyString(box.text),
  };
}

function exactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  const result = value as Record<string, unknown>;
  const keys = Object.keys(result);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !(key in result)) || keys.some((key) => !allowed.has(key))) {
    throw new Error();
  }
  return result;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error();
  return value;
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2_048 || /[\0-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
    throw new Error();
  }
  return value;
}

function uniqueId(value: unknown, seen: Set<string>): string {
  const id = nonEmptyString(value);
  if (id.length > 256 || seen.has(id)) throw new Error();
  seen.add(id);
  return id;
}

function contiguousPosition(value: unknown, expected: number): number {
  if (!Number.isInteger(value) || value !== expected) throw new Error();
  return expected;
}

function nonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error();
  return value;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error();
  return value as T[number];
}

function publicHttpsUrl(value: unknown): string {
  const raw = nonEmptyString(value);
  const parsed = new URL(raw);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !isPublicHostname(parsed.hostname) ||
    hasDisallowedSiteMediaQuery(parsed)
  ) {
    throw new Error();
  }
  return parsed.toString();
}

function sourcePageUrl(value: unknown): string {
  const raw = nonEmptyString(value);
  if (raw.startsWith("/")) {
    if (raw.startsWith("//") || raw.includes("#")) throw new Error();
    return raw;
  }
  return publicHttpsUrl(raw);
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false;
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [a, b] = host.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (ipVersion === 6) {
    return !(
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/.test(host) ||
      host.startsWith("::ffff:")
    );
  }
  return host.includes(".");
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  JSON.stringify(value);
  return value as Record<string, unknown>;
}
