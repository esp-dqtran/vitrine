import type { QueryResult } from "pg";
import { query as databaseQuery, withTransaction } from "./db.ts";
import {
  validateObjectMetadata,
  type ObjectMetadata,
} from "./objectStore.ts";
import {
  parseSiteAnalysis,
  type SiteAnalysis,
} from "./siteAnalysis.ts";
import {
  canonicalMobbinSitesUrl,
  classifySiteImportUrl,
  parseSiteImport,
  type MobbinSitesIdentity,
  type SiteImport,
  type SiteOcrBox,
} from "./sites.ts";
import {
  createGenericSitesStoreMethods,
  type GenericSitesStoreMethods,
} from "./sitesGenericStore.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type TransactionRunner = <T>(work: (query: DatabaseQuery) => Promise<T>) => Promise<T>;

export interface CompletedSiteImport {
  identity: MobbinSitesIdentity;
  graph: SiteImport;
  objectKeys: {
    source: string;
    preview: string;
    pages: Record<string, string>;
    sections: Record<string, { media: string; poster?: string }>;
  };
}

export interface SiteSummary {
  siteId: number;
  versionId: number;
  name: string;
  slug: string;
  sourceUrl: string;
  description?: string;
  logoUrl?: string;
  categories: string[];
  styles: string[];
  popularity: number;
  label: string;
  isLatest: boolean;
  pageCount: number;
  sectionCount: number;
  previewUrl: string;
  previewMediaKind: "image" | "video";
  previews: Array<{
    id: number;
    title: string;
    position: number;
    url: string;
  }>;
  updatedAt: string;
}

export interface SiteVersionOption {
  id: number;
  label: string;
  isLatest: boolean;
  updatedAt: string;
}

export interface SiteVersionDetail {
  siteId: number;
  versionId: number;
  name: string;
  slug: string;
  sourceUrl: string;
  description?: string;
  logoUrl?: string;
  categories: string[];
  styles: string[];
  popularity: number;
  canonicalUrl: string;
  label: string;
  isLatest: boolean;
  analysisStatus?: "ready" | "evidence-only";
  analysis?: SiteAnalysis | null;
  analysisModel?: string;
  mobilePageUrl?: string;
  previewUrl: string;
  previewMediaKind: "image" | "video";
  versions: SiteVersionOption[];
  pages: Array<{
    id: number;
    sourceId: string;
    title: string;
    url: string;
    position: number;
    fullPageImageUrl: string;
    sections: Array<{
      id: number;
      sourceId: string;
      position: number;
      mediaKind: "image" | "video";
      mediaUrl: string;
      posterUrl?: string;
      cropTop?: number;
      cropBottom?: number;
      videoStartSeconds?: number;
      videoEndSeconds?: number;
      ocrBoxes: SiteOcrBox[];
      sourceMetadata: Record<string, unknown>;
    }>;
  }>;
}

export interface SitesStore extends Partial<GenericSitesStoreMethods> {
  readyVersionByCanonicalUrl(
    url: string,
  ): Promise<{ siteId: number; versionId: number } | undefined>;
  listReadySites(): Promise<SiteSummary[]>;
  readyVersionDetail(
    siteId: number,
    versionId: number,
  ): Promise<SiteVersionDetail | undefined>;
  beginImport(
    identity: MobbinSitesIdentity,
    graph: SiteImport,
  ): Promise<{ siteId: number; versionId: number }>;
  completeImport(
    input: CompletedSiteImport,
    objects: ObjectMetadata[],
  ): Promise<{ siteId: number; versionId: number }>;
  failImport(url: string, message: string): Promise<void>;
  siteMediaObject(input: {
    siteId: number;
    versionId: number;
    kind: "preview" | "mobile" | "page" | "section" | "poster";
    recordId?: number;
  }): Promise<ObjectMetadata | undefined>;
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
      const result = await work(runQuery);
      await runQuery("COMMIT");
      return result;
    } catch (error) {
      await runQuery("ROLLBACK");
      throw error;
    }
  };
}

