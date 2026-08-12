import assert from "node:assert/strict";
import { test } from "node:test";
import {
  featureEvidenceManifestSha256,
  parseFeatureDocumentContent,
  parseFeatureStepAnalysis,
  renderFeatureDocumentMarkdown,
  type FeatureDocumentContent,
} from "./featureDocument.ts";

test("crawl observations participate in source drift checks without changing legacy manifests", () => {
  const item = {
    stepIndex: 0,
    imageIndex: 0,
    imageId: 42,
    evidenceId: "IMAGE-42",
    stepLabel: "Cart",
    description: "Cart review",
  };
  const legacy = featureEvidenceManifestSha256([item]);
  const observed = featureEvidenceManifestSha256([{
    ...item,
    observation: stepAnalysisFixture(),
  }]);
  const changed = featureEvidenceManifestSha256([{
    ...item,
    observation: { ...stepAnalysisFixture(), likelyIntent: "Open payment" },
  }]);

  assert.notEqual(observed, legacy);
  assert.notEqual(changed, observed);
  assert.equal(featureEvidenceManifestSha256([item]), legacy);
  assert.equal(
    featureEvidenceManifestSha256([{
      ...item,
      observation: {
        confidence: 0.82,
        accessibility: ["Button label is visible"],
        missingOrUncertainStates: ["Interrupted session"],
        friction: ["No recovery guidance"],
        systemFeedback: [],
        availableActions: ["Continue"],
        likelyIntent: "Review the cart before checkout",
        visibleText: ["Continue"],
        visibleUi: ["Cart summary", "Continue button"],
        evidenceId: "IMAGE-42",
      },
    }]),
    observed,
  );
});

const claim = (
  id: string,
  text: string,
  kind: "observed" | "inferred" | "proposed" | "unknown" = "observed",
  evidenceIds: string[] = ["FLOW-STEP-01", "IMAGE-42"],
) => ({ id, kind, text, evidenceIds, confidence: 0.82 });

function completeDocumentFixture() {
  return {
    executiveSummary: {
      purpose: claim("summary-purpose", "Help users recover checkout", "proposed", []),
      userValue: claim("summary-value", "Users can continue after an interruption", "inferred"),
      recommendation: claim("summary-recommendation", "Preserve checkout progress", "proposed", ["FLOW-STEP-01"]),
    },
    observedFlow: {
      userGoal: claim("flow-goal", "Complete checkout"),
      entryPoint: claim("flow-entry", "Cart review"),
      completionPoint: claim("flow-completion", "Order confirmation", "unknown", []),
      journey: [claim("journey-1", "Review cart")],
      actors: [claim("actor-1", "Shopper", "inferred")],
      visibleStates: [claim("state-1", "Cart with one item")],
    },
    flowAnalysis: {
      effectivePatterns: [claim("pattern-1", "Primary action remains visible")],
      friction: [claim("friction-1", "No recovery explanation")],
      missingStates: [claim("missing-1", "Recovery state is not shown", "inferred")],
      inconsistencies: [],
      risksAndAssumptions: [claim("risk-1", "Session persistence is unknown", "unknown", [])],
    },
    proposedFeature: {
      problem: claim("problem-1", "Interrupted users may lose progress", "inferred"),
      targetUsers: [claim("target-1", "Returning shoppers", "proposed", [])],
      goals: [claim("goal-1", "Restore checkout", "proposed", [])],
      nonGoals: [claim("non-goal-1", "Change payment providers", "proposed", [])],
      behavior: [claim("behavior-1", "Save checkout progress", "proposed", ["IMAGE-42"])],
      journey: [claim("proposed-journey-1", "Resume from the saved cart", "proposed", ["FLOW-STEP-01"])],
    },
    requirements: [{
      ...claim("requirement-1", "The system preserves checkout progress", "proposed", ["IMAGE-42"]),
      userStory: "As a shopper, I want to resume checkout so that I can finish my purchase.",
      priority: "must",
      preconditions: ["The shopper has started checkout."],
      acceptanceCriteria: [{
        id: "criterion-1",
        given: "a shopper has entered checkout",
        when: "the session is interrupted",
        then: "the shopper can resume the saved checkout",
        evidenceIds: ["IMAGE-42"],
      }],
    }],
    edgeCases: [claim("edge-1", "Saved inventory becomes unavailable", "proposed", [])],
    successMetrics: [claim("metric-1", "Checkout recovery completion rate", "proposed", [])],
    guardrailMetrics: [claim("guardrail-1", "Incorrect restoration rate", "proposed", [])],
    analyticsEvents: [claim("event-1", "checkout_recovery_opened", "proposed", [])],
    dependencies: [claim("dependency-1", "Checkout session storage", "unknown", [])],
    openQuestions: [claim("question-1", "How long is progress retained?", "unknown", [])],
  };
}

