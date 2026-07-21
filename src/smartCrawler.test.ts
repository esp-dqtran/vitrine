import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { chromium, errors, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import type { CrawlFlow, CrawlPlan, CrawlStep, ExpectedState } from "./crawlPlan.ts";
import * as smartCrawlerModule from "./smartCrawler.ts";
import {
  assembleFlows,
  assertExpectedState,
  assertRunnable,
  assertAgentEpisodePlan,
  captureIfNew,
  dbCaptureSink,
  dedupeKey,
  installSettleTracker,
  interpretStep,
  MAX_CAPTURE_HEIGHT_PX,
  pngSize,
  runFlow,
  sha16,
  splitBySafety,
  withDurableFailureArtifacts,
  type CaptureRecord,
  type CrawlExecutionResult,
  type FlowRunResult,
  type RunnerHooks,
  type StepActual,
} from "./smartCrawler.ts";
import type { DesignFlow } from "./designSystem.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

// ---------- pure parts ----------

let nextFixtureStepId = 0;

function fixtureStep(
  fields: Omit<CrawlStep, "id" | "safety" | "expected"> & Partial<Pick<CrawlStep, "expected">>
): CrawlStep {
  const { expected = { state: "Fixture page", visible: { text: "Fixture app" } }, ...step } = fields;
  return {
    ...step,
    id: `fixture-step-${++nextFixtureStepId}`,
    safety: "read",
    expected,
  };
}

test("dedupe key is stable and drops query strings", () => {
  const viewport = { width: 1280, height: 720 };
  const a = dedupeKey("https://x.com/pricing?utm=1", "Plans", viewport);
  const b = dedupeKey("https://x.com/pricing?utm=2#hash", "Plans", viewport);
  assert.equal(a, b);
  assert.notEqual(a, dedupeKey("https://x.com/pricing", "Plans changed", viewport));
  assert.notEqual(a, dedupeKey("https://x.com/pricing", "Plans", { width: 375, height: 812 }));
});

test("accepts only one reviewed bounded flow as an agent episode", () => {
  const flow: CrawlFlow = { id: "episode", title: "Episode", description: "", safe: true, requiredSecrets: [], steps: [fixtureStep({ action: "click", text: "New", expected: { state: "New", page: "same", visible: { text: "New" } } })] };
  assert.doesNotThrow(() => assertAgentEpisodePlan({ app: "fixture", revision: 1, startUrl: "https://app.test", domain: "", sources: [], reviewed: true, flows: [flow] }));
  assert.throws(() => assertAgentEpisodePlan({ app: "fixture", revision: 1, startUrl: "https://app.test", domain: "", sources: [], reviewed: false, flows: [flow] }), /review/);
  assert.throws(() => assertAgentEpisodePlan({ app: "fixture", revision: 1, startUrl: "https://app.test", domain: "", sources: [], reviewed: true, flows: [flow, flow] }), /exactly one flow/);
});

function pngFixture(): Buffer {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(1440, 16);
  png.writeUInt32BE(900, 20);
  return png;
}

test("legacy capture sink uploads verified PNG bytes before attaching the image", async () => {
  const events: string[] = [];
  let uploaded: ObjectMetadata | undefined;
  const { sink, ledger } = dbCaptureSink("fixture", {
    insertImage: async (_app, _platform, reference) => { events.push(`insert:${reference}`); return 41; },
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => { events.push("put"); uploaded = input; return { created: true, metadata: input }; },
    } as unknown as ObjectStore,
    attachImage: async (imageId, metadata) => {
      events.push(`attach:${imageId}`);
      const { body: _body, ...expected } = uploaded! as ObjectMetadata & { body: Uint8Array };
      assert.deepEqual(metadata, expected);
    },
  });
  await sink({ png: pngFixture(), sourceUrl: "https://example.com/home", stateContext: "home" });
  assert.deepEqual(events.map((event) => event.split(":")[0]), ["insert", "put", "attach"]);
  assert.match(uploaded!.key, /^images\/41\/[0-9a-f]{64}\.png$/);
  assert.equal(uploaded!.contentType, "image/png");
  assert.equal(uploaded!.accessClass, "protected");
  assert.equal(ledger.length, 1);
});

test("legacy capture upload failure leaves no association and an identical retry succeeds", async () => {
  let attached = false;
  let puts = 0;
  const { sink } = dbCaptureSink("fixture", {
    insertImage: async () => 42,
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => {
        if (++puts === 1) throw new Error("storage unavailable");
        return { created: true, metadata: input };
      },
    } as unknown as ObjectStore,
    attachImage: async () => { attached = true; },
  });
  const capture = { png: pngFixture(), sourceUrl: "https://example.com/home", stateContext: "home" };
  await assert.rejects(sink(capture), /storage unavailable/);
  assert.equal(attached, false);
  await sink(capture);
  assert.equal(attached, true);
  assert.equal(puts, 2);
});

test("legacy capture rejects mismatched adapter metadata before attachment", async () => {
  let attached = false;
  const { sink } = dbCaptureSink("fixture", {
    insertImage: async () => 43,
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => ({
        created: true,
        metadata: { ...input, key: "images/999/" + "0".repeat(64) + ".png" },
      }),
    } as unknown as ObjectStore,
    attachImage: async () => { attached = true; },
  });
  await assert.rejects(sink({ png: pngFixture(), sourceUrl: "https://example.com/home", stateContext: "home" }), /metadata does not match/);
  assert.equal(attached, false);
});

test("URL validation accepts a matching settled URL after Playwright reports an interrupted wait", async () => {
  const expected: ExpectedState = {
    state: "Rovo overview",
    url: "https://www.atlassian.com/software/rovo",
  };
  const actual: StepActual = {
    sourceUrl: "https://www.atlassian.com/",
    finalUrl: "about:blank",
    page: "same",
  };
  let waits = 0;
  const settledPage = {
    waitForURL: async () => {
      waits++;
      throw new Error("Navigation was interrupted by another navigation");
    },
    url: () => expected.url!,
  } as unknown as Page;

  await assertExpectedState(settledPage, expected, actual, 50);

  assert.equal(waits, 1);
  assert.equal(actual.finalUrl, expected.url);
});

test("refuses unreviewed plans and splits unsafe flows without TEST_ACCOUNT", () => {
  const flows: CrawlFlow[] = [
    { id: "safe", title: "Safe", description: "", safe: true, requiredSecrets: [], steps: [] },
    { id: "risky", title: "Risky", description: "", safe: false, requiredSecrets: [], steps: [] },
  ];
  const plan: CrawlPlan = { app: "x", revision: 1, startUrl: "https://x.com", domain: "", sources: [], reviewed: false, flows };
  assert.throws(() => assertRunnable(plan), /reviewed: false/);
  assert.doesNotThrow(() => assertRunnable({ ...plan, reviewed: true }));

  const split = splitBySafety(plan, {});
  assert.deepEqual(split.runnable.map((f) => f.id), ["safe"]);
  assert.deepEqual(split.skippedUnsafe.map((f) => f.id), ["risky"]);
  const withTestAccount = splitBySafety(plan, { TEST_ACCOUNT: "1" });
  assert.equal(withTestAccount.runnable.length, 2);
});

test("assembles flow evidence from the ledger and merges over existing flows", () => {
  const executed: CrawlFlow[] = [
    { id: "pricing", title: "Pricing", description: "d", safe: true, requiredSecrets: [], steps: [] },
    { id: "empty", title: "No captures", description: "", safe: true, requiredSecrets: [], steps: [] },
  ];
  const ledger = [
    { ref: "capture:aa", stateContext: "pricing/start" },
    { ref: "capture:bb", stateContext: "pricing/1. click Plans" },
    { ref: "capture:bb", stateContext: "pricing/2. click Plans again" }, // same image twice -> one evidence
    { ref: "capture:zz", stateContext: "other/start" }, // different flow prefix
  ];
  const refs = new Map([
    ["capture:aa", 11],
    ["capture:bb", 22],
  ]);
  const existing: DesignFlow[] = [
    { id: "pricing", title: "Old", description: "", tags: [], steps: [{ label: "old", evidence: [1] }] },
    { id: "keep", title: "Keep", description: "", tags: [], steps: [{ label: "k", evidence: [2] }] },
  ];
  const flows = assembleFlows(executed, ledger, refs, existing);
  assert.deepEqual(flows.map((f) => f.id), ["keep", "pricing"]); // replaced, not duplicated; no empty flow
  const pricing = flows.find((f) => f.id === "pricing")!;
  assert.deepEqual(pricing.steps.map((s) => s.evidence), [[11], [22]]);
  assert.deepEqual(pricing.tags, ["smart-crawler"]);
});

