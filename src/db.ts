import pg from "pg";
import { databasePoolOptions } from "./dbPoolConfig.ts";
import type { DesignFlow, DesignSystemSnapshot } from "./designSystem.ts";
import type { ObjectMetadata } from "./objectStore.ts";
import type { PublishedSearchSource } from "./searchProjection.ts";
import type { ScreenAnalysis } from "./screenAnalysis.ts";
import { markSnapshotReviewed, validatePublication, type AppVersionStatus, type PublicationBlocker } from "./versioning.ts";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/astryx";

export const pool = new pg.Pool({ connectionString: DATABASE_URL, ...databasePoolOptions(process.env) });

export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<R>> {
  return pool.query<R>(text, params);
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Narrow migration seam: the caller owns the surrounding transaction so startup and
// integration tests can use the exact same consolidation without nesting BEGIN/COMMIT.
export async function closePool(): Promise<void> {
  await pool.end();
}

// Upserts the app and platform rows on the way to the image, so callers keep passing
// plain names and never have to know about the ids.
export async function insertImage(
  app: string,
  platform: string,
  imageUrl: string,
  capture: { sourceUrl?: string; viewportWidth?: number; viewportHeight?: number; stateContext?: string; kind?: ImageKind } = {},
): Promise<number> {
  return withTransaction(async (client) => {
    // The app-row upsert also serializes concurrent inserts for the same app while this
    // transaction establishes its active draft and version membership.
    const appRow = await client.query<{ id: number }>(
      `INSERT INTO apps (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [app],
    );
    const appId = appRow.rows[0].id;
    const platformRow = await client.query<{ id: number }>(
      `INSERT INTO platforms (app_id, name) VALUES ($1, $2)
       ON CONFLICT (app_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [appId, platform],
    );
    const imageRow = await client.query<{ id: number }>(
      `INSERT INTO images (platform_id, image_url, kind) VALUES ($1, $2, $3)
       ON CONFLICT (platform_id, image_url) DO UPDATE SET image_url = EXCLUDED.image_url
       RETURNING id`,
      [platformRow.rows[0].id, imageUrl, capture.kind ?? "screen"],
    );
    const imageId = imageRow.rows[0].id;

    await client.query(
      `WITH next AS (
         SELECT COALESCE(MAX(version_number), 0) + 1 AS revision
         FROM app_versions WHERE app_id = $1 AND platform = $2
       )
       INSERT INTO app_versions (app_id, platform, version_number, label, status)
       SELECT $1, $2, revision, 'v' || revision, 'draft' FROM next
       WHERE NOT EXISTS (
         SELECT 1 FROM app_versions
         WHERE app_id = $1 AND platform = $2 AND status IN ('draft', 'in_review')
       )`,
      [appId, platform],
    );
    await client.query(
      `INSERT INTO version_images (version_id, image_id, source_url, viewport_width, viewport_height, state_context)
       SELECT av.id, $3, COALESCE($4, $5), $6, $7, $8
       FROM app_versions av
       WHERE av.app_id = $1 AND av.platform = $2 AND av.status IN ('draft', 'in_review')
       ORDER BY av.version_number DESC LIMIT 1
       ON CONFLICT (version_id, image_id) DO UPDATE SET
         source_url = COALESCE(EXCLUDED.source_url, version_images.source_url),
         viewport_width = COALESCE(EXCLUDED.viewport_width, version_images.viewport_width),
         viewport_height = COALESCE(EXCLUDED.viewport_height, version_images.viewport_height),
         state_context = COALESCE(EXCLUDED.state_context, version_images.state_context)`,
      [
        appId,
        platform,
        imageId,
        capture.sourceUrl ?? null,
        imageUrl,
        capture.viewportWidth ?? null,
        capture.viewportHeight ?? null,
        capture.stateContext ?? null,
      ],
    );
    return imageId;
  });
}

export async function imageExists(imageUrl: string): Promise<boolean> {
  const res = await query("SELECT 1 FROM images WHERE image_url = $1", [imageUrl]);
  return res.rowCount! > 0;
}

export async function appHasImages(app: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 LIMIT 1`,
    [app]
  );
  return res.rowCount! > 0;
}

export async function uncaptionedImages(app?: string): Promise<{ id: number; app: string; platform: string; image_url: string }[]> {
  const res = await query<{ id: number; app: string; platform: string; image_url: string }>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE i.description IS NULL
       AND ($1::text IS NULL OR a.name = $1)
     ORDER BY i.id`,
    [app ?? null]
  );
  return res.rows;
}

export async function appPlatforms(app: string): Promise<string[]> {
  const res = await query<{ name: string }>(
    `SELECT p.name
     FROM platforms p
     JOIN apps a ON a.id = p.app_id
     JOIN images i ON i.platform_id = p.id AND i.kind = 'screen'
     WHERE a.name = $1
     GROUP BY p.name
     ORDER BY CASE p.name WHEN 'web' THEN 1 WHEN 'ios' THEN 2 WHEN 'android' THEN 3 ELSE 4 END, p.name`,
    [app]
  );
  return res.rows.map(({ name }) => name);
}

export async function saveDescription(id: number, description: string): Promise<void> {
  await query("UPDATE images SET description = $1 WHERE id = $2", [description, id]);
}

export async function saveScreenAnalysis(id: number, analysis: ScreenAnalysis): Promise<void> {
  await query("UPDATE images SET description = $1, analysis = $2::jsonb WHERE id = $3", [
    analysis.description,
    JSON.stringify(analysis),
    id,
  ]);
  await query("UPDATE version_images SET state_context = $1 WHERE image_id = $2", [analysis.visibleStates.join(", ") || null, id]);
}

// Store app metadata captured from Mobbin at crawl time (icon, category). COALESCE only
// fills a null so a manual/backfilled value isn't clobbered by a later crawl that missed it.
export async function setAppMeta(app: string, meta: { iconUrl?: string | null; category?: string | null }): Promise<void> {
  await query(
    "UPDATE apps SET icon_url = COALESCE(icon_url, $2), category = COALESCE(category, $3) WHERE name = $1",
    [app, meta.iconUrl ?? null, meta.category ?? null],
  );
}

// "flow_step" is a screenshot captured via a flow's own export rather than the Screens tab —
// visually identical to a "screen" but kept distinct so it doesn't inflate the Screens count/
// listing. Evidence hydration (design-system, export) still needs to resolve both kinds.
export type ImageKind = "screen" | "ui_element" | "flow_step";

export interface CrawledImage {
  id: number;
  app: string;
  platform: string;
  image_url: string;
  kind?: ImageKind;
  description: string | null;
  analysis?: ScreenAnalysis | null;
  capture_url?: string | null;
  icon_url?: string | null;
  category?: string | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  state_context?: string | null;
  captured_at?: string | null;
}

export interface AppKnowledgeEvidenceSource {
  appId: number;
  app: string;
  platformId: number;
  platform: "ios" | "android" | "web";
  versionId: number;
  versionNumber: number;
  images: Array<CrawledImage & { object?: ObjectMetadata }>;
  flows: DesignFlow[];
}

export type AppKnowledgeEvidenceQuery = (
  text: string,
  params?: unknown[],
) => Promise<pg.QueryResult<Record<string, unknown>>>;

export async function appKnowledgeEvidenceSource(
  input: { app: string; platform: string; versionNumber: number },
  runQuery: AppKnowledgeEvidenceQuery = query,
): Promise<AppKnowledgeEvidenceSource | undefined> {
  const result = await runQuery(
    `WITH selected AS (
       SELECT a.id AS app_id, a.name AS app, p.id AS platform_id, av.platform,
         av.id AS version_id, av.version_number, av.status
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       JOIN platforms p ON p.app_id = a.id AND p.name = av.platform
       WHERE a.name = $1 AND av.platform = $2 AND av.version_number = $3
       LIMIT 1
     )
     SELECT selected.app_id, selected.app, selected.platform_id, selected.platform,
       selected.version_id, selected.version_number,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', i.id,
           'app', selected.app,
           'platform', selected.platform,
           'image_url', i.image_url,
           'kind', i.kind,
           'description', i.description,
           'analysis', i.analysis,
           'capture_url', COALESCE(vi.source_url, i.image_url),
           'viewport_width', vi.viewport_width,
           'viewport_height', vi.viewport_height,
           'state_context', vi.state_context,
           'captured_at', vi.captured_at,
           'object', CASE WHEN so.object_key IS NULL THEN NULL ELSE jsonb_build_object(
             'key', so.object_key,
             'sha256', so.sha256,
             'byteSize', so.byte_size,
             'contentType', so.content_type,
             'accessClass', so.access_class
           ) END
         ) ORDER BY i.id)
         FROM version_images vi
         JOIN images i ON i.id = vi.image_id
         LEFT JOIN stored_objects so ON so.object_key = i.object_key
         WHERE vi.version_id = selected.version_id
           AND i.platform_id = selected.platform_id
           AND i.kind IN ('screen', 'flow_step', 'ui_element')
       ), '[]'::jsonb) AS images,
       COALESCE(
         CASE WHEN selected.status IN ('draft', 'in_review') THEN af.flows ELSE afv.flows END,
         '[]'::jsonb
       ) AS flows
     FROM selected
     LEFT JOIN app_flows af
       ON af.app_id = selected.app_id AND af.platform = selected.platform
     LEFT JOIN app_flow_versions afv ON afv.version_id = selected.version_id`,
    [input.app, input.platform, input.versionNumber],
  );
  const row = result.rows[0] as {
    app_id: number;
    app: string;
    platform_id: number;
    platform: "ios" | "android" | "web";
    version_id: number;
    version_number: number;
    images: Array<CrawledImage & { object?: ObjectMetadata }>;
    flows: DesignFlow[];
  } | undefined;
  if (!row) return undefined;
  return {
    appId: Number(row.app_id),
    app: row.app,
    platformId: Number(row.platform_id),
    platform: row.platform,
    versionId: Number(row.version_id),
    versionNumber: Number(row.version_number),
    images: row.images,
    flows: row.flows,
  };
}

export interface AppMetadataRow {
  app: string;
  icon_url: string | null;
  category: string | null;
  display_name?: string | null;
  description?: string | null;
  website_url?: string | null;
  accent_color?: string | null;
  preview_version_id?: number | null;
  total_screens: number;
  total_ui_elements: number;
  total_flows: number;
  analyzed_screens: number;
  last_captured_at: string | null;
  available_platforms: string[];
}

export interface AppEvidencePage {
  rows: CrawledImage[];
  nextCursor: string | null;
}

function encodeImageCursor(id: number): string {
  return Buffer.from(String(id), "utf8").toString("base64url");
}

function decodeImageCursor(cursor: string): number {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new RangeError("invalid image cursor");
  const id = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError("invalid image cursor");
  return id;
}

export async function appMetadata(app: string, publishedOnly = false): Promise<AppMetadataRow | null> {
  try {
    const res = await query<AppMetadataRow>(
    `WITH target AS (
       SELECT id, name, icon_url, category, display_name, description, website_url, accent_color
       FROM apps WHERE name = $1
     ), latest_versions AS (
       SELECT DISTINCT ON (av.platform) av.id, av.platform
       FROM app_versions av JOIN target t ON t.id = av.app_id
       WHERE av.status = 'published'
       ORDER BY av.platform, av.version_number DESC
     ), eligible_images AS (
       SELECT i.id, i.kind, i.analysis, i.created_at AS captured_at, p.name AS platform
       FROM target t JOIN platforms p ON p.app_id = t.id JOIN images i ON i.platform_id = p.id
       WHERE $2::boolean = false
       UNION ALL
       SELECT i.id, i.kind, i.analysis, vi.captured_at, lv.platform
       FROM latest_versions lv JOIN version_images vi ON vi.version_id = lv.id
       JOIN images i ON i.id = vi.image_id
       WHERE $2::boolean = true
     ), eligible_flows AS (
       SELECT COALESCE(jsonb_array_length(af.flows), 0)::integer AS flow_count
       FROM target t JOIN app_flows af ON af.app_id = t.id
       WHERE $2::boolean = false
       UNION ALL
       SELECT COALESCE(jsonb_array_length(afv.flows), 0)::integer
       FROM latest_versions lv LEFT JOIN app_flow_versions afv ON afv.version_id = lv.id
       WHERE $2::boolean = true
     )
     SELECT t.name AS app, t.icon_url, t.category, t.display_name, t.description,
       t.website_url, t.accent_color,
       (
         SELECT wpv.id::integer
         FROM web_pages wp
         JOIN web_page_versions wpv ON wpv.page_id = wp.id
         WHERE wp.app_id = t.id AND wpv.status = 'ready'
           AND ($2::boolean = false OR EXISTS (
             SELECT 1 FROM version_images vi
             JOIN app_versions av ON av.id = vi.version_id
             WHERE vi.image_id = wpv.screenshot_image_id AND av.status = 'published'
           ))
         ORDER BY wpv.captured_at DESC NULLS LAST, wpv.id DESC
         LIMIT 1
       ) AS preview_version_id,
       COUNT(DISTINCT ei.id) FILTER (WHERE ei.kind = 'screen')::integer AS total_screens,
       COUNT(DISTINCT ei.id) FILTER (WHERE ei.kind = 'ui_element')::integer AS total_ui_elements,
       COALESCE((SELECT SUM(flow_count) FROM eligible_flows), 0)::integer AS total_flows,
       COUNT(DISTINCT ei.id) FILTER (WHERE ei.kind = 'screen' AND ei.analysis IS NOT NULL)::integer AS analyzed_screens,
       MAX(ei.captured_at) AS last_captured_at,
       COALESCE((
         SELECT array_agg(platform ORDER BY CASE platform WHEN 'web' THEN 1 WHEN 'ios' THEN 2 WHEN 'android' THEN 3 ELSE 4 END, platform)
         FROM (SELECT DISTINCT platform FROM eligible_images WHERE platform IS NOT NULL) available
       ), ARRAY[]::text[]) AS available_platforms
     FROM target t LEFT JOIN eligible_images ei ON true
     GROUP BY t.id, t.name, t.icon_url, t.category, t.display_name, t.description,
       t.website_url, t.accent_color`,
    [app, publishedOnly],
  );
    return res.rows[0] ?? null;
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code !== "42703" && code !== "42P01") throw error;
    // API startup requires current migrations. This fallback only keeps rolling deploys and
    // older local test databases readable while migration 0012 is being applied.
    return legacyAppMetadata(app, publishedOnly);
  }
}

