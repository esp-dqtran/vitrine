import { Button, Icon, TextInput } from "@astryxdesign/core";
import {
  BookmarkIcon,
  CommentIcon,
  EyeCloseIcon,
  EyeIcon,
  HeartIcon,
  LightningIcon,
  QuestionIcon,
  ThumbsUpIcon,
  UserIcon,
} from "@storybook/icons";
import { useEffect, useState, type CSSProperties } from "react";

import { AstryxDropdown, AstryxDropdownItem } from "./AstryxDropdown.tsx";
import {
  projectStickyNoteColors,
  type ProjectStickyNoteColor,
} from "./ProjectStickyNotePicker.tsx";

export type ProjectStickyNoteFont = "sans" | "sketch";
export type ProjectStickyNoteFontSize = 16 | 20 | 28;
export type ProjectStickyNoteTextAlign = "left" | "center" | "right";

export interface ProjectStickyNoteFormat {
  font: ProjectStickyNoteFont;
  fontSize: ProjectStickyNoteFontSize;
  textAlign: ProjectStickyNoteTextAlign;
  link: string;
  locked: boolean;
}

export type ProjectStickyNoteReactionId =
  | "agree"
  | "love"
  | "question"
  | "idea";

export interface ProjectStickyNoteComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface ProjectStickyNoteCollaboration {
  showAuthor: boolean;
  author: string;
  tags: string[];
  reactions: ProjectStickyNoteReactionId[];
  comments: ProjectStickyNoteComment[];
}

export function defaultProjectStickyNoteCollaboration(): ProjectStickyNoteCollaboration {
  return {
    showAuthor: false,
    author: "You",
    tags: [],
    reactions: [],
    comments: [],
  };
}

const projectStickyNoteReactionOptions = [
  { id: "agree", label: "Agree", icon: ThumbsUpIcon },
  { id: "love", label: "Love", icon: HeartIcon },
  { id: "question", label: "Question", icon: QuestionIcon },
  { id: "idea", label: "Idea", icon: LightningIcon },
] as const;

export function normalizeProjectStickyNoteCollaboration(
  value?: Partial<ProjectStickyNoteCollaboration>,
): ProjectStickyNoteCollaboration {
  const defaults = defaultProjectStickyNoteCollaboration();
  const reactionIds = new Set<ProjectStickyNoteReactionId>(
    projectStickyNoteReactionOptions.map((option) => option.id),
  );
  return {
    showAuthor: value?.showAuthor === true,
    author:
      typeof value?.author === "string" && value.author.trim()
        ? value.author.trim().slice(0, 80)
        : defaults.author,
    tags: Array.isArray(value?.tags)
      ? [
          ...new Set(
            value.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.trim().slice(0, 32))
              .filter(Boolean),
          ),
        ].slice(0, 8)
      : defaults.tags,
    reactions: Array.isArray(value?.reactions)
      ? [
          ...new Set(
            value.reactions.filter(
              (reaction): reaction is ProjectStickyNoteReactionId =>
                reactionIds.has(reaction as ProjectStickyNoteReactionId),
            ),
          ),
        ]
      : defaults.reactions,
    comments: Array.isArray(value?.comments)
      ? value.comments
          .flatMap((comment) => {
            if (
              !comment ||
              typeof comment.id !== "string" ||
              typeof comment.body !== "string" ||
              !comment.body.trim()
            )
              return [];
            return [
              {
                id: comment.id,
                body: comment.body.trim().slice(0, 500),
                author:
                  typeof comment.author === "string" && comment.author.trim()
                    ? comment.author.trim().slice(0, 80)
                    : defaults.author,
                createdAt:
                  typeof comment.createdAt === "string"
                    ? comment.createdAt
                    : new Date().toISOString(),
              },
            ];
          })
          .slice(-24)
      : defaults.comments,
  };
}

