import type { QueryResult } from "pg";
import { query as databaseQuery } from "./db.ts";
import type { DesignFlow, EvidenceView } from "./designSystem.ts";
import {
  decodeFlowCatalogCursor,
  encodeFlowCatalogCursor,
  flowCatalogQueryIdentity,
  FlowCatalogCursorError,
  type FlowCatalogCursor,
  type FlowCatalogSort,
} from "./flowCatalogCursor.ts";
import type { Platform } from "./platformFromUrl.ts";
import type { DiscoveryFacet } from "./vitrine/discoveryTypes.ts";

export { FlowCatalogCursorError } from "./flowCatalogCursor.ts";

export interface FlowCatalogItem {
  category: string;
  type?: string;
  title: string;
  preview: {
    appId: string;
    appName: string;
    appIconUrl: string | null;
    versionId: number;
    version: number;
    sourceFlowId: string;
    screenCount: number;
    flow: DesignFlow<EvidenceView>;
  };
}

export interface FlowCatalogPage {
  items: FlowCatalogItem[];
  nextCursor: string | null;
  totalCount: number;
  facets: DiscoveryFacet[];
}

export type FlowCatalogQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

interface FacetMetadata {
  totalCount: number;
  facets: DiscoveryFacet[];
}

interface FacetCacheEntry {
  expiresAt: number;
  value: FacetMetadata;
}

interface PageCacheEntry {
  expiresAt: number;
  staleExpiresAt: number;
  value: FlowCatalogPage;
}

export class FlowCatalogPageCache {
  readonly #entries = new Map<string, PageCacheEntry>();
  readonly #loads = new Map<string, Promise<FlowCatalogPage>>();
  readonly #maxEntries: number;
  readonly #staleTtlMs: number;
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(input: {
    maxEntries?: number;
    staleTtlMs?: number;
    ttlMs?: number;
    now?: () => number;
  } = {}) {
    this.#maxEntries = Math.max(1, Math.trunc(input.maxEntries ?? 128));
    this.#ttlMs = Math.max(1, Math.trunc(input.ttlMs ?? 300_000));
    this.#staleTtlMs = Math.max(
      this.#ttlMs,
      Math.trunc(input.staleTtlMs ?? 1_800_000),
    );
    this.#now = input.now ?? Date.now;
  }

  get size(): number {
    this.#prune();
    return this.#entries.size;
  }

  get(key: string): FlowCatalogPage | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.#now()) {
      return undefined;
    }
    this.#touch(key, entry);
    return entry.value;
  }

  getStale(key: string): FlowCatalogPage | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.staleExpiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#touch(key, entry);
    return entry.value;
  }

  load(
    key: string,
    loader: () => Promise<FlowCatalogPage>,
  ): Promise<FlowCatalogPage> {
    const pending = this.#loads.get(key);
    if (pending) return pending;
    const operation = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.#loads.delete(key);
      });
    this.#loads.set(key, operation);
    return operation;
  }

  #touch(key: string, entry: PageCacheEntry): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
  }

  set(key: string, value: FlowCatalogPage): void {
    this.#prune();
    this.#entries.delete(key);
    this.#entries.set(key, {
      expiresAt: this.#now() + this.#ttlMs,
      staleExpiresAt: this.#now() + this.#staleTtlMs,
      value,
    });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  #prune(): void {
    const now = this.#now();
    for (const [key, entry] of this.#entries) {
      if (entry.staleExpiresAt <= now) this.#entries.delete(key);
    }
  }
}

export class FlowCatalogFacetCache {
  readonly #entries = new Map<string, FacetCacheEntry>();
  readonly #maxEntries: number;
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(input: {
    maxEntries?: number;
    ttlMs?: number;
    now?: () => number;
  } = {}) {
    this.#maxEntries = Math.max(1, Math.trunc(input.maxEntries ?? 128));
    this.#ttlMs = Math.max(1, Math.trunc(input.ttlMs ?? 300_000));
    this.#now = input.now ?? Date.now;
  }

