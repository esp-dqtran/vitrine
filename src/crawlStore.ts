import { createHash } from "node:crypto";
import type pg from "pg";
import { parseCrawlPlan, parseCrawlStep, type CrawlPlan, type CrawlStep } from "./crawlPlan.ts";
import { query, withTransaction } from "./db.ts";
import type { DesignFlow } from "./designSystem.ts";
import { failureObjectKey, validateObjectMetadata, type ObjectMetadata } from "./objectStore.ts";

type JsonObject = Record<string, unknown>;

export type CrawlPlanStatus = "draft" | "approved" | "superseded";
export type CrawlRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
export type CrawlRunStepStatus = "queued" | "running" | "completed" | "skipped" | "failed";
export type CrawlRepairStatus = "proposed" | "applied" | "rejected";
export type RetryMode = "all" | "failed" | "remaining";

export interface CrawlRunEnvironment {
  headless?: boolean;
  browserName?: string;
  browserVersion?: string;
  platform?: string;
  workerVersion?: string;
  locale?: string;
  timezone?: string;
  viewport?: { width: number; height: number };
  requestedFlowIds: string[];
  unsafeApproved: boolean;
  disposableAccountAcknowledged: boolean;
  allowSideEffects: boolean;
}

export type CrawlRunEnvironmentInput = Omit<
  CrawlRunEnvironment,
  "requestedFlowIds" | "unsafeApproved" | "disposableAccountAcknowledged" | "allowSideEffects"
> & Partial<Pick<
  CrawlRunEnvironment,
  "requestedFlowIds" | "unsafeApproved" | "disposableAccountAcknowledged" | "allowSideEffects"
>>;

export interface CrawlPlanRecord {
  id: string;
  app_id: number;
  app: string;
  revision: number;
  plan: CrawlPlan;
  content_hash: string;
  status: CrawlPlanStatus;
  research_metadata: JsonObject;
  created_by: number | null;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

type CrawlPlanRow = Omit<CrawlPlanRecord, "plan"> & { plan: unknown };

export interface CrawlRunRecord {
  id: string;
  app_id: number;
  app: string;
  version_id: number;
  plan_id: string;
  job_id: number | null;
  status: CrawlRunStatus;
  current_flow_id: string | null;
  current_step_id: string | null;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  cancel_requested_at: Date | null;
  retry_of_run_id: string | null;
  retry_mode: RetryMode;
  environment: CrawlRunEnvironment;
  worker_id: string | null;
  heartbeat_at: Date | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

export interface CrawlRunStepRecord {
  run_id: string;
  flow_id: string;
  step_id: string;
  flow_order: number;
  step_order: number;
  status: CrawlRunStepStatus;
  attempts: number;
  source_url: string | null;
  final_url: string | null;
  expected: unknown | null;
  actual: unknown | null;
  observed_screenshot_hash: string | null;
  evidence_id: string | null;
  error_class: string | null;
  error_message: string | null;
  failure_screenshot: string | null;
  failure_object_key: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

export interface CrawlEvidenceRecord {
  id: string;
  version_id: number;
  plan_id: string;
  image_id: number;
  flow_id: string;
  step_id: string;
  source_url: string;
  final_url: string;
  state_label: string;
  screenshot_hash: string;
  viewport_width: number;
  viewport_height: number;
  captured_at: Date;
}

export interface CrawlRepairRecord {
  id: string;
  plan_id: string;
  run_id: string;
  flow_id: string;
  step_id: string;
  proposed_step: CrawlStep;
  failure: JsonObject;
  provider: string | null;
  status: CrawlRepairStatus;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  applied_plan_id: string | null;
  created_at: Date;
}

export interface CreateRunInput {
  app: string;
  versionId: number;
  planId: string;
  jobId?: number;
  retryOfRunId?: string;
  environment: CrawlRunEnvironmentInput;
}

export interface UpdateRunInput {
  status?: CrawlRunStatus;
  currentFlowId?: string | null;
  currentStepId?: string | null;
  completedCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

export interface UpsertRunStepInput {
  runId: string;
  workerId: string;
  flowId: string;
  stepId: string;
  flowOrder: number;
  stepOrder: number;
  status: CrawlRunStepStatus;
  attempts: number;
  // Durable optional fields insert null and retain the stored value on conflict
  // when undefined; null explicitly clears them. Timestamps are never inferred.
  sourceUrl?: string | null;
  finalUrl?: string | null;
  expected?: unknown;
  actual?: unknown;
  observedScreenshotHash?: string | null;
  evidenceId?: string | null;
  errorClass?: string | null;
  errorMessage?: string | null;
  failureScreenshot?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
}

export interface AttachFailureObjectInput {
  runId: string;
  workerId: string;
  flowId: string;
  stepId: string;
  object: ObjectMetadata;
}

export interface EvidenceKey {
  versionId: number;
  planId: string;
  flowId: string;
  stepId: string;
  finalUrl: string;
  viewportWidth: number;
  viewportHeight: number;
}

export interface FindWorkerEvidenceInput extends EvidenceKey {
  runId: string;
  workerId: string;
  app: string;
}

export interface CreateEvidenceInput extends EvidenceKey {
  runId: string;
  workerId: string;
  imageId: number;
  sourceUrl: string;
  stateLabel: string;
  screenshotHash: string;
  capturedAt?: Date | string;
}

export interface PersistEvidenceBundleInput extends EvidenceKey {
  runId: string;
  workerId: string;
  app: string;
  imageId: number;
  imageCreated: boolean;
  object: ObjectMetadata;
  sourceUrl: string;
  stateLabel: string;
  screenshotHash: string;
  capturedAt?: Date | string;
}

export interface ReserveCaptureImageInput extends EvidenceKey {
  runId: string;
  workerId: string;
  app: string;
  imageUrl: string;
}

export interface ReserveCaptureImageResult {
  imageId: number;
  imageCreated: boolean;
}

export interface PersistEvidenceBundleResult {
  imageId: number;
  evidence: CrawlEvidenceRecord;
  imageCreated: boolean;
  evidenceCreated: boolean;
  reused: boolean;
}

export interface WorkerRunFinalizationSnapshot {
  runId: string;
  app: string;
  versionId: number;
  planId: string;
  plan: CrawlPlan;
  steps: Array<{ flowId: string; stepId: string; status: CrawlRunStepStatus; evidenceId: string | null }>;
  evidence: CrawlEvidenceRecord[];
}

export interface WorkerRunExecutionSnapshot {
  run: CrawlRunRecord;
  plan: CrawlPlanRecord;
  steps: CrawlRunStepRecord[];
  evidence: CrawlEvidenceRecord[];
}

export interface SaveWorkerAppFlowsInput {
  runId: string;
  workerId: string;
  app: string;
  flows: DesignFlow[];
}

export interface ProposeRepairInput {
  planId: string;
  runId: string;
  flowId: string;
  stepId: string;
  proposedStep: unknown;
  failure: JsonObject;
  provider?: string;
}

const PLAN_STATUSES = new Set<CrawlPlanStatus>(["draft", "approved", "superseded"]);
const RUN_STATUSES = new Set<CrawlRunStatus>(["queued", "running", "succeeded", "failed", "cancelled", "interrupted"]);
const STEP_STATUSES = new Set<CrawlRunStepStatus>(["queued", "running", "completed", "skipped", "failed"]);
const TERMINAL_RUN_STATUSES = new Set<CrawlRunStatus>(["succeeded", "failed", "cancelled"]);
const RETRY_MODES = new Set<RetryMode>(["all", "failed", "remaining"]);
const SECRET_KEY = /password|passwd|pwd|secret|token|api.?key|private.?key|authorization|cookie|session.?id/i;
const SECRET_VALUE = /\bBearer\s+\S+|-----BEGIN [^-]*PRIVATE KEY-----|(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^@\s]+@|\bAKIA[0-9A-Z]{16}\b|\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/;
const ENVIRONMENT_STRING_KEYS = ["browserName", "browserVersion", "platform", "workerVersion", "locale", "timezone"] as const;
const ENVIRONMENT_BOOLEAN_KEYS = ["unsafeApproved", "disposableAccountAcknowledged", "allowSideEffects"] as const;
const ENVIRONMENT_KEYS = new Set<string>([
  "headless",
  "viewport",
  "requestedFlowIds",
  ...ENVIRONMENT_STRING_KEYS,
  ...ENVIRONMENT_BOOLEAN_KEYS,
]);

const planSelect = `SELECT cp.*, a.name AS app
  FROM crawl_plans cp JOIN apps a ON a.id = cp.app_id`;
const runSelect = `SELECT cr.*, a.name AS app
  FROM crawl_runs cr JOIN apps a ON a.id = cr.app_id`;

function jsonObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  try {
    return JSON.parse(JSON.stringify(value)) as JsonObject;
  } catch {
    throw new Error(`${label} must be JSON-serializable`);
  }
}

function parsedPlan(value: unknown): CrawlPlan {
  const plan = parseCrawlPlan(typeof value === "string" ? value : JSON.stringify(value));
  return plan;
}

function mapPlanRow(row: CrawlPlanRow): CrawlPlanRecord {
  const plan = parsedPlan(row.plan);
  if (plan.app !== row.app || plan.revision !== row.revision) {
    throw new Error("Stored crawl plan identity does not match its app and revision columns");
  }
  if (hashPlan(plan) !== row.content_hash) throw new Error("Stored crawl plan content hash does not match");
  return { ...row, plan };
}

function serializePlan(plan: CrawlPlan): string {
  return JSON.stringify(plan);
}

function hashPlan(plan: CrawlPlan): string {
  return createHash("sha256").update(serializePlan(plan)).digest("hex");
}

function containsSecretLike(value: unknown, checkKeys: boolean): boolean {
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value)) return true;
    try {
      const url = new URL(value);
      if (url.username || url.password) return true;
      if ([...url.searchParams.keys()].some((key) => SECRET_KEY.test(key))) return true;
    } catch {
      // Ordinary metadata strings are not URLs.
    }
    return false;
  }
  if (Array.isArray(value)) return value.some((item) => containsSecretLike(item, checkKeys));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => (checkKeys && SECRET_KEY.test(key)) || containsSecretLike(item, checkKeys));
}

