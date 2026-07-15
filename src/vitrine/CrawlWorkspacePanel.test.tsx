import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CrawlWorkspacePanel, createCrawlWorkspaceCommands, preparePlanRevision, shouldPollRunStatus, startRunPolling } from "./components/CrawlWorkspacePanel.tsx";
import type { CrawlPlanView, CrawlRepairView, CrawlRunDetailView, CrawlRunStatus, Job } from "./types.ts";

const planView: CrawlPlanView = {
  id: "11",
  app: "atlassian",
  revision: 2,
  status: "draft",
  requiredSecrets: [{ name: "ATLASSIAN_TEST_EMAIL", configured: false }],
  approved_by: null,
  approved_at: null,
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
  research_metadata: {},
  plan: {
    app: "atlassian",
    revision: 2,
    startUrl: "https://www.atlassian.com/",
    domain: "Team collaboration and developer tools.",
    sources: ["https://www.atlassian.com/software"],
    reviewed: false,
    flows: [{
      id: "browse-products",
      title: "Browse products",
      description: "Inspect the catalog.",
      safe: true,
      requiredSecrets: [],
      steps: [{
        id: "open-software",
        action: "goto",
        url: "/software",
        safety: "read",
        expected: { state: "Software catalog", url: "https://www.atlassian.com/software" },
      }],
    }],
  },
};

function runView(status: CrawlRunStatus): CrawlRunDetailView {
  return {
    run: {
      id: "21",
      app: "atlassian",
      version_id: 8,
      plan_id: "11",
      run_kind: "planned",
      parent_run_id: null,
      platform: "web",
      allow_all: false,
      pause_requested_at: null,
      status,
      current_flow_id: status === "running" ? "browse-products" : null,
      current_step_id: status === "running" ? "open-software" : null,
      completed_count: 1,
      failed_count: status === "failed" ? 1 : 0,
      skipped_count: 2,
      cancel_requested_at: null,
      retry_of_run_id: null,
      retry_mode: "all",
      environment: {
        headless: true,
        browserName: "chromium",
        requestedFlowIds: [],
        unsafeApproved: false,
        disposableAccountAcknowledged: false,
        allowSideEffects: false,
      },
      worker_id: status === "running" ? "worker-1" : null,
      heartbeat_at: status === "running" ? "2026-07-12T00:00:05.000Z" : null,
      created_at: "2026-07-12T00:00:00.000Z",
      started_at: "2026-07-12T00:00:01.000Z",
      finished_at: status === "running" || status === "queued" ? null : "2026-07-12T00:01:00.000Z",
      updated_at: "2026-07-12T00:00:05.000Z",
    },
    steps: [{
      run_id: "21",
      flow_id: "browse-products",
      step_id: "open-software",
      flow_order: 0,
      step_order: 0,
      status: status === "failed" ? "failed" : "completed",
      attempts: 1,
      source_url: "https://www.atlassian.com/",
      final_url: "https://www.atlassian.com/software",
      expected: { state: "Software catalog", url: "https://www.atlassian.com/software" },
      actual: { finalUrl: "https://www.atlassian.com/software", visible: status !== "failed" },
      observed_screenshot_hash: status === "failed" ? null : "abc",
      evidence_id: status === "failed" ? null : "51",
      error_class: status === "failed" ? "SemanticStepError" : null,
      error_message: status === "failed" ? "Expected Software catalog to be visible" : null,
      ...(status === "failed" ? { failureScreenshotUrl: "/api/crawl/runs/21/failures/open-software/screenshot" } : {}),
      created_at: "2026-07-12T00:00:00.000Z",
      started_at: "2026-07-12T00:00:01.000Z",
      finished_at: "2026-07-12T00:00:02.000Z",
      updated_at: "2026-07-12T00:00:02.000Z",
    }],
    evidence: status === "failed" ? [] : [{
      id: "51",
      version_id: 8,
      plan_id: "11",
      image_id: 71,
      flow_id: "browse-products",
      step_id: "open-software",
      source_url: "https://www.atlassian.com/",
      final_url: "https://www.atlassian.com/software",
      state_label: "Software catalog",
      screenshot_hash: "abc",
      viewport_width: 1440,
      viewport_height: 900,
      captured_at: "2026-07-12T00:00:02.000Z",
      imageUrl: "/api/media/atlassian/abc",
    }],
  };
}

