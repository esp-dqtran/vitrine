import { Spinner } from './Spinner.tsx';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Heading,
  Icon,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
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
  QuestionIcon,
  SparkleIcon,
  UserIcon,
} from "@storybook/icons";

import type { DesignerCanvasFileSummary } from "../../designerCanvas.ts";
import type {
  ResearchProjectIcon,
  ResearchProjectWorkspace,
} from "../../researchProject.ts";
import {
  createDesignerCanvas,
  listDesignerCanvases,
} from "../designerCanvasApi.ts";
import {
  createProjectDocument,
  listProjectDocuments,
  type ProjectDocumentIcon,
  type ProjectDocumentView,
} from "../projectDocumentsApi.ts";
import {
  getResearchProject,
  updateResearchProject,
} from "../researchProjectsApi.ts";
import { navigate, routeToPath } from "../router.ts";
import { ProjectAccessButton } from "./ProjectAccessDialog.tsx";
import { MediaGridCard } from "./MediaGridCard.tsx";
import { ProjectWorkspaceNav, type ProjectWorkspaceArea } from "./ProjectWorkspaceNav.tsx";
import { projectGlyph, projectRailNav } from "./projectRailNav.tsx";
import type { WorkspaceRailAction } from "./WorkspaceChrome.tsx";
import { useSegmentedIndicator } from "./useSegmentedIndicator.ts";
import { useWorkspaceChrome } from "./WorkspaceChromeContext.tsx";
import "../projectFiles.css";

const blankCanvasSnapshot = {
  type: "excalidraw" as const,
  version: 2,
  elements: [],
  appState: { viewBackgroundColor: "#f7f8fa" },
  files: {},
  comments: [],
};

function DocumentGlyph({ icon }: { icon: ProjectDocumentIcon }) {
  if (icon === "task") return <Icon icon="check" size="md" />;
  if (icon === "schedule") return <Icon icon="calendar" size="md" />;
  if (icon === "build") return <Icon icon="wrench" size="md" />;
  if (icon === "idea") return <Icon icon="info" size="md" />;
  return <Icon icon="copy" size="md" />;
}

const updatedLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(value).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(new Date(value));

const projectIconOptions: Array<{
  value: ResearchProjectIcon;
  label: string;
}> = [
  { value: "initial", label: "Project initial" },
  { value: "folder", label: "Folder" },
  { value: "grid", label: "Grid" },
  { value: "book", label: "Book" },
  { value: "sparkle", label: "Sparkle" },
];

/* One size now that the hero is gone — the 80px variant had no other caller. */
function ProjectMark({
  icon,
  title,
}: {
  icon: ResearchProjectIcon;
  title: string;
}) {
  return (
    <span className="project-files__project-mark" aria-hidden="true">
      {projectGlyph(icon, title)}
    </span>
  );
}

export type CanvasView = "grid" | "list";

/* The list row reuses the document row: same shape, same hit target, canvas
   icon and meta. Only the media preview is grid-only. */
function CanvasListRow({
  canvas,
  projectId,
}: {
  canvas: DesignerCanvasFileSummary;
  projectId: string;
}) {
  return (
    <button
      className="project-file-row"
      type="button"
      onClick={() =>
        navigate({ name: "project-canvas", projectId, canvasId: canvas.id })
      }
    >
      <span className="project-file-row__icon project-file-row__icon--canvas">
        <Icon icon="viewColumns" size="lg" />
      </span>
      <span className="project-file-row__meta">
        <strong>{canvas.title}</strong>
        <small>Canvas · Updated {updatedLabel(canvas.updatedAt)}</small>
      </span>
      <Icon icon="chevronRight" size="sm" />
    </button>
  );
}

function CanvasScreenCard({
  canvas,
  projectId,
}: {
  canvas: DesignerCanvasFileSummary;
  projectId: string;
}) {
  return (
    <article
      className="screen-grid-card project-canvas-screen-card"
      data-canvas-preview="placeholder"
    >
      <div className="screen-grid-card__media">
        <MediaGridCard
          label={`Open ${canvas.title}`}
          kind="image"
          url="/favicon.svg"
          accent="var(--color-accent)"
          aspectRatio="16 / 10"
          imageFit="contain"
          preferFullImage
          title={canvas.title}
          href={routeToPath(
            {
              name: "project-canvas",
              projectId,
              canvasId: canvas.id,
            },
          )}
        />
      </div>
    </article>
  );
}

