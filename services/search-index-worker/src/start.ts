import type { SearchIndexJob } from "../../../src/searchIndexStore.ts";

export async function startSearchIndexWorker(input: {
  assertMigrations(): Promise<void>;
  run(): Promise<void>;
}): Promise<void> {
  await input.assertMigrations();
  await input.run();
}

export async function runSearchIndexLoop(input: {
  signal: AbortSignal;
  claim(): Promise<SearchIndexJob | null>;
  process(job: SearchIndexJob): Promise<void>;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  idleMilliseconds?: number;
}): Promise<void> {
  const sleep = input.sleep ?? ((milliseconds, signal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const timeout = setTimeout(resolve, milliseconds);
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    }));
  while (!input.signal.aborted) {
    const job = await input.claim();
    if (job) {
      await input.process(job);
      continue;
    }
    await sleep(input.idleMilliseconds ?? 2_000, input.signal);
  }
}
