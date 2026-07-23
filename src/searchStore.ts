import { createHash } from "node:crypto";
import type pg from "pg";
import {
  decodeSearchCursor,
  encodeSearchCursor,
  fuseSearchRanks,
  SEARCH_ENTITY_TYPES,
  type AdvancedSearchResult,
  type NormalizedSearchRequest,
  type SearchFacets,
  type SearchFilters,
  type SearchResultItem,
} from "./searchTypes.ts";

export interface SearchAccess {
  userId?: number;
  role?: string;
  plan?: string;
  publishedOnly: boolean;
  allowedAppIds?: number[];
}

export interface SearchSuggestion {
  kind: "app" | "title" | "alias" | "pageType" | "productArea" | "flow" | "component" | "layout";
  value: string;
  resultCount: number;
}

interface RankedCandidate {
  document_id: string;
  exact_boost?: number | string;
}

interface SearchDocumentRow {
  document_id: string;
  index_version: number;
  version_id: number;
  app_id: number;
  app_name: string;
  platform: string;
  entity_type: SearchResultItem["entityType"];
  source_id: string;
  title: string;
  description: string;
  aliases: string[];
  visible_text: string;
  page_type: string | null;
  product_area: string | null;
  flow_id: string | null;
  flow_name: string | null;
  flow_step_index: number | null;
  components: string[];
  states: string[];
  theme: SearchResultItem["theme"] | null;
  layout_patterns: string[];
  app_category: string | null;
  published_at: Date | string;
  captured_at: Date | string | null;
  media_image_id: number | null;
  source_payload: Record<string, unknown>;
}

const FILTER_COLUMNS: Record<keyof SearchFilters, {
  expression: string;
  array?: boolean;
}> = {
  platform: { expression: "d.platform" },
  app: { expression: "d.app_name" },
  appCategory: { expression: "d.app_category" },
  pageType: { expression: "d.page_type" },
  productArea: { expression: "d.product_area" },
  flow: { expression: "d.flow_name" },
  component: { expression: "d.components", array: true },
  state: { expression: "d.states", array: true },
  theme: { expression: "d.theme" },
  layout: { expression: "d.layout_patterns", array: true },
};

