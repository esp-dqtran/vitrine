import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAutonomousOrchestrator,
  decideAutonomousCoverage,
  type AutonomousOrchestratorDependencies,
  type OrchestratedMission,
} from "./autonomousOrchestrator.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

function mission(id: string, mode: "read" | "mutate", status: OrchestratedMission["status"] = "queued"): OrchestratedMission {
  return { id, mode, status };
}

function fixtureDependencies(initial: OrchestratedMission[]) {
  const missions = initial.map((value) => ({ ...value }));
  const pools: string[] = [];
  const checkpoints: string[] = [];
  const finalized: string[] = [];
  let coverageCalls = 0;
  const dependencies: AutonomousOrchestratorDependencies = {
    claimParent: async (id) => ({ id, environment: { agentConcurrency: 4, researchConcurrency: 2, heartbeatIntervalMs: 50 } }),
    ensureDossier: async () => ({ app: "fixture" }),
    ensureInitialMissions: async () => {},
    startAgentPool: async (kind, size) => { pools.push(`${kind}:${size}`); return { close: async () => { pools.push(`close:${kind}`); } }; },
    claimMission: async (_runId, workerId) => {
      const next = missions.find((item) => item.status === "queued" || item.status === "interrupted");
      if (!next) return undefined;
      next.status = "running";
      next.workerId = workerId;
      return { ...next };
    },
    heartbeatMission: async () => {},
    finishMission: async (claimed, workerId, result) => {
      const stored = missions.find(({ id }) => id === claimed.id)!;
      assert.equal(stored.workerId, workerId);
      stored.status = result.status;
      stored.workerId = undefined;
    },
    saveCheckpoint: async (claimed) => { checkpoints.push(claimed.id); },
    acquireMutationLease: async () => true,
    releaseMutationLease: async () => {},
    isCancelled: async () => false,
    executeMission: async (claimed) => ({ status: "succeeded", checkpoint: { missionId: claimed.id } }),
    scheduleFollowups: async () => {},
    coverage: async () => ({
      growth: 0,
      queued: missions.filter(({ status }) => status === "queued").length,
      running: missions.filter(({ status }) => status === "running").length,
      recoverable: missions.filter(({ status }) => status === "interrupted").length,
      liveAccountLease: false,
      unansweredHighValue: 0,
      terminalFailures: missions.filter(({ status }) => status === "failed").length,
      hasRecovery: false,
      ceilingReached: false,
      cancelled: false,
    }),
    finalize: async (_runId, decision) => { finalized.push(decision); return { runId: "parent-1", status: decision, missions: missions.map((value) => ({ ...value })) }; },
  };
  return { dependencies, missions, pools, checkpoints, finalized, coverageCalls: () => coverageCalls };
}

test("runs read missions concurrently and mutations under one lease", async () => {
  const fixture = fixtureDependencies([
    mission("read-1", "read"), mission("read-2", "read"), mission("mutate-1", "mutate"), mission("mutate-2", "mutate"),
  ]);
  const activeReads = new Set<string>();
  let maximumReads = 0;
  let activeMutations = 0;
  let maximumMutations = 0;
  let leases = 0;
  fixture.dependencies.acquireMutationLease = async () => { leases++; return true; };
  fixture.dependencies.executeMission = async (claimed) => {
    if (claimed.mode === "read") {
      activeReads.add(claimed.id);
      maximumReads = Math.max(maximumReads, activeReads.size);
      await tick();
      activeReads.delete(claimed.id);
    } else {
      activeMutations++;
      maximumMutations = Math.max(maximumMutations, activeMutations);
      await tick();
      activeMutations--;
    }
    return { status: "succeeded", checkpoint: { missionId: claimed.id } };
  };

  const result = await createAutonomousOrchestrator(fixture.dependencies).run("parent-1");
  assert.ok(maximumReads >= 2);
  assert.equal(maximumMutations, 1);
  assert.equal(leases, 2);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(fixture.pools, ["research:2", "discovery:4", "close:discovery", "close:research"]);
});

test("resumes interrupted missions and preserves completed graph work", async () => {
  const fixture = fixtureDependencies([mission("completed", "read", "succeeded"), mission("interrupted", "read", "interrupted")]);
  await createAutonomousOrchestrator(fixture.dependencies).run("parent-1");
  assert.equal(fixture.missions.find(({ id }) => id === "completed")?.status, "succeeded");
  assert.equal(fixture.missions.find(({ id }) => id === "interrupted")?.status, "succeeded");
  assert.deepEqual(fixture.checkpoints, ["interrupted"]);
});

test("requires two zero-growth rounds and maps terminal partial outcomes", () => {
  const complete = { growth: 0, queued: 0, running: 0, recoverable: 0, liveAccountLease: false, unansweredHighValue: 0, terminalFailures: 0, hasRecovery: false, ceilingReached: false, cancelled: false };
  assert.equal(decideAutonomousCoverage(complete, 1), "continue");
  assert.equal(decideAutonomousCoverage(complete, 2), "succeeded");
  assert.equal(decideAutonomousCoverage({ ...complete, ceilingReached: true }, 2), "interrupted");
  assert.equal(decideAutonomousCoverage({ ...complete, cancelled: true }, 2), "cancelled");
  assert.equal(decideAutonomousCoverage({ ...complete, terminalFailures: 1 }, 2), "failed");
  assert.equal(decideAutonomousCoverage({ ...complete, terminalFailures: 1, hasRecovery: true }, 2), "continue");
});
