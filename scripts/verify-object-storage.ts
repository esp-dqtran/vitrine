import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { isAppSlug, parseImageSource } from "../src/imageSource.ts";
import { assertMigrationsCurrent } from "../src/migrations.ts";
import type { ObjectMetadata } from "../src/objectStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import {
  verifyObjectStorage,
  type ObjectStorageVerificationSource,
  type VerificationImage,
  type VerificationPreview,
  type VerificationReference,
} from "../src/objectStorageVerify.ts";

type MetadataRow = {
  object_key: string | null;
  sha256: string | null;
  byte_size: string | number | null;
  content_type: string | null;
  access_class: string | null;
};

function metadata(row: MetadataRow): ObjectMetadata | undefined {
  if (row.object_key === null || row.sha256 === null || row.byte_size === null
    || row.content_type === null || row.access_class === null) return undefined;
  return {
    key: row.object_key,
    sha256: row.sha256,
    byteSize: Number(row.byte_size),
    contentType: row.content_type as ObjectMetadata["contentType"],
    accessClass: row.access_class as ObjectMetadata["accessClass"],
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "verification_failed";
  return /^[a-z_]+(?: id=[1-9][0-9]*)?$/.test(message) ? message : "verification_failed";
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(JSON.stringify({ status: "error", error: "database_configuration_invalid" }));
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    try { await assertMigrationsCurrent(pool); } catch { throw new Error("migration_check_failed"); }

    let objectStore;
    try { objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env)); }
    catch { throw new Error("object_store_configuration_invalid"); }

    const source: ObjectStorageVerificationSource = {
      async loadImages(): Promise<VerificationImage[]> {
        const result = await pool.query<MetadataRow & {
          id: number;
          app: string;
          legacy_reference: string | null;
        }>(
          `SELECT i.id, a.name AS app, mms.legacy_reference,
                  so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
           FROM images i
           JOIN platforms p ON p.id = i.platform_id
           JOIN apps a ON a.id = p.app_id
           LEFT JOIN media_migration_state mms ON mms.image_id = i.id
           LEFT JOIN stored_objects so ON so.object_key = i.object_key
           ORDER BY i.id`,
        );
        return result.rows.map((row) => ({
          id: row.id,
          app: row.app,
          legacyReference: row.legacy_reference ?? undefined,
          object: metadata(row),
        }));
      },

      async loadStoredObjects(): Promise<ObjectMetadata[]> {
        const result = await pool.query<MetadataRow>(
          `SELECT object_key, sha256, byte_size, content_type, access_class
           FROM stored_objects ORDER BY object_key`,
        );
        return result.rows.map((row) => metadata(row) as ObjectMetadata);
      },

      async loadObjectReferences(): Promise<VerificationReference[]> {
        const result = await pool.query<MetadataRow & { kind: VerificationReference["kind"]; id: string }>(
          `SELECT 'image'::text AS kind, i.id::text AS id,
                  i.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
           FROM images i LEFT JOIN stored_objects so ON so.object_key = i.object_key
           WHERE i.object_key IS NOT NULL
           UNION ALL
           SELECT 'export', e.id::text, e.object_key,
                  so.sha256, so.byte_size, so.content_type, so.access_class
           FROM exports e LEFT JOIN stored_objects so ON so.object_key = e.object_key
           WHERE e.object_key IS NOT NULL
           UNION ALL
           SELECT 'crawl-step', row_number() OVER ()::text, step.failure_object_key,
                  so.sha256, so.byte_size, so.content_type, so.access_class
           FROM crawl_run_steps step
           LEFT JOIN stored_objects so ON so.object_key = step.failure_object_key
           WHERE step.failure_object_key IS NOT NULL`,
        );
        return result.rows.map((row) => ({
          kind: row.kind,
          id: row.id,
          objectKey: row.object_key as string,
          object: metadata(row),
        }));
      },

      async loadRelationshipIntegrity() {
        const result = await pool.query<{ total: string; invalid: string }>(
          `SELECT count(*)::text AS total,
                  count(*) FILTER (WHERE av.id IS NULL OR i.id IS NULL)::text AS invalid
           FROM version_images vi
           LEFT JOIN app_versions av ON av.id = vi.version_id
           LEFT JOIN images i ON i.id = vi.image_id`,
        );
        return { total: Number(result.rows[0].total), invalid: Number(result.rows[0].invalid) };
      },

      async loadPreviews(): Promise<VerificationPreview[]> {
        const result = await pool.query<{
          app_id: number;
          version_id: number;
          latest_published_version_id: number | null;
          image_id: number;
          rank: number;
          belongs_to_version: boolean;
        }>(
          `SELECT av.app_id, api.version_id, latest.id AS latest_published_version_id,
                  api.image_id, api.rank,
                  EXISTS (SELECT 1 FROM version_images vi
                          WHERE vi.version_id = api.version_id AND vi.image_id = api.image_id) AS belongs_to_version
           FROM app_preview_images api
           JOIN app_versions av ON av.id = api.version_id
           LEFT JOIN LATERAL (
             SELECT published.id FROM app_versions published
             WHERE published.app_id = av.app_id AND published.status = 'published'
             ORDER BY published.version_number DESC LIMIT 1
           ) latest ON true
           ORDER BY av.app_id, api.rank`,
        );
        return result.rows.map((row) => ({
          appId: row.app_id,
          versionId: row.version_id,
          latestPublishedVersionId: row.latest_published_version_id ?? 0,
          imageId: row.image_id,
          rank: row.rank,
          belongsToVersion: row.belongs_to_version,
        }));
      },

      async readLegacyBytes(image: VerificationImage): Promise<Buffer | undefined> {
        const parsed = image.legacyReference ? parseImageSource(image.legacyReference) : undefined;
        if (parsed?.kind !== "legacy" || !isAppSlug(image.app)) return undefined;
        const root = process.env.DATA_DIR ?? "data";
        const candidates = await Promise.all(
          ["png", "jpg", "jpeg", "webp"].map(async (extension) => {
            const file = path.join(root, "images", image.app, `${parsed.hash}.${extension}`);
            try { return await readFile(file); } catch (error) {
              if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
              throw error;
            }
          }),
        );
        const matches = candidates.filter((body) => body !== undefined);
        return matches.length === 1 ? matches[0] : undefined;
      },
    };

    const report = await verifyObjectStorage(source, objectStore);
    console.log(JSON.stringify({ status: "ok", ...report }));
  } catch (error) {
    console.error(JSON.stringify({ status: "error", error: safeError(error) }));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
