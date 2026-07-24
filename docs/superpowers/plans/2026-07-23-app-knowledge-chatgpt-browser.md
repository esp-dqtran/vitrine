# App Knowledge ChatGPT Browser Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate App Knowledge through two authenticated normal-ChatGPT browser tabs without `RESEARCH_LLM_*` credentials.

**Architecture:** Extend the existing `ChatSession` browser contract with abort-aware waits, then adapt a two-lane `ChatSession` pool to the existing `AppKnowledgeProvider` interface. Keep API authorization, RabbitMQ transport, evidence verification, caching, revision persistence, SSE progress, and review behavior unchanged; construct and close the ChatGPT pool once per App Knowledge job.

**Tech Stack:** TypeScript, Node test runner, Playwright persistent Chromium contexts, Express, RabbitMQ, PostgreSQL/Supabase, existing App Knowledge validation/runtime.

**Execution constraint:** Work on `main` as requested. Stage only files named by each task; preserve unrelated dirty gallery and design-extract work.

---

## File Map

- Modify `src/llmChat.ts` — add an optional abort signal to the existing browser request contract and make every long wait observe it.
- Modify `src/llmChat.test.ts` — verify backward-compatible profile behavior plus abort-aware wait behavior.
- Modify `src/appKnowledgeProvider.ts` — expose shared prompt rendering used by both transports.
- Create `src/appKnowledgeBrowserProvider.ts` — strict JSON parser and serialized two-lane ChatGPT browser adapter.
- Create `src/appKnowledgeBrowserProvider.test.ts` — adapter, attachment, scheduling, JSON, and cancellation tests.
- Modify `src/evidenceAnalysisRuntime.ts` — combine a job cancellation signal with the existing per-attempt timeout.
- Modify `src/evidenceAnalysisRuntime.test.ts` — verify external cancellation is not retried or reclassified.
- Modify `src/appKnowledgeService.ts` — monitor durable cancellation during a long browser request and abort cleanly.
- Modify `src/appKnowledgeService.test.ts` — verify cancellation during an active provider call does not create an evidence failure.
- Create `src/appKnowledgeProviderConfig.ts` — parse the dedicated browser provider and one-or-two-tab concurrency contract.
- Create `src/appKnowledgeProviderConfig.test.ts` — configuration acceptance and fail-closed tests.
- Modify `services/api/src/app.ts` — advertise `chatgpt-browser` without reading `RESEARCH_LLM_MODEL`.
- Modify `services/api/src/app.test.ts` — prove the live API provider model comes from App Knowledge config.
- Create `services/import-worker/src/appKnowledgeWorker.ts` — own job-scoped browser pool creation, service construction, and cleanup.
- Create `services/import-worker/src/appKnowledgeWorker.test.ts` — verify lazy startup and unconditional cleanup.
- Modify `services/import-worker/src/index.ts` — replace the process-scoped multimodal App Knowledge service with the browser job factory.
- Modify `.env.example` and `docker-compose.yml` — document and pass the dedicated provider settings.
- Modify `docs/operations/app-knowledge-15five-pilot.md` — add browser-provider startup, login, and recovery steps.

### Task 1: Make ChatGPT browser requests abort-aware

**Files:**
- Modify: `src/llmChat.ts`
- Modify: `src/llmChat.test.ts`

- [ ] **Step 1: Write failing abort-contract tests**

Add imports and tests to `src/llmChat.test.ts`:

```ts
import {
  chatSessionHeadless,
  raceChatAbort,
  resolveChatProfileDir,
  type ChatSession,
} from "./llmChat.ts";

test("browser waits reject immediately when the request is aborted", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("cancelled", "AbortError"));

  await assert.rejects(
    () => raceChatAbort(new Promise(() => {}), controller.signal),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("browser waits preserve the operation result without a signal", async () => {
  assert.equal(await raceChatAbort(Promise.resolve("ready")), "ready");
});

test("ChatSession keeps existing callers compatible while accepting request options", () => {
  const session: ChatSession = {
    ask: async (_prompt, _attachment, options) => {
      options?.signal?.throwIfAborted();
      return "reply";
    },
    close: async () => {},
  };
  assert.equal(typeof session.ask, "function");
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
node --experimental-strip-types --test src/llmChat.test.ts
```

Expected: FAIL because `raceChatAbort` and the third `ask` argument do not exist.

- [ ] **Step 3: Extend the contract and abort every long browser wait**

In `src/llmChat.ts`, add:

```ts
export interface ChatAskOptions {
  signal?: AbortSignal;
}

export async function raceChatAbort<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return operation;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", aborted);
        reject(error);
      },
    );
  });
}
```

Change the public interface without breaking current callers:

```ts
export interface ChatSession {
  ask(
    prompt: string,
    filePath?: string | ChatAttachment,
    options?: ChatAskOptions,
  ): Promise<string>;
  close(): Promise<void>;
}
```

