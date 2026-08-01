import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOCKSUITE_VERSION,
  INTEGRATION_VERSION,
  OCTOBASE_COMMIT,
} from "./projectDocumentCompatibility.ts";

test("pins the approved BlockSuite and OctoBase compatibility set", () => {
  assert.equal(BLOCKSUITE_VERSION, "0.19.5");
  assert.equal(
    OCTOBASE_COMMIT,
    "58f3bbdf97f391a535e772d32828a484376c4159",
  );
  assert.equal(
    INTEGRATION_VERSION,
    "blocksuite-0.19.5_octobase-58f3bbdf97f391a535e772d32828a484376c4159",
  );
});