export function createSitesStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): SitesStore {
  return {
    ...createGenericSitesStoreMethods(runQuery, runTransaction),
    async readyVersionByCanonicalUrl(url) {
      const canonical = classifySiteImportUrl(url).canonicalUrl;
      const result = await runQuery(
        `SELECT s.id AS site_id, sv.id AS version_id
         FROM sites s
         JOIN site_versions sv ON sv.site_id = s.id
         WHERE sv.canonical_url = $1 AND sv.status = 'ready'
         LIMIT 1`,
        [canonical],
      );
      const row = result.rows[0];
      return row
        ? { siteId: positiveId(row.site_id), versionId: positiveId(row.version_id) }
        : undefined;
    },

    async listReadySites() {
      const result = await runQuery(
        `SELECT DISTINCT ON (s.id)
                s.id AS site_id, sv.id AS version_id, s.name, s.slug, s.source_url,
                to_jsonb(s)->>'description' AS description,
                to_jsonb(s)->>'logo_url' AS logo_url,
                to_jsonb(s)->'categories' AS categories,
                to_jsonb(s)->'styles' AS styles,
                (to_jsonb(s)->>'popularity')::integer AS popularity,
                sv.label, sv.is_latest, sv.updated_at,
                preview_object.content_type AS preview_content_type,
                (SELECT count(*)::integer FROM site_pages sp WHERE sp.version_id = sv.id) AS page_count,
                (SELECT count(*)::integer FROM site_sections ss
                 JOIN site_pages sp ON sp.id = ss.page_id WHERE sp.version_id = sv.id) AS section_count,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', preview.id,
                    'title', preview.title,
                    'position', preview.position
                  ) ORDER BY preview.position)
                  FROM (
                    SELECT sp.id, sp.title, sp.position
                    FROM site_pages sp
                    WHERE sp.version_id = sv.id
                    ORDER BY sp.position
                    LIMIT 5
                  ) preview
                ), '[]'::jsonb) AS page_previews
         FROM sites s
         JOIN site_versions sv ON sv.site_id = s.id
         LEFT JOIN stored_objects preview_object
           ON preview_object.object_key = sv.preview_object_key
         WHERE sv.status = 'ready'
         ORDER BY s.id, sv.is_latest DESC, sv.updated_at DESC`,
      );
      return result.rows.map((row) => {
        const siteId = positiveId(row.site_id);
        const versionId = positiveId(row.version_id);
        const previews = jsonArray(row.page_previews ?? []).map((value) => {
          const page = jsonObject(value);
          const id = positiveId(page.id);
          return {
            id,
            title: text(page.title),
            position: nonNegativeInteger(page.position),
            url: mediaPath(siteId, versionId, "page", id),
          };
        });
        return {
          siteId,
          versionId,
          name: text(row.name),
          slug: text(row.slug),
          sourceUrl: text(row.source_url),
          ...optionalTextProperty("description", row.description),
          ...optionalTextProperty("logoUrl", row.logo_url),
          categories: jsonStringArray(row.categories),
          styles: jsonStringArray(row.styles),
          popularity: optionalNonNegativeInteger(row.popularity),
          label: text(row.label),
          isLatest: row.is_latest === true,
          pageCount: nonNegativeInteger(row.page_count),
          sectionCount: nonNegativeInteger(row.section_count),
          previewUrl: mediaPath(siteId, versionId, "preview"),
          previewMediaKind: previewMediaKind(row.preview_content_type),
          previews,
          updatedAt: isoDate(row.updated_at),
        };
      });
    },

    async readyVersionDetail(siteId, versionId) {
      assertPositiveId(siteId);
      assertPositiveId(versionId);
      const header = await runQuery(
        `SELECT s.id AS site_id, sv.id AS version_id, s.name, s.slug, s.source_url,
                to_jsonb(s)->>'description' AS description,
                to_jsonb(s)->>'logo_url' AS logo_url,
                to_jsonb(s)->'categories' AS categories,
                to_jsonb(s)->'styles' AS styles,
                (to_jsonb(s)->>'popularity')::integer AS popularity,
                sv.canonical_url, sv.label, sv.is_latest,
                preview_object.content_type AS preview_content_type
         FROM sites s
         JOIN site_versions sv ON sv.site_id = s.id
         LEFT JOIN stored_objects preview_object
           ON preview_object.object_key = sv.preview_object_key
         WHERE s.id = $1 AND sv.id = $2 AND sv.status = 'ready'
         LIMIT 1`,
        [siteId, versionId],
      );
      const headerRow = header.rows[0];
      if (!headerRow) return undefined;
      const analysisResult = await runQuery(
        `SELECT analysis_status, analysis, analysis_model, mobile_page_object_key
         FROM site_versions
         WHERE id = $1 AND site_id = $2 AND status = 'ready'
         LIMIT 1`,
        [versionId, siteId],
      );
      const analysisRow = analysisResult.rows[0] ?? {};

      const [pageResult, sectionResult, versionResult] = await Promise.all([
        runQuery(
          `SELECT sp.id, sp.source_page_id, sp.title, sp.page_url, sp.position
           FROM site_pages sp
           WHERE sp.version_id = $1
           ORDER BY sp.position`,
          [versionId],
        ),
        runQuery(
          `SELECT ss.id, ss.page_id, ss.source_section_id, ss.position, ss.media_kind,
                  ss.poster_object_key, ss.crop_top, ss.crop_bottom,
                  ss.video_start_seconds, ss.video_end_seconds,
                  ss.ocr_boxes, ss.source_metadata
           FROM site_sections ss
           JOIN site_pages sp ON sp.id = ss.page_id
           WHERE sp.version_id = $1
           ORDER BY sp.position, ss.position`,
          [versionId],
        ),
        runQuery(
          `SELECT sv.id, sv.label, sv.is_latest, sv.updated_at
           FROM site_versions sv
           WHERE sv.site_id = $1 AND sv.status = 'ready'
           ORDER BY sv.is_latest DESC, sv.updated_at DESC, sv.id DESC`,
          [siteId],
        ),
      ]);
      const sectionsByPage = new Map<number, SiteVersionDetail["pages"][number]["sections"]>();
      for (const row of sectionResult.rows) {
        const pageId = positiveId(row.page_id);
        const sectionId = positiveId(row.id);
        const mediaKind = enumMediaKind(row.media_kind);
        const section: SiteVersionDetail["pages"][number]["sections"][number] = {
          id: sectionId,
          sourceId: text(row.source_section_id),
          position: nonNegativeInteger(row.position),
          mediaKind,
          mediaUrl: mediaPath(siteId, versionId, "section", sectionId),
          ocrBoxes: jsonArray(row.ocr_boxes) as SiteOcrBox[],
          sourceMetadata: jsonObject(row.source_metadata),
        };
        if (mediaKind === "image") {
          const crop = optionalOrderedBounds(row.crop_top, row.crop_bottom);
          if (crop) {
            section.cropTop = crop[0];
            section.cropBottom = crop[1];
          }
        } else {
          const interval = optionalOrderedBounds(
            row.video_start_seconds,
            row.video_end_seconds,
          );
          if (interval) {
            section.videoStartSeconds = interval[0];
            section.videoEndSeconds = interval[1];
          }
          if (row.poster_object_key != null) {
            section.posterUrl = mediaPath(siteId, versionId, "poster", sectionId);
          }
        }
        const collection = sectionsByPage.get(pageId) ?? [];
        collection.push(section);
        sectionsByPage.set(pageId, collection);
      }

      return {
        siteId,
        versionId,
        name: text(headerRow.name),
        slug: text(headerRow.slug),
        sourceUrl: text(headerRow.source_url),
        ...optionalTextProperty("description", headerRow.description),
        ...optionalTextProperty("logoUrl", headerRow.logo_url),
        categories: jsonStringArray(headerRow.categories),
        styles: jsonStringArray(headerRow.styles),
        popularity: optionalNonNegativeInteger(headerRow.popularity),
        canonicalUrl: text(headerRow.canonical_url),
        label: text(headerRow.label),
        isLatest: headerRow.is_latest === true,
        analysisStatus: analysisStatus(analysisRow.analysis_status),
        analysis: analysisFromRow(analysisRow.analysis),
        ...(typeof analysisRow.analysis_model === "string" &&
            analysisRow.analysis_model
          ? { analysisModel: analysisRow.analysis_model }
          : {}),
        ...(analysisRow.mobile_page_object_key
          ? { mobilePageUrl: mediaPath(siteId, versionId, "mobile") }
          : {}),
        previewUrl: mediaPath(siteId, versionId, "preview"),
        previewMediaKind: previewMediaKind(headerRow.preview_content_type),
        versions: versionResult.rows.map((row) => ({
          id: positiveId(row.id),
          label: text(row.label),
          isLatest: row.is_latest === true,
          updatedAt: isoDate(row.updated_at),
        })),
        pages: pageResult.rows.map((row) => {
          const pageId = positiveId(row.id);
          return {
            id: pageId,
            sourceId: text(row.source_page_id),
            title: text(row.title),
            url: text(row.page_url),
            position: nonNegativeInteger(row.position),
            fullPageImageUrl: mediaPath(siteId, versionId, "page", pageId),
            sections: sectionsByPage.get(pageId) ?? [],
          };
        }),
      };
    },

    async beginImport(identity, graphValue) {
      const { checkedIdentity, graph } = checkedImport(identity, graphValue);
      return runTransaction(async (tx) => {
        const matchingSite = await tx(
          `SELECT id
           FROM sites
           WHERE regexp_replace(lower(source_url), '/+$', '') =
                 regexp_replace(lower($1), '/+$', '')
           ORDER BY id
           LIMIT 1
           FOR UPDATE`,
          [graph.site.sourceUrl],
        );
        const existingSiteId = matchingSite.rows[0]
          ? positiveId(matchingSite.rows[0].id)
          : undefined;
        const site = existingSiteId
          ? await tx(
            `UPDATE sites
             SET categories = $2::jsonb,
                 styles = $3::jsonb,
                 popularity = $4,
                 updated_at = now()
             WHERE id = $1
             RETURNING id`,
            [
              existingSiteId,
              JSON.stringify(graph.site.categories ?? []),
              JSON.stringify(graph.site.styles ?? []),
              graph.site.popularity ?? 0,
            ],
          )
          : await tx(
            `INSERT INTO sites
             (source_site_id, slug, name, source_url, description, logo_url,
              categories, styles, popularity)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
             ON CONFLICT (source_site_id) DO UPDATE SET
               slug = EXCLUDED.slug,
               name = EXCLUDED.name,
               source_url = EXCLUDED.source_url,
               description = EXCLUDED.description,
               logo_url = EXCLUDED.logo_url,
               categories = EXCLUDED.categories,
               styles = EXCLUDED.styles,
               popularity = EXCLUDED.popularity,
               updated_at = now()
             RETURNING id`,
            [
              checkedIdentity.sourceSiteId,
              graph.site.slug,
              graph.site.name,
              graph.site.sourceUrl,
              graph.site.description ?? null,
              graph.site.logoUrl ?? null,
              JSON.stringify(graph.site.categories ?? []),
              JSON.stringify(graph.site.styles ?? []),
              graph.site.popularity ?? 0,
            ],
          );
        const siteId = positiveId(site.rows[0]?.id);
        const version = await tx(
          `INSERT INTO site_versions
             (site_id, source_version_id, canonical_url, label, is_latest, status)
           VALUES ($1, $2, $3, $4, $5, 'importing')
           ON CONFLICT (site_id, source_version_id) DO UPDATE SET
             canonical_url = EXCLUDED.canonical_url,
             label = EXCLUDED.label,
             is_latest = EXCLUDED.is_latest,
             status = CASE
               WHEN site_versions.status = 'ready' THEN 'ready'
               ELSE 'importing'
             END,
             failure_message = CASE
               WHEN site_versions.status = 'ready' THEN site_versions.failure_message
               ELSE NULL
             END,
             updated_at = now()
           RETURNING id`,
          [
            siteId,
            checkedIdentity.sourceVersionId,
            checkedIdentity.canonicalUrl,
            graph.version.label,
            graph.version.isLatest,
          ],
        );
        return { siteId, versionId: positiveId(version.rows[0]?.id) };
      });
    },

    async completeImport(input, objects) {
      const { checkedIdentity, graph } = checkedImport(input.identity, input.graph);
      const metadataByKey = checkedObjectMetadata(objects);
      assertObjectKeyCoverage(input, graph, metadataByKey);

      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT s.id AS site_id, sv.id AS version_id, sv.status
           FROM sites s
           JOIN site_versions sv ON sv.site_id = s.id
           WHERE sv.canonical_url = $1
           FOR UPDATE`,
          [checkedIdentity.canonicalUrl],
        );
        const row = locked.rows[0];
        if (!row) throw new Error("Site import was not initialized");
        const siteId = positiveId(row.site_id);
        const versionId = positiveId(row.version_id);
        if (row.status === "ready") return { siteId, versionId };
        if (row.status !== "importing") throw new Error("Site import is not running");

        for (const metadata of metadataByKey.values()) {
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
        for (const page of graph.pages) {
          const insertedPage = await tx(
            `INSERT INTO site_pages
               (version_id, source_page_id, title, page_url, position, full_page_object_key)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              versionId,
              page.sourceId,
              page.title,
              page.url,
              page.position,
              input.objectKeys.pages[page.sourceId],
            ],
          );
          const pageId = positiveId(insertedPage.rows[0]?.id);
          for (const section of page.sections) {
            const keys = input.objectKeys.sections[section.sourceId];
            await tx(
              `INSERT INTO site_sections
                 (page_id, source_section_id, position, media_kind,
                  media_object_key, poster_object_key, crop_top, crop_bottom,
                  video_start_seconds, video_end_seconds, ocr_boxes, source_metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
               RETURNING id`,
              [
                pageId,
                section.sourceId,
                section.position,
                section.mediaKind,
                keys.media,
                keys.poster ?? null,
                section.cropTop ?? null,
                section.cropBottom ?? null,
                section.videoStartSeconds ?? null,
                section.videoEndSeconds ?? null,
                JSON.stringify(section.ocrBoxes),
                JSON.stringify(section.sourceMetadata ?? {}),
              ],
            );
          }
        }

        const counts = await tx(
          `SELECT
             (SELECT count(*)::integer FROM site_pages WHERE version_id = $1) AS page_count,
             (SELECT count(*)::integer FROM site_sections ss
              JOIN site_pages sp ON sp.id = ss.page_id
              WHERE sp.version_id = $1) AS section_count`,
          [versionId],
        );
        const expectedSections = graph.pages.reduce(
          (total, page) => total + page.sections.length,
          0,
        );
        if (
          nonNegativeInteger(counts.rows[0]?.page_count) !== graph.pages.length ||
          nonNegativeInteger(counts.rows[0]?.section_count) !== expectedSections
        ) {
          throw new Error("Persisted Site graph count mismatch");
        }

        await tx(
          `UPDATE site_versions
           SET is_latest = false
           WHERE site_id = $1 AND id <> $2`,
          [siteId, versionId],
        );
        const ready = await tx(
          `UPDATE site_versions
           SET source_object_key = $2,
               preview_object_key = $3,
               is_latest = true,
               status = 'ready',
               failure_message = NULL,
               updated_at = now()
           WHERE id = $1 AND status = 'importing'
           RETURNING id`,
          [versionId, input.objectKeys.source, input.objectKeys.preview],
        );
        if (ready.rowCount !== 1) throw new Error("Site import ready transition failed");
        return { siteId, versionId };
      });
    },

    async failImport(url, message) {
      const canonical = canonicalMobbinSitesUrl(url).canonicalUrl;
      await runQuery(
        `UPDATE site_versions
         SET status = 'failed', failure_message = $2, updated_at = now()
         WHERE canonical_url = $1 AND status <> 'ready'`,
        [canonical, safeFailureMessage(message)],
      );
    },

    async siteMediaObject(input) {
      assertPositiveId(input.siteId);
      assertPositiveId(input.versionId);
      const needsRecord = input.kind !== "preview" && input.kind !== "mobile";
      if (needsRecord) assertPositiveId(input.recordId);
      if (!needsRecord && input.recordId !== undefined) {
        throw new Error("Version media has no record ID");
      }

      const selection = mediaSelection(input.kind);
      const values = needsRecord
        ? [input.siteId, input.versionId, input.recordId]
        : [input.siteId, input.versionId];
      const result = await runQuery(
        `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM sites s
         JOIN site_versions sv ON sv.site_id = s.id
         ${selection.joins}
         JOIN stored_objects so ON so.object_key = ${selection.objectKey}
         WHERE s.id = $1 AND sv.id = $2 AND sv.status = 'ready'
         ${selection.recordPredicate}
         LIMIT 1`,
        values,
      );
      return metadataFrom(result.rows[0]);
    },
  };
}

