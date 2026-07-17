import { pathToFileURL } from "node:url";
import pg, { type PoolClient } from "pg";

const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/astryx";
const BATCH_SIZE = 200;

export function chunks<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error("Batch size must be a positive integer");
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export function assertDifferentDatabases(sourceUrl: string, targetUrl: string): void {
  if (sourceUrl === targetUrl) throw new Error("Source and target databases must be different");
}

export function missingKeys(source: readonly string[], target: readonly string[]): string[] {
  const targetKeys = new Set(target);
  return [...new Set(source)].filter((key) => !targetKeys.has(key)).sort();
}

export interface CatalogKeySnapshot {
  apps: string[];
  platforms: string[];
  images: string[];
  objects: string[];
  flows: string[];
}

type CatalogCounts = Record<keyof CatalogKeySnapshot, number>;

const counts = (snapshot: CatalogKeySnapshot): CatalogCounts => ({
  apps: new Set(snapshot.apps).size,
  platforms: new Set(snapshot.platforms).size,
  images: new Set(snapshot.images).size,
  objects: new Set(snapshot.objects).size,
  flows: new Set(snapshot.flows).size,
});

export function auditSnapshots(source: CatalogKeySnapshot, target: CatalogKeySnapshot): {
  source: CatalogCounts;
  target: CatalogCounts;
  missing: CatalogCounts;
} {
  return {
    source: counts(source),
    target: counts(target),
    missing: {
      apps: missingKeys(source.apps, target.apps).length,
      platforms: missingKeys(source.platforms, target.platforms).length,
      images: missingKeys(source.images, target.images).length,
      objects: missingKeys(source.objects, target.objects).length,
      flows: missingKeys(source.flows, target.flows).length,
    },
  };
}

type JsonObject = Record<string, unknown>;

export function mergeFlowArrays(target: unknown, source: unknown): unknown[] {
  const targetFlows = Array.isArray(target) ? target : [];
  const sourceFlows = Array.isArray(source) ? source : [];
  const sourceById = new Map(
    sourceFlows
      .filter((flow): flow is JsonObject => Boolean(flow) && typeof flow === "object" && !Array.isArray(flow))
      .filter((flow) => typeof flow.id === "string")
      .map((flow) => [flow.id as string, flow]),
  );
  const merged = targetFlows.map((flow) => {
    if (!flow || typeof flow !== "object" || Array.isArray(flow)) return flow;
    const id = (flow as JsonObject).id;
    if (typeof id !== "string") return flow;
    const replacement = sourceById.get(id);
    if (replacement) sourceById.delete(id);
    return replacement ?? flow;
  });
  return [...merged, ...sourceById.values()];
}

export interface ObjectMetadataRow {
  object_key: string;
  sha256: string;
  byte_size: string | number;
  content_type: string;
  access_class: string;
  created_at?: string | Date;
}

export function sameObjectMetadata(left: ObjectMetadataRow, right: ObjectMetadataRow): boolean {
  return left.object_key === right.object_key
    && sameObjectContent(left, right);
}

export function sameObjectContent(left: ObjectMetadataRow, right: ObjectMetadataRow): boolean {
  return left.sha256 === right.sha256
    && Number(left.byte_size) === Number(right.byte_size)
    && left.content_type === right.content_type
    && left.access_class === right.access_class;
}

interface AppRow {
  name: string;
  icon_url: string | null;
  category: string | null;
}

interface PlatformRow {
  app: string;
  platform: string;
}

interface ImageRow {
  app: string;
  platform: string;
  image_url: string;
  description: string | null;
  analysis: unknown;
  kind: string;
  created_at: string | Date;
  object_key: string | null;
  thumbnail_object_key: string | null;
  captured_at: string | Date | null;
  source_url: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  state_context: string | null;
}

interface FlowRow {
  app: string;
  platform: string;
  flows: unknown;
  updated_at: string | Date;
}

interface CatalogRows {
  apps: AppRow[];
  platforms: PlatformRow[];
  images: ImageRow[];
  objects: ObjectMetadataRow[];
  flows: FlowRow[];
}

type Queryable = Pick<pg.Pool, "query"> | Pick<PoolClient, "query">;
const naturalKey = (...parts: string[]) => JSON.stringify(parts);

function snapshot(rows: CatalogRows): CatalogKeySnapshot {
  return {
    apps: rows.apps.map(({ name }) => name),
    platforms: rows.platforms.map(({ app, platform }) => naturalKey(app, platform)),
    images: rows.images.map(({ app, platform, image_url }) => naturalKey(app, platform, image_url)),
    objects: rows.objects.map(({ object_key }) => object_key),
    flows: rows.flows.map(({ app, platform }) => naturalKey(app, platform)),
  };
}