async function legacyAppMetadata(app: string, publishedOnly: boolean): Promise<AppMetadataRow | null> {
  const res = await query<AppMetadataRow>(
    `WITH target AS (
       SELECT id, name, icon_url, category FROM apps WHERE name = $1
     ), latest_versions AS (
       SELECT DISTINCT ON (av.platform) av.id, av.platform
       FROM app_versions av JOIN target t ON t.id = av.app_id
       WHERE av.status = 'published'
       ORDER BY av.platform, av.version_number DESC
     ), eligible_images AS (
       SELECT i.id, i.kind, i.analysis, i.created_at AS captured_at, p.name AS platform
       FROM target t JOIN platforms p ON p.app_id = t.id JOIN images i ON i.platform_id = p.id
       WHERE $2::boolean = false
       UNION ALL
       SELECT i.id, i.kind, i.analysis, vi.captured_at, lv.platform
       FROM latest_versions lv JOIN version_images vi ON vi.version_id = lv.id
       JOIN images i ON i.id = vi.image_id
       WHERE $2::boolean = true
     ), eligible_flows AS (
       SELECT COALESCE(jsonb_array_length(af.flows), 0)::integer AS flow_count
       FROM target t JOIN app_flows af ON af.app_id = t.id
       WHERE $2::boolean = false
       UNION ALL
       SELECT COALESCE(jsonb_array_length(afv.flows), 0)::integer
       FROM latest_versions lv LEFT JOIN app_flow_versions afv ON afv.version_id = lv.id
       WHERE $2::boolean = true
     )
     SELECT t.name AS app, t.icon_url, t.category,
       COUNT(DISTINCT ei.id) FILTER (WHERE ei.kind = 'screen')::integer AS total_screens,
       COUNT(DISTINCT ei.id) FILTER (WHERE ei.kind = 'ui_element')::integer AS total_ui_elements,
       COALESCE((SELECT SUM(flow_count) FROM eligible_flows), 0)::integer AS total_flows,
       COUNT(DISTINCT ei.id) FILTER (WHERE ei.kind = 'screen' AND ei.analysis IS NOT NULL)::integer AS analyzed_screens,
       MAX(ei.captured_at) AS last_captured_at,
       COALESCE((
         SELECT array_agg(platform ORDER BY CASE platform WHEN 'web' THEN 1 WHEN 'ios' THEN 2 WHEN 'android' THEN 3 ELSE 4 END, platform)
         FROM (SELECT DISTINCT platform FROM eligible_images WHERE platform IS NOT NULL) available
       ), ARRAY[]::text[]) AS available_platforms
     FROM target t LEFT JOIN eligible_images ei ON true
     GROUP BY t.id, t.name, t.icon_url, t.category`,
    [app, publishedOnly],
  );
  return res.rows[0] ?? null;
}

