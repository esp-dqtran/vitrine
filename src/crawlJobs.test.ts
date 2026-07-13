import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import type { CrawlPlan } from "./crawlPlan.ts";
import { createResearchAppJob } from "./crawlJobs.ts";

function draftPlan(): CrawlPlan {
  return {
    app: "atlassian",
    revision: 1,
    startUrl: "https://www.atlassian.com/",
    domain: "Teamwork software",
    sources: ["https://www.atlassian.com/software"],
    reviewed: false,
    flows: [{
      id: "browse-products",
      title: "Browse products",
      description: "Open the product catalog",
      safe: false,
      requiredSecrets: [],
      steps: [{
        id: "open-home",
        action: "goto",
        url: "/",
        safety: "side-effect",
        expected: { state: "Homepage", url: "https://www.atlassian.com/" },
      }],
    }],
  };
}

test("research job uses one provider session, parses the generated file, saves an unreviewed draft, and closes", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-research-job-"));
  const events: string[] = [];
  const ask = async () => "unused";
  let saved: CrawlPlan | undefined;
  let metadata: Record<string, unknown> | undefined;
  try {
    const run = createResearchAppJob({
      dataDir,
      startChatSession: async (provider) => {
        events.push(`session:${provider}`);
        return { ask, close: async () => { events.push("close"); } };
      },
      researchApp: async (name, homepageUrl, sessionAsk, root) => {
        events.push(`research:${name}:${homepageUrl}`);
        assert.equal(sessionAsk, ask);
        assert.equal(root, dataDir);
        const path = join(dataDir, "crawl-plans", name, "plan.json");
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify(draftPlan()));
        return path;
      },
      listPlans: async () => [],
      saveDraftPlan: async (plan, _userId, researchMetadata) => {
        events.push("save");
        saved = plan as CrawlPlan;
        metadata = researchMetadata;
      },
    });

    await run({ name: "atlassian", homepageUrl: "https://www.atlassian.com/" });

    assert.equal(saved?.revision, 1);
    assert.equal(saved?.reviewed, false);
    assert.equal(saved?.app, "atlassian");
    assert.deepEqual(metadata, {
      source: "research-app",
      provider: "chatgpt",
      homepageUrl: "https://www.atlassian.com/",
    });
    assert.deepEqual(events, [
      "session:chatgpt",
      "research:atlassian:https://www.atlassian.com/",
      "save",
      "close",
    ]);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("research regeneration saves the generated draft at the next revision without mutating prior plans", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-research-job-regenerate-"));
  const generated = draftPlan();
  const generatedSnapshot = structuredClone(generated);
  const prior = { revision: 7 };
  const priorSnapshot = structuredClone(prior);
  let saved: CrawlPlan | undefined;
  let closed = false;
  try {
    const run = createResearchAppJob({
      dataDir,
      startChatSession: async () => ({
        ask: async () => "unused",
        close: async () => { closed = true; },
      }),
      researchApp: async () => {
        const path = join(dataDir, "regenerated-plan.json");
        writeFileSync(path, JSON.stringify(generated));
        return path;
      },
      listPlans: async () => [prior],
      saveDraftPlan: async (plan) => { saved = plan as CrawlPlan; },
    });

    await run({ name: "atlassian", homepageUrl: "https://www.atlassian.com/" });

    assert.equal(saved?.revision, 8);
    assert.equal(saved?.reviewed, false);
    assert.ok(saved?.flows.every(({ safe }) => safe === false));
    assert.ok(saved?.flows.every(({ steps }) => steps.every(({ safety }) => safety === "side-effect")));
    assert.deepEqual(generated, generatedSnapshot);
    assert.deepEqual(prior, priorSnapshot);
    assert.equal(closed, true);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("research job closes the provider session when the generated plan is invalid", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-research-job-invalid-"));
  let closed = false;
  let saved = false;
  try {
    const run = createResearchAppJob({
      dataDir,
      startChatSession: async () => ({ ask: async () => "unused", close: async () => { closed = true; } }),
      researchApp: async () => {
        const path = join(dataDir, "bad-plan.json");
        writeFileSync(path, "not-json");
        return path;
      },
      saveDraftPlan: async () => { saved = true; },
    });

    await assert.rejects(
      () => run({ name: "atlassian", homepageUrl: "https://www.atlassian.com/", provider: "claude" }),
      /valid JSON/i,
    );
    assert.equal(saved, false);
    assert.equal(closed, true);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
