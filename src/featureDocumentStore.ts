import type { QueryResult } from "pg";
import { query as databaseQuery, withTransaction } from "./db.ts";
import {
  parseFeatureDocumentContent,
  parseFeatureStepAnalysis,
  type CreateFeatureGenerationInput,
  type FeatureDocumentContent,
  type FeatureDocumentJobStage,
  type FeatureDocumentJobView,
  type FeatureDocumentReviewStatus,
  type FeatureDocumentRevisionView,
  type FeatureDocumentShareView,
  type FeatureDocumentView,
  type FeatureEvidenceManifestItem,
  type FeatureSourceFlow,
  type FeatureStepAnalysis,
} from "./featureDocument.ts";
import { validateObjectMetadata, type ObjectMetadata } from "./objectStore.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type TransactionRunner = <T>(work: (query: DatabaseQuery) => Promise<T>) => Promise<T>;

export interface FeatureDocumentWorkerJob extends FeatureDocumentJobView {
  transportJobId: number;
  requestedBy: number;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
  cancelRequested: boolean;
}

export interface FeatureStepAnalysisRecord {
  jobId: number;
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  result: FeatureStepAnalysis;
  attemptCount: number;
}

export interface RecordedStepAnalysis {
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  result: FeatureStepAnalysis;
  attemptCount: number;
}

export interface RecordedStepFailure {
  stepIndex: number;
  imageIndex: number;
  imageId: number;
  evidenceId: string;
  errorCode: string;
  attemptCount: number;
}

export interface CompleteFeatureGenerationInput {
  content: FeatureDocumentContent;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
  evidenceManifestSha256: string;
  focusInstruction: string;
  promptVersion: number;
  providerModel: string;
}

export interface PublicFeatureDocumentShare {
  title: string;
  reviewStatus: FeatureDocumentReviewStatus;
  revision: FeatureDocumentRevisionView;
  expiresAt: string;
}

export interface FeatureDocumentStore {
  createGeneration(userId: number, input: CreateFeatureGenerationInput): Promise<{ document: FeatureDocumentView; job: FeatureDocumentJobView }>;
  createRegeneration(userId: number, documentId: number, input: CreateFeatureGenerationInput): Promise<FeatureDocumentJobView | undefined>;
  getDocument(userId: number, documentId: number, currentSourceSha256?: string): Promise<FeatureDocumentView | undefined>;
  getJob(userId: number, jobId: number): Promise<FeatureDocumentJobView | undefined>;
  workerJob(jobId: number): Promise<FeatureDocumentWorkerJob | undefined>;
  requestCancel(userId: number, jobId: number): Promise<FeatureDocumentJobView | undefined>;
  claimJob(jobId: number): Promise<FeatureDocumentWorkerJob | undefined>;
  updateProgress(jobId: number, stage: FeatureDocumentJobStage, doneCount: number): Promise<void>;
  completedStepAnalyses(jobId: number): Promise<FeatureStepAnalysisRecord[]>;
  recordStepAnalysis(jobId: number, input: RecordedStepAnalysis): Promise<void>;
  recordStepFailure(jobId: number, input: RecordedStepFailure): Promise<void>;
  completeGeneration(jobId: number, input: CompleteFeatureGenerationInput): Promise<FeatureDocumentRevisionView>;
  failJob(jobId: number, code: string, safeMessage: string): Promise<void>;
  markStale(jobId: number): Promise<void>;
  saveRevision(userId: number, documentId: number, expectedRevisionId: number, content: FeatureDocumentContent): Promise<FeatureDocumentRevisionView | undefined>;
  restoreRevision(userId: number, documentId: number, revisionId: number): Promise<FeatureDocumentRevisionView | undefined>;
  setReviewStatus(userId: number, documentId: number, revisionId: number, status: FeatureDocumentReviewStatus): Promise<FeatureDocumentView | undefined>;
  acknowledgeSourceChange(userId: number, documentId: number, currentSourceSha256: string): Promise<FeatureDocumentView | undefined>;
  createShare(userId: number, documentId: number, revisionId: number, tokenSha256: string, now: Date): Promise<FeatureDocumentShareView | undefined>;
  revokeShare(userId: number, documentId: number, shareId: number): Promise<boolean>;
  documentImage(userId: number, documentId: number, revisionId: number, imageId: number): Promise<ObjectMetadata | undefined>;
  publicShare(tokenSha256: string, now: Date): Promise<PublicFeatureDocumentShare | undefined>;
  publicShareImage(tokenSha256: string, imageId: number, now: Date): Promise<ObjectMetadata | undefined>;
}