Thread `options?.signal` through `waitForCount`, `waitForLogin`,
`waitForStableReply`, and `sendPrompt`. Replace every long
`page.waitForTimeout(...)` and `page.waitForFunction(...)` call in those paths
with `raceChatAbort(..., signal)`, and call `signal?.throwIfAborted()` before
navigation, upload, send, and reply extraction.

The bound method becomes:

```ts
async ask(prompt, filePath, options) {
  const signal = options?.signal;
  signal?.throwIfAborted();
  await raceChatAbort(page.goto(provider.url, { waitUntil: "domcontentloaded" }), signal);
  // Existing login, upload, send, and stable-reply behavior follows,
  // with the same signal passed to every wait helper.
}
```

Keep the existing selectors, six-minute stable-reply ceiling, fresh-chat
navigation, and existing two-argument callers unchanged.

- [ ] **Step 4: Run the focused test**

Run:

```bash
node --experimental-strip-types --test src/llmChat.test.ts
```

Expected: all `llmChat` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/llmChat.ts src/llmChat.test.ts
git commit -m "feat: make chat browser requests cancellable"
```

### Task 2: Build the strict two-lane App Knowledge browser adapter

**Files:**
- Modify: `src/appKnowledgeProvider.ts`
- Modify: `src/appKnowledgeProvider.test.ts`
- Create: `src/appKnowledgeBrowserProvider.ts`
- Create: `src/appKnowledgeBrowserProvider.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `src/appKnowledgeBrowserProvider.test.ts` with:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatAttachment, ChatSession } from "./llmChat.ts";
import {
  createChatGptBrowserAppKnowledgeProvider,
  parseBrowserJsonObject,
} from "./appKnowledgeBrowserProvider.ts";

function evidencePrompt(id: string) {
  return {
    evidenceId: id,
    app: "15five",
    platform: "web" as const,
    kind: "screen" as const,
    flowContext: null,
    previousStepContext: null,
    validationError: "",
  };
}

test("accepts raw JSON and one exact json fence", () => {
  assert.deepEqual(parseBrowserJsonObject('{"ok":true}'), { ok: true });
  assert.deepEqual(
    parseBrowserJsonObject("```json\n{\"ok\":true}\n```"),
    { ok: true },
  );
});

test("rejects prose, multiple objects, arrays, and malformed JSON", () => {
  for (const reply of [
    "",
    'Here is JSON: {"ok":true}',
    '{"a":1}\n{"b":2}',
    "[]",
    "```\n{\"ok\":true}\n```",
    "```json\n{bad}\n```",
  ]) assert.throws(() => parseBrowserJsonObject(reply), /invalid JSON output/i);
});

test("uploads verified bytes and uses no attachment for synthesis", async () => {
  const calls: Array<{
    prompt: string;
    attachment?: string | ChatAttachment;
    signal?: AbortSignal;
  }> = [];
  const session: ChatSession = {
    async ask(prompt, attachment, options) {
      calls.push({ prompt, attachment, signal: options?.signal });
      return '{"ok":true}';
    },
    close: async () => {},
  };
  const provider = createChatGptBrowserAppKnowledgeProvider([session]);
  const signal = AbortSignal.timeout(1_000);

  await provider.analyzeEvidence(evidencePrompt("SCREEN-1"), {
    bytes: Buffer.from("png"),
    contentType: "image/png",
  }, signal);
  await provider.synthesize({
    app: "15five",
    platform: "web",
    captureVersionId: 1654,
    analyses: [],
    flows: [],
    coverage: {},
    allowedEvidenceIds: ["SCREEN-1"],
    validationError: "",
  }, signal);

  assert.equal(provider.model, "chatgpt-browser");
  assert.deepEqual(calls[0].attachment, {
    name: "app-knowledge.png",
    mimeType: "image/png",
    buffer: Buffer.from("png"),
  });
  assert.equal(calls[1].attachment, undefined);
  assert.equal(calls[0].signal, signal);
});

