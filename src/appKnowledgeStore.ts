import type { QueryResult } from "pg";
import {
  parseAppKnowledgeSnapshot,
  type AppKnowledgeJobStage,
  type AppKnowledgeJobStatus,
  type AppKnowledgeReviewStatus,
  type AppKnowledgeSnapshot,
} from "./appKnowledge.ts";
import type {
  AppKnowledgeEvidenceManifestItem,
  AppKnowledgeEvidenceOverride,
} from "./appKnowledgeEvidence.ts";
import { query as databaseQuery, withTransaction } from "./db.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type TransactionRunner = <T>(work: (query: DatabaseQuery) => Promise<T>) => Promise<T>;

export interface AppKnowledgeTarget {
  appId: number;
  app: string;
  platformId: number;
  platform: "ios" | "android" | "web";
  captureVersionId: number;
  versionNumber: number;
}

export interface AppKnowledgeJobView {
  id: number;
  snapshotId: number;
  transportJobId: number;
  requestedBy: number;
  status: AppKnowledgeJobStatus;
  stage: AppKnowledgeJobStage;
  doneCount: number;
  totalCount: number;
  cacheHitCount: number;
  failedCount: number;
  providerModel: string;
  promptVersion: number;
  cancelRequested: boolean;
  retryFailedOnly: boolean;
  manifest?: AppKnowledgeEvidenceManifestItem[];
  sourceSha256?: string;
  errorCode?: string;
  errorMessage?: string;
  updatedAt: string;
}

export interface AppKnowledgeWorkerJob extends AppKnowledgeJobView {
  target: AppKnowledgeTarget;
}

export interface AppKnowledgeRevisionView {
  id: number;
  snapshotId: number;
  revisionNumber: number;
  authorType: "generated" | "user";
  reviewStatus: AppKnowledgeReviewStatus;
  content: AppKnowledgeSnapshot;
  manifest: AppKnowledgeEvidenceManifestItem[];
  sourceSha256: string;
  providerModel: string;
  promptVersion: number;
  createdBy: number;
  createdAt: string;
}

export interface AppKnowledgeReviewEventView {
  id: number;
  snapshotId: number;
  revisionId?: number;
  actorId: number;
  action: string;
  fromStatus?: AppKnowledgeReviewStatus;
  toStatus?: AppKnowledgeReviewStatus;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AppKnowledgeSnapshotView {
  id: number;
  target: AppKnowledgeTarget;
  currentRevisionId?: number;
  approvedRevisionId?: number;
  currentRevision?: AppKnowledgeRevisionView;
  revisions: AppKnowledgeRevisionView[];
  reviewEvents: AppKnowledgeReviewEventView[];
}

export interface AppKnowledgeCacheEntry {
  cacheKey: string;
  normalizedVisualSha256: string;
  platform: "ios" | "android" | "web";
  promptVersion: number;
  providerModel: string;
  analysis: Record<string, unknown>;
}

export interface AppKnowledgeEvidenceResultInput {
  evidenceId: string;
  status: "complete" | "cached";
  cacheKey?: string;
  analysis: Record<string, unknown>;
  attemptCount: number;
}

export interface AppKnowledgeEvidenceFailureInput {
  evidenceId: string;
  errorCode: string;
  attemptCount: number;
}

export interface AppKnowledgeStore {
  createJob(
    requestedBy: number,
    target: AppKnowledgeTarget,
    transportJobId: number,
    model: string,
    promptVersion: number,
  ): Promise<AppKnowledgeJobView>;
  claimJob(jobId: number): Promise<AppKnowledgeWorkerJob | undefined>;
  freezeManifest(
    jobId: number,
    manifest: AppKnowledgeEvidenceManifestItem[],
    sourceSha256: string,
  ): Promise<AppKnowledgeWorkerJob>;
  workerJob(jobId: number): Promise<AppKnowledgeWorkerJob | undefined>;
  updateProgress(jobId: number, stage: AppKnowledgeJobStage, doneCount: number): Promise<void>;
  cachedAnalysis(cacheKey: string): Promise<AppKnowledgeCacheEntry | undefined>;
  saveCachedAnalysis(input: AppKnowledgeCacheEntry): Promise<AppKnowledgeCacheEntry>;
  recordEvidenceResult(jobId: number, input: AppKnowledgeEvidenceResultInput): Promise<void>;
  recordEvidenceFailure(jobId: number, input: AppKnowledgeEvidenceFailureInput): Promise<void>;
  requestCancel(jobId: number): Promise<AppKnowledgeJobView | undefined>;
  resumeJob(jobId: number, transportJobId: number): Promise<AppKnowledgeJobView | undefined>;
  retryFailedEvidence(jobId: number, transportJobId: number): Promise<AppKnowledgeJobView | undefined>;
  markStale(jobId: number): Promise<void>;
  completeGeneration(jobId: number, snapshot: AppKnowledgeSnapshot): Promise<AppKnowledgeRevisionView>;
  failJob(jobId: number, code: string, safeMessage: string): Promise<void>;
  getAdminSnapshot(snapshotId: number): Promise<AppKnowledgeSnapshotView | undefined>;
  getApprovedSnapshotForApp(
    app: string,
    platform: string,
    versionNumber: number,
  ): Promise<AppKnowledgeSnapshotView | undefined>;
  getJob(jobId: number): Promise<AppKnowledgeJobView | undefined>;
  saveRevision(
    snapshotId: number,
    baseRevisionId: number,
    content: AppKnowledgeSnapshot,
    userId: number,
  ): Promise<AppKnowledgeRevisionView>;
  setReviewStatus(
    snapshotId: number,
    revisionId: number,
    status: AppKnowledgeReviewStatus,
    userId: number,
  ): Promise<AppKnowledgeRevisionView>;
  recordReviewEvent(input: {
    snapshotId: number;
    revisionId?: number;
    userId: number;
    action: string;
    fromStatus?: AppKnowledgeReviewStatus;
    toStatus?: AppKnowledgeReviewStatus;
    details?: Record<string, unknown>;
  }): Promise<AppKnowledgeReviewEventView>;
  setEvidenceOverride(input: {
    versionId: number;
    imageId: number;
    decision: AppKnowledgeEvidenceOverride["decision"];
    reason: string;
    userId: number;
  }): Promise<void>;
  evidenceOverrides(versionId: number): Promise<AppKnowledgeEvidenceOverride[]>;
}

const SHA256 = /^[0-9a-f]{64}$/;
const PLATFORMS = new Set(["ios", "android", "web"]);
const JOB_STAGES = new Set<AppKnowledgeJobStage>([
  "preparing",
  "validating_evidence",
  "analyzing",
  "synthesizing",
  "validating_output",
  "saving",
  "complete",
]);
const REVIEW_STATUSES = new Set<AppKnowledgeReviewStatus>([
  "draft",
  "in_review",
  "approved",
  "superseded",
]);

const liveQuery: DatabaseQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

function defaultTransaction(runQuery: DatabaseQuery): TransactionRunner {
  if (runQuery !== liveQuery) return async (work) => work(runQuery);
  return async (work) => withTransaction((client) =>
    work((sql, values) => client.query(sql, values ? [...values] : undefined)));
}

function integer(value: unknown, label = "database identifier"): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`Invalid ${label}`);
  return result;
}

