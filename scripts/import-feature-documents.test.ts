import assert from "node:assert/strict";
import { test } from "node:test";
import {
  artifactMatchesFlow,
  catalogDocumentKey,
  featureDescriptionToContent,
  type FeatureDescriptionArtifact,
} from "./import-feature-documents.ts";
import { parseFeatureDocumentContent } from "../src/featureDocument.ts";

const artifact: FeatureDescriptionArtifact = {
  generatedAt: "2026-07-26T00:00:00.000Z",
  source: {
    app: "binance",
    platform: "web",
    flowId: "flow-123",
    title: "Upload a document",
    description: "",
    category: "Verification",
    tags: [],
    evidence: [
      { imageId: 42, evidenceId: "S01", stepIndex: 0, imageIndex: 0, stepLabel: "Step 1" },
      { imageId: 43, evidenceId: "S02", stepIndex: 1, imageIndex: 0, stepLabel: "Step 2" },
    ],
  },
  feature: {
    title: "Upload a document",
    featureDescription: "Users can upload a document for verification.",
    userGoal: "Submit a clear document.",
    entryPoint: "The verification page.",
    completionState: "The uploaded document is attached.",
    orderedSteps: [
      { evidenceId: "S01", name: "Open upload", description: "The upload page is visible.", userAction: "Open upload.", systemResponse: "The upload control is shown.", confidence: 0.9 },
      { evidenceId: "S02", name: "Confirm document", description: "A document preview is visible.", userAction: "Confirm the document.", systemResponse: "The document remains attached.", confidence: 0.9 },
    ],
    observedBehavior: [{ text: "The upload page exposes a document control.", evidenceIds: ["S01"] }],
    inferredRules: [{ text: "A document must be selected before continuing.", evidenceIds: ["S01", "S02"], confidence: 0.8 }],
    requirements: [{ id: "REQ-01", text: "The system must accept a document.", priority: "must", evidenceIds: ["S01"] }],
    edgeCases: [{ scenario: "Upload fails", expectedBehavior: "Keep the user on the upload step.", basis: "proposed", evidenceIds: [] }],
    acceptanceCriteria: [{ id: "AC-01", given: "The upload page is open", when: "The user selects a document", then: "The document is attached", evidenceIds: ["S01", "S02"] }],
    unknowns: ["The maximum file size is not shown."],
  },
};

test("converts a local flow analysis into a valid catalog Feature Document", () => {
  const content = featureDescriptionToContent(artifact);
  const parsed = parseFeatureDocumentContent(content, new Set(["S01", "S02"]));
  assert.equal(parsed.requirements[0].id, "REQ-01");
  assert.equal(
    parsed.requirements[0].userStory,
    "As a user, I need the system to accept a document, so that I can complete the flow goal.",
  );
  assert.equal(parsed.observedFlow.journey.length, 2);
  assert.equal(parsed.executiveSummary.purpose.kind, "observed");
  assert.equal(parsed.openQuestions[0].kind, "unknown");
});

test("matches acceptance criteria to requirements by evidence instead of array position", () => {
  const content = featureDescriptionToContent({
    ...artifact,
    feature: {
      ...artifact.feature,
      requirements: [
        { id: "REQ-01", text: "The system must show the first state.", priority: "must", evidenceIds: ["S01"] },
        { id: "REQ-02", text: "The system must show an intermediate state.", priority: "must", evidenceIds: [] },
        { id: "REQ-03", text: "The system must show the final state.", priority: "must", evidenceIds: ["S02"] },
      ],
      acceptanceCriteria: [
        { id: "AC-01", given: "First", when: "Opened", then: "First state", evidenceIds: ["S01"] },
        { id: "AC-02", given: "Final", when: "Confirmed", then: "Final state", evidenceIds: ["S02"] },
      ],
    },
  });

  assert.equal(content.requirements[0].acceptanceCriteria[0].then, "First state");
  assert.equal(content.requirements[1].acceptanceCriteria[0].then, "The system must show an intermediate state.");
  assert.equal(content.requirements[2].acceptanceCriteria[0].then, "Final state");
});

test("uses app, platform, and Flow ID as the stable catalog identity", () => {
  assert.equal(catalogDocumentKey(artifact.source), "binance:web:flow-123");
});

test("can limit a catalog import to one exact Flow", () => {
  assert.equal(artifactMatchesFlow(artifact), true);
  assert.equal(artifactMatchesFlow(artifact, "flow-123"), true);
  assert.equal(artifactMatchesFlow(artifact, "another-flow"), false);
});