test("serializes work per session while using two sessions concurrently", async () => {
  let active = 0;
  let maximum = 0;
  const perSession = [0, 0];
  const sessions = perSession.map((_value, lane): ChatSession => ({
    async ask() {
      perSession[lane] += 1;
      assert.equal(perSession[lane], 1);
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      perSession[lane] -= 1;
      return '{"ok":true}';
    },
    close: async () => {},
  }));
  const provider = createChatGptBrowserAppKnowledgeProvider(sessions);
  await Promise.all([1, 2, 3, 4].map((id) =>
    provider.analyzeEvidence(evidencePrompt(`SCREEN-${id}`), {
      bytes: Buffer.from("png"),
      contentType: "image/png",
    }, AbortSignal.timeout(1_000))));
  assert.equal(maximum, 2);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts
```

Expected: FAIL because the browser adapter does not exist.

- [ ] **Step 3: Share prompt rendering**

In `src/appKnowledgeProvider.ts`, export the two instruction strings and add
browser prompt renderers:

```ts
export const APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS = EVIDENCE_SYSTEM_PROMPT;
export const APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS = SYNTHESIS_SYSTEM_PROMPT;

export function appKnowledgeBrowserPrompt(
  instructions: string,
  payload: AppKnowledgeEvidencePrompt | AppKnowledgeSynthesisPrompt,
): string {
  return `${instructions}\n\nReturn one JSON object for this payload:\n${JSON.stringify(payload)}`;
}
```

Keep `appKnowledgeProviderFromMultimodalJsonProvider` behavior unchanged and
switch its internal references to the exported constants.

- [ ] **Step 4: Implement strict parsing and lane serialization**

Create `src/appKnowledgeBrowserProvider.ts`:

```ts
import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";
import type { ChatAttachment, ChatSession } from "./llmChat.ts";
import {
  APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS,
  APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS,
  appKnowledgeBrowserPrompt,
  type AppKnowledgeProvider,
} from "./appKnowledgeProvider.ts";

export const CHATGPT_BROWSER_MODEL = "chatgpt-browser";

export function parseBrowserJsonObject(reply: string): Record<string, unknown> {
  const trimmed = reply.trim();
  const fenced = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(trimmed);
  const source = fenced?.[1].trim() ?? trimmed;
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new EvidenceAnalysisError("output_invalid", "Analysis provider returned invalid JSON output");
  }
}

function attachment(image: {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
}): ChatAttachment {
  const extension = image.contentType === "image/jpeg"
    ? "jpg"
    : image.contentType.split("/")[1];
  return {
    name: `app-knowledge.${extension}`,
    mimeType: image.contentType,
    buffer: image.bytes,
  };
}

export function createChatGptBrowserAppKnowledgeProvider(
  sessions: readonly ChatSession[],
): AppKnowledgeProvider {
  if (sessions.length < 1 || sessions.length > 2) {
    throw new Error("App Knowledge browser provider requires one or two sessions");
  }
  const tails = sessions.map(() => Promise.resolve());
  let cursor = 0;
  const useSession = async <T>(
    signal: AbortSignal,
    operation: (session: ChatSession) => Promise<T>,
  ): Promise<T> => {
    signal.throwIfAborted();
    const lane = cursor % sessions.length;
    cursor += 1;
    const result = tails[lane].then(() => {
      signal.throwIfAborted();
      return operation(sessions[lane]);
    });
    tails[lane] = result.then(() => undefined, () => undefined);
    return result;
  };

  return {
    model: CHATGPT_BROWSER_MODEL,
    analyzeEvidence(prompt, image, signal) {
      return useSession(signal, async (session) => parseBrowserJsonObject(
        await session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_EVIDENCE_INSTRUCTIONS, prompt),
          attachment(image),
          { signal },
        ),
      ));
    },
    synthesize(prompt, signal) {
      return useSession(signal, async (session) => parseBrowserJsonObject(
        await session.ask(
          appKnowledgeBrowserPrompt(APP_KNOWLEDGE_SYNTHESIS_INSTRUCTIONS, prompt),
          undefined,
          { signal },
        ),
      ));
    },
  };
}
```

- [ ] **Step 5: Run the provider tests**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts
```

Expected: all provider tests PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  src/appKnowledgeProvider.ts \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.ts \
  src/appKnowledgeBrowserProvider.test.ts
