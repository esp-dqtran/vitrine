import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, errors, type BrowserContext, type Page, type Locator } from "playwright";
import {
  parseCrawlPlan,
  resolveStepUrl,
  resolveValue,
  urlMatchesExpectation,
  type CrawlFlow,
  type CrawlLocator,
  type CrawlPlan,
  type CrawlStep,
  type ExpectedState,
} from "./crawlPlan.ts";
import { appImages, getAppFlows, imageExists, insertImage, saveAppFlows } from "./db.ts";
import type { DesignFlow } from "./designSystem.ts";
import { clearCancel, isCancelRequested, writeProgress, type ProgressState } from "./progress.ts";
import { imageObjectKey, type ObjectMetadata, type ObjectStore } from "./objectStore.ts";
import { persistFailureArtifact, type FailureArtifactDependencies } from "./crawlRun.ts";

const STEP_TIMEOUT_MS = 10_000;
const OPTIONAL_STEP_TIMEOUT_MS = 5_000;
// A mutation burst (modal opening, route transition) is considered settled after this
// much quiet; captures fire only on settled states so we don't shoot mid-animation.
const SETTLE_QUIET_MS = 600;
const SETTLE_MAX_WAIT_MS = 8_000;
const RECORD_POLL_MS = 700;
// A click can create a page just before Playwright reports the action error; keep the
// acting-page listener alive briefly so that orphan is observed and closed.
const ACTION_FAILURE_POPUP_WAIT_MS = 1_000;
// ponytail: hard cap on capture height — full-page shots of marketing pages reach 20k+ px
// and crash image decoding in the gallery grid. 6000px keeps ~5 scroll-screens of context;
// raise only alongside downscaled thumbnails in the UI.
export const MAX_CAPTURE_HEIGHT_PX = 6_000;