function assertNoSecrets(value: unknown, label: string, checkKeys = true): void {
  if (containsSecretLike(value, checkKeys)) throw new Error(`${label} contains secret-like material`);
}

function parseRunEnvironment(value: unknown): CrawlRunEnvironment {
  const invalid = () => {
    throw new Error("Run environment contains unsupported or secret-like metadata");
  };
  let raw: JsonObject;
  try {
    raw = jsonObject(value, "Run environment");
  } catch {
    return invalid();
  }
  if (containsSecretLike(raw, true) || Object.keys(raw).some((key) => !ENVIRONMENT_KEYS.has(key))) return invalid();
  if (raw.headless !== undefined && typeof raw.headless !== "boolean") return invalid();
  for (const key of ENVIRONMENT_BOOLEAN_KEYS) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") return invalid();
  }
  for (const key of ENVIRONMENT_STRING_KEYS) {
    if (raw[key] !== undefined && (typeof raw[key] !== "string" || !raw[key].trim())) return invalid();
  }
  if (raw.viewport !== undefined) {
    if (!raw.viewport || typeof raw.viewport !== "object" || Array.isArray(raw.viewport)) return invalid();
    const viewport = raw.viewport as JsonObject;
    if (Object.keys(viewport).some((key) => key !== "width" && key !== "height")) return invalid();
    if (!Number.isInteger(viewport.width) || (viewport.width as number) <= 0
      || !Number.isInteger(viewport.height) || (viewport.height as number) <= 0) return invalid();
  }
  if (raw.requestedFlowIds !== undefined && (
    !Array.isArray(raw.requestedFlowIds)
    || raw.requestedFlowIds.some((flowId) => typeof flowId !== "string" || !flowId.trim())
  )) return invalid();
  const requestedFlowIds = [...new Set((raw.requestedFlowIds as string[] | undefined)?.map((id) => id.trim()) ?? [])];
  return {
    ...raw,
    requestedFlowIds,
    unsafeApproved: raw.unsafeApproved ?? false,
    disposableAccountAcknowledged: raw.disposableAccountAcknowledged ?? false,
    allowSideEffects: raw.allowSideEffects ?? false,
  } as CrawlRunEnvironment;
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`);
}

function nonEmpty(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} must be non-empty`);
  return value.trim();
}

async function assertAdmin(client: pg.PoolClient, userId: number): Promise<void> {
  const user = await client.query("SELECT 1 FROM users WHERE id = $1 AND role = 'admin' AND active = true", [userId]);
  if (!user.rowCount) throw new Error("An active admin must review crawl plans and repairs");
}

async function clientPlan(client: pg.PoolClient, id: string): Promise<CrawlPlanRecord | undefined> {
  const result = await client.query<CrawlPlanRow>(`${planSelect} WHERE cp.id = $1`, [id]);
  return result.rows[0] ? mapPlanRow(result.rows[0]) : undefined;
}

async function clientRun(client: pg.PoolClient, id: string): Promise<CrawlRunRecord | undefined> {
  const result = await client.query<CrawlRunRecord>(`${runSelect} WHERE cr.id = $1`, [id]);
  return result.rows[0];
}

async function clientRepair(client: pg.PoolClient, id: string): Promise<CrawlRepairRecord | undefined> {
  const result = await client.query<CrawlRepairRecord>("SELECT * FROM crawl_repairs WHERE id = $1", [id]);
  return result.rows[0];
}

async function lockedWorkerRun(
  client: pg.PoolClient,
  runId: string,
  workerId: string,
): Promise<{ run: CrawlRunRecord; plan: CrawlPlanRecord }> {
  const runResult = await client.query<CrawlRunRecord>(
    `${runSelect} WHERE cr.id = $1 FOR SHARE OF cr`,
    [runId],
  );
  const run = runResult.rows[0];
  if (!run || run.status !== "running" || run.worker_id !== nonEmpty(workerId, "Worker id")) {
    throw new Error("Crawl run worker lease is not active");
  }
  const planResult = await client.query<CrawlPlanRow>(
    `${planSelect} WHERE cp.id = $1 FOR SHARE OF cp`,
    [run.plan_id],
  );
  if (!planResult.rowCount) throw new Error("Pinned crawl plan not found");
  return { run, plan: mapPlanRow(planResult.rows[0]) };
}

function planHasStep(plan: CrawlPlan, flowId: string, stepId: string): boolean {
  return plan.flows.some((flow) => flow.id === flowId && flow.steps.some((step) => step.id === stepId));
}