  get size(): number {
    this.#prune();
    return this.#entries.size;
  }

  get(key: string): FacetMetadata | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: FacetMetadata): void {
    this.#prune();
    this.#entries.delete(key);
    this.#entries.set(key, {
      expiresAt: this.#now() + this.#ttlMs,
      value,
    });
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

const query: FlowCatalogQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);
const defaultFacetCache = new FlowCatalogFacetCache();
const defaultPageCache = new FlowCatalogPageCache();
function pageLimit(requested = 80): number {
  if (!Number.isFinite(requested)) return 80;
  return Math.min(Math.max(Math.trunc(requested), 1), 100);
}

export function normalizeFlowCatalogText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replaceAll("&", " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FLOW_SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "into", "my",
  "of", "on", "or", "the", "to", "up", "via", "with",
]);

function flowSearchStem(token: string): string {
  let stem = token;
  if (stem.length > 5 && stem.endsWith("ing")) {
    stem = stem.slice(0, -3);
  } else if (stem.length > 4 && stem.endsWith("ies")) {
    stem = `${stem.slice(0, -3)}y`;
  } else if (stem.length > 4 && stem.endsWith("tion")) {
    stem = stem.slice(0, -3);
  } else if (stem.length > 4 && stem.endsWith("ed")) {
    stem = stem.slice(0, -2);
  } else if (stem.length > 4 && stem.endsWith("s")) {
    stem = stem.slice(0, -1);
  }
  if (stem.length > 4 && stem.endsWith("e")) stem = stem.slice(0, -1);
  return stem;
}

function normalizeStoredFlowTaxonomyKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function flowCatalogSearchTerms(value: string): string[] {
  const normalized = normalizeFlowCatalogText(value);
  if (!normalized) return [];
  const tokens = normalized.split(" ");
  const terms: string[] = [];
  for (const [index, token] of tokens.entries()) {
    const previous = flowSearchStem(tokens[index - 1] ?? "");
    if (
      (token === "in" || token === "up")
      && (previous === "log" || previous === "sign" || previous === "set")
    ) {
      terms.push(` ${token}`);
      continue;
    }
    if (token.length < 3 || FLOW_SEARCH_STOP_WORDS.has(token)) continue;
    const stem = flowSearchStem(token);
    if (stem.length >= 3) terms.push(stem);
  }
  return [...new Set(terms.length > 0 ? terms : [normalized])].slice(0, 12);
}

export function minimumFlowCatalogTermMatches(termCount: number): number {
  if (termCount <= 0) return 0;
  return Math.max(1, Math.ceil(termCount * 0.65));
}

function normalizedCategories(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? [])
    .map(normalizeStoredFlowTaxonomyKey)
    .filter(Boolean))]
    .sort();
}

function normalizedTypes(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? [])
    .map((value) => value.trim().toLocaleLowerCase("en-US"))
    .filter(Boolean))]
    .sort();
}

