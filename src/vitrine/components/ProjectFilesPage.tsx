import { Spinner } from "./Spinner.tsx";
import { useEffect, useMemo, useState } from "react";
import { Button, Heading, Icon, Text, TextInput } from "@astryxdesign/core";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDownIcon,
  CogIcon,
  DocListIcon,
  GridIcon,
  PlusIcon,
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
  type ProjectDocumentView,
} from "../projectDocumentsApi.ts";
import {
  getResearchProject,
  updateResearchProject,
} from "../researchProjectsApi.ts";
import { navigate } from "../router.ts";
import { AstryxModal } from "./AstryxModal.tsx";
import { AstryxSingleSelectDropdown } from "./AstryxDropdown.tsx";
import type { ProjectWorkspaceArea } from "./ProjectWorkspaceNav.tsx";
import {
  projectCanvasTemplates,
  type ProjectCanvasTemplate,
} from "./ProjectTemplateLibrary.tsx";
import { projectGlyph, projectRailNav } from "./projectRailNav.tsx";
import type { WorkspaceRailAction } from "./WorkspaceChrome.tsx";
import {
  useProjectsWorkspace,
  useWorkspaceChrome,
} from "./WorkspaceChromeContext.tsx";
import designCritiqueThumbnail from "../assets/project-templates/design-critique.png";
import journeyMapThumbnail from "../assets/project-templates/journey-map.png";
import moodboardThumbnail from "../assets/project-templates/moodboard.png";
import userFlowThumbnail from "../assets/project-templates/user-flow.png";
import "../projectFiles.css";

const blankCanvasSnapshot = {
  type: "excalidraw" as const,
  version: 2,
  elements: [],
  appState: { viewBackgroundColor: "#f7f8fa" },
  files: {},
  comments: [],
};

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

type ProjectFileKind = "canvas" | "document";
type ProjectFileFilter = "all" | ProjectFileKind;
type ProjectFileSort = "updated" | "title";

const projectFileFilterOptions = [
  { value: "all", label: "All files" },
  { value: "canvas", label: "Canvas" },
  { value: "document", label: "Document" },
] as const;

const projectFileSortOptions = [
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Name" },
] as const;

interface ProjectLibraryFile {
  id: string;
  kind: ProjectFileKind;
  title: string;
  updatedAt: string;
  thumbnail: string;
}

const templateThumbnails = new Map<string, string>([
  ["moodboard-starter", moodboardThumbnail],
  ["design-critique", designCritiqueThumbnail],
  ["user-flow", userFlowThumbnail],
  ["journey-map", journeyMapThumbnail],
]);

const featuredTemplates = projectCanvasTemplates.filter((template) =>
  templateThumbnails.has(template.id),
);

const canvasThumbnails = [moodboardThumbnail, userFlowThumbnail];
const documentThumbnails = [designCritiqueThumbnail, journeyMapThumbnail];

function ProjectFileListRow({
  file,
  projectId,
}: {
  file: ProjectLibraryFile;
  projectId: string;
}) {
  return (
    <button
      className="project-file-row"
      type="button"
      onClick={() => {
        if (file.kind === "canvas") {
          navigate({ name: "project-canvas", projectId, canvasId: file.id });
        } else {
          navigate({
            name: "project-document-file",
            projectId,
            documentId: Number(file.id),
          });
        }
      }}
    >
      <span
        className={`project-file-row__preview project-file-row__preview--${file.kind}`}
      >
        <img src={file.thumbnail} alt="" />
      </span>
      <span className="project-file-row__meta">
        <strong>{file.title}</strong>
        <small>
          {file.kind === "canvas" ? "Canvas" : "Document"} · Updated{" "}
          {updatedLabel(file.updatedAt)}
        </small>
      </span>
      <Icon icon="chevronRight" size="sm" />
    </button>
  );
}

