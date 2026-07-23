import { randomUUID } from "node:crypto";
import { bulkImageHash } from "../../../src/imageSource.ts";
import type { SearchEmbeddingProvider } from "../../../src/searchEmbedding.ts";
import type {
  PostgresSearchStore,
  SearchAccess,
  SearchSuggestion,
} from "../../../src/searchStore.ts";
import {
  decodeSearchCursor,
  normalizeSearchRequest,
  SEARCH_ENTITY_TYPES,
  type AdvancedSearchResult,
  type NormalizedSearchRequest,
  type SearchFilters,
} from "../../../src/searchTypes.ts";

export class SearchRequestError extends Error {
  readonly status = 400;
  readonly code = "invalid_search_request";
}

export interface SearchTelemetryEvent {
  requestId: string;
  action: "adaptive-search";
  resultCount: number;
  zeroResult: boolean;
  filterGroupCount: number;
  sort: string;
  degraded: boolean;
  latencyMs: number;
}

interface SearchServiceStore {
  search(
    request: NormalizedSearchRequest,
    queryVector: number[] | undefined,
    access: SearchAccess,
  ): Promise<AdvancedSearchResult>;
  suggest(prefix: string, access: SearchAccess, limit?: number): Promise<SearchSuggestion[]>;
}

const FILTER_KEYS: Array<keyof SearchFilters> = [
  "platform",
  "app",
  "appCategory",
  "pageType",
  "productArea",
  "flow",
  "component",
  "state",
  "theme",
  "layout",
];

function stringValues(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  const candidates = Array.isArray(value) ? value : [value];
  if (
    candidates.length > 100
    || candidates.some((item) => typeof item !== "string" || !item.trim() || item.length > 200)
  ) {
    throw new SearchRequestError(`invalid search ${field}`);
  }
  return candidates as string[];
}

export function searchRequestFromExpressQuery(
  query: Record<string, unknown>,
): NormalizedSearchRequest {
  const type = query.type === undefined ? "all" : String(query.type);
  if (type !== "all" && !SEARCH_ENTITY_TYPES.includes(type as never)) {
    throw new SearchRequestError("invalid search type");
  }
  const sort = query.sort === undefined ? "relevance" : String(query.sort);
  if (!["relevance", "recent", "app-az"].includes(sort)) {
    throw new SearchRequestError("invalid search sort");
  }
  if (
    query.q !== undefined
    && (typeof query.q !== "string" || query.q.length > 500)
  ) {
    throw new SearchRequestError("invalid search query");
  }
  if (
    query.limit !== undefined
    && (!/^\d+$/.test(String(query.limit))
      || Number(query.limit) < 1
      || Number(query.limit) > 48)
  ) {
    throw new SearchRequestError("invalid search limit");
  }
  if (
    query.cursor !== undefined
    && (typeof query.cursor !== "string" || query.cursor.length > 2_000)
  ) {
    throw new SearchRequestError("invalid search cursor");
  }
  for (const key of FILTER_KEYS) stringValues(query[key], key);
  const request = normalizeSearchRequest(query);
  if (request.cursor) {
    try {
      decodeSearchCursor(request.cursor);
    } catch {
      throw new SearchRequestError("invalid search cursor");
    }
  }
  return request;
}

export function createSearchService(input: {
  store: SearchServiceStore | PostgresSearchStore;
  embedder: SearchEmbeddingProvider | null;
  telemetry?: { record(event: SearchTelemetryEvent): void | Promise<void> };
  now?: () => number;
}) {
  const now = input.now ?? Date.now;
  return {
    async search(
      request: NormalizedSearchRequest,
      access: SearchAccess,
    ): Promise<AdvancedSearchResult> {
      const startedAt = now();
      const requestId = randomUUID();
      let vector: number[] | undefined;
      let degraded = !!request.query && !input.embedder;
      if (request.query && input.embedder) {
        try {
          [vector] = await input.embedder.embed([request.query]);
        } catch {
          degraded = true;
        }
      }
      let result: AdvancedSearchResult;
      try {
        result = await input.store.search(request, vector, access);
      } catch (error) {
        if (/search cursor/i.test(error instanceof Error ? error.message : "")) {
          throw new SearchRequestError((error as Error).message);
        }
        throw error;
      }
      result = {
        ...result,
        requestId,
        degraded: degraded || result.degraded,
      };
      await input.telemetry?.record({
        requestId,
        action: "adaptive-search",
        resultCount: result.items.length,
        zeroResult: result.items.length === 0,
        filterGroupCount: FILTER_KEYS.filter((key) => request.filters[key].length > 0).length,
        sort: request.sort,
        degraded: result.degraded,
        latencyMs: Math.max(0, now() - startedAt),
      });
      return result;
    },
    suggest(prefix: string, access: SearchAccess, limit = 10) {
      return input.store.suggest(prefix, access, Math.min(10, Math.max(1, limit)));
    },
  };
}

export type AdaptiveSearchService = ReturnType<typeof createSearchService>;

function safePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !/(?:url|object.?key|embedding|search.?text)/i.test(key)),
  );
}

export function hydrateSearchMedia(result: AdvancedSearchResult): AdvancedSearchResult {
  return {
    ...result,
    items: result.items.map((item) => {
      const rawImageUrl = typeof item.sourcePayload.imageUrl === "string"
        ? item.sourcePayload.imageUrl
        : undefined;
      return {
        ...item,
        sourcePayload: safePayload(item.sourcePayload),
        ...(rawImageUrl ? {
          imageUrl: `/api/media/${encodeURIComponent(item.appName)}/${bulkImageHash(rawImageUrl)}`,
          thumbnailUrl: `/api/media/${encodeURIComponent(item.appName)}/${bulkImageHash(rawImageUrl)}?variant=thumb`,
        } : {}),
      };
    }),
  };
}

export function sendSearchError(
  response: { status(code: number): { json(body: unknown): void } },
  error: unknown,
): void {
  if (error instanceof SearchRequestError) {
    response.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  response.status(500).json({ error: "Search unavailable", code: "search_unavailable" });
}
