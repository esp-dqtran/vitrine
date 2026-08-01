import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { EditorHost } from "@blocksuite/block-std";
import type {
  AffineInlineEditor,
  LinkedMenuGroup,
  ReferenceInfo,
} from "@blocksuite/blocks";
import {
  BreadcrumbItem,
  Breadcrumbs,
  Button,
  Heading,
  HStack,
  Icon,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  StatusDot,
  Text,
  TextInput,
  Toolbar,
  type IconName,
} from "@astryxdesign/core";
import { AstryxMenu } from "./AstryxDropdown.tsx";

import type {
  ProjectDocumentComment,
  ProjectDocumentAccess,
  ProjectDocumentCollaborator,
  ProjectDocumentCollaboratorRole,
  ProjectDocumentCommentAnchor,
  ProjectDocumentFolder,
  ProjectDocumentIcon,
  ProjectDocumentLink,
  ProjectDocumentMode,
  ProjectDocumentPageWidth,
  ProjectDocumentProperty,
  ProjectDocumentPropertyType,
  ProjectDocumentPublic,
  ProjectDocumentSearchResult,
  ProjectDocumentShare,
  ProjectDocumentSmartCollection,
  ProjectDocumentTag,
  ProjectDocumentVersion,
} from "../../projectDocument.ts";
import {
  appendProjectDocumentSimpleTable,
  appendProjectDocumentStarterBlocks,
  createProjectDocumentRuntime,
  htmlProjectDocumentExport,
  markdownProjectDocumentExport,
  syncProjectDocumentCollectionMetadata,
  type ProjectDocumentPresence,
  type ProjectDocumentRuntime,
} from "../projectDocumentRuntime.ts";
import type { ProjectDocumentSaveState } from "../projectDocumentStatus.ts";
import {
  journalWeekDates,
  localDateKey,
  projectDocumentMentionDates,
} from "../projectDocumentJournal.ts";
import { projectDocumentMentionUsers } from "../projectDocumentMentions.ts";
import {
  addProjectDocumentCollaborator,
  bootstrapProjectDocument,
  createProjectDocument,
  createProjectDocumentComment,
  createProjectDocumentJournal,
  createProjectDocumentShare,
  createProjectDocumentVersion,
  listProjectDocumentComments,
  listProjectDocumentShares,
  listProjectDocumentVersions,
  listProjectDocuments,
  searchProjectDocuments,
  revokeProjectDocumentShare,
  resolveProjectDocumentComment,
  restoreProjectDocumentVersion,
  removeProjectDocumentCollaborator,
  setProjectDocumentTags,
  setProjectDocumentLinks,
  trashProjectDocument,
  updateProjectDocumentMetadata,
  updateProjectDocumentMode,
  updateProjectDocumentSearchIndex,
  updateProjectDocumentTemplate,
} from "../projectDocumentsApi.ts";
import { useAuth } from "../AuthProvider.tsx";
import { navigate } from "../router.ts";
import { copyShareLink } from "../screenActions.ts";
import { AstryxModal } from "./AstryxModal.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { ProjectDocumentCommentsPanel } from "./ProjectDocumentCommentsPanel.tsx";
import { ProjectDocumentHistoryPanel } from "./ProjectDocumentHistoryPanel.tsx";
import { ProjectDocumentLibrary } from "./ProjectDocumentLibrary.tsx";
import {
  ProjectDocumentLinkPickerDialog,
  ProjectDocumentTagPickerDialog,
} from "./ProjectDocumentOrganizerDialogs.tsx";

const pageIconOptions: ReadonlyArray<{
  value: Exclude<ProjectDocumentIcon, "none">;
  label: string;
  icon: IconName;
}> = [
  { value: "document", label: "Document", icon: "viewColumns" },
  { value: "idea", label: "Idea", icon: "info" },
  { value: "task", label: "Tasks", icon: "checkDouble" },
  { value: "schedule", label: "Schedule", icon: "calendar" },
  { value: "build", label: "Build", icon: "wrench" },
];

const pageIconNames: Record<
  Exclude<ProjectDocumentIcon, "none">,
  IconName
> = Object.fromEntries(
  pageIconOptions.map((option) => [option.value, option.icon]),
) as Record<Exclude<ProjectDocumentIcon, "none">, IconName>;

function formatDocumentDate(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDocumentListDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function projectDocumentPresenceInitials(name: string): string {
  const parts = name
    .split(/[\s@._+-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      : (parts[0]?.slice(0, 2) ?? "?")
  ).toUpperCase();
}

export function selectedProjectDocumentCommentAnchor(
  root: ParentNode,
  selection: Selection | null = typeof window === "undefined"
    ? null
    : window.getSelection(),
): ProjectDocumentCommentAnchor | undefined {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return undefined;
  }
  const quote = selection.toString().replace(/\s+/g, " ").trim().slice(0, 500);
  if (!quote) return undefined;
  const ancestor = selection.getRangeAt(0).commonAncestorContainer;
  const element =
    ancestor.nodeType === 1 ? (ancestor as Element) : ancestor.parentElement;
  const block = element?.closest<HTMLElement>("[data-block-id]");
  if (!block?.dataset.blockId || !(root as Node).contains(block)) {
    return undefined;
  }
  return {
    blockId: block.dataset.blockId,
    quote,
  };
}

function documentIconName(icon: ProjectDocumentIcon): IconName {
  return icon === "none" ? "viewColumns" : pageIconNames[icon];
}

function restoredVersionStorageKey(
  documentId: number,
  syncInstanceId: string,
): string {
  return `astryx-project-document-restore-${documentId}-${syncInstanceId}`;
}

function decodeBase64Update(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Update(value: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    binary += String.fromCharCode(...value.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
}

export function projectDocumentExportFilename(title: string): string {
  return (
    title
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project-document"
  );
}

function downloadProjectDocumentBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ProjectDocumentOutlineItem {
  id: string;
  title: string;
  level: number;
}

export function extractProjectDocumentOutline(
  root: ParentNode,
): ProjectDocumentOutlineItem[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("affine-paragraph[data-block-id]"),
  ).flatMap((block) => {
    const wrapper = block.querySelector<HTMLElement>(
      ".affine-paragraph-rich-text-wrapper",
    );
    const headingClass = Array.from(wrapper?.classList ?? []).find((name) =>
      /^h[1-6]$/.test(name),
    );
    const title = block.querySelector("rich-text")?.textContent?.trim() ?? "";
    const id = block.dataset.blockId ?? "";
    if (!headingClass || !title || !id) return [];
    return [{ id, title, level: Number(headingClass.slice(1)) }];
  });
}

export interface ProjectDocumentWorkspaceViewProps {
  title: string;
  icon?: ProjectDocumentIcon;
  isFavorite?: boolean;
  isTemplate?: boolean;
  pageWidth?: ProjectDocumentPageWidth;
  properties?: readonly ProjectDocumentProperty[];
  createdAt?: string;
  updatedAt?: string;
  createdByEmail?: string;
  lastEditedByEmail?: string;
  journalDate?: string | null;
  outlineItems?: readonly ProjectDocumentOutlineItem[];
  documents?: readonly ProjectDocumentPublic[];
  searchResults?: readonly ProjectDocumentSearchResult[];
  isSearchingDocuments?: boolean;
  documentSearchError?: string;
  trash?: readonly ProjectDocumentPublic[];
  folders?: readonly ProjectDocumentFolder[];
  tags?: readonly ProjectDocumentTag[];
  collections?: readonly ProjectDocumentSmartCollection[];
  links?: readonly ProjectDocumentLink[];
  comments?: readonly ProjectDocumentComment[];
  shares?: readonly ProjectDocumentShare[];
  versions?: readonly ProjectDocumentVersion[];
  access?: ProjectDocumentAccess;
  collaborators?: readonly ProjectDocumentCollaborator[];
  presence?: readonly ProjectDocumentPresence[];
  commentError?: string;
  shareError?: string;
  historyError?: string;
  activeDocumentId?: number;
  isCreatingDocument?: boolean;
  isDuplicatingDocument?: boolean;
  isSubmittingComment?: boolean;
  isCreatingShare?: boolean;
  isLoadingHistory?: boolean;
  isSavingVersion?: boolean;
  isUpdatingTemplate?: boolean;
  restoringVersionId?: number;
  mode: ProjectDocumentMode;
  status: ProjectDocumentSaveState;
  editorHostRef?: RefObject<HTMLDivElement | null>;
  error?: string;
  onTitleChange?(title: string): void;
  onTitleCommit?(): void;
  onIconChange?(icon: ProjectDocumentIcon): void;
  onFavoriteChange?(isFavorite: boolean): void;
  onTemplateChange?(isTemplate: boolean): void;
  onPageWidthChange?(pageWidth: ProjectDocumentPageWidth): void;
  onPropertiesChange?(properties: ProjectDocumentProperty[]): void;
  onOutlineSelect?(blockId: string): void;
  onJournalDateChange?(journalDate: string): void;
  onOpenLibrary?(): void;
  onOpenLibraryScope?(
    type:
      | "folder"
      | "tag"
      | "collection"
      | "collections"
      | "journals"
      | "trash"
      | "import"
      | "templates"
      | "new-folder"
      | "new-tag"
      | "new-collection",
    id?: number,
  ): void;
  onSelectDocument?(documentId: number): void;
  onCreateDocument?(): void;
  onDuplicateDocument?(): void;
  onSearchDocuments?(query: string): void;
  onSetDocumentTags?(documentId: number, tagIds: number[]): void;
  onSetDocumentLinks?(documentId: number, documentIds: number[]): void;
  onAddComment?(
    body: string,
    anchor?: ProjectDocumentCommentAnchor,
  ): boolean | Promise<boolean>;
  onResolveComment?(commentId: number, resolved: boolean): void | Promise<void>;
  onCreatePublicShare?(): void | Promise<void>;
  onRevokePublicShare?(shareId: number): void | Promise<void>;
  onAddCollaborator?(
    email: string,
    role: ProjectDocumentCollaboratorRole,
  ): boolean | Promise<boolean>;
  onRemoveCollaborator?(userId: number): void | Promise<void>;
  onLoadVersions?(): void | Promise<void>;
  onCreateVersion?(label: string): boolean | Promise<boolean>;
  onRestoreVersion?(versionId: number): void | Promise<void>;
  onMode(mode: ProjectDocumentMode): void;
  onRetry(): void;
  onInsertSimpleTable?(): void;
  onInsertStarterBlocks?(): void;
  onDownloadHtml?(): void;
  onDownloadPng?(): void;
  onDownloadMarkdown?(): void;
  onCopyMarkdown?(): void;
  onDownloadRecovery?(): void;
  onPrint?(): void;
  onTrashDocument?(): void | Promise<void>;
}

export function installProjectDocumentEditorEffects(
  registry: Pick<CustomElementRegistry, "get">,
  installBlocks: () => void,
  installPresets: () => void,
) {
  if (!registry.get("editor-host")) installBlocks();

  const pageInstalled = Boolean(registry.get("page-editor"));
  const canvasInstalled = Boolean(registry.get("edgeless-editor"));
  if (!pageInstalled && !canvasInstalled) {
    installPresets();
  } else if (!pageInstalled || !canvasInstalled) {
    throw new Error("BlockSuite editor registration is incomplete");
  }
}

function projectDocumentPropertyId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `property-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`
  );
}

