import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  Heading,
  Icon,
  IconButton,
  Spinner,
  Text,
  TextInput,
} from '@astryxdesign/core';
import { AstryxModal } from './AstryxModal.tsx';
import type { CreateResearchProjectInput, ResearchProjectSummary } from '../../researchProject.ts';
import {
  createResearchProject,
  deleteResearchProject,
  duplicateResearchProject,
  listResearchProjects,
  updateResearchProject,
} from '../researchProjectsApi.ts';
import { navigate } from '../router.ts';
import { DiscoveryCard } from './DiscoveryCard.tsx';
import { DiscoverySortDropdown } from './AppsFilterBar.tsx';
import { PageHeader } from './PageHeader.tsx';

export type ProjectSort = 'updated' | 'name';

export interface ProjectActions {
  open(projectId: string): void;
  create(input: CreateResearchProjectInput): Promise<void>;
  rename(project: ResearchProjectSummary, title: string): Promise<void>;
  setPinned(project: ResearchProjectSummary, pinned: boolean): Promise<void>;
  duplicate(projectId: string): Promise<void>;
  remove(projectId: string): Promise<void>;
}

export function sortProjects(
  projects: ResearchProjectSummary[],
  sort: ProjectSort,
): ResearchProjectSummary[] {
  return [...projects].sort((left, right) => sort === 'name'
    ? left.title.localeCompare(right.title)
    : Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function formatUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return '';
  const elapsedDays = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (elapsedDays <= 0) return 'Updated today';
  if (elapsedDays === 1) return 'Updated yesterday';
  if (elapsedDays < 7) return `Updated ${elapsedDays} days ago`;
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(timestamp)}`;
}

function ProjectCard({
  project,
  actions,
  onRename,
  onDelete,
}: {
  project: ResearchProjectSummary;
  actions: ProjectActions;
  onRename(project: ResearchProjectSummary): void;
  onDelete(project: ResearchProjectSummary): void;
}) {
  const projectInitial = project.title.trim().charAt(0).toLocaleUpperCase() || 'P';
  return (
    <div className="project-discovery-card">
      <DiscoveryCard
        kind="app"
        ariaLabel={`Open ${project.title}`}
        onOpen={() => actions.open(project.id)}
        articleProps={{ 'data-project-card': 'true' }}
        media={(
          <span className="project-discovery-card__cover" aria-hidden="true">
            <span className="project-discovery-card__window">
              <span className="project-discovery-card__topbar" />
              <span className="project-discovery-card__sidebar" />
              <span className="project-discovery-card__panel project-discovery-card__panel--primary" />
              <span className="project-discovery-card__panel project-discovery-card__panel--secondary" />
              <span className="project-discovery-card__panel project-discovery-card__panel--tertiary" />
            </span>
          </span>
        )}
        logo={projectInitial}
        title={project.title}
        description={project.question || 'Add modules and flows inside this project'}
        metadata={formatUpdatedAt(project.updatedAt)}
      />
      <div className="project-discovery-card__actions">
        <IconButton
          label={project.pinned ? `Unpin ${project.title}` : `Pin ${project.title}`}
          icon={<span aria-hidden="true">{project.pinned ? '★' : '☆'}</span>}
          variant="ghost"
          size="sm"
          clickAction={() => actions.setPinned(project, !project.pinned)}
        />
        <details className="projects-workspace__menu">
          <summary aria-label={`More actions for ${project.title}`}>
            <Icon icon="moreHorizontal" size="md" />
          </summary>
          <div className="projects-workspace__menu-popover">
            <Button label="Rename" variant="ghost" size="sm" clickAction={() => onRename(project)} />
            <Button label="Duplicate" variant="ghost" size="sm" clickAction={() => actions.duplicate(project.id)} />
            <Button
              label="Delete"
              variant="ghost"
              size="sm"
              className="projects-workspace__menu-danger"
              clickAction={() => onDelete(project)}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

function ProjectGrid({
  title,
  projects,
  actions,
  onRename,
  onDelete,
}: {
  title: string;
  projects: ResearchProjectSummary[];
  actions: ProjectActions;
  onRename(project: ResearchProjectSummary): void;
  onDelete(project: ResearchProjectSummary): void;
}) {
  if (!projects.length) return null;
  return (
    <section className="projects-workspace__section">
      <div className="projects-workspace__section-heading">
        <Heading level={2}>{title}</Heading>
        <span>{projects.length}</span>
      </div>
      <div className="projects-workspace__grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            actions={actions}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

export function ResearchProjectsView({ projects, loading, error, actions }: {
  projects: ResearchProjectSummary[];
  loading: boolean;
  error: string;
  actions: ProjectActions;
}) {
  const [sort, setSort] = useState<ProjectSort>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameProject, setRenameProject] = useState<ResearchProjectSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteProject, setDeleteProject] = useState<ResearchProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleProjects = useMemo(
    () => sortProjects(projects, sort),
    [projects, sort],
  );
  const pinnedProjects = visibleProjects.filter(({ pinned }) => pinned);
  const otherProjects = visibleProjects.filter(({ pinned }) => !pinned);

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setNewTitle('');
  };
  const submitCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      await actions.create({ title: newTitle.trim() });
      setCreateOpen(false);
      setNewTitle('');
    } finally {
      setCreating(false);
    }
  };
  const openRename = (project: ResearchProjectSummary) => {
    setRenameProject(project);
    setRenameTitle(project.title);
  };
  const submitRename = async () => {
    if (!renameProject || !renameTitle.trim() || renaming) return;
    setRenaming(true);
    try {
      await actions.rename(renameProject, renameTitle.trim());
      setRenameProject(null);
    } finally {
      setRenaming(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteProject || deleting) return;
    setDeleting(true);
    try {
      await actions.remove(deleteProject.id);
      setDeleteProject(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="vitrine-page projects-workspace">
      <PageHeader
        title="Projects"
        description="A personal workspace for the applications, modules, and flows you are designing."
        action={(
          <Button
            variant="primary"
            label="New project"
            clickAction={() => setCreateOpen(true)}
          />
        )}
      />

      <div className="projects-workspace__toolbar">
        <DiscoverySortDropdown
          value={sort}
          open={sortOpen}
          onOpenChange={setSortOpen}
          onChange={(value) => setSort(value as ProjectSort)}
          options={[
            { value: 'updated', label: 'Last updated' },
            { value: 'name', label: 'Name' },
          ]}
        />
      </div>

      {error && <p role="alert" className="projects-workspace__error">{error}</p>}
      {loading ? (
        <div className="projects-workspace__loading"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <div className="projects-workspace__empty">
          <EmptyState
            title="Create your first project"
            description="Give your application idea a home. You can shape its modules and flows when you open it."
          />
          <Button variant="primary" label="New project" clickAction={() => setCreateOpen(true)} />
        </div>
      ) : (
        <div className="projects-workspace__content">
          <ProjectGrid title="Pinned" projects={pinnedProjects} actions={actions} onRename={openRename} onDelete={setDeleteProject} />
          <ProjectGrid title={pinnedProjects.length ? 'All projects' : 'Recent projects'} projects={otherProjects} actions={actions} onRename={openRename} onDelete={setDeleteProject} />
        </div>
      )}

      <AstryxModal isOpen={createOpen} onOpenChange={(open) => { if (!open) closeCreate(); }} purpose="form" width={460}>
        <form className="projects-workspace__dialog" onSubmit={(event) => { event.preventDefault(); void submitCreate(); }}>
          <div>
            <Heading level={3}>New project</Heading>
            <Text color="secondary">Start with a name. Add modules, flows, and design context when you open it.</Text>
          </div>
          <TextInput
            label="Project name"
            placeholder="e.g. Personal finance app"
            value={newTitle}
            onChange={setNewTitle}
            autoFocus
            width="100%"
            isDisabled={creating}
          />
          <div className="projects-workspace__dialog-actions">
            <Button label="Cancel" variant="ghost" isDisabled={creating} clickAction={closeCreate} />
            <Button label="Create project" variant="primary" isDisabled={!newTitle.trim()} isLoading={creating} clickAction={submitCreate} />
          </div>
        </form>
      </AstryxModal>

      <AstryxModal isOpen={Boolean(renameProject)} onOpenChange={(open) => { if (!open && !renaming) setRenameProject(null); }} purpose="form" width={460}>
        <form className="projects-workspace__dialog" onSubmit={(event) => { event.preventDefault(); void submitRename(); }}>
          <Heading level={3}>Rename project</Heading>
          <TextInput
            label="Project name"
            value={renameTitle}
            onChange={setRenameTitle}
            autoFocus
            width="100%"
            isDisabled={renaming}
          />
          <div className="projects-workspace__dialog-actions">
            <Button label="Cancel" variant="ghost" isDisabled={renaming} clickAction={() => setRenameProject(null)} />
            <Button label="Save" variant="primary" isDisabled={!renameTitle.trim()} isLoading={renaming} clickAction={submitRename} />
          </div>
        </form>
      </AstryxModal>

      <AstryxModal isOpen={Boolean(deleteProject)} onOpenChange={(open) => { if (!open && !deleting) setDeleteProject(null); }} purpose="form" width={440}>
        <div className="projects-workspace__dialog">
          <div>
            <Heading level={3}>Delete project?</Heading>
            <Text color="secondary">
              {deleteProject ? `“${deleteProject.title}” and everything inside it will be permanently deleted.` : ''}
            </Text>
          </div>
          <div className="projects-workspace__dialog-actions">
            <Button label="Cancel" variant="ghost" isDisabled={deleting} clickAction={() => setDeleteProject(null)} />
            <Button label="Delete project" variant="destructive" isLoading={deleting} clickAction={confirmDelete} />
          </div>
        </div>
      </AstryxModal>
    </main>
  );
}

export function ResearchProjectsPage() {
  const [projects, setProjects] = useState<ResearchProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setProjects(await listResearchProjects());
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const runAndRefresh = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
      throw cause;
    }
  };

  return <ResearchProjectsView projects={projects} loading={loading} error={error} actions={{
    open: (projectId) => navigate({ name: 'project', projectId }),
    create: async (input) => {
      const project = await createResearchProject(input);
      navigate({ name: 'project', projectId: project.id });
    },
    rename: (project, title) => runAndRefresh(
      () => updateResearchProject(project.id, project.revision, { title }),
    ),
    setPinned: (project, pinned) => runAndRefresh(
      () => updateResearchProject(project.id, project.revision, { pinned }),
    ),
    duplicate: (projectId) => runAndRefresh(() => duplicateResearchProject(projectId)),
    remove: (projectId) => runAndRefresh(() => deleteResearchProject(projectId)),
  }} />;
}
