import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { imageObjectKey, type ObjectMetadata, type ObjectStore, type StoredContentType } from "./objectStore.ts";

const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const LEGACY_REFERENCE = /^(?:mobbin-bulk|capture):([0-9a-f]{16})$/;
const APP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES: Record<string, { extension: "png" | "jpg" | "webp"; contentType: StoredContentType }> = {
  png: { extension: "png", contentType: "image/png" },
  jpg: { extension: "jpg", contentType: "image/jpeg" },
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  webp: { extension: "webp", contentType: "image/webp" },
};

export type MigrationStatus = "pending" | "complete" | "failed";

export interface MediaMigrationRow {
  imageId: number;
  app: string;
  legacyReference: string;
  objectKey: string | null;
  migrationStatus: MigrationStatus | null;
  migrationObjectKey: string | null;
}

export interface PreviewSelection {
  appId: number;
  versionId: number;
  imageId: number;
  rank: number;
}

export interface MediaMigrationDatabase {
  migrationRows(): Promise<MediaMigrationRow[]>;
  beginAttempt(row: MediaMigrationRow): Promise<void>;
  complete(row: MediaMigrationRow, metadata: ObjectMetadata): Promise<void>;
  fail(row: MediaMigrationRow, errorCode: string): Promise<void>;
  previewCandidates(): Promise<PreviewSelection[]>;
  replacePreviews(rows: PreviewSelection[]): Promise<void>;
}

interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

interface QueryClient {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  release(): void;
}

interface QueryPool {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  connect(): Promise<QueryClient>;
}

export class PostgresMediaMigrationDatabase implements MediaMigrationDatabase {
  private readonly pool: QueryPool;

  constructor(pool: QueryPool) { this.pool = pool; }

  async migrationRows(): Promise<MediaMigrationRow[]> {
    const result = await this.pool.query(
      `SELECT i.id AS image_id, a.name AS app, i.image_url AS legacy_reference,
         i.object_key, m.status AS migration_status, m.object_key AS migration_object_key
       FROM images i
       JOIN platforms p ON p.id = i.platform_id
       JOIN apps a ON a.id = p.app_id
       LEFT JOIN media_migration_state m ON m.image_id = i.id
       WHERE i.image_url ~ '^(mobbin-bulk|capture):[0-9a-f]{16}$'
         AND (i.object_key IS NULL OR m.image_id IS NOT NULL)
       ORDER BY i.id`,
    );
    return result.rows.map((item) => ({
      imageId: Number(item.image_id),
      app: String(item.app),
      legacyReference: String(item.legacy_reference),
      objectKey: item.object_key === null ? null : String(item.object_key),
      migrationStatus: item.migration_status === null ? null : item.migration_status as MigrationStatus,
      migrationObjectKey: item.migration_object_key === null ? null : String(item.migration_object_key),
    }));
  }

