import type { QueryResult } from "pg";
import { query as databaseQuery, withTransaction } from "./db.ts";
import {
  validateObjectMetadata,
  type ObjectMetadata,
  type StoredContentType,
} from "./objectStore.ts";
import {
  canonicalPublicPageUrl,
  parsePublicPageCapture,
  type PublicPageCapture,
} from "./publicPage.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type TransactionRunner = <T>(work: (query: DatabaseQuery) => Promise<T>) => Promise<T>;

export interface ReusedPublicPageCapture {
  reused: true;
  app: string;
  pageId: number;
  versionId: number;
}

export interface NewPublicPageCapture {
  reused: false;
  app: string;
  appId: number;
  pageId: number;
  versionId: number;
  contentHash: string;
  capture: PublicPageCapture;
}

export type BeginPublicPageCapture = ReusedPublicPageCapture | NewPublicPageCapture;

export interface PublicPageAssets {
  source: string;
  preview: string;
  page: { objectKey: string; imageRef: string };
  sections: Array<{ position: number; objectKey: string; imageRef: string }>;
}

export interface CompletedPublicPageCapture {
  app: string;
  pageId: number;
  versionId: number;
  sectionCount: number;
}

export interface PublicPageStore {
  beginCapture(capture: PublicPageCapture, contentHash: string): Promise<BeginPublicPageCapture>;
  completeCapture(
    begin: NewPublicPageCapture,
    assets: PublicPageAssets,
    objects: ObjectMetadata[],
  ): Promise<CompletedPublicPageCapture>;
  failCapture(versionId: number, message: string): Promise<void>;
  previewObject(app: string, versionId: number): Promise<ObjectMetadata | undefined>;
}

const liveQuery: DatabaseQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

function defaultTransaction(runQuery: DatabaseQuery): TransactionRunner {
  if (runQuery === liveQuery) {
    return (work) => withTransaction((client) =>
      work((sql, values) => client.query(sql, values ? [...values] : undefined))
    );
  }
  return async (work) => {
    await runQuery("BEGIN");
    try {
      const value = await work(runQuery);
      await runQuery("COMMIT");
      return value;
    } catch (error) {
      await runQuery("ROLLBACK");
      throw error;
    }
  };
}

