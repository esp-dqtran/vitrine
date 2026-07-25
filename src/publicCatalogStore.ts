import type { QueryResult } from "pg";
import {
  query as databaseQuery,
  type PublishedPreviewImage,
} from "./db.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

const query: DatabaseQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

export interface PublishedCatalogAppRecord {
  app: string;
  display_name: string | null;
  category: string | null;
  website_url: string | null;
  icon_url: string | null;
  accent_color: string | null;
  total_screens: number;
  available_platforms: string[];
}

export interface PublishedCatalogPageRecord {
  apps: PublishedCatalogAppRecord[];
  previews: PublishedPreviewImage[];
  nextCursor: string | null;
}

const encodeCursor = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

function decodeCursor(value?: string): string | undefined {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  if (!decoded) return undefined;
  return Buffer.from(decoded, "utf8").toString("base64url") === value
    ? decoded
    : undefined;
}

function pageLimit(requested = 24): number {
  if (!Number.isFinite(requested)) return 24;
  return Math.min(Math.max(Math.trunc(requested), 1), 24);
}

export async function publishedCatalogPage(
  input: { cursor?: string; limit?: number } = {},
  runQuery: DatabaseQuery = query,
): Promise<PublishedCatalogPageRecord> {
  const limit = pageLimit(input.limit);
  const after = decodeCursor(input.cursor) ?? null;
  const namesResult = await runQuery(
    `WITH latest AS MATERIALIZED (
       SELECT DISTINCT ON (av.app_id, av.platform)
         av.id AS version_id, av.app_id, av.platform
       FROM app_versions av
       WHERE av.status = 'published'
       ORDER BY av.app_id, av.platform, av.version_number DESC
     )
     SELECT a.name AS app
     FROM apps a
     WHERE ($1::text IS NULL OR a.name > $1)
       AND EXISTS (
         SELECT 1
         FROM latest
         JOIN version_images vi ON vi.version_id = latest.version_id
         JOIN images i ON i.id = vi.image_id
         WHERE latest.app_id = a.id AND i.kind = 'screen'
       )
     ORDER BY a.name
     LIMIT $2`,
    [after, limit + 1],
  );
  const selectedNames = (namesResult.rows as Array<{ app: string }>).map(({ app }) => app);
  const hasMore = selectedNames.length > limit;
  const names = selectedNames.slice(0, limit);
  if (names.length === 0) return { apps: [], previews: [], nextCursor: null };

  const [appsResult, previewsResult] = await Promise.all([
    runQuery(
      `WITH latest AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform
         FROM app_versions av
         JOIN apps a ON a.id = av.app_id
         WHERE av.status = 'published' AND a.name = ANY($1::text[])
         ORDER BY av.app_id, av.platform, av.version_number DESC
       )
       SELECT a.name AS app, a.display_name, a.category, a.website_url,
         a.icon_url, a.accent_color,
         COUNT(DISTINCT i.id) FILTER (WHERE i.kind = 'screen')::int AS total_screens,
         COALESCE(
           ARRAY_AGG(DISTINCT latest.platform ORDER BY latest.platform)
             FILTER (WHERE i.kind = 'screen'),
           ARRAY[]::text[]
         ) AS available_platforms
       FROM apps a
       JOIN latest ON latest.app_id = a.id
       JOIN version_images vi ON vi.version_id = latest.version_id
       JOIN images i ON i.id = vi.image_id
       WHERE a.name = ANY($1::text[])
       GROUP BY a.id, a.name, a.display_name, a.category, a.website_url,
         a.icon_url, a.accent_color
       ORDER BY a.name`,
      [names],
    ),
    runQuery(
      `WITH latest AS MATERIALIZED (
         SELECT DISTINCT ON (av.app_id, av.platform)
           av.id AS version_id, av.app_id, av.platform
         FROM app_versions av
         JOIN apps a ON a.id = av.app_id
         WHERE av.status = 'published' AND a.name = ANY($1::text[])
         ORDER BY av.app_id, av.platform, av.version_number DESC
       ),
       candidates AS (
         SELECT DISTINCT ON (a.id, i.id)
           i.id, a.name AS app, latest.platform, i.image_url, i.kind,
           i.description, i.analysis, a.icon_url, a.category,
           vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height,
           vi.state_context, vi.captured_at, api.rank::int AS curated_rank
         FROM apps a
         JOIN latest ON latest.app_id = a.id
         JOIN version_images vi ON vi.version_id = latest.version_id
         JOIN images i ON i.id = vi.image_id AND i.kind = 'screen'
         LEFT JOIN app_preview_images api
           ON api.version_id = latest.version_id AND api.image_id = i.id
         WHERE a.name = ANY($1::text[])
         ORDER BY a.id, i.id, api.rank NULLS LAST, vi.captured_at DESC NULLS LAST
       ),
       ranked AS (
         SELECT candidates.*,
           ROW_NUMBER() OVER (
             PARTITION BY app
             ORDER BY (curated_rank IS NULL), curated_rank NULLS LAST,
               captured_at DESC NULLS LAST, id DESC
           ) AS preview_rank
         FROM candidates
       )
       SELECT id, app, platform, image_url, kind, description, analysis,
         icon_url, category, capture_url, viewport_width, viewport_height,
         state_context, captured_at, preview_rank::int
       FROM ranked
       WHERE preview_rank <= 3
       ORDER BY app, preview_rank`,
      [names],
    ),
  ]);

  return {
    apps: appsResult.rows as PublishedCatalogAppRecord[],
    previews: previewsResult.rows as PublishedPreviewImage[],
    nextCursor: hasMore ? encodeCursor(names.at(-1)!) : null,
  };
}
