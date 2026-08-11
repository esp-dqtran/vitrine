import type { App } from "./vitrine/types.ts";
import type { DiscoveryFacet, DiscoveryFilter } from "./vitrine/discoveryTypes.ts";

export const TYPESENSE_APP_CATALOG_COLLECTION = "vitrines_apps_v1";

export interface TypesenseAppCatalogConfig {
  host: string;
  apiKey: string;
  collection: string;
}

export interface AppCatalogIndexDocument {
  id: string;
  appId: string;
  platform: "web" | "ios" | "android";
  title: string;
  searchText: string;
  categories: string[];
  latestAt: number;
  trendingScore: number;
  card: string;
}

export interface AppCatalogSearchOptions {
  query?: string;
  platform: "web" | "ios" | "android";
  filters: readonly DiscoveryFilter[];
  sort: "latest" | "trending";
  page?: number;
  limit?: number;
}

export interface AppCatalogSearchResult {
  apps: App[];
  totalCount: number;
  nextPage: number | null;
  facets: DiscoveryFacet[];
}

interface TypesenseFacetCount {
  field_name: string;
  counts: Array<{ count: number; value: string }>;
}

interface TypesenseSearchResponse {
  found: number;
  hits: Array<{ document: AppCatalogIndexDocument }>;
  facet_counts?: TypesenseFacetCount[];
}

const facetFieldByGroup: Record<string, keyof Pick<AppCatalogIndexDocument, "categories">> = {
  categories: "categories",
};

const escapeFilter = (value: string) => value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
const equals = (field: string, value: string) => `${field}:=\`${escapeFilter(value)}\``;

export function appCatalogTypesenseFilter(input: Pick<AppCatalogSearchOptions, "platform" | "filters">): string {
  const filters = [equals("platform", input.platform)];
  const grouped = new Map<string, string[]>();
  for (const filter of input.filters) {
    const field = facetFieldByGroup[filter.group];
    const value = filter.value.trim();
    if (!field || !value) continue;
    grouped.set(field, [...(grouped.get(field) ?? []), value]);
  }
  for (const [field, values] of grouped) {
    filters.push(`(${values.map((value) => equals(field, value)).join(" || ")})`);
  }
  return filters.join(" && ");
}

function collectionPath(collection: string): string {
  return `/collections/${encodeURIComponent(collection)}`;
}

function aliasPath(alias: string): string {
  return `/aliases/${encodeURIComponent(alias)}`;
}

function appCollectionSchema(name: string) {
  return {
    name,
    fields: [
      { name: "id", type: "string" },
      { name: "appId", type: "string", facet: true },
      { name: "platform", type: "string", facet: true },
      { name: "title", type: "string" },
      { name: "searchText", type: "string" },
      { name: "categories", type: "string[]", facet: true },
      { name: "latestAt", type: "int64", sort: true },
      { name: "trendingScore", type: "int32", sort: true },
      { name: "card", type: "string", index: false },
    ],
  };
}

function responseFacets(counts: TypesenseFacetCount[] | undefined): DiscoveryFacet[] {
  const groupByField: Record<string, string> = { categories: "categories" };
  return (counts ?? []).flatMap(({ field_name, counts: values }) => {
    const group = groupByField[field_name];
    return group ? values.map(({ value, count }) => ({ group, value, count })) : [];
  });
}

export interface TypesenseAppCatalogClient {
  index(documents: readonly AppCatalogIndexDocument[]): Promise<number>;
  upsert(document: AppCatalogIndexDocument): Promise<void>;
  search(options: AppCatalogSearchOptions): Promise<AppCatalogSearchResult>;
}

export function createTypesenseAppCatalogClient(
  config: TypesenseAppCatalogConfig,
  request: typeof fetch = fetch,
): TypesenseAppCatalogClient {
  const call = (path: string, init: RequestInit = {}) => request(`${config.host}${path}`, {
    ...init,
    headers: { "x-typesense-api-key": config.apiKey, ...init.headers },
  });

  return {
    async index(documents) {
      const next = `${config.collection}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const existing = await call(aliasPath(config.collection));
      if (!existing.ok && existing.status !== 404) throw new Error(`Typesense app alias check returned ${existing.status}`);
      const previous = existing.ok
        ? (await existing.json() as { collection_name: string }).collection_name
        : undefined;
      const created = await call("/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(appCollectionSchema(next)),
      });
      if (!created.ok) throw new Error(`Typesense app collection creation returned ${created.status}`);
      const imported = await call(`${collectionPath(next)}/documents/import?action=upsert`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: documents.map((document) => JSON.stringify(document)).join("\n"),
      });
      if (!imported.ok) throw new Error(`Typesense app import returned ${imported.status}`);
      const rows = (await imported.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as { success?: boolean });
      if (rows.some(({ success }) => !success)) throw new Error("Typesense rejected one or more app documents");
      const switched = await call(aliasPath(config.collection), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection_name: next }),
      });
      if (!switched.ok) throw new Error(`Typesense app alias update returned ${switched.status}`);
      if (previous?.startsWith(`${config.collection}_`)) void call(collectionPath(previous), { method: "DELETE" });
      return rows.length;
    },
    async upsert(document) {
      const response = await call(`${collectionPath(config.collection)}/documents?action=upsert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(document),
      });
      if (!response.ok) throw new Error(`Typesense app document upsert returned ${response.status}`);
    },
    async search(options) {
      const limit = Math.min(Math.max(options.limit ?? 24, 1), 24);
      const page = Math.max(options.page ?? 1, 1);
      const params = new URLSearchParams({
        q: options.query?.trim() || "*",
        query_by: "title,searchText",
        query_by_weights: "8,2",
        filter_by: appCatalogTypesenseFilter(options),
        facet_by: "categories",
        sort_by: options.sort === "trending"
          ? "trendingScore:desc,latestAt:desc,_text_match:desc"
          : "_text_match:desc,latestAt:desc",
        page: String(page),
        per_page: String(limit),
      });
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`);
      if (!response.ok) throw new Error(`Typesense app search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      return {
        apps: body.hits.map(({ document }) => JSON.parse(document.card) as App),
        totalCount: body.found,
        nextPage: body.found > page * limit ? page + 1 : null,
        facets: responseFacets(body.facet_counts),
      };
    },
  };
}
