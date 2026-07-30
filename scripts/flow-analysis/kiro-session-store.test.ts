import assert from "node:assert/strict";
import test from "node:test";
import {
  creditsFromUsageInfo,
  elapsedLabel,
} from "./kiro-session-store.ts";

test("sums and rounds Kiro credit usage", () => {
  assert.equal(creditsFromUsageInfo(JSON.stringify([
    { value: 0.0747, unit: "credit" },
    { value: 0.2087, unit: "credit" },
    { value: 999, unit: "tokens" },
  ])), 0.28);
});

test("formats persisted session elapsed time", () => {
  assert.equal(elapsedLabel(1_000, 126_000), "2m 5s");
});