test("context initialization failure closes the launched context", async () => {
  let closes = 0;
  const initializeOwnedContext = (smartCrawlerModule as typeof smartCrawlerModule & {
    initializeOwnedContext?: (
      create: () => Promise<{ close: () => Promise<void> }>,
      initialize: (context: { close: () => Promise<void> }) => Promise<void>
    ) => Promise<{ close: () => Promise<void> }>;
  }).initializeOwnedContext;
  assert.equal(typeof initializeOwnedContext, "function");

  await assert.rejects(
    initializeOwnedContext!(
      async () => ({ close: async () => void closes++ }),
      async () => {
        throw new Error("Settle tracker failed");
      }
    ),
    /Settle tracker failed/
  );
  assert.equal(closes, 1);
});

test("context work failure closes the owned context", async () => {
  let closes = 0;
  const withOwnedContext = (smartCrawlerModule as typeof smartCrawlerModule & {
    withOwnedContext?: <T>(context: { close: () => Promise<void> }, work: () => Promise<T>) => Promise<T>;
  }).withOwnedContext;
  assert.equal(typeof withOwnedContext, "function");

  await assert.rejects(
    withOwnedContext!({ close: async () => void closes++ }, async () => {
      throw new Error("Capture failed");
    }),
    /Capture failed/
  );
  assert.equal(closes, 1);
});

// ---------- browser-bound parts, against a local fixture ----------

const FIXTURE = `<!doctype html><html><head><title>Fixture</title></head><body>
  <h1>Fixture app</h1>
  <p id="initial-state">Initial state</p>
  <span hidden>Duplicate label</span>
  <button id="dup" onclick="this.textContent='Duplicate clicked'">Duplicate label</button>
  <button id="open">Open panel</button>
  <button id="client-nav">Client navigate</button>
  <a id="popup" target="_blank" href="/popup?source=fixture">Open popup</a>
  <a id="slow-popup" target="_blank" href="/popup?source=slow" hidden>Slow popup target</a>
  <button id="popup-then-detach">Open popup then fail</button>
  <button id="late-popup">Open popup during validation</button>
  <button id="delayed">Show delayed state</button>
  <button id="brief-url">Visit brief URL</button>
  <button class="ambiguous-action">Ambiguous action</button>
  <button class="ambiguous-action">Ambiguous action</button>
  <button id="hide-duplicate">Hide visible duplicate</button>
  <button id="changing-assertions">Change assertion state</button>
  <button id="noop">No-op control</button>
  <button id="replace">Replace status</button>
  <a href="/second">Second page</a>
  <input aria-label="Search" type="text" />
  <div id="panel" hidden><p>Panel content</p></div>
  <h2 id="client-state" hidden>Client state</h2>
  <p id="delayed-state" hidden>Delayed state</p>
  <p id="late-popup-state" hidden>Late popup state</p>
  <p id="brief-state" hidden>Brief state</p>
  <p id="brief-blocker">Brief blocker</p>
  <p>Ambiguous visible state</p>
  <p>Ambiguous visible state</p>
  <p id="hidden-duplicate-first" hidden>Tracked duplicate</p>
  <p id="hidden-duplicate-visible">Tracked duplicate</p>
  <p id="transient-visible">Transient visible</p>
  <p id="blocking-hidden">Blocking hidden</p>
  <p id="replace-status">Old status</p>
  <script>
    document.getElementById("open").addEventListener("click", () => {
      document.getElementById("panel").hidden = false;
    });
    document.getElementById("client-nav").addEventListener("click", () => {
      history.pushState({}, "", "/client");
      document.getElementById("client-state").hidden = false;
      document.getElementById("initial-state").hidden = true;
    });
    document.getElementById("delayed").addEventListener("click", () => {
      setTimeout(() => {
        history.pushState({}, "", "/delayed");
        document.getElementById("delayed-state").hidden = false;
      }, 750);
    });
    document.getElementById("popup-then-detach").addEventListener("mousedown", (event) => {
      window.open("/popup?source=action-error", "_blank");
      event.currentTarget.remove();
    });
    setTimeout(() => document.getElementById("slow-popup").hidden = false, 1200);
    document.getElementById("late-popup").addEventListener("click", () => {
      setTimeout(() => document.getElementById("popup").click(), 800);
      setTimeout(() => document.getElementById("late-popup-state").hidden = false, 1000);
    });
    document.getElementById("brief-url").addEventListener("click", () => {
      history.pushState({}, "", "/brief");
      setTimeout(() => history.replaceState({}, "", "/after"), 800);
      setTimeout(() => document.getElementById("brief-state").hidden = false, 1000);
      setTimeout(() => document.getElementById("brief-state").hidden = true, 1500);
      setTimeout(() => document.getElementById("brief-blocker").hidden = true, 1700);
    });
    document.getElementById("hide-duplicate").addEventListener("click", () => {
      setTimeout(() => document.getElementById("hidden-duplicate-visible").hidden = true, 800);
    });
    document.getElementById("changing-assertions").addEventListener("click", () => {
      setTimeout(() => document.getElementById("transient-visible").hidden = true, 800);
      setTimeout(() => document.getElementById("blocking-hidden").hidden = true, 1000);
    });
    document.getElementById("replace").addEventListener("click", () => {
      document.getElementById("replace-status").outerHTML = '<p id="replace-status">Fresh replacement</p>';
    });
  </script>
</body></html>`;
const SECOND = `<!doctype html><html><body><h1>Second page</h1></body></html>`;
const POPUP = `<!doctype html><html><body>
  <h1>Popup page</h1>
  <button id="continue-popup" onclick="document.getElementById('popup-complete').hidden = false">Continue popup</button>
  <p id="popup-complete" hidden>Popup complete</p>
</body></html>`;
const TALL = `<!doctype html><html><body><h1>Tall page</h1><div style="height:20000px">very long content</div></body></html>`;

let server: Server;
let baseUrl: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;

before(async () => {
  server = createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(req.url === "/second" ? SECOND : req.url?.startsWith("/popup") ? POPUP : req.url === "/tall" ? TALL : FIXTURE);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  browser = await chromium.launch();
  context = await browser.newContext();
  await installSettleTracker(context);
  page = await context.newPage();
});

after(async () => {
  await browser?.close();
  server?.close();
});

function fixturePlan(flows: CrawlFlow[]): CrawlPlan {
  return { app: "fixture", revision: 1, startUrl: baseUrl, domain: "", sources: [], reviewed: true, flows };
}

function collectingSink(): { records: CaptureRecord[]; sink: (r: CaptureRecord) => Promise<void> } {
  const records: CaptureRecord[] = [];
  return { records, sink: async (r) => void records.push(r) };
}

function silentRunnerHooks(overrides: Partial<RunnerHooks> = {}): RunnerHooks {
  return {
    cancelled: () => false,
    stepStarted: async () => {},
    stepFinished: async () => {},
    capture: async () => {},
    failure: async () => undefined,
    ...overrides,
  };
}

function cliRunnerHooks(sink: (record: CaptureRecord) => Promise<void>, reportDir: string): RunnerHooks {
  const create = (smartCrawlerModule as typeof smartCrawlerModule & {
    createCliRunnerHooks?: (
      sink: (record: CaptureRecord) => Promise<void>,
      reportDir: string,
      cancelled: () => boolean
    ) => RunnerHooks;
  }).createCliRunnerHooks;
  assert.equal(typeof create, "function");
  return create!(sink, reportDir, () => false);
}

function completedActual(activePage: Page): StepActual {
  return { sourceUrl: activePage.url(), finalUrl: activePage.url(), page: "same" };
}