function checkedImport(identity: MobbinSitesIdentity, value: SiteImport) {
  const parsedIdentity = canonicalMobbinSitesUrl(identity.canonicalUrl);
  if (
    parsedIdentity.sourceSiteId !== identity.sourceSiteId ||
    parsedIdentity.sourceVersionId !== identity.sourceVersionId
  ) {
    throw new Error("Site import identity mismatch");
  }
  const graph = parseSiteImport(value);
  if (
    graph.site.slug !== identity.sourceSiteId ||
    graph.version.sourceId !== identity.sourceVersionId
  ) {
    throw new Error("Site import graph mismatch");
  }
  return { checkedIdentity: parsedIdentity, graph };
}

function checkedObjectMetadata(objects: ObjectMetadata[]): Map<string, ObjectMetadata> {
  if (!Array.isArray(objects) || objects.length === 0) throw new Error("Site objects are required");
  const byKey = new Map<string, ObjectMetadata>();
  for (const metadata of objects) {
    validateObjectMetadata(metadata);
    if (byKey.has(metadata.key)) throw new Error("Duplicate Site object metadata");
    byKey.set(metadata.key, metadata);
  }
  return byKey;
}

function assertObjectKeyCoverage(
  input: CompletedSiteImport,
  graph: SiteImport,
  metadataByKey: Map<string, ObjectMetadata>,
): void {
  const required = new Set([input.objectKeys.source, input.objectKeys.preview]);
  if (Object.keys(input.objectKeys.pages).length !== graph.pages.length) {
    throw new Error("Site page object mapping mismatch");
  }
  const sections = graph.pages.flatMap((page) => page.sections);
  if (Object.keys(input.objectKeys.sections).length !== sections.length) {
    throw new Error("Site section object mapping mismatch");
  }
  for (const page of graph.pages) {
    const key = input.objectKeys.pages[page.sourceId];
    if (!key) throw new Error("Site page object mapping mismatch");
    required.add(key);
    for (const section of page.sections) {
      const keys = input.objectKeys.sections[section.sourceId];
      if (!keys?.media) throw new Error("Site section object mapping mismatch");
      required.add(keys.media);
      if (keys.poster) required.add(keys.poster);
    }
  }
  if (
    required.size !== metadataByKey.size ||
    [...required].some((key) => !metadataByKey.has(key))
  ) {
    throw new Error("Site object metadata coverage mismatch");
  }
}