function commonCtes(): string {
  const parentName = "COALESCE(parent.name, 'Other Flows')";
  const parentKey = "COALESCE(parent.normalized_name, 'other flows')";
  const categoryName = "COALESCE(classified_category.name, " + parentName + ")";
  const categoryKey = "COALESCE(classified_category.slug, " + parentKey + ")";
  const categoryId = "COALESCE(classified_category.id, parent.id, 0)::bigint";
  const typeName = "COALESCE(classified_type.name, 'Other content detail')";
  const typeKey = "COALESCE(classified_category.slug || '/' || classified_type.slug, 'content-detail/other-content-detail')";
  const titleKey = "canonical.normalized_name";
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
  return `latest AS MATERIALIZED (
      SELECT DISTINCT ON (av.app_id)
        av.id AS version_id,
        av.app_id,
        av.version_number
      FROM app_versions av
      WHERE av.platform = $1
        AND av.published_at IS NOT NULL
        AND av.published_at <= $2::timestamptz
      ORDER BY av.app_id, av.published_at DESC, av.version_number DESC, av.id DESC
    ), page_limit AS MATERIALIZED (
      -- $8 (the page LIMIT) is only referenced by pageSql, not by metadataSql's own
      -- text. Postgres can't infer a type for a parameter absent from the whole
      -- query, so metadataSql (which shares these CTEs) fails to parse without this
      -- no-op typed reference keeping $8 resolvable in both queries.
      SELECT $8::int AS value
    ), relevant_taxonomy AS (
      SELECT
        canonical.id AS flow_id,
        ${categoryId} AS category_id,
        ${categoryName} AS category,
        ${categoryKey} AS category_key,
        ${typeName} AS flow_type,
        ${typeKey} AS flow_type_key,
        canonical.name AS title,
        ${titleKey} AS title_key,
        relevance.exact_match,
        relevance.title_term_matches,
        relevance.term_matches
      FROM flows canonical
      LEFT JOIN flows parent ON parent.id = canonical.parent_id
      LEFT JOIN flow_classifications classification
        ON classification.flow_id = canonical.id
       AND classification.status = 'approved'
      LEFT JOIN flow_types classified_type
        ON classified_type.id = classification.flow_type_id
      LEFT JOIN flow_categories classified_category
        ON classified_category.id = classified_type.category_id
      CROSS JOIN LATERAL (
        SELECT
          CASE WHEN $3 <> '' AND (
            ${titleKey} LIKE '%' || $3 || '%'
            OR ${parentKey} LIKE '%' || $3 || '%'
            OR replace(${titleKey}, ' and ', ' ')
              LIKE '%' || replace($3, ' and ', ' ') || '%'
            OR replace(${parentKey}, ' and ', ' ')
              LIKE '%' || replace($3, ' and ', ' ') || '%'
          ) THEN 1 ELSE 0 END::int AS exact_match,
          COUNT(*) FILTER (
            WHERE ${titleTermMatch}
          )::int AS title_term_matches,
          COUNT(*) FILTER (
            WHERE ${titleTermMatch} OR ${parentTermMatch}
          )::int AS term_matches
        FROM unnest($9::text[]) AS search_term(term)
      ) relevance
      WHERE canonical.created_at <= $2::timestamptz
        AND (parent.id IS NULL OR parent.created_at <= $2::timestamptz)
        AND (
          $3 = ''
          OR relevance.exact_match = 1
          OR relevance.term_matches >= $10::int
        )
    ), instances AS (
      SELECT
        latest.app_id,
        mapping.flow_id,
        afv.id AS version_flow_id
      FROM latest
      JOIN app_flow_versions afv ON afv.version_id = latest.version_id
      JOIN app_flow_version_mappings mapping
        ON mapping.app_flow_version_id = afv.id
    ), unique_flow_ids AS MATERIALIZED (
      SELECT DISTINCT flow_id
      FROM instances
    ), grouped_all AS (
      SELECT
        taxonomy.flow_id,
        taxonomy.category_id,
        taxonomy.category,
        taxonomy.category_key,
        taxonomy.flow_type,
        taxonomy.flow_type_key,
        taxonomy.title,
        taxonomy.title_key,
        taxonomy.exact_match,
        taxonomy.title_term_matches,
        taxonomy.term_matches
      FROM unique_flow_ids
      JOIN relevant_taxonomy taxonomy ON taxonomy.flow_id = unique_flow_ids.flow_id
    ), filtered_items AS (
      SELECT *
      FROM grouped_all
      WHERE (NOT $6::boolean OR category_key = ANY($4::text[]))
        AND (NOT $7::boolean OR flow_type_key = ANY($5::text[]))
    )`;
}

