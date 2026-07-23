import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EvidenceAnalysisError,
  mapBounded,
  runValidatedProviderCall,
} from "./evidenceAnalysisRuntime.ts";

test("retries invalid structured output with the parser error", async () => {
  const validationErrors: string[] = [];
  const result = await runValidatedProviderCall({
    call: async (validationError) => {
      validationErrors.push(validationError);
      return validationErrors.length === 1 ? { value: 0 } : { value: 2 };
    },
    parse: (value) => {
      const number = (value as { value: number }).value;
      if (number < 1) throw new Error("value must be positive");
      return number;
    },
    timeoutMs: 1_000,
    retryDelayMs: 0,
  });

  assert.deepEqual(result, { value: 2, attemptCount: 2 });
  assert.deepEqual(validationErrors, ["", "value must be positive"]);
});

test("retries temporary provider failures at most three times", async () => {
  let attempts = 0;
  await assert.rejects(
    runValidatedProviderCall({
      call: async () => {
        attempts += 1;
        throw new EvidenceAnalysisError(
          "provider_unavailable",
          "Analysis provider is temporarily unavailable",
        );
      },
      parse: (value) => value,
      timeoutMs: 1_000,
      retryDelayMs: 0,
    }),
    (error: unknown) =>
      error instanceof EvidenceAnalysisError
      && error.code === "provider_unavailable",
  );
  assert.equal(attempts, 3);
});

test("does not retry a provider refusal", async () => {
  let attempts = 0;
  await assert.rejects(
    runValidatedProviderCall({
      call: async () => {
        attempts += 1;
        throw new EvidenceAnalysisError(
          "provider_refused",
          "Analysis provider refused the request",
        );
      },
      parse: (value) => value,
      timeoutMs: 1_000,
      retryDelayMs: 0,
    }),
    (error: unknown) =>
      error instanceof EvidenceAnalysisError
      && error.code === "provider_refused",
  );
  assert.equal(attempts, 1);
});

test("classifies an aborted timeout without exposing its original message", async () => {
  await assert.rejects(
    runValidatedProviderCall({
      call: async () => {
        const error = new Error("secret upstream timeout details");
        error.name = "TimeoutError";
        throw error;
      },
      parse: (value) => value,
      timeoutMs: 1,
      retryDelayMs: 0,
    }),
    (error: unknown) =>
      error instanceof EvidenceAnalysisError
      && error.code === "provider_timeout"
      && error.message === "Analysis provider timed out",
  );
});

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
    timeoutMs: 20,
    retryDelayMs: 0,
  });
  controller.abort(new DOMException("cancelled", "AbortError"));
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(calls, 1);
});

test("maps with bounded concurrency and preserves input order", async () => {
  let active = 0;
  let maximum = 0;
  const values = await mapBounded([3, 1, 2, 4], 2, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, value));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(values, [6, 2, 4, 8]);
  assert.equal(maximum, 2);
  await assert.rejects(() => mapBounded([1], 0, async (value) => value), /concurrency/i);
});
