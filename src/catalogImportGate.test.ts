import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("catalog stage gate rejects partial and unsuccessful outcomes", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.assertCatalogStageComplete, "function");
  const gate = progress.assertCatalogStageComplete as (label: string, outcome: unknown) => void;

  assert.doesNotThrow(() => gate("flows", { status: "done", discovered: 57, captured: 57 }));
  assert.throws(() => gate("flows", { status: "done", discovered: 57, captured: 56 }), /flows.*56\/57/i);
  assert.throws(() => gate("flows", { status: "error", discovered: 57, captured: 56 }), /flows.*error/i);
  assert.throws(() => gate("screens", { status: "cancelled", discovered: 100, captured: 10 }), /screens.*cancelled/i);
});

test("catalog stage gate requires auditable counts", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  const gate = progress.assertCatalogStageComplete as (label: string, outcome: unknown) => void;
  assert.throws(() => gate("ui-elements", { status: "done" }), /auditable counts/i);
});

test("repair planner reimports unknown or short artifact phases only", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.planCatalogRepair, "function");
  const plan = progress.planCatalogRepair as (input: unknown) => unknown;
  assert.deepEqual(plan({
    expected: { screens: 527, uiElements: 80, flows: 42 },
    persisted: { screens: 522, uiElements: 80, flows: 41 },
    invalidFlowReferences: 0,
  }), { screens: true, uiElements: false, flows: true });
  assert.deepEqual(plan({
    expected: { screens: 100 },
    persisted: { screens: 100, uiElements: 0, flows: 0 },
    invalidFlowReferences: 0,
  }), { screens: false, uiElements: true, flows: true });
  assert.deepEqual(plan({
    expected: { screens: 183, uiElements: 183 },
    persisted: { screens: 183, uiElements: 183, flows: 0 },
    invalidFlowReferences: 0,
  }), { screens: false, uiElements: false, flows: true });
});

test("catalog phase checkpoints retain only unfinished work after a failure", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.catalogRepairPlan, "function");
  assert.equal(typeof progress.markCatalogPhaseComplete, "function");
  const plan = progress.catalogRepairPlan as (repair?: unknown) => Record<string, boolean>;
  const complete = progress.markCatalogPhaseComplete as (repair: unknown, phase: string) => Record<string, boolean>;

  const initial = plan();
  assert.deepEqual(initial, { screens: true, uiElements: true, flows: true });
  const afterScreens = complete(initial, "screens");
  const afterUi = complete(afterScreens, "uiElements");
  assert.deepEqual(afterUi, { screens: false, uiElements: false, flows: true });
  assert.deepEqual(initial, { screens: true, uiElements: true, flows: true });
});

test("catalog log parser reads legacy and verified Mobbin totals", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.parseCatalogLogCounts, "function");
  const parse = progress.parseCatalogLogCounts as (lines: string[]) => unknown;
  assert.deepEqual(parse([
    "[gamma] Done. Imported 527 screens image(s) via bulk download.",
    "[gamma] Pass 1: selected 522 of 527 UI elements (5 filtered as other-app).",
    "[gamma] Done. Imported 41/42 flow(s).",
  ]), { screens: 527, uiElements: 527, flows: 42 });
  assert.deepEqual(parse([
    "[gamma] Done. Captured 527/527 screens image(s) via bulk download (5 new object(s)).",
    "[gamma] Done. Captured 527/527 UI elements image(s) via bulk download (527 new object(s)).",
    "[gamma] Done. Verified 42/42 flow(s); downloaded 42 in this pass.",
  ]), { screens: 527, uiElements: 527, flows: 42 });
});

test("UI completeness uses Mobbin's displayed total when fewer cards were selected", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.catalogCaptureTarget, "function");
  const target = progress.catalogCaptureTarget as (shown: number) => number;
  assert.equal(target(144), 144);
});