export function ProjectStickyNoteMetadata({
  collaboration,
  style,
}: {
  collaboration: ProjectStickyNoteCollaboration;
  style?: CSSProperties;
}) {
  const hasMetadata =
    collaboration.showAuthor ||
    collaboration.tags.length > 0 ||
    collaboration.reactions.length > 0 ||
    collaboration.comments.length > 0;
  if (!hasMetadata) return null;

  return (
    <div
      className="project-sticky-note-metadata"
      style={style}
      aria-label="Sticky note collaboration"
    >
      {collaboration.showAuthor ? (
        <span title={`Author: ${collaboration.author}`}>
          <UserIcon />
          {collaboration.author}
        </span>
      ) : null}
      {collaboration.tags.slice(0, 2).map((tag) => (
        <span key={tag} title={`Tag: ${tag}`}>
          <BookmarkIcon />
          {tag}
        </span>
      ))}
      {collaboration.tags.length > 2 ? (
        <span>+{collaboration.tags.length - 2}</span>
      ) : null}
      {collaboration.reactions.length ? (
        <span title={`${collaboration.reactions.length} reactions`}>
          <HeartIcon />
          {collaboration.reactions.length}
        </span>
      ) : null}
      {collaboration.comments.length ? (
        <span title={`${collaboration.comments.length} comments`}>
          <CommentIcon />
          {collaboration.comments.length}
        </span>
      ) : null}
    </div>
  );
}

function stickyNoteCommentTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const defaultProjectStickyNoteFormat: ProjectStickyNoteFormat = {
  font: "sans",
  fontSize: 20,
  textAlign: "center",
  link: "",
  locked: false,
};

export const projectStickyNoteFontFamilies = {
  sans: 2,
  sketch: 1,
} as const;

