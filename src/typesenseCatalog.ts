import {
  catalogSearchItems,
  type CatalogEntityKind,
  type CatalogResearchSource,
  type CatalogSearchFacets,
  type CatalogSearchItem,
  type CatalogSearchOptions,
  type CatalogSearchResult,
  type CatalogSearchResultItem,
} from "./catalogResearch.ts";
import {
  SEARCH_ENTITY_TYPES,
  type AdvancedSearchResult,
  type NormalizedSearchRequest,
  type SearchFacetOption,
  type SearchFacets,
  type SearchResultItem,
  type SearchSuggestion,
} from "./searchTypes.ts";

export const TYPESENSE_CATALOG_COLLECTION = "vitrines_catalog_v1";

export interface TypesenseCatalogConfig {
  host: string;
  apiKey: string;
  collection: string;
}

export interface TypesenseCatalogDocument extends CatalogSearchItem {
  id: string;
  embedding?: number[];
}

export interface TypesenseCatalogClient {
  index(source: CatalogResearchSource): Promise<number>;
  search(options: CatalogSearchOptions): Promise<CatalogSearchResult>;
  searchAdvanced?(request: NormalizedSearchRequest): Promise<AdvancedSearchResult>;
  suggest?(prefix: string, limit?: number): Promise<SearchSuggestion[]>;
  related?(sourceId: string, limit?: number): Promise<AdvancedSearchResult>;
}

interface TypesenseFacetCount {
  field_name: string;
  counts: Array<{ count: number; value: string }>;
}

interface TypesenseSearchResponse {
  found?: number;
  hits: Array<{ document: TypesenseCatalogDocument }>;
  facet_counts?: TypesenseFacetCount[];
}

const searchableFields = ["title", "app", "description", "searchText"];
const facetFields = [
  "kind",
  "app",
  "theme",
  "pageType",
  "productArea",
  "states",
  "layoutPatterns",
  "componentNames",
  "appCategories",
  "platform",
  "flowTags",
];

const advancedFacetFields: Record<Exclude<keyof SearchFacets, "siteSection" | "siteStyle">, string> = {
  platform: "platform",
  app: "app",
  appCategory: "appCategories",
  pageType: "pageType",
  productArea: "productArea",
  flow: "flowTags",
  component: "componentNames",
  state: "states",
  theme: "theme",
  layout: "layoutPatterns",
};

function collectionSchema(name: string) {
  return {
    name,
    enable_nested_fields: false,
    fields: [
      { name: "id", type: "string" },
      { name: "kind", type: "string", facet: true },
      { name: "app", type: "string", facet: true },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "searchText", type: "string" },
      { name: "evidenceIds", type: "int32[]" },
      { name: "imageUrl", type: "string", optional: true, index: false },
      { name: "thumbnailUrl", type: "string", optional: true, index: false },
      { name: "pageType", type: "string", facet: true, optional: true },
      { name: "productArea", type: "string", facet: true, optional: true },
      { name: "theme", type: "string", facet: true, optional: true },
      { name: "states", type: "string[]", facet: true },
      { name: "layoutPatterns", type: "string[]", facet: true },
      { name: "componentNames", type: "string[]", facet: true },
      { name: "appCategories", type: "string[]", facet: true },
      { name: "platform", type: "string", facet: true, optional: true },
      { name: "flowTags", type: "string[]", facet: true, optional: true },
      // The model is intentionally fixed per collection. A model migration creates a
      // new collection instead of mixing incomparable embedding dimensions.
      { name: "embedding", type: "float[]", num_dim: 1536, optional: true },
    ],
  };
}

function collectionPath(collection: string): string {
  return `/collections/${encodeURIComponent(collection)}`;
}

function aliasPath(alias: string): string {
  return `/aliases/${encodeURIComponent(alias)}`;
}

function escapeFilter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

function equalFilter(field: string, value: string): string {
  return `${field}:=\`${escapeFilter(value)}\``;
}

function anyFilter(field: string, values: string[]): string {
  return `(${values.map((value) => equalFilter(field, value)).join(" || ")})`;
}