function filteredBrowseCtes(): string {
  return `query_parameters AS MATERIALIZED (
      SELECT
        $3::text AS search,
        $9::text[] AS search_terms,
        $10::int AS minimum_term_matches
    ), latest AS MATERIALIZED (
      SELECT DISTINCT ON (av.app_id)
        av.id AS version_id,
        av.app_id,
        av.version_number
      FROM app_versions av
      WHERE av.platform = $1
        AND av.published_at IS NOT NULL
        AND av.published_at <= $2::timestamptz
      ORDER BY av.app_id, av.published_at DESC, av.version_number DESC, av.id DESC
    ), instances AS (
      SELECT
        latest.app_id,
        mapping.flow_id,
        afv.id AS version_flow_id
      FROM latest
      JOIN app_flow_versions afv ON afv.version_id = latest.version_id
      JOIN app_flow_version_mappings mapping
        ON mapping.app_flow_version_id = afv.id
    ), unique_flow_ids AS MATERIALIZED (
      SELECT DISTINCT flow_id
      FROM instances
    ), approved_taxonomy AS (
      SELECT
        canonical.id AS flow_id,
        classified_category.id::bigint AS category_id,
        classified_category.name AS category,
        classified_category.slug AS category_key,
        classified_type.name AS flow_type,
        classified_category.slug || '/' || classified_type.slug AS flow_type_key,
        canonical.name AS title,
        canonical.normalized_name AS title_key,
        0::int AS exact_match,
        0::int AS title_term_matches,
        0::int AS term_matches
      FROM unique_flow_ids observed
      JOIN flow_classifications classification
        ON classification.flow_id = observed.flow_id
       AND classification.status = 'approved'
      JOIN flow_types classified_type
        ON classified_type.id = classification.flow_type_id
      JOIN flow_categories classified_category
        ON classified_category.id = classified_type.category_id
      JOIN flows canonical ON canonical.id = observed.flow_id
      LEFT JOIN flows parent ON parent.id = canonical.parent_id
      WHERE canonical.created_at <= $2::timestamptz
        AND (parent.id IS NULL OR parent.created_at <= $2::timestamptz)
        AND (NOT $6::boolean OR classified_category.slug = ANY($4::text[]))
        AND (
          NOT $7::boolean
          OR (classified_category.slug || '/' || classified_type.slug) = ANY($5::text[])
        )
    ), fallback_taxonomy AS (
      SELECT
        canonical.id AS flow_id,
        COALESCE(parent.id, 0)::bigint AS category_id,
        COALESCE(parent.name, 'Other Flows') AS category,
        COALESCE(parent.normalized_name, 'other flows') AS category_key,
        'Other content detail' AS flow_type,
        'content-detail/other-content-detail' AS flow_type_key,
        canonical.name AS title,
        canonical.normalized_name AS title_key,
        0::int AS exact_match,
        0::int AS title_term_matches,
        0::int AS term_matches
      FROM unique_flow_ids observed
      JOIN flows canonical ON canonical.id = observed.flow_id
      LEFT JOIN flows parent ON parent.id = canonical.parent_id
      LEFT JOIN flow_classifications approved
        ON approved.flow_id = canonical.id
       AND approved.status = 'approved'
      WHERE approved.flow_id IS NULL
        AND canonical.created_at <= $2::timestamptz
        AND (parent.id IS NULL OR parent.created_at <= $2::timestamptz)
        AND (
          NOT $6::boolean
          OR COALESCE(parent.normalized_name, 'other flows') = ANY($4::text[])
        )
        AND (
          NOT $7::boolean
          OR 'content-detail/other-content-detail' = ANY($5::text[])
        )
    ), filtered_items AS (
      SELECT * FROM approved_taxonomy
      UNION ALL
      SELECT * FROM fallback_taxonomy
    )`;
}

function keyset(cursor: FlowCatalogCursor | undefined): { sql: string; values: unknown[] } {
  if (!cursor) return { sql: "", values: [] };
  const key = cursor.key;
  return {
    sql: `WHERE ROW(
        -ranked.exact_match,
        -ranked.title_term_matches,
        -ranked.term_matches,
        ranked.other_rank,
        ranked.title_sort,
        ranked.category_sort,
        ranked.category_id,
        ranked.flow_id
      ) > ROW(
        -$11::int, -$12::int, -$13::int, $14::int, $15::text, $16::text,
        $17::bigint, $18::bigint
      )`,
    values: [
      key.exactMatch,
      key.titleTermMatches,
      key.termMatches,
      key.other,
      key.title,
      key.category,
      key.categoryId,
      key.flowId,
    ],
  };
}

