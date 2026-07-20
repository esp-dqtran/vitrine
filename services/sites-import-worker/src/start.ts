export interface SitesImportWorkerStartupDependencies {
  assertMigrations(): Promise<void>;
  assertObjectStorage(): Promise<void>;
  consume(): Promise<void>;
}

export async function startSitesImportWorker(
  dependencies: SitesImportWorkerStartupDependencies,
): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.assertObjectStorage();
  await dependencies.consume();
}