export async function appEvidencePage(input: {
  app: string;
  kind: "screen" | "ui_element";
  platform: string;
  versionNumber?: number | null;
  cursor?: string | null;
  limit?: number;
  publishedOnly?: boolean;
}): Promise<AppEvidencePage> {
  const requestedLimit = Math.min(Math.max(Math.floor(input.limit ?? 48), 1), 48);
  const cursorId = input.cursor ? decodeImageCursor(input.cursor) : null;
  const res = await query<CrawledImage>(
    `WITH selected_version AS (
       SELECT av.id
       FROM app_versions av JOIN apps a ON a.id = av.app_id
       WHERE a.name = $1 AND av.platform = $3
         AND (($4::integer IS NOT NULL AND av.version_number = $4)
           OR ($4::integer IS NULL AND av.status = 'published'))
         AND ($5::boolean = false OR av.status = 'published')
       ORDER BY av.version_number DESC LIMIT 1
     ), eligible AS (
       SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
         a.icon_url, a.category, i.image_url AS capture_url, i.created_at AS captured_at,
         NULL::integer AS viewport_width, NULL::integer AS viewport_height, NULL::text AS state_context
       FROM apps a JOIN platforms p ON p.app_id = a.id JOIN images i ON i.platform_id = p.id
       WHERE a.name = $1 AND p.name = $3 AND i.kind = $2
         AND $4::integer IS NULL AND $5::boolean = false
       UNION ALL
       SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
         a.icon_url, a.category, COALESCE(vi.source_url, i.image_url) AS capture_url, vi.captured_at,
         vi.viewport_width, vi.viewport_height, vi.state_context
       FROM selected_version sv JOIN version_images vi ON vi.version_id = sv.id
       JOIN images i ON i.id = vi.image_id JOIN platforms p ON p.id = i.platform_id
       JOIN apps a ON a.id = p.app_id
       WHERE i.kind = $2 AND ($4::integer IS NOT NULL OR $5::boolean = true)
     )
     SELECT * FROM eligible
     WHERE ($6::integer IS NULL OR id > $6)
     ORDER BY id
     LIMIT $7`,
    [
      input.app,
      input.kind,
      input.platform,
      input.versionNumber ?? null,
      input.publishedOnly ?? false,
      cursorId,
      requestedLimit + 1,
    ],
  );
  const hasMore = res.rows.length > requestedLimit;
  const rows = hasMore ? res.rows.slice(0, requestedLimit) : res.rows;
  return {
    rows,
    nextCursor: hasMore && rows.length ? encodeImageCursor(rows[rows.length - 1].id) : null,
  };
}

export async function getVersionFlows(
  app: string,
  platform: string,
  versionNumber?: number | null,
  publishedOnly = false,
): Promise<DesignFlow[]> {
  if (versionNumber == null && !publishedOnly) return getAppFlows(app, platform);
  const res = await query<{ flows: DesignFlow[] }>(
    `SELECT COALESCE(
       CASE WHEN av.status IN ('draft', 'in_review') THEN af.flows ELSE afv.flows END,
       '[]'::jsonb
     ) AS flows
     FROM app_versions av JOIN apps a ON a.id = av.app_id
     LEFT JOIN app_flow_versions afv ON afv.version_id = av.id
     LEFT JOIN app_flows af ON af.app_id = av.app_id AND af.platform = av.platform
     WHERE a.name = $1 AND av.platform = $2
       AND (($3::integer IS NOT NULL AND av.version_number = $3)
         OR ($3::integer IS NULL AND av.status = 'published'))
       AND ($4::boolean = false OR av.status = 'published')
     ORDER BY av.version_number DESC LIMIT 1`,
    [app, platform, versionNumber ?? null, publishedOnly],
  );
  return res.rows[0]?.flows ?? [];
}