function ProjectDocumentPropertyEditor({
  property,
  readOnly,
  onChange,
  onRemove,
}: {
  property: ProjectDocumentProperty;
  readOnly: boolean;
  onChange(property: ProjectDocumentProperty): void;
  onRemove(): void;
}) {
  const [name, setName] = useState(property.name);
  const [value, setValue] = useState(
    property.value === null ? "" : String(property.value),
  );

  useEffect(() => {
    setName(property.name);
    setValue(property.value === null ? "" : String(property.value));
  }, [property]);

  const commitName = () => {
    const normalized = name.trim();
    if (!normalized) {
      setName(property.name);
      return;
    }
    if (normalized !== property.name) {
      onChange({ ...property, name: normalized });
    }
  };

  const commitValue = () => {
    if (property.type === "number") {
      const next = value.trim() ? Number(value) : null;
      if (next !== null && !Number.isFinite(next)) {
        setValue(property.value === null ? "" : String(property.value));
        return;
      }
      onChange({ ...property, value: next });
      return;
    }
    if (property.type === "date") {
      onChange({ ...property, value: value || null });
      return;
    }
    onChange({ ...property, value });
  };

  return (
    <div className="project-document-custom-property">
      <dt>
        <input
          aria-label={`${property.name} property name`}
          value={name}
          maxLength={80}
          readOnly={readOnly}
          onChange={(event) => setName(event.currentTarget.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </dt>
      <dd>
        {property.type === "checkbox" ? (
          <label className="project-document-custom-property-checkbox">
            <input
              type="checkbox"
              aria-label={property.name}
              checked={property.value === true}
              disabled={readOnly}
              onChange={(event) =>
                onChange({ ...property, value: event.currentTarget.checked })
              }
            />
            <span>{property.value === true ? "Checked" : "Unchecked"}</span>
          </label>
        ) : (
          <input
            aria-label={property.name}
            type={
              property.type === "number"
                ? "number"
                : "text"
            }
            value={value}
            maxLength={property.type === "text" ? 2000 : undefined}
            readOnly={readOnly}
            placeholder={
              property.type === "text"
                ? "Empty"
                : property.type === "date"
                  ? "YYYY-MM-DD"
                  : undefined
            }
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setValue(nextValue);
              if (property.type === "date") {
                onChange({ ...property, value: nextValue || null });
              }
            }}
            onBlur={commitValue}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        )}
        {!readOnly ? (
          <IconButton
            label={`Remove ${property.name} property`}
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            size="sm"
            onClick={onRemove}
          />
        ) : null}
      </dd>
    </div>
  );
}

