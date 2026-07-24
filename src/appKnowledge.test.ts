import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAppKnowledgeSnapshot,
  projectAppKnowledge,
  type AppKnowledgeSnapshot,
} from "./appKnowledge.ts";

const evidence = new Set(["SCREEN-1", "FLOW-login-STEP-01-IMAGE-2"]);

function claim(
  id: string,
  text: string,
  kind: "observed" | "inferred" | "proposed" | "unknown" = "observed",
  evidenceIds: string[] = ["SCREEN-1"],
) {
  return { id, kind, text, evidenceIds, confidence: 0.9 };
}

function snapshotFixture(): AppKnowledgeSnapshot {
  return {
    identity: {
      app: "15five",
      platform: "web",
      captureVersionId: 7,
      sourceSha256: "a".repeat(64),
      providerModel: "vision-model",
      promptVersion: 1,
      generatedAt: "2026-07-23T00:00:00.000Z",
    },
    coverage: {
      total: 3,
      eligible: 2,
      analyzed: 2,
      cached: 0,
      quarantined: 1,
      skipped: 0,
      failed: 0,
      duplicateVisuals: 0,
      byKind: {
        screen: { total: 1, eligible: 1, analyzed: 1, cached: 0, quarantined: 0, failed: 0 },
        flow_step: { total: 1, eligible: 1, analyzed: 1, cached: 0, quarantined: 0, failed: 0 },
        ui_element: { total: 1, eligible: 0, analyzed: 0, cached: 0, quarantined: 1, failed: 0 },
      },
      flowReferences: { total: 1, resolved: 1, uniqueImages: 1 },
    },
    screens: [{
      id: "screen-dashboard",
      evidenceId: "SCREEN-1",
      pageType: "Dashboard",
      productArea: "Check-ins",
      purpose: "Review team activity",
      viewport: "desktop",
      visibleText: ["15Five"],
      theme: "light",
      visualHierarchy: ["Navigation", "Summary"],
      layoutPatterns: ["Sidebar"],
      contentPatterns: ["Metric cards"],
      imagery: [],
      icons: ["Navigation icons"],
      interactionPatterns: ["Card navigation"],
      visibleStates: ["Default"],
      availableActions: ["Open a check-in"],
      systemFeedback: [],
      accessibilityObservations: ["Visible labels accompany icons"],
      claims: [claim("screen-purpose", "The dashboard summarizes team activity.")],
      confidence: 0.92,
      reviewStatus: "needs_review",
    }],
    componentCandidates: [{
      id: "component-sidebar",
      name: "Sidebar navigation",
      category: "navigation",
      purpose: "Move between product areas",
      anatomy: ["Icon", "Label"],
      observedProperties: ["Persistent left rail"],
      variants: ["Selected", "Default"],
      states: ["Selected"],
      responsiveEvidence: [],
      evidenceIds: ["SCREEN-1"],
      visualRegions: [],
      designLanguageCandidateIds: ["language-navigation"],
      claims: [claim("component-sidebar-purpose", "The sidebar exposes product areas.")],
      confidence: 0.84,
      status: "candidate",
    }],
    designLanguage: {
      color: [claim("language-color", "The main surface uses a light neutral background.")],
      typography: [claim("language-type", "Section headings use stronger weight.")],
      spacing: [claim("language-spacing", "Cards use consistent internal spacing.", "inferred")],
      radius: [],
      border: [],
      effects: [],
      layout: [claim("language-navigation", "Primary navigation remains on the left.")],
      iconography: [],
      imagery: [],
      responsive: [],
      content: [],
      interaction: [],
    },
    flows: [{
      id: "flow-login",
      sourceFlowId: "login",
      title: "Sign in",
      category: "Authentication",
      userGoal: claim("flow-goal", "Access the product.", "observed", ["FLOW-login-STEP-01-IMAGE-2"]),
      actors: [claim("flow-actor", "A team member signs in.", "inferred", ["FLOW-login-STEP-01-IMAGE-2"])],
      entryPoint: claim("flow-entry", "The journey begins at sign in.", "observed", ["FLOW-login-STEP-01-IMAGE-2"]),
      completionPoint: claim("flow-completion", "The captured step does not establish completion.", "unknown", []),
      steps: [{
        id: "flow-login-step-1",
        order: 1,
        evidenceId: "FLOW-login-STEP-01-IMAGE-2",
        label: "Enter credentials",
        availableActions: ["Submit"],
        systemFeedback: [],
        friction: [],
        uncertainStates: ["Validation behavior is not captured"],
        claims: [claim("flow-step-visible", "A sign-in form is visible.", "observed", ["FLOW-login-STEP-01-IMAGE-2"])],
      }],
      effectivePatterns: [],
      risks: [],
      inconsistencies: [],
      openQuestions: [claim("flow-open-question", "What validation rules apply?", "unknown", [])],
    }],
    productKnowledge: {
      capabilities: [claim("capability-checkins", "Users can review team check-ins.")],
      featureRelationships: [],
      userJourneys: [claim("journey-review", "A manager reviews team activity.", "inferred")],
      actorResponsibilities: [claim("actor-manager", "A manager reviews submitted updates.", "inferred")],
      requirements: [claim("requirement-navigation", "Preserve access to primary product areas.", "proposed", [])],
      acceptanceCriteria: [claim("criterion-navigation", "Given the dashboard, primary areas remain reachable.", "proposed", [])],
      edgeCases: [],
      dependencies: [],
      risks: [],
      successMetrics: [],
      guardrails: [],
      analyticsEvents: [],
      openQuestions: [claim("product-question", "Which roles can view all team activity?", "unknown", [])],
    },
  };
}