export async function flowEvidenceImages(input: {
  app: string;
  platform: string;
  versionNumber?: number | null;
  imageIds: number[];
  publishedOnly?: boolean;
}): Promise<CrawledImage[]> {
  const ids = [...new Set(input.imageIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return [];
  const res = await query<CrawledImage>(
    `WITH selected_version AS (
       SELECT av.id
       FROM app_versions av JOIN apps a ON a.id = av.app_id
       WHERE a.name = $1 AND av.platform = $2
         AND (($3::integer IS NOT NULL AND av.version_number = $3)
           OR ($3::integer IS NULL AND av.status = 'published'))
         AND ($4::boolean = false OR av.status = 'published')
       ORDER BY av.version_number DESC LIMIT 1
     )
     SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
       a.icon_url, a.category,
       COALESCE(vi.source_url, i.image_url) AS capture_url,
       COALESCE(vi.captured_at, i.created_at) AS captured_at,
       vi.viewport_width, vi.viewport_height, vi.state_context
     FROM images i JOIN platforms p ON p.id = i.platform_id JOIN apps a ON a.id = p.app_id
     LEFT JOIN selected_version sv ON true
     LEFT JOIN version_images vi ON vi.version_id = sv.id AND vi.image_id = i.id
     WHERE a.name = $1 AND p.name = $2 AND i.id = ANY($5::integer[])
       AND ((($3::integer IS NULL AND $4::boolean = false) OR vi.image_id IS NOT NULL))
     ORDER BY i.id`,
    [input.app, input.platform, input.versionNumber ?? null, input.publishedOnly ?? false, ids],
  );
  return res.rows;
}

export async function allImages(kind: ImageKind | ImageKind[] = "screen"): Promise<CrawledImage[]> {
  const kinds = Array.isArray(kind) ? kind : [kind];
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis, a.icon_url, a.category,
       i.image_url AS capture_url, i.created_at AS captured_at
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE i.kind = ANY($1::text[])
     ORDER BY i.created_at ASC`,
    [kinds]
  );
  return res.rows;
}

export interface AdminGalleryImage extends CrawledImage {
  display_name?: string | null;
  website_url?: string | null;
  accent_color?: string | null;
  total_screens: number;
  analyzed_screens: number;
  last_captured_at: string | null;
  available_platforms: string[];
  has_more?: boolean;
}

type AdminGalleryPageRow = AdminGalleryImage & { total_apps: number };

export interface AdminAppPage {
  images: AdminGalleryImage[];
  nextCursor: string | null;
  total: number;
}

export async function adminAppPage(cursor?: string, requestedLimit = 24): Promise<AdminAppPage> {
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 24, 1), 48);
  const res = await query<AdminGalleryPageRow>(
    `WITH eligible_apps AS (
       SELECT a.id, a.name, a.icon_url, a.category,
              a.display_name, a.website_url, a.accent_color,
              COUNT(*) OVER()::integer AS total_apps
       FROM apps a
       WHERE EXISTS (
         SELECT 1
         FROM platforms p
         JOIN images i ON i.platform_id = p.id AND i.kind = 'screen'
         WHERE p.app_id = a.id
       )
     ), candidate_apps AS (
       SELECT *
       FROM eligible_apps
       WHERE ($1::text IS NULL OR name > $1)
       ORDER BY name
       LIMIT ($2::integer + 1)
     ), page_apps AS (
       SELECT * FROM candidate_apps ORDER BY name LIMIT $2
     ), page_image_facts AS MATERIALIZED (
       SELECT pa.id AS app_id, p.name AS platform, i.id AS image_id,
              i.created_at, (i.analysis IS NOT NULL) AS analyzed
       FROM page_apps pa
       JOIN platforms p ON p.app_id = pa.id
       JOIN images i ON i.platform_id = p.id AND i.kind = 'screen'
     ), app_counts AS (
       SELECT app_id, COUNT(*)::integer AS total_screens,
              COUNT(*) FILTER (WHERE analyzed)::integer AS analyzed_screens,
              MAX(created_at) AS last_captured_at
       FROM page_image_facts
       GROUP BY app_id
     ), app_platforms AS (
       SELECT app_id,
              ARRAY_AGG(platform ORDER BY
                CASE platform WHEN 'web' THEN 1 WHEN 'ios' THEN 2 WHEN 'android' THEN 3 ELSE 4 END,
                platform
              ) AS available_platforms
       FROM (
         SELECT DISTINCT app_id, platform FROM page_image_facts
       ) distinct_platforms
       GROUP BY app_id
     ), ranked_preview_ids AS (
       SELECT app_id, platform, image_id,
              ROW_NUMBER() OVER (
                PARTITION BY app_id ORDER BY created_at ASC, image_id ASC
              ) AS preview_rank
       FROM page_image_facts
     ), preview_ids AS (
       SELECT app_id, platform, image_id, preview_rank
       FROM ranked_preview_ids
       WHERE preview_rank <= 5
     )
     SELECT i.id, pa.name AS app, pi.platform, i.image_url, i.kind,
            i.description, i.analysis, pa.icon_url, pa.category,
            pa.display_name, pa.website_url, pa.accent_color,
            i.image_url AS capture_url, i.created_at AS captured_at,
            c.total_screens, c.analyzed_screens, c.last_captured_at,
            pa.total_apps, ap.available_platforms,
            ((SELECT COUNT(*) FROM candidate_apps) > $2)::boolean AS has_more
     FROM preview_ids pi
     JOIN page_apps pa ON pa.id = pi.app_id
     JOIN images i ON i.id = pi.image_id
     JOIN app_counts c ON c.app_id = pi.app_id
     JOIN app_platforms ap ON ap.app_id = pi.app_id
     ORDER BY pa.name, pi.preview_rank`,
    [cursor ?? null, limit],
  );
  const lastApp = res.rows.at(-1)?.app ?? null;
  return {
    images: res.rows,
    nextCursor: res.rows[0]?.has_more && lastApp ? lastApp : null,
    total: res.rows[0]?.total_apps ?? 0,
  };
}

export async function appImages(app: string, kind: ImageKind | ImageKind[] = "screen", platform?: string): Promise<CrawledImage[]> {
  const kinds = Array.isArray(kind) ? kind : [kind];
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis, a.icon_url, a.category,
       i.image_url AS capture_url, i.created_at AS captured_at
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 AND i.kind = ANY($2::text[]) AND ($3::text IS NULL OR p.name = $3)
     ORDER BY i.created_at ASC`,
    [app, kinds, platform ?? null]
  );
  return res.rows;
}

export async function saveDesignSystem(app: string, platform: string, snapshot: DesignSystemSnapshot): Promise<void> {
  await query(
    `INSERT INTO design_systems (app_id, platform, snapshot, origin)
     SELECT id, $2, $3::jsonb, 'observed' FROM apps WHERE name = $1
     ON CONFLICT (app_id, platform) DO UPDATE
     SET snapshot = EXCLUDED.snapshot, origin = 'observed', updated_at = now()`,
    [app, platform, JSON.stringify(snapshot)]
  );
}

export async function getDesignSystem(app: string, platform: string): Promise<DesignSystemSnapshot | undefined> {
  const res = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT ds.snapshot
     FROM design_systems ds JOIN apps a ON a.id = ds.app_id
     WHERE a.name = $1 AND ds.platform = $2`,
    [app, platform]
  );
  return res.rows[0]?.snapshot;
}

export async function listDesignSystems(): Promise<DesignSystemSnapshot[]> {
  const res = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT ds.snapshot FROM design_systems ds JOIN apps a ON a.id = ds.app_id ORDER BY a.name`
  );
  return res.rows.map(({ snapshot }) => snapshot);
}

