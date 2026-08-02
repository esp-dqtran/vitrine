import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { withCollaboration } from "@blocknote/core/yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Icon, Spinner } from "@astryxdesign/core";

import "@blocknote/mantine/style.css";
import "./projectDocument.css";

import {
  addProjectDocumentComment,
  ensureProjectDocument,
  listProjectDocumentComments,
  resolveProjectDocumentComment,
  updateProjectDocument,
  type ProjectDocumentCommentView,
  type ProjectDocumentIcon,
  type ProjectDocumentPatch,
  type ProjectDocumentView,
} from "../projectDocumentsApi.ts";
import {
  ResearchProjectApiError,
  attachResearchFlow,
  getResearchProject,
} from "../researchProjectsApi.ts";
import { navigate } from "../router.ts";
import type { Platform } from "../../platformFromUrl.ts";
import type { ResearchProjectWorkspace } from "../../researchProject.ts";
import {
  ProjectDocumentFlowProvider,
  projectDocumentFlowOptions,
  projectDocumentSchema,
  projectDocumentSlashMenuItems,
  type ProjectDocumentFlowOption,
} from "./projectDocumentFlowBlock.tsx";

type ConnectionState = "connecting" | "connected" | "disconnected";

interface Collaborator {
  color: string;
  name: string;
}

const pageIcons: Array<{ value: ProjectDocumentIcon; label: string }> = [
  { value: "none", label: "No icon" },
  { value: "document", label: "Document" },
  { value: "idea", label: "Idea" },
  { value: "task", label: "Task" },
  { value: "schedule", label: "Schedule" },
  { value: "build", label: "Build" },
];

const collaboratorColor = (identity: string): string => {
  const colors = ["#5b67f1", "#0f9f6e", "#d97706", "#db2777", "#7c3aed", "#0284c7"];
  let hash = 0;
  for (const character of identity) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
};