export function ProjectFilesPage({
  projectId,
  area,
}: {
  projectId: string;
  area: ProjectWorkspaceArea;
}) {
  const [project, setProject] = useState<ResearchProjectWorkspace>();
  const [canvases, setCanvases] = useState<DesignerCanvasFileSummary[]>([]);
  const [documents, setDocuments] = useState<ProjectDocumentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [canvasView, setCanvasView] = useState<CanvasView>("grid");
  const canvasViewRef = useSegmentedIndicator(canvasView);
  const [title, setTitle] = useState("");
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsIcon, setSettingsIcon] =
    useState<ResearchProjectIcon>("initial");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [error, setError] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceMenuRef = useRef<HTMLElement>(null);

  const projectTitle = project?.title ?? "Designer project";
  const projectIcon = project?.icon ?? "initial";

  /* Says what this view is and how much is in it, so the area still identifies
     itself without a metadata card restating the page it sits on. */
  const areaSummary =
    area === "settings"
      ? "Rename this project and pick the icon it shows across the workspace."
      : loading
        ? "Loading…"
        : area === "canvas"
          ? `${canvases.length} ${canvases.length === 1 ? "canvas" : "canvases"} · visual exploration for this project.`
          : `${documents.length} ${documents.length === 1 ? "document" : "documents"} · written knowledge for this project.`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    /* Both lists load regardless of `area` so switching Canvas and Documents
       is immediate once the project page is open. */
    const fileRequest = Promise.all([
      listDesignerCanvases(projectId, controller.signal).then(setCanvases),
      listProjectDocuments(projectId, controller.signal).then(setDocuments),
    ]);
    void Promise.all([getResearchProject(projectId), fileRequest])
      .then(([nextProject]) => {
        setProject(nextProject);
        setSettingsTitle(nextProject.title);
        setSettingsIcon(nextProject.icon ?? "initial");
        setSettingsSaved(false);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError((cause as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [area, projectId]);

  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setWorkspaceMenuOpen(false);
      workspaceMenuTriggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() =>
      workspaceMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [workspaceMenuOpen]);

  const files = useMemo(
    () =>
      area === "canvas" ? canvases : area === "documents" ? documents : [],
    [area, canvases, documents],
  );

  const createFile = async () => {
    const nextTitle =
      title.trim() ||
      (area === "canvas" ? "Untitled canvas" : "Untitled document");
    setCreating(true);
    setError("");
    try {
      if (area === "canvas") {
        const canvas = await createDesignerCanvas(
          projectId,
          nextTitle,
          blankCanvasSnapshot,
        );
        navigate({ name: "project-canvas", projectId, canvasId: canvas.id });
      } else {
        const document = await createProjectDocument(projectId, nextTitle);
        navigate({
          name: "project-document-file",
          projectId,
          documentId: document.id,
        });
      }
    } catch (cause) {
      setError((cause as Error).message);
      setCreating(false);
    }
  };

  const saveSettings = async () => {
    const nextTitle = settingsTitle.trim();
    if (!project || !nextTitle) {
      setError("Project name is required.");
      return;
    }
    setSavingSettings(true);
    setSettingsSaved(false);
    setError("");
    try {
      const updated = await updateResearchProject(projectId, project.revision, {
        title: nextTitle,
        icon: settingsIcon,
      });
      setProject(updated);
      setSettingsTitle(updated.title);
      setSettingsIcon(updated.icon ?? "initial");
      setSettingsSaved(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  const settingsDirty =
    Boolean(project) &&
    (settingsTitle.trim() !== projectTitle || settingsIcon !== projectIcon);
  const settingsReadOnly = project?.access?.role === "viewer";

  /* The shared app rail stays flat. Project-specific areas are local to this
     page, where their labels can be read without a popup or tiny tree rows. */
  const projectTree: WorkspaceRailAction[] = useMemo(
    () =>
      projectRailNav({
        onOpenProjects: () => navigate({ name: "projects" }),
      }),
    [],
  );

  useWorkspaceChrome(
    () => ({
      className: "project-files-page",
      /* Keep the rail identity identical to the Projects index. The current
         workspace remains switchable on a detail route instead of becoming an
         inert label. */
      workspace: {
        label: "Switch workspace",
        name: project?.organization?.name ?? "Personal",
        initial: (project?.organization?.name ?? "Personal").charAt(0).toUpperCase(),
        expanded: workspaceMenuOpen,
        buttonRef: workspaceMenuTriggerRef,
        onSelect: () => setWorkspaceMenuOpen((open) => !open),
      },
      nav: {
        primaryLabel: "Workspace",
        primaryHeading: "Workspace",
        globalActions: [{
          label: "Apps",
          icon: <GridIcon aria-hidden="true" />,
          onSelect: () => navigate({ name: "apps" }),
        }],
        primaryActions: projectTree,
        settings: {
          label: "Settings",
          icon: <CogIcon aria-hidden="true" />,
          onSelect: () => navigate({ name: "settings-billing" }),
        },
      },
      onBrandSelect: () => navigate({ name: "apps" }),
      drawer: (
        <div
          className={`projects-workspace__drawer-layer${workspaceMenuOpen ? " is-open" : ""}`}
          aria-hidden={!workspaceMenuOpen}
        >
          <button
            type="button"
            className="projects-workspace__drawer-backdrop"
            aria-label="Close workspace menu"
            tabIndex={workspaceMenuOpen ? 0 : -1}
            onClick={() => setWorkspaceMenuOpen(false)}
          />
          <aside
            ref={workspaceMenuRef}
            className="projects-team-drawer"
            role="menu"
            aria-label="Switch workspace"
          >
            <section className="projects-team-switcher__spaces" aria-label="Workspaces">
              <button
                type="button"
                className="is-active"
                role="menuitemradio"
                aria-checked="true"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  navigate({ name: "projects" });
                }}
              >
                <UserIcon aria-hidden="true" />
                <span>{project?.organization?.name ?? "Personal"}</span>
              </button>
            </section>
            <div className="projects-team-drawer__divider" />
            <button
              type="button"
              className="projects-team-switcher__create"
              role="menuitem"
              onClick={() => {
                setWorkspaceMenuOpen(false);
                navigate({ name: "settings-billing" });
              }}
            >
              <CogIcon aria-hidden="true" />
              <span>Workspace settings</span>
            </button>
          </aside>
        </div>
      ),
    }),
    [project?.organization?.name, projectTitle, projectTree, workspaceMenuOpen],
  );

  return (
    <>

          {/*
            * The same page header every other surface uses. The rail already
            * says which project and which area you are in, so this carries the
            * project name once and the actions for the view — not a mark, a
            * restated area name, and a "Workspace: Project" metadata cell.
            */}
          <header className="projects-workspace__page-header">
            <div>
              <Heading level={1}>{projectTitle}</Heading>
              <Text color="secondary">{areaSummary}</Text>
              <ProjectWorkspaceNav projectId={projectId} active={area} />
            </div>
            <div className="projects-workspace__page-header-actions">
              {area === "canvas" && canvases.length ? (
                <SegmentedControl
                  ref={canvasViewRef}
                  label="Canvas layout"
                  size="sm"
                  value={canvasView}
                  onChange={(value) => setCanvasView(value as CanvasView)}
                >
                  <SegmentedControlItem value="grid" label="Grid" />
                  <SegmentedControlItem value="list" label="List" />
                </SegmentedControl>
              ) : null}
              {area !== "settings" ? (
                <Button
                  label={area === "canvas" ? "New Canvas" : "New Document"}
                  variant="primary"
                  onClick={() => {
                    setComposerOpen(true);
                    setTitle("");
                  }}
                />
              ) : null}
            </div>
          </header>

          {area === "settings" ? (
            <section
              className="project-settings"
              aria-labelledby="project-settings-title"
            >
              <div className="project-settings__heading">
                <Heading level={2} id="project-settings-title">
                  Project settings
                </Heading>
                <Text color="secondary">
                  Update how this project appears across your workspace.
                </Text>
              </div>
              {loading ? (
                <div className="project-file-index__loading">
                  <Spinner size="lg" />
                </div>
              ) : null}
              {!loading && project ? (
                <form
                  className="project-settings__card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSettings();
                  }}
                >
                  <div className="project-settings__identity">
                    <ProjectMark
                      icon={settingsIcon}
                      title={settingsTitle || projectTitle}
                    />
                    <div>
                      <strong>{settingsTitle.trim() || projectTitle}</strong>
                      <span>Project identity</span>
                    </div>
                  </div>

                  <TextInput
                    label="Project name"
                    value={settingsTitle}
                    placeholder="Project name"
                    onChange={(value) => {
                      setSettingsTitle(value);
                      setSettingsSaved(false);
                    }}
                    width="100%"
                    isDisabled={settingsReadOnly || savingSettings}
                  />

                  <fieldset className="project-settings__icon-field">
                    <legend>Project icon</legend>
                    <span>Choose an icon for the project header.</span>
                    <div className="project-settings__icon-options">
                      {projectIconOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={
                            settingsIcon === option.value ? "is-selected" : ""
                          }
                          aria-label={option.label}
                          aria-pressed={settingsIcon === option.value}
                          disabled={settingsReadOnly || savingSettings}
                          onClick={() => {
                            setSettingsIcon(option.value);
                            setSettingsSaved(false);
                          }}
                        >
                          <ProjectMark
                            icon={option.value}
                            title={settingsTitle || projectTitle}
                          />
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {error ? (
                    <p
                      className="project-settings__message is-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                  {settingsSaved ? (
                    <p className="project-settings__message" role="status">
                      Project settings saved.
                    </p>
                  ) : null}

                  <div className="project-settings__actions">
                    <Button
                      type="submit"
                      label="Save changes"
                      variant="primary"
                      size="md"
                      isLoading={savingSettings}
                      isDisabled={
                        settingsReadOnly || savingSettings || !settingsDirty
                      }
                    />
                  </div>
                </form>
              ) : null}
            </section>
          ) : (
            <section
              className="project-file-index"
              aria-label={`${area} files`}
            >
              {error ? (
                <p className="project-file-index__error" role="alert">
                  {error}
                </p>
              ) : null}
              {composerOpen ? (
                <form
                  className="project-file-index__composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createFile();
                  }}
                >
                  <TextInput
                    label={area === "canvas" ? "Canvas name" : "Document name"}
                    value={title}
                    placeholder={
                      area === "canvas"
                        ? "Untitled canvas"
                        : "Untitled document"
                    }
                    onChange={setTitle}
                    hasAutoFocus
                  />
                  <div>
                    <Button
                      label="Cancel"
                      variant="ghost"
                      size="sm"
                      onClick={() => setComposerOpen(false)}
                    />
                    <Button
                      type="submit"
                      label="Create"
                      variant="primary"
                      size="sm"
                      isLoading={creating}
                      isDisabled={creating}
                    />
                  </div>
                </form>
              ) : null}

              {loading ? (
                <div className="project-file-index__loading">
                  <Spinner size="lg" />
                </div>
              ) : null}
              {!loading && !files.length ? (
                <button
                  className="project-file-index__empty"
                  type="button"
                  onClick={() => setComposerOpen(true)}
                >
                  <span className="project-file-row__icon project-file-row__icon--canvas">
                    <Icon
                      icon={area === "canvas" ? "viewColumns" : "copy"}
                      size="lg"
                    />
                  </span>
                  <span>
                    <strong>
                      Create your first{" "}
                      {area === "canvas" ? "canvas" : "document"}
                    </strong>
                    <small>
                      {area === "canvas"
                        ? "Start with a blank visual workspace."
                        : "Start a collaborative page for this project."}
                    </small>
                  </span>
                  <Icon icon="chevronRight" size="sm" />
                </button>
              ) : null}

              {!loading && files.length ? (
                <div
                  className={`project-file-index__grid${
                    area === "canvas" && canvasView === "grid"
                      ? " project-file-index__grid--canvas"
                      : " project-file-index__grid--documents"
                  }`}
                >
                  {area === "canvas"
                    ? canvases.map((canvas) =>
                        canvasView === "grid" ? (
                          <CanvasScreenCard
                            key={canvas.id}
                            canvas={canvas}
                            projectId={projectId}
                          />
                        ) : (
                          <CanvasListRow
                            key={canvas.id}
                            canvas={canvas}
                            projectId={projectId}
                          />
                        ),
                      )
                    : documents.map((document) => (
                        <button
                          className="project-file-row"
                          type="button"
                          key={document.id}
                          onClick={() =>
                            navigate({
                              name: "project-document-file",
                              projectId,
                              documentId: document.id,
                            })
                          }
                        >
                          <span className="project-file-row__icon project-file-row__icon--document">
                            <DocumentGlyph icon={document.icon} />
                          </span>
                          <span className="project-file-row__meta">
                            <strong>{document.title}</strong>
                            <small>
                              Document · Updated{" "}
                              {updatedLabel(document.updatedAt)}
                            </small>
                          </span>
                          <Icon icon="chevronRight" size="sm" />
                        </button>
                      ))}
                </div>
              ) : null}
            </section>
          )}
    </>
  );
}
