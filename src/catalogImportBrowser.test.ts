import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveMobbinContextOptions } from "./crawler.ts";

test("Apps browser defaults retain the existing environment contract", () => {
  assert.deepEqual(resolveMobbinContextOptions({}, {
    MOBBIN_PROFILE_DIR: "data/apps-profile",
    MOBBIN_STORAGE_STATE_PATH: "data/apps-state.json",
    HEADLESS: "true",
  }), {
    profileDir: "data/apps-profile",
    storageStatePath: "data/apps-state.json",
    headless: true,
  });
  assert.deepEqual(resolveMobbinContextOptions({}, {}), {
    profileDir: "data/browser-profile-mobbin",
    storageStatePath: undefined,
    headless: false,
  });
});

test("Sites browser options override both Apps profile inputs", () => {
  assert.deepEqual(resolveMobbinContextOptions({
    profileDir: "data/sites-profile",
    storageStatePath: "data/sites-state.json",
    headless: false,
  }, {
    MOBBIN_PROFILE_DIR: "data/apps-profile",
    MOBBIN_STORAGE_STATE_PATH: "data/apps-state.json",
    HEADLESS: "true",
  }), {
    profileDir: "data/sites-profile",
    storageStatePath: "data/sites-state.json",
    headless: false,
  });
});

test("fresh catalog discovery uses the authenticated headless Mobbin context", () => {
  const source = readFileSync(new URL("../scripts/catalog-import.ts", import.meta.url), "utf8");
  const fetchCatalog = source.match(/async function fetchCatalog[\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(fetchCatalog, /const context = await launchMobbinContext\(\);/);
  assert.doesNotMatch(fetchCatalog, /chromium\.launchPersistentContext/);
});
