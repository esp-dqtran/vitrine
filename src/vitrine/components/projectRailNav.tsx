import {
  BookIcon,
  BookmarkHollowIcon,
  CogIcon,
  FolderIcon,
  GridIcon,
  SparkleIcon,
} from '@storybook/icons';

import type { ResearchProjectIcon, ResearchProjectSummary } from '../../researchProject.ts';
import { navigate } from '../router.ts';
import type { WorkspaceRailAction } from './WorkspaceChrome.tsx';
import type { ProjectWorkspaceArea } from './ProjectWorkspaceNav.tsx';

/*
 * One definition of the project tree, shared by the Projects index and the
 * project workspace. Built here rather than per page so the rail does not
 * change shape as you move between them — stepping into a project should
 * expand a row, not swap the navigation out.
 */

/* The project's own glyph at row size — the page hero's mark is a 56px box,
   which is four times a rail row. */
export function projectGlyph(icon: ResearchProjectIcon, title: string) {
  if (icon === 'folder') return <FolderIcon aria-hidden="true" />;
  if (icon === 'grid') return <GridIcon aria-hidden="true" />;
  if (icon === 'book') return <BookIcon aria-hidden="true" />;
  if (icon === 'sparkle') return <SparkleIcon aria-hidden="true" />;
  return <span aria-hidden="true">{title.trim().charAt(0).toUpperCase() || 'P'}</span>;
}

export interface ProjectRailNavInput {
  projects: ResearchProjectSummary[];
  /* The project being viewed, if any. It is the only expanded row: opening
     another navigates to it, which expands it, so there is no collapse state
     to persist or to fall out of sync with the route. */
  openProjectId?: string;
  area?: ProjectWorkspaceArea;
  /* True on the Projects index, where the header row is the destination. */
  projectsActive?: boolean;
  onOpenProjects: () => void;
}

export function projectRailNav({
  projects,
  openProjectId,
  area,
  projectsActive = false,
  onOpenProjects,
}: ProjectRailNavInput): WorkspaceRailAction[] {
  return [
    {
      label: 'Projects',
      icon: <FolderIcon aria-hidden="true" />,
      active: projectsActive,
      expanded: true,
      onSelect: onOpenProjects,
      children: projects.map((project) => {
        const projectId = String(project.id);
        const isOpen = projectId === openProjectId;
        return {
          label: project.title,
          icon: (
            <span className="projects-workspace__desktop-row-glyph">
              {projectGlyph(project.icon ?? 'initial', project.title)}
            </span>
          ),
          active: isOpen,
          expanded: isOpen,
          onSelect: () => navigate({ name: 'project', projectId }),
          /* Settings is the project's own cog, not a third area row — it edits
             the project rather than opening one of its file areas. */
          trailing: isOpen ? (
            <button
              type="button"
              className="projects-workspace__desktop-row-action"
              aria-label={`${project.title} settings`}
              onClick={() => navigate({ name: 'project-settings', projectId })}
            >
              <CogIcon aria-hidden="true" />
            </button>
          ) : undefined,
          children: isOpen
            ? [
                {
                  label: 'Canvas',
                  icon: <GridIcon aria-hidden="true" />,
                  active: area === 'canvas',
                  onSelect: () => navigate({ name: 'project', projectId }),
                },
                {
                  label: 'Documents',
                  icon: <BookIcon aria-hidden="true" />,
                  active: area === 'documents',
                  onSelect: () => navigate({ name: 'project-documents', projectId }),
                },
              ]
            : undefined,
        };
      }),
    },
    {
      label: 'Collections',
      icon: <BookmarkHollowIcon aria-hidden="true" />,
      onSelect: () => navigate({ name: 'collections' }),
    },
  ];
}
