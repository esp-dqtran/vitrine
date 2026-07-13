import assert from "node:assert/strict";
import { test } from "node:test";
import type { CrawlPlan } from "../crawlPlan.ts";
import {
  applyCrawlRepair,
  approveCrawlPlan,
  cancelCrawlRun,
  createCrawlRun,
  getCrawlPlan,
  getCrawlRun,
  listCrawlPlans,
  listCrawlRuns,
  rejectCrawlRepair,
  requestCrawlRepair,
  researchCrawlApp,
  retryCrawlRun,
  saveCrawlPlan,
} from "./researchApi.ts";

const plan: CrawlPlan = {
  app: "atlassian",
  revision: 2,
  startUrl: "https://www.atlassian.com/",
  domain: "Team collaboration and developer tools.",
  sources: [],
  reviewed: false,
  flows: [],
};

test("crawler API helpers use the admin crawl routes and JSON bodies", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}),
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await researchCrawlApp("atlassian", "https://www.atlassian.com/", "claude");
  await listCrawlPlans("atlassian");
  await getCrawlPlan("11");
  await saveCrawlPlan("11", plan);
  await approveCrawlPlan("11");
  await createCrawlRun("atlassian", { planId: "11", mode: "full", environment: { headless: true } });
  await listCrawlRuns("atlassian");
  await getCrawlRun("21");
  await cancelCrawlRun("21");
  await retryCrawlRun("21", "failed");
  await requestCrawlRepair("21", { flowId: "browse-products", stepId: "open-software", provider: "chatgpt" });
  await applyCrawlRepair("31");
  await rejectCrawlRepair("31");

  assert.deepEqual(requests, [
    { url: "/api/crawl/apps/atlassian/research", method: "POST", body: { homepageUrl: "https://www.atlassian.com/", provider: "claude" } },
    { url: "/api/crawl/apps/atlassian/plans", method: "GET" },
    { url: "/api/crawl/plans/11", method: "GET" },
    { url: "/api/crawl/plans/11", method: "PUT", body: plan },
    { url: "/api/crawl/plans/11/approve", method: "POST" },
    { url: "/api/crawl/apps/atlassian/runs", method: "POST", body: { planId: "11", mode: "full", environment: { headless: true } } },
    { url: "/api/crawl/apps/atlassian/runs", method: "GET" },
    { url: "/api/crawl/runs/21", method: "GET" },
    { url: "/api/crawl/runs/21/cancel", method: "POST" },
    { url: "/api/crawl/runs/21/retry", method: "POST", body: { mode: "failed" } },
    { url: "/api/crawl/runs/21/repairs", method: "POST", body: { flowId: "browse-products", stepId: "open-software", provider: "chatgpt" } },
    { url: "/api/crawl/repairs/31/apply", method: "POST" },
    { url: "/api/crawl/repairs/31/reject", method: "POST" },
  ]);
});
