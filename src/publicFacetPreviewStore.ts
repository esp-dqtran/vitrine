import type { QueryResult } from "pg";
import { query as databaseQuery } from "./db.ts";
import type {
  PublicFacetInput,
  PublicFacetPreview,
} from "./publicFacetPreview.ts";

export type FacetDatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

const query: FacetDatabaseQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

interface FacetPreviewRow {
  app: string;
  icon_url: string | null;
  media_count: number;
}

const latestPublished = `
  SELECT DISTINCT ON (av.app_id)
    av.id AS version_id, av.app_id
  FROM app_versions av
  WHERE av.status = 'published' AND av.platform = $1
  ORDER BY av.app_id, av.version_number DESC
`;

function cachedMediaSql(group: Exclude<PublicFacetInput["group"], "categories">): string {
  return `WITH latest AS MATERIALIZED (${latestPublished})
    SELECT a.name AS app, a.icon_url, COUNT(pfp.image_id)::int AS media_count
    FROM latest
    JOIN apps a ON a.id = latest.app_id
    JOIN public_facet_previews pfp
      ON pfp.version_id = latest.version_id
     AND pfp.facet_group = '${group}'
     AND pfp.facet_value = $2
    GROUP BY a.id, a.name, a.icon_url
    ORDER BY a.name
    LIMIT 1`;
}

export async function publishedFacetPreview(
  input: PublicFacetInput,
  runQuery: FacetDatabaseQuery = query,
): Promise<PublicFacetPreview | null> {
  const kind = input.group === "categories"
    ? "icon"
    : input.group === "screens"
      ? "screen"
      : input.group === "elements"
        ? "component"
        : "flow";
  const sql = input.group === "categories"
    ? `WITH latest AS MATERIALIZED (${latestPublished})
       SELECT a.name AS app, a.icon_url, 0::int AS media_count
       FROM latest
       JOIN apps a ON a.id = latest.app_id
       WHERE lower(a.category) = lower($2) AND a.icon_url IS NOT NULL
       ORDER BY a.name
       LIMIT 1`
    : cachedMediaSql(input.group);
  const result = await runQuery(sql, [input.platform, input.value]);
  const row = result.rows[0] as FacetPreviewRow | undefined;
  if (!row) return null;
  const mediaCount = kind === "flow"
    ? Math.min(Math.max(Number(row.media_count) || 0, 0), 3)
    : kind === "icon" ? 0 : 1;
  if (kind === "icon" && !row.icon_url) return null;
  if (kind !== "icon" && mediaCount === 0) return null;
  return {
    kind,
    app: row.app,
    label: input.value,
    iconUrl: row.icon_url,
    mediaCount,
  };
}
