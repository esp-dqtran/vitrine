import { query as databaseQuery } from "./db.ts";
import {
  flowCatalogItemFromRow,
  flowCatalogSearchTerms,
  minimumFlowCatalogTermMatches,
  normalizeFlowCatalogText,
  type FlowCatalogItem,
  type FlowCatalogQuery,
} from "./flowCatalogStore.ts";
import type { Platform } from "./platformFromUrl.ts";

export interface PublishedFlowInstanceSearchInput {
  platform: Platform;
  query: string;
  limit?: number;
  now?: () => Date;
  cache?: FlowInstanceSearchCache;
}

const defaultQuery: FlowCatalogQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

interface CacheEntry {
  expiresAt: number;
  value: FlowCatalogItem[];
}

export class FlowInstanceSearchCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #maxEntries: number;
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(input: { maxEntries?: number; ttlMs?: number; now?: () => number } = {}) {
    this.#maxEntries = Math.max(1, Math.trunc(input.maxEntries ?? 256));
    this.#ttlMs = Math.max(1, Math.trunc(input.ttlMs ?? 300_000));
    this.#now = input.now ?? Date.now;
  }

  get size(): number {
    this.#prune();
    return this.#entries.size;
  }

  get(key: string): FlowCatalogItem[] | undefined {
    const entry = this.#entries.get(key);
    if (!entry || entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: FlowCatalogItem[]): void {
    this.#prune();
    this.#entries.delete(key);
    this.#entries.set(key, { expiresAt: this.#now() + this.#ttlMs, value });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  #prune(): void {
    const now = this.#now();
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
  }
}

const defaultCache = new FlowInstanceSearchCache();

