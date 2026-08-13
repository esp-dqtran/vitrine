import { Spinner } from './Spinner.tsx';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { withCollaboration } from "@blocknote/core/yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Button, Icon, IconButton } from "@astryxdesign/core";
import { getAuthToken } from '../apiFetch.ts';

import "@blocknote/mantine/style.css";
import "./projectDocument.css";
import "./projectDocumentEvidence.css";

import {
  addProjectDocumentCommentById,
  deleteProjectDocumentCommentById,
  ensureProjectDocument,
  getProjectDocument,
  listProjectDocumentCommentsById,
  resolveProjectDocumentCommentById,
  updateProjectDocumentById,
  type ProjectDocumentCommentView,
  type ProjectDocumentIcon,
  type ProjectDocumentPatch,
  type ProjectDocumentReviewStatus,
  type ProjectDocumentView,
} from "../projectDocumentsApi.ts";
import {
  ResearchProjectApiError,
  attachResearchFlow,
  getResearchProject,
} from "../researchProjectsApi.ts";
import { navigate } from "../router.ts";
import { useResolvedThemeMode } from "../theme.tsx";
import type { Platform } from "../../platformFromUrl.ts";
import type { ResearchProjectWorkspace } from "../../researchProject.ts";
import {
  ProjectDocumentFlowProvider,
  insertProjectDocumentEvidenceBlock,
  insertProjectDocumentFlowBlock,
  projectDocumentEvidenceOptions,
  projectDocumentFlowOptions,
  projectDocumentSchema,
  projectDocumentSlashMenuItems,
  type ProjectDocumentFlowOption,
} from "./projectDocumentFlowBlock.tsx";
import {
  consumeProjectDocumentFlowInsertIntent,
  type ProjectDocumentFlowInsertItem,
} from "../projectDocumentFlowInsertIntent.ts";
import { ProjectAccessDialog } from "./ProjectAccessDialog.tsx";
import {
  decodeProjectDocumentStateVector,
  parseProjectDocumentPersistenceMessage,
  projectDocumentStateVectorCoversDocument,
} from "../../projectDocumentCollaborationProtocol.ts";

type DocumentSaveState =
  | "connecting"
  | "saving"
  | "saved"
  | "offline"
  | "delayed"
  | "error";

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
  const colors = [
    "#5b67f1",
    "#0f9f6e",
    "#d97706",
    "#db2777",
    "#7c3aed",
    "#0284c7",
  ];
  let hash = 0;
  for (const character of identity)
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
};

const collaboratorInitials = (name: string): string =>
  name
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export const documentReviewTemplates = [
  {
    id: "product-requirements",
    title: "Product requirements",
    description: "Problem, scope, user stories, business rules, acceptance criteria, metrics, and open questions.",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Product requirements" },
      { type: "heading", props: { level: 3 }, content: "Problem and outcome" },
      { type: "paragraph", content: "What customer or business problem are we solving, and what outcome should change?" },
      { type: "heading", props: { level: 3 }, content: "Evidence" },
      { type: "paragraph", content: "Insert the Vitrines Flow and screens that support this requirement." },
      { type: "heading", props: { level: 3 }, content: "Scope" },
      { type: "bulletListItem", content: "Goal:" },
      { type: "bulletListItem", content: "Non-goal:" },
      { type: "heading", props: { level: 3 }, content: "User story and business rules" },
      { type: "paragraph", content: "As a [user], I want [capability], so that [outcome]." },
      { type: "bulletListItem", content: "Business rule:" },
      { type: "heading", props: { level: 3 }, content: "Acceptance criteria" },
      { type: "checkListItem", content: "Given [context], when [action], then [result]." },
      { type: "heading", props: { level: 3 }, content: "Success and guardrails" },
      { type: "bulletListItem", content: "Success metric:" },
      { type: "bulletListItem", content: "Guardrail metric:" },
      { type: "heading", props: { level: 3 }, content: "Dependencies and open questions" },
      { type: "bulletListItem", content: "Dependency:" },
      { type: "bulletListItem", content: "Open question:" },
    ],
  },
  {
    id: "design-critique",
    title: "Design critique",
    description: "Goal, evidence, feedback, open questions, and next moves.",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Design critique" },
      { type: "heading", props: { level: 3 }, content: "Goal and context" },
      { type: "paragraph", content: "What are we trying to improve, and for whom?" },
      { type: "heading", props: { level: 3 }, content: "Evidence" },
      { type: "paragraph", content: "Insert Vitrines screens or flows that support the review." },
      { type: "heading", props: { level: 3 }, content: "Feedback and next moves" },
      { type: "bulletListItem", content: "Keep:" },
      { type: "bulletListItem", content: "Change:" },
      { type: "bulletListItem", content: "Open question:" },
    ],
  },
  {
    id: "decision-record",
    title: "Decision record",
    description: "Capture the decision, evidence, tradeoffs, owner, and follow-up.",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Decision record" },
      { type: "heading", props: { level: 3 }, content: "Decision" },
      { type: "paragraph", content: "State the decision in one sentence." },
      { type: "heading", props: { level: 3 }, content: "Evidence and tradeoffs" },
      { type: "paragraph", content: "Link the product evidence and alternatives considered." },
      { type: "heading", props: { level: 3 }, content: "Owner and follow-up" },
      { type: "checkListItem", content: "Assign an owner and next checkpoint." },
    ],
  },
] as const;

