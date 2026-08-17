import { Spinner } from "./Spinner.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  Heading,
  Icon,
  IconButton,
  Selector,
  Text,
  TextInput,
} from "@astryxdesign/core";
import {
  BellIcon,
  BookIcon,
  BookmarkHollowIcon,
  CogIcon,
  FolderIcon,
  GlobeIcon,
  GridIcon,
  MenuIcon,
  PlusIcon,
  QuestionIcon,
  SparkleIcon,
  UserIcon,
} from "@storybook/icons";
import { AstryxModal } from "./AstryxModal.tsx";
import type {
  CreateResearchProjectInput,
  ResearchProjectSummary,
} from "../../researchProject.ts";
import type { ResearchCollection } from "../../db.ts";
import {
  createResearchProject,
  deleteResearchProject,
  duplicateResearchProject,
  listResearchProjects,
  updateResearchProject,
} from "../researchProjectsApi.ts";
import { navigate } from "../router.ts";
import { listCollections } from "../researchApi.ts";
import { DiscoveryCard } from "./DiscoveryCard.tsx";
import {
  addTeamMember,
  listTeamMembers,
  removeTeamMember,
  type TeamMember,
  type TeamSummary,
} from "../organizationsApi.ts";
import { ProjectAccessDialog } from "./ProjectAccessDialog.tsx";
import { projectRailNav } from "./projectRailNav.tsx";
import {
  ProjectsWorkspaceProvider,
  useProjectsWorkspace,
  useWorkspaceChrome,
} from "./WorkspaceChromeContext.tsx";

export type ProjectSort = "updated" | "name";
export type TeamSection = "projects" | "people" | "settings";

export interface ProjectActions {
  open(projectId: string): void;
  create(input: CreateResearchProjectInput): Promise<void>;
  rename(project: ResearchProjectSummary, title: string): Promise<void>;
  setPinned(project: ResearchProjectSummary, pinned: boolean): Promise<void>;
  duplicate(projectId: string): Promise<void>;
  remove(projectId: string): Promise<void>;
}

export function FirstProjectGuide({
  onCreate,
  onBrowse,
}: {
  onCreate: () => void;
  onBrowse: () => void;
}) {
  return (
    <section
      className="first-project-guide"
      aria-labelledby="first-project-guide-title"
    >
      <div className="first-project-guide__intro">
        <span>
          <SparkleIcon aria-hidden="true" /> First project
        </span>
        <Heading level={2} id="first-project-guide-title">
          Turn product evidence into a decision
        </Heading>
        <Text color="secondary">
          Start with a question, collect real product evidence, then shape it
          into a visual decision or reviewable requirement.
        </Text>
      </div>
      <ol className="first-project-guide__steps">
        <li>
          <span>1</span>
          <div>
            <strong>Create a project</strong>
            <small>
              Name the product question or decision you are exploring.
            </small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Save evidence</strong>
            <small>
              Browse Apps, Sites, and Flows and add useful references.
            </small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Decide and hand off</strong>
            <small>
              Compare on Canvas or write a requirement, request review, and
              approve the outcome.
            </small>
          </div>
        </li>
      </ol>
      <div className="first-project-guide__actions">
        <Button
          variant="primary"
          label="Create first project"
          clickAction={onCreate}
        />
        <Button
          variant="secondary"
          label="Browse Apps first"
          clickAction={onBrowse}
        />
      </div>
    </section>
  );
}