test("parses one canonical snapshot and produces deterministic role projections", () => {
  const parsed = parseAppKnowledgeSnapshot(snapshotFixture(), evidence);
  const designer = projectAppKnowledge(parsed, "designer");
  const developer = projectAppKnowledge(parsed, "developer");
  const product = projectAppKnowledge(parsed, "product");

  assert.deepEqual(projectAppKnowledge(parsed, "designer"), designer);
  assert.deepEqual(designer.entityIds.screens, ["screen-dashboard"]);
  assert.deepEqual(developer.entityIds.componentCandidates, ["component-sidebar"]);
  assert.ok(product.sections.some(({ claims }) =>
    claims.some(({ id, evidenceIds }) => id === "capability-checkins" && evidenceIds[0] === "SCREEN-1")));
});

test("rejects observed and inferred claims without evidence", () => {
  const raw = snapshotFixture();
  raw.productKnowledge.capabilities[0].evidenceIds = [];
  assert.throws(() => parseAppKnowledgeSnapshot(raw, evidence), /requires evidence/);
});

test("rejects citations outside the evidence allowlist", () => {
  const raw = snapshotFixture();
  raw.productKnowledge.capabilities[0].evidenceIds = ["SCREEN-999"];
  assert.throws(() => parseAppKnowledgeSnapshot(raw, evidence), /unknown evidence/);
});

test("rejects duplicate claim identities across sections", () => {
  const raw = snapshotFixture();
  raw.productKnowledge.capabilities[0].id = "screen-purpose";
  assert.throws(() => parseAppKnowledgeSnapshot(raw, evidence), /duplicate app knowledge id/);
});

test("rejects duplicate screen, component, Flow, and step identities", () => {
  const raw = snapshotFixture();
  raw.screens.push({ ...raw.screens[0] });
  assert.throws(() => parseAppKnowledgeSnapshot(raw, evidence), /duplicate screen id/);
});

test("rejects confidence outside zero and one", () => {
  const raw = snapshotFixture();
  raw.componentCandidates[0].confidence = 1.1;
  assert.throws(() => parseAppKnowledgeSnapshot(raw, evidence), /confidence must be between 0 and 1/);
});

test("does not accept trusted screenshot-derived components", () => {
  const raw = snapshotFixture() as unknown as {
    componentCandidates: Array<Record<string, unknown>>;
  };
  raw.componentCandidates[0].status = "trusted";
  assert.throws(
    () => parseAppKnowledgeSnapshot(raw, evidence),
    /component candidate status is invalid/,
  );
});

test("rejects a snapshot without a Screen catalog", () => {
  const raw = snapshotFixture();
  raw.screens = [];
  assert.throws(() => parseAppKnowledgeSnapshot(raw, evidence), /screens must contain at least one item/);
});

test("accepts a large captured screen inventory", () => {
  const raw = snapshotFixture();
  raw.screens = Array.from({ length: 610 }, (_, index) => ({
    ...structuredClone(raw.screens[0]),
    id: `screen-${index + 1}`,
    evidenceId: `SCREEN-${index + 1}`,
    claims: [],
  }));
  const allowed = new Set([
    ...evidence,
    ...raw.screens.map(({ evidenceId }) => evidenceId),
  ]);
  assert.equal(parseAppKnowledgeSnapshot(raw, allowed).screens.length, 610);
});