async function insertDraftPlan(
  client: pg.PoolClient,
  plan: CrawlPlan,
  userId: number | undefined,
  researchMetadata: JsonObject,
): Promise<CrawlPlanRecord> {
  const appRow = await client.query<{ id: number }>(
    `INSERT INTO apps (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [plan.app],
  );
  const created = await client.query<{ id: string }>(
    `INSERT INTO crawl_plans
       (app_id, revision, plan, content_hash, status, research_metadata, created_by)
     VALUES ($1, $2, $3::jsonb, $4, 'draft', $5::jsonb, $6)
     RETURNING id`,
    [appRow.rows[0].id, plan.revision, serializePlan(plan), hashPlan(plan), JSON.stringify(researchMetadata), userId ?? null],
  );
  return (await clientPlan(client, created.rows[0].id))!;
}

export async function saveDraftPlan(
  value: unknown,
  userId?: number,
  researchMetadata: JsonObject = {},
): Promise<CrawlPlanRecord> {
  const plan = parsedPlan(value);
  if (plan.reviewed) throw new Error("A draft crawl plan must have reviewed false");
  const metadata = jsonObject(researchMetadata, "Research metadata");
  return withTransaction((client) => insertDraftPlan(client, plan, userId, metadata));
}

export async function getPlan(id: string): Promise<CrawlPlanRecord | undefined> {
  const result = await query<CrawlPlanRow>(`${planSelect} WHERE cp.id = $1`, [id]);
  return result.rows[0] ? mapPlanRow(result.rows[0]) : undefined;
}

export async function listPlans(app: string, status?: CrawlPlanStatus): Promise<CrawlPlanRecord[]> {
  if (status && !PLAN_STATUSES.has(status)) throw new Error("Invalid crawl plan status");
  const result = await query<CrawlPlanRow>(
    `${planSelect} WHERE a.name = $1 AND ($2::text IS NULL OR cp.status = $2)
     ORDER BY cp.revision DESC`,
    [app, status ?? null],
  );
  return result.rows.map(mapPlanRow);
}

export async function approvePlan(id: string, userId: number): Promise<CrawlPlanRecord> {
  return withTransaction(async (client) => {
    await assertAdmin(client, userId);
    const located = await client.query<{ app_id: number }>("SELECT app_id FROM crawl_plans WHERE id = $1", [id]);
    if (!located.rowCount) throw new Error("Crawl plan not found");
    // App first, then plan: every plan/revision writer uses this lock order.
    await client.query("SELECT id FROM apps WHERE id = $1 FOR UPDATE", [located.rows[0].app_id]);
    const locked = await client.query<CrawlPlanRow>(
      `${planSelect} WHERE cp.id = $1 FOR UPDATE OF cp`,
      [id],
    );
    const row = locked.rows[0] ? mapPlanRow(locked.rows[0]) : undefined;
    if (!row) throw new Error("Crawl plan not found");
    if (row.status !== "draft") throw new Error("Only a draft crawl plan can be approved");

    const approved = parsedPlan({ ...row.plan, reviewed: true });
    await client.query(
      `UPDATE crawl_plans SET status = 'superseded', updated_at = now()
       WHERE app_id = $1 AND status = 'approved' AND id <> $2`,
      [row.app_id, id],
    );
    await client.query(
      `UPDATE crawl_plans
       SET plan = $2::jsonb, content_hash = $3, status = 'approved',
           approved_by = $4, approved_at = now(), updated_at = now()
       WHERE id = $1`,
      [id, serializePlan(approved), hashPlan(approved), userId],
    );
    return (await clientPlan(client, id))!;
  });
}

export async function createRun(input: CreateRunInput): Promise<CrawlRunRecord> {
  const environment = parseRunEnvironment(input.environment);
  return withTransaction(async (client) => {
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1 FOR SHARE", [input.app]);
    if (!app.rowCount) throw new Error("Plan and version must belong to the same app");
    const appId = app.rows[0].id;

    const planResult = await client.query<CrawlPlanRow>(
      `${planSelect} WHERE cp.id = $1 FOR SHARE OF cp`,
      [input.planId],
    );
    const plan = planResult.rows[0] ? mapPlanRow(planResult.rows[0]) : undefined;
    if (!plan || plan.status !== "approved") throw new Error("Crawl runs require an approved plan");
    if (plan.app_id !== appId) throw new Error("Plan and version must belong to the same app");
    if (!plan.plan.reviewed) throw new Error("Crawl runs require an approved reviewed plan");
    if (environment.requestedFlowIds.some((flowId) => !plan.plan.flows.some(({ id }) => id === flowId))) {
      throw new Error("Requested flow is not present in the approved plan");
    }

    const version = await client.query<{ app_id: number; status: string }>(
      "SELECT app_id, status FROM app_versions WHERE id = $1 FOR SHARE",
      [input.versionId],
    );
    if (!version.rowCount || !["draft", "in_review"].includes(version.rows[0].status)) {
      throw new Error("Crawl runs require a draft or in-review version");
    }
    if (version.rows[0].app_id !== appId) throw new Error("Plan and version must belong to the same app");

    if (input.retryOfRunId) {
      const original = await client.query<{ app_id: number; version_id: number; plan_id: string; status: CrawlRunStatus }>(
        "SELECT app_id, version_id, plan_id, status FROM crawl_runs WHERE id = $1 FOR SHARE",
        [input.retryOfRunId],
      );
      if (!original.rowCount
        || original.rows[0].app_id !== appId
        || original.rows[0].version_id !== input.versionId
        || original.rows[0].plan_id !== input.planId
        || !["failed", "cancelled", "interrupted"].includes(original.rows[0].status)) {
        throw new Error("Retry must reuse the original run app, version, and plan");
      }
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO crawl_runs
         (app_id, version_id, plan_id, job_id, status, retry_of_run_id, retry_mode, environment)
       VALUES ($1, $2, $3, $4, 'queued', $5, 'all', $6::jsonb)
       RETURNING id`,
      [appId, input.versionId, input.planId, input.jobId ?? null, input.retryOfRunId ?? null, JSON.stringify(environment)],
    );
    return (await clientRun(client, created.rows[0].id))!;
  });
}

export async function getRun(id: string): Promise<CrawlRunRecord | undefined> {
  const result = await query<CrawlRunRecord>(`${runSelect} WHERE cr.id = $1`, [id]);
  return result.rows[0];
}

export async function listRuns(app: string, status?: CrawlRunStatus): Promise<CrawlRunRecord[]> {
  if (status && !RUN_STATUSES.has(status)) throw new Error("Invalid crawl run status");
  const result = await query<CrawlRunRecord>(
    `${runSelect} WHERE a.name = $1 AND ($2::text IS NULL OR cr.status = $2)
     ORDER BY cr.created_at DESC, cr.id DESC`,
    [app, status ?? null],
  );
  return result.rows;
}

export async function claimRun(workerId: string): Promise<CrawlRunRecord | undefined> {
  const worker = nonEmpty(workerId, "Worker id");
  return withTransaction(async (client) => {
    const skipped: string[] = [];
    while (true) {
      const candidate = await client.query<{ id: string; version_id: number }>(
        `SELECT cr.id, cr.version_id
         FROM crawl_runs cr
         WHERE cr.status IN ('queued', 'interrupted')
           AND NOT (cr.id = ANY($1::bigint[]))
         ORDER BY CASE cr.status WHEN 'queued' THEN 0 ELSE 1 END, cr.created_at, cr.id
         LIMIT 1`,
        [skipped],
      );
      if (!candidate.rowCount) return undefined;
      const version = await client.query<{ status: string }>(
        "SELECT status FROM app_versions WHERE id = $1 FOR SHARE",
        [candidate.rows[0].version_id],
      );
      const runLock = await client.query(
        "SELECT 1 FROM crawl_runs WHERE id = $1 AND status IN ('queued', 'interrupted') FOR UPDATE SKIP LOCKED",
        [candidate.rows[0].id],
      );
      if (!runLock.rowCount) {
        skipped.push(candidate.rows[0].id);
        continue;
      }
      if (!version.rowCount || !["draft", "in_review"].includes(version.rows[0].status)) {
        await client.query(
          `UPDATE crawl_runs
           SET status = 'cancelled', worker_id = NULL, finished_at = now(), updated_at = now()
           WHERE id = $1 AND status IN ('queued', 'interrupted')`,
          [candidate.rows[0].id],
        );
        continue;
      }
      const result = await client.query<CrawlRunRecord>(
        `UPDATE crawl_runs cr
         SET status = 'running', worker_id = $1, heartbeat_at = now(),
             started_at = COALESCE(cr.started_at, now()), finished_at = NULL, updated_at = now()
         FROM apps a
         WHERE cr.id = $2 AND cr.status IN ('queued', 'interrupted') AND a.id = cr.app_id
         RETURNING cr.*, a.name AS app`,
        [worker, candidate.rows[0].id],
      );
      if (result.rowCount) return result.rows[0];
    }
  });
}