test("runner resume starts at the requested original index and URL without replaying prior steps", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-resume-flow-"));
  const steps = [
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Second page" }),
    fixtureStep({ action: "waitFor", text: "Second page" }),
  ];
  const flow: CrawlFlow = { id: "resume", title: "Resume", description: "", safe: true, requiredSecrets: [], steps };
  const executed: Array<{ stepId: string; url: string }> = [];
  const started: number[] = [];
  const finished: number[] = [];
  const captured: Array<{ stepId: string; state: string }> = [];

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      resume: { stepIndex: 1, url: `${baseUrl}/second` },
      hooks: silentRunnerHooks({
        stepStarted: async (_flow, _step, index) => void started.push(index),
        stepFinished: async (_flow, _step, index) => void finished.push(index),
        capture: async (_page, _flow, step, state) => void captured.push({ stepId: step!.id, state }),
      }),
      executeStep: async (activePage, _plan, step) => {
        executed.push({ stepId: step.id, url: activePage.url() });
        return { status: "completed", page: activePage, actual: completedActual(activePage) };
      },
    });

    assert.equal(result.status, "completed");
    assert.deepEqual(executed, [
      { stepId: steps[1].id, url: `${baseUrl}/second` },
      { stepId: steps[2].id, url: `${baseUrl}/second` },
    ]);
    assert.deepEqual(started, [1, 2]);
    assert.deepEqual(finished, [1, 2]);
    assert.deepEqual(result.steps.map(({ stepId, index }) => ({ stepId, index })), [
      { stepId: steps[1].id, index: 1 },
      { stepId: steps[2].id, index: 2 },
    ]);
    assert.deepEqual(captured.map(({ stepId }) => stepId), [steps[1].id, steps[2].id]);
    assert.match(captured[0].state, /^resume\/2\./);
    assert.match(captured[1].state, /^resume\/3\./);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("completed capture hook receives the observed step actual before stepFinished", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-capture-actual-"));
  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "capture-actual", title: "Capture actual", description: "", safe: true, requiredSecrets: [], steps: [step] };
  const actual: StepActual = { sourceUrl: `${baseUrl}/before`, finalUrl: `${baseUrl}/after`, page: "same", visible: true };
  const events: string[] = [];
  let capturedActual: StepActual | undefined;

  try {
    await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks({
        capture: (async (...args: unknown[]) => {
          events.push("capture");
          capturedActual = args[4] as StepActual | undefined;
        }) as RunnerHooks["capture"],
        stepFinished: async () => void events.push("finished"),
      }),
      executeStep: async (activePage) => ({ status: "completed", page: activePage, actual }),
    });

    assert.equal(capturedActual, actual);
    assert.deepEqual(events, ["capture", "finished"]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("owned flow executor closes its page and context after success, failure, and cancellation", async () => {
  type ExecuteOwned = (
    plan: CrawlPlan,
    flows: CrawlFlow[],
    options: {
      createContext(): Promise<BrowserContext>;
      hooks: RunnerHooks;
      env?: Record<string, string | undefined>;
      executeStep?: typeof interpretStep;
      resumes?: ReadonlyMap<string, { stepIndex: number; url: string }>;
      afterRun?: (context: BrowserContext, results: FlowRunResult[]) => Promise<void>;
    }
  ) => Promise<FlowRunResult[]>;
  const executeOwned = (smartCrawlerModule as typeof smartCrawlerModule & { executeFlowsInOwnedContext?: ExecuteOwned })
    .executeFlowsInOwnedContext;
  assert.equal(typeof executeOwned, "function");

  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "owned", title: "Owned", description: "", safe: true, requiredSecrets: [], steps: [step] };
  const plan = fixturePlan([flow]);

  for (const scenario of ["success", "failure", "cancel"] as const) {
    let ownedContext!: BrowserContext;
    let ownedPage!: Page;
    const captureError = new Error("Durable capture failed");
    const hooks = silentRunnerHooks({
      cancelled: () => scenario === "cancel",
      ...(scenario === "failure" ? { capture: async () => Promise.reject(captureError) } : {}),
    });
    const work = executeOwned!(plan, [flow], {
      createContext: async () => {
        ownedContext = await browser.newContext();
        ownedPage = await ownedContext.newPage();
        return ownedContext;
      },
      hooks,
      afterRun: async (context, results) => {
        assert.equal(context, ownedContext);
        assert.equal(results.length, 1);
        assert.equal(ownedPage.isClosed(), false);
      },
      executeStep: async (activePage) => ({ status: "completed", page: activePage, actual: completedActual(activePage) }),
    });

    if (scenario === "failure") await assert.rejects(work, (error) => error === captureError);
    else {
      const [result] = await work;
      assert.equal(result.status, scenario === "cancel" ? "cancelled" : "completed");
    }
    assert.equal(ownedPage.isClosed(), true, `${scenario} page should close`);
    await assert.rejects(ownedContext.newPage(), `${scenario} context should close`);
  }
});