const collaboratorInitials = (name: string): string => name
  .split(/[@\s._-]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("") || "?";

function PageIcon({ icon, size = "md" }: { icon: ProjectDocumentIcon; size?: "md" | "lg" }) {
  if (icon === "task") return <Icon icon="check" size={size} />;
  if (icon === "schedule") return <Icon icon="calendar" size={size} />;
  if (icon === "build") return <Icon icon="wrench" size={size} />;
  if (icon === "idea") return <Icon icon="info" size={size} />;
  return <Icon icon="viewColumns" size={size} />;
}

export function projectDocumentCollaborationUrl(location: Location = window.location): string {
  const configured = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env?.VITE_PROJECT_DOCUMENT_COLLAB_URL?.trim();
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/project-document-collaboration`;
}

function DocumentDiscussion({
  comments,
  draft,
  loading,
  submitting,
  onClose,
  onDraftChange,
  onResolve,
  onSubmit,
}: {
  comments: ProjectDocumentCommentView[];
  draft: string;
  loading: boolean;
  submitting: boolean;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onResolve: (comment: ProjectDocumentCommentView) => void;
  onSubmit: () => void;
}) {
  const openComments = comments.filter((comment) => !comment.resolvedAt);
  const resolvedComments = comments.filter((comment) => comment.resolvedAt);
  return (
    <aside
      id="project-document-discussion"
      className="project-document-discussion"
      aria-label="Page discussion"
    >
      <header>
        <div>
          <strong>Page discussion</strong>
          <span>{openComments.length} open</span>
        </div>
        <button type="button" className="project-document-icon-button" aria-label="Close discussion" onClick={onClose}>
          <Icon icon="close" size="sm" />
        </button>
      </header>
      <form
        className="project-document-discussion__composer"
        onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
      >
        <textarea
          aria-label="Add a page comment"
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Leave a comment…"
          rows={3}
          maxLength={2000}
        />
        <button type="submit" disabled={submitting || !draft.trim()}>
          {submitting ? "Adding…" : "Comment"}
        </button>
      </form>
      <div className="project-document-discussion__list">
        {loading ? <p>Loading discussion…</p> : null}
        {!loading && !comments.length ? (
          <div className="project-document-discussion__empty">
            <strong>No comments yet</strong>
            <span>Start a discussion about this page.</span>
          </div>
        ) : null}
        {[...openComments, ...resolvedComments].map((comment) => (
          <article
            key={comment.id}
            className={comment.resolvedAt ? "project-document-comment project-document-comment--resolved" : "project-document-comment"}
          >
            <div className="project-document-comment__avatar" aria-hidden="true">
              {collaboratorInitials(comment.authorEmail)}
            </div>
            <div>
              <header>
                <strong>{comment.authorEmail}</strong>
                <time dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </time>
              </header>
              <p>{comment.body}</p>
              <button type="button" onClick={() => onResolve(comment)}>
                {comment.resolvedAt ? "Reopen" : "Resolve"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function CollaborativeProjectDocument({
  document,
  flows,
  initialPlatform,
  userName,
  onAttachCatalogFlow,
  onDocumentChange,
}: {
  document: ProjectDocumentView;
  flows: ProjectDocumentFlowOption[];
  initialPlatform: Platform;
  userName: string;
  onAttachCatalogFlow: (option: ProjectDocumentFlowOption) => Promise<ProjectDocumentFlowOption>;
  onDocumentChange: (document: ProjectDocumentView) => void;
}) {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [synced, setSynced] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    { name: userName, color: collaboratorColor(userName) },
  ]);
  const [titleDraft, setTitleDraft] = useState(document.title);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [uiError, setUiError] = useState("");
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [comments, setComments] = useState<ProjectDocumentCommentView[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const cancelTitleCommitRef = useRef(false);
  const yDocument = useMemo(() => new Y.Doc(), [document.collaborationDocumentId]);
  const provider = useMemo(() => new HocuspocusProvider({
    url: projectDocumentCollaborationUrl(),
    name: document.collaborationDocumentId,
    document: yDocument,
    onStatus: ({ status }) => setConnection(status),
    onSynced: () => setSynced(true),
    onDisconnect: () => {
      setConnection("disconnected");
      setSynced(false);
    },
  }), [document.collaborationDocumentId, yDocument]);
  const editor = useCreateBlockNote(withCollaboration({
    schema: projectDocumentSchema,
    defaultStyles: true,
    collaboration: {
      provider: { awareness: provider.awareness ?? undefined },
      fragment: yDocument.getXmlFragment("document-store"),
      user: {
        name: userName,
        color: collaboratorColor(userName),
      },
      showCursorLabels: "activity",
    },
  }), [provider, userName, yDocument]);

  useEffect(() => setTitleDraft(document.title), [document.title]);

  useEffect(() => {
    const input = titleInputRef.current;
    if (!input) return;
    const resizeTitle = () => {
      input.style.height = "0";
      input.style.height = `${input.scrollHeight}px`;
    };
    resizeTitle();
    window.addEventListener("resize", resizeTitle);
    return () => window.removeEventListener("resize", resizeTitle);
  }, [titleDraft]);

  useEffect(() => {
    const closeTransientUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const hasOpenLayer = iconMenuOpen || actionsOpen || shareOpen || discussionOpen;
      if (!hasOpenLayer) return;
      event.preventDefault();
      setIconMenuOpen(false);
      setActionsOpen(false);
      setShareOpen(false);
      setDiscussionOpen(false);
    };
    window.document.addEventListener("keydown", closeTransientUi);
    return () => window.document.removeEventListener("keydown", closeTransientUi);
  }, [actionsOpen, discussionOpen, iconMenuOpen, shareOpen]);

  useEffect(() => {
    const refreshCollaborators = () => {
      const next = Array.from(provider.awareness?.getStates().values() ?? [])
        .map((state) => (state as { user?: Partial<Collaborator> }).user)
        .filter((user): user is Collaborator => Boolean(user?.name && user?.color));
      const unique = Array.from(new Map(next.map((user) => [user.name, user])).values());
      setCollaborators(unique.length ? unique : [
        { name: userName, color: collaboratorColor(userName) },
      ]);
    };
    provider.awareness?.on("change", refreshCollaborators);
    refreshCollaborators();
    return () => provider.awareness?.off("change", refreshCollaborators);
  }, [provider, userName]);

  useEffect(() => () => {
    provider.destroy();
    yDocument.destroy();
  }, [provider, yDocument]);

  const updateMetadata = async (patch: ProjectDocumentPatch) => {
    if (document.role !== "editor") return;
    setSavingMetadata(true);
    setUiError("");
    try {
      onDocumentChange(await updateProjectDocument(document.projectId, patch));
    } catch (cause) {
      setUiError((cause as Error).message);
      setTitleDraft(document.title);
    } finally {
      setSavingMetadata(false);
    }
  };

  const commitTitle = () => {
    if (cancelTitleCommitRef.current) {
      cancelTitleCommitRef.current = false;
      setTitleDraft(document.title);
      return;
    }
    const title = titleDraft.trim();
    if (!title) {
      setTitleDraft(document.title);
      return;
    }
    if (title !== document.title) void updateMetadata({ title });
  };

  const openDiscussion = async () => {
    setDiscussionOpen(true);
    setCommentsLoading(true);
    setUiError("");
    try {
      setComments(await listProjectDocumentComments(document.projectId));
    } catch (cause) {
      setUiError((cause as Error).message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;
    setCommentSubmitting(true);
    setUiError("");
    try {
      const comment = await addProjectDocumentComment(document.projectId, body);
      setComments((current) => [...current, comment]);
      setCommentDraft("");
    } catch (cause) {
      setUiError((cause as Error).message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const toggleComment = async (comment: ProjectDocumentCommentView) => {
    setUiError("");
    try {
      const updated = await resolveProjectDocumentComment(
        document.projectId,
        comment.id,
        !comment.resolvedAt,
      );
      setComments((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setUiError((cause as Error).message);
    }
  };

  const copyLink = async () => {
    setUiError("");
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setUiError("The document link could not be copied");
    }
  };

  const connectionLabel = connection === "connected" && synced
    ? (savingMetadata ? "Saving…" : "Saved")
    : connection === "disconnected"
      ? "Offline"
      : "Connecting";

  return (
    <section
      className={`project-document project-document--${document.pageWidth}`}
      aria-label="Collaborative project document"
    >
      <header className="project-document-page__topbar">
        <nav className="project-document-breadcrumb" aria-label="Document breadcrumb">
          <button type="button" onClick={() => navigate({ name: "projects" })}>Projects</button>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={() => navigate({ name: "project", projectId: document.projectId })}>
            {document.title}
          </button>
        </nav>
        <div className="project-document-actions">
          <span
            className={`project-document__connection project-document__connection--${connection}`}
            data-testid="project-document-connection"
          >
            {connectionLabel}
          </span>
          <div className="project-document-collaborators" data-testid="project-document-collaborators">
            {collaborators.slice(0, 4).map((collaborator) => (
              <span
                key={collaborator.name}
                title={collaborator.name}
                style={{ backgroundColor: collaborator.color }}
              >
                {collaboratorInitials(collaborator.name)}
              </span>
            ))}
            <span className="project-document-collaborators__count">
              {collaborators.length} {collaborators.length === 1 ? "collaborator" : "collaborators"}
            </span>
          </div>
          <button
            type="button"
            className={document.isFavorite ? "project-document-action is-active" : "project-document-action"}
            aria-pressed={document.isFavorite}
            onClick={() => void updateMetadata({ isFavorite: !document.isFavorite })}
            disabled={document.role !== "editor" || savingMetadata}
          >
            {document.isFavorite ? "Favorited" : "Favorite"}
          </button>
          <div className="project-document-popover-anchor">
            <button
              type="button"
              className="project-document-action"
              aria-expanded={shareOpen}
              onClick={() => {
                setShareOpen((open) => !open);
                setActionsOpen(false);
                setIconMenuOpen(false);
              }}
            >
              Share
            </button>
            {shareOpen ? (
              <div className="project-document-popover project-document-share" role="dialog" aria-label="Share document">
                <strong>Share this page</strong>
                <p>Anyone who already has access to this project can open this link.</p>
                <button type="button" onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>
              </div>
            ) : null}
          </div>
          <button type="button" className="project-document-action" aria-label="Copy link" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <div className="project-document-popover-anchor">
            <button
              type="button"
              className="project-document-icon-button"
              aria-label="Document actions"
              aria-expanded={actionsOpen}
              onClick={() => {
                setActionsOpen((open) => !open);
                setShareOpen(false);
                setIconMenuOpen(false);
              }}
            >
              <Icon icon="moreHorizontal" size="sm" />
            </button>
            {actionsOpen ? (
              <div
                className="project-document-popover project-document-actions-menu"
                role="menu"
                aria-label="Document settings"
              >
                <span>Page width</span>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={document.pageWidth === "standard"}
                  onClick={() => { void updateMetadata({ pageWidth: "standard" }); setActionsOpen(false); }}
                >
                  Standard {document.pageWidth === "standard" ? <Icon icon="check" size="xsm" /> : null}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={document.pageWidth === "full"}
                  onClick={() => { void updateMetadata({ pageWidth: "full" }); setActionsOpen(false); }}
                >
                  Full width {document.pageWidth === "full" ? <Icon icon="check" size="xsm" /> : null}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {uiError ? <p role="alert" className="project-document-page__error">{uiError}</p> : null}

      <div className="project-document__workspace">
        <article className="project-document__page">
          <div className="project-document__page-controls">
            <div className="project-document-popover-anchor">
              <button
                type="button"
                aria-expanded={iconMenuOpen}
                onClick={() => {
                  setIconMenuOpen((open) => !open);
                  setActionsOpen(false);
                  setShareOpen(false);
                }}
                disabled={document.role !== "editor"}
              >
                {document.icon === "none" ? "Add icon" : "Change icon"}
              </button>
              {iconMenuOpen ? (
                <div className="project-document-popover project-document-icon-menu" role="menu" aria-label="Page icon">
                  {pageIcons.map((option) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={document.icon === option.value}
                      key={option.value}
                      onClick={() => { void updateMetadata({ icon: option.value }); setIconMenuOpen(false); }}
                    >
                      {option.value !== "none" ? <PageIcon icon={option.value} /> : null}
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              aria-expanded={discussionOpen}
              aria-controls="project-document-discussion"
              onClick={() => void openDiscussion()}
            >
              Add comment
            </button>
          </div>

          {document.icon !== "none" ? (
            <button
              type="button"
              className="project-document__page-icon"
              aria-label="Change page icon"
              aria-expanded={iconMenuOpen}
              onClick={() => {
                setIconMenuOpen((open) => !open);
                setActionsOpen(false);
                setShareOpen(false);
              }}
            >
              <PageIcon icon={document.icon} size="lg" />
            </button>
          ) : null}

          <textarea
            ref={titleInputRef}
            className="project-document__title"
            aria-label="Document title"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.currentTarget.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelTitleCommitRef.current = true;
                setTitleDraft(document.title);
                event.currentTarget.blur();
              }
            }}
            placeholder="Untitled"
            maxLength={120}
            rows={1}
            readOnly={document.role !== "editor"}
          />

          <div className="project-document__editor" data-testid="project-document-editor">
            <ProjectDocumentFlowProvider
              flows={flows}
              initialPlatform={initialPlatform}
              onAttachCatalogFlow={onAttachCatalogFlow}
            >
              <BlockNoteView
                editor={editor}
                editable={document.role === "editor"}
                formattingToolbar
                linkToolbar
                slashMenu={false}
                sideMenu
                filePanel
                tableHandles
                emojiPicker
                theme="light"
              >
                <SuggestionMenuController
                  triggerCharacter="/"
                  getItems={async (query) => projectDocumentSlashMenuItems(editor, query)}
                />
              </BlockNoteView>
            </ProjectDocumentFlowProvider>
          </div>
        </article>

        {discussionOpen ? (
          <DocumentDiscussion
            comments={comments}
            draft={commentDraft}
            loading={commentsLoading}
            submitting={commentSubmitting}
            onClose={() => setDiscussionOpen(false)}
            onDraftChange={setCommentDraft}
            onResolve={(comment) => void toggleComment(comment)}
            onSubmit={() => void submitComment()}
          />
        ) : null}
      </div>
    </section>
  );
}

export function ProjectDocumentPage({
  projectId,
  userName,
}: {
  projectId: string;
  userName: string;
}) {
  const [document, setDocument] = useState<ProjectDocumentView>();
  const [workspace, setWorkspace] = useState<ResearchProjectWorkspace>();
  const [flowPlatform, setFlowPlatform] = useState<Platform>("web");
  const [error, setError] = useState("");
  const flows = useMemo(
    () => workspace ? projectDocumentFlowOptions(workspace) : [],
    [workspace],
  );

  useEffect(() => {
    let active = true;
    setDocument(undefined);
    setWorkspace(undefined);
    setFlowPlatform("web");
    setError("");
    void Promise.all([
      ensureProjectDocument(projectId),
      getResearchProject(projectId),
    ])
      .then(([nextDocument, workspace]) => {
        if (!active) return;
        setDocument(nextDocument);
        setWorkspace(workspace);
        setFlowPlatform(workspace.platformFilter === "all" ? "web" : workspace.platformFilter);
      })
      .catch((cause) => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [projectId]);

  const attachCatalogFlowOption = useCallback(async (
    option: ProjectDocumentFlowOption,
  ): Promise<ProjectDocumentFlowOption> => {
    if (!workspace || !option.catalog) {
      throw new Error("This catalog flow cannot be attached.");
    }
    const attach = (current: ResearchProjectWorkspace) => {
      const lane = [...current.lanes].sort((left, right) => left.position - right.position)[0];
      if (!lane) throw new Error("Add a research lane before attaching a flow.");
      return attachResearchFlow({
        projectId: current.id,
        laneId: lane.id,
        expectedRevision: current.revision,
        catalog: option.catalog!,
      });
    };

    let updated: ResearchProjectWorkspace;
    try {
      updated = await attach(workspace);
    } catch (cause) {
      if (!(cause instanceof ResearchProjectApiError)
        || cause.code !== "revision_conflict"
        || !cause.project) throw cause;
      updated = await attach(cause.project);
    }
    setWorkspace(updated);
    const attached = projectDocumentFlowOptions(updated).find((candidate) =>
      candidate.app === option.app && candidate.title === option.title);
    if (!attached) throw new Error("The flow was attached but its project reference could not be loaded.");
    return { ...attached, platform: option.platform };
  }, [workspace]);

  if (!document && !error) {
    return (
      <main className="vitrine-page project-document-page project-document-page--loading">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="vitrine-page project-document-page">
      {error ? <p role="alert" className="project-document-page__error">{error}</p> : null}
      {document ? (
        <CollaborativeProjectDocument
          document={document}
          flows={flows}
          initialPlatform={flowPlatform}
          userName={userName}
          onAttachCatalogFlow={attachCatalogFlowOption}
          onDocumentChange={setDocument}
        />
      ) : null}
    </main>
  );
}
