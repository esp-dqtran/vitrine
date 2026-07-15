import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { collectResearchPages, extractJson, fetchAndVerifyResearchSources } from "./appResearch.ts";
import { executeAgentEpisode, isAuthenticationObservation, observePage, type AgentDecision } from "./autonomousAgent.ts";
import { type AppDossier } from "./autonomousCrawler.ts";
import { finalizeAutonomousFlows } from "./autonomousGraph.ts";
import { createAutonomousOrchestrator, type AutonomousCoverage, type AutonomousRunSummary, type OrchestratedMission } from "./autonomousOrchestrator.ts";
import { planInitialMissions } from "./autonomousPlanner.ts";
import { researchDossier } from "./autonomousResearch.ts";
import { createAutonomousStore, type CrawlMissionRecord } from "./autonomousStore.ts";
import { caption } from "./caption.ts";
import type { CrawlRunService } from "./crawlRun.ts";
import {
  createAutonomousChildRun,
  listRunEvidence,
  saveAutonomousEpisodePlan,
} from "./crawlStore.ts";
import {
  getVersionPublicationBlockers,
  publishAppVersion,
  query,
  submitAppVersionForReview,
} from "./db.ts";
import { decryptStorageState } from "./crawlSession.ts";
import { startChatPool, type ChatSession } from "./llmChat.ts";
import { imageObjectById } from "./objectStoreDb.ts";
import type { ObjectStore } from "./objectStore.ts";
import { synthesize } from "./synthesize.ts";

interface WorkerParent {
  id: string;
  app: string;
  platform: string;
  versionId: number;
  allowAll: boolean;
  createdBy: number;
  homepageUrl: string;
  provider: string;
  requiredSecrets: string[];
  environment: { agentConcurrency: number; researchConcurrency: number; heartbeatIntervalMs: number };
}

export interface ProductionAutonomousOrchestratorOptions {
  workerId: string;
  objectStore: ObjectStore;
  crawlRunService: Pick<CrawlRunService, "execute">;
  sessionEncryptionKey?: string;
  startPool?: typeof startChatPool;
}

function decisionPrompt(mission: CrawlMissionRecord, observation: Awaited<ReturnType<typeof observePage>>): string {
  return `You are one bounded application discovery agent. Choose one to five actions that advance this mission without inventing controls.
Mission: ${mission.goal}
Mode: ${mission.mode}
Current observation: ${JSON.stringify(observation)}

Return raw JSON: either one object or an array of at most five objects. Each object uses:
{"action":"goto|click|fill|press|waitFor","role":"button","name":"Accessible name","url":"optional","key":"optional","value":"ordinary text or exact $SECRET_NAME","expectedState":"label","expectedUrl":"optional absolute URL","expectedVisible":{"role":"heading","name":"Accessible name"},"expectedPage":"same|new","mode":"${mission.mode}"}
Use exactly one locator (role+name, text, or css) for click/fill/waitFor. Every action needs an expected URL or visible locator. Never include credential values.`;
}

function authenticationPrompt(
  mission: CrawlMissionRecord,
  observation: Awaited<ReturnType<typeof observePage>>,
  requiredSecrets: string[],
): string {
  return `You are the serialized authentication agent for one shared test account. Produce one to five actions that complete sign-in from the observed page.
Mission: ${mission.goal}
Current observation: ${JSON.stringify(observation)}
Allowed named secret references: ${requiredSecrets.map((name) => `$${name}`).join(", ") || "none"}

Return raw JSON using the same action schema as a discovery episode. Fill values must be an allowed exact $SECRET_NAME reference. Never return credential values. Every step needs an observable expected state. Do not navigate outside the current app origin.`;
}

function parseDecision(reply: string, mode: "read" | "mutate"): AgentDecision | AgentDecision[] {
  const parsed = JSON.parse(extractJson(reply)) as unknown;
  const values = Array.isArray(parsed) ? parsed : [parsed];
  if (values.length < 1 || values.length > 5 || values.some((value) => !value || typeof value !== "object" || Array.isArray(value))) {
    throw new Error("Discovery decision must contain one to five action objects");
  }
  const decisions = values.map((value) => ({ ...(value as Record<string, unknown>), mode })) as unknown as AgentDecision[];
  return Array.isArray(parsed) ? decisions : decisions[0];
}