test("review: cancellation requested during start navigation skips index zero and every remaining step", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-cancel-during-goto-"));
  const steps = [
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
  ];
  const flow: CrawlFlow = { id: "cancel-during-goto", title: "Cancel during goto", description: "", safe: true, requiredSecrets: [], steps };
  let cancellationChecks = 0;
  let executions = 0;
  let captures = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks({
        cancelled: () => ++cancellationChecks > 1,
        capture: async () => void captures++,
      }),
      executeStep: async (activePage) => {
        executions++;
        return { status: "completed", page: activePage, actual: completedActual(activePage) };
      },
    });

    assert.equal(result.status, "cancelled");
    assert.deepEqual(result.steps.map(({ status, attempts, reason }) => ({ status, attempts, reason })), [
      { status: "skipped", attempts: 0, reason: "cancelled" },
      { status: "skipped", attempts: 0, reason: "cancelled" },
    ]);
    assert.equal(executions, 0);
    assert.equal(captures, 0);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("review: stepStarted hook errors bypass retry, execution, and failure serialization", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-step-started-error-"));
  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "hook-error", title: "Hook error", description: "", safe: true, requiredSecrets: [], steps: [step] };
  const hookError = new Error("page.goto: net::ERR_CONNECTION_RESET from stepStarted");
  let starts = 0;
  let executions = 0;
  let failures = 0;
  let finishes = 0;

  try {
    await assert.rejects(
      runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
        hooks: silentRunnerHooks({
          stepStarted: async () => {
            starts++;
            throw hookError;
          },
          failure: async () => {
            failures++;
            return undefined;
          },
          stepFinished: async () => void finishes++,
        }),
        executeStep: async (activePage) => {
          executions++;
          return { status: "completed", page: activePage, actual: completedActual(activePage) };
        },
      }),
      (error) => error === hookError
    );
    assert.deepEqual({ starts, executions, failures, finishes }, { starts: 1, executions: 0, failures: 0, finishes: 0 });
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("review: a completed step is not finished until its capture is durable", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-capture-order-"));
  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "capture-order", title: "Capture order", description: "", safe: true, requiredSecrets: [], steps: [step] };
  const captureError = new Error("Capture sink failed after execution");
  const events: string[] = [];

  try {
    await assert.rejects(
      runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
        hooks: silentRunnerHooks({
          capture: async () => {
            events.push("capture");
            throw captureError;
          },
          stepFinished: async (_flow, _step, _index, result) => void events.push(`finished:${result.status}`),
        }),
        executeStep: async (activePage) => {
          events.push("execute");
          return { status: "completed", page: activePage, actual: completedActual(activePage) };
        },
      }),
      (error) => error === captureError
    );
    assert.deepEqual(events, ["execute", "capture"]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("review: captureIfNew retries the same state after a sink failure", async () => {
  await page.goto(baseUrl);
  const seen = new Set<string>();
  const records: CaptureRecord[] = [];
  const sinkError = new Error("First sink attempt failed");
  let attempts = 0;
  const sink = async (record: CaptureRecord): Promise<void> => {
    if (++attempts === 1) throw sinkError;
    records.push(record);
  };

  await assert.rejects(captureIfNew(page, seen, "retry/start", sink), (error) => error === sinkError);
  assert.equal(seen.size, 0);
  assert.equal(await captureIfNew(page, seen, "retry/start", sink), true);
  assert.deepEqual({ attempts, records: records.length, seen: seen.size }, { attempts: 2, records: 1, seen: 1 });
});

test("review: record mode propagates a later capture sink error", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-record-capture-error-"));
  const flow: CrawlFlow = { id: "record-error", title: "Record error", description: "", safe: true, requiredSecrets: [], steps: [] };
  const sinkError = new Error("Recorded-state sink failed");
  let cancellationChecks = 0;
  let captures = 0;

  try {
    await assert.rejects(
      runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
        hooks: silentRunnerHooks({
          cancelled: () => ++cancellationChecks >= 4,
          capture: async () => {
            if (++captures === 2) throw sinkError;
          },
        }),
      }),
      (error) => error === sinkError
    );
    assert.equal(captures, 2);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("review: crawl progress finalization maps outcomes and preserves the original work error", async () => {
  type Progress = {
    stage: "crawl" | "caption" | "synthesize" | "smart-crawl";
    app: string;
    done: number;
    total: number;
    status: "running" | "done" | "error" | "cancelled" | "idle";
    message?: string;
  };
  const withCrawlProgress = (smartCrawlerModule as typeof smartCrawlerModule & {
    withCrawlProgress?: (
      app: string,
      total: number,
      done: () => number,
      work: () => Promise<CrawlExecutionResult>,
      write?: (progress: Progress) => void
    ) => Promise<CrawlExecutionResult>;
  }).withCrawlProgress;
  assert.equal(typeof withCrawlProgress, "function");

  const flowResults: FlowRunResult[] = [];
  const result = (status: CrawlExecutionResult["status"]): CrawlExecutionResult => ({
    status,
    flowResults,
    completedFlows: status === "succeeded" ? 2 : 1,
    failedFlows: status === "failed" ? 1 : 0,
    skippedFlows: status === "cancelled" ? 1 : 0,
    completedSteps: 0,
    failedSteps: 0,
    skippedSteps: 0,
    skippedUnsafe: [],
  });
  const writes: Progress[] = [];
  for (const [status, expected] of [
    ["succeeded", "done"],
    ["failed", "error"],
    ["cancelled", "cancelled"],
  ] as const) {
    await withCrawlProgress!("fixture", 3, () => 2, async () => result(status), (progress) => void writes.push(progress));
    assert.equal(writes.at(-1)?.status, expected);
    assert.equal(writes.at(-1)?.done, 2);
  }

  const workError = new Error("Capture/report/assembly failed");
  let errorProgress: Progress | undefined;
  await assert.rejects(
    withCrawlProgress!(
      "fixture",
      3,
      () => 1,
      async () => {
        throw workError;
      },
      (progress) => {
        errorProgress = progress;
        throw new Error("Progress write also failed");
      }
    ),
    (error) => error === workError
  );
  assert.deepEqual(errorProgress && { status: errorProgress.status, done: errorProgress.done }, { status: "error", done: 1 });
});

test("review: structured failures redact required secrets and credential URL parts without mutating the plan", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-secret-safe-failure-"));
  const secret = "known-secret-value-7f6e";
  const unrelated = "unrelated-value-must-remain";
  const step = fixtureStep({ action: "fill", role: "textbox", name: "Search", value: "$SEARCH_SECRET" });
  const flow: CrawlFlow = {
    id: "secret-safe",
    title: "Secret safe",
    description: "",
    safe: true,
    requiredSecrets: ["SEARCH_SECRET"],
    steps: [step],
  };
  const originalStep = structuredClone(step);
  const credentialUrl = new URL(`${baseUrl}/private?token=${secret}#${secret}`);
  credentialUrl.username = "crawler-user";
  credentialUrl.password = "crawler-password";
  const finalUrl = `${baseUrl}/final?credential=${secret}#private-fragment`;
  let received: Parameters<RunnerHooks["failure"]>[1] | undefined;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      env: { SEARCH_SECRET: secret, UNRELATED: unrelated },
      hooks: silentRunnerHooks({
        failure: async (_failedPage, failure) => {
          received = failure;
          return "capture:secret-safe";
        },
      }),
      executeStep: async (activePage, _plan, activeStep, env) => {
        assert.equal(activeStep.value, "$SEARCH_SECRET");
        assert.equal(env?.SEARCH_SECRET, secret);
        await activePage.goto(`${baseUrl}/current?token=${secret}#current-secret`);
        const actual: StepActual = { sourceUrl: credentialUrl.toString(), finalUrl, page: "same", visible: false };
        const error = new smartCrawlerModule.SemanticStepError(activeStep.expected, actual, activePage);
        error.message = `Resolved ${secret}; kept ${unrelated}; source ${credentialUrl.toString()} final ${finalUrl}`;
        throw error;
      },
    });

    assert.ok(received);
    assert.equal(received.currentUrl, `${baseUrl}/current`);
    assert.deepEqual(received.actual, {
      sourceUrl: `${baseUrl}/private`,
      finalUrl: `${baseUrl}/final`,
      page: "same",
      visible: false,
    });
    assert.deepEqual(step, originalStep);
    assert.equal(received.step, step);
    assert.equal(received.expected, step.expected);
    const serialized = JSON.stringify({ received, result });
    for (const forbidden of [secret, "crawler-user", "crawler-password", "token=", "credential=", "private-fragment", "current-secret"]) {
      assert.equal(serialized.includes(forbidden), false, `serialized failure leaked ${forbidden}`);
    }
    assert.equal(serialized.includes("$SEARCH_SECRET"), true);
    assert.equal(serialized.includes(unrelated), true);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("review: failed popup pages close before failure hooks propagate infrastructure errors", async (t) => {
  const step = fixtureStep({
    action: "click",
    role: "link",
    name: "Open popup",
    expected: { state: "Missing popup state", page: "new", visible: { text: "Never rendered in popup" } },
  });
  const flow: CrawlFlow = { id: "popup-hook-error", title: "Popup hook error", description: "", safe: true, requiredSecrets: [], steps: [step] };

  for (const throwingHook of ["failure", "stepFinished"] as const) {
    await t.test(throwingHook, async () => {
      const reportDir = mkdtempSync(join(tmpdir(), `astryx-popup-${throwingHook}-error-`));
      const hookError = new Error(`${throwingHook} hook failed`);
      const pageCountBefore = context.pages().length;
      let failedChild: Page | undefined;
      try {
        await assert.rejects(
          runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
            hooks: silentRunnerHooks({
              failure: async () => {
                if (throwingHook === "failure") throw hookError;
                return "capture:popup-hook-error";
              },
              stepFinished: async (_flow, _step, _index, record) => {
                if (throwingHook === "stepFinished" && record.status === "failed") throw hookError;
              },
            }),
            executeStep: async () => {
              failedChild = await context.newPage();
              await failedChild.goto(`${baseUrl}/popup?source=${throwingHook}`);
              throw new smartCrawlerModule.SemanticStepError(
                step.expected,
                { sourceUrl: page.url(), finalUrl: failedChild.url(), page: "new", visible: false },
                failedChild
              );
            },
          }),
          (error) => error === hookError
        );
        assert.equal(failedChild?.isClosed(), true);
        assert.equal(context.pages().length, pageCountBefore);
      } finally {
        await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
        rmSync(reportDir, { recursive: true, force: true });
      }
    });
  }
});

function semanticError(
  error: unknown,
  expected: ExpectedState,
  actual: { sourceUrl: string; finalUrl: string; page: "same" | "new"; visible?: boolean; hidden?: boolean }
): boolean {
  const ErrorType = (smartCrawlerModule as typeof smartCrawlerModule & {
    SemanticStepError?: new (...args: never[]) => Error;
  }).SemanticStepError;
  assert.equal(typeof ErrorType, "function");
  assert.ok(error instanceof ErrorType);
  assert.deepEqual((error as Error & { expected: ExpectedState }).expected, expected);
  assert.deepEqual((error as Error & { actual: typeof actual }).actual, actual);
  return true;
}

