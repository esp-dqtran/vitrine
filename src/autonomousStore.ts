import { createHash } from "node:crypto";
import type pg from "pg";
import { query, withTransaction } from "./db.ts";
import {
  parseAppDossier,
  parseMission,
  type AppDossier,
  type AutonomousMission,
  type AutonomousState,
  type MissionMode,
  type MissionStatus,
} from "./autonomousCrawler.ts";
import type { CrawlRunRecord } from "./crawlStore.ts";
import type { Platform } from "./platformFromUrl.ts";

export interface CreateAutonomousRunInput {
  app: string;
  platform: Platform;
  versionId: number;
  createdBy: number;
  homepageUrl: string;
  allowAll: boolean;
  environment?: Record<string, unknown>;
}

export interface CrawlDossierRecord {
  id: string;
  run_id: string;
  revision: number;
  dossier: AppDossier;
  content_hash: string;
  created_at: Date;
}

export interface CrawlMissionRecord extends AutonomousMission {
  id: string;
  run_id: string;
  mission_key: string;
  product_area: string;
  status: MissionStatus;
  worker_id: string | null;
  heartbeat_at: Date | null;
  lease_expires_at: Date | null;
  checkpoint: unknown;
  result: unknown;
}

export interface CrawlStateRecord extends AutonomousState {
  id: string;
  run_id: string;
  evidence_id: string | null;
}

export interface CrawlTransitionRecord {
  id: string;
  run_id: string;
  mission_id: string;
  child_run_id: string | null;
  source_state_id: string | null;
  destination_state_id: string | null;
  action: unknown;
  mode: MissionMode;
  outcome: "completed" | "failed" | "blocked";
  confidence: number;
}

export interface RecordTransitionInput {
  runId: string;
  missionId: string;
  childRunId?: string;
  sourceStateId?: string;
  destinationStateId?: string;
  action: unknown;
  mode: MissionMode;
  outcome: "completed" | "failed" | "blocked";
  confidence: number;
}

export interface AutonomousRunDetail {
  run: CrawlRunRecord;
  dossier?: CrawlDossierRecord;
  missions: CrawlMissionRecord[];
  states: CrawlStateRecord[];
  transitions: CrawlTransitionRecord[];
}

export interface AutonomousStore {
  createAutonomousRun(input: CreateAutonomousRunInput): Promise<CrawlRunRecord>;
  saveDossier(runId: string, dossier: AppDossier): Promise<CrawlDossierRecord>;
  latestDossier(runId: string): Promise<CrawlDossierRecord | undefined>;
  saveMissions(runId: string, missions: AutonomousMission[]): Promise<CrawlMissionRecord[]>;
  claimMission(runId: string, workerId: string, now: Date, leaseMs: number): Promise<CrawlMissionRecord | undefined>;
  heartbeatMission(missionId: string, workerId: string, now: Date, leaseMs: number): Promise<void>;
  finishMission(missionId: string, workerId: string, status: Extract<MissionStatus, "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled">, result: unknown): Promise<void>;
  acquireAccountLease(runId: string, missionId: string, workerId: string, purpose: "mutation" | "authentication", now: Date, leaseMs: number): Promise<boolean>;
  heartbeatAccountLease(runId: string, workerId: string, purpose: "mutation" | "authentication", now: Date, leaseMs: number): Promise<void>;
  releaseAccountLease(runId: string, workerId: string, purpose: "mutation" | "authentication"): Promise<void>;
  upsertState(runId: string, state: AutonomousState, evidenceId?: string): Promise<CrawlStateRecord>;
  recordTransition(input: RecordTransitionInput): Promise<CrawlTransitionRecord>;
  autonomousRunDetail(runId: string): Promise<AutonomousRunDetail | undefined>;
  requestPause(runId: string): Promise<void>;
  clearPause(runId: string): Promise<void>;
}

interface StoreDependencies {
  query: typeof query;
  withTransaction: typeof withTransaction;
}

type MissionRow = Omit<CrawlMissionRecord, keyof AutonomousMission> & {
  mission_key: string;
  goal: string;
  product_area: string;
  mode: MissionMode;
  prerequisites: string[];
  budget: AutonomousMission["budget"];
};

