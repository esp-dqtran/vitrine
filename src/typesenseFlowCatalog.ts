import type { FlowCatalogItem } from "./flowCatalogStore.ts";
import type { Platform } from "./platformFromUrl.ts";
import type { DiscoveryFacet } from "./vitrine/discoveryTypes.ts";

export const TYPESENSE_FLOW_CATALOG_COLLECTION = "vitrines_flows_v1";

export interface TypesenseFlowCatalogConfig {
  host: string;
  apiKey: string;
  collection: string;
}

export interface FlowCatalogIndexDocument {
  id: string;
  platform: Platform;
  appId: string;
  appName: string;
  title: string;
  category: string;
  categorySlug: string;
  type: string;
  typeKey: string;
  description: string;
  tags: string[];
  stepLabels: string[];
  searchText: string;
  versionId: number;
  card: string;
}

export interface FlowCatalogSearchOptions {
  query: string;
  platform: Platform;
  flowCategories?: readonly string[];
  flowTypes?: readonly string[];
  page?: number;
  limit?: number;
}

export interface FlowCatalogSearchResult {
  items: FlowCatalogItem[];
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
  hits: Array<{ document: FlowCatalogIndexDocument }>;
  facet_counts?: TypesenseFacetCount[];
}

const escapeFilter = (value: string) => value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
const equals = (field: string, value: string) => `${field}:=\`${escapeFilter(value)}\``;

export function flowCatalogTypesenseFilter(input: Pick<FlowCatalogSearchOptions, "platform" | "flowCategories" | "flowTypes">): string {
  const categories = [...new Set((input.flowCategories ?? []).map((value) => value.trim()).filter(Boolean))];
  const types = [...new Set((input.flowTypes ?? []).map((value) => value.trim()).filter(Boolean))];
  return [
    equals("platform", input.platform),
    ...(categories.length > 0 ? [`(${categories.map((value) => equals("categorySlug", value)).join(" || ")})`] : []),
    ...(types.length > 0 ? [`(${types.map((value) => equals("typeKey", value)).join(" || ")})`] : []),
  ].join(" && ");
}

function collectionPath(collection: string): string {
  return `/collections/${encodeURIComponent(collection)}`;
}

function aliasPath(alias: string): string {
  return `/aliases/${encodeURIComponent(alias)}`;
}

function flowCollectionSchema(name: string) {
  return {
    name,
    fields: [
      { name: "id", type: "string" },
      { name: "platform", type: "string", facet: true },
      { name: "appId", type: "string", facet: true },
      { name: "appName", type: "string" },
      { name: "title", type: "string" },
      { name: "category", type: "string", facet: true },
      { name: "categorySlug", type: "string", facet: true },
      { name: "type", type: "string" },
      { name: "typeKey", type: "string", facet: true },
      { name: "description", type: "string" },
      { name: "tags", type: "string[]", facet: true },
      { name: "stepLabels", type: "string[]" },
      { name: "searchText", type: "string" },
      { name: "versionId", type: "int64", sort: true },
      { name: "card", type: "string", index: false },
    ],
  };
}

function responseFacets(counts: TypesenseFacetCount[] | undefined): DiscoveryFacet[] {
  return (counts ?? []).flatMap(({ field_name, counts: values }) => field_name === "categorySlug"
    ? values.map(({ value, count }) => ({ group: "flowCategories", value, count }))
    : field_name === "typeKey"
      ? values.map(({ value, count }) => ({ group: "flowTypes", value, count }))
      : []);
}

export interface TypesenseFlowCatalogClient {
  index(documents: readonly FlowCatalogIndexDocument[]): Promise<number>;
  search(options: FlowCatalogSearchOptions): Promise<FlowCatalogSearchResult>;
}

export function createTypesenseFlowCatalogClient(
  config: TypesenseFlowCatalogConfig,
  request: typeof fetch = fetch,
): TypesenseFlowCatalogClient {
  const call = (path: string, init: RequestInit = {}) => request(`${config.host}${path}`, {
    ...init,
    headers: { "x-typesense-api-key": config.apiKey, ...init.headers },
  });

  return {
    async index(documents) {
      const next = `${config.collection}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const existing = await call(aliasPath(config.collection));
      if (!existing.ok && existing.status !== 404) throw new Error(`Typesense Flow alias check returned ${existing.status}`);
      const previous = existing.ok
        ? (await existing.json() as { collection_name: string }).collection_name
        : undefined;
      const created = await call("/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(flowCollectionSchema(next)),
      });
      if (!created.ok) throw new Error(`Typesense Flow collection creation returned ${created.status}`);
      const imported = await call(`${collectionPath(next)}/documents/import?action=upsert`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: documents.map((document) => JSON.stringify(document)).join("\n"),
      });
      if (!imported.ok) throw new Error(`Typesense Flow import returned ${imported.status}`);
      const rows = (await imported.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as { success?: boolean });
      if (rows.some(({ success }) => !success)) throw new Error("Typesense rejected one or more Flow documents");
      const switched = await call(aliasPath(config.collection), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection_name: next }),
      });
      if (!switched.ok) throw new Error(`Typesense Flow alias update returned ${switched.status}`);
      if (previous?.startsWith(`${config.collection}_`)) void call(collectionPath(previous), { method: "DELETE" });
      return rows.length;
    },
    async search(options) {
      const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
      const page = Math.max(options.page ?? 1, 1);
      const params = new URLSearchParams({
        q: options.query.trim(),
        query_by: "title,appName,category,type,tags,stepLabels,description,searchText",
        query_by_weights: "10,8,6,6,5,4,3,1",
        filter_by: flowCatalogTypesenseFilter(options),
        facet_by: "categorySlug,typeKey",
        sort_by: "_text_match:desc,versionId:desc",
        page: String(page),
        per_page: String(limit),
      });
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`);
      if (!response.ok) throw new Error(`Typesense Flow search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      return {
        items: body.hits.map(({ document }) => JSON.parse(document.card) as FlowCatalogItem),
        totalCount: body.found,
        nextPage: body.found > page * limit ? page + 1 : null,
        facets: responseFacets(body.facet_counts),
      };
    },
  };
}
