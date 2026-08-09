import { Button, Icon, TextInput } from "@astryxdesign/core";
import {
  BoldIcon,
  BookmarkIcon,
  CommentIcon,
  HeartIcon,
  LinkIcon,
  ListUnorderedIcon,
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
  bold: boolean;
  strikethrough: boolean;
  bulletedList: boolean;
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

const projectStickyNoteReactionIds = [
  "agree",
  "love",
  "question",
  "idea",
] as const;

export function normalizeProjectStickyNoteCollaboration(
  value?: Partial<ProjectStickyNoteCollaboration>,
): ProjectStickyNoteCollaboration {
  const defaults = defaultProjectStickyNoteCollaboration();
  const reactionIds = new Set<ProjectStickyNoteReactionId>(
    projectStickyNoteReactionIds,
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

export const defaultProjectStickyNoteFormat: ProjectStickyNoteFormat = {
  font: "sans",
  fontSize: 16,
  textAlign: "left",
  bold: false,
  strikethrough: false,
  bulletedList: false,
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

function projectObjectFontSizeLabel(fontSize: ProjectStickyNoteFontSize) {
  if (fontSize === 16) return "Small";
  if (fontSize === 20) return "Medium";
  return "Large";
}

/*
 * FigJam uses one dark contextual surface for selected objects and changes
 * only the controls the object supports. Sticky notes and plain text share
 * the typography controls; author visibility is the sticky-only capability.
 */
export function ProjectObjectToolbar({
  color,
  format,
  style,
  collaboration,
  ariaLabel = "Selection Properties Menu",
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
    "font" | "size" | "color" | "link"
  >();
  const [linkDraft, setLinkDraft] = useState(format.link);

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

  const closePanel = () => setOpenPanel(undefined);
  const typefaceLabel = format.font === "sans" ? "simple" : "handwritten";
  const sizeLabel = projectObjectFontSizeLabel(format.fontSize);

  return (
    <div
      className="project-object-toolbar"
      style={style}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="project-object-toolbar__control project-object-toolbar__color-control">
        <button
          type="button"
          className="project-object-toolbar__color-trigger"
          aria-label={`Change ${objectLabel.toLowerCase()} color`}
          aria-expanded={openPanel === "color"}
          onClick={() =>
            setOpenPanel((current) =>
              current === "color" ? undefined : "color",
            )
          }
        >
          <span
            className="project-object-toolbar__color-dot"
            style={{ "--object-color": color.fill } as CSSProperties}
          />
          <Icon icon="chevronDown" size="xsm" aria-hidden="true" />
        </button>
        {openPanel === "color" ? (
          <div
            className="project-object-toolbar__panel project-object-toolbar__color-panel"
            role="dialog"
            aria-label={`${objectLabel} colors`}
          >
            {colorOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="project-object-toolbar__color-swatch"
                aria-label={`Use ${option.name}`}
                aria-pressed={color.id === option.id}
                style={
                  {
                    "--object-color": option.fill,
                    "--object-stroke": option.stroke,
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
      <span className="project-object-toolbar__divider" aria-hidden="true" />
      <AstryxDropdown
        label="Aa"
        ariaLabel={`Typeface, ${typefaceLabel}`}
        open={openPanel === "font"}
        triggerVariant="secondary"
        triggerClassName="project-object-toolbar__typeface-trigger"
        menuWidth={160}
        onOpenChange={(open) => setOpenPanel(open ? "font" : undefined)}
      >
        <AstryxDropdownItem
          label="Simple"
          selected={format.font === "sans"}
          onSelect={() => {
            updateFormat({ font: "sans" });
            closePanel();
          }}
        />
        <AstryxDropdownItem
          label="Handwritten"
          selected={format.font === "sketch"}
          onSelect={() => {
            updateFormat({ font: "sketch" });
            closePanel();
          }}
        />
      </AstryxDropdown>
      <span className="project-object-toolbar__divider" aria-hidden="true" />
      <AstryxDropdown
        label={sizeLabel}
        ariaLabel={`Font size, ${sizeLabel.toLowerCase()}`}
        open={openPanel === "size"}
        triggerVariant="secondary"
        triggerClassName="project-object-toolbar__size-trigger"
        menuWidth={144}
        onOpenChange={(open) => setOpenPanel(open ? "size" : undefined)}
      >
        {([16, 20, 28] as const).map((fontSize) => (
          <AstryxDropdownItem
            key={fontSize}
            label={projectObjectFontSizeLabel(fontSize)}
            selected={format.fontSize === fontSize}
            onSelect={() => {
              updateFormat({ fontSize });
              closePanel();
            }}
          />
        ))}
      </AstryxDropdown>
      <span className="project-object-toolbar__divider" aria-hidden="true" />
      <button
        type="button"
        className="project-object-toolbar__action"
        aria-label="Bold"
        aria-pressed={format.bold}
        onClick={() => updateFormat({ bold: !format.bold })}
      >
        <BoldIcon />
      </button>
      <button
        type="button"
        className="project-object-toolbar__action project-object-toolbar__strikethrough"
        aria-label="Strikethrough"
        aria-pressed={format.strikethrough}
        onClick={() =>
          updateFormat({ strikethrough: !format.strikethrough })
        }
      >
        <span aria-hidden="true">S</span>
      </button>
      <div className="project-object-toolbar__control project-object-toolbar__link-control">
        <button
          type="button"
          className="project-object-toolbar__action"
          aria-label={format.link ? "Edit link" : "Create link"}
          aria-expanded={openPanel === "link"}
          onClick={() =>
            setOpenPanel((current) =>
              current === "link" ? undefined : "link",
            )
          }
        >
          <LinkIcon />
        </button>
        {openPanel === "link" ? (
          <div
            className="project-object-toolbar__panel project-object-toolbar__link-panel"
            role="dialog"
            aria-label={`${objectLabel} link`}
          >
            <TextInput
              label={`${objectLabel} link`}
              isLabelHidden
              value={linkDraft}
              onChange={setLinkDraft}
              placeholder="Paste a URL…"
              width="100%"
              size="sm"
            />
            <div className="project-object-toolbar__link-actions">
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
        ) : null}
      </div>
      <button
        type="button"
        className="project-object-toolbar__action"
        aria-label="Bulleted list"
        aria-pressed={format.bulletedList}
        onClick={() =>
          updateFormat({ bulletedList: !format.bulletedList })
        }
      >
        <ListUnorderedIcon />
      </button>
      {collaboration && onCollaborationChange ? (
        <>
          <span
            className="project-object-toolbar__divider"
            aria-hidden="true"
          />
          <button
            type="button"
            className="project-object-toolbar__action project-object-toolbar__author"
            aria-label="Show/hide author"
            aria-pressed={collaboration.showAuthor}
            onClick={() =>
              updateCollaboration({ showAuthor: !collaboration.showAuthor })
            }
          >
            <UserIcon />
          </button>
        </>
      ) : null}
    </div>
  );
}
