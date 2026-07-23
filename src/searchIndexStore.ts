import type pg from "pg";
import { publishedSearchSource } from "./db.ts";
import type { PublishedSearchSource } from "./searchProjection.ts";
import type { SearchDocument } from "./searchTypes.ts";

export interface SearchIndexJob {
  appId: number;
  platform: string;
  attempts: number;
  workerId: string;
}

export interface SearchIndexScope {
  appId: number;
  platform: string;
  indexVersion: 1;
}

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
  private readonly sourceLoader: (
    appId: number,
    platform: string,
  ) => Promise<PublishedSearchSource | undefined>;

  constructor(
    pool: pg.Pool,
    sourceLoader: (
      appId: number,
      platform: string,
    ) => Promise<PublishedSearchSource | undefined> = publishedSearchSource,
  ) {
    this.pool = pool;
    this.sourceLoader = sourceLoader;
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
      const row = claimed.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      const attempts = row.attempts + 1;
      await client.query(
        `UPDATE search_index_queue
         SET status = 'running', attempts = $3, locked_by = $4, locked_at = now(), updated_at = now()
         WHERE app_id = $1 AND platform = $2`,
        [row.app_id, row.platform, attempts, workerId],
      );
      await client.query("COMMIT");
      return {
        appId: row.app_id,
        platform: row.platform,
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

  loadSource(job: SearchIndexJob): Promise<PublishedSearchSource | undefined> {
    return this.sourceLoader(job.appId, job.platform);
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
      await client.query(
        `SELECT app_id FROM search_index_queue
         WHERE app_id = $1 AND platform = $2 FOR UPDATE`,
        [scope.appId, scope.platform],
      );
      await client.query(
        `DELETE FROM search_documents
         WHERE app_id = $1 AND platform = $2 AND index_version = $3`,
        [scope.appId, scope.platform, scope.indexVersion],
      );
      if (documents.length) {
        const rows = documents.map((document, index) => ({
          document_id: document.documentId,
          index_version: document.indexVersion,
          version_id: document.versionId,
          app_id: document.appId,
          app_name: document.appName,
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
             document_id, index_version, version_id, app_id, app_name, platform,
             entity_type, source_id, title, description, aliases, visible_text,
             page_type, product_area, flow_id, flow_name, flow_step_index,
             components, states, theme, layout_patterns, app_category, published_at,
             captured_at, media_image_id, source_payload, search_text, embedding,
             source_revision
           )
           SELECT document_id, index_version, version_id, app_id, app_name, platform,
             entity_type, source_id, title, description, aliases, visible_text,
             page_type, product_area, flow_id, flow_name, flow_step_index,
             components, states, theme, layout_patterns, app_category, published_at,
             captured_at, media_image_id, source_payload, search_text,
             embedding::vector, source_revision
           FROM jsonb_to_recordset($1::jsonb) AS row(
             document_id text, index_version integer, version_id integer, app_id integer,
             app_name text, platform text, entity_type text, source_id text, title text,
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
    await this.pool.query(
      `DELETE FROM search_index_queue
       WHERE app_id = $1 AND platform = $2 AND locked_by = $3`,
      [job.appId, job.platform, job.workerId],
    );
  }

  async fail(job: SearchIndexJob, error: unknown): Promise<void> {
    const terminal = job.attempts >= retrySeconds.length;
    const delay = terminal ? 3600 : retrySeconds[Math.max(0, job.attempts - 1)];
    await this.pool.query(
      `UPDATE search_index_queue
       SET status = $4,
           next_attempt_at = now() + ($5::integer * interval '1 second'),
           locked_by = NULL,
           locked_at = NULL,
           last_error = $6,
           updated_at = now()
       WHERE app_id = $1 AND platform = $2 AND locked_by = $3`,
      [
        job.appId,
        job.platform,
        job.workerId,
        terminal ? "failed" : "queued",
        delay,
        sanitizedError(error),
      ],
    );
  }

  async enqueue(appId: number, platform: string): Promise<void> {
    await this.pool.query("SELECT enqueue_search_index($1, $2)", [appId, platform]);
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
