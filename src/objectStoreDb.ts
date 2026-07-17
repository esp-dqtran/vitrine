import type { PoolClient, QueryResult } from "pg";
import { query as databaseQuery } from "./db.ts";
import { validateObjectMetadata, type ObjectAccessClass, type ObjectMetadata, type StoredContentType } from "./objectStore.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

const query: DatabaseQuery = (sql, values) => databaseQuery(sql, values ? [...values] : undefined);

interface MetadataRow extends Record<string, unknown> {
  object_key: string;
  sha256: string;
  byte_size: string | number;
  content_type: StoredContentType;
  access_class: ObjectAccessClass;
}

function metadataFrom(row: MetadataRow | undefined): ObjectMetadata | undefined {
  if (!row) return undefined;
  const byteSize = Number(row.byte_size);
  const metadata: ObjectMetadata = {
    key: row.object_key,
    sha256: row.sha256,
    byteSize,
    contentType: row.content_type,
    accessClass: row.access_class,
  };
  try {
    validateObjectMetadata(metadata);
  } catch (error) {
    throw new Error("Invalid stored object metadata", { cause: error });
  }
  return metadata;
}

function sameObjectContent(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

const METADATA_COLUMNS = `so.object_key, so.sha256, so.byte_size,
  so.content_type, so.access_class`;

export async function attachImageObject(
  client: PoolClient,
  input: { imageId: number; metadata: ObjectMetadata },
): Promise<void> {
  const { metadata } = input;
  validateObjectMetadata(metadata);
  if (!Number.isSafeInteger(input.imageId) || input.imageId <= 0) throw new Error("Invalid image ID");
  await client.query("BEGIN");
  try {
    const stored = await client.query(
      `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
       WHERE stored_objects.sha256 = EXCLUDED.sha256
         AND stored_objects.byte_size = EXCLUDED.byte_size
         AND stored_objects.content_type = EXCLUDED.content_type
         AND stored_objects.access_class = EXCLUDED.access_class
       RETURNING object_key`,
      [metadata.key, metadata.sha256, metadata.byteSize, metadata.contentType, metadata.accessClass],
    );
    if (stored.rowCount !== 1) throw new Error("Object key already exists with different metadata");

    const associated = await client.query(
      `UPDATE images SET object_key = $2
       WHERE id = $1 AND (object_key IS NULL OR object_key = $2)
       RETURNING id`,
      [input.imageId, metadata.key],
    );
    if (associated.rowCount !== 1) {
      const existing = await client.query<MetadataRow>(
        `SELECT ${METADATA_COLUMNS}
         FROM images i JOIN stored_objects so ON so.object_key = i.object_key
         WHERE i.id = $1`,
        [input.imageId],
      );
      const attached = metadataFrom(existing.rows[0]);
      if (!attached || !sameObjectContent(attached, metadata)) {
        throw new Error("Image not found or already attached to another object");
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

// Thumbnails are a serving optimization, not a distinct access-controlled object: joining on
// COALESCE(thumbnail_object_key, object_key) when a thumbnail was requested means callers get
// the small version when one exists and transparently fall back to full-res otherwise — no
// separate "does it have a thumbnail" branch needed at the call site.
const imageObjectJoin = (variant: "full" | "thumb") => variant === "thumb"
  ? "so.object_key = COALESCE(i.thumbnail_object_key, i.object_key)"
  : "so.object_key = i.object_key";

export async function entitledImageObject(
  input: { userId: number; app: string; hash: string; variant?: "full" | "thumb" },
  runQuery: DatabaseQuery = query,
): Promise<ObjectMetadata | undefined> {
  const result = await runQuery(
    `SELECT ${METADATA_COLUMNS}
     FROM images i
     JOIN stored_objects so ON ${imageObjectJoin(input.variant ?? "full")}
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     JOIN LATERAL (
       SELECT av.id FROM app_versions av
       WHERE av.app_id = a.id AND av.status = 'published'
       ORDER BY av.version_number DESC LIMIT 1
     ) published ON true
     JOIN version_images vi ON vi.version_id = published.id AND vi.image_id = i.id
     WHERE a.name = $2
       AND i.image_url IN ('mobbin-bulk:' || $3, 'capture:' || $3)
       AND so.access_class IN ('protected', 'public-preview')
       AND (
         EXISTS (
           SELECT 1 FROM users u WHERE u.id = $1 AND u.role = 'admin' AND u.active = true
         )
         OR
         EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s.user_id = $1 AND (
             s.status = 'active'
             OR (s.status = 'past_due' AND s.grace_expires_at > now())
           )
         )
         OR EXISTS (
           SELECT 1 FROM free_app_unlocks u
           WHERE u.user_id = $1 AND u.app_id = a.id
         )
       )
     LIMIT 1`,
    [input.userId, input.app, input.hash],
  );
  return metadataFrom(result.rows[0] as MetadataRow | undefined);
}

export async function adminImageObject(
  input: { app: string; hash: string; variant?: "full" | "thumb" },
  runQuery: DatabaseQuery = query,
): Promise<ObjectMetadata | undefined> {
  const result = await runQuery(
    `SELECT ${METADATA_COLUMNS}
     FROM images i
     JOIN stored_objects so ON ${imageObjectJoin(input.variant ?? "full")}
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1
       AND i.image_url IN ('mobbin-bulk:' || $2, 'capture:' || $2)
       AND so.access_class IN ('protected', 'public-preview', 'internal')
     LIMIT 1`,
    [input.app, input.hash],
  );
  return metadataFrom(result.rows[0] as MetadataRow | undefined);
}

export async function attachThumbnailObject(
  client: PoolClient,
  input: { imageId: number; metadata: ObjectMetadata },
): Promise<void> {
  const { metadata } = input;
  validateObjectMetadata(metadata);
  if (!Number.isSafeInteger(input.imageId) || input.imageId <= 0) throw new Error("Invalid image ID");
  await client.query("BEGIN");
  try {
    const stored = await client.query(
      `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
       WHERE stored_objects.sha256 = EXCLUDED.sha256
         AND stored_objects.byte_size = EXCLUDED.byte_size
         AND stored_objects.content_type = EXCLUDED.content_type
         AND stored_objects.access_class = EXCLUDED.access_class
       RETURNING object_key`,
      [metadata.key, metadata.sha256, metadata.byteSize, metadata.contentType, metadata.accessClass],
    );
    if (stored.rowCount !== 1) throw new Error("Object key already exists with different metadata");

    const associated = await client.query(
      `UPDATE images SET thumbnail_object_key = $2 WHERE id = $1 RETURNING id`,
      [input.imageId, metadata.key],
    );
    if (associated.rowCount !== 1) throw new Error("Image not found");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function imageObjectById(
  imageId: number,
  runQuery: DatabaseQuery = query,
): Promise<ObjectMetadata | undefined> {
  if (!Number.isSafeInteger(imageId) || imageId <= 0) throw new Error("Invalid image ID");
  const result = await runQuery(
    `SELECT ${METADATA_COLUMNS}
     FROM stored_objects so
     JOIN images i ON i.object_key = so.object_key
     WHERE i.id = $1
     LIMIT 1`,
    [imageId],
  );
  return metadataFrom(result.rows[0] as MetadataRow | undefined);
}

export async function crawlFailureObject(
  input: { runId: string; flowId: string; stepId: string },
  runQuery: DatabaseQuery = query,
): Promise<ObjectMetadata | undefined> {
  if (!/^[1-9][0-9]*$/.test(input.runId) || !input.flowId || !input.stepId) {
    throw new Error("Invalid crawl failure identity");
  }
  const result = await runQuery(
    `SELECT ${METADATA_COLUMNS}
     FROM stored_objects so
     JOIN crawl_run_steps crs ON crs.failure_object_key = so.object_key
     WHERE crs.run_id = $1 AND crs.flow_id = $2 AND crs.step_id = $3
       AND crs.status = 'failed'
       AND so.content_type = 'image/png'
       AND so.access_class = 'internal'
     LIMIT 1`,
    [input.runId, input.flowId, input.stepId],
  );
  return metadataFrom(result.rows[0] as MetadataRow | undefined);
}

export async function publishedPreviewObject(
  input: { app: string; rank: number },
  runQuery: DatabaseQuery = query,
): Promise<ObjectMetadata | undefined> {
  if (!Number.isInteger(input.rank) || input.rank < 1 || input.rank > 3) {
    throw new Error("Preview rank must be an integer from 1 to 3");
  }
  const result = await runQuery(
    `SELECT ${METADATA_COLUMNS}
     FROM apps a
     JOIN LATERAL (
       SELECT av.id FROM app_versions av
       WHERE av.app_id = a.id AND av.status = 'published'
       ORDER BY av.version_number DESC LIMIT 1
     ) published ON true
     JOIN app_preview_images api ON api.version_id = published.id
     JOIN images i ON i.id = api.image_id
     JOIN platforms p ON p.id = i.platform_id AND p.app_id = a.id
     JOIN stored_objects so ON so.object_key = i.object_key
     WHERE a.name = $1 AND api.rank = $2
       AND so.access_class IN ('protected', 'public-preview')
     LIMIT 1`,
    [input.app, input.rank],
  );
  return metadataFrom(result.rows[0] as MetadataRow | undefined);
}

export async function legacyImageReference(
  input: { app: string; hash: string; publishedOnly?: boolean },
  runQuery: DatabaseQuery = query,
): Promise<string | undefined> {
  const publicationJoin = input.publishedOnly === false ? "" : `
     JOIN LATERAL (
       SELECT av.id FROM app_versions av
       WHERE av.app_id = a.id AND av.status = 'published'
       ORDER BY av.version_number DESC LIMIT 1
     ) published ON true
     JOIN version_images vi ON vi.version_id = published.id AND vi.image_id = i.id`;
  const result = await runQuery(
    `SELECT i.image_url
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id${publicationJoin}
     WHERE a.name = $1
       AND i.image_url IN ('mobbin-bulk:' || $2, 'capture:' || $2)
       AND i.object_key IS NULL
     LIMIT 1`,
    [input.app, input.hash],
  );
  return result.rows[0]?.image_url as string | undefined;
}
