import { useState, type CSSProperties } from "react";
import { Button, Icon, IconButton, TextArea } from "@astryxdesign/core";

import type { DesignerCanvasCommentThread } from "../../designerCanvas.ts";

export function ProjectCanvasCommentGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 4.75h14v10.5H9.25L5 19.25V4.75Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M8 8.25h8M8 11.5h5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
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

export function ProjectCanvasCommentPanel({
  thread,
  draft,
  onDraftChange,
  onSubmit,
  onResolve,
  onClose,
}: {
  thread?: DesignerCanvasCommentThread;
  draft: string;
  onDraftChange(value: string): void;
  onSubmit(value: string): void;
  onResolve(): void;
  onClose(): void;
}) {
  const [reply, setReply] = useState("");
  const value = thread ? reply : draft;
  const setValue = thread ? setReply : onDraftChange;
  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    if (thread) setReply("");
  };
  return (
    <aside className="project-canvas-comments" aria-label={thread ? "Comment thread" : "New comment"}>
      <header>
        <div>
          <span>Canvas comment</span>
          <strong>{thread ? (thread.resolved ? "Resolved" : "Discussion") : "New thread"}</strong>
        </div>
        <IconButton
          label="Close comments"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          clickAction={onClose}
        />
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
      <footer>
        {thread ? (
          <Button
            label={thread.resolved ? "Reopen" : "Resolve"}
            variant="secondary"
            size="sm"
            clickAction={onResolve}
          />
        ) : <span />}
        <Button
          label={thread ? "Reply" : "Comment"}
          variant="primary"
          size="sm"
          isDisabled={!value.trim()}
          clickAction={submit}
        />
      </footer>
    </aside>
  );
}
