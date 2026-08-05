import type { DiscoveryFacet, DiscoveryPage } from "./discoveryTypes.ts";
import type { SiteSummary } from "./types.ts";

const SITE_FACET_GROUPS = new Set(["categories", "sections", "styles"]);

function invalid(): never {
  throw new Error("Sites returned an invalid response");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function positiveInteger(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : invalid();
}

function nonNegativeInteger(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : invalid();
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : invalid();
}

function requiredText(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : invalid();
}

function apiPath(value: unknown): string {
  const path = requiredText(value);
  return path.startsWith("/api/sites/") ? path : invalid();
}

// Public catalog media (preview, poster) is served from R2 by the Worker, so it
// is an /assets path; everything entitlement-checked still comes from the API.
function mediaPath(value: unknown): string {
  const path = requiredText(value);
  return path.startsWith("/assets/") || path.startsWith("/api/sites/") ? path : invalid();
}

function optionalText(
  item: Record<string, unknown>,
  key: string,
): Record<string, string> {
  if (item[key] === undefined) return {};
  return { [key]: requiredText(item[key]) };
}

function optionalNullableText(
  item: Record<string, unknown>,
  key: string,
): Record<string, string | null> {
  if (item[key] === undefined) return {};
  if (item[key] === null) return { [key]: null };
  return { [key]: requiredText(item[key]) };
}

function requiredStringArray(
  item: Record<string, unknown>,
  key: string,
): string[] {
  const value = item[key];
  if (!Array.isArray(value)
    || value.some((entry) => typeof entry !== "string" || !entry)) {
    return invalid();
  }
  return [...new Set(value as string[])];
}

export function parseSiteSummary(value: unknown): SiteSummary {
  const item = record(value);
  if (!item || typeof item.isLatest !== "boolean" || !Array.isArray(item.previews)) {
    return invalid();
  }
  if (item.previews.length > 5) return invalid();
  const updatedAt = requiredText(item.updatedAt);
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== updatedAt) {
    return invalid();
  }
  const previews = item.previews.map((value) => {
    const preview = record(value);
    if (!preview) return invalid();
    return {
      id: positiveInteger(preview.id),
      title: requiredText(preview.title),
      position: nonNegativeInteger(preview.position),
      url: apiPath(preview.url),
    };
  }).sort((left, right) => left.position - right.position);
  const mediaKind = item.previewMediaKind;
  if (mediaKind !== "image" && mediaKind !== "video") {
    return invalid();
  }
  return {
    id: positiveInteger(item.siteId),
    versionId: positiveInteger(item.versionId),
    name: requiredText(item.name),
    slug: requiredText(item.slug),
    routeSlug: requiredText(item.routeSlug),
    sourceUrl: requiredText(item.sourceUrl),
    ...optionalText(item, "description"),
    ...optionalNullableText(item, "logoUrl"),
    categories: requiredStringArray(item, "categories"),
    styles: requiredStringArray(item, "styles"),
    popularity: nonNegativeNumber(item.popularity),
    label: requiredText(item.label),
    isLatest: item.isLatest,
    pageCount: nonNegativeInteger(item.pageCount),
    sectionCount: nonNegativeInteger(item.sectionCount),
    previewUrl: mediaPath(item.previewUrl),
    // Served by the Worker from R2, so it is not an /api path.
    ...(typeof item.posterUrl === "string" && item.posterUrl.startsWith("/assets/")
      ? { posterUrl: item.posterUrl }
      : {}),
    isUpdated: item.isUpdated === true,
    previewMediaKind: mediaKind,
    previews,
    updatedAt,
  };
}

function parseFacet(value: unknown): DiscoveryFacet {
  const item = record(value);
  if (!item
    || typeof item.group !== "string"
    || !SITE_FACET_GROUPS.has(item.group)
    || typeof item.value !== "string"
    || !item.value
    || (item.section !== undefined
      && (typeof item.section !== "string" || !item.section))) {
    return invalid();
  }
  return {
    group: item.group,
    value: item.value,
    count: nonNegativeInteger(item.count),
    ...(item.section === undefined ? {} : { section: item.section }),
  };
}

export function parseSitesDiscoveryPage(
  value: unknown,
): DiscoveryPage<SiteSummary> {
  const page = record(value);
  if (!page || !Array.isArray(page.items) || !Array.isArray(page.facets)) {
    return invalid();
  }
  const nextCursor = page.nextCursor;
  if (nextCursor !== null
    && (typeof nextCursor !== "string"
      || nextCursor.length === 0
      || nextCursor.length > 2_048)) {
    return invalid();
  }
  return {
    items: page.items.map(parseSiteSummary),
    nextCursor,
    totalCount: nonNegativeInteger(page.totalCount),
    facets: page.facets.map(parseFacet),
  };
}
