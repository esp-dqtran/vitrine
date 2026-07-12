export interface ImportWorkerStartupDependencies {
  assertMigrations(): Promise<void>;
  assertObjectStorage(): Promise<void>;
  consume(): Promise<void>;
}

export async function startImportWorker(
  dependencies: ImportWorkerStartupDependencies,
): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.assertObjectStorage();
  await dependencies.consume();
}
