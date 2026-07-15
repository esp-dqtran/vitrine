import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { researchDossier } from "./autonomousResearch.ts";
import { planInitialMissions } from "./autonomousPlanner.ts";
import { observePage } from "./autonomousAgent.ts";
import { createAutonomousOrchestrator, type AutonomousCoverage, type OrchestratedMission } from "./autonomousOrchestrator.ts";
import { finalizeAutonomousFlows } from "./autonomousGraph.ts";
import type { AppDossier, AutonomousMission } from "./autonomousCrawler.ts";
import type { DesignFlow } from "./designSystem.ts";
import { concurrentMutationCount, startAutonomousFixture } from "../test/fixtures/autonomous-app/server.ts";

test("researches, delegates, recovers, and publishes autonomous flows", async (t) => {
  const fixture = await startAutonomousFixture();
  const browser = await chromium.launch();
  t.after(async () => { await browser.close(); await fixture.close(); });
  const sourceUrls = ["https://fixture.example/docs", "https://fixture.example/docs/workflows"];
  const flowSpecs = [
    ["navigate-items", "Navigate items", "read"],
    ["search-items", "Search items", "read"],
    ["share-item", "Share item", "read"],
    ["create-item", "Create item", "mutate"],
    ["edit-item", "Edit item", "mutate"],
  ] as const;
  const sessions = flowSpecs.map(([id, title, mode], index) => ({
    ask: async () => JSON.stringify({
      sourceCandidates: sourceUrls,
      claims: [{ text: `${title} is documented`, sourceUrls: [sourceUrls[index % 2]], confidence: 0.95 }],
      candidateFlows: [{ id, title, goal: title, productArea: "Items", mode, prerequisites: [], sourceUrls: [sourceUrls[index % 2]] }],
      roles: ["member"], capabilities: [id], openQuestions: [],
    }),
    close: async () => {},
  }));
  let dossier: AppDossier | undefined;
  type Mission = OrchestratedMission & AutonomousMission & { run_id: string; missionKey: string; goal: string; productArea: string; result: unknown };
  const missions: Mission[] = [];
  const states: Array<Record<string, unknown>> = [];
  const transitions: Array<Record<string, unknown>> = [];
  const evidenceObjects = new Map<string, Uint8Array>();
  const verifiedEvidenceIds = new Set<string>();
  let evidenceId = 100;
  let lastCoverageSize = 0;
  let sessionValid = true;
  let successfulMissions = 0;
  let sessionRecoveries = 0;
  let published: DesignFlow[] = [];

  const orchestrator = createAutonomousOrchestrator({
    claimParent: async (id) => ({ id, environment: { agentConcurrency: 3, researchConcurrency: 5, heartbeatIntervalMs: 100 } }),
    startAgentPool: async () => ({ close: async () => {} }),
    ensureDossier: async () => {
      dossier = await researchDossier({ app: "fixture", homepageUrl: fixture.url }, {
        sessions,
        collectResearchPages: async () => sourceUrls.map((url) => ({ url, text: `Fixture documentation at ${url}` })),
        fetchAndVerifySources: async (urls) => urls.map((url) => ({ url, title: url.endsWith("workflows") ? "Workflows" : "Fixture docs", retrievedAt: "2026-07-16T00:00:00.000Z", text: "Verified fixture documentation" })),
      });
      return dossier;
    },
    ensureInitialMissions: async (_parent, value) => {
      for (const planned of planInitialMissions(value as AppDossier, true)) missions.push({ ...planned, id: String(missions.length + 1), run_id: "1", status: "queued", result: { sourceUrls } });
    },
    claimMission: async (_runId, workerId) => {
      const mission = missions.find(({ status }) => status === "queued" || status === "interrupted");
      if (!mission) return undefined;
      mission.status = "running";
      mission.workerId = workerId;
      return mission;
    },
    heartbeatMission: async () => {},
    acquireMutationLease: async () => true,
    releaseMutationLease: async () => {},
    isCancelled: async () => false,
    executeMission: async (claimed, workerId) => {
      const mission = claimed as Mission;
      const context = await browser.newContext();
      try {
        if (sessionValid) await context.addCookies([{ name: "fixture_session", value: "valid", url: fixture.url }]);
        const page = await context.newPage();
        const route = mission.missionKey.includes("create") ? "/items/new"
          : mission.missionKey.includes("edit") ? "/items/1/edit"
            : mission.missionKey.includes("search") ? "/search"
              : mission.missionKey.includes("share") ? "/items/1/share" : "/items";
        await page.goto(`${fixture.url}${route}`, { waitUntil: "domcontentloaded" });
        const observation = await observePage(page);
        if (/\/login$/.test(new URL(observation.url).pathname)) {
          sessionValid = true;
          sessionRecoveries++;
          return { status: "interrupted" as const, checkpoint: { reason: "authentication_required", workerId } };
        }
        if (mission.mode === "mutate") {
          await fetch(`${fixture.url}/events/mutation-start?actor=${workerId}`);
          await new Promise((resolve) => setTimeout(resolve, 15));
          await fetch(`${fixture.url}/events/mutation-end?actor=${workerId}`);
        }
        const png = await page.screenshot();
        const sourceEvidenceId = String(++evidenceId);
        const destinationEvidenceId = String(++evidenceId);
        evidenceObjects.set(sourceEvidenceId, png);
        evidenceObjects.set(destinationEvidenceId, png);
        verifiedEvidenceIds.add(sourceEvidenceId);
        verifiedEvidenceIds.add(destinationEvidenceId);
        const sourceStateId = `${mission.id}-source`;
        const destinationStateId = `${mission.id}-destination`;
        const makeState = (id: string, label: string, evidence: string, suffix: string) => ({
          id, run_id: "1", platform: "web", evidence_id: evidence, stateKey: id,
          normalizedUrl: observation.url, label, productArea: mission.productArea, accountStateVersion: sessionRecoveries + 1,
          fingerprint: { domHash: createHash("sha256").update(`${observation.domHash}:${suffix}`).digest("hex"), screenshotHash: observation.screenshotHash, landmarks: observation.landmarks, title: observation.title },
        });
        states.push(makeState(sourceStateId, observation.title || mission.goal, sourceEvidenceId, "source"));
        states.push(makeState(destinationStateId, `${mission.goal} complete`, destinationEvidenceId, "destination"));
        transitions.push({
          id: `${mission.id}-transition`, run_id: "1", mission_id: mission.id, child_run_id: `${mission.id}0`,
          source_state_id: sourceStateId, destination_state_id: destinationStateId,
          action: { action: "waitFor", expectedState: mission.goal }, mode: mission.mode, outcome: "completed", confidence: 0.95,
        });
        successfulMissions++;
        if (successfulMissions === 1) sessionValid = false;
        return { status: "succeeded" as const, checkpoint: { states: [sourceStateId, destinationStateId] } };
      } finally {
        await context.close();
      }
    },
    saveCheckpoint: async () => {},
    finishMission: async (claimed, _workerId, result) => { (claimed as Mission).status = result.status; },
    scheduleFollowups: async () => {},
    coverage: async (): Promise<AutonomousCoverage> => {
      const size = states.length + transitions.length;
      const growth = size - lastCoverageSize;
      lastCoverageSize = size;
      return {
        growth,
        queued: missions.filter(({ status }) => status === "queued").length,
        running: missions.filter(({ status }) => status === "running").length,
        recoverable: missions.filter(({ status }) => status === "interrupted").length,
        liveAccountLease: false, unansweredHighValue: 0,
        terminalFailures: missions.filter(({ status }) => status === "failed").length,
        hasRecovery: false, ceilingReached: false, cancelled: false,
      };
    },
    finalize: async (runId, status) => {
      if (status === "succeeded") {
        const finalized = await finalizeAutonomousFlows(runId, {
          loadFinalization: async () => ({ runId, app: "fixture", platform: "web", versionId: 1, createdBy: 1, missions: missions as never, states: states as never, transitions: transitions as never, verifiedEvidenceIds }),
          verifyEvidence: async (flows) => ({
            valid: flows.filter((flow) => flow.steps.every((step) => step.evidence.every((id) => evidenceObjects.has(String(id))))),
            invalid: [],
          }),
          saveValidatedFlows: async (_id, flows) => { published = flows; return flows; },
          analyzeCapturedScreens: async () => {}, ensureDesignSystem: async () => {},
          getVersionPublicationBlockers: async () => [], submitVersionForReview: async () => {}, publishVersion: async () => {},
        });
        published = finalized.published;
      }
      return { runId, status, dossier: dossier!, missions, flows: published };
    },
  });

  const completed = await orchestrator.run("1");
  assert.equal(completed.status, "succeeded");
  assert.ok(completed.dossier.sources.length >= 2);
  assert.ok(completed.missions.filter(({ status }) => status === "succeeded").length >= 5);
  assert.ok(sessionRecoveries >= 1);
  assert.equal(concurrentMutationCount(fixture.events), 1);
  assert.ok(completed.flows.some(({ title }) => /create item/i.test(title)));
  assert.ok(completed.flows.every((flow) => flow.steps.every((step) => step.evidence.length > 0)));
});
