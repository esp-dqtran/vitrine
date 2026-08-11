import type { DiscoveryFacet, DiscoveryFilter } from "./vitrine/discoveryTypes.ts";
import type { SiteSummary } from "./sitesStore.ts";

export const TYPESENSE_SITE_CATALOG_COLLECTION = "vitrines_sites_v1";

export interface TypesenseSiteCatalogConfig {
  host: string;
  apiKey: string;
  collection: string;
}

export interface SiteCatalogIndexDocument {
  id: string;
  siteId: number;
  versionId: number;
  title: string;
  sourceUrl: string;
  searchText: string;
  categories: string[];
  sections: string[];
  styles: string[];
  technologies: string[];
  motion: string[];
  latestAt: number;
  popularity: number;
  card: string;
}

export interface SiteCatalogSearchOptions {
  query?: string;
  filters: readonly DiscoveryFilter[];
  sort: "latest" | "popular";
  page?: number;
  limit?: number;
}

export interface SiteCatalogSearchResult {
  sites: SiteSummary[];
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
  hits: Array<{ document: SiteCatalogIndexDocument }>;
  facet_counts?: TypesenseFacetCount[];
}

const facetFieldByGroup: Record<string, keyof Pick<SiteCatalogIndexDocument, "categories" | "sections" | "styles">> = {
  categories: "categories",
  sections: "sections",
  styles: "styles",
};

const escapeFilter = (value: string) => value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
const equals = (field: string, value: string) => `${field}:=\`${escapeFilter(value)}\``;

export function siteCatalogTypesenseFilter(
  input: Pick<SiteCatalogSearchOptions, "filters">,
): string {
  const grouped = new Map<string, string[]>();
  for (const filter of input.filters) {
    const field = facetFieldByGroup[filter.group];
    const value = filter.value.trim();
    if (!field || !value) continue;
    grouped.set(field, [...(grouped.get(field) ?? []), value]);
  }
  return [...grouped].map(([field, values]) => (
    `(${values.map((value) => equals(field, value)).join(" || ")})`
  )).join(" && ");
}

function collectionPath(collection: string): string {
  return `/collections/${encodeURIComponent(collection)}`;
}

function aliasPath(alias: string): string {
  return `/aliases/${encodeURIComponent(alias)}`;
}

function siteCollectionSchema(name: string) {
  return {
    name,
    fields: [
      { name: "id", type: "string" },
      { name: "siteId", type: "int64", facet: true },
      { name: "versionId", type: "int64" },
      { name: "title", type: "string" },
      { name: "sourceUrl", type: "string" },
      { name: "searchText", type: "string" },
      { name: "categories", type: "string[]", facet: true },
      { name: "sections", type: "string[]", facet: true },
      { name: "styles", type: "string[]", facet: true },
      { name: "technologies", type: "string[]", facet: true },
      { name: "motion", type: "string[]", facet: true },
      { name: "latestAt", type: "int64", sort: true },
      { name: "popularity", type: "int32", sort: true },
      { name: "card", type: "string", index: false },
    ],
  };
}

function responseFacets(counts: TypesenseFacetCount[] | undefined): DiscoveryFacet[] {
  const groupByField: Record<string, "categories" | "sections" | "styles"> = {
    categories: "categories",
    sections: "sections",
    styles: "styles",
  };
  return (counts ?? []).flatMap(({ field_name, counts: values }) => {
    const group = groupByField[field_name];
    return group ? values.map(({ value, count }) => ({ group, value, count })) : [];
  });
}

export interface TypesenseSiteCatalogClient {
  index(documents: readonly SiteCatalogIndexDocument[]): Promise<number>;
  upsert(document: SiteCatalogIndexDocument): Promise<void>;
  search(options: SiteCatalogSearchOptions): Promise<SiteCatalogSearchResult>;
}

export function createTypesenseSiteCatalogClient(
  config: TypesenseSiteCatalogConfig,
  request: typeof fetch = fetch,
): TypesenseSiteCatalogClient {
  const call = (path: string, init: RequestInit = {}) => request(`${config.host}${path}`, {
    ...init,
    headers: { "x-typesense-api-key": config.apiKey, ...init.headers },
  });

  return {
    async index(documents) {
      const next = `${config.collection}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const existing = await call(aliasPath(config.collection));
      if (!existing.ok && existing.status !== 404) throw new Error(`Typesense Site alias check returned ${existing.status}`);
      const previous = existing.ok
        ? (await existing.json() as { collection_name: string }).collection_name
        : undefined;
      const created = await call("/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(siteCollectionSchema(next)),
      });
      if (!created.ok) throw new Error(`Typesense Site collection creation returned ${created.status}`);
      const imported = await call(`${collectionPath(next)}/documents/import?action=upsert`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: documents.map((document) => JSON.stringify(document)).join("\n"),
      });
      if (!imported.ok) throw new Error(`Typesense Site import returned ${imported.status}`);
      const rows = (await imported.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as { success?: boolean });
      if (rows.some(({ success }) => !success)) throw new Error("Typesense rejected one or more Site documents");
      const switched = await call(aliasPath(config.collection), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection_name: next }),
      });
      if (!switched.ok) throw new Error(`Typesense Site alias update returned ${switched.status}`);
      if (previous?.startsWith(`${config.collection}_`)) void call(collectionPath(previous), { method: "DELETE" });
      return rows.length;
    },
    async upsert(document) {
      const response = await call(`${collectionPath(config.collection)}/documents?action=upsert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(document),
      });
      if (!response.ok) throw new Error(`Typesense Site document upsert returned ${response.status}`);
    },
    async search(options) {
      const limit = Math.min(Math.max(options.limit ?? 24, 1), 48);
      const page = Math.max(options.page ?? 1, 1);
      const filter = siteCatalogTypesenseFilter(options);
      const params = new URLSearchParams({
        q: options.query?.trim() || "*",
        query_by: "title,sourceUrl,searchText,technologies,motion",
        query_by_weights: "8,6,3,4,3",
        ...(filter ? { filter_by: filter } : {}),
        facet_by: "categories,sections,styles",
        sort_by: options.sort === "popular"
          ? "popularity:desc,latestAt:desc,_text_match:desc"
          : "_text_match:desc,latestAt:desc",
        page: String(page),
        per_page: String(limit),
      });
      const response = await call(`${collectionPath(config.collection)}/documents/search?${params}`);
      if (!response.ok) throw new Error(`Typesense Site search returned ${response.status}`);
      const body = await response.json() as TypesenseSearchResponse;
      return {
        sites: body.hits.map(({ document }) => JSON.parse(document.card) as SiteSummary),
        totalCount: body.found,
        nextPage: body.found > page * limit ? page + 1 : null,
        facets: responseFacets(body.facet_counts),
      };
    },
  };
}