function stepAnalysisFixture() {
  return {
    evidenceId: "IMAGE-42",
    visibleUi: ["Cart summary", "Continue button"],
    visibleText: ["Continue"],
    likelyIntent: "Review the cart before checkout",
    availableActions: ["Continue"],
    systemFeedback: [],
    friction: ["No recovery guidance"],
    missingOrUncertainStates: ["Interrupted session"],
    accessibility: ["Button label is visible"],
    confidence: 0.82,
  };
}

test("renders a concise Document Flow without repeating technical analysis", () => {
  const fixture = completeDocumentFixture();
  fixture.openQuestions.push(
    claim("question-duplicate", "Recovery state is not shown", "unknown", []),
  );
  const content = parseFeatureDocumentContent(
    fixture,
    new Set(["FLOW-STEP-01", "IMAGE-42"]),
  );
  const markdown = renderFeatureDocumentMarkdown("Checkout recovery", content, {
    sourceFlowTitle: "Recover checkout",
    generatedAt: "2026-07-22T00:00:00.000Z",
    evidenceManifest: [
      { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: "IMAGE-42", stepLabel: "Cart", description: "Cart review" },
      { stepIndex: 0, imageIndex: 1, imageId: 43, evidenceId: "FLOW-STEP-01", stepLabel: "Cart", description: "Cart detail" },
    ],
  });

  assert.equal(content.requirements[0].kind, "proposed");
  assert.match(markdown, /## Summary/);
  assert.match(markdown, /## Observed steps/);
  assert.match(markdown, /1\. Review cart \[FLOW-STEP-01, IMAGE-42\]/);
  assert.match(markdown, /## Behavior requirements/);
  assert.match(markdown, /\*\*Behavior:\*\* The system preserves checkout progress/);
  assert.match(markdown, /\*\*Status:\*\* Proposed/);
  assert.match(markdown, /\*\*Evidence:\*\* IMAGE-42/);
  assert.match(markdown, /#### Scenario criterion-1/);
  assert.match(markdown, /\*\*Given\*\* a shopper has entered checkout/);
  assert.match(markdown, /\*\*When\*\* the session is interrupted/);
  assert.match(markdown, /\*\*Then\*\* the shopper can resume the saved checkout/);
  assert.match(markdown, /## Missing evidence/);
  assert.match(markdown, /FLOW-STEP-01/);
  assert.match(markdown, /IMAGE-42/);
  assert.equal((markdown.match(/Recovery state is not shown/g) ?? []).length, 1);
  for (const repeatedSection of [
    "Executive summary",
    "Flow analysis",
    "Proposed feature",
    "Acceptance criteria",
    "User story",
    "Preconditions",
    "Evidence appendix",
  ]) {
    assert.doesNotMatch(markdown, new RegExp(repeatedSection, "i"));
  }
});

test("rejects an observed claim without evidence", () => {
  const fixture = completeDocumentFixture();
  fixture.flowAnalysis.friction[0] = claim("friction-1", "No feedback", "observed", []);
  assert.throws(
    () => parseFeatureDocumentContent(fixture, new Set(["FLOW-STEP-01", "IMAGE-42"])),
    /requires evidence/,
  );
});

test("rejects citations outside the evidence manifest", () => {
  const fixture = completeDocumentFixture();
  fixture.executiveSummary.recommendation.evidenceIds = ["IMAGE-999"];
  assert.throws(
    () => parseFeatureDocumentContent(fixture, new Set(["FLOW-STEP-01", "IMAGE-42"])),
    /unknown evidence: IMAGE-999/,
  );
});

test("rejects duplicate claim and acceptance criterion identities", () => {
  const fixture = completeDocumentFixture();
  fixture.edgeCases.push(claim("friction-1", "Duplicate identity", "proposed", []));
  assert.throws(
    () => parseFeatureDocumentContent(fixture, new Set(["FLOW-STEP-01", "IMAGE-42"])),
    /duplicate feature document id: friction-1/,
  );
});

function evidenceBackedFixture(): FeatureDocumentContent {
  const fixture = completeDocumentFixture();
  return {
    ...fixture,
    unscopedEvidence: [],
    sourceAssessment: {
      captureType: "partial-journey",
      completeness: "partial",
      rationale: "The capture shows visible states but no explicit interaction annotation.",
      evidenceIds: ["IMAGE-42"],
    },
    observedFlow: {
      ...fixture.observedFlow,
      journey: [],
      actors: [],
      visibleStates: [],
    },
    flowAnalysis: {
      effectivePatterns: [],
      friction: [],
      missingStates: [],
      inconsistencies: [],
      risksAndAssumptions: [],
    },
    proposedFeature: {
      ...fixture.proposedFeature,
      targetUsers: [],
      goals: [],
      nonGoals: [],
      behavior: [],
      journey: [],
    },
    requirements: [{
      ...claim("REQ-001", "The cart displays a continuation control", "inferred", ["IMAGE-42", "FLOW-STEP-01"]),
      userStory: "As a shopper, I can identify the visible continuation control.",
      priority: "unranked",
      preconditions: ["The cart is visible."],
      acceptanceCriteria: [{
        id: "AC-001",
        kind: "inferred",
        given: "the cart screen is visible",
        when: "the shopper reviews the available controls",
        then: "a continuation control is present",
        evidenceIds: ["IMAGE-42"],
      }, {
        id: "AC-002",
        kind: "inferred",
        given: "the checkout screen is visible",
        when: "the shopper reviews the available controls",
        then: "a continuation control remains available",
        evidenceIds: ["FLOW-STEP-01"],
      }],
    }],
    edgeCases: [],
    successMetrics: [],
    guardrailMetrics: [],
    analyticsEvents: [],
    dependencies: [],
    openQuestions: [],
  };
}

test("accepts an evidence-backed replication document with classified criteria", () => {
  const parsed = parseFeatureDocumentContent(
    evidenceBackedFixture(),
    new Set(["FLOW-STEP-01", "IMAGE-42"]),
    {
      evidenceBacked: true,
      evidenceManifest: [
        { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: "IMAGE-42", stepLabel: "Cart", description: null },
        { stepIndex: 1, imageIndex: 0, imageId: 43, evidenceId: "FLOW-STEP-01", stepLabel: "Checkout", description: null },
      ],
      analyses: [],
    },
  );

  assert.equal(parsed.sourceAssessment?.completeness, "partial");
  assert.equal(parsed.requirements[0].priority, "unranked");
  assert.equal(parsed.requirements[0].acceptanceCriteria[0].kind, "inferred");
});

test("requires multiple acceptance criteria for multi-state evidence", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].acceptanceCriteria = fixture.requirements[0].acceptanceCriteria.slice(0, 1);
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      {
        evidenceBacked: true,
        evidenceManifest: [
          { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: "IMAGE-42", stepLabel: "Cart", description: null },
          { stepIndex: 1, imageIndex: 0, imageId: 43, evidenceId: "FLOW-STEP-01", stepLabel: "Checkout", description: null },
        ],
        analyses: [],
      },
    ),
    /requires at least two acceptance criteria for multi-state evidence/,
  );
});

test("keeps official documentation separate from visual evidence", () => {
  const fixture = {
    ...evidenceBackedFixture(),
    documentedContext: {
      status: "researched",
      sources: [{
        id: "DOC-001",
        title: "Shopee Account and Security",
        url: "https://help.shopee.co.id/portal/article/official-account-security",
        retrievedAt: "2026-07-30T00:00:00.000Z",
        platform: "ios",
        region: "Indonesia",
      }],
      claims: [{
        id: "DCL-001",
        text: "Shopee documents account-security controls in its Help Centre.",
        sourceIds: ["DOC-001"],
        relationship: "extends",
        visualEvidenceIds: [],
        unresolved: true,
      }],
    },
  };
  const parsed = parseFeatureDocumentContent(
    fixture,
    new Set(["FLOW-STEP-01", "IMAGE-42"]),
    {
      evidenceBacked: true,
      evidenceManifest: [
        { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: "IMAGE-42", stepLabel: "Cart", description: null },
        { stepIndex: 0, imageIndex: 1, imageId: 43, evidenceId: "FLOW-STEP-01", stepLabel: "Cart", description: null },
      ],
      analyses: [stepAnalysisFixture()],
      officialDocumentationDomains: ["shopee.co.id"],
    },
  );

  assert.equal(parsed.documentedContext?.status, "researched");
  assert.equal(parsed.documentedContext?.sources[0]?.id, "DOC-001");
  assert.equal(parsed.documentedContext?.claims[0]?.relationship, "extends");
  assert.deepEqual(parsed.documentedContext?.claims[0]?.visualEvidenceIds, []);
});

test("rejects unofficial and uncited documented context", () => {
  const fixture = {
    ...evidenceBackedFixture(),
    documentedContext: {
      status: "researched",
      sources: [{
        id: "DOC-001",
        title: "Unofficial guide",
        url: "https://example.com/shopee-guide",
        retrievedAt: "2026-07-30T00:00:00.000Z",
        platform: "ios",
        region: "Indonesia",
      }],
      claims: [{
        id: "DCL-001",
        text: "An unsupported claim.",
        sourceIds: ["DOC-404"],
        relationship: "supports",
        visualEvidenceIds: ["IMAGE-42"],
        unresolved: false,
      }],
    },
  };
  const options = {
    evidenceBacked: true,
    evidenceManifest: [
      { stepIndex: 0, imageIndex: 0, imageId: 42, evidenceId: "IMAGE-42", stepLabel: "Cart", description: null },
      { stepIndex: 0, imageIndex: 1, imageId: 43, evidenceId: "FLOW-STEP-01", stepLabel: "Cart", description: null },
    ],
    analyses: [stepAnalysisFixture()],
    officialDocumentationDomains: ["shopee.co.id"],
  };

  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      options,
    ),
    /documentedContext source domain is not allowed/,
  );
  fixture.documentedContext.sources[0]!.url =
    "https://help.shopee.co.id/portal/article/official-account-security";
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      options,
    ),
    /unknown documented source: DOC-404/,
  );
});