git commit -m "feat: adapt app knowledge to chatgpt browser"
```

### Task 3: Propagate durable job cancellation into browser requests

**Files:**
- Modify: `src/evidenceAnalysisRuntime.ts`
- Modify: `src/evidenceAnalysisRuntime.test.ts`
- Modify: `src/appKnowledgeService.ts`
- Modify: `src/appKnowledgeService.test.ts`

- [ ] **Step 1: Write failing runtime cancellation tests**

Add to `src/evidenceAnalysisRuntime.test.ts`:

```ts
test("external cancellation is neither retried nor reclassified", async () => {
  const controller = new AbortController();
  let calls = 0;
  const promise = runValidatedProviderCall({
    signal: controller.signal,
    call: async (_validationError, signal) => {
      calls += 1;
      await new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    },
    parse: () => ({ ok: true }),
    timeoutMs: 10_000,
    retryDelayMs: 0,
  });
  controller.abort(new DOMException("cancelled", "AbortError"));
  await assert.rejects(promise, (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError");
  assert.equal(calls, 1);
});
```

Add a service test to `src/appKnowledgeService.test.ts` using the existing
harness:

```ts
test("cancels an active provider call without recording evidence failure", async () => {
  const state = await harness({ blockEvidenceId: "SCREEN-1" });
  const generation = state.service.generate("1");
  await state.providerStarted;
  state.cancel();

  assert.equal(await generation, "cancelled");
  assert.equal(state.records.has("SCREEN-1"), false);
  assert.equal(state.failed, undefined);
});
```

Extend the existing harness options with `blockEvidenceId?: string`. Create a
`Promise.withResolvers<void>()` for `providerStarted`; when `analyzeEvidence`
receives that evidence ID, resolve `providerStarted.promise` and wait for its
signal to abort:

```ts
const providerGate = Promise.withResolvers<void>();

async analyzeEvidence(prompt, _image, signal) {
  if (prompt.evidenceId === options.blockEvidenceId) {
    providerGate.resolve();
    await new Promise<never>((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }
  return analysis(prompt.evidenceId);
}
```

Return these controls from the harness and set a one-millisecond monitor
interval:

```ts
cancelCheckIntervalMs: 1,
// returned fields
providerStarted: providerGate.promise,
cancel: () => { job.cancelRequested = true; },
```

Use the existing fake store and evidence source; do not create a database
fixture.

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
node --experimental-strip-types --test \
  src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.test.ts
```

Expected: FAIL because provider calls accept only timeout signals and active
durable cancellation is not observed.

- [ ] **Step 3: Combine external cancellation with per-attempt timeout**

Extend the runtime input:

```ts
export async function runValidatedProviderCall<T>(input: {
  call(validationError: string, signal: AbortSignal): Promise<unknown>;
  parse(value: unknown): T;
  timeoutMs: number;
  retryDelayMs: number;
  signal?: AbortSignal;
}): Promise<{ value: T; attemptCount: number }> {
```

At each attempt:

```ts
input.signal?.throwIfAborted();
const attemptSignal = input.signal
  ? AbortSignal.any([input.signal, AbortSignal.timeout(input.timeoutMs)])
  : AbortSignal.timeout(input.timeoutMs);
raw = await input.call(validationError, attemptSignal);
```

In the catch block, before classification:

```ts
if (input.signal?.aborted) throw input.signal.reason;
```

This keeps timeouts retryable but lets durable cancellation escape unchanged.

- [ ] **Step 4: Monitor durable cancellation for the active job**

In `createAppKnowledgeService`, add an optional testable interval:

```ts
cancelCheckIntervalMs?: number;
```

After claiming a running job, create one controller and monitor:

```ts
const cancellation = new AbortController();
const monitorStop = new AbortController();
const waitForCheck = () => new Promise<void>((resolve) => {
  const complete = () => {
    clearTimeout(timer);
    monitorStop.signal.removeEventListener("abort", complete);
    resolve();
  };
  const timer = setTimeout(complete, deps.cancelCheckIntervalMs ?? 1_000);
  monitorStop.signal.addEventListener("abort", complete, { once: true });
});
const monitor = (async () => {
  while (!monitorStop.signal.aborted && !cancellation.signal.aborted) {
    await waitForCheck();
    if (monitorStop.signal.aborted) return;
    const current = await deps.store.workerJob(jobId);
    if (current?.cancelRequested) {
      cancellation.abort(new DOMException("cancelled", "AbortError"));
    }
  }
})();
```

Pass `signal: cancellation.signal` to every `runValidatedProviderCall`. In an
evidence-call catch, if cancellation is aborted, return `undefined` without
recording a failure. In the outer catch, if cancellation is aborted, call
`deps.store.claimJob(jobId)` once so the existing store performs the durable
cancel transition, then return its status.

Stop the monitor in the outer `finally` without delaying successful jobs:

```ts
} finally {
  monitorStop.abort();
  await monitor;
}
```

- [ ] **Step 5: Run runtime and service tests**

Run:

```bash
node --experimental-strip-types --test \
  src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.test.ts
```

Expected: all tests PASS, including cancellation during an active provider
request.

- [ ] **Step 6: Commit**

```bash
git add \
  src/evidenceAnalysisRuntime.ts \
  src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.ts \
  src/appKnowledgeService.test.ts
git commit -m "feat: cancel active app knowledge analysis"
```

### Task 4: Add dedicated App Knowledge provider configuration

**Files:**
- Create: `src/appKnowledgeProviderConfig.ts`
- Create: `src/appKnowledgeProviderConfig.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing configuration tests**

Create `src/appKnowledgeProviderConfig.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appKnowledgeProviderConfigFromEnvironment,
  appKnowledgeProviderModelFromEnvironment,
} from "./appKnowledgeProviderConfig.ts";

test("enables the normal ChatGPT browser with two tabs by default", () => {
  assert.deepEqual(appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
  }), { kind: "chatgpt-browser", model: "chatgpt-browser", concurrency: 2 });
});

test("accepts one or two tabs and rejects every other value", () => {
  assert.equal(appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
    APP_KNOWLEDGE_BROWSER_CONCURRENCY: "1",
  })?.concurrency, 1);
  assert.throws(() => appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
    APP_KNOWLEDGE_BROWSER_CONCURRENCY: "3",
  }), /one or two/);
});