export async function searchPublishedFlowInstances(
  input: PublishedFlowInstanceSearchInput,
  runQuery: FlowCatalogQuery = defaultQuery,
): Promise<FlowCatalogItem[]> {
  const search = normalizeFlowCatalogText(input.query).slice(0, 120);
  if (!search) return [];
  const searchTerms = flowCatalogSearchTerms(search);
  const minimumTermMatches = minimumFlowCatalogTermMatches(searchTerms.length);
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 40), 1), 100);
  const cache = input.cache ?? (runQuery === defaultQuery ? defaultCache : undefined);
  const cacheKey = `${input.platform}\0${search}\0${limit}`;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const snapshotAt = (input.now ?? (() => new Date()))().toISOString();
  const titleKey = "canonical.normalized_name";
  const parentKey = "COALESCE(parent.normalized_name, 'other flows')";
  const titleTermMatch = `(CASE
    WHEN left(search_term.term, 1) = ' ' THEN ${titleKey} ~
      ('(^|[^[:alnum:]])' || btrim(search_term.term) || '([^[:alnum:]]|$)')
    ELSE ${titleKey} LIKE '%' || search_term.term || '%'
  END)`;
  const parentTermMatch = `(CASE
    WHEN left(search_term.term, 1) = ' ' THEN ${parentKey} ~
      ('(^|[^[:alnum:]])' || btrim(search_term.term) || '([^[:alnum:]]|$)')
    ELSE ${parentKey} LIKE '%' || search_term.term || '%'
  END)`;

  const result = await runQuery(
    `WITH latest AS MATERIALIZED (
       SELECT DISTINCT ON (av.app_id)
         av.id AS version_id, av.app_id, av.version_number
       FROM app_versions av
       WHERE av.platform = $1
         AND av.published_at IS NOT NULL
         AND av.published_at <= $2::timestamptz
       ORDER BY av.app_id, av.published_at DESC, av.version_number DESC, av.id DESC
     ), exact_flow_matches AS MATERIALIZED (
       SELECT exact.id
       FROM flows exact
       WHERE exact.normalized_name = $3
         AND exact.created_at <= $2::timestamptz
     ), relevant_flows AS MATERIALIZED (
       SELECT
         canonical.id AS flow_id,
         COALESCE(taxonomy.category_id, parent.id, 0)::bigint AS category_id,
         COALESCE(taxonomy.category, parent.name, 'Other Flows') AS category,
         COALESCE(taxonomy.category_key, parent.normalized_name, 'other flows') AS category_key,
         COALESCE(taxonomy.flow_type, 'Other content detail') AS flow_type,
         COALESCE(taxonomy.flow_type_key, 'content-detail/other-content-detail') AS flow_type_key,
         canonical.name AS title,
         canonical.normalized_name AS title_key,
         relevance.exact_match,
         relevance.title_term_matches,
         relevance.term_matches
       FROM flows canonical
       LEFT JOIN flows parent ON parent.id = canonical.parent_id
       LEFT JOIN LATERAL (
         SELECT
           category.id AS category_id,
           category.name AS category,
           category.slug AS category_key,
           flow_type.name AS flow_type,
           category.slug || '/' || flow_type.slug AS flow_type_key
         FROM flow_classifications classification
         JOIN flow_types flow_type ON flow_type.id = classification.flow_type_id
         JOIN flow_categories category ON category.id = flow_type.category_id
         WHERE classification.flow_id = canonical.id
           AND classification.status = 'approved'
         ORDER BY classification.flow_id
         LIMIT 1
       ) taxonomy ON true
       CROSS JOIN LATERAL (
         SELECT
           CASE WHEN canonical.normalized_name = $3
             THEN 2 WHEN (
               canonical.normalized_name LIKE '%' || $3 || '%'
               OR ${parentKey} LIKE '%' || $3 || '%'
             ) THEN 1 ELSE 0 END::int AS exact_match,
           COUNT(*) FILTER (WHERE ${titleTermMatch})::int AS title_term_matches,
           COUNT(*) FILTER (WHERE ${titleTermMatch} OR ${parentTermMatch})::int AS term_matches
         FROM unnest($4::text[]) AS search_term(term)
       ) relevance
       WHERE canonical.created_at <= $2::timestamptz
         AND (parent.id IS NULL OR parent.created_at <= $2::timestamptz)
         AND (
           canonical.id IN (SELECT id FROM exact_flow_matches)
           OR (
             NOT EXISTS (SELECT 1 FROM exact_flow_matches)
             AND (relevance.exact_match > 0 OR relevance.term_matches >= $5::int)
           )
         )
     ), instance_candidates AS (
       SELECT
         relevant.*,
         latest.version_id,
         latest.version_number,
         app.name AS app,
         COALESCE(app.display_name, initcap(replace(app.name, '-', ' '))) AS app_name,
         app.icon_url AS app_icon_url,
         app_flow.id AS version_flow_id,
         app_flow.source_flow_id,
         app_flow.description,
         app_flow.tags,
         app_flow.steps,
         jsonb_array_length(app_flow.steps)::int AS evidence_count
       FROM relevant_flows relevant
       JOIN app_flow_version_mappings mapping ON mapping.flow_id = relevant.flow_id
       JOIN app_flow_versions app_flow ON app_flow.id = mapping.app_flow_version_id
       JOIN latest ON latest.version_id = app_flow.version_id
       JOIN apps app ON app.id = latest.app_id
     ), ranked_instances AS (
       SELECT
         candidate.*,
         ROW_NUMBER() OVER (
           PARTITION BY candidate.app, candidate.title_key
           ORDER BY candidate.evidence_count DESC, candidate.version_flow_id
         ) AS instance_rank
       FROM instance_candidates candidate
     )
     SELECT *
     FROM ranked_instances
     WHERE instance_rank = 1
     ORDER BY
       exact_match DESC,
       title_term_matches DESC,
       term_matches DESC,
       evidence_count DESC,
       lower(app),
       version_flow_id
     LIMIT $6::int`,
    [input.platform, snapshotAt, search, searchTerms, minimumTermMatches, limit],
  );

  const items = result.rows.map((row) => flowCatalogItemFromRow(row, input.platform));
  cache?.set(cacheKey, items);
  return items;
}