test("transient retry classifier excludes semantic and Playwright timeout failures", () => {
  const classify = (smartCrawlerModule as typeof smartCrawlerModule & {
    isTransientBrowserError?: (error: unknown) => boolean;
  }).isTransientBrowserError;
  assert.equal(typeof classify, "function");
  assert.equal(classify!(new Error("page.goto: net::ERR_CONNECTION_RESET")), true);
  assert.equal(classify!(new Error("Navigation was interrupted by another navigation")), true);
  assert.equal(classify!(new Error("Target page, context or browser has been closed")), true);
  assert.equal(classify!(new errors.TimeoutError("locator.waitFor: ERR_TIMED_OUT")), false);
  assert.equal(
    classify!(
      new smartCrawlerModule.SemanticStepError(
        { state: "Expected", url: "https://example.com/expected" },
        { sourceUrl: "https://example.com/", finalUrl: "https://example.com/actual", page: "same" }
      )
    ),
    false
  );
});

test("structured flow result records completed and optional skipped steps in order", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-structured-result-"));
  const steps = [
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app", optional: true, optionalReason: "Overlay absent" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
  ];
  const flow: CrawlFlow = { id: "ordered", title: "Ordered", description: "", safe: true, requiredSecrets: [], steps };
  const captures: string[] = [];
  const finished: Array<{ stepId: string; status: string }> = [];
  const hooks = silentRunnerHooks({
    capture: async (_page, _flow, step) => void captures.push(step?.id ?? "recorded"),
    stepFinished: async (_flow, _step, _index, result) => void finished.push(result),
  });

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks,
      executeStep: async (activePage, _plan, step) =>
        step === steps[1]
          ? { status: "skipped", page: activePage, actual: completedActual(activePage), reason: "Overlay absent" }
          : { status: "completed", page: activePage, actual: completedActual(activePage) },
    });

    assert.equal(result.status, "completed");
    assert.deepEqual({ completed: result.completed, skipped: result.skipped, failed: result.failed }, { completed: 2, skipped: 1, failed: 0 });
    assert.deepEqual(
      result.steps.map(({ stepId, index, status, attempts, reason }) => ({ stepId, index, status, attempts, reason })),
      [
        { stepId: steps[0].id, index: 0, status: "completed", attempts: 1, reason: undefined },
        { stepId: steps[1].id, index: 1, status: "skipped", attempts: 1, reason: "Overlay absent" },
        { stepId: steps[2].id, index: 2, status: "completed", attempts: 1, reason: undefined },
      ]
    );
    assert.deepEqual(captures, [steps[0].id, steps[2].id]);
    assert.deepEqual(finished.map(({ stepId, status }) => ({ stepId, status })), [
      { stepId: steps[0].id, status: "completed" },
      { stepId: steps[1].id, status: "skipped" },
      { stepId: steps[2].id, status: "completed" },
    ]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("structured flow result keeps partial evidence and never retries a semantic failure", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-semantic-result-"));
  const steps = [
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
  ];
  const flow: CrawlFlow = { id: "semantic", title: "Semantic", description: "", safe: true, requiredSecrets: [], steps };
  const captures: string[] = [];
  let semanticAttempts = 0;
  const hooks = silentRunnerHooks({
    capture: async (_page, _flow, step) => void captures.push(step!.id),
    failure: async () => "capture:semantic-failure",
  });

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks,
      executeStep: async (activePage, _plan, step) => {
        if (step === steps[1]) {
          semanticAttempts++;
          throw new smartCrawlerModule.SemanticStepError(step.expected, completedActual(activePage), activePage);
        }
        return { status: "completed", page: activePage, actual: completedActual(activePage) };
      },
    });

    assert.equal(semanticAttempts, 1);
    assert.equal(result.status, "failed");
    assert.deepEqual({ completed: result.completed, skipped: result.skipped, failed: result.failed }, { completed: 1, skipped: 1, failed: 1 });
    assert.deepEqual(result.steps.map(({ status, attempts, reason }) => ({ status, attempts, reason })), [
      { status: "completed", attempts: 1, reason: undefined },
      { status: "failed", attempts: 1, reason: undefined },
      { status: "skipped", attempts: 0, reason: "flow_failed" },
    ]);
    assert.equal(result.steps[1].failure?.errorClass, "SemanticStepError");
    assert.equal(result.steps[1].failure?.screenshot, "capture:semantic-failure");
    assert.deepEqual(captures, [steps[0].id]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("transient retry succeeds on the second and final attempt", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-transient-success-"));
  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "retry-success", title: "Retry success", description: "", safe: true, requiredSecrets: [], steps: [step] };
  const started: number[] = [];
  let attempts = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks({ stepStarted: async (_flow, _step, _index, attempt) => void started.push(attempt) }),
      executeStep: async (activePage) => {
        if (++attempts === 1) throw new Error("page.goto: net::ERR_CONNECTION_RESET");
        return { status: "completed", page: activePage, actual: completedActual(activePage) };
      },
    });

    assert.equal(result.status, "completed");
    assert.equal(result.steps[0].attempts, 2);
    assert.equal(attempts, 2);
    assert.deepEqual(started, [1, 2]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("transient retry fails on attempt two without a third attempt", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-transient-failure-"));
  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "retry-failure", title: "Retry failure", description: "", safe: true, requiredSecrets: [], steps: [step] };
  let attempts = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks({ failure: async () => "capture:retry-failure" }),
      executeStep: async () => {
        attempts++;
        throw new Error("page.goto: net::ERR_CONNECTION_RESET");
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.steps[0].attempts, 2);
    assert.equal(attempts, 2);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("transient retry never retries a side-effect step", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-side-effect-retry-"));
  const step: CrawlStep = { ...fixtureStep({ action: "waitFor", text: "Fixture app" }), safety: "side-effect" };
  const flow: CrawlFlow = { id: "side-effect", title: "Side effect", description: "", safe: false, requiredSecrets: [], steps: [step] };
  let attempts = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks(),
      executeStep: async () => {
        attempts++;
        throw new Error("page.goto: net::ERR_CONNECTION_RESET");
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.steps[0].attempts, 1);
    assert.equal(attempts, 1);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("transient retry never retries a Playwright locator timeout", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-timeout-retry-"));
  const step = fixtureStep({ action: "waitFor", text: "Fixture app" });
  const flow: CrawlFlow = { id: "timeout", title: "Timeout", description: "", safe: true, requiredSecrets: [], steps: [step] };
  let attempts = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks(),
      executeStep: async () => {
        attempts++;
        throw new errors.TimeoutError("locator.waitFor: Timeout exceeded after ERR_TIMED_OUT");
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.steps[0].attempts, 1);
    assert.equal(attempts, 1);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("runner cancellation before a flow marks every step skipped without captures", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-cancel-before-"));
  const steps = [
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
  ];
  const flow: CrawlFlow = { id: "cancel-before", title: "Cancel before", description: "", safe: true, requiredSecrets: [], steps };
  let executions = 0;
  let captures = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks({ cancelled: () => true, capture: async () => void captures++ }),
      executeStep: async (activePage) => {
        executions++;
        return { status: "completed", page: activePage, actual: completedActual(activePage) };
      },
    });
    assert.equal(result.status, "cancelled");
    assert.deepEqual({ completed: result.completed, skipped: result.skipped, failed: result.failed }, { completed: 0, skipped: 2, failed: 0 });
    assert.deepEqual(result.steps.map(({ status, attempts, reason }) => ({ status, attempts, reason })), [
      { status: "skipped", attempts: 0, reason: "cancelled" },
      { status: "skipped", attempts: 0, reason: "cancelled" },
    ]);
    assert.equal(executions, 0);
    assert.equal(captures, 0);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("runner cancellation after the first step skips the rest and makes no later captures", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-cancel-after-"));
  const steps = [
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
    fixtureStep({ action: "waitFor", text: "Fixture app" }),
  ];
  const flow: CrawlFlow = { id: "cancel-after", title: "Cancel after", description: "", safe: true, requiredSecrets: [], steps };
  let cancellationChecks = 0;
  const captures: string[] = [];
  let executions = 0;

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      hooks: silentRunnerHooks({
        cancelled: () => ++cancellationChecks > 2,
        capture: async (_page, _flow, step) => void captures.push(step!.id),
      }),
      executeStep: async (activePage) => {
        executions++;
        return { status: "completed", page: activePage, actual: completedActual(activePage) };
      },
    });
    assert.equal(result.status, "cancelled");
    assert.deepEqual({ completed: result.completed, skipped: result.skipped, failed: result.failed }, { completed: 1, skipped: 2, failed: 0 });
    assert.deepEqual(result.steps.map(({ status, attempts, reason }) => ({ status, attempts, reason })), [
      { status: "completed", attempts: 1, reason: undefined },
      { status: "skipped", attempts: 0, reason: "cancelled" },
      { status: "skipped", attempts: 0, reason: "cancelled" },
    ]);
    assert.equal(executions, 1);
    assert.deepEqual(captures, [steps[0].id]);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("failure hook receives structured plan metadata and stores its screenshot reference", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-failure-hook-"));
  const step = fixtureStep({ action: "click", role: "button", name: "Open panel" });
  const flow: CrawlFlow = { id: "failure-hook", title: "Failure hook", description: "", safe: true, requiredSecrets: [], steps: [step] };
  const secret = "never-serialize-this-secret";
  const actual: StepActual = { sourceUrl: new URL(baseUrl).toString(), finalUrl: new URL(baseUrl).toString(), page: "same", visible: false };
  const received: Array<Parameters<RunnerHooks["failure"]>[1]> = [];

  try {
    const result = await runFlow(page, fixturePlan([flow]), flow, async () => {}, reportDir, {
      env: { SEARCH_SECRET: secret },
      hooks: silentRunnerHooks({
        failure: async (failedPage, failure) => {
          assert.equal(failedPage, page);
          received.push(failure);
          return "capture:failure-hook";
        },
      }),
      executeStep: async (activePage) => {
        throw new smartCrawlerModule.SemanticStepError(step.expected, actual, activePage);
      },
    });

    assert.equal(received.length, 1);
    assert.deepEqual(received[0].locator, { role: "button", name: "Open panel" });
    assert.equal(received[0].currentUrl, new URL(baseUrl).toString());
    assert.deepEqual(received[0].expected, step.expected);
    assert.deepEqual(received[0].actual, actual);
    assert.equal(received[0].errorClass, "SemanticStepError");
    assert.equal("screenshot" in received[0], false);
    assert.equal(result.steps[0].failure?.screenshot, "capture:failure-hook");
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.doesNotThrow(() => JSON.stringify(result));
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("crawl aggregation fails on a failed flow, cancels on cancellation, and exposes only completed eligibility", () => {
  const aggregate = (smartCrawlerModule as typeof smartCrawlerModule & {
    aggregateCrawlExecution?: (flowResults: FlowRunResult[], skippedUnsafe: string[]) => {
      status: "succeeded" | "failed" | "cancelled";
      flowResults: FlowRunResult[];
      completedFlows: number;
      failedFlows: number;
      skippedFlows: number;
      completedSteps: number;
      failedSteps: number;
      skippedSteps: number;
      skippedUnsafe: string[];
    };
  }).aggregateCrawlExecution;
  assert.equal(typeof aggregate, "function");
  const completed: FlowRunResult = { flowId: "complete", status: "completed", completed: 1, skipped: 0, failed: 0, steps: [] };
  const failed: FlowRunResult = { flowId: "failed", status: "failed", completed: 0, skipped: 1, failed: 1, steps: [] };
  const cancelled: FlowRunResult = { flowId: "cancelled", status: "cancelled", completed: 0, skipped: 2, failed: 0, steps: [] };

  const failedRun = aggregate!([completed, failed], ["unsafe"]);
  assert.deepEqual(
    {
      status: failedRun.status,
      completedFlows: failedRun.completedFlows,
      failedFlows: failedRun.failedFlows,
      skippedFlows: failedRun.skippedFlows,
      completedSteps: failedRun.completedSteps,
      failedSteps: failedRun.failedSteps,
      skippedSteps: failedRun.skippedSteps,
      skippedUnsafe: failedRun.skippedUnsafe,
    },
    {
      status: "failed",
      completedFlows: 1,
      failedFlows: 1,
      skippedFlows: 1,
      completedSteps: 1,
      failedSteps: 1,
      skippedSteps: 1,
      skippedUnsafe: ["unsafe"],
    }
  );
  assert.deepEqual(failedRun.flowResults.filter(({ status }) => status === "completed").map(({ flowId }) => flowId), ["complete"]);

  const cancelledRun = aggregate!([completed, cancelled], []);
  assert.equal(cancelledRun.status, "cancelled");
  assert.equal(cancelledRun.skippedFlows, 1);
  assert.equal(cancelledRun.skippedSteps, 2);
});

test("interpretStep resolves each locator kind and optional steps skip on timeout", async () => {
  const plan = fixturePlan([]);
  await interpretStep(page, plan, fixtureStep({ action: "goto", url: "/" }));
  await interpretStep(page, plan, fixtureStep({ action: "click", role: "button", name: "Open panel" }));
  assert.equal(await page.locator("#panel").isVisible(), true);
  await interpretStep(page, plan, fixtureStep({ action: "waitFor", text: "Panel content" }));
  await interpretStep(page, plan, fixtureStep({ action: "fill", role: "textbox", name: "Search", value: "$Q" }), { Q: "hello" });
  assert.equal(await page.locator("input").inputValue(), "hello");
  await interpretStep(page, plan, fixtureStep({ action: "press", key: "Escape" }));
  await interpretStep(page, plan, fixtureStep({ action: "click", css: "#open", locatorReason: "Fixture has a stable id" }));
  // missing element: optional skips, required throws
  await interpretStep(
    page,
    plan,
    fixtureStep({ action: "click", text: "No such thing", optional: true, optionalReason: "Fixture intentionally omits it" })
  );
  await assert.rejects(interpretStep(page, plan, fixtureStep({ action: "waitFor", text: "No such thing" })));
});

test("text locators skip hidden duplicates and click the visible match", async () => {
  const plan = fixturePlan([]);
  await interpretStep(page, plan, fixtureStep({ action: "goto", url: "/" }));
  // a hidden <span> with the same text comes first in the DOM; the visible button must win
  await interpretStep(page, plan, fixtureStep({ action: "click", text: "Duplicate label" }));
  assert.equal(await page.locator("#dup").textContent(), "Duplicate clicked");
});

test("same-page observable client navigation validates URL and semantic locators", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = {
    state: "Client state",
    page: "same",
    url: `${baseUrl}/client`,
    visible: { role: "heading", name: "Client state" },
    hidden: { text: "Initial state" },
  };

  const result = await interpretStep(page, plan, fixtureStep({ action: "click", css: "#client-nav", expected }));

  assert.equal(result.status, "completed");
  assert.equal(result.page, page);
  assert.deepEqual(result.actual, {
    sourceUrl: `${baseUrl}/`,
    finalUrl: `${baseUrl}/client`,
    page: "same",
    visible: true,
    hidden: true,
  });
});

test("expected popup becomes active page and validates wildcard URL", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = {
    state: "Popup opened",
    page: "new",
    urlPattern: `${baseUrl}/popup*`,
    visible: { text: "Popup page" },
  };

  const result = await interpretStep(page, plan, fixtureStep({ action: "click", role: "link", name: "Open popup", expected }));

  assert.equal(result.status, "completed");
  assert.notEqual(result.page, page);
  assert.deepEqual(result.actual, {
    sourceUrl: `${baseUrl}/`,
    finalUrl: `${baseUrl}/popup?source=fixture`,
    page: "new",
    visible: true,
  });
  await result.page.close();
});

test("popup load timeout defers success and failure to semantic assertions", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const pagePrototype = Object.getPrototypeOf(page) as { waitForLoadState: Page["waitForLoadState"] };
  const originalWaitForLoadState = pagePrototype.waitForLoadState;
  pagePrototype.waitForLoadState = async function (this: Page, ...args: Parameters<Page["waitForLoadState"]>) {
    if (this !== page && args[0] === "domcontentloaded") throw new errors.TimeoutError("Forced popup load timeout");
    return originalWaitForLoadState.apply(this, args);
  };

  try {
    const expected: ExpectedState = {
      state: "Popup opened despite load timeout",
      page: "new",
      urlPattern: `${baseUrl}/popup*`,
      visible: { text: "Popup page" },
    };
    const result = await interpretStep(page, plan, fixtureStep({ action: "click", role: "link", name: "Open popup", expected }));
    assert.equal(result.status, "completed");
    assert.deepEqual(result.actual, {
      sourceUrl: `${baseUrl}/`,
      finalUrl: `${baseUrl}/popup?source=fixture`,
      page: "new",
      visible: true,
    });
    await result.page.close();

    const missingExpected: ExpectedState = {
      state: "Missing popup state",
      page: "new",
      urlPattern: `${baseUrl}/popup*`,
      visible: { css: "h1, body" },
    };
    await assert.rejects(
      interpretStep(page, plan, fixtureStep({ action: "click", role: "link", name: "Open popup", expected: missingExpected })),
      (error) =>
        semanticError(error, missingExpected, {
          sourceUrl: `${baseUrl}/`,
          finalUrl: `${baseUrl}/popup?source=fixture`,
          page: "new",
          visible: false,
        })
    );
  } finally {
    pagePrototype.waitForLoadState = originalWaitForLoadState;
    await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  }
});