function pageSql(after: string, filteredBrowse = false): string {
  const order = `ranked.exact_match DESC,
    ranked.title_term_matches DESC,
    ranked.term_matches DESC,
    ranked.other_rank,
    ranked.title_sort,
    ranked.category_sort,
    ranked.category_id,
    ranked.flow_id`;
  return `WITH ${filteredBrowse ? filteredBrowseCtes() : commonCtes()},
    ranked AS (
      SELECT
        filtered_items.*,
        left(category_key, 120) AS category_sort,
        left(title_key, 120) AS title_sort,
        CASE WHEN category = 'Other Flows' THEN 1 ELSE 0 END::int AS other_rank,
        COUNT(*) OVER ()::int AS page_total
      FROM filtered_items
    ), paged AS (
      SELECT *
      FROM ranked
      ${after}
      ORDER BY ${order}
      LIMIT $8
    ), representatives AS (
      SELECT DISTINCT ON (instances.flow_id)
        instances.flow_id,
        latest.version_id,
        latest.version_number,
        a.name AS app,
        COALESCE(a.display_name, initcap(replace(a.name, '-', ' '))) AS app_name,
        a.icon_url AS app_icon_url,
        afv.id AS version_flow_id,
        afv.source_flow_id,
        afv.description,
        afv.tags,
        afv.steps
      FROM instances
      JOIN paged ON paged.flow_id = instances.flow_id
      JOIN latest ON latest.app_id = instances.app_id
      JOIN apps a ON a.id = instances.app_id
      JOIN app_flow_versions afv
        ON afv.id = instances.version_flow_id
       AND afv.version_id = latest.version_id
      ORDER BY
        instances.flow_id,
        (
          SELECT COUNT(*)
          FROM jsonb_array_elements(afv.steps) AS step(value)
          WHERE jsonb_array_length(COALESCE(step.value->'evidence', '[]'::jsonb)) > 0
        ) DESC,
        jsonb_array_length(afv.steps) DESC,
        lower(a.name),
        afv.id
    )
    SELECT
      paged.flow_id,
      paged.category_id,
      paged.category,
      paged.category_key,
      paged.flow_type,
      paged.flow_type_key,
      paged.category_sort,
      paged.title,
      paged.title_key,
      paged.title_sort,
      paged.exact_match,
      paged.title_term_matches,
      paged.term_matches,
      paged.other_rank,
      paged.page_total,
      representatives.version_id,
      representatives.version_number,
      representatives.app,
      representatives.app_name,
      representatives.app_icon_url,
      representatives.version_flow_id,
      representatives.source_flow_id,
      representatives.description,
      representatives.tags,
      representatives.steps
    FROM paged
    JOIN representatives ON representatives.flow_id = paged.flow_id
    ORDER BY ${order.replaceAll("ranked.", "paged.")}`;
}

const metadataSql = `WITH ${commonCtes()},
  category_facet_items AS (
    SELECT category, category_key, COUNT(*)::int AS count
    FROM grouped_all
    GROUP BY category, category_key
  ), type_facet_items AS (
    SELECT flow_type, flow_type_key, COUNT(*)::int AS count
    FROM grouped_all
    GROUP BY flow_type, flow_type_key
  )
  SELECT
    (SELECT COUNT(*)::int FROM filtered_items) AS total_count,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'group', 'flowCategories',
          'value', category_key,
          'count', count
        )
        ORDER BY
          CASE WHEN category = 'Other content detail' THEN 1 ELSE 0 END,
          count DESC,
          category_key
      )
      FROM category_facet_items
    ), '[]'::jsonb) || COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'group', 'flowTypes',
          'value', flow_type_key,
          'count', count
        )
        ORDER BY count DESC, flow_type_key
      )
      FROM type_facet_items
    ), '[]'::jsonb) AS facets`;

