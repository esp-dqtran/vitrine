import {
  BookIcon,
  BookmarkHollowIcon,
  CategoryIcon,
  FolderIcon,
  GridIcon,
  SparkleIcon,
} from "@storybook/icons";

import type { ResearchProjectIcon } from "../../researchProject.ts";
import { navigate } from "../router.ts";
import type { WorkspaceRailAction } from "./WorkspaceChrome.tsx";

/* The global rail is intentionally flat. A project has its own Canvas,
   Documents, and Settings navigation in the page header; forcing those paths
   into an 80px app rail was the source of the awkward flyout. */

/* The project's own glyph at row size — the page hero's mark is a 56px box,
   which is four times a rail row. */
export function projectGlyph(icon: ResearchProjectIcon, title: string) {
  if (icon === "folder") return <FolderIcon aria-hidden="true" />;
  if (icon === "grid") return <GridIcon aria-hidden="true" />;
  if (icon === "book") return <BookIcon aria-hidden="true" />;
  if (icon === "sparkle") return <SparkleIcon aria-hidden="true" />;
  return (
    <span aria-hidden="true">
      {title.trim().charAt(0).toUpperCase() || "P"}
    </span>
  );
}

export interface ProjectRailNavInput {
  /* True on the Projects index, where the header row is the destination. */
  projectsActive?: boolean;
  /* True while viewing the collections workspace or a collection inside it. */
  collectionsActive?: boolean;
  onOpenProjects: () => void;
}

export function projectRailNav({
  projectsActive = false,
  collectionsActive = false,
  onOpenProjects,
}: ProjectRailNavInput): WorkspaceRailAction[] {
  return [
    {
      label: "Projects",
      icon: <CategoryIcon aria-hidden="true" />,
      active: projectsActive,
      onSelect: onOpenProjects,
    },
    {
      label: "Collections",
      icon: <BookmarkHollowIcon aria-hidden="true" />,
      active: collectionsActive,
      onSelect: () => navigate({ name: "collections" }),
    },
  ];
}