test("missing expected popup fails with observable expected and actual state", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = {
    state: "Popup should open",
    page: "new",
    url: `${baseUrl}/popup?source=fixture`,
  };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#noop", expected })),
    (error) => semanticError(error, expected, { sourceUrl: `${baseUrl}/`, finalUrl: `${baseUrl}/`, page: "same" })
  );
});

test("unexpected popup for same-page expectation is closed and fails semantically", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const openPages = context.pages().length;
  const expected: ExpectedState = {
    state: "Stay in fixture",
    page: "same",
    url: `${baseUrl}/`,
  };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#popup", expected })),
    (error) =>
      semanticError(error, expected, {
        sourceUrl: `${baseUrl}/`,
        finalUrl: `${baseUrl}/popup?source=fixture`,
        page: "new",
      })
  );
  assert.equal(context.pages().length, openPages);
});

test("popup opened before an action failure is closed", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const openPages = context.pages().length;
  const popupOpened = context.waitForEvent("page", { timeout: 2_000 });
  const locatorPrototype = Object.getPrototypeOf(page.locator("body")) as {
    click: (this: Locator, ...args: Parameters<Locator["click"]>) => ReturnType<Locator["click"]>;
  };
  const originalClick = locatorPrototype.click;
  let actionError: unknown;

  try {
    locatorPrototype.click = async function (this: Locator, ...args: Parameters<Locator["click"]>): Promise<void> {
      await originalClick.apply(this, args);
      throw new Error("Forced post-click failure");
    };
    await interpretStep(
      page,
      plan,
      fixtureStep({
        action: "click",
        css: "#popup-then-detach",
        expected: { state: "Stay in fixture", page: "same", visible: { text: "Fixture app" } },
      })
    );
  } catch (error) {
    actionError = error;
  } finally {
    locatorPrototype.click = originalClick;
  }

  await popupOpened;
  const pageCountAfterFailure = context.pages().length;
  await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  assert.ok(actionError);
  assert.ok(!(actionError instanceof smartCrawlerModule.SemanticStepError));
  assert.equal(pageCountAfterFailure, openPages);
});

