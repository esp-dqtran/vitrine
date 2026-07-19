import assert from "node:assert/strict";
import test from "node:test";
import { featureKeyForLegacyAction, isFeatureKey, parseUsageRange } from "./featureUsage.ts";

test("accepts only the declared feature taxonomy", () => {
  assert.equal(isFeatureKey("exports"), true);
  assert.equal(isFeatureKey("protected-request"), false);
});

test("normalizes supported ranges and rejects arbitrary windows", () => {
  assert.deepEqual(parseUsageRange("30d"), { key: "30d", days: 30 });
  assert.deepEqual(parseUsageRange(undefined), { key: "30d", days: 30 });
  assert.equal(parseUsageRange("365d"), undefined);
});

test("maps useful historical actions without counting generic requests", () => {
  assert.equal(featureKeyForLegacyAction("export-figma"), "exports");
  assert.equal(featureKeyForLegacyAction("research_project_created"), "research");
  assert.equal(featureKeyForLegacyAction("protected-request"), undefined);
});
