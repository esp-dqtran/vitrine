import { createHash } from "node:crypto";

export const SEARCH_ENTITY_TYPES = ["app", "screen", "flow", "component", "pattern"] as const;
export type SearchEntityType = typeof SEARCH_ENTITY_TYPES[number];
export type SearchType = SearchEntityType | "all";
export type SearchSort = "relevance" | "recent" | "app-az";

export interface SearchFilters {
  platform: string[];
  app: string[];
  appCategory: string[];
  pageType: string[];
  productArea: string[];
  flow: string[];
  component: string[];
  state: string[];
  theme: string[];
  layout: string[];
}

export interface NormalizedSearchRequest {
  query: string;
  type: SearchType;
  filters: SearchFilters;
  sort: SearchSort;
  cursor?: string;
  limit: number;
}

export interface SearchDocument {
  documentId: string;
  indexVersion: 1;
  versionId: number;
  appId: number;
  appName: string;
  platform: string;
  entityType: SearchEntityType;
  sourceId: string;
  title: string;
  description: string;
  aliases: string[];
  visibleText: string;
  pageType?: string;
  productArea?: string;
  flowId?: string;
  flowName?: string;
  flowStepIndex?: number;
  components: string[];
  states: string[];
  theme?: "light" | "dark" | "mixed";
  layoutPatterns: string[];
  appCategory?: string;
  publishedAt: string;
  capturedAt?: string;
  mediaImageId?: number;
  sourcePayload: Record<string, unknown>;
  searchText: string;
  sourceRevision: string;
}

export interface SearchResultItem extends Omit<SearchDocument, "searchText" | "sourceRevision"> {
  imageUrl?: string;
  thumbnailUrl?: string;
  matchedContext: Array<{
    kind: "text" | "component" | "flow" | "productArea";
    value: string;
  }>;
}

export interface SearchFacetOption {
  value: string;
  count: number;
}

export type SearchFacets = { [K in keyof SearchFilters]: SearchFacetOption[] };

export interface AdvancedSearchResult {
  requestId: string;
  items: SearchResultItem[];
  facets: SearchFacets;
  typeCounts: Record<SearchEntityType, number>;
  nextCursor: string | null;
  hasMore: boolean;
  degraded: boolean;
}

const EMPTY_FILTERS: SearchFilters = {
  platform: [],
  app: [],
  appCategory: [],
  pageType: [],
  productArea: [],
  flow: [],
  component: [],
  state: [],
  theme: [],
  layout: [],
};

const values = (value: unknown): string[] =>
  [...new Set((Array.isArray(value) ? value : value ? [value] : [])
    .map(String)
    .map((item) => item.trim())
    .filter(Boolean))]
    .sort();

export function normalizeSearchRequest(input: Record<string, unknown>): NormalizedSearchRequest {
  const type = SEARCH_ENTITY_TYPES.includes(input.type as SearchEntityType)
    ? input.type as SearchEntityType
    : "all";
  const sort = ["relevance", "recent", "app-az"].includes(String(input.sort))
    ? input.sort as SearchSort
    : "relevance";
  return {
    query: String(input.q ?? "").trim().slice(0, 500),
    type,
    filters: {
      ...EMPTY_FILTERS,
      platform: values(input.platform),
      app: values(input.app),
      appCategory: values(input.appCategory),
      pageType: values(input.pageType),
      productArea: values(input.productArea),
      flow: values(input.flow),
      component: values(input.component),
      state: values(input.state),
      theme: values(input.theme),
      layout: values(input.layout),
    },
    sort,
    ...(input.cursor ? { cursor: String(input.cursor) } : {}),
    limit: Math.min(48, Math.max(1, Number(input.limit) || 24)),
  };
}

export function searchFingerprint(
  request: Omit<NormalizedSearchRequest, "cursor" | "limit">,
): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("base64url");
}

export interface SearchCursor {
  fingerprint: string;
  indexVersion: number;
  sort: SearchSort;
  values: Array<string | number>;
}

export const encodeSearchCursor = (cursor: SearchCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export function decodeSearchCursor(value: string): SearchCursor {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SearchCursor;
  if (
    !parsed.fingerprint
    || parsed.indexVersion !== 1
    || !["relevance", "recent", "app-az"].includes(parsed.sort)
    || !Array.isArray(parsed.values)
  ) {
    throw new Error("invalid search cursor");
  }
  return parsed;
}

export function fuseSearchRanks(lists: string[][], k = 60) {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((documentId, index) => {
      scores.set(documentId, (scores.get(documentId) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores]
    .map(([documentId, score]) => ({ documentId, score }))
    .sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId));
}