export async function saveAppFlows(app: string, platform: string, flows: DesignFlow[]): Promise<void> {
  await query(
    `INSERT INTO app_flows (app_id, platform, flows)
     SELECT id, $2, $3::jsonb FROM apps WHERE name = $1
     ON CONFLICT (app_id, platform) DO UPDATE SET flows = EXCLUDED.flows, updated_at = now()`,
    [app, platform, JSON.stringify(flows)]
  );
}

export async function getAppFlows(app: string, platform: string): Promise<DesignFlow[]> {
  const res = await query<{ flows: DesignFlow[] }>(
    `SELECT f.flows FROM app_flows f JOIN apps a ON a.id = f.app_id WHERE a.name = $1 AND f.platform = $2`,
    [app, platform]
  );
  return res.rows[0]?.flows ?? [];
}

export async function getFlowDocument(app: string, platform: string): Promise<{ body: string; updatedAt: string } | undefined> {
  const res = await query<{ body: string; updated_at: string }>(
    `SELECT d.body, d.updated_at FROM flow_documents d JOIN apps a ON a.id = d.app_id WHERE a.name = $1 AND d.platform = $2`,
    [app, platform]
  );
  const row = res.rows[0];
  return row ? { body: row.body, updatedAt: row.updated_at } : undefined;
}

export async function saveFlowDocument(app: string, platform: string, body: string, userId: number): Promise<string> {
  const res = await query<{ updated_at: string }>(
    `INSERT INTO flow_documents (app_id, platform, body, updated_by, updated_at)
     SELECT a.id, $2, $3, $4, now() FROM apps a WHERE a.name = $1
     ON CONFLICT (app_id, platform) DO UPDATE SET body = EXCLUDED.body, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING updated_at`,
    [app, platform, body, userId]
  );
  if (!res.rows[0]) throw new Error("Flow document app not found");
  return res.rows[0].updated_at;
}

export async function listAppFlowSets(): Promise<Array<{ app: string; flows: DesignFlow[] }>> {
  const res = await query<{ app: string; flows: DesignFlow[] }>(
    `SELECT a.name AS app, f.flows FROM app_flows f JOIN apps a ON a.id = f.app_id ORDER BY a.name`
  );
  return res.rows;
}

export interface AppVersion {
  id: number;
  app_id?: number;
  platform_id?: number;
  app: string;
  platform: string;
  version_number: number;
  label: string;
  source_url: string | null;
  status: AppVersionStatus;
  notes: string;
  captured_at: string;
  submitted_at: string | null;
  published_at: string | null;
  screen_count: number;
  analyzed_count: number;
  component_count: number;
  token_count: number;
  flow_count: number;
}

const versionSelect = `SELECT av.id, av.app_id, platform_identity.id AS platform_id,
  a.name AS app, av.platform, av.version_number, av.label, av.source_url, av.status,
  av.notes, av.captured_at, av.submitted_at, av.published_at,
  COALESCE(image_counts.screen_count, 0)::int AS screen_count,
  COALESCE(image_counts.analyzed_count, 0)::int AS analyzed_count,
  COALESCE(jsonb_array_length((CASE WHEN av.status IN ('draft','in_review') THEN ds.snapshot ELSE dsv.snapshot END)->'components'), 0)::int AS component_count,
  COALESCE(jsonb_array_length((CASE WHEN av.status IN ('draft','in_review') THEN ds.snapshot ELSE dsv.snapshot END)->'tokens'), 0)::int AS token_count,
  COALESCE(jsonb_array_length(CASE WHEN av.status IN ('draft','in_review') THEN af.flows ELSE afv.flows END), 0)::int AS flow_count
  FROM app_versions av JOIN apps a ON a.id = av.app_id
  JOIN platforms platform_identity ON platform_identity.app_id = av.app_id
    AND platform_identity.name = av.platform
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE i.kind = 'screen')::int AS screen_count,
      COUNT(*) FILTER (WHERE i.kind = 'screen' AND i.analysis IS NOT NULL)::int AS analyzed_count
    FROM version_images vi JOIN images i ON i.id = vi.image_id
    WHERE vi.version_id = av.id
  ) image_counts ON true
  LEFT JOIN design_system_versions dsv ON dsv.version_id = av.id
  LEFT JOIN app_flow_versions afv ON afv.version_id = av.id
  LEFT JOIN design_systems ds ON ds.app_id = av.app_id AND ds.platform = av.platform
  LEFT JOIN app_flows af ON af.app_id = av.app_id AND af.platform = av.platform`;

export async function listAppVersions(app: string, platform: string, publishedOnly = false): Promise<AppVersion[]> {
  const res = await query<AppVersion>(
    `${versionSelect} WHERE a.name = $1 AND av.platform = $2 AND ($3::boolean = false OR av.status = 'published')
     ORDER BY av.version_number DESC`,
    [app, platform, publishedOnly]
  );
  return res.rows;
}

export async function resolveAppVersion(
  app: string,
  platform: string,
  versionNumber?: number,
  publishedOnly = false,
): Promise<AppVersion | undefined> {
  const res = await query<AppVersion>(
    `${versionSelect}
     WHERE a.name = $1 AND av.platform = $2
       AND (($3::integer IS NULL AND av.status = 'published') OR av.version_number = $3)
       AND ($4::boolean = false OR av.status = 'published')
     ORDER BY av.version_number DESC LIMIT 1`,
    [app, platform, versionNumber ?? null, publishedOnly],
  );
  return res.rows[0];
}

async function appVersionById(id: number): Promise<AppVersion | undefined> {
  const res = await query<AppVersion>(
    `${versionSelect} WHERE av.id = $1`, [id]
  );
  return res.rows[0];
}

