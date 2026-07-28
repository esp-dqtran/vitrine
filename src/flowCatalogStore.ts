import type { QueryResult } from "pg";
import { query as databaseQuery } from "./db.ts";
import type { DesignFlow, EvidenceView } from "./designSystem.ts";
import type { Platform } from "./platformFromUrl.ts";

export interface FlowCatalogItem {
  category: string;
  title: string;
  count: number;
  preview: {
    appId: string;
    appName: string;
    appIconUrl: string | null;
    screenCount: number;
    flow: DesignFlow<EvidenceView>;
  };
}

export interface FlowCatalogPage {
  items: FlowCatalogItem[];
  nextCursor: string | null;
}

export type FlowCatalogQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

export class FlowCatalogCursorError extends Error {
  constructor() {
    super("invalid Flow catalog cursor");
  }
}

const query: FlowCatalogQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

const FLOW_PREVIEW_LIMIT = 6;

function pageLimit(requested = 80): number {
  if (!Number.isFinite(requested)) return 80;
  return Math.min(Math.max(Math.trunc(requested), 1), 100);
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: unknown;
    };
    if (!Number.isInteger(parsed.offset) || Number(parsed.offset) < 0) {
      throw new FlowCatalogCursorError();
    }
    return Number(parsed.offset);
  } catch (error) {
    if (error instanceof FlowCatalogCursorError) throw error;
    throw new FlowCatalogCursorError();
  }
}

