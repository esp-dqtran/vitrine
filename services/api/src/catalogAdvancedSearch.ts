import { randomUUID } from "node:crypto";
import type { DiscoveryFacet } from "../../../src/vitrine/discoveryTypes.ts";
import type { SiteSummary } from "../../../src/sitesStore.ts";
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_SCOPES,
  normalizeSearchRequest,
  type AdvancedSearchResult,
  type NormalizedSearchRequest,
  type SearchFacets,
  type SearchResultItem,
} from "../../../src/searchTypes.ts";

export class CatalogAdvancedSearchRequestError extends Error {}

const mixedCursorPrefix = "catalog-mixed:";

export function decodeAdvancedSearchCursor(cursor: string | undefined): {
  appCursor?: string;
  sitePage?: number;
} {
  if (!cursor) return {};
  if (cursor.startsWith("typesense-catalog:")) return { appCursor: cursor };
  if (cursor.startsWith("typesense-site:")) {
    const sitePage = Number(cursor.slice("typesense-site:".length));
    if (Number.isSafeInteger(sitePage) && sitePage > 0) return { sitePage };
    throw new CatalogAdvancedSearchRequestError("invalid search cursor");
  }
  if (!cursor.startsWith(mixedCursorPrefix)) {
    throw new CatalogAdvancedSearchRequestError("invalid search cursor");
  }
  try {
    const value = JSON.parse(
      Buffer.from(cursor.slice(mixedCursorPrefix.length), "base64url").toString("utf8"),
    ) as { appCursor?: unknown; sitePage?: unknown };
    if (value.appCursor !== undefined && (
      typeof value.appCursor !== "string" || !value.appCursor.startsWith("typesense-catalog:")
    )) throw new Error("invalid app cursor");
    if (value.sitePage !== undefined && (
      !Number.isSafeInteger(value.sitePage) || Number(value.sitePage) < 1
    )) throw new Error("invalid site cursor");
    return {
      ...(value.appCursor ? { appCursor: value.appCursor } : {}),
      ...(value.sitePage ? { sitePage: Number(value.sitePage) } : {}),
    };
  } catch {
    throw new CatalogAdvancedSearchRequestError("invalid search cursor");
  }
}

function encodeAdvancedSearchCursor(input: {
  appCursor?: string;
  sitePage?: number;
}): string | null {
  if (!input.appCursor && !input.sitePage) return null;
  return `${mixedCursorPrefix}${Buffer.from(JSON.stringify(input)).toString("base64url")}`;
}

const filterKeys: Array<keyof SearchFacets> = [
  "platform", "app", "appCategory", "pageType", "productArea", "flow",
  "component", "state", "theme", "layout", "siteSection", "siteStyle",
];

function values(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  const candidates = Array.isArray(value) ? value : [value];
  if (candidates.length > 100 || candidates.some((item) => (
    typeof item !== "string" || !item.trim() || item.length > 200
  ))) throw new CatalogAdvancedSearchRequestError(`invalid search ${field}`);
  return candidates as string[];
}

export function advancedSearchRequestFromQuery(
  query: Record<string, unknown>,
): NormalizedSearchRequest {
  const type = query.type === undefined ? "all" : String(query.type);
  const scope = query.scope === undefined ? "all" : String(query.scope);
  const sort = query.sort === undefined ? "relevance" : String(query.sort);
  if (type !== "all" && !SEARCH_ENTITY_TYPES.includes(type as never)) {
    throw new CatalogAdvancedSearchRequestError("invalid search type");
  }
  if (!SEARCH_SCOPES.includes(scope as never)) {
    throw new CatalogAdvancedSearchRequestError("invalid search scope");
  }
  if (!["relevance", "recent", "app-az"].includes(sort)) {
    throw new CatalogAdvancedSearchRequestError("invalid search sort");
  }
  if (query.q !== undefined && (typeof query.q !== "string" || query.q.length > 500)) {
    throw new CatalogAdvancedSearchRequestError("invalid search query");
  }
  if (query.limit !== undefined && (
    !/^\d+$/.test(String(query.limit)) || Number(query.limit) < 1 || Number(query.limit) > 48
  )) throw new CatalogAdvancedSearchRequestError("invalid search limit");
  if (query.cursor !== undefined && (
    typeof query.cursor !== "string" || query.cursor.length > 2_000
  )) throw new CatalogAdvancedSearchRequestError("invalid search cursor");
  for (const key of filterKeys) values(query[key], key);
  return normalizeSearchRequest(query);
}