export async function createAppVersion(app: string, platform: string, userId?: number, sourceUrl?: string): Promise<AppVersion> {
  const id = await withTransaction(async (client) => {
    const appRow = await client.query<{ id: number }>(
      `INSERT INTO apps (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [app]
    );
    const appId = appRow.rows[0].id;
    const active = await client.query<{ id: number }>(
      `SELECT id FROM app_versions WHERE app_id = $1 AND platform = $2 AND status IN ('draft', 'in_review') LIMIT 1`, [appId, platform]
    );
    if (active.rowCount) throw new Error('This app already has an active draft or review version for this platform');
    const created = await client.query<{ id: number }>(
      `INSERT INTO app_versions (app_id, platform, version_number, label, source_url, status, created_by)
       SELECT $1, $2, COALESCE(MAX(version_number), 0) + 1, 'v' || (COALESCE(MAX(version_number), 0) + 1), $3, 'draft', $4
       FROM app_versions WHERE app_id = $1 AND platform = $2 RETURNING id`,
      [appId, platform, sourceUrl ?? null, userId ?? null]
    );
    const versionId = created.rows[0].id;
    await client.query(
      `INSERT INTO version_images (version_id, image_id, captured_at, source_url, viewport_width, viewport_height, state_context)
       SELECT $1, vi.image_id, now(), vi.source_url, vi.viewport_width, vi.viewport_height, vi.state_context
       FROM version_images vi JOIN app_versions prior ON prior.id = vi.version_id
       WHERE prior.app_id = $2 AND prior.platform = $3 AND prior.status = 'published'
         AND prior.version_number = (SELECT MAX(version_number) FROM app_versions WHERE app_id = $2 AND platform = $3 AND status = 'published')
       ON CONFLICT DO NOTHING`,
      [versionId, appId, platform]
    );
    return versionId;
  });
  return (await appVersionById(id))!;
}

export async function ensureActiveAppVersion(app: string, platform: string, userId?: number, sourceUrl?: string): Promise<AppVersion> {
  const id = await withTransaction(async (client) => {
    // The harmless conflict update locks this app, serializing concurrent ensure calls.
    const appRow = await client.query<{ id: number }>(
      `INSERT INTO apps (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [app],
    );
    const appId = appRow.rows[0].id;
    const active = await client.query<{ id: number }>(
      `SELECT id FROM app_versions
       WHERE app_id = $1 AND platform = $2 AND status IN ('draft', 'in_review')
       ORDER BY version_number DESC LIMIT 1`,
      [appId, platform],
    );
    if (active.rowCount) return active.rows[0].id;
    const created = await client.query<{ id: number }>(
      `INSERT INTO app_versions (app_id, platform, version_number, label, source_url, status, created_by)
       SELECT $1, $2, COALESCE(MAX(version_number), 0) + 1,
         'v' || (COALESCE(MAX(version_number), 0) + 1), $3, 'draft', $4
       FROM app_versions WHERE app_id = $1 AND platform = $2 RETURNING id`,
      [appId, platform, sourceUrl ?? null, userId ?? null],
    );
    return created.rows[0].id;
  });
  return (await appVersionById(id))!;
}

async function publicationCandidate(versionId: number) {
  const version = await appVersionById(versionId);
  if (!version) return undefined;
  const images = await query<{ id: number; kind: 'screen' | 'flow_step'; analysis: ScreenAnalysis | null }>(
    `SELECT i.id, i.kind, i.analysis FROM version_images vi JOIN images i ON i.id = vi.image_id
     WHERE vi.version_id = $1 AND i.kind IN ('screen', 'flow_step')`, [versionId]
  );
  const snapshot = await getDesignSystem(version.app, version.platform);
  const flows = await getAppFlows(version.app, version.platform);
  return { version, images: images.rows, snapshot, flows };
}

export async function getVersionPublicationBlockers(versionId: number): Promise<PublicationBlocker[]> {
  const candidate = await publicationCandidate(versionId);
  if (!candidate) return [{ code: 'screens_missing', message: 'Version not found.' }];
  const issues = await query<{ message: string }>(
    `SELECT message FROM review_issues WHERE version_id = $1 AND severity = 'blocker' AND resolved = false`, [versionId]
  );
  return [
    ...validatePublication(candidate),
    ...issues.rows.map(({ message }) => ({ code: 'invalid_evidence' as const, message })),
  ];
}

export async function submitAppVersionForReview(versionId: number, userId: number): Promise<AppVersion> {
  const blockers = await getVersionPublicationBlockers(versionId);
  if (blockers.length) throw new Error(blockers.map(({ message }) => message).join(' '));
  const res = await query<{ id: number }>(
    `UPDATE app_versions SET status = 'in_review', submitted_at = now(), reviewed_by = $2
     WHERE id = $1 AND status = 'draft' RETURNING id`, [versionId, userId]
  );
  if (!res.rowCount) throw new Error('Only a draft version can be submitted for review');
  return (await appVersionById(versionId))!;
}

export async function publishAppVersion(versionId: number, userId: number): Promise<AppVersion> {
  const outcome = await withTransaction(async (client) => {
    // READ COMMITTED is intentional: after waiting for a prior version lock holder,
    // every candidate/run query below must see what that transaction committed.
    const version = await client.query<{ app_id: number; platform: string; status: AppVersionStatus }>(
      `SELECT app_id, platform, status FROM app_versions WHERE id = $1 FOR UPDATE`,
      [versionId],
    );
    if (!version.rowCount || version.rows[0].status !== 'in_review') {
      throw new Error('Only an in-review version can be published');
    }
    const images = await client.query<{ id: number; kind: 'screen' | 'flow_step'; analysis: ScreenAnalysis | null }>(
      `SELECT i.id, i.kind, i.analysis FROM version_images vi JOIN images i ON i.id = vi.image_id
       WHERE vi.version_id = $1 AND i.kind IN ('screen', 'flow_step')`,
      [versionId],
    );
    const snapshot = await client.query<{ snapshot: DesignSystemSnapshot }>(
      `SELECT snapshot FROM design_systems WHERE app_id = $1 AND platform = $2`,
      [version.rows[0].app_id, version.rows[0].platform],
    );
    const flows = await client.query<{ flows: DesignFlow[] }>(
      `SELECT flows FROM app_flows WHERE app_id = $1 AND platform = $2`,
      [version.rows[0].app_id, version.rows[0].platform],
    );
    const issues = await client.query<{ message: string }>(
      `SELECT message FROM review_issues
       WHERE version_id = $1 AND severity = 'blocker' AND resolved = false`,
      [versionId],
    );
    const candidate = {
      images: images.rows,
      snapshot: snapshot.rows[0]?.snapshot,
      flows: flows.rows[0]?.flows ?? [],
    };
    const blockers = [
      ...validatePublication(candidate),
      ...issues.rows.map(({ message }) => ({ code: 'invalid_evidence' as const, message })),
    ];
    if (blockers.length) throw new Error(blockers.map(({ message }) => message).join(' '));

    await client.query(
      `UPDATE crawl_runs
       SET status = 'cancelled', worker_id = NULL, cancel_requested_at = COALESCE(cancel_requested_at, now()),
           finished_at = now(), updated_at = now()
       WHERE version_id = $1 AND status IN ('queued', 'interrupted')`,
      [versionId],
    );
    const running = await client.query(
      `UPDATE crawl_runs
       SET cancel_requested_at = COALESCE(cancel_requested_at, now()), updated_at = now()
       WHERE version_id = $1 AND status = 'running'`,
      [versionId],
    );
    if (running.rowCount) return { blocked: true as const };

    await client.query(
      `INSERT INTO design_system_versions (version_id, snapshot) VALUES ($1, $2::jsonb)
       ON CONFLICT (version_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, created_at = now()`,
      [versionId, JSON.stringify(markSnapshotReviewed(candidate.snapshot!))]
    );
    await client.query(
      `INSERT INTO app_flow_versions (version_id, flows) VALUES ($1, $2::jsonb)
       ON CONFLICT (version_id) DO UPDATE SET flows = EXCLUDED.flows, created_at = now()`,
      [versionId, JSON.stringify(candidate.flows)]
    );
    const updated = await client.query(
      `UPDATE app_versions SET status = 'published', published_at = now(), reviewed_by = $2
       WHERE id = $1 AND status = 'in_review'`, [versionId, userId]
    );
    if (!updated.rowCount) throw new Error('Version changed while publishing');
    return { blocked: false as const };
  });
  if (outcome.blocked) throw new Error('Version has an active crawl run; cancellation was requested');
  return (await appVersionById(versionId))!;
}

export async function getVersionDesignSystem(app: string, platform: string, versionNumber?: number): Promise<{
  version: AppVersion;
  snapshot: DesignSystemSnapshot;
  flows: DesignFlow[];
} | undefined> {
  const versions = await listAppVersions(app, platform);
  const version = versionNumber == null
    ? versions.find(({ status }) => status === 'published')
    : versions.find(({ version_number }) => version_number === versionNumber);
  if (!version) return undefined;
  if (version.status === 'draft' || version.status === 'in_review') {
    const snapshot = await getDesignSystem(app, platform);
    if (!snapshot) return undefined;
    return { version, snapshot, flows: await getAppFlows(app, platform) };
  }
  const res = await query<{ snapshot: DesignSystemSnapshot; flows: DesignFlow[] }>(
    `SELECT dsv.snapshot, COALESCE(afv.flows, '[]'::jsonb) AS flows
     FROM design_system_versions dsv LEFT JOIN app_flow_versions afv ON afv.version_id = dsv.version_id
     WHERE dsv.version_id = $1`, [version.id]
  );
  return res.rows[0] ? { version, ...res.rows[0] } : undefined;
}

export async function versionImages(app: string, platform: string, versionNumber?: number, kind: ImageKind | ImageKind[] = "screen"): Promise<CrawledImage[]> {
  const kinds = Array.isArray(kind) ? kind : [kind];
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
       vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height, vi.state_context, vi.captured_at
     FROM app_versions av JOIN apps a ON a.id = av.app_id
     JOIN version_images vi ON vi.version_id = av.id JOIN images i ON i.id = vi.image_id
     JOIN platforms p ON p.id = i.platform_id
     WHERE i.kind = ANY($4::text[]) AND a.name = $1 AND av.platform = $2 AND av.version_number = COALESCE($3, (
       SELECT MAX(latest.version_number) FROM app_versions latest WHERE latest.app_id = a.id AND latest.platform = $2 AND latest.status = 'published'
     )) ORDER BY i.id`,
    [app, platform, versionNumber ?? null, kinds]
  );
  return res.rows;
}

export async function publishedSearchSource(
  appId: number,
  platform: string,
): Promise<PublishedSearchSource | undefined> {
  const version = await query<{
    id: number;
    app_id: number;
    app: string;
    category: string | null;
    platform: string;
    published_at: string;
  }>(
    `SELECT av.id, av.app_id, a.name AS app, a.category, av.platform, av.published_at
     FROM app_versions av JOIN apps a ON a.id = av.app_id
     WHERE av.app_id = $1 AND av.platform = $2 AND av.status = 'published'
     ORDER BY av.version_number DESC LIMIT 1`,
    [appId, platform],
  );
  const selected = version.rows[0];
  if (!selected) return undefined;

  const [images, system, flows] = await Promise.all([
    query<CrawledImage>(
      `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
         vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height, vi.state_context,
         vi.captured_at, a.icon_url, a.category
       FROM version_images vi
       JOIN app_versions av ON av.id = vi.version_id
       JOIN apps a ON a.id = av.app_id
       JOIN images i ON i.id = vi.image_id
       JOIN platforms p ON p.id = i.platform_id
       WHERE vi.version_id = $1 AND i.kind IN ('screen', 'ui_element')
       ORDER BY i.id`,
      [selected.id],
    ),
    query<{ snapshot: DesignSystemSnapshot }>(
      "SELECT snapshot FROM design_system_versions WHERE version_id = $1",
      [selected.id],
    ),
    query<{ flows: DesignFlow[] }>(
      "SELECT flows FROM app_flow_versions WHERE version_id = $1",
      [selected.id],
    ),
  ]);

  return {
    version: {
      id: selected.id,
      appId: selected.app_id,
      app: selected.app,
      platform: selected.platform,
      ...(selected.category ? { category: selected.category } : {}),
      publishedAt: new Date(selected.published_at).toISOString(),
    },
    images: images.rows.map((image) => ({
      ...image,
      ...(image.captured_at
        ? { captured_at: new Date(image.captured_at).toISOString() }
        : {}),
    })),
    ...(system.rows[0] ? { system: system.rows[0].snapshot } : {}),
    flows: flows.rows[0]?.flows ?? [],
  };
}

export async function publishedImages(): Promise<CrawledImage[]> {
  const res = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
       vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height, vi.state_context, vi.captured_at
     FROM apps a JOIN app_versions av ON av.app_id = a.id
     JOIN version_images vi ON vi.version_id = av.id JOIN images i ON i.id = vi.image_id
     JOIN platforms p ON p.id = i.platform_id
     WHERE i.kind = 'screen' AND av.status = 'published' AND av.version_number = (
       SELECT MAX(latest.version_number) FROM app_versions latest WHERE latest.app_id = a.id AND latest.status = 'published'
     ) ORDER BY i.created_at`,
  );
  return res.rows;
}