function mediaSelection(
  kind: "preview" | "mobile" | "page" | "section" | "poster",
) {
  if (kind === "preview") {
    return { joins: "", objectKey: "sv.preview_object_key", recordPredicate: "" };
  }
  if (kind === "mobile") {
    return {
      joins: "",
      objectKey: "sv.mobile_page_object_key",
      recordPredicate: "",
    };
  }
  if (kind === "page") {
    return {
      joins: "JOIN site_pages sp ON sp.version_id = sv.id",
      objectKey: "sp.full_page_object_key",
      recordPredicate: "AND sp.id = $3",
    };
  }
  return {
    joins: `JOIN site_pages sp ON sp.version_id = sv.id
         JOIN site_sections ss ON ss.page_id = sp.id`,
    objectKey: kind === "section" ? "ss.media_object_key" : "ss.poster_object_key",
    recordPredicate: "AND ss.id = $3",
  };
}

function mediaPath(
  siteId: number,
  versionId: number,
  kind: "preview" | "mobile" | "page" | "section" | "poster",
  recordId?: number,
): string {
  const base = `/api/sites/${siteId}/versions/${versionId}`;
  if (kind === "preview") return `${base}/media/preview`;
  if (kind === "mobile") return `${base}/media/mobile`;
  if (kind === "page") return `${base}/pages/${recordId}/media`;
  if (kind === "section") return `${base}/sections/${recordId}/media`;
  return `${base}/sections/${recordId}/poster`;
}