class SqlParameters {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

function authorizedWhere(
  parameters: SqlParameters,
  request: NormalizedSearchRequest,
  access: SearchAccess,
  omittedFilter?: keyof SearchFilters,
): string {
  const clauses = [`d.index_version = ${parameters.add(1)}`];
  if (request.type !== "all") {
    clauses.push(`d.entity_type = ${parameters.add(request.type)}`);
  }
  if (access.publishedOnly) {
    clauses.push(
      "EXISTS (SELECT 1 FROM app_versions av WHERE av.id = d.version_id AND av.status = 'published')",
    );
  }
  if (access.allowedAppIds) {
    clauses.push(`d.app_id = ANY(${parameters.add(access.allowedAppIds)}::integer[])`);
  }
  for (const [key, config] of Object.entries(FILTER_COLUMNS) as Array<
    [keyof SearchFilters, typeof FILTER_COLUMNS[keyof SearchFilters]]
  >) {
    if (key === omittedFilter || request.filters[key].length === 0) continue;
    const value = parameters.add(request.filters[key]);
    clauses.push(config.array
      ? `${config.expression} && ${value}::text[]`
      : `${config.expression} = ANY(${value}::text[])`);
  }
  return clauses.join(" AND ");
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function rowToItem(row: SearchDocumentRow, query: string): SearchResultItem {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const contexts: SearchResultItem["matchedContext"] = [];
  const addContext = (
    kind: SearchResultItem["matchedContext"][number]["kind"],
    values: Array<string | null | undefined>,
  ) => {
    const value = values.find((candidate) =>
      candidate && terms.some((term) => candidate.toLocaleLowerCase().includes(term)));
    if (value && !contexts.some((context) => context.kind === kind && context.value === value)) {
      contexts.push({ kind, value });
    }
  };
  addContext("text", [row.visible_text, row.description]);
  addContext("component", row.components);
  addContext("flow", [row.flow_name]);
  addContext("productArea", [row.product_area]);
  return {
    documentId: row.document_id,
    indexVersion: 1,
    versionId: row.version_id,
    appId: row.app_id,
    appName: row.app_name,
    platform: row.platform,
    entityType: row.entity_type,
    sourceId: row.source_id,
    title: row.title,
    description: row.description,
    aliases: row.aliases,
    visibleText: row.visible_text,
    ...(row.page_type ? { pageType: row.page_type } : {}),
    ...(row.product_area ? { productArea: row.product_area } : {}),
    ...(row.flow_id ? { flowId: row.flow_id } : {}),
    ...(row.flow_name ? { flowName: row.flow_name } : {}),
    ...(row.flow_step_index !== null ? { flowStepIndex: row.flow_step_index } : {}),
    components: row.components,
    states: row.states,
    ...(row.theme ? { theme: row.theme } : {}),
    layoutPatterns: row.layout_patterns,
    ...(row.app_category ? { appCategory: row.app_category } : {}),
    publishedAt: iso(row.published_at),
    ...(row.captured_at ? { capturedAt: iso(row.captured_at) } : {}),
    ...(row.media_image_id !== null ? { mediaImageId: row.media_image_id } : {}),
    sourcePayload: row.source_payload,
    matchedContext: contexts,
  };
}

function requestFingerprint(request: NormalizedSearchRequest): string {
  const { cursor: _cursor, limit: _limit, ...state } = request;
  return createHash("sha256").update(JSON.stringify(state)).digest("base64url");
}

export class PostgresSearchStore {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async search(
    request: NormalizedSearchRequest,
    queryVector: number[] | undefined,
    access: SearchAccess,
  ): Promise<AdvancedSearchResult> {
    const fingerprint = requestFingerprint(request);
    if (request.cursor) {
      let cursor;
      try {
        cursor = decodeSearchCursor(request.cursor);
      } catch {
        throw new Error("invalid search cursor");
      }
      if (
        cursor.fingerprint !== fingerprint
        || cursor.indexVersion !== 1
        || cursor.sort !== request.sort
      ) {
        throw new Error("search cursor does not match request");
      }
    }

    const keywordParameters = new SqlParameters();
    const keywordWhere = authorizedWhere(keywordParameters, request, access);
    const query = keywordParameters.add(request.query);
    const prefix = keywordParameters.add(`${request.query}%`);
    const contains = keywordParameters.add(`%${request.query}%`);
    const keyword = await this.pool.query<RankedCandidate>(
      `SELECT d.document_id,
         ts_rank_cd(d.search_vector, websearch_to_tsquery('english', ${query})) AS text_rank,
         CASE
           WHEN lower(d.title) = lower(${query}) THEN 4
           WHEN lower(d.app_name) = lower(${query}) THEN 4
           WHEN EXISTS (
             SELECT 1 FROM unnest(d.aliases) alias WHERE lower(alias) = lower(${query})
           ) THEN 3
           WHEN d.title ILIKE ${prefix} THEN 2
           ELSE 0
         END AS exact_boost
       FROM search_documents d
       WHERE ${keywordWhere}
         AND (${query} = '' OR d.search_vector @@ websearch_to_tsquery('english', ${query})
           OR d.title ILIKE ${contains} OR d.app_name ILIKE ${contains})
       ORDER BY exact_boost DESC, text_rank DESC, d.document_id
       LIMIT 240`,
      keywordParameters.values,
    );

    let semantic: RankedCandidate[] = [];
    if (queryVector) {
      const vectorParameters = new SqlParameters();
      const vectorWhere = authorizedWhere(vectorParameters, request, access);
      const vector = vectorParameters.add(vectorLiteral(queryVector));
      semantic = (await this.pool.query<RankedCandidate>(
        `SELECT d.document_id, 1 - (d.embedding <=> ${vector}::vector) AS semantic_rank
         FROM search_documents d
         WHERE ${vectorWhere} AND d.embedding IS NOT NULL
         ORDER BY d.embedding <=> ${vector}::vector, d.document_id
         LIMIT 240`,
        vectorParameters.values,
      )).rows;
    }

    const fused = fuseSearchRanks([
      keyword.rows.map(({ document_id }) => document_id),
      semantic.map(({ document_id }) => document_id),
    ]);
    const exactBoosts = new Map(keyword.rows.map((row) => [
      row.document_id,
      Number(row.exact_boost ?? 0),
    ]));
    const ranked = fused.map((item) => ({
      ...item,
      score: item.score + (exactBoosts.get(item.documentId) ?? 0),
    }));
    const ids = ranked.map(({ documentId }) => documentId);
    const rows = ids.length
      ? await this.pool.query<SearchDocumentRow>(
        "SELECT * FROM search_documents WHERE index_version = 1 AND document_id = ANY($1::text[])",
        [ids],
      )
      : { rows: [] as SearchDocumentRow[] };
    const byId = new Map(rows.rows.map((row) => [row.document_id, row]));
    let ordered = ranked
      .flatMap(({ documentId, score }) => {
        const row = byId.get(documentId);
        return row ? [{ item: rowToItem(row, request.query), score }] : [];
      });

    if (request.sort === "recent") {
      ordered.sort((left, right) =>
        right.item.publishedAt.localeCompare(left.item.publishedAt)
        || left.item.documentId.localeCompare(right.item.documentId));
    } else if (request.sort === "app-az") {
      ordered.sort((left, right) =>
        left.item.appName.localeCompare(right.item.appName)
        || left.item.title.localeCompare(right.item.title)
        || left.item.documentId.localeCompare(right.item.documentId));
    } else {
      ordered.sort((left, right) =>
        right.score - left.score || left.item.documentId.localeCompare(right.item.documentId));
    }

    if (request.cursor) {
      const cursor = decodeSearchCursor(request.cursor);
      const cursorDocumentId = String(cursor.values.at(-1));
      const position = ordered.findIndex(({ item }) => item.documentId === cursorDocumentId);
      if (position < 0) throw new Error("search cursor is no longer available");
      ordered = ordered.slice(position + 1);
    }
    const page = ordered.slice(0, request.limit + 1);
    const hasMore = page.length > request.limit;
    const selected = page.slice(0, request.limit);
    const last = selected.at(-1);
    const cursorValues = last
      ? request.sort === "relevance"
        ? [last.score, last.item.documentId]
        : request.sort === "recent"
          ? [last.item.publishedAt, last.item.documentId]
          : [last.item.appName, last.item.title, last.item.documentId]
      : [];

    const [facets, typeCounts] = await Promise.all([
      this.facets(request, access),
      this.typeCounts(request, access),
    ]);
    return {
      requestId: "",
      items: selected.map(({ item }) => item),
      facets,
      typeCounts,
      nextCursor: hasMore && last
        ? encodeSearchCursor({
          fingerprint,
          indexVersion: 1,
          sort: request.sort,
          values: cursorValues,
        })
        : null,
      hasMore,
      degraded: !!request.query && !queryVector,
    };
  }

  private async facets(
    request: NormalizedSearchRequest,
    access: SearchAccess,
  ): Promise<SearchFacets> {
    const entries = await Promise.all(
      (Object.keys(FILTER_COLUMNS) as Array<keyof SearchFilters>).map(async (key) => {
        const parameters = new SqlParameters();
        const where = authorizedWhere(parameters, request, access, key);
        const config = FILTER_COLUMNS[key];
        const valueExpression = config.array
          ? `unnest(${config.expression})`
          : config.expression;
        const limit = key === "app" ? 100 : 50;
        const result = await this.pool.query<{ value: string; count: number }>(
          `SELECT ${valueExpression} AS value, count(DISTINCT d.document_id)::integer AS count
           FROM search_documents d
           WHERE ${where} AND ${config.expression} IS NOT NULL
           GROUP BY value
           HAVING count(DISTINCT d.document_id) > 0
           ORDER BY count DESC, value ASC
           LIMIT ${limit}`,
          parameters.values,
        );
        return [key, result.rows] as const;
      }),
    );
    return Object.fromEntries(entries) as SearchFacets;
  }

  private async typeCounts(
    request: NormalizedSearchRequest,
    access: SearchAccess,
  ): Promise<AdvancedSearchResult["typeCounts"]> {
    const parameters = new SqlParameters();
    const where = authorizedWhere(parameters, request, access);
    const result = await this.pool.query<{ entity_type: SearchResultItem["entityType"]; count: number }>(
      `SELECT d.entity_type, count(*)::integer AS count
       FROM search_documents d WHERE ${where} GROUP BY d.entity_type`,
      parameters.values,
    );
    const counts = Object.fromEntries(
      SEARCH_ENTITY_TYPES.map((type) => [type, 0]),
    ) as AdvancedSearchResult["typeCounts"];
    for (const row of result.rows) counts[row.entity_type] = row.count;
    return counts;
  }

  async suggest(
    prefix: string,
    access: SearchAccess,
    limit = 10,
  ): Promise<SearchSuggestion[]> {
    const request: NormalizedSearchRequest = {
      query: "",
      type: "all",
      filters: {
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
      },
      sort: "relevance",
      limit: 1,
    };
    const parameters = new SqlParameters();
    const where = authorizedWhere(parameters, request, access);
    const pattern = parameters.add(`${prefix}%`);
    const cappedLimit = Math.min(10, Math.max(1, limit));
    const result = await this.pool.query<{
      kind: SearchSuggestion["kind"];
      value: string;
      result_count: number;
    }>(
      `WITH authorized AS (
         SELECT d.* FROM search_documents d WHERE ${where}
       ), suggestions AS (
         SELECT 'app'::text AS kind, app_name AS value, document_id FROM authorized
         UNION ALL SELECT 'title', title, document_id FROM authorized
         UNION ALL SELECT 'alias', unnest(aliases), document_id FROM authorized
         UNION ALL SELECT 'pageType', page_type, document_id FROM authorized
         UNION ALL SELECT 'productArea', product_area, document_id FROM authorized
         UNION ALL SELECT 'flow', flow_name, document_id FROM authorized
         UNION ALL SELECT 'component', unnest(components), document_id FROM authorized
         UNION ALL SELECT 'layout', unnest(layout_patterns), document_id FROM authorized
       )
       SELECT kind, value, count(DISTINCT document_id)::integer AS result_count
       FROM suggestions
       WHERE value IS NOT NULL AND value ILIKE ${pattern}
       GROUP BY kind, value
       ORDER BY result_count DESC, value ASC
       LIMIT ${cappedLimit}`,
      parameters.values,
    );
    return result.rows.map(({ kind, value, result_count }) => ({
      kind,
      value,
      resultCount: result_count,
    }));
  }

  async related(
    sourceId: string,
    access: SearchAccess,
    limit = 12,
  ): Promise<AdvancedSearchResult> {
    const request = {
      query: "",
      type: "all" as const,
      filters: {
        platform: [], app: [], appCategory: [], pageType: [], productArea: [],
        flow: [], component: [], state: [], theme: [], layout: [],
      },
      sort: "relevance" as const,
      limit: Math.min(12, Math.max(1, limit + 1)),
    };
    const parameters = new SqlParameters();
    const where = authorizedWhere(parameters, request, access);
    const source = parameters.add(sourceId);
    const row = await this.pool.query<{
      title: string;
      app_name: string;
      product_area: string | null;
      flow_name: string | null;
      components: string[];
      layout_patterns: string[];
    }>(
      `SELECT d.title, d.app_name, d.product_area, d.flow_name, d.components, d.layout_patterns
       FROM search_documents d WHERE ${where} AND d.source_id = ${source} LIMIT 1`,
      parameters.values,
    );
    if (!row.rows[0]) throw new Error("related search source is unavailable");
    const metadata = row.rows[0];
    const result = await this.search({
      ...request,
      query: [
        metadata.title,
        metadata.app_name,
        metadata.product_area,
        metadata.flow_name,
        ...metadata.components,
        ...metadata.layout_patterns,
      ].filter(Boolean).join(" "),
    }, undefined, access);
    result.items = result.items.filter((item) => item.sourceId !== sourceId).slice(0, limit);
    result.hasMore = false;
    result.nextCursor = null;
    return result;
  }
}