function ProjectFileCard({
  file,
  projectId,
}: {
  file: ProjectLibraryFile;
  projectId: string;
}) {
  return (
    <button
      className={`project-library-card is-${file.kind}`}
      type="button"
      onClick={() => {
        if (file.kind === "canvas") {
          navigate({ name: "project-canvas", projectId, canvasId: file.id });
        } else {
          navigate({
            name: "project-document-file",
            projectId,
            documentId: Number(file.id),
          });
        }
      }}
    >
      <span className="project-library-card__thumbnail">
        <img src={file.thumbnail} alt="" />
      </span>
      <span className="project-library-card__copy">
        <strong>{file.title}</strong>
        <small>Updated {updatedLabel(file.updatedAt)}</small>
      </span>
    </button>
  );
}

export function ProjectFilesPage({
  projectId,
  area,
}: {
  projectId: string;
  area: ProjectWorkspaceArea;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [project, setProject] = useState<ResearchProjectWorkspace>();
  const [canvases, setCanvases] = useState<DesignerCanvasFileSummary[]>([]);
  const [documents, setDocuments] = useState<ProjectDocumentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [canvasView, setCanvasView] = useState<CanvasView>("grid");
  const [fileFilter, setFileFilter] = useState<ProjectFileFilter>("all");
  const [fileSort, setFileSort] = useState<ProjectFileSort>("updated");
  const [templatesExpanded, setTemplatesExpanded] = useState(true);
  const [newFileKind, setNewFileKind] = useState<ProjectFileKind>("canvas");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProjectCanvasTemplate>();
  const [title, setTitle] = useState("");
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsIcon, setSettingsIcon] =
    useState<ResearchProjectIcon>("initial");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [error, setError] = useState("");
  const projectsWorkspace = useProjectsWorkspace();

  const projectTitle = project?.title ?? "Designer project";
  const projectIcon = project?.icon ?? "initial";

  const areaSummary =
    area === "settings"
      ? "Rename this project and pick the icon it shows across the workspace."
      : area === "documents"
        ? `${documents.length} ${documents.length === 1 ? "document" : "documents"} · written knowledge for this project.`
        : undefined;

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
    if (!project || !projectsWorkspace) return;
    projectsWorkspace.setSelectedTeamId(project.organization?.id);
  }, [project?.organization?.id, projectsWorkspace?.setSelectedTeamId]);

  const libraryFiles = useMemo<ProjectLibraryFile[]>(
    () => [
      ...canvases.map((canvas, index) => ({
        id: canvas.id,
        kind: "canvas" as const,
        title: canvas.title,
        updatedAt: canvas.updatedAt,
        thumbnail: canvasThumbnails[index % canvasThumbnails.length],
      })),
      ...documents.map((document, index) => ({
        id: String(document.id),
        kind: "document" as const,
        title: document.title,
        updatedAt: document.updatedAt,
        thumbnail: documentThumbnails[index % documentThumbnails.length],
      })),
    ],
    [canvases, documents],
  );

  const effectiveFileFilter = area === "documents" ? "document" : fileFilter;

  const files = useMemo(() => {
    const filtered = libraryFiles.filter(
      (file) =>
        effectiveFileFilter === "all" || file.kind === effectiveFileFilter,
    );
    return [...filtered].sort((left, right) =>
      fileSort === "title"
        ? left.title.localeCompare(right.title)
        : new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
    );
  }, [effectiveFileFilter, fileSort, libraryFiles]);

  const fileSections = useMemo(
    () =>
      [
        {
          kind: "canvas" as const,
          label: "Canvas",
          files: files.filter((file) => file.kind === "canvas"),
        },
        {
          kind: "document" as const,
          label: "Document",
          files: files.filter((file) => file.kind === "document"),
        },
      ].filter(
        (section) =>
          effectiveFileFilter === "all" || section.kind === effectiveFileFilter,
      ),
    [effectiveFileFilter, files],
  );

  const openComposer = (
    kind: ProjectFileKind,
    template?: ProjectCanvasTemplate,
  ) => {
    setCreating(false);
    setError("");
    setNewFileKind(kind);
    setSelectedTemplate(template);
    setTitle(template?.title ?? "");
    setComposerOpen(true);
  };

  const createFile = async () => {
    const nextTitle =
      title.trim() ||
      (newFileKind === "canvas" ? "Untitled canvas" : "Untitled document");
    setCreating(true);
    setError("");
    try {
      if (newFileKind === "canvas") {
        let snapshot: object = blankCanvasSnapshot;
        if (selectedTemplate) {
          const { convertToExcalidrawElements } =
            await import("@excalidraw/excalidraw");
          type ElementSkeleton = NonNullable<
            Parameters<typeof convertToExcalidrawElements>[0]
          >[number];
          snapshot = {
            ...blankCanvasSnapshot,
            elements: convertToExcalidrawElements(
              selectedTemplate.elements as unknown as ElementSkeleton[],
            ),
          };
        }
        const canvas = await createDesignerCanvas(
          projectId,
          nextTitle,
          snapshot,
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
      nav: {
        primaryLabel: "Workspace",
        primaryHeading: "Workspace",
        primaryActions: projectTree,
        settings: {
          label: "Settings",
          icon: <CogIcon aria-hidden="true" />,
          onSelect: () => navigate({ name: "settings-billing" }),
        },
      },
      onBrandSelect: () => navigate({ name: "apps" }),
    }),
    [projectTitle, projectTree],
  );

  return (
    <>
      <header className="projects-workspace__page-header project-library__header">
        <div>
          <Heading level={1}>{projectTitle}</Heading>
          {areaSummary ? <Text color="secondary">{areaSummary}</Text> : null}
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
                <p className="project-settings__message is-error" role="alert">
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
        <main className="project-file-index" aria-label={`${area} files`}>
          {error ? (
            <p className="project-file-index__error" role="alert">
              {error}
            </p>
          ) : null}

          {area === "canvas" ? (
            <section
              className={`project-template-shelf${templatesExpanded ? " is-expanded" : ""}`}
              aria-labelledby="project-template-shelf-title"
            >
              <button
                className="project-template-shelf__heading"
                type="button"
                aria-expanded={templatesExpanded}
                onClick={() => setTemplatesExpanded((expanded) => !expanded)}
              >
                <span>
                  <strong id="project-template-shelf-title">Templates</strong>
                  <small>Start with a proven canvas structure</small>
                </span>
                <ChevronDownIcon aria-hidden="true" />
              </button>
              {templatesExpanded ? (
                <div className="project-template-shelf__track">
                  <button
                    className="project-template-card project-template-card--blank"
                    type="button"
                    aria-label="Create a blank canvas"
                    onClick={() => openComposer("canvas")}
                  >
                    <span className="project-template-card__preview">
                      <span className="project-template-card__blank-icon">
                        <PlusIcon aria-hidden="true" />
                      </span>
                    </span>
                    <strong>Blank canvas</strong>
                  </button>
                  {featuredTemplates.map((template) => (
                    <button
                      className="project-template-card"
                      type="button"
                      key={template.id}
                      onClick={() => openComposer("canvas", template)}
                    >
                      <span className="project-template-card__preview">
                        <img src={templateThumbnails.get(template.id)} alt="" />
                      </span>
                      <strong>{template.title}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section
            className="project-library"
            aria-label={
              area === "documents" ? "Project documents" : "Project files"
            }
          >
            <div className="project-library__controls">
              {area === "canvas" ? (
                <div className="project-library__control">
                  <span>Filter by</span>
                  <AstryxSingleSelectDropdown
                    ariaLabel="Filter project files"
                    value={fileFilter}
                    options={projectFileFilterOptions}
                    triggerClassName="project-library__dropdown"
                    menuWidth={192}
                    onChange={(value) =>
                      setFileFilter(value as ProjectFileFilter)
                    }
                  />
                </div>
              ) : null}
              <div className="project-library__control">
                <span>Sort by</span>
                <AstryxSingleSelectDropdown
                  ariaLabel="Sort project files"
                  value={fileSort}
                  options={projectFileSortOptions}
                  triggerClassName="project-library__dropdown"
                  menuWidth={192}
                  onChange={(value) => setFileSort(value as ProjectFileSort)}
                />
              </div>
              <div
                className="project-library__view"
                role="radiogroup"
                aria-label="File layout"
              >
                <button
                  type="button"
                  role="radio"
                  aria-label="Grid view"
                  aria-checked={canvasView === "grid"}
                  className={canvasView === "grid" ? "is-active" : ""}
                  onClick={() => setCanvasView("grid")}
                >
                  <GridIcon aria-hidden="true" />
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-label="List view"
                  aria-checked={canvasView === "list"}
                  className={canvasView === "list" ? "is-active" : ""}
                  onClick={() => setCanvasView("list")}
                >
                  <DocListIcon aria-hidden="true" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="project-file-index__loading">
                <Spinner size="lg" />
              </div>
            ) : null}
            {!loading ? (
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={canvasView}
                  className="project-library__sections"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReducedMotion ? undefined : { opacity: 0, y: -6 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.18,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {fileSections.map((section) => (
                    <section
                      className={`project-library-section is-${section.kind}`}
                      aria-labelledby={`project-${section.kind}-files-title`}
                      key={section.kind}
                    >
                      <h2 id={`project-${section.kind}-files-title`}>
                        {section.label}
                      </h2>
                      {section.files.length ? (
                        <div
                          className={`project-file-index__grid project-file-index__grid--${canvasView}`}
                        >
                          {section.files.map((file) =>
                            canvasView === "grid" ? (
                              <ProjectFileCard
                                key={`${file.kind}-${file.id}`}
                                file={file}
                                projectId={projectId}
                              />
                            ) : (
                              <ProjectFileListRow
                                key={`${file.kind}-${file.id}`}
                                file={file}
                                projectId={projectId}
                              />
                            ),
                          )}
                        </div>
                      ) : (
                        <button
                          className="project-file-index__empty"
                          type="button"
                          onClick={() => openComposer(section.kind)}
                        >
                          <span
                            className={`project-file-row__icon project-file-row__icon--${section.kind}`}
                          >
                            <Icon
                              icon={
                                section.kind === "document"
                                  ? "copy"
                                  : "viewColumns"
                              }
                              size="lg"
                            />
                          </span>
                          <span>
                            <strong>
                              No {section.label.toLowerCase()} files yet
                            </strong>
                            <small>
                              Create the first {section.label.toLowerCase()}{" "}
                              file in this project.
                            </small>
                          </span>
                          <Icon icon="chevronRight" size="sm" />
                        </button>
                      )}
                    </section>
                  ))}
                </motion.div>
              </AnimatePresence>
            ) : null}
          </section>
        </main>
      )}

      <AstryxModal
        isOpen={composerOpen}
        onOpenChange={(open) => {
          if (!creating) setComposerOpen(open);
        }}
        purpose="form"
        width={480}
        aria-labelledby="project-create-dialog-title"
      >
        <form
          className="project-create-dialog"
          onSubmit={(event) => {
            event.preventDefault();
            void createFile();
          }}
        >
          <div className="project-create-dialog__heading">
            <span className="project-create-dialog__icon" aria-hidden="true">
              {newFileKind === "canvas" ? (
                <Icon icon="viewColumns" size="lg" />
              ) : (
                <Icon icon="copy" size="lg" />
              )}
            </span>
            <div>
              <Heading level={2} id="project-create-dialog-title">
                {selectedTemplate
                  ? `Create ${selectedTemplate.title}`
                  : newFileKind === "canvas"
                    ? "Create a blank canvas"
                    : "Create a document"}
              </Heading>
              <Text color="secondary">
                {selectedTemplate
                  ? `Start with this template in ${projectTitle}.`
                  : `Add a new ${newFileKind} to ${projectTitle}.`}
              </Text>
            </div>
          </div>

          <TextInput
            label={newFileKind === "canvas" ? "Canvas name" : "Document name"}
            value={title}
            placeholder={
              newFileKind === "canvas" ? "Untitled canvas" : "Untitled document"
            }
            onChange={setTitle}
            hasAutoFocus
            width="100%"
          />

          {error ? (
            <p className="project-create-dialog__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="project-create-dialog__actions">
            <Button
              type="button"
              label="Cancel"
              variant="ghost"
              onClick={() => setComposerOpen(false)}
              isDisabled={creating}
            />
            <Button
              type="submit"
              label={
                selectedTemplate
                  ? "Create from template"
                  : newFileKind === "canvas"
                    ? "Create canvas"
                    : "Create document"
              }
              variant="primary"
              isLoading={creating}
              isDisabled={creating}
            />
          </div>
        </form>
      </AstryxModal>
    </>
  );
}
