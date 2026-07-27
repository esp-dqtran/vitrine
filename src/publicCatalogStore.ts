import type { QueryResult } from "pg";
import {
  query as databaseQuery,
  type PublishedPreviewImage,
} from "./db.ts";
import {
  decodeUpdatedCatalogCursor,
  encodeUpdatedCatalogCursor,
} from "./catalogCursor.ts";
import type { Category } from "./categoryStore.ts";

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
  categories: Category[];
  website_url: string | null;
  icon_url: string | null;
  accent_color: string | null;
  total_screens: number;
  available_platforms: string[];
  last_captured_at: string;
}

export interface PublishedCatalogPageRecord {
  apps: PublishedCatalogAppRecord[];
  previews: PublishedPreviewImage[];
  nextCursor: string | null;
}

function pageLimit(requested = 24): number {
  if (!Number.isFinite(requested)) return 24;
  return Math.min(Math.max(Math.trunc(requested), 1), 24);
}

export async function publishedCatalogPage(
  input: { cursor?: string; limit?: number; now?: Date } = {},
  runQuery: DatabaseQuery = query,
): Promise<PublishedCatalogPageRecord> {
  const limit = pageLimit(input.limit);
  const decoded = input.cursor
    ? decodeUpdatedCatalogCursor(input.cursor)
    : undefined;
  const snapshotAt = decoded?.snapshotAt ?? (input.now ?? new Date()).toISOString();
  const afterUpdatedAt = decoded?.updatedAt ?? null;
  const afterAppId = decoded?.appId ?? null;
  const identitiesResult = await runQuery(
     `WITH latest AS MATERIALIZED (
       SELECT DISTINCT ON (av.app_id, av.platform)
         av.id AS version_id, av.app_id, av.platform, av.screen_count, av.captured_at
       FROM app_versions av
       WHERE av.published_at IS NOT NULL
         AND av.published_at <= $1::timestamptz
       ORDER BY av.app_id, av.platform, av.published_at DESC, av.version_number DESC
     ), app_updates AS (
       SELECT latest.app_id, MAX(latest.captured_at) AS updated_at
       FROM latest
       WHERE latest.screen_count > 0
       GROUP BY latest.app_id
     ), eligible AS (
       SELECT a.id AS app_id, a.name AS app, app_updates.updated_at
       FROM app_updates
       JOIN apps a ON a.id = app_updates.app_id
       WHERE (
         $2::timestamptz IS NULL
         OR (app_updates.updated_at, a.id) < ($2::timestamptz, $3::integer)
       )
     )
     SELECT app_id, app, updated_at
     FROM eligible
     ORDER BY updated_at DESC, app_id DESC
     LIMIT $4`,
    [snapshotAt, afterUpdatedAt, afterAppId, limit + 1],
  );
  const selectedIdentities = identitiesResult.rows as Array<{
    app_id: number;
    app: string;
    updated_at: string | Date;
  }>;
  const hasMore = selectedIdentities.length > limit;
  const identities = selectedIdentities.slice(0, limit);
  if (identities.length === 0) {
    return { apps: [], previews: [], nextCursor: null };
  }
  const appIds = identities.map(({ app_id }) => app_id);

  const [appsResult, previewsResult] = await Promise.all([
    runQuery(
      `WITH latest AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform, av.screen_count
         FROM app_versions av
         WHERE av.app_id = ANY($1::integer[])
           AND av.published_at IS NOT NULL
           AND av.published_at <= $2::timestamptz
         ORDER BY av.app_id, av.platform, av.published_at DESC, av.version_number DESC
       )
       SELECT a.id AS app_id, a.name AS app, a.display_name,
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
         a.icon_url, a.accent_color,
         COALESCE(SUM(latest.screen_count), 0)::int AS total_screens,
         COALESCE(
           ARRAY_AGG(latest.platform ORDER BY latest.platform)
             FILTER (WHERE latest.screen_count > 0),
           ARRAY[]::text[]
         ) AS available_platforms
       FROM apps a
       JOIN latest ON latest.app_id = a.id
       WHERE a.id = ANY($1::integer[])
       GROUP BY a.id, a.name, a.display_name, a.website_url,
         a.icon_url, a.accent_color`,
      [appIds, snapshotAt],
    ),
    runQuery(
      `WITH latest AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform
         FROM app_versions av
         WHERE av.app_id = ANY($1::integer[])
           AND av.published_at IS NOT NULL
           AND av.published_at <= $2::timestamptz
         ORDER BY av.app_id, av.platform, av.published_at DESC, av.version_number DESC
       ),
       candidates AS (
         SELECT DISTINCT ON (a.id, latest.platform, i.id)
           i.id, a.name AS app, latest.platform, i.image_url, i.kind,
           i.description, i.analysis, a.icon_url,
           vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height,
           vi.state_context, vi.captured_at, api.rank::int AS curated_rank
         FROM apps a
         JOIN latest ON latest.app_id = a.id
         JOIN version_images vi ON vi.version_id = latest.version_id
         JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
         LEFT JOIN app_preview_images api
           ON api.version_id = latest.version_id AND api.image_id = i.id
         WHERE a.id = ANY($1::integer[])
           AND vi.captured_at <= $2::timestamptz
         ORDER BY a.id, latest.platform, i.id, api.rank NULLS LAST,
           vi.captured_at DESC NULLS LAST
       ),
       platform_ranked AS (
         SELECT candidates.*,
           ROW_NUMBER() OVER (
             PARTITION BY app, platform
             ORDER BY (curated_rank IS NULL), curated_rank NULLS LAST,
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
         state_context, captured_at, preview_rank::int
       FROM ranked
       WHERE preview_rank <= 3
       ORDER BY app, preview_rank`,
      [appIds, snapshotAt],
    ),
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
      ? encodeUpdatedCatalogCursor({
          v: 1,
          sort: "updated",
          snapshotAt,
          updatedAt: new Date(lastIdentity.updated_at).toISOString(),
          appId: lastIdentity.app_id,
        })
      : null,
  };
}