function itemFromRow(row: Record<string, unknown>, platform: Platform): FlowCatalogItem {
  const appId = String(row.app);
  const versionId = Number(row.version_id);
  const version = Number(row.version_number);
  const versionFlowId = Number(row.version_flow_id);
  const rawSteps = Array.isArray(row.steps) ? row.steps : [];
  const observedScreens = rawSteps.flatMap((step, stepIndex) => {
    if (
      !step
      || typeof step !== "object"
      || !Array.isArray((step as { evidence?: unknown }).evidence)
    ) return [];
    const label = typeof (step as { label?: unknown }).label === "string"
      ? String((step as { label: string }).label)
      : `Step ${stepIndex + 1}`;
    const evidence = (step as { evidence: unknown[] }).evidence;
    return evidence.flatMap((value, evidenceIndex) => {
      const imageId = Number(value);
      if (!Number.isSafeInteger(imageId) || imageId < 1) return [];
      return [{
        imageId,
        label: evidence.length > 1 ? `${label} (${evidenceIndex + 1})` : label,
      }];
    });
  });
  const steps = observedScreens.map(({ imageId, label }, index) => {
    const mediaUrl = `/api/flows/media/${encodeURIComponent(appId)}/${platform}/${versionId}/${versionFlowId}/${index + 1}`;
    return {
      label,
      evidence: [{
        imageId,
        imageUrl: `${mediaUrl}?variant=full`,
        thumbnailUrl: `${mediaUrl}?variant=thumb`,
        description: label,
      }],
    };
  });
  return {
    category: String(row.category),
    type: String(row.flow_type),
    title: String(row.title),
    preview: {
      appId,
      appName: String(row.app_name),
      appIconUrl: typeof row.app_icon_url === "string" ? row.app_icon_url : null,
      versionId,
      version,
      sourceFlowId: String(row.source_flow_id),
      screenCount: observedScreens.length,
      flow: {
        id: `${appId}:${versionFlowId}`,
        title: String(row.title),
        category: String(row.category),
        description: typeof row.description === "string" ? row.description : "",
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        steps,
      },
    },
  };
}

function cursorFromRow(
  row: Record<string, unknown>,
  base: {
    sort: FlowCatalogSort;
    platform: Platform;
    snapshotAt: string;
    identity: string;
  },
): FlowCatalogCursor {
  const key = {
    exactMatch: Number(row.exact_match) as 0 | 1,
    titleTermMatches: Number(row.title_term_matches),
    termMatches: Number(row.term_matches),
    other: Number(row.other_rank) as 0 | 1,
    category: String(row.category_sort),
    categoryId: String(row.category_id),
    title: String(row.title_sort),
    flowId: String(row.flow_id),
  };
  return { v: 3, ...base, sort: "grouped", key };
}

interface PublishedFlowCatalogPageInput {
  platform: Platform;
  query?: string;
  cursor?: string;
  limit?: number;
  sort?: FlowCatalogSort;
  flowCategories?: readonly string[];
  flowTypes?: readonly string[];
  cursorSecret: string;
  facetCache?: FlowCatalogFacetCache;
  includeFacets?: boolean;
  pageCache?: FlowCatalogPageCache;
  now?: () => Date;
}

function pageCacheKey(input: PublishedFlowCatalogPageInput): string {
  const search = normalizeFlowCatalogText(input.query ?? "").slice(0, 120);
  const flowCategories = normalizedCategories(input.flowCategories);
  const flowTypes = normalizedTypes(input.flowTypes);
  const identity = flowCatalogQueryIdentity({ query: search, flowCategories, flowTypes });
  return [
    flowCatalogQueryIdentity({ query: input.cursorSecret }),
    input.platform,
    input.sort ?? "grouped",
    String(pageLimit(input.limit)),
    identity,
    input.includeFacets === false ? "summary" : "full",
  ].join("\0");
}

