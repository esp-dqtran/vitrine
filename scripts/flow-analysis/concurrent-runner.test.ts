import assert from "node:assert/strict";
import { test } from "node:test";

test("runWithWorkers processes every item once with the supplied workers", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const runWithWorkers = (module as {
    runWithWorkers?: <T, W>(
      items: readonly T[],
      workers: readonly W[],
      run: (worker: W, item: T, index: number) => Promise<void>,
    ) => Promise<void>;
  }).runWithWorkers;

  assert.equal(typeof runWithWorkers, "function");

  const seen: Array<{ worker: string; item: number; index: number }> = [];
  let active = 0;
  let maxActive = 0;
  await runWithWorkers!([10, 20, 30, 40], ["a", "b"], async (worker, item, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    seen.push({ worker, item, index });
    active -= 1;
  });

  assert.equal(maxActive, 2);
  assert.deepEqual(seen.map(({ item }) => item).sort((a, b) => a - b), [10, 20, 30, 40]);
  assert.deepEqual(seen.map(({ index }) => index).sort((a, b) => a - b), [0, 1, 2, 3]);
});

test("createSerialQueue runs state updates without overlap and in call order", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const createSerialQueue = (module as {
    createSerialQueue?: () => <T>(operation: () => Promise<T>) => Promise<T>;
  }).createSerialQueue;

  assert.equal(typeof createSerialQueue, "function");

  const serial = createSerialQueue!();
  const events: string[] = [];
  await Promise.all([
    serial(async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push("first:end");
    }),
    serial(async () => {
      events.push("second:start");
      events.push("second:end");
    }),
  ]);

  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("runWithWorkers stops assigning new items after a worker fails", async () => {
  const { runWithWorkers } = await import("./concurrent-runner.ts").catch(() => ({
    runWithWorkers: undefined,
  }));
  assert.equal(typeof runWithWorkers, "function");

  const started: number[] = [];
  await assert.rejects(
    runWithWorkers!([1, 2, 3, 4], ["a", "b"], async (_worker, item) => {
      started.push(item);
      if (item === 1) throw new Error("boom");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }),
    /boom/,
  );

  assert.deepEqual(started.sort((a, b) => a - b), [1, 2]);
});

test("isInfrastructureFailure distinguishes transient connectivity outages from flow errors", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const isInfrastructureFailure = (module as {
    isInfrastructureFailure?: (error: unknown) => boolean;
  }).isInfrastructureFailure;

  assert.equal(typeof isInfrastructureFailure, "function");
  assert.equal(isInfrastructureFailure!(new Error("getaddrinfo ENOTFOUND example.com")), true);
  assert.equal(
    isInfrastructureFailure!(
      new Error("page.goto: net::ERR_ADDRESS_UNREACHABLE at https://chatgpt.com/"),
    ),
    true,
  );
  assert.equal(
    isInfrastructureFailure!(
      new Error("page.goto: net::ERR_NETWORK_CHANGED at https://chatgpt.com/"),
    ),
    true,
  );
  assert.equal(
    isInfrastructureFailure!(
      new Error("page.goto failed", {
        cause: new Error("net::ERR_INTERNET_DISCONNECTED at https://chatgpt.com/"),
      }),
    ),
    true,
  );
  assert.equal(isInfrastructureFailure!(new Error("Analysis provider returned invalid JSON output")), false);
});

test("isRateLimitFailure recognizes the ChatGPT rate-limit modal inside Playwright errors", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const isRateLimitFailure = (module as {
    isRateLimitFailure?: (error: unknown) => boolean;
  }).isRateLimitFailure;

  assert.equal(typeof isRateLimitFailure, "function");
  assert.equal(
    isRateLimitFailure!(
      new Error(
        "locator.click: Timeout exceeded; modal-conversation-history-rate-limit; Please wait a few minutes before trying again.",
      ),
    ),
    true,
  );
  assert.equal(isRateLimitFailure!(new Error("locator.click: Timeout 30000ms exceeded")), false);
});

test("rateLimitCooldown increases through 15, 30, and 60 minute waits", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const rateLimitCooldown = (module as {
    rateLimitCooldown?: (
      consecutiveRateLimits: number,
      nowMs: number,
      random: () => number,
    ) => { attempt: number; delayMs: number; until: string };
  }).rateLimitCooldown;

  assert.equal(typeof rateLimitCooldown, "function");

  const now = Date.parse("2026-07-25T12:00:00.000Z");
  assert.deepEqual(rateLimitCooldown!(0, now, () => 0.5), {
    attempt: 1,
    delayMs: 15 * 60_000,
    until: "2026-07-25T12:15:00.000Z",
  });
  assert.equal(rateLimitCooldown!(1, now, () => 0.5).delayMs, 30 * 60_000);
  assert.equal(rateLimitCooldown!(2, now, () => 0.5).delayMs, 60 * 60_000);
  assert.deepEqual(rateLimitCooldown!(8, now, () => 0.5), {
    attempt: 9,
    delayMs: 60 * 60_000,
    until: "2026-07-25T13:00:00.000Z",
  });
});

