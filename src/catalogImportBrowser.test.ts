import assert from "node:assert/strict";
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
