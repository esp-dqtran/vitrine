export type EvidenceAnalysisFailureCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_refused"
  | "output_invalid";

const SAFE_MESSAGES: Record<EvidenceAnalysisFailureCode, string> = {
  provider_unavailable: "Analysis provider is temporarily unavailable",
  provider_timeout: "Analysis provider timed out",
  provider_refused: "Analysis provider refused the request",
  output_invalid: "Analysis provider returned invalid output",
};

export class EvidenceAnalysisError extends Error {
  readonly code: EvidenceAnalysisFailureCode;

  constructor(
    code: EvidenceAnalysisFailureCode,
    message = SAFE_MESSAGES[code],
  ) {
    super(message);
    this.code = code;
  }
}

function classified(error: unknown): EvidenceAnalysisError {
  if (error instanceof EvidenceAnalysisError) return error;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "TimeoutError" || /timed? ?out|timeout/i.test(message)) {
    return new EvidenceAnalysisError("provider_timeout");
  }
  if (/\((400|401|403|422)\)/.test(message)) {
    return new EvidenceAnalysisError("provider_refused");
  }
  if (/invalid JSON|invalid response|returned no content/i.test(message)) {
    return new EvidenceAnalysisError("output_invalid");
  }
  return new EvidenceAnalysisError("provider_unavailable");
}

export async function runValidatedProviderCall<T>(input: {
  call(validationError: string, signal: AbortSignal): Promise<unknown>;
  parse(value: unknown): T;
  timeoutMs: number;
  retryDelayMs: number;
}): Promise<{ value: T; attemptCount: number }> {
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1) {
    throw new Error("Analysis timeout must be a positive integer");
  }
  if (!Number.isSafeInteger(input.retryDelayMs) || input.retryDelayMs < 0) {
    throw new Error("Analysis retry delay must be a non-negative integer");
  }
  let validationError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let raw: unknown;
    try {
      raw = await input.call(validationError, AbortSignal.timeout(input.timeoutMs));
    } catch (error) {
      const failure = classified(error);
      const retryable = failure.code === "provider_unavailable"
        || failure.code === "provider_timeout"
        || failure.code === "output_invalid";
      if (!retryable || attempt === 3) throw failure;
      if (failure.code === "output_invalid") validationError = failure.message;
      if (input.retryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, input.retryDelayMs * attempt));
      }
      continue;
    }
    try {
      return { value: input.parse(raw), attemptCount: attempt };
    } catch (error) {
      validationError = error instanceof Error ? error.message : "Invalid analysis output";
      if (attempt === 3) throw new EvidenceAnalysisError("output_invalid");
    }
  }
  throw new EvidenceAnalysisError("output_invalid");
}

export async function mapBounded<T, R>(
  items: readonly T[],
  concurrency: number,
  operation: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("Bounded map concurrency must be a positive integer");
  }
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await operation(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
