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

function mediaText(group: "screens" | "elements"): string {
  return group === "screens"
    ? `concat_ws(' ', i.description, i.analysis->>'pageType',
        i.analysis->>'productArea', i.analysis->>'visibleStates')`
    : `concat_ws(' ', i.description, i.analysis->>'componentNames',
        i.analysis->>'layoutPatterns')`;
}

function mediaSql(input: PublicFacetInput): string {
  const kind = input.group === "screens" ? "screen" : "ui_element";
  return `WITH latest AS MATERIALIZED (${latestPublished}),
    candidate AS (
      SELECT a.name AS app, a.icon_url
      FROM latest
      JOIN apps a ON a.id = latest.app_id
      JOIN version_images vi ON vi.version_id = latest.version_id
      JOIN images i ON i.id = vi.image_id AND i.kind = '${kind}'
      JOIN stored_objects so
        ON so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
       AND so.access_class IN ('protected', 'public-preview')
      WHERE lower(${mediaText(input.group as "screens" | "elements")})
        LIKE '%' || lower($2) || '%'
      ORDER BY a.name, vi.captured_at DESC NULLS LAST, i.id DESC
      LIMIT 1
    )
    SELECT app, icon_url, 1::int AS media_count FROM candidate`;
}

const flowSql = `WITH latest AS MATERIALIZED (${latestPublished}),
  matching_flows AS (
    SELECT latest.version_id, a.id AS app_id, a.name AS app, a.icon_url,
      flow.value AS flow, flow.ordinality AS flow_ordinal
    FROM latest
    JOIN apps a ON a.id = latest.app_id
    JOIN app_flow_versions afv ON afv.version_id = latest.version_id
    CROSS JOIN LATERAL jsonb_array_elements(afv.flows) WITH ORDINALITY AS flow(value, ordinality)
    WHERE lower(concat_ws(' ', flow.value->>'title', flow.value->>'description',
      flow.value->>'tags')) LIKE '%' || lower($2) || '%'
  ),
  first_app AS (
    SELECT app_id, app, icon_url
    FROM matching_flows
    ORDER BY app, flow_ordinal
    LIMIT 1
  ),
  media AS (
    SELECT first_app.app, first_app.icon_url
    FROM first_app
    JOIN matching_flows matched ON matched.app_id = first_app.app_id
    CROSS JOIN LATERAL jsonb_array_elements(matched.flow->'steps')
      WITH ORDINALITY AS step(value, ordinality)
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(step.value->'evidence', '[]'::jsonb))
      WITH ORDINALITY AS evidence(value, ordinality)
    JOIN version_images vi
      ON vi.version_id = matched.version_id
     AND evidence.value ~ '^[1-9][0-9]*$'
     AND vi.image_id = evidence.value::int
    JOIN images i ON i.id = vi.image_id AND i.kind IN ('screen', 'flow_step')
    JOIN stored_objects so
      ON so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)
     AND so.access_class IN ('protected', 'public-preview')
    ORDER BY matched.flow_ordinal, step.ordinality, evidence.ordinality
    LIMIT 3
  )
  SELECT app, icon_url, COUNT(*)::int AS media_count
  FROM media
  GROUP BY app, icon_url`;

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
    : input.group === "flows"
      ? flowSql
      : mediaSql(input);
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
