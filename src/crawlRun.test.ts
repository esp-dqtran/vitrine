import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CrawlFlow, CrawlPlan, CrawlStep } from "./crawlPlan.ts";
import type { CreateEvidenceInput, CrawlEvidenceRecord, EvidenceKey } from "./crawlStore.ts";
import type { DesignFlow } from "./designSystem.ts";
import {
  assembleCanonicalFlows,
  captureValidatedState,
  normalizeCaptureUrl,
  type CaptureDependencies,
  type CompletedCaptureIdentity,
} from "./crawlRun.ts";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function identity(overrides: Partial<CompletedCaptureIdentity> = {}): CompletedCaptureIdentity {
  return {
    status: "completed",
    runId: "run-1",
    workerId: "worker-1",
    app: "fixture-app",
    versionId: 1,
    planId: "plan-1",
    flowId: "settings",
    stepId: "open-settings",
    stateLabel: "Settings open",
    sourceUrl: "https://example.com/home?session=discarded",
    finalUrl: "https://example.com/settings?attempt=1#panel",
    viewport: { width: 1280, height: 720 },
    ...overrides,
  };
}

function screenshotPage(
  bytes: Uint8Array,
  observed?: { calls: number },
  state: { url?: () => string; viewportSize?: () => { width: number; height: number } | null } = {},
) {
  return {
    url: state.url ?? (() => "https://example.com/settings?attempt=page#panel"),
    viewportSize: state.viewportSize ?? (() => ({ width: 1280, height: 720 })),
    screenshot: async (options: { fullPage: true }) => {
      assert.deepEqual(options, { fullPage: true });
      if (observed) observed.calls++;
      return bytes;
    },
  };
}

test("capture URL normalization accepts only HTTP(S), strips volatile parts, and redacts known path secrets", () => {
  const rawSecret = "known-secret";
  const encodedSecret = "secret/segment";
  const normalized = normalizeCaptureUrl(
    `https://user:password@example.com/private/${rawSecret}/encoded/${encodeURIComponent(encodedSecret)}?token=${rawSecret}#panel`,
    [rawSecret, encodedSecret],
  );

  assert.equal(normalized, "https://example.com/private/redacted/encoded/redacted");
  assert.equal(normalized.includes(rawSecret), false);
  assert.equal(normalized.includes(encodeURIComponent(encodedSecret)), false);

  for (const unsafe of ["javascript:alert(1)", "data:text/plain,secret", "file:///tmp/secret"]) {
    try {
      normalizeCaptureUrl(unsafe, ["secret"]);
      assert.fail("unsafe capture URL was accepted");
    } catch (error) {
      assert.match((error as Error).message, /HTTP|HTTPS/i);
      assert.equal((error as Error).message.includes(unsafe), false);
    }
  }
});

function sameEvidenceKey(record: CrawlEvidenceRecord, key: EvidenceKey): boolean {
  return (
    record.version_id === key.versionId &&
    record.plan_id === key.planId &&
    record.flow_id === key.flowId &&
    record.step_id === key.stepId &&
    record.final_url === key.finalUrl &&
    record.viewport_width === key.viewportWidth &&
    record.viewport_height === key.viewportHeight
  );
}

