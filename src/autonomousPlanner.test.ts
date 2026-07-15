import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppDossier } from "./autonomousCrawler.ts";
import { coverageDecision, planFollowupMissions, planInitialMissions } from "./autonomousPlanner.ts";

const dossier: AppDossier = {
  app: "linear",
  purpose: "Issue tracking",
  sources: [{ url: "https://linear.app/docs", title: "Docs", retrievedAt: "2026-07-16T00:00:00.000Z" }],
  claims: [{ text: "Teams manage issues", sourceUrls: ["https://linear.app/docs"], confidence: 0.9 }],
  roles: ["member"],
  capabilities: ["issues", "settings"],
  candidateFlows: [
    {
      id: "browse-issues", title: "Browse issues", goal: "Browse issues", productArea: "Issues",
      mode: "read", prerequisites: [], sourceUrls: ["https://linear.app/docs"],
    },
    {
      id: "delete-issue", title: "Delete issue", goal: "Delete an issue", productArea: "Issues",
      mode: "mutate", prerequisites: ["browse-issues"], sourceUrls: ["https://linear.app/docs"],
    },
  ],
  openQuestions: [],
};

test("creates app-specific missions and defers destructive work", () => {
  const missions = planInitialMissions(dossier, true);
  assert.equal(missions[0].missionKey, "authentication-and-navigation");
  assert.equal(missions.at(-1)?.mode, "mutate");
  assert.equal(new Set(missions.map(({ missionKey }) => missionKey)).size, missions.length);
  assert.equal(planInitialMissions(dossier, false).some(({ mode }) => mode === "mutate"), false);
});

test("requires two plateau rounds before deep crawl completion", () => {
  assert.equal(coverageDecision({ queued: 0, running: 0, recoverable: 0, unansweredHighValue: 0, newStates: 0, newTransitions: 0, plateauRounds: 1 }), "continue");
  assert.equal(coverageDecision({ queued: 0, running: 0, recoverable: 0, unansweredHighValue: 0, newStates: 0, newTransitions: 0, plateauRounds: 2 }), "complete");
  assert.equal(coverageDecision({ queued: 0, running: 0, recoverable: 0, unansweredHighValue: 0, newStates: 1, newTransitions: 0, plateauRounds: 2 }), "continue");
  assert.equal(coverageDecision({ queued: 1, running: 0, recoverable: 0, unansweredHighValue: 0, newStates: 0, newTransitions: 0, plateauRounds: 2, ceilingReached: true }), "partial");
});

test("accepts follow-up missions only for known capabilities", () => {
  const proposals = [{
    capabilityId: "settings",
    mission: {
      missionKey: "inspect-preferences",
      goal: "Inspect preferences",
      productArea: "Settings",
      mode: "read" as const,
      prerequisites: [],
      budget: { actions: 40, recoveries: 2 },
    },
  }];
  assert.deepEqual(
    planFollowupMissions(proposals, dossier, [], new Set(["already-planned"]), false).map(({ missionKey }) => missionKey),
    ["inspect-preferences"],
  );
  assert.throws(
    () => planFollowupMissions([{ ...proposals[0], capabilityId: "hallucinated" }], dossier, [], new Set(), false),
    /capability/i,
  );
  assert.deepEqual(
    planFollowupMissions([{ ...proposals[0], capabilityId: "observed-new" }], dossier, ["observed-new"], new Set(), false).length,
    1,
  );
});