  async beginAttempt(row: MediaMigrationRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO media_migration_state (image_id, legacy_reference, status, attempts, error_code)
       VALUES ($1, $2, 'pending', 1, NULL)
       ON CONFLICT (image_id) DO UPDATE SET
         legacy_reference = EXCLUDED.legacy_reference,
         status = 'pending', attempts = media_migration_state.attempts + 1,
         error_code = NULL, updated_at = now()`,
      [row.imageId, row.legacyReference],
    );
  }

  async complete(row: MediaMigrationRow, metadata: ObjectMetadata): Promise<void> {
    const client = await this.pool.connect();
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
      if (stored.rowCount !== 1) throw new MigrationFailure("EXISTING_OBJECT_MISMATCH");
      const attached = await client.query(
        `UPDATE images SET object_key = $2
         WHERE id = $1 AND (object_key IS NULL OR object_key = $2)
         RETURNING id`,
        [row.imageId, metadata.key],
      );
      if (attached.rowCount !== 1) throw new MigrationFailure("IMAGE_ATTACH_CONFLICT");
      await client.query(
        `INSERT INTO media_migration_state
           (image_id, legacy_reference, object_key, status, attempts, error_code, updated_at)
         VALUES ($1, $2, $3, 'complete', 1, NULL, now())
         ON CONFLICT (image_id) DO UPDATE SET
           legacy_reference = EXCLUDED.legacy_reference, object_key = EXCLUDED.object_key,
           status = 'complete', error_code = NULL, updated_at = now()`,
        [row.imageId, row.legacyReference, metadata.key],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async fail(row: MediaMigrationRow, errorCode: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO media_migration_state (image_id, legacy_reference, status, attempts, error_code)
       VALUES ($1, $2, 'failed', 1, $3)
       ON CONFLICT (image_id) DO UPDATE SET
         legacy_reference = EXCLUDED.legacy_reference, status = 'failed',
         error_code = EXCLUDED.error_code, updated_at = now()`,
      [row.imageId, row.legacyReference, errorCode],
    );
  }

  async previewCandidates(): Promise<PreviewSelection[]> {
    const result = await this.pool.query(
      `WITH latest_published AS (
         SELECT DISTINCT ON (av.app_id) av.app_id, av.id AS version_id
         FROM app_versions av
         WHERE av.status = 'published'
         ORDER BY av.app_id, av.version_number DESC
       ), ranked AS (
         SELECT lp.app_id, lp.version_id, vi.image_id,
           row_number() OVER (PARTITION BY lp.version_id ORDER BY i.id) AS rank
         FROM latest_published lp
         JOIN version_images vi ON vi.version_id = lp.version_id
         JOIN images i ON i.id = vi.image_id
         WHERE i.kind = 'screen' AND i.object_key IS NOT NULL
       )
       SELECT app_id, version_id, image_id, rank::integer
       FROM ranked WHERE rank BETWEEN 1 AND 3
       ORDER BY app_id, rank`,
    );
    return result.rows.map((item) => ({
      appId: Number(item.app_id), versionId: Number(item.version_id),
      imageId: Number(item.image_id), rank: Number(item.rank),
    }));
  }

  async replacePreviews(rows: PreviewSelection[]): Promise<void> {
    const client = await this.pool.connect();
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM app_preview_images");
      for (const row of rows) {
        await client.query(
          `INSERT INTO app_preview_images (version_id, image_id, rank) VALUES ($1, $2, $3)`,
          [row.versionId, row.imageId, row.rank],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export interface MediaMigrationReport {
  mode: "dry-run" | "apply";
  total: number;
  ready: number;
  migrated: number;
  skipped: number;
  failed: number;
  images: Array<{
    image_id: number;
    status: "ready" | "migrated" | "skipped" | "failed";
    sha256?: string;
    error_code?: string;
  }>;
  evidence_sha256: string;
}

class MigrationFailure extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function matchesMagic(body: Uint8Array, contentType: StoredContentType): boolean {
  if (contentType === "image/png") {
    return body.length >= 8 && Buffer.from(body.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (contentType === "image/webp") {
    return body.length >= 12
      && Buffer.from(body.subarray(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(body.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  return false;
}

function sameMetadata(left: ObjectMetadata | undefined, right: ObjectMetadata): boolean {
  return Boolean(left)
    && left!.key === right.key
    && left!.sha256 === right.sha256
    && left!.byteSize === right.byteSize
    && left!.contentType === right.contentType
    && left!.accessClass === right.accessClass;
}

async function resolvedLegacyFile(dataDir: string, row: MediaMigrationRow): Promise<{ file: string; type: typeof IMAGE_TYPES[string] }> {
  const hash = row.legacyReference.match(LEGACY_REFERENCE)?.[1];
  if (!hash || !APP_SLUG.test(row.app)) throw new MigrationFailure("LEGACY_REFERENCE_INVALID");
  const directory = path.resolve(dataDir, "images", row.app);
  let entries: string[];
  try { entries = await readdir(directory); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new MigrationFailure("LEGACY_FILE_MISSING");
    throw error;
  }
  const matches = entries.filter((entry) => {
    const [base, extension] = [entry.slice(0, entry.lastIndexOf(".")), entry.slice(entry.lastIndexOf(".") + 1).toLowerCase()];
    return base === hash && extension in IMAGE_TYPES;
  });
  if (matches.length === 0) throw new MigrationFailure("LEGACY_FILE_MISSING");
  if (matches.length !== 1) throw new MigrationFailure("LEGACY_FILE_AMBIGUOUS");
  const extension = matches[0].slice(matches[0].lastIndexOf(".") + 1).toLowerCase();
  const file = path.join(directory, matches[0]);
  try {
    const [directoryPath, filePath, details] = await Promise.all([realpath(directory), realpath(file), lstat(file)]);
    if (details.isSymbolicLink() || path.dirname(filePath) !== directoryPath) throw new MigrationFailure("LEGACY_PATH_UNSAFE");
    return { file: filePath, type: IMAGE_TYPES[extension] };
  } catch (error) {
    if (error instanceof MigrationFailure) throw error;
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new MigrationFailure("LEGACY_FILE_MISSING");
    throw error;
  }
}

async function preparedImage(dataDir: string, row: MediaMigrationRow) {
  const resolved = await resolvedLegacyFile(dataDir, row);
  const details = await lstat(resolved.file);
  if (!details.isFile()) throw new MigrationFailure("LEGACY_FILE_MISSING");
  if (details.size > MAX_IMAGE_BYTES) throw new MigrationFailure("IMAGE_TOO_LARGE");
  if (details.size <= 0) throw new MigrationFailure("IMAGE_BYTES_INVALID");
  const body = await readFile(resolved.file);
  if (!matchesMagic(body, resolved.type.contentType)) throw new MigrationFailure("IMAGE_TYPE_MISMATCH");
  const sha256 = createHash("sha256").update(body).digest("hex");
  const metadata: ObjectMetadata = {
    key: imageObjectKey(row.imageId, sha256, resolved.type.extension),
    sha256,
    byteSize: body.byteLength,
    contentType: resolved.type.contentType,
    accessClass: "protected",
  };
  return { body, metadata };
}

type ImageResult = MediaMigrationReport["images"][number];

async function migrateOne(
  row: MediaMigrationRow,
  options: { dataDir: string; database: MediaMigrationDatabase; objectStore: ObjectStore; apply: boolean },
): Promise<ImageResult> {
  try {
    if (options.apply && row.migrationStatus !== "complete") await options.database.beginAttempt(row);
    const { body, metadata } = await preparedImage(options.dataDir, row);
    const existing = await options.objectStore.head(metadata.key);
    if (existing && !sameMetadata(existing, metadata)) throw new MigrationFailure("EXISTING_OBJECT_MISMATCH");

    if (row.migrationStatus === "complete" && row.objectKey === metadata.key && row.migrationObjectKey === metadata.key) {
      if (!sameMetadata(existing, metadata)) throw new MigrationFailure("EXISTING_OBJECT_MISMATCH");
      return { image_id: row.imageId, status: "skipped", sha256: metadata.sha256 };
    }
    if (!options.apply) return { image_id: row.imageId, status: "ready", sha256: metadata.sha256 };

    if (!existing) {
      const uploaded = await options.objectStore.put({ ...metadata, body });
      if (!sameMetadata(uploaded.metadata, metadata)) throw new MigrationFailure("OBJECT_UPLOAD_MISMATCH");
      const verified = await options.objectStore.head(metadata.key);
      if (!sameMetadata(verified, metadata)) throw new MigrationFailure("OBJECT_UPLOAD_MISMATCH");
    }
    await options.database.complete(row, metadata);
    return { image_id: row.imageId, status: "migrated", sha256: metadata.sha256 };
  } catch (error) {
    const code = error instanceof MigrationFailure ? error.code : "MIGRATION_FAILED";
    if (options.apply) {
      try { await options.database.fail(row, code); } catch { /* The report stays secret-free even when failure recording is unavailable. */ }
    }
    return { image_id: row.imageId, status: "failed", error_code: code };
  }
}

export async function migrateLegacyMedia(options: {
  dataDir: string;
  database: MediaMigrationDatabase;
  objectStore: ObjectStore;
  apply?: boolean;
  concurrency?: number;
  databaseUrl?: string;
}): Promise<MediaMigrationReport> {
  const rows = [...await options.database.migrationRows()].sort((left, right) => left.imageId - right.imageId);
  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? 4)));
  const results = new Array<ImageResult>(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= rows.length) return;
      results[index] = await migrateOne(rows[index], {
        dataDir: options.dataDir,
        database: options.database,
        objectStore: options.objectStore,
        apply: options.apply === true,
      });
    }
  }));
  const evidence = results.map(({ image_id, sha256, error_code }) => [image_id, sha256 ?? error_code]);
  return {
    mode: options.apply === true ? "apply" : "dry-run",
    total: results.length,
    ready: results.filter(({ status }) => status === "ready").length,
    migrated: results.filter(({ status }) => status === "migrated").length,
    skipped: results.filter(({ status }) => status === "skipped").length,
    failed: results.filter(({ status }) => status === "failed").length,
    images: results,
    evidence_sha256: createHash("sha256").update(JSON.stringify(evidence)).digest("hex"),
  };
}

export async function selectPublishedPreviews(database: MediaMigrationDatabase, apply: boolean): Promise<PreviewSelection[]> {
  const rows = await database.previewCandidates();
  if (rows.some(({ rank }) => !Number.isSafeInteger(rank) || rank < 1 || rank > 3)) {
    throw new Error("Invalid published preview rank");
  }
  if (apply) await database.replacePreviews(rows);
  return rows;
}