export function CreateProjectDialog({
  isOpen,
  title,
  scope,
  teams,
  isCreating,
  onTitleChange,
  onScopeChange,
  onCancel,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  scope: string;
  teams: TeamSummary[];
  isCreating: boolean;
  onTitleChange(value: string): void;
  onScopeChange(value: string): void;
  onCancel(): void;
  onSubmit(): void;
}) {
  return (
    <AstryxModal
      className="projects-workspace__modal"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      purpose="form"
      width={460}
    >
      <form
        className="projects-workspace__dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <Heading level={3}>New project</Heading>
          <Text color="secondary">
            Start with a name. Add modules, flows, and design context when you
            open it.
          </Text>
        </div>
        <TextInput
          label="Project name"
          placeholder="e.g. Personal finance app"
          value={title}
          onChange={onTitleChange}
          autoFocus
          width="100%"
          isDisabled={isCreating}
        />
        {teams.length > 0 && (
          <Selector
            label="Team"
            value={scope}
            onChange={onScopeChange}
            options={[
              { value: "personal", label: "Personal" },
              ...teams.map((team) => ({
                value: String(team.id),
                label: team.name,
              })),
            ]}
            width="100%"
            isDisabled={isCreating}
          />
        )}
        <div className="projects-workspace__dialog-actions">
          <Button
            label="Cancel"
            variant="ghost"
            isDisabled={isCreating}
            clickAction={onCancel}
          />
          <Button
            label="Create project"
            variant="primary"
            isDisabled={!title.trim()}
            isLoading={isCreating}
            clickAction={onSubmit}
          />
        </div>
      </form>
    </AstryxModal>
  );
}

export function RenameProjectDialog({
  project,
  title,
  isRenaming,
  onTitleChange,
  onCancel,
  onSubmit,
}: {
  project: ResearchProjectSummary | null;
  title: string;
  isRenaming: boolean;
  onTitleChange(value: string): void;
  onCancel(): void;
  onSubmit(): void;
}) {
  return (
    <AstryxModal
      className="projects-workspace__modal"
      isOpen={Boolean(project)}
      onOpenChange={(open) => {
        if (!open && !isRenaming) onCancel();
      }}
      purpose="form"
      width={460}
    >
      <form
        className="projects-workspace__dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Heading level={3}>Rename project</Heading>
        <TextInput
          label="Project name"
          value={title}
          onChange={onTitleChange}
          autoFocus
          width="100%"
          isDisabled={isRenaming}
        />
        <div className="projects-workspace__dialog-actions">
          <Button
            label="Cancel"
            variant="ghost"
            isDisabled={isRenaming}
            clickAction={onCancel}
          />
          <Button
            label="Save"
            variant="primary"
            isDisabled={!title.trim()}
            isLoading={isRenaming}
            clickAction={onSubmit}
          />
        </div>
      </form>
    </AstryxModal>
  );
}

export function DeleteProjectDialog({
  project,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  project: ResearchProjectSummary | null;
  isDeleting: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <AstryxModal
      className="projects-workspace__modal"
      isOpen={Boolean(project)}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onCancel();
      }}
      purpose="form"
      width={440}
    >
      <div className="projects-workspace__dialog">
        <div>
          <Heading level={3}>Delete project?</Heading>
          <Text color="secondary">
            {project
              ? `“${project.title}” and everything inside it will be permanently deleted.`
              : ""}
          </Text>
        </div>
        <div className="projects-workspace__dialog-actions">
          <Button
            label="Cancel"
            variant="ghost"
            isDisabled={isDeleting}
            clickAction={onCancel}
          />
          <Button
            label="Delete project"
            variant="destructive"
            isLoading={isDeleting}
            clickAction={onConfirm}
          />
        </div>
      </div>
    </AstryxModal>
  );
}

