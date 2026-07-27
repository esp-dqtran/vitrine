import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseFeatureDocumentContent,
  parseFeatureStepAnalysis,
  renderFeatureDocumentMarkdown,
} from "./featureDocument.ts";

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

test("accepts only one bounded step analysis for its supplied evidence", () => {
  const result = parseFeatureStepAnalysis(stepAnalysisFixture(), "IMAGE-42");
  assert.equal(result.evidenceId, "IMAGE-42");
  assert.equal(result.confidence, 0.82);
  assert.throws(
    () => parseFeatureStepAnalysis({ ...stepAnalysisFixture(), evidenceId: "IMAGE-9" }, "IMAGE-42"),
    /evidence ID does not match/,
  );
});
