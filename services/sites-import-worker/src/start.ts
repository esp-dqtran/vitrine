export interface SitesImportWorkerStartupDependencies {
  assertMigrations(): Promise<void>;
  assertObjectStorage(): Promise<void>;
  consume(): Promise<void>;
}

export const DEFAULT_SITES_CRAWL_TIMEOUT_MS = 180_000;

export function sitesCrawlTimeoutMs(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_SITES_CRAWL_TIMEOUT_MS;
  }
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000) {
    throw new Error("SITES_CRAWL_TIMEOUT_MS must be an integer of at least 1000");
  }
  return timeoutMs;
}

export async function runSitesCrawlWithTimeout<T>(
  run: () => Promise<T>,
  close: () => Promise<void>,
  timeoutMs: number,
): Promise<T> {
  let timedOut = false;
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      void close().catch(() => undefined);
      reject(new Error(`Sites crawl timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve().then(run), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    if (!timedOut) await close();
  }
}

export async function startSitesImportWorker(
  dependencies: SitesImportWorkerStartupDependencies,
): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.assertObjectStorage();
  await dependencies.consume();
}