export async function claimRunById(runId: string, workerId: string): Promise<CrawlRunRecord> {
  const id = nonEmpty(runId, "Run id");
  const worker = nonEmpty(workerId, "Worker id");
  return withTransaction(async (client) => {
    const pin = await client.query<{ version_id: number }>(
      "SELECT version_id FROM crawl_runs WHERE id = $1",
      [id],
    );
    if (!pin.rowCount) throw new Error("Crawl run not found");

    // Publication locks the version before its runs. Match that order here.
    const version = await client.query<{ status: string }>(
      "SELECT status FROM app_versions WHERE id = $1 FOR SHARE",
      [pin.rows[0].version_id],
    );
    const locked = await client.query<CrawlRunRecord>(
      `${runSelect} WHERE cr.id = $1 FOR UPDATE OF cr`,
      [id],
    );
    const run = locked.rows[0];
    if (!run) throw new Error("Crawl run not found");
    if (run.version_id !== pin.rows[0].version_id) throw new Error("Crawl run version changed while claiming it");
    if (run.status === "running") {
      if (run.worker_id !== worker) throw new Error("Crawl run is owned by another worker");
      const reused = await client.query<CrawlRunRecord>(
        `UPDATE crawl_runs cr SET heartbeat_at = now(), updated_at = now()
         FROM apps a WHERE cr.id = $1 AND a.id = cr.app_id
         RETURNING cr.*, a.name AS app`,
        [id],
      );
      return reused.rows[0];
    }
    if (!["queued", "interrupted"].includes(run.status)) throw new Error("Terminal crawl run cannot be claimed");
    if (!version.rowCount || !["draft", "in_review"].includes(version.rows[0].status)) {
      const cancelled = await client.query<CrawlRunRecord>(
        `UPDATE crawl_runs cr
         SET status = 'cancelled', worker_id = NULL, finished_at = now(), updated_at = now()
         FROM apps a
         WHERE cr.id = $1 AND cr.status IN ('queued', 'interrupted') AND a.id = cr.app_id
         RETURNING cr.*, a.name AS app`,
        [id],
      );
      return cancelled.rows[0];
    }
    const claimed = await client.query<CrawlRunRecord>(
      `UPDATE crawl_runs cr
       SET status = 'running', worker_id = $2, heartbeat_at = now(),
           started_at = COALESCE(cr.started_at, now()), finished_at = NULL, updated_at = now()
       FROM apps a WHERE cr.id = $1 AND a.id = cr.app_id
       RETURNING cr.*, a.name AS app`,
      [id, worker],
    );
    return claimed.rows[0];
  });
}

export async function heartbeatRun(id: string, workerId: string): Promise<CrawlRunRecord> {
  const result = await query<CrawlRunRecord>(
    `UPDATE crawl_runs cr SET heartbeat_at = now(), updated_at = now()
     FROM apps a
     WHERE cr.id = $1 AND cr.status = 'running' AND cr.worker_id = $2 AND a.id = cr.app_id
     RETURNING cr.*, a.name AS app`,
    [id, nonEmpty(workerId, "Worker id")],
  );
  if (!result.rowCount) throw new Error("Running crawl run is not owned by this worker");
  return result.rows[0];
}

export async function updateRun(id: string, workerId: string, patch: UpdateRunInput): Promise<CrawlRunRecord> {
  const assignments: string[] = [];
  const values: unknown[] = [id, nonEmpty(workerId, "Worker id")];
  const set = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (patch.status !== undefined) {
    if (!["succeeded", "failed", "cancelled", "interrupted"].includes(patch.status)) {
      throw new Error("Invalid crawl run transition");
    }
    values.push(patch.status);
    const statusParameter = `$${values.length}`;
    assignments.push(`status = CASE WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' ELSE ${statusParameter} END`);
    if (TERMINAL_RUN_STATUSES.has(patch.status)) {
      assignments.push("finished_at = now()");
    } else {
      assignments.push("finished_at = CASE WHEN cancel_requested_at IS NOT NULL THEN now() ELSE finished_at END");
    }
    if (patch.status === "interrupted") assignments.push("worker_id = NULL");
  }
  if (patch.currentFlowId !== undefined) set("current_flow_id", patch.currentFlowId);
  if (patch.currentStepId !== undefined) set("current_step_id", patch.currentStepId);
  for (const [column, value] of [
    ["completed_count", patch.completedCount],
    ["failed_count", patch.failedCount],
    ["skipped_count", patch.skippedCount],
  ] as const) {
    if (value !== undefined) {
      assertNonNegative(value, column);
      set(column, value);
    }
  }
  assertNoSecrets({ currentFlowId: patch.currentFlowId, currentStepId: patch.currentStepId }, "Run progress", false);
  assignments.push("updated_at = now()");
  const result = await query<CrawlRunRecord>(
    `UPDATE crawl_runs SET ${assignments.join(", ")}
     WHERE id = $1 AND status = 'running' AND worker_id = $2
     RETURNING crawl_runs.*, (SELECT name FROM apps WHERE id = crawl_runs.app_id) AS app`,
    values,
  );
  if (!result.rowCount) throw new Error("Crawl run worker lease or transition is no longer valid");
  return result.rows[0];
}

export async function requestRunCancellation(id: string): Promise<CrawlRunRecord> {
  const result = await query<CrawlRunRecord>(
    `UPDATE crawl_runs
     SET cancel_requested_at = COALESCE(cancel_requested_at, now()),
         status = CASE WHEN status IN ('queued', 'interrupted') THEN 'cancelled' ELSE status END,
         finished_at = CASE WHEN status IN ('queued', 'interrupted') THEN now() ELSE finished_at END,
         worker_id = CASE WHEN status IN ('queued', 'interrupted') THEN NULL ELSE worker_id END,
         updated_at = now()
     WHERE id = $1 AND status IN ('queued', 'running', 'interrupted')
     RETURNING crawl_runs.*, (SELECT name FROM apps WHERE id = crawl_runs.app_id) AS app`,
    [id],
  );
  if (!result.rowCount) throw new Error("Only an active crawl run can be cancelled");
  return result.rows[0];
}

export async function markQueuedRunInterrupted(id: string): Promise<CrawlRunRecord> {
  const runId = nonEmpty(id, "Run id");
  return withTransaction(async (client) => {
    const result = await client.query<CrawlRunRecord>(
      `UPDATE crawl_runs
       SET status = CASE WHEN cancel_requested_at IS NULL THEN 'interrupted' ELSE 'cancelled' END,
           worker_id = NULL,
           heartbeat_at = NULL,
           finished_at = CASE
             WHEN cancel_requested_at IS NULL THEN NULL
             ELSE COALESCE(finished_at, now())
           END,
           updated_at = now()
       WHERE id = $1 AND status = 'queued'
       RETURNING crawl_runs.*, (SELECT name FROM apps WHERE id = crawl_runs.app_id) AS app`,
      [runId],
    );
    if (result.rowCount) return result.rows[0];
    const current = await clientRun(client, runId);
    if (!current) throw new Error("Crawl run not found");
    return current;
  });
}

export async function isRunCancellationRequested(id: string): Promise<boolean> {
  const result = await query<{ requested: boolean }>(
    "SELECT cancel_requested_at IS NOT NULL AS requested FROM crawl_runs WHERE id = $1",
    [id],
  );
  return result.rows[0]?.requested ?? false;
}