export function createPublicPageStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): PublicPageStore {
  return {
    async beginCapture(captureValue, contentHash) {
      const capture = parsePublicPageCapture(captureValue);
      assertHash(contentHash);
      const identity = canonicalPublicPageUrl(capture.canonicalUrl);
      const websiteUrl = new URL(capture.canonicalUrl).origin;
      return runTransaction(async (tx) => {
        const appResult = await tx(
          `INSERT INTO apps
             (name, source_domain, display_name, description, website_url, accent_color, icon_url, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (name) DO UPDATE SET
             source_domain = COALESCE(apps.source_domain, EXCLUDED.source_domain),
             display_name = COALESCE(apps.display_name, EXCLUDED.display_name),
             description = COALESCE(apps.description, EXCLUDED.description),
             website_url = COALESCE(apps.website_url, EXCLUDED.website_url),
             accent_color = COALESCE(apps.accent_color, EXCLUDED.accent_color),
             icon_url = COALESCE(apps.icon_url, EXCLUDED.icon_url),
             category = COALESCE(apps.category, EXCLUDED.category)
           RETURNING id, name`,
          [
            identity.appSlug,
            identity.sourceDomain,
            capture.metadata.name,
            capture.metadata.description,
            websiteUrl,
            capture.metadata.accent,
            capture.metadata.iconUrl ?? null,
            capture.metadata.category,
          ],
        );
        const appRow = appResult.rows[0];
        const appId = positiveId(appRow?.id);
        const app = nonEmptyText(appRow?.name);
        const pageResult = await tx(
          `INSERT INTO web_pages (app_id, canonical_url, title)
           VALUES ($1, $2, $3)
           ON CONFLICT (canonical_url) DO UPDATE SET
             title = EXCLUDED.title,
             updated_at = now()
           RETURNING id`,
          [appId, capture.canonicalUrl, capture.sections[0]?.heading ?? capture.metadata.name],
        );
        const pageId = positiveId(pageResult.rows[0]?.id);
        const existing = await tx(
          `SELECT id
           FROM web_page_versions
           WHERE page_id = $1 AND content_hash = $2 AND status = 'ready'
           LIMIT 1`,
          [pageId, contentHash],
        );
        if (existing.rows[0]) {
          return { reused: true, app, pageId, versionId: positiveId(existing.rows[0].id) };
        }
        const versionResult = await tx(
          `INSERT INTO web_page_versions
             (page_id, content_hash, status, viewport_width, viewport_height)
           VALUES ($1, $2, 'importing', $3, $4)
           ON CONFLICT (page_id, content_hash) DO UPDATE SET
             status = 'importing',
             failure_message = NULL,
             updated_at = now()
           WHERE web_page_versions.status = 'failed'
           RETURNING id`,
          [pageId, contentHash, capture.viewport.width, capture.viewport.height],
        );
        if (!versionResult.rows[0]) {
          throw new Error("Public page capture is already importing");
        }
        return {
          reused: false,
          app,
          appId,
          pageId,
          versionId: positiveId(versionResult.rows[0].id),
          contentHash,
          capture,
        };
      });
    },

    async completeCapture(begin, assets, objects) {
      checkedNewCapture(begin);
      const objectMap = checkedObjects(objects);
      const requiredKeys = [assets.source, assets.preview, assets.page.objectKey, ...assets.sections.map(({ objectKey }) => objectKey)];
      if (new Set(requiredKeys).size !== requiredKeys.length || requiredKeys.some((key) => !objectMap.has(key))) {
        throw new Error("Public page object coverage is incomplete");
      }
      if (assets.sections.length !== begin.capture.sections.length) {
        throw new Error("Public page section asset count does not match capture");
      }
      assertImageRef(assets.page.imageRef, "screen");
      assets.sections.forEach((asset, index) => {
        if (asset.position !== index) throw new Error("Public page section asset order is invalid");
        assertImageRef(asset.imageRef, "ui_element");
      });

      return runTransaction(async (tx) => {
        for (const object of objects) await insertObject(tx, object);
        const platformResult = await tx(
          `INSERT INTO platforms (app_id, name) VALUES ($1, 'web')
           ON CONFLICT (app_id, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [begin.appId],
        );
        const platformId = positiveId(platformResult.rows[0]?.id);
        let appVersionId: number;
        const currentDraft = await tx(
          `SELECT id FROM app_versions
           WHERE app_id = $1 AND platform = 'web' AND status IN ('draft', 'in_review')
           ORDER BY version_number DESC LIMIT 1`,
          [begin.appId],
        );
        if (currentDraft.rows[0]) {
          appVersionId = positiveId(currentDraft.rows[0].id);
        } else {
          const version = await tx(
            `WITH next AS (
               SELECT COALESCE(MAX(version_number), 0) + 1 AS revision
               FROM app_versions WHERE app_id = $1 AND platform = 'web'
             )
             INSERT INTO app_versions (app_id, platform, version_number, label, source_url, status)
             SELECT $1, 'web', revision, 'v' || revision, $2, 'draft' FROM next
             RETURNING id`,
            [begin.appId, begin.capture.canonicalUrl],
          );
          appVersionId = positiveId(version.rows[0]?.id);
        }

        const screenId = await insertEvidenceImage(tx, {
          platformId,
          appVersionId,
          imageRef: assets.page.imageRef,
          kind: "screen",
          objectKey: assets.page.objectKey,
          sourceUrl: begin.capture.canonicalUrl,
          viewportWidth: begin.capture.viewport.width,
          viewportHeight: begin.capture.viewport.height,
          stateContext: begin.capture.sections[0]?.heading ?? begin.capture.metadata.name,
        });

        await tx(
          `UPDATE web_page_versions SET
             source_object_key = $2,
             preview_object_key = $3,
             screenshot_image_id = $4,
             failure_message = NULL,
             updated_at = now()
           WHERE id = $1 AND status = 'importing'`,
          [begin.versionId, assets.source, assets.preview, screenId],
        );

        for (const [index, asset] of assets.sections.entries()) {
          const section = begin.capture.sections[index];
          const imageId = await insertEvidenceImage(tx, {
            platformId,
            appVersionId,
            imageRef: asset.imageRef,
            kind: "ui_element",
            objectKey: asset.objectKey,
            sourceUrl: begin.capture.canonicalUrl,
            viewportWidth: begin.capture.viewport.width,
            viewportHeight: begin.capture.viewport.height,
            stateContext: section.heading ?? section.tagName,
          });
          await tx(
            `INSERT INTO web_page_sections
               (version_id, position, selector, tag_name, role, heading, text_excerpt,
                x, y, width, height, image_id, source_metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
            [
              begin.versionId,
              index,
              section.selector,
              section.tagName,
              section.role ?? null,
              section.heading ?? null,
              section.text,
              section.bounds.x,
              section.bounds.y,
              section.bounds.width,
              section.bounds.height,
              imageId,
              JSON.stringify({ canonicalUrl: begin.capture.canonicalUrl }),
            ],
          );
        }
        const countResult = await tx(
          `SELECT count(*)::integer AS count
           FROM web_page_sections
           WHERE version_id = $1`,
          [begin.versionId],
        );
        if (Number(countResult.rows[0]?.count) !== begin.capture.sections.length) {
          throw new Error("Public page section count does not match capture");
        }
        const ready = await tx(
          `UPDATE web_page_versions SET
             status = 'ready',
             captured_at = now(),
             updated_at = now()
           WHERE id = $1 AND status = 'importing'
           RETURNING id`,
          [begin.versionId],
        );
        if (ready.rowCount !== 1) throw new Error("Public page version could not become ready");
        return {
          app: begin.app,
          pageId: begin.pageId,
          versionId: begin.versionId,
          sectionCount: begin.capture.sections.length,
        };
      });
    },

    async failCapture(versionId, message) {
      assertPositiveId(versionId);
      const safeMessage = nonEmptyText(message).replace(/https?:\/\/\S+/gi, "[redacted-url]").slice(0, 500);
      await runQuery(
        `UPDATE web_page_versions SET
           status = 'failed', failure_message = $2, updated_at = now()
         WHERE id = $1 AND status = 'importing'`,
        [versionId, safeMessage],
      );
    },

    async previewObject(app, versionId) {
      assertPositiveId(versionId);
      const result = await runQuery(
        `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM apps a
         JOIN web_pages wp ON wp.app_id = a.id
         JOIN web_page_versions wpv ON wpv.page_id = wp.id
         JOIN stored_objects so ON so.object_key = wpv.preview_object_key
         WHERE a.name = $1 AND wpv.id = $2 AND wpv.status = 'ready'
           AND so.content_type = 'video/webm'
           AND so.access_class = 'protected'
         LIMIT 1`,
        [nonEmptyText(app), versionId],
      );
      return metadataFrom(result.rows[0]);
    },
  };
}