async function loadPublishedFlowCatalogPage(
  input: PublishedFlowCatalogPageInput,
  runQuery: FlowCatalogQuery = query,
): Promise<FlowCatalogPage> {
  const limit = pageLimit(input.limit);
  const sort = input.sort ?? "grouped";
  const search = normalizeFlowCatalogText(input.query ?? "").slice(0, 120);
  const searchTerms = flowCatalogSearchTerms(search);
  const minimumTermMatches = minimumFlowCatalogTermMatches(searchTerms.length);
  const flowCategories = normalizedCategories(input.flowCategories);
  const flowTypes = normalizedTypes(input.flowTypes);
  const identity = flowCatalogQueryIdentity({ query: search, flowCategories, flowTypes });
  const cursor = input.cursor
    ? decodeFlowCatalogCursor(input.cursor, {
        sort,
        platform: input.platform,
        identity,
      }, input.cursorSecret)
    : undefined;
  const snapshotAt = cursor?.snapshotAt
    ?? (input.now ?? (() => new Date()))().toISOString();
  const after = keyset(cursor);
  const values = [
    input.platform,
    snapshotAt,
    search,
    flowCategories,
    flowTypes,
    flowCategories.length > 0,
    flowTypes.length > 0,
    limit + 1,
    searchTerms,
    minimumTermMatches,
    ...after.values,
  ];
  const cache = input.facetCache
    ?? (runQuery === query ? defaultFacetCache : new FlowCatalogFacetCache());
  const cacheKey = `${input.platform}\0${sort}\0${identity}`;
  let metadata = input.includeFacets === false ? undefined : cache.get(cacheKey);
  const pageResultPromise = runQuery(pageSql(
    after.sql,
    search === "" && (flowCategories.length > 0 || flowTypes.length > 0),
  ), values);
  const metadataResultPromise = input.includeFacets === false || metadata
    ? null
    : runQuery(metadataSql, values.slice(0, 10));
  const [result, metadataResult] = await Promise.all([
    pageResultPromise,
    metadataResultPromise,
  ]);
  const rows = result.rows as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const visibleRows = rows.slice(0, limit);

  if (!metadata && metadataResult) {
    const metadataRow = metadataResult.rows[0] as Record<string, unknown> | undefined;
    metadata = {
      totalCount: Number(metadataRow?.total_count ?? 0),
      facets: Array.isArray(metadataRow?.facets)
        ? metadataRow.facets.map((facet) => ({
            group: String((facet as Record<string, unknown>).group),
            value: String((facet as Record<string, unknown>).value),
            count: Number((facet as Record<string, unknown>).count),
          }))
        : [],
    };
    cache.set(cacheKey, metadata);
  }
  if (input.includeFacets === false) {
    metadata = {
      totalCount: Number(rows[0]?.page_total ?? 0),
      facets: [],
    };
  }
  metadata ??= { totalCount: 0, facets: [] };

  const page = {
    items: visibleRows.map((row) => itemFromRow(row, input.platform)),
    nextCursor: hasMore && visibleRows.length > 0
      ? encodeFlowCatalogCursor(cursorFromRow(visibleRows.at(-1)!, {
          sort,
          platform: input.platform,
          snapshotAt,
          identity,
        }), input.cursorSecret)
      : null,
    totalCount: metadata.totalCount,
    facets: metadata.facets,
  };
  return page;
}

export async function publishedFlowCatalogPage(
  input: PublishedFlowCatalogPageInput,
  runQuery: FlowCatalogQuery = query,
): Promise<FlowCatalogPage> {
  if (input.cursor) {
    return loadPublishedFlowCatalogPage(input, runQuery);
  }
  const pageCache = input.pageCache
    ?? (runQuery === query ? defaultPageCache : undefined);
  if (!pageCache) {
    return loadPublishedFlowCatalogPage(input, runQuery);
  }
  const key = pageCacheKey(input);
  const fresh = pageCache.get(key);
  if (fresh) return fresh;
  const stale = pageCache.getStale(key);
  if (stale) {
    void pageCache.load(
      key,
      () => loadPublishedFlowCatalogPage(input, runQuery),
    ).catch(() => undefined);
    return stale;
  }
  return pageCache.load(
    key,
    () => loadPublishedFlowCatalogPage(input, runQuery),
  );
}
