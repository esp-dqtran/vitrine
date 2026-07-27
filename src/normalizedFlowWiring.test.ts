import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sourceFor = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("active crawl and import paths do not use aggregate Flow columns", () => {
  const activeFiles = [
    "src/db.ts",
    "src/bulkDownload.ts",
    "src/flows.ts",
    "src/smartCrawler.ts",
    "src/crawlStore.ts",
    "src/autonomousStore.ts",
    "src/catalogVerification.ts",
    "services/api/src/app.ts",
    "services/import-worker/src/index.ts",
    "scripts/catalog-import.ts",
    "scripts/merge-catalog-databases.ts",
    "scripts/verify-catalog-import.ts",
  ];

  for (const path of activeFiles) {
    const source = sourceFor(path);
    assert.doesNotMatch(
      source,
      /INSERT INTO app_flows\s*\([^)]*\bflows\b/,
      `${path} writes the removed app_flows.flows aggregate`,
    );
    assert.doesNotMatch(
      source,
      /INSERT INTO app_flow_versions\s*\([^)]*\bflows\b/,
      `${path} writes the removed app_flow_versions.flows aggregate`,
    );
    assert.doesNotMatch(
      source,
      /UPDATE app_flows SET flows\b/,
      `${path} updates the removed app_flows.flows aggregate`,
    );
    assert.doesNotMatch(
      source,
      /\b(?:af|afv)\.flows\b/,
      `${path} reads a removed aggregate Flow column`,
    );
  }
});

test("existing complete-import producers retain their saveAppFlows seam", () => {
  for (const path of [
    "src/bulkDownload.ts",
    "src/flows.ts",
    "src/smartCrawler.ts",
    "services/api/src/app.ts",
  ]) {
    assert.match(sourceFor(path), /\bsaveAppFlows\b/, path);
  }
  assert.match(sourceFor("scripts/catalog-import.ts"), /\bcrawlFlowsDownload\b/);
});

test("planned and autonomous crawlers delegate normalized persistence", () => {
  const planned = sourceFor("src/crawlStore.ts");
  assert.match(planned, /\breplaceCurrentFlows\b/);
  const autonomous = sourceFor("src/autonomousStore.ts");
  assert.match(autonomous, /\bmergeCurrentFlows\b/);
});
