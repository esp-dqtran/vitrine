export interface ProjectDocumentCollaborationStartupDependencies {
  assertMigrations(): Promise<void>;
  start(): void | Promise<void>;
}

export async function startProjectDocumentCollaboration(
  dependencies: ProjectDocumentCollaborationStartupDependencies,
): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.start();
}
