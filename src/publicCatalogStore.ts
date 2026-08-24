import type { QueryResult } from "pg";
import {
  query as databaseQuery,
  type PublishedPreviewImage,
} from "./db.ts";
import {
  decodeCatalogCursor,
  encodeCatalogCursor,
  type CatalogSort,
} from "./catalogCursor.ts";
import type { Category } from "./categoryStore.ts";
import type { Platform } from "./platformFromUrl.ts";
import type {
  DiscoveryFacet,
  DiscoveryFilter,
} from "./vitrine/discoveryTypes.ts";
import type { PublicFacetGroup } from "./publicFacetPreview.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

const query: DatabaseQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

export interface PublishedCatalogAppRecord {
  app_id: number;
  app: string;
  display_name: string | null;
  description?: string | null;
  categories: Category[];
  website_url: string | null;
  icon_url: string | null;
  preview_object_key?: string | null;
  accent_color: string | null;
  total_screens: number;
  analyzed_screens?: number;
  available_platforms: string[];
  /** Timestamp of the latest published capture; this is when the App entered the catalog. */
  created_at?: string;
  last_captured_at: string;
}

export interface PublishedCatalogPageRecord {
  apps: PublishedCatalogAppRecord[];
  previews: PublishedPreviewImage[];
  nextCursor: string | null;
  totalCount?: number;
  facets?: DiscoveryFacet[];
}

function pageLimit(requested = 24): number {
  if (!Number.isFinite(requested)) return 24;
  return Math.min(Math.max(Math.trunc(requested), 1), 24);
}

function stableCatalogSnapshotAt(now: Date): string {
  return new Date(
    Math.floor(now.getTime() / 60_000) * 60_000,
  ).toISOString();
}

class SqlParameters {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

export interface CatalogFacetCache {
  get(key: string): DiscoveryFacet[] | undefined;
  set(key: string, facets: DiscoveryFacet[]): void;
}

export function createCatalogFacetCache(options: {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
} = {}): CatalogFacetCache {
  const ttlMs = options.ttlMs ?? 280_000;
  const maxEntries = options.maxEntries ?? 100;
  const now = options.now ?? Date.now;
  const entries = new Map<string, { expiresAt: number; facets: DiscoveryFacet[] }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.facets;
    },
    set(key, facets) {
      entries.delete(key);
      entries.set(key, { expiresAt: now() + ttlMs, facets });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
  };
}

const facetCaches = new WeakMap<DatabaseQuery, CatalogFacetCache>();

export function catalogFacetCacheForQuery(
  runQuery: DatabaseQuery,
): CatalogFacetCache {
  const existing = facetCaches.get(runQuery);
  if (existing) return existing;
  const cache = createCatalogFacetCache();
  facetCaches.set(runQuery, cache);
  return cache;
}

function facetStateKey(input: {
  visibility: "public" | "admin";
  facetGroups?: readonly PublicFacetGroup[];
  filters: readonly DiscoveryFilter[];
  platform?: Platform;
  query?: string;
}): string {
  const filters = [...groupedFilterValues(input.filters).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, values]) => [group, [...values].sort()]);
  return JSON.stringify([
    input.visibility,
    [...(input.facetGroups ?? FACET_GROUPS)].sort(),
    input.platform ?? null,
    input.query?.trim().toLocaleLowerCase() || null,
    filters,
  ]);
}

const FACET_GROUPS = [
  "categories",
  "screens",
  "elements",
  "flows",
] as const satisfies readonly PublicFacetGroup[];

function groupedFilterValues(
  filters: readonly DiscoveryFilter[] = [],
): Map<PublicFacetGroup, string[]> {
  const grouped = new Map<PublicFacetGroup, string[]>();
  for (const filter of filters) {
    if (!(FACET_GROUPS as readonly string[]).includes(filter.group)) continue;
    const group = filter.group as PublicFacetGroup;
    const value = filter.value.trim().toLocaleLowerCase();
    if (!value) continue;
    const values = grouped.get(group) ?? [];
    if (!values.includes(value)) values.push(value);
    grouped.set(group, values);
  }
  return grouped;
}

