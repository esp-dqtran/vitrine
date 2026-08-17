import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAgentTraceEvent, parseAppDossier, parseMission } from "./autonomousCrawler.ts";

const validDossier = {
  app: "linear",
  purpose: "Issue tracking",
  sources: [{
    url: "https://linear.app/docs",
    title: "Docs",
    retrievedAt: "2026-07-16T00:00:00.000Z",
  }],
  claims: [{
    text: "Teams manage issues",
    sourceUrls: ["https://linear.app/docs"],
    confidence: 0.9,
  }],
  roles: ["member"],
  capabilities: ["issue-management"],
  candidateFlows: [],
  openQuestions: [],
};

test("parses a cited dossier and rejects unsupported claims", () => {
  const dossier = parseAppDossier(validDossier);
  assert.equal(dossier.claims[0].confidence, 0.9);
  assert.throws(
    () => parseAppDossier({
      ...dossier,
      claims: [{ text: "Unsupported", sourceUrls: ["https://other.test"], confidence: 1 }],
    }),
    /source/i,
  );
});

test("requires explicit authorization for mutating missions", () => {
  const mission = {
    missionKey: "delete",
    goal: "Delete item",
    productArea: "Settings",
    mode: "mutate" as const,
    prerequisites: [],
    budget: { actions: 20, recoveries: 2 },
  };
  assert.throws(() => parseMission(mission, false), /allow_all/i);
  assert.deepEqual(parseMission(mission, true), mission);
});

test("requires unique cited sources and bounded claim confidence", () => {
  assert.throws(
    () => parseAppDossier({ ...validDossier, sources: [...validDossier.sources, validDossier.sources[0]] }),
    /unique/i,
  );
  assert.throws(
    () => parseAppDossier({
      ...validDossier,
      claims: [{ ...validDossier.claims[0], confidence: 1.1 }],
    }),
    /confidence/i,
  );
  assert.throws(
    () => parseAppDossier({
      ...validDossier,
      candidateFlows: [{
        id: "create-issue",
        title: "Create issue",
        goal: "Create an issue",
        productArea: "Issues",
        mode: "mutate",
        prerequisites: [],
        sourceUrls: ["https://unsupported.example/docs"],
      }],
    }),
    /source/i,
  );
});

test("rejects private source URLs and secret-like dossier content", () => {
  assert.throws(
    () => parseAppDossier({
      ...validDossier,
      sources: [{ ...validDossier.sources[0], url: "http://127.0.0.1/docs" }],
      claims: [{ ...validDossier.claims[0], sourceUrls: ["http://127.0.0.1/docs"] }],
    }),
    /public/i,
  );
  assert.throws(
    () => parseAppDossier({ ...validDossier, apiKey: "not-for-storage" }),
    /secret/i,
  );
  assert.throws(
    () => parseAppDossier({ ...validDossier, purpose: "Bearer abcdefghijklmnopqrstuvwxyz" }),
    /secret/i,
  );
});

test("validates mission identity and emergency ceilings", () => {
  const mission = {
    missionKey: "settings-read",
    goal: "Inspect settings",
    productArea: "Settings",
    mode: "read" as const,
    prerequisites: [],
    budget: { actions: 20, recoveries: 2 },
  };
  assert.throws(() => parseMission({ ...mission, missionKey: "" }, false), /identity/i);
  assert.throws(() => parseMission({ ...mission, budget: { ...mission.budget, actions: 501 } }, false), /action budget/i);
  assert.throws(() => parseMission({ ...mission, budget: { ...mission.budget, recoveries: 21 } }, false), /recovery budget/i);
  assert.deepEqual(parseMission(mission, false), mission);
});

test("bounds dossier payloads and rejects unknown fields", () => {
  assert.throws(() => parseAppDossier({ ...validDossier, debug: true }), /unexpected/i);
  assert.throws(
    () => parseAppDossier({
      ...validDossier,
      sources: [{ ...validDossier.sources[0], body: "raw page" }],
    }),
    /unexpected/i,
  );
  assert.throws(() => parseAppDossier({ ...validDossier, purpose: "x".repeat(10_001) }), /too long/i);
  assert.throws(() => parseAppDossier({ ...validDossier, roles: Array(501).fill("member") }), /too many/i);
});

test("parses a sourced designer research profile, flow readiness, and credential capability aliases", () => {
  const dossier = parseAppDossier({
    ...validDossier,
    profile: {
      name: "Linear",
      canonicalUrl: "https://linear.app",
      category: "Project management",
      description: "A product-development workspace.",
      sourceUrls: ["https://linear.app/docs"],
      iconUrl: "https://linear.app/icon.svg",
    },
    candidateFlows: [{
      id: "invite-member",
      title: "Invite member",
      goal: "Invite a teammate to a workspace",
      productArea: "Members",
      mode: "read",
      prerequisites: [],
      sourceUrls: ["https://linear.app/docs"],
      access: "sign_in_required",
      readiness: "needs_review",
      confidence: 0.8,
      credentialCapability: "linear.demo.admin",
      candidateSteps: [{
        title: "Open workspace members",
        sourceUrls: ["https://linear.app/docs"],
        evidence: "documented",
      }],
    }],
    credentialCapabilities: [{
      alias: "linear.demo.admin",
      purpose: "Validate workspace administration flows",
      role: "workspace admin",
      allowedOrigins: ["https://linear.app/settings"],
      flowIds: ["invite-member"],
      sourceUrls: ["https://linear.app/docs"],
    }],
  });
  assert.equal(dossier.profile?.category, "Project management");
  assert.equal(dossier.candidateFlows[0]?.candidateSteps?.[0]?.evidence, "documented");
  assert.equal(dossier.credentialCapabilities?.[0]?.allowedOrigins[0], "https://linear.app");
  assert.throws(
    () => parseAppDossier({
      ...dossier,
      credentialCapabilities: [{ ...dossier.credentialCapabilities![0], flowIds: ["missing-flow"] }],
    }),
    /unknown flow/i,
  );
});

test("accepts bounded, redacted decision-trace events", () => {
  assert.deepEqual(
    parseAgentTraceEvent({
      stage: "execution",
      type: "action_selected",
      rationale: "Selected one navigation action from the observed public state.",
      confidence: 0.8,
      credentialCapability: "linear.demo.admin",
    }),
    {
      stage: "execution",
      type: "action_selected",
      rationale: "Selected one navigation action from the observed public state.",
      confidence: 0.8,
      credentialCapability: "linear.demo.admin",
    },
  );
  assert.throws(
    () => parseAgentTraceEvent({ stage: "execution", type: "action_selected", rationale: "x", password: "not-safe" }),
    /secret/i,
  );
});