test("missing and unknown provider values fail closed", () => {
  assert.equal(appKnowledgeProviderConfigFromEnvironment({}), undefined);
  assert.equal(appKnowledgeProviderModelFromEnvironment({}), "");
  assert.throws(() => appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "api",
  }), /unsupported/i);
});
```

In `services/api/src/app.test.ts`, add a source-boundary assertion:

```ts
test("App Knowledge availability comes from its browser provider config", async () => {
  const source = await readFile(new URL("./app.ts", import.meta.url), "utf8");
  assert.match(source, /appKnowledgeProviderModelFromEnvironment/);
  assert.doesNotMatch(
    source.match(/appKnowledgeProviderModel:[^\n]+/)?.[0] ?? "",
    /RESEARCH_LLM_MODEL/,
  );
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProviderConfig.test.ts \
  services/api/src/app.test.ts
```

Expected: FAIL because the configuration module does not exist and API defaults
still read `RESEARCH_LLM_MODEL`.

- [ ] **Step 3: Implement strict configuration**

Create `src/appKnowledgeProviderConfig.ts`:

```ts
import { CHATGPT_BROWSER_MODEL } from "./appKnowledgeBrowserProvider.ts";

export interface ChatGptBrowserAppKnowledgeConfig {
  kind: "chatgpt-browser";
  model: typeof CHATGPT_BROWSER_MODEL;
  concurrency: 1 | 2;
}

export function appKnowledgeProviderConfigFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): ChatGptBrowserAppKnowledgeConfig | undefined {
  const provider = env.APP_KNOWLEDGE_PROVIDER?.trim();
  if (!provider) return undefined;
  if (provider !== "chatgpt-browser") {
    throw new Error(`Unsupported App Knowledge provider "${provider}"`);
  }
  const raw = env.APP_KNOWLEDGE_BROWSER_CONCURRENCY?.trim() || "2";
  if (raw !== "1" && raw !== "2") {
    throw new Error("App Knowledge browser concurrency must be one or two");
  }
  return {
    kind: "chatgpt-browser",
    model: CHATGPT_BROWSER_MODEL,
    concurrency: Number(raw) as 1 | 2,
  };
}

export function appKnowledgeProviderModelFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): string {
  return appKnowledgeProviderConfigFromEnvironment(env)?.model ?? "";
}
```

In `services/api/src/app.ts`, import the model helper and replace:

```ts
appKnowledgeProviderModel: process.env.RESEARCH_LLM_MODEL?.trim() ?? "",
```

with:

```ts
appKnowledgeProviderModel: appKnowledgeProviderModelFromEnvironment(),
```

Do not change Feature Document configuration.

- [ ] **Step 4: Run config and API tests**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeProviderConfig.test.ts \
  services/api/src/appKnowledge.test.ts \
  services/api/src/app.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/appKnowledgeProviderConfig.ts \
  src/appKnowledgeProviderConfig.test.ts \
  services/api/src/app.ts \
  services/api/src/app.test.ts
git commit -m "feat: configure chatgpt browser app knowledge"
```

### Task 5: Make the ChatGPT pool lazy and job-scoped in the import worker

**Files:**
- Create: `services/import-worker/src/appKnowledgeWorker.ts`
- Create: `services/import-worker/src/appKnowledgeWorker.test.ts`
- Modify: `services/import-worker/src/index.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`

- [ ] **Step 1: Write failing worker lifecycle tests**

Create `services/import-worker/src/appKnowledgeWorker.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatSession } from "../../../src/llmChat.ts";
import { createBrowserAppKnowledgeGenerator } from "./appKnowledgeWorker.ts";

function session(): ChatSession {
  return { ask: async () => '{"ok":true}', close: async () => {} };
}

for (const outcome of ["done", "cancelled", "error"] as const) {
  test(`closes the browser pool after ${outcome}`, async () => {
    const opened: string[] = [];
    let closed = 0;
    const generate = createBrowserAppKnowledgeGenerator({
      environment: {
        APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
        APP_KNOWLEDGE_BROWSER_CONCURRENCY: "2",
      },
      startChatPool: async (provider, concurrency) => {
        opened.push(`${provider}:${concurrency}`);
        return {
          sessions: [session(), session()],
          closeAll: async () => { closed += 1; },
        };
      },
      failProviderUnavailable: async () => {
        throw new Error("must not fail a configured job");
      },
      createService: () => ({ generate: async () => outcome }),
    });

    assert.deepEqual(opened, []);
    assert.equal(await generate("31"), outcome);
    assert.deepEqual(opened, ["chatgpt:2"]);
    assert.equal(closed, 1);
  });
}

test("closes the browser pool when service generation throws", async () => {
  let closed = 0;
  const generate = createBrowserAppKnowledgeGenerator({
    environment: { APP_KNOWLEDGE_PROVIDER: "chatgpt-browser" },
    startChatPool: async () => ({
      sessions: [session(), session()],
      closeAll: async () => { closed += 1; },
    }),
    failProviderUnavailable: async () => {
      throw new Error("must not fail after the pool opens");
    },
    createService: () => ({
      generate: async () => { throw new Error("generation failed"); },
    }),
  });
  await assert.rejects(() => generate("31"), /generation failed/);
  assert.equal(closed, 1);
});

test("does not open a browser when the provider is unavailable", async () => {
  let opened = false;
  const failed: string[] = [];
  const generate = createBrowserAppKnowledgeGenerator({
    environment: {},
    startChatPool: async () => {
      opened = true;
      throw new Error("must not open");
    },
    failProviderUnavailable: async (runId) => { failed.push(runId); },
    createService: () => ({ generate: async () => "done" }),
  });
  assert.equal(await generate("31"), "error");
  assert.equal(opened, false);
  assert.deepEqual(failed, ["31"]);
});

test("marks the durable job unavailable when ChatGPT pool startup fails", async () => {
  const failed: string[] = [];
  const generate = createBrowserAppKnowledgeGenerator({
    environment: { APP_KNOWLEDGE_PROVIDER: "chatgpt-browser" },
    startChatPool: async () => {
      throw new Error("secret browser profile path");
    },
    failProviderUnavailable: async (runId) => { failed.push(runId); },
    createService: () => ({ generate: async () => "done" }),
  });
  assert.equal(await generate("31"), "error");
  assert.deepEqual(failed, ["31"]);
});
```

