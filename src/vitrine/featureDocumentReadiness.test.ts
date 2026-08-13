import assert from "node:assert/strict";
import { test } from "node:test";

import type { FeatureDocumentContent } from "../featureDocument.ts";
import { assessFeatureDocumentReadiness } from "../featureDocumentReadiness.ts";

const claim = (id: string, text: string, evidenceIds: string[] = []) => ({
  id,
  kind: "proposed" as const,
  text,
  evidenceIds,
});

const content = (): FeatureDocumentContent => ({
  executiveSummary: {
    purpose: claim("purpose", "Improve checkout"),
    userValue: claim("value", "Complete a purchase"),
    recommendation: claim("recommendation", "Preserve progress"),
  },
  observedFlow: {
    userGoal: claim("goal", "Checkout", ["IMAGE-1"]),
    entryPoint: claim("entry", "Cart", ["IMAGE-1"]),
    completionPoint: claim("complete", "Confirmation"),
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
    problem: claim("problem", "Progress can be lost"),
    targetUsers: [],
    goals: [],
    nonGoals: [],
    behavior: [],
    journey: [],
  },
  requirements: [{
    ...claim("REQ-1", "Restore checkout", ["IMAGE-1"]),
    userStory: "As a buyer, I can resume checkout.",
    priority: "must",
    preconditions: [],
    acceptanceCriteria: [{
      id: "AC-1",
      given: "a started checkout",
      when: "the buyer returns",
      then: "progress is restored",
      evidenceIds: ["IMAGE-1"],
    }],
  }],
  edgeCases: [],
  successMetrics: [claim("metric", "Completion rate increases")],
  guardrailMetrics: [],
  analyticsEvents: [],
  dependencies: [],
  openQuestions: [],
});

test("approval readiness separates hard blockers from human-review warnings", () => {
  const ready = assessFeatureDocumentReadiness(
    { sourceChanged: false },
    { content: content() },
  );
  assert.equal(ready.canApprove, true);
  assert.equal(ready.requirementCount, 1);
  assert.equal(ready.acceptanceCriteriaCount, 1);
  assert.equal(ready.supportedRequirementCount, 1);
  assert.deepEqual(ready.blockers, []);
  assert.deepEqual(ready.warnings, []);

  const incomplete = content();
  incomplete.requirements[0].acceptanceCriteria = [];
  incomplete.requirements[0].evidenceIds = [];
  incomplete.openQuestions.push(claim("question", "What happens offline?"));
  incomplete.successMetrics = [];
  const assessed = assessFeatureDocumentReadiness(
    { sourceChanged: true },
    { content: incomplete },
  );
  assert.equal(assessed.canApprove, false);
  assert.deepEqual(
    assessed.blockers.map(({ id }) => id),
    ["source-changed", "acceptance-criteria-missing"],
  );
  assert.deepEqual(
    assessed.warnings.map(({ id }) => id),
    ["evidence-missing", "open-questions", "success-metrics-missing"],
  );
});

test("an empty generated brief cannot be approved", () => {
  const empty = content();
  empty.requirements = [];
  const readiness = assessFeatureDocumentReadiness(
    { sourceChanged: false },
    { content: empty },
  );
  assert.equal(readiness.canApprove, false);
  assert.deepEqual(readiness.blockers.map(({ id }) => id), ["requirements-missing"]);
});