async function loadCatalog(database: Queryable, includeUnreferencedObjects = false): Promise<CatalogRows> {
  const objectFilter = includeUnreferencedObjects ? "" : `WHERE object_key IN (
         SELECT object_key FROM images WHERE object_key IS NOT NULL
         UNION
         SELECT thumbnail_object_key FROM images WHERE thumbnail_object_key IS NOT NULL
       )`;
  const [apps, platforms, images, objects, flows] = await Promise.all([
    database.query<AppRow>("SELECT name, icon_url, category FROM apps ORDER BY name"),
    database.query<PlatformRow>(
      `SELECT a.name AS app, p.name AS platform
       FROM platforms p JOIN apps a ON a.id = p.app_id
       ORDER BY a.name, p.name`,
    ),
    database.query<ImageRow>(
      `WITH capture AS MATERIALIZED (
         SELECT DISTINCT ON (vi.image_id)
           vi.image_id, vi.captured_at, vi.source_url, vi.viewport_width,
           vi.viewport_height, vi.state_context
         FROM version_images vi
         JOIN app_versions av ON av.id = vi.version_id
         WHERE av.status IN ('draft', 'in_review')
         ORDER BY vi.image_id, av.version_number DESC
       )
       SELECT a.name AS app, p.name AS platform, i.image_url, i.description, i.analysis,
         i.kind, i.created_at, i.object_key, i.thumbnail_object_key,
         capture.captured_at, capture.source_url, capture.viewport_width,
         capture.viewport_height, capture.state_context
       FROM images i
       JOIN platforms p ON p.id = i.platform_id
       JOIN apps a ON a.id = p.app_id
       LEFT JOIN capture ON capture.image_id = i.id
       ORDER BY a.name, p.name, i.image_url`,
    ),
    database.query<ObjectMetadataRow>(
      `SELECT object_key, sha256, byte_size, content_type, access_class, created_at
       FROM stored_objects
       ${objectFilter}
       ORDER BY object_key`,
    ),
    database.query<FlowRow>(
      `SELECT a.name AS app, f.platform, f.flows, f.updated_at
       FROM app_flows f JOIN apps a ON a.id = f.app_id
       ORDER BY a.name, f.platform`,
    ),
  ]);
  return { apps: apps.rows, platforms: platforms.rows, images: images.rows, objects: objects.rows, flows: flows.rows };
}

function assertNoPreflightConflicts(source: CatalogRows, target: CatalogRows): void {
  const sourceObjects = new Map(source.objects.map((row) => [row.object_key, row]));
  const targetObjects = new Map(target.objects.map((row) => [row.object_key, row]));
  for (const object of source.objects) {
    const existing = targetObjects.get(object.object_key);
    if (existing && !sameObjectMetadata(existing, object)) {
      throw new Error(`Object key already exists with different metadata: ${object.object_key}`);
    }
  }

  const targetImages = new Map(
    target.images.map((row) => [naturalKey(row.app, row.platform, row.image_url), row]),
  );
  for (const image of source.images) {
    const existing = targetImages.get(naturalKey(image.app, image.platform, image.image_url));
    if (!existing) continue;
    if (existing.object_key && image.object_key && existing.object_key !== image.object_key) {
      const sourceObject = sourceObjects.get(image.object_key);
      const targetObject = targetObjects.get(existing.object_key);
      if (!sourceObject || !targetObject || !sameObjectContent(sourceObject, targetObject)) {
        throw new Error(`Image already points to different full-object content: ${image.app}/${image.platform}/${image.image_url}`);
      }
    }
    if (existing.thumbnail_object_key && image.thumbnail_object_key
      && existing.thumbnail_object_key !== image.thumbnail_object_key) {
      const sourceObject = sourceObjects.get(image.thumbnail_object_key);
      const targetObject = targetObjects.get(existing.thumbnail_object_key);
      if (!sourceObject || !targetObject || !sameObjectContent(sourceObject, targetObject)) {
        throw new Error(`Image already points to different thumbnail content: ${image.app}/${image.platform}/${image.image_url}`);
      }
    }
  }
}

