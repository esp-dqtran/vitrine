import type { QueryResult } from "pg";
import {
  validateObjectMetadata,
  type ObjectMetadata,
} from "./objectStore.ts";
import {
  parseSiteAnalysis,
  type SiteAnalysis,
} from "./siteAnalysis.ts";
import {
  classifySiteImportUrl,
  type SiteImportIdentity,
} from "./sites.ts";

export type GenericSiteIdentity = Extract<
  SiteImportIdentity,
  { kind: "public-page" }
>;

export type GenericSitesDatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

export type GenericSitesTransactionRunner = <T>(
  work: (query: GenericSitesDatabaseQuery) => Promise<T>,
) => Promise<T>;

export interface GenericSiteBeginInput {
  identity: GenericSiteIdentity;
  name: string;
  description: string;
  iconUrl?: string;
  categories: string[];
  styles: string[];
  contentHash: string;
  analysis: SiteAnalysis;
}

export interface GenericSiteCompleteInput {
  identity: GenericSiteIdentity;
  siteId: number;
  versionId: number;
  contentHash: string;
  page: {
    sourceId: string;
    title: string;
    url: string;
  };
  sections: Array<{
    sourceId: string;
    position: number;
    cropTop: number;
    cropBottom: number;
    sourceMetadata?: Record<string, unknown>;
  }>;
  analysis: SiteAnalysis;
  analysisModel?: string;
  objectKeys: {
    source: string;
    analysis: string;
    preview: string;
    mobile: string;
    page: string;
    sections: Record<string, string>;
  };
}

export interface GenericSitesStoreMethods {
  beginGenericImport(
    input: GenericSiteBeginInput,
  ): Promise<
    | { reused: true; siteId: number; versionId: number }
    | { reused: false; siteId: number; versionId: number }
  >;
  completeGenericImport(
    input: GenericSiteCompleteInput,
    objects: ObjectMetadata[],
  ): Promise<{ siteId: number; versionId: number }>;
  failGenericImport(url: string, message: string): Promise<void>;
}