const repair: CrawlRepairView = {
  id: "31",
  plan_id: "11",
  run_id: "21",
  flow_id: "browse-products",
  step_id: "open-software",
  proposed_step: {
    id: "open-software",
    action: "goto",
    url: "/software",
    safety: "read",
    expected: { state: "Current software catalog", url: "https://www.atlassian.com/software" },
  },
  failure: { error: "Expected Software catalog to be visible" },
  provider: "chatgpt",
  status: "proposed",
  reviewed_by: null,
  reviewed_at: null,
  applied_plan_id: null,
  created_at: "2026-07-12T00:02:00.000Z",
};

function researchJob(status: Job["status"], message: string | null = null): Job {
  return {
    id: 41,
    parent_id: null,
    type: "research-app",
    payload: { name: "atlassian", homepageUrl: "https://www.atlassian.com/" },
    status,
    message,
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:01.000Z",
  };
}

test("does not expose curator crawler controls to a normal user", () => {
  const html = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="user" />,
  );

  assert.doesNotMatch(html, /research|approve|start crawl|cancel|repair|retry|publish/i);
});

test("renders the empty curator workflow with app and homepage inputs", () => {
  const html = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" />,
  );

  assert.match(html, /Research and plan/);
  assert.match(html, /name="app"[^>]*value="atlassian"/);
  assert.match(html, /Public homepage/);
  assert.match(html, /Generate research/);
  assert.match(html, /No crawl plan yet/);
  assert.match(html, /Run/);
  assert.match(html, /Evidence and failures/);
  assert.match(html, /Draft and publication/);
  assert.match(html, /Autonomous discovery/);
  assert.match(html, /Provider/);
  assert.match(html, /Agent concurrency/);
  assert.match(html, /Allow all actions/);
  assert.match(html, /Start autonomous crawl/);
  assert.match(html, /Shared account session/);
});

test("renders queued, running, and error research job states", () => {
  for (const status of ["queued", "running"] as const) {
    const html = renderToStaticMarkup(
      <CrawlWorkspacePanel app="atlassian" role="admin" initialResearchJob={researchJob(status)} />,
    );
    assert.match(html, new RegExp(`Research ${status}`, "i"));
  }
  const failed = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialResearchJob={researchJob("error", "Research provider unavailable")} />,
  );
  assert.match(failed, /Research error/);
  assert.match(failed, /Research provider unavailable/);
});

test("renders an editable unapproved plan with sources, safety, and missing secret names", () => {
  const html = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={planView} />,
  );

  assert.match(html, /Revision 2/);
  assert.match(html, /Draft/);
  assert.match(html, /atlassian\.com\/software/);
  assert.match(html, /browse-products/);
  assert.match(html, /Browse products/);
  assert.match(html, /open-software/);
  assert.match(html, /Software catalog/);
  assert.match(html, /Safe/);
  assert.match(html, /ATLASSIAN_TEST_EMAIL/);
  assert.match(html, /Missing/);
  assert.match(html, /Save revision/);
  assert.match(html, /Approve plan/);
  assert.match(html, /Regenerate research/);
});

test("renders approved-plan run controls and every durable run status", () => {
  const approved = { ...planView, status: "approved" as const, plan: { ...planView.plan, reviewed: true } };
  const ready = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={approved} />,
  );
  assert.match(ready, /Start crawl/);
  assert.match(ready, /Headless/);
  assert.doesNotMatch(ready, /Approve plan/);

  for (const status of ["queued", "running", "succeeded", "failed", "cancelled", "interrupted"] as const) {
    const html = renderToStaticMarkup(
      <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={approved} initialRun={runView(status)} />,
    );
    assert.match(html, new RegExp(status, "i"), status);
    assert.match(html, /Run 21/);
  }

  const running = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={approved} initialRun={runView("running")} />,
  );
  assert.match(running, /browse-products/);
  assert.match(running, /open-software/);
  assert.match(running, /1 completed/);
  assert.match(running, /2 skipped/);
  assert.match(running, /Headless/);
  assert.match(running, /Chromium/);
  assert.match(running, /Cancel run/);

  const failed = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={approved} initialRun={runView("failed")} />,
  );
  assert.match(failed, /Retry failed flows/);
  assert.match(failed, /Retry full run/);

  const nextApproved = { ...approved, id: "12", revision: 3, plan: { ...approved.plan, revision: 3 } };
  const oldRun = runView("succeeded");
  oldRun.run.plan_id = "11";
  const next = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={nextApproved} initialRun={oldRun} />,
  );
  assert.match(next, /Run 21/);
  assert.match(next, /Start crawl/);
});