const SHA256 = /^[0-9a-f]{64}$/;
const REVIEW_STATUSES = new Set<FeatureDocumentReviewStatus>(["draft", "in_review", "approved", "superseded"]);
const JOB_STAGES = new Set<FeatureDocumentJobStage>(["preparing", "analyzing", "synthesizing", "validating", "saving", "complete"]);

const liveQuery: DatabaseQuery = (sql, values) => databaseQuery(sql, values ? [...values] : undefined);

function defaultTransaction(runQuery: DatabaseQuery): TransactionRunner {
  if (runQuery !== liveQuery) return async (work) => work(runQuery);
  return async (work) => withTransaction((client) => work(
    (sql, values) => client.query(sql, values ? [...values] : undefined),
  ));
}

function integer(value: unknown, label = "database identifier"): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${label}`);
  return parsed;
}

function positiveInteger(value: unknown, label = "database identifier"): number {
  const parsed = integer(value, label);
  if (parsed < 1) throw new Error(`Invalid ${label}`);
  return parsed;
}

function text(value: unknown, label = "database text"): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}`);
  return value;
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(text(value, "database timestamp"));
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid database timestamp");
  return date.toISOString();
}

function checkedSha256(value: string): string {
  if (!SHA256.test(value)) throw new Error("Invalid SHA-256");
  return value;
}

function checkedErrorCode(value: string): string {
  const result = value.trim();
  if (!/^[a-z0-9_]{1,80}$/.test(result)) throw new Error("Invalid feature document error code");
  return result;
}

function safeErrorMessage(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 1_000) || "Feature document generation failed";
}

function checkedSource(value: FeatureSourceFlow): FeatureSourceFlow {
  if (!value || typeof value !== "object") throw new Error("Feature source is required");
  if (!value.app?.trim() || !value.flowId?.trim() || !value.title?.trim()) throw new Error("Invalid feature source");
  if (value.platform !== "ios" && value.platform !== "android" && value.platform !== "web") throw new Error("Invalid feature source platform");
  if (value.versionId !== undefined) positiveInteger(value.versionId, "source version");
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) throw new Error("Invalid feature source tags");
  return structuredClone(value);
}

function checkedManifest(value: FeatureEvidenceManifestItem[]): FeatureEvidenceManifestItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) throw new Error("Feature evidence is required");
  const identities = new Set<string>();
  const positions = new Set<string>();
  return value.map((item) => {
    const stepIndex = integer(item.stepIndex, "evidence step index");
    const imageIndex = integer(item.imageIndex, "evidence image index");
    const imageId = positiveInteger(item.imageId, "evidence image");
    if (typeof item.evidenceId !== "string" || !item.evidenceId.trim() || item.evidenceId.length > 240) throw new Error("Invalid evidence identity");
    if (identities.has(item.evidenceId)) throw new Error("Duplicate evidence identity");
    const position = `${stepIndex}:${imageIndex}`;
    if (positions.has(position)) throw new Error("Duplicate evidence position");
    identities.add(item.evidenceId);
    positions.add(position);
    if (typeof item.stepLabel !== "string" || !item.stepLabel.trim()) throw new Error("Invalid evidence step label");
    return structuredClone(item);
  });
}

function checkedGeneration(input: CreateFeatureGenerationInput): CreateFeatureGenerationInput {
  positiveInteger(input.transportJobId, "transport job");
  if (!Number.isSafeInteger(input.promptVersion) || input.promptVersion < 1) throw new Error("Invalid prompt version");
  if (!input.providerModel?.trim() || input.providerModel.length > 160) throw new Error("Invalid provider model");
  if (typeof input.focusInstruction !== "string" || input.focusInstruction.length > 2_000) throw new Error("Invalid focus instruction");
  return {
    ...input,
    source: checkedSource(input.source),
    evidenceManifest: checkedManifest(input.evidenceManifest),
    evidenceManifestSha256: checkedSha256(input.evidenceManifestSha256),
    focusInstruction: input.focusInstruction.trim(),
    providerModel: input.providerModel.trim(),
  };
}

function manifestFrom(value: unknown): FeatureEvidenceManifestItem[] {
  return checkedManifest(value as FeatureEvidenceManifestItem[]);
}

function sourceFrom(value: unknown): FeatureSourceFlow {
  return checkedSource(value as FeatureSourceFlow);
}

