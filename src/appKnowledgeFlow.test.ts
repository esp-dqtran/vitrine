import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enrichOrderedFlows,
  parseAppKnowledgeFlowSynthesisResult,
  planFlowSynthesisChunks,
  planOrderedFlows,
} from "./appKnowledgeFlow.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";
import type { AppKnowledgeEvidenceAnalysis } from "./appKnowledgeService.ts";

function analysis(evidenceId: string): AppKnowledgeEvidenceAnalysis {
  return {
    evidenceId,
    pageType: "Form",
    productArea: "Check-ins",
    purpose: "Complete a check-in",
    viewport: "desktop",
    visibleText: ["Continue"],
    theme: "light",
    visualHierarchy: ["Form", "Action"],
    layoutPatterns: ["Single column"],
    contentPatterns: ["Questionnaire"],
    imagery: [],
    icons: [],
    interactionPatterns: ["Form submission"],
    visibleStates: ["Default"],
    availableActions: ["Continue"],
    systemFeedback: [],
    accessibilityObservations: [],
    likelyIntent: "Complete the check-in",
    friction: [],
    uncertainStates: [],
    confidence: 0.9,
    tokenCandidates: [],
    componentOccurrences: [],
  };
}

function item(input: {
  evidenceId: string;
  imageId: number;
  stepIndex: number;
  stepLabel: string;
  interaction?: string;
  duplicateOfEvidenceId?: string;
}): AppKnowledgeEvidenceManifestItem {
  return {
    evidenceId: input.evidenceId,
    imageId: input.imageId,
    kind: "flow_step",
    eligibility: input.duplicateOfEvidenceId ? "duplicate" : "eligible",
    reason: input.duplicateOfEvidenceId ? "visual_duplicate" : "flow_step_capture",
    ...(input.duplicateOfEvidenceId ? {
      duplicateOfEvidenceId: input.duplicateOfEvidenceId,
    } : {}),
    flow: {
      id: "weekly-check-in",
      title: "Submit a weekly check-in",
      category: "Check-ins",
      stepIndex: input.stepIndex,
      stepLabel: input.stepLabel,
      ...(input.interaction ? { interaction: input.interaction } : {}),
    },
    object: {
      sha256: "a".repeat(64),
      byteSize: 100,
      contentType: "image/png",
    },
  };
}

function planned() {
  const manifest = [
    item({
      evidenceId: "FLOW-weekly-check-in-STEP-01-IMAGE-9",
      imageId: 9,
      stepIndex: 0,
      stepLabel: "Answer questions",
    }),
    item({
      evidenceId: "FLOW-weekly-check-in-STEP-02-IMAGE-9",
      imageId: 9,
      stepIndex: 1,
      stepLabel: "Review answers",
      interaction: "Tap Continue",
      duplicateOfEvidenceId: "FLOW-weekly-check-in-STEP-01-IMAGE-9",
    }),
    item({
      evidenceId: "FLOW-weekly-check-in-STEP-03-IMAGE-10",
      imageId: 10,
      stepIndex: 2,
      stepLabel: "Submit",
    }),
  ];
  return planOrderedFlows(manifest, new Map([
    ["FLOW-weekly-check-in-STEP-01-IMAGE-9", analysis("FLOW-weekly-check-in-STEP-01-IMAGE-9")],
    ["FLOW-weekly-check-in-STEP-03-IMAGE-10", analysis("FLOW-weekly-check-in-STEP-03-IMAGE-10")],
  ]));
}

function providerResult() {
  return {
    flows: [{
      flowId: "weekly-check-in",
      purpose: "Complete and submit a weekly check-in",
      tags: ["Check-ins", "Submission"],
      feedback: ["A confirmation is shown after submission"],
      openQuestions: ["What happens when a required response is missing?"],
      confidence: 0.86,
      source: "llm_inferred",
      reviewStatus: "needs_review",
      steps: [{
        stepId: "weekly-check-in-step-1",
        interaction: "Enter responses",
        visibleStates: ["Default form"],
        systemFeedback: [],
      }, {
        stepId: "weekly-check-in-step-2",
        interaction: "Submit form",
        visibleStates: ["Review"],
        systemFeedback: [],
      }, {
        stepId: "weekly-check-in-step-3",
        interaction: "Confirm submission",
        visibleStates: ["Ready to submit"],
        systemFeedback: ["Submission confirmation"],
      }],
    }],
  };
}

test("restores duplicate visuals to every original Flow occurrence", () => {
  const flows = planned();

  assert.deepEqual(
    flows[0].steps.map(({ id }) => id),
    [
      "weekly-check-in-step-1",
      "weekly-check-in-step-2",
      "weekly-check-in-step-3",
    ],
  );
  assert.equal(
    flows[0].steps[1].analysis.evidenceId,
    "FLOW-weekly-check-in-STEP-02-IMAGE-9",
  );
  assert.deepEqual(
    flows[0].steps.map(({ evidenceId }) => evidenceId),
    [
      "FLOW-weekly-check-in-STEP-01-IMAGE-9",
      "FLOW-weekly-check-in-STEP-02-IMAGE-9",
      "FLOW-weekly-check-in-STEP-03-IMAGE-10",
    ],
  );
});

test("validates exact Flow and step identities and order", () => {
  const flows = planned();
  const reordered = providerResult();
  reordered.flows[0].steps.reverse();
  assert.throws(
    () => parseAppKnowledgeFlowSynthesisResult(reordered, flows),
    /step order/,
  );

  const unknown = providerResult();
  unknown.flows[0].flowId = "unknown";
  assert.throws(
    () => parseAppKnowledgeFlowSynthesisResult(unknown, flows),
    /unknown Flow/,
  );
});

test("keeps crawled interactions authoritative while adding Flow insights", () => {
  const flows = planned();
  const parsed = parseAppKnowledgeFlowSynthesisResult(providerResult(), flows);
  const [enriched] = enrichOrderedFlows(flows, parsed);

  assert.equal(enriched.steps[0].interaction, "Enter responses");
  assert.equal(enriched.steps[1].interaction, "Tap Continue");
  assert.deepEqual(enriched.steps.map(({ evidenceId }) => evidenceId), [
    "FLOW-weekly-check-in-STEP-01-IMAGE-9",
    "FLOW-weekly-check-in-STEP-02-IMAGE-9",
    "FLOW-weekly-check-in-STEP-03-IMAGE-10",
  ]);
  assert.equal(enriched.insights?.source, "llm_inferred");
  assert.equal(enriched.insights?.reviewStatus, "needs_review");
});

test("plans deterministic byte-bounded Flow synthesis chunks", () => {
  const flows = planned();
  const copies = Array.from({ length: 4 }, (_, index) => ({
    ...structuredClone(flows[0]),
    id: `weekly-check-in-${index + 1}`,
    steps: flows[0].steps.map((step) => ({
      ...structuredClone(step),
      id: `weekly-check-in-${index + 1}-step-${step.order}`,
    })),
  }));

  const first = planFlowSynthesisChunks(copies, 5_000);
  const second = planFlowSynthesisChunks([...copies].reverse(), 5_000);

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.flatMap((chunk) => chunk.flows).map(({ id }) => id),
    copies.map(({ id }) => id),
  );
  assert.ok(first.every(({ byteSize }) => byteSize <= 5_000));
});