test("renders canonical evidence, exact failure diagnostics, and explicit repair review", () => {
  const approved = { ...planView, status: "approved" as const, plan: { ...planView.plan, reviewed: true } };
  const evidence = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={approved} initialRun={runView("succeeded")} />,
  );
  assert.match(evidence, /Software catalog/);
  assert.match(evidence, /1440×900/);
  assert.match(evidence, /Validated capture/);

  const failure = renderToStaticMarkup(
    <CrawlWorkspacePanel app="atlassian" role="admin" initialPlan={approved} initialRun={runView("failed")} initialRepairs={[repair]} />,
  );
  assert.match(failure, /Incomplete/);
  assert.match(failure, /SemanticStepError/);
  assert.match(failure, /Expected Software catalog to be visible/);
  assert.match(failure, /Action/);
  assert.match(failure, /goto/);
  assert.match(failure, /Locator/);
  assert.match(failure, /url=\/software/);
  assert.match(failure, /Expected/);
  assert.match(failure, /Actual/);
  assert.match(failure, /Failure screenshot/);
  assert.match(failure, /Request repair/);
  assert.match(failure, /Current software catalog/);
  assert.match(failure, /Original step/);
  assert.match(failure, /Proposed step/);
  assert.match(failure, /Changed fields/);
  assert.match(failure, /Apply repair/);
  assert.match(failure, /Reject repair/);
  assert.match(failure, /new unapproved revision/i);
});

test("failure and repair diagnostics stay pinned to the run plan instead of the editable latest plan", () => {
  const latest: CrawlPlanView = {
    ...planView,
    id: "12",
    revision: 3,
    plan: {
      ...planView.plan,
      revision: 3,
      flows: [{
        ...planView.plan.flows[0],
        steps: [{ ...planView.plan.flows[0].steps[0], url: "/changed-after-run" }],
      }],
    },
  };
  const failedRun = runView("failed");
  const html = renderToStaticMarkup(
    <CrawlWorkspacePanel
      app="atlassian"
      role="admin"
      initialPlan={latest}
      initialRun={failedRun}
      initialRunPlan={planView}
      initialRepairs={[repair]}
    />,
  );
  assert.match(html, /Locator:<\/strong> url=\/software/);
  assert.doesNotMatch(html, /Locator:<\/strong> url=\/changed-after-run/);
  assert.match(html, /Original step[\s\S]*\/software/);
});

test("run polling stops updates and clears its timer on cleanup", async () => {
  let tick: (() => void) | undefined;
  let cleared = false;
  let loads = 0;
  const updates: string[] = [];
  const stop = startRunPolling(
    async () => { loads++; return runView("running"); },
    (value) => updates.push(value.run.status),
    {
      set: (callback) => { tick = callback; return 17; },
      clear: (timer) => { assert.equal(timer, 17); cleared = true; },
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loads, 1);
  assert.deepEqual(updates, ["running"]);

  stop();
  assert.equal(cleared, true);
  tick?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loads, 2);
  assert.deepEqual(updates, ["running"]);
});

test("terminal run polling refreshes the existing draft-version controls", async () => {
  let settled = 0;
  const stop = startRunPolling(
    async () => runView("succeeded"),
    () => undefined,
    { set: () => 1, clear: () => undefined },
    () => undefined,
    async () => { settled++; },
  );
  await new Promise((resolve) => setImmediate(resolve));
  stop();
  assert.equal(settled, 1);
});