type DossierRow = Omit<CrawlDossierRecord, "dossier"> & { dossier: unknown };
type StateRow = Omit<CrawlStateRecord, keyof AutonomousState> & {
  state_key: string;
  normalized_url: string;
  label: string;
  product_area: string;
  account_state_version: number;
  fingerprint: AutonomousState["fingerprint"];
};

const runSelect = `SELECT cr.*, a.name AS app
  FROM crawl_runs cr JOIN apps a ON a.id = cr.app_id`;

function nonEmpty(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function expiry(now: Date, leaseMs: number): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Lease time is invalid");
  if (!Number.isInteger(leaseMs) || leaseMs < 1) throw new Error("Lease duration is invalid");
  return new Date(now.getTime() + leaseMs);
}

function mapMission(row: MissionRow): CrawlMissionRecord {
  return {
    ...row,
    missionKey: row.mission_key,
    productArea: row.product_area,
  };
}

function mapDossier(row: DossierRow): CrawlDossierRecord {
  return { ...row, dossier: parseAppDossier(row.dossier) };
}

function mapState(row: StateRow): CrawlStateRecord {
  return {
    ...row,
    stateKey: row.state_key,
    normalizedUrl: row.normalized_url,
    productArea: row.product_area,
    accountStateVersion: row.account_state_version,
  };
}

