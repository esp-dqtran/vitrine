import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEpisodePlan,
  createOriginPolicy,
  executeAgentEpisode,
  observePage,
} from "./autonomousAgent.ts";

const mission = {
  id: "mission-1",
  missionKey: "inspect-items",
  goal: "Inspect the item creation flow",
  productArea: "Items",
  mode: "read" as const,
  prerequisites: [],
  budget: { actions: 5, recoveries: 1 },
};

const observation = {
  url: "https://app.test/items",
  title: "Items",
  landmarks: ["Items"],
  controls: [{ role: "button", name: "New item" }],
  screenshotHash: "screen-hash",
  domHash: "dom-hash",
};

test("turns one agent decision into a strict immutable one-flow plan", () => {
  const episode = buildEpisodePlan({
    app: "agent-app",
    startUrl: "https://app.test/items",
    mission,
    observation,
    allowAll: false,
    decision: {
      action: "click",
      role: "button",
      name: "New item",
      expectedState: "Create item",
      expectedVisible: { role: "heading", name: "Create item" },
      mode: "read",
    },
  });
  assert.equal(episode.flows.length, 1);
  assert.equal(episode.flows[0].steps[0].action, "click");
  assert.equal(episode.flows[0].steps[0].expected.page, "same");
  assert.equal(episode.reviewed, true);
  assert.equal(Object.isFrozen(episode.flows[0].steps[0]), true);
});

test("blocks unrelated and private-network navigation", () => {
  const policy = createOriginPolicy("https://app.test", ["https://auth.app.test"]);
  assert.equal(policy.allows("https://auth.app.test/login"), true);
  assert.equal(policy.allows("https://example.org"), false);
  assert.equal(policy.allows("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(policy.allows("http://[::1]/"), false);
});

test("requires allow_all for side effects and checks goto and expected origins", () => {
  assert.throws(() => buildEpisodePlan({
    app: "agent-app",
    startUrl: observation.url,
    mission: { ...mission, mode: "mutate" },
    observation,
    allowAll: false,
    decision: { action: "click", text: "Save", expectedState: "Saved", expectedVisible: { text: "Saved" }, mode: "mutate" },
  }), /allow_all/);
  assert.throws(() => buildEpisodePlan({
    app: "agent-app",
    startUrl: observation.url,
    mission,
    observation,
    allowAll: true,
    decision: { action: "goto", url: "https://example.org", expectedState: "Elsewhere", expectedUrl: "https://example.org", mode: "read" },
  }), /origin policy/);
});

test("observes bounded semantic page state and hashes the DOM and screenshot", async () => {
  const page = {
    locator: (selector: string) => selector === "body"
      ? { ariaSnapshot: async () => "- heading: Items" }
      : { evaluateAll: async () => [{ role: "button", name: "New item" }] },
    getByRole: () => ({ allTextContents: async () => ["Items"] }),
    screenshot: async () => Buffer.from("png"),
    url: () => observation.url,
    title: async () => "Items",
  };
  const result = await observePage(page as never);
  assert.deepEqual(result.controls, [{ role: "button", name: "New item" }]);
  assert.equal(result.screenshotHash.length, 64);
  assert.equal(result.domHash.length, 64);
});

test("persists and executes an episode as a planned child run", async () => {
  const events: string[] = [];
  const result = await executeAgentEpisode({
    app: "agent-app",
    startUrl: observation.url,
    parentRunId: "parent-1",
    mission,
    observation,
    allowAll: false,
    decision: { action: "click", text: "Details", expectedState: "Details", expectedVisible: { text: "Details" }, mode: "read" },
  }, {
    saveAutonomousPlan: async (plan, parentRunId, missionId) => {
      events.push(`save:${plan.reviewed}:${parentRunId}:${missionId}`);
      return { id: "plan-1" };
    },
    createChildRun: async (input) => {
      events.push(`child:${input.parentRunId}:${input.planId}:${input.allowSideEffects}`);
      return { id: "child-1" };
    },
    executeRun: async (runId) => {
      events.push(`execute:${runId}`);
      return { id: runId };
    },
    readEpisodeResult: async (runId, missionId) => {
      events.push(`read:${runId}:${missionId}`);
      return { runId, missionId, status: "succeeded" as const };
    },
    checkpointMission: async () => assert.fail("successful episode must not checkpoint authentication"),
    requestAuthenticationLease: async () => assert.fail("successful episode must not request authentication"),
  });
  assert.deepEqual(events, [
    "save:true:parent-1:mission-1",
    "child:parent-1:plan-1:false",
    "execute:child-1",
    "read:child-1:mission-1",
  ]);
  assert.equal(result.status, "succeeded");
});

test("checkpoints a login observation and requests the authentication lease", async () => {
  const events: string[] = [];
  const result = await executeAgentEpisode({
    app: "agent-app",
    startUrl: "https://app.test/login",
    parentRunId: "parent-1",
    mission,
    observation: { ...observation, url: "https://app.test/login", title: "Sign in" },
    allowAll: false,
    decision: { action: "waitFor", text: "Sign in", expectedState: "Sign in", expectedVisible: { text: "Sign in" }, mode: "read" },
  }, {
    saveAutonomousPlan: async () => assert.fail("login blocker must not start a child run"),
    createChildRun: async () => assert.fail("login blocker must not start a child run"),
    executeRun: async () => assert.fail("login blocker must not start a child run"),
    readEpisodeResult: async () => assert.fail("login blocker must not start a child run"),
    checkpointMission: async (missionId, checkpoint) => { events.push(`checkpoint:${missionId}:${checkpoint.reason}`); },
    requestAuthenticationLease: async (parentRunId, missionId) => { events.push(`lease:${parentRunId}:${missionId}`); },
  });
  assert.deepEqual(events, ["checkpoint:mission-1:authentication_required", "lease:parent-1:mission-1"]);
  assert.equal(result.status, "authentication_required");
});

test("keeps named authentication secrets in the existing runtime substitution path", () => {
  const plan = buildEpisodePlan({
    app: "agent-app",
    startUrl: "https://app.test/login",
    mission,
    observation: { ...observation, url: "https://app.test/login", title: "Sign in" },
    allowAll: true,
    decision: {
      action: "fill",
      role: "textbox",
      name: "Email",
      value: "$APP_TEST_EMAIL",
      expectedState: "Email entered",
      expectedVisible: { role: "textbox", name: "Email" },
      mode: "read",
    },
  });
  assert.deepEqual(plan.flows[0].requiredSecrets, ["APP_TEST_EMAIL"]);
  assert.equal(plan.flows[0].steps[0].value, "$APP_TEST_EMAIL");
});
