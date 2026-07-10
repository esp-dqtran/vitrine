import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCaptionReply } from "./caption.ts";

test("parses a structured caption reply", () => {
  const analysis = parseCaptionReply(JSON.stringify({
    description: "A dark settings page.",
    purpose: "Manage account preferences",
    pageType: "Settings",
    productArea: "Account",
    theme: "dark",
    visibleStates: ["selected navigation item"],
    componentNames: ["Side navigation", "Toggle"],
  }));
  assert.equal(analysis.productArea, "Account");
  assert.deepEqual(analysis.componentNames, ["Side navigation", "Toggle"]);
});

test("rejects an unstructured caption reply", () => {
  assert.throws(() => parseCaptionReply("A dark settings page."), /valid JSON/);
});