export async function publishedFlowCatalogPage(
  input: {
    platform: Platform;
    query?: string;
    cursor?: string;
    limit?: number;
    order?: "grouped" | "browse";
  },
  runQuery: FlowCatalogQuery = query,
): Promise<FlowCatalogPage> {
  const limit = pageLimit(input.limit);
  const offset = decodeCursor(input.cursor);
  const search = input.query?.trim().slice(0, 120) ?? "";
  const result = await runQuery(
     `WITH latest AS MATERIALIZED (
       SELECT DISTINCT ON (av.app_id)
         av.id AS version_id,
         av.app_id,
         av.version_number
       FROM app_versions av
       WHERE av.status = 'published'
         AND av.platform = $1
       ORDER BY av.app_id, av.version_number DESC
     ), instances AS MATERIALIZED (
       SELECT
         latest.app_id,
         latest.version_id,
         a.name AS app,
         COALESCE(a.display_name, initcap(replace(a.name, '-', ' '))) AS app_name,
         a.icon_url AS app_icon_url,
         COALESCE(parent.name, 'Other Flows') AS category,
         canonical.name AS title,
         afv.id AS version_flow_id,
         afv.source_flow_id,
         afv.description,
         afv.tags,
         afv.steps
       FROM latest
       JOIN apps a ON a.id = latest.app_id
       JOIN app_flow_versions afv ON afv.version_id = latest.version_id
       JOIN app_flow_version_mappings mapping
         ON mapping.app_flow_version_id = afv.id
       JOIN flows canonical ON canonical.id = mapping.flow_id
       LEFT JOIN flows parent ON parent.id = canonical.parent_id
       WHERE (
         $2 = ''
         OR canonical.normalized_name LIKE '%' || lower($2) || '%'
         OR lower(COALESCE(parent.name, 'Other Flows')) LIKE '%' || lower($2) || '%'
       )
     ), matches AS MATERIALIZED (
       SELECT DISTINCT app_id, category, title
       FROM instances
     ), by_category AS (
       SELECT
         category,
       title,
       COUNT(*)::int AS count
       FROM matches
       GROUP BY category, title
     ), totals AS (
       SELECT title, COUNT(DISTINCT app_id)::int AS count
       FROM matches
       GROUP BY title
     ), grouped AS (
       SELECT
         (
           ARRAY_AGG(
             by_category.category
             ORDER BY
               CASE WHEN by_category.category = 'Other Flows' THEN 1 ELSE 0 END,
               by_category.count DESC,
               lower(by_category.category)
           )
         )[1] AS category,
         totals.title,
         totals.count
       FROM by_category
       JOIN totals ON totals.title = by_category.title
       GROUP BY totals.title, totals.count
     ), ranked AS (
       SELECT
         category,
         title,
         count,
         SUM(count) OVER (PARTITION BY category) AS category_count,
         ROW_NUMBER() OVER (
           PARTITION BY category
           ORDER BY count DESC, lower(title)
         ) AS category_rank
       FROM grouped
     ), paged AS (
       SELECT
         ranked.*,
         ROW_NUMBER() OVER (
           ORDER BY
             CASE WHEN ranked.category = 'Other Flows' THEN 1 ELSE 0 END,
             CASE WHEN $5 = 'browse' THEN ranked.category_rank ELSE 0 END,
             ranked.category_count DESC,
             lower(ranked.category),
             ranked.count DESC,
             lower(ranked.title)
         ) AS page_order
       FROM ranked
       ORDER BY
         CASE WHEN ranked.category = 'Other Flows' THEN 1 ELSE 0 END,
         CASE WHEN $5 = 'browse' THEN ranked.category_rank ELSE 0 END,
         ranked.category_count DESC,
         lower(ranked.category),
         ranked.count DESC,
         lower(ranked.title)
       OFFSET $3
       LIMIT $4
     ), representatives AS (
       SELECT DISTINCT ON (instances.title)
         instances.title,
         instances.version_id,
         instances.app,
         instances.app_name,
         instances.app_icon_url,
         instances.version_flow_id,
         instances.source_flow_id,
         instances.description,
         instances.tags,
         instances.steps
       FROM instances
       JOIN paged
         ON paged.title = instances.title
        AND paged.category = instances.category
       ORDER BY
         instances.title,
         (
           SELECT COUNT(*)
           FROM jsonb_array_elements(instances.steps) AS step(value)
           WHERE jsonb_array_length(COALESCE(step.value->'evidence', '[]'::jsonb)) > 0
         ) DESC,
         jsonb_array_length(instances.steps) DESC,
         lower(instances.app)
     )
     SELECT
       paged.category,
       paged.title,
       paged.count,
       representatives.version_id,
       representatives.app,
       representatives.app_name,
       representatives.app_icon_url,
       representatives.version_flow_id,
       representatives.source_flow_id,
       representatives.description,
       representatives.tags,
       representatives.steps
     FROM paged
     JOIN representatives ON representatives.title = paged.title
     ORDER BY paged.page_order`,
    [input.platform, search, offset, limit + 1, input.order === "browse" ? "browse" : "grouped"],
  );
  const rows = result.rows.map((row) => {
    const appId = String(row.app);
    const versionId = Number(row.version_id);
    const versionFlowId = Number(row.version_flow_id);
    const rawSteps = Array.isArray(row.steps) ? row.steps : [];
    const observedSteps = rawSteps.filter((step) =>
      step
      && typeof step === "object"
      && Array.isArray((step as { evidence?: unknown }).evidence)
      && (step as { evidence: unknown[] }).evidence.length > 0
    );
    const steps = observedSteps.slice(0, FLOW_PREVIEW_LIMIT).map((step, index) => {
      const label = typeof (step as { label?: unknown }).label === "string"
        ? String((step as { label: string }).label)
        : `Step ${index + 1}`;
      const mediaUrl = `/api/catalog/flow-media/${encodeURIComponent(appId)}/${input.platform}/${versionId}/${versionFlowId}/${index + 1}`;
      return {
        label,
        evidence: [{
          imageId: index + 1,
          imageUrl: mediaUrl,
          thumbnailUrl: mediaUrl,
          description: label,
        }],
      };
    });
    return {
      category: String(row.category),
      title: String(row.title),
      count: Number(row.count),
      preview: {
        appId,
        appName: String(row.app_name),
        appIconUrl: typeof row.app_icon_url === "string" ? row.app_icon_url : null,
        screenCount: observedSteps.length,
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
  });
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit),
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
  };
}
