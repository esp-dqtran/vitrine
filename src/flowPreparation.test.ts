import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { CrawlPlan } from "./crawlPlan.ts";
import { flowPreparationRoot, prepareFlowWorkspace } from "./flowPreparation.ts";

const plan: CrawlPlan = {
  app: "linear",
  revision: 1,
  startUrl: "https://linear.app/",
  domain: "Issue tracking for product teams.",
  sources: ["https://linear.app/features"],
  reviewed: false,
  flows: [
    {
      id: "browse-features",
      title: "Browse features",
      description: "Understand the product's core capabilities.",
      safe: false,
      requiredSecrets: [],
      steps: [{
        id: "open-features",
        action: "goto",
        url: "/features",
        safety: "side-effect",
        expected: { state: "Features", url: "https://linear.app/features" },
      }],
    },
    {
      id: "read-docs",
      title: "Read docs",
      description: "Open the documentation.",
      safe: false,
      requiredSecrets: [],
      steps: [],
    },
  ],
};

test("prepares a cited per-Flow directory structure without capturing screens", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "vitrines-flow-preparation-"));
  try {
    const workspace = prepareFlowWorkspace(
      plan,
      [
        { url: "https://linear.app/features", text: "Feature research" },
        { url: "https://linear.app/docs", text: "Documentation research" },
      ],
      dataDir,
      () => new Date("2026-08-09T10:00:00.000Z"),
    );

    assert.equal(workspace.root, join(dataDir, "flow-preparation", "linear"));
    assert.equal(workspace.flows.length, 2);
    for (const flow of workspace.flows) {
      assert.ok(existsSync(flow.definitionPath));
      assert.ok(existsSync(flow.screensPath));
      assert.ok(existsSync(flow.evidencePath));
    }

    const manifest = JSON.parse(readFileSync(workspace.manifestPath, "utf8"));
    assert.equal(manifest.status, "prepared");
    assert.equal(manifest.reviewed, false);
    assert.deepEqual(manifest.flows[0], {
      id: "browse-features",
      directory: "flows/browse-features",
      definition: "flows/browse-features/flow.json",
      screens: "flows/browse-features/screens",
      evidence: "flows/browse-features/evidence",
    });

    const sources = JSON.parse(readFileSync(workspace.sourcesPath, "utf8"));
    assert.equal(sources.sources.length, 2);
    assert.equal(sources.sources[0].selectedForPlan, true);
    assert.equal(sources.sources[1].selectedForPlan, false);
    assert.equal(sources.sources[0].text, undefined, "raw page contents are not persisted");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("normalizes unsafe directory characters and resolves Flow directory collisions", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "vitrines-flow-segments-"));
  try {
    const workspace = prepareFlowWorkspace({
      ...plan,
      app: "Linear Product",
      flows: [
        { ...plan.flows[0], id: "Browse / Features" },
        { ...plan.flows[1], id: "Browse --- Features" },
      ],
    }, [], dataDir);
    assert.equal(workspace.root, flowPreparationRoot("Linear Product", dataDir));
    assert.deepEqual(workspace.flows.map(({ directory }) => directory), ["browse-features", "browse-features-2"]);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