function fakeCaptureStore(dataDir: string) {
  const evidences: CrawlEvidenceRecord[] = [];
  const images = new Map<string, number>();
  const insertCalls: string[] = [];
  const state = { failEvidence: false };

  const findEvidence = async (key: EvidenceKey): Promise<CrawlEvidenceRecord | undefined> =>
    evidences.find((record) => sameEvidenceKey(record, key));

  const createEvidence = async (input: CreateEvidenceInput): Promise<CrawlEvidenceRecord> => {
    if (state.failEvidence) throw new Error("evidence database unavailable");
    const existing = await findEvidence(input);
    if (existing) return existing;
    const record: CrawlEvidenceRecord = {
      id: `evidence-${evidences.length + 1}`,
      version_id: input.versionId,
      plan_id: input.planId,
      image_id: input.imageId,
      flow_id: input.flowId,
      step_id: input.stepId,
      source_url: input.sourceUrl,
      final_url: input.finalUrl,
      state_label: input.stateLabel,
      screenshot_hash: input.screenshotHash,
      viewport_width: input.viewportWidth,
      viewport_height: input.viewportHeight,
      captured_at: new Date(`2026-07-12T00:00:0${evidences.length}Z`),
    };
    evidences.push(record);
    return record;
  };

  const insertImage: CaptureDependencies["insertImage"] = async (app, platform, ref, capture) => {
    assert.equal(app, "fixture-app");
    assert.equal(platform, "web");
    assert.ok(capture);
    assert.equal(capture.stateContext, "Settings open");
    insertCalls.push(ref);
    const existing = images.get(ref);
    if (existing !== undefined) return existing;
    const id = images.size + 1;
    images.set(ref, id);
    return id;
  };

  const deps: CaptureDependencies = { dataDir, findEvidence, createEvidence, insertImage };
  return { deps, evidences, images, insertCalls, state };
}

