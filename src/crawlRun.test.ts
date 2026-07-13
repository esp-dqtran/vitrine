import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CrawlFlow, CrawlPlan, CrawlStep } from "./crawlPlan.ts";
import type {
  CrawlEvidenceRecord,
  CrawlRunRecord,
  CrawlRunStepRecord,
  EvidenceKey,
  PersistEvidenceBundleInput,
  PersistEvidenceBundleResult,
  WorkerRunExecutionSnapshot,
} from "./crawlStore.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import type { FlowRunResult, FlowStepRecord, RunnerHooks, StepActual } from "./smartCrawler.ts";
import type { DesignFlow } from "./designSystem.ts";
import {
  assembleCanonicalFlows,
  captureValidatedState,
  CrawlRunInterruptedError,
  createCrawlRunService,
  finalizeCanonicalRun,
  normalizeCaptureUrl,
  persistFailureArtifact,
  resolveCrawlProfileDir,
  sanitizeDurableActualUrl,
  withMaskedSecretFields,
  type CaptureDependencies,
  type CrawlBrowserRunInput,
  type CompletedCaptureIdentity,
} from "./crawlRun.ts";

test("crawl worker keeps Linux profiles under an explicit root without changing the host default", () => {
  assert.equal(resolveCrawlProfileDir("data", "atlassian", {}), "data/browser-profile-atlassian");
  assert.equal(
    resolveCrawlProfileDir("data", "atlassian", { CRAWL_PROFILE_ROOT: "/app/data/browser-profiles-linux" }),
    "/app/data/browser-profiles-linux/atlassian",
  );
});

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

test("failure artifact uploads deterministic internal PNG before database attachment and retries idempotently", async () => {
  const png = Buffer.from("failure screenshot");
  const events: string[] = [];
  const keys: string[] = [];
  const objectStore = {
    put: async (input: ObjectMetadata & { body: Uint8Array }) => {
      events.push("put");
      keys.push(input.key);
      assert.deepEqual(Buffer.from(input.body), png);
      return { created: keys.length === 1, metadata: input };
    },
  } as unknown as ObjectStore;
  const dependencies = {
    objectStore,
    attachFailureObject: async (input: { object: ObjectMetadata }) => { events.push("attach"); assert.equal(input.object.key, keys.at(-1)); },
  };
  const identity = { runId: "7", workerId: "worker-1", flowId: "settings/main", stepId: "open panel" };
  const first = await persistFailureArtifact(screenshotPage(png), identity, dependencies);
  const second = await persistFailureArtifact(screenshotPage(png), identity, dependencies);
  assert.deepEqual(events, ["put", "attach", "put", "attach"]);
  assert.equal(first.key, second.key);
  assert.match(first.key, /^crawl-failures\/7\//);
  assert.equal(first.accessClass, "internal");
});

test("failure artifact upload or metadata mismatch never creates a database association", async () => {
  const png = Buffer.from("failure screenshot");
  let attached = false;
  const identity = { runId: "8", workerId: "worker-1", flowId: "settings", stepId: "open" };
  await assert.rejects(persistFailureArtifact(screenshotPage(png), identity, {
    objectStore: { put: async () => { throw new Error("storage unavailable"); } } as unknown as ObjectStore,
    attachFailureObject: async () => { attached = true; },
  }), /storage unavailable/);
  assert.equal(attached, false);

  await assert.rejects(persistFailureArtifact(screenshotPage(png), identity, {
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => ({
        created: true,
        metadata: { ...input, sha256: "0".repeat(64) },
      }),
    } as unknown as ObjectStore,
    attachFailureObject: async () => { attached = true; },
  }), /metadata does not match/);
  assert.equal(attached, false);
});

test("durable actual URLs preserve semantic query state while redacting secret material", () => {
  const secret = "secret/segment";
  assert.equal(
    sanitizeDurableActualUrl(
      `https://user:pass@example.com/software/${encodeURIComponent(secret)}?tab=tab-1&token=${encodeURIComponent(secret)}&refresh_token=x&id_token=y&session_id=z&cookie=q&private_key=w#panel`,
      [secret],
    ),
    "https://example.com/software/redacted?tab=tab-1",
  );
});