function analysisStatus(value: unknown): "ready" | "evidence-only" {
  if (value === undefined || value === null || value === "evidence-only") {
    return "evidence-only";
  }
  if (value === "ready") return "ready";
  throw new Error("Invalid Sites analysis status");
}

function analysisFromRow(value: unknown): SiteAnalysis | null {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length === 0)
  ) {
    return null;
  }
  return parseSiteAnalysis(value);
}

function metadataFrom(row: Record<string, unknown> | undefined): ObjectMetadata | undefined {
  if (!row) return undefined;
  const metadata: ObjectMetadata = {
    key: text(row.object_key),
    sha256: text(row.sha256),
    byteSize: nonNegativeInteger(row.byte_size),
    contentType: row.content_type as ObjectMetadata["contentType"],
    accessClass: row.access_class as ObjectMetadata["accessClass"],
  };
  validateObjectMetadata(metadata);
  return metadata;
}

function safeFailureMessage(value: string): string {
  const message = typeof value === "string" ? value : "Site import failed";
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(authorization|cookie|password|secret|signature|token)\b\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/[\0-\x08\x0b\x0c\x0e-\x1f]/g, " ")
    .slice(0, 1_000) || "Site import failed";
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Invalid Sites database row");
  return value;
}

function positiveId(value: unknown): number {
  const result = Number(value);
  assertPositiveId(result);
  return result;
}