export async function upsertRunStep(input: UpsertRunStepInput): Promise<CrawlRunStepRecord> {
  if (!STEP_STATUSES.has(input.status)) throw new Error("Invalid crawl run step status");
  assertNonNegative(input.flowOrder, "Flow order");
  assertNonNegative(input.stepOrder, "Step order");
  assertNonNegative(input.attempts, "Attempts");
  assertNoSecrets(input, "Run step");
  const flowId = nonEmpty(input.flowId, "Flow id");
  const stepId = nonEmpty(input.stepId, "Step id");

  return withTransaction(async (client) => {
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (!planHasStep(locked.plan.plan, flowId, stepId)) {
      throw new Error("Run step is not present in the pinned plan");
    }
    if (input.evidenceId) {
      const evidence = await client.query(
        `SELECT 1 FROM crawl_evidence
         WHERE id = $1 AND version_id = $2 AND plan_id = $3 AND flow_id = $4 AND step_id = $5`,
        [input.evidenceId, locked.run.version_id, locked.run.plan_id, flowId, stepId],
      );
      if (!evidence.rowCount) throw new Error("Step evidence must belong to the run version, plan, flow and step");
    }

    const startedAt = input.startedAt === undefined ? null : input.startedAt;
    const finishedAt = input.finishedAt === undefined ? null : input.finishedAt;
    const result = await client.query<CrawlRunStepRecord>(
    `INSERT INTO crawl_run_steps
       (run_id, flow_id, step_id, flow_order, step_order, status, attempts,
        source_url, final_url, expected, actual, observed_screenshot_hash, evidence_id,
        error_class, error_message, failure_screenshot, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (run_id, flow_id, step_id) DO UPDATE SET
       flow_order = EXCLUDED.flow_order,
       step_order = EXCLUDED.step_order,
       status = EXCLUDED.status,
       attempts = EXCLUDED.attempts,
       source_url = CASE WHEN $19::boolean THEN EXCLUDED.source_url ELSE crawl_run_steps.source_url END,
       final_url = CASE WHEN $20::boolean THEN EXCLUDED.final_url ELSE crawl_run_steps.final_url END,
       expected = CASE WHEN $21::boolean THEN EXCLUDED.expected ELSE crawl_run_steps.expected END,
       actual = CASE WHEN $22::boolean THEN EXCLUDED.actual ELSE crawl_run_steps.actual END,
       observed_screenshot_hash = CASE WHEN $23::boolean THEN EXCLUDED.observed_screenshot_hash ELSE crawl_run_steps.observed_screenshot_hash END,
       evidence_id = CASE WHEN $24::boolean THEN EXCLUDED.evidence_id ELSE crawl_run_steps.evidence_id END,
       error_class = CASE WHEN $25::boolean THEN EXCLUDED.error_class ELSE crawl_run_steps.error_class END,
       error_message = CASE WHEN $26::boolean THEN EXCLUDED.error_message ELSE crawl_run_steps.error_message END,
       failure_screenshot = CASE WHEN $27::boolean THEN EXCLUDED.failure_screenshot ELSE crawl_run_steps.failure_screenshot END,
       started_at = CASE WHEN $28::boolean THEN EXCLUDED.started_at ELSE crawl_run_steps.started_at END,
       finished_at = CASE WHEN $29::boolean THEN EXCLUDED.finished_at ELSE crawl_run_steps.finished_at END,
       updated_at = now()
     RETURNING *`,
    [
      input.runId,
      flowId,
      stepId,
      input.flowOrder,
      input.stepOrder,
      input.status,
      input.attempts,
      input.sourceUrl ?? null,
      input.finalUrl ?? null,
      input.expected == null ? null : JSON.stringify(input.expected),
      input.actual == null ? null : JSON.stringify(input.actual),
      input.observedScreenshotHash ?? null,
      input.evidenceId ?? null,
      input.errorClass ?? null,
      input.errorMessage ?? null,
      input.failureScreenshot ?? null,
      startedAt,
      finishedAt,
      input.sourceUrl !== undefined,
      input.finalUrl !== undefined,
      input.expected !== undefined,
      input.actual !== undefined,
      input.observedScreenshotHash !== undefined,
      input.evidenceId !== undefined,
      input.errorClass !== undefined,
      input.errorMessage !== undefined,
      input.failureScreenshot !== undefined,
      input.startedAt !== undefined,
      input.finishedAt !== undefined,
    ],
  );
    return result.rows[0];
  });
}

export async function attachFailureObject(input: AttachFailureObjectInput): Promise<void> {
  const flowId = nonEmpty(input.flowId, "Flow id");
  const stepId = nonEmpty(input.stepId, "Step id");
  validateObjectMetadata(input.object);
  if (
    input.object.key !== failureObjectKey(input.runId, flowId, stepId, input.object.sha256)
    || input.object.contentType !== "image/png"
    || input.object.accessClass !== "internal"
  ) {
    throw new Error("Failure object metadata does not match the crawl step");
  }
  assertNoSecrets(input, "Failure object");

  await withTransaction(async (client) => {
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (!planHasStep(locked.plan.plan, flowId, stepId)) {
      throw new Error("Failure object flow and step are not present in the pinned plan");
    }
    const stored = await client.query(
      `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
       WHERE stored_objects.sha256 = EXCLUDED.sha256
         AND stored_objects.byte_size = EXCLUDED.byte_size
         AND stored_objects.content_type = EXCLUDED.content_type
         AND stored_objects.access_class = EXCLUDED.access_class
       RETURNING object_key`,
      [input.object.key, input.object.sha256, input.object.byteSize, input.object.contentType, input.object.accessClass],
    );
    if (stored.rowCount !== 1) throw new Error("Object key already exists with different metadata");
    const attached = await client.query(
      `UPDATE crawl_run_steps SET failure_object_key = $4, updated_at = now()
       WHERE run_id = $1 AND flow_id = $2 AND step_id = $3
         AND (failure_object_key IS NULL OR failure_object_key = $4)
       RETURNING run_id`,
      [input.runId, flowId, stepId, input.object.key],
    );
    if (attached.rowCount !== 1) throw new Error("Crawl run step not found or already attached to another failure object");
  });
}

export async function listRunSteps(runId: string): Promise<CrawlRunStepRecord[]> {
  const result = await query<CrawlRunStepRecord>(
    `SELECT * FROM crawl_run_steps
     WHERE run_id = $1 ORDER BY flow_order, step_order`,
    [nonEmpty(runId, "Run id")],
  );
  return result.rows;
}

export async function listRunEvidence(runId: string): Promise<CrawlEvidenceRecord[]> {
  const result = await query<CrawlEvidenceRecord>(
    `SELECT ce.*
     FROM crawl_run_steps crs
     JOIN crawl_evidence ce ON ce.id = crs.evidence_id
     WHERE crs.run_id = $1
     ORDER BY crs.flow_order, crs.step_order, ce.id`,
    [nonEmpty(runId, "Run id")],
  );
  return result.rows;
}

function validateEvidenceKey(key: EvidenceKey): void {
  assertNonNegative(key.viewportWidth - 1, "Viewport width");
  assertNonNegative(key.viewportHeight - 1, "Viewport height");
  nonEmpty(key.flowId, "Flow id");
  nonEmpty(key.stepId, "Step id");
  nonEmpty(key.finalUrl, "Final URL");
  assertNoSecrets(key, "Evidence key");
}

export async function findEvidence(key: EvidenceKey): Promise<CrawlEvidenceRecord | undefined> {
  validateEvidenceKey(key);
  const result = await query<CrawlEvidenceRecord>(
    `SELECT * FROM crawl_evidence
     WHERE version_id = $1 AND plan_id = $2 AND flow_id = $3 AND step_id = $4
       AND final_url = $5 AND viewport_width = $6 AND viewport_height = $7`,
    [key.versionId, key.planId, key.flowId, key.stepId, key.finalUrl, key.viewportWidth, key.viewportHeight],
  );
  return result.rows[0];
}