Add a pipeline regression to `services/import-worker/src/pipeline.test.ts` that
asserts an unrelated `caption-app` job never calls `generateAppKnowledge`.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --experimental-strip-types --test \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  services/import-worker/src/pipeline.test.ts
```

Expected: FAIL because the job-scoped worker factory does not exist.

- [ ] **Step 3: Implement the lifecycle owner**

Create `services/import-worker/src/appKnowledgeWorker.ts`:

```ts
import type { AppKnowledgeJobStatus } from "../../../src/appKnowledge.ts";
import type { AppKnowledgeProvider } from "../../../src/appKnowledgeProvider.ts";
import { createChatGptBrowserAppKnowledgeProvider } from "../../../src/appKnowledgeBrowserProvider.ts";
import {
  appKnowledgeProviderConfigFromEnvironment,
  type ChatGptBrowserAppKnowledgeConfig,
} from "../../../src/appKnowledgeProviderConfig.ts";
import { startChatPool, type ChatSession } from "../../../src/llmChat.ts";

interface AppKnowledgeGeneratorDependencies {
  environment?: Record<string, string | undefined>;
  startChatPool(
    provider: string,
    concurrency: number,
  ): Promise<{ sessions: ChatSession[]; closeAll(): Promise<void> }>;
  failProviderUnavailable(runId: string): Promise<void>;
  createService(
    provider: AppKnowledgeProvider,
    concurrency: number,
  ): { generate(runId: string): Promise<AppKnowledgeJobStatus | undefined> };
}

export function createBrowserAppKnowledgeGenerator(
  overrides: Partial<AppKnowledgeGeneratorDependencies> &
    Pick<AppKnowledgeGeneratorDependencies, "createService" | "failProviderUnavailable">,
) {
  const deps: AppKnowledgeGeneratorDependencies = {
    environment: process.env,
    startChatPool,
    ...overrides,
  };
  return async (runId: string): Promise<AppKnowledgeJobStatus | undefined> => {
    let config: ChatGptBrowserAppKnowledgeConfig | undefined;
    try {
      config = appKnowledgeProviderConfigFromEnvironment(deps.environment);
    } catch {
      await deps.failProviderUnavailable(runId);
      return "error";
    }
    if (!config) {
      await deps.failProviderUnavailable(runId);
      return "error";
    }
    let pool: { sessions: ChatSession[]; closeAll(): Promise<void> };
    try {
      pool = await deps.startChatPool("chatgpt", config.concurrency);
    } catch {
      await deps.failProviderUnavailable(runId);
      return "error";
    }
    try {
      const provider = createChatGptBrowserAppKnowledgeProvider(pool.sessions);
      return await deps.createService(provider, config.concurrency).generate(runId);
    } finally {
      await pool.closeAll();
    }
  };
}
```

- [ ] **Step 4: Wire production dependencies without touching Feature Documents**

In `services/import-worker/src/index.ts`:

1. Remove only the process-scoped `appKnowledgeProvider` and
   `appKnowledgeService` constants.
2. Keep `multimodalProvider` and `featureDocumentService` unchanged.
3. Import `createBrowserAppKnowledgeGenerator`.
4. Build:

```ts
const generateAppKnowledge = createBrowserAppKnowledgeGenerator({
  failProviderUnavailable: (runId) => appKnowledgeStore.failJob(
    Number(runId),
    "provider_unavailable",
    "Analysis provider is temporarily unavailable",
  ),
  createService: (provider, concurrency) => createAppKnowledgeService({
    store: appKnowledgeStore,
    provider,
    objectStore,
    evidenceSource: (target) => appKnowledgeEvidenceSource({
      app: target.app,
      platform: target.platform,
      versionNumber: target.versionNumber,
    }),
    evidenceOverrides: (versionId) => appKnowledgeStore.evidenceOverrides(versionId),
    imageObjectById,
    currentSourceSha256: async (target) => {
      const source = await appKnowledgeEvidenceSource({
        app: target.app,
        platform: target.platform,
        versionNumber: target.versionNumber,
      });
      if (!source) return undefined;
      const prepared = await buildAppKnowledgeEvidenceManifest({
        source,
        objectStore,
        overrides: await appKnowledgeStore.evidenceOverrides(target.captureVersionId),
      });
      return prepared.sourceSha256;
    },
    screenConcurrency: concurrency,
    flowConcurrency: concurrency,
    timeoutMs: 6 * 60_000,
  }),
});
```

Pass it directly to the pipeline:

```ts
generateAppKnowledge,
```

The browser must still be created only when the pipeline invokes this function
for `generate-app-knowledge`.

- [ ] **Step 5: Run worker and provider regression tests**

Run:

```bash
node --experimental-strip-types --test \
  src/appKnowledgeBrowserProvider.test.ts \
  src/appKnowledgeService.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  services/import-worker/src/pipeline.test.ts \
  services/import-worker/src/startup.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  services/import-worker/src/appKnowledgeWorker.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  services/import-worker/src/index.ts \
  services/import-worker/src/pipeline.test.ts
