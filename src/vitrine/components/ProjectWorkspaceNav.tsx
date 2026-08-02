import {
  Button,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  Text,
} from "@astryxdesign/core";

import { navigate } from "../router.ts";

export type ProjectWorkspaceArea = "overview" | "document" | "playground";

export function ProjectWorkspaceNav({
  projectId,
  active,
  title = "Designer project",
  description = "Collect references, build a moodboard, and keep project decisions together.",
}: {
  projectId: string;
  active: ProjectWorkspaceArea;
  title?: string;
  description?: string;
}) {
  const openArea = (area: string) => {
    if (area === "overview") {
      navigate({ name: "project", projectId });
      return;
    }
    if (area === "playground") {
      navigate({ name: "project-playground", projectId });
      return;
    }
    if (area === "document") {
      navigate({ name: "project-document", projectId });
      return;
    }
    navigate({ name: "project-playground", projectId });
  };

  return (
    <header className="project-workspace-nav" aria-label="Project workspace">
      <div className="project-workspace-nav__identity">
        <Button
          label="Back to projects"
          variant="ghost"
          size="sm"
          onClick={() => navigate({ name: "projects" })}
        />
        <div className="project-workspace-nav__title">
          <Heading level={1}>{title}</Heading>
          <Text color="secondary" size="sm">
            {description}
          </Text>
        </div>
      </div>
      <SegmentedControl
        value={active}
        onChange={openArea}
        label="Project area"
        size="md"
        layout="fill"
        className="project-workspace-nav__areas"
      >
        <SegmentedControlItem value="overview" label="Overview" />
        <SegmentedControlItem value="document" label="Document" />
        <SegmentedControlItem value="playground" label="Playground" />
      </SegmentedControl>
    </header>
  );
}
