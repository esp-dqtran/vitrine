import type pg from "pg";
import { publishedSearchSource, publishedSiteSearchSource } from "./db.ts";
import type { PublishedSearchSource } from "./searchProjection.ts";
import type { PublishedSiteSearchSource } from "./siteSearchProjection.ts";
import type { SearchDocument } from "./searchTypes.ts";

export type SearchIndexJob =
  | {
    kind: "app";
    appId: number;
    platform: string;
    attempts: number;
    workerId: string;
  }
  | {
    kind: "site";
    siteId: number;
    attempts: number;
    workerId: string;
  };

export type SearchIndexScope =
  | { kind: "app"; appId: number; platform: string; indexVersion: 1 }
  | { kind: "site"; siteId: number; indexVersion: 1 };

export type SearchIndexSource = PublishedSearchSource | PublishedSiteSearchSource;

const retrySeconds = [5, 30, 300] as const;

function sanitizedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(?:token|key|secret|password)\s*[=:]?\s*\S+/gi, "[redacted-secret]")
    .slice(0, 1000);
}

function vectorLiteral(vector: number[] | undefined): string | null {
  return vector ? `[${vector.join(",")}]` : null;
}

export class PostgresSearchIndexStore {
  private readonly pool: pg.Pool;
  private readonly appSourceLoader: (
    appId: number,
    platform: string,
  ) => Promise<PublishedSearchSource | undefined>;
  private readonly siteSourceLoader: (
    siteId: number,
  ) => Promise<PublishedSiteSearchSource | undefined>;

  constructor(
    pool: pg.Pool,
    loaders: {
      app?: typeof publishedSearchSource;
      site?: typeof publishedSiteSearchSource;
    } = {},
  ) {
    this.pool = pool;
    this.appSourceLoader = loaders.app ?? publishedSearchSource;
    this.siteSourceLoader = loaders.site ?? publishedSiteSearchSource;
  }

