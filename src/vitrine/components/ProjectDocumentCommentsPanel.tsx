import { useState } from "react";
import {
  Button,
  HStack,
  Icon,
  IconButton,
  Text,
} from "@astryxdesign/core";

import type {
  ProjectDocumentComment,
  ProjectDocumentCommentAnchor,
} from "../../projectDocument.ts";

function commentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ProjectDocumentCommentsPanel({
  comments,
  anchor,
  error,
  submitting = false,
  onClose,
  onSubmit,
  onResolve,
  onClearAnchor,
  onSelectAnchor,
}: {
  comments: readonly ProjectDocumentComment[];
  anchor?: ProjectDocumentCommentAnchor;
  error?: string;
  submitting?: boolean;
  onClose(): void;
  onSubmit(
    body: string,
    anchor?: ProjectDocumentCommentAnchor,
  ): boolean | Promise<boolean>;
  onResolve(commentId: number, resolved: boolean): void | Promise<void>;
  onClearAnchor?(): void;
  onSelectAnchor?(blockId: string): void;
}) {
  const [draft, setDraft] = useState("");
  const unresolved = comments.filter((comment) => !comment.resolvedAt);
  const resolved = comments.filter((comment) => comment.resolvedAt);
  const submit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    if (await onSubmit(body, anchor)) {
      setDraft("");
      onClearAnchor?.();
    }
  };

  const renderComment = (comment: ProjectDocumentComment) => (
    <article
      key={comment.id}
      className="project-document-comment"
      data-resolved={Boolean(comment.resolvedAt)}
    >
      <HStack justify="between" align="start" gap={2}>
        <div>
          <Text type="label" weight="semibold">
            {comment.authorEmail}
          </Text>
          <Text type="supporting">{commentDate(comment.createdAt)}</Text>
        </div>
        <Button
          label={comment.resolvedAt ? "Reopen" : "Resolve"}
          variant="ghost"
          size="sm"
          onClick={() =>
            void onResolve(comment.id, !comment.resolvedAt)
          }
        />
      </HStack>
      {comment.blockId ? (
        <button
          type="button"
          className="project-document-comment-anchor"
          onClick={() => onSelectAnchor?.(comment.blockId!)}
        >
          <Icon icon="externalLink" size="sm" />
          <span>
            {comment.quote
              ? `“${comment.quote}”`
              : "Open commented block"}
          </span>
        </button>
      ) : null}
      <p>{comment.body}</p>
    </article>
  );

  return (
    <aside
      className="project-document-comments-panel"
      aria-label="Document comments"
    >
      <header>
        <HStack gap={2} align="center">
          <Icon icon="info" size="sm" />
          <div>
            <Text as="h2" type="label" weight="semibold">
              Comments
            </Text>
            <Text type="supporting">
              {unresolved.length} open · {resolved.length} resolved
            </Text>
          </div>
        </HStack>
        <IconButton
          label="Close comments"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </header>

      <div className="project-document-comment-composer">
        {error ? (
          <Text
            className="project-document-comment-error"
            color="secondary"
            type="supporting"
          >
            {error}
          </Text>
        ) : null}
        <label htmlFor="project-document-comment-draft">Add a comment</label>
        {anchor ? (
          <div className="project-document-comment-composer-anchor">
            <div>
              <Text type="supporting" weight="semibold">
                Commenting on selection
              </Text>
              <blockquote>{anchor.quote ?? "Selected block"}</blockquote>
            </div>
            <IconButton
              label="Clear comment selection"
              icon={<Icon icon="close" size="sm" />}
              variant="ghost"
              size="sm"
              onClick={onClearAnchor}
            />
          </div>
        ) : null}
        <textarea
          id="project-document-comment-draft"
          value={draft}
          maxLength={2000}
          placeholder="Ask a question or leave feedback…"
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <HStack justify="between" align="center">
          <Text type="supporting">{draft.length}/2000</Text>
          <Button
            label={submitting ? "Commenting…" : "Comment"}
            variant="primary"
            size="sm"
            isDisabled={!draft.trim() || submitting}
            onClick={() => void submit()}
          />
        </HStack>
      </div>

      <div className="project-document-comments-list">
        {unresolved.length > 0 ? (
          <section aria-labelledby="project-document-open-comments">
            <Text
              id="project-document-open-comments"
              type="supporting"
              weight="semibold"
            >
              Open
            </Text>
            {unresolved.map(renderComment)}
          </section>
        ) : (
          <div className="project-document-comments-empty">
            <Icon icon="checkDouble" size="md" />
            <Text type="label" weight="semibold">
              No open comments
            </Text>
            <Text type="supporting">
              Questions and feedback will appear here.
            </Text>
          </div>
        )}
        {resolved.length > 0 ? (
          <section aria-labelledby="project-document-resolved-comments">
            <Text
              id="project-document-resolved-comments"
              type="supporting"
              weight="semibold"
            >
              Resolved
            </Text>
            {resolved.map(renderComment)}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
