import { query as databaseQuery } from "./db.ts";

// Declared locally rather than imported from publicCatalogStore so this module
// stays independent of that file's (much larger) surface.
type RunQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<{ rows: Array<Record<string, unknown>> }>;

// Purpose-built read for the Apps grid: platform + category filters, sorted by
// last capture, keyset-paginated.
//
// Deliberately NOT the /catalog query. That one also serves the palette, the
// project libraries and Flows, so it carries facet aggregation (~75k rows /
// 5.4MB) and a preview-screen pass (two LATERAL joins plus ~6 NOT EXISTS
// dedup anti-joins) that the grid never reads. This returns only what a card
// renders, in one round trip.
//
// The three joins here are each load-bearing:
//   latest(app_versions)  -> platform filter, the updated_at sort key, screen count
//   app_categories/categories -> the category line and the category filter
// Filtering platform via the `platforms` table instead would be simpler but
// wrong: it is a superset that includes apps with no *published* version on
// that platform (6 apps on web at time of writing).

export interface AppsListInput {
  platform?: string | null;
  category?: string | null;
  cursor?: { updatedAt: string; id: number } | null;
  limit?: number;
  snapshotAt?: string;
}

export interface AppsListRow {
  app: string;
  display_name: string | null;
  icon_url: string | null;
  accent_color: string | null;
  description: string | null;
  website_url: string | null;
  preview_object_key: string | null;
  is_updated: boolean;
  total_screens: number;
  updated_at: Date;
  categories: Array<{ id: number; name: string; slug: string }>;
  available_platforms: string[];
}

export interface AppsListPage {
  rows: AppsListRow[];
  totalCount: number;
  nextCursor: { updatedAt: string; id: number } | null;
}

const MAX_LIMIT = 48;

const SQL = `
WITH latest AS MATERIALIZED (
  SELECT DISTINCT ON (av.app_id, av.platform)
         av.app_id, av.platform, av.screen_count, av.captured_at
  FROM app_versions av
  WHERE av.published_at IS NOT NULL
    AND av.published_at <= $1::timestamptz
    AND ($2::text IS NULL OR av.platform = $2)
  ORDER BY av.app_id, av.platform, av.published_at DESC, av.version_number DESC
), rollup AS (
  SELECT app_id,
         SUM(screen_count)::int                       AS total_screens,
         date_trunc('milliseconds', MAX(captured_at)) AS updated_at,
         ARRAY_AGG(platform ORDER BY platform)        AS available_platforms
  FROM latest
  WHERE screen_count > 0
  GROUP BY app_id
), eligible AS (
  SELECT a.id, a.name, a.display_name, a.icon_url, a.accent_color,
         a.description, a.website_url, a.preview_object_key,
         r.total_screens, r.updated_at, r.available_platforms
  FROM rollup r
  JOIN apps a ON a.id = r.app_id
  WHERE ($3::text IS NULL OR EXISTS (
           SELECT 1 FROM app_categories ac
           JOIN categories c ON c.id = ac.category_id
           WHERE ac.app_id = a.id AND c.name = $3))
), totals AS (
  SELECT count(*)::int AS total_count FROM eligible
), page AS (
  -- Total is counted over eligible, before this cursor predicate, so it stays
  -- the full result size rather than "rows remaining after the cursor".
  SELECT * FROM eligible
  WHERE ($4::timestamptz IS NULL
         OR (updated_at, id) < ($4::timestamptz, $5::int))
  ORDER BY updated_at DESC, id DESC
  LIMIT $6
)
SELECT page.id, page.name AS app, page.display_name, page.icon_url,
       page.accent_color, page.description, page.website_url,
       -- Prefer the capture belonging to the platform being browsed: an app on
       -- both Android and iOS would otherwise show the same iOS screenshot on
       -- both tabs. Falls back to the app-level preview when the platform has
       -- none, and when no platform filter is applied.
       COALESCE((
         SELECT pl.preview_object_key FROM platforms pl
         WHERE pl.app_id = page.id AND pl.name = $2::text
           AND pl.preview_object_key IS NOT NULL
         LIMIT 1
       ), page.preview_object_key) AS preview_object_key,
       page.total_screens, page.updated_at, page.available_platforms,
       totals.total_count,
       -- More than one capture means we have re-crawled this App since it
       -- first landed, which is what the card's badge distinguishes.
       (SELECT count(*) > 1 FROM app_versions av WHERE av.app_id = page.id) AS is_updated,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
                          ORDER BY lower(c.name), c.id)
         FROM app_categories ac
         JOIN categories c ON c.id = ac.category_id
         WHERE ac.app_id = page.id
       ), '[]'::jsonb) AS categories
FROM page CROSS JOIN totals
ORDER BY page.updated_at DESC, page.id DESC`;

export async function publishedAppsPage(
  input: AppsListInput = {},
  runQuery: RunQuery = databaseQuery as unknown as RunQuery,
): Promise<AppsListPage> {
  const limit = Math.min(Math.max(input.limit ?? 24, 1), MAX_LIMIT);
  const result = await runQuery(SQL, [
    input.snapshotAt ?? new Date().toISOString(),
    input.platform ?? null,
    input.category ?? null,
    input.cursor?.updatedAt ?? null,
    input.cursor?.id ?? null,
    limit + 1,
  ]);

  const all = result.rows as Array<Record<string, unknown>>;
  const totalCount = Number(all[0]?.total_count ?? 0);
  const hasMore = all.length > limit;
  const rows = (hasMore ? all.slice(0, limit) : all) as unknown as Array<
    AppsListRow & { id: number }
  >;
  const last = rows[rows.length - 1];

  return {
    rows: rows as unknown as AppsListRow[],
    totalCount,
    nextCursor: hasMore && last
      ? { updatedAt: new Date(last.updated_at).toISOString(), id: last.id }
      : null,
  };
}