  async claim(workerId: string): Promise<SearchIndexJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const claimed = await client.query<{
        app_id: number;
        platform: string;
        attempts: number;
      }>(
        `SELECT app_id, platform, attempts
         FROM search_index_queue
         WHERE status IN ('queued', 'failed') AND next_attempt_at <= now()
         ORDER BY requested_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const appRow = claimed.rows[0];
      if (appRow) {
        const attempts = appRow.attempts + 1;
        await client.query(
          `UPDATE search_index_queue
           SET status = 'running', attempts = $3, locked_by = $4, locked_at = now(), updated_at = now()
           WHERE app_id = $1 AND platform = $2`,
          [appRow.app_id, appRow.platform, attempts, workerId],
        );
        await client.query("COMMIT");
        return {
          kind: "app",
          appId: appRow.app_id,
          platform: appRow.platform,
          attempts,
          workerId,
        };
      }

      const claimedSite = await client.query<{
        site_id: number;
        attempts: number;
      }>(
        `SELECT site_id, attempts
         FROM site_search_index_queue
         WHERE status IN ('queued', 'failed') AND next_attempt_at <= now()
         ORDER BY requested_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const siteRow = claimedSite.rows[0];
      if (!siteRow) {
        await client.query("COMMIT");
        return null;
      }
      const attempts = siteRow.attempts + 1;
      await client.query(
        `UPDATE site_search_index_queue
         SET status = 'running', attempts = $2, locked_by = $3, locked_at = now(), updated_at = now()
         WHERE site_id = $1`,
        [siteRow.site_id, attempts, workerId],
      );
      await client.query("COMMIT");
      return {
        kind: "site",
        siteId: Number(siteRow.site_id),
        attempts,
        workerId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  loadSource(job: SearchIndexJob): Promise<SearchIndexSource | undefined> {
    return job.kind === "app"
      ? this.appSourceLoader(job.appId, job.platform)
      : this.siteSourceLoader(job.siteId);
  }

  async replaceDocuments(
    scope: SearchIndexScope,
    documents: SearchDocument[],
    embeddings?: number[][],
  ): Promise<void> {
    if (embeddings && embeddings.length !== documents.length) {
      throw new Error("search document and embedding counts differ");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (scope.kind === "app") {
        await client.query(
          `SELECT app_id FROM search_index_queue
           WHERE app_id = $1 AND platform = $2 FOR UPDATE`,
          [scope.appId, scope.platform],
        );
        await client.query(
          `DELETE FROM search_documents
           WHERE catalog_scope = 'apps' AND app_id = $1 AND platform = $2 AND index_version = $3`,
          [scope.appId, scope.platform, scope.indexVersion],
        );
      } else {
        await client.query(
          "SELECT site_id FROM site_search_index_queue WHERE site_id = $1 FOR UPDATE",
          [scope.siteId],
        );
        await client.query(
          `DELETE FROM search_documents
           WHERE catalog_scope = 'sites' AND site_id = $1 AND index_version = $2`,
          [scope.siteId, scope.indexVersion],
        );
      }
      if (documents.length) {
        const rows = documents.map((document, index) => ({
          document_id: document.documentId,
          index_version: document.indexVersion,
          catalog_scope: document.catalogScope,
          catalog_name: document.catalogName,
          version_id: document.versionId ?? null,
          app_id: document.appId ?? null,
          app_name: document.appName ?? null,
          site_id: document.siteId ?? null,
          site_version_id: document.siteVersionId ?? null,
          catalog_categories: document.catalogCategories,
          site_sections: document.siteSections,
          site_styles: document.siteStyles,
          platform: document.platform,
          entity_type: document.entityType,
          source_id: document.sourceId,
          title: document.title,
          description: document.description,
          aliases: document.aliases,
          visible_text: document.visibleText,
          page_type: document.pageType ?? null,
          product_area: document.productArea ?? null,
          flow_id: document.flowId ?? null,
          flow_name: document.flowName ?? null,
          flow_step_index: document.flowStepIndex ?? null,
          components: document.components,
          states: document.states,
          theme: document.theme ?? null,
          layout_patterns: document.layoutPatterns,
          app_category: document.appCategory ?? null,
          published_at: document.publishedAt,
          captured_at: document.capturedAt ?? null,
          media_image_id: document.mediaImageId ?? null,
          source_payload: document.sourcePayload,
          search_text: document.searchText,
          embedding: vectorLiteral(embeddings?.[index]),
          source_revision: document.sourceRevision,
        }));
        await client.query(
          `INSERT INTO search_documents (
             document_id, index_version, catalog_scope, catalog_name,
             version_id, app_id, app_name, site_id, site_version_id,
             catalog_categories, site_sections, site_styles, platform,
             entity_type, source_id, title, description, aliases, visible_text,
             page_type, product_area, flow_id, flow_name, flow_step_index,
             components, states, theme, layout_patterns, app_category, published_at,
             captured_at, media_image_id, source_payload, search_text, embedding,
             source_revision
           )
           SELECT document_id, index_version, catalog_scope, catalog_name,
             version_id, app_id, app_name, site_id, site_version_id,
             catalog_categories, site_sections, site_styles, platform,
             entity_type, source_id, title, description, aliases, visible_text,
             page_type, product_area, flow_id, flow_name, flow_step_index,
             components, states, theme, layout_patterns, app_category, published_at,
             captured_at, media_image_id, source_payload, search_text,
             embedding::vector, source_revision
           FROM jsonb_to_recordset($1::jsonb) AS row(
             document_id text, index_version integer, catalog_scope text, catalog_name text,
             version_id integer, app_id integer, app_name text, site_id bigint,
             site_version_id bigint, catalog_categories text[], site_sections text[],
             site_styles text[], platform text, entity_type text, source_id text, title text,
             description text, aliases text[], visible_text text, page_type text,
             product_area text, flow_id text, flow_name text, flow_step_index integer,
             components text[], states text[], theme text, layout_patterns text[],
             app_category text, published_at timestamptz, captured_at timestamptz,
             media_image_id integer, source_payload jsonb, search_text text,
             embedding text, source_revision text
           )`,
          [JSON.stringify(rows)],
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

  async complete(job: SearchIndexJob): Promise<void> {
    if (job.kind === "app") {
      await this.pool.query(
        `DELETE FROM search_index_queue
         WHERE app_id = $1 AND platform = $2 AND locked_by = $3`,
        [job.appId, job.platform, job.workerId],
      );
    } else {
      await this.pool.query(
        "DELETE FROM site_search_index_queue WHERE site_id = $1 AND locked_by = $2",
        [job.siteId, job.workerId],
      );
    }
  }

  async fail(job: SearchIndexJob, error: unknown): Promise<void> {
    const terminal = job.attempts >= retrySeconds.length;
    const delay = terminal ? 3600 : retrySeconds[Math.max(0, job.attempts - 1)];
    if (job.kind === "app") {
      await this.pool.query(
        `UPDATE search_index_queue
         SET status = $4,
             next_attempt_at = now() + ($5::integer * interval '1 second'),
             locked_by = NULL, locked_at = NULL, last_error = $6, updated_at = now()
         WHERE app_id = $1 AND platform = $2 AND locked_by = $3`,
        [
          job.appId, job.platform, job.workerId,
          terminal ? "failed" : "queued", delay, sanitizedError(error),
        ],
      );
    } else {
      await this.pool.query(
        `UPDATE site_search_index_queue
         SET status = $3,
             next_attempt_at = now() + ($4::integer * interval '1 second'),
             locked_by = NULL, locked_at = NULL, last_error = $5, updated_at = now()
         WHERE site_id = $1 AND locked_by = $2`,
        [
          job.siteId, job.workerId,
          terminal ? "failed" : "queued", delay, sanitizedError(error),
        ],
      );
    }
  }

  async enqueue(appId: number, platform: string): Promise<void> {
    await this.pool.query("SELECT enqueue_search_index($1, $2)", [appId, platform]);
  }

  async enqueueSite(siteId: number): Promise<void> {
    await this.pool.query("SELECT enqueue_site_search_index($1)", [siteId]);
  }

  async enqueueAllPublished(): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO search_index_queue (app_id, platform)
       SELECT DISTINCT app_id, platform FROM app_versions WHERE status = 'published'
       ON CONFLICT (app_id, platform) DO UPDATE SET
         status = 'queued', attempts = 0, next_attempt_at = now(),
         locked_by = NULL, locked_at = NULL, last_error = NULL,
         requested_at = now(), updated_at = now()`,
    );
    return result.rowCount ?? 0;
  }

  async enqueueAllReadySites(): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO site_search_index_queue (site_id)
       SELECT DISTINCT site_id FROM site_versions WHERE status = 'ready'
       ON CONFLICT (site_id) DO UPDATE SET
         status = 'queued', attempts = 0, next_attempt_at = now(),
         locked_by = NULL, locked_at = NULL, last_error = NULL,
         requested_at = now(), updated_at = now()`,
    );
    return result.rowCount ?? 0;
  }

  async documentsFor(appId: number, platform: string): Promise<Array<{ documentId: string }>> {
    const result = await this.pool.query<{ document_id: string }>(
      `SELECT document_id FROM search_documents
       WHERE app_id = $1 AND platform = $2 AND index_version = 1
       ORDER BY document_id`,
      [appId, platform],
    );
    return result.rows.map(({ document_id }) => ({ documentId: document_id }));
  }
}
