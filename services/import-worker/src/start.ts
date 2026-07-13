export interface ImportWorkerStartupDependencies {
  assertMigrations(): Promise<void>;
  assertObjectStorage(): Promise<void>;
  recoverStaleRuns(staleBefore: Date): Promise<unknown>;
  consume(): Promise<void>;
  now?(): Date;
  staleRunThresholdMs?: number;
}

export async function startImportWorker(
  dependencies: ImportWorkerStartupDependencies,
): Promise<void> {
  const threshold = dependencies.staleRunThresholdMs ?? 5 * 60_000;
  if (!Number.isFinite(threshold) || threshold <= 0) throw new Error("Stale run threshold must be positive");
  await dependencies.assertMigrations();
  await dependencies.assertObjectStorage();
  const now = dependencies.now?.() ?? new Date();
  await dependencies.recoverStaleRuns(new Date(now.getTime() - threshold));
  await dependencies.consume();
}