export function sha16(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// Same state = same place in the app: URL without query/hash (session ids, utm noise),
// what the page says, and the viewport it was rendered at. Computed before screenshotting
// so revisiting an already-captured state costs nothing.
// ponytail: text-hash dedupe misses image-only changes and over-fires on live timestamps/
// counters; upgrade to a perceptual hash over pixels only if real runs show it matters.
export function dedupeKey(url: string, bodyText: string, viewport: { width: number; height: number }): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname}|${sha16(bodyText)}|${viewport.width}x${viewport.height}`;
}

// PNG dimensions live in the IHDR chunk at fixed offsets — no image library needed.
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// Plans identify what a human can see. Callers enforce cardinality instead of silently
// choosing one of several visible matches.
export function locatorFor(page: Page, locator: CrawlLocator): Locator {
  const base = locator.role
    ? page.getByRole(locator.role as Parameters<Page["getByRole"]>[0], { name: locator.name })
    : locator.text
      ? page.getByText(locator.text)
      : page.locator(locator.css!);
  return base.filter({ visible: true });
}

export function stepLabel(step: CrawlStep, index: number): string {
  const target = step.url ?? step.key ?? step.name ?? step.text ?? step.css ?? "";
  return `${index + 1}. ${step.action}${target ? ` ${target}` : ""}`;
}

export interface StepActual {
  sourceUrl: string;
  finalUrl: string;
  page: "same" | "new";
  visible?: boolean;
  hidden?: boolean;
}

export type StepResult =
  | { status: "completed"; page: Page; actual: StepActual }
  | { status: "skipped"; page: Page; actual: StepActual; reason: string };

export class SemanticStepError extends Error {
  readonly expected: ExpectedState;
  readonly actual: StepActual;

  constructor(expected: ExpectedState, actual: StepActual, failedPage?: Page) {
    super(`Expected state "${expected.state}" was not observed`);
    this.name = "SemanticStepError";
    this.expected = expected;
    this.actual = actual;
    if (failedPage) semanticErrorPages.set(this, failedPage);
  }
}

const semanticErrorPages = new WeakMap<SemanticStepError, Page>();

function waitForOpenedPage(opened: Promise<Page>, timeout: number): { promise: Promise<Page | undefined>; cancel: () => void } {
  let cancel = () => {};
  const promise = new Promise<Page | undefined>((resolve) => {
    let settled = false;
    const finish = (newPage?: Page) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(newPage);
    };
    const timer = setTimeout(finish, timeout);
    cancel = finish;
    opened.then(finish);
  });
  return { promise, cancel };
}

async function assertExpectedState(page: Page, expected: ExpectedState, actual: StepActual, timeout: number): Promise<void> {
  if (expected.url !== undefined || expected.urlPattern !== undefined) {
    try {
      await page.waitForURL((url) => urlMatchesExpectation(url.toString(), expected), { timeout });
    } catch {
      actual.finalUrl = page.url();
      throw new SemanticStepError(expected, actual, page);
    }
  }
  actual.finalUrl = page.url();

  if (expected.visible) {
    try {
      const visible = locatorFor(page, expected.visible);
      await visible.first().waitFor({ state: "visible", timeout });
      if ((await visible.count()) !== 1) throw new Error("Expected exactly one visible match");
      actual.visible = true;
    } catch {
      actual.visible = false;
      actual.finalUrl = page.url();
      throw new SemanticStepError(expected, actual, page);
    }
  }

  if (expected.hidden) {
    try {
      await locatorFor(page, expected.hidden).first().waitFor({ state: "hidden", timeout });
      actual.hidden = true;
    } catch {
      actual.hidden = false;
      actual.finalUrl = page.url();
      throw new SemanticStepError(expected, actual, page);
    }
  }

  actual.finalUrl = page.url();
  const finalUrlMatches = urlMatchesExpectation(actual.finalUrl, expected);
  if (expected.visible) {
    actual.visible = (await locatorFor(page, expected.visible).count()) === 1;
  }
  if (expected.hidden) {
    actual.hidden = (await locatorFor(page, expected.hidden).count()) === 0;
  }
  if (!finalUrlMatches || actual.visible === false || actual.hidden === false) throw new SemanticStepError(expected, actual, page);
}

export async function interpretStep(
  page: Page,
  plan: CrawlPlan,
  step: CrawlStep,
  env: Record<string, string | undefined> = process.env
): Promise<StepResult> {
  const timeout = step.optional ? OPTIONAL_STEP_TIMEOUT_MS : STEP_TIMEOUT_MS;
  const sourceUrl = page.url();
  const initialActual: StepActual = { sourceUrl, finalUrl: sourceUrl, page: "same" };

  const actionTarget = async (): Promise<Locator> => {
    const target = locatorFor(page, step);
    await target.first().waitFor({ state: "visible", timeout });
    if ((await target.count()) !== 1) throw new SemanticStepError(step.expected, { ...initialActual, finalUrl: page.url() });
    return target;
  };

  if (step.optional && (step.action === "click" || step.action === "fill" || step.action === "waitFor")) {
    try {
      await actionTarget();
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) throw error;
      return { status: "skipped", page, actual: { ...initialActual, finalUrl: page.url() }, reason: step.optionalReason! };
    }
  }

  let openedPage: Page | undefined;
  let resolveOpened!: (opened: Page) => void;
  const opened = new Promise<Page>((resolve) => {
    resolveOpened = resolve;
  });
  const onPopup = (newPage: Page) => {
    if (openedPage) return;
    openedPage = newPage;
    resolveOpened(newPage);
  };
  page.on("popup", onPopup);
  let actionStarted = false;
  let actionPopupWait: ReturnType<typeof waitForOpenedPage> | undefined;

  try {
    switch (step.action) {
      case "goto":
        actionStarted = true;
        await page.goto(resolveStepUrl(plan.startUrl, step.url!), { waitUntil: "domcontentloaded", timeout });
        break;
      case "press":
        actionStarted = true;
        await page.keyboard.press(step.key!);
        break;
      case "click": {
        const target = await actionTarget();
        if (step.expected.page !== "new" && (await target.getAttribute("target"))?.toLowerCase() === "_blank") {
          actionPopupWait = waitForOpenedPage(opened, timeout);
        }
        actionStarted = true;
        await target.click({ timeout });
        if (actionPopupWait) openedPage ??= await actionPopupWait.promise;
        break;
      }
      case "fill": {
        const target = await actionTarget();
        actionStarted = true;
        await target.fill(resolveValue(step.value!, env), { timeout });
        break;
      }
      case "waitFor":
        await actionTarget();
        actionStarted = true;
        break;
      default:
        throw new Error(`Unsupported crawl action: ${String(step.action)}`);
    }

    if (step.expected.page === "new") {
      if (!openedPage) {
        const popupWait = waitForOpenedPage(opened, timeout);
        try {
          openedPage = await popupWait.promise;
        } finally {
          popupWait.cancel();
        }
      }
      if (!openedPage) throw new SemanticStepError(step.expected, { ...initialActual, finalUrl: page.url() });

      const actual: StepActual = { sourceUrl, finalUrl: openedPage.url(), page: "new" };
      try {
        await openedPage.waitForLoadState("domcontentloaded", { timeout });
      } catch {
        actual.finalUrl = openedPage.url();
        throw new SemanticStepError(step.expected, actual, openedPage);
      }
      await assertExpectedState(openedPage, step.expected, actual, timeout);
      return { status: "completed", page: openedPage, actual };
    }

    const actual: StepActual = { sourceUrl, finalUrl: page.url(), page: "same" };
    await assertExpectedState(page, step.expected, actual, timeout);
    if (openedPage) {
      await openedPage.waitForLoadState("domcontentloaded", { timeout }).catch(() => {});
      const popupActual: StepActual = { sourceUrl, finalUrl: openedPage.url(), page: "new" };
      await openedPage.close().catch(() => {});
      throw new SemanticStepError(step.expected, popupActual);
    }
    return { status: "completed", page, actual };
  } catch (error) {
    if (!(error instanceof SemanticStepError)) {
      if (!actionPopupWait && actionStarted && step.action === "click") {
        actionPopupWait = waitForOpenedPage(opened, Math.min(timeout, ACTION_FAILURE_POPUP_WAIT_MS));
      }
      if (actionPopupWait) openedPage ??= await actionPopupWait.promise;
      if (openedPage && !openedPage.isClosed()) await openedPage.close().catch(() => {});
      throw error;
    }
    if (step.expected.page !== "new" && actionStarted) {
      if (openedPage) {
        const popupActual: StepActual = { sourceUrl, finalUrl: openedPage.url(), page: "new" };
        await openedPage.close().catch(() => {});
        throw new SemanticStepError(step.expected, popupActual);
      }
    }
    throw error;
  } finally {
    actionPopupWait?.cancel();
    page.off("popup", onPopup);
  }
}

// Every page in the context stamps __astryxDirtyAt on each DOM mutation; waitForSettle
// polls it. This is how both step flows and record mode know "the page finished reacting".
export async function installSettleTracker(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __astryxDirtyAt: number };
    w.__astryxDirtyAt = Date.now();
    const observer = new MutationObserver(() => {
      w.__astryxDirtyAt = Date.now();
    });
    const observe = () => observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true, attributes: true });
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", observe);
    else observe();
  });
}

async function waitForSettle(page: Page): Promise<void> {
  const deadline = Date.now() + SETTLE_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const quiet = await page
      .evaluate((q) => Date.now() - ((window as unknown as { __astryxDirtyAt?: number }).__astryxDirtyAt ?? 0) > q, SETTLE_QUIET_MS)
      .catch(() => false); // evaluate throws mid-navigation — that's "not settled yet"
    if (quiet) return;
    await page.waitForTimeout(150);
  }
}

export interface CaptureRecord {
  png: Uint8Array;
  sourceUrl: string;
  stateContext: string;
}

// The sink is where captures land. Production sink writes files + DB; tests stub it.
export type CaptureSink = (record: CaptureRecord) => Promise<void>;

export async function captureIfNew(page: Page, seen: Set<string>, stateContext: string, sink: CaptureSink): Promise<boolean> {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const key = dedupeKey(url, bodyText, viewport);
  if (seen.has(key)) return false;
  // Always clip: measuring first then deciding races lazy-loaded content that grows the
  // page mid-screenshot. Playwright intersects the clip with the real page bounds, so
  // short pages come out natural-height and tall ones cap at MAX_CAPTURE_HEIGHT_PX.
  const png = await page.screenshot({
    fullPage: true,
    clip: { x: 0, y: 0, width: viewport.width, height: MAX_CAPTURE_HEIGHT_PX },
  });
  await sink({ png, sourceUrl: url, stateContext });
  seen.add(key);
  return true;
}

// Compatibility sink: keep capture: refs while durable bytes live in object storage.
// The ledger includes every state seen this run so flow assembly can attach evidence
// even when a re-run reuses an existing logical image.
export interface LegacyCaptureDependencies {
  objectStore: ObjectStore;
  insertImage: typeof insertImage;
  attachImage(imageId: number, metadata: ObjectMetadata): Promise<void>;
}

function sameObjectMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key && left.sha256 === right.sha256 && left.byteSize === right.byteSize
    && left.contentType === right.contentType && left.accessClass === right.accessClass;
}

export function dbCaptureSink(app: string, dependencies: LegacyCaptureDependencies): { sink: CaptureSink; ledger: Array<{ ref: string; stateContext: string }> } {
  const ledger: Array<{ ref: string; stateContext: string }> = [];
  const sink: CaptureSink = async ({ png, sourceUrl, stateContext }) => {
    const sha256 = createHash("sha256").update(png).digest("hex");
    const ref = `capture:${sha256.slice(0, 16)}`;
    ledger.push({ ref, stateContext });
    const size = pngSize(png);
    const imageId = await dependencies.insertImage(app, "web", ref, {
      sourceUrl,
      viewportWidth: size.width,
      viewportHeight: size.height,
      stateContext,
    });
    const metadata: ObjectMetadata = {
      key: imageObjectKey(imageId, sha256, "png"),
      sha256,
      byteSize: png.byteLength,
      contentType: "image/png",
      accessClass: "protected",
    };
    const stored = await dependencies.objectStore.put({ ...metadata, body: png });
    if (!sameObjectMetadata(stored.metadata, metadata)) throw new Error("Uploaded legacy capture metadata does not match the PNG");
    await dependencies.attachImage(imageId, metadata);
  };
  return { sink, ledger };
}

export interface StepFailure {
  flow: string;
  flowTitle: string;
  stepIndex: number;
  stepId: string;
  step: CrawlStep;
  locator?: CrawlLocator;
  currentUrl: string;
  expected: ExpectedState;
  actual?: StepActual;
  errorClass: string;
  error: string;
  screenshot: string;
}

export interface FlowStepRecord {
  stepId: string;
  index: number;
  status: "completed" | "skipped" | "failed";
  attempts: number;
  actual?: StepActual;
  reason?: string;
  failure?: StepFailure;
}

export interface FlowRunResult {
  flowId: string;
  status: "completed" | "failed" | "cancelled";
  completed: number;
  skipped: number;
  failed: number;
  steps: FlowStepRecord[];
}

export interface RunnerHooks {
  cancelled(): boolean | Promise<boolean>;
  stepStarted(flow: CrawlFlow, step: CrawlStep, index: number, attempt: number): Promise<void>;
  stepFinished(flow: CrawlFlow, step: CrawlStep, index: number, result: FlowStepRecord): Promise<void>;
  capture(page: Page, flow: CrawlFlow, step: CrawlStep | undefined, state: string): Promise<void>;
  failure(page: Page, failure: Omit<StepFailure, "screenshot">): Promise<string | undefined>;
}

export type StepExecutor = (
  page: Page,
  plan: CrawlPlan,
  step: CrawlStep,
  env?: Record<string, string | undefined>
) => Promise<StepResult>;

export interface RunFlowOptions {
  env?: Record<string, string | undefined>;
  hooks?: RunnerHooks;
  executeStep?: StepExecutor;
}

export interface CrawlExecutionResult {
  status: "succeeded" | "failed" | "cancelled";
  flowResults: FlowRunResult[];
  completedFlows: number;
  failedFlows: number;
  skippedFlows: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  skippedUnsafe: string[];
}

export function isTransientBrowserError(error: unknown): boolean {
  if (error instanceof SemanticStepError || error instanceof errors.TimeoutError) return false;
  if (error instanceof Error && error.name === "TimeoutError") return false;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    /ERR_(?:NAME_NOT_RESOLVED|CONNECTION_RESET|CONNECTION_CLOSED|TIMED_OUT)/.test(message) ||
    /navigation.*interrupted|interrupted.*navigation/i.test(message) ||
    /Target .*?(?:page|context|browser).*closed/i.test(message)
  );
}

export async function runStepWithRetry<T>(
  step: CrawlStep,
  execute: (attempt: number) => Promise<T>,
  beforeAttempt: (attempt: number) => Promise<void> = async () => {}
): Promise<{ result: T; attempts: number }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await beforeAttempt(attempt);
    try {
      return { result: await execute(attempt), attempts: attempt };
    } catch (error) {
      if (attempt === 2 || step.safety === "side-effect" || !isTransientBrowserError(error)) throw error;
    }
  }
  throw new Error("Unreachable retry state");
}

function planLocator(step: CrawlStep): CrawlLocator | undefined {
  if (step.role) return { role: step.role, name: step.name };
  if (step.text) return { text: step.text };
  if (step.css) return { css: step.css };
  return undefined;
}

function flowRunResult(flowId: string, status: FlowRunResult["status"], steps: FlowStepRecord[]): FlowRunResult {
  return {
    flowId,
    status,
    completed: steps.filter((step) => step.status === "completed").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    failed: steps.filter((step) => step.status === "failed").length,
    steps,
  };
}

export function createCliRunnerHooks(
  sink: CaptureSink,
  _reportDir: string,
  cancelled: () => boolean | Promise<boolean> = isCancelRequested
): RunnerHooks {
  const seen = new Set<string>();
  return {
    cancelled,
    stepStarted: async () => {},
    stepFinished: async () => {},
    capture: async (page, _flow, _step, state) => void (await captureIfNew(page, seen, state, sink)),
    failure: async () => undefined,
  };
}

export function withDurableFailureArtifacts(
  hooks: RunnerHooks,
  identity: { runId: string; workerId: string },
  dependencies: FailureArtifactDependencies,
): RunnerHooks {
  return {
    ...hooks,
    failure: async (page, failure) => {
      const object = await persistFailureArtifact(page, {
        ...identity,
        flowId: failure.flow,
        stepId: failure.stepId,
      }, dependencies);
      return object.key;
    },
  };
}

export function aggregateCrawlExecution(flowResults: FlowRunResult[], skippedUnsafe: string[]): CrawlExecutionResult {
  const completedFlows = flowResults.filter((flow) => flow.status === "completed").length;
  const failedFlows = flowResults.filter((flow) => flow.status === "failed").length;
  const cancelledFlows = flowResults.filter((flow) => flow.status === "cancelled").length;
  return {
    status: failedFlows > 0 ? "failed" : cancelledFlows > 0 ? "cancelled" : "succeeded",
    flowResults,
    completedFlows,
    failedFlows,
    skippedFlows: cancelledFlows + skippedUnsafe.length,
    completedSteps: flowResults.reduce((total, flow) => total + flow.completed, 0),
    failedSteps: flowResults.reduce((total, flow) => total + flow.failed, 0),
    skippedSteps: flowResults.reduce((total, flow) => total + flow.skipped, 0),
    skippedUnsafe: [...skippedUnsafe],
  };
}

// The safety boundary. No flag skips these — fix the plan file instead.
export function assertRunnable(plan: CrawlPlan): void {
  if (!plan.reviewed) {
    throw new Error(`Plan for ${plan.app} has reviewed: false. A human must review the flows and flip it before running.`);
  }
}

export function splitBySafety(plan: CrawlPlan, env: Record<string, string | undefined> = process.env): { runnable: CrawlFlow[]; skippedUnsafe: CrawlFlow[] } {
  if (env.TEST_ACCOUNT === "1") return { runnable: plan.flows, skippedUnsafe: [] };
  return {
    runnable: plan.flows.filter((f) => f.safe),
    skippedUnsafe: plan.flows.filter((f) => !f.safe),
  };
}

async function appendSkippedSteps(
  flow: CrawlFlow,
  from: number,
  reason: "cancelled" | "flow_failed",
  records: FlowStepRecord[],
  hooks: RunnerHooks
): Promise<void> {
  for (let index = from; index < flow.steps.length; index++) {
    const step = flow.steps[index];
    const record: FlowStepRecord = { stepId: step.id, index, status: "skipped", attempts: 0, reason };
    records.push(record);
    await hooks.stepFinished(flow, step, index, record);
  }
}

function errorClass(error: unknown): string {
  if (error instanceof Error) return error.name || error.constructor.name;
  return typeof error;
}

function sanitizeDiagnosticUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeDiagnosticText(value: string, secrets: string[]): string {
  let sanitized = value.replace(/https?:\/\/[^\s"'<>]+/g, sanitizeDiagnosticUrl);
  for (const secret of secrets) {
    if (!secret) continue;
    sanitized = sanitized.replaceAll(secret, "[REDACTED]");
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) sanitized = sanitized.replaceAll(encoded, "[REDACTED]");
  }
  return sanitized;
}

function sanitizeStepActual(actual: StepActual): StepActual {
  return {
    ...actual,
    sourceUrl: sanitizeDiagnosticUrl(actual.sourceUrl),
    finalUrl: sanitizeDiagnosticUrl(actual.finalUrl),
  };
}

function isClosedPageCaptureRace(page: Page, error: unknown): boolean {
  return page.isClosed() && /Target .*?(?:page|context|browser).*closed|Page closed/i.test(String(error));
}

async function captureRecordState(page: Page, flow: CrawlFlow, state: string, hooks: RunnerHooks): Promise<void> {
  if (page.isClosed()) return;
  try {
    await hooks.capture(page, flow, undefined, state);
  } catch (error) {
    if (!isClosedPageCaptureRace(page, error)) throw error;
  }
}

// Walks one flow's steps and exposes terminal records through narrow hooks. Empty steps
// remain record mode: the human drives while explicit settled observations are captured.
export async function runFlow(
  page: Page,
  plan: CrawlPlan,
  flow: CrawlFlow,
  sink: CaptureSink,
  reportDir: string,
  options: RunFlowOptions = {}
): Promise<FlowRunResult> {
  const env = options.env ?? process.env;
  const hooks = options.hooks ?? createCliRunnerHooks(sink, reportDir);
  const executeStep = options.executeStep ?? interpretStep;
  const records: FlowStepRecord[] = [];
  let activePage = page;
  try {
    if (await hooks.cancelled()) {
      await appendSkippedSteps(flow, 0, "cancelled", records, hooks);
      return flowRunResult(flow.id, "cancelled", records);
    }

    await activePage.goto(plan.startUrl, { waitUntil: "domcontentloaded" });

    if (flow.steps.length === 0) {
      if (await hooks.cancelled()) return flowRunResult(flow.id, "cancelled", records);
      console.log(`[${plan.app}] Record mode for "${flow.title}": drive the app in the opened window. Close it (or cancel) to finish.`);
      await waitForSettle(activePage);
      await captureRecordState(activePage, flow, `${flow.id}/start`, hooks);
      while (!activePage.isClosed()) {
        if (await hooks.cancelled()) return flowRunResult(flow.id, "cancelled", records);
        await activePage.waitForTimeout(RECORD_POLL_MS).catch(() => {});
        await waitForSettle(activePage);
        if (activePage.isClosed()) break;
        await captureRecordState(activePage, flow, `${flow.id}/recorded`, hooks);
      }
      return flowRunResult(flow.id, "completed", records);
    }

    for (const [i, step] of flow.steps.entries()) {
      if (await hooks.cancelled()) {
        await appendSkippedSteps(flow, i, "cancelled", records, hooks);
        return flowRunResult(flow.id, "cancelled", records);
      }

      let attempts = 0;
      let outcome: StepResult;
      let stepStartedFailed = false;
      try {
        outcome = (
          await runStepWithRetry(
            step,
            async () => executeStep(activePage, plan, step, env),
            async (attempt) => {
              attempts = attempt;
              try {
                await hooks.stepStarted(flow, step, i, attempt);
              } catch (error) {
                stepStartedFailed = true;
                throw error;
              }
            }
          )
        ).result;
      } catch (error) {
        if (stepStartedFailed) throw error;
        const failedPage = error instanceof SemanticStepError ? (semanticErrorPages.get(error) ?? activePage) : activePage;
        try {
          const secrets = flow.requiredSecrets.flatMap((name) => (env[name] ? [env[name]] : []));
          const failureWithoutScreenshot: Omit<StepFailure, "screenshot"> = {
            flow: flow.id,
            flowTitle: flow.title,
            stepIndex: i,
            stepId: step.id,
            step,
            locator: planLocator(step),
            currentUrl: sanitizeDiagnosticUrl(failedPage.url()),
            expected: step.expected,
            ...(error instanceof SemanticStepError ? { actual: sanitizeStepActual(error.actual) } : {}),
            errorClass: errorClass(error),
            error: sanitizeDiagnosticText(String(error), secrets),
          };
          const failure: StepFailure = {
            ...failureWithoutScreenshot,
            screenshot: (await hooks.failure(failedPage, failureWithoutScreenshot)) ?? "",
          };
          const record: FlowStepRecord = { stepId: step.id, index: i, status: "failed", attempts, failure };
          records.push(record);
          await hooks.stepFinished(flow, step, i, record);
          await appendSkippedSteps(flow, i + 1, "flow_failed", records, hooks);
          return flowRunResult(flow.id, "failed", records);
        } finally {
          if (failedPage !== page && !failedPage.isClosed()) await failedPage.close().catch(() => {});
        }
      }

      activePage = outcome.page;
      const record: FlowStepRecord = {
        stepId: step.id,
        index: i,
        status: outcome.status,
        attempts,
        actual: outcome.actual,
        ...(outcome.status === "skipped" ? { reason: outcome.reason } : {}),
      };
      if (outcome.status === "completed") {
        await waitForSettle(activePage);
        await hooks.capture(activePage, flow, step, `${flow.id}/${stepLabel(step, i)}`);
      }
      records.push(record);
      await hooks.stepFinished(flow, step, i, record);
    }
    return flowRunResult(flow.id, "completed", records);
  } finally {
    if (activePage !== page && !activePage.isClosed()) await activePage.close().catch(() => {});
  }
}

// Screens are born flow-tagged: each executed flow becomes a DesignFlow whose steps carry
// the captured image ids as evidence, merged over the app's existing flow set by id.
export function assembleFlows(
  executed: CrawlFlow[],
  ledger: Array<{ ref: string; stateContext: string }>,
  refToImageId: ReadonlyMap<string, number>,
  existing: DesignFlow[]
): DesignFlow[] {
  const built: DesignFlow[] = [];
  for (const flow of executed) {
    const prefix = `${flow.id}/`;
    const steps: DesignFlow["steps"] = [];
    const seenIds = new Set<number>();
    for (const entry of ledger) {
      if (!entry.stateContext.startsWith(prefix)) continue;
      const imageId = refToImageId.get(entry.ref);
      if (imageId === undefined || seenIds.has(imageId)) continue;
      seenIds.add(imageId);
      steps.push({ label: entry.stateContext.slice(prefix.length), evidence: [imageId] });
    }
    if (steps.length === 0) continue;
    built.push({ id: flow.id, title: flow.title, description: flow.description, tags: ["smart-crawler"], steps });
  }
  const builtIds = new Set(built.map((f) => f.id));
  return [...existing.filter((f) => !builtIds.has(f.id)), ...built];
}

export function planPath(appName: string, dataDir = "data"): string {
  return join(dataDir, "crawl-plans", `${appName}.json`);
}

export function loadPlan(appName: string, dataDir = "data"): CrawlPlan {
  const path = planPath(appName, dataDir);
  if (!existsSync(path)) throw new Error(`No crawl plan at ${path}. Run "research ${appName} <homepageUrl>" first.`);
  return parseCrawlPlan(readFileSync(path, "utf8"));
}

type OwnedContext = { close: () => Promise<void> };

export async function initializeOwnedContext<T extends OwnedContext>(
  create: () => Promise<T>,
  initialize: (context: T) => Promise<void>
): Promise<T> {
  const context = await create();
  try {
    await initialize(context);
    return context;
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

export async function withOwnedContext<T extends OwnedContext, R>(context: T, work: (context: T) => Promise<R>): Promise<R> {
  try {
    return await work(context);
  } finally {
    await context.close().catch(() => {});
  }
}

async function launchAppContext(appName: string, dataDir: string): Promise<BrowserContext> {
  return initializeOwnedContext(
    () =>
      chromium.launchPersistentContext(join(dataDir, `browser-profile-${appName}`), {
        headless: process.env.HEADLESS === "true",
      }),
    installSettleTracker
  );
}

async function persistAssembledFlows(app: string, executed: CrawlFlow[], ledger: Array<{ ref: string; stateContext: string }>): Promise<void> {
  const images = await appImages(app);
  const refToImageId = new Map(images.map((image) => [image.image_url, image.id]));
  const flows = assembleFlows(executed, ledger, refToImageId, await getAppFlows(app));
  if (flows.length > 0) await saveAppFlows(app, flows);
}

type ProgressWriter = (state: Omit<ProgressState, "updatedAt">) => void;

export async function withCrawlProgress(
  app: string,
  total: number,
  done: () => number,
  work: () => Promise<CrawlExecutionResult>,
  write: ProgressWriter = writeProgress
): Promise<CrawlExecutionResult> {
  let result: CrawlExecutionResult | undefined;
  let workFailed = false;
  try {
    result = await work();
    return result;
  } catch (error) {
    workFailed = true;
    throw error;
  } finally {
    try {
      write({
        stage: "smart-crawl",
        app,
        done: done(),
        total,
        status: result === undefined ? "error" : result.status === "succeeded" ? "done" : result.status === "failed" ? "error" : "cancelled",
      });
    } catch (error) {
      if (!workFailed) throw error;
    }
  }
}

export async function smartCrawl(appName: string, dataDir = "data", storage: LegacyCaptureDependencies): Promise<CrawlExecutionResult> {
  const plan = loadPlan(appName, dataDir);
  assertRunnable(plan);
  const { runnable, skippedUnsafe } = splitBySafety(plan);
  for (const flow of skippedUnsafe) {
    console.log(`[${plan.app}] Skipping unsafe flow "${flow.id}" (${flow.title}) — set TEST_ACCOUNT=1 against a disposable test account to run it.`);
  }
  clearCancel();
  const flowResults: FlowRunResult[] = [];
  return withCrawlProgress(
    plan.app,
    runnable.length,
    () => flowResults.filter((flow) => flow.status !== "cancelled").length,
    async () => {
      if (runnable.length === 0) {
        console.log(`[${plan.app}] Nothing to run.`);
        return aggregateCrawlExecution(flowResults, skippedUnsafe.map((flow) => flow.id));
      }

      const context = await launchAppContext(appName, dataDir);
      return withOwnedContext(context, async () => {
        const page = context.pages()[0] ?? (await context.newPage());
        const { sink, ledger } = dbCaptureSink(plan.app, storage);
        const reportDir = join(dataDir, "crawl-reports", plan.app);

        for (const [i, flow] of runnable.entries()) {
          console.log(`\n=== Flow ${i + 1}/${runnable.length}: ${flow.title} ===`);
          writeProgress({ stage: "smart-crawl", app: plan.app, done: i, total: runnable.length, status: "running", message: flow.title });
          const flowResult = await runFlow(page, plan, flow, sink, reportDir);
          flowResults.push(flowResult);
          const failure = flowResult.steps.find((step) => step.status === "failed")?.failure;
          if (failure) {
            console.warn(`[${plan.app}] Flow "${flow.id}" failed at step ${failure.stepIndex + 1} (${stepLabel(failure.step, failure.stepIndex)}): ${failure.error}`);
            if (failure.screenshot) console.warn(`[${plan.app}] Stuck-state screenshot: ${failure.screenshot}`);
          }
        }

        const result = aggregateCrawlExecution(flowResults, skippedUnsafe.map((flow) => flow.id));
        const failures = flowResults.flatMap((flow) => flow.steps.flatMap((step) => (step.failure ? [step.failure] : [])));
        if (failures.length > 0) {
          mkdirSync(reportDir, { recursive: true });
          writeFileSync(join(reportDir, "report.json"), JSON.stringify({ app: plan.app, failures }, null, 2));
          console.log(`[${plan.app}] ${failures.length} flow(s) failed — report at ${join(reportDir, "report.json")}. Patch the plan and re-run (already-captured states dedupe for free).`);
        } else if (result.status === "succeeded") {
          // A stale report would point repair-flow at failures that no longer exist.
          rmSync(join(reportDir, "report.json"), { force: true });
        }

        const completedIds = new Set(flowResults.filter((flow) => flow.status === "completed").map((flow) => flow.flowId));
        const completedFlows = runnable.filter((flow) => completedIds.has(flow.id));
        await persistAssembledFlows(plan.app, completedFlows, ledger);
        if (result.status === "succeeded") {
          console.log(`[${plan.app}] Done. ${ledger.length} state(s) captured across ${result.completedFlows} flow(s).`);
        } else if (result.status === "cancelled") {
          console.log(`[${plan.app}] Cancelled after ${result.completedFlows} completed flow(s).`);
        }
        return result;
      });
    }
  );
}

// Record mode without a plan file: open the app, human drives, every settled state is
// captured. Doubles as the login bootstrap — the persistent profile keeps the session
// for later scripted runs.
export async function recordApp(appName: string, startUrl: string, dataDir = "data", storage: LegacyCaptureDependencies): Promise<FlowRunResult> {
  new URL(startUrl);
  clearCancel();
  const context = await launchAppContext(appName, dataDir);
  return withOwnedContext(context, async () => {
    const page = context.pages()[0] ?? (await context.newPage());
    const { sink, ledger } = dbCaptureSink(appName, storage);
    const plan: CrawlPlan = { app: appName, revision: 1, startUrl, domain: "", sources: [], reviewed: true, flows: [] };
    const flow: CrawlFlow = { id: "recorded", title: `Recorded session`, description: "", safe: true, requiredSecrets: [], steps: [] };
    const result = await runFlow(page, plan, flow, sink, join(dataDir, "crawl-reports", appName));
    if (result.status === "completed") await persistAssembledFlows(appName, [flow], ledger);
    console.log(`[${appName}] Recorded ${ledger.length} state(s).`);
    return result;
  });
}