export interface PublishedPreviewImage extends CrawledImage {
  preview_rank: number;
}

export async function publishedPreviewImages(): Promise<PublishedPreviewImage[]> {
  const res = await query<PublishedPreviewImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.kind, i.description, i.analysis,
       a.icon_url, a.category, vi.source_url AS capture_url, vi.viewport_width, vi.viewport_height,
       vi.state_context, vi.captured_at, api.rank::integer AS preview_rank
     FROM apps a
     JOIN LATERAL (
       SELECT av.id FROM app_versions av
       WHERE av.app_id = a.id AND av.status = 'published'
       ORDER BY av.version_number DESC LIMIT 1
     ) published ON true
     JOIN app_preview_images api ON api.version_id = published.id
     JOIN version_images vi ON vi.version_id = published.id AND vi.image_id = api.image_id
     JOIN images i ON i.id = api.image_id
     JOIN platforms p ON p.id = i.platform_id AND p.app_id = a.id
     ORDER BY a.name, api.rank`,
  );
  return res.rows;
}

export interface CatalogStats {
  apps: number;
  screens: number;
  uiElements: number;
}

// Real headline counts for the public marketing pages. Counts screens/elements in
// each app's latest published version — the same set `publishedImages()` exposes.
export async function catalogStats(): Promise<CatalogStats> {
  const res = await query<{ apps: number; screens: number; ui_elements: number }>(
    `WITH pub AS (
       SELECT av.id AS version_id, av.app_id
       FROM app_versions av
       WHERE av.status = 'published' AND av.version_number = (
         SELECT MAX(latest.version_number) FROM app_versions latest
         WHERE latest.app_id = av.app_id AND latest.status = 'published'
       )
     )
     SELECT COUNT(DISTINCT pub.app_id)::int AS apps,
       COUNT(*) FILTER (WHERE i.kind = 'screen')::int AS screens,
       COUNT(*) FILTER (WHERE i.kind = 'ui_element')::int AS ui_elements
     FROM pub
     LEFT JOIN version_images vi ON vi.version_id = pub.version_id
     LEFT JOIN images i ON i.id = vi.image_id`,
  );
  const row = res.rows[0];
  return { apps: row?.apps ?? 0, screens: row?.screens ?? 0, uiElements: row?.ui_elements ?? 0 };
}

export async function listPublishedDesignSystems(): Promise<DesignSystemSnapshot[]> {
  const res = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT dsv.snapshot FROM design_system_versions dsv JOIN app_versions av ON av.id = dsv.version_id
     WHERE av.status = 'published' AND av.version_number = (
       SELECT MAX(latest.version_number) FROM app_versions latest
       WHERE latest.app_id = av.app_id AND latest.platform = av.platform AND latest.status = 'published'
     ) ORDER BY av.app_id`
  );
  return res.rows.map(({ snapshot }) => snapshot);
}