test("repair-only workers never start untouched catalog jobs", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.shouldRunCatalogJob, "function");
  const shouldRun = progress.shouldRunCatalogJob as (repairOnly: boolean, job: unknown) => boolean;
  assert.equal(shouldRun(true, { status: "pending", repair: { screens: false, uiElements: true, flows: false } }), true);
  assert.equal(shouldRun(true, { status: "pending" }), false);
  assert.equal(shouldRun(false, { status: "pending" }), true);
  assert.equal(shouldRun(false, { status: "done", repair: { screens: true, uiElements: true, flows: true } }), false);
});

test("catalog app failures never add a worker failure-count shutdown", () => {
  const importer = readFileSync(new URL("../scripts/catalog-import.ts", import.meta.url), "utf8");
  assert.doesNotMatch(importer, /CONSECUTIVE_FAILURE_LIMIT|consecutiveFailures/);
});

test("catalog integrity summary counts repair markers in every job status", async () => {
  const progress = await import("./progress.ts") as Record<string, unknown>;
  assert.equal(typeof progress.summarizeCatalogIntegrityState, "function");
  const summarize = progress.summarizeCatalogIntegrityState as (jobs: unknown[], queuedJobs: number) => unknown;
  assert.deepEqual(summarize([
    { status: "pending", repair: { screens: false, uiElements: true, flows: false } },
    { status: "failed", repair: { screens: true, uiElements: true, flows: true } },
    { status: "done" },
    { status: "pending" },
  ], 0), {
    remainingRepairJobs: 2,
    failedJobs: 1,
    clean: false,
  });
  assert.deepEqual(summarize([{ status: "done" }], 1), {
    remainingRepairJobs: 0,
    failedJobs: 0,
    clean: false,
  });
  assert.deepEqual(summarize([{ status: "done" }], 0), {
    remainingRepairJobs: 0,
    failedJobs: 0,
    clean: true,
  });
  assert.deepEqual((summarize as (jobs: unknown[], queuedJobs: number, invalidFlowReferences: number) => unknown)(
    [{ status: "done" }], 0, 1,
  ), {
    remainingRepairJobs: 0,
    failedJobs: 0,
    clean: false,
  });
});

test("catalog identity keeps distinct Mobbin apps separate when name and platform collide", async () => {
  const identity = await import("./catalogIdentity.ts") as Record<string, unknown>;
  assert.equal(typeof identity.disambiguateCatalogSlugs, "function");
  const disambiguate = identity.disambiguateCatalogSlugs as (jobs: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
  const jobs = [
    { mobbinId: "c793233c-68a0-4655-8e3b-a5a08e4322b5", slug: "threads", platform: "ios", status: "pending" },
    { mobbinId: "610937a2-ec34-468e-b68b-120deb45f742", slug: "threads", platform: "ios", status: "done" },
    { mobbinId: "c109b808-3106-4b0e-b79e-891b6921a5b3", slug: "threads", platform: "android", status: "pending" },
    { mobbinId: "8aec9fa8-d684-49a2-8a85-56a06e179122", slug: "bloom", platform: "ios", status: "pending" },
    { mobbinId: "e1251835-34e6-426e-9f94-f9595f2567fa", slug: "bloom", platform: "ios", status: "pending" },
  ];

  const result = disambiguate(jobs);
  assert.equal(result.find((job) => job.mobbinId === "610937a2-ec34-468e-b68b-120deb45f742")?.slug, "threads");
  assert.equal(result.find((job) => job.mobbinId === "c793233c-68a0-4655-8e3b-a5a08e4322b5")?.slug,
    "threads-c793233c-68a0-4655-8e3b-a5a08e4322b5");
  assert.equal(result.find((job) => job.platform === "android")?.slug, "threads");
  assert.equal(result.find((job) => job.mobbinId === "8aec9fa8-d684-49a2-8a85-56a06e179122")?.slug, "bloom");
  assert.equal(result.find((job) => job.mobbinId === "e1251835-34e6-426e-9f94-f9595f2567fa")?.slug,
    "bloom-e1251835-34e6-426e-9f94-f9595f2567fa");
  assert.equal(new Set(result.map((job) => `${job.slug}\u0000${job.platform}`)).size, result.length);
  assert.deepEqual(jobs.map((job) => job.slug), ["threads", "threads", "threads", "bloom", "bloom"]);
});