export async function findWorkerEvidence(input: FindWorkerEvidenceInput): Promise<CrawlEvidenceRecord | undefined> {
  validateEvidenceKey(input);
  nonEmpty(input.runId, "Run id");
  nonEmpty(input.app, "Evidence app");
  assertNoSecrets(input, "Worker evidence lookup");
  return withTransaction(async (client) => {
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (
      locked.run.app !== input.app ||
      locked.run.version_id !== input.versionId ||
      locked.run.plan_id !== input.planId ||
      locked.plan.app_id !== locked.run.app_id ||
      locked.plan.app !== input.app
    ) {
      throw new Error("Evidence lookup must use the run's pinned app, version and plan");
    }
    if (!planHasStep(locked.plan.plan, input.flowId, input.stepId)) {
      throw new Error("Evidence flow and step are not present in the pinned plan");
    }
    const result = await client.query<CrawlEvidenceRecord>(
      `SELECT * FROM crawl_evidence
       WHERE version_id = $1 AND plan_id = $2 AND flow_id = $3 AND step_id = $4
         AND final_url = $5 AND viewport_width = $6 AND viewport_height = $7`,
      [
        input.versionId,
        input.planId,
        input.flowId,
        input.stepId,
        input.finalUrl,
        input.viewportWidth,
        input.viewportHeight,
      ],
    );
    return result.rows[0];
  });
}

export async function reserveCaptureImage(input: ReserveCaptureImageInput): Promise<ReserveCaptureImageResult> {
  validateEvidenceKey(input);
  nonEmpty(input.app, "Evidence app");
  nonEmpty(input.imageUrl, "Evidence image URL");
  assertNoSecrets(input, "Capture image reservation");
  return withTransaction(async (client) => {
    const pin = await client.query<{ version_id: number }>(
      "SELECT version_id FROM crawl_runs WHERE id = $1",
      [input.runId],
    );
    if (!pin.rowCount || pin.rows[0].version_id !== input.versionId) {
      throw new Error("Capture image must use the run's pinned version");
    }
    const version = await client.query<{ app_id: number; status: string }>(
      `SELECT app_id, status FROM app_versions
       WHERE id = $1 AND status IN ('draft', 'in_review') FOR UPDATE`,
      [input.versionId],
    );
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (
      !version.rowCount ||
      version.rows[0].app_id !== locked.run.app_id ||
      locked.run.version_id !== input.versionId ||
      locked.run.plan_id !== input.planId ||
      locked.run.app !== input.app ||
      locked.plan.app_id !== locked.run.app_id ||
      locked.plan.app !== input.app
    ) {
      throw new Error("Capture image must use the run's pinned app, version and plan");
    }
    if (!planHasStep(locked.plan.plan, input.flowId, input.stepId)) {
      throw new Error("Capture image flow and step are not present in the pinned plan");
    }
    const platform = await client.query<{ id: number }>(
      `INSERT INTO platforms (app_id, name) VALUES ($1, 'web')
       ON CONFLICT (app_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [locked.run.app_id],
    );
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO images (platform_id, image_url, kind) VALUES ($1, $2, 'screen')
       ON CONFLICT (platform_id, image_url) DO NOTHING RETURNING id`,
      [platform.rows[0].id, input.imageUrl],
    );
    const imageId = inserted.rows[0]?.id ?? (await client.query<{ id: number }>(
      "SELECT id FROM images WHERE platform_id = $1 AND image_url = $2",
      [platform.rows[0].id, input.imageUrl],
    )).rows[0]?.id;
    if (!imageId) throw new Error("Capture image was not reserved");
    return { imageId, imageCreated: Boolean(inserted.rowCount) };
  });
}

export async function createEvidence(input: CreateEvidenceInput): Promise<CrawlEvidenceRecord> {
  validateEvidenceKey(input);
  assertNoSecrets(input, "Crawl evidence");
  return withTransaction(async (client) => {
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (locked.run.version_id !== input.versionId || locked.run.plan_id !== input.planId) {
      throw new Error("Evidence must use the run's pinned version and plan");
    }
    if (!planHasStep(locked.plan.plan, input.flowId, input.stepId)) {
      throw new Error("Evidence flow and step are not present in the pinned plan");
    }
    const result = await client.query<CrawlEvidenceRecord>(
    `INSERT INTO crawl_evidence
       (version_id, plan_id, image_id, flow_id, step_id, source_url, final_url,
        state_label, screenshot_hash, viewport_width, viewport_height, captured_at)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, now())
     FROM app_versions av
     JOIN crawl_plans cp ON cp.app_id = av.app_id
     JOIN version_images vi ON vi.version_id = av.id AND vi.image_id = $3
     WHERE av.id = $1 AND cp.id = $2
     ON CONFLICT (version_id, plan_id, flow_id, step_id, final_url, viewport_width, viewport_height)
       DO UPDATE SET id = crawl_evidence.id
     RETURNING *`,
    [
      input.versionId,
      input.planId,
      input.imageId,
      input.flowId,
      input.stepId,
      input.sourceUrl,
      input.finalUrl,
      input.stateLabel,
      input.screenshotHash,
      input.viewportWidth,
      input.viewportHeight,
      input.capturedAt ?? null,
    ],
  );
    if (!result.rowCount) throw new Error("Evidence image must belong to the version and plan app");
    return result.rows[0];
  });
}