export function isAdvancedSearchQuery(query: Record<string, unknown>): boolean {
  return ["scope", "type", "sort", "cursor", "relatedTo"]
    .some((key) => query[key] !== undefined);
}

export function emptyAdvancedSearchResult(degraded = false): AdvancedSearchResult {
  return {
    requestId: randomUUID(),
    items: [],
    facets: Object.fromEntries(filterKeys.map((key) => [key, []])) as unknown as SearchFacets,
    typeCounts: Object.fromEntries(
      SEARCH_ENTITY_TYPES.map((type) => [type, 0]),
    ) as AdvancedSearchResult["typeCounts"],
    nextCursor: null,
    hasMore: false,
    degraded,
  };
}

function siteItem(site: SiteSummary): SearchResultItem {
  const imageUrl = site.posterUrl ?? site.previewUrl;
  return {
    documentId: `site:${site.siteId}`,
    indexVersion: 1,
    catalogScope: "sites",
    catalogName: site.name,
    siteId: site.siteId,
    siteVersionId: site.versionId,
    catalogCategories: site.categories,
    siteSections: [],
    siteStyles: site.styles,
    platform: "web",
    entityType: "site",
    sourceId: `site:${site.siteId}`,
    title: site.name,
    description: site.description ?? "",
    aliases: [],
    visibleText: "",
    components: [],
    states: [],
    layoutPatterns: [],
    ...(site.categories[0] ? { appCategory: site.categories[0] } : {}),
    publishedAt: site.updatedAt,
    sourcePayload: { siteId: site.siteId, siteVersionId: site.versionId },
    ...(imageUrl ? { imageUrl, thumbnailUrl: imageUrl } : {}),
    matchedContext: [],
  };
}

export function siteAdvancedSearchResult(input: {
  sites: SiteSummary[];
  totalCount: number;
  nextPage: number | null;
  facets: DiscoveryFacet[];
}): AdvancedSearchResult {
  const result = emptyAdvancedSearchResult(false);
  result.items = input.sites.map(siteItem);
  result.typeCounts.site = input.totalCount;
  result.hasMore = input.nextPage !== null;
  result.nextCursor = input.nextPage ? `typesense-site:${input.nextPage}` : null;
  for (const facet of input.facets) {
    const key = facet.group === "sections"
      ? "siteSection"
      : facet.group === "styles"
        ? "siteStyle"
        : facet.group === "categories"
          ? "appCategory"
          : null;
    if (key) result.facets[key].push({ value: facet.value, count: facet.count });
  }
  return result;
}

export function mergeAdvancedSearchResults(
  appResult: AdvancedSearchResult,
  siteResult: AdvancedSearchResult,
  request: NormalizedSearchRequest,
): AdvancedSearchResult {
  const result = emptyAdvancedSearchResult(appResult.degraded || siteResult.degraded);
  const candidates = request.sort === "relevance"
    ? Array.from({ length: Math.max(appResult.items.length, siteResult.items.length) })
      .flatMap((_, index) => [appResult.items[index], siteResult.items[index]])
      .filter((item): item is SearchResultItem => item !== undefined)
    : [...appResult.items, ...siteResult.items];
  if (request.sort === "recent") {
    candidates.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  } else if (request.sort === "app-az") {
    candidates.sort((left, right) => (
      left.catalogName.localeCompare(right.catalogName) || left.title.localeCompare(right.title)
    ));
  }
  result.items = candidates.slice(0, request.limit);
  for (const type of SEARCH_ENTITY_TYPES) {
    result.typeCounts[type] = appResult.typeCounts[type] + siteResult.typeCounts[type];
  }
  for (const key of filterKeys) {
    const counts = new Map<string, number>();
    for (const option of [...appResult.facets[key], ...siteResult.facets[key]]) {
      counts.set(option.value, (counts.get(option.value) ?? 0) + option.count);
    }
    result.facets[key] = [...counts].map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
  }
  result.hasMore = appResult.hasMore || siteResult.hasMore;
  result.nextCursor = encodeAdvancedSearchCursor({
    ...(appResult.nextCursor ? { appCursor: appResult.nextCursor } : {}),
    ...(siteResult.nextCursor?.startsWith("typesense-site:")
      ? { sitePage: Number(siteResult.nextCursor.slice("typesense-site:".length)) }
      : {}),
  });
  return result;
}
