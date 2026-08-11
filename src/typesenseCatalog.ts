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
}

interface TypesenseFacetCount {
  field_name: string;
  counts: Array<{ count: number; value: string }>;
}

interface TypesenseSearchResponse {
  hits: Array<{ document: TypesenseCatalogDocument }>;
  facet_counts?: TypesenseFacetCount[];
}

const searchableFields = ["title", "app", "description", "searchText"];
const facetFields = [
  "kind",
  "theme",
  "pageType",
  "productArea",
  "states",
  "layoutPatterns",
  "componentNames",
  "appCategories",
];

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
  return filters.join(" && ");
}

function emptyFacets(): CatalogSearchFacets {
  return {
    kinds: { app: 0, screen: 0, component: 0, token: 0, flow: 0, pattern: 0 },
    themes: [], pageTypes: [], productAreas: [], states: [], layouts: [], components: [], appCategories: [],
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
    }
  }
  return result;
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
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await request(`${config.host}${path}`, {
      ...init,
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
        sort_by: "_text_match:desc",
        per_page: String(Math.min(Math.max(options.limit ?? 50, 1), 100)),
      });
      const filter = typesenseFilter(options);
      if (filter) params.set("filter_by", filter);
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`);
      if (!response.ok) throw new Error(`Typesense search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      return {
        items: body.hits.map(({ document }) => resultItem(document)),
        facets: responseFacets(body.facet_counts),
      };
    },
  };
}