function PageIcon({
  icon,
  size = "md",
}: {
  icon: ProjectDocumentIcon;
  size?: "md" | "lg";
}) {
  if (icon === "task") return <Icon icon="check" size={size} />;
  if (icon === "schedule") return <Icon icon="calendar" size={size} />;
  if (icon === "build") return <Icon icon="wrench" size={size} />;
  if (icon === "idea") return <Icon icon="info" size={size} />;
  return <Icon icon="viewColumns" size={size} />;
}

function DocumentSaveIcon({ state }: { state: DocumentSaveState }) {
  if (state === "connecting" || state === "saving") {
    return <Spinner size="sm" />;
  }
  if (state === "saved") return <Icon icon="check" size="sm" />;
  if (state === "error") return <Icon icon="close" size="sm" />;
  return <Icon icon="info" size="sm" />;
}

export function projectDocumentCollaborationUrl(
  location: Location = window.location,
): string {
  const configured = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env?.VITE_PROJECT_DOCUMENT_COLLAB_URL?.trim();
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/project-document-collaboration`;
}

function DocumentDiscussion({
  comments,
  context,
  draft,
  error,
  loading,
  submitting,
  onClose,
  onContextClear,
  onDelete,
  onDraftChange,
  onJumpToContext,
  onReply,
  onRetry,
  onResolve,
  onSubmit,
  reviewStatus,
  reviewRequestedAt,
  approvedAt,
  approvedByEmail,
  canReview,
  onReviewStatusChange,
  onApplyTemplate,
}: {
  comments: ProjectDocumentCommentView[];
  context: { blockId: string; quote?: string } | null;
  draft: string;
  error: string;
  loading: boolean;
  submitting: boolean;
  onClose: () => void;
  onContextClear: () => void;
  onDelete: (comment: ProjectDocumentCommentView) => Promise<void>;
  onDraftChange: (value: string) => void;
  onJumpToContext: (comment: ProjectDocumentCommentView) => void;
  onReply: (comment: ProjectDocumentCommentView, body: string) => Promise<boolean>;
  onRetry: () => void;
  onResolve: (comment: ProjectDocumentCommentView) => void;
  onSubmit: () => void;
  reviewStatus: ProjectDocumentReviewStatus;
  reviewRequestedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  canReview: boolean;
  onReviewStatusChange: (status: ProjectDocumentReviewStatus) => void;
  onApplyTemplate: (templateId: typeof documentReviewTemplates[number]["id"]) => void;
}) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const roots = comments.filter((comment) => comment.parentCommentId === null);
  const openComments = roots.filter((comment) => !comment.resolvedAt);
  const resolvedComments = roots.filter((comment) => comment.resolvedAt);
  const renderBody = (body: string) => body
    .split(/(@[A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?)/g)
    .map((part, index) => part.startsWith("@")
      ? <mark key={`${part}-${index}`}>{part}</mark>
      : part);
  return (
    <aside
      id="project-document-discussion"
      className="project-document-discussion"
      aria-label="Contextual review"
    >
      <header>
        <div>
          <strong>Review hub</strong>
          <span>{openComments.length} open · {reviewStatus === "in_review" ? "In review" : reviewStatus === "approved" ? "Approved" : "Draft"}</span>
        </div>
        <IconButton
          label="Close discussion"
          variant="ghost"
          size="sm"
          icon={<Icon icon="close" size="sm" />}
          onClick={onClose}
        />
      </header>
      <section className="project-document-review-workflow" aria-label="Review workflow">
        <div>
          <strong>Approval</strong>
          <span>
            {reviewStatus === "approved" && approvedAt
              ? `Approved${approvedByEmail ? ` by ${approvedByEmail}` : ""} on ${new Date(approvedAt).toLocaleDateString()}`
              : reviewStatus === "in_review" && reviewRequestedAt
                ? `Requested ${new Date(reviewRequestedAt).toLocaleDateString()}`
                : "Keep drafting, then request a team review."}
          </span>
        </div>
        <div className="project-document-review-workflow__actions">
          <Button label="Draft" size="sm" variant={reviewStatus === "draft" ? "primary" : "ghost"} isDisabled={!canReview} onClick={() => onReviewStatusChange("draft")} />
          <Button label="Request review" size="sm" variant={reviewStatus === "in_review" ? "primary" : "ghost"} isDisabled={!canReview} onClick={() => onReviewStatusChange("in_review")} />
          <Button label="Approve" size="sm" variant={reviewStatus === "approved" ? "primary" : "ghost"} isDisabled={!canReview || openComments.length > 0} onClick={() => onReviewStatusChange("approved")} />
        </div>
        {openComments.length > 0 ? <small>Resolve all open threads before approval.</small> : null}
      </section>
      <section className="project-document-review-templates" aria-label="Review templates">
        <strong>Start from a workspace template</strong>
        {documentReviewTemplates.map((template) => (
          <div className="project-document-review-template" key={template.id}>
            <Button label={template.title} variant="ghost" size="sm" onClick={() => onApplyTemplate(template.id)} isDisabled={!canReview} />
            <small>{template.description}</small>
          </div>
        ))}
      </section>
      {error ? (
        <div className="project-document-discussion__error">
          <p role="alert">{error}</p>
          <Button
            label="Retry"
            variant="ghost"
            size="sm"
            onClick={onRetry}
          />
        </div>
      ) : null}
      <form
        className="project-document-discussion__composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {context ? (
          <div className="project-document-discussion__context">
            <span>{context.quote ? `“${context.quote}”` : "Linked block"}</span>
            <button type="button" onClick={onContextClear}>Remove</button>
          </div>
        ) : null}
        <textarea
          aria-label="Add a review comment"
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Leave feedback or type @email to mention…"
          rows={3}
          maxLength={2000}
        />
        <Button
          type="submit"
          label="Comment"
          variant="primary"
          size="sm"
          isLoading={submitting}
          isDisabled={submitting || !draft.trim()}
        />
      </form>
      <div className="project-document-discussion__list">
        {loading ? <p>Loading discussion…</p> : null}
        {!loading && !roots.length ? (
          <div className="project-document-discussion__empty">
            <strong>No review threads yet</strong>
            <span>Select text or a block to start one.</span>
          </div>
        ) : null}
        {[...openComments, ...resolvedComments].map((comment) => (
          <article
            key={comment.id}
            className={
              comment.resolvedAt
                ? "project-document-comment project-document-comment--resolved"
                : "project-document-comment"
            }
          >
            <div
              className="project-document-comment__avatar"
              aria-hidden="true"
            >
              {collaboratorInitials(comment.authorEmail)}
            </div>
            <div>
              {comment.blockId ? (
                <button
                  type="button"
                  className="project-document-comment__anchor"
                  onClick={() => onJumpToContext(comment)}
                >
                  {comment.quote ? `“${comment.quote}”` : "Linked block"}
                </button>
              ) : null}
              <header>
                <strong>{comment.authorEmail}</strong>
                <time dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </header>
              <p>{renderBody(comment.body)}</p>
              <div className="project-document-comment__actions">
                <Button
                  label={comment.resolvedAt ? "Reopen" : "Resolve"}
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(comment)}
                />
                <Button
                  label="Reply"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyingTo(comment.id);
                    setReplyDraft("");
                  }}
                />
                {comment.canDelete ? (
                  <Button
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDelete(comment)}
                  />
                ) : null}
              </div>
              {comments
                .filter((reply) => reply.parentCommentId === comment.id)
                .map((reply) => (
                  <div className="project-document-comment__reply" key={reply.id}>
                    <header>
                      <strong>{reply.authorEmail}</strong>
                      <time dateTime={reply.createdAt}>
                        {new Date(reply.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </header>
                    <p>{renderBody(reply.body)}</p>
                    {reply.canDelete ? (
                      <Button
                        label="Delete"
                        variant="ghost"
                        size="sm"
                        onClick={() => void onDelete(reply)}
                      />
                    ) : null}
                  </div>
                ))}
              {replyingTo === comment.id ? (
                <form
                  className="project-document-comment__reply-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = replyDraft.trim();
                    if (!body) return;
                    void onReply(comment, body).then((created) => {
                      if (!created) return;
                      setReplyingTo(null);
                      setReplyDraft("");
                    });
                  }}
                >
                  <textarea
                    aria-label={`Reply to ${comment.authorEmail}`}
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.currentTarget.value)}
                    placeholder="Reply or type @email to mention…"
                    rows={2}
                    maxLength={2000}
                    autoFocus
                  />
                  <div>
                    <Button type="button" label="Cancel" variant="ghost" size="sm" onClick={() => setReplyingTo(null)} />
                    <Button type="submit" label="Reply" variant="primary" size="sm" isDisabled={!replyDraft.trim()} />
                  </div>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <section className="project-document-review-activity" aria-label="Review activity">
        <strong>Recent activity</strong>
        {comments.length ? comments.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5).map((comment) => (
          <span key={`activity-${comment.id}`}>
            {comment.authorEmail} {comment.resolvedAt ? "resolved a thread" : comment.parentCommentId ? "replied" : "commented"}
          </span>
        )) : <span>No review activity yet.</span>}
      </section>
    </aside>
  );
}

function CollaborativeProjectDocument({
  document,
  evidence,
  flows,
  initialPlatform,
  userName,
  onAttachCatalogFlow,
  onDocumentChange,
  pendingFlow,
  onPendingFlowConsumed,
}: {
  document: ProjectDocumentView;
  evidence: ReturnType<typeof projectDocumentEvidenceOptions>;
  flows: ProjectDocumentFlowOption[];
  initialPlatform: Platform;
  userName: string;
  onAttachCatalogFlow: (
    option: ProjectDocumentFlowOption,
  ) => Promise<ProjectDocumentFlowOption>;
  onDocumentChange: (document: ProjectDocumentView) => void;
  pendingFlow?: ProjectDocumentFlowInsertItem;
  onPendingFlowConsumed: () => void;
}) {
  const resolvedTheme = useResolvedThemeMode();
  const [saveState, setSaveState] = useState<DocumentSaveState>("connecting");
  const [lastPersistedAt, setLastPersistedAt] = useState<string>();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    { name: userName, color: collaboratorColor(userName) },
  ]);
  const [titleDraft, setTitleDraft] = useState(document.title);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [uiError, setUiError] = useState("");
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [projectAccessOpen, setProjectAccessOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [comments, setComments] = useState<ProjectDocumentCommentView[]>([]);
  const [discussionError, setDiscussionError] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentContext, setCommentContext] = useState<{
    blockId: string;
    quote?: string;
  } | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const cancelTitleCommitRef = useRef(false);
  const saveDelayTimerRef = useRef<number | undefined>(undefined);
  const insertedPendingFlowRef = useRef("");
  const clearSaveDelayTimer = useCallback(() => {
    if (saveDelayTimerRef.current === undefined) return;
    window.clearTimeout(saveDelayTimerRef.current);
    saveDelayTimerRef.current = undefined;
  }, []);
  const markSavePending = useCallback(() => {
    clearSaveDelayTimer();
    setSaveState("saving");
    saveDelayTimerRef.current = window.setTimeout(() => {
      setSaveState((current) => current === "saving" ? "delayed" : current);
    }, 6_000);
  }, [clearSaveDelayTimer]);
  const yDocument = useMemo(
    () => new Y.Doc(),
    [document.collaborationDocumentId],
  );
  const provider = useMemo(
    () =>
      new HocuspocusProvider({
        url: projectDocumentCollaborationUrl(),
        token: getAuthToken() ?? undefined,
        name: document.collaborationDocumentId,
        document: yDocument,
        onStatus: ({ status }) => {
          if (status === "disconnected") setSaveState("offline");
          else if (status === "connecting") setSaveState("connecting");
        },
        onSynced: () => {
          clearSaveDelayTimer();
          setSaveState("saved");
        },
        onStateless: ({ payload }) => {
          const message = parseProjectDocumentPersistenceMessage(payload);
          if (!message) return;
          if (message.type === "project-document.persistence-error") {
            clearSaveDelayTimer();
            setSaveState("error");
            return;
          }
          if (
            projectDocumentStateVectorCoversDocument(
              decodeProjectDocumentStateVector(message.stateVector),
              yDocument,
            )
          ) {
            clearSaveDelayTimer();
            setLastPersistedAt(message.persistedAt);
            setSaveState("saved");
          }
        },
        onDisconnect: () => {
          clearSaveDelayTimer();
          setSaveState("offline");
        },
      }),
    [clearSaveDelayTimer, document.collaborationDocumentId, yDocument],
  );
  const editor = useCreateBlockNote(
    withCollaboration({
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
    }),
    [provider, userName, yDocument],
  );

  useEffect(() => setTitleDraft(document.title), [document.title]);

  useEffect(() => {
    if (
      !pendingFlow
      || document.role !== "editor"
      || document.reviewStatus === "approved"
      || insertedPendingFlowRef.current === pendingFlow.id
    ) return;
    insertProjectDocumentFlowBlock(editor, pendingFlow);
    insertedPendingFlowRef.current = pendingFlow.id;
    onPendingFlowConsumed();
  }, [document.reviewStatus, document.role, editor, onPendingFlowConsumed, pendingFlow]);

  useEffect(() => {
    yDocument.on("update", markSavePending);
    return () => yDocument.off("update", markSavePending);
  }, [markSavePending, yDocument]);

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
      const hasOpenLayer =
        iconMenuOpen || actionsOpen || shareOpen || discussionOpen;
      if (!hasOpenLayer) return;
      event.preventDefault();
      setIconMenuOpen(false);
      setActionsOpen(false);
      setShareOpen(false);
      setDiscussionOpen(false);
    };
    window.document.addEventListener("keydown", closeTransientUi);
    return () =>
      window.document.removeEventListener("keydown", closeTransientUi);
  }, [actionsOpen, discussionOpen, iconMenuOpen, shareOpen]);

  useEffect(() => {
    const refreshCollaborators = () => {
      const next = Array.from(provider.awareness?.getStates().values() ?? [])
        .map((state) => (state as { user?: Partial<Collaborator> }).user)
        .filter((user): user is Collaborator =>
          Boolean(user?.name && user?.color),
        );
      const unique = Array.from(
        new Map(next.map((user) => [user.name, user])).values(),
      );
      setCollaborators(
        unique.length
          ? unique
          : [{ name: userName, color: collaboratorColor(userName) }],
      );
    };
    provider.awareness?.on("change", refreshCollaborators);
    refreshCollaborators();
    return () => provider.awareness?.off("change", refreshCollaborators);
  }, [provider, userName]);

  useEffect(
    () => () => {
      clearSaveDelayTimer();
      provider.destroy();
      yDocument.destroy();
    },
    [clearSaveDelayTimer, provider, yDocument],
  );

  const updateMetadata = async (patch: ProjectDocumentPatch) => {
    if (document.role !== "editor") return;
    setSavingMetadata(true);
    setUiError("");
    try {
      onDocumentChange(
        await updateProjectDocumentById(document.projectId, document.id, patch),
      );
    } catch (cause) {
      clearSaveDelayTimer();
      setSaveState("error");
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
    setDiscussionError("");
    try {
      setComments(
        await listProjectDocumentCommentsById(document.projectId, document.id),
      );
    } catch (cause) {
      setDiscussionError((cause as Error).message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const startContextReview = () => {
    const selectedBlock = editor.getSelection()?.blocks[0]
      ?? editor.getTextCursorPosition().block;
    const quote = editor.getSelectedText().trim().slice(0, 500);
    setCommentContext({
      blockId: selectedBlock.id,
      ...(quote ? { quote } : {}),
    });
    void openDiscussion();
  };

  const submitComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;
    setCommentSubmitting(true);
    setDiscussionError("");
    try {
      const comment = await addProjectDocumentCommentById(
        document.projectId,
        document.id,
        body,
        commentContext ?? {},
      );
      setComments((current) => [...current, comment]);
      setCommentDraft("");
      setCommentContext(null);
    } catch (cause) {
      setDiscussionError((cause as Error).message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const replyToComment = async (
    comment: ProjectDocumentCommentView,
    body: string,
  ) => {
    setDiscussionError("");
    try {
      const reply = await addProjectDocumentCommentById(
        document.projectId,
        document.id,
        body,
        { parentCommentId: comment.id },
      );
      setComments((current) => [...current, reply]);
      return true;
    } catch (cause) {
      setDiscussionError((cause as Error).message);
      return false;
    }
  };

  const deleteComment = async (comment: ProjectDocumentCommentView) => {
    setDiscussionError("");
    try {
      await deleteProjectDocumentCommentById(
        document.projectId,
        document.id,
        comment.id,
      );
      setComments((current) => current.filter((item) =>
        item.id !== comment.id && item.parentCommentId !== comment.id));
    } catch (cause) {
      setDiscussionError((cause as Error).message);
    }
  };

  const jumpToCommentContext = (comment: ProjectDocumentCommentView) => {
    if (!comment.blockId) return;
    try {
      editor.setTextCursorPosition(comment.blockId, "start");
    } catch {
      setDiscussionError("The linked block is no longer in this document");
      return;
    }
    const linkedBlock = window.document.querySelector<HTMLElement>(
      `[data-id="${comment.blockId}"]`,
    );
    linkedBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
    linkedBlock?.classList.add("project-document-comment-anchor--active");
    window.setTimeout(
      () => linkedBlock?.classList.remove("project-document-comment-anchor--active"),
      1800,
    );
  };

  const toggleComment = async (comment: ProjectDocumentCommentView) => {
    setDiscussionError("");
    try {
      const updated = await resolveProjectDocumentCommentById(
        document.projectId,
        document.id,
        comment.id,
        !comment.resolvedAt,
      );
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (cause) {
      setDiscussionError((cause as Error).message);
    }
  };

  const applyReviewTemplate = (
    templateId: typeof documentReviewTemplates[number]["id"],
  ) => {
    const template = documentReviewTemplates.find(({ id }) => id === templateId);
    const target = editor.document.at(-1);
    if (!template || !target || document.role !== "editor") return;
    editor.insertBlocks(
      template.blocks.map((block) => ({ ...block })) as Parameters<typeof editor.insertBlocks>[0],
      target,
      "after",
    );
    setDiscussionOpen(false);
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

  const displayedSaveState = savingMetadata ? "saving" : saveState;
  const saveStatusLabel: Record<DocumentSaveState, string> = {
    connecting: "Connecting",
    saving: "Saving",
    saved: "Saved",
    offline: "Offline",
    delayed: "Still saving",
    error: "Save failed",
  };
  const saveStatusTitle = displayedSaveState === "saved" && lastPersistedAt
    ? `Saved to Vitrines at ${new Date(lastPersistedAt).toLocaleTimeString()}`
    : saveStatusLabel[displayedSaveState];

  return (
    <section
      className={`project-document project-document--${document.pageWidth}`}
      aria-label="Collaborative project document"
    >
      <header className="project-document-page__topbar">
        <nav
          className="project-document-breadcrumb"
          aria-label="Document breadcrumb"
        >
          <button
            type="button"
            className="project-document-breadcrumb__root"
            onClick={() => navigate({ name: "projects" })}
          >
            <Icon icon="chevronLeft" size="sm" />
            <span className="project-document-breadcrumb__root-label">
              Projects
            </span>
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            className="project-document-breadcrumb__document"
            onClick={() =>
              navigate({ name: "project", projectId: document.projectId })
            }
          >
            {document.title}
          </button>
        </nav>
        <div className="project-document-actions">
          <span
            className={`project-document__connection project-document__connection--${displayedSaveState}`}
            data-testid="project-document-connection"
            role="status"
            aria-live="polite"
            aria-label={saveStatusLabel[displayedSaveState]}
            title={saveStatusTitle}
          >
            <DocumentSaveIcon state={displayedSaveState} />
          </span>
          <div
            className="project-document-collaborators"
            data-testid="project-document-collaborators"
          >
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
              {collaborators.length}{" "}
              {collaborators.length === 1 ? "collaborator" : "collaborators"}
            </span>
          </div>
          <Button
            className="project-document-action project-document-action--favorite"
            label={document.isFavorite ? "Favorited" : "Favorite"}
            variant={document.isFavorite ? "primary" : "ghost"}
            size="sm"
            aria-pressed={document.isFavorite}
            onClick={() =>
              void updateMetadata({ isFavorite: !document.isFavorite })
            }
            isDisabled={document.role !== "editor" || savingMetadata}
          />
          <Button
            className="project-document-action project-document-action--review"
            label={document.reviewStatus === "in_review" ? "In review" : document.reviewStatus === "approved" ? "Approved" : "Review"}
            variant={document.reviewStatus === "draft" ? "ghost" : "secondary"}
            size="sm"
            aria-expanded={discussionOpen}
            aria-controls="project-document-discussion"
            onClick={() => void openDiscussion()}
          />
          <div className="project-document-popover-anchor">
            <Button
              className="project-document-action project-document-action--share"
              label="Share"
              variant="ghost"
              size="sm"
              aria-expanded={shareOpen}
              onClick={() => {
                setShareOpen((open) => !open);
                setActionsOpen(false);
                setIconMenuOpen(false);
              }}
            />
            {shareOpen ? (
              <div
                className="project-document-popover project-document-share"
                role="dialog"
                aria-label="Share document"
              >
                <strong>Share this page</strong>
                <p>
                  Anyone who already has access to this project can open this
                  link.
                </p>
                <Button
                  label="Manage access"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShareOpen(false);
                    setProjectAccessOpen(true);
                  }}
                />
                <Button
                  label={copied ? "Copied" : "Copy link"}
                  variant="ghost"
                  size="sm"
                  clickAction={() => copyLink()}
                />
              </div>
            ) : null}
          </div>
          <div className="project-document-popover-anchor">
            <IconButton
              label="Document actions"
              variant="ghost"
              size="sm"
              icon={<Icon icon="moreHorizontal" size="sm" />}
              aria-expanded={actionsOpen}
              onClick={() => {
                setActionsOpen((open) => !open);
                setShareOpen(false);
                setIconMenuOpen(false);
              }}
            />
            {actionsOpen ? (
              <div
                className="project-document-popover project-document-actions-menu"
                role="menu"
                aria-label="Document settings"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="project-document-actions-menu__mobile-action"
                  onClick={() => {
                    void updateMetadata({ isFavorite: !document.isFavorite });
                    setActionsOpen(false);
                  }}
                  disabled={document.role !== "editor" || savingMetadata}
                >
                  {document.isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="project-document-actions-menu__mobile-action"
                  onClick={() => {
                    void copyLink();
                    setActionsOpen(false);
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <span>Page width</span>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={document.pageWidth === "standard"}
                  onClick={() => {
                    void updateMetadata({ pageWidth: "standard" });
                    setActionsOpen(false);
                  }}
                >
                  Standard{" "}
                  {document.pageWidth === "standard" ? (
                    <Icon icon="check" size="xsm" />
                  ) : null}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={document.pageWidth === "full"}
                  onClick={() => {
                    void updateMetadata({ pageWidth: "full" });
                    setActionsOpen(false);
                  }}
                >
                  Full width{" "}
                  {document.pageWidth === "full" ? (
                    <Icon icon="check" size="xsm" />
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {uiError ? (
        <p role="alert" className="project-document-page__error">
          {uiError}
        </p>
      ) : null}

      <div className="project-document__workspace">
        <article className="project-document__page">
          {document.icon !== "none" ? (
            <IconButton
              className="project-document__page-icon"
              label="Change page icon"
              variant="ghost"
              icon={<PageIcon icon={document.icon} size="lg" />}
              aria-expanded={iconMenuOpen}
              onClick={() => {
                setIconMenuOpen((open) => !open);
                setActionsOpen(false);
                setShareOpen(false);
              }}
            />
          ) : null}

          <div className="project-document__page-controls">
            <Button
              label="Insert from Vitrines"
              variant="ghost"
              size="sm"
              onClick={() => insertProjectDocumentEvidenceBlock(editor)}
              isDisabled={document.role !== "editor"}
            />
            <div className="project-document-popover-anchor">
              <Button
                label={document.icon === "none" ? "Add icon" : "Change icon"}
                variant="ghost"
                size="sm"
                aria-expanded={iconMenuOpen}
                onClick={() => {
                  setIconMenuOpen((open) => !open);
                  setActionsOpen(false);
                  setShareOpen(false);
                }}
                isDisabled={document.role !== "editor"}
              />
              {iconMenuOpen ? (
                <div
                  className="project-document-popover project-document-icon-menu"
                  role="menu"
                  aria-label="Page icon"
                >
                  {pageIcons.map((option) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={document.icon === option.value}
                      key={option.value}
                      onClick={() => {
                        void updateMetadata({ icon: option.value });
                        setIconMenuOpen(false);
                      }}
                    >
                      {option.value !== "none" ? (
                        <PageIcon icon={option.value} />
                      ) : null}
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button
              label="Comment on selection"
              variant="ghost"
              size="sm"
              aria-expanded={discussionOpen}
              aria-controls="project-document-discussion"
              clickAction={startContextReview}
            />
          </div>

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

          <div
            className="project-document__editor"
            data-testid="project-document-editor"
          >
            <ProjectDocumentFlowProvider
              evidence={evidence}
              flows={flows}
              initialPlatform={initialPlatform}
              onAttachCatalogFlow={onAttachCatalogFlow}
            >
              <BlockNoteView
                editor={editor}
                editable={document.role === "editor" && document.reviewStatus !== "approved"}
                formattingToolbar
                linkToolbar
                slashMenu={false}
                sideMenu
                filePanel
                tableHandles
                emojiPicker
                theme={resolvedTheme}
              >
                <SuggestionMenuController
                  triggerCharacter="/"
                  getItems={async (query) =>
                    projectDocumentSlashMenuItems(editor, query)
                  }
                />
              </BlockNoteView>
            </ProjectDocumentFlowProvider>
          </div>
        </article>

        {discussionOpen ? (
          <DocumentDiscussion
            comments={comments}
            context={commentContext}
            draft={commentDraft}
            error={discussionError}
            loading={commentsLoading}
            submitting={commentSubmitting}
            onClose={() => setDiscussionOpen(false)}
            onContextClear={() => setCommentContext(null)}
            onDelete={deleteComment}
            onDraftChange={setCommentDraft}
            onJumpToContext={jumpToCommentContext}
            onReply={replyToComment}
            onRetry={() => void openDiscussion()}
            onResolve={(comment) => void toggleComment(comment)}
            onSubmit={() => void submitComment()}
            reviewStatus={document.reviewStatus}
            reviewRequestedAt={document.reviewRequestedAt}
            approvedAt={document.approvedAt}
            approvedByEmail={document.approvedByEmail}
            canReview={document.role === "editor" && !savingMetadata && !commentsLoading}
            onReviewStatusChange={(reviewStatus) => void updateMetadata({ reviewStatus })}
            onApplyTemplate={applyReviewTemplate}
          />
        ) : null}
      </div>
      <ProjectAccessDialog
        project={{ id: document.projectId, title: document.title }}
        isOpen={projectAccessOpen}
        onOpenChange={setProjectAccessOpen}
      />
    </section>
  );
}

export function ProjectDocumentPage({
  projectId,
  documentId,
  userName,
}: {
  projectId: string;
  documentId?: number;
  userName: string;
}) {
  const [document, setDocument] = useState<ProjectDocumentView>();
  const [workspace, setWorkspace] = useState<ResearchProjectWorkspace>();
  const [flowPlatform, setFlowPlatform] = useState<Platform>("web");
  const [error, setError] = useState("");
  const [pendingFlow, setPendingFlow] = useState<ProjectDocumentFlowInsertItem>();
  const flows = useMemo(
    () => (workspace ? projectDocumentFlowOptions(workspace) : []),
    [workspace],
  );
  const evidence = useMemo(
    () => (workspace ? projectDocumentEvidenceOptions(workspace) : []),
    [workspace],
  );

  useEffect(() => {
    let active = true;
    setDocument(undefined);
    setWorkspace(undefined);
    setFlowPlatform("web");
    setError("");
    void Promise.all([
      documentId
        ? getProjectDocument(projectId, documentId)
        : ensureProjectDocument(projectId),
      getResearchProject(projectId),
    ])
      .then(([nextDocument, workspace]) => {
        if (!active) return;
        setDocument(nextDocument);
        setWorkspace(workspace);
        setFlowPlatform(
          workspace.platformFilter === "all" ? "web" : workspace.platformFilter,
        );
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [documentId, projectId]);

  useEffect(() => {
    setPendingFlow(consumeProjectDocumentFlowInsertIntent(projectId));
  }, [projectId]);

  const attachCatalogFlowOption = useCallback(
    async (
      option: ProjectDocumentFlowOption,
    ): Promise<ProjectDocumentFlowOption> => {
      if (!workspace || !option.catalog) {
        throw new Error("This catalog flow cannot be attached.");
      }
      const attach = (current: ResearchProjectWorkspace) => {
        const lane = [...current.lanes].sort(
          (left, right) => left.position - right.position,
        )[0];
        if (!lane)
          throw new Error("Add a research lane before attaching a flow.");
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
        if (
          !(cause instanceof ResearchProjectApiError) ||
          cause.code !== "revision_conflict" ||
          !cause.project
        )
          throw cause;
        updated = await attach(cause.project);
      }
      setWorkspace(updated);
      const attached = projectDocumentFlowOptions(updated).find(
        (candidate) =>
          candidate.app === option.app && candidate.title === option.title,
      );
      if (!attached)
        throw new Error(
          "The flow was attached but its project reference could not be loaded.",
        );
      return { ...attached, platform: option.platform };
    },
    [workspace],
  );

  if (!document && !error) {
    return (
      <main className="vitrine-page project-document-page project-document-page--loading">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="vitrine-page project-document-page">
      {error ? (
        <p role="alert" className="project-document-page__error">
          {error}
        </p>
      ) : null}
      {document ? (
        <CollaborativeProjectDocument
          document={document}
          evidence={evidence}
          flows={flows}
          initialPlatform={flowPlatform}
          userName={userName}
          onAttachCatalogFlow={attachCatalogFlowOption}
          onDocumentChange={setDocument}
          pendingFlow={pendingFlow}
          onPendingFlowConsumed={() => setPendingFlow(undefined)}
        />
      ) : null}
    </main>
  );
}