async function mergeApps(client: PoolClient, rows: AppRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    await client.query(
      `INSERT INTO apps (name, icon_url, category)
       SELECT name, icon_url, category
       FROM jsonb_to_recordset($1::jsonb) AS x(name text, icon_url text, category text)
       ON CONFLICT (name) DO UPDATE SET
         icon_url = COALESCE(apps.icon_url, EXCLUDED.icon_url),
         category = COALESCE(apps.category, EXCLUDED.category)`,
      [JSON.stringify(batch)],
    );
  }
}

async function mergePlatforms(client: PoolClient, rows: PlatformRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    await client.query(
      `INSERT INTO platforms (app_id, name)
       SELECT a.id, x.platform
       FROM jsonb_to_recordset($1::jsonb) AS x(app text, platform text)
       JOIN apps a ON a.name = x.app
       ON CONFLICT (app_id, name) DO NOTHING`,
      [JSON.stringify(batch)],
    );
  }
}

async function mergeObjects(client: PoolClient, rows: ObjectMetadataRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    await client.query(
      `INSERT INTO stored_objects
         (object_key, sha256, byte_size, content_type, access_class, created_at)
       SELECT object_key, sha256, byte_size, content_type, access_class, COALESCE(created_at, now())
       FROM jsonb_to_recordset($1::jsonb) AS x(
         object_key text, sha256 text, byte_size bigint, content_type text,
         access_class text, created_at timestamptz
       )
       ON CONFLICT (object_key) DO NOTHING`,
      [JSON.stringify(batch)],
    );
  }
}

async function mergeImages(client: PoolClient, rows: ImageRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    await client.query(
      `INSERT INTO images
         (platform_id, image_url, description, analysis, kind, created_at, object_key, thumbnail_object_key)
       SELECT p.id, x.image_url, x.description, x.analysis, COALESCE(x.kind, 'screen'),
         COALESCE(x.created_at, now()), x.object_key, x.thumbnail_object_key
       FROM jsonb_to_recordset($1::jsonb) AS x(
         app text, platform text, image_url text, description text, analysis jsonb,
         kind text, created_at timestamptz, object_key text, thumbnail_object_key text,
         captured_at timestamptz, source_url text, viewport_width integer,
         viewport_height integer, state_context text
       )
       JOIN apps a ON a.name = x.app
       JOIN platforms p ON p.app_id = a.id AND p.name = x.platform
       ON CONFLICT (platform_id, image_url) DO UPDATE SET
         description = COALESCE(images.description, EXCLUDED.description),
         analysis = COALESCE(images.analysis, EXCLUDED.analysis),
         object_key = COALESCE(images.object_key, EXCLUDED.object_key),
         thumbnail_object_key = COALESCE(images.thumbnail_object_key, EXCLUDED.thumbnail_object_key)`,
      [JSON.stringify(batch)],
    );
  }
}

async function ensureDraftVersions(client: PoolClient, rows: PlatformRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    await client.query(
      `WITH requested AS (
         SELECT DISTINCT app, platform
         FROM jsonb_to_recordset($1::jsonb) AS x(app text, platform text)
       ), resolved AS (
         SELECT a.id AS app_id, requested.platform
         FROM requested JOIN apps a ON a.name = requested.app
       )
       INSERT INTO app_versions (app_id, platform, version_number, label, status)
       SELECT resolved.app_id, resolved.platform, next.revision, 'v' || next.revision, 'draft'
       FROM resolved
       CROSS JOIN LATERAL (
         SELECT COALESCE(MAX(version_number), 0) + 1 AS revision
         FROM app_versions
         WHERE app_id = resolved.app_id AND platform = resolved.platform
       ) next
       WHERE NOT EXISTS (
         SELECT 1 FROM app_versions
         WHERE app_id = resolved.app_id AND platform = resolved.platform
           AND status IN ('draft', 'in_review')
       )
       ON CONFLICT (app_id, platform, version_number) DO NOTHING`,
      [JSON.stringify(batch)],
    );
  }
}

