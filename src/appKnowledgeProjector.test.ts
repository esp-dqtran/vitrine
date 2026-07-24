import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppKnowledgeSnapshot } from "./appKnowledge.ts";
import {
  projectAppKnowledgeDesignSystem,
} from "./appKnowledgeProjector.ts";
import type { AppKnowledgeRevisionView } from "./appKnowledgeStore.ts";

function content(): AppKnowledgeSnapshot {
  return {
    identity: {
      app: "15five",
      platform: "web",
      captureVersionId: 7,
      sourceSha256: "a".repeat(64),
      providerModel: "vision-model",
      promptVersion: 2,
      generatedAt: "2026-07-24T00:00:00.000Z",
    },
    coverage: {
      total: 2,
      eligible: 2,
      analyzed: 2,
      cached: 0,
      quarantined: 0,
      skipped: 0,
      failed: 0,
      duplicateVisuals: 0,
      byKind: {
        screen: { total: 2, eligible: 2, analyzed: 2, cached: 0, quarantined: 0, failed: 0 },
        flow_step: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
        ui_element: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
      },
      flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
    },
    screens: [{
      id: "screen-home",
      evidenceId: "SCREEN-1",
      pageType: "Home",
      productArea: "Core",
      purpose: "Orient users",
      viewport: "desktop",
      visibleText: ["Home"],
      theme: "light",
      visualHierarchy: ["Navigation", "Content"],
      layoutPatterns: ["Page frame"],
      contentPatterns: [],
      imagery: [],
      icons: [],
      interactionPatterns: [],
      visibleStates: ["Default"],
      availableActions: [],
      systemFeedback: [],
      accessibilityObservations: [],
      claims: [],
      confidence: 0.9,
      reviewStatus: "needs_review",
    }],
    tokenCandidates: [{
      id: "token-action-primary",
      kind: "color",
      name: "Primary action",
      value: "#F26B38",
      role: "Primary action fill",
      evidenceIds: ["SCREEN-1"],
      confidence: 0.82,
      source: "llm_inferred",
      reviewStatus: "needs_review",
    }, {
      id: "token-space-control",
      kind: "spacing",
      name: "Control gap",
      value: "8px",
      role: "Gap between control contents",
      evidenceIds: ["SCREEN-2"],
      confidence: 0.76,
      source: "llm_inferred",
      reviewStatus: "needs_review",
    }],
    componentCandidates: [{
      id: "component-button",
      name: "Button",
      category: "Inputs",
      purpose: "Trigger an action",
      anatomy: ["container", "label"],
      observedProperties: ["orange fill"],
      variants: ["Primary"],
      variantCandidates: [{
        id: "component-button-primary",
        name: "Primary",
        description: "Primary action button",
        observedProperties: ["orange fill"],
        visibleStates: ["default"],
        evidenceIds: ["SCREEN-1"],
        occurrences: [{
          evidenceId: "SCREEN-1",
          region: { x: 0.7, y: 0.6, width: 0.2, height: 0.08 },
          confidence: 0.88,
        }],
        confidence: 0.88,
        source: "llm_inferred",
        reviewStatus: "needs_review",
      }],
      states: ["default"],
      responsiveEvidence: ["desktop"],
      evidenceIds: ["SCREEN-1"],
      visualRegions: ["Primary action"],
      designLanguageCandidateIds: [],
      claims: [],
      confidence: 0.88,
      status: "candidate",
    }],
    designRules: [{
      id: "rule-layout-page",
      kind: "layout",
      name: "Page frame",
      description: "Content uses a persistent page frame.",
      evidenceIds: ["SCREEN-1"],
      confidence: 0.86,
      source: "llm_inferred",
      reviewStatus: "needs_review",
    }],
    designConflicts: [],
    designLanguage: {
      color: [],
      typography: [],
      spacing: [],
      radius: [],
      border: [],
      effects: [],
      layout: [],
      iconography: [],
      imagery: [],
      responsive: [],
      content: [],
      interaction: [],
    },
    flows: [],
    productKnowledge: {
      capabilities: [{
        id: "capability-core",
        kind: "observed",
        text: "The Core area is visible.",
        evidenceIds: ["SCREEN-1"],
        confidence: 0.9,
      }],
      featureRelationships: [],
      userJourneys: [],
      actorResponsibilities: [],
      requirements: [],
      acceptanceCriteria: [],
      edgeCases: [],
      dependencies: [],
      risks: [],
      successMetrics: [],
      guardrails: [],
      analyticsEvents: [],
      openQuestions: [],
    },
  };
}

