export interface ApiStartupDependencies {
  assertMigrations(): Promise<void>;
  start(): void | Promise<void>;
}

export async function startApi(dependencies: ApiStartupDependencies): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.start();
}