export function typesenseFilter(options: CatalogSearchOptions): string {
  const filters: string[] = [];
  if (options.kind && options.kind !== "all") filters.push(equalFilter("kind", options.kind));
  if (options.theme) filters.push(equalFilter("theme", options.theme));
  if (options.pageType) filters.push(equalFilter("pageType", options.pageType));
  if (options.productArea) filters.push(equalFilter("productArea", options.productArea));
  if (options.state) filters.push(`states:=\`${escapeFilter(options.state)}\``);
  if (options.layout) filters.push(`layoutPatterns:=\`${escapeFilter(options.layout)}\``);
  if (options.component) filters.push(`componentNames:=\`${escapeFilter(options.component)}\``);
  if (options.appCategory) filters.push(`appCategories:=\`${escapeFilter(options.appCategory)}\``);
  if (options.platform) filters.push(equalFilter("platform", options.platform));
  if (options.flowTag) filters.push(`flowTags:=\`${escapeFilter(options.flowTag)}\``);
  return filters.join(" && ");
}

export function typesenseAdvancedFilter(request: NormalizedSearchRequest): string {
  const filters: string[] = [];
  if (request.scope === "sites" || request.type === "site") return "kind:=`__site__`";
  if (request.type !== "all") filters.push(equalFilter("kind", request.type));
  for (const [key, field] of Object.entries(advancedFacetFields) as Array<
    [keyof typeof advancedFacetFields, string]
  >) {
    if (request.filters[key].length) filters.push(anyFilter(field, request.filters[key]));
  }
  return filters.join(" && ");
}

function emptyFacets(): CatalogSearchFacets {
  return {
    kinds: { app: 0, screen: 0, component: 0, token: 0, flow: 0, pattern: 0 },
    themes: [], pageTypes: [], productAreas: [], states: [], layouts: [], components: [], appCategories: [], platforms: [], flowTags: [],
  };
}

function responseFacets(facetCounts: TypesenseFacetCount[] | undefined): CatalogSearchFacets {
  const result = emptyFacets();
  for (const facet of facetCounts ?? []) {
    const values = facet.counts.map(({ value }) => value).sort();
    switch (facet.field_name) {
      case "kind":
        for (const { value, count } of facet.counts) {
          if (value in result.kinds) result.kinds[value as CatalogEntityKind] = count;
        }
        break;
      case "theme": result.themes = values; break;
      case "pageType": result.pageTypes = values; break;
      case "productArea": result.productAreas = values; break;
      case "states": result.states = values; break;
      case "layoutPatterns": result.layouts = values; break;
      case "componentNames": result.components = values; break;
      case "appCategories": result.appCategories = values; break;
      case "platform": result.platforms = values; break;
      case "flowTags": result.flowTags = values; break;
    }
  }
  return result;
}

