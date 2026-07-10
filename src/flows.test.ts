import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlowManifest } from "./flows.ts";

const manifest = JSON.stringify({
  flows: [{
    id: "login",
    title: "Login",
    description: "Authenticate with email and password",
    tags: ["Authentication"],
    steps: [
      { label: "Enter email", imageId: 7 },
      { label: "Enter password", imageId: 9 },
    ],
  }],
});

test("preserves curator-authored flow order", () => {
  const flows = parseFlowManifest(manifest, new Set([7, 9]));
  assert.deepEqual(flows[0].steps.map((step) => step.evidence[0]), [7, 9]);
});

test("rejects image ids outside the selected app", () => {
  assert.throws(() => parseFlowManifest(manifest, new Set([7])), /Unknown image id 9/);
});

test("rejects duplicate step image ids", () => {
  const duplicate = manifest.replace('{"label":"Enter password","imageId":9}', '{"label":"Enter password","imageId":7}');
  assert.throws(() => parseFlowManifest(duplicate, new Set([7])), /Duplicate image id 7/);
});

test("rejects duplicate flow ids", () => {
  const flow = JSON.parse(manifest).flows[0];
  assert.throws(() => parseFlowManifest(JSON.stringify({ flows: [flow, flow] }), new Set([7, 9])), /Duplicate flow id login/);
});
