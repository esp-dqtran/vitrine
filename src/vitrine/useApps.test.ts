import assert from "node:assert/strict";
import test from "node:test";
import { appendUniqueApps, catalogFacetPath } from "./useApps.ts";

test("appends server-ordered pages without duplicates or reordering", () => {
  const current = [{ id: "tubi" }, { id: "ipsy" }];
  const next = [{ id: "ipsy" }, { id: "zip" }];
  assert.deepEqual(
    appendUniqueApps(current as never[], next as never[]).map(({ id }) => id),
    ["tubi", "ipsy", "zip"],
  );
});

test("builds a server-side catalog path for category and flow facets", () => {
  assert.equal(
    catalogFacetPath({ group: "categories", value: "CRM" }, "web"),
    "/api/catalog?group=categories&value=CRM&platform=web",
  );
  assert.equal(
    catalogFacetPath(
      { group: "flows", value: "Setting Up" },
      "android",
      "next page",
    ),
    "/api/catalog?group=flows&value=Setting+Up&platform=android&cursor=next+page",
  );
});