function jobFromRow(row: Record<string, unknown> | undefined): FeatureDocumentJobView | undefined {
  if (!row) return undefined;
  return {
    id: positiveInteger(row.id),
    documentId: positiveInteger(row.document_id),
    status: row.status as FeatureDocumentJobView["status"],
    stage: row.stage as FeatureDocumentJobStage,
    doneCount: integer(row.done_count, "job progress"),
    totalCount: positiveInteger(row.total_count, "job total"),
    ...(row.error_code == null ? {} : { errorCode: text(row.error_code) }),
    ...(row.error_message == null ? {} : { errorMessage: text(row.error_message) }),
    updatedAt: iso(row.updated_at),
  };
}

function workerJobFromRow(row: Record<string, unknown> | undefined): FeatureDocumentWorkerJob | undefined {
  const base = jobFromRow(row);
  if (!base || !row) return undefined;
  return {
    ...base,
    transportJobId: positiveInteger(row.transport_job_id, "transport job"),
    requestedBy: positiveInteger(row.requested_by, "requester"),
    source: sourceFrom(row.source_flow),
    evidenceManifest: manifestFrom(row.evidence_manifest),
    evidenceManifestSha256: checkedSha256(text(row.evidence_manifest_sha256)),
    focusInstruction: text(row.focus_instruction),
    promptVersion: positiveInteger(row.prompt_version, "prompt version"),
    providerModel: text(row.provider_model),
    cancelRequested: row.cancel_requested === true,
  };
}

function revisionFromRow(row: Record<string, unknown>): FeatureDocumentRevisionView {
  const manifest = manifestFrom(row.evidence_manifest);
  return {
    id: positiveInteger(row.id),
    documentId: positiveInteger(row.document_id),
    revisionNumber: positiveInteger(row.revision_number, "revision number"),
    authorType: row.author_type as FeatureDocumentRevisionView["authorType"],
    reviewStatus: row.review_status as FeatureDocumentReviewStatus,
    content: parseFeatureDocumentContent(row.content, new Set(manifest.map(({ evidenceId }) => evidenceId))),
    source: sourceFrom(row.source_flow),
    evidenceManifest: manifest,
    focusInstruction: text(row.focus_instruction),
    promptVersion: positiveInteger(row.prompt_version, "prompt version"),
    providerModel: text(row.provider_model),
    createdAt: iso(row.created_at),
  };
}

function objectFromRow(row: Record<string, unknown> | undefined): ObjectMetadata | undefined {
  if (!row) return undefined;
  const metadata: ObjectMetadata = {
    key: text(row.object_key),
    sha256: text(row.sha256),
    byteSize: positiveInteger(row.byte_size, "object byte size"),
    contentType: row.content_type as ObjectMetadata["contentType"],
    accessClass: row.access_class as ObjectMetadata["accessClass"],
  };
  validateObjectMetadata(metadata);
  return metadata;
}

const JOB_COLUMNS = `j.id, j.document_id, j.transport_job_id, j.requested_by, j.status, j.stage,
  j.done_count, j.total_count, j.source_flow, j.evidence_manifest, j.evidence_manifest_sha256,
  j.focus_instruction, j.prompt_version, j.provider_model, j.cancel_requested,
  j.error_code, j.error_message, j.updated_at`;

const REVISION_COLUMNS = `r.id, r.document_id, r.revision_number, r.author_type, r.review_status,
  r.content, r.source_flow, r.evidence_manifest, r.focus_instruction, r.prompt_version,
  r.provider_model, r.created_at`;

