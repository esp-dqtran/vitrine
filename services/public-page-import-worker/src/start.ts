export interface PublicPageImportWorkerStartupDependencies {
  assertMigrations(): Promise<void>;
  assertObjectStorage(): Promise<void>;
  consume(): Promise<void>;
}

export async function startPublicPageImportWorker(
  dependencies: PublicPageImportWorkerStartupDependencies,
): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.assertObjectStorage();
  await dependencies.consume();
}