function catalogFilterSql(
  parameters: SqlParameters,
  filters: readonly DiscoveryFilter[],
  platform: string,
  omit?: PublicFacetGroup,
): string {
  const grouped = groupedFilterValues(filters);
  const conditions: string[] = [];
  for (const group of FACET_GROUPS) {
    if (group === omit) continue;
    const values = grouped.get(group);
    if (!values?.length) continue;
    const token = parameters.add(values);
    if (group === "categories") {
      conditions.push(`EXISTS (
        SELECT 1
        FROM app_categories ac
        JOIN categories c ON c.id = ac.category_id
        WHERE ac.app_id = a.id
          AND lower(c.name) = ANY(${token}::text[])
      )`);
      continue;
    }
    if (group === "flows") {
      conditions.push(`EXISTS (
        SELECT 1
        FROM latest facet_latest
        JOIN app_flow_versions afv
          ON afv.version_id = facet_latest.version_id
        JOIN app_flow_version_mappings mapping
          ON mapping.app_flow_version_id = afv.id
        JOIN flows canonical ON canonical.id = mapping.flow_id
        WHERE facet_latest.app_id = a.id
          AND facet_latest.screen_count > 0
          AND (${platform}::text IS NULL OR facet_latest.platform = ${platform})
          AND lower(canonical.name) = ANY(${token}::text[])
      )`);
      continue;
    }
    conditions.push(`EXISTS (
      SELECT 1
      FROM latest facet_latest
      JOIN public_facet_previews pfp
        ON pfp.version_id = facet_latest.version_id
      WHERE facet_latest.app_id = a.id
        AND facet_latest.screen_count > 0
        AND (${platform}::text IS NULL OR facet_latest.platform = ${platform})
        AND pfp.facet_group = '${group}'
        AND lower(pfp.facet_value) = ANY(${token}::text[])
    )`);
  }
  return conditions.length ? conditions.join("\n      AND ") : "TRUE";
}

function facetCountsQuery(input: {
  visibility: "public" | "admin";
  snapshotAt: string;
  groups?: readonly PublicFacetGroup[];
  filters: readonly DiscoveryFilter[];
  platform?: Platform;
  query?: string;
}): { sql: string; values: readonly unknown[] } {
  const parameters = new SqlParameters();
  const snapshot = parameters.add(input.snapshotAt);
  const platform = parameters.add(input.platform ?? null);
  const search = parameters.add(input.query ?? null);
  const published = `EXISTS (
    SELECT 1
    FROM latest eligible_latest
    WHERE eligible_latest.app_id = a.id
      AND eligible_latest.screen_count > 0
      AND (${platform}::text IS NULL OR eligible_latest.platform = ${platform})
  )`;
  const query = `(${search}::text IS NULL
    OR a.name ILIKE '%' || ${search} || '%'
    OR COALESCE(a.display_name, '') ILIKE '%' || ${search} || '%'
    OR EXISTS (
      SELECT 1
      FROM app_categories search_app_category
      JOIN categories search_category ON search_category.id = search_app_category.category_id
      WHERE search_app_category.app_id = a.id
        AND search_category.name ILIKE '%' || ${search} || '%'
    ))`;
  const where = (omit: PublicFacetGroup) =>
    `${published}
      AND ${query}
      AND ${catalogFilterSql(parameters, input.filters, platform, omit)}`;
  const groups = new Set(input.groups ?? FACET_GROUPS);
  const selects: string[] = [];
  if (groups.has("categories")) {
    selects.push(`SELECT 'categories' AS facet_group, c.name AS facet_value,
      COUNT(DISTINCT a.id)::integer AS count,
      NULL::text AS section, NULL::text AS description,
      ARRAY[]::text[] AS aliases,
      NULL::integer AS section_position,
      NULL::integer AS pattern_position
    FROM apps a
    JOIN app_categories ac ON ac.app_id = a.id
    JOIN categories c ON c.id = ac.category_id
    WHERE /* omit:categories */ ${where("categories")}
    GROUP BY c.id, c.name`);
  }
  if (groups.has("screens")) {
    selects.push(`SELECT 'screens' AS facet_group, pattern.name AS facet_value,
      COUNT(DISTINCT matching.app_id)::integer AS count,
      section.name AS section, pattern.description, pattern.aliases,
      section.position AS section_position,
      pattern.position AS pattern_position
    FROM screen_patterns pattern
    JOIN screen_pattern_sections section ON section.id = pattern.section_id
    LEFT JOIN LATERAL (
      SELECT DISTINCT a.id AS app_id
      FROM apps a
      WHERE /* omit:screens */ ${where("screens")}
        AND EXISTS (
          SELECT 1
          FROM latest facet_latest
          JOIN public_facet_previews pfp
            ON pfp.version_id = facet_latest.version_id
           AND pfp.facet_group = 'screens'
           AND lower(pfp.facet_value) = lower(pattern.name)
          WHERE facet_latest.app_id = a.id
            AND facet_latest.screen_count > 0
            AND (
              ${platform}::text IS NULL
              OR facet_latest.platform = ${platform}
            )
        )
    ) matching ON true
    GROUP BY pattern.id, pattern.name, pattern.description, pattern.aliases,
      pattern.position, section.id, section.name, section.position`);
  }
  if (groups.has("elements")) {
    selects.push(`SELECT 'elements' AS facet_group, pfp.facet_value,
      COUNT(DISTINCT a.id)::integer AS count,
      NULL::text AS section, NULL::text AS description,
      ARRAY[]::text[] AS aliases,
      NULL::integer AS section_position,
      NULL::integer AS pattern_position
    FROM apps a
    JOIN latest facet_latest ON facet_latest.app_id = a.id
    JOIN public_facet_previews pfp ON pfp.version_id = facet_latest.version_id
    WHERE /* omit:elements */ pfp.facet_group = 'elements'
      AND facet_latest.screen_count > 0
      AND (${platform}::text IS NULL OR facet_latest.platform = ${platform})
      AND ${where("elements")}
    GROUP BY pfp.facet_value`);
  }
  const flowEligibleWhere = groups.has("flows") ? where("flows") : "";
  if (groups.has("flows")) {
    selects.push(`SELECT 'flows' AS facet_group, canonical.name AS facet_value,
      COUNT(DISTINCT a.id)::integer AS count,
      NULL::text AS section, NULL::text AS description,
      ARRAY[]::text[] AS aliases,
      NULL::integer AS section_position,
      NULL::integer AS pattern_position
    FROM latest facet_latest
    JOIN flow_eligible_apps flow_eligible
      ON flow_eligible.app_id = facet_latest.app_id
    JOIN apps a ON a.id = flow_eligible.app_id
    JOIN app_flow_versions afv ON afv.version_id = facet_latest.version_id
    JOIN app_flow_version_mappings mapping
      ON mapping.app_flow_version_id = afv.id
    JOIN flows canonical ON canonical.id = mapping.flow_id
    WHERE /* omit:flows */ facet_latest.screen_count > 0
      AND (${platform}::text IS NULL OR facet_latest.platform = ${platform})
    GROUP BY canonical.id, canonical.name`);
  }

  return {
    sql: `WITH latest AS MATERIALIZED (
      SELECT DISTINCT ON (av.app_id, av.platform)
        av.id AS version_id, av.app_id, av.platform, av.screen_count
      FROM app_versions av
      WHERE ${input.visibility === "public"
        ? `av.published_at IS NOT NULL
        AND av.published_at <= ${snapshot}::timestamptz`
        : `av.captured_at <= ${snapshot}::timestamptz`}
      ORDER BY av.app_id, av.platform,
        ${input.visibility === "public" ? "av.published_at" : "av.captured_at"} DESC,
        av.version_number DESC
    )${groups.has("flows") ? `, flow_eligible_apps AS MATERIALIZED (
      SELECT a.id AS app_id
      FROM apps a
      WHERE /* eligible:flows */ ${flowEligibleWhere}
    )` : ""}
    ${selects.join("\n    UNION ALL\n    ")}`,
    values: parameters.values,
  };
}