export async function persistEvidenceBundle(input: PersistEvidenceBundleInput): Promise<PersistEvidenceBundleResult> {
  validateEvidenceKey(input);
  nonEmpty(input.app, "Evidence app");
  nonEmpty(input.sourceUrl, "Evidence source URL");
  nonEmpty(input.stateLabel, "Evidence state label");
  nonEmpty(input.screenshotHash, "Evidence screenshot hash");
  if (!Number.isSafeInteger(input.imageId) || input.imageId <= 0) throw new Error("Evidence image ID is invalid");
  validateObjectMetadata(input.object);
  if (input.object.sha256 !== input.screenshotHash || input.object.contentType !== "image/png") {
    throw new Error("Evidence object must be the captured PNG");
  }
  assertNoSecrets(input, "Crawl evidence bundle");

  return withTransaction(async (client) => {
    // Publication locks the version before touching runs. Match that order so a capture
    // cannot deadlock a concurrent publication while still revalidating the worker lease.
    const pin = await client.query<{ version_id: number }>(
      "SELECT version_id FROM crawl_runs WHERE id = $1",
      [input.runId],
    );
    if (!pin.rowCount || pin.rows[0].version_id !== input.versionId) {
      throw new Error("Evidence bundle must use the run's pinned version");
    }
    const version = await client.query<{ app_id: number; status: string }>(
      `SELECT app_id, status FROM app_versions
       WHERE id = $1 AND status IN ('draft', 'in_review') FOR UPDATE`,
      [input.versionId],
    );
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (
      !version.rowCount ||
      version.rows[0].app_id !== locked.run.app_id ||
      locked.run.version_id !== input.versionId ||
      locked.run.plan_id !== input.planId ||
      locked.run.app !== input.app ||
      locked.plan.app_id !== locked.run.app_id ||
      locked.plan.app !== input.app
    ) {
      throw new Error("Evidence bundle must use the run's pinned app, version and plan");
    }
    if (!planHasStep(locked.plan.plan, input.flowId, input.stepId)) {
      throw new Error("Evidence flow and step are not present in the pinned plan");
    }

    const existing = await client.query<CrawlEvidenceRecord>(
      `SELECT * FROM crawl_evidence
       WHERE version_id = $1 AND plan_id = $2 AND flow_id = $3 AND step_id = $4
         AND final_url = $5 AND viewport_width = $6 AND viewport_height = $7`,
      [
        input.versionId,
        input.planId,
        input.flowId,
        input.stepId,
        input.finalUrl,
        input.viewportWidth,
        input.viewportHeight,
      ],
    );
    if (existing.rowCount) {
      return {
        imageId: existing.rows[0].image_id,
        evidence: existing.rows[0],
        imageCreated: false,
        evidenceCreated: false,
        reused: true,
      };
    }

    const stored = await client.query(
      `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
       WHERE stored_objects.sha256 = EXCLUDED.sha256
         AND stored_objects.byte_size = EXCLUDED.byte_size
         AND stored_objects.content_type = EXCLUDED.content_type
         AND stored_objects.access_class = EXCLUDED.access_class
       RETURNING object_key`,
      [input.object.key, input.object.sha256, input.object.byteSize, input.object.contentType, input.object.accessClass],
    );
    if (stored.rowCount !== 1) throw new Error("Object key already exists with different metadata");
    const attached = await client.query(
      `UPDATE images i SET object_key = $2
       FROM platforms p
       WHERE i.id = $1 AND p.id = i.platform_id AND p.app_id = $3
         AND (i.object_key IS NULL OR i.object_key = $2)
       RETURNING i.id`,
      [input.imageId, input.object.key, locked.run.app_id],
    );
    if (attached.rowCount !== 1) throw new Error("Image not found or already attached to another object");
    const imageId = input.imageId;

    await client.query(
      `INSERT INTO version_images
         (version_id, image_id, source_url, viewport_width, viewport_height, state_context)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (version_id, image_id) DO UPDATE SET
         source_url = COALESCE(EXCLUDED.source_url, version_images.source_url),
         viewport_width = COALESCE(EXCLUDED.viewport_width, version_images.viewport_width),
         viewport_height = COALESCE(EXCLUDED.viewport_height, version_images.viewport_height),
         state_context = COALESCE(EXCLUDED.state_context, version_images.state_context)`,
      [
        input.versionId,
        imageId,
        input.sourceUrl,
        input.viewportWidth,
        input.viewportHeight,
        input.stateLabel,
      ],
    );
    const evidence = await client.query<CrawlEvidenceRecord>(
      `INSERT INTO crawl_evidence
         (version_id, plan_id, image_id, flow_id, step_id, source_url, final_url,
          state_label, screenshot_hash, viewport_width, viewport_height, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, now()))
       ON CONFLICT (version_id, plan_id, flow_id, step_id, final_url, viewport_width, viewport_height)
         DO NOTHING
       RETURNING *`,
      [
        input.versionId,
        input.planId,
        imageId,
        input.flowId,
        input.stepId,
        input.sourceUrl,
        input.finalUrl,
        input.stateLabel,
        input.screenshotHash,
        input.viewportWidth,
        input.viewportHeight,
        input.capturedAt ?? null,
      ],
    );
    const canonical = evidence.rows[0] ?? (await client.query<CrawlEvidenceRecord>(
      `SELECT * FROM crawl_evidence
       WHERE version_id = $1 AND plan_id = $2 AND flow_id = $3 AND step_id = $4
         AND final_url = $5 AND viewport_width = $6 AND viewport_height = $7`,
      [
        input.versionId,
        input.planId,
        input.flowId,
        input.stepId,
        input.finalUrl,
        input.viewportWidth,
        input.viewportHeight,
      ],
    )).rows[0];
    if (!canonical) throw new Error("Canonical crawl evidence was not persisted");
    const evidenceCreated = Boolean(evidence.rowCount);
    return {
      imageId: canonical.image_id,
      evidence: canonical,
      imageCreated: input.imageCreated,
      evidenceCreated,
      reused: !evidenceCreated,
    };
  });
}

export async function loadWorkerRunFinalization(
  runId: string,
  workerId: string,
): Promise<WorkerRunFinalizationSnapshot> {
  const snapshot = await loadWorkerRunExecution(runId, workerId);
  return {
    runId: snapshot.run.id,
    app: snapshot.run.app,
    versionId: snapshot.run.version_id,
    planId: snapshot.run.plan_id,
    plan: snapshot.plan.plan,
    steps: snapshot.steps.map((step) => ({
      flowId: step.flow_id,
      stepId: step.step_id,
      status: step.status,
      evidenceId: step.evidence_id,
    })),
    evidence: snapshot.evidence,
  };
}

export async function loadWorkerRunExecution(
  runId: string,
  workerId: string,
): Promise<WorkerRunExecutionSnapshot> {
  const id = nonEmpty(runId, "Run id");
  return withTransaction(async (client) => {
    const locked = await lockedWorkerRun(client, id, workerId);
    if (!["approved", "superseded"].includes(locked.plan.status) || !locked.plan.plan.reviewed) {
      throw new Error("Worker execution requires an immutable reviewed pinned plan");
    }
    const steps = await client.query<CrawlRunStepRecord>(
      `SELECT * FROM crawl_run_steps
       WHERE run_id = $1 ORDER BY flow_order, step_order`,
      [id],
    );
    const evidence = await client.query<CrawlEvidenceRecord>(
      `SELECT DISTINCT ce.* FROM crawl_evidence ce
       JOIN crawl_run_steps crs ON crs.evidence_id = ce.id
       WHERE crs.run_id = $1 AND ce.version_id = $2 AND ce.plan_id = $3
       ORDER BY ce.flow_id, ce.step_id, ce.final_url, ce.viewport_width, ce.viewport_height, ce.image_id`,
      [id, locked.run.version_id, locked.run.plan_id],
    );
    return {
      run: { ...locked.run, environment: parseRunEnvironment(locked.run.environment) },
      plan: locked.plan,
      steps: steps.rows,
      evidence: evidence.rows,
    };
  });
}

export async function saveWorkerAppFlows(input: SaveWorkerAppFlowsInput): Promise<void> {
  nonEmpty(input.runId, "Run id");
  nonEmpty(input.app, "App");
  if (!Array.isArray(input.flows)) throw new Error("App flows must be an array");
  const ids = new Set<string>();
  for (const flow of input.flows) {
    const id = nonEmpty(flow.id, "Flow id");
    if (ids.has(id)) throw new Error("App flow ids must be unique");
    ids.add(id);
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(input.flows);
  } catch {
    throw new Error("App flows must be JSON-serializable");
  }
  return withTransaction(async (client) => {
    const locked = await lockedWorkerRun(client, input.runId, input.workerId);
    if (locked.run.app !== input.app || locked.plan.app_id !== locked.run.app_id) {
      throw new Error("App flows must use the run's pinned app");
    }
    await client.query(
      `INSERT INTO app_flows (app_id, flows) VALUES ($1, $2::jsonb)
       ON CONFLICT (app_id) DO UPDATE SET flows = EXCLUDED.flows, updated_at = now()`,
      [locked.run.app_id, serialized],
    );
  });
}

export async function markStaleRunsInterrupted(heartbeatBefore: Date): Promise<number> {
  return (await markStaleRunIdsInterrupted(heartbeatBefore)).length;
}

export async function markStaleRunIdsInterrupted(heartbeatBefore: Date): Promise<string[]> {
  if (Number.isNaN(heartbeatBefore.getTime())) throw new Error("Heartbeat threshold must be a valid date");
  const result = await query<{ id: string }>(
    `UPDATE crawl_runs
     SET status = 'interrupted', worker_id = NULL, updated_at = now()
     WHERE status = 'running' AND COALESCE(heartbeat_at, started_at, created_at) < $1
     RETURNING id`,
    [heartbeatBefore],
  );
  return result.rows.map(({ id }) => id).sort((a, b) => Number(BigInt(a) - BigInt(b)));
}