git commit -m "feat: run app knowledge through chatgpt browser"
```

### Task 6: Document runtime configuration and authenticated-profile behavior

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docs/operations/app-knowledge-15five-pilot.md`

- [ ] **Step 1: Write the configuration contract**

Add to `.env.example` immediately after the existing chat profile settings:

```env
# App Knowledge uses the normal signed-in ChatGPT web application.
# Supported concurrency is 1 or 2; two is the recommended default.
APP_KNOWLEDGE_PROVIDER=chatgpt-browser
APP_KNOWLEDGE_BROWSER_CONCURRENCY=2
```

Clarify the `RESEARCH_LLM_*` comment so it names Research Projects and Feature
Documents only; it must no longer claim App Knowledge uses those values.

- [ ] **Step 2: Pass only non-secret provider settings through Compose**

Add to both the `api` and `import-worker` environment blocks:

```yaml
APP_KNOWLEDGE_PROVIDER: ${APP_KNOWLEDGE_PROVIDER:-chatgpt-browser}
APP_KNOWLEDGE_BROWSER_CONCURRENCY: ${APP_KNOWLEDGE_BROWSER_CONCURRENCY:-2}
```

Do not add cookies, browser tokens, profile contents, or API credentials.
Preserve the existing `CHAT_PROFILE_ROOT` volume behavior.

- [ ] **Step 3: Update the pilot runbook**

Add these exact local pilot steps to
`docs/operations/app-knowledge-15five-pilot.md`:

````md
## ChatGPT browser provider

Set:

```env
APP_KNOWLEDGE_PROVIDER=chatgpt-browser
APP_KNOWLEDGE_BROWSER_CONCURRENCY=2
```

The local worker reuses `~/.config/chatgpt-cli/profile`. Start the worker
headed for the first pilot:

```bash
HEADLESS=false npm run service:import-worker
```

If ChatGPT is logged out, authenticate in the window opened by the worker,
allow the current job to fail safely, then resume the same durable App
Knowledge job. Do not copy or inspect browser cookies. Containerized headless
workers require an already-authenticated Linux profile volume and are not the
first-pilot path.
````

State explicitly that two tabs share one login, each evidence request starts a
fresh conversation, browser selector drift is provider-unavailable, and
completed/cache evidence survives restart.

- [ ] **Step 4: Run static configuration checks**

Run:

```bash
rg -n "APP_KNOWLEDGE_PROVIDER|APP_KNOWLEDGE_BROWSER_CONCURRENCY" \
  .env.example docker-compose.yml docs/operations/app-knowledge-15five-pilot.md
rg -n "RESEARCH_LLM_" src/appKnowledge* services/import-worker/src/appKnowledgeWorker.ts
```

Expected: provider settings appear in all three operational surfaces; the
second command returns no App Knowledge runtime dependency.

- [ ] **Step 5: Enable the non-secret provider locally for the pilot**

If the two settings are absent from the gitignored local `.env`, add exactly:

```env
APP_KNOWLEDGE_PROVIDER=chatgpt-browser
APP_KNOWLEDGE_BROWSER_CONCURRENCY=2
```

Do not stage `.env`, print its other contents, or modify any credential value.

- [ ] **Step 6: Commit**

```bash
git add .env.example docker-compose.yml docs/operations/app-knowledge-15five-pilot.md
git commit -m "docs: operate app knowledge with chatgpt browser"
```

### Task 7: Verify the feature and run the live 15five pilot

**Files:**
- Modify only if a defect is discovered in a file named by Tasks 1–6.

- [ ] **Step 1: Run the focused provider and lifecycle suites**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/llmChat.test.ts \
  src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.test.ts \
  src/appKnowledgeProviderConfig.test.ts \
  src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.test.ts \
  services/api/src/appKnowledge.test.ts \
  services/api/src/app.test.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  services/import-worker/src/pipeline.test.ts \
  services/import-worker/src/startup.test.ts
