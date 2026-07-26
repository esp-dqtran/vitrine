import assert from "node:assert/strict";
import test from "node:test";
import { appendUniqueApps } from "./useApps.ts";

test("appends server-ordered pages without duplicates or reordering", () => {
  const current = [{ id: "tubi" }, { id: "ipsy" }];
  const next = [{ id: "ipsy" }, { id: "zip" }];
  assert.deepEqual(
    appendUniqueApps(current as never[], next as never[]).map(({ id }) => id),
    ["tubi", "ipsy", "zip"],
  );
});