export function ProjectDocumentWorkspaceView({
  title,
  icon = "none",
  isFavorite = false,
  isTemplate = false,
  pageWidth = "standard",
  properties = [],
  createdAt,
  updatedAt,
  createdByEmail,
  lastEditedByEmail,
  journalDate,
  outlineItems = [],
  documents = [],
  searchResults,
  isSearchingDocuments = false,
  documentSearchError,
  trash = [],
  folders = [],
  tags = [],
  collections = [],
  links = [],
  comments = [],
  shares = [],
  versions = [],
  access = { ownerUserId: 0, role: "owner" },
  collaborators = [],
  presence = [],
  commentError,
  shareError,
  historyError,
  activeDocumentId,
  isCreatingDocument = false,
  isDuplicatingDocument = false,
  isSubmittingComment = false,
  isCreatingShare = false,
  isLoadingHistory = false,
  isSavingVersion = false,
  isUpdatingTemplate = false,
  restoringVersionId,
  mode,
  status,
  editorHostRef,
  error,
  onTitleChange,
  onTitleCommit,
  onIconChange,
  onFavoriteChange,
  onTemplateChange,
  onPageWidthChange,
  onPropertiesChange,
  onOutlineSelect,
  onJournalDateChange,
  onOpenLibrary,
  onOpenLibraryScope,
  onSelectDocument,
  onCreateDocument,
  onDuplicateDocument,
  onSearchDocuments,
  onSetDocumentTags,
  onSetDocumentLinks,
  onAddComment,
  onResolveComment,
  onCreatePublicShare,
  onRevokePublicShare,
  onAddCollaborator,
  onRemoveCollaborator,
  onLoadVersions,
  onCreateVersion,
  onRestoreVersion,
  onMode,
  onRetry,
  onInsertSimpleTable,
  onInsertStarterBlocks,
  onDownloadHtml,
  onDownloadPng,
  onDownloadMarkdown,
  onCopyMarkdown,
  onDownloadRecovery,
  onPrint,
  onTrashDocument,
}: ProjectDocumentWorkspaceViewProps) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorRole, setCollaboratorRole] =
    useState<ProjectDocumentCollaboratorRole>("editor");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentAnchor, setCommentAnchor] =
    useState<ProjectDocumentCommentAnchor>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [documentQuery, setDocumentQuery] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const normalizedDocumentQuery = documentQuery.trim().toLocaleLowerCase();
  const filteredDocuments = documents.filter((document) =>
    document.title.toLocaleLowerCase().includes(normalizedDocumentQuery),
  );
  const visibleSearchResults =
    searchResults ??
    filteredDocuments.map((document) => ({ document, snippet: "" }));
  const favoriteDocuments = filteredDocuments.filter(
    (document) => document.isFavorite,
  );
  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId,
  );
  const activeDocumentTags = tags.filter(
    (tag) =>
      activeDocumentId !== undefined &&
      tag.documentIds.includes(activeDocumentId),
  );
  const linkedDocumentIds = links
    .filter((link) => link.sourceDocumentId === activeDocumentId)
    .map((link) => link.targetDocumentId);
  const backlinkDocumentIds = links
    .filter((link) => link.targetDocumentId === activeDocumentId)
    .map((link) => link.sourceDocumentId);
  const linkedDocuments = documents.filter((document) =>
    linkedDocumentIds.includes(document.id),
  );
  const backlinkDocuments = documents.filter((document) =>
    backlinkDocumentIds.includes(document.id),
  );
  const openCommentCount = comments.filter(
    (comment) => !comment.resolvedAt,
  ).length;
  const visibleStatus = error ? "Save failed" : status;
  const missingProject = error === "Research project not found";
  const errorTitle = missingProject
    ? "Project unavailable"
    : "We couldn’t open this document";
  const errorDetail = missingProject
    ? "This project may have been removed, or you may no longer have access."
    : error;
  const statusVariant =
    visibleStatus === "Saved"
      ? "success"
      : visibleStatus === "Saving"
        ? "warning"
        : visibleStatus === "Save failed"
          ? "error"
          : "neutral";
  const updateCustomProperty = (next: ProjectDocumentProperty) => {
    onPropertiesChange?.(
      properties.map((property) =>
        property.id === next.id ? next : property,
      ),
    );
  };
  const addCustomProperty = (type: ProjectDocumentPropertyType) => {
    const baseName =
      type === "text"
        ? "Text"
        : type === "number"
          ? "Number"
          : type === "checkbox"
            ? "Checkbox"
            : "Date";
    const existingNames = new Set(properties.map((property) => property.name));
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `${baseName} ${suffix}`;
      suffix += 1;
    }
    onPropertiesChange?.([
      ...properties,
      {
        id: projectDocumentPropertyId(),
        name,
        type,
        value: type === "checkbox" ? false : type === "text" ? "" : null,
      },
    ]);
  };

  useEffect(() => {
    if (!onSearchDocuments) return;
    const timeout = window.setTimeout(
      () => onSearchDocuments(documentQuery.trim()),
      normalizedDocumentQuery ? 250 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [documentQuery, normalizedDocumentQuery, onSearchDocuments]);

  return (
    <main className="project-document-page">
      <Toolbar
        className="project-document-toolbar"
        label="Document controls"
        size="sm"
        variant="transparent"
        dividers={["bottom"]}
        startContent={
          <HStack gap={1} align="center">
            <IconButton
              label={
                sidebarOpen
                  ? "Close document navigation"
                  : "Open document navigation"
              }
              icon={<Icon icon="viewColumns" size="sm" />}
              variant={sidebarOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSidebarOpen((value) => !value)}
            />
            <Breadcrumbs
              className="project-document-identity"
              label="Project document"
            >
              <BreadcrumbItem onClick={() => history.back()}>
                Back
              </BreadcrumbItem>
              <BreadcrumbItem className="project-document-title" isCurrent>
                {title}
              </BreadcrumbItem>
            </Breadcrumbs>
          </HStack>
        }
        centerContent={
          <SegmentedControl
            className="project-document-mode-switcher"
            value={mode}
            onChange={(value) => onMode(value as ProjectDocumentMode)}
            label="Document view"
            size="sm"
          >
            <SegmentedControlItem value="page" label="Page" />
            <SegmentedControlItem value="edgeless" label="Canvas" />
          </SegmentedControl>
        }
        endContent={
          <HStack
            className="project-document-toolbar-actions"
            gap={1}
            align="center"
          >
            {presence.length > 0 ? (
              <div
                className="project-document-presence"
                aria-label={`${presence.length} active ${
                  presence.length === 1 ? "collaborator" : "collaborators"
                }`}
              >
                {presence.slice(0, 4).map((entry) => (
                  <span
                    key={entry.clientId}
                    className="project-document-presence-avatar"
                    style={{ backgroundColor: entry.color }}
                    title={`${entry.name}${entry.isLocal ? " (you)" : ""}`}
                  >
                    {projectDocumentPresenceInitials(entry.name)}
                  </span>
                ))}
              </div>
            ) : null}
            <Button
              label={`Comments ${openCommentCount}`}
              variant={commentsOpen ? "secondary" : "ghost"}
              size="sm"
              icon={<Icon icon="info" size="sm" />}
              onMouseDown={() => {
                if (!commentsOpen && editorHostRef?.current) {
                  setCommentAnchor(
                    selectedProjectDocumentCommentAnchor(editorHostRef.current),
                  );
                }
              }}
              onClick={() => {
                setHistoryOpen(false);
                setCommentsOpen((value) => !value);
              }}
            />
            <Button
              label="Share"
              variant="primary"
              size="sm"
              icon={<Icon icon="externalLink" size="sm" />}
              onClick={() => setShareOpen(true)}
            />
            <Button
              className="project-document-favorite-action"
              label={isFavorite ? "Favorited" : "Favorite"}
              variant={isFavorite ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onFavoriteChange?.(!isFavorite)}
            />
            <AstryxMenu
              button={{
                label: "More",
                variant: "ghost",
                size: "sm",
                icon: <Icon icon="moreHorizontal" size="sm" />,
              }}
              hasChevron={false}
              menuWidth={220}
              items={[
                {
                  label: "Rename",
                  onClick: () => {
                    titleInputRef.current?.focus();
                    titleInputRef.current?.select();
                  },
                },
                {
                  label: isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites",
                  onClick: () => onFavoriteChange?.(!isFavorite),
                },
                {
                  label:
                    mode === "page" ? "Switch to Canvas" : "Switch to Page",
                  onClick: () => onMode(mode === "page" ? "edgeless" : "page"),
                },
                {
                  label: "Open in new tab",
                  onClick: () =>
                    window.open(
                      window.location.href,
                      "_blank",
                      "noopener,noreferrer",
                    ),
                },
                ...(onDuplicateDocument
                  ? [
                      {
                        label: isDuplicatingDocument
                          ? "Duplicating…"
                          : "Duplicate",
                        onClick: onDuplicateDocument,
                        isDisabled: isDuplicatingDocument,
                      },
                    ]
                  : []),
                { type: "divider" },
                {
                  label: "View info",
                  onClick: () => setInfoOpen(true),
                },
                {
                  label: "View table of contents",
                  onClick: () => setOutlineOpen(true),
                  isDisabled: mode !== "page",
                },
                {
                  label: "View version history",
                  onClick: () => {
                    setCommentsOpen(false);
                    setHistoryOpen(true);
                    void onLoadVersions?.();
                  },
                },
                ...(onInsertSimpleTable || onInsertStarterBlocks
                  ? [
                      { type: "divider" as const },
                      ...(onInsertSimpleTable
                        ? [
                            {
                              label: "Insert simple table",
                              onClick: onInsertSimpleTable,
                              isDisabled: mode !== "page",
                            },
                          ]
                        : []),
                      ...(onInsertStarterBlocks
                        ? [
                            {
                              label: "Insert AFFiNE starter blocks",
                              onClick: onInsertStarterBlocks,
                              isDisabled: mode !== "page",
                            },
                          ]
                        : []),
                    ]
                  : []),
                ...(onDownloadRecovery ||
                onDownloadHtml ||
                onDownloadPng ||
                onDownloadMarkdown ||
                onCopyMarkdown ||
                onPrint
                  ? [
                      { type: "divider" as const },
                      ...(onOpenLibraryScope
                        ? [
                            {
                              label: "Import",
                              onClick: () => onOpenLibraryScope("import"),
                            },
                          ]
                        : []),
                      ...(onDownloadHtml
                        ? [
                            {
                              label: "Export to HTML",
                              onClick: onDownloadHtml,
                            },
                          ]
                        : []),
                      ...(onDownloadPng
                        ? [
                            {
                              label: "Export to PNG",
                              onClick: onDownloadPng,
                            },
                          ]
                        : []),
                      ...(onDownloadMarkdown
                        ? [
                            {
                              label: "Export to Markdown",
                              onClick: onDownloadMarkdown,
                            },
                          ]
                        : []),
                      ...(onCopyMarkdown
                        ? [
                            {
                              label: "Copy as Markdown",
                              onClick: onCopyMarkdown,
                            },
                          ]
                        : []),
                      ...(onDownloadRecovery
                        ? [
                            {
                              label: "Export recovery snapshot",
                              onClick: onDownloadRecovery,
                            },
                          ]
                        : []),
                      ...(onPrint
                        ? [
                            {
                              label: "Print",
                              onClick: onPrint,
                            },
                          ]
                        : []),
                    ]
                  : []),
                ...(onTrashDocument
                  ? [
                      { type: "divider" as const },
                      {
                        label: "Move to trash",
                        onClick: onTrashDocument,
                      },
                    ]
                  : []),
              ]}
            />
            {mode === "page" ? (
              <IconButton
                label={
                  outlineOpen
                    ? "Close table of contents"
                    : "Open table of contents"
                }
                icon={<Icon icon="viewColumns" size="sm" />}
                variant={outlineOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setOutlineOpen((value) => !value)}
              />
            ) : null}
            <HStack
              className="project-document-save-state"
              gap={1}
              align="center"
              data-state={visibleStatus.toLowerCase().replace(/\s+/g, "-")}
              role="status"
            >
              <StatusDot
                variant={statusVariant}
                label={`${visibleStatus} status`}
                isPulsing={visibleStatus === "Saving"}
                aria-hidden="true"
              />
              <Text type="supporting" weight="medium">
                {visibleStatus}
              </Text>
            </HStack>
          </HStack>
        }
      />
      <div className="project-document-workspace-body">
        {sidebarOpen ? (
          <aside
            className="project-document-sidebar"
            aria-label="Project documents"
          >
            <HStack
              className="project-document-sidebar-header"
              justify="between"
              align="center"
            >
              <Text
                className="project-document-sidebar-title"
                type="label"
                weight="semibold"
              >
                Project docs
              </Text>
              <Button
                label={isCreatingDocument ? "Creating…" : "New doc"}
                variant="primary"
                size="sm"
                isDisabled={isCreatingDocument}
                onClick={() => onCreateDocument?.()}
              />
            </HStack>
            <div className="project-document-sidebar-search">
              <TextInput
                label="Search documents"
                isLabelHidden
                value={documentQuery}
                onChange={setDocumentQuery}
                placeholder="Search docs…"
                startIcon={<Icon icon="search" size="sm" />}
                hasClear={Boolean(documentQuery)}
                width="100%"
              />
            </div>
            <nav aria-label="Project document list">
              {!normalizedDocumentQuery && favoriteDocuments.length > 0 ? (
                <section aria-labelledby="project-document-favorites-heading">
                  <Text
                    id="project-document-favorites-heading"
                    type="supporting"
                    weight="semibold"
                  >
                    Favorites
                  </Text>
                  <div className="project-document-sidebar-list">
                    {favoriteDocuments.map((document) => (
                      <button
                        key={`favorite-${document.id}`}
                        type="button"
                        className="project-document-sidebar-item"
                        data-active={document.id === activeDocumentId}
                        onClick={() => onSelectDocument?.(document.id)}
                      >
                        <Icon
                          icon={documentIconName(document.icon)}
                          size="sm"
                        />
                        <span>
                          <strong>{document.title}</strong>
                          <small>
                            Updated {formatDocumentListDate(document.updatedAt)}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              <section aria-labelledby="project-document-all-heading">
                <button
                  type="button"
                  className="project-document-sidebar-library-link"
                  id="project-document-all-heading"
                  onClick={() => onOpenLibrary?.()}
                >
                  All docs · {documents.length}
                </button>
                <div className="project-document-sidebar-list">
                  <button
                    type="button"
                    className="project-document-sidebar-item"
                    onClick={() => onOpenLibraryScope?.("journals")}
                  >
                    <Icon icon="calendar" size="sm" />
                    <span>
                      <strong>Journals</strong>
                      <small>Notes organized by date</small>
                    </span>
                  </button>
                </div>
                {normalizedDocumentQuery ? (
                  <div
                    className="project-document-sidebar-search-results"
                    aria-label="Document search results"
                  >
                    <Text type="supporting" weight="semibold">
                      {isSearchingDocuments
                        ? "Searching documents…"
                        : `Search results · ${visibleSearchResults.length}`}
                    </Text>
                    <div className="project-document-sidebar-list">
                      {visibleSearchResults.map(({ document, snippet }) => (
                        <button
                          key={document.id}
                          type="button"
                          className="project-document-sidebar-item"
                          data-active={document.id === activeDocumentId}
                          onClick={() => onSelectDocument?.(document.id)}
                        >
                          <Icon
                            icon={documentIconName(document.icon)}
                            size="sm"
                          />
                          <span>
                            <strong>{document.title}</strong>
                            <small
                              className={
                                snippet
                                  ? "project-document-search-snippet"
                                  : undefined
                              }
                            >
                              {snippet ||
                                `Updated ${formatDocumentListDate(
                                  document.updatedAt,
                                )}`}
                            </small>
                          </span>
                        </button>
                      ))}
                      {documentSearchError ? (
                        <Text type="supporting">{documentSearchError}</Text>
                      ) : null}
                      {!isSearchingDocuments &&
                      !documentSearchError &&
                      visibleSearchResults.length === 0 ? (
                        <Text type="supporting">
                          No documents match your search.
                        </Text>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
              <section aria-labelledby="project-document-organize-heading">
                <HStack justify="between" align="center">
                  <Text
                    id="project-document-organize-heading"
                    type="supporting"
                    weight="semibold"
                  >
                    Organize
                  </Text>
                  <Button
                    label="New folder"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenLibraryScope?.("new-folder")}
                  />
                </HStack>
                {folders.length > 0 ? (
                  <div className="project-document-sidebar-list">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className="project-document-sidebar-item"
                        onClick={() =>
                          onOpenLibraryScope?.("folder", folder.id)
                        }
                      >
                        <Icon icon="viewColumns" size="sm" />
                        <span>
                          <strong>{folder.name}</strong>
                          <small>
                            {folder.documentIds.length}{" "}
                            {folder.documentIds.length === 1
                              ? "document"
                              : "documents"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
              <section aria-labelledby="project-document-tags-heading">
                <HStack justify="between" align="center">
                  <Text
                    id="project-document-tags-heading"
                    type="supporting"
                    weight="semibold"
                  >
                    Tags
                  </Text>
                  <Button
                    label="New tag"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenLibraryScope?.("new-tag")}
                  />
                </HStack>
                {tags.length > 0 ? (
                  <div className="project-document-sidebar-list">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="project-document-sidebar-item"
                        onClick={() => onOpenLibraryScope?.("tag", tag.id)}
                      >
                        <span
                          className="project-document-tag-dot"
                          data-color={tag.color}
                          aria-hidden="true"
                        />
                        <span>
                          <strong>{tag.name}</strong>
                          <small>
                            {tag.documentIds.length}{" "}
                            {tag.documentIds.length === 1
                              ? "document"
                              : "documents"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
              <section aria-labelledby="project-document-collections-heading">
                <HStack justify="between" align="center">
                  <button
                    type="button"
                    className="project-document-sidebar-library-link"
                    id="project-document-collections-heading"
                    onClick={() => onOpenLibraryScope?.("collections")}
                  >
                    Collections · {collections.length}
                  </button>
                  <Button
                    label="New collection"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenLibraryScope?.("new-collection")}
                  />
                </HStack>
                <div className="project-document-sidebar-list">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      className="project-document-sidebar-item"
                      onClick={() =>
                        onOpenLibraryScope?.("collection", collection.id)
                      }
                    >
                      <Icon icon="funnel" size="sm" />
                      <span>
                        <strong>{collection.name}</strong>
                        <small>
                          {collection.documentIds.length}{" "}
                          {collection.documentIds.length === 1
                            ? "document"
                            : "documents"}
                        </small>
                      </span>
                    </button>
                  ))}
                  {collections.length === 0 ? (
                    <Text type="supporting">No collections yet.</Text>
                  ) : null}
                </div>
              </section>
              <section aria-labelledby="project-document-others-heading">
                <Text
                  id="project-document-others-heading"
                  type="supporting"
                  weight="semibold"
                >
                  Others
                </Text>
                <div className="project-document-sidebar-list">
                  <button
                    type="button"
                    className="project-document-sidebar-item"
                    onClick={() => onOpenLibraryScope?.("trash")}
                  >
                    <Icon icon="viewColumns" size="sm" />
                    <span>
                      <strong>Trash</strong>
                      <small>
                        {trash.length} deleted{" "}
                        {trash.length === 1 ? "document" : "documents"}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="project-document-sidebar-item"
                    onClick={() => onOpenLibraryScope?.("import")}
                  >
                    <Icon icon="arrowDown" size="sm" />
                    <span>
                      <strong>Import</strong>
                      <small>Markdown or HTML</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="project-document-sidebar-item"
                    onClick={() => onOpenLibraryScope?.("templates")}
                  >
                    <Icon icon="viewColumns" size="sm" />
                    <span>
                      <strong>Templates</strong>
                      <small>BA/PO structures</small>
                    </span>
                  </button>
                </div>
              </section>
            </nav>
          </aside>
        ) : null}
        <section className="project-document-workspace-editor">
          {error ? (
            <section
              className="project-document-error"
              role="alert"
              aria-labelledby="project-document-error-title"
            >
              <div className="project-document-error-card">
                <span
                  className="project-document-error-icon"
                  aria-hidden="true"
                >
                  !
                </span>
                <div className="project-document-error-copy">
                  <h2 id="project-document-error-title">{errorTitle}</h2>
                  <p>{errorDetail}</p>
                </div>
                <div className="project-document-error-actions">
                  <Button
                    className="project-document-retry"
                    label="Retry"
                    variant="primary"
                    clickAction={onRetry}
                  />
                  {onDownloadRecovery ? (
                    <Button
                      label="Download recovery snapshot"
                      variant="secondary"
                      clickAction={onDownloadRecovery}
                    />
                  ) : null}
                </div>
              </div>
            </section>
          ) : mode === "page" ? (
            <div className="project-document-page-mode">
              <section className="project-document-page-scroll">
                <div
                  className="project-document-page-content"
                  data-page-width={pageWidth}
                >
                  <header className="project-document-page-header">
                    {journalDate ? (
                      <nav
                        className="project-document-editor-journal-strip"
                        aria-label="Journal dates"
                      >
                        {journalWeekDates(journalDate).map((dateKey) => {
                          const date = new Date(`${dateKey}T12:00:00`);
                          const hasJournal = documents.some(
                            (document) => document.journalDate === dateKey,
                          );
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              aria-label={new Intl.DateTimeFormat(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              }).format(date)}
                              data-active={dateKey === journalDate}
                              data-has-journal={hasJournal}
                              onClick={() => onJournalDateChange?.(dateKey)}
                            >
                              <small>
                                {new Intl.DateTimeFormat(undefined, {
                                  weekday: "short",
                                }).format(date)}
                              </small>
                              <strong>{date.getDate()}</strong>
                            </button>
                          );
                        })}
                        <Button
                          label="Today"
                          variant="secondary"
                          size="sm"
                          onClick={() => onJournalDateChange?.(localDateKey())}
                        />
                      </nav>
                    ) : null}
                    <div className="project-document-page-actions">
                      {icon !== "none" ? (
                        <button
                          className="project-document-page-icon"
                          type="button"
                          aria-label="Change page icon"
                          onClick={() => setIconPickerOpen((value) => !value)}
                        >
                          <Icon icon={pageIconNames[icon]} size="lg" />
                        </button>
                      ) : null}
                      <HStack gap={1} align="center">
                        <Button
                          label={icon === "none" ? "Add icon" : "Change icon"}
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon="viewColumns" size="sm" />}
                          onClick={() => setIconPickerOpen((value) => !value)}
                        />
                      </HStack>
                      {iconPickerOpen ? (
                        <div
                          className="project-document-icon-picker"
                          role="menu"
                          aria-label="Page icon"
                        >
                          {pageIconOptions.map((option) => (
                            <IconButton
                              key={option.value}
                              label={option.label}
                              icon={<Icon icon={option.icon} size="md" />}
                              variant={
                                icon === option.value ? "primary" : "ghost"
                              }
                              size="md"
                              onClick={() => {
                                onIconChange?.(option.value);
                                setIconPickerOpen(false);
                              }}
                            />
                          ))}
                          {icon !== "none" ? (
                            <IconButton
                              label="Remove icon"
                              icon={<Icon icon="close" size="md" />}
                              variant="ghost"
                              size="md"
                              onClick={() => {
                                onIconChange?.("none");
                                setIconPickerOpen(false);
                              }}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <input
                      ref={titleInputRef}
                      className="project-document-page-title-input"
                      aria-label="Document title"
                      value={title}
                      maxLength={200}
                      readOnly={!onTitleChange}
                      onChange={(event) =>
                        onTitleChange?.(event.currentTarget.value)
                      }
                      onBlur={() => onTitleCommit?.()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <div className="project-document-info-toggle">
                      <Button
                        label="Info"
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon="info" size="sm" />}
                        onClick={() => setInfoOpen((value) => !value)}
                      />
                    </div>
                    {infoOpen ? (
                      <section
                        className="project-document-properties"
                        aria-label="Document properties"
                      >
                        <Text type="label" weight="semibold">
                          Document properties
                        </Text>
                        <dl>
                          <div>
                            <dt>Tags</dt>
                            <dd>
                              <button
                                type="button"
                                className="project-document-properties-tags"
                                onClick={() => setTagPickerOpen(true)}
                              >
                                {activeDocumentTags.length > 0 ? (
                                  activeDocumentTags.map((tag) => (
                                    <span key={tag.id} data-color={tag.color}>
                                      {tag.name}
                                    </span>
                                  ))
                                ) : (
                                  <span>Empty</span>
                                )}
                              </button>
                            </dd>
                          </div>
                          <div>
                            <dt>Created</dt>
                            <dd>{formatDocumentDate(createdAt)}</dd>
                          </div>
                          <div>
                            <dt>Updated</dt>
                            <dd>{formatDocumentDate(updatedAt)}</dd>
                          </div>
                          <div>
                            <dt>Created by</dt>
                            <dd>{createdByEmail ?? "Unknown"}</dd>
                          </div>
                          <div>
                            <dt>Last edited by</dt>
                            <dd>{lastEditedByEmail ?? "Unknown"}</dd>
                          </div>
                          <div>
                            <dt>View</dt>
                            <dd>Page and Canvas</dd>
                          </div>
                          <div>
                            <dt>Template</dt>
                            <dd>
                              <label className="project-document-template-checkbox">
                                <input
                                  type="checkbox"
                                  aria-label="Reusable template"
                                  checked={isTemplate}
                                  disabled={
                                    !onTemplateChange || isUpdatingTemplate
                                  }
                                  onChange={(event) =>
                                    onTemplateChange?.(
                                      event.currentTarget.checked,
                                    )
                                  }
                                />
                                <span>
                                  {isUpdatingTemplate
                                    ? "Updating…"
                                    : isTemplate
                                      ? "Reusable"
                                      : "Not a template"}
                                </span>
                              </label>
                            </dd>
                          </div>
                          <div>
                            <dt>Page width</dt>
                            <dd>
                              <SegmentedControl
                                value={pageWidth}
                                onChange={(value) =>
                                  onPageWidthChange?.(
                                    value as ProjectDocumentPageWidth,
                                  )
                                }
                                label="Page width"
                                size="sm"
                              >
                                <SegmentedControlItem
                                  value="standard"
                                  label="Standard"
                                />
                                <SegmentedControlItem
                                  value="full"
                                  label="Full width"
                                />
                              </SegmentedControl>
                            </dd>
                          </div>
                          <div>
                            <dt>Favorite</dt>
                            <dd>{isFavorite ? "Yes" : "No"}</dd>
                          </div>
                          <div>
                            <dt>Links</dt>
                            <dd>
                              <Button
                                label={
                                  linkedDocuments.length
                                    ? `${linkedDocuments.length} linked`
                                    : "Add links"
                                }
                                variant="secondary"
                                size="sm"
                                onClick={() => setLinkPickerOpen(true)}
                              />
                            </dd>
                          </div>
                          {properties.map((property) => (
                            <ProjectDocumentPropertyEditor
                              key={property.id}
                              property={property}
                              readOnly={!onPropertiesChange}
                              onChange={updateCustomProperty}
                              onRemove={() =>
                                onPropertiesChange?.(
                                  properties.filter(
                                    (candidate) =>
                                      candidate.id !== property.id,
                                  ),
                                )
                              }
                            />
                          ))}
                          {onPropertiesChange ? (
                            <div className="project-document-add-property">
                              <dt>Custom</dt>
                              <dd>
                                <AstryxMenu
                                  button={{
                                    label: "Add property",
                                    variant: "secondary",
                                    size: "sm",
                                  }}
                                  menuWidth={190}
                                  items={[
                                    {
                                      label: "Text",
                                      onClick: () =>
                                        addCustomProperty("text"),
                                    },
                                    {
                                      label: "Number",
                                      onClick: () =>
                                        addCustomProperty("number"),
                                    },
                                    {
                                      label: "Checkbox",
                                      onClick: () =>
                                        addCustomProperty("checkbox"),
                                    },
                                    {
                                      label: "Date",
                                      onClick: () =>
                                        addCustomProperty("date"),
                                    },
                                  ]}
                                />
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </section>
                    ) : null}
                  </header>
                  <div
                    className="project-document-editor project-document-page-editor"
                    ref={editorHostRef}
                    aria-label="Page editor"
                  />
                  <section
                    className="project-document-links"
                    aria-label="Document links and backlinks"
                  >
                    <button
                      type="button"
                      className="project-document-links-toggle"
                      aria-expanded={linksOpen}
                      onClick={() => setLinksOpen((value) => !value)}
                    >
                      <span>
                        <strong>Bi-directional links</strong>
                        <small>
                          {linkedDocuments.length} linked ·{" "}
                          {backlinkDocuments.length} backlinks
                        </small>
                      </span>
                      <span>{linksOpen ? "Hide" : "Show"}</span>
                    </button>
                    {linksOpen ? (
                      <div className="project-document-links-content">
                        <div>
                          <HStack justify="between" align="center">
                            <Text type="label" weight="semibold">
                              Linked documents
                            </Text>
                            <Button
                              label="Manage"
                              variant="secondary"
                              size="sm"
                              onClick={() => setLinkPickerOpen(true)}
                            />
                          </HStack>
                          <div className="project-document-link-list">
                            {linkedDocuments.map((document) => (
                              <button
                                key={document.id}
                                type="button"
                                onClick={() => onSelectDocument?.(document.id)}
                              >
                                <Icon
                                  icon={documentIconName(document.icon)}
                                  size="sm"
                                />
                                <span>{document.title}</span>
                              </button>
                            ))}
                            {linkedDocuments.length === 0 ? (
                              <Text type="supporting">
                                No linked documents yet.
                              </Text>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <Text type="label" weight="semibold">
                            Backlinks
                          </Text>
                          <div className="project-document-link-list">
                            {backlinkDocuments.map((document) => (
                              <button
                                key={document.id}
                                type="button"
                                onClick={() => onSelectDocument?.(document.id)}
                              >
                                <Icon
                                  icon={documentIconName(document.icon)}
                                  size="sm"
                                />
                                <span>{document.title}</span>
                              </button>
                            ))}
                            {backlinkDocuments.length === 0 ? (
                              <Text type="supporting">
                                Nothing links to this document yet.
                              </Text>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>
              </section>
              {outlineOpen ? (
                <aside
                  className="project-document-outline"
                  aria-label="Table of contents"
                >
                  <HStack justify="between" align="center">
                    <Text type="label" weight="semibold">
                      Table of contents
                    </Text>
                    <IconButton
                      label="Close table of contents"
                      icon={<Icon icon="close" size="sm" />}
                      variant="ghost"
                      size="sm"
                      onClick={() => setOutlineOpen(false)}
                    />
                  </HStack>
                  <nav aria-label="Document outline">
                    <button
                      type="button"
                      className="project-document-outline-item"
                      data-level="1"
                      onClick={() => titleInputRef.current?.scrollIntoView()}
                    >
                      {title}
                    </button>
                    {outlineItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="project-document-outline-item"
                        data-level={item.level}
                        onClick={() => onOutlineSelect?.(item.id)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </nav>
                  {outlineItems.length === 0 ? (
                    <Text type="supporting">
                      Add headings to build an outline.
                    </Text>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : (
            <div
              className="project-document-editor project-document-canvas-editor"
              ref={editorHostRef}
              aria-label="Canvas editor"
            />
          )}
        </section>
        {commentsOpen && !error ? (
          <ProjectDocumentCommentsPanel
            comments={comments}
            anchor={commentAnchor}
            error={commentError}
            submitting={isSubmittingComment}
            onClose={() => setCommentsOpen(false)}
            onSubmit={async (body, anchor) =>
              (await onAddComment?.(body, anchor)) ?? false
            }
            onClearAnchor={() => setCommentAnchor(undefined)}
            onSelectAnchor={(blockId) => onOutlineSelect?.(blockId)}
            onResolve={(commentId, resolved) =>
              onResolveComment?.(commentId, resolved)
            }
          />
        ) : null}
        {historyOpen && !error ? (
          <ProjectDocumentHistoryPanel
            versions={versions}
            error={historyError}
            loading={isLoadingHistory}
            saving={isSavingVersion}
            restoringVersionId={restoringVersionId}
            readOnly={access.role === "viewer"}
            onClose={() => setHistoryOpen(false)}
            onCreate={async (label) =>
              (await onCreateVersion?.(label)) ?? false
            }
            onRestore={(versionId) => onRestoreVersion?.(versionId)}
          />
        ) : null}
      </div>
      <ProjectDocumentTagPickerDialog
        document={activeDocument}
        tags={tags}
        isOpen={tagPickerOpen && activeDocument !== undefined}
        onClose={() => setTagPickerOpen(false)}
        onSubmit={(tagIds) => {
          if (activeDocumentId !== undefined) {
            onSetDocumentTags?.(activeDocumentId, tagIds);
          }
          setTagPickerOpen(false);
        }}
      />
      <ProjectDocumentLinkPickerDialog
        document={activeDocument}
        documents={documents}
        linkedDocumentIds={linkedDocumentIds}
        isOpen={linkPickerOpen && activeDocument !== undefined}
        onClose={() => setLinkPickerOpen(false)}
        onSubmit={(documentIds) => {
          if (activeDocumentId !== undefined) {
            onSetDocumentLinks?.(activeDocumentId, documentIds);
          }
          setLinkPickerOpen(false);
        }}
      />
      <AstryxModal
        className="project-document-share-dialog"
        isOpen={shareOpen}
        onOpenChange={(open) => setShareOpen(open)}
        purpose="form"
        width={680}
      >
        <div className="project-document-share-dialog-content">
          <div>
            <Heading level={3}>Share {title}</Heading>
            <Text color="secondary">
              Share inside the Project or publish a read-only link.
            </Text>
          </div>
          <div className="project-document-share-dialog-link">
            <div>
              <Text type="label" weight="semibold">
                Project link
              </Text>
              <Text type="supporting">
                Opens this Page or Canvas inside Astryx.
              </Text>
            </div>
            <CopyButton
              action={() => copyShareLink(window.location.href)}
              label="Copy link"
              successMessage="Project document link copied"
              variant="primary"
              size="md"
            />
          </div>
          {access.role === "owner" ? (
            <div className="project-document-share-dialog-collaboration">
              <div>
                <Text type="label" weight="semibold">
                  Project collaborators
                </Text>
                <Text type="supporting">
                  Invite a registered Astryx user to edit or view every Project
                  document.
                </Text>
              </div>
              <div className="project-document-share-dialog-invite">
                <div className="project-document-share-dialog-email">
                  <TextInput
                    label="Email"
                    isLabelHidden
                    value={collaboratorEmail}
                    placeholder="teammate@example.com"
                    width="100%"
                    onChange={setCollaboratorEmail}
                    onEnter={() => {
                      const email = collaboratorEmail.trim();
                      if (!email) return;
                      void Promise.resolve(
                        onAddCollaborator?.(email, collaboratorRole),
                      ).then((added) => {
                        if (added) setCollaboratorEmail("");
                      });
                    }}
                  />
                </div>
                <SegmentedControl
                  label="Collaborator role"
                  value={collaboratorRole}
                  onChange={(value) =>
                    setCollaboratorRole(
                      value as ProjectDocumentCollaboratorRole,
                    )
                  }
                >
                  <SegmentedControlItem label="Can edit" value="editor" />
                  <SegmentedControlItem label="Can view" value="viewer" />
                </SegmentedControl>
                <Button
                  label="Invite"
                  variant="primary"
                  size="sm"
                  isDisabled={!collaboratorEmail.trim() || !onAddCollaborator}
                  onClick={() => {
                    const email = collaboratorEmail.trim();
                    if (!email) return;
                    void Promise.resolve(
                      onAddCollaborator?.(email, collaboratorRole),
                    ).then((added) => {
                      if (added) setCollaboratorEmail("");
                    });
                  }}
                />
              </div>
              {collaborators.map((collaborator) => (
                <div
                  className="project-document-share-dialog-grant"
                  key={collaborator.userId}
                >
                  <div>
                    <Text type="label" weight="semibold">
                      {collaborator.email}
                    </Text>
                    <Text type="supporting">
                      {collaborator.role === "editor"
                        ? "Can edit and comment"
                        : "Can view"}
                    </Text>
                  </div>
                  <Button
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveCollaborator?.(collaborator.userId)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="project-document-share-dialog-public">
              <div>
                <Text type="label" weight="semibold">
                  Shared with you
                </Text>
                <Text type="supporting">
                  You have {access.role === "editor" ? "edit" : "view-only"}{" "}
                  access to this Project.
                </Text>
              </div>
            </div>
          )}
          <div className="project-document-share-dialog-public">
            <div>
              <Text type="label" weight="semibold">
                Public read-only access
              </Text>
              <Text type="supporting">
                Anyone with the link can see the live Page or Canvas.
              </Text>
            </div>
            <Button
              label="Create public link"
              variant="primary"
              size="sm"
              isLoading={isCreatingShare}
              isDisabled={access.role !== "owner" || !onCreatePublicShare}
              onClick={() => onCreatePublicShare?.()}
            />
          </div>
          {shareError ? (
            <Text
              className="project-document-share-dialog-error"
              type="supporting"
              color="secondary"
            >
              {shareError}
            </Text>
          ) : null}
          {shares.length > 0 ? (
            <div className="project-document-share-dialog-grants">
              {shares.map((share) => (
                <div
                  className="project-document-share-dialog-grant"
                  key={share.id}
                >
                  <div>
                    <Text type="label" weight="semibold">
                      Public link
                    </Text>
                    <Text type="supporting">
                      {share.url
                        ? "Ready to copy or open."
                        : "Active. Create a new link if you need the URL again."}
                    </Text>
                    {share.url ? (
                      <code className="project-document-share-dialog-url">
                        {share.url}
                      </code>
                    ) : null}
                  </div>
                  <HStack gap={1} align="center">
                    {share.url ? (
                      <>
                        <CopyButton
                          action={() => copyShareLink(share.url!)}
                          label="Copy"
                          successMessage="Public document link copied"
                          variant="secondary"
                          size="sm"
                        />
                        <Button
                          label="Open"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(
                              share.url!,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        />
                      </>
                    ) : null}
                    <Button
                      label="Revoke"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevokePublicShare?.(share.id)}
                    />
                  </HStack>
                </div>
              ))}
            </div>
          ) : null}
          <div className="project-document-share-dialog-footer">
            <Text type="supporting">
              Public viewers cannot edit or comment.
            </Text>
            <HStack
              className="project-document-share-dialog-export-actions"
              gap={1}
              align="center"
            >
              {onDownloadHtml ? (
                <Button
                  label="Export HTML"
                  variant="primary"
                  size="sm"
                  onClick={onDownloadHtml}
                />
              ) : null}
              {onDownloadMarkdown ? (
                <Button
                  label="Export Markdown"
                  variant="secondary"
                  size="sm"
                  onClick={onDownloadMarkdown}
                />
              ) : null}
              {onDownloadRecovery ? (
                <Button
                  label="Export recovery snapshot"
                  variant="secondary"
                  size="sm"
                  onClick={onDownloadRecovery}
                />
              ) : null}
            </HStack>
          </div>
        </div>
      </AstryxModal>
    </main>
  );
}

function ProjectDocumentEditorWorkspace({
  projectId,
  documentId: selectedDocumentId,
}: {
  projectId: number;
  documentId?: number;
}) {
  const { user } = useAuth();
  const editorHostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ProjectDocumentRuntime | undefined>(undefined);
  const [runtime, setRuntime] = useState<ProjectDocumentRuntime>();
  const [documentRecordId, setDocumentRecordId] = useState<number>();
  const [documents, setDocuments] = useState<ProjectDocumentPublic[]>([]);
  const [searchResults, setSearchResults] = useState<
    ProjectDocumentSearchResult[]
  >([]);
  const [isSearchingDocuments, setIsSearchingDocuments] = useState(false);
  const [documentSearchError, setDocumentSearchError] = useState("");
  const [trash, setTrash] = useState<ProjectDocumentPublic[]>([]);
  const [folders, setFolders] = useState<ProjectDocumentFolder[]>([]);
  const [tags, setTags] = useState<ProjectDocumentTag[]>([]);
  const [collections, setCollections] = useState<
    ProjectDocumentSmartCollection[]
  >([]);
  const [links, setLinks] = useState<ProjectDocumentLink[]>([]);
  const [comments, setComments] = useState<ProjectDocumentComment[]>([]);
  const [shares, setShares] = useState<ProjectDocumentShare[]>([]);
  const [versions, setVersions] = useState<ProjectDocumentVersion[]>([]);
  const [access, setAccess] = useState<ProjectDocumentAccess>({
    ownerUserId: 0,
    role: "owner",
  });
  const [collaborators, setCollaborators] = useState<
    ProjectDocumentCollaborator[]
  >([]);
  const [presence, setPresence] = useState<ProjectDocumentPresence[]>([]);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [isDuplicatingDocument, setIsDuplicatingDocument] = useState(false);
  const isCreatingDocumentRef = useRef(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number>();
  const [title, setTitle] = useState("Project notes");
  const [savedTitle, setSavedTitle] = useState("Project notes");
  const [icon, setIcon] = useState<ProjectDocumentIcon>("none");
  const [savedIcon, setSavedIcon] = useState<ProjectDocumentIcon>("none");
  const [isFavorite, setIsFavorite] = useState(false);
  const [savedIsFavorite, setSavedIsFavorite] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [pageWidth, setPageWidth] =
    useState<ProjectDocumentPageWidth>("standard");
  const [savedPageWidth, setSavedPageWidth] =
    useState<ProjectDocumentPageWidth>("standard");
  const [properties, setProperties] = useState<ProjectDocumentProperty[]>([]);
  const [savedProperties, setSavedProperties] = useState<
    ProjectDocumentProperty[]
  >([]);
  const [outlineItems, setOutlineItems] = useState<
    ProjectDocumentOutlineItem[]
  >([]);
  const [createdAt, setCreatedAt] = useState<string>();
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [createdByEmail, setCreatedByEmail] = useState<string>();
  const [lastEditedByEmail, setLastEditedByEmail] = useState<string>();
  const [journalDate, setJournalDate] = useState<string | null>(null);
  const [mode, setMode] = useState<ProjectDocumentMode>("page");
  const [status, setStatus] = useState<ProjectDocumentSaveState>("Saving");
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [shareError, setShareError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  const documentRecordIdRef = useRef<number | undefined>(undefined);
  const linksRef = useRef<ProjectDocumentLink[]>([]);
  const searchRequestRef = useRef(0);
  const lastIndexedSearchTextRef = useRef("");

  documentRecordIdRef.current = documentRecordId;
  linksRef.current = links;

  useEffect(() => {
    let active = true;
    const previous = runtimeRef.current;
    runtimeRef.current = undefined;
    previous?.dispose();
    setRuntime(undefined);
    setError("");
    setCommentError("");
    setShareError("");
    setHistoryError("");
    setComments([]);
    setSearchResults([]);
    setDocumentSearchError("");
    setShares([]);
    setVersions([]);
    setPresence([]);
    const refreshDocuments = () =>
      listProjectDocuments(projectId).then((collection) => {
        if (active) {
          setDocuments(collection.documents);
          setTrash(collection.trash ?? []);
          setFolders(collection.folders ?? []);
          setTags(collection.tags ?? []);
          setCollections(collection.collections ?? []);
          setLinks(collection.links ?? []);
          setAccess(
            collection.access ?? { ownerUserId: user?.id ?? 0, role: "owner" },
          );
          setCollaborators(collection.collaborators ?? []);
        }
      });

    void refreshDocuments().catch(() => {
      // A selected document may no longer exist. Keep the editor error while
      // preserving any list that was already loaded so another page can open.
    });

    bootstrapProjectDocument(projectId, selectedDocumentId)
      .then((bootstrap) => {
        if (!active) return;
        let initialUpdate: Uint8Array | undefined;
        if (typeof window !== "undefined") {
          const storageKey = restoredVersionStorageKey(
            bootstrap.document.id,
            bootstrap.syncInstanceId,
          );
          const encoded = window.sessionStorage.getItem(storageKey);
          if (encoded) {
            initialUpdate = decodeBase64Update(encoded);
            window.sessionStorage.removeItem(storageKey);
          }
        }
        const next = createProjectDocumentRuntime(bootstrap, {
          presence: user?.email ? { name: user.email } : undefined,
          initialUpdate,
        });
        runtimeRef.current = next;
        setRuntime(next);
        setDocumentRecordId(bootstrap.document.id);
        setTitle(bootstrap.document.title);
        setSavedTitle(bootstrap.document.title);
        setIcon(bootstrap.document.icon ?? "none");
        setSavedIcon(bootstrap.document.icon ?? "none");
        setIsFavorite(bootstrap.document.isFavorite ?? false);
        setSavedIsFavorite(bootstrap.document.isFavorite ?? false);
        setIsTemplate(bootstrap.document.isTemplate ?? false);
        setPageWidth(bootstrap.document.pageWidth ?? "standard");
        setSavedPageWidth(bootstrap.document.pageWidth ?? "standard");
        setProperties(bootstrap.document.properties ?? []);
        setSavedProperties(bootstrap.document.properties ?? []);
        setCreatedAt(bootstrap.document.createdAt);
        setUpdatedAt(bootstrap.document.updatedAt);
        setCreatedByEmail(bootstrap.document.createdByEmail);
        setLastEditedByEmail(bootstrap.document.lastEditedByEmail);
        setJournalDate(bootstrap.document.journalDate ?? null);
        setMode(bootstrap.document.lastEditorMode);
        setStatus(next.snapshot());
        setPresence(next.presence());
        const unsubscribe = next.subscribe(() => {
          if (active) {
            setStatus(next.snapshot());
            setPresence(next.presence());
          }
        });
        if (!active) {
          unsubscribe();
          next.dispose();
        }
        void listProjectDocumentComments(projectId, bootstrap.document.id)
          .then((nextComments) => {
            if (active) setComments(nextComments);
          })
          .catch((cause) => {
            if (active) setCommentError((cause as Error).message);
          });
        void listProjectDocumentShares(projectId, bootstrap.document.id)
          .then((nextShares) => {
            if (active) setShares(nextShares);
          })
          .catch((cause) => {
            if (active) setShareError((cause as Error).message);
          });
        return refreshDocuments();
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
      const current = runtimeRef.current;
      runtimeRef.current = undefined;
      current?.dispose();
    };
  }, [projectId, retryKey, selectedDocumentId, user?.email, user?.id]);

  useEffect(() => {
    if (
      !runtime ||
      !documentRecordId ||
      status !== "Saved" ||
      access.role === "viewer"
    ) {
      return;
    }
    const searchText = markdownProjectDocumentExport(runtime.doc, title).slice(
      0,
      200_000,
    );
    const indexKey = `${documentRecordId}:${searchText}`;
    if (lastIndexedSearchTextRef.current === indexKey) return;
    const timeout = window.setTimeout(() => {
      void updateProjectDocumentSearchIndex(
        projectId,
        documentRecordId,
        searchText,
      )
        .then(() => {
          lastIndexedSearchTextRef.current = indexKey;
        })
        .catch(() => {
          // Search indexing is secondary to document persistence. A later
          // Saved transition retries it without changing the save status.
        });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [access.role, documentRecordId, projectId, runtime, status, title]);

  const searchDocuments = useCallback(
    (query: string) => {
      const requestId = ++searchRequestRef.current;
      const normalized = query.trim();
      setDocumentSearchError("");
      if (!normalized) {
        setSearchResults([]);
        setIsSearchingDocuments(false);
        return;
      }
      setIsSearchingDocuments(true);
      searchProjectDocuments(projectId, normalized)
        .then((results) => {
          if (searchRequestRef.current === requestId) setSearchResults(results);
        })
        .catch((cause) => {
          if (searchRequestRef.current === requestId) {
            setSearchResults([]);
            setDocumentSearchError((cause as Error).message);
          }
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) {
            setIsSearchingDocuments(false);
          }
        });
    },
    [projectId],
  );

  useEffect(() => {
    if (!runtime || !documentRecordId) return;
    syncProjectDocumentCollectionMetadata(
      runtime.doc,
      documentRecordId,
      documents,
    );
  }, [documentRecordId, documents, runtime]);

  const persistInlineDocumentLink = useCallback(
    (targetDocumentId: number) => {
      const sourceDocumentId = documentRecordIdRef.current;
      if (
        !sourceDocumentId ||
        targetDocumentId === sourceDocumentId ||
        !Number.isSafeInteger(targetDocumentId)
      ) {
        return;
      }
      const targetDocumentIds = linksRef.current
        .filter((link) => link.sourceDocumentId === sourceDocumentId)
        .map((link) => link.targetDocumentId);
      if (targetDocumentIds.includes(targetDocumentId)) return;

      setProjectDocumentLinks(projectId, sourceDocumentId, [
        ...targetDocumentIds,
        targetDocumentId,
      ])
        .then((collection) => {
          setDocuments(collection.documents);
          setFolders(collection.folders ?? []);
          setTags(collection.tags ?? []);
          setLinks(collection.links ?? []);
        })
        .catch((cause) => setError((cause as Error).message));
    },
    [projectId],
  );

  const createPersistentDocument = useCallback(async () => {
    if (isCreatingDocumentRef.current) return undefined;
    isCreatingDocumentRef.current = true;
    setIsCreatingDocument(true);
    setError("");
    try {
      const created = await createProjectDocument(projectId);
      setDocuments((current) => [
        created.document,
        ...current.filter((document) => document.id !== created.document.id),
      ]);
      return created.document.id;
    } catch (cause) {
      setError((cause as Error).message);
      return undefined;
    } finally {
      isCreatingDocumentRef.current = false;
      setIsCreatingDocument(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!runtime || !editorHostRef.current) return;
    let active = true;
    let editor: HTMLElement | undefined;
    let referenceSubscription: { dispose(): void } | undefined;
    let slashMenuConfigurationDispose: (() => void) | undefined;
    let canvasTemplateConfigurationDispose: (() => void) | undefined;
    let blockSuiteAccessibilityDispose: (() => void) | undefined;
    let mountStage = "loading editor modules";
    const loadEditorModule = async <Module,>(
      label: string,
      modulePromise: Promise<Module>,
    ): Promise<Module> => {
      try {
        return await modulePromise;
      } catch (cause) {
        throw new Error(
          `Unable to load ${label}: ${(cause as Error).message}`,
          { cause },
        );
      }
    };
    Promise.all([
      loadEditorModule(
        "BlockSuite block effects",
        import("@blocksuite/blocks/effects"),
      ),
      loadEditorModule(
        "BlockSuite preset effects",
        import("@blocksuite/presets/effects"),
      ),
      loadEditorModule("BlockSuite blocks", import("@blocksuite/blocks")),
      loadEditorModule(
        "BlockSuite standard extensions",
        import("@blocksuite/block-std"),
      ),
      loadEditorModule(
        "the table block",
        import("../projectDocumentTableBlock.ts"),
      ),
      loadEditorModule(
        "the callout block",
        import("../projectDocumentCalloutBlock.ts"),
      ),
      loadEditorModule(
        "the embed block",
        import("../projectDocumentEmbedBlock.ts"),
      ),
      loadEditorModule(
        "text alignment",
        import("../projectDocumentTextAlignment.ts"),
      ),
      loadEditorModule(
        "the calendar view",
        import("../projectDocumentCalendarView.ts"),
      ),
      loadEditorModule(
        "document slash commands",
        import("../projectDocumentSlashMenu.ts"),
      ),
      loadEditorModule(
        "Canvas templates",
        import("../projectDocumentCanvasTemplates.ts"),
      ),
      loadEditorModule(
        "BlockSuite UI integration",
        import("../projectDocumentBlockSuiteUi.ts"),
      ),
    ])
      .then(
        ([
          blockEffects,
          presetEffects,
          blocks,
          blockStd,
          tableBlock,
          calloutBlock,
          embedBlock,
          textAlignment,
          calendarView,
          slashMenu,
          canvasTemplates,
          blockSuiteUi,
        ]) => {
          if (!active || !editorHostRef.current) return;
          mountStage = "installing BlockSuite effects";
          installProjectDocumentEditorEffects(
            customElements,
            blockEffects.effects,
            presetEffects.effects,
          );
          mountStage = "registering document blocks";
          tableBlock.registerProjectDocumentTableBlock(customElements);
          calloutBlock.registerProjectDocumentCalloutBlock(customElements);
          embedBlock.registerProjectDocumentEmbedBlock(customElements);
          textAlignment.registerProjectDocumentTextAlignmentBlocks(
            customElements,
          );
          mountStage = "registering database views";
          calendarView.registerProjectDocumentDatabaseBlock(customElements, {
            docId: runtime.doc.id,
            currentUserId: user ? String(user.id) : undefined,
            members: [
              ...(user ? [{ id: String(user.id), email: user.email }] : []),
              ...collaborators
                .filter((collaborator) => collaborator.userId !== user?.id)
                .map((collaborator) => ({
                  id: String(collaborator.userId),
                  email: collaborator.email,
                })),
            ],
          });
          mountStage = "registering slash commands";
          slashMenu.registerProjectDocumentSlashMenu();
          slashMenuConfigurationDispose =
            slashMenu.configureProjectDocumentSlashMenu({
              createDocument: createPersistentDocument,
            });
          mountStage = "registering Canvas templates";
          canvasTemplateConfigurationDispose =
            canvasTemplates.configureProjectDocumentCanvasTemplates(
              blocks.EdgelessTemplatePanel,
              runtime.doc,
            );
          mountStage = "creating the editor";
          editor = document.createElement(
            mode === "page" ? "page-editor" : "edgeless-editor",
          );
          if (mode === "page") {
            const pageEditor = editor as typeof editor & {
              specs: unknown[];
              std: {
                getOptional<T>(identifier: unknown): T | undefined;
              };
              updateComplete: Promise<boolean>;
            };
            pageEditor.specs = [
              ...blocks.PageEditorBlockSpecs,
              ...tableBlock.ProjectDocumentTableBlockSpec,
              ...calloutBlock.ProjectDocumentCalloutBlockSpec,
              ...embedBlock.ProjectDocumentEmbedBlockSpec,
              ...textAlignment.ProjectDocumentTextAlignmentBlockSpec,
              blocks.RefNodeSlotsExtension(),
              blockStd.ConfigExtension("affine:page", {
                linkedWidget: {
                  getMenus: (
                    query: string,
                    abort: () => void,
                    editorHost: EditorHost,
                    inlineEditor: AffineInlineEditor,
                    _abortSignal: AbortSignal,
                  ): LinkedMenuGroup[] => {
                    const normalizedQuery = query.trim().toLocaleLowerCase();
                    const candidates =
                      editorHost.doc.collection.meta.docMetas.filter(
                        (metadata) =>
                          metadata.id !== editorHost.doc.id &&
                          metadata.title
                            .toLocaleLowerCase()
                            .includes(normalizedQuery),
                      );
                    const dateCandidates = projectDocumentMentionDates(query);
                    const userCandidates = projectDocumentMentionUsers(
                      query,
                      user ? [user] : [],
                    );
                    return [
                      {
                        name: "Link to document",
                        items: candidates.map((metadata) => ({
                          key: metadata.id,
                          name: metadata.title || "Untitled",
                          icon: blocks.LinkedDocIcon,
                          action: () => {
                            abort();
                            blocks.insertLinkedNode({
                              inlineEditor,
                              docId: metadata.id,
                            });
                            persistInlineDocumentLink(Number(metadata.id));
                          },
                        })),
                        maxDisplay: 6,
                        overflowText: `${Math.max(0, candidates.length - 6)} more docs`,
                      },
                      {
                        name: "People",
                        items: userCandidates.map((candidate) => ({
                          key: `user:${candidate.id}`,
                          name: candidate.email,
                          suffix: "You",
                          icon: blocks.DocIcon,
                          action: () => {
                            abort();
                            const inlineRange = inlineEditor.getInlineRange();
                            if (!inlineRange) return;
                            inlineEditor.insertText(
                              inlineRange,
                              candidate.label,
                              { link: candidate.link },
                            );
                            inlineEditor.setInlineRange({
                              index: inlineRange.index + candidate.label.length,
                              length: 0,
                            });
                          },
                        })),
                        maxDisplay: 6,
                        overflowText: `${Math.max(0, userCandidates.length - 6)} more people`,
                      },
                      {
                        name: "Dates",
                        items: dateCandidates.map((candidate) => ({
                          key: `journal:${candidate.dateKey}`,
                          name: candidate.label,
                          suffix: candidate.suffix,
                          icon: blocks.DocIcon,
                          action: async () => {
                            abort();
                            try {
                              const journal =
                                await createProjectDocumentJournal(
                                  projectId,
                                  candidate.dateKey,
                                );
                              const sourceDocumentId =
                                documentRecordIdRef.current;
                              if (
                                !active ||
                                !sourceDocumentId ||
                                journal.document.id === sourceDocumentId
                              ) {
                                return;
                              }
                              const collection =
                                await listProjectDocuments(projectId);
                              if (!active) return;
                              setDocuments(collection.documents);
                              setFolders(collection.folders ?? []);
                              setTags(collection.tags ?? []);
                              setLinks(collection.links ?? []);
                              syncProjectDocumentCollectionMetadata(
                                runtime.doc,
                                sourceDocumentId,
                                collection.documents,
                              );
                              blocks.insertLinkedNode({
                                inlineEditor,
                                docId: String(journal.document.id),
                              });
                              persistInlineDocumentLink(journal.document.id);
                            } catch (cause) {
                              if (active) {
                                setError((cause as Error).message);
                              }
                            }
                          },
                        })),
                        maxDisplay: 7,
                        overflowText: `${Math.max(0, dateCandidates.length - 7)} more dates`,
                      },
                    ];
                  },
                },
              }),
            ];
            void pageEditor.updateComplete.then(() => {
              if (!active) return;
              referenceSubscription = pageEditor.std
                .getOptional<{
                  docLinkClicked: {
                    on(listener: (reference: ReferenceInfo) => void): {
                      dispose(): void;
                    };
                  };
                }>(blocks.RefNodeSlotsProvider)
                ?.docLinkClicked.on((reference) => {
                  const nextDocumentId = Number(reference.pageId);
                  if (!Number.isSafeInteger(nextDocumentId)) return;
                  navigate({
                    name: "project-document",
                    projectId,
                    documentId: nextDocumentId,
                  });
                });
            });
          } else {
            (editor as typeof editor & { specs: unknown[] }).specs = [
              ...blocks.EdgelessEditorBlockSpecs,
              blockSuiteUi.ProjectDocumentCanvasThemeExtension,
              ...tableBlock.ProjectDocumentTableBlockSpec,
              ...calloutBlock.ProjectDocumentCalloutBlockSpec,
              ...embedBlock.ProjectDocumentEmbedBlockSpec,
              ...textAlignment.ProjectDocumentTextAlignmentBlockSpec,
            ];
          }
          mountStage = "binding the document";
          (editor as typeof editor & { doc: typeof runtime.doc }).doc =
            runtime.doc;
          mountStage = "mounting the editor";
          editorHostRef.current.replaceChildren(editor);
          blockSuiteAccessibilityDispose =
            blockSuiteUi.installProjectDocumentBlockSuiteAccessibility(editor);
          setError("");
        },
      )
      .catch((cause) => {
        if (active)
          setError(
            `Unable to mount document: ${(cause as Error).message} (${mountStage})`,
          );
      });
    return () => {
      active = false;
      referenceSubscription?.dispose();
      slashMenuConfigurationDispose?.();
      canvasTemplateConfigurationDispose?.();
      blockSuiteAccessibilityDispose?.();
      editor?.remove();
    };
  }, [
    mountKey,
    mode,
    collaborators,
    createPersistentDocument,
    persistInlineDocumentLink,
    projectId,
    runtime,
    user,
  ]);

  useEffect(() => {
    const host = editorHostRef.current;
    if (!runtime || mode !== "page" || !host) {
      setOutlineItems([]);
      return;
    }
    const updateOutline = () => {
      setOutlineItems(extractProjectDocumentOutline(host));
    };
    const observer = new MutationObserver(updateOutline);
    observer.observe(host, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    updateOutline();
    return () => observer.disconnect();
  }, [runtime, mode, mountKey]);

  const changeMode = useCallback(
    (nextMode: ProjectDocumentMode) => {
      if (!documentRecordId || nextMode === mode) return;
      setMode(nextMode);
      updateProjectDocumentMode(projectId, documentRecordId, nextMode).catch(
        (cause) => {
          setError((cause as Error).message);
        },
      );
    },
    [documentRecordId, mode, projectId],
  );

  const persistMetadata = useCallback(
    (
      nextTitle: string,
      nextIcon: ProjectDocumentIcon,
      nextIsFavorite: boolean,
      nextPageWidth: ProjectDocumentPageWidth,
      nextProperties: ProjectDocumentProperty[] = properties,
    ) => {
      if (!documentRecordId) return;
      const normalizedTitle = nextTitle.trim() || "Untitled";
      setTitle(normalizedTitle);
      setIcon(nextIcon);
      setIsFavorite(nextIsFavorite);
      setPageWidth(nextPageWidth);
      setProperties(nextProperties);
      updateProjectDocumentMetadata(projectId, documentRecordId, {
        title: normalizedTitle,
        icon: nextIcon,
        isFavorite: nextIsFavorite,
        pageWidth: nextPageWidth,
        properties: nextProperties,
      })
        .then((updated) => {
          setTitle(updated.title);
          setSavedTitle(updated.title);
          setIcon(updated.icon ?? "none");
          setSavedIcon(updated.icon ?? "none");
          setIsFavorite(updated.isFavorite ?? false);
          setSavedIsFavorite(updated.isFavorite ?? false);
          setPageWidth(updated.pageWidth ?? "standard");
          setSavedPageWidth(updated.pageWidth ?? "standard");
          setProperties(updated.properties ?? []);
          setSavedProperties(updated.properties ?? []);
          setUpdatedAt(updated.updatedAt);
          setLastEditedByEmail(updated.lastEditedByEmail);
          setDocuments((current) =>
            current.map((document) =>
              document.id === updated.id ? updated : document,
            ),
          );
        })
        .catch((cause) => {
          setTitle(savedTitle);
          setIcon(savedIcon);
          setIsFavorite(savedIsFavorite);
          setPageWidth(savedPageWidth);
          setProperties(savedProperties);
          setError((cause as Error).message);
        });
    },
    [
      documentRecordId,
      projectId,
      properties,
      savedIcon,
      savedIsFavorite,
      savedPageWidth,
      savedProperties,
      savedTitle,
    ],
  );

  const navigateOutline = useCallback((blockId: string) => {
    const block = Array.from(
      editorHostRef.current?.querySelectorAll<HTMLElement>("[data-block-id]") ??
        [],
    ).find((candidate) => candidate.dataset.blockId === blockId);
    if (!block) return;
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.dataset.commentFocus = "true";
    window.setTimeout(() => {
      delete block.dataset.commentFocus;
    }, 1600);
  }, []);

  const downloadRecovery = useCallback(() => {
    if (!runtime || !documentRecordId) return;
    const blob = new Blob([new Uint8Array(runtime.recoveryUpdate())], {
      type: "application/octet-stream",
    });
    downloadProjectDocumentBlob(
      blob,
      `astryx-project-document-${documentRecordId}.yjs`,
    );
  }, [documentRecordId, runtime]);

  const persistTemplate = useCallback(
    async (nextIsTemplate: boolean) => {
      if (
        !runtime ||
        !documentRecordId ||
        isUpdatingTemplate ||
        access.role === "viewer"
      ) {
        return;
      }
      const previous = isTemplate;
      setIsTemplate(nextIsTemplate);
      setIsUpdatingTemplate(true);
      setError("");
      try {
        const updated = await updateProjectDocumentTemplate(
          projectId,
          documentRecordId,
          nextIsTemplate ? runtime.recoveryUpdate() : undefined,
        );
        setIsTemplate(updated.isTemplate);
        setUpdatedAt(updated.updatedAt);
        setLastEditedByEmail(updated.lastEditedByEmail);
        setDocuments((current) =>
          current.map((document) =>
            document.id === updated.id ? updated : document,
          ),
        );
      } catch (cause) {
        setIsTemplate(previous);
        setError((cause as Error).message);
      } finally {
        setIsUpdatingTemplate(false);
      }
    },
    [
      access.role,
      documentRecordId,
      isTemplate,
      isUpdatingTemplate,
      projectId,
      runtime,
    ],
  );

  const downloadMarkdown = useCallback(() => {
    if (!runtime) return;
    const markdown = markdownProjectDocumentExport(runtime.doc, title);
    downloadProjectDocumentBlob(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      `${projectDocumentExportFilename(title)}.md`,
    );
  }, [runtime, title]);

  const downloadHtml = useCallback(() => {
    if (!runtime) return;
    downloadProjectDocumentBlob(
      new Blob([htmlProjectDocumentExport(runtime.doc, title)], {
        type: "text/html;charset=utf-8",
      }),
      `${projectDocumentExportFilename(title)}.html`,
    );
  }, [runtime, title]);

  const copyMarkdown = useCallback(async () => {
    if (!runtime) return;
    setError("");
    try {
      await copyShareLink(markdownProjectDocumentExport(runtime.doc, title));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [runtime, title]);

  const downloadPng = useCallback(async () => {
    const editor = editorHostRef.current;
    if (!editor) return;
    setError("");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const target =
        editor.closest<HTMLElement>(".project-document-page-content") ?? editor;
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error("Could not encode document as PNG"));
        }, "image/png");
      });
      downloadProjectDocumentBlob(
        blob,
        `${projectDocumentExportFilename(title)}.png`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [title]);

  const loadVersions = useCallback(async () => {
    if (!documentRecordId || isLoadingHistory) return;
    setIsLoadingHistory(true);
    setHistoryError("");
    try {
      setVersions(
        await listProjectDocumentVersions(projectId, documentRecordId),
      );
    } catch (cause) {
      setHistoryError((cause as Error).message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [documentRecordId, isLoadingHistory, projectId]);

  const saveVersion = useCallback(
    async (label: string) => {
      if (!runtime || !documentRecordId || isSavingVersion) return false;
      setIsSavingVersion(true);
      setHistoryError("");
      try {
        const created = await createProjectDocumentVersion(
          projectId,
          documentRecordId,
          label,
          runtime.recoveryUpdate(),
        );
        setVersions((current) => [
          created,
          ...current.filter((version) => version.id !== created.id),
        ]);
        return true;
      } catch (cause) {
        setHistoryError((cause as Error).message);
        return false;
      } finally {
        setIsSavingVersion(false);
      }
    },
    [documentRecordId, isSavingVersion, projectId, runtime],
  );

  const restoreVersion = useCallback(
    async (versionId: number) => {
      if (!runtime || !documentRecordId || restoringVersionId) return;
      setRestoringVersionId(versionId);
      setHistoryError("");
      try {
        const safetyVersion = await createProjectDocumentVersion(
          projectId,
          documentRecordId,
          "Before restore",
          runtime.recoveryUpdate(),
        );
        setVersions((current) => [safetyVersion, ...current]);
        const restored = await restoreProjectDocumentVersion(
          projectId,
          documentRecordId,
          versionId,
        );
        window.sessionStorage.setItem(
          restoredVersionStorageKey(
            restored.bootstrap.document.id,
            restored.bootstrap.syncInstanceId,
          ),
          restored.snapshotBase64,
        );
        window.location.reload();
      } catch (cause) {
        setHistoryError((cause as Error).message);
        setRestoringVersionId(undefined);
      }
    },
    [documentRecordId, projectId, restoringVersionId, runtime],
  );

  const createNewDocument = useCallback(() => {
    void createPersistentDocument().then((documentId) => {
      if (documentId) {
        navigate({
          name: "project-document",
          projectId,
          documentId,
        });
      }
    });
  }, [createPersistentDocument, projectId]);

  const duplicateCurrentDocument = useCallback(async () => {
    if (
      !runtime ||
      !documentRecordId ||
      isDuplicatingDocument ||
      access.role === "viewer"
    ) {
      return;
    }
    setIsDuplicatingDocument(true);
    setError("");
    try {
      const duplicateTitle = `${title.trim() || "Untitled"} copy`;
      const created = await createProjectDocument(projectId, duplicateTitle);
      await Promise.all([
        updateProjectDocumentMetadata(projectId, created.document.id, {
          title: duplicateTitle,
          icon,
          isFavorite: false,
          pageWidth,
          properties,
        }),
        updateProjectDocumentMode(projectId, created.document.id, mode),
      ]);
      window.sessionStorage.setItem(
        restoredVersionStorageKey(
          created.document.id,
          created.syncInstanceId,
        ),
        encodeBase64Update(runtime.recoveryUpdate()),
      );
      navigate({
        name: "project-document",
        projectId,
        documentId: created.document.id,
      });
    } catch (cause) {
      setError((cause as Error).message);
      setIsDuplicatingDocument(false);
    }
  }, [
    access.role,
    documentRecordId,
    icon,
    isDuplicatingDocument,
    mode,
    pageWidth,
    projectId,
    properties,
    runtime,
    title,
  ]);

  const persistDocumentTags = useCallback(
    (documentId: number, tagIds: number[]) => {
      setError("");
      setProjectDocumentTags(projectId, documentId, tagIds)
        .then((collection) => {
          setDocuments(collection.documents);
          setFolders(collection.folders ?? []);
          setTags(collection.tags ?? []);
        })
        .catch((cause) => {
          setError((cause as Error).message);
        });
    },
    [projectId],
  );

  const addDocumentComment = useCallback(
    async (body: string, anchor?: ProjectDocumentCommentAnchor) => {
      if (!documentRecordId || isSubmittingComment) return false;
      setIsSubmittingComment(true);
      setCommentError("");
      try {
        const created = await createProjectDocumentComment(
          projectId,
          documentRecordId,
          body,
          anchor,
        );
        setComments((current) => [...current, created]);
        return true;
      } catch (cause) {
        setCommentError((cause as Error).message);
        return false;
      } finally {
        setIsSubmittingComment(false);
      }
    },
    [documentRecordId, isSubmittingComment, projectId],
  );

  const updateDocumentCommentResolution = useCallback(
    async (commentId: number, resolved: boolean) => {
      if (!documentRecordId) return;
      setCommentError("");
      try {
        const updated = await resolveProjectDocumentComment(
          projectId,
          documentRecordId,
          commentId,
          resolved,
        );
        setComments((current) =>
          current.map((comment) =>
            comment.id === updated.id ? updated : comment,
          ),
        );
      } catch (cause) {
        setCommentError((cause as Error).message);
      }
    },
    [documentRecordId, projectId],
  );

  const createPublicShare = useCallback(async () => {
    if (!documentRecordId || isCreatingShare) return;
    setIsCreatingShare(true);
    setShareError("");
    try {
      const created = await createProjectDocumentShare(
        projectId,
        documentRecordId,
      );
      setShares((current) => [
        created,
        ...current.filter((share) => share.id !== created.id),
      ]);
    } catch (cause) {
      setShareError((cause as Error).message);
    } finally {
      setIsCreatingShare(false);
    }
  }, [documentRecordId, isCreatingShare, projectId]);

  const revokePublicShare = useCallback(
    async (shareId: number) => {
      if (!documentRecordId) return;
      setShareError("");
      try {
        await revokeProjectDocumentShare(projectId, documentRecordId, shareId);
        setShares((current) => current.filter((share) => share.id !== shareId));
      } catch (cause) {
        setShareError((cause as Error).message);
      }
    },
    [documentRecordId, projectId],
  );

  const addCollaborator = useCallback(
    async (email: string, role: ProjectDocumentCollaboratorRole) => {
      setShareError("");
      try {
        const collaborator = await addProjectDocumentCollaborator(
          projectId,
          email,
          role,
        );
        setCollaborators((current) => [
          ...current.filter((item) => item.userId !== collaborator.userId),
          collaborator,
        ]);
        return true;
      } catch (cause) {
        setShareError((cause as Error).message);
        return false;
      }
    },
    [projectId],
  );

  const removeCollaborator = useCallback(
    async (userId: number) => {
      setShareError("");
      try {
        await removeProjectDocumentCollaborator(projectId, userId);
        setCollaborators((current) =>
          current.filter((item) => item.userId !== userId),
        );
      } catch (cause) {
        setShareError((cause as Error).message);
      }
    },
    [projectId],
  );

  const trashCurrentDocument = useCallback(async () => {
    if (!documentRecordId) return;
    setError("");
    try {
      await trashProjectDocument(projectId, documentRecordId);
      navigate({ name: "project-document", projectId });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [documentRecordId, projectId]);

  if (!runtime && !error) {
    return (
      <main className="project-document-page project-document-loading">
        <p role="status">Opening Project Docs…</p>
      </main>
    );
  }

  return (
    <ProjectDocumentWorkspaceView
      title={title}
      icon={icon}
      isFavorite={isFavorite}
      isTemplate={isTemplate}
      pageWidth={pageWidth}
      properties={properties}
      createdAt={createdAt}
      updatedAt={updatedAt}
      createdByEmail={createdByEmail}
      lastEditedByEmail={lastEditedByEmail}
      journalDate={journalDate}
      outlineItems={outlineItems}
      documents={documents}
      searchResults={searchResults}
      isSearchingDocuments={isSearchingDocuments}
      documentSearchError={documentSearchError}
      trash={trash}
      folders={folders}
      tags={tags}
      collections={collections}
      links={links}
      comments={comments}
      shares={shares}
      versions={versions}
      access={access}
      collaborators={collaborators}
      presence={presence}
      commentError={commentError}
      shareError={shareError}
      historyError={historyError}
      activeDocumentId={documentRecordId}
      isCreatingDocument={isCreatingDocument}
      isDuplicatingDocument={isDuplicatingDocument}
      isSubmittingComment={isSubmittingComment}
      isCreatingShare={isCreatingShare}
      isLoadingHistory={isLoadingHistory}
      isSavingVersion={isSavingVersion}
      isUpdatingTemplate={isUpdatingTemplate}
      restoringVersionId={restoringVersionId}
      mode={mode}
      status={status}
      editorHostRef={editorHostRef}
      error={error || undefined}
      onTitleChange={setTitle}
      onTitleCommit={() => persistMetadata(title, icon, isFavorite, pageWidth)}
      onIconChange={(nextIcon) =>
        persistMetadata(title, nextIcon, isFavorite, pageWidth)
      }
      onFavoriteChange={(nextIsFavorite) =>
        persistMetadata(title, icon, nextIsFavorite, pageWidth)
      }
      onTemplateChange={
        access.role === "viewer" ? undefined : persistTemplate
      }
      onPageWidthChange={(nextPageWidth) =>
        persistMetadata(title, icon, isFavorite, nextPageWidth)
      }
      onPropertiesChange={
        access.role === "viewer"
          ? undefined
          : (nextProperties) =>
              persistMetadata(
                title,
                icon,
                isFavorite,
                pageWidth,
                nextProperties,
              )
      }
      onOutlineSelect={navigateOutline}
      onJournalDateChange={(date) => {
        const target = documents.find(
          (document) => document.journalDate === date,
        );
        navigate(
          target
            ? {
                name: "project-document",
                projectId,
                documentId: target.id,
              }
            : {
                name: "project-document",
                projectId,
                workspaceView: "journals",
                journalDate: date,
              },
        );
      }}
      onOpenLibrary={() =>
        navigate({
          name: "project-document",
          projectId,
        })
      }
      onOpenLibraryScope={(type, id) => {
        if (type === "folder" && id) {
          navigate({ name: "project-document", projectId, folderId: id });
          return;
        }
        if (type === "tag" && id) {
          navigate({ name: "project-document", projectId, tagId: id });
          return;
        }
        if (type === "collection" && id) {
          navigate({ name: "project-document", projectId, collectionId: id });
          return;
        }
        if (
          type === "collections" ||
          type === "journals" ||
          type === "trash" ||
          type === "import" ||
          type === "templates" ||
          type === "new-folder" ||
          type === "new-tag" ||
          type === "new-collection"
        ) {
          navigate({
            name: "project-document",
            projectId,
            workspaceView: type,
          });
        }
      }}
      onSelectDocument={(nextDocumentId) => {
        if (nextDocumentId === documentRecordId) return;
        navigate({
          name: "project-document",
          projectId,
          documentId: nextDocumentId,
        });
      }}
      onCreateDocument={createNewDocument}
      onDuplicateDocument={
        access.role === "viewer" ? undefined : duplicateCurrentDocument
      }
      onSearchDocuments={searchDocuments}
      onSetDocumentTags={persistDocumentTags}
      onSetDocumentLinks={(documentId, documentIds) => {
        setError("");
        setProjectDocumentLinks(projectId, documentId, documentIds)
          .then((collection) => {
            setDocuments(collection.documents);
            setFolders(collection.folders ?? []);
            setTags(collection.tags ?? []);
            setLinks(collection.links ?? []);
          })
          .catch((cause) => setError((cause as Error).message));
      }}
      onAddComment={addDocumentComment}
      onResolveComment={updateDocumentCommentResolution}
      onCreatePublicShare={createPublicShare}
      onRevokePublicShare={revokePublicShare}
      onAddCollaborator={addCollaborator}
      onRemoveCollaborator={removeCollaborator}
      onLoadVersions={loadVersions}
      onCreateVersion={saveVersion}
      onRestoreVersion={restoreVersion}
      onMode={changeMode}
      onRetry={() => {
        if (runtime) {
          setError("");
          setMountKey((value) => value + 1);
        } else {
          setRetryKey((value) => value + 1);
        }
      }}
      onInsertSimpleTable={
        runtime
          ? () => {
              setError("");
              try {
                appendProjectDocumentSimpleTable(runtime.doc);
              } catch (cause) {
                setError((cause as Error).message);
              }
            }
          : undefined
      }
      onInsertStarterBlocks={
        runtime
          ? () => {
              setError("");
              void appendProjectDocumentStarterBlocks(runtime.doc).catch(
                (cause) => setError((cause as Error).message),
              );
            }
          : undefined
      }
      onDownloadHtml={runtime ? downloadHtml : undefined}
      onDownloadPng={runtime ? downloadPng : undefined}
      onDownloadRecovery={runtime ? downloadRecovery : undefined}
      onDownloadMarkdown={runtime ? downloadMarkdown : undefined}
      onCopyMarkdown={runtime ? copyMarkdown : undefined}
      onPrint={runtime ? () => window.print() : undefined}
      onTrashDocument={
        access.role === "owner" ? trashCurrentDocument : undefined
      }
    />
  );
}

export function ProjectDocumentWorkspace({
  projectId,
  documentId,
  folderId,
  tagId,
  collectionId,
  workspaceView,
  journalDate,
}: {
  projectId: number;
  documentId?: number;
  folderId?: number;
  tagId?: number;
  collectionId?: number;
  workspaceView?:
    | "favorites"
    | "tags"
    | "collections"
    | "journals"
    | "trash"
    | "import"
    | "templates"
    | "new-folder"
    | "new-tag"
    | "new-collection";
  journalDate?: string;
}) {
  return documentId ? (
    <ProjectDocumentEditorWorkspace
      projectId={projectId}
      documentId={documentId}
    />
  ) : (
    <ProjectDocumentLibrary
      projectId={projectId}
      folderId={folderId}
      tagId={tagId}
      collectionId={collectionId}
      workspaceView={workspaceView}
      journalDate={journalDate}
    />
  );
}