test("popup from an unrelated tab is never captured, closed, or used", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const unrelatedParent = await context.newPage();
  await unrelatedParent.goto(`${baseUrl}/`);
  const unrelatedPopup = unrelatedParent.waitForEvent("popup", { timeout: 2_000 });

  try {
    const actingStep = interpretStep(
      page,
      plan,
      fixtureStep({ action: "click", css: "#delayed", expected: { state: "Delayed state", visible: { text: "Delayed state" } } })
    );
    await unrelatedParent.locator("#popup").click();
    const [result, popup] = await Promise.all([actingStep, unrelatedPopup]);
    assert.equal(result.page, page);
    assert.equal(popup.isClosed(), false);
    assert.equal(popup.url(), `${baseUrl}/popup?source=fixture`);
  } finally {
    await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  }
});

test("late popup during same-page postcondition validation is closed and fails semantically", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const openPages = context.pages().length;
  let stepError: unknown;

  try {
    await interpretStep(
      page,
      plan,
      fixtureStep({
        action: "click",
        css: "#late-popup",
        expected: { state: "Late popup state", page: "same", visible: { text: "Late popup state" } },
      })
    );
  } catch (error) {
    stepError = error;
  }

  const pageCountAfterStep = context.pages().length;
  await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  assert.ok(stepError instanceof smartCrawlerModule.SemanticStepError);
  assert.equal(stepError.actual.page, "new");
  assert.equal(pageCountAfterStep, openPages);
});

test("slow action target popup is still attributed to the acting step", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const popupOpened = page.waitForEvent("popup", { timeout: 3_000 });
  let stepError: unknown;

  try {
    await interpretStep(
      page,
      plan,
      fixtureStep({
        action: "click",
        role: "link",
        name: "Slow popup target",
        expected: { state: "Stay in fixture", page: "same", visible: { text: "Fixture app" } },
      })
    );
  } catch (error) {
    stepError = error;
  }

  const popup = await popupOpened;
  const popupClosed = popup.isClosed();
  const pageCountAfterStep = context.pages().length;
  await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  assert.ok(stepError instanceof smartCrawlerModule.SemanticStepError);
  assert.equal(popupClosed, true);
  assert.equal(pageCountAfterStep, 1);
});

test("delayed observable state passes through Playwright waiting", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "Delayed state", visible: { css: "#delayed-state" } };

  const result = await interpretStep(page, plan, fixtureStep({ action: "click", css: "#delayed", expected }));

  assert.equal(result.status, "completed");
  assert.equal(result.actual.visible, true);
  assert.equal(result.actual.finalUrl, `${baseUrl}/delayed`);
});

test("final state rejects a URL that matched briefly before a delayed locator appeared", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = {
    state: "Brief URL with delayed state",
    url: `${baseUrl}/brief`,
    visible: { text: "Brief state" },
    hidden: { text: "Brief blocker" },
  };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#brief-url", expected })),
    (error) =>
      semanticError(error, expected, {
        sourceUrl: `${baseUrl}/`,
        finalUrl: `${baseUrl}/after`,
        page: "same",
        visible: false,
        hidden: true,
      })
  );
});

test("final state rejects a visible assertion that disappears while hidden state settles", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = {
    state: "Both assertions remain true",
    visible: { text: "Transient visible" },
    hidden: { text: "Blocking hidden" },
  };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#changing-assertions", expected })),
    (error) =>
      semanticError(error, expected, {
        sourceUrl: `${baseUrl}/`,
        finalUrl: `${baseUrl}/`,
        page: "same",
        visible: false,
        hidden: true,
      })
  );
});

test("strict locator rejects multiple visible action targets semantically", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", text: "Ambiguous action" })),
    (error) => error instanceof smartCrawlerModule.SemanticStepError
  );
});

test("strict locator rejects multiple visible expected-state matches", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "One visible state", visible: { text: "Ambiguous visible state" } };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#noop", expected })),
    (error) =>
      semanticError(error, expected, {
        sourceUrl: `${baseUrl}/`,
        finalUrl: `${baseUrl}/`,
        page: "same",
        visible: false,
      })
  );
});

test("hidden duplicate waits until every matching element is hidden", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "All duplicates hidden", hidden: { text: "Tracked duplicate" } };

  const result = await interpretStep(page, plan, fixtureStep({ action: "click", css: "#hide-duplicate", expected }));

  assert.equal(result.actual.hidden, true);
  assert.equal(await page.locator("#hidden-duplicate-visible").isVisible(), false);
});

test("wrong observable URL reports expected and actual", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "Wrong destination", url: `${baseUrl}/not-the-fixture` };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#noop", expected })),
    (error) => semanticError(error, expected, { sourceUrl: `${baseUrl}/`, finalUrl: `${baseUrl}/`, page: "same" })
  );
});

test("missing observable text reports expected and actual", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "Missing text", visible: { text: "Never rendered" } };

  await assert.rejects(
    interpretStep(page, plan, fixtureStep({ action: "click", css: "#noop", expected })),
    (error) =>
      semanticError(error, expected, {
        sourceUrl: `${baseUrl}/`,
        finalUrl: `${baseUrl}/`,
        page: "same",
        visible: false,
      })
  );
});