async function loadDocument(
  runQuery: DatabaseQuery,
  userId: number,
  documentId: number,
  currentSourceSha256?: string,
): Promise<FeatureDocumentView | undefined> {
  const documentResult = await runQuery(
    `SELECT d.id, d.title, d.current_revision_id, d.source_change_acknowledged_sha256,
            current_revision.evidence_manifest_sha256 AS revision_source_sha256,
            (SELECT j.evidence_manifest_sha256 FROM feature_document_jobs j
             WHERE j.document_id = d.id ORDER BY j.created_at DESC, j.id DESC LIMIT 1) AS current_source_sha256
     FROM feature_documents d
     LEFT JOIN feature_document_revisions current_revision ON current_revision.id = d.current_revision_id
     WHERE d.id = $1 AND d.user_id = $2`,
    [documentId, userId],
  );
  const document = documentResult.rows[0];
  if (!document) return undefined;
  const [revisionResult, jobResult] = await Promise.all([
    runQuery(
      `SELECT ${REVISION_COLUMNS}
       FROM feature_document_revisions r
       WHERE r.document_id = $1 ORDER BY r.revision_number DESC`,
      [documentId],
    ),
    runQuery(
      `SELECT ${JOB_COLUMNS}
       FROM feature_document_jobs j
       WHERE j.document_id = $1 ORDER BY j.created_at DESC, j.id DESC LIMIT 1`,
      [documentId],
    ),
  ]);
  const revisions = revisionResult.rows.map(revisionFromRow);
  const currentRevisionId = document.current_revision_id == null ? undefined : positiveInteger(document.current_revision_id);
  const currentRevision = currentRevisionId === undefined ? undefined : revisions.find(({ id }) => id === currentRevisionId);
  const revisionSha = document.revision_source_sha256 == null ? undefined : text(document.revision_source_sha256);
  const currentSha = currentSourceSha256
    ? checkedSha256(currentSourceSha256)
    : document.current_source_sha256 == null ? revisionSha : text(document.current_source_sha256);
  const acknowledgedSha = document.source_change_acknowledged_sha256 == null ? undefined : text(document.source_change_acknowledged_sha256);
  return {
    id: positiveInteger(document.id),
    title: text(document.title),
    reviewStatus: currentRevision?.reviewStatus ?? "draft",
    sourceChanged: Boolean(revisionSha && currentSha && revisionSha !== currentSha && acknowledgedSha !== currentSha),
    ...(currentRevision ? { currentRevision } : {}),
    revisions,
    ...(jobResult.rows[0] ? { currentJob: jobFromRow(jobResult.rows[0]) } : {}),
  };
}

async function insertJob(runQuery: DatabaseQuery, documentId: number, userId: number, input: CreateFeatureGenerationInput): Promise<FeatureDocumentJobView> {
  const result = await runQuery(
    `INSERT INTO feature_document_jobs
       (document_id, transport_job_id, requested_by, total_count, source_version_id, source_flow,
        evidence_manifest, evidence_manifest_sha256, focus_instruction, prompt_version, provider_model)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
     RETURNING id, document_id, status, stage, done_count, total_count, error_code, error_message, updated_at`,
    [
      documentId,
      input.transportJobId,
      userId,
      input.evidenceManifest.length,
      input.source.versionId ?? null,
      JSON.stringify(input.source),
      JSON.stringify(input.evidenceManifest),
      input.evidenceManifestSha256,
      input.focusInstruction,
      input.promptVersion,
      input.providerModel,
    ],
  );
  return jobFromRow(result.rows[0])!;
}

async function insertRevision(
  runQuery: DatabaseQuery,
  input: {
    documentId: number;
    authorType: FeatureDocumentRevisionView["authorType"];
    reviewStatus?: FeatureDocumentReviewStatus;
    content: FeatureDocumentContent;
    source: FeatureSourceFlow;
    evidenceManifest: FeatureEvidenceManifestItem[];
    evidenceManifestSha256: string;
    focusInstruction: string;
    promptVersion: number;
    providerModel: string;
    createdBy: number;
  },
): Promise<FeatureDocumentRevisionView> {
  const result = await runQuery(
    `INSERT INTO feature_document_revisions
       (document_id, revision_number, author_type, review_status, content, source_version_id,
        source_flow, evidence_manifest, evidence_manifest_sha256, focus_instruction,
        prompt_version, provider_model, created_by)
     SELECT $1, COALESCE(MAX(revision_number), 0) + 1, $2, $3, $4::jsonb, $5,
            $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12
     FROM feature_document_revisions WHERE document_id = $1
     RETURNING id, document_id, revision_number, author_type, review_status, content, source_flow,
               evidence_manifest, focus_instruction, prompt_version, provider_model, created_at`,
    [
      input.documentId,
      input.authorType,
      input.reviewStatus ?? "draft",
      JSON.stringify(input.content),
      input.source.versionId ?? null,
      JSON.stringify(input.source),
      JSON.stringify(input.evidenceManifest),
      input.evidenceManifestSha256,
      input.focusInstruction,
      input.promptVersion,
      input.providerModel,
      input.createdBy,
    ],
  );
  return revisionFromRow(result.rows[0]);
}