async function insertObject(tx: DatabaseQuery, metadata: ObjectMetadata): Promise<void> {
  validateObjectMetadata(metadata);
  const stored = await tx(
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
  if (stored.rowCount !== 1) throw new Error("Public page object metadata conflicts with storage");
}

async function insertEvidenceImage(tx: DatabaseQuery, input: {
  platformId: number;
  appVersionId: number;
  imageRef: string;
  kind: "screen" | "ui_element";
  objectKey: string;
  sourceUrl: string;
  viewportWidth: number;
  viewportHeight: number;
  stateContext: string;
}): Promise<number> {
  const image = await tx(
    `INSERT INTO images (platform_id, image_url, kind, object_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (platform_id, image_url) DO UPDATE SET
       kind = EXCLUDED.kind,
       object_key = EXCLUDED.object_key
     RETURNING id`,
    [input.platformId, input.imageRef, input.kind, input.objectKey],
  );
  const imageId = positiveId(image.rows[0]?.id);
  await tx(
    `INSERT INTO version_images
       (version_id, image_id, source_url, viewport_width, viewport_height, state_context)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (version_id, image_id) DO UPDATE SET
       source_url = EXCLUDED.source_url,
       viewport_width = EXCLUDED.viewport_width,
       viewport_height = EXCLUDED.viewport_height,
       state_context = EXCLUDED.state_context`,
    [
      input.appVersionId,
      imageId,
      input.sourceUrl,
      input.viewportWidth,
      input.viewportHeight,
      input.stateContext,
    ],
  );
  return imageId;
}

function checkedObjects(objects: ObjectMetadata[]): Map<string, ObjectMetadata> {
  if (!Array.isArray(objects) || objects.length < 3) throw new Error("Public page objects are incomplete");
  const map = new Map<string, ObjectMetadata>();
  for (const object of objects) {
    validateObjectMetadata(object);
    if (map.has(object.key)) throw new Error("Duplicate public page object key");
    map.set(object.key, object);
  }
  return map;
}

function checkedNewCapture(value: NewPublicPageCapture): void {
  if (value.reused !== false) throw new Error("Cannot complete a reused public page capture");
  assertPositiveId(value.appId);
  assertPositiveId(value.pageId);
  assertPositiveId(value.versionId);
  assertHash(value.contentHash);
  parsePublicPageCapture(value.capture);
}

function assertImageRef(value: string, kind: "screen" | "ui_element"): void {
  const expected = kind === "screen"
    ? /^capture:[0-9a-f]{16}$/
    : /^capture:ui_element:[0-9a-f]{16}:[0-9]+$/;
  if (!expected.test(value)) throw new Error(`Invalid public page ${kind} image reference`);
}

function metadataFrom(row: Record<string, unknown> | undefined): ObjectMetadata | undefined {
  if (!row) return undefined;
  const metadata: ObjectMetadata = {
    key: nonEmptyText(row.object_key),
    sha256: nonEmptyText(row.sha256),
    byteSize: Number(row.byte_size),
    contentType: row.content_type as StoredContentType,
    accessClass: row.access_class as ObjectMetadata["accessClass"],
  };
  validateObjectMetadata(metadata);
  return metadata;
}

function assertHash(value: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("Invalid public page content hash");
}

function positiveId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("Invalid public page database ID");
  return parsed;
}

function assertPositiveId(value: number): void {
  positiveId(value);
}

function nonEmptyText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid public page text");
  return value.trim();
}
