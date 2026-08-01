import { EmptyState } from "@astryxdesign/core";

import { ProjectWorkspaceNav } from "./ProjectWorkspaceNav.tsx";

export function ProjectPlayground({ projectId }: { projectId: string }) {
  return (
    <main className="vitrine-page research-project-page">
      <ProjectWorkspaceNav
        projectId={projectId}
        active="playground"
        title="Designer playground"
        description="A clean foundation for the next Astryx canvas."
      />
      <section className="project-playground-empty" aria-label="Designer playground">
        <EmptyState
          title="Canvas foundation cleared"
          description="The next canvas can now be designed directly on Astryx standards."
          headingLevel={2}
        />
      </section>
    </main>
  );
}