async function mergeVersionImages(client: PoolClient, rows: ImageRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    await client.query(
      `INSERT INTO version_images
         (version_id, image_id, captured_at, source_url, viewport_width, viewport_height, state_context)
       SELECT active.id, i.id, COALESCE(x.captured_at, x.created_at, now()),
         COALESCE(x.source_url, x.image_url), x.viewport_width, x.viewport_height, x.state_context
       FROM jsonb_to_recordset($1::jsonb) AS x(
         app text, platform text, image_url text, description text, analysis jsonb,
         kind text, created_at timestamptz, object_key text, thumbnail_object_key text,
         captured_at timestamptz, source_url text, viewport_width integer,
         viewport_height integer, state_context text
       )
       JOIN apps a ON a.name = x.app
       JOIN platforms p ON p.app_id = a.id AND p.name = x.platform
       JOIN images i ON i.platform_id = p.id AND i.image_url = x.image_url
       JOIN LATERAL (
         SELECT id FROM app_versions
         WHERE app_id = a.id AND platform = x.platform AND status IN ('draft', 'in_review')
         ORDER BY version_number DESC LIMIT 1
       ) active ON true
       ON CONFLICT (version_id, image_id) DO UPDATE SET
         captured_at = LEAST(version_images.captured_at, EXCLUDED.captured_at),
         source_url = COALESCE(version_images.source_url, EXCLUDED.source_url),
         viewport_width = COALESCE(version_images.viewport_width, EXCLUDED.viewport_width),
         viewport_height = COALESCE(version_images.viewport_height, EXCLUDED.viewport_height),
         state_context = COALESCE(version_images.state_context, EXCLUDED.state_context)`,
      [JSON.stringify(batch)],
    );
  }
}

async function mergeFlows(client: PoolClient, rows: FlowRow[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    const pairs = batch.map(({ app, platform }) => ({ app, platform }));
    const existing = await client.query<FlowRow>(
      `SELECT a.name AS app, f.platform, f.flows, f.updated_at
       FROM jsonb_to_recordset($1::jsonb) AS x(app text, platform text)
       JOIN apps a ON a.name = x.app
       JOIN app_flows f ON f.app_id = a.id AND f.platform = x.platform`,
      [JSON.stringify(pairs)],
    );
    const existingByKey = new Map(
      existing.rows.map((row) => [naturalKey(row.app, row.platform), row.flows]),
    );
    const merged = batch.map((row) => ({
      ...row,
      flows: mergeFlowArrays(existingByKey.get(naturalKey(row.app, row.platform)), row.flows),
    }));
    await client.query(
      `INSERT INTO app_flows (app_id, platform, flows, updated_at)
       SELECT a.id, x.platform, x.flows, COALESCE(x.updated_at, now())
       FROM jsonb_to_recordset($1::jsonb) AS x(
         app text, platform text, flows jsonb, updated_at timestamptz
       )
       JOIN apps a ON a.name = x.app
       ON CONFLICT (app_id, platform) DO UPDATE SET
         flows = EXCLUDED.flows,
         updated_at = GREATEST(app_flows.updated_at, EXCLUDED.updated_at)`,
      [JSON.stringify(merged)],
    );
  }
}

async function applyMerge(target: pg.Pool, source: CatalogRows): Promise<void> {
  const client = await target.connect();
  try {
    await client.query("BEGIN");
    await mergeApps(client, source.apps);
    await mergePlatforms(client, source.platforms);
    await mergeObjects(client, source.objects);
    await mergeImages(client, source.images);
    await ensureDraftVersions(client, source.platforms);
    await mergeVersionImages(client, source.images);
    await mergeFlows(client, source.flows);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function hasMissing(audit: ReturnType<typeof auditSnapshots>): boolean {
  return Object.values(audit.missing).some((value) => value !== 0);
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Pass exactly one of --dry-run or --apply");

  const sourceUrl = process.env.SOURCE_DATABASE_URL ?? LOCAL_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) throw new Error("DATABASE_URL is required for the target database");
  assertDifferentDatabases(sourceUrl, targetUrl);

  const sourcePool = new pg.Pool({ connectionString: sourceUrl, max: 2 });
  const targetPool = new pg.Pool({ connectionString: targetUrl, max: 2 });
  try {
    console.error("Loading source and target catalog metadata...");
    const [sourceRows, targetRows] = await Promise.all([loadCatalog(sourcePool), loadCatalog(targetPool, true)]);
    assertNoPreflightConflicts(sourceRows, targetRows);
    const before = auditSnapshots(snapshot(sourceRows), snapshot(targetRows));
    if (dryRun) {
      console.log(JSON.stringify({ mode: "dry-run", before }, null, 2));
      return;
    }

    console.error("Applying additive catalog merge in one transaction...");
    await applyMerge(targetPool, sourceRows);
    console.error("Reloading target for post-merge audit...");
    const afterRows = await loadCatalog(targetPool, true);
    const after = auditSnapshots(snapshot(sourceRows), snapshot(afterRows));
    if (hasMissing(after)) throw new Error(`Post-merge audit found missing records: ${JSON.stringify(after.missing)}`);
    console.log(JSON.stringify({ mode: "apply", before, after }, null, 2));
  } finally {
    await Promise.allSettled([sourcePool.end(), targetPool.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
