import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  BreadcrumbItem,
  Breadcrumbs,
  Button,
  EmptyState,
  HStack,
  Icon,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextInput,
  Toolbar,
} from "@astryxdesign/core";
import { AstryxMenu } from "./AstryxDropdown.tsx";

import type {
  ProjectDocumentCollection,
  ProjectDocumentCollectionMode,
  ProjectDocumentCollectionRule,
  ProjectDocumentFolder,
  ProjectDocumentIcon,
  ProjectDocumentPublic,
  ProjectDocumentSearchResult,
  ProjectDocumentSmartCollection,
  ProjectDocumentTag,
  ProjectDocumentTagColor,
} from "../../projectDocument.ts";
import {
  createProjectDocumentCollection,
  createProjectDocumentFolder,
  createProjectDocumentJournal,
  createProjectDocumentTag,
  createProjectDocument,
  createProjectDocumentFromTemplate,
  deleteProjectDocumentCollection,
  deleteProjectDocumentFolder,
  deleteProjectDocumentTag,
  listProjectDocuments,
  searchProjectDocuments,
  permanentlyDeleteProjectDocument,
  restoreProjectDocument,
  setProjectDocumentCollectionDocuments,
  setProjectDocumentFolderDocuments,
  setProjectDocumentTags,
  updateProjectDocumentFolder,
  updateProjectDocumentCollection,
  updateProjectDocumentMetadata,
  updateProjectDocumentTag,
  trashProjectDocument,
} from "../projectDocumentsApi.ts";
import {
  htmlProjectDocumentBlocks,
  markdownProjectDocumentBlocks,
  seedProjectDocument,
  type ProjectDocumentSeedBlock,
} from "../projectDocumentRuntime.ts";
import {
  isProjectDocumentJournalDate,
  journalWeekDates,
  localDateKey,
} from "../projectDocumentJournal.ts";
import { navigate } from "../router.ts";
import {
  ProjectDocumentCollectionPickerDialog,
  ProjectDocumentCollectionRulesDialog,
} from "./ProjectDocumentCollectionDialogs.tsx";
import {
  ProjectDocumentFolderPickerDialog,
  ProjectDocumentNameDialog,
  ProjectDocumentTagPickerDialog,
} from "./ProjectDocumentOrganizerDialogs.tsx";
import {
  ProjectDocumentDeleteDialog,
  ProjectDocumentImportDialog,
  ProjectDocumentTemplateDialog,
  type ProjectDocumentTemplate,
} from "./ProjectDocumentManagementDialogs.tsx";

type ProjectDocumentLibraryViewMode = "list" | "grid";
type ProjectDocumentLibrarySort = "updated" | "created" | "title";
type ProjectDocumentLibraryGrouping = "updated" | "none";
type ProjectDocumentLibraryScope =
  | { type: "docs" }
  | { type: "favorites" }
  | { type: "folder"; id: number }
  | { type: "tag"; id: number }
  | { type: "tags" }
  | { type: "collections" }
  | { type: "collection"; id: number }
  | { type: "journals" }
  | { type: "trash" };

const tagColors: readonly ProjectDocumentTagColor[] = [
  "blue",
  "purple",
  "green",
  "amber",
  "rose",
  "slate",
];

const documentIconLabels: Record<ProjectDocumentIcon, string> = {
  none: "Document",
  document: "Document",
  idea: "Idea",
  task: "Tasks",
  schedule: "Schedule",
  build: "Build",
};

function templateRestoreStorageKey(
  documentId: number,
  syncInstanceId: string,
): string {
  return `astryx-project-document-restore-${documentId}-${syncInstanceId}`;
}

function formatLibraryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatSidebarDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function startOfDay(value: Date): number {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

function documentGroup(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const difference = startOfDay(now) - startOfDay(date);
  if (difference <= 0) return "Today";
  if (difference === 86_400_000) return "Yesterday";
  if (difference < 7 * 86_400_000) return "This week";
  return "Earlier";
}

function compareDocuments(
  left: ProjectDocumentPublic,
  right: ProjectDocumentPublic,
  sort: ProjectDocumentLibrarySort,
): number {
  if (sort === "title") {
    return left.title.localeCompare(right.title, undefined, {
      sensitivity: "base",
    });
  }
  const leftValue = Date.parse(
    sort === "created" ? left.createdAt : left.updatedAt,
  );
  const rightValue = Date.parse(
    sort === "created" ? right.createdAt : right.updatedAt,
  );
  return rightValue - leftValue;
}

function orderedFolderTree(
  folders: readonly ProjectDocumentFolder[],
  parentFolderId: number | null = null,
  depth = 0,
  visited = new Set<number>(),
): Array<{ folder: ProjectDocumentFolder; depth: number }> {
  return folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort((left, right) => {
      if (left.isFavorite !== right.isFavorite) {
        return left.isFavorite ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .flatMap((folder) => {
      if (visited.has(folder.id)) return [];
      const nextVisited = new Set(visited).add(folder.id);
      return [
        { folder, depth },
        ...orderedFolderTree(
          folders,
          folder.id,
          depth + 1,
          nextVisited,
        ),
      ];
    });
}

function smartCollectionDocuments(
  collection: ProjectDocumentSmartCollection | undefined,
  documents: readonly ProjectDocumentPublic[],
  tags: readonly ProjectDocumentTag[],
): ProjectDocumentPublic[] {
  if (!collection) return [];
  if (collection.mode === "manual") {
    return documents.filter((document) =>
      collection.documentIds.includes(document.id),
    );
  }
  return documents.filter((document) =>
    collection.rules.every((rule) => {
      switch (rule.field) {
        case "favorite":
          return document.isFavorite === rule.value;
        case "journal":
          return Boolean(document.journalDate) === rule.value;
        case "tag":
          return Boolean(
            tags
              .find((tag) => tag.id === rule.value)
              ?.documentIds.includes(document.id),
          );
        case "createdAfter":
          return document.createdAt.slice(0, 10) >= rule.value;
        case "updatedAfter":
          return document.updatedAt.slice(0, 10) >= rule.value;
        case "mode":
          return document.lastEditorMode === rule.value;
        case "pageWidth":
          return document.pageWidth === rule.value;
      }
    }),
  );
}

export interface ProjectDocumentLibraryViewProps {
  documents: readonly ProjectDocumentPublic[];
  trash?: readonly ProjectDocumentPublic[];
  folders?: readonly ProjectDocumentFolder[];
  tags?: readonly ProjectDocumentTag[];
  collections?: readonly ProjectDocumentSmartCollection[];
  initialScope?: ProjectDocumentLibraryScope;
  initialJournalDate?: string;
  initialManagementDialog?:
    | "import"
    | "templates"
    | "new-folder"
    | "new-tag"
    | "new-collection";
  query: string;
  viewMode: ProjectDocumentLibraryViewMode;
  sort: ProjectDocumentLibrarySort;
  grouping: ProjectDocumentLibraryGrouping;
  loading?: boolean;
  searching?: boolean;
  searchResults?: readonly ProjectDocumentSearchResult[];
  searchError?: string;
  creating?: boolean;
  error?: string;
  onQueryChange(query: string): void;
  onScopeChange?(scope: ProjectDocumentLibraryScope): void;
  onViewModeChange(mode: ProjectDocumentLibraryViewMode): void;
  onSortChange(sort: ProjectDocumentLibrarySort): void;
  onGroupingChange(grouping: ProjectDocumentLibraryGrouping): void;
  onOpenDocument(documentId: number): void;
  onFavoriteDocument(document: ProjectDocumentPublic): void;
  onCreateDocument(): void;
  onCreateFolder?(name: string, parentFolderId: number | null): void;
  onUpdateFolder?(
    folder: ProjectDocumentFolder,
    input: { name: string; isFavorite: boolean },
  ): void;
  onDeleteFolder?(folderId: number): void;
  onSetFolderDocuments?(folderId: number, documentIds: number[]): void;
  onCreateTag?(name: string, color: ProjectDocumentTagColor): void;
  onUpdateTag?(
    tag: ProjectDocumentTag,
    input: { name: string; color: ProjectDocumentTagColor },
  ): void;
  onDeleteTag?(tagId: number): void;
  onSetDocumentTags?(documentId: number, tagIds: number[]): void;
  onCreateCollection?(name: string): void;
  onUpdateCollection?(
    collection: ProjectDocumentSmartCollection,
    input: {
      name: string;
      isFavorite: boolean;
      mode: ProjectDocumentCollectionMode;
      rules: readonly ProjectDocumentCollectionRule[];
    },
  ): void;
  onDeleteCollection?(collectionId: number): void;
  onSetCollectionDocuments?(
    collectionId: number,
    documentIds: number[],
  ): void;
  onCreateJournal?(journalDate: string): void;
  onJournalDateChange?(journalDate: string): void;
  onTrashDocument?(documentId: number): void;
  onRestoreDocument?(documentId: number): void;
  onDeleteDocumentPermanently?(documentId: number): void;
  onImportDocument?(file: File): void;
  onCreateFromTemplate?(template: ProjectDocumentTemplate): void;
  onManagementDialogClose?(): void;
  onRetry(): void;
}

export function ProjectDocumentLibraryView({
  documents,
  trash = [],
  folders = [],
  tags = [],
  collections = [],
  initialScope = { type: "docs" },
  initialJournalDate,
  initialManagementDialog,
  query,
  viewMode,
  sort,
  grouping,
  loading = false,
  searching = false,
  searchResults,
  searchError,
  creating = false,
  error,
  onQueryChange,
  onScopeChange,
  onViewModeChange,
  onSortChange,
  onGroupingChange,
  onOpenDocument,
  onFavoriteDocument,
  onCreateDocument,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onSetFolderDocuments,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onSetDocumentTags,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onSetCollectionDocuments,
  onCreateJournal,
  onJournalDateChange,
  onTrashDocument,
  onRestoreDocument,
  onDeleteDocumentPermanently,
  onImportDocument,
  onCreateFromTemplate,
  onManagementDialogClose,
  onRetry,
}: ProjectDocumentLibraryViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scope, setScope] =
    useState<ProjectDocumentLibraryScope>(initialScope);
  const [folderDialog, setFolderDialog] = useState<
    | {
        parentFolderId: number | null;
        folder?: ProjectDocumentFolder;
      }
    | undefined
  >(
    initialManagementDialog === "new-folder"
      ? { parentFolderId: null }
      : undefined,
  );
  const [folderPickerId, setFolderPickerId] = useState<number>();
  const [tagDialog, setTagDialog] = useState<
    ProjectDocumentTag | null | undefined
  >(initialManagementDialog === "new-tag" ? null : undefined);
  const [tagPickerDocumentId, setTagPickerDocumentId] = useState<number>();
  const [collectionDialog, setCollectionDialog] = useState<
    ProjectDocumentSmartCollection | null | undefined
  >(initialManagementDialog === "new-collection" ? null : undefined);
  const [collectionPickerId, setCollectionPickerId] = useState<number>();
  const [collectionRulesId, setCollectionRulesId] = useState<number>();
  const [journalDate, setJournalDate] = useState(
    isProjectDocumentJournalDate(initialJournalDate)
      ? initialJournalDate
      : localDateKey(),
  );
  const [importOpen, setImportOpen] = useState(
    initialManagementDialog === "import",
  );
  const [templatesOpen, setTemplatesOpen] = useState(
    initialManagementDialog === "templates",
  );
  const [permanentDeleteDocument, setPermanentDeleteDocument] =
    useState<ProjectDocumentPublic>();

  useEffect(() => {
    setScope(initialScope);
  }, [initialScope.type, "id" in initialScope ? initialScope.id : undefined]);
  useEffect(() => {
    if (isProjectDocumentJournalDate(initialJournalDate)) {
      setJournalDate(initialJournalDate);
    }
  }, [initialJournalDate]);
  useEffect(() => {
    setImportOpen(initialManagementDialog === "import");
    setTemplatesOpen(initialManagementDialog === "templates");
    if (initialManagementDialog === "new-folder") {
      setFolderDialog({ parentFolderId: null });
    }
    if (initialManagementDialog === "new-tag") {
      setTagDialog(null);
    }
    if (initialManagementDialog === "new-collection") {
      setCollectionDialog(null);
    }
  }, [initialManagementDialog]);
  const closeRoutedManagementDialog = (
    dialog: NonNullable<
      ProjectDocumentLibraryViewProps["initialManagementDialog"]
    >,
  ) => {
    if (initialManagementDialog === dialog) {
      onManagementDialogClose?.();
    }
  };
  const changeScope = (nextScope: ProjectDocumentLibraryScope) => {
    setScope(nextScope);
    onScopeChange?.(nextScope);
  };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const activeFolder =
    scope.type === "folder"
      ? folders.find((folder) => folder.id === scope.id)
      : undefined;
  const activeTag =
    scope.type === "tag" ? tags.find((tag) => tag.id === scope.id) : undefined;
  const activeCollection =
    scope.type === "collection"
      ? collections.find((collection) => collection.id === scope.id)
      : undefined;
  const collectionDocuments = useMemo(
    () => smartCollectionDocuments(activeCollection, documents, tags),
    [activeCollection, documents, tags],
  );
  const scopedDocuments = useMemo(() => {
    if (scope.type === "trash") return [...trash];
    if (scope.type === "favorites") {
      return documents.filter((document) => document.isFavorite);
    }
    if (activeFolder) {
      return documents.filter((document) =>
        activeFolder.documentIds.includes(document.id),
      );
    }
    if (activeTag) {
      return documents.filter((document) =>
        activeTag.documentIds.includes(document.id),
      );
    }
    if (activeCollection) return collectionDocuments;
    return documents;
  }, [
    activeCollection,
    activeFolder,
    activeTag,
    collectionDocuments,
    documents,
    scope.type,
    trash,
  ]);
  const visibleDocuments = useMemo(
    () => {
      const scopedIds = new Set(scopedDocuments.map(({ id }) => id));
      const candidates =
        normalizedQuery && searchResults
          ? searchResults
              .map(({ document }) => document)
              .filter(({ id }) => scopedIds.has(id))
          : scopedDocuments.filter((document) =>
              document.title.toLocaleLowerCase().includes(normalizedQuery),
            );
      return candidates.sort((left, right) =>
        normalizedQuery && searchResults
          ? 0
          : compareDocuments(left, right, sort),
      );
    },
    [normalizedQuery, scopedDocuments, searchResults, sort],
  );
  const searchSnippets = useMemo(
    () =>
      new Map(
        (searchResults ?? []).map(({ document, snippet }) => [
          document.id,
          snippet,
        ]),
      ),
    [searchResults],
  );
  const groupedDocuments = useMemo(() => {
    if (grouping === "none") {
      return [["All documents", visibleDocuments]] as const;
    }
    const groups = new Map<string, ProjectDocumentPublic[]>();
    for (const document of visibleDocuments) {
      const label = documentGroup(document.updatedAt);
      groups.set(label, [...(groups.get(label) ?? []), document]);
    }
    return Array.from(groups.entries());
  }, [grouping, visibleDocuments]);
  const favoriteDocuments = documents.filter(
    (document) => document.isFavorite,
  );
  const folderTree = useMemo(() => orderedFolderTree(folders), [folders]);
  const folderPicker = folders.find((folder) => folder.id === folderPickerId);
  const tagPickerDocument = documents.find(
    (document) => document.id === tagPickerDocumentId,
  );
  const collectionPicker = collections.find(
    (collection) => collection.id === collectionPickerId,
  );
  const collectionRules = collections.find(
    (collection) => collection.id === collectionRulesId,
  );
  const journalDocument = documents.find(
    (document) => document.journalDate === journalDate,
  );
  const selectedTitle =
    scope.type === "favorites"
      ? "Favorites"
      : scope.type === "tags"
      ? "Tags"
      : scope.type === "collections"
        ? "Collections"
        : scope.type === "journals"
          ? new Intl.DateTimeFormat(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(`${journalDate}T12:00:00`))
          : scope.type === "trash"
            ? "Trash"
          : activeCollection?.name ??
            activeFolder?.name ??
            activeTag?.name ??
            "Docs";

  return (
    <main className="project-document-library-page">
      <Toolbar
        className="project-document-library-toolbar"
        label="Document library controls"
        size="sm"
        variant="transparent"
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
            <Breadcrumbs label="Project document library">
              <BreadcrumbItem onClick={() => history.back()}>
                Back
              </BreadcrumbItem>
              <BreadcrumbItem isCurrent>Project docs</BreadcrumbItem>
            </Breadcrumbs>
          </HStack>
        }
        endContent={
          scope.type === "trash" ? null : (
            <Button
            label={
              scope.type === "tags"
                ? "New tag"
                : scope.type === "collections"
                  ? "New collection"
                  : scope.type === "journals"
                    ? journalDocument
                      ? "Open journal"
                      : "Create daily journal"
                    : creating
                      ? "Creating…"
                      : "New doc"
            }
            variant="primary"
            size="sm"
            isDisabled={
              scope.type !== "tags" &&
              scope.type !== "collections" &&
              creating
            }
            onClick={() =>
              scope.type === "tags"
                ? setTagDialog(null)
                : scope.type === "collections"
                  ? setCollectionDialog(null)
                  : scope.type === "journals"
                    ? journalDocument
                      ? onOpenDocument(journalDocument.id)
                      : onCreateJournal?.(journalDate)
                    : onCreateDocument()
            }
            />
          )
        }
      />

      <div className="project-document-library-body">
        {sidebarOpen ? (
          <aside
            className="project-document-library-sidebar"
            aria-label="Project documents"
          >
            <HStack justify="between" align="center">
              <Text type="label" weight="semibold">
                Project docs
              </Text>
              <Button
                label={creating ? "Creating…" : "New doc"}
                variant="primary"
                size="sm"
                isDisabled={creating}
                onClick={onCreateDocument}
              />
            </HStack>
            <div className="project-document-library-sidebar-search">
              <TextInput
                label="Search sidebar documents"
                isLabelHidden
                value={query}
                onChange={onQueryChange}
                placeholder="Search docs…"
                startIcon={<Icon icon="search" size="sm" />}
                hasClear={Boolean(query)}
                width="100%"
              />
            </div>
            <nav aria-label="Project document library navigation">
              <section aria-labelledby="project-document-library-favorites">
                <button
                    id="project-document-library-favorites"
                    type="button"
                    className="project-document-library-sidebar-all"
                    data-active={scope.type === "favorites"}
                    onClick={() => changeScope({ type: "favorites" })}
                  >
                  Favorites · {favoriteDocuments.length}
                </button>
              </section>
              <section aria-labelledby="project-document-library-all-docs">
                <button
                  id="project-document-library-all-docs"
                  type="button"
                  className="project-document-library-sidebar-all"
                  data-active={scope.type === "docs"}
                  onClick={() => changeScope({ type: "docs" })}
                >
                  All docs · {documents.length}
                </button>
                <button
                  type="button"
                  className="project-document-library-sidebar-all"
                  data-active={scope.type === "journals"}
                  onClick={() => changeScope({ type: "journals" })}
                >
                  Journals
                </button>
              </section>
              <section aria-labelledby="project-document-library-organize">
                <HStack justify="between" align="center">
                  <Text
                    id="project-document-library-organize"
                    type="supporting"
                    weight="semibold"
                  >
                    Organize
                  </Text>
                  <Button
                    label="New folder"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFolderDialog({ parentFolderId: null })
                    }
                  />
                </HStack>
                <div className="project-document-library-folder-list">
                  {folderTree.map(({ folder, depth }) => (
                    <div
                      key={folder.id}
                      className="project-document-library-folder-row"
                      style={{ "--folder-depth": depth } as CSSProperties}
                    >
                      <button
                        type="button"
                        className="project-document-library-folder-link"
                        data-active={
                          scope.type === "folder" && scope.id === folder.id
                        }
                        onClick={() =>
                          changeScope({ type: "folder", id: folder.id })
                        }
                      >
                        <Icon icon="viewColumns" size="sm" />
                        <span>
                          <strong>{folder.name}</strong>
                          <small>{folder.documentIds.length}</small>
                        </span>
                      </button>
                      <AstryxMenu
                        button={{
                          label: `${folder.name} actions`,
                          variant: "ghost",
                          size: "sm",
                          isIconOnly: true,
                          icon: <Icon icon="moreHorizontal" size="sm" />,
                        }}
                        hasChevron={false}
                        menuWidth={220}
                        items={[
                          {
                            label: "Rename",
                            onClick: () =>
                              setFolderDialog({
                                parentFolderId: folder.parentFolderId,
                                folder,
                              }),
                          },
                          {
                            label: "Create a subfolder",
                            onClick: () =>
                              setFolderDialog({
                                parentFolderId: folder.id,
                              }),
                          },
                          {
                            label: "Add docs",
                            onClick: () => setFolderPickerId(folder.id),
                          },
                          {
                            label: folder.isFavorite
                              ? "Remove from favorites"
                              : "Add to favorites",
                            onClick: () =>
                              onUpdateFolder?.(folder, {
                                name: folder.name,
                                isFavorite: !folder.isFavorite,
                              }),
                          },
                          { type: "divider" },
                          {
                            label: "Delete",
                            onClick: () => onDeleteFolder?.(folder.id),
                          },
                        ]}
                      />
                    </div>
                  ))}
                  {folderTree.length === 0 ? (
                    <Text type="supporting">No folders yet.</Text>
                  ) : null}
                </div>
              </section>
              <section aria-labelledby="project-document-library-tags">
                <HStack justify="between" align="center">
                  <button
                    id="project-document-library-tags"
                    type="button"
                    className="project-document-library-sidebar-section-link"
                    data-active={scope.type === "tags"}
                    onClick={() => changeScope({ type: "tags" })}
                  >
                    Tags
                  </button>
                  <Button
                    label="New tag"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTagDialog(null)}
                  />
                </HStack>
                <div className="project-document-library-tag-list">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className="project-document-library-tag-link"
                      data-active={
                        scope.type === "tag" && scope.id === tag.id
                      }
                      onClick={() =>
                        changeScope({ type: "tag", id: tag.id })
                      }
                    >
                      <span
                        className="project-document-tag-dot"
                        data-color={tag.color}
                        aria-hidden="true"
                      />
                      <span>{tag.name}</span>
                      <small>{tag.documentIds.length}</small>
                    </button>
                  ))}
                  {tags.length === 0 ? (
                    <Text type="supporting">No tags yet.</Text>
                  ) : null}
                </div>
              </section>
              <section aria-labelledby="project-document-library-collections">
                <HStack justify="between" align="center">
                  <button
                    id="project-document-library-collections"
                    type="button"
                    className="project-document-library-sidebar-section-link"
                    data-active={scope.type === "collections"}
                    onClick={() => changeScope({ type: "collections" })}
                  >
                    Collections
                  </button>
                  <Button
                    label="New collection"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollectionDialog(null)}
                  />
                </HStack>
                <div className="project-document-library-collection-list">
                  {collections.map((collection) => {
                    const count = smartCollectionDocuments(
                      collection,
                      documents,
                      tags,
                    ).length;
                    return (
                      <div
                        key={collection.id}
                        className="project-document-library-collection-row"
                      >
                        <button
                          type="button"
                          className="project-document-library-collection-link"
                          data-active={
                            scope.type === "collection" &&
                            scope.id === collection.id
                          }
                          onClick={() =>
                            changeScope({
                              type: "collection",
                              id: collection.id,
                            })
                          }
                        >
                          <Icon icon="funnel" size="sm" />
                          <span>{collection.name}</span>
                          <small>{count}</small>
                        </button>
                        <AstryxMenu
                          button={{
                            label: `${collection.name} actions`,
                            variant: "ghost",
                            size: "sm",
                            isIconOnly: true,
                            icon: <Icon icon="moreHorizontal" size="sm" />,
                          }}
                          hasChevron={false}
                          menuWidth={220}
                          items={[
                            {
                              label: "Rename",
                              onClick: () =>
                                setCollectionDialog(collection),
                            },
                            {
                              label: "Edit contents",
                              onClick: () =>
                                setCollectionRulesId(collection.id),
                            },
                            {
                              label: collection.isFavorite
                                ? "Remove from favorites"
                                : "Add to favorites",
                              onClick: () =>
                                onUpdateCollection?.(collection, {
                                  name: collection.name,
                                  isFavorite: !collection.isFavorite,
                                  mode: collection.mode,
                                  rules: collection.rules,
                                }),
                            },
                            { type: "divider" },
                            {
                              label: "Delete",
                              onClick: () => {
                                if (
                                  scope.type === "collection" &&
                                  scope.id === collection.id
                                ) {
                                  changeScope({ type: "collections" });
                                }
                                onDeleteCollection?.(collection.id);
                              },
                            },
                          ]}
                        />
                      </div>
                    );
                  })}
                  {collections.length === 0 ? (
                    <Text type="supporting">No collections yet.</Text>
                  ) : null}
                </div>
              </section>
              <section aria-labelledby="project-document-library-others">
                <Text
                  id="project-document-library-others"
                  type="supporting"
                  weight="semibold"
                >
                  Others
                </Text>
                <div className="project-document-library-sidebar-list">
                  <button
                    type="button"
                    className="project-document-library-sidebar-item"
                    data-active={scope.type === "trash"}
                    onClick={() => changeScope({ type: "trash" })}
                  >
                    <Icon icon="viewColumns" size="sm" />
                    <span>
                      <strong>Trash</strong>
                      <small>{trash.length} deleted</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="project-document-library-sidebar-item"
                    onClick={() => setImportOpen(true)}
                  >
                    <Icon icon="arrowDown" size="sm" />
                    <span>
                      <strong>Import</strong>
                      <small>Markdown or HTML</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="project-document-library-sidebar-item"
                    onClick={() => setTemplatesOpen(true)}
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
        <section
          className="project-document-library-content"
          aria-labelledby="project-document-library-title"
        >
          {scope.type !== "trash" ? (
            <nav
              className="project-document-library-tabs"
              aria-label="Document workspace views"
            >
              <button
                type="button"
                data-active={
                  scope.type === "docs" ||
                  scope.type === "folder" ||
                  scope.type === "tag"
                }
                onClick={() => changeScope({ type: "docs" })}
              >
                Docs
              </button>
              <button
                type="button"
                data-active={
                  scope.type === "collections" ||
                  scope.type === "collection"
                }
                onClick={() => changeScope({ type: "collections" })}
              >
                Collections
              </button>
              <button
                type="button"
                data-active={scope.type === "tags"}
                onClick={() => changeScope({ type: "tags" })}
              >
                Tags
              </button>
            </nav>
          ) : null}
          <header className="project-document-library-heading">
            <div>
              <Text
                id="project-document-library-title"
                as="h1"
                type="large"
                weight="semibold"
              >
                {selectedTitle}
              </Text>
              <Text type="supporting">
                {scope.type === "tags"
                  ? `${tags.length} ${tags.length === 1 ? "tag" : "tags"}`
                  : scope.type === "collections"
                    ? `${collections.length} ${
                        collections.length === 1
                          ? "collection"
                          : "collections"
                      }`
                    : scope.type === "journals"
                      ? journalDocument
                        ? "Daily journal"
                        : "No journal"
                      : scope.type === "trash"
                        ? `${trash.length} deleted ${
                            trash.length === 1 ? "document" : "documents"
                          }`
                        : searching
                          ? "Searching documents…"
                          : `${visibleDocuments.length} ${
                            visibleDocuments.length === 1
                              ? "document"
                              : "documents"
                            }`}
              </Text>
            </div>
            {scope.type === "tags" ? (
              <Button
                label="New tag"
                variant="primary"
                size="sm"
                onClick={() => setTagDialog(null)}
              />
            ) : scope.type === "collections" ? (
              <Button
                label="New collection"
                variant="primary"
                size="sm"
                onClick={() => setCollectionDialog(null)}
              />
            ) : scope.type === "collection" && activeCollection ? (
              <HStack gap={2} align="center">
                <Button
                  label="Add docs"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCollectionPickerId(activeCollection.id)}
                />
                <Button
                  label="Add rules"
                  variant="primary"
                  size="sm"
                  onClick={() => setCollectionRulesId(activeCollection.id)}
                />
              </HStack>
            ) : scope.type === "journals" || scope.type === "trash" ? null : (
              <HStack
                className="project-document-library-controls"
                gap={2}
                align="center"
              >
                <TextInput
                  label="Search documents"
                  isLabelHidden
                  value={query}
                  onChange={onQueryChange}
                  placeholder="Search docs…"
                  startIcon={<Icon icon="search" size="sm" />}
                  hasClear={Boolean(query)}
                  width="240px"
                />
                <AstryxMenu
                  button={{
                    label: "Display",
                    variant: "secondary",
                    size: "sm",
                    icon: <Icon icon="viewColumns" size="sm" />,
                  }}
                  menuWidth={236}
                  items={[
                    {
                      label:
                        grouping === "updated"
                          ? "Show one group"
                          : "Group by updated",
                      onClick: () =>
                        onGroupingChange(
                          grouping === "updated" ? "none" : "updated",
                        ),
                    },
                    { type: "divider" },
                    {
                      label: `Sort: ${sort === "updated" ? "Updated" : sort === "created" ? "Created" : "Title"}`,
                      isDisabled: true,
                    },
                    {
                      label: "Sort by updated",
                      onClick: () => onSortChange("updated"),
                    },
                    {
                      label: "Sort by created",
                      onClick: () => onSortChange("created"),
                    },
                    {
                      label: "Sort by title",
                      onClick: () => onSortChange("title"),
                    },
                  ]}
                />
                <SegmentedControl
                  value={viewMode}
                  onChange={(value) =>
                    onViewModeChange(value as ProjectDocumentLibraryViewMode)
                  }
                  label="Document display"
                  size="sm"
                >
                  <SegmentedControlItem value="list" label="List" />
                  <SegmentedControlItem value="grid" label="Grid" />
                </SegmentedControl>
              </HStack>
            )}
          </header>

          {error ? (
            <div className="project-document-library-state" role="alert">
              <EmptyState
                title="Could not load Project Docs"
                description={error}
                actions={
                  <Button label="Retry" variant="primary" onClick={onRetry} />
                }
              />
            </div>
          ) : loading ? (
            <div className="project-document-library-state" role="status">
              <Text type="supporting">Loading documents…</Text>
            </div>
          ) : scope.type === "tags" ? (
            <div className="project-document-tag-management">
              {tags.length === 0 ? (
                <div className="project-document-library-state">
                  <EmptyState
                    title="Tag management"
                    description="Create a new tag for your documents."
                    actions={
                      <Button
                        label="New tag"
                        variant="primary"
                        onClick={() => setTagDialog(null)}
                      />
                    }
                  />
                </div>
              ) : (
                <div className="project-document-tag-management-list">
                  {tags.map((tag) => {
                    const colorIndex = tagColors.indexOf(tag.color);
                    const nextColor =
                      tagColors[(colorIndex + 1) % tagColors.length] ?? "blue";
                    return (
                      <article
                        key={tag.id}
                        className="project-document-tag-management-row"
                      >
                        <button
                          type="button"
                          className="project-document-tag-management-open"
                          onClick={() =>
                            changeScope({ type: "tag", id: tag.id })
                          }
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
                        <AstryxMenu
                          button={{
                            label: `${tag.name} actions`,
                            variant: "ghost",
                            size: "sm",
                            isIconOnly: true,
                            icon: <Icon icon="moreHorizontal" size="sm" />,
                          }}
                          hasChevron={false}
                          menuWidth={210}
                          items={[
                            {
                              label: "Rename",
                              onClick: () => setTagDialog(tag),
                            },
                            {
                              label: "Change color",
                              onClick: () =>
                                onUpdateTag?.(tag, {
                                  name: tag.name,
                                  color: nextColor,
                                }),
                            },
                            { type: "divider" },
                            {
                              label: "Delete",
                              onClick: () => onDeleteTag?.(tag.id),
                            },
                          ]}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : scope.type === "collections" ? (
            <div className="project-document-collection-management">
              {collections.length === 0 ? (
                <div className="project-document-library-state">
                  <EmptyState
                    title="Collection management"
                    description="Create smart or manual collections for the documents in this project."
                    actions={
                      <Button
                        label="Add collection"
                        variant="primary"
                        onClick={() => setCollectionDialog(null)}
                      />
                    }
                  />
                </div>
              ) : (
                <div className="project-document-collection-management-list">
                  {collections.map((collection) => {
                    const count = smartCollectionDocuments(
                      collection,
                      documents,
                      tags,
                    ).length;
                    return (
                      <article
                        key={collection.id}
                        className="project-document-collection-management-row"
                      >
                        <button
                          type="button"
                          className="project-document-collection-management-open"
                          onClick={() =>
                            changeScope({
                              type: "collection",
                              id: collection.id,
                            })
                          }
                        >
                          <span
                            className="project-document-library-icon"
                            aria-hidden="true"
                          >
                            <Icon icon="viewColumns" size="sm" />
                          </span>
                          <span>
                            <strong>{collection.name}</strong>
                            <small>
                              {collection.mode === "rules"
                                ? `${collection.rules.length} active ${
                                    collection.rules.length === 1
                                      ? "rule"
                                      : "rules"
                                  }`
                                : "Manual collection"}{" "}
                              · {count} {count === 1 ? "document" : "documents"}
                            </small>
                          </span>
                        </button>
                        <AstryxMenu
                          button={{
                            label: `${collection.name} actions`,
                            variant: "ghost",
                            size: "sm",
                            isIconOnly: true,
                            icon: <Icon icon="moreHorizontal" size="sm" />,
                          }}
                          hasChevron={false}
                          menuWidth={220}
                          items={[
                            {
                              label: "Rename",
                              onClick: () => setCollectionDialog(collection),
                            },
                            {
                              label:
                                collection.mode === "manual"
                                  ? "Add docs"
                                  : "Edit rules",
                              onClick: () =>
                                collection.mode === "manual"
                                  ? setCollectionPickerId(collection.id)
                                  : setCollectionRulesId(collection.id),
                            },
                            {
                              label: collection.isFavorite
                                ? "Remove from favorites"
                                : "Add to favorites",
                              onClick: () =>
                                onUpdateCollection?.(collection, {
                                  name: collection.name,
                                  isFavorite: !collection.isFavorite,
                                  mode: collection.mode,
                                  rules: collection.rules,
                                }),
                            },
                            { type: "divider" },
                            {
                              label: "Delete",
                              onClick: () =>
                                onDeleteCollection?.(collection.id),
                            },
                          ]}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : scope.type === "journals" ? (
            <div className="project-document-journals">
              <div
                className="project-document-journal-date-strip"
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
                      data-active={journalDate === dateKey}
                      data-has-journal={hasJournal}
                      onClick={() => {
                        setJournalDate(dateKey);
                        onJournalDateChange?.(dateKey);
                      }}
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
              </div>
              <div className="project-document-journal-day">
                <Text type="supporting">
                  {journalDate === localDateKey() ? "Today" : "Daily journal"}
                </Text>
                {journalDocument ? (
                  <button
                    type="button"
                    className="project-document-journal-card"
                    onClick={() => onOpenDocument(journalDocument.id)}
                  >
                    <span
                      className="project-document-library-icon"
                      aria-hidden="true"
                    >
                      <Icon icon="viewColumns" size="sm" />
                    </span>
                    <span>
                      <strong>{journalDocument.title}</strong>
                      <small>
                        Updated {formatLibraryDate(journalDocument.updatedAt)}
                      </small>
                    </span>
                  </button>
                ) : (
                  <div className="project-document-journal-empty">
                    <EmptyState
                      title="No Journal"
                      description="Capture notes, decisions, and progress for this day."
                      actions={
                        <Button
                          label="Create Daily Journal"
                          variant="primary"
                          onClick={() => onCreateJournal?.(journalDate)}
                        />
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ) : scope.type === "trash" ? (
            <div className="project-document-trash">
              {trash.length === 0 ? (
                <div className="project-document-library-state">
                  <EmptyState
                    title="Docs management"
                    description="Deleted docs will appear here."
                  />
                </div>
              ) : (
                <div className="project-document-trash-list">
                  {trash.map((document) => (
                    <article
                      key={document.id}
                      className="project-document-trash-row"
                    >
                      <span
                        className="project-document-library-icon"
                        aria-hidden="true"
                      >
                        <Icon icon="viewColumns" size="sm" />
                      </span>
                      <span className="project-document-library-copy">
                        <strong>{document.title}</strong>
                        <small>
                          Deleted{" "}
                          {formatLibraryDate(
                            document.trashedAt ?? document.updatedAt,
                          )}
                        </small>
                      </span>
                      <HStack gap={2}>
                        <Button
                          label="Restore"
                          variant="secondary"
                          size="sm"
                          onClick={() => onRestoreDocument?.(document.id)}
                        />
                        <Button
                          label="Delete permanently"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPermanentDeleteDocument(document)}
                        />
                      </HStack>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : scope.type === "collection" && !activeCollection ? (
            <div className="project-document-library-state">
              <EmptyState
                title="Collection not found"
                description="This collection may have been deleted."
                actions={
                  <Button
                    label="View collections"
                    variant="primary"
                    onClick={() => changeScope({ type: "collections" })}
                  />
                }
              />
            </div>
          ) : scope.type === "collection" &&
            activeCollection &&
            visibleDocuments.length === 0 ? (
            <div className="project-document-library-state">
              <EmptyState
                title="Empty collection"
                description={
                  activeCollection.mode === "manual"
                    ? "Add documents to keep related work together."
                    : "Adjust the rules to include matching documents."
                }
                actions={
                  <HStack gap={2}>
                    <Button
                      label="Add docs"
                      variant="secondary"
                      onClick={() =>
                        setCollectionPickerId(activeCollection.id)
                      }
                    />
                    <Button
                      label="Add rules"
                      variant="primary"
                      onClick={() => setCollectionRulesId(activeCollection.id)}
                    />
                  </HStack>
                }
              />
            </div>
          ) : visibleDocuments.length === 0 ? (
            <div className="project-document-library-state">
              <EmptyState
                title={
                  query ? "No documents found" : "Create your first document"
                }
                description={
                  query
                    ? searchError || "Try a different search."
                    : "Start with a Page and switch to Canvas whenever you need more space."
                }
                actions={
                  query ? (
                    <Button
                      label="Clear search"
                      variant="secondary"
                      onClick={() => onQueryChange("")}
                    />
                  ) : (
                    <Button
                      label="New doc"
                      variant="primary"
                      onClick={onCreateDocument}
                    />
                  )
                }
              />
            </div>
          ) : (
            <div
              className="project-document-library-groups"
              data-view={viewMode}
            >
              {groupedDocuments.map(([label, groupDocuments]) => (
                <section
                  key={label}
                  className="project-document-library-group"
                  aria-labelledby={`project-document-group-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`}
                >
                  <HStack gap={1} align="center">
                    <Text
                      id={`project-document-group-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`}
                      as="h2"
                      type="label"
                      weight="semibold"
                    >
                      {label}
                    </Text>
                    <Text type="supporting">· {groupDocuments.length}</Text>
                  </HStack>
                  <div className="project-document-library-list">
                    {groupDocuments.map((document) => {
                      const documentTags = tags.filter((tag) =>
                        tag.documentIds.includes(document.id),
                      );
                      return (
                        <article
                          key={document.id}
                          className="project-document-library-item"
                        >
                          <button
                            type="button"
                            className="project-document-library-open"
                            onClick={() => onOpenDocument(document.id)}
                          >
                            <span
                              className="project-document-library-icon"
                              aria-hidden="true"
                            >
                              <Icon icon="viewColumns" size="sm" />
                            </span>
                            <span className="project-document-library-copy">
                              <strong>{document.title}</strong>
                              <small
                                className={
                                  normalizedQuery &&
                                  searchSnippets.get(document.id)
                                    ? "project-document-library-search-snippet"
                                    : undefined
                                }
                              >
                                {normalizedQuery &&
                                searchSnippets.get(document.id)
                                  ? searchSnippets.get(document.id)
                                  : `${documentIconLabels[document.icon]} · Updated ${formatLibraryDate(
                                      document.updatedAt,
                                    )}`}
                              </small>
                              {documentTags.length > 0 ? (
                                <span className="project-document-library-tag-chips">
                                  {documentTags.map((tag) => (
                                    <span
                                      key={tag.id}
                                      data-color={tag.color}
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            <span className="project-document-library-date">
                              Created {formatLibraryDate(document.createdAt)}
                            </span>
                          </button>
                          <AstryxMenu
                            button={{
                              label: `${document.title} actions`,
                              variant: "ghost",
                              size: "sm",
                              isIconOnly: true,
                              icon: <Icon icon="moreHorizontal" size="sm" />,
                            }}
                            hasChevron={false}
                            menuWidth={190}
                            items={[
                              {
                                label: "Manage tags",
                                onClick: () =>
                                  setTagPickerDocumentId(document.id),
                              },
                              { type: "divider" },
                              {
                                label: "Move to trash",
                                onClick: () =>
                                  onTrashDocument?.(document.id),
                              },
                            ]}
                          />
                          <Button
                            className="project-document-library-favorite"
                            label={
                              document.isFavorite ? "Favorited" : "Favorite"
                            }
                            variant={
                              document.isFavorite ? "secondary" : "ghost"
                            }
                            size="sm"
                            onClick={() => onFavoriteDocument(document)}
                          />
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
      <ProjectDocumentNameDialog
        isOpen={folderDialog !== undefined}
        title={folderDialog?.folder ? "Rename folder" : "Create folder"}
        description={
          folderDialog?.parentFolderId
            ? "Create a nested folder inside the selected folder."
            : "Group related project documents in the workspace."
        }
        label="Folder name"
        initialValue={folderDialog?.folder?.name}
        submitLabel={folderDialog?.folder ? "Save" : "Create"}
        onClose={() => {
          setFolderDialog(undefined);
          closeRoutedManagementDialog("new-folder");
        }}
        onSubmit={(name) => {
          if (folderDialog?.folder) {
            onUpdateFolder?.(folderDialog.folder, {
              name,
              isFavorite: folderDialog.folder.isFavorite,
            });
          } else {
            onCreateFolder?.(name, folderDialog?.parentFolderId ?? null);
          }
          setFolderDialog(undefined);
          closeRoutedManagementDialog("new-folder");
        }}
      />
      <ProjectDocumentFolderPickerDialog
        folder={folderPicker}
        documents={documents}
        isOpen={folderPicker !== undefined}
        onClose={() => setFolderPickerId(undefined)}
        onSubmit={(documentIds) => {
          if (folderPicker) {
            onSetFolderDocuments?.(folderPicker.id, documentIds);
          }
          setFolderPickerId(undefined);
        }}
      />
      <ProjectDocumentNameDialog
        isOpen={tagDialog !== undefined}
        title={tagDialog ? "Rename tag" : "Create tag"}
        description="Tags can be assigned to documents from the library or document info."
        label="Tag name"
        initialValue={tagDialog?.name}
        submitLabel={tagDialog ? "Save" : "Create"}
        onClose={() => {
          setTagDialog(undefined);
          closeRoutedManagementDialog("new-tag");
        }}
        onSubmit={(name) => {
          if (tagDialog) {
            onUpdateTag?.(tagDialog, {
              name,
              color: tagDialog.color,
            });
          } else {
            onCreateTag?.(name, "blue");
          }
          setTagDialog(undefined);
          closeRoutedManagementDialog("new-tag");
        }}
      />
      <ProjectDocumentTagPickerDialog
        document={tagPickerDocument}
        tags={tags}
        isOpen={tagPickerDocument !== undefined}
        onClose={() => setTagPickerDocumentId(undefined)}
        onSubmit={(tagIds) => {
          if (tagPickerDocument) {
            onSetDocumentTags?.(tagPickerDocument.id, tagIds);
          }
          setTagPickerDocumentId(undefined);
        }}
      />
      <ProjectDocumentNameDialog
        isOpen={collectionDialog !== undefined}
        title={collectionDialog ? "Rename collection" : "Save as new collection"}
        description="A collection is a smart folder where you can manually add docs or automatically include docs through rules."
        label="Collection name"
        initialValue={collectionDialog?.name}
        submitLabel={collectionDialog ? "Save" : "Create"}
        onClose={() => {
          setCollectionDialog(undefined);
          closeRoutedManagementDialog("new-collection");
        }}
        onSubmit={(name) => {
          if (collectionDialog) {
            onUpdateCollection?.(collectionDialog, {
              name,
              isFavorite: collectionDialog.isFavorite,
              mode: collectionDialog.mode,
              rules: collectionDialog.rules,
            });
          } else {
            onCreateCollection?.(name);
          }
          setCollectionDialog(undefined);
          closeRoutedManagementDialog("new-collection");
        }}
      />
      <ProjectDocumentCollectionPickerDialog
        collection={collectionPicker}
        documents={documents}
        isOpen={collectionPicker !== undefined}
        onClose={() => setCollectionPickerId(undefined)}
        onSubmit={(documentIds) => {
          if (collectionPicker) {
            onUpdateCollection?.(collectionPicker, {
              name: collectionPicker.name,
              isFavorite: collectionPicker.isFavorite,
              mode: "manual",
              rules: [],
            });
            onSetCollectionDocuments?.(collectionPicker.id, documentIds);
          }
          setCollectionPickerId(undefined);
        }}
      />
      <ProjectDocumentCollectionRulesDialog
        collection={collectionRules}
        tags={tags}
        isOpen={collectionRules !== undefined}
        onClose={() => setCollectionRulesId(undefined)}
        onSubmit={({ mode, rules }) => {
          if (collectionRules) {
            onUpdateCollection?.(collectionRules, {
              name: collectionRules.name,
              isFavorite: collectionRules.isFavorite,
              mode,
              rules,
            });
          }
          setCollectionRulesId(undefined);
        }}
      />
      <ProjectDocumentImportDialog
        isOpen={importOpen}
        onClose={() => {
          setImportOpen(false);
          closeRoutedManagementDialog("import");
        }}
        onSubmit={(file) => {
          onImportDocument?.(file);
          setImportOpen(false);
        }}
      />
      <ProjectDocumentTemplateDialog
        isOpen={templatesOpen}
        savedTemplates={documents.filter((document) => document.isTemplate)}
        onClose={() => {
          setTemplatesOpen(false);
          closeRoutedManagementDialog("templates");
        }}
        onSelect={(template) => {
          onCreateFromTemplate?.(template);
          setTemplatesOpen(false);
        }}
      />
      <ProjectDocumentDeleteDialog
        document={permanentDeleteDocument}
        onClose={() => setPermanentDeleteDocument(undefined)}
        onConfirm={(documentId) => {
          onDeleteDocumentPermanently?.(documentId);
          setPermanentDeleteDocument(undefined);
        }}
      />
    </main>
  );
}

export function ProjectDocumentLibrary({
  projectId,
  folderId,
  tagId,
  collectionId,
  workspaceView,
  journalDate,
}: {
  projectId: number;
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
  const [documents, setDocuments] = useState<ProjectDocumentPublic[]>([]);
  const [trash, setTrash] = useState<ProjectDocumentPublic[]>([]);
  const [folders, setFolders] = useState<ProjectDocumentFolder[]>([]);
  const [tags, setTags] = useState<ProjectDocumentTag[]>([]);
  const [collections, setCollections] = useState<
    ProjectDocumentSmartCollection[]
  >([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    ProjectDocumentSearchResult[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [viewMode, setViewMode] =
    useState<ProjectDocumentLibraryViewMode>("list");
  const [sort, setSort] = useState<ProjectDocumentLibrarySort>("updated");
  const [grouping, setGrouping] =
    useState<ProjectDocumentLibraryGrouping>("updated");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const applyCollection = (collection: ProjectDocumentCollection) => {
    setDocuments(collection.documents);
    setTrash(collection.trash ?? []);
    setFolders(collection.folders ?? []);
    setTags(collection.tags ?? []);
    setCollections(collection.collections ?? []);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listProjectDocuments(projectId)
      .then((collection) => {
        if (active) applyCollection(collection);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, retryKey]);

  useEffect(() => {
    let active = true;
    const normalized = query.trim();
    setSearchError("");
    if (!normalized) {
      setSearchResults([]);
      setSearching(false);
      return () => {
        active = false;
      };
    }
    setSearching(true);
    const timeout = window.setTimeout(() => {
      searchProjectDocuments(projectId, normalized)
        .then((results) => {
          if (active) setSearchResults(results);
        })
        .catch((cause) => {
          if (active) {
            setSearchResults([]);
            setSearchError((cause as Error).message);
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [projectId, query]);

  const openDocument = (documentId: number) =>
    navigate({ name: "project-document", projectId, documentId });

  const createDocument = () => {
    if (creating) return;
    setCreating(true);
    setError("");
    createProjectDocument(projectId)
      .then((created) => openDocument(created.document.id))
      .catch((cause) => setError((cause as Error).message))
      .finally(() => setCreating(false));
  };

  const createSeededDocument = (
    title: string,
    blocks: readonly ProjectDocumentSeedBlock[],
  ) => {
    if (creating) return;
    setCreating(true);
    setError("");
    createProjectDocument(projectId, title)
      .then(async (created) => {
        await seedProjectDocument(created, blocks);
        openDocument(created.document.id);
      })
      .catch((cause) => setError((cause as Error).message))
      .finally(() => setCreating(false));
  };

  const createSavedTemplateDocument = (templateDocumentId: number) => {
    if (creating) return;
    setCreating(true);
    setError("");
    createProjectDocumentFromTemplate(projectId, templateDocumentId)
      .then((created) => {
        window.sessionStorage.setItem(
          templateRestoreStorageKey(
            created.bootstrap.document.id,
            created.bootstrap.syncInstanceId,
          ),
          created.snapshotBase64,
        );
        openDocument(created.bootstrap.document.id);
      })
      .catch((cause) => setError((cause as Error).message))
      .finally(() => setCreating(false));
  };

  const favoriteDocument = (document: ProjectDocumentPublic) => {
    const nextFavorite = !document.isFavorite;
    setDocuments((current) =>
      current.map((item) =>
        item.id === document.id ? { ...item, isFavorite: nextFavorite } : item,
      ),
    );
    updateProjectDocumentMetadata(projectId, document.id, {
      title: document.title,
      icon: document.icon,
      isFavorite: nextFavorite,
      pageWidth: document.pageWidth,
      properties: document.properties,
    })
      .then((updated) => {
        setDocuments((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      })
      .catch((cause) => {
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? { ...item, isFavorite: document.isFavorite }
              : item,
          ),
        );
        setError((cause as Error).message);
      });
  };

  const runCollectionAction = (action: Promise<ProjectDocumentCollection>) => {
    setError("");
    action.then(applyCollection).catch((cause) => {
      setError((cause as Error).message);
    });
  };

  const runDeleteAction = (action: Promise<void>) => {
    setError("");
    action
      .then(() => listProjectDocuments(projectId))
      .then(applyCollection)
      .catch((cause) => {
        setError((cause as Error).message);
      });
  };

  return (
    <ProjectDocumentLibraryView
      documents={documents}
      trash={trash}
      folders={folders}
      tags={tags}
      collections={collections}
      initialScope={
        folderId
          ? { type: "folder", id: folderId }
          : tagId
            ? { type: "tag", id: tagId }
            : collectionId
              ? { type: "collection", id: collectionId }
              : workspaceView === "favorites"
                ? { type: "favorites" }
              : workspaceView === "tags"
                ? { type: "tags" }
                : workspaceView === "collections"
                  ? { type: "collections" }
                  : workspaceView === "journals"
                    ? { type: "journals" }
                    : workspaceView === "trash"
                      ? { type: "trash" }
                    : { type: "docs" }
      }
      initialJournalDate={journalDate}
      initialManagementDialog={
        workspaceView === "import"
          ? "import"
          : workspaceView === "templates"
            ? "templates"
            : workspaceView === "new-folder"
              ? "new-folder"
              : workspaceView === "new-tag"
                ? "new-tag"
                : workspaceView === "new-collection"
                  ? "new-collection"
            : undefined
      }
      query={query}
      viewMode={viewMode}
      sort={sort}
      grouping={grouping}
      loading={loading}
      searching={searching}
      searchResults={searchResults}
      searchError={searchError}
      creating={creating}
      error={error || undefined}
      onQueryChange={setQuery}
      onScopeChange={(scope) =>
        navigate(
          scope.type === "folder"
            ? { name: "project-document", projectId, folderId: scope.id }
            : scope.type === "tag"
              ? { name: "project-document", projectId, tagId: scope.id }
              : scope.type === "collection"
                ? {
                    name: "project-document",
                    projectId,
                    collectionId: scope.id,
                  }
              : scope.type === "favorites"
                ? {
                    name: "project-document",
                    projectId,
                    workspaceView: "favorites",
                  }
              : scope.type === "tags"
                ? {
                    name: "project-document",
                    projectId,
                    workspaceView: "tags",
                  }
                : scope.type === "collections"
                  ? {
                      name: "project-document",
                      projectId,
                      workspaceView: "collections",
                    }
                  : scope.type === "journals"
                    ? {
                        name: "project-document",
                        projectId,
                        workspaceView: "journals",
                      }
                    : scope.type === "trash"
                      ? {
                          name: "project-document",
                          projectId,
                          workspaceView: "trash",
                        }
                : { name: "project-document", projectId },
        )
      }
      onViewModeChange={setViewMode}
      onSortChange={setSort}
      onGroupingChange={setGrouping}
      onJournalDateChange={(date) =>
        navigate({
          name: "project-document",
          projectId,
          workspaceView: "journals",
          journalDate: date,
        })
      }
      onManagementDialogClose={() =>
        navigate({ name: "project-document", projectId })
      }
      onOpenDocument={openDocument}
      onFavoriteDocument={favoriteDocument}
      onCreateDocument={createDocument}
      onCreateFolder={(name, parentFolderId) =>
        runCollectionAction(
          createProjectDocumentFolder(projectId, { name, parentFolderId }),
        )
      }
      onUpdateFolder={(folder, input) =>
        runCollectionAction(
          updateProjectDocumentFolder(projectId, folder.id, input),
        )
      }
      onDeleteFolder={(folderId) =>
        runDeleteAction(deleteProjectDocumentFolder(projectId, folderId))
      }
      onSetFolderDocuments={(folderId, documentIds) =>
        runCollectionAction(
          setProjectDocumentFolderDocuments(
            projectId,
            folderId,
            documentIds,
          ),
        )
      }
      onCreateTag={(name, color) =>
        runCollectionAction(
          createProjectDocumentTag(projectId, { name, color }),
        )
      }
      onUpdateTag={(tag, input) =>
        runCollectionAction(
          updateProjectDocumentTag(projectId, tag.id, input),
        )
      }
      onDeleteTag={(tagId) =>
        runDeleteAction(deleteProjectDocumentTag(projectId, tagId))
      }
      onSetDocumentTags={(documentId, tagIds) =>
        runCollectionAction(
          setProjectDocumentTags(projectId, documentId, tagIds),
        )
      }
      onCreateCollection={(name) =>
        runCollectionAction(
          createProjectDocumentCollection(projectId, { name }),
        )
      }
      onUpdateCollection={(collection, input) =>
        runCollectionAction(
          updateProjectDocumentCollection(projectId, collection.id, input),
        )
      }
      onDeleteCollection={(collectionId) =>
        runDeleteAction(
          deleteProjectDocumentCollection(projectId, collectionId),
        )
      }
      onSetCollectionDocuments={(collectionId, documentIds) =>
        runCollectionAction(
          setProjectDocumentCollectionDocuments(
            projectId,
            collectionId,
            documentIds,
          ),
        )
      }
      onCreateJournal={(date) => {
        if (creating) return;
        setCreating(true);
        setError("");
        createProjectDocumentJournal(projectId, date)
          .then((created) => openDocument(created.document.id))
          .catch((cause) => setError((cause as Error).message))
          .finally(() => setCreating(false));
      }}
      onTrashDocument={(documentId) =>
        runCollectionAction(trashProjectDocument(projectId, documentId))
      }
      onRestoreDocument={(documentId) =>
        runCollectionAction(restoreProjectDocument(projectId, documentId))
      }
      onDeleteDocumentPermanently={(documentId) =>
        runDeleteAction(
          permanentlyDeleteProjectDocument(projectId, documentId),
        )
      }
      onImportDocument={(file) => {
        void file
          .text()
          .then((source) => {
            const title =
              file.name.replace(/\.(?:md|markdown|html?|htm)$/i, "").trim() ||
              "Imported document";
            const blocks = /\.html?$/i.test(file.name)
              ? htmlProjectDocumentBlocks(source)
              : markdownProjectDocumentBlocks(source);
            createSeededDocument(title, blocks);
          })
          .catch((cause) => setError((cause as Error).message));
      }}
      onCreateFromTemplate={(template) => {
        if (template.kind === "document") {
          createSavedTemplateDocument(template.documentId);
        } else {
          createSeededDocument(template.title, template.blocks);
        }
      }}
      onRetry={() => setRetryKey((value) => value + 1)}
    />
  );
}