test("optional outcome skips a missing action target with its reason", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const result = await interpretStep(
    page,
    plan,
    fixtureStep({
      action: "click",
      text: "Missing optional control",
      optional: true,
      optionalReason: "Fixture intentionally omits it",
    })
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "Fixture intentionally omits it");
  assert.equal(result.page, page);
  assert.deepEqual(result.actual, { sourceUrl: `${baseUrl}/`, finalUrl: `${baseUrl}/`, page: "same" });
});

test("optional outcome failure remains semantic after the action executes", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "No-op changed state", visible: { text: "No-op completed" } };

  await assert.rejects(
    interpretStep(
      page,
      plan,
      fixtureStep({ action: "click", css: "#noop", optional: true, optionalReason: "Control may be absent", expected })
    ),
    (error) =>
      semanticError(error, expected, {
        sourceUrl: `${baseUrl}/`,
        finalUrl: `${baseUrl}/`,
        page: "same",
        visible: false,
      })
  );
});

test("fresh locator survives stale locator DOM replacement", async () => {
  const plan = fixturePlan([]);
  await page.goto(`${baseUrl}/`);
  const expected: ExpectedState = { state: "Replacement rendered", visible: { text: "Fresh replacement" } };

  const result = await interpretStep(page, plan, fixtureStep({ action: "click", css: "#replace", expected }));

  assert.equal(result.status, "completed");
  assert.equal(result.actual.visible, true);
});

test("captureIfNew dedupes identical states and captures new ones", async () => {
  await page.goto(baseUrl);
  const seen = new Set<string>();
  const { records, sink } = collectingSink();
  assert.equal(await captureIfNew(page, seen, "f/start", sink), true);
  assert.equal(await captureIfNew(page, seen, "f/start", sink), false); // same state
  await page.click("#open"); // DOM changed -> new state
  assert.equal(await captureIfNew(page, seen, "f/opened", sink), true);
  assert.equal(records.length, 2);
  const size = pngSize(records[0].png);
  assert.ok(size.width > 0 && size.height > 0);
});

test("captures of very tall pages are clamped to the height cap", async () => {
  await page.goto(`${baseUrl}/tall`);
  const { records, sink } = collectingSink();
  assert.equal(await captureIfNew(page, new Set(), "f/tall", sink), true);
  const size = pngSize(records[0].png);
  assert.equal(size.height, MAX_CAPTURE_HEIGHT_PX);
  assert.ok(size.width >= 1); // still a real image
});

test("runFlow walks steps, captures along the way, and reports a stuck step", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-crawl-report-"));
  const good: CrawlFlow = {
    id: "tour",
    title: "Tour",
    description: "",
    safe: true,
    requiredSecrets: [],
    steps: [
      fixtureStep({ action: "click", role: "button", name: "Open panel" }),
      fixtureStep({
        action: "click",
        role: "link",
        name: "Second page",
        expected: { state: "Second page", url: `${baseUrl}/second`, visible: { text: "Second page" } },
      }),
    ],
  };
  const { records, sink } = collectingSink();
  const okResult = await runFlow(page, fixturePlan([good]), good, sink, reportDir, {
    hooks: cliRunnerHooks(sink, reportDir),
  });
  assert.equal(okResult.status, "completed");
  assert.deepEqual(okResult.steps.map(({ status }) => status), ["completed", "completed"]);
  const contexts = records.map((r) => r.stateContext);
  assert.equal(contexts.includes("tour/start"), false);
  assert.equal(contexts.length, 2);
  assert.ok(contexts.some((c) => c.includes("Open panel")));
  assert.ok(contexts.some((c) => c.includes("Second page")));

  const bad: CrawlFlow = {
    id: "broken",
    title: "Broken",
    description: "",
    safe: true,
    requiredSecrets: [],
    steps: [fixtureStep({ action: "click", text: "Does not exist" })],
  };
  const badResult = await runFlow(page, fixturePlan([bad]), bad, sink, reportDir, {
    hooks: cliRunnerHooks(sink, reportDir),
  });
  assert.equal(badResult.status, "failed");
  const failure = badResult.steps[0].failure;
  assert.ok(failure);
  assert.equal(failure.flow, "broken");
  assert.equal(failure.stepIndex, 0);
  assert.equal(failure.screenshot, "");
  assert.equal(readdirSync(reportDir).includes("broken-step-1.png"), false);
  rmSync(reportDir, { recursive: true, force: true });
});

test("runFlow carries the active page from popup into the following step and capture", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-popup-flow-"));
  const flow: CrawlFlow = {
    id: "popup-tour",
    title: "Popup tour",
    description: "",
    safe: true,
    requiredSecrets: [],
    steps: [
      fixtureStep({
        action: "click",
        role: "link",
        name: "Open popup",
        expected: {
          state: "Popup opened",
          page: "new",
          urlPattern: `${baseUrl}/popup*`,
          visible: { text: "Popup page" },
        },
      }),
      fixtureStep({
        action: "click",
        role: "button",
        name: "Continue popup",
        expected: { state: "Popup complete", page: "same", visible: { text: "Popup complete" } },
      }),
    ],
  };
  const { records, sink } = collectingSink();

  const result = await runFlow(page, fixturePlan([flow]), flow, sink, reportDir, {
    hooks: cliRunnerHooks(sink, reportDir),
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(result.steps.map(({ status }) => status), ["completed", "completed"]);
  const popupCaptures = records.filter((record) => record.sourceUrl.startsWith(`${baseUrl}/popup`));
  assert.equal(popupCaptures.length, 2);
  assert.ok(popupCaptures.some((record) => record.stateContext.includes("Continue popup")));
  const pageCountAfterFlow = context.pages().length;
  await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  assert.equal(pageCountAfterFlow, 1);
  rmSync(reportDir, { recursive: true, force: true });
});

test("runFlow closes the active popup when capture sink fails", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-popup-sink-failure-"));
  const flow: CrawlFlow = {
    id: "popup-sink-failure",
    title: "Popup sink failure",
    description: "",
    safe: true,
    requiredSecrets: [],
    steps: [
      fixtureStep({
        action: "click",
        role: "link",
        name: "Open popup",
        expected: { state: "Popup opened", page: "new", urlPattern: `${baseUrl}/popup*`, visible: { text: "Popup page" } },
      }),
    ],
  };
  let captures = 0;
  const sink = async (): Promise<void> => {
    if (++captures === 1) throw new Error("Capture sink failed");
  };

  await assert.rejects(
    runFlow(page, fixturePlan([flow]), flow, sink, reportDir, { hooks: cliRunnerHooks(sink, reportDir) }),
    /Capture sink failed/
  );

  const pageCountAfterFailure = context.pages().length;
  await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  assert.equal(pageCountAfterFailure, 1);
  rmSync(reportDir, { recursive: true, force: true });
});

test("runFlow captures the failed popup active page and closes it", async () => {
  const reportDir = mkdtempSync(join(tmpdir(), "astryx-popup-failure-"));
  const flow: CrawlFlow = {
    id: "broken-popup",
    title: "Broken popup",
    description: "",
    safe: true,
    requiredSecrets: [],
    steps: [
      fixtureStep({
        action: "click",
        role: "link",
        name: "Open popup",
        expected: { state: "Missing popup state", page: "new", visible: { text: "Never rendered in popup" } },
      }),
    ],
  };
  const { records, sink } = collectingSink();
  await page.goto(baseUrl);
  const sourceHash = sha16(await page.screenshot());
  let failurePng = Buffer.alloc(0);
  const hooks = withDurableFailureArtifacts(cliRunnerHooks(sink, reportDir), { runId: "99", workerId: "worker-1" }, {
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => {
        failurePng = Buffer.from(input.body);
        return { created: true, metadata: input };
      },
    } as unknown as ObjectStore,
    attachFailureObject: async () => {},
  });

  const result = await runFlow(page, fixturePlan([flow]), flow, sink, reportDir, {
    hooks,
  });

  assert.equal(result.status, "failed");
  const failure = result.steps[0].failure;
  assert.ok(failure);
  assert.equal(records.length, 0);
  const pageCountAfterFailure = context.pages().length;
  const failureHash = sha16(failurePng);
  await Promise.all(context.pages().filter((openPage) => openPage !== page).map((openPage) => openPage.close()));
  assert.equal(pageCountAfterFailure, 1);
  assert.notEqual(failureHash, sourceHash);
  rmSync(reportDir, { recursive: true, force: true });
});