test("rejects evidence-backed requirements that omit criterion evidence", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].evidenceIds = ["FLOW-STEP-01"];
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /must include all acceptance-criterion evidence/,
  );
});

test("rejects an observed state transition without before-after or visible-feedback evidence", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].acceptanceCriteria[0] = {
    ...fixture.requirements[0].acceptanceCriteria[0],
    kind: "observed",
    when: "the shopper taps Save",
  };
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /needs before\/after or visible-feedback evidence/,
  );
});

test("requires every screenshot to be scoped by requirements or explicitly unscoped", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].acceptanceCriteria = fixture.requirements[0].acceptanceCriteria.slice(0, 1);
  fixture.requirements[0].evidenceIds = ["IMAGE-42"];
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /evidence is not covered by requirements or unscopedEvidence: FLOW-STEP-01/,
  );

  fixture.unscopedEvidence = [{
    evidenceId: "FLOW-STEP-01",
    reason: "This screenshot repeats the same state and adds no implementation behavior.",
  }];
  assert.doesNotThrow(() => parseFeatureDocumentContent(
    fixture,
    new Set(["FLOW-STEP-01", "IMAGE-42"]),
    { evidenceBacked: true, evidenceManifest: [], analyses: [] },
  ));
});

test("rejects priority wording on an unranked requirement", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].text = "The cart must display a continuation control";
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /cannot use priority language/,
  );
});