test("secret masking is installed before screenshot work and refuses an unmasked fallback", async () => {
  const calls: unknown[] = [];
  let worked = false;
  const page = {
    evaluate: async (_callback: unknown, input: unknown) => { calls.push(input); },
  };
  await withMaskedSecretFields(page as never, ["visible-secret"], async () => {
    worked = true;
  });
  assert.equal(worked, true);
  assert.equal(calls.length, 2);

  let unsafeWork = false;
  await assert.rejects(
    () => withMaskedSecretFields(
      { evaluate: async () => { throw new Error("mask injection failed"); } } as never,
      ["visible-secret"],
      async () => { unsafeWork = true; },
    ),
    /mask injection failed/,
  );
  assert.equal(unsafeWork, false);
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
  const versionImages = new Map<number, Set<number>>();
  const persistCalls: string[] = [];
  const state = { failBundle: false, failUpload: false, workerId: "worker-1" };
  const objects = new Map<string, { metadata: ObjectMetadata; body: Buffer }>();
  const putCalls: string[] = [];
  const attached = new Map<number, string>();

  const findEvidence = async (key: EvidenceKey): Promise<CrawlEvidenceRecord | undefined> =>
    evidences.find((record) => sameEvidenceKey(record, key));

  const findWorkerEvidence = async (
    input: EvidenceKey & { runId: string; workerId: string; app: string },
  ): Promise<CrawlEvidenceRecord | undefined> => {
    if (input.workerId !== state.workerId) throw new Error("Crawl run worker lease is not active");
    return findEvidence(input);
  };

  const reserveCaptureImage = async (input: { imageUrl: string }): Promise<{ imageId: number; imageCreated: boolean }> => {
    if (state.workerId !== "worker-1") throw new Error("Crawl run worker lease is not active");
    const existing = images.get(input.imageUrl);
    if (existing) return { imageId: existing, imageCreated: false };
    const imageId = images.size + 1;
    images.set(input.imageUrl, imageId);
    return { imageId, imageCreated: true };
  };

  const persistEvidenceBundle = async (
    input: PersistEvidenceBundleInput,
  ): Promise<PersistEvidenceBundleResult> => {
    persistCalls.push(input.object.key);
    const existing = await findEvidence(input);
    if (existing) {
      return {
        imageId: existing.image_id,
        evidence: existing,
        imageCreated: false,
        evidenceCreated: false,
        reused: true,
      };
    }

    const imageId = input.imageId;
    const attachedKey = attached.get(imageId);
    if (attachedKey && attachedKey !== input.object.key) throw new Error("Image already attached to another object");
    const record: CrawlEvidenceRecord = {
      id: `evidence-${evidences.length + 1}`,
      version_id: input.versionId,
      plan_id: input.planId,
      image_id: imageId,
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
    if (state.failBundle) throw new Error("evidence database unavailable");
    attached.set(imageId, input.object.key);
    const membership = versionImages.get(input.versionId) ?? new Set<number>();
    membership.add(imageId);
    versionImages.set(input.versionId, membership);
    evidences.push(record);
    return {
      imageId,
      evidence: record,
      imageCreated: false,
      evidenceCreated: true,
      reused: false,
    };
  };

  const objectStore: ObjectStore = {
    put: async (input) => {
      putCalls.push(input.key);
      if (state.failUpload) throw new Error("object storage unavailable");
      const existing = objects.get(input.key);
      const metadata = { key: input.key, sha256: input.sha256, byteSize: input.byteSize, contentType: input.contentType, accessClass: input.accessClass };
      if (!existing) objects.set(input.key, { metadata, body: Buffer.from(input.body) });
      return { created: !existing, metadata };
    },
    head: async (key) => objects.get(key)?.metadata,
    get: async (key) => {
      const found = objects.get(key);
      if (!found) throw new Error("not found");
      return found;
    },
    signedGetUrl: async () => undefined,
    async *list() { for (const value of objects.values()) yield value.metadata; },
    delete: async (key) => objects.delete(key),
  };

  const deps: CaptureDependencies = {
    dataDir, findWorkerEvidence, reserveCaptureImage, persistEvidenceBundle, objectStore, secretValues: [],
  };
  return { deps, evidences, images, versionImages, persistCalls, state, objects, putCalls };
}

test("an existing canonical capture still requires the active worker lease", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-worker-lease-"));
  const store = fakeCaptureStore(dataDir);
  const screenshot = Buffer.from("canonical screenshot");

  try {
    await captureValidatedState(screenshotPage(screenshot), identity(), store.deps);
    store.state.workerId = "worker-2";

    await assert.rejects(
      captureValidatedState(screenshotPage(screenshot), identity({ runId: "run-2" }), store.deps),
      /worker lease/i,
    );
    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(store.persistCalls.length, 1);
    assert.equal(store.objects.size, 1);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

function imageFiles(dataDir: string): string[] {
  try {
    return readdirSync(join(dataDir, "images", "fixture-app")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

test("secret-bearing canonical capture refuses a page without masking support", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-mask-required-"));
  const store = fakeCaptureStore(dataDir);
  const observed = { calls: 0 };
  try {
    await assert.rejects(
      () => captureValidatedState(
        screenshotPage(Buffer.from("unmasked secret"), observed),
        identity(),
        { ...store.deps, secretValues: ["unmasked secret"] },
      ),
      /masking support/i,
    );
    assert.equal(observed.calls, 0);
    assert.equal(store.evidences.length, 0);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("first canonical evidence wins while every run retains its observed screenshot hash", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-first-wins-"));
  const store = fakeCaptureStore(dataDir);
  const shotA = Buffer.from("rendered screenshot A");
  const shotB = Buffer.from("rendered screenshot B");

  try {
    const first = await captureValidatedState(screenshotPage(shotA), identity(), store.deps);
    const second = await captureValidatedState(
      screenshotPage(shotB),
      identity({ runId: "run-2" }),
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
    assert.equal(store.persistCalls.length, 1);
    assert.deepEqual([...store.objects.keys()], [`images/1/${sha256(shotA)}.png`]);
    assert.deepEqual([...store.objects.values()][0].body, shotA);
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
    assert.equal(store.persistCalls.length, 2);
    assert.deepEqual([...store.versionImages.get(1) ?? []], [first.imageId]);
    assert.deepEqual([...store.versionImages.get(2) ?? []], [second.imageId]);
    assert.deepEqual([...store.objects.keys()], [`images/1/${sha256(screenshot)}.png`]);
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
    assert.equal(store.persistCalls.length, 1);
    assert.equal(store.objects.size, 1);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a short-reference collision cannot replace an image's attached object", async () => {
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
      /attached to another object/i,
    );

    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(store.persistCalls.length, 2);
    assert.equal(store.objects.size, 2);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("evidence failure throws, cleans temporary files, and permits a safe retry", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-db-failure-"));
  const store = fakeCaptureStore(dataDir);
  const screenshot = Buffer.from("durable before database failure");

  try {
    store.state.failBundle = true;
    await assert.rejects(
      captureValidatedState(screenshotPage(screenshot), identity(), store.deps),
      /evidence database unavailable/,
    );

    assert.equal(store.evidences.length, 0);
    assert.equal(store.images.size, 1);
    assert.equal(store.versionImages.size, 0);
    assert.deepEqual([...store.objects.keys()], [`images/1/${sha256(screenshot)}.png`]);

    store.state.failBundle = false;
    const retried = await captureValidatedState(screenshotPage(screenshot), identity({ runId: "run-2" }), store.deps);
    assert.equal(retried.newFile, false);
    assert.equal(retried.reused, false);
    assert.equal(store.evidences.length, 1);
    assert.equal(store.images.size, 1);
    assert.equal(store.objects.size, 1);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("object upload failure leaves no usable evidence and permits an idempotent retry", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-capture-upload-failure-"));
  const store = fakeCaptureStore(dataDir);
  const screenshot = Buffer.from("upload retry screenshot");

  try {
    store.state.failUpload = true;
    await assert.rejects(captureValidatedState(screenshotPage(screenshot), identity(), store.deps), /object storage unavailable/);
    assert.equal(store.images.size, 1);
    assert.equal(store.objects.size, 0);
    assert.equal(store.evidences.length, 0);
    assert.equal(store.persistCalls.length, 0);

    store.state.failUpload = false;
    const retried = await captureValidatedState(screenshotPage(screenshot), identity({ runId: "run-2" }), store.deps);
    assert.equal(retried.imageId, 1);
    assert.equal(retried.newFile, true);
    assert.equal(store.objects.size, 1);
    assert.equal(store.evidences.length, 1);
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
    assert.equal(store.objects.size, 0);
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
      {
        ...identity(),
        finalUrl: "https://attacker.example/forged",
        viewport: { width: 1, height: 1 },
      } as CompletedCaptureIdentity,
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

test("durable finalization loads the pinned run and saves plan-ordered flows by stable ID", async () => {
  const complete = plannedFlow("complete", ["First", "Second"]);
  const partial = plannedFlow("partial", ["Only", "Missing"]);
  const plan: CrawlPlan = {
    app: "fixture-app",
    revision: 1,
    startUrl: "https://example.com",
    domain: "example.com",
    sources: [],
    reviewed: true,
    flows: [complete, partial],
  };
  const retained: DesignFlow = {
    id: "partial",
    title: "Previously curated",
    description: "Retained until the durable run completes",
    tags: ["manual"],
    steps: [{ label: "Previous", evidence: [99] }],
  };
  const saved: Array<{ runId: string; workerId: string; app: string; flows: DesignFlow[] }> = [];
  const evidence = [
    canonicalEvidence(1, "complete", "complete-step-1", "https://example.com/first"),
    canonicalEvidence(2, "complete", "complete-step-2", "https://example.com/second"),
    canonicalEvidence(3, "partial", "partial-step-1", "https://example.com/partial"),
  ];

  const flows = await finalizeCanonicalRun(
    { runId: "run-1", workerId: "worker-1" },
    {
      loadWorkerRunFinalization: async () => ({
        runId: "run-1",
        app: "fixture-app",
        versionId: 1,
        planId: "plan-1",
        plan,
        steps: [
          { flowId: "complete", stepId: "complete-step-1", status: "completed", evidenceId: evidence[0].id },
          { flowId: "complete", stepId: "complete-step-2", status: "completed", evidenceId: evidence[1].id },
          { flowId: "partial", stepId: "partial-step-1", status: "completed", evidenceId: evidence[2].id },
        ],
        evidence,
      }),
      getAppFlows: async (app) => {
        assert.equal(app, "fixture-app");
        return [retained];
      },
      saveWorkerAppFlows: async (input) => {
        saved.push(input);
      },
    },
  );

  assert.deepEqual(flows.map(({ id }) => id), ["partial", "complete"]);
  assert.equal(flows[0], retained);
  assert.deepEqual(flows[1].steps, [
    { label: "First", evidence: [1] },
    { label: "Second", evidence: [2] },
  ]);
  assert.deepEqual(saved, [{
    runId: "run-1",
    workerId: "worker-1",
    app: "fixture-app",
    flows,
  }]);
});

test("durable finalization retains an existing flow when a completed step lacks matching evidence", async () => {
  const flow = plannedFlow("unlinked", ["Observed"]);
  const plan: CrawlPlan = {
    app: "fixture-app",
    revision: 1,
    startUrl: "https://example.com",
    domain: "example.com",
    sources: [],
    reviewed: true,
    flows: [flow],
  };
  const retained: DesignFlow = {
    id: "unlinked",
    title: "Previously curated",
    description: "Keep until the run step links evidence",
    tags: ["manual"],
    steps: [{ label: "Previous", evidence: [99] }],
  };
  let saves = 0;

  const flows = await finalizeCanonicalRun(
    { runId: "run-1", workerId: "worker-1" },
    {
      loadWorkerRunFinalization: async () => ({
        runId: "run-1",
        app: "fixture-app",
        versionId: 1,
        planId: "plan-1",
        plan,
        steps: [{
          flowId: "unlinked",
          stepId: "unlinked-step-1",
          status: "completed",
          evidenceId: "evidence-for-another-step",
        }],
        evidence: [
          canonicalEvidence(1, "unlinked", "unlinked-step-1", "https://example.com/observed"),
          canonicalEvidence(2, "other", "other-step", "https://example.com/other", { id: "evidence-for-another-step" }),
        ],
      }),
      getAppFlows: async () => [retained],
      saveWorkerAppFlows: async () => { saves++; },
    },
  );

  assert.equal(flows[0], retained);
  assert.equal(saves, 0);
});

test("crawl run service creates against one active draft and persists non-secret selection gates", async () => {
  const plan = {
    app: "fixture-app",
    revision: 1,
    startUrl: "https://example.com",
    domain: "example.com",
    sources: [],
    reviewed: true,
    flows: [plannedFlow("core", ["Home"])],
  } satisfies CrawlPlan;
  const created: unknown[] = [];
  const service = createCrawlRunService({
    workerId: "worker-1",
    store: {
      getPlan: async () => ({ id: "plan-1", app: "fixture-app", status: "approved", plan }),
      ensureActiveVersion: async () => ({ id: 9 }),
      createRun: async (input: unknown) => {
        created.push(input);
        return { id: "run-1", status: "queued" } as never;
      },
    } as never,
  });

  const run = await service.create({
    app: "fixture-app",
    planId: "plan-1",
    requestedFlowIds: ["core"],
    unsafeApproved: true,
    disposableAccountAcknowledged: true,
    allowSideEffects: false,
    environment: { headless: true },
  });

  assert.equal(run.id, "run-1");
  assert.deepEqual(created, [{
    app: "fixture-app",
    versionId: 9,
    planId: "plan-1",
    environment: {
      headless: true,
      browserName: "chromium",
      requestedFlowIds: ["core"],
      unsafeApproved: true,
      disposableAccountAcknowledged: true,
      allowSideEffects: false,
    },
  }]);
});

function serviceRun(
  plan: CrawlPlan,
  overrides: Partial<CrawlRunRecord> = {},
): CrawlRunRecord {
  const date = new Date("2026-07-12T00:00:00Z");
  return {
    id: "run-1",
    app_id: 1,
    app: plan.app,
    version_id: 9,
    plan_id: "plan-1",
    job_id: null,
    status: "queued",
    current_flow_id: null,
    current_step_id: null,
    completed_count: 0,
    failed_count: 0,
    skipped_count: 0,
    cancel_requested_at: null,
    retry_of_run_id: null,
    retry_mode: "all",
    environment: {
      requestedFlowIds: [],
      unsafeApproved: false,
      disposableAccountAcknowledged: false,
      allowSideEffects: false,
    },
    worker_id: null,
    heartbeat_at: null,
    created_at: date,
    started_at: null,
    finished_at: null,
    updated_at: date,
    ...overrides,
  };
}

function storedStep(
  runId: string,
  flowId: string,
  stepId: string,
  overrides: Partial<CrawlRunStepRecord> = {},
): CrawlRunStepRecord {
  const date = new Date("2026-07-12T00:00:00Z");
  return {
    run_id: runId,
    flow_id: flowId,
    step_id: stepId,
    flow_order: 0,
    step_order: 0,
    status: "queued",
    attempts: 0,
    source_url: null,
    final_url: null,
    expected: null,
    actual: null,
    observed_screenshot_hash: null,
    evidence_id: null,
    error_class: null,
    error_message: null,
    failure_screenshot: null,
    failure_object_key: null,
    created_at: date,
    started_at: null,
    finished_at: null,
    updated_at: date,
    ...overrides,
  };
}

async function completeBrowserRun(input: CrawlBrowserRunInput): Promise<FlowRunResult[]> {
  const results: FlowRunResult[] = [];
  for (const flow of input.flows) {
    const records: FlowStepRecord[] = [];
    const start = input.resumes.get(flow.id)?.stepIndex ?? 0;
    for (let index = start; index < flow.steps.length; index++) {
      const step = flow.steps[index];
      const actual: StepActual = {
        sourceUrl: index === 0 ? input.plan.startUrl : `https://example.com/${flow.id}/${flow.steps[index - 1].id}`,
        finalUrl: step.expected.url ?? `https://example.com/${flow.id}/${step.id}`,
        page: step.expected.page ?? "same",
        ...(step.expected.visible ? { visible: true } : {}),
        ...(step.expected.hidden ? { hidden: true } : {}),
      };
      const record: FlowStepRecord = { stepId: step.id, index, status: "completed", attempts: 1, actual };
      const page = {
        url: () => actual.finalUrl,
        viewportSize: () => ({ width: 1280, height: 720 }),
        screenshot: async () => Buffer.from(`${flow.id}/${step.id}`),
      };
      await input.hooks.stepStarted(flow, step, index, 1);
      await input.hooks.capture(page as never, flow, step, step.expected.state, actual);
      await input.hooks.stepFinished(flow, step, index, record);
      records.push(record);
    }
    results.push({
      flowId: flow.id,
      status: "completed",
      completed: records.length,
      skipped: 0,
      failed: 0,
      steps: records,
    });
  }
  return results;
}

function serviceHarness(options: {
  plan: CrawlPlan;
  run?: Partial<CrawlRunRecord>;
  steps?: CrawlRunStepRecord[];
  evidence?: CrawlEvidenceRecord[];
  parentSteps?: CrawlRunStepRecord[];
  runtimeEnv?: Record<string, string | undefined>;
  cancelled?: boolean;
  onFinalize?: () => void;
  resolveTerminalAsCancelled?: boolean;
  objectStore?: ObjectStore;
  attachFailureObject?: (input: { runId: string; flowId: string; stepId: string; object: ObjectMetadata }) => Promise<void>;
  executeBrowser?: (input: Parameters<NonNullable<Parameters<typeof createCrawlRunService>[0]["executeBrowser"]>>[0]) => Promise<FlowRunResult[]>;
}) {
  let run = serviceRun(options.plan, options.run);
  let cancelled = options.cancelled ?? false;
  const rows = new Map((options.steps ?? []).map((row) => [durableTestKey(row.flow_id, row.step_id), row]));
  const terminal: string[] = [];
  const upserts: Array<Record<string, unknown>> = [];
  const browserInputs: unknown[] = [];
  const evidenceRecords = [...(options.evidence ?? [])];
  let finalizations = 0;
  const store = {
    getRun: async () => run,
    claimRunById: async () => (run = { ...run, status: "running", worker_id: "worker-1" }),
    loadWorkerRunExecution: async (): Promise<WorkerRunExecutionSnapshot> => ({
      run,
      plan: { id: run.plan_id, app: run.app, status: "approved", plan: options.plan } as never,
      steps: [...rows.values()],
      evidence: evidenceRecords,
    }),
    listRunSteps: async (id: string) => id === run.retry_of_run_id ? (options.parentSteps ?? []) : [...rows.values()],
    heartbeatRun: async () => run,
    isRunCancellationRequested: async () => cancelled,
    requestRunCancellation: async () => {
      cancelled = true;
      run = { ...run, status: run.status === "running" ? "running" : "cancelled" };
      return run;
    },
    upsertRunStep: async (input: Record<string, unknown>) => {
      upserts.push(input);
      const row = storedStep(run.id, String(input.flowId), String(input.stepId), {
        flow_order: Number(input.flowOrder),
        step_order: Number(input.stepOrder),
        status: input.status as CrawlRunStepRecord["status"],
        attempts: Number(input.attempts),
        source_url: (input.sourceUrl as string | null | undefined) ?? null,
        final_url: (input.finalUrl as string | null | undefined) ?? null,
        expected: input.expected ?? null,
        actual: input.actual ?? null,
        observed_screenshot_hash: (input.observedScreenshotHash as string | null | undefined) ?? null,
        evidence_id: (input.evidenceId as string | null | undefined) ?? null,
        error_class: (input.errorClass as string | null | undefined) ?? null,
        error_message: (input.errorMessage as string | null | undefined) ?? null,
      });
      rows.set(durableTestKey(row.flow_id, row.step_id), row);
      return row;
    },
    updateRun: async (_id: string, _worker: string, patch: Record<string, unknown>) => {
      if (patch.status) terminal.push(String(patch.status));
      const persistedStatus = patch.status && options.resolveTerminalAsCancelled && patch.status !== "cancelled"
        ? "cancelled"
        : patch.status;
      run = {
        ...run,
        status: (persistedStatus as CrawlRunRecord["status"] | undefined) ?? run.status,
        completed_count: (patch.completedCount as number | undefined) ?? run.completed_count,
        failed_count: (patch.failedCount as number | undefined) ?? run.failed_count,
        skipped_count: (patch.skippedCount as number | undefined) ?? run.skipped_count,
      };
      return run;
    },
    createRetry: async (_id: string, retry: { mode: "all" | "failed" }) => serviceRun(options.plan, {
      id: "run-2",
      retry_of_run_id: run.id,
      retry_mode: retry.mode,
    }),
    markStaleRunIdsInterrupted: async () => ["stale-1"],
  };
  const service = createCrawlRunService({
    workerId: "worker-1",
    runtimeEnv: options.runtimeEnv ?? {},
    objectStore: options.objectStore,
    attachFailureObject: options.attachFailureObject,
    store: store as never,
    executeBrowser: async (input) => {
      browserInputs.push(input);
      return options.executeBrowser ? options.executeBrowser(input) : completeBrowserRun(input);
    },
    captureState: async (page, identity) => {
      const finalUrl = normalizeCaptureUrl(page.url());
      const evidence = canonicalEvidence(
        evidenceRecords.length + 100,
        identity.flowId,
        identity.stepId,
        finalUrl,
        { version_id: run.version_id, plan_id: run.plan_id, id: `captured-${identity.flowId}-${identity.stepId}` },
      );
      evidenceRecords.push(evidence);
      return {
        evidence,
        imageId: evidence.image_id,
        ref: `capture:${String(evidence.image_id).padStart(16, "0")}`,
        observedHash: String(evidence.image_id).padStart(64, "0"),
        newFile: true,
        reused: false,
      };
    },
    finalizeRun: async () => {
      finalizations++;
      options.onFinalize?.();
      return [];
    },
  });
  return {
    service,
    rows,
    terminal,
    upserts,
    browserInputs,
    setCancelled(value: boolean) { cancelled = value; },
    get run() { return run; },
    get finalizations() { return finalizations; },
  };
}

function durableTestKey(flowId: string, stepId: string): string {
  return `${flowId}\u0000${stepId}`;
}

test("crawl run service durably captures before completion, finalizes, and writes terminal success once", async () => {
  const secret = "top/secret";
  const flow = { ...plannedFlow("core", ["Home"]), requiredSecrets: ["FLOW_TOKEN"] };
  const plan: CrawlPlan = {
    app: "fixture-app",
    revision: 1,
    startUrl: "https://example.com",
    domain: "example.com",
    sources: [],
    reviewed: true,
    flows: [flow],
  };
  let run = serviceRun(plan);
  const steps = new Map<string, CrawlRunStepRecord>();
  const events: string[] = [];
  const statusPatches: string[] = [];
  const evidence = canonicalEvidence(7, flow.id, flow.steps[0].id, "https://example.com/redacted", { version_id: 9 });
  const evidences: CrawlEvidenceRecord[] = [];
  const snapshot = (): WorkerRunExecutionSnapshot => ({
    run,
    plan: { id: "plan-1", app: plan.app, status: "approved", plan } as never,
    steps: [...steps.values()],
    evidence: evidences,
  });
  const store = {
    getRun: async () => run,
    claimRunById: async () => (run = { ...run, status: "running", worker_id: "worker-1" }),
    loadWorkerRunExecution: async () => snapshot(),
    listRunSteps: async () => [...steps.values()],
    heartbeatRun: async () => run,
    isRunCancellationRequested: async () => false,
    upsertRunStep: async (input: Record<string, unknown>) => {
      const key = `${input.flowId}/${input.stepId}`;
      const row = storedStep(run.id, String(input.flowId), String(input.stepId), {
        status: input.status as CrawlRunStepRecord["status"],
        attempts: Number(input.attempts),
        expected: input.expected ?? null,
        actual: input.actual ?? null,
        source_url: (input.sourceUrl as string | null | undefined) ?? null,
        final_url: (input.finalUrl as string | null | undefined) ?? null,
        observed_screenshot_hash: (input.observedScreenshotHash as string | null | undefined) ?? null,
        evidence_id: (input.evidenceId as string | null | undefined) ?? null,
      });
      steps.set(key, row);
      if (row.status === "completed") events.push("step-completed");
      return row;
    },
    updateRun: async (_id: string, _worker: string, patch: Record<string, unknown>) => {
      if (patch.status) {
        statusPatches.push(String(patch.status));
        events.push(`terminal-${patch.status}`);
      }
      run = { ...run, ...{
        status: (patch.status as CrawlRunRecord["status"] | undefined) ?? run.status,
        completed_count: (patch.completedCount as number | undefined) ?? run.completed_count,
        failed_count: (patch.failedCount as number | undefined) ?? run.failed_count,
        skipped_count: (patch.skippedCount as number | undefined) ?? run.skipped_count,
      } };
      return run;
    },
  };
  const actual: StepActual = {
    sourceUrl: `https://example.com/start?token=${encodeURIComponent(secret)}`,
    finalUrl: `https://example.com/${encodeURIComponent(secret)}?token=${encodeURIComponent(secret)}`,
    page: "same",
    visible: true,
  };
  const completed: FlowStepRecord = {
    stepId: flow.steps[0].id,
    index: 0,
    status: "completed",
    attempts: 1,
    actual,
  };
  const executeBrowser = async ({ hooks }: { hooks: RunnerHooks }): Promise<FlowRunResult[]> => {
    await hooks.stepStarted(flow, flow.steps[0], 0, 1);
    await hooks.capture({} as never, flow, flow.steps[0], "core/Home", actual);
    await hooks.stepFinished(flow, flow.steps[0], 0, completed);
    return [{ flowId: flow.id, status: "completed", completed: 1, skipped: 0, failed: 0, steps: [completed] }];
  };
  const service = createCrawlRunService({
    workerId: "worker-1",
    runtimeEnv: { FLOW_TOKEN: secret },
    store: store as never,
    executeBrowser: executeBrowser as never,
    captureState: async () => {
      events.push("capture");
      evidences.push(evidence);
      return {
        evidence,
        imageId: evidence.image_id,
        ref: "capture:0000000000000007",
        observedHash: "7".repeat(64),
        newFile: true,
        reused: false,
      };
    },
    finalizeRun: async () => {
      events.push("finalize");
      return [];
    },
  });

  const finished = await service.execute(run.id);

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(statusPatches, ["succeeded"]);
  assert.deepEqual(events, ["capture", "step-completed", "finalize", "terminal-succeeded"]);
  assert.equal(steps.get(`${flow.id}/${flow.steps[0].id}`)?.evidence_id, evidence.id);
  assert.equal(steps.get(`${flow.id}/${flow.steps[0].id}`)?.observed_screenshot_hash, "7".repeat(64));
  const durable = steps.get(`${flow.id}/${flow.steps[0].id}`)!;
  assert.equal(durable.source_url, "https://example.com/start");
  assert.equal(durable.final_url, "https://example.com/redacted");
  assert.equal(JSON.stringify(durable).includes(secret), false);
  assert.equal(JSON.stringify(durable).includes(encodeURIComponent(secret)), false);
});

test("failed-only retry executes only flows that failed in the parent run", async () => {
  const failedFlow = plannedFlow("failed", ["Failed state"]);
  const completedFlow = plannedFlow("completed", ["Completed state"]);
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [failedFlow, completedFlow],
  };
  const parentSteps = [
    storedStep("parent", failedFlow.id, failedFlow.steps[0].id, { status: "failed" }),
    storedStep("parent", completedFlow.id, completedFlow.steps[0].id, { status: "completed" }),
  ];
  let executed: string[] = [];
  const harness = serviceHarness({
    plan,
    run: { retry_of_run_id: "parent", retry_mode: "failed" },
    parentSteps,
    executeBrowser: async (input) => {
      executed = input.flows.map(({ id }) => id);
      return completeBrowserRun(input);
    },
  });

  assert.equal((await harness.service.execute("run-1")).status, "succeeded");
  assert.deepEqual(executed, ["failed"]);
  assert.deepEqual(harness.terminal, ["succeeded"]);
});

test("unsafe flows skip by default and an approved run stops at its side-effect boundary", async () => {
  const read = plannedStep("read", "Read-only state");
  const submit: CrawlStep = { ...plannedStep("submit", "Submitted"), safety: "side-effect" };
  const unsafe: CrawlFlow = {
    id: "signup", title: "Signup", description: "", safe: false,
    requiredSecrets: ["TEST_EMAIL"], steps: [read, submit],
  };
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [unsafe],
  };
  const skipped = serviceHarness({ plan });
  assert.equal((await skipped.service.execute("run-1")).status, "succeeded");
  assert.equal(skipped.browserInputs.length, 0);
  assert.deepEqual([...skipped.rows.values()].map(({ status }) => status), ["skipped", "skipped"]);

  let executedSteps: string[] = [];
  let exposedEnv: Record<string, string | undefined> = {};
  const prefix = serviceHarness({
    plan,
    run: {
      environment: {
        requestedFlowIds: ["signup"], unsafeApproved: true,
        disposableAccountAcknowledged: true, allowSideEffects: false,
      },
    },
    runtimeEnv: { TEST_ACCOUNT: "1", TEST_EMAIL: "disposable@example.com", UNRELATED_SECRET: "must-not-leak" },
    executeBrowser: async (input) => {
      executedSteps = input.flows[0].steps.map(({ id }) => id);
      exposedEnv = input.env;
      return completeBrowserRun(input);
    },
  });
  assert.equal((await prefix.service.execute("run-1")).status, "succeeded");
  assert.deepEqual(executedSteps, ["read"]);
  assert.deepEqual(exposedEnv, { TEST_ACCOUNT: "1", TEST_EMAIL: "disposable@example.com" });
  assert.equal(prefix.rows.get(durableTestKey("signup", "submit"))?.status, "skipped");
});

test("missing unsafe-flow secrets refuse execution without persisting or echoing a value", async () => {
  const unsafe: CrawlFlow = {
    id: "signup", title: "Signup", description: "", safe: false,
    requiredSecrets: ["TEST_EMAIL"], steps: [plannedStep("email", "Email")],
  };
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [unsafe],
  };
  const secretValue = "never-persist-this@example.com";
  const harness = serviceHarness({
    plan,
    run: {
      environment: {
        requestedFlowIds: ["signup"], unsafeApproved: true,
        disposableAccountAcknowledged: true, allowSideEffects: false,
      },
    },
    runtimeEnv: { TEST_ACCOUNT: "1", UNRELATED: secretValue },
  });
  assert.equal((await harness.service.execute("21")).status, "failed");
  assert.equal(harness.browserInputs.length, 0);
  assert.deepEqual(harness.terminal, ["failed"]);
  const serialized = JSON.stringify(harness.upserts);
  assert.match(serialized, /TEST_EMAIL/);
  assert.equal(serialized.includes(secretValue), false);

  const safeWithSecret: CrawlFlow = { ...plannedFlow("authenticated", ["Account"]), requiredSecrets: ["SESSION_TOKEN"] };
  const safePlan = { ...plan, flows: [safeWithSecret] };
  const safeMissing = serviceHarness({ plan: safePlan });
  assert.equal((await safeMissing.service.execute("run-1")).status, "failed");
  assert.equal(safeMissing.browserInputs.length, 0);
  assert.match(JSON.stringify(safeMissing.upserts), /SESSION_TOKEN/);
});

test("cancellation and semantic failure become terminal without finalization", async () => {
  const flow = plannedFlow("core", ["Home"]);
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [flow],
  };
  const cancelled = serviceHarness({ plan, cancelled: true });
  assert.equal((await cancelled.service.execute("run-1")).status, "cancelled");
  assert.equal(cancelled.browserInputs.length, 0);
  assert.equal(cancelled.finalizations, 0);

  const failed = serviceHarness({
    plan,
    executeBrowser: async () => [{
      flowId: flow.id, status: "failed", completed: 0, skipped: 0, failed: 1, steps: [],
    }],
  });
  assert.equal((await failed.service.execute("run-1")).status, "failed");
  assert.deepEqual(failed.terminal, ["failed"]);
  assert.equal(failed.finalizations, 0);
});

test("durable service stores a failed-step screenshot as an internal object before recording the failure", async () => {
  const flow = plannedFlow("core", ["Home"]);
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [flow],
  };
  const uploaded: ObjectMetadata[] = [];
  const attached: Array<{ runId: string; flowId: string; stepId: string; object: ObjectMetadata }> = [];
  const harness = serviceHarness({
    plan,
    run: { id: "21" },
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => {
        const { body: _body, ...metadata } = input;
        uploaded.push(metadata);
        return { created: true, metadata };
      },
    } as unknown as ObjectStore,
    attachFailureObject: async (input) => { attached.push(input); },
    executeBrowser: async ({ hooks }) => {
      const step = flow.steps[0];
      await hooks.stepStarted(flow, step, 0, 1);
      const screenshot = await hooks.failure({ screenshot: async () => Buffer.from("failed screen") } as never, {
        flow: flow.id,
        flowTitle: flow.title,
        stepIndex: 0,
        stepId: step.id,
        step,
        currentUrl: plan.startUrl,
        expected: step.expected,
        errorClass: "SemanticStepError",
        error: "Expected Home",
      });
      const failure: FlowStepRecord = {
        stepId: step.id,
        index: 0,
        status: "failed",
        attempts: 1,
        failure: {
          flow: flow.id,
          flowTitle: flow.title,
          stepIndex: 0,
          stepId: step.id,
          step,
          currentUrl: plan.startUrl,
          expected: step.expected,
          errorClass: "SemanticStepError",
          error: "Expected Home",
          screenshot: screenshot ?? "",
        },
      };
      await hooks.stepFinished(flow, step, 0, failure);
      return [{ flowId: flow.id, status: "failed", completed: 0, skipped: 0, failed: 1, steps: [failure] }];
    },
  });

  assert.equal((await harness.service.execute("21")).status, "failed");
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].accessClass, "internal");
  assert.equal(attached.length, 1);
  assert.equal(attached[0].object.key, uploaded[0].key);
  assert.equal(harness.upserts.find((row) => row.status === "failed")?.failureScreenshot, uploaded[0].key);
});

test("infrastructure exceptions mark the run interrupted once and escape with their cause", async () => {
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [plannedFlow("core", ["Home"])],
  };
  const infrastructure = new Error("browser process exited");
  const harness = serviceHarness({ plan, executeBrowser: async () => { throw infrastructure; } });
  await assert.rejects(
    () => harness.service.execute("run-1"),
    (error) => error instanceof CrawlRunInterruptedError && error.cause === infrastructure,
  );
  assert.deepEqual(harness.terminal, ["interrupted"]);
  assert.equal(harness.finalizations, 0);

  const cancelledInfrastructure = serviceHarness({
    plan,
    resolveTerminalAsCancelled: true,
    executeBrowser: async () => { throw infrastructure; },
  });
  assert.equal((await cancelledInfrastructure.service.execute("run-1")).status, "cancelled");
  assert.deepEqual(cancelledInfrastructure.terminal, ["interrupted"]);

  const step = plan.flows[0].steps[0];
  const transientResult: FlowRunResult = {
    flowId: "core",
    status: "failed",
    completed: 0,
    skipped: 0,
    failed: 1,
    steps: [{
      stepId: step.id,
      index: 0,
      status: "failed",
      attempts: 2,
      failure: {
        flow: "core",
        flowTitle: "core title",
        stepIndex: 0,
        stepId: step.id,
        step,
        currentUrl: "https://example.com",
        expected: step.expected,
        errorClass: "Error",
        error: "Error: page.goto: net::ERR_CONNECTION_RESET",
        screenshot: "capture:failure",
      },
    }],
  };
  const serializedTransient = serviceHarness({
    plan,
    executeBrowser: async () => [transientResult],
  });
  await assert.rejects(() => serializedTransient.service.execute("run-1"), /Transient crawler infrastructure failure/);
  assert.deepEqual(serializedTransient.terminal, ["interrupted"]);

  const cancelledSerialized = serviceHarness({
    plan,
    resolveTerminalAsCancelled: true,
    executeBrowser: async () => [transientResult],
  });
  assert.equal((await cancelledSerialized.service.execute("run-1")).status, "cancelled");
  assert.deepEqual(cancelledSerialized.terminal, ["interrupted"]);
});

test("success requires an exact flow result set and matching durable evidence", async () => {
  const flow = plannedFlow("core", ["Home"]);
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [flow],
  };
  const interruptedBy = (pattern: RegExp) => (error: unknown) =>
    error instanceof CrawlRunInterruptedError
    && error.cause instanceof Error
    && pattern.test(error.cause.message);
  const omitted = serviceHarness({ plan, executeBrowser: async () => [] });
  await assert.rejects(() => omitted.service.execute("run-1"), interruptedBy(/incomplete or duplicate flow result set/));
  assert.deepEqual(omitted.terminal, ["interrupted"]);

  const result: FlowRunResult = {
    flowId: flow.id, status: "completed", completed: 1, skipped: 0, failed: 0, steps: [],
  };
  const duplicate = serviceHarness({ plan, executeBrowser: async () => [result, result] });
  await assert.rejects(() => duplicate.service.execute("run-1"), interruptedBy(/incomplete or duplicate flow result set/));
  assert.deepEqual(duplicate.terminal, ["interrupted"]);

  const noEvidence = serviceHarness({ plan, executeBrowser: async () => [result] });
  await assert.rejects(() => noEvidence.service.execute("run-1"), interruptedBy(/exact durable step evidence/));
  assert.deepEqual(noEvidence.terminal, ["interrupted"]);
  assert.equal(noEvidence.finalizations, 0);
});

test("same-run resume skips only the exact contiguous captured prefix", async () => {
  const flow = plannedFlow("core", ["First", "Second", "Third"]);
  const semanticUrl = "https://example.com/software?tab=tab-1";
  flow.steps[0] = { ...flow.steps[0], expected: { ...flow.steps[0].expected, url: semanticUrl } };
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [flow],
  };
  const firstEvidence = canonicalEvidence(1, flow.id, flow.steps[0].id, "https://example.com/software", { version_id: 9 });
  const secondEvidence = canonicalEvidence(2, flow.id, flow.steps[1].id, "https://example.com/second", { version_id: 9 });
  // PostgreSQL jsonb normalizes object key order on the round trip. Durable
  // equality must compare JSON values, not their insertion-order serialization.
  const reorderedFirstExpected = {
    visible: flow.steps[0].expected.visible,
    url: flow.steps[0].expected.url,
    state: flow.steps[0].expected.state,
  };
  const first = storedStep("run-1", flow.id, flow.steps[0].id, {
    status: "completed", expected: reorderedFirstExpected,
    actual: { sourceUrl: "https://example.com", finalUrl: semanticUrl, page: "same", visible: true },
    final_url: semanticUrl, observed_screenshot_hash: "a".repeat(64), evidence_id: firstEvidence.id,
  });
  const invalidSecond = storedStep("run-1", flow.id, flow.steps[1].id, {
    step_order: 1, status: "completed", expected: flow.steps[1].expected,
    actual: { sourceUrl: semanticUrl, finalUrl: "https://example.com/second", page: "same", visible: false },
    final_url: "https://example.com/second", observed_screenshot_hash: "b".repeat(64), evidence_id: secondEvidence.id,
  });
  let resume: unknown;
  const harness = serviceHarness({
    plan, steps: [first, invalidSecond], evidence: [firstEvidence, secondEvidence],
    executeBrowser: async (input) => {
      resume = input.resumes.get(flow.id);
      return completeBrowserRun(input);
    },
  });
  assert.equal((await harness.service.execute("run-1")).status, "succeeded");
  assert.deepEqual(resume, { stepIndex: 1, url: semanticUrl });
});

test("cancel, retry, and stale recovery delegate durable relationships and IDs", async () => {
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [plannedFlow("core", ["Home"])],
  };
  const harness = serviceHarness({ plan });
  assert.equal((await harness.service.cancel("run-1")).status, "cancelled");
  assert.deepEqual(
    { id: (await harness.service.retry("run-1", "failed")).id, mode: (await harness.service.retry("run-1", "full")).retry_mode },
    { id: "run-2", mode: "all" },
  );
  assert.deepEqual(await harness.service.recoverStaleRuns(new Date(0)), ["stale-1"]);
});

test("a cancellation racing with finalization cannot become false success", async () => {
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [plannedFlow("core", ["Home"])],
  };
  let requestCancellation = () => {};
  const harness = serviceHarness({ plan, onFinalize: () => requestCancellation() });
  requestCancellation = () => harness.setCancelled(true);
  assert.equal((await harness.service.execute("run-1")).status, "cancelled");
  assert.deepEqual(harness.terminal, ["cancelled"]);
  assert.equal(harness.finalizations, 1);
});

test("execute returns a terminal run when cancellation wins the claim race", async () => {
  const plan: CrawlPlan = {
    app: "fixture-app", revision: 1, startUrl: "https://example.com", domain: "example.com",
    sources: [], reviewed: true, flows: [plannedFlow("core", ["Home"])],
  };
  const queued = serviceRun(plan);
  const cancelled = { ...queued, status: "cancelled" as const };
  let reads = 0;
  const service = createCrawlRunService({
    workerId: "worker-1",
    store: {
      getRun: async () => ++reads === 1 ? queued : cancelled,
      claimRunById: async () => { throw new Error("Terminal crawl run cannot be claimed"); },
    } as never,
  });
  assert.equal((await service.execute(queued.id)).status, "cancelled");
});