function normalizedStickyNoteLink(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^(?:https?:\/\/|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/*
 * The compact contextual shell is shared by Canvas objects. Sticky notes add
 * collaboration controls, while text and future objects use the same type,
 * link and colour controls without inheriting note-specific behaviour.
 */
export function ProjectObjectToolbar({
  color,
  format,
  style,
  collaboration,
  ariaLabel = "Object formatting",
  objectLabel = "Object",
  colorOptions = projectStickyNoteColors,
  onColorChange,
  onFormatChange,
  onCollaborationChange,
}: {
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
  style?: CSSProperties;
  collaboration?: ProjectStickyNoteCollaboration;
  ariaLabel?: string;
  objectLabel?: string;
  colorOptions?: readonly ProjectStickyNoteColor[];
  onColorChange(color: ProjectStickyNoteColor): void;
  onFormatChange(format: ProjectStickyNoteFormat): void;
  onCollaborationChange?(collaboration: ProjectStickyNoteCollaboration): void;
}) {
  const [openPanel, setOpenPanel] = useState<
    | "font"
    | "size"
    | "align"
    | "color"
    | "link"
    | "tags"
    | "reactions"
    | "comments"
  >();
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState(format.link);
  const [tagDraft, setTagDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => setLinkDraft(format.link), [format.link]);

  const updateFormat = (patch: Partial<ProjectStickyNoteFormat>) => {
    onFormatChange({ ...format, ...patch });
  };

  const updateCollaboration = (
    patch: Partial<ProjectStickyNoteCollaboration>,
  ) => {
    if (!collaboration || !onCollaborationChange) return;
    onCollaborationChange(
      normalizeProjectStickyNoteCollaboration({
        ...collaboration,
        ...patch,
      }),
    );
  };

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || !collaboration) return;
    updateCollaboration({ tags: [...collaboration.tags, tag] });
    setTagDraft("");
  };

  const addComment = () => {
    const body = commentDraft.trim();
    if (!body || !collaboration) return;
    updateCollaboration({
      comments: [
        ...collaboration.comments,
        {
          id: crypto.randomUUID(),
          body,
          author: collaboration.author,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setCommentDraft("");
  };

  const closePanel = () => setOpenPanel(undefined);

  return (
    <div
      className="project-sticky-note-toolbar"
      style={style}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <AstryxDropdown
        label={format.font === "sans" ? "Sans" : "Sketch"}
        ariaLabel={`${objectLabel} font`}
        open={openPanel === "font"}
        triggerVariant="secondary"
        triggerClassName="project-sticky-note-toolbar__dropdown-trigger"
        menuWidth={136}
        onOpenChange={(open) => setOpenPanel(open ? "font" : undefined)}
      >
        <AstryxDropdownItem
          label="Sans"
          selected={format.font === "sans"}
          onSelect={() => {
            updateFormat({ font: "sans" });
            closePanel();
          }}
        />
        <AstryxDropdownItem
          label="Sketch"
          selected={format.font === "sketch"}
          onSelect={() => {
            updateFormat({ font: "sketch" });
            closePanel();
          }}
        />
      </AstryxDropdown>
      <AstryxDropdown
        label={`${format.fontSize}`}
        ariaLabel={`${objectLabel} text size`}
        open={openPanel === "size"}
        triggerVariant="secondary"
        triggerClassName="project-sticky-note-toolbar__size-trigger"
        menuWidth={104}
        onOpenChange={(open) => setOpenPanel(open ? "size" : undefined)}
      >
        {([16, 20, 28] as const).map((fontSize) => (
          <AstryxDropdownItem
            key={fontSize}
            label={`${fontSize}px`}
            selected={format.fontSize === fontSize}
            onSelect={() => {
              updateFormat({ fontSize });
              closePanel();
            }}
          />
        ))}
      </AstryxDropdown>
      <AstryxDropdown
        label={
          format.textAlign === "left"
            ? "Left"
            : format.textAlign === "center"
              ? "Centre"
              : "Right"
        }
        ariaLabel={`${objectLabel} text alignment`}
        open={openPanel === "align"}
        triggerVariant="secondary"
        triggerClassName="project-sticky-note-toolbar__align-trigger"
        menuWidth={124}
        onOpenChange={(open) => setOpenPanel(open ? "align" : undefined)}
      >
        {(["left", "center", "right"] as const).map((textAlign) => (
          <AstryxDropdownItem
            key={textAlign}
            label={
              textAlign === "center"
                ? "Centre"
                : textAlign === "left"
                  ? "Left"
                  : "Right"
            }
            selected={format.textAlign === textAlign}
            onSelect={() => {
              updateFormat({ textAlign });
              closePanel();
            }}
          />
        ))}
      </AstryxDropdown>
      <AstryxDropdown
        label="Link"
        ariaLabel={
          format.link
            ? `Edit ${objectLabel.toLowerCase()} link`
            : `Add ${objectLabel.toLowerCase()} link`
        }
        open={openPanel === "link"}
        mode="panel"
        hasChevron={false}
        triggerVariant="secondary"
        triggerEndContent={<Icon icon="externalLink" size="xsm" />}
        panelAriaLabel={`${objectLabel} link`}
        triggerClassName="project-sticky-note-toolbar__link-trigger"
        onOpenChange={(open) => setOpenPanel(open ? "link" : undefined)}
      >
        <div className="project-sticky-note-toolbar__link-panel">
          <TextInput
            label={`${objectLabel} link`}
            isLabelHidden
            value={linkDraft}
            onChange={setLinkDraft}
            placeholder="Paste a URL…"
            width="100%"
            size="sm"
          />
          <div className="project-sticky-note-toolbar__link-actions">
            {format.link ? (
              <Button
                label="Remove"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLinkDraft("");
                  updateFormat({ link: "" });
                  closePanel();
                }}
              />
            ) : null}
            <Button
              label="Apply"
              variant="primary"
              size="sm"
              isDisabled={!linkDraft.trim()}
              onClick={() => {
                const link = normalizedStickyNoteLink(linkDraft);
                setLinkDraft(link);
                updateFormat({ link });
                closePanel();
              }}
            />
          </div>
        </div>
      </AstryxDropdown>
      <div className="project-sticky-note-toolbar__color-control">
        <Button
          label={color.name}
          aria-label={`${objectLabel} color: ${color.name}`}
          aria-expanded={openPanel === "color"}
          variant="secondary"
          size="sm"
          className="project-sticky-note-toolbar__color-trigger"
          icon={
            <span
              className="project-sticky-note-toolbar__color-dot"
              style={{ "--sticky-color": color.fill } as CSSProperties}
            />
          }
          isIconOnly
          onClick={() =>
            setOpenPanel((current) =>
              current === "color" ? undefined : "color",
            )
          }
        />
        {openPanel === "color" ? (
          <div
            className="project-sticky-note-toolbar__color-panel"
            role="dialog"
            aria-label={`${objectLabel} colors`}
          >
            {colorOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="project-sticky-note-toolbar__color-swatch"
                aria-label={`Use ${option.name}`}
                aria-pressed={color.id === option.id}
                style={
                  {
                    "--sticky-color": option.fill,
                    "--sticky-stroke": option.stroke,
                  } as CSSProperties
                }
                onClick={() => {
                  onColorChange(option);
                  closePanel();
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
      {collaboration && onCollaborationChange ? (
        <div className="project-sticky-note-toolbar__more-control">
          <Button
            label="More sticky note options"
            aria-expanded={moreOpen}
            variant={moreOpen ? "primary" : "ghost"}
            size="sm"
            className="project-sticky-note-toolbar__icon-trigger"
            icon={<Icon icon="moreHorizontal" size="sm" />}
            isIconOnly
            onClick={() => setMoreOpen((open) => !open)}
          />
          {moreOpen ? (
            <div
              className="project-sticky-note-toolbar__more-panel"
              role="dialog"
              aria-label="More sticky note options"
            >
              <Button
                label={collaboration.showAuthor ? "Hide author" : "Show author"}
                aria-pressed={collaboration.showAuthor}
                variant={collaboration.showAuthor ? "primary" : "ghost"}
                size="sm"
                className="project-sticky-note-toolbar__icon-trigger"
                icon={collaboration.showAuthor ? <EyeIcon /> : <EyeCloseIcon />}
                isIconOnly
                onClick={() =>
                  updateCollaboration({ showAuthor: !collaboration.showAuthor })
                }
              />
              <div className="project-sticky-note-toolbar__panel-control">
                <Button
                  label="Add tag"
                  aria-expanded={openPanel === "tags"}
                  variant={collaboration.tags.length ? "primary" : "ghost"}
                  size="sm"
                  className="project-sticky-note-toolbar__icon-trigger"
                  icon={<BookmarkIcon />}
                  isIconOnly
                  onClick={() =>
                    setOpenPanel((current) =>
                      current === "tags" ? undefined : "tags",
                    )
                  }
                />
                {collaboration.tags.length ? (
                  <span
                    className="project-sticky-note-toolbar__count"
                    aria-hidden="true"
                  >
                    {collaboration.tags.length}
                  </span>
                ) : null}
                {openPanel === "tags" ? (
                  <div
                    className="project-sticky-note-toolbar__panel"
                    role="dialog"
                    aria-label="Sticky note tags"
                  >
                    <strong>Tags</strong>
                    {collaboration.tags.length ? (
                      <div className="project-sticky-note-toolbar__tags">
                        {collaboration.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="project-sticky-note-toolbar__tag"
                            aria-label={`Remove tag ${tag}`}
                            onClick={() =>
                              updateCollaboration({
                                tags: collaboration.tags.filter(
                                  (current) => current !== tag,
                                ),
                              })
                            }
                          >
                            <span>{tag}</span>
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p>No tags yet.</p>
                    )}
                    <div className="project-sticky-note-toolbar__panel-entry">
                      <TextInput
                        label="Tag name"
                        isLabelHidden
                        value={tagDraft}
                        onChange={setTagDraft}
                        placeholder="Add a tag…"
                        width="100%"
                        size="sm"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button
                        label="Add"
                        variant="primary"
                        size="sm"
                        isDisabled={!tagDraft.trim()}
                        onClick={addTag}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="project-sticky-note-toolbar__panel-control">
                <Button
                  label="Add reaction"
                  aria-expanded={openPanel === "reactions"}
                  variant={collaboration.reactions.length ? "primary" : "ghost"}
                  size="sm"
                  className="project-sticky-note-toolbar__icon-trigger"
                  icon={<HeartIcon />}
                  isIconOnly
                  onClick={() =>
                    setOpenPanel((current) =>
                      current === "reactions" ? undefined : "reactions",
                    )
                  }
                />
                {collaboration.reactions.length ? (
                  <span
                    className="project-sticky-note-toolbar__count"
                    aria-hidden="true"
                  >
                    {collaboration.reactions.length}
                  </span>
                ) : null}
                {openPanel === "reactions" ? (
                  <div
                    className="project-sticky-note-toolbar__panel project-sticky-note-toolbar__reaction-panel"
                    role="dialog"
                    aria-label="Sticky note reactions"
                  >
                    <strong>Reactions</strong>
                    <div className="project-sticky-note-toolbar__reactions">
                      {projectStickyNoteReactionOptions.map((option) => {
                        const active = collaboration.reactions.includes(
                          option.id,
                        );
                        const ReactionIcon = option.icon;
                        return (
                          <Button
                            key={option.id}
                            label={option.label}
                            aria-pressed={active}
                            variant={active ? "primary" : "secondary"}
                            size="sm"
                            icon={<ReactionIcon />}
                            onClick={() =>
                              updateCollaboration({
                                reactions: active
                                  ? collaboration.reactions.filter(
                                      (reaction) => reaction !== option.id,
                                    )
                                  : [...collaboration.reactions, option.id],
                              })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="project-sticky-note-toolbar__panel-control">
                <Button
                  label="Comments"
                  aria-expanded={openPanel === "comments"}
                  variant={collaboration.comments.length ? "primary" : "ghost"}
                  size="sm"
                  className="project-sticky-note-toolbar__icon-trigger"
                  icon={<CommentIcon />}
                  isIconOnly
                  onClick={() =>
                    setOpenPanel((current) =>
                      current === "comments" ? undefined : "comments",
                    )
                  }
                />
                {collaboration.comments.length ? (
                  <span
                    className="project-sticky-note-toolbar__count"
                    aria-hidden="true"
                  >
                    {collaboration.comments.length}
                  </span>
                ) : null}
                {openPanel === "comments" ? (
                  <div
                    className="project-sticky-note-toolbar__panel project-sticky-note-toolbar__comment-panel"
                    role="dialog"
                    aria-label="Sticky note comments"
                  >
                    <strong>Comments</strong>
                    {collaboration.comments.length ? (
                      <div className="project-sticky-note-toolbar__comments">
                        {collaboration.comments.map((comment) => (
                          <article key={comment.id}>
                            <header>
                              <strong>{comment.author}</strong>
                              <time dateTime={comment.createdAt}>
                                {stickyNoteCommentTime(comment.createdAt)}
                              </time>
                            </header>
                            <p>{comment.body}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p>Start a conversation about this note.</p>
                    )}
                    <div className="project-sticky-note-toolbar__panel-entry">
                      <TextInput
                        label="Comment"
                        isLabelHidden
                        value={commentDraft}
                        onChange={setCommentDraft}
                        placeholder="Add a comment…"
                        width="100%"
                        size="sm"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addComment();
                          }
                        }}
                      />
                      <Button
                        label="Post"
                        variant="primary"
                        size="sm"
                        isDisabled={!commentDraft.trim()}
                        onClick={addComment}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <span
                className="project-sticky-note-toolbar__divider"
                aria-hidden="true"
              />
              <Button
                label={format.locked ? "Unlock" : "Lock"}
                aria-pressed={format.locked}
                variant={format.locked ? "primary" : "ghost"}
                size="sm"
                className="project-sticky-note-toolbar__lock-trigger"
                onClick={() => updateFormat({ locked: !format.locked })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