export function createAutonomousStore(overrides: Partial<StoreDependencies> = {}): AutonomousStore {
  const deps: StoreDependencies = { query, withTransaction, ...overrides };

  const createAutonomousRun = (input: CreateAutonomousRunInput): Promise<CrawlRunRecord> => deps.withTransaction(async (client) => {
    const appName = nonEmpty(input.app, "App");
    let homepage: URL;
    try {
      homepage = new URL(input.homepageUrl);
    } catch {
      throw new Error("Homepage URL must be absolute");
    }
    if (!["http:", "https:"].includes(homepage.protocol)) throw new Error("Homepage URL must use HTTP or HTTPS");
    const admin = await client.query("SELECT 1 FROM users WHERE id = $1 AND role = 'admin' AND active = true", [input.createdBy]);
    if (!admin.rowCount) throw new Error("Autonomous runs require an active administrator");
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1 FOR SHARE", [appName]);
    if (!app.rowCount) throw new Error("Autonomous run app does not exist");
    const version = await client.query<{ app_id: number; platform: string; status: string }>(
      "SELECT app_id, platform, status FROM app_versions WHERE id = $1 FOR SHARE",
      [input.versionId],
    );
    if (!version.rowCount || version.rows[0].app_id !== app.rows[0].id || version.rows[0].platform !== input.platform) {
      throw new Error("Autonomous run version must belong to the app and platform");
    }
    if (!["draft", "in_review"].includes(version.rows[0].status)) throw new Error("Autonomous runs require an active version");
    const environment = { ...(input.environment ?? {}), homepageUrl: homepage.toString(), createdBy: input.createdBy };
    const created = await client.query<CrawlRunRecord>(
      `INSERT INTO crawl_runs
         (app_id, version_id, plan_id, status, run_kind, platform, allow_all, environment)
       VALUES ($1, $2, NULL, 'queued', 'autonomous', $3, $4, $5::jsonb)
       RETURNING *`,
      [app.rows[0].id, input.versionId, input.platform, input.allowAll, JSON.stringify(environment)],
    );
    return { ...created.rows[0], app: appName };
  });

  const saveMissions = (runId: string, missions: AutonomousMission[]): Promise<CrawlMissionRecord[]> => deps.withTransaction(async (client) => {
    const run = await client.query<{ allow_all: boolean }>(
      "SELECT allow_all FROM crawl_runs WHERE id = $1 AND run_kind = 'autonomous' FOR UPDATE",
      [runId],
    );
    if (!run.rowCount) throw new Error("Autonomous run not found");
    const saved: CrawlMissionRecord[] = [];
    for (const input of missions) {
      const mission = parseMission(input, run.rows[0].allow_all);
      const result = await client.query<MissionRow>(
        `INSERT INTO crawl_missions
           (run_id, mission_key, goal, product_area, mode, status, prerequisites, budget)
         VALUES ($1, $2, $3, $4, $5, 'queued', $6::jsonb, $7::jsonb)
         ON CONFLICT (run_id, mission_key) DO UPDATE SET
           goal = EXCLUDED.goal, product_area = EXCLUDED.product_area, mode = EXCLUDED.mode,
           prerequisites = EXCLUDED.prerequisites, budget = EXCLUDED.budget, updated_at = now()
         RETURNING *`,
        [runId, mission.missionKey, mission.goal, mission.productArea, mission.mode, JSON.stringify(mission.prerequisites), JSON.stringify(mission.budget)],
      );
      saved.push(mapMission(result.rows[0]));
    }
    return saved;
  });

  const claimMission = (runId: string, workerId: string, now: Date, leaseMs: number): Promise<CrawlMissionRecord | undefined> => deps.withTransaction(async (client) => {
    const worker = nonEmpty(workerId, "Worker id");
    const leaseExpiresAt = expiry(now, leaseMs);
    const candidate = await client.query<{ id: string }>(
      `SELECT cm.id
       FROM crawl_missions cm JOIN crawl_runs cr ON cr.id = cm.run_id
       WHERE cm.run_id = $1 AND cr.run_kind = 'autonomous' AND cr.pause_requested_at IS NULL
         AND (cm.status = 'queued' OR (cm.status IN ('running', 'interrupted') AND cm.lease_expires_at <= $2))
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(cm.prerequisites) prerequisite
           LEFT JOIN crawl_missions dependency
             ON dependency.run_id = cm.run_id AND dependency.mission_key = prerequisite
           WHERE dependency.status IS DISTINCT FROM 'succeeded'
         )
       ORDER BY cm.priority DESC, cm.id
       FOR UPDATE OF cm SKIP LOCKED
       LIMIT 1`,
      [runId, now],
    );
    if (!candidate.rowCount) return undefined;
    const claimed = await client.query<MissionRow>(
      `UPDATE crawl_missions
       SET status = 'running', worker_id = $2, heartbeat_at = $3, lease_expires_at = $4,
           updated_at = $3
       WHERE id = $1 RETURNING *`,
      [candidate.rows[0].id, worker, now, leaseExpiresAt],
    );
    await client.query(
      `UPDATE crawl_runs SET status = 'running', started_at = COALESCE(started_at, $2),
         heartbeat_at = $2, updated_at = $2 WHERE id = $1 AND status IN ('queued', 'interrupted')`,
      [runId, now],
    );
    return mapMission(claimed.rows[0]);
  });

  const acquireAccountLease = async (
    runId: string,
    missionId: string,
    workerId: string,
    purpose: "mutation" | "authentication",
    now: Date,
    leaseMs: number,
  ): Promise<boolean> => {
    const worker = nonEmpty(workerId, "Worker id");
    const result = await deps.query(
      `INSERT INTO crawl_account_leases
         (run_id, purpose, mission_id, worker_id, heartbeat_at, lease_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id, purpose) DO UPDATE SET
         mission_id = EXCLUDED.mission_id, worker_id = EXCLUDED.worker_id,
         heartbeat_at = EXCLUDED.heartbeat_at, lease_expires_at = EXCLUDED.lease_expires_at
       WHERE crawl_account_leases.lease_expires_at <= $5
          OR crawl_account_leases.worker_id = EXCLUDED.worker_id
       RETURNING run_id`,
      [runId, purpose, missionId, worker, now, expiry(now, leaseMs)],
    );
    return Boolean(result.rowCount);
  };

  const saveDossier = (runId: string, value: AppDossier): Promise<CrawlDossierRecord> => deps.withTransaction(async (client) => {
    const dossier = parseAppDossier(value);
    const serialized = JSON.stringify(dossier);
    const contentHash = createHash("sha256").update(serialized).digest("hex");
    const run = await client.query(
      "SELECT 1 FROM crawl_runs WHERE id = $1 AND run_kind = 'autonomous' FOR UPDATE",
      [runId],
    );
    if (!run.rowCount) throw new Error("Autonomous run not found");
    const existing = await client.query<DossierRow>(
      "SELECT * FROM crawl_dossiers WHERE run_id = $1 AND content_hash = $2",
      [runId, contentHash],
    );
    if (existing.rowCount) return mapDossier(existing.rows[0]);
    const saved = await client.query<DossierRow>(
      `INSERT INTO crawl_dossiers (run_id, revision, dossier, content_hash)
       SELECT $1, COALESCE(MAX(revision), 0) + 1, $2::jsonb, $3
       FROM crawl_dossiers WHERE run_id = $1
       RETURNING *`,
      [runId, serialized, contentHash],
    );
    return mapDossier(saved.rows[0]);
  });

  const latestDossier = async (runId: string): Promise<CrawlDossierRecord | undefined> => {
    const result = await deps.query<DossierRow>(
      "SELECT * FROM crawl_dossiers WHERE run_id = $1 ORDER BY revision DESC LIMIT 1",
      [runId],
    );
    return result.rows[0] ? mapDossier(result.rows[0]) : undefined;
  };

  const heartbeatMission = async (missionId: string, workerId: string, now: Date, leaseMs: number): Promise<void> => {
    const worker = nonEmpty(workerId, "Worker id");
    const result = await deps.query(
      `UPDATE crawl_missions SET heartbeat_at = $3, lease_expires_at = $4, updated_at = $3
       WHERE id = $1 AND worker_id = $2 AND status = 'running'`,
      [missionId, worker, now, expiry(now, leaseMs)],
    );
    if (!result.rowCount) throw new Error("Mission is not owned by this worker");
  };

  const finishMission = async (
    missionId: string,
    workerId: string,
    status: Extract<MissionStatus, "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled">,
    result: unknown,
  ): Promise<void> => {
    if (!["succeeded", "blocked", "failed", "interrupted", "cancelled"].includes(status)) {
      throw new Error("Mission terminal status is invalid");
    }
    const serialized = JSON.stringify(result ?? null);
    const updated = await deps.query(
      `UPDATE crawl_missions SET status = $3, result = $4::jsonb, worker_id = NULL,
         heartbeat_at = NULL, lease_expires_at = NULL, updated_at = now()
       WHERE id = $1 AND worker_id = $2 AND status = 'running'`,
      [missionId, nonEmpty(workerId, "Worker id"), status, serialized],
    );
    if (!updated.rowCount) throw new Error("Mission is not owned by this worker");
  };

  const heartbeatAccountLease = async (
    runId: string,
    workerId: string,
    purpose: "mutation" | "authentication",
    now: Date,
    leaseMs: number,
  ): Promise<void> => {
    const updated = await deps.query(
      `UPDATE crawl_account_leases SET heartbeat_at = $4, lease_expires_at = $5
       WHERE run_id = $1 AND purpose = $2 AND worker_id = $3`,
      [runId, purpose, nonEmpty(workerId, "Worker id"), now, expiry(now, leaseMs)],
    );
    if (!updated.rowCount) throw new Error("Account lease is not owned by this worker");
  };

  const releaseAccountLease = async (
    runId: string,
    workerId: string,
    purpose: "mutation" | "authentication",
  ): Promise<void> => {
    const removed = await deps.query(
      "DELETE FROM crawl_account_leases WHERE run_id = $1 AND purpose = $2 AND worker_id = $3",
      [runId, purpose, nonEmpty(workerId, "Worker id")],
    );
    if (!removed.rowCount) throw new Error("Account lease is not owned by this worker");
  };

  const upsertState = async (runId: string, state: AutonomousState, evidenceId?: string): Promise<CrawlStateRecord> => {
    const saved = await deps.query<StateRow>(
      `INSERT INTO crawl_states
         (run_id, state_key, platform, account_state_version, normalized_url, label,
          product_area, fingerprint, evidence_id)
       SELECT cr.id, $2, cr.platform, $3, $4, $5, $6, $7::jsonb, $8
       FROM crawl_runs cr WHERE cr.id = $1 AND cr.run_kind = 'autonomous'
       ON CONFLICT (run_id, state_key) DO UPDATE SET
         account_state_version = EXCLUDED.account_state_version,
         normalized_url = EXCLUDED.normalized_url, label = EXCLUDED.label,
         product_area = EXCLUDED.product_area, fingerprint = EXCLUDED.fingerprint,
         evidence_id = COALESCE(EXCLUDED.evidence_id, crawl_states.evidence_id),
         last_seen_at = now()
       RETURNING *`,
      [runId, state.stateKey, state.accountStateVersion, state.normalizedUrl, state.label, state.productArea, JSON.stringify(state.fingerprint), evidenceId ?? null],
    );
    if (!saved.rowCount) throw new Error("Autonomous run not found");
    return mapState(saved.rows[0]);
  };

  const recordTransition = async (input: RecordTransitionInput): Promise<CrawlTransitionRecord> => {
    if (input.mode !== "read" && input.mode !== "mutate") throw new Error("Transition mode is invalid");
    if (!["completed", "failed", "blocked"].includes(input.outcome)) throw new Error("Transition outcome is invalid");
    if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error("Transition confidence is invalid");
    const recorded = await deps.query<CrawlTransitionRecord>(
      `INSERT INTO crawl_transitions
         (run_id, mission_id, child_run_id, source_state_id, destination_state_id,
          action, mode, outcome, confidence)
       SELECT $1, cm.id, $3, $4, $5, $6::jsonb, $7, $8, $9
       FROM crawl_missions cm WHERE cm.id = $2 AND cm.run_id = $1
       RETURNING *`,
      [
        input.runId,
        input.missionId,
        input.childRunId ?? null,
        input.sourceStateId ?? null,
        input.destinationStateId ?? null,
        JSON.stringify(input.action),
        input.mode,
        input.outcome,
        input.confidence,
      ],
    );
    if (!recorded.rowCount) throw new Error("Transition mission does not belong to the autonomous run");
    return recorded.rows[0];
  };

  const autonomousRunDetail = async (runId: string): Promise<AutonomousRunDetail | undefined> => {
    const run = await deps.query<CrawlRunRecord>(
      `${runSelect} WHERE cr.id = $1 AND cr.run_kind = 'autonomous'`,
      [runId],
    );
    if (!run.rowCount) return undefined;
    const [dossier, missions, states, transitions] = await Promise.all([
      latestDossier(runId),
      deps.query<MissionRow>("SELECT * FROM crawl_missions WHERE run_id = $1 ORDER BY priority DESC, id", [runId]),
      deps.query<StateRow>("SELECT * FROM crawl_states WHERE run_id = $1 ORDER BY first_seen_at, id", [runId]),
      deps.query<CrawlTransitionRecord>("SELECT * FROM crawl_transitions WHERE run_id = $1 ORDER BY id", [runId]),
    ]);
    return {
      run: run.rows[0],
      dossier,
      missions: missions.rows.map(mapMission),
      states: states.rows.map(mapState),
      transitions: transitions.rows,
    };
  };

  const requestPause = async (runId: string): Promise<void> => {
    const updated = await deps.query(
      `UPDATE crawl_runs SET pause_requested_at = now(), status = 'interrupted',
         environment = environment || '{"reason":"paused"}'::jsonb, updated_at = now()
       WHERE id = $1 AND run_kind = 'autonomous'`,
      [runId],
    );
    if (!updated.rowCount) throw new Error("Autonomous run not found");
  };

  const clearPause = (runId: string): Promise<void> => deps.withTransaction(async (client) => {
    const resumed = await client.query(
      `UPDATE crawl_runs SET pause_requested_at = NULL, status = 'queued', finished_at = NULL,
         environment = environment - 'reason', updated_at = now()
       WHERE id = $1 AND run_kind = 'autonomous' RETURNING id`,
      [runId],
    );
    if (!resumed.rowCount) throw new Error("Autonomous run not found");
    await client.query(
      `UPDATE crawl_missions SET status = 'queued', worker_id = NULL, heartbeat_at = NULL,
         lease_expires_at = NULL, updated_at = now()
       WHERE run_id = $1 AND status IN ('running', 'interrupted')`,
      [runId],
    );
  });

  return {
    createAutonomousRun,
    saveDossier,
    latestDossier,
    saveMissions,
    claimMission,
    heartbeatMission,
    finishMission,
    acquireAccountLease,
    heartbeatAccountLease,
    releaseAccountLease,
    upsertState,
    recordTransition,
    autonomousRunDetail,
    requestPause,
    clearPause,
  };
}