async function catalogPage(
  input: {
    cursor?: string;
    limit?: number;
    now?: Date;
    filters?: DiscoveryFilter[];
    facetGroups?: readonly PublicFacetGroup[];
    includeFacets?: boolean;
    platform?: Platform;
    query?: string;
    sort?: CatalogSort;
  } = {},
  runQuery: DatabaseQuery = query,
  facetCache: CatalogFacetCache = catalogFacetCacheForQuery(runQuery),
  visibility: "public" | "admin" = "public",
): Promise<PublishedCatalogPageRecord> {
  const limit = pageLimit(input.limit);
  const sort = input.sort ?? "latest";
  const decoded = input.cursor
    ? decodeCatalogCursor(input.cursor, sort)
    : undefined;
  const snapshotAt = decoded?.snapshotAt
    ?? stableCatalogSnapshotAt(input.now ?? new Date());
  const afterUpdatedAt = decoded?.updatedAt ?? null;
  const afterAppId = decoded?.appId ?? null;
  const parameters = new SqlParameters();
  const snapshot = parameters.add(snapshotAt);
  const after = parameters.add(afterUpdatedAt);
  const afterId = parameters.add(afterAppId);
  const afterMetric = sort === "trending"
    ? parameters.add(decoded?.sort === "trending" ? decoded.popularityScore : null)
    : null;
  const platform = parameters.add(input.platform ?? null);
  const search = parameters.add(input.query?.trim() || null);
  const filters = catalogFilterSql(
    parameters,
    input.filters ?? [],
    platform,
  );
  const resultLimit = parameters.add(limit + 1);
  const identitiesResult = await runQuery(
     `WITH latest AS MATERIALIZED (
       SELECT DISTINCT ON (av.app_id, av.platform)
         av.id AS version_id, av.app_id, av.platform, av.screen_count, av.captured_at
       FROM app_versions av
       WHERE ${visibility === "public"
         ? `av.published_at IS NOT NULL
         AND av.published_at <= ${snapshot}::timestamptz`
         : `av.captured_at <= ${snapshot}::timestamptz`}
         AND (${platform}::text IS NULL OR av.platform = ${platform})
       ORDER BY av.app_id, av.platform,
         ${visibility === "public" ? "av.published_at" : "av.captured_at"} DESC,
         av.version_number DESC
     ), app_updates AS (
       SELECT latest.app_id,
         date_trunc('milliseconds', MAX(latest.captured_at)) AS updated_at,
         SUM(latest.screen_count)::integer AS total_screens
       FROM latest
       WHERE latest.screen_count > 0
       GROUP BY latest.app_id
     ), popularity AS MATERIALIZED (
       -- Real usage signal for the "Popular" sort: page views over the last 30
       -- days (relative to this page's stable snapshot, not wall-clock now(),
       -- so counts stay consistent across cursor pages of the same request).
       SELECT app_slug, COUNT(*)::integer AS popularity_score
       FROM access_events
       WHERE action IN ('app-detail', 'preview_viewed')
         AND created_at >= ${snapshot}::timestamptz - INTERVAL '30 days'
         AND created_at <= ${snapshot}::timestamptz
       GROUP BY app_slug
     ), eligible AS (
       SELECT a.id AS app_id, a.name AS app, app_updates.updated_at,
         app_updates.total_screens,
         COALESCE(popularity.popularity_score, 0) AS popularity_score
       FROM app_updates
       JOIN apps a ON a.id = app_updates.app_id
       LEFT JOIN popularity ON popularity.app_slug = a.name
       WHERE (
         ${platform}::text IS NULL
         OR EXISTS (
           SELECT 1
           FROM latest platform_latest
           WHERE platform_latest.app_id = a.id
             AND platform_latest.platform = ${platform}
             AND platform_latest.screen_count > 0
         )
       )
       AND (
         ${search}::text IS NULL
         OR a.name ILIKE '%' || ${search} || '%'
         OR COALESCE(a.display_name, '') ILIKE '%' || ${search} || '%'
         OR EXISTS (
           SELECT 1
           FROM app_categories search_app_category
           JOIN categories search_category ON search_category.id = search_app_category.category_id
           WHERE search_app_category.app_id = a.id
             AND search_category.name ILIKE '%' || ${search} || '%'
         )
       )
       AND ${filters}
     ), totals AS (
       SELECT COUNT(*)::integer AS total_count FROM eligible
     ), page AS (
       SELECT app_id, app, updated_at, total_screens, popularity_score
       FROM eligible
       WHERE (
         ${after}::timestamptz IS NULL
         OR ${sort === "trending"
           ? `(popularity_score, updated_at, app_id) < (${afterMetric}::integer, ${after}::timestamptz, ${afterId}::integer)`
           : `(updated_at, app_id) < (${after}::timestamptz, ${afterId}::integer)`}
       )
       ORDER BY ${sort === "trending"
         ? "popularity_score DESC, updated_at DESC, app_id DESC"
         : "updated_at DESC, app_id DESC"}
       LIMIT ${resultLimit}
     )
     SELECT page.app_id, page.app, page.updated_at, page.total_screens,
       page.popularity_score, totals.total_count
     FROM page CROSS JOIN totals
     UNION ALL
     SELECT NULL::integer, NULL::text, NULL::timestamptz, NULL::integer,
       NULL::integer, totals.total_count
     FROM totals
     WHERE NOT EXISTS (SELECT 1 FROM page)
     ORDER BY ${sort === "trending"
       ? "popularity_score DESC NULLS LAST, updated_at DESC NULLS LAST, app_id DESC NULLS LAST"
       : "updated_at DESC NULLS LAST, app_id DESC NULLS LAST"}`,
    parameters.values,
  );
  const selectedRows = identitiesResult.rows as Array<{
    app_id: number | null;
    app: string;
    updated_at: string | Date;
    total_screens: number;
    popularity_score: number;
    total_count?: number;
  }>;
  const totalCount = Number(selectedRows[0]?.total_count ?? selectedRows.length);
  const selectedIdentities = selectedRows.filter(
    (row): row is typeof row & { app_id: number } => Number.isInteger(row.app_id),
  );
  const hasMore = selectedIdentities.length > limit;
  const identities = selectedIdentities.slice(0, limit);
  const readFacets = async (): Promise<DiscoveryFacet[]> => {
    if (input.includeFacets === false) return [];
    const facetQuery = facetCountsQuery({
      visibility,
      snapshotAt,
      groups: input.facetGroups,
      filters: input.filters ?? [],
      platform: input.platform,
      query: input.query?.trim() || undefined,
    });
    const facetKey = facetStateKey({
      visibility,
      facetGroups: input.facetGroups,
      filters: input.filters ?? [],
      platform: input.platform,
      query: input.query,
    });
    const cachedFacets = facetCache.get(facetKey);
    if (cachedFacets) return cachedFacets;
    const rows = await runQuery(facetQuery.sql, facetQuery.values);
    const facets = catalogFacets(rows.rows);
    facetCache.set(facetKey, facets);
    return facets;
  };
  if (identities.length === 0) {
    return {
      apps: [],
      previews: [],
      nextCursor: null,
      totalCount,
      facets: await readFacets(),
    };
  }
  const appIds = identities.map(({ app_id }) => app_id);
  const exactPreviewFacets = (input.filters ?? []).flatMap((filter) => {
    if (filter.group !== "screens" && filter.group !== "elements") return [];
    const value = filter.value.trim().toLocaleLowerCase();
    return value ? [{ group: filter.group, value }] : [];
  });
  const exactPreviewGroups = exactPreviewFacets.map(({ group }) => group);
  const exactPreviewValues = exactPreviewFacets.map(({ value }) => value);

  const [appsResult, previewsResult, facets] = await Promise.all([
    runQuery(
      `WITH latest AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform, av.screen_count
         FROM app_versions av
         WHERE av.app_id = ANY($1::integer[])
           AND ${visibility === "public"
             ? `av.published_at IS NOT NULL
           AND av.published_at <= $2::timestamptz`
             : `av.captured_at <= $2::timestamptz`}
           AND ($3::text IS NULL OR av.platform = $3)
         ORDER BY av.app_id, av.platform,
           ${visibility === "public" ? "av.published_at" : "av.captured_at"} DESC,
           av.version_number DESC
       )
       SELECT a.id AS app_id, a.name AS app, a.display_name, a.description,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', category_rows.id,
               'name', category_rows.name,
               'slug', category_rows.slug
             )
             ORDER BY lower(category_rows.name), category_rows.id
           )
           FROM (
             SELECT c.id, c.name, c.slug
             FROM app_categories ac
             JOIN categories c ON c.id = ac.category_id
             WHERE ac.app_id = a.id
           ) category_rows
         ), '[]'::jsonb) AS categories,
         a.website_url,
         a.icon_url, a.preview_object_key, a.accent_color,
         COALESCE(SUM(latest.screen_count), 0)::int AS total_screens,
         ${visibility === "admin"
           ? `(SELECT COUNT(*)::integer
              FROM images progress_image
              JOIN platforms progress_platform
                ON progress_platform.id = progress_image.platform_id
              WHERE progress_platform.app_id = a.id
                AND ($3::text IS NULL OR progress_platform.name = $3)
                AND progress_image.kind = 'screen'
                AND progress_image.analysis IS NOT NULL
                AND progress_image.created_at <= $2::timestamptz
            ) AS analyzed_screens,`
           : ""}
         COALESCE(
           ARRAY_AGG(latest.platform ORDER BY latest.platform)
             FILTER (WHERE latest.screen_count > 0),
           ARRAY[]::text[]
         ) AS available_platforms
       FROM apps a
       JOIN latest ON latest.app_id = a.id
       WHERE a.id = ANY($1::integer[])
       GROUP BY a.id, a.name, a.display_name, a.description, a.website_url,
         a.icon_url, a.preview_object_key, a.accent_color`,
      [appIds, snapshotAt, input.platform ?? null],
    ),
    runQuery(
      `WITH latest AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform
         FROM app_versions av
         WHERE av.app_id = ANY($1::integer[])
           AND ${visibility === "public"
             ? `av.published_at IS NOT NULL
           AND av.published_at <= $2::timestamptz`
             : `av.captured_at <= $2::timestamptz`}
           AND ($3::text IS NULL OR av.platform = $3)
         ORDER BY av.app_id, av.platform,
           ${visibility === "public" ? "av.published_at" : "av.captured_at"} DESC,
           av.version_number DESC
       ),
       candidates AS (
         SELECT candidate.id, a.name AS app, latest.platform,
           candidate.image_url, candidate.kind, candidate.description,
           candidate.analysis, a.icon_url, candidate.capture_url,
           candidate.viewport_width, candidate.viewport_height,
           candidate.state_context, candidate.captured_at,
           candidate.curated_rank, candidate.source_priority,
           candidate.heft_bytes, candidate.matched_facets
         FROM apps a
         JOIN latest ON latest.app_id = a.id
         JOIN LATERAL (
           WITH requested_facets AS (
             SELECT requested.facet_group, requested.facet_value
             FROM UNNEST($4::text[], $5::text[])
               AS requested(facet_group, facet_value)
           ),
           preview_category AS MATERIALIZED (
             SELECT i.id, i.image_url, i.kind, i.description, i.analysis,
               vi.source_url AS capture_url, vi.viewport_width,
               vi.viewport_height, vi.state_context, vi.captured_at,
               MIN(pfp.rank)::int AS curated_rank, -2 AS source_priority,
               NULL::bigint AS heft_bytes,
               to_jsonb(ARRAY_AGG(DISTINCT jsonb_build_object(
                 'group', pfp.facet_group,
                 'value', pfp.facet_value
               ))) AS matched_facets
             FROM public_facet_previews pfp
             JOIN version_images vi
               ON vi.version_id = pfp.version_id
              AND vi.image_id = pfp.image_id
             JOIN images i
               ON i.id = pfp.image_id
              AND i.kind = 'screen'
             WHERE pfp.version_id = latest.version_id
               AND pfp.facet_group = 'screens'
               AND lower(pfp.facet_value) = 'preview'
               AND vi.captured_at <= $2::timestamptz
               AND NOT EXISTS (
                 SELECT 1 FROM app_preview_images manual
                 WHERE manual.version_id = latest.version_id
               )
             GROUP BY i.id, i.image_url, i.kind, i.description, i.analysis,
               vi.source_url, vi.viewport_width, vi.viewport_height,
               vi.state_context, vi.captured_at
           ),
           exact AS MATERIALIZED (
             SELECT i.id, i.image_url, i.kind, i.description, i.analysis,
               vi.source_url AS capture_url, vi.viewport_width,
               vi.viewport_height, vi.state_context, vi.captured_at,
               MIN(pfp.rank)::int AS curated_rank, -1 AS source_priority,
               NULL::bigint AS heft_bytes,
               to_jsonb(ARRAY_AGG(DISTINCT jsonb_build_object(
                 'group', pfp.facet_group,
                 'value', pfp.facet_value
               ))) AS matched_facets
             FROM requested_facets requested
             JOIN public_facet_previews pfp
               ON pfp.version_id = latest.version_id
              AND pfp.facet_group = requested.facet_group
              AND lower(pfp.facet_value) = requested.facet_value
             JOIN version_images vi
               ON vi.version_id = pfp.version_id
              AND vi.image_id = pfp.image_id
             JOIN images i
               ON i.id = pfp.image_id
              AND i.kind IN ('screen', 'ui_element')
             WHERE vi.captured_at <= $2::timestamptz
               AND NOT EXISTS (
                 SELECT 1 FROM preview_category
                 WHERE preview_category.id = i.id
               )
             GROUP BY i.id, i.image_url, i.kind, i.description, i.analysis,
               vi.source_url, vi.viewport_width, vi.viewport_height,
               vi.state_context, vi.captured_at
           ),
           curated AS MATERIALIZED (
             SELECT i.id, i.image_url, i.kind, i.description, i.analysis,
               vi.source_url AS capture_url, vi.viewport_width,
               vi.viewport_height, vi.state_context, vi.captured_at,
               api.rank::int AS curated_rank, 0 AS source_priority,
               NULL::bigint AS heft_bytes,
               NULL::jsonb AS matched_facets
             FROM app_preview_images api
             JOIN version_images vi
               ON vi.version_id = api.version_id
              AND vi.image_id = api.image_id
             JOIN images i ON i.id = api.image_id AND i.kind = 'screen'
             WHERE api.version_id = latest.version_id
               AND vi.captured_at <= $2::timestamptz
               AND NOT EXISTS (
                 SELECT 1 FROM preview_category
                 WHERE preview_category.id = api.image_id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM exact WHERE exact.id = api.image_id
               )
           ),
           fast_fallback AS MATERIALIZED (
             SELECT i.id, i.image_url, i.kind, i.description, i.analysis,
               vi.source_url AS capture_url, vi.viewport_width,
               vi.viewport_height, vi.state_context, vi.captured_at,
               NULL::int AS curated_rank, 1 AS source_priority,
               i.heft_bytes,
               NULL::jsonb AS matched_facets
             FROM platforms p
             JOIN LATERAL (
               -- Uncurated fallback previews used to be pure recency, which
               -- surfaced blank splash/loading captures (~18% of previews,
               -- measured) as an app's public face. Stored byte size is a
               -- strong blankness proxy — near-empty frames compress an order
               -- of magnitude smaller than real screens — and it's already on
               -- every stored object, so no reanalysis pass is needed. The
               -- same ordering rule lives in publishedPreviewImages (db.ts)
               -- and publishedPreviewObject (objectStoreDb.ts); the three
               -- must agree or /preview-media/:app/:rank serves a different
               -- image than the catalog JSON described.
               -- ponytail: byte size is a heuristic; replace with a stored
               -- visual-richness score at import time if it misranks.
               SELECT candidate.*, heft.byte_size AS heft_bytes
               FROM images candidate
               LEFT JOIN stored_objects heft
                 ON heft.object_key = candidate.object_key
               WHERE candidate.platform_id = p.id
                 AND candidate.kind = 'screen'
               ORDER BY heft.byte_size DESC NULLS LAST,
                 candidate.created_at DESC, candidate.id DESC
               LIMIT 3
             ) i ON true
             JOIN version_images vi
               ON vi.version_id = latest.version_id
              AND vi.image_id = i.id
             WHERE p.app_id = latest.app_id
               AND p.name = latest.platform
               AND vi.captured_at <= $2::timestamptz
               AND NOT EXISTS (
                 SELECT 1 FROM app_preview_images manual
                 WHERE manual.version_id = latest.version_id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM preview_category
                 WHERE preview_category.id = vi.image_id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM exact WHERE exact.id = vi.image_id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM curated WHERE curated.id = vi.image_id
               )
           )
           SELECT pool.*
           FROM (
             SELECT * FROM preview_category
             UNION ALL
             SELECT * FROM exact
             UNION ALL
             SELECT * FROM curated
             UNION ALL
             SELECT * FROM fast_fallback
             UNION ALL
             (
               SELECT i.id, i.image_url, i.kind, i.description, i.analysis,
                 vi.source_url AS capture_url, vi.viewport_width,
                 vi.viewport_height, vi.state_context, vi.captured_at,
                 NULL::int AS curated_rank, 1 AS source_priority,
                 heft.byte_size AS heft_bytes,
                 NULL::jsonb AS matched_facets
               FROM version_images vi
               JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
               -- Same blankness guard as fast_fallback: prefer heavier
               -- captures so a splash screen never becomes the preview.
               LEFT JOIN stored_objects heft ON heft.object_key = i.object_key
               WHERE vi.version_id = latest.version_id
                 AND vi.captured_at <= $2::timestamptz
                 AND NOT EXISTS (
                   SELECT 1 FROM app_preview_images manual
                   WHERE manual.version_id = latest.version_id
                 )
                 AND (
                   (SELECT COUNT(*) FROM preview_category)
                   + (SELECT COUNT(*) FROM exact)
                   +
                   (SELECT COUNT(*) FROM curated)
                   + (SELECT COUNT(*) FROM fast_fallback)
                 ) < 3
                 AND NOT EXISTS (
                   SELECT 1 FROM preview_category
                   WHERE preview_category.id = vi.image_id
                 )
                 AND NOT EXISTS (
                   SELECT 1 FROM exact WHERE exact.id = vi.image_id
                 )
                 AND NOT EXISTS (
                   SELECT 1 FROM curated WHERE curated.id = vi.image_id
                 )
                 AND NOT EXISTS (
                   SELECT 1
                   FROM fast_fallback
                   WHERE fast_fallback.id = vi.image_id
                 )
               ORDER BY heft.byte_size DESC NULLS LAST,
                 vi.captured_at DESC, vi.image_id DESC
               LIMIT 3
             )
           ) pool
           ORDER BY pool.source_priority, pool.curated_rank NULLS LAST,
             pool.heft_bytes DESC NULLS LAST,
             pool.captured_at DESC NULLS LAST, pool.id DESC
           LIMIT 3
         ) candidate ON true
         WHERE a.id = ANY($1::integer[])
       ),
       platform_ranked AS (
         SELECT candidates.*,
           ROW_NUMBER() OVER (
             PARTITION BY app, platform
             ORDER BY source_priority, curated_rank NULLS LAST,
               heft_bytes DESC NULLS LAST,
               captured_at DESC NULLS LAST, id DESC
           ) AS platform_rank
         FROM candidates
       ),
       ranked AS (
         SELECT platform_ranked.*,
           ROW_NUMBER() OVER (
             PARTITION BY app
             ORDER BY platform_rank, platform
           ) AS preview_rank
         FROM platform_ranked
       )
       SELECT id, app, platform, image_url, kind, description, analysis,
         icon_url, capture_url, viewport_width, viewport_height,
         state_context, captured_at, matched_facets, preview_rank::int
       FROM ranked
       WHERE preview_rank <= 3
       ORDER BY app, preview_rank`,
      [
        appIds,
        snapshotAt,
        input.platform ?? null,
        exactPreviewGroups,
        exactPreviewValues,
      ],
    ),
    readFacets(),
  ]);

  const appsById = new Map(
    (appsResult.rows as Array<Omit<PublishedCatalogAppRecord, "last_captured_at">>)
      .map((app) => [app.app_id, app] as const),
  );
  const apps = identities.flatMap((identity) => {
    const app = appsById.get(identity.app_id);
    if (!app) return [];
    return [{
      ...app,
      // Apps do not have their own created_at column. The newest published
      // version's captured_at is the durable moment the App entered the
      // catalog, and is already the key used by the latest sort above.
      created_at: new Date(identity.updated_at).toISOString(),
      last_captured_at: new Date(identity.updated_at).toISOString(),
    }];
  });
  const appOrder = new Map(identities.map(({ app }, index) => [app, index]));
  const previews = (previewsResult.rows as PublishedPreviewImage[])
    .sort((left, right) =>
      (appOrder.get(left.app) ?? Number.MAX_SAFE_INTEGER)
      - (appOrder.get(right.app) ?? Number.MAX_SAFE_INTEGER)
      || left.preview_rank - right.preview_rank
    );
  const lastIdentity = identities.at(-1);
  return {
    apps,
    previews,
    nextCursor: hasMore && lastIdentity
      ? encodeCatalogCursor(sort === "trending"
        ? {
            v: 2,
            sort,
            snapshotAt,
            updatedAt: new Date(lastIdentity.updated_at).toISOString(),
            popularityScore: lastIdentity.popularity_score,
            appId: lastIdentity.app_id,
          }
        : {
            v: 2,
            sort,
            snapshotAt,
            updatedAt: new Date(lastIdentity.updated_at).toISOString(),
            appId: lastIdentity.app_id,
          })
      : null,
    totalCount,
    facets,
  };
}