```

Expected: all focused tests PASS. PostgreSQL-backed tests may skip only when
their documented pgvector test database is unavailable.

- [ ] **Step 2: Run all App Knowledge UI and pilot tests**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/appKnowledge*.test.ts \
  scripts/verify-app-knowledge-pilot.test.ts \
  src/vitrine/appKnowledge*.test.ts \
  src/vitrine/useAppKnowledge.test.ts
npx tsx --test src/vitrine/AppKnowledge*.test.tsx
```

Expected: all tests PASS, with only the documented pgvector integration skip.

- [ ] **Step 3: Run build and static audits**

Run:

```bash
npm run build
git diff --check
rg -n "setInterval|GET /api/jobs|/api/jobs" \
  src/vitrine/appKnowledgeApi.ts \
  src/vitrine/appKnowledgeStore.ts \
  src/vitrine/useAppKnowledge.ts \
  src/vitrine/components/AppKnowledgePanel.tsx
```

Expected: build PASS; no diff errors; no App Knowledge frontend polling match.

- [ ] **Step 4: Verify live prerequisites without exposing secrets**

Run:

```bash
node --env-file=.env --experimental-strip-types scripts/check-migrations.ts
nc -z 127.0.0.1 5672
node --env-file=.env --input-type=module -e '
const enabled = process.env.APP_KNOWLEDGE_PROVIDER === "chatgpt-browser";
const concurrency = process.env.APP_KNOWLEDGE_BROWSER_CONCURRENCY || "2";
console.log(JSON.stringify({ enabled, concurrency }));
'
```

Expected: migrations current, RabbitMQ reachable, provider enabled, and
concurrency `"1"` or `"2"`. Never print session or object-store credentials.

- [ ] **Step 5: Start the API and headed worker**

In separate terminals:

```bash
npm run service:api
```

```bash
HEADLESS=false npm run service:import-worker
```

Expected: API health succeeds, worker waits for RabbitMQ jobs, and no ChatGPT
window opens before an App Knowledge job is delivered.

- [ ] **Step 6: Submit the scoped pilot through the existing admin API**

Use an authenticated admin session to submit:

```http
POST /api/app-knowledge/jobs
Content-Type: application/json

{"app":"15five","platform":"web","version":1}
```

Expected: `201`, a durable App Knowledge job, and exactly one
`generate-app-knowledge` RabbitMQ message. Do not insert a job directly into
PostgreSQL and do not bypass `requireAdmin`.

- [ ] **Step 7: Verify lazy browser startup and progress**

Expected after submission:

- one persistent Chromium context opens;
- it uses the ChatGPT profile selected by `resolveChatProfileDir`;
- exactly two ChatGPT tabs share the context;
- evidence progress advances through the existing database notification/SSE
  path;
- no `GET /api/jobs` polling is introduced; and
- the worker closes the context when the job reaches a terminal state.

If login is required, authenticate in that browser profile, let the current
request fail safely, and resume the same job through:

```http
POST /api/app-knowledge/jobs/{jobId}/resume
```

- [ ] **Step 8: Exercise cancellation and resume**

Cancel one active job through:

```http
POST /api/app-knowledge/jobs/{jobId}/cancel
```

Expected: the active ChatGPT wait aborts, the browser pool closes, no in-flight
evidence becomes a false failure, and completed evidence remains durable.
Resume the same job and verify it processes only unfinished evidence.

- [ ] **Step 9: Run the read-only pilot verifier**

After generation, required review actions, and one identical cached
regeneration:

```bash
npm run analysis:pilot:verify -- --version 1
```

Expected: JSON containing `"ok": true`. If human review gates remain, report
their exact names; do not fabricate approval, flow review, role review, or auth
acceptance events.

- [ ] **Step 10: Commit only verification defects, if any**

If verification requires a code correction:

```bash
git add \
  src/llmChat.ts src/llmChat.test.ts \
  src/appKnowledgeProvider.ts src/appKnowledgeProvider.test.ts \
  src/appKnowledgeBrowserProvider.ts src/appKnowledgeBrowserProvider.test.ts \
  src/evidenceAnalysisRuntime.ts src/evidenceAnalysisRuntime.test.ts \
  src/appKnowledgeService.ts src/appKnowledgeService.test.ts \
  src/appKnowledgeProviderConfig.ts src/appKnowledgeProviderConfig.test.ts \
  services/api/src/app.ts services/api/src/app.test.ts \
  services/import-worker/src/appKnowledgeWorker.ts \
  services/import-worker/src/appKnowledgeWorker.test.ts \
  services/import-worker/src/index.ts services/import-worker/src/pipeline.test.ts \
  .env.example docker-compose.yml \
  docs/operations/app-knowledge-15five-pilot.md
git commit -m "fix: complete chatgpt browser app knowledge verification"
```

If no correction is needed, create no empty commit.
