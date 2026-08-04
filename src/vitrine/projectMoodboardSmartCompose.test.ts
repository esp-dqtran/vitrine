import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMoodboardPixels,
  buildMoodboardSmartComposeResult,
  normalizeMoodboardSmartComposeResult,
} from "./projectMoodboardSmartCompose.ts";

test("Smart Compose extracts distinct colors and labels automated interpretations", () => {
  const pixels = new Uint8ClampedArray([
    244, 244, 244, 255,
    244, 244, 244, 255,
    32, 64, 224, 255,
    32, 64, 224, 255,
  ]);
  const analysis = analyzeMoodboardPixels("ref-1", pixels, 2, 2);
  const result = buildMoodboardSmartComposeResult({
    references: [{
      elementId: "ref-1",
      sourceLabel: "Checkout",
      sourceUrl: "/apps/checkout",
      caption: "Use the clear hierarchy.",
      decision: "keep",
      sectionId: "direction-a",
    }],
    sections: [{ id: "direction-a", title: "Direction A" }],
    analyses: [analysis],
    generatedAt: "2026-08-04T00:00:00.000Z",
  });

  assert.ok(result.palette.length >= 2);
  assert.deepEqual(result.basis, { keepCount: 1, sampledCount: 1 });
  assert.equal(result.signals.at(-1)?.label, "Typography");
  assert.equal(result.signals.at(-1)?.value, "Needs designer review");
  assert.match(result.sections[0].summary, /Designer anchors: Use the clear hierarchy/);
  assert.deepEqual(result.sections[0].sources, [{ label: "Checkout", url: "/apps/checkout" }]);
  assert.deepEqual(normalizeMoodboardSmartComposeResult(result), result);
});

test("Smart Compose withholds visual conclusions when nothing is marked Keep", () => {
  const result = buildMoodboardSmartComposeResult({
    references: [{
      elementId: "ref-1",
      sourceLabel: "Reference",
      caption: "",
      decision: "maybe",
      sectionId: "unsorted",
    }],
    sections: [{ id: "unsorted", title: "Unsorted" }],
    analyses: [],
  });

  assert.deepEqual(result.palette, []);
  assert.deepEqual(result.basis, { keepCount: 0, sampledCount: 0 });
  assert.deepEqual(result.signals, []);
  assert.match(result.sections[0].summary, /Add captions to record the design rationale/);
});