export function createFeatureDocumentStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): FeatureDocumentStore {
  return {
    async createGeneration(userId, rawInput) {
      const input = checkedGeneration(rawInput);
      positiveInteger(userId, "user");
      return runTransaction(async (tx) => {
        const sourceRows = await tx(
          `SELECT a.id AS app_id, p.id AS platform_id
           FROM apps a JOIN platforms p ON p.app_id = a.id
           WHERE a.name = $1 AND p.name = $2`,
          [input.source.app, input.source.platform],
        );
        const sourceRow = sourceRows.rows[0];
        if (!sourceRow) throw new Error("Feature source was not found");
        const created = await tx(
          `INSERT INTO feature_documents (user_id, app_id, platform_id, source_flow_id, title)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, title`,
          [userId, sourceRow.app_id, sourceRow.platform_id, input.source.flowId, input.source.title.slice(0, 160)],
        );
        const documentId = positiveInteger(created.rows[0].id);
        const job = await insertJob(tx, documentId, userId, input);
        return {
          document: {
            id: documentId,
            title: text(created.rows[0].title),
            reviewStatus: "draft",
            sourceChanged: false,
            revisions: [],
            currentJob: job,
          },
          job,
        };
      });
    },

    async createRegeneration(userId, documentId, rawInput) {
      const input = checkedGeneration(rawInput);
      return runTransaction(async (tx) => {
        const owned = await tx(
          `SELECT d.id FROM feature_documents d
           JOIN apps a ON a.id = d.app_id JOIN platforms p ON p.id = d.platform_id
           WHERE d.id = $1 AND d.user_id = $2 AND a.name = $3 AND p.name = $4
           FOR UPDATE OF d`,
          [documentId, userId, input.source.app, input.source.platform],
        );
        if (!owned.rows[0]) return undefined;
        await tx("UPDATE feature_documents SET updated_at = now() WHERE id = $1", [documentId]);
        return insertJob(tx, documentId, userId, input);
      });
    },

    getDocument(userId, documentId, currentSourceSha256) {
      return loadDocument(runQuery, userId, documentId, currentSourceSha256);
    },

    async getJob(userId, jobId) {
      const result = await runQuery(
        `SELECT ${JOB_COLUMNS}
         FROM feature_document_jobs j JOIN feature_documents d ON d.id = j.document_id
         WHERE j.id = $1 AND d.user_id = $2`,
        [jobId, userId],
      );
      return jobFromRow(result.rows[0]);
    },

    async workerJob(jobId) {
      const result = await runQuery(`SELECT ${JOB_COLUMNS} FROM feature_document_jobs j WHERE j.id = $1`, [jobId]);
      return workerJobFromRow(result.rows[0]);
    },

    async requestCancel(userId, jobId) {
      const result = await runQuery(
        `UPDATE feature_document_jobs j SET cancel_requested = true, updated_at = now()
         FROM feature_documents d
         WHERE j.id = $1 AND d.id = j.document_id AND d.user_id = $2
           AND j.status IN ('queued', 'running')
         RETURNING ${JOB_COLUMNS}`,
        [jobId, userId],
      );
      return jobFromRow(result.rows[0]);
    },

    async claimJob(jobId) {
      const result = await runQuery(
        `UPDATE feature_document_jobs j
         SET status = CASE WHEN cancel_requested THEN 'cancelled' ELSE 'running' END,
             updated_at = now(),
             completed_at = CASE WHEN cancel_requested THEN now() ELSE NULL END
         WHERE j.id = $1 AND j.status IN ('queued', 'running')
         RETURNING ${JOB_COLUMNS}`,
        [jobId],
      );
      return workerJobFromRow(result.rows[0]);
    },

    async updateProgress(jobId, stage, doneCount) {
      if (!JOB_STAGES.has(stage)) throw new Error("Invalid feature document stage");
      integer(doneCount, "job progress");
      const result = await runQuery(
        `UPDATE feature_document_jobs
         SET stage = $2, done_count = $3, updated_at = now()
         WHERE id = $1 AND status = 'running' AND $3 <= total_count`,
        [jobId, stage, doneCount],
      );
      if (result.rowCount !== 1) throw new Error("Feature document job cannot accept progress");
    },

    async completedStepAnalyses(jobId) {
      const result = await runQuery(
        `SELECT job_id, step_index, image_index, image_id, evidence_id, result, attempt_count
         FROM feature_document_step_analyses
         WHERE job_id = $1 AND status = 'complete'
         ORDER BY step_index, image_index`,
        [jobId],
      );
      return result.rows.map((row) => {
        const evidenceId = text(row.evidence_id);
        return {
          jobId: positiveInteger(row.job_id),
          stepIndex: integer(row.step_index),
          imageIndex: integer(row.image_index),
          imageId: positiveInteger(row.image_id),
          evidenceId,
          result: parseFeatureStepAnalysis(row.result, evidenceId),
          attemptCount: positiveInteger(row.attempt_count, "attempt count"),
        };
      });
    },

    async recordStepAnalysis(jobId, input) {
      const result = parseFeatureStepAnalysis(input.result, input.evidenceId);
      await runQuery(
        `INSERT INTO feature_document_step_analyses
           (job_id, step_index, image_index, image_id, evidence_id, status, result, attempt_count)
         VALUES ($1, $2, $3, $4, $5, 'complete', $6::jsonb, $7)
         ON CONFLICT (job_id, step_index, image_index) DO UPDATE SET
           image_id = EXCLUDED.image_id, evidence_id = EXCLUDED.evidence_id,
           status = 'complete', result = EXCLUDED.result, attempt_count = EXCLUDED.attempt_count,
           error_code = NULL, updated_at = now()`,
        [jobId, input.stepIndex, input.imageIndex, input.imageId, input.evidenceId, JSON.stringify(result), input.attemptCount],
      );
    },

    async recordStepFailure(jobId, input) {
      await runQuery(
        `INSERT INTO feature_document_step_analyses
           (job_id, step_index, image_index, image_id, evidence_id, status, result, attempt_count, error_code)
         VALUES ($1, $2, $3, $4, $5, 'failed', NULL, $6, $7)
         ON CONFLICT (job_id, step_index, image_index) DO UPDATE SET
           image_id = EXCLUDED.image_id, evidence_id = EXCLUDED.evidence_id,
           status = 'failed', result = NULL, attempt_count = EXCLUDED.attempt_count,
           error_code = EXCLUDED.error_code, updated_at = now()`,
        [jobId, input.stepIndex, input.imageIndex, input.imageId, input.evidenceId, input.attemptCount, checkedErrorCode(input.errorCode)],
      );
    },

    async completeGeneration(jobId, rawInput) {
      const source = checkedSource(rawInput.source);
      const evidenceManifest = checkedManifest(rawInput.evidenceManifest);
      const checksum = checkedSha256(rawInput.evidenceManifestSha256);
      const content = parseFeatureDocumentContent(rawInput.content, new Set(evidenceManifest.map(({ evidenceId }) => evidenceId)));
      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT j.document_id, j.requested_by, j.status, j.evidence_manifest_sha256
           FROM feature_document_jobs j WHERE j.id = $1 FOR UPDATE`,
          [jobId],
        );
        const job = locked.rows[0];
        if (!job || (job.status !== "running" && job.status !== "queued")) throw new Error("Feature document job is not active");
        if (text(job.evidence_manifest_sha256) !== checksum) throw new Error("Feature document source changed during generation");
        const documentId = positiveInteger(job.document_id);
        await tx("SELECT id FROM feature_documents WHERE id = $1 FOR UPDATE", [documentId]);
        const revision = await insertRevision(tx, {
          documentId,
          authorType: "generated",
          content,
          source,
          evidenceManifest,
          evidenceManifestSha256: checksum,
          focusInstruction: rawInput.focusInstruction.trim(),
          promptVersion: rawInput.promptVersion,
          providerModel: rawInput.providerModel.trim(),
          createdBy: positiveInteger(job.requested_by),
        });
        await tx("UPDATE feature_documents SET current_revision_id = $2, updated_at = now() WHERE id = $1", [documentId, revision.id]);
        await tx(
          `UPDATE feature_document_jobs
           SET status = 'done', stage = 'complete', done_count = total_count,
               updated_at = now(), completed_at = now()
           WHERE id = $1`,
          [jobId],
        );
        return revision;
      });
    },

    async failJob(jobId, code, safeMessage) {
      await runQuery(
        `UPDATE feature_document_jobs
         SET status = 'error', error_code = $2, error_message = $3, updated_at = now(), completed_at = now()
         WHERE id = $1 AND status IN ('queued', 'running')`,
        [jobId, checkedErrorCode(code), safeErrorMessage(safeMessage)],
      );
    },

    async markStale(jobId) {
      await runQuery(
        `UPDATE feature_document_jobs
         SET status = 'stale', error_code = 'source_changed', error_message = 'The source Flow changed during generation',
             updated_at = now(), completed_at = now()
         WHERE id = $1 AND status IN ('queued', 'running')`,
        [jobId],
      );
    },

    async saveRevision(userId, documentId, expectedRevisionId, rawContent) {
      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT d.current_revision_id, r.source_flow, r.evidence_manifest, r.evidence_manifest_sha256,
                  r.focus_instruction, r.prompt_version, r.provider_model
           FROM feature_documents d
           JOIN feature_document_revisions r ON r.id = d.current_revision_id
           WHERE d.id = $1 AND d.user_id = $2 AND d.current_revision_id = $3
           FOR UPDATE OF d`,
          [documentId, userId, expectedRevisionId],
        );
        const current = locked.rows[0];
        if (!current) return undefined;
        const evidenceManifest = manifestFrom(current.evidence_manifest);
        const content = parseFeatureDocumentContent(rawContent, new Set(evidenceManifest.map(({ evidenceId }) => evidenceId)));
        const revision = await insertRevision(tx, {
          documentId,
          authorType: "user",
          content,
          source: sourceFrom(current.source_flow),
          evidenceManifest,
          evidenceManifestSha256: checkedSha256(text(current.evidence_manifest_sha256)),
          focusInstruction: text(current.focus_instruction),
          promptVersion: positiveInteger(current.prompt_version, "prompt version"),
          providerModel: text(current.provider_model),
          createdBy: userId,
        });
        await tx("UPDATE feature_documents SET current_revision_id = $2, updated_at = now() WHERE id = $1", [documentId, revision.id]);
        return revision;
      });
    },

    async restoreRevision(userId, documentId, revisionId) {
      return runTransaction(async (tx) => {
        const owned = await tx(
          `SELECT d.id FROM feature_documents d WHERE d.id = $1 AND d.user_id = $2 FOR UPDATE`,
          [documentId, userId],
        );
        if (!owned.rows[0]) return undefined;
        const selected = await tx(
          `SELECT r.content, r.source_flow, r.evidence_manifest, r.evidence_manifest_sha256,
                  r.focus_instruction, r.prompt_version, r.provider_model
           FROM feature_document_revisions r WHERE r.id = $1 AND r.document_id = $2`,
          [revisionId, documentId],
        );
        const sourceRevision = selected.rows[0];
        if (!sourceRevision) return undefined;
        const evidenceManifest = manifestFrom(sourceRevision.evidence_manifest);
        const content = parseFeatureDocumentContent(sourceRevision.content, new Set(evidenceManifest.map(({ evidenceId }) => evidenceId)));
        const revision = await insertRevision(tx, {
          documentId,
          authorType: "restored",
          content,
          source: sourceFrom(sourceRevision.source_flow),
          evidenceManifest,
          evidenceManifestSha256: checkedSha256(text(sourceRevision.evidence_manifest_sha256)),
          focusInstruction: text(sourceRevision.focus_instruction),
          promptVersion: positiveInteger(sourceRevision.prompt_version, "prompt version"),
          providerModel: text(sourceRevision.provider_model),
          createdBy: userId,
        });
        await tx("UPDATE feature_documents SET current_revision_id = $2, updated_at = now() WHERE id = $1", [documentId, revision.id]);
        return revision;
      });
    },

    async setReviewStatus(userId, documentId, revisionId, status) {
      if (!REVIEW_STATUSES.has(status)) throw new Error("Invalid feature document review status");
      return runTransaction(async (tx) => {
        const owned = await tx(
          `SELECT id FROM feature_documents
           WHERE id = $1 AND user_id = $2 AND current_revision_id = $3 FOR UPDATE`,
          [documentId, userId, revisionId],
        );
        if (!owned.rows[0]) return undefined;
        if (status === "approved") {
          await tx(
            `UPDATE feature_document_revisions
             SET review_status = 'superseded'
             WHERE document_id = $1 AND id <> $2 AND review_status = 'approved'`,
            [documentId, revisionId],
          );
        }
        await tx(
          `UPDATE feature_document_revisions SET review_status = $3
           WHERE id = $2 AND document_id = $1`,
          [documentId, revisionId, status],
        );
        await tx("UPDATE feature_documents SET updated_at = now() WHERE id = $1", [documentId]);
        return loadDocument(tx, userId, documentId);
      });
    },

    async acknowledgeSourceChange(userId, documentId, currentSourceSha256) {
      const checksum = checkedSha256(currentSourceSha256);
      return runTransaction(async (tx) => {
        const changed = await tx(
          `SELECT d.id FROM feature_documents d
           WHERE d.id = $1 AND d.user_id = $2 FOR UPDATE OF d`,
          [documentId, userId],
        );
        if (!changed.rows[0]) return undefined;
        await tx(
          `UPDATE feature_documents SET source_change_acknowledged_sha256 = $2,
             source_change_acknowledged_at = now(), updated_at = now() WHERE id = $1`,
          [documentId, checksum],
        );
        return loadDocument(tx, userId, documentId, checksum);
      });
    },

    async createShare(userId, documentId, revisionId, tokenSha256, now) {
      const checksum = checkedSha256(tokenSha256);
      if (!Number.isFinite(now.getTime())) throw new Error("Invalid share time");
      const result = await runQuery(
        `INSERT INTO feature_document_shares
           (document_id, revision_id, token_sha256, created_by, expires_at)
         SELECT d.id, r.id, $4, $2, $5::timestamptz + interval '7 days'
         FROM feature_documents d JOIN feature_document_revisions r ON r.document_id = d.id
         WHERE d.id = $1 AND d.user_id = $2 AND r.id = $3
         RETURNING id, document_id, revision_id, expires_at, revoked_at`,
        [documentId, userId, revisionId, checksum, now.toISOString()],
      );
      const row = result.rows[0];
      return row ? {
        id: positiveInteger(row.id),
        documentId: positiveInteger(row.document_id),
        revisionId: positiveInteger(row.revision_id),
        expiresAt: iso(row.expires_at),
        ...(row.revoked_at == null ? {} : { revokedAt: iso(row.revoked_at) }),
      } : undefined;
    },

    async revokeShare(userId, documentId, shareId) {
      const result = await runQuery(
        `UPDATE feature_document_shares s SET revoked_at = now()
         FROM feature_documents d
         WHERE s.id = $1 AND s.document_id = $2 AND d.id = s.document_id AND d.user_id = $3
           AND s.revoked_at IS NULL`,
        [shareId, documentId, userId],
      );
      return result.rowCount === 1;
    },

    async documentImage(userId, documentId, revisionId, imageId) {
      const result = await runQuery(
        `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM feature_documents d
         JOIN feature_document_revisions r ON r.document_id = d.id
         JOIN images i ON i.id = $4
         JOIN stored_objects so ON so.object_key = i.object_key
         WHERE d.id = $1 AND d.user_id = $2 AND r.id = $3
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(r.evidence_manifest) evidence
             WHERE (evidence->>'imageId')::integer = i.id
           )`,
        [documentId, userId, revisionId, imageId],
      );
      return objectFromRow(result.rows[0]);
    },

    async publicShare(tokenSha256, now) {
      const checksum = checkedSha256(tokenSha256);
      if (!Number.isFinite(now.getTime())) throw new Error("Invalid share time");
      const result = await runQuery(
        `UPDATE feature_document_shares s SET last_accessed_at = $2
         FROM feature_documents d, feature_document_revisions r
         WHERE s.token_sha256 = $1 AND s.revoked_at IS NULL AND s.expires_at > $2
           AND d.id = s.document_id AND r.id = s.revision_id AND r.document_id = d.id
         RETURNING d.title, s.expires_at,
                   r.id, r.document_id, r.revision_number, r.author_type, r.review_status,
                   r.content, r.source_flow, r.evidence_manifest, r.focus_instruction,
                   r.prompt_version, r.provider_model, r.created_at`,
        [checksum, now.toISOString()],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const revision = revisionFromRow(row);
      return { title: text(row.title), reviewStatus: revision.reviewStatus, revision, expiresAt: iso(row.expires_at) };
    },

    async publicShareImage(tokenSha256, imageId, now) {
      const checksum = checkedSha256(tokenSha256);
      const result = await runQuery(
        `WITH active_share AS (
           UPDATE feature_document_shares SET last_accessed_at = $3
           WHERE token_sha256 = $1 AND revoked_at IS NULL AND expires_at > $3
           RETURNING revision_id
         )
         SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM active_share share
         JOIN feature_document_revisions r ON r.id = share.revision_id
         JOIN images i ON i.id = $2
         JOIN stored_objects so ON so.object_key = i.object_key
         WHERE EXISTS (
           SELECT 1 FROM jsonb_array_elements(r.evidence_manifest) evidence
           WHERE (evidence->>'imageId')::integer = i.id
         )`,
        [checksum, imageId, now.toISOString()],
      );
      return objectFromRow(result.rows[0]);
    },
  };
}
