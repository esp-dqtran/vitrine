export type AutonomousFinalDecision = "succeeded" | "interrupted" | "cancelled" | "failed";

export interface OrchestratedMission {
  id: string;
  mode: "read" | "mutate";
  status: "queued" | "running" | "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled";
  workerId?: string;
}

export interface OrchestratedParent {
  id: string;
  environment: {
    agentConcurrency?: number;
    researchConcurrency?: number;
    heartbeatIntervalMs?: number;
  };
}

export interface MissionExecutionResult {
  status: Extract<OrchestratedMission["status"], "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled">;
  checkpoint: unknown;
}

export interface AutonomousCoverage {
  growth: number;
  queued: number;
  running: number;
  recoverable: number;
  liveAccountLease: boolean;
  unansweredHighValue: number;
  terminalFailures: number;
  hasRecovery: boolean;
  ceilingReached: boolean;
  cancelled: boolean;
}

export interface AutonomousRunSummary {
  runId: string;
  status: AutonomousFinalDecision;
  [key: string]: unknown;
}

interface AgentPool {
  close(): Promise<void>;
}

export interface AutonomousOrchestratorDependencies<T extends AutonomousRunSummary = AutonomousRunSummary> {
  claimParent(runId: string): Promise<OrchestratedParent>;
  ensureDossier(parent: OrchestratedParent): Promise<unknown>;
  ensureInitialMissions(parent: OrchestratedParent, dossier: unknown): Promise<void>;
  startAgentPool(kind: "research" | "discovery", size: number): Promise<AgentPool>;
  claimMission(runId: string, workerId: string): Promise<OrchestratedMission | undefined>;
  heartbeatMission(mission: OrchestratedMission, workerId: string): Promise<void>;
  executeMission(mission: OrchestratedMission, workerId: string): Promise<MissionExecutionResult>;
  saveCheckpoint(mission: OrchestratedMission, workerId: string, checkpoint: unknown): Promise<void>;
  finishMission(mission: OrchestratedMission, workerId: string, result: MissionExecutionResult): Promise<void>;
  acquireMutationLease(runId: string, missionId: string, workerId: string): Promise<boolean>;
  releaseMutationLease(runId: string, workerId: string): Promise<void>;
  isCancelled(runId: string): Promise<boolean>;
  scheduleFollowups(parent: OrchestratedParent, dossier: unknown): Promise<void>;
  coverage(runId: string): Promise<AutonomousCoverage>;
  finalize(runId: string, decision: AutonomousFinalDecision, partialSummary: { coverage: AutonomousCoverage; zeroGrowthRounds: number }): Promise<T>;
}

function boundedConcurrency(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) ? Math.max(1, Math.min(8, value!)) : fallback;
}

function mutationGate() {
  let tail = Promise.resolve();
  return async <T>(work: () => Promise<T>): Promise<T> => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
}

export function decideAutonomousCoverage(coverage: AutonomousCoverage, zeroGrowthRounds: number): "continue" | AutonomousFinalDecision {
  if (coverage.cancelled) return "cancelled";
  if (coverage.ceilingReached) return "interrupted";
  if (coverage.terminalFailures > 0 && !coverage.hasRecovery) return "failed";
  if (
    zeroGrowthRounds >= 2
    && coverage.queued === 0
    && coverage.running === 0
    && coverage.recoverable === 0
    && !coverage.liveAccountLease
    && coverage.unansweredHighValue === 0
    && coverage.terminalFailures === 0
  ) return "succeeded";
  return "continue";
}

export function createAutonomousOrchestrator<T extends AutonomousRunSummary>(dependencies: AutonomousOrchestratorDependencies<T>) {
  return {
    async run(runId: string): Promise<T> {
      const parent = await dependencies.claimParent(runId);
      if (parent.id !== runId) throw new Error("Claimed autonomous parent does not match the requested run");
      const agentConcurrency = boundedConcurrency(parent.environment.agentConcurrency, 3);
      const researchConcurrency = boundedConcurrency(parent.environment.researchConcurrency, 2);
      const heartbeatIntervalMs = Math.max(50, parent.environment.heartbeatIntervalMs ?? 10_000);
      const researchPool = await dependencies.startAgentPool("research", researchConcurrency);
      const discoveryPool = await dependencies.startAgentPool("discovery", agentConcurrency);
      const withMutationLease = mutationGate();
      let zeroGrowthRounds = 0;
      let lastCoverage: AutonomousCoverage | undefined;

      const executeOne = async (mission: OrchestratedMission, workerId: string): Promise<void> => {
        if (await dependencies.isCancelled(runId)) {
          const result: MissionExecutionResult = { status: "cancelled", checkpoint: { reason: "parent_cancelled" } };
          await dependencies.saveCheckpoint(mission, workerId, result.checkpoint);
          await dependencies.finishMission(mission, workerId, result);
          return;
        }
        await dependencies.heartbeatMission(mission, workerId);
        const timer = setInterval(() => void dependencies.heartbeatMission(mission, workerId), heartbeatIntervalMs);
        timer.unref?.();
        try {
          const result = await dependencies.executeMission(mission, workerId);
          await dependencies.saveCheckpoint(mission, workerId, result.checkpoint);
          await dependencies.finishMission(mission, workerId, result);
        } catch (error) {
          const result: MissionExecutionResult = {
            status: "interrupted",
            checkpoint: { reason: "infrastructure_error", message: error instanceof Error ? error.message : String(error) },
          };
          await dependencies.saveCheckpoint(mission, workerId, result.checkpoint);
          await dependencies.finishMission(mission, workerId, result);
          throw error;
        } finally {
          clearInterval(timer);
        }
      };

      const runMission = async (mission: OrchestratedMission, workerId: string): Promise<void> => {
        if (mission.mode === "read") return executeOne(mission, workerId);
        return withMutationLease(async () => {
          const acquired = await dependencies.acquireMutationLease(runId, mission.id, workerId);
          if (!acquired) {
            const result: MissionExecutionResult = { status: "interrupted", checkpoint: { reason: "mutation_lease_unavailable" } };
            await dependencies.saveCheckpoint(mission, workerId, result.checkpoint);
            await dependencies.finishMission(mission, workerId, result);
            return;
          }
          try {
            await executeOne(mission, workerId);
          } finally {
            await dependencies.releaseMutationLease(runId, workerId);
          }
        });
      };

      try {
        const dossier = await dependencies.ensureDossier(parent);
        await dependencies.ensureInitialMissions(parent, dossier);
        while (true) {
          if (await dependencies.isCancelled(runId)) {
            const coverage = { ...(lastCoverage ?? await dependencies.coverage(runId)), cancelled: true };
            return dependencies.finalize(runId, "cancelled", { coverage, zeroGrowthRounds });
          }
          await Promise.all(Array.from({ length: agentConcurrency }, async (_, index) => {
            const workerId = `agent-${index + 1}`;
            while (!(await dependencies.isCancelled(runId))) {
              const mission = await dependencies.claimMission(runId, workerId);
              if (!mission) return;
              await runMission(mission, workerId);
            }
          }));
          await dependencies.scheduleFollowups(parent, dossier);
          const coverage = await dependencies.coverage(runId);
          lastCoverage = coverage;
          zeroGrowthRounds = coverage.growth === 0 ? zeroGrowthRounds + 1 : 0;
          const decision = decideAutonomousCoverage(coverage, zeroGrowthRounds);
          if (decision !== "continue") {
            return dependencies.finalize(runId, decision, { coverage, zeroGrowthRounds });
          }
        }
      } finally {
        await discoveryPool.close();
        await researchPool.close();
      }
    },
  };
}