test("rateLimitCooldown applies bounded ten percent jitter", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const rateLimitCooldown = (module as {
    rateLimitCooldown?: (
      consecutiveRateLimits: number,
      nowMs: number,
      random: () => number,
    ) => { delayMs: number; until: string };
  }).rateLimitCooldown;

  assert.equal(typeof rateLimitCooldown, "function");

  const now = Date.parse("2026-07-25T12:00:00.000Z");
  assert.equal(rateLimitCooldown!(0, now, () => 0).delayMs, 13.5 * 60_000);
  assert.equal(rateLimitCooldown!(0, now, () => 1).delayMs, 16.5 * 60_000);
});

test("runWithRateLimitCooldown waits and retries after a rate limit", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const runWithRateLimitCooldown = (module as {
    runWithRateLimitCooldown?: <T>(options: {
      run: (resetCooldown: () => void) => Promise<T>;
      isRateLimit: (error: unknown) => boolean;
      sleep: (delayMs: number) => Promise<void>;
      onCooldown: (
        cooldown: { attempt: number; delayMs: number; until: string },
        error: unknown,
      ) => Promise<void>;
      onResume: () => Promise<void>;
      now: () => number;
      random: () => number;
    }) => Promise<T>;
  }).runWithRateLimitCooldown;

  assert.equal(typeof runWithRateLimitCooldown, "function");

  let runs = 0;
  const events: string[] = [];
  const result = await runWithRateLimitCooldown!({
    run: async () => {
      runs += 1;
      if (runs === 1) throw new Error("rate limited");
      return "done";
    },
    isRateLimit: (error) => error instanceof Error && error.message === "rate limited",
    sleep: async (delayMs) => {
      events.push(`sleep:${delayMs}`);
    },
    onCooldown: async ({ attempt, until }) => {
      events.push(`cooldown:${attempt}:${until}`);
    },
    onResume: async () => {
      events.push("resume");
    },
    now: () => Date.parse("2026-07-25T12:00:00.000Z"),
    random: () => 0.5,
  });

  assert.equal(result, "done");
  assert.equal(runs, 2);
  assert.deepEqual(events, [
    "cooldown:1:2026-07-25T12:15:00.000Z",
    `sleep:${15 * 60_000}`,
    "resume",
  ]);
});

test("runWithRateLimitCooldown escalates consecutive limits and resets after progress", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const runWithRateLimitCooldown = (module as {
    runWithRateLimitCooldown?: <T>(options: {
      run: (resetCooldown: () => void) => Promise<T>;
      isRateLimit: (error: unknown) => boolean;
      sleep: (delayMs: number) => Promise<void>;
      onCooldown: (cooldown: { attempt: number; delayMs: number }) => Promise<void>;
      onResume: () => Promise<void>;
      now: () => number;
      random: () => number;
    }) => Promise<T>;
  }).runWithRateLimitCooldown;

  assert.equal(typeof runWithRateLimitCooldown, "function");

  let runs = 0;
  const cooldowns: Array<{ attempt: number; delayMs: number }> = [];
  await runWithRateLimitCooldown!({
    run: async (resetCooldown) => {
      runs += 1;
      if (runs === 3) resetCooldown();
      if (runs < 4) throw new Error("rate limited");
    },
    isRateLimit: () => true,
    sleep: async () => {},
    onCooldown: async ({ attempt, delayMs }) => {
      cooldowns.push({ attempt, delayMs });
    },
    onResume: async () => {},
    now: () => 0,
    random: () => 0.5,
  });

  assert.deepEqual(cooldowns, [
    { attempt: 1, delayMs: 15 * 60_000 },
    { attempt: 2, delayMs: 30 * 60_000 },
    { attempt: 1, delayMs: 15 * 60_000 },
  ]);
});

test("runWithRateLimitCooldown does not retry unrelated failures", async () => {
  const module = await import("./concurrent-runner.ts").catch(() => ({}));
  const runWithRateLimitCooldown = (module as {
    runWithRateLimitCooldown?: <T>(options: {
      run: (resetCooldown: () => void) => Promise<T>;
      isRateLimit: (error: unknown) => boolean;
      sleep: (delayMs: number) => Promise<void>;
      onCooldown: (
        cooldown: { attempt: number; delayMs: number; until: string },
        error: unknown,
      ) => Promise<void>;
      onResume: () => Promise<void>;
    }) => Promise<T>;
  }).runWithRateLimitCooldown;

  assert.equal(typeof runWithRateLimitCooldown, "function");

  let slept = false;
  await assert.rejects(
    runWithRateLimitCooldown!({
      run: async () => {
        throw new Error("network down");
      },
      isRateLimit: () => false,
      sleep: async () => {
        slept = true;
      },
      onCooldown: async () => {},
      onResume: async () => {},
    }),
    /network down/,
  );
  assert.equal(slept, false);
});