function imageFiles(dataDir: string): string[] {
  try {
    return readdirSync(join(dataDir, "images", "fixture-app")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

test("first canonical evidence wins while every run retains its observed screenshot hash", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-first-wins-"));
  const store = fakeCaptureStore(dataDir);
  const shotA = Buffer.from("rendered screenshot A");
  const shotB = Buffer.from("rendered screenshot B");

  try {
    const first = await captureValidatedState(screenshotPage(shotA), identity(), store.deps);
    const second = await captureValidatedState(
      screenshotPage(shotB),
      identity({ runId: "run-2", finalUrl: "https://example.com/settings?attempt=2#changed" }),
      store.deps,
    );

    assert.equal(first.observedHash, sha256(shotA));
    assert.equal(second.observedHash, sha256(shotB));
    assert.notEqual(second.observedHash, first.observedHash);
    assert.equal(first.evidence.screenshot_hash, sha256(shotA));
    assert.equal(second.evidence.id, first.evidence.id);
    assert.equal(second.evidence.screenshot_hash, sha256(shotA));
    assert.equal(second.ref, first.ref);
    assert.equal(second.imageId, first.imageId);
    assert.deepEqual(
      { reused: first.reused, newFile: first.newFile },
      { reused: false, newFile: true },
    );
    assert.deepEqual(
      { reused: second.reused, newFile: second.newFile },
      { reused: true, newFile: false },
    );
    assert.equal(first.evidence.final_url, "https://example.com/settings");
    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(store.insertCalls.length, 1);
    assert.deepEqual(imageFiles(dataDir), [`${sha256(shotA).slice(0, 16)}.png`]);
    assert.deepEqual(readFileSync(join(dataDir, "images", "fixture-app", `${sha256(shotA).slice(0, 16)}.png`)), shotA);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a new draft version reuses identical media but creates new logical evidence", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-new-version-"));
  const store = fakeCaptureStore(dataDir);
  const screenshot = Buffer.from("same rendered screenshot");

  try {
    const first = await captureValidatedState(screenshotPage(screenshot), identity(), store.deps);
    const second = await captureValidatedState(
      screenshotPage(screenshot),
      identity({ runId: "run-2", versionId: 2 }),
      store.deps,
    );

    assert.notEqual(second.evidence.id, first.evidence.id);
    assert.equal(second.evidence.version_id, 2);
    assert.equal(second.imageId, first.imageId);
    assert.equal(second.ref, first.ref);
    assert.equal(second.observedHash, sha256(screenshot));
    assert.deepEqual(
      { reused: second.reused, newFile: second.newFile },
      { reused: false, newFile: false },
    );
    assert.equal(store.evidences.length, 2);
    assert.equal(store.images.size, 1);
    assert.equal(store.insertCalls.length, 2);
    assert.deepEqual(imageFiles(dataDir), [`${sha256(screenshot).slice(0, 16)}.png`]);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("an exact repeated capture creates no duplicate row, image, or file", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-repeat-"));
  const store = fakeCaptureStore(dataDir);
  const screenshot = Buffer.from("repeatable screenshot");

  try {
    const first = await captureValidatedState(screenshotPage(screenshot), identity(), store.deps);
    const repeated = await captureValidatedState(screenshotPage(screenshot), identity({ runId: "run-2" }), store.deps);

    assert.equal(repeated.reused, true);
    assert.equal(repeated.newFile, false);
    assert.equal(repeated.evidence.id, first.evidence.id);
    assert.equal(repeated.observedHash, sha256(screenshot));
    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(store.insertCalls.length, 1);
    assert.equal(imageFiles(dataDir).length, 1);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("an existing short-hash target is verified and a collision fails before database writes", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-collision-"));
  const store = fakeCaptureStore(dataDir);
  const shortRef = () => "aaaaaaaaaaaaaaaa";
  const deps: CaptureDependencies = { ...store.deps, shortRef };

  try {
    await captureValidatedState(screenshotPage(Buffer.from("collision A")), identity(), deps);
    await assert.rejects(
      captureValidatedState(
        screenshotPage(Buffer.from("collision B")),
        identity({ runId: "run-2", versionId: 2 }),
        deps,
      ),
      /hash collision/i,
    );

    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(store.insertCalls.length, 1);
    assert.deepEqual(imageFiles(dataDir), ["aaaaaaaaaaaaaaaa.png"]);
    assert.equal(imageFiles(dataDir).some((name) => name.includes(".tmp")), false);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("evidence failure throws, cleans temporary files, and permits a safe retry", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-db-failure-"));
  const store = fakeCaptureStore(dataDir);
  const screenshot = Buffer.from("durable before database failure");

  try {
    store.state.failEvidence = true;
    await assert.rejects(
      captureValidatedState(screenshotPage(screenshot), identity(), store.deps),
      /evidence database unavailable/,
    );

    assert.equal(store.evidences.length, 0);
    assert.equal(store.images.size, 1);
    assert.deepEqual(imageFiles(dataDir), [`${sha256(screenshot).slice(0, 16)}.png`]);
    assert.equal(imageFiles(dataDir).some((name) => name.includes(".tmp")), false);

    store.state.failEvidence = false;
    const retried = await captureValidatedState(screenshotPage(screenshot), identity({ runId: "run-2" }), store.deps);
    assert.equal(retried.newFile, false);
    assert.equal(retried.reused, false);
    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(imageFiles(dataDir).length, 1);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("skipped and failed results cannot reach screenshot persistence", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-not-completed-"));
  const store = fakeCaptureStore(dataDir);
  const observed = { calls: 0 };
  const page = screenshotPage(Buffer.from("must not be captured"), observed);

  try {
    for (const status of ["skipped", "failed"] as const) {
      await assert.rejects(
        captureValidatedState(
          page,
          { ...identity(), status } as unknown as CompletedCaptureIdentity,
          store.deps,
        ),
        /completed step/i,
      );
    }
    assert.equal(observed.calls, 0);
    assert.equal(store.evidences.length, 0);
    assert.equal(store.images.size, 0);
    assert.deepEqual(imageFiles(dataDir), []);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("capture derives the durable URL and viewport from stable page state", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-page-state-"));
  const store = fakeCaptureStore(dataDir);
  const page = screenshotPage(Buffer.from("trusted page state"), undefined, {
    url: () => "https://example.com/trusted?session=discarded#panel",
    viewportSize: () => ({ width: 1440, height: 900 }),
  });

  try {
    const captured = await captureValidatedState(
      page,
      identity({ finalUrl: "https://attacker.example/forged", viewport: { width: 1, height: 1 } }),
      store.deps,
    );

    assert.equal(captured.evidence.final_url, "https://example.com/trusted");
    assert.equal(captured.evidence.viewport_width, 1440);
    assert.equal(captured.evidence.viewport_height, 900);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("capture rejects page navigation or viewport changes during the screenshot", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-changing-state-"));
  const store = fakeCaptureStore(dataDir);

  try {
    let urlRead = 0;
    await assert.rejects(
      captureValidatedState(
        screenshotPage(Buffer.from("navigating page"), undefined, {
          url: () => urlRead++ === 0 ? "https://example.com/before" : "https://example.com/after",
        }),
        identity(),
        store.deps,
      ),
      /changed during screenshot/i,
    );

    let viewportRead = 0;
    await assert.rejects(
      captureValidatedState(
        screenshotPage(Buffer.from("resizing page"), undefined, {
          viewportSize: () => viewportRead++ === 0 ? { width: 1280, height: 720 } : { width: 1440, height: 900 },
        }),
        identity(),
        store.deps,
      ),
      /changed during screenshot/i,
    );
    assert.equal(store.evidences.length, 0);
    assert.equal(store.images.size, 0);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("capture rejects a missing or invalid live viewport before persistence", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-invalid-viewport-"));
  const store = fakeCaptureStore(dataDir);

  try {
    for (const viewportSize of [
      () => null,
      () => ({ width: 0, height: 720 }),
      () => ({ width: 1280.5, height: 720 }),
    ]) {
      await assert.rejects(
        captureValidatedState(
          screenshotPage(Buffer.from("invalid viewport"), undefined, { viewportSize }),
          identity(),
          store.deps,
        ),
        /viewport/i,
      );
    }
    assert.equal(store.evidences.length, 0);
    assert.equal(store.images.size, 0);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

function plannedStep(id: string, state: string): CrawlStep {
  return {
    id,
    action: "waitFor",
    text: state,
    safety: "read",
    expected: { state, visible: { text: state } },
  };
}

function plannedFlow(id: string, states: string[]): CrawlFlow {
  return {
    id,
    title: `${id} title`,
    description: `${id} description`,
    safe: true,
    requiredSecrets: [],
    steps: states.map((state, index) => plannedStep(`${id}-step-${index + 1}`, state)),
  };
}

function canonicalEvidence(
  imageId: number,
  flowId: string,
  stepId: string,
  finalUrl: string,
  overrides: Partial<CrawlEvidenceRecord> = {},
): CrawlEvidenceRecord {
  return {
    id: `evidence-${imageId}-${finalUrl}`,
    version_id: 1,
    plan_id: "plan-1",
    image_id: imageId,
    flow_id: flowId,
    step_id: stepId,
    source_url: "https://example.com/start",
    final_url: finalUrl,
    state_label: "stored label must not drive assembly",
    screenshot_hash: String(imageId).padStart(64, "0"),
    viewport_width: 1280,
    viewport_height: 720,
    captured_at: new Date(0),
    ...overrides,
  };
}

test("canonical flow assembly follows plan order, replaces completed flows, and deduplicates evidence", () => {
  const alpha = plannedFlow("alpha", ["Alpha start", "Alpha finish"]);
  const beta = plannedFlow("beta", ["Beta start", "Beta finish"]);
  const incomplete = plannedFlow("incomplete", ["Incomplete state"]);
  const plan: CrawlPlan = {
    app: "fixture-app",
    revision: 1,
    startUrl: "https://example.com",
    domain: "example.com",
    sources: [],
    reviewed: true,
    flows: [alpha, beta, incomplete],
  };
  const evidences = [
    canonicalEvidence(22, "beta", "beta-step-2", "https://example.com/beta/finish"),
    canonicalEvidence(21, "beta", "beta-step-1", "https://example.com/beta/z"),
    canonicalEvidence(12, "alpha", "alpha-step-2", "https://example.com/alpha/finish"),
    canonicalEvidence(11, "alpha", "alpha-step-2", "https://example.com/alpha/duplicate-start"),
    canonicalEvidence(21, "beta", "beta-step-1", "https://example.com/beta/z", { id: "duplicate-row" }),
    canonicalEvidence(30, "incomplete", "incomplete-step-1", "https://example.com/incomplete"),
    canonicalEvidence(11, "alpha", "alpha-step-1", "https://example.com/alpha/start"),
    canonicalEvidence(20, "beta", "beta-step-1", "https://example.com/beta/a"),
    canonicalEvidence(900, "alpha", "alpha-step-1", "https://example.com/alpha/foreign-version", { version_id: 2 }),
    canonicalEvidence(901, "alpha", "alpha-step-1", "https://example.com/alpha/foreign-plan", { plan_id: "plan-2" }),
  ];
  const keep: DesignFlow = {
    id: "keep",
    title: "Unrelated",
    description: "Retain me",
    tags: ["manual"],
    steps: [{ label: "Existing", evidence: [99] }],
  };
  const existing: DesignFlow[] = [
    { id: "beta", title: "Old beta", description: "", tags: [], steps: [{ label: "old", evidence: [2] }] },
    keep,
    { id: "alpha", title: "Old alpha", description: "", tags: [], steps: [{ label: "old", evidence: [1] }] },
  ];

  const flows = assembleCanonicalFlows(
    plan,
    { versionId: 1, planId: "plan-1", completedFlowIds: ["beta", "alpha", "beta"] },
    evidences,
    existing,
  );

  assert.deepEqual(flows.map((flow) => flow.id), ["keep", "alpha", "beta"]);
  assert.equal(flows[0], keep);
  assert.equal(flows.filter((flow) => flow.id === "alpha").length, 1);
  assert.equal(flows.filter((flow) => flow.id === "beta").length, 1);
  assert.equal(flows.some((flow) => flow.id === "incomplete"), false);
  assert.deepEqual(flows.find((flow) => flow.id === "alpha")?.steps, [
    { label: "Alpha start", evidence: [11] },
    { label: "Alpha finish", evidence: [12] },
  ]);
  assert.deepEqual(flows.find((flow) => flow.id === "beta")?.steps, [
    { label: "Beta start", evidence: [20, 21] },
    { label: "Beta finish", evidence: [22] },
  ]);
});

test("canonical assembly preserves an existing flow until every required step has pinned evidence", () => {
  const required = plannedFlow("required", ["First", "Second"]);
  const optional = plannedFlow("optional", ["Required", "Optional"]);
  optional.steps[1] = { ...optional.steps[1], optional: true, optionalReason: "Only shown to some accounts" };
  const plan: CrawlPlan = {
    app: "fixture-app",
    revision: 1,
    startUrl: "https://example.com",
    domain: "example.com",
    sources: [],
    reviewed: true,
    flows: [required, optional],
  };
  const oldRequired: DesignFlow = {
    id: "required",
    title: "Previously curated",
    description: "Do not replace with a partial run",
    tags: ["manual"],
    steps: [{ label: "Previous", evidence: [99] }],
  };
  const evidence = [
    canonicalEvidence(1, "required", "required-step-1", "https://example.com/required"),
    canonicalEvidence(2, "required", "required-step-2", "https://example.com/foreign", { version_id: 2 }),
    canonicalEvidence(3, "optional", "optional-step-1", "https://example.com/optional"),
    canonicalEvidence(4, "optional", "optional-step-2", "https://example.com/optional/details"),
  ];

  const flows = assembleCanonicalFlows(
    plan,
    { versionId: 1, planId: "plan-1", completedFlowIds: ["required", "optional"] },
    evidence,
    [oldRequired],
  );

  assert.equal(flows.find((flow) => flow.id === "required"), oldRequired);
  assert.deepEqual(flows.find((flow) => flow.id === "optional")?.steps, [
    { label: "Required", evidence: [3] },
    { label: "Optional", evidence: [4] },
  ]);
});