function countedFacets(facetCounts: TypesenseFacetCount[] | undefined): SearchFacets {
  const result = Object.fromEntries([
    ...Object.keys(advancedFacetFields),
    "siteSection",
    "siteStyle",
  ].map((key) => [key, []])) as unknown as SearchFacets;
  const keyByField = Object.fromEntries(
    Object.entries(advancedFacetFields).map(([key, field]) => [field, key]),
  ) as Record<string, keyof SearchFacets>;
  for (const facet of facetCounts ?? []) {
    const key = keyByField[facet.field_name];
    if (!key) continue;
    result[key] = facet.counts
      .map(({ value, count }) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
  }
  return result;
}

function matchedContext(document: TypesenseCatalogDocument, query: string): SearchResultItem["matchedContext"] {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const contexts: SearchResultItem["matchedContext"] = [];
  const add = (kind: SearchResultItem["matchedContext"][number]["kind"], values: Array<string | undefined>) => {
    const value = values.find((candidate) => candidate
      && terms.some((term) => candidate.toLocaleLowerCase().includes(term)));
    if (value) contexts.push({ kind, value });
  };
  add("text", [document.description]);
  add("component", document.componentNames);
  add("productArea", [document.productArea]);
  if (document.kind === "flow") add("flow", [document.title]);
  return contexts;
}

function advancedResultItem(
  document: TypesenseCatalogDocument,
  query: string,
): SearchResultItem | null {
  if (document.kind === "token") return null;
  const entityType = document.kind;
  if (!SEARCH_ENTITY_TYPES.includes(entityType as never)) return null;
  const mediaImageId = document.evidenceIds[0];
  return {
    documentId: document.id,
    indexVersion: 1,
    catalogScope: "apps",
    catalogName: document.app,
    appName: document.app,
    catalogCategories: document.appCategories,
    siteSections: [],
    siteStyles: [],
    platform: document.platform ?? "web",
    entityType: entityType as SearchResultItem["entityType"],
    sourceId: document.id,
    title: document.title,
    description: document.description,
    aliases: [],
    visibleText: "",
    ...(document.pageType ? { pageType: document.pageType } : {}),
    ...(document.productArea ? { productArea: document.productArea } : {}),
    ...(document.kind === "flow" ? { flowName: document.title } : {}),
    components: document.componentNames,
    states: document.states,
    ...(document.theme ? { theme: document.theme } : {}),
    layoutPatterns: document.layoutPatterns,
    ...(document.appCategories[0] ? { appCategory: document.appCategories[0] } : {}),
    publishedAt: new Date(0).toISOString(),
    ...(mediaImageId ? { mediaImageId } : {}),
    sourcePayload: {
      evidenceIds: document.evidenceIds,
      ...(document.kind === "flow" ? { steps: [] } : {}),
    },
    ...(document.imageUrl ? { imageUrl: document.imageUrl } : {}),
    ...(document.thumbnailUrl ? { thumbnailUrl: document.thumbnailUrl } : {}),
    matchedContext: matchedContext(document, query),
  };
}

const suggestionKindOrder: SearchSuggestion["kind"][] = [
  "app", "site", "pageType", "productArea", "flow", "component", "layout", "title", "alias",
];

function searchSuggestions(
  prefix: string,
  body: TypesenseSearchResponse,
  limit: number,
): SearchSuggestion[] {
  const normalized = prefix.toLocaleLowerCase();
  const counts = new Map<string, SearchSuggestion>();
  const add = (kind: SearchSuggestion["kind"], value: string | undefined, resultCount: number) => {
    const trimmed = value?.trim();
    if (!trimmed || !trimmed.toLocaleLowerCase().startsWith(normalized)) return;
    const key = `${kind}:${trimmed.toLocaleLowerCase()}`;
    const current = counts.get(key);
    counts.set(key, { kind, value: trimmed, resultCount: Math.max(current?.resultCount ?? 0, resultCount) });
  };
  const facetKind: Record<string, SearchSuggestion["kind"]> = {
    app: "app",
    pageType: "pageType",
    productArea: "productArea",
    componentNames: "component",
    layoutPatterns: "layout",
  };
  for (const facet of body.facet_counts ?? []) {
    const kind = facetKind[facet.field_name];
    if (!kind) continue;
    for (const entry of facet.counts) add(kind, entry.value, entry.count);
  }
  for (const { document } of body.hits) {
    add(document.kind === "flow" ? "flow" : "title", document.title, 1);
  }
  return [...counts.values()]
    .sort((left, right) => (
      suggestionKindOrder.indexOf(left.kind) - suggestionKindOrder.indexOf(right.kind)
      || right.resultCount - left.resultCount
      || left.value.localeCompare(right.value)
    ))
    .slice(0, limit);
}

function resultItem(document: TypesenseCatalogDocument): CatalogSearchResultItem {
  const { searchText: _searchText, embedding: _embedding, ...item } = document;
  return item;
}

export function typesenseCatalogConfigFromEnv(
  env: Record<string, string | undefined>,
): TypesenseCatalogConfig | undefined {
  if (env.TYPESENSE_SEARCH_ENABLED !== "true") return undefined;
  const host = env.TYPESENSE_HOST?.trim().replace(/\/$/, "");
  const apiKey = env.TYPESENSE_API_KEY?.trim();
  if (!host || !/^https?:\/\//.test(host)) throw new Error("TYPESENSE_HOST must be an absolute HTTP URL");
  if (!apiKey) throw new Error("TYPESENSE_API_KEY is required when TYPESENSE_SEARCH_ENABLED=true");
  const collection = env.TYPESENSE_COLLECTION?.trim() || TYPESENSE_CATALOG_COLLECTION;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(collection)) throw new Error("TYPESENSE_COLLECTION must use only letters, numbers, underscores, or hyphens");
  return { host, apiKey, collection };
}

export function createTypesenseCatalogClient(
  config: TypesenseCatalogConfig,
  request: typeof fetch = fetch,
): TypesenseCatalogClient {
  const call = async (path: string, init: RequestInit = {}, timeoutMs?: number) => {
    const timeoutSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
    const requestSignal = init.signal ?? undefined;
    const signal = requestSignal && timeoutSignal
      ? AbortSignal.any([requestSignal, timeoutSignal])
      : requestSignal ?? timeoutSignal;
    const response = await request(`${config.host}${path}`, {
      ...init,
      ...(signal ? { signal } : {}),
      headers: { "x-typesense-api-key": config.apiKey, ...init.headers },
    });
    return response;
  };

  const createCollection = async (collection: string): Promise<void> => {
    const created = await call("/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(collectionSchema(collection)),
    });
    if (!created.ok) throw new Error(`Typesense collection creation returned ${created.status}`);
  };

  return {
    async index(source) {
      const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const nextCollection = `${config.collection}_${suffix}`;
      const existingAlias = await call(aliasPath(config.collection));
      if (!existingAlias.ok && existingAlias.status !== 404) {
        throw new Error(`Typesense alias check returned ${existingAlias.status}`);
      }
      const previousCollection = existingAlias.ok
        ? (await existingAlias.json() as { collection_name: string }).collection_name
        : undefined;
      await createCollection(nextCollection);
      const documents = catalogSearchItems(source);
      const imported = await call(`${collectionPath(nextCollection)}/documents/import?action=upsert`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: documents.map((document) => JSON.stringify(document)).join("\n"),
      });
      if (!imported.ok) throw new Error(`Typesense import returned ${imported.status}`);
      const lines = (await imported.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as { success?: boolean });
      if (lines.some(({ success }) => success !== true)) throw new Error("Typesense rejected one or more catalog documents");
      const switched = await call(aliasPath(config.collection), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection_name: nextCollection }),
      });
      if (!switched.ok) throw new Error(`Typesense alias update returned ${switched.status}`);
      if (previousCollection?.startsWith(`${config.collection}_`)) {
        await call(collectionPath(previousCollection), { method: "DELETE" });
      }
      return lines.length;
    },

    async search(options) {
      const params = new URLSearchParams({
        q: options.query.trim() || "*",
        query_by: searchableFields.join(","),
        query_by_weights: "8,6,4,1",
        facet_by: facetFields.join(","),
        exclude_fields: "embedding,searchText",
        max_facet_values: "100",
        sort_by: "_text_match:desc",
        per_page: String(Math.min(Math.max(options.limit ?? 24, 1), 100)),
      });
      const filter = typesenseFilter(options);
      if (filter) params.set("filter_by", filter);
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`, {}, 3_000);
      if (!response.ok) throw new Error(`Typesense search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      return {
        items: body.hits.map(({ document }) => resultItem(document)),
        facets: responseFacets(body.facet_counts),
      };
    },

    async searchAdvanced(input) {
      const pagePrefix = "typesense-catalog:";
      const page = input.cursor?.startsWith(pagePrefix)
        ? Number(input.cursor.slice(pagePrefix.length))
        : 1;
      if (!Number.isSafeInteger(page) || page < 1) throw new Error("invalid search cursor");
      const params = new URLSearchParams({
        q: input.query.trim() || "*",
        query_by: searchableFields.join(","),
        query_by_weights: "8,6,4,1",
        facet_by: facetFields.join(","),
        exclude_fields: "embedding,searchText",
        max_facet_values: "100",
        sort_by: "_text_match:desc",
        page: String(page),
        per_page: String(input.limit),
      });
      const filter = typesenseAdvancedFilter(input);
      if (filter) params.set("filter_by", filter);
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`, {}, 3_000);
      if (!response.ok) throw new Error(`Typesense search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      const items = body.hits.flatMap(({ document }) => {
        const item = advancedResultItem(document, input.query);
        return item ? [item] : [];
      });
      const typeCounts = Object.fromEntries(
        SEARCH_ENTITY_TYPES.map((type) => [type, 0]),
      ) as AdvancedSearchResult["typeCounts"];
      const kindFacet = body.facet_counts?.find(({ field_name }) => field_name === "kind");
      for (const { value, count } of kindFacet?.counts ?? []) {
        if (SEARCH_ENTITY_TYPES.includes(value as never)) {
          typeCounts[value as keyof typeof typeCounts] = count;
        }
      }
      const found = body.found ?? items.length;
      const hasMore = found > page * input.limit;
      return {
        requestId: "",
        items,
        facets: countedFacets(body.facet_counts),
        typeCounts,
        nextCursor: hasMore ? `${pagePrefix}${page + 1}` : null,
        hasMore,
        degraded: Boolean(input.query),
      };
    },

    async suggest(prefix, rawLimit = 10) {
      const limit = Math.min(10, Math.max(1, rawLimit));
      const query = prefix.trim();
      if (!query) return [];
      const params = new URLSearchParams({
        q: query,
        query_by: searchableFields.join(","),
        query_by_weights: "8,6,4,1",
        facet_by: facetFields.join(","),
        exclude_fields: "embedding,searchText",
        max_facet_values: "100",
        per_page: String(Math.max(limit * 2, 10)),
      });
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`, {}, 3_000);
      if (!response.ok) throw new Error(`Typesense suggestions returned ${response.status}`);
      return searchSuggestions(query, await response.json() as TypesenseSearchResponse, limit);
    },

    async related(sourceId, rawLimit = 12) {
      const limit = Math.min(12, Math.max(1, rawLimit));
      const sourceResponse = await call(
        `${collectionPath(config.collection)}/documents/${encodeURIComponent(sourceId)}`,
        {},
        3_000,
      );
      if (!sourceResponse.ok) {
        if (sourceResponse.status === 404) return {
          requestId: "", items: [], facets: countedFacets([]),
          typeCounts: Object.fromEntries(SEARCH_ENTITY_TYPES.map((type) => [type, 0])) as AdvancedSearchResult["typeCounts"],
          nextCursor: null, hasMore: false, degraded: true,
        };
        throw new Error(`Typesense related source returned ${sourceResponse.status}`);
      }
      const source = await sourceResponse.json() as TypesenseCatalogDocument;
      const query = [
        source.title,
        source.pageType,
        source.productArea,
        ...source.componentNames.slice(0, 3),
        ...source.layoutPatterns.slice(0, 2),
      ].filter(Boolean).join(" ");
      const params = new URLSearchParams({
        q: query || source.app,
        query_by: searchableFields.join(","),
        query_by_weights: "8,6,4,1",
        facet_by: facetFields.join(","),
        exclude_fields: "embedding,searchText",
        max_facet_values: "100",
        filter_by: `id:!=\`${escapeFilter(sourceId)}\``,
        per_page: String(limit),
      });
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`, {}, 3_000);
      if (!response.ok) throw new Error(`Typesense related search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      const items = body.hits.flatMap(({ document }) => {
        const item = advancedResultItem(document, query);
        return item ? [item] : [];
      });
      const typeCounts = Object.fromEntries(
        SEARCH_ENTITY_TYPES.map((type) => [type, 0]),
      ) as AdvancedSearchResult["typeCounts"];
      for (const item of items) typeCounts[item.entityType] += 1;
      return {
        requestId: "",
        items,
        facets: countedFacets(body.facet_counts),
        typeCounts,
        nextCursor: null,
        hasMore: false,
        degraded: true,
      };
    },
  };
}