export function createProductionAutonomousOrchestrator(options: ProductionAutonomousOrchestratorOptions) {
  const store = createAutonomousStore();
  const pools = new Map<"research" | "discovery", ChatSession[]>();
  const parentById = new Map<string, WorkerParent>();
  const coverageSize = new Map<string, number>();
  let discoverySession = 0;
  const startPool = options.startPool ?? startChatPool;

  const orchestrator = createAutonomousOrchestrator<AutonomousRunSummary>({
    claimParent: async (runId) => {
      const detail = await store.autonomousRunDetail(runId);
      if (!detail) throw new Error("Autonomous run not found");
      if (["succeeded", "failed", "cancelled"].includes(detail.run.status)) {
        return {
          id: runId,
          environment: { agentConcurrency: 1, researchConcurrency: 1, heartbeatIntervalMs: 10_000 },
        };
      }
      const environment = detail.run.environment as unknown as Record<string, unknown>;
      const parent: WorkerParent = {
        id: runId,
        app: detail.run.app,
        platform: detail.run.platform,
        versionId: detail.run.version_id,
        allowAll: detail.run.allow_all,
        createdBy: Number(environment.createdBy),
        homepageUrl: String(environment.homepageUrl),
        provider: typeof environment.provider === "string" ? environment.provider : "chatgpt",
        requiredSecrets: Array.isArray(environment.requiredSecrets)
          ? environment.requiredSecrets.filter((name): name is string => typeof name === "string")
          : [],
        environment: {
          agentConcurrency: Number(environment.agentConcurrency) || 3,
          researchConcurrency: 5,
          heartbeatIntervalMs: 10_000,
        },
      };
      parentById.set(runId, parent);
      return parent;
    },
    startAgentPool: async (kind, size) => {
      const parent = [...parentById.values()].at(-1);
      if (!parent) throw new Error("Autonomous parent was not claimed before starting agent pools");
      const pool = await startPool(parent.provider, size);
      pools.set(kind, pool.sessions);
      return { close: pool.closeAll };
    },
    ensureDossier: async (claimed) => {
      const parent = claimed as WorkerParent;
      const existing = await store.latestDossier(parent.id);
      if (existing) return existing.dossier;
      const dossier = await researchDossier({ app: parent.app, homepageUrl: parent.homepageUrl }, {
        sessions: pools.get("research") ?? [],
        collectResearchPages,
        fetchAndVerifySources: fetchAndVerifyResearchSources,
      });
      return (await store.saveDossier(parent.id, dossier)).dossier;
    },
    ensureInitialMissions: async (claimed, dossier) => {
      const parent = claimed as WorkerParent;
      const detail = await store.autonomousRunDetail(parent.id);
      if (detail?.missions.length) return;
      await store.saveMissions(parent.id, planInitialMissions(dossier as AppDossier, parent.allowAll));
    },
    claimMission: (runId, workerId) => store.claimMission(runId, `${options.workerId}:${workerId}`, new Date(), 30_000) as Promise<OrchestratedMission | undefined>,
    heartbeatMission: (mission, workerId) => store.heartbeatMission(mission.id, `${options.workerId}:${workerId}`, new Date(), 30_000),
    acquireMutationLease: (runId, missionId, workerId) => store.acquireAccountLease(runId, missionId, `${options.workerId}:${workerId}`, "mutation", new Date(), 30_000),
    releaseMutationLease: (runId, workerId) => store.releaseAccountLease(runId, `${options.workerId}:${workerId}`, "mutation"),
    isCancelled: async (runId) => {
      const detail = await store.autonomousRunDetail(runId);
      return !detail || detail.run.status === "cancelled" || detail.run.cancel_requested_at !== null;
    },
    executeMission: async (claimed, workerId) => {
      const mission = claimed as CrawlMissionRecord;
      const parent = parentById.get(mission.run_id);
      if (!parent) throw new Error("Autonomous parent context is unavailable");
      const accountSession = await store.accountSession(parent.app);
      const storageState = accountSession && options.sessionEncryptionKey
        ? decryptStorageState(accountSession.encrypted_storage_state, options.sessionEncryptionKey)
        : undefined;
      const browser = await chromium.launch({ headless: true });
      let observation: Awaited<ReturnType<typeof observePage>>;
      try {
        const context = await browser.newContext(storageState ? { storageState } : undefined);
        const page = await context.newPage();
        await page.goto(parent.homepageUrl, { waitUntil: "domcontentloaded" });
        observation = await observePage(page);
        await context.close();
      } finally {
        await browser.close();
      }
      const sessions = pools.get("discovery") ?? [];
      if (!sessions.length) throw new Error("Discovery chat pool is unavailable");
      const session = sessions[discoverySession++ % sessions.length];
      const authenticationRequired = isAuthenticationObservation(observation);
      if (authenticationRequired) {
        if (!options.sessionEncryptionKey) {
          return { status: "blocked", checkpoint: { reason: "session_encryption_unavailable" } };
        }
        const authWorkerId = `${options.workerId}:${workerId}`;
        const acquired = await store.acquireAccountLease(parent.id, mission.id, authWorkerId, "authentication", new Date(), 30_000);
        if (!acquired) return { status: "interrupted", checkpoint: { reason: "authentication_lease_busy" } };
        try {
          const decision = parseDecision(
            await session.ask(authenticationPrompt(mission, observation, parent.requiredSecrets)),
            "read",
          );
          const episode = await executeAgentEpisode({
            app: parent.app,
            startUrl: parent.homepageUrl,
            parentRunId: parent.id,
            mission: {
              id: mission.id,
              missionKey: mission.missionKey,
              goal: `Authenticate shared account for ${mission.goal}`,
              productArea: "Account",
              mode: "read",
              prerequisites: mission.prerequisites,
              budget: mission.budget,
            },
            observation,
            decision,
            allowAll: parent.allowAll,
            recoverAuthentication: true,
            sourceUrls: (await store.latestDossier(parent.id))?.dossier.sources.map(({ url }) => url) ?? [],
          }, {
            saveAutonomousPlan: async (plan, parentRunId, missionId) => saveAutonomousEpisodePlan(plan, parentRunId, missionId),
            createChildRun: createAutonomousChildRun,
            executeRun: async (runId) => options.crawlRunService.execute(runId),
            readEpisodeResult: async (runId, missionId) => {
              const run = await query<{ status: string }>("SELECT status FROM crawl_runs WHERE id = $1", [runId]);
              return { runId, missionId, status: run.rows[0]?.status === "succeeded" ? "succeeded" as const : "failed" as const };
            },
            checkpointMission: async () => {},
            requestAuthenticationLease: async () => {},
          });
          if (episode.status !== "succeeded") {
            return { status: "blocked", checkpoint: { reason: "authentication_failed", childRunId: episode.runId } };
          }
          const refreshed = await store.accountSession(parent.app);
          return {
            status: "interrupted",
            checkpoint: { reason: "authentication_recovered", childRunId: episode.runId, sessionVersion: refreshed?.state_version ?? null },
          };
        } finally {
          await store.releaseAccountLease(parent.id, authWorkerId, "authentication");
        }
      }
      const decision = parseDecision(await session.ask(decisionPrompt(mission, observation)), mission.mode);
      let authenticationLeaseHeld = false;
      const episode = await executeAgentEpisode({
        app: parent.app,
        startUrl: parent.homepageUrl,
        parentRunId: parent.id,
        mission: {
          id: mission.id,
          missionKey: mission.missionKey,
          goal: mission.goal,
          productArea: mission.productArea,
          mode: mission.mode,
          prerequisites: mission.prerequisites,
          budget: mission.budget,
        },
        observation,
        decision,
        allowAll: parent.allowAll,
        sourceUrls: (await store.latestDossier(parent.id))?.dossier.sources.map(({ url }) => url) ?? [],
      }, {
        saveAutonomousPlan: async (plan, parentRunId, missionId) => saveAutonomousEpisodePlan(plan, parentRunId, missionId),
        createChildRun: createAutonomousChildRun,
        executeRun: async (runId) => options.crawlRunService.execute(runId),
        readEpisodeResult: async (runId, missionId) => {
          const run = await query<{ status: string }>("SELECT status FROM crawl_runs WHERE id = $1", [runId]);
          const status = run.rows[0]?.status;
          return { runId, missionId, status: status === "succeeded" ? "succeeded" as const : status === "cancelled" ? "blocked" as const : "failed" as const };
        },
        checkpointMission: async (missionId, checkpoint) => {
          await query("UPDATE crawl_missions SET checkpoint = $2::jsonb, updated_at = now() WHERE id = $1", [missionId, JSON.stringify(checkpoint)]);
        },
        requestAuthenticationLease: async (runId, missionId) => {
          authenticationLeaseHeld = await store.acquireAccountLease(runId, missionId, `${options.workerId}:${workerId}`, "authentication", new Date(), 30_000);
        },
      });
      if (episode.status === "authentication_required") {
        if (authenticationLeaseHeld) await store.releaseAccountLease(parent.id, `${options.workerId}:${workerId}`, "authentication");
        return { status: "blocked", checkpoint: { reason: "authentication_required", sessionVersion: accountSession?.state_version ?? null } };
      }
      if (episode.status !== "succeeded") return { status: episode.status === "blocked" ? "blocked" : "failed", checkpoint: { childRunId: episode.runId } };

      const evidence = await listRunEvidence(episode.runId);
      const item = evidence.at(-1);
      if (!item) return { status: "failed", checkpoint: { reason: "episode_produced_no_evidence", childRunId: episode.runId } };
      const sourceId = `${mission.id}:source`;
      const destinationId = `${mission.id}:destination`;
      const accountStateVersion = accountSession?.state_version ?? 1;
      const base = {
        normalizedUrl: item.final_url,
        productArea: mission.productArea,
        accountStateVersion,
        fingerprint: { domHash: createHash("sha256").update(`source:${item.screenshot_hash}`).digest("hex"), screenshotHash: item.screenshot_hash, landmarks: [item.state_label], title: item.state_label },
      };
      const source = await store.upsertState(parent.id, { ...base, stateKey: sourceId, label: observation.title || mission.goal }, item.id);
      const destination = await store.upsertState(parent.id, {
        ...base,
        stateKey: destinationId,
        label: item.state_label,
        fingerprint: { ...base.fingerprint, domHash: createHash("sha256").update(`destination:${item.screenshot_hash}`).digest("hex") },
      }, item.id);
      await store.recordTransition({
        runId: parent.id,
        missionId: mission.id,
        childRunId: episode.runId,
        sourceStateId: source.id,
        destinationStateId: destination.id,
        action: decision,
        mode: mission.mode,
        outcome: "completed",
        confidence: 0.9,
      });
      return { status: "succeeded", checkpoint: { childRunId: episode.runId, sourceStateId: source.id, destinationStateId: destination.id } };
    },
    saveCheckpoint: async (mission, workerId, checkpoint) => {
      await query(
        "UPDATE crawl_missions SET checkpoint = $3::jsonb, updated_at = now() WHERE id = $1 AND worker_id = $2",
        [mission.id, `${options.workerId}:${workerId}`, JSON.stringify(checkpoint)],
      );
    },
    finishMission: (mission, workerId, result) => store.finishMission(
      mission.id,
      `${options.workerId}:${workerId}`,
      result.status,
      result.checkpoint,
    ),
    scheduleFollowups: async () => {},
    coverage: async (runId): Promise<AutonomousCoverage> => {
      const counts = await query<{ queued: number; running: number; recoverable: number; terminal_failures: number; states: number; transitions: number; leases: number }>(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
          COUNT(*) FILTER (WHERE status = 'running')::int AS running,
          COUNT(*) FILTER (WHERE status = 'interrupted')::int AS recoverable,
          COUNT(*) FILTER (WHERE status IN ('failed','blocked'))::int AS terminal_failures,
          (SELECT COUNT(*)::int FROM crawl_states WHERE run_id = $1) AS states,
          (SELECT COUNT(*)::int FROM crawl_transitions WHERE run_id = $1) AS transitions,
          (SELECT COUNT(*)::int FROM crawl_account_leases WHERE run_id = $1 AND lease_expires_at > now()) AS leases
         FROM crawl_missions WHERE run_id = $1`,
        [runId],
      );
      const row = counts.rows[0];
      const size = row.states + row.transitions;
      const previous = coverageSize.get(runId) ?? 0;
      coverageSize.set(runId, size);
      const parent = parentById.get(runId);
      const detail = await store.autonomousRunDetail(runId);
      const environment = detail?.run.environment as unknown as Record<string, unknown> | undefined;
      const ceilings = environment?.ceilings as Record<string, unknown> | undefined;
      const runtimeMinutes = Number(ceilings?.runtimeMinutes);
      const started = detail?.run.started_at ? new Date(detail.run.started_at).getTime() : Date.now();
      return {
        growth: size - previous,
        queued: row.queued,
        running: row.running,
        recoverable: row.recoverable,
        liveAccountLease: row.leases > 0,
        unansweredHighValue: 0,
        terminalFailures: row.terminal_failures,
        hasRecovery: row.recoverable > 0,
        ceilingReached: Number.isFinite(runtimeMinutes) && (Date.now() - started) >= runtimeMinutes * 60_000,
        cancelled: !parent || detail?.run.status === "cancelled",
      };
    },
    finalize: async (runId, decision, partialSummary) => {
      const parent = parentById.get(runId);
      const detail = await store.autonomousRunDetail(runId);
      if (!parent || !detail) throw new Error("Autonomous finalization parent is unavailable");
      let publishedFlows = 0;
      let draftFlows = 0;
      let versionBlockers: unknown[] = [];
      if (decision === "succeeded") {
        const evidenceIds = new Set(detail.states.flatMap(({ evidence_id }) => evidence_id ? [evidence_id] : []));
        const result = await finalizeAutonomousFlows(runId, {
          loadFinalization: async () => ({
            runId, app: parent.app, platform: parent.platform, versionId: parent.versionId, createdBy: parent.createdBy,
            missions: detail.missions, states: detail.states, transitions: detail.transitions, verifiedEvidenceIds: evidenceIds,
          }),
          verifyEvidence: async (flows) => {
            const valid = [];
            const invalid = [];
            for (const flow of flows) {
              let blocker: string | undefined;
              for (const imageId of flow.steps.flatMap(({ evidence }) => evidence)) {
                const metadata = await imageObjectById(imageId);
                const head = metadata ? await options.objectStore.head(metadata.key) : undefined;
                if (!metadata || !head || head.sha256 !== metadata.sha256 || head.byteSize !== metadata.byteSize) {
                  blocker = "evidence_object_missing";
                  break;
                }
              }
              if (blocker) invalid.push({ flow, blockers: [blocker] });
              else valid.push(flow);
            }
            return { valid, invalid };
          },
          saveValidatedFlows: (id, flows) => store.saveAutonomousFlows(id, flows),
          analyzeCapturedScreens: async (app) => {
            await caption(parent.provider, undefined, app, { objectStore: options.objectStore, resolveObjectMetadata: (image) => imageObjectById(image.id) });
          },
          ensureDesignSystem: async (app, platform) => { await synthesize(app, platform, parent.provider); },
          getVersionPublicationBlockers,
          submitVersionForReview: submitAppVersionForReview,
          publishVersion: publishAppVersion,
        });
        publishedFlows = result.published.length;
        draftFlows = result.drafts.length;
        versionBlockers = result.versionBlockers;
      }
      await query(
        `UPDATE crawl_runs SET status = $2, worker_id = NULL, finished_at = now(),
           environment = environment || $3::jsonb, updated_at = now() WHERE id = $1 AND run_kind = 'autonomous'`,
        [runId, decision, JSON.stringify({ partialSummary, publishedFlows, draftFlows, versionBlockers })],
      );
      return { runId, status: decision, publishedFlows, draftFlows, versionBlockers };
    },
  });
  return {
    async run(runId: string): Promise<AutonomousRunSummary> {
      const detail = await store.autonomousRunDetail(runId);
      if (detail && ["succeeded", "failed", "cancelled"].includes(detail.run.status)) {
        return { runId, status: detail.run.status as "succeeded" | "failed" | "cancelled" };
      }
      return orchestrator.run(runId);
    },
  };
}
