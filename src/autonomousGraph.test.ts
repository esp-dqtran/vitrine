import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleGraphFlowCandidates, assembleGraphFlows, normalizeAutonomousUrl, stateKey } from "./autonomousGraph.ts";

const completedMission = {
  id: "mission-1",
  run_id: "1",
  mission_key: "create-item",
  missionKey: "create-item",
  goal: "Create an item",
  product_area: "Items",
  productArea: "Items",
  mode: "mutate" as const,
  status: "succeeded" as const,
  prerequisites: [],
  budget: { actions: 5, recoveries: 1 },
  worker_id: null,
  heartbeat_at: null,
  lease_expires_at: null,
  checkpoint: null,
  result: { sourceUrls: ["https://docs.app.test/items"] },
};

const states = [
  state("state-1", "Items", "10", 1),
  state("state-2", "Create item", "11", 1),
  state("state-3", "Item created", "12", 1),
];

const transitions = [
  transition("transition-1", "state-1", "state-2", 0.94),
  transition("transition-2", "state-2", "state-3", 0.91),
];

function state(id: string, label: string, evidenceId: string | null, accountStateVersion: number) {
  return {
    id,
    run_id: "1",
    platform: "web",
    evidence_id: evidenceId,
    stateKey: id,
    normalizedUrl: `https://app.test/${id}`,
    label,
    productArea: "Items",
    accountStateVersion,
    fingerprint: { domHash: id, screenshotHash: id, landmarks: [label], title: label },
  };
}

function transition(id: string, sourceStateId: string, destinationStateId: string, confidence: number) {
  return {
    id,
    run_id: "1",
    mission_id: "mission-1",
    child_run_id: null,
    source_state_id: sourceStateId,
    destination_state_id: destinationStateId,
    action: { kind: "click" },
    mode: "mutate" as const,
    outcome: "completed" as const,
    confidence,
  };
}

test("normalizes tracking parameters without changing meaningful query state", () => {
  assert.equal(
    normalizeAutonomousUrl("https://app.test/items?utm_source=x&view=grid&sort=name#dialog"),
    "https://app.test/items?sort=name&view=grid",
  );
});

test("distinguishes modal states on the same URL", () => {
  const base = stateKey({ normalizedUrl: "https://app.test/items", title: "Items", landmarks: ["Items", "New"], domHash: "a", screenshotHash: "1", accountStateVersion: 1 });
  const modal = stateKey({ normalizedUrl: "https://app.test/items", title: "Items", landmarks: ["Create item", "Save"], domHash: "b", screenshotHash: "2", accountStateVersion: 1 });
  assert.notEqual(base, modal);
});

test("assembles one ordered flow from a successful coherent path", () => {
  const flows = assembleGraphFlows({
    runId: "1",
    platform: "web",
    missions: [completedMission],
    states,
    transitions,
    verifiedEvidenceIds: new Set(["10", "11", "12"]),
  });
  assert.deepEqual(flows[0].steps.map(({ label, evidence }) => ({ label, evidence })), [
    { label: "Items", evidence: [10] },
    { label: "Create item", evidence: [11] },
    { label: "Item created", evidence: [12] },
  ]);
  assert.deepEqual(flows[0].provenance, {
    autonomousRunId: "1",
    missionId: "mission-1",
    confidence: 0.91,
    sourceUrls: ["https://docs.app.test/items"],
    validationStatus: "complete",
  });
});

test("returns rejected candidates separately with exact validation reasons", () => {
  const result = assembleGraphFlowCandidates({
    runId: "1",
    platform: "web",
    missions: [completedMission],
    states: [states[0], { ...states[1], evidence_id: null }],
    transitions: [transition("transition-1", "state-1", "state-2", 0.7), transition("transition-2", "state-2", "state-1", 0.7)],
    verifiedEvidenceIds: new Set(["10"]),
  });
  assert.equal(result.flows.length, 0);
  assert.deepEqual(result.rejected[0].reasons, [
    "state state-2 has no verified destination evidence",
    "path repeats state state-1",
    "confidence 0.7 is below 0.85",
  ]);
  assert.equal(result.rejected[0].flow.provenance?.validationStatus, "incomplete");
});
