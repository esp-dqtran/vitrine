import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Heading,
  Icon,
  IconButton,
  Spinner,
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
import { navigate } from "../router.ts";
import { ProjectAccessButton } from "./ProjectAccessDialog.tsx";
import { MediaGridCard } from "./MediaGridCard.tsx";
import {
  ProjectWorkspaceNav,
  type ProjectWorkspaceArea,
} from "./ProjectWorkspaceNav.tsx";
import { WorkspaceHeader, WorkspaceRail } from "./WorkspaceChrome.tsx";
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

function ProjectMark({
  icon,
  title,
  compact = false,
}: {
  icon: ResearchProjectIcon;
  title: string;
  compact?: boolean;
}) {
  const glyph =
    icon === "folder" ? (
      <FolderIcon aria-hidden="true" />
    ) : icon === "grid" ? (
      <GridIcon aria-hidden="true" />
    ) : icon === "book" ? (
      <BookIcon aria-hidden="true" />
    ) : icon === "sparkle" ? (
      <SparkleIcon aria-hidden="true" />
    ) : (
      <span aria-hidden="true">
        {title.trim().charAt(0).toUpperCase() || "P"}
      </span>
    );

  return (
    <span
      className={`project-files__project-mark${
        compact ? " project-files__project-mark--compact" : ""
      }`}
      aria-hidden="true"
    >
      {glyph}
    </span>
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
          onOpen={() =>
            navigate({
              name: "project-canvas",
              projectId,
              canvasId: canvas.id,
            })
          }
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
  const [title, setTitle] = useState("");
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsIcon, setSettingsIcon] =
    useState<ResearchProjectIcon>("initial");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [error, setError] = useState("");

  const projectTitle = project?.title ?? "Designer project";
  const projectIcon = project?.icon ?? "initial";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const fileRequest =
      area === "canvas"
        ? listDesignerCanvases(projectId, controller.signal).then(setCanvases)
        : area === "documents"
          ? listProjectDocuments(projectId, controller.signal).then(
              setDocuments,
            )
          : Promise.resolve();
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

  return (
    <main className="vitrine-page projects-workspace project-files-page">
      <WorkspaceRail
        workspace={{
          label: "Back to projects",
          initial: projectTitle.trim().charAt(0).toUpperCase() || "P",
          onSelect: () => navigate({ name: "projects" }),
        }}
        primaryLabel="Project navigation"
        primaryActions={[
          {
            label: "Projects",
            icon: <FolderIcon aria-hidden="true" />,
            active: true,
            onSelect: () => navigate({ name: "projects" }),
          },
          {
            label: "Collections",
            icon: <BookmarkHollowIcon aria-hidden="true" />,
            onSelect: () => navigate({ name: "collections" }),
          },
        ]}
        secondaryLabel="Vitrine libraries"
        secondaryActions={[
          {
            label: "Apps",
            href: "/apps",
            icon: <GridIcon aria-hidden="true" />,
            onSelect: () => navigate({ name: "apps" }),
          },
          {
            label: "Sites",
            href: "/sites",
            icon: <GlobeIcon aria-hidden="true" />,
            onSelect: () => navigate({ name: "sites" }),
          },
        ]}
        settings={{
          label: "Account settings",
          icon: <CogIcon aria-hidden="true" />,
          onSelect: () => navigate({ name: "settings-billing" }),
        }}
      />

      <div className="projects-workspace__shell">
        <section className="projects-workspace__main">
          <WorkspaceHeader
            variant="projects"
            menu={{
              label: "Back to projects",
              expanded: false,
              icon: <MenuIcon aria-hidden="true" />,
              onSelect: () => navigate({ name: "projects" }),
            }}
            onBrandSelect={() => navigate({ name: "projects" })}
            actions={
              <>
                <ProjectAccessButton
                  project={{ id: projectId, title: projectTitle }}
                />
                <span className="project-files__optional-header-actions">
                  <span
                    className="projects-workspace__header-divider"
                    aria-hidden="true"
                  />
                  <IconButton
                    label="Help"
                    tooltip="Help"
                    variant="ghost"
                    icon={<QuestionIcon aria-hidden="true" />}
                  />
                  <IconButton
                    label="Notifications"
                    tooltip="Notifications"
                    variant="ghost"
                    icon={<BellIcon aria-hidden="true" />}
                  />
                </span>
                <IconButton
                  label="Account settings"
                  variant="ghost"
                  icon={<UserIcon aria-hidden="true" />}
                  onClick={() => navigate({ name: "settings-billing" })}
                />
              </>
            }
          >
            <button
              className="project-files__header-context"
              type="button"
              onClick={() => navigate({ name: "projects" })}
            >
              <Icon icon="chevronLeft" size="sm" />
              <span>{projectTitle}</span>
            </button>
          </WorkspaceHeader>

          <header className="project-files__hero">
            <div className="project-files__hero-inner">
              <ProjectMark icon={projectIcon} title={projectTitle} />
              <div className="project-files__hero-heading">
                <Heading level={1}>{projectTitle}</Heading>
                <Text color="secondary">
                  Keep visual exploration and project knowledge together.
                </Text>
              </div>
              <div className="project-files__hero-metadata">
                <div>
                  <span>Workspace</span>
                  <strong>Project</strong>
                </div>
                <div>
                  <span>{area === "settings" ? "Manage" : "Files"}</span>
                  <strong>
                    {area === "settings"
                      ? "Name & icon"
                      : loading
                        ? "Loading…"
                        : `${files.length} ${area === "canvas" ? "canvases" : "documents"}`}
                  </strong>
                </div>
              </div>
            </div>
            <div className="project-area-toolbar">
              <ProjectWorkspaceNav projectId={projectId} active={area} />
              {area !== "settings" ? (
                <div className="project-area-toolbar__action">
                  <Button
                    label={area === "canvas" ? "New Canvas" : "New Document"}
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setComposerOpen(true);
                      setTitle("");
                    }}
                  />
                </div>
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
                      compact
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
                            compact
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
                    area === "canvas"
                      ? " project-file-index__grid--canvas"
                      : " project-file-index__grid--documents"
                  }`}
                >
                  {area === "canvas"
                    ? canvases.map((canvas) => (
                        <CanvasScreenCard
                          key={canvas.id}
                          canvas={canvas}
                          projectId={projectId}
                        />
                      ))
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
        </section>
      </div>
    </main>
  );
}
