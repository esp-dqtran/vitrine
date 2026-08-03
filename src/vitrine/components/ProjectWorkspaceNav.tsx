import { ToggleButton } from "@astryxdesign/core";

import { navigate } from "../router.ts";
import { useSlidingIndicator } from "../useSlidingIndicator.ts";

export type ProjectWorkspaceArea = "canvas" | "documents" | "settings";

export function ProjectWorkspaceNav({
  projectId,
  active,
}: {
  projectId: string;
  active: ProjectWorkspaceArea;
  title?: string;
  description?: string;
}) {
  const { indicatorRef, registerItem } = useSlidingIndicator(active);

  const openArea = (area: ProjectWorkspaceArea) => {
    if (area === "canvas") navigate({ name: "project", projectId });
    else if (area === "documents")
      navigate({ name: "project-documents", projectId });
    else navigate({ name: "project-settings", projectId });
  };

  return (
    <nav className="project-area-nav" role="tablist" aria-label="Project files">
      <ToggleButton
        ref={registerItem("canvas")}
        label="Canvas"
        isPressed={active === "canvas"}
        onPressedChange={() => openArea("canvas")}
        role="tab"
        aria-pressed={undefined}
        aria-selected={active === "canvas"}
        size="sm"
      />
      <ToggleButton
        ref={registerItem("documents")}
        label="Documents"
        isPressed={active === "documents"}
        onPressedChange={() => openArea("documents")}
        role="tab"
        aria-pressed={undefined}
        aria-selected={active === "documents"}
        size="sm"
      />
      <ToggleButton
        ref={registerItem("settings")}
        label="Settings"
        isPressed={active === "settings"}
        onPressedChange={() => openArea("settings")}
        role="tab"
        aria-pressed={undefined}
        aria-selected={active === "settings"}
        size="sm"
      />
      <div ref={indicatorRef} className="project-area-nav__indicator" />
    </nav>
  );
}
