import { Icon } from "@astryxdesign/core";
import {
  AlignLeftIcon,
  AlignRightIcon,
  LinkIcon,
  ListUnorderedIcon,
  MenuIcon,
  UserIcon,
} from "@storybook/icons";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { AstryxDropdown, AstryxDropdownItem } from "./AstryxDropdown.tsx";
import {
  CanvasObjectToolbar,
  CanvasObjectToolbarDivider,
} from "./CanvasObjectToolbar.tsx";
import {
  projectStickyNoteColors,
  type ProjectStickyNoteColor,
} from "./ProjectStickyNotePicker.tsx";

export type ProjectStickyNoteFont =
  | "simple"
  | "bookish"
  | "technical"
  | "cute";
export type ProjectStickyNoteFontSize = number;
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
    // FigJam keeps the author visible on a freshly created Sticky Note.
    showAuthor: true,
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
    showAuthor:
      typeof value?.showAuthor === "boolean"
        ? value.showAuthor
        : defaults.showAuthor,
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
  if (!collaboration.showAuthor) return null;

  return (
    <div
      className="project-sticky-note-metadata"
      style={style}
      aria-label="Sticky note collaboration"
    >
      <span title={`Author: ${collaboration.author}`}>{collaboration.author}</span>
    </div>
  );
}

export const defaultProjectStickyNoteFormat: ProjectStickyNoteFormat = {
  font: "simple",
  fontSize: 16,
  textAlign: "left",
  bold: false,
  strikethrough: false,
  bulletedList: false,
  link: "",
  locked: false,
};

export const projectStickyNoteFontFamilies = {
  simple: 6,
  bookish: 7,
  technical: 3,
  cute: 5,
} as const;

/**
 * Excalidraw persists Sticky Note text but does not natively support the two
 * rich-text treatments FigJam exposes. The canvas uses this predicate to
 * switch to its matching DOM text layer only when either treatment is active.
 */
export function stickyNoteUsesRichTextOverlay(
  format: Pick<ProjectStickyNoteFormat, "bold" | "strikethrough">,
) {
  return format.bold || format.strikethrough;
}

const projectStickyNoteFontSizes = [16, 20, 28, 36, 48] as const;

export function normalizeProjectStickyNoteFormat(
  value?: Partial<ProjectStickyNoteFormat> & { font?: string },
): ProjectStickyNoteFormat {
  const font =
    value?.font === "bookish" ||
    value?.font === "technical" ||
    value?.font === "cute"
      ? value.font
      : value?.font === "scribbled" || value?.font === "sketch"
        ? "cute"
        : "simple";
  const fontSize = Number.isFinite(value?.fontSize)
    ? Math.min(96, Math.max(8, Math.round(value.fontSize!)))
    : defaultProjectStickyNoteFormat.fontSize;

  return {
    ...defaultProjectStickyNoteFormat,
    ...value,
    font,
    fontSize,
    textAlign:
      value?.textAlign === "center" || value?.textAlign === "right"
        ? value.textAlign
        : "left",
    bold: value?.bold === true,
    strikethrough: value?.strikethrough === true,
    bulletedList: value?.bulletedList === true,
    link: typeof value?.link === "string" ? value.link : "",
    locked: value?.locked === true,
  };
}

export function projectStickyNoteFontForFamily(fontFamily: number): ProjectStickyNoteFont {
  return (
    (Object.entries(projectStickyNoteFontFamilies).find(
      ([, family]) => family === fontFamily,
    )?.[0] as ProjectStickyNoteFont | undefined) ?? "simple"
  );
}