function revision(): AppKnowledgeRevisionView {
  return {
    id: 51,
    snapshotId: 41,
    revisionNumber: 1,
    authorType: "generated",
    reviewStatus: "draft",
    content: content(),
    manifest: [{
      evidenceId: "SCREEN-1",
      imageId: 101,
      kind: "screen",
      eligibility: "eligible",
      reason: "screen_capture",
      viewport: { width: 1440, height: 900 },
      object: {
        sha256: "b".repeat(64),
        byteSize: 100,
        contentType: "image/png",
      },
    }, {
      evidenceId: "SCREEN-2",
      imageId: 102,
      kind: "screen",
      eligibility: "eligible",
      reason: "screen_capture",
      viewport: { width: 390, height: 844 },
      object: {
        sha256: "c".repeat(64),
        byteSize: 100,
        contentType: "image/png",
      },
    }],
    sourceSha256: "a".repeat(64),
    providerModel: "vision-model",
    promptVersion: 2,
    createdBy: 1,
    createdAt: "2026-07-24T00:00:00.000Z",
  };
}

test("projects a stable LLM-inferred design-system snapshot", () => {
  const first = projectAppKnowledgeDesignSystem(revision());
  const reversed = revision();
  reversed.content.tokenCandidates?.reverse();
  reversed.content.componentCandidates.reverse();
  reversed.content.designRules?.reverse();
  const second = projectAppKnowledgeDesignSystem(reversed);

  assert.deepEqual(first, second);
  assert.equal(first.tokens[0].source, "llm_inferred");
  assert.equal(first.tokens[0].reviewStatus, "needs_review");
  assert.deepEqual(first.components[0].variants[0].occurrences?.[0], {
    imageId: 101,
    region: { x: 0.7, y: 0.6, width: 0.2, height: 0.08 },
    coordinateSpace: "normalized",
    confidence: 0.88,
  });
  assert.equal(first.rules?.[0].source, "llm_inferred");
  assert.match(first.tokens[0].id, /^color-[0-9a-f]{20}$/);
});

test("rejects revision evidence that is absent from the frozen manifest", () => {
  const input = revision();
  input.content.tokenCandidates![0].evidenceIds = ["SCREEN-999"];

  assert.throws(
    () => projectAppKnowledgeDesignSystem(input),
    /frozen manifest/,
  );
});

test("projects Flow insights without replacing a crawled interaction", () => {
  const input = revision();
  input.manifest.push({
    evidenceId: "FLOW-weekly-check-in-STEP-01-IMAGE-9",
    imageId: 109,
    kind: "flow_step",
    eligibility: "eligible",
    reason: "flow_step_capture",
    flow: {
      id: "weekly-check-in",
      title: "Submit a weekly check-in",
      category: "Check-ins",
      stepIndex: 0,
      stepLabel: "Review answers",
      interaction: "Tap Continue",
    },
    object: {
      sha256: "d".repeat(64),
      byteSize: 100,
      contentType: "image/png",
    },
  });
  input.content.flows = [{
    id: "flow-weekly-check-in",
    sourceFlowId: "weekly-check-in",
    title: "Submit a weekly check-in",
    category: "Check-ins",
    userGoal: {
      id: "flow-weekly-check-in-purpose",
      kind: "inferred",
      text: "Complete a weekly check-in",
      evidenceIds: ["FLOW-weekly-check-in-STEP-01-IMAGE-9"],
      confidence: 0.86,
    },
    actors: [],
    entryPoint: {
      id: "flow-weekly-check-in-entry",
      kind: "observed",
      text: "The review screen is visible.",
      evidenceIds: ["FLOW-weekly-check-in-STEP-01-IMAGE-9"],
      confidence: 0.9,
    },
    completionPoint: {
      id: "flow-weekly-check-in-completion",
      kind: "unknown",
      text: "Completion is not captured.",
      evidenceIds: [],
      confidence: 0.5,
    },
    steps: [{
      id: "weekly-check-in-step-1",
      order: 1,
      evidenceId: "FLOW-weekly-check-in-STEP-01-IMAGE-9",
      label: "Review answers",
      interaction: "Tap Continue",
      visibleStates: ["Review"],
      availableActions: ["Continue"],
      systemFeedback: [],
      friction: [],
      uncertainStates: [],
      claims: [],
    }],
    effectivePatterns: [],
    risks: [],
    inconsistencies: [],
    openQuestions: [],
    insights: {
      purpose: "Complete a weekly check-in",
      feedback: ["Submission confirmation is shown"],
      openQuestions: ["What happens when a response is missing?"],
      confidence: 0.86,
      reviewStatus: "needs_review",
      source: "llm_inferred",
      evidenceIds: ["FLOW-weekly-check-in-STEP-01-IMAGE-9"],
    },
  }];

  const [flow] = projectAppKnowledgeDesignSystem(input).flows;

  assert.equal(flow.steps[0].interaction, "Tap Continue");
  assert.equal(flow.insights?.source, "llm_inferred");
  assert.deepEqual(flow.insights?.evidence, [109]);
});
