import { test } from "node:test";
import assert from "node:assert/strict";
import { GETDESIGN_APP_MAPPINGS } from "./getdesignCatalog.ts";

test("defines 44 unique GetDesign-to-Astryx web mappings", () => {
  assert.equal(GETDESIGN_APP_MAPPINGS.length, 44);
  assert.equal(new Set(GETDESIGN_APP_MAPPINGS.map(({ sourceSlug }) => sourceSlug)).size, 44);
  assert.equal(new Set(GETDESIGN_APP_MAPPINGS.map(({ app }) => app)).size, 44);
  assert.deepEqual(
    GETDESIGN_APP_MAPPINGS
      .filter(({ createWebPlatform }) => createWebPlatform)
      .map(({ app }) => app)
      .sort(),
    ["my-bmw", "playstation-app", "raycast", "starbucks", "tesla"],
  );
  assert.ok(GETDESIGN_APP_MAPPINGS.every(({ platform }) => platform === "web"));
});