test("enforces a bounded claim budget for small captures", () => {
  const fixture = evidenceBackedFixture();
  fixture.edgeCases = Array.from(
    { length: 25 },
    (_, index) => claim(`edge-budget-${index}`, `Proposed edge case ${index}`, "proposed", []),
  );
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /exceeds the 24-claim budget/,
  );
});

test("rejects loading completion without visible loading evidence", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].acceptanceCriteria[0].when = "the view finishes loading";
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /cannot claim loading completion without visible loading evidence/,
  );
});

test("requires interaction metadata for observed requirement-level action capabilities", () => {
  const fixture = evidenceBackedFixture();
  fixture.requirements[0].kind = "observed";
  fixture.requirements[0].text = "The cart supports submission of the displayed choice";
  assert.throws(
    () => parseFeatureDocumentContent(
      fixture,
      new Set(["FLOW-STEP-01", "IMAGE-42"]),
      { evidenceBacked: true, evidenceManifest: [], analyses: [] },
    ),
    /cannot claim an observed interaction without interaction metadata/,
  );

  assert.doesNotThrow(() => parseFeatureDocumentContent(
    fixture,
    new Set(["FLOW-STEP-01", "IMAGE-42"]),
    {
      evidenceBacked: true,
      evidenceManifest: [{
        stepIndex: 0,
        imageIndex: 0,
        imageId: 42,
        evidenceId: "IMAGE-42",
        stepLabel: "Submit",
        interaction: "Tap submit",
        description: null,
      }],
      analyses: [],
    },
  ));
});

test("accepts only one bounded step analysis for its supplied evidence", () => {
  const result = parseFeatureStepAnalysis(stepAnalysisFixture(), "IMAGE-42");
  assert.equal(result.evidenceId, "IMAGE-42");
  assert.equal(result.confidence, 0.82);
  assert.throws(
    () => parseFeatureStepAnalysis({ ...stepAnalysisFixture(), evidenceId: "IMAGE-9" }, "IMAGE-42"),
    /evidence ID does not match/,
  );
});