export function createGenericSitesStoreMethods(
  runQuery: GenericSitesDatabaseQuery,
  runTransaction: GenericSitesTransactionRunner,
): GenericSitesStoreMethods {
  return {
    async beginGenericImport(input) {
      const identity = checkedIdentity(input.identity);
      const contentHash = checkedHash(input.contentHash);
      const analysis = parseSiteAnalysis(input.analysis);
      const name = text(input.name, 160);
      const description = text(input.description, 500, false);
      const iconUrl = input.iconUrl
        ? checkedPublicUrl(input.iconUrl)
        : null;
      const categories = stringArray(input.categories, 20, 100);
      const styles = stringArray(input.styles, 20, 100);
      const slug = new URL(identity.canonicalUrl).hostname
        .replace(/^www\./, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 120) || "website";

      return runTransaction(async (tx) => {
        const matchingSite = await tx(
          `SELECT id
           FROM sites
           WHERE regexp_replace(lower(source_url), '/+$', '') =
                 regexp_replace(lower($1), '/+$', '')
           ORDER BY id
           LIMIT 1
           FOR UPDATE`,
          [identity.canonicalUrl],
        );
        const existingSiteId = matchingSite.rows[0]
          ? positiveId(matchingSite.rows[0].id)
          : undefined;
        const site = existingSiteId
          ? await tx(
            `UPDATE sites
             SET name = $2,
                 source_url = $3,
                 description = $4,
                 logo_url = $5,
                 categories = $6::jsonb,
                 styles = $7::jsonb,
                 updated_at = now()
             WHERE id = $1
             RETURNING id`,
            [
              existingSiteId,
              name,
              identity.canonicalUrl,
              description || null,
              iconUrl,
              JSON.stringify(categories),
              JSON.stringify(styles),
            ],
          )
          : await tx(
            `INSERT INTO sites
             (source_site_id, source_kind, slug, name, source_url, description,
              logo_url, categories, styles, popularity)
             VALUES ($1, 'public-page', $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 0)
             ON CONFLICT (source_site_id) DO UPDATE SET
               source_kind = 'public-page',
               slug = EXCLUDED.slug,
               name = EXCLUDED.name,
               source_url = EXCLUDED.source_url,
               description = EXCLUDED.description,
               logo_url = EXCLUDED.logo_url,
               categories = EXCLUDED.categories,
               styles = EXCLUDED.styles,
               updated_at = now()
             RETURNING id`,
            [
              identity.sourceSiteId,
              slug,
              name,
              identity.canonicalUrl,
              description || null,
              iconUrl,
              JSON.stringify(categories),
              JSON.stringify(styles),
            ],
          );
        const siteId = positiveId(site.rows[0]?.id);
        const version = await tx(
          `INSERT INTO site_versions
             (site_id, source_version_id, canonical_url, label, is_latest,
              status, content_hash, analysis_status, analysis)
           VALUES ($1, $2, $3, 'Captured page', true, 'importing', $2,
                   $4, $5::jsonb)
           ON CONFLICT (site_id, source_version_id) DO UPDATE SET
             status = CASE
               WHEN site_versions.status = 'ready' THEN 'ready'
               ELSE 'importing'
             END,
             failure_message = CASE
               WHEN site_versions.status = 'ready' THEN site_versions.failure_message
               ELSE NULL
             END,
             analysis_status = CASE
               WHEN site_versions.status = 'ready' THEN site_versions.analysis_status
               ELSE EXCLUDED.analysis_status
             END,
             analysis = CASE
               WHEN site_versions.status = 'ready' THEN site_versions.analysis
               ELSE EXCLUDED.analysis
             END,
             updated_at = now()
           RETURNING id, status`,
          [
            siteId,
            contentHash,
            identity.canonicalUrl,
            analysis.status,
            JSON.stringify(analysis),
          ],
        );
        const row = version.rows[0];
        const versionId = positiveId(row?.id);
        return row?.status === "ready"
          ? { reused: true as const, siteId, versionId }
          : { reused: false as const, siteId, versionId };
      });
    },

    async completeGenericImport(input, objects) {
      const identity = checkedIdentity(input.identity);
      const contentHash = checkedHash(input.contentHash);
      const siteId = positiveId(input.siteId);
      const versionId = positiveId(input.versionId);
      const analysis = parseSiteAnalysis(input.analysis);
      const metadataByKey = checkedObjects(objects);
      const requiredKeys = checkedObjectKeys(input, metadataByKey);
      const page = {
        sourceId: text(input.page.sourceId, 200),
        title: text(input.page.title, 200),
        url: checkedPublicUrl(input.page.url),
      };
      const sections = checkedSections(input.sections);
      const analysisModel = input.analysisModel
        ? text(input.analysisModel, 200)
        : null;

      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT s.id AS site_id, sv.id AS version_id, sv.status, sv.content_hash
           FROM sites s
           JOIN site_versions sv ON sv.site_id = s.id
           WHERE s.id = $1
             AND sv.id = $2
             AND sv.canonical_url = $3
           FOR UPDATE`,
          [siteId, versionId, identity.canonicalUrl],
        );
        const row = locked.rows[0];
        if (!row) throw new Error("Generic Site import was not initialized");
        if (row.content_hash !== contentHash) {
          throw new Error("Generic Site content hash mismatch");
        }
        if (row.status === "ready") return { siteId, versionId };
        if (row.status !== "importing") {
          throw new Error("Generic Site import is not running");
        }

        for (const key of requiredKeys) {
          const metadata = metadataByKey.get(key)!;
          const stored = await tx(
            `INSERT INTO stored_objects
               (object_key, sha256, byte_size, content_type, access_class)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
             WHERE stored_objects.sha256 = EXCLUDED.sha256
               AND stored_objects.byte_size = EXCLUDED.byte_size
               AND stored_objects.content_type = EXCLUDED.content_type
               AND stored_objects.access_class = EXCLUDED.access_class
             RETURNING object_key`,
            [
              metadata.key,
              metadata.sha256,
              metadata.byteSize,
              metadata.contentType,
              metadata.accessClass,
            ],
          );
          if (stored.rowCount !== 1) {
            throw new Error("Object key already exists with different metadata");
          }
        }

        await tx("DELETE FROM site_pages WHERE version_id = $1", [versionId]);
        const insertedPage = await tx(
          `INSERT INTO site_pages
             (version_id, source_page_id, title, page_url, position,
              full_page_object_key)
           VALUES ($1, $2, $3, $4, 0, $5)
           RETURNING id`,
          [versionId, page.sourceId, page.title, page.url, input.objectKeys.page],
        );
        const pageId = positiveId(insertedPage.rows[0]?.id);
        for (const section of sections) {
          await tx(
            `INSERT INTO site_sections
               (page_id, source_section_id, position, media_kind,
                media_object_key, poster_object_key, crop_top, crop_bottom,
                video_start_seconds, video_end_seconds, ocr_boxes,
                source_metadata)
             VALUES ($1, $2, $3, 'image', $4, NULL, $5, $6,
                     NULL, NULL, '[]'::jsonb, $7::jsonb)`,
            [
              pageId,
              section.sourceId,
              section.position,
              input.objectKeys.sections[section.sourceId],
              section.cropTop,
              section.cropBottom,
              JSON.stringify(section.sourceMetadata),
            ],
          );
        }

        await tx(
          `UPDATE site_versions
           SET is_latest = false
           WHERE site_id = $1 AND id <> $2 AND content_hash IS NOT NULL`,
          [siteId, versionId],
        );
        const ready = await tx(
          `UPDATE site_versions
           SET source_object_key = $2,
               preview_object_key = $3,
               mobile_page_object_key = $4,
               analysis_object_key = $5,
               analysis_status = $6,
               analysis = $7::jsonb,
               analysis_model = $8,
               is_latest = true,
               status = 'ready',
               failure_message = NULL,
               updated_at = now()
           WHERE id = $1 AND status = 'importing'
           RETURNING id`,
          [
            versionId,
            input.objectKeys.source,
            input.objectKeys.preview,
            input.objectKeys.mobile,
            input.objectKeys.analysis,
            analysis.status,
            JSON.stringify(analysis),
            analysisModel,
          ],
        );
        if (ready.rowCount !== 1) {
          throw new Error("Generic Site import ready transition failed");
        }
        return { siteId, versionId };
      });
    },

    async failGenericImport(url, message) {
      const identity = classifySiteImportUrl(url);
      if (identity.kind !== "public-page") {
        throw new Error("Generic Site URL must be a public page");
      }
      await runQuery(
        `UPDATE site_versions sv
         SET status = 'failed', failure_message = $2, updated_at = now()
           FROM sites s
         WHERE sv.site_id = s.id
           AND sv.canonical_url = $1
           AND sv.status <> 'ready'`,
        [identity.canonicalUrl, failureMessage(message)],
      );
    },
  };
}

function checkedIdentity(input: GenericSiteIdentity): GenericSiteIdentity {
  const parsed = classifySiteImportUrl(input.canonicalUrl);
  if (
    input.kind !== "public-page" ||
    parsed.kind !== "public-page" ||
    parsed.sourceSiteId !== input.sourceSiteId
  ) {
    throw new Error("Generic Site identity mismatch");
  }
  return parsed;
}

function checkedSections(
  input: GenericSiteCompleteInput["sections"],
): Array<GenericSiteCompleteInput["sections"][number] & {
  sourceMetadata: Record<string, unknown>;
}> {
  if (!Array.isArray(input) || input.length < 1 || input.length > 200) {
    throw new Error("Generic Site sections are invalid");
  }
  const ids = new Set<string>();
  return input.map((section, index) => {
    const sourceId = text(section.sourceId, 200);
    if (ids.has(sourceId)) throw new Error("Duplicate Generic Site section");
    ids.add(sourceId);
    if (
      section.position !== index ||
      typeof section.cropTop !== "number" ||
      !Number.isFinite(section.cropTop) ||
      section.cropTop < 0 ||
      typeof section.cropBottom !== "number" ||
      !Number.isFinite(section.cropBottom) ||
      section.cropBottom <= section.cropTop
    ) {
      throw new Error("Generic Site section bounds are invalid");
    }
    const sourceMetadata = jsonObject(section.sourceMetadata ?? {});
    return { ...section, sourceId, sourceMetadata };
  });
}

function checkedObjectKeys(
  input: GenericSiteCompleteInput,
  metadataByKey: Map<string, ObjectMetadata>,
): Set<string> {
  if (
    Object.keys(input.objectKeys.sections).length !== input.sections.length
  ) {
    throw new Error("Generic Site section object mapping mismatch");
  }
  const required = new Set([
    input.objectKeys.source,
    input.objectKeys.analysis,
    input.objectKeys.preview,
    input.objectKeys.mobile,
    input.objectKeys.page,
    ...input.sections.map((section) => {
      const key = input.objectKeys.sections[section.sourceId];
      if (!key) throw new Error("Generic Site section object is missing");
      return key;
    }),
  ]);
  if (
    required.size !== 5 + input.sections.length ||
    metadataByKey.size !== required.size
  ) {
    throw new Error("Generic Site object coverage mismatch");
  }
  for (const key of required) {
    if (!metadataByKey.has(key)) {
      throw new Error(`Generic Site object metadata is missing: ${key}`);
    }
  }
  return required;
}

function checkedObjects(objects: ObjectMetadata[]): Map<string, ObjectMetadata> {
  if (!Array.isArray(objects) || objects.length === 0) {
    throw new Error("Generic Site objects are required");
  }
  const result = new Map<string, ObjectMetadata>();
  for (const object of objects) {
    validateObjectMetadata(object);
    if (result.has(object.key)) throw new Error("Duplicate Generic Site object");
    result.set(object.key, object);
  }
  return result;
}

function checkedHash(value: string): string {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error("Invalid Generic Site content hash");
  }
  return value;
}

function checkedPublicUrl(value: string): string {
  const identity = classifySiteImportUrl(value);
  return identity.canonicalUrl;
}

function text(value: unknown, maximum: number, required = true): string {
  if (typeof value !== "string") throw new Error("Invalid Generic Site text");
  const result = value.replace(/\s+/g, " ").trim();
  if ((required && !result) || result.length > maximum || result.includes("\0")) {
    throw new Error("Invalid Generic Site text");
  }
  return result;
}

function stringArray(
  input: unknown,
  maximumItems: number,
  maximumText: number,
): string[] {
  if (!Array.isArray(input) || input.length > maximumItems) {
    throw new Error("Invalid Generic Site string array");
  }
  return [...new Set(input.map((value) => text(value, maximumText)))];
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Generic Site metadata");
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > 20_000) {
    throw new Error("Generic Site metadata is too large");
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

function positiveId(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid Generic Site ID");
  }
  return parsed;
}

function failureMessage(value: unknown): string {
  return text(value, 1_000).replace(
    /(?:api[_-]?key|authorization|cookie|password|secret|token)\s*[:=]\s*\S+/gi,
    "[redacted]",
  );
}