export function sortProjects(
  projects: ResearchProjectSummary[],
  sort: ProjectSort,
): ResearchProjectSummary[] {
  return [...projects].sort((left, right) =>
    sort === "name"
      ? left.title.localeCompare(right.title)
      : Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

function formatUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return "";
  const elapsedDays = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (elapsedDays <= 0) return "Updated today";
  if (elapsedDays === 1) return "Updated yesterday";
  if (elapsedDays < 7) return `Updated ${elapsedDays} days ago`;
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(timestamp).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(timestamp)}`;
}

function projectCardIcon(project: ResearchProjectSummary) {
  if (project.icon === "folder") return <FolderIcon aria-hidden="true" />;
  if (project.icon === "grid") return <GridIcon aria-hidden="true" />;
  if (project.icon === "book") return <BookIcon aria-hidden="true" />;
  if (project.icon === "sparkle") return <SparkleIcon aria-hidden="true" />;
  return project.title.trim().charAt(0).toLocaleUpperCase() || "P";
}

function formatMemberDate(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function ProjectCard({
  project,
  actions,
  onRename,
  onDelete,
  onShare,
}: {
  project: ResearchProjectSummary;
  actions: ProjectActions;
  onRename(project: ResearchProjectSummary): void;
  onDelete(project: ResearchProjectSummary): void;
  onShare(project: ResearchProjectSummary): void;
}) {
  const actionMenuRef = useRef<HTMLDetailsElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const canEdit = project.access?.role !== "viewer";
  const canManage =
    project.access?.canManage ??
    (!project.organization ||
      project.organization.role === "owner" ||
      project.organization.role === "admin");

  useEffect(() => {
    if (!actionMenuOpen) return undefined;
    const closeFromOutside = (event: PointerEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node))
        setActionMenuOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActionMenuOpen(false);
      actionMenuRef.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [actionMenuOpen]);

  const runAction = (action: () => void) => {
    setActionMenuOpen(false);
    action();
  };

  return (
    <div className="project-discovery-card">
      <DiscoveryCard
        kind="app"
        ariaLabel={`Open ${project.title}`}
        onOpen={() => actions.open(project.id)}
        articleProps={{ "data-project-card": "true" }}
        media={
          <span className="project-discovery-card__cover" aria-hidden="true">
            <span className="project-discovery-card__window">
              <span className="project-discovery-card__topbar" />
              <span className="project-discovery-card__sidebar" />
              <span className="project-discovery-card__panel project-discovery-card__panel--primary" />
              <span className="project-discovery-card__panel project-discovery-card__panel--secondary" />
              <span className="project-discovery-card__panel project-discovery-card__panel--tertiary" />
            </span>
          </span>
        }
        logo={projectCardIcon(project)}
        title={project.title}
        description={
          project.question || "Add modules and flows inside this project"
        }
        metadata={`${project.organization?.name ? `${project.organization.name} · ` : ""}${formatUpdatedAt(project.updatedAt)}`}
      />
      <div className="project-discovery-card__actions">
        {canEdit ? (
          <IconButton
            label={
              project.pinned ? `Unpin ${project.title}` : `Pin ${project.title}`
            }
            icon={<span aria-hidden="true">{project.pinned ? "★" : "☆"}</span>}
            variant="ghost"
            size="sm"
            clickAction={() => actions.setPinned(project, !project.pinned)}
          />
        ) : null}
        <details
          ref={actionMenuRef}
          className="projects-workspace__menu"
          open={actionMenuOpen}
          onToggle={(event) => setActionMenuOpen(event.currentTarget.open)}
        >
          <summary
            aria-label={`More actions for ${project.title}`}
            aria-haspopup="menu"
          >
            <Icon icon="moreHorizontal" size="md" />
          </summary>
          <div
            className="projects-workspace__menu-popover"
            role="menu"
            aria-label={`Actions for ${project.title}`}
          >
            <Button
              label="Share"
              role="menuitem"
              variant="ghost"
              size="sm"
              clickAction={() => runAction(() => onShare(project))}
            />
            {canEdit ? (
              <Button
                label="Rename"
                role="menuitem"
                variant="ghost"
                size="sm"
                clickAction={() => runAction(() => onRename(project))}
              />
            ) : null}
            {canEdit ? (
              <Button
                label="Duplicate"
                role="menuitem"
                variant="ghost"
                size="sm"
                clickAction={() =>
                  runAction(() => actions.duplicate(project.id))
                }
              />
            ) : null}
            {canManage && (
              <Button
                label="Delete"
                role="menuitem"
                variant="ghost"
                size="sm"
                className="projects-workspace__menu-danger"
                clickAction={() => runAction(() => onDelete(project))}
              />
            )}
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
  onShare,
}: {
  title: string;
  projects: ResearchProjectSummary[];
  actions: ProjectActions;
  onRename(project: ResearchProjectSummary): void;
  onDelete(project: ResearchProjectSummary): void;
  onShare(project: ResearchProjectSummary): void;
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
            onShare={onShare}
          />
        ))}
      </div>
    </section>
  );
}

interface ResearchProjectsViewProps {
  projects: ResearchProjectSummary[];
  collections?: ResearchCollection[];
  teams?: TeamSummary[];
  loading: boolean;
  error: string;
  actions: ProjectActions;
}

function ResearchProjectsViewContent({
  projects,
  collections = [],
  teams = [],
  loading,
  error,
  actions,
}: ResearchProjectsViewProps) {
  const projectsWorkspace = useProjectsWorkspace();
  if (!projectsWorkspace) {
    throw new Error("ResearchProjectsView requires ProjectsWorkspaceProvider");
  }
  const {
    teams: teamOptions,
    selectedTeamId,
    setTeams: setTeamOptions,
  } = projectsWorkspace;
  const [section, setSection] = useState<TeamSection>("projects");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectScope, setNewProjectScope] = useState("personal");
  const [creating, setCreating] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");
  const [memberBusy, setMemberBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renameProject, setRenameProject] =
    useState<ResearchProjectSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteProject, setDeleteProject] =
    useState<ResearchProjectSummary | null>(null);
  const [shareProject, setShareProject] =
    useState<ResearchProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (teams.length) setTeamOptions(teams);
  }, [setTeamOptions, teams]);

  useEffect(() => {
    setSection("projects");
    setNewProjectScope(selectedTeamId ? String(selectedTeamId) : "personal");
  }, [selectedTeamId]);

  const selectedTeam = teamOptions.find(({ id }) => id === selectedTeamId);
  const canManageTeam =
    selectedTeam?.role === "owner" || selectedTeam?.role === "admin";
  const scopedProjects = useMemo(
    () =>
      projects.filter((project) =>
        selectedTeamId
          ? project.organization?.id === selectedTeamId
          : !project.organization,
      ),
    [projects, selectedTeamId],
  );
  const visibleProjects = useMemo(
    () => sortProjects(scopedProjects, "updated"),
    [scopedProjects],
  );
  const pinnedProjects = visibleProjects.filter(({ pinned }) => pinned);
  const otherProjects = visibleProjects.filter(({ pinned }) => !pinned);
  const visibleMembers = members.filter(({ email }) =>
    email.toLowerCase().includes(memberSearch.trim().toLowerCase()),
  );
  const adminCount = members.filter(
    ({ role }) => role === "owner" || role === "admin",
  ).length;

  useEffect(() => {
    if (!selectedTeamId || section === "projects") return;
    let active = true;
    setMembersLoading(true);
    setTeamError("");
    void listTeamMembers(selectedTeamId)
      .then((nextMembers) => {
        if (active) setMembers(nextMembers);
      })
      .catch((cause: Error) => {
        if (active) setTeamError(cause.message);
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTeamId, section]);

  const selectSection = (nextSection: TeamSection) => {
    setSection(nextSection);
  };
  const openWorkspaceSettings = () => {
    if (selectedTeam) {
      selectSection("settings");
      return;
    }
    navigate({ name: "settings-billing" });
  };
  const openCreate = () => {
    setNewProjectScope(selectedTeamId ? String(selectedTeamId) : "personal");
    setCreateOpen(true);
  };
  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setNewTitle("");
  };
  const submitCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      await actions.create({
        title: newTitle.trim(),
        ...(newProjectScope === "personal"
          ? {}
          : { organizationId: Number(newProjectScope) }),
      });
      setCreateOpen(false);
      setNewTitle("");
    } finally {
      setCreating(false);
    }
  };
  const submitMember = async () => {
    if (!selectedTeamId || !memberEmail.trim() || memberBusy) return;
    setMemberBusy(true);
    setTeamError("");
    try {
      const member = await addTeamMember(
        selectedTeamId,
        memberEmail.trim(),
        memberRole,
      );
      setMembers((current) => [
        ...current.filter(({ userId }) => userId !== member.userId),
        member,
      ]);
      setTeamOptions((current) =>
        current.map((team) =>
          team.id === selectedTeamId
            ? {
                ...team,
                memberCount: Math.max(team.memberCount, members.length + 1),
              }
            : team,
        ),
      );
      setMemberEmail("");
      setInviteOpen(false);
    } catch (cause) {
      setTeamError((cause as Error).message);
    } finally {
      setMemberBusy(false);
    }
  };
  const removeMember = async (member: TeamMember) => {
    if (!selectedTeamId || memberBusy || member.role === "owner") return;
    setMemberBusy(true);
    setTeamError("");
    try {
      await removeTeamMember(selectedTeamId, member.userId);
      setMembers((current) =>
        current.filter(({ userId }) => userId !== member.userId),
      );
      setTeamOptions((current) =>
        current.map((team) =>
          team.id === selectedTeamId
            ? { ...team, memberCount: Math.max(1, team.memberCount - 1) }
            : team,
        ),
      );
    } catch (cause) {
      setTeamError((cause as Error).message);
    } finally {
      setMemberBusy(false);
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

  const pageTitle =
    section === "people"
      ? "People"
      : section === "settings"
        ? "Team settings"
        : selectedTeam
          ? selectedTeam.name
          : "Personal projects";
  const pageDescription =
    section === "people"
      ? `Manage who belongs to ${selectedTeam?.name ?? "this Team"} and what they can do.`
      : section === "settings"
        ? `Team identity, ownership, and shared project defaults for ${selectedTeam?.name ?? "this Team"}.`
        : selectedTeam
          ? `Projects shared with everyone in ${selectedTeam.name}.`
          : "Private projects that only you can access until you share them.";

  useWorkspaceChrome(
    () => ({
      nav: {
        primaryLabel: "Workspace",
        primaryHeading: "Workspace",
        primaryActions: projectRailNav({
          projectsActive: section === "projects",
          onOpenProjects: () => selectSection("projects"),
        }),
        settings: {
          label: selectedTeam ? "Team settings" : "Settings",
          icon: <CogIcon aria-hidden="true" />,
          active: section === "settings",
          onSelect: openWorkspaceSettings,
        },
      },
      onBrandSelect: () => navigate({ name: "apps" }),
    }),
    [selectedTeam?.name, section],
  );

  return (
    <>
      <header className="projects-workspace__page-header">
        <div>
          <Heading level={1}>{pageTitle}</Heading>
          <Text color="secondary">{pageDescription}</Text>
        </div>
        <div className="projects-workspace__page-header-actions">
          {selectedTeam && canManageTeam ? (
            <Button
              className="projects-workspace__invite-action"
              label="Invite members"
              variant="ghost"
              icon={<UserIcon aria-hidden="true" />}
              onClick={() => setInviteOpen(true)}
            />
          ) : null}
          {section === "projects" ? (
            <Button
              variant="primary"
              label="New project"
              clickAction={openCreate}
            />
          ) : null}
        </div>
      </header>

      {error && (
        <p role="alert" className="projects-workspace__error">
          {error}
        </p>
      )}
      {teamError && (
        <p role="alert" className="projects-workspace__error">
          {teamError}
        </p>
      )}

      {section === "projects" && (
        <>
          {loading ? (
            <div className="projects-workspace__loading">
              <Spinner size="lg" />
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="projects-workspace__empty">
              {selectedTeam ? (
                <>
                  <EmptyState
                    title={`No projects in ${selectedTeam.name} yet`}
                    description="Create a shared project so the whole Team can contribute to its flows, Canvas, and Notes."
                  />
                  <Button
                    variant="primary"
                    label="New project"
                    clickAction={openCreate}
                  />
                </>
              ) : (
                <FirstProjectGuide
                  onCreate={openCreate}
                  onBrowse={() => navigate({ name: "apps" })}
                />
              )}
            </div>
          ) : (
            <div className="projects-workspace__content">
              <ProjectGrid
                title="Pinned"
                projects={pinnedProjects}
                actions={actions}
                onRename={openRename}
                onDelete={setDeleteProject}
                onShare={setShareProject}
              />
              <ProjectGrid
                title={
                  pinnedProjects.length ? "All projects" : "Recent projects"
                }
                projects={otherProjects}
                actions={actions}
                onRename={openRename}
                onDelete={setDeleteProject}
                onShare={setShareProject}
              />
            </div>
          )}
        </>
      )}

      {section === "people" && selectedTeam && (
        <div className="team-people">
          <div className="team-people__stats">
            <article>
              <span>Members</span>
              <strong>{membersLoading ? "—" : members.length}</strong>
            </article>
            <article>
              <span>Admins</span>
              <strong>{membersLoading ? "—" : adminCount}</strong>
            </article>
            <article>
              <span>Pending invites</span>
              <strong>0</strong>
            </article>
            <article>
              <span>Your role</span>
              <strong className="team-people__role">{selectedTeam.role}</strong>
            </article>
          </div>

          <div className="team-people__toolbar">
            <Heading level={2}>Members</Heading>
            <TextInput
              label="Search members"
              isLabelHidden
              placeholder="Search by email"
              value={memberSearch}
              onChange={setMemberSearch}
              width="100%"
            />
            {canManageTeam ? (
              <Button
                label="Invite members"
                variant="primary"
                clickAction={() => setInviteOpen(true)}
              />
            ) : null}
          </div>

          <section
            className="team-people__list product-data-table"
            aria-label={`${selectedTeam.name} members`}
            role="table"
          >
            <div className="team-people__list-heading" role="row">
              <strong role="columnheader">Member</strong>
              <span role="columnheader">Role</span>
              <span role="columnheader">Joined</span>
              <span aria-hidden="true" />
            </div>
            {membersLoading ? (
              <div className="team-people__loading">
                <Spinner size="md" />
              </div>
            ) : (
              visibleMembers.map((member) => (
                <div
                  className="team-people__member"
                  key={member.userId}
                  role="row"
                >
                  <span className="team-people__member-profile" role="cell">
                    <span
                      className="team-people__member-avatar"
                      aria-hidden="true"
                    >
                      {member.email.charAt(0).toUpperCase()}
                    </span>
                    <span>{member.email}</span>
                  </span>
                  <span className="team-people__role" role="cell">
                    {member.role}
                  </span>
                  <span role="cell">{formatMemberDate(member.createdAt)}</span>
                  <span role="cell">
                    {canManageTeam && member.role !== "owner" ? (
                      <Button
                        label="Remove"
                        variant="ghost"
                        size="sm"
                        isDisabled={memberBusy}
                        clickAction={() => void removeMember(member)}
                      />
                    ) : null}
                  </span>
                </div>
              ))
            )}
            {!membersLoading && visibleMembers.length === 0 && (
              <Text color="secondary">No Team members match this search.</Text>
            )}
          </section>
          <footer className="team-people__pagination">
            <span>
              Show <strong>10</strong>
            </span>
            <button type="button" disabled aria-label="Previous page">
              ‹
            </button>
            <button type="button" className="is-active" aria-current="page">
              1
            </button>
            <button type="button" disabled aria-label="Next page">
              ›
            </button>
            <span>
              Showing {visibleMembers.length ? 1 : 0} to {visibleMembers.length}{" "}
              of {visibleMembers.length}{" "}
              {visibleMembers.length === 1 ? "entry" : "entries"}
            </span>
          </footer>
        </div>
      )}

      {section === "settings" && selectedTeam && (
        <div className="team-settings-view">
          <Heading level={2}>Team profile</Heading>
          <section className="team-settings-view__card team-settings-view__card--profile">
            <div className="team-settings-view__identity">
              <span className="projects-team-rail__avatar" aria-hidden="true">
                {selectedTeam.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <Heading level={3}>{selectedTeam.name}</Heading>
                <Text color="secondary">
                  Shared Team profile for projects, flows, and documents.
                </Text>
              </div>
            </div>
            <dl>
              <div>
                <dt>Members</dt>
                <dd>{selectedTeam.memberCount}</dd>
              </div>
              <div>
                <dt>Your role</dt>
                <dd className="team-people__role">{selectedTeam.role}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatMemberDate(selectedTeam.createdAt)}</dd>
              </div>
            </dl>
          </section>
          <Heading level={2}>Project defaults</Heading>
          <section className="team-settings-view__card">
            <Heading level={3}>Project ownership</Heading>
            <Text color="secondary">
              Projects created inside this Team are available to every Team
              member. Owners and admins can manage membership and project
              access.
            </Text>
          </section>
        </div>
      )}

      <AstryxModal
        className="projects-workspace__modal projects-workspace__modal--invite"
        isOpen={inviteOpen}
        onOpenChange={(open) => {
          if (!open && !memberBusy) setInviteOpen(false);
        }}
        purpose="form"
        width={640}
      >
        <form
          className="projects-workspace__dialog projects-workspace__invite-dialog"
          onSubmit={(event) => {
            event.preventDefault();
            void submitMember();
          }}
        >
          <div className="projects-workspace__dialog-header">
            <Heading level={3}>Invite members</Heading>
          </div>
          <div className="projects-workspace__invite-note">
            <strong>Invite to {selectedTeam?.name ?? "this Team"}</strong>
            <span>
              Members can contribute to shared Projects, Flows, Canvas, and
              Documents.
            </span>
          </div>
          <div className="projects-workspace__invite-fields">
            <TextInput
              label="Email"
              placeholder="teammate@example.com"
              value={memberEmail}
              onChange={setMemberEmail}
              width="100%"
              autoFocus
              isDisabled={memberBusy}
            />
            <Selector
              label="Role"
              value={memberRole}
              onChange={(value) => setMemberRole(value as "admin" | "member")}
              options={[
                { value: "member", label: "Member" },
                { value: "admin", label: "Admin" },
              ]}
              width="100%"
              isDisabled={memberBusy}
            />
          </div>
          <div className="projects-workspace__dialog-actions">
            <Button
              label="Cancel"
              variant="ghost"
              isDisabled={memberBusy}
              clickAction={() => setInviteOpen(false)}
            />
            <Button
              label="Invite member"
              variant="primary"
              isDisabled={!memberEmail.trim()}
              isLoading={memberBusy}
              clickAction={submitMember}
            />
          </div>
        </form>
      </AstryxModal>

      <CreateProjectDialog
        isOpen={createOpen}
        title={newTitle}
        scope={newProjectScope}
        teams={teamOptions}
        isCreating={creating}
        onTitleChange={setNewTitle}
        onScopeChange={setNewProjectScope}
        onCancel={closeCreate}
        onSubmit={() => void submitCreate()}
      />

      <ProjectAccessDialog
        project={shareProject}
        isOpen={Boolean(shareProject)}
        onOpenChange={(open) => {
          if (!open) setShareProject(null);
        }}
      />

      <RenameProjectDialog
        project={renameProject}
        title={renameTitle}
        isRenaming={renaming}
        onTitleChange={setRenameTitle}
        onCancel={() => setRenameProject(null)}
        onSubmit={() => void submitRename()}
      />

      <DeleteProjectDialog
        project={deleteProject}
        isDeleting={deleting}
        onCancel={() => setDeleteProject(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

export function ResearchProjectsView(props: ResearchProjectsViewProps) {
  const projectsWorkspace = useProjectsWorkspace();
  if (projectsWorkspace) return <ResearchProjectsViewContent {...props} />;

  return (
    <ProjectsWorkspaceProvider initialTeams={props.teams}>
      <ResearchProjectsViewContent {...props} />
    </ProjectsWorkspaceProvider>
  );
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<ResearchProjectSummary[]>([]);
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [nextProjects, nextCollections] = await Promise.all([
        listResearchProjects(),
        listCollections().catch(() => []),
      ]);
      setProjects(nextProjects);
      setCollections(nextCollections);
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAndRefresh = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
      throw cause;
    }
  };

  return (
    <ResearchProjectsView
      projects={projects}
      collections={collections}
      loading={loading}
      error={error}
      actions={{
        open: (projectId) => navigate({ name: "project", projectId }),
        create: async (input) => {
          const project = await createResearchProject(input);
          navigate({ name: "project", projectId: project.id });
        },
        rename: (project, title) =>
          runAndRefresh(() =>
            updateResearchProject(project.id, project.revision, { title }),
          ),
        setPinned: (project, pinned) =>
          runAndRefresh(() =>
            updateResearchProject(project.id, project.revision, { pinned }),
          ),
        duplicate: (projectId) =>
          runAndRefresh(() => duplicateResearchProject(projectId)),
        remove: (projectId) =>
          runAndRefresh(() => deleteResearchProject(projectId)),
      }}
    />
  );
}