function normalizedStickyNoteLink(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^(?:https?:\/\/|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function projectObjectFontSizeLabel(fontSize: ProjectStickyNoteFontSize) {
  if (fontSize === 16) return "Small";
  if (fontSize === 20) return "Medium";
  if (fontSize === 28) return "Large";
  if (fontSize === 36) return "Extra large";
  if (fontSize === 48) return "Huge";
  return `${fontSize}px`;
}

export function ProjectSelectionToolbar({
  children,
  style,
  className,
  ariaLabel = "Selection Properties Menu",
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <CanvasObjectToolbar
      className={className}
      style={style}
      ariaLabel={ariaLabel}
    >
      {children}
    </CanvasObjectToolbar>
  );
}

/**
 * Shared colour control for contextual canvas toolbars.  It is controlled by
 * its owner so opening it can close any other object-specific panel.
 */
export function ProjectObjectToolbarColorPicker({
  color,
  colorOptions,
  ariaLabel,
  panelLabel,
  open,
  onOpenChange,
  onColorChange,
  className,
  panelClassName,
}: {
  color: string;
  colorOptions: readonly ProjectStickyNoteColor[];
  ariaLabel: string;
  panelLabel: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  onColorChange(color: ProjectStickyNoteColor): void;
  className?: string;
  panelClassName?: string;
}) {
  return (
    <div
      className={`project-object-toolbar__control project-object-toolbar__color-control${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        type="button"
        className="project-object-toolbar__color-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span
          className="project-object-toolbar__color-dot"
          style={{ "--object-color": color } as CSSProperties}
        />
        <Icon icon="chevronDown" size="xsm" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={`project-object-toolbar__panel project-object-toolbar__color-panel${
            panelClassName ? ` ${panelClassName}` : ""
          }`}
          role="radiogroup"
          aria-label={panelLabel}
        >
          {colorOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="project-object-toolbar__color-swatch"
              role="radio"
              aria-label={`Use ${option.name}`}
              aria-checked={color.toLowerCase() === option.fill.toLowerCase()}
              style={
                {
                  "--object-color": option.fill,
                  "--object-stroke": option.stroke,
                } as CSSProperties
              }
              onClick={() => {
                onColorChange(option);
                onOpenChange(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
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
  children,
  ariaLabel = "Selection Properties Menu",
  objectLabel = "Object",
  colorAriaLabel,
  colorOptions = projectStickyNoteColors,
  showLink = true,
  showTextAlignment = true,
  showTextStyling = false,
  onColorChange,
  onFormatChange,
  onCollaborationChange,
}: {
  color: ProjectStickyNoteColor;
  format: ProjectStickyNoteFormat;
  style?: CSSProperties;
  collaboration?: ProjectStickyNoteCollaboration;
  children?: ReactNode;
  ariaLabel?: string;
  objectLabel?: string;
  colorAriaLabel?: string;
  colorOptions?: readonly ProjectStickyNoteColor[];
  showLink?: boolean;
  showTextAlignment?: boolean;
  showTextStyling?: boolean;
  onColorChange(color: ProjectStickyNoteColor): void;
  onFormatChange(format: ProjectStickyNoteFormat): void;
  onCollaborationChange?(collaboration: ProjectStickyNoteCollaboration): void;
}) {
  const [openPanel, setOpenPanel] = useState<
    "font" | "size" | "color" | "link" | "align"
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
  const typefaceLabel = format.font;
  const sizeLabel = projectObjectFontSizeLabel(format.fontSize);

  return (
    <ProjectSelectionToolbar style={style} ariaLabel={ariaLabel}>
      <ProjectObjectToolbarColorPicker
        color={color.fill}
        colorOptions={colorOptions}
        ariaLabel={
          colorAriaLabel ?? `Change ${objectLabel.toLowerCase()} color`
        }
        panelLabel={`${objectLabel} colors`}
        open={openPanel === "color"}
        onOpenChange={(open) => setOpenPanel(open ? "color" : undefined)}
        onColorChange={onColorChange}
      />
      <CanvasObjectToolbarDivider />
      <AstryxDropdown
        label="Aa"
        ariaLabel={`Typeface, ${typefaceLabel}`}
        open={openPanel === "font"}
        triggerVariant="secondary"
        triggerClassName="project-object-toolbar__typeface-trigger"
        menuWidth={160}
        onOpenChange={(open) => setOpenPanel(open ? "font" : undefined)}
      >
        {(
          [
            ["simple", "Simple"],
            ["bookish", "Bookish"],
            ["technical", "Technical"],
            ["cute", "Cute"],
          ] as const
        ).map(([font, label]) => (
          <AstryxDropdownItem
            key={font}
            label={label}
            selected={format.font === font}
            onSelect={() => {
              updateFormat({ font });
              closePanel();
            }}
          />
        ))}
      </AstryxDropdown>
      <CanvasObjectToolbarDivider />
      <AstryxDropdown
        label={sizeLabel}
        ariaLabel={`Font size, ${sizeLabel.toLowerCase()}`}
        open={openPanel === "size"}
        triggerVariant="secondary"
        triggerClassName="project-object-toolbar__size-trigger"
        menuWidth={144}
        onOpenChange={(open) => setOpenPanel(open ? "size" : undefined)}
      >
        {projectStickyNoteFontSizes.map((fontSize) => (
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
        <div className="project-object-toolbar__custom-size">
          <label htmlFor="sticky-note-custom-size">Custom</label>
          <input
            id="sticky-note-custom-size"
            type="number"
            min="8"
            max="96"
            value={format.fontSize}
            onChange={(event) => {
              const nextSize = Number(event.target.value);
              if (!Number.isFinite(nextSize)) return;
              updateFormat({
                fontSize: Math.min(96, Math.max(8, Math.round(nextSize))),
              });
            }}
          />
        </div>
      </AstryxDropdown>
      {showTextStyling ? (
        <>
          <CanvasObjectToolbarDivider />
          <button
            type="button"
            className="project-object-toolbar__action project-object-toolbar__bold"
            aria-label="Bold"
            aria-pressed={format.bold}
            onClick={() => updateFormat({ bold: !format.bold })}
          >
            <strong aria-hidden="true">B</strong>
          </button>
          <button
            type="button"
            className="project-object-toolbar__action project-object-toolbar__strikethrough"
            aria-label="Strikethrough"
            aria-pressed={format.strikethrough}
            onClick={() => updateFormat({ strikethrough: !format.strikethrough })}
          >
            <span aria-hidden="true">S</span>
          </button>
          <CanvasObjectToolbarDivider />
        </>
      ) : null}
      {showLink ? (
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
              <input
                type="url"
                autoFocus
                aria-label="Type or paste URL"
                value={linkDraft}
                onChange={(event) => setLinkDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    event.nativeEvent.stopImmediatePropagation();
                    setLinkDraft(format.link);
                    closePanel();
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    event.nativeEvent.stopImmediatePropagation();
                    const link = normalizedStickyNoteLink(linkDraft);
                    setLinkDraft(link);
                    updateFormat({ link });
                    closePanel();
                  }
                }}
                placeholder="Type or paste URL"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="project-object-toolbar__action"
        aria-label="Bulleted list"
        aria-pressed={format.bulletedList}
        onClick={() => updateFormat({ bulletedList: !format.bulletedList })}
      >
        <ListUnorderedIcon />
      </button>
      {showTextAlignment ? (
        <div className="project-object-toolbar__control project-object-toolbar__align-control">
          <button
            type="button"
            className="project-object-toolbar__action project-object-toolbar__align-trigger"
            aria-label={`Text alignment, text align ${format.textAlign}`}
            aria-expanded={openPanel === "align"}
            onClick={() =>
              setOpenPanel((current) =>
                current === "align" ? undefined : "align",
              )
            }
          >
            {format.textAlign === "left" ? (
              <AlignLeftIcon />
            ) : format.textAlign === "right" ? (
              <AlignRightIcon />
            ) : (
              <MenuIcon />
            )}
            <Icon icon="chevronDown" size="xsm" aria-hidden="true" />
          </button>
          {openPanel === "align" ? (
            <div
              className="project-object-toolbar__panel project-object-toolbar__align-panel"
              role="menu"
              aria-label="Text alignment"
            >
              {(
                [
                  ["left", "Left", AlignLeftIcon],
                  ["center", "Center", MenuIcon],
                  ["right", "Right", AlignRightIcon],
                ] as const
              ).map(([value, label, AlignmentIcon]) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={format.textAlign === value}
                  onClick={() => {
                    updateFormat({ textAlign: value });
                    closePanel();
                  }}
                >
                  <AlignmentIcon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
      {collaboration && onCollaborationChange ? (
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
      ) : null}
    </ProjectSelectionToolbar>
  );
}
