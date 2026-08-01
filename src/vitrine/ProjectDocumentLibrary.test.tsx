import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  ProjectDocumentFolder,
  ProjectDocumentPublic,
  ProjectDocumentSmartCollection,
  ProjectDocumentTag,
} from "../projectDocument.ts";
import { ProjectDocumentLibraryView } from "./components/ProjectDocumentLibrary.tsx";
import { ProjectDocumentWorkspace } from "./components/ProjectDocumentWorkspace.tsx";

const documents: ProjectDocumentPublic[] = [
  {
    id: 41,
    projectId: 7,
    ownerUserId: 3,
    documentKey: "main",
    title: "Project notes",
    icon: "document",
    isFavorite: false,
    isTemplate: false,
    pageWidth: "standard",
    properties: [],
    lastEditorMode: "page",
    integrationVersion: "integration-1",
    journalDate: null,
    trashedAt: null,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    id: 42,
    projectId: 7,
    ownerUserId: 3,
    documentKey: "brief",
    title: "Product brief",
    icon: "idea",
    isFavorite: true,
    isTemplate: true,
    pageWidth: "full",
    properties: [],
    lastEditorMode: "edgeless",
    integrationVersion: "integration-1",
    journalDate: null,
    trashedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  },
];

const folders: ProjectDocumentFolder[] = [
  {
    id: 8,
    projectId: 7,
    ownerUserId: 3,
    parentFolderId: null,
    name: "Planning",
    isFavorite: false,
    documentIds: [41, 42],
    createdAt: documents[0].createdAt,
    updatedAt: documents[1].updatedAt,
  },
  {
    id: 10,
    projectId: 7,
    ownerUserId: 3,
    parentFolderId: 8,
    name: "Research",
    isFavorite: false,
    documentIds: [41],
    createdAt: documents[0].createdAt,
    updatedAt: documents[1].updatedAt,
  },
];

const tags: ProjectDocumentTag[] = [
  {
    id: 9,
    projectId: 7,
    ownerUserId: 3,
    name: "Priority",
    color: "blue",
    documentIds: [42],
    createdAt: documents[0].createdAt,
    updatedAt: documents[1].updatedAt,
  },
];

const collections: ProjectDocumentSmartCollection[] = [
  {
    id: 10,
    projectId: 7,
    ownerUserId: 3,
    name: "Product decisions",
    isFavorite: false,
    mode: "manual",
    rules: [],
    documentIds: [42],
    createdAt: documents[0].createdAt,
    updatedAt: documents[1].updatedAt,
  },
];

test("renders a functional AFFiNE-like All docs library with Astryx primitives", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      documents={documents}
      query=""
      viewMode="list"
      sort="updated"
      grouping="updated"
      onQueryChange={() => undefined}
      onViewModeChange={() => undefined}
      onSortChange={() => undefined}
      onGroupingChange={() => undefined}
      onOpenDocument={() => undefined}
      onFavoriteDocument={() => undefined}
      onCreateDocument={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, /role="toolbar" aria-label="Document library controls"/);
  assert.match(html, /aria-label="Project document library"/);
  assert.match(html, /aria-label="Close document navigation"/);
  assert.match(html, /aria-label="Project documents"/);
  assert.match(html, /aria-label="Project document library navigation"/);
  assert.match(html, />All docs · 2</);
  assert.match(html, />Project docs</);
  assert.match(html, />New doc</);
  assert.match(html, /id="project-document-library-title"/);
  assert.match(html, />Docs</);
  assert.match(html, />2 documents</);
  assert.match(html, /placeholder="Search docs…"/);
  assert.match(html, />Display</);
  assert.match(html, /role="radiogroup" aria-label="Document display"/);
  assert.match(html, /data-view="list"/);
  assert.match(html, />Product brief</);
  assert.match(html, />Project notes</);
  assert.match(html, />Favorited</);
  assert.match(html, />Favorite</);
});

test("uses the no-document route as the library instead of bootstrapping an editor", () => {
  const html = renderToStaticMarkup(<ProjectDocumentWorkspace projectId={7} />);

  assert.match(html, /project-document-library-page/);
  assert.match(html, />Docs</);
  assert.doesNotMatch(html, /Opening Project Docs/);
});

test("renders persistent nested folders and workspace tags", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      documents={documents}
      folders={folders}
      tags={tags}
      initialScope={{ type: "folder", id: 8 }}
      query=""
      viewMode="list"
      sort="updated"
      grouping="updated"
      onQueryChange={() => undefined}
      onScopeChange={() => undefined}
      onViewModeChange={() => undefined}
      onSortChange={() => undefined}
      onGroupingChange={() => undefined}
      onOpenDocument={() => undefined}
      onFavoriteDocument={() => undefined}
      onCreateDocument={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, />Planning</);
  assert.match(html, />Research</);
  assert.match(html, /Planning actions/);
  assert.match(html, />Priority</);
  assert.match(html, />2 documents</);
  assert.match(html, /Manage tags/);
});

