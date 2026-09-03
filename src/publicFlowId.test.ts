import assert from "node:assert/strict";
import test from "node:test";
import { flowIdsMatch, publicFlowId, publicFlowReferenceId } from "./publicFlowId.ts";

test("replaces the internal Mobbin namespace with a neutral public Flow ID", () => {
  assert.equal(
    publicFlowId("mobbin-flow-68c35291-9004-4f43-8fa4-0c1cd625151f"),
    "flow-68c35291-9004-4f43-8fa4-0c1cd625151f",
  );
  assert.equal(publicFlowId("invite-admins"), "invite-admins");
});

test("matches neutral public Flow IDs with legacy internal IDs", () => {
  assert.equal(flowIdsMatch("flow-68c35291", "mobbin-flow-68c35291"), true);
  assert.equal(flowIdsMatch("mobbin-flow-68c35291", "mobbin-flow-68c35291"), true);
  assert.equal(flowIdsMatch("flow-first", "flow-second"), false);
});

test("removes the internal source from catalog Flow references", () => {
  assert.equal(
    publicFlowReferenceId("flow:tiktok:mobbin-flow-68c35291"),
    "flow:tiktok:flow-68c35291",
  );
  assert.equal(publicFlowReferenceId("screen:42"), "screen:42");
});