export function publishedCatalogPage(
  input: Parameters<typeof catalogPage>[0] = {},
  runQuery: DatabaseQuery = query,
  facetCache: CatalogFacetCache = catalogFacetCacheForQuery(runQuery),
): Promise<PublishedCatalogPageRecord> {
  return catalogPage(input, runQuery, facetCache, "public");
}

export function adminCatalogPage(
  input: Parameters<typeof catalogPage>[0] = {},
  runQuery: DatabaseQuery = query,
  facetCache: CatalogFacetCache = catalogFacetCacheForQuery(runQuery),
): Promise<PublishedCatalogPageRecord> {
  return catalogPage(input, runQuery, facetCache, "admin");
}

function catalogFacets(rows: readonly Record<string, unknown>[]): DiscoveryFacet[] {
  return rows.flatMap((row) => {
    const group = row.facet_group;
    const value = row.facet_value;
    const count = Number(row.count);
    const section = row.section;
    const description = row.description;
    const aliases = row.aliases;
    const sectionPosition = row.section_position === null
      || row.section_position === undefined
      ? undefined
      : Number(row.section_position);
    const position = row.pattern_position === null
      || row.pattern_position === undefined
      ? undefined
      : Number(row.pattern_position);
    if (!(FACET_GROUPS as readonly unknown[]).includes(group)
      || typeof value !== "string"
      || !Number.isInteger(count)
      || count < 0
      || (section !== null && section !== undefined && typeof section !== "string")
      || (description !== null
        && description !== undefined
        && typeof description !== "string")
      || (aliases !== null
        && aliases !== undefined
        && (!Array.isArray(aliases)
          || aliases.some((alias) => typeof alias !== "string")))
      || (sectionPosition !== undefined
        && (!Number.isInteger(sectionPosition) || sectionPosition < 1))
      || (position !== undefined && (!Number.isInteger(position) || position < 1))) {
      return [];
    }
    return [{
      group: group as PublicFacetGroup,
      value,
      count,
      ...(typeof section === "string" ? { section } : {}),
      ...(typeof description === "string" ? { description } : {}),
      ...(Array.isArray(aliases) ? { aliases: aliases as string[] } : {}),
      ...(sectionPosition === undefined ? {} : { sectionPosition }),
      ...(position === undefined ? {} : { position }),
    }];
  }).sort((left, right) =>
    left.group.localeCompare(right.group)
    || (left.sectionPosition ?? Number.MAX_SAFE_INTEGER)
      - (right.sectionPosition ?? Number.MAX_SAFE_INTEGER)
    || (left.position ?? Number.MAX_SAFE_INTEGER)
      - (right.position ?? Number.MAX_SAFE_INTEGER)
    || left.value.localeCompare(right.value)
  );
}