test("renders persistent collections and the daily journal workspace", () => {
  const collectionHtml = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      documents={documents}
      folders={folders}
      tags={tags}
      collections={collections}
      initialScope={{ type: "collections" }}
      query=""
      viewMode="list"
      sort="updated"
      grouping="updated"
      onQueryChange={() => undefined}
      onViewModeChange={() => undefined}
      onSortChange={() => undefined}
      onGroupingChange={() => undefined}
      onOpenDocument={() => undefined}
      onFavoriteDocument={() => undefined}
      onCreateDocument={() => undefined}
      onRetry={() => undefined}
    />,
  );
  const journalHtml = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      documents={documents}
      collections={collections}
      initialScope={{ type: "journals" }}
      query=""
      viewMode="list"
      sort="updated"
      grouping="updated"
      onQueryChange={() => undefined}
      onViewModeChange={() => undefined}
      onSortChange={() => undefined}
      onGroupingChange={() => undefined}
      onOpenDocument={() => undefined}
      onFavoriteDocument={() => undefined}
      onCreateDocument={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(collectionHtml, />Collections</);
  assert.match(collectionHtml, />Product decisions</);
  assert.match(collectionHtml, /Manual collection/);
  assert.match(journalHtml, /aria-label="Journal dates"/);
  assert.match(journalHtml, />No Journal</);
  assert.match(journalHtml, />Create Daily Journal</);
});

test("renders Favorites as a first-class filtered workspace", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      documents={documents}
      initialScope={{ type: "favorites" }}
      query=""
      viewMode="list"
      sort="updated"
      grouping="updated"
      onQueryChange={() => undefined}
      onViewModeChange={() => undefined}
      onSortChange={() => undefined}
      onGroupingChange={() => undefined}
      onOpenDocument={() => undefined}
      onFavoriteDocument={() => undefined}
      onCreateDocument={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, />Favorites · 1</);
  assert.match(html, /id="project-document-library-title"[^>]*>Favorites</);
  assert.match(html, />1 document</);
  assert.match(html, />Product brief</);
  assert.equal(
    [...html.matchAll(/class="project-document-library-item"/g)].length,
    1,
  );
});

test("renders Trash, Import, and BA/PO template workspace tools", () => {
  const trashedDocument = {
    ...documents[0],
    trashedAt: "2026-07-31T08:00:00.000Z",
  };
  const html = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      documents={documents.slice(1)}
      trash={[trashedDocument]}
      initialScope={{ type: "trash" }}
      query=""
      viewMode="list"
      sort="updated"
      grouping="updated"
      onQueryChange={() => undefined}
      onViewModeChange={() => undefined}
      onSortChange={() => undefined}
      onGroupingChange={() => undefined}
      onOpenDocument={() => undefined}
      onFavoriteDocument={() => undefined}
      onCreateDocument={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, />Trash</);
  assert.match(html, />Import</);
  assert.match(html, /Markdown or HTML/);
  assert.match(html, />Templates</);
  assert.match(html, /BA\/PO structures/);
  assert.match(html, />Restore</);
  assert.match(html, />Delete permanently</);
  assert.doesNotMatch(html, /aria-label="Document workspace views"/);
});

test("opens import and template tools from durable workspace routes", () => {
  const sharedProps = {
    documents,
    query: "",
    viewMode: "list" as const,
    sort: "updated" as const,
    grouping: "updated" as const,
    onQueryChange: () => undefined,
    onViewModeChange: () => undefined,
    onSortChange: () => undefined,
    onGroupingChange: () => undefined,
    onOpenDocument: () => undefined,
    onFavoriteDocument: () => undefined,
    onCreateDocument: () => undefined,
    onRetry: () => undefined,
  };
  const importHtml = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      {...sharedProps}
      initialManagementDialog="import"
    />,
  );
  const templatesHtml = renderToStaticMarkup(
    <ProjectDocumentLibraryView
      {...sharedProps}
      initialManagementDialog="templates"
    />,
  );

  assert.match(importHtml, /aria-label="Import document file"/);
  assert.match(importHtml, />Import document</);
  assert.match(templatesHtml, />Create from a template</);
  assert.match(templatesHtml, />Product brief</);
  assert.match(templatesHtml, />Decision record</);
  assert.match(templatesHtml, />Meeting notes</);
  assert.match(templatesHtml, />Project template</);
  assert.match(templatesHtml, /full Page and Canvas/);
});

test("opens organization creation dialogs from durable workspace routes", () => {
  const sharedProps = {
    documents,
    query: "",
    viewMode: "list" as const,
    sort: "updated" as const,
    grouping: "updated" as const,
    onQueryChange: () => undefined,
    onViewModeChange: () => undefined,
    onSortChange: () => undefined,
    onGroupingChange: () => undefined,
    onOpenDocument: () => undefined,
    onFavoriteDocument: () => undefined,
    onCreateDocument: () => undefined,
    onRetry: () => undefined,
  };

  for (const [initialManagementDialog, heading] of [
    ["new-folder", "Create folder"],
    ["new-tag", "Create tag"],
    ["new-collection", "Save as new collection"],
  ] as const) {
    const html = renderToStaticMarkup(
      <ProjectDocumentLibraryView
        {...sharedProps}
        initialManagementDialog={initialManagementDialog}
      />,
    );
    assert.match(html, new RegExp(`>${heading}<`));
  }
});

test("keeps the document library responsive and inside the Project Docs frame", () => {
  const css = readFileSync(
    new URL("./components/ProjectDocumentLibrary.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\[data-project-document-frame="true"\] \.project-document-library-page\s*\{[^}]*flex:\s*1 1 auto[^}]*height:\s*auto/s,
  );
  assert.match(
    css,
    /\.project-document-library-groups\[data-view="grid"\][^{]*\.project-document-library-list\s*\{[^}]*grid-template-columns:/s,
  );
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /@media \(max-width:\s*480px\)/);
});
