export async function runWithWorkers<T, W>(
  items: readonly T[],
  workers: readonly W[],
  run: (worker: W, item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  let firstError: unknown;

  const results = await Promise.allSettled(workers.map(async (worker) => {
    while (firstError === undefined) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        await run(worker, items[index], index);
      } catch (error) {
        firstError ??= error;
        throw error;
      }
    }
  }));

  if (firstError !== undefined) throw firstError;
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected?.status === "rejected") throw rejected.reason;
}

export function createSerialQueue(): <T>(operation: () => Promise<T>) => Promise<T> {
  let tail = Promise.resolve();

  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

const INFRASTRUCTURE_FAILURE_MARKERS = [
  "EADDRNOTAVAIL",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ERR_ADDRESS_UNREACHABLE",
  "ERR_INTERNET_DISCONNECTED",
  "ERR_NETWORK_CHANGED",
];

export function isInfrastructureFailure(error: unknown): boolean {
  let current = error;
  while (current !== undefined && current !== null) {
    const message = current instanceof Error ? current.message : String(current);
    if (INFRASTRUCTURE_FAILURE_MARKERS.some((marker) => message.includes(marker))) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

export function isRateLimitFailure(error: unknown): boolean {
  let current = error;
  while (current !== undefined && current !== null) {
    const message = current instanceof Error ? current.message : String(current);
    if (
      message.includes("modal-conversation-history-rate-limit")
      || message.includes("You’re making requests too quickly")
      || message.includes("Please wait a few minutes before trying again")
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

const RATE_LIMIT_COOLDOWNS_MS = [15, 30, 60].map((minutes) => minutes * 60_000);

export function rateLimitCooldown(
  consecutiveRateLimits: number,
  nowMs: number = Date.now(),
  random: () => number = Math.random,
): { attempt: number; delayMs: number; until: string } {
  const attempt = consecutiveRateLimits + 1;
  const baseDelay = RATE_LIMIT_COOLDOWNS_MS[Math.min(consecutiveRateLimits, RATE_LIMIT_COOLDOWNS_MS.length - 1)];
  const jitterMultiplier = 0.9 + random() * 0.2;
  const delayMs = Math.round(baseDelay * jitterMultiplier);
  return {
    attempt,
    delayMs,
    until: new Date(nowMs + delayMs).toISOString(),
  };
}

interface RateLimitCooldownOptions<T> {
  run(resetCooldown: () => void): Promise<T>;
  isRateLimit(error: unknown): boolean;
  sleep(delayMs: number): Promise<void>;
  onCooldown(
    cooldown: { attempt: number; delayMs: number; until: string },
    error: unknown,
  ): Promise<void>;
  onResume(): Promise<void>;
  now?: () => number;
  random?: () => number;
}

export async function runWithRateLimitCooldown<T>(
  options: RateLimitCooldownOptions<T>,
): Promise<T> {
  let consecutiveRateLimits = 0;
  const resetCooldown = (): void => {
    consecutiveRateLimits = 0;
  };

  while (true) {
    try {
      return await options.run(resetCooldown);
    } catch (error) {
      if (!options.isRateLimit(error)) throw error;
      const cooldown = rateLimitCooldown(
        consecutiveRateLimits,
        options.now?.() ?? Date.now(),
        options.random ?? Math.random,
      );
      consecutiveRateLimits = cooldown.attempt;
      await options.onCooldown(cooldown, error);
      await options.sleep(cooldown.delayMs);
      await options.onResume();
    }
  }
}