export async function listPublishedFlowSets(): Promise<Array<{ app: string; flows: DesignFlow[] }>> {
  const res = await query<{ app: string; flows: DesignFlow[] }>(
    `SELECT a.name AS app, COALESCE(afv.flows, '[]'::jsonb) AS flows
     FROM app_versions av JOIN apps a ON a.id = av.app_id
     LEFT JOIN app_flow_versions afv ON afv.version_id = av.id
     WHERE av.status = 'published' AND av.version_number = (
       SELECT MAX(latest.version_number) FROM app_versions latest
       WHERE latest.app_id = av.app_id AND latest.platform = av.platform AND latest.status = 'published'
     ) ORDER BY a.name`
  );
  return res.rows;
}

export async function recordExport(
  userId: number,
  app: string,
  versionId: number | undefined,
  scope: unknown,
  format: string,
  filename: string,
): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO exports (user_id, app_id, version_id, scope, format, status, output_filename, completed_at)
     SELECT $1, a.id, $3, $4::jsonb, $5, 'complete', $6, now() FROM apps a WHERE a.name = $2 RETURNING id`,
    [userId, app, versionId ?? null, JSON.stringify(scope), format, filename]
  );
  return res.rows[0].id;
}

export type CollectionItemKind = "app" | "screen" | "component" | "token" | "flow" | "pattern";

export interface CollectionItem {
  id: number;
  kind: CollectionItemKind;
  app: string;
  reference_id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchCollection {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  items: CollectionItem[];
}

export interface NewCollectionItem {
  kind: CollectionItemKind;
  app: string;
  referenceId: string;
  title: string;
  notes: string;
}

export async function createCollection(userId: number, name: string, description = ""): Promise<ResearchCollection> {
  const res = await query<Omit<ResearchCollection, "items">>(
    `INSERT INTO collections (user_id, name, description) VALUES ($1, $2, $3)
     RETURNING id, name, description, created_at, updated_at`,
    [userId, name, description]
  );
  return { ...res.rows[0], items: [] };
}

export async function listCollections(userId: number): Promise<ResearchCollection[]> {
  const res = await query<ResearchCollection>(
    `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
       COALESCE(
         jsonb_agg(to_jsonb(ci) - 'collection_id' ORDER BY ci.created_at)
           FILTER (WHERE ci.id IS NOT NULL),
         '[]'::jsonb
       ) AS items
     FROM collections c
     LEFT JOIN collection_items ci ON ci.collection_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function addCollectionItem(
  userId: number,
  collectionId: number,
  item: NewCollectionItem,
): Promise<CollectionItem | undefined> {
  const res = await query<CollectionItem>(
    `INSERT INTO collection_items (collection_id, kind, app, reference_id, title, notes)
     SELECT c.id, $3, $4, $5, $6, $7 FROM collections c WHERE c.id = $2 AND c.user_id = $1
     ON CONFLICT (collection_id, kind, app, reference_id)
       DO UPDATE SET title = EXCLUDED.title, notes = EXCLUDED.notes, updated_at = now()
     RETURNING id, kind, app, reference_id, title, notes, created_at, updated_at`,
    [userId, collectionId, item.kind, item.app, item.referenceId, item.title, item.notes]
  );
  if (res.rowCount) await query("UPDATE collections SET updated_at = now() WHERE id = $1", [collectionId]);
  return res.rows[0];
}

export async function updateCollectionItemNotes(
  userId: number,
  collectionId: number,
  itemId: number,
  notes: string,
): Promise<CollectionItem | undefined> {
  const res = await query<CollectionItem>(
    `UPDATE collection_items ci SET notes = $4, updated_at = now()
     FROM collections c
     WHERE ci.id = $3 AND ci.collection_id = $2 AND c.id = ci.collection_id AND c.user_id = $1
     RETURNING ci.id, ci.kind, ci.app, ci.reference_id, ci.title, ci.notes, ci.created_at, ci.updated_at`,
    [userId, collectionId, itemId, notes]
  );
  if (res.rowCount) await query("UPDATE collections SET updated_at = now() WHERE id = $1", [collectionId]);
  return res.rows[0];
}

export async function removeCollectionItem(userId: number, collectionId: number, itemId: number): Promise<boolean> {
  const res = await query(
    `DELETE FROM collection_items ci USING collections c
     WHERE ci.id = $3 AND ci.collection_id = $2 AND c.id = ci.collection_id AND c.user_id = $1`,
    [userId, collectionId, itemId]
  );
  return Boolean(res.rowCount);
}

export async function deleteCollection(userId: number, collectionId: number): Promise<boolean> {
  const res = await query("DELETE FROM collections WHERE id = $2 AND user_id = $1", [userId, collectionId]);
  return Boolean(res.rowCount);
}

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface JobRow {
  id: number;
  parent_id: number | null;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  message: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function createJob(
  type: string,
  payload: Record<string, unknown>,
  parentId?: number
): Promise<number> {
  const res = await query<{ id: number }>(
    "INSERT INTO jobs (type, payload, parent_id) VALUES ($1, $2, $3) RETURNING id",
    [type, JSON.stringify(payload), parentId ?? null]
  );
  return res.rows[0].id;
}

export async function setJobStatus(id: number, status: JobStatus, message?: string): Promise<void> {
  await query("UPDATE jobs SET status = $1, message = $2, updated_at = now() WHERE id = $3", [
    status,
    message ?? null,
    id,
  ]);
}

export async function getJob(id: number): Promise<JobRow | undefined> {
  const res = await query<JobRow>("SELECT * FROM jobs WHERE id = $1", [id]);
  return res.rows[0];
}

export async function listJobs(limit = 100): Promise<JobRow[]> {
  const res = await query<JobRow>("SELECT * FROM jobs ORDER BY id DESC LIMIT $1", [limit]);
  return res.rows;
}