function positiveInteger(value: unknown, label = "database identifier"): number {
  const result = integer(value, label);
  if (result < 1) throw new Error(`Invalid ${label}`);
  return result;
}

function text(value: unknown, label = "database text"): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}`);
  return value;
}

function iso(value: unknown): string {
  const result = value instanceof Date ? value : new Date(text(value, "database timestamp"));
  if (!Number.isFinite(result.getTime())) throw new Error("Invalid database timestamp");
  return result.toISOString();
}

function sha256(value: string): string {
  if (!SHA256.test(value)) throw new Error("Invalid SHA-256");
  return value;
}

function providerModel(value: string): string {
  const result = value.trim();
  if (!result || result.length > 160) throw new Error("Invalid provider model");
  return result;
}

function errorCode(value: string): string {
  const result = value.trim();
  if (!/^[a-z0-9_]{1,80}$/.test(result)) throw new Error("Invalid App Knowledge error code");
  return result;
}

function safeMessage(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 1_000)
    || "App Knowledge generation failed";
}

function jsonObject(value: unknown, label = "database JSON object"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return structuredClone(value as Record<string, unknown>);
}

function target(value: AppKnowledgeTarget): AppKnowledgeTarget {
  positiveInteger(value.appId, "app");
  positiveInteger(value.platformId, "platform");
  positiveInteger(value.captureVersionId, "capture version");
  positiveInteger(value.versionNumber, "version number");
  if (!value.app.trim() || !PLATFORMS.has(value.platform)) throw new Error("Invalid App Knowledge target");
  return { ...value, app: value.app.trim() };
}

function checkedManifest(value: AppKnowledgeEvidenceManifestItem[]): AppKnowledgeEvidenceManifestItem[] {
  if (!Array.isArray(value) || value.length > 20_000) throw new Error("Invalid App Knowledge evidence manifest");
  const ids = new Set<string>();
  return value.map((item) => {
    positiveInteger(item.imageId, "evidence image");
    if (
      !item.evidenceId?.trim()
      || item.evidenceId.length > 300
      || ids.has(item.evidenceId)
      || !["screen", "flow_step", "ui_element"].includes(item.kind)
      || !["eligible", "quarantined", "duplicate"].includes(item.eligibility)
    ) throw new Error("Invalid App Knowledge evidence manifest");
    ids.add(item.evidenceId);
    if (item.normalizedVisualSha256) sha256(item.normalizedVisualSha256);
    if (!SHA256.test(item.object.sha256) || item.object.byteSize < 1) {
      throw new Error("Invalid App Knowledge evidence object");
    }
    return structuredClone(item);
  });
}

function manifestFrom(value: unknown): AppKnowledgeEvidenceManifestItem[] {
  return checkedManifest(value as AppKnowledgeEvidenceManifestItem[]);
}

const JOB_COLUMNS = `j.id, j.snapshot_id, j.transport_job_id, j.requested_by, j.status, j.stage,
  j.done_count, j.total_count, j.cache_hit_count, j.failed_count, j.evidence_manifest,
  j.source_sha256, j.provider_model, j.prompt_version, j.cancel_requested,
  j.retry_failed_only, j.error_code, j.error_message, j.updated_at`;

const TARGET_COLUMNS = `s.app_id, a.name AS app, s.platform_id, p.name AS platform,
  s.capture_version_id, av.version_number`;

const REVISION_COLUMNS = `r.id, r.snapshot_id, r.revision_number, r.author_type,
  r.review_status, r.content, r.evidence_manifest, r.source_sha256,
  r.provider_model, r.prompt_version, r.created_by, r.created_at`;

function jobFromRow(row: Record<string, unknown> | undefined): AppKnowledgeJobView | undefined {
  if (!row) return undefined;
  return {
    id: positiveInteger(row.id),
    snapshotId: positiveInteger(row.snapshot_id),
    transportJobId: positiveInteger(row.transport_job_id, "transport job"),
    requestedBy: positiveInteger(row.requested_by, "requester"),
    status: row.status as AppKnowledgeJobStatus,
    stage: row.stage as AppKnowledgeJobStage,
    doneCount: integer(row.done_count, "job progress"),
    totalCount: integer(row.total_count, "job total"),
    cacheHitCount: integer(row.cache_hit_count, "job cache hits"),
    failedCount: integer(row.failed_count, "job failures"),
    providerModel: text(row.provider_model),
    promptVersion: positiveInteger(row.prompt_version, "prompt version"),
    cancelRequested: row.cancel_requested === true,
    retryFailedOnly: row.retry_failed_only === true,
    ...(row.evidence_manifest == null ? {} : { manifest: manifestFrom(row.evidence_manifest) }),
    ...(row.source_sha256 == null ? {} : { sourceSha256: sha256(text(row.source_sha256)) }),
    ...(row.error_code == null ? {} : { errorCode: text(row.error_code) }),
    ...(row.error_message == null ? {} : { errorMessage: text(row.error_message) }),
    updatedAt: iso(row.updated_at),
  };
}

function targetFromRow(row: Record<string, unknown>): AppKnowledgeTarget {
  return target({
    appId: positiveInteger(row.app_id),
    app: text(row.app),
    platformId: positiveInteger(row.platform_id),
    platform: row.platform as AppKnowledgeTarget["platform"],
    captureVersionId: positiveInteger(row.capture_version_id),
    versionNumber: positiveInteger(row.version_number, "version number"),
  });
}

function workerFromRow(row: Record<string, unknown> | undefined): AppKnowledgeWorkerJob | undefined {
  const job = jobFromRow(row);
  return job && row ? { ...job, target: targetFromRow(row) } : undefined;
}

function revisionFromRow(row: Record<string, unknown>): AppKnowledgeRevisionView {
  const manifest = manifestFrom(row.evidence_manifest);
  const content = parseAppKnowledgeSnapshot(
    row.content,
    new Set(manifest.map(({ evidenceId }) => evidenceId)),
  );
  return {
    id: positiveInteger(row.id),
    snapshotId: positiveInteger(row.snapshot_id),
    revisionNumber: positiveInteger(row.revision_number, "revision number"),
    authorType: row.author_type as AppKnowledgeRevisionView["authorType"],
    reviewStatus: row.review_status as AppKnowledgeReviewStatus,
    content,
    manifest,
    sourceSha256: sha256(text(row.source_sha256)),
    providerModel: text(row.provider_model),
    promptVersion: positiveInteger(row.prompt_version, "prompt version"),
    createdBy: positiveInteger(row.created_by, "revision creator"),
    createdAt: iso(row.created_at),
  };
}

function reviewEventFromRow(row: Record<string, unknown>): AppKnowledgeReviewEventView {
  return {
    id: positiveInteger(row.id),
    snapshotId: positiveInteger(row.snapshot_id),
    ...(row.revision_id == null ? {} : { revisionId: positiveInteger(row.revision_id) }),
    actorId: positiveInteger(row.actor_id),
    action: text(row.action),
    ...(row.from_status == null ? {} : { fromStatus: row.from_status as AppKnowledgeReviewStatus }),
    ...(row.to_status == null ? {} : { toStatus: row.to_status as AppKnowledgeReviewStatus }),
    details: jsonObject(row.details),
    createdAt: iso(row.created_at),
  };
}

async function recountJob(runQuery: DatabaseQuery, jobId: number): Promise<void> {
  await runQuery(
    `UPDATE app_knowledge_jobs j SET
       done_count = counts.done_count,
       cache_hit_count = counts.cache_hit_count,
       failed_count = counts.failed_count,
       updated_at = now()
     FROM (
       SELECT job_id,
         COUNT(*) FILTER (WHERE status IN ('complete', 'cached'))::integer AS done_count,
         COUNT(*) FILTER (WHERE status = 'cached')::integer AS cache_hit_count,
         COUNT(*) FILTER (WHERE status = 'failed')::integer AS failed_count
       FROM app_knowledge_job_evidence WHERE job_id = $1 GROUP BY job_id
     ) counts
     WHERE j.id = counts.job_id`,
    [jobId],
  );
}

async function loadSnapshot(
  runQuery: DatabaseQuery,
  snapshotId: number,
  approvedOnly = false,
): Promise<AppKnowledgeSnapshotView | undefined> {
  const root = await runQuery(
    `SELECT s.id, s.current_revision_id, s.approved_revision_id, ${TARGET_COLUMNS}
     FROM app_knowledge_snapshots s
     JOIN apps a ON a.id = s.app_id
     JOIN platforms p ON p.id = s.platform_id
     JOIN app_versions av ON av.id = s.capture_version_id
     WHERE s.id = $1`,
    [snapshotId],
  );
  const row = root.rows[0];
  if (!row || (approvedOnly && row.approved_revision_id == null)) return undefined;
  const revisions = await runQuery(
    `SELECT ${REVISION_COLUMNS} FROM app_knowledge_revisions r
     WHERE r.snapshot_id = $1 ${approvedOnly ? "AND r.id = $2" : ""}
     ORDER BY r.revision_number DESC`,
    approvedOnly ? [snapshotId, row.approved_revision_id] : [snapshotId],
  );
  const parsed = revisions.rows.map(revisionFromRow);
  const currentId = approvedOnly
    ? positiveInteger(row.approved_revision_id)
    : row.current_revision_id == null ? undefined : positiveInteger(row.current_revision_id);
  const events = approvedOnly
    ? []
    : (await runQuery(
        `SELECT id, snapshot_id, revision_id, actor_id, action, from_status, to_status, details, created_at
         FROM app_knowledge_review_events WHERE snapshot_id = $1 ORDER BY created_at, id`,
        [snapshotId],
      )).rows.map(reviewEventFromRow);
  return {
    id: positiveInteger(row.id),
    target: targetFromRow(row),
    ...(row.current_revision_id == null ? {} : { currentRevisionId: positiveInteger(row.current_revision_id) }),
    ...(row.approved_revision_id == null ? {} : { approvedRevisionId: positiveInteger(row.approved_revision_id) }),
    ...(currentId === undefined ? {} : { currentRevision: parsed.find(({ id }) => id === currentId) }),
    revisions: parsed,
    reviewEvents: events,
  };
}

async function insertRevision(
  runQuery: DatabaseQuery,
  input: {
    snapshotId: number;
    authorType: "generated" | "user";
    content: AppKnowledgeSnapshot;
    manifest: AppKnowledgeEvidenceManifestItem[];
    sourceSha256: string;
    providerModel: string;
    promptVersion: number;
    createdBy: number;
  },
): Promise<AppKnowledgeRevisionView> {
  const result = await runQuery(
    `INSERT INTO app_knowledge_revisions
       (snapshot_id, revision_number, author_type, content, evidence_manifest,
        source_sha256, provider_model, prompt_version, created_by)
     SELECT $1, COALESCE(MAX(revision_number), 0) + 1, $2, $3::jsonb, $4::jsonb,
       $5, $6, $7, $8
     FROM app_knowledge_revisions WHERE snapshot_id = $1
     RETURNING id, snapshot_id, revision_number, author_type, review_status, content,
       evidence_manifest, source_sha256, provider_model, prompt_version, created_by, created_at`,
    [
      input.snapshotId,
      input.authorType,
      JSON.stringify(input.content),
      JSON.stringify(input.manifest),
      input.sourceSha256,
      input.providerModel,
      input.promptVersion,
      input.createdBy,
    ],
  );
  return revisionFromRow(result.rows[0]);
}

export function createAppKnowledgeStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): AppKnowledgeStore {
  const workerJob = async (jobId: number): Promise<AppKnowledgeWorkerJob | undefined> => {
    const result = await runQuery(
      `SELECT ${JOB_COLUMNS}, ${TARGET_COLUMNS}
       FROM app_knowledge_jobs j
       JOIN app_knowledge_snapshots s ON s.id = j.snapshot_id
       JOIN apps a ON a.id = s.app_id
       JOIN platforms p ON p.id = s.platform_id
       JOIN app_versions av ON av.id = s.capture_version_id
       WHERE j.id = $1`,
      [jobId],
    );
    return workerFromRow(result.rows[0]);
  };

  return {
    async createJob(requestedBy, rawTarget, transportJobId, model, promptVersion) {
      const checkedTarget = target(rawTarget);
      positiveInteger(requestedBy, "requester");
      positiveInteger(transportJobId, "transport job");
      positiveInteger(promptVersion, "prompt version");
      const checkedModel = providerModel(model);
      return runTransaction(async (tx) => {
        const found = await tx(
          `SELECT av.id FROM app_versions av
           JOIN apps a ON a.id = av.app_id
           JOIN platforms p ON p.app_id = a.id
           WHERE av.id = $1 AND av.app_id = $2 AND av.platform = $3
             AND av.version_number = $4 AND p.id = $5 AND p.name = $3 AND a.name = $6
           FOR SHARE OF av`,
          [
            checkedTarget.captureVersionId,
            checkedTarget.appId,
            checkedTarget.platform,
            checkedTarget.versionNumber,
            checkedTarget.platformId,
            checkedTarget.app,
          ],
        );
        if (!found.rows[0]) throw new Error("App Knowledge target was not found");
        const snapshot = await tx(
          `INSERT INTO app_knowledge_snapshots (app_id, platform_id, capture_version_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (app_id, platform_id, capture_version_id)
           DO UPDATE SET updated_at = app_knowledge_snapshots.updated_at
           RETURNING id`,
          [checkedTarget.appId, checkedTarget.platformId, checkedTarget.captureVersionId],
        );
        const result = await tx(
          `INSERT INTO app_knowledge_jobs AS j
             (snapshot_id, transport_job_id, requested_by, provider_model, prompt_version)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING ${JOB_COLUMNS}`,
          [
            snapshot.rows[0].id,
            transportJobId,
            requestedBy,
            checkedModel,
            promptVersion,
          ],
        );
        return jobFromRow(result.rows[0])!;
      });
    },

    async claimJob(jobId) {
      positiveInteger(jobId, "job");
      const result = await runQuery(
        `UPDATE app_knowledge_jobs j SET
           status = CASE WHEN cancel_requested THEN 'cancelled' ELSE 'running' END,
           completed_at = CASE WHEN cancel_requested THEN now() ELSE NULL END,
           updated_at = now()
         FROM app_knowledge_snapshots s, apps a, platforms p, app_versions av
         WHERE j.id = $1 AND j.status IN ('queued', 'running')
           AND s.id = j.snapshot_id AND a.id = s.app_id
           AND p.id = s.platform_id AND av.id = s.capture_version_id
         RETURNING ${JOB_COLUMNS}, ${TARGET_COLUMNS}`,
        [jobId],
      );
      return workerFromRow(result.rows[0]);
    },

    async freezeManifest(jobId, rawManifest, rawSourceSha256) {
      const manifest = checkedManifest(rawManifest);
      const sourceSha256 = sha256(rawSourceSha256);
      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT evidence_manifest, source_sha256 FROM app_knowledge_jobs
           WHERE id = $1 AND status IN ('queued', 'running') FOR UPDATE`,
          [jobId],
        );
        const current = locked.rows[0];
        if (!current) throw new Error("App Knowledge job is not active");
        if (current.evidence_manifest != null) {
          const sameManifest = JSON.stringify(manifestFrom(current.evidence_manifest)) === JSON.stringify(manifest);
          if (text(current.source_sha256) !== sourceSha256 || !sameManifest) {
            throw new Error("App Knowledge manifest is already frozen");
          }
        } else {
          const totalCount = manifest.filter(({ eligibility }) => eligibility === "eligible").length;
          await tx(
            `UPDATE app_knowledge_jobs SET evidence_manifest = $2::jsonb, source_sha256 = $3,
               total_count = $4, stage = 'validating_evidence', updated_at = now()
             WHERE id = $1`,
            [jobId, JSON.stringify(manifest), sourceSha256, totalCount],
          );
          for (let ordinal = 0; ordinal < manifest.length; ordinal += 1) {
            const item = manifest[ordinal];
            const status = item.eligibility === "eligible"
              ? "pending"
              : item.eligibility === "duplicate" ? "duplicate" : "quarantined";
            await tx(
              `INSERT INTO app_knowledge_job_evidence
                 (job_id, evidence_id, ordinal, image_id, kind, status)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [jobId, item.evidenceId, ordinal, item.imageId, item.kind, status],
            );
          }
        }
        const result = await tx(
          `SELECT ${JOB_COLUMNS}, ${TARGET_COLUMNS}
           FROM app_knowledge_jobs j
           JOIN app_knowledge_snapshots s ON s.id = j.snapshot_id
           JOIN apps a ON a.id = s.app_id
           JOIN platforms p ON p.id = s.platform_id
           JOIN app_versions av ON av.id = s.capture_version_id
           WHERE j.id = $1`,
          [jobId],
        );
        return workerFromRow(result.rows[0])!;
      });
    },

    workerJob,

    async updateProgress(jobId, stage, doneCount) {
      if (!JOB_STAGES.has(stage)) throw new Error("Invalid App Knowledge job stage");
      integer(doneCount, "job progress");
      const result = await runQuery(
        `UPDATE app_knowledge_jobs SET stage = $2, done_count = $3, updated_at = now()
         WHERE id = $1 AND status = 'running' AND $3 <= total_count`,
        [jobId, stage, doneCount],
      );
      if (result.rowCount !== 1) throw new Error("App Knowledge job cannot accept progress");
    },

    async cachedAnalysis(cacheKey) {
      const key = sha256(cacheKey);
      const result = await runQuery(
        `SELECT cache_key, normalized_visual_sha256, platform, prompt_version,
           provider_model, analysis FROM app_knowledge_evidence_cache WHERE cache_key = $1`,
        [key],
      );
      const row = result.rows[0];
      return row ? {
        cacheKey: text(row.cache_key),
        normalizedVisualSha256: sha256(text(row.normalized_visual_sha256)),
        platform: row.platform as AppKnowledgeCacheEntry["platform"],
        promptVersion: positiveInteger(row.prompt_version, "prompt version"),
        providerModel: text(row.provider_model),
        analysis: jsonObject(row.analysis),
      } : undefined;
    },

    async saveCachedAnalysis(input) {
      const key = sha256(input.cacheKey);
      const visual = sha256(input.normalizedVisualSha256);
      if (!PLATFORMS.has(input.platform)) throw new Error("Invalid cache platform");
      positiveInteger(input.promptVersion, "prompt version");
      const model = providerModel(input.providerModel);
      const analysis = jsonObject(input.analysis, "analysis");
      await runQuery(
        `INSERT INTO app_knowledge_evidence_cache
           (cache_key, normalized_visual_sha256, platform, prompt_version, provider_model, analysis)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (cache_key) DO NOTHING`,
        [key, visual, input.platform, input.promptVersion, model, JSON.stringify(analysis)],
      );
      return (await this.cachedAnalysis(key))!;
    },

    async recordEvidenceResult(jobId, input) {
      positiveInteger(input.attemptCount, "attempt count");
      if (input.cacheKey) sha256(input.cacheKey);
      const result = await runQuery(
        `UPDATE app_knowledge_job_evidence e SET status = $3, cache_key = $4,
           analysis = $5::jsonb, attempt_count = $6, error_code = NULL, updated_at = now()
         FROM app_knowledge_jobs j
         WHERE e.job_id = $1 AND e.evidence_id = $2 AND j.id = e.job_id
           AND j.status = 'running' AND e.status IN ('pending', 'failed')
         RETURNING e.id`,
        [
          jobId,
          input.evidenceId,
          input.status,
          input.cacheKey ?? null,
          JSON.stringify(jsonObject(input.analysis, "analysis")),
          input.attemptCount,
        ],
      );
      if (result.rowCount !== 1) throw new Error("App Knowledge evidence cannot accept a result");
      await recountJob(runQuery, jobId);
    },

    async recordEvidenceFailure(jobId, input) {
      positiveInteger(input.attemptCount, "attempt count");
      const result = await runQuery(
        `UPDATE app_knowledge_job_evidence e SET status = 'failed', analysis = NULL,
           attempt_count = $4, error_code = $3, updated_at = now()
         FROM app_knowledge_jobs j
         WHERE e.job_id = $1 AND e.evidence_id = $2 AND j.id = e.job_id
           AND j.status = 'running' AND e.status IN ('pending', 'failed')
         RETURNING e.id`,
        [jobId, input.evidenceId, errorCode(input.errorCode), input.attemptCount],
      );
      if (result.rowCount !== 1) throw new Error("App Knowledge evidence cannot accept a failure");
      await recountJob(runQuery, jobId);
    },

    async requestCancel(jobId) {
      const result = await runQuery(
        `UPDATE app_knowledge_jobs j SET cancel_requested = true, updated_at = now()
         WHERE j.id = $1 AND j.status IN ('queued', 'running') RETURNING ${JOB_COLUMNS}`,
        [jobId],
      );
      return jobFromRow(result.rows[0]);
    },

    async resumeJob(jobId, transportJobId) {
      positiveInteger(transportJobId, "transport job");
      const result = await runQuery(
        `UPDATE app_knowledge_jobs j SET transport_job_id = $2, status = 'queued',
           cancel_requested = false, retry_failed_only = false,
           stage = CASE WHEN evidence_manifest IS NULL THEN 'preparing' ELSE 'analyzing' END,
           error_code = NULL, error_message = NULL, completed_at = NULL, updated_at = now()
         WHERE j.id = $1 AND j.status IN ('error', 'cancelled')
         RETURNING ${JOB_COLUMNS}`,
        [jobId, transportJobId],
      );
      return jobFromRow(result.rows[0]);
    },

    async retryFailedEvidence(jobId, transportJobId) {
      positiveInteger(transportJobId, "transport job");
      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT id FROM app_knowledge_jobs WHERE id = $1
           AND status IN ('running', 'error', 'cancelled') FOR UPDATE`,
          [jobId],
        );
        if (!locked.rows[0]) return undefined;
        await tx(
          `UPDATE app_knowledge_job_evidence SET status = 'pending', analysis = NULL,
             cache_key = NULL, error_code = NULL, updated_at = now()
           WHERE job_id = $1 AND status = 'failed'`,
          [jobId],
        );
        const result = await tx(
          `UPDATE app_knowledge_jobs j SET transport_job_id = $2, status = 'queued',
             stage = 'analyzing', retry_failed_only = true, cancel_requested = false,
             failed_count = 0, error_code = NULL, error_message = NULL,
             completed_at = NULL, updated_at = now()
           WHERE id = $1 RETURNING ${JOB_COLUMNS}`,
          [jobId, transportJobId],
        );
        return jobFromRow(result.rows[0]);
      });
    },

    async markStale(jobId) {
      await runQuery(
        `UPDATE app_knowledge_jobs SET status = 'stale', error_code = 'source_changed',
           error_message = 'The capture source changed during App Knowledge generation',
           completed_at = now(), updated_at = now()
         WHERE id = $1 AND status IN ('queued', 'running')`,
        [jobId],
      );
    },

    async completeGeneration(jobId, rawSnapshot) {
      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT ${JOB_COLUMNS}, ${TARGET_COLUMNS}
           FROM app_knowledge_jobs j
           JOIN app_knowledge_snapshots s ON s.id = j.snapshot_id
           JOIN apps a ON a.id = s.app_id
           JOIN platforms p ON p.id = s.platform_id
           JOIN app_versions av ON av.id = s.capture_version_id
           WHERE j.id = $1 FOR UPDATE OF j, s`,
          [jobId],
        );
        const job = workerFromRow(locked.rows[0]);
        if (!job || (job.status !== "running" && job.status !== "queued")) {
          throw new Error("App Knowledge job is not active");
        }
        if (!job.manifest || !job.sourceSha256) throw new Error("App Knowledge manifest is not frozen");
        const snapshot = parseAppKnowledgeSnapshot(
          rawSnapshot,
          new Set(job.manifest.map(({ evidenceId }) => evidenceId)),
        );
        if (
          snapshot.identity.app !== job.target.app
          || snapshot.identity.platform !== job.target.platform
          || snapshot.identity.captureVersionId !== job.target.captureVersionId
          || snapshot.identity.sourceSha256 !== job.sourceSha256
          || snapshot.identity.providerModel !== job.providerModel
          || snapshot.identity.promptVersion !== job.promptVersion
        ) throw new Error("App Knowledge snapshot identity does not match the job");
        const revision = await insertRevision(tx, {
          snapshotId: job.snapshotId,
          authorType: "generated",
          content: snapshot,
          manifest: job.manifest,
          sourceSha256: job.sourceSha256,
          providerModel: job.providerModel,
          promptVersion: job.promptVersion,
          createdBy: job.requestedBy,
        });
        await tx(
          `UPDATE app_knowledge_snapshots SET current_revision_id = $2, updated_at = now()
           WHERE id = $1`,
          [job.snapshotId, revision.id],
        );
        await tx(
          `UPDATE app_knowledge_jobs SET status = 'done', stage = 'complete',
             done_count = total_count, completed_at = now(), updated_at = now()
           WHERE id = $1`,
          [jobId],
        );
        return revision;
      });
    },

    async failJob(jobId, code, message) {
      await runQuery(
        `UPDATE app_knowledge_jobs SET status = 'error', error_code = $2,
           error_message = $3, completed_at = now(), updated_at = now()
         WHERE id = $1 AND status IN ('queued', 'running')`,
        [jobId, errorCode(code), safeMessage(message)],
      );
    },

    getAdminSnapshot(snapshotId) {
      positiveInteger(snapshotId, "snapshot");
      return loadSnapshot(runQuery, snapshotId);
    },

    async getApprovedSnapshotForApp(app, platform, versionNumber) {
      positiveInteger(versionNumber, "version number");
      const result = await runQuery(
        `SELECT s.id FROM app_knowledge_snapshots s
         JOIN apps a ON a.id = s.app_id
         JOIN platforms p ON p.id = s.platform_id
         JOIN app_versions av ON av.id = s.capture_version_id
         WHERE a.name = $1 AND p.name = $2 AND av.version_number = $3
           AND s.approved_revision_id IS NOT NULL
         LIMIT 1`,
        [app, platform, versionNumber],
      );
      return result.rows[0]
        ? loadSnapshot(runQuery, positiveInteger(result.rows[0].id), true)
        : undefined;
    },

    async getJob(jobId) {
      const result = await runQuery(
        `SELECT ${JOB_COLUMNS} FROM app_knowledge_jobs j WHERE j.id = $1`,
        [jobId],
      );
      return jobFromRow(result.rows[0]);
    },

    async saveRevision(snapshotId, baseRevisionId, rawContent, userId) {
      positiveInteger(userId, "user");
      return runTransaction(async (tx) => {
        const result = await tx(
          `SELECT ${REVISION_COLUMNS}
           FROM app_knowledge_snapshots s
           JOIN app_knowledge_revisions r ON r.snapshot_id = s.id
           WHERE s.id = $1 AND r.id = $2 FOR UPDATE OF s, r`,
          [snapshotId, baseRevisionId],
        );
        if (!result.rows[0]) throw new Error("App Knowledge base revision was not found");
        const base = revisionFromRow(result.rows[0]);
        if (base.reviewStatus === "approved") throw new Error("An approved revision cannot be edited");
        const content = parseAppKnowledgeSnapshot(
          rawContent,
          new Set(base.manifest.map(({ evidenceId }) => evidenceId)),
        );
        if (
          content.identity.sourceSha256 !== base.sourceSha256
          || content.identity.providerModel !== base.providerModel
          || content.identity.promptVersion !== base.promptVersion
        ) throw new Error("App Knowledge revision identity cannot change");
        const revision = await insertRevision(tx, {
          snapshotId,
          authorType: "user",
          content,
          manifest: base.manifest,
          sourceSha256: base.sourceSha256,
          providerModel: base.providerModel,
          promptVersion: base.promptVersion,
          createdBy: userId,
        });
        await tx(
          "UPDATE app_knowledge_snapshots SET current_revision_id = $2, updated_at = now() WHERE id = $1",
          [snapshotId, revision.id],
        );
        return revision;
      });
    },

    async setReviewStatus(snapshotId, revisionId, status, userId) {
      if (!REVIEW_STATUSES.has(status) || status === "superseded") {
        throw new Error("Invalid App Knowledge review status");
      }
      return runTransaction(async (tx) => {
        const locked = await tx(
          `SELECT ${REVISION_COLUMNS}
           FROM app_knowledge_snapshots s
           JOIN app_knowledge_revisions r ON r.snapshot_id = s.id
           WHERE s.id = $1 AND r.id = $2 FOR UPDATE OF s, r`,
          [snapshotId, revisionId],
        );
        if (!locked.rows[0]) throw new Error("App Knowledge revision was not found");
        const revision = revisionFromRow(locked.rows[0]);
        const allowed = revision.reviewStatus === "draft"
          ? status === "in_review"
          : revision.reviewStatus === "in_review" && (status === "draft" || status === "approved");
        if (!allowed) throw new Error("Invalid App Knowledge review transition");
        if (status === "approved") {
          await tx(
            `UPDATE app_knowledge_revisions SET review_status = 'superseded'
             WHERE snapshot_id = $1 AND id <> $2 AND review_status = 'approved'`,
            [snapshotId, revisionId],
          );
        }
        const updated = await tx(
          `UPDATE app_knowledge_revisions AS r SET review_status = $3
           WHERE snapshot_id = $1 AND id = $2
           RETURNING ${REVISION_COLUMNS}`,
          [snapshotId, revisionId, status],
        );
        await tx(
          `UPDATE app_knowledge_snapshots SET
             current_revision_id = $2,
             approved_revision_id = CASE WHEN $3 = 'approved' THEN $2 ELSE approved_revision_id END,
             updated_at = now()
           WHERE id = $1`,
          [snapshotId, revisionId, status],
        );
        await tx(
          `INSERT INTO app_knowledge_review_events
             (snapshot_id, revision_id, actor_id, action, from_status, to_status)
           VALUES ($1, $2, $3, 'review_status_changed', $4, $5)`,
          [snapshotId, revisionId, userId, revision.reviewStatus, status],
        );
        return revisionFromRow(updated.rows[0]);
      });
    },

    async recordReviewEvent(input) {
      const action = input.action.trim();
      if (!action || action.length > 80) throw new Error("Invalid review action");
      const result = await runQuery(
        `INSERT INTO app_knowledge_review_events
           (snapshot_id, revision_id, actor_id, action, from_status, to_status, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id, snapshot_id, revision_id, actor_id, action, from_status, to_status, details, created_at`,
        [
          input.snapshotId,
          input.revisionId ?? null,
          input.userId,
          action,
          input.fromStatus ?? null,
          input.toStatus ?? null,
          JSON.stringify(input.details ?? {}),
        ],
      );
      return reviewEventFromRow(result.rows[0]);
    },

    async setEvidenceOverride(input) {
      const reason = input.reason.replace(/[\r\n\t]+/g, " ").trim().slice(0, 1_000);
      if (!reason) throw new Error("Evidence override reason is required");
      await runQuery(
        `INSERT INTO app_knowledge_evidence_overrides
           (version_id, image_id, decision, reason, created_by)
         SELECT $1, $2, $3, $4, $5
         WHERE EXISTS (
           SELECT 1 FROM version_images WHERE version_id = $1 AND image_id = $2
         )
         ON CONFLICT (version_id, image_id) DO UPDATE SET
           decision = EXCLUDED.decision, reason = EXCLUDED.reason,
           created_by = EXCLUDED.created_by, updated_at = now()`,
        [input.versionId, input.imageId, input.decision, reason, input.userId],
      );
    },

    async evidenceOverrides(versionId) {
      const result = await runQuery(
        `SELECT image_id, decision, reason FROM app_knowledge_evidence_overrides
         WHERE version_id = $1 ORDER BY image_id`,
        [versionId],
      );
      return result.rows.map((row) => ({
        imageId: positiveInteger(row.image_id),
        decision: row.decision as AppKnowledgeEvidenceOverride["decision"],
        reason: text(row.reason),
      }));
    },
  };
}
