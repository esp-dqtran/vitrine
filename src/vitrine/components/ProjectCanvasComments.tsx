import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Button,
  Icon,
  IconButton,
  TextArea,
  TextInput,
} from "@astryxdesign/core";

import type { DesignerCanvasCommentThread } from "../../designerCanvas.ts";
import figjamCommentToolIcon from "../assets/figjam-comment-tool.svg";

export function ProjectCanvasCommentGlyph() {
  return (
    <img
      className="project-canvas-comment-glyph"
      src={figjamCommentToolIcon}
      alt=""
      aria-hidden="true"
    />
  );
}

export function ProjectCanvasCommentPin({
  index,
  thread,
  active,
  style,
  onSelect,
}: {
  index: number;
  thread: DesignerCanvasCommentThread;
  active: boolean;
  style: CSSProperties;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      className="project-canvas-comment-pin"
      data-active={active}
      data-resolved={thread.resolved}
      style={style}
      aria-label={`Open comment ${index}`}
      onClick={onSelect}
    >
      {thread.resolved ? <Icon icon="success" size="sm" /> : index}
    </button>
  );
}

export function ProjectCanvasCommentInbox({
  threads,
  onSelectThread,
  onClose,
}: {
  threads: readonly DesignerCanvasCommentThread[];
  onSelectThread(threadId: string): void;
  onClose(): void;
}) {
  const [query, setQuery] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleThreads = useMemo(
    () =>
      threads.filter((thread) => {
        if (!showResolved && thread.resolved) return false;
        if (!normalizedQuery) return true;
        return thread.messages.some((message) =>
          `${message.authorName} ${message.body}`
            .toLowerCase()
            .includes(normalizedQuery),
        );
      }),
    [normalizedQuery, showResolved, threads],
  );

  return (
    <aside
      className="project-canvas-comment-inbox"
      aria-label="Comments"
      role="dialog"
      aria-modal="false"
    >
      <header>
        <div className="project-canvas-comment-inbox__topbar">
          <div>
            <strong>Comments</strong>
            <span>{visibleThreads.length}</span>
          </div>
          <div>
            <button
              type="button"
              className="project-canvas-comment-inbox__icon-button"
              aria-label={
                showResolved
                  ? "Hide resolved comments"
                  : "Show resolved comments"
              }
              aria-pressed={showResolved}
              onClick={() => setShowResolved((current) => !current)}
            >
              <Icon icon="funnel" size="sm" />
            </button>
            <span className="project-canvas-comment-inbox__menu">
              <button
                type="button"
                className="project-canvas-comment-inbox__icon-button"
                aria-label="Comment options"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <Icon icon="moreHorizontal" size="sm" />
              </button>
              {menuOpen ? (
                <span
                  className="project-canvas-comment-inbox__menu-popover"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showResolved}
                    onClick={() => {
                      setShowResolved((current) => !current);
                      setMenuOpen(false);
                    }}
                  >
                    {showResolved
                      ? "Hide resolved comments"
                      : "Show resolved comments"}
                  </button>
                  <button type="button" role="menuitem" onClick={onClose}>
                    Close comments
                  </button>
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="project-canvas-comment-inbox__icon-button"
              aria-label="Close comments"
              onClick={onClose}
            >
              <Icon icon="close" size="sm" />
            </button>
          </div>
        </div>
        <TextInput
          label="Search comments"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder="Search comments"
          startIcon={<Icon icon="search" size="sm" />}
          hasClear={Boolean(query)}
          size="sm"
          width="100%"
        />
      </header>

      <div className="project-canvas-comment-inbox__body">
        {visibleThreads.length ? (
          <div className="project-canvas-comment-inbox__threads">
            {visibleThreads.map((thread) => {
              const latestMessage =
                thread.messages.at(-1) ?? thread.messages[0];
              return (
                <button
                  key={thread.id}
                  type="button"
                  className="project-canvas-comment-inbox__thread"
                  onClick={() => onSelectThread(thread.id)}
                >
                  <span
                    className="project-canvas-comment-inbox__avatar"
                    aria-hidden="true"
                  >
                    {latestMessage?.authorName.trim().charAt(0).toUpperCase() ||
                      "?"}
                  </span>
                  <span>
                    <strong>{latestMessage?.authorName || "Comment"}</strong>
                    <span>{latestMessage?.body || "Open comment"}</span>
                  </span>
                  {thread.resolved ? <small>Resolved</small> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="project-canvas-comment-inbox__empty">
            <ProjectCanvasCommentGlyph />
            <p>
              {normalizedQuery
                ? "No comments match your search."
                : "Give feedback, ask a question, or just leave a note of appreciation. Click anywhere in the file to leave a comment."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function ProjectCanvasCommentPanel({
  thread,
  draft,
  style,
  onDraftChange,
  onSubmit,
  onResolve,
  onDelete,
  onBack,
  onClose,
}: {
  thread?: DesignerCanvasCommentThread;
  draft: string;
  style?: CSSProperties;
  onDraftChange(value: string): void;
  onSubmit(value: string): void;
  onResolve(): void;
  onDelete(): void;
  onBack?(): void;
  onClose(): void;
}) {
  const [reply, setReply] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const value = thread ? reply : draft;
  const setValue = thread ? setReply : onDraftChange;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [thread?.id]);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    if (thread) setReply("");
  };
  const deleteThread = () => {
    setConfirmingDelete(false);
    onDelete();
  };
  if (!thread) {
    return (
      <aside
        className="project-canvas-comments project-canvas-comments--composer"
        aria-label="New comment"
        style={style}
      >
        <span
          className="project-canvas-comments__composer-pin"
          aria-hidden="true"
        >
          <ProjectCanvasCommentGlyph />
        </span>
        <textarea
          autoFocus
          aria-label="Add a comment"
          placeholder="Add a comment"
          rows={1}
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="project-canvas-comments__composer-send"
          aria-label="Send"
          disabled={!draft.trim()}
          onClick={submit}
        >
          <Icon icon="arrowUp" size="sm" />
        </button>
      </aside>
    );
  }
  return (
    <aside
      className="project-canvas-comments project-canvas-comments--thread"
      aria-label={thread ? "Comment thread" : "New comment"}
      style={style}
    >
      <header>
        <div>
          <strong>Comments</strong>
          <span>
            {thread
              ? thread.resolved
                ? "Resolved"
                : "Discussion"
              : "New thread"}
          </span>
        </div>
        <div className="project-canvas-comments__header-actions">
          {onBack ? (
            <IconButton
              label="Back to comments"
              icon={<Icon icon="chevronLeft" size="sm" />}
              variant="ghost"
              size="sm"
              clickAction={onBack}
            />
          ) : null}
          <IconButton
            label="Close comments"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            size="sm"
            clickAction={onClose}
          />
        </div>
      </header>
      {thread ? (
        <div className="project-canvas-comments__messages">
          {thread.messages.map((message) => (
            <article key={message.id}>
              <strong>{message.authorName}</strong>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      ) : null}
      <TextArea
        label={thread ? "Reply" : "Comment"}
        isLabelHidden
        value={value}
        onChange={setValue}
        placeholder={thread ? "Reply to this thread…" : "Leave a comment…"}
        rows={3}
        width="100%"
        autoFocus
      />
      <footer data-confirming-delete={confirmingDelete || undefined}>
        {thread && confirmingDelete ? (
          <>
            <span className="project-canvas-comments__delete-prompt">
              Delete this thread?
            </span>
            <div className="project-canvas-comments__delete-actions">
              <Button
                label="Cancel"
                variant="secondary"
                size="sm"
                clickAction={() => setConfirmingDelete(false)}
              />
              <Button
                label="Delete thread"
                variant="destructive"
                size="sm"
                clickAction={deleteThread}
              />
            </div>
          </>
        ) : (
          <>
            {thread ? (
              <div className="project-canvas-comments__thread-actions">
                <Button
                  label="Delete"
                  variant="destructive"
                  size="sm"
                  clickAction={() => setConfirmingDelete(true)}
                />
                <Button
                  label={thread.resolved ? "Reopen" : "Resolve"}
                  variant="secondary"
                  size="sm"
                  clickAction={onResolve}
                />
              </div>
            ) : (
              <span />
            )}
            <Button
              label={thread ? "Reply" : "Comment"}
              variant="primary"
              size="sm"
              isDisabled={!value.trim()}
              clickAction={submit}
            />
          </>
        )}
      </footer>
    </aside>
  );
}
