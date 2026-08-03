export interface DesignerCanvasCollaborationStartupDependencies {
  assertMigrations(): Promise<void>;
  start(): void | Promise<void>;
}

export async function startDesignerCanvasCollaboration(
  dependencies: DesignerCanvasCollaborationStartupDependencies,
): Promise<void> {
  await dependencies.assertMigrations();
  await dependencies.start();
}
