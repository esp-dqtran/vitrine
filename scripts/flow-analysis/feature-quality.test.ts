import assert from "node:assert/strict";
import test from "node:test";
import { qualityGateFeature } from "./feature-quality.ts";

function feature(): Record<string, unknown> {
  return {
    featureDescription: "Manage payment settings.",
    orderedSteps: [
      { evidenceId: "S01", confidence: 95 },
      { evidenceId: "S02", confidence: 0.8 },
    ],
    observedBehavior: [{ evidenceIds: ["S01"] }],
    inferredRules: [{ evidenceIds: ["S02"], confidence: 80 }],
    requirements: [{ evidenceIds: ["S01"] }],
    edgeCases: [{ evidenceIds: [] }],
    acceptanceCriteria: [{ evidenceIds: ["S01", "S02"] }],
  };
}

test("normalizes Gemini percentage confidence values", () => {
  const result = qualityGateFeature(feature(), ["S01", "S02"]);
  const value = result.value as {
    orderedSteps: Array<{ confidence: number }>;
    inferredRules: Array<{ confidence: number }>;
  };

  assert.deepEqual(value.orderedSteps.map(({ confidence }) => confidence), [0.95, 0.8]);
  assert.deepEqual(value.inferredRules.map(({ confidence }) => confidence), [0.8]);
  assert.deepEqual(result.warnings, [
    "confidence values normalized from percent to decimal",
  ]);
  assert.equal(result.score, 95);
});

test("rejects missing, reordered, or foreign evidence", () => {
  assert.throws(
    () => qualityGateFeature(feature(), ["S02", "S01"]),
    /Ordered evidence IDs/,
  );
  const invalid = feature();
  invalid.requirements = [{ evidenceIds: ["S99"] }];
  assert.throws(
    () => qualityGateFeature(invalid, ["S01", "S02"]),
    /Unknown evidence ID S99/,
  );
});

test("flags provider output that leaks the uploaded filename", () => {
  const input = feature();
  input.featureDescription = "Based on payment-settings.jpg, manage payment settings.";
  const result = qualityGateFeature(input, ["S01", "S02"]);

  assert.ok(result.warnings.includes("featureDescription mentions the uploaded filename"));
});