export async function createRetry(
  originalRunId: string,
  options: { mode?: RetryMode; environment?: Partial<CrawlRunEnvironment> } = {},
): Promise<CrawlRunRecord> {
  const mode = options.mode ?? "all";
  if (!RETRY_MODES.has(mode)) throw new Error("Invalid retry mode");
  const snapshot = await getRun(originalRunId);
  if (!snapshot) throw new Error("Original crawl run not found");
  const retryable = ["failed", "cancelled", "interrupted"].includes(snapshot.status)
    || (snapshot.status === "succeeded" && mode === "all");
  if (!retryable) {
    throw new Error("Only a failed, cancelled, or interrupted run, or a succeeded full run, can be retried");
  }
  const environment = parseRunEnvironment({
    ...snapshot.environment,
    ...(options.environment ?? {}),
  });
  return withTransaction(async (client) => {
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE id = $1 FOR SHARE", [snapshot.app_id]);
    if (!app.rowCount) throw new Error("Original crawl run app no longer exists");
    const planResult = await client.query<CrawlPlanRow>(
      `${planSelect} WHERE cp.id = $1 FOR SHARE OF cp`,
      [snapshot.plan_id],
    );
    const plan = planResult.rows[0] ? mapPlanRow(planResult.rows[0]) : undefined;
    if (!plan || plan.app_id !== snapshot.app_id || !["approved", "superseded"].includes(plan.status) || !plan.plan.reviewed) {
      throw new Error("Retry requires the original reviewed pinned plan");
    }
    if (environment.requestedFlowIds.some((flowId) => !plan.plan.flows.some(({ id }) => id === flowId))) {
      throw new Error("Requested flow is not present in the pinned plan");
    }
    const version = await client.query<{ app_id: number; status: string }>(
      "SELECT app_id, status FROM app_versions WHERE id = $1 FOR SHARE",
      [snapshot.version_id],
    );
    if (!version.rowCount || version.rows[0].app_id !== snapshot.app_id
      || !["draft", "in_review"].includes(version.rows[0].status)) {
      throw new Error("Retry requires the original draft or in-review version");
    }
    const original = await client.query<{
      app_id: number;
      version_id: number;
      plan_id: string;
      status: CrawlRunStatus;
    }>("SELECT app_id, version_id, plan_id, status FROM crawl_runs WHERE id = $1 FOR SHARE", [originalRunId]);
    if (!original.rowCount
      || original.rows[0].app_id !== snapshot.app_id
      || original.rows[0].version_id !== snapshot.version_id
      || original.rows[0].plan_id !== snapshot.plan_id
      || !(["failed", "cancelled", "interrupted"].includes(original.rows[0].status)
        || (original.rows[0].status === "succeeded" && mode === "all"))) {
      throw new Error("Original crawl run changed while creating its retry");
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO crawl_runs
         (app_id, version_id, plan_id, status, retry_of_run_id, retry_mode, environment)
       VALUES ($1, $2, $3, 'queued', $4, $5, $6::jsonb)
       RETURNING id`,
      [snapshot.app_id, snapshot.version_id, snapshot.plan_id, originalRunId, mode, JSON.stringify(environment)],
    );
    return (await clientRun(client, created.rows[0].id))!;
  });
}

export async function getRepair(id: string): Promise<CrawlRepairRecord | undefined> {
  const result = await query<CrawlRepairRecord>("SELECT * FROM crawl_repairs WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listRunRepairs(runId: string): Promise<CrawlRepairRecord[]> {
  const result = await query<CrawlRepairRecord>(
    "SELECT * FROM crawl_repairs WHERE run_id = $1 ORDER BY created_at, id",
    [nonEmpty(runId, "Run id")],
  );
  return result.rows;
}

export async function proposeRepair(input: ProposeRepairInput): Promise<CrawlRepairRecord> {
  const proposed = parseCrawlStep(input.proposedStep);
  if (proposed.id !== input.stepId) throw new Error("Proposed step id must match the repaired step id");
  const failure = jsonObject(input.failure, "Repair failure");
  assertNoSecrets({ proposed, failure }, "Repair proposal");

  const source = await query<{ plan: CrawlPlan }>(
    `SELECT cp.plan
     FROM crawl_plans cp JOIN crawl_runs cr ON cr.plan_id = cp.id
     WHERE cp.id = $1 AND cr.id = $2 AND cp.status = 'approved'`,
    [input.planId, input.runId],
  );
  if (!source.rowCount) throw new Error("Repairs require the run's approved plan");
  const plan = parsedPlan(source.rows[0].plan);
  const flow = plan.flows.find(({ id }) => id === input.flowId);
  if (!flow?.steps.some(({ id }) => id === input.stepId)) throw new Error("Repair target step was not found in the plan");

  const result = await query<CrawlRepairRecord>(
    `INSERT INTO crawl_repairs
       (plan_id, run_id, flow_id, step_id, proposed_step, failure, provider, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'proposed')
     RETURNING *`,
    [
      input.planId,
      input.runId,
      input.flowId,
      input.stepId,
      JSON.stringify(proposed),
      JSON.stringify(failure),
      input.provider ?? null,
    ],
  );
  return result.rows[0];
}

export async function rejectRepair(id: string, userId: number): Promise<CrawlRepairRecord> {
  return withTransaction(async (client) => {
    await assertAdmin(client, userId);
    const locked = await client.query<CrawlRepairRecord>("SELECT * FROM crawl_repairs WHERE id = $1 FOR UPDATE", [id]);
    if (!locked.rowCount) throw new Error("Repair proposal not found");
    if (locked.rows[0].status !== "proposed") throw new Error("Repair proposal was already reviewed");
    await client.query(
      `UPDATE crawl_repairs
       SET status = 'rejected', reviewed_by = $2, reviewed_at = now()
       WHERE id = $1`,
      [id, userId],
    );
    return (await clientRepair(client, id))!;
  });
}

export async function applyRepair(id: string, userId: number): Promise<CrawlRepairRecord> {
  return withTransaction(async (client) => {
    await assertAdmin(client, userId);
    const repairResult = await client.query<CrawlRepairRecord>("SELECT * FROM crawl_repairs WHERE id = $1 FOR UPDATE", [id]);
    const repair = repairResult.rows[0];
    if (!repair) throw new Error("Repair proposal not found");
    if (repair.status !== "proposed") throw new Error("Repair proposal was already reviewed");

    const located = await client.query<{ app_id: number }>("SELECT app_id FROM crawl_plans WHERE id = $1", [repair.plan_id]);
    if (!located.rowCount) throw new Error("Repairs can only be applied to an approved plan");
    await client.query("SELECT id FROM apps WHERE id = $1 FOR UPDATE", [located.rows[0].app_id]);
    const planResult = await client.query<CrawlPlanRow>(
      `${planSelect} WHERE cp.id = $1 FOR SHARE OF cp`,
      [repair.plan_id],
    );
    const source = planResult.rows[0] ? mapPlanRow(planResult.rows[0]) : undefined;
    if (!source || source.status !== "approved") throw new Error("Repairs can only be applied to an approved plan");

    const original = source.plan;
    const replacement = parseCrawlStep(repair.proposed_step);
    if (replacement.id !== repair.step_id) throw new Error("Proposed step id must match the repaired step id");
    let replaced = false;
    const flows = original.flows.map((flow) => {
      if (flow.id !== repair.flow_id) return flow;
      return {
        ...flow,
        steps: flow.steps.map((step) => {
          if (step.id !== repair.step_id) return step;
          replaced = true;
          return replacement;
        }),
      };
    });
    if (!replaced) throw new Error("Repair target step was not found in the plan");

    const next = await client.query<{ revision: number }>(
      "SELECT COALESCE(MAX(revision), 0)::int + 1 AS revision FROM crawl_plans WHERE app_id = $1",
      [source.app_id],
    );
    const revised = parsedPlan({
      ...original,
      revision: next.rows[0].revision,
      reviewed: false,
      flows,
    });
    const draft = await insertDraftPlan(client, revised, userId, {
      ...source.research_metadata,
      repairId: repair.id,
      sourcePlanId: source.id,
    });
    await client.query(
      `UPDATE crawl_repairs
       SET status = 'applied', reviewed_by = $2, reviewed_at = now(), applied_plan_id = $3
       WHERE id = $1`,
      [id, userId, draft.id],
    );
    return (await clientRepair(client, id))!;
  });
}