test("an interrupted run keeps polling for same-run worker recovery", async () => {
  assert.equal(shouldPollRunStatus("queued"), true);
  assert.equal(shouldPollRunStatus("running"), true);
  assert.equal(shouldPollRunStatus("interrupted"), true);
  assert.equal(shouldPollRunStatus("succeeded"), false);
  assert.equal(shouldPollRunStatus("failed"), false);
  assert.equal(shouldPollRunStatus("cancelled"), false);

  let settled = 0;
  const stop = startRunPolling(
    async () => runView("interrupted"),
    () => undefined,
    { set: () => 1, clear: () => undefined },
    () => undefined,
    async () => { settled++; },
  );
  await new Promise((resolve) => setImmediate(resolve));
  stop();
  assert.equal(settled, 0);
});

test("plan editing always creates the next unapproved revision", () => {
  const edited = JSON.stringify({ ...planView.plan, revision: 99, reviewed: true, domain: "Edited domain" });
  const next = preparePlanRevision(edited, planView);
  assert.equal(next.app, "atlassian");
  assert.equal(next.revision, 3);
  assert.equal(next.reviewed, false);
  assert.equal(next.domain, "Edited domain");
  assert.throws(() => preparePlanRevision("not json", planView), /valid JSON/i);
  assert.throws(() => preparePlanRevision("{}", planView), /startUrl|domain|sources|flows/i);
});

test("workspace commands wire every curator action and refresh the draft handoff", async () => {
  const calls: Array<[string, ...unknown[]]> = [];
  let draftRefreshes = 0;
  const run = runView("queued").run;
  const commands = createCrawlWorkspaceCommands({
    researchCrawlApp: async (...args) => { calls.push(["research", ...args]); return { jobId: 41, app: "atlassian", homepageUrl: "https://www.atlassian.com/" }; },
    saveCrawlPlan: async (...args) => { calls.push(["save", ...args]); return { ...planView, id: "12", revision: 3 }; },
    approveCrawlPlan: async (...args) => { calls.push(["approve", ...args]); return { ...planView, status: "approved" }; },
    createCrawlRun: async (...args) => { calls.push(["start", ...args]); return run; },
    cancelCrawlRun: async (...args) => { calls.push(["cancel", ...args]); return { ...run, status: "cancelled" }; },
    retryCrawlRun: async (...args) => { calls.push(["retry", ...args]); return { ...run, id: "22", retry_of_run_id: "21" }; },
    requestCrawlRepair: async (...args) => { calls.push(["repair", ...args]); return repair; },
    applyCrawlRepair: async (...args) => { calls.push(["apply", ...args]); return { ...repair, status: "applied" }; },
    rejectCrawlRepair: async (...args) => { calls.push(["reject", ...args]); return { ...repair, status: "rejected" }; },
  });

  await commands.research("atlassian", "https://www.atlassian.com/", "claude");
  await commands.save(planView, JSON.stringify({ ...planView.plan, domain: "Edited" }));
  await commands.approve("11");
  const created = await commands.start("atlassian", "11", {
    unsafeApproved: true,
    disposableAccountAcknowledged: true,
    allowSideEffects: false,
    environment: { headless: true, browserName: "chromium" },
  }, async () => { draftRefreshes++; throw new Error("version refresh unavailable"); });
  await commands.cancel("21");
  await commands.retry("21", "failed");
  await commands.proposeRepair("21", "browse-products", "open-software", "chatgpt");
  await commands.reviewRepair("31", "apply");
  await commands.reviewRepair("31", "reject");

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created.id, "21");
  assert.equal(draftRefreshes, 1);
  assert.deepEqual(calls.map(([name]) => name), ["research", "save", "approve", "start", "cancel", "retry", "repair", "apply", "reject"]);
  assert.deepEqual(calls[3], ["start", "atlassian", {
    planId: "11",
    mode: "full",
    unsafeApproved: true,
    disposableAccountAcknowledged: true,
    allowSideEffects: false,
    environment: { headless: true, browserName: "chromium" },
  }]);
  assert.deepEqual(calls[5], ["retry", "21", "failed"]);
  assert.deepEqual(calls[6], ["repair", "21", { flowId: "browse-products", stepId: "open-software", provider: "chatgpt" }]);
});