function assertPositiveId(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error("Invalid Site database ID");
  }
}

function nonNegativeInteger(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Invalid Sites database row");
  return result;
}

function finiteNumber(value: unknown): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error("Invalid Sites database row");
  return result;
}

function optionalOrderedBounds(
  startValue: unknown,
  endValue: unknown,
): readonly [number, number] | undefined {
  const hasStart = startValue !== undefined && startValue !== null;
  const hasEnd = endValue !== undefined && endValue !== null;
  if (!hasStart && !hasEnd) return undefined;
  if (hasStart !== hasEnd) throw new Error("Invalid Sites database row");
  const start = finiteNumber(startValue);
  const end = finiteNumber(endValue);
  if (end <= start) throw new Error("Invalid Sites database row");
  return [start, end];
}

function isoDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(text(value));
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid Sites database row");
  return date.toISOString();
}

function enumMediaKind(value: unknown): "image" | "video" {
  if (value !== "image" && value !== "video") throw new Error("Invalid Sites database row");
  return value;
}

function previewMediaKind(value: unknown): "image" | "video" {
  if (value === undefined || value === null) return "video";
  const contentType = text(value).toLowerCase();
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  throw new Error("Invalid Sites database row");
}

function jsonArray(value: unknown): unknown[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error("Invalid Sites database row");
  return parsed;
}

function jsonObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid Sites database row");
  }
  return parsed as Record<string, unknown>;
}

function jsonStringArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const values = jsonArray(value);
  if (values.some((item) => typeof item !== "string" || !item)) {
    throw new Error("Invalid Sites database row");
  }
  return [...new Set(values as string[])];
}

function optionalTextProperty<Key extends string>(
  key: Key,
  value: unknown,
): Partial<Record<Key, string>> {
  if (value === undefined || value === null) return {};
  return { [key]: text(value) } as Record<Key, string>;
}

function optionalNonNegativeInteger(value: unknown): number {
  return value === undefined || value === null ? 0 : nonNegativeInteger(value);
}
