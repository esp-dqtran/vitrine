import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import * as projectDocumentWorkspace from "./components/ProjectDocumentWorkspace.tsx";

const { ProjectDocumentWorkspaceView, projectDocumentExportFilename } =
  projectDocumentWorkspace;

const workspaceDocument = {
  id: 41,
  projectId: 7,
  ownerUserId: 3,
  documentKey: "main",
  title: "Project notes",
  icon: "none" as const,
  isFavorite: false,
  pageWidth: "standard" as const,
  lastEditorMode: "page" as const,
  integrationVersion: "integration-1",
  journalDate: null,
  trashedAt: null,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

test("shows Page, Canvas, and accessible save state without generation actions", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      documents={[{ ...workspaceDocument, isFavorite: true }]}
      activeDocumentId={41}
      mode="page"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
      onOpenLibraryScope={() => undefined}
      onDuplicateDocument={() => undefined}
      onTrashDocument={() => undefined}
    />,
  );

  assert.match(html, />Page</);
  assert.match(html, />Canvas</);
  assert.match(html, /role="toolbar" aria-label="Document controls"/);
  assert.match(html, /aria-label="Project document"/);
  assert.match(html, /role="radiogroup" aria-label="Document view"/);
  assert.match(html, /role="radio" aria-checked="true"[^>]*data-value="page"/);
  assert.match(html, /role="status"[^>]*>.*Saved/s);
  assert.match(html, /aria-label="Document title"/);
  assert.match(html, />Add icon</);
  assert.match(html, />Info</);
  assert.match(html, />Comments 0</);
  assert.match(html, />Share</);
  assert.match(html, />Favorite</);
  assert.match(html, />More</);
  assert.match(html, />Open in new tab</);
  assert.match(html, />Duplicate</);
  assert.match(html, />Import</);
  assert.match(html, />Move to trash</);
  assert.match(html, /aria-label="Project documents"/);
  assert.match(html, />Project docs</);
  assert.match(html, />New doc</);
  assert.match(html, /placeholder="Search docs…"/);
  assert.match(html, />All docs · 1</);
  assert.match(html, /data-active="true"/);
  assert.match(html, /aria-label="Open table of contents"/);
  assert.match(
    html,
    /project-document-page-content[^"]*" data-page-width="standard"/,
  );
  assert.match(html, /project-document-page-editor/);
  assert.doesNotMatch(html, /generate|synthesis|migration/i);
});

test("shows active collaborative presence in the document toolbar", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      mode="page"
      status="Saved"
      presence={[
        {
          clientId: 10,
          name: "admin@localhost.test",
          color: "#2563eb",
          isLocal: true,
        },
        {
          clientId: 11,
          name: "collaborator@localhost.test",
          color: "#7c3aed",
          isLocal: false,
        },
      ]}
      onMode={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, /aria-label="2 active collaborators"/);
  assert.match(html, /title="admin@localhost.test \(you\)"/);
  assert.match(html, /title="collaborator@localhost.test"/);
  assert.match(html, />AL</);
  assert.match(html, />CL</);
});

test("exposes journals, collections, and trash from the editor sidebar", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      documents={[workspaceDocument]}
      trash={[
        {
          ...workspaceDocument,
          id: 42,
          title: "Archived brief",
          trashedAt: "2026-07-31T08:00:00.000Z",
        },
      ]}
      collections={[
        {
          id: 8,
          projectId: 7,
          ownerUserId: 3,
          name: "Launch decisions",
          isFavorite: false,
          mode: "manual",
          rules: [],
          documentIds: [41],
          createdAt: "2026-07-30T00:00:00.000Z",
          updatedAt: "2026-07-30T00:00:00.000Z",
        },
      ]}
      activeDocumentId={41}
      mode="page"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
      onOpenLibraryScope={() => undefined}
    />,
  );

  assert.match(html, />Journals</);
  assert.match(html, />Collections · 1</);
  assert.match(html, />Launch decisions</);
  assert.match(html, />1 document</);
  assert.match(html, />Trash</);
  assert.match(html, />1 deleted document</);
  assert.match(html, />Import</);
  assert.match(html, />Markdown or HTML</);
  assert.match(html, />Templates</);
  assert.match(html, />BA\/PO structures</);
  assert.match(html, />New folder</);
  assert.match(html, />New tag</);
  assert.match(html, />New collection</);
});

test("keeps Canvas full-bleed without rendering the Page shell", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      icon="idea"
      mode="edgeless"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, /project-document-canvas-editor/);
  assert.doesNotMatch(html, /aria-label="Document title"/);
  assert.doesNotMatch(html, /project-document-page-content/);
});

test("shows journal navigation inside the Page editor", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="July 31, 2026"
      journalDate="2026-07-31"
      documents={[
        {
          ...workspaceDocument,
          title: "July 31, 2026",
          journalDate: "2026-07-31",
        },
      ]}
      mode="page"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
      onJournalDateChange={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Journal dates"/);
  assert.match(html, /data-active="true"/);
  assert.match(html, /data-has-journal="true"/);
  assert.match(html, />Today</);
  assert.match(html, /aria-label="Friday, July 31, 2026"/);
});

test("renders linked documents and backlinks in the Page editor", () => {
  const linked = {
    ...workspaceDocument,
    id: 42,
    title: "Product brief",
  };
  const backlink = {
    ...workspaceDocument,
    id: 43,
    title: "Research notes",
  };
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Decision record"
      documents={[workspaceDocument, linked, backlink]}
      links={[
        {
          projectId: 7,
          ownerUserId: 3,
          sourceDocumentId: 41,
          targetDocumentId: 42,
          createdAt: "2026-07-31T00:00:00.000Z",
        },
        {
          projectId: 7,
          ownerUserId: 3,
          sourceDocumentId: 43,
          targetDocumentId: 41,
          createdAt: "2026-07-31T00:00:00.000Z",
        },
      ]}
      activeDocumentId={41}
      mode="page"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, /Bi-directional links/);
  assert.match(html, /1 linked · 1 backlinks/);
  assert.match(html, /aria-label="Document links and backlinks"/);
});

test("mount failure offers retry and a recovery snapshot", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      mode="edgeless"
      status="Save failed"
      error="Unable to mount document"
      onMode={() => undefined}
      onRetry={() => undefined}
      onDownloadRecovery={() => undefined}
    />,
  );

  assert.match(html, /Retry/);
  assert.match(html, /Download recovery snapshot/);
  assert.match(html, /role="alert"/);
});

test("renders a missing Project as one centered recovery card with useful copy", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      mode="page"
      status="Saving"
      error="Research project not found"
      onMode={() => undefined}
      onRetry={() => undefined}
    />,
  );
  const css = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.css", import.meta.url),
    "utf8",
  );

  assert.match(html, /project-document-error-card/);
  assert.match(html, /project-document-error-actions/);
  assert.match(html, /project-document-retry/);
  assert.match(html, /data-state="save-failed"/);
  assert.match(html, /Project unavailable/);
  assert.match(html, /may have been removed, or you may no longer have access/);
  assert.doesNotMatch(html, />Research project not found</);
  assert.match(
    css,
    /\.project-document-error\s*\{[^}]*display:\s*grid[^}]*place-items:\s*center/s,
  );
  assert.match(
    css,
    /\.project-document-error-actions \.project-document-retry\s*\{[^}]*background:\s*#0f172a\s*!important[^}]*color:\s*#fff\s*!important/s,
  );
});

test("installs BlockSuite core effects before the Page and Canvas editors", () => {
  const install = (
    projectDocumentWorkspace as typeof projectDocumentWorkspace & {
      installProjectDocumentEditorEffects?: (
        registry: Pick<CustomElementRegistry, "get">,
        installBlocks: () => void,
        installPresets: () => void,
      ) => void;
    }
  ).installProjectDocumentEditorEffects;
  assert.equal(typeof install, "function");

  const installed = new Set<string>();
  const order: string[] = [];
  install!(
    {
      get: (name) =>
        installed.has(name)
          ? (class {} as CustomElementConstructor)
          : undefined,
    },
    () => {
      order.push("blocks");
      installed.add("editor-host");
    },
    () => {
      assert.equal(installed.has("editor-host"), true);
      order.push("presets");
      installed.add("page-editor");
      installed.add("edgeless-editor");
    },
  );

  assert.deepEqual(order, ["blocks", "presets"]);
});

test("connects BlockSuite inline document mentions to durable Astryx links", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /RefNodeSlotsExtension\(\)/);
  assert.match(source, /ConfigExtension\("affine:page"/);
  assert.match(source, /insertLinkedNode\(\{/);
  assert.match(source, /persistInlineDocumentLink\(Number\(metadata\.id\)\)/);
  assert.match(source, /docLinkClicked\.on/);
});

test("connects inline date mentions to real Journals and backlinks", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /name:\s*"Dates"/);
  assert.match(source, /projectDocumentMentionDates\(query\)/);
  assert.match(source, /createProjectDocumentJournal\(/);
  assert.match(source, /syncProjectDocumentCollectionMetadata\(/);
  assert.match(source, /persistInlineDocumentLink\(\s*journal\.document\.id/);
});

test("connects inline user mentions without modifying BlockSuite", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /name:\s*"People"/);
  assert.match(source, /projectDocumentMentionUsers\(/);
  assert.match(source, /candidate\.label/);
  assert.match(source, /\{\s*link:\s*candidate\.link\s*\}/);
});

test("offers the native AFFiNE starter blocks from the document menu", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      mode="page"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
      onInsertSimpleTable={() => undefined}
      onInsertStarterBlocks={() => undefined}
    />,
  );
  assert.match(html, /Insert simple table/);
  assert.match(html, /Insert AFFiNE starter blocks/);
});

test("registers the forward-compatible simple table view in Page and Canvas", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const shareSource = readFileSync(
    new URL("./components/ProjectDocumentSharePage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /registerProjectDocumentTableBlock\(customElements\)/);
  assert.match(source, /ProjectDocumentTableBlockSpec/);
  assert.match(source, /EdgelessEditorBlockSpecs/);
  assert.match(shareSource, /ProjectDocumentTableBlockSpec/);
  assert.match(shareSource, /EdgelessEditorBlockSpecs/);
});

test("extends BlockSuite databases with a shared Calendar view in Page and Canvas", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const shareSource = readFileSync(
    new URL("./components/ProjectDocumentSharePage.tsx", import.meta.url),
    "utf8",
  );
  const calendarSource = readFileSync(
    new URL("./projectDocumentCalendarView.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /registerProjectDocumentDatabaseBlock\(customElements,/);
  assert.match(
    shareSource,
    /registerProjectDocumentDatabaseBlock\(customElements\)/,
  );
  assert.match(calendarSource, /viewType\("calendar"\)/);
  assert.match(
    calendarSource,
    /source\.viewMetas = \[\.\.\.source\.viewMetas, calendarViewMeta\]/,
  );
  assert.match(calendarSource, /widgetPresets\.tools\.filter/);
  assert.match(calendarSource, /widgetPresets\.tools\.sort/);
  assert.match(calendarSource, /widgetPresets\.tools\.search/);
  assert.match(calendarSource, /data-view-mode="calendar"/);
  assert.match(calendarSource, /Add record on \$\{key\}/);
  assert.match(calendarSource, /class="astryx-calendar__undated"/);
  assert.match(calendarSource, /"created-time"/);
  assert.match(calendarSource, /"attachment"/);
  assert.match(calendarSource, /"member"/);
  assert.match(calendarSource, /"created-by"/);
  assert.match(calendarSource, /source\.propertyReadonlyGet =/);
});

test("adds app-owned Callout, Table, and Calendar commands to the BlockSuite slash menu", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const shareSource = readFileSync(
    new URL("./components/ProjectDocumentSharePage.tsx", import.meta.url),
    "utf8",
  );
  const slashMenuSource = readFileSync(
    new URL("./projectDocumentSlashMenu.ts", import.meta.url),
    "utf8",
  );
  const calloutSource = readFileSync(
    new URL("./projectDocumentCalloutBlock.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /registerProjectDocumentSlashMenu\(\)/);
  assert.match(shareSource, /registerProjectDocumentSlashMenu\(\)/);
  assert.match(source, /registerProjectDocumentCalloutBlock\(customElements\)/);
  assert.match(
    shareSource,
    /registerProjectDocumentCalloutBlock\(customElements\)/,
  );
  assert.match(slashMenuSource, /name: "Callout"/);
  assert.match(calloutSource, /aria-label="Callout text"/);
  assert.match(calloutSource, /aria-label="Callout color"/);
  assert.match(slashMenuSource, /name: "Table"/);
  assert.match(slashMenuSource, /createProjectDocumentTableProps\(\)/);
  assert.match(slashMenuSource, /name: "PDF"/);
  assert.match(
    slashMenuSource,
    /accept:\s*\{\s*"application\/pdf": \["\.pdf"\]/,
  );
  assert.match(slashMenuSource, /embed: true/);
  assert.match(slashMenuSource, /style: "pdf"/);
  assert.match(slashMenuSource, /blobSync\.set\(file\)/);
  assert.match(slashMenuSource, /name: "Calendar View"/);
  assert.match(slashMenuSource, /viewManager\.viewAdd\("calendar"\)/);
  assert.match(slashMenuSource, /name: "Frame"/);
  assert.match(slashMenuSource, /model\.doc\.addBlock\(\s*"affine:frame"/);
  assert.match(
    slashMenuSource,
    /model\.doc\.addBlock\(\s*"affine:surface-ref"/,
  );
  assert.match(slashMenuSource, /refFlavour: "frame"/);
  assert.match(slashMenuSource, /name: "Mind Map"/);
  assert.match(slashMenuSource, /surface\.addElement\(\{\s*type: "mindmap"/);
  assert.match(slashMenuSource, /refFlavour: "mindmap"/);
  assert.match(slashMenuSource, /PROJECT_DOCUMENT_SLASH_MENU_MARKER/);
});

test("creates durable Astryx documents from BlockSuite's New Doc command", () => {
  const workspaceSource = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const slashMenuSource = readFileSync(
    new URL("./projectDocumentSlashMenu.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    workspaceSource,
    /configureProjectDocumentSlashMenu\(\{\s*createDocument: createPersistentDocument/,
  );
  assert.match(
    workspaceSource,
    /const created = await createProjectDocument\(projectId\)/,
  );
  assert.match(slashMenuSource, /candidate\.name === "New Doc"/);
  assert.match(slashMenuSource, /Create and link a project document/);
  assert.match(
    slashMenuSource,
    /insertContent\(rootComponent\.host, model, REFERENCE_NODE/,
  );
  assert.match(slashMenuSource, /pageId: String\(documentId\)/);
});

test("adds persisted AFFiNE-style alignment commands and block views", () => {
  const workspaceSource = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const shareSource = readFileSync(
    new URL("./components/ProjectDocumentSharePage.tsx", import.meta.url),
    "utf8",
  );
  const slashMenuSource = readFileSync(
    new URL("./projectDocumentSlashMenu.ts", import.meta.url),
    "utf8",
  );
  const alignmentSource = readFileSync(
    new URL("./projectDocumentTextAlignment.ts", import.meta.url),
    "utf8",
  );

  assert.match(slashMenuSource, /\["Align left", "left"\]/);
  assert.match(slashMenuSource, /\["Align center", "center"\]/);
  assert.match(slashMenuSource, /\["Align right", "right"\]/);
  assert.match(
    slashMenuSource,
    /model\.doc\.updateBlock\(model, \{ textAlign \}/,
  );
  assert.match(
    workspaceSource,
    /registerProjectDocumentTextAlignmentBlocks\(\s*customElements/,
  );
  assert.match(
    shareSource,
    /registerProjectDocumentTextAlignmentBlocks\(\s*customElements/,
  );
  assert.match(alignmentSource, /BlockViewIdentifier\("affine:paragraph"\)/);
  assert.match(alignmentSource, /BlockViewIdentifier\("affine:list"\)/);
  assert.match(alignmentSource, /style=\$\{`text-align:/);
});

test("adds AFFiNE-style sandboxed web embeds to Page and Canvas", () => {
  const workspaceSource = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const shareSource = readFileSync(
    new URL("./components/ProjectDocumentSharePage.tsx", import.meta.url),
    "utf8",
  );
  const slashMenuSource = readFileSync(
    new URL("./projectDocumentSlashMenu.ts", import.meta.url),
    "utf8",
  );
  const embedSource = readFileSync(
    new URL("./projectDocumentEmbedBlock.ts", import.meta.url),
    "utf8",
  );

  assert.match(slashMenuSource, /name: "Embed"/);
  assert.match(slashMenuSource, /createProjectDocumentEmbedProps\(\)/);
  assert.match(
    workspaceSource,
    /registerProjectDocumentEmbedBlock\(customElements\)/,
  );
  assert.match(
    shareSource,
    /registerProjectDocumentEmbedBlock\(customElements\)/,
  );
  assert.match(workspaceSource, /ProjectDocumentEmbedBlockSpec/);
  assert.match(shareSource, /ProjectDocumentEmbedBlockSpec/);
  assert.match(embedSource, /sandbox="allow-scripts"/);
  assert.match(embedSource, /aria-label="Embed URL"/);
  assert.match(embedSource, /aria-label="Embed caption"/);
});

test("offers AFFiNE-style document export actions alongside recovery export", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      mode="page"
      status="Saved"
      onMode={() => undefined}
      onRetry={() => undefined}
      onDownloadHtml={() => undefined}
      onDownloadPng={() => undefined}
      onDownloadMarkdown={() => undefined}
      onCopyMarkdown={() => undefined}
      onDownloadRecovery={() => undefined}
      onPrint={() => undefined}
    />,
  );

  assert.match(html, />Export to HTML</);
  assert.match(html, />Export to PNG</);
  assert.match(html, />Export to Markdown</);
  assert.match(html, />Copy as Markdown</);
  assert.match(html, />Export recovery snapshot</);
  assert.match(html, />Print</);
  assert.equal(
    projectDocumentExportFilename("  Decision Record: Q3  "),
    "decision-record-q3",
  );
  assert.equal(projectDocumentExportFilename("✨"), "project-document");
});

test("provides durable AFFiNE-style custom document property controls", () => {
  const source = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /label: "Add property"/);
  assert.match(source, /addCustomProperty\("text"\)/);
  assert.match(source, /addCustomProperty\("number"\)/);
  assert.match(source, /addCustomProperty\("checkbox"\)/);
  assert.match(source, /addCustomProperty\("date"\)/);
  assert.match(source, /onPropertiesChange\?\.\(/);
  assert.match(css, /\.project-document-custom-property/);
});

test("provides the BlockSuite theme tokens needed for visible Page and Canvas content", () => {
  const css = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.css", import.meta.url),
    "utf8",
  );
  const globalCss = readFileSync(
    new URL("./styles.css", import.meta.url),
    "utf8",
  );
  assert.match(globalCss, /@import '@toeverything\/theme\/style\.css'/);
  assert.match(
    css,
    /--affine-background-primary-color:\s*var\(--color-background-surface\)/,
  );
  assert.match(
    css,
    /--affine-text-primary-color:\s*var\(--color-text-primary\)/,
  );
  assert.match(css, /--affine-icon-color:\s*var\(--color-icon-primary\)/);
  assert.match(css, /--affine-edgeless-grid-color:\s*#d9d9d9/);
  assert.match(
    css,
    /--affine-v2-layer-background-overlayPanel:\s*var\(--color-background-popover\)/,
  );
  assert.match(
    css,
    /--affine-v2-input-border-default:\s*var\(--color-border\)/,
  );
  assert.match(
    css,
    /--affine-v2-text-placeholder:\s*var\(--color-text-disabled\)/,
  );
  assert.match(
    css,
    /\.project-document-page-editor affine-menu:has\(affine-menu-input\)\s*\{[^}]*right:\s*12px !important[^}]*left:\s*auto !important/s,
  );
  assert.match(css, /color-scheme:\s*light/);
});

test("maps BlockSuite menus, inputs, and toolbar controls to Astryx standards", () => {
  const css = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.project-document-editor\s+:is\([^}]*affine-menu[^}]*editor-icon-button[^}]*edgeless-toolbar-button[^}]*edgeless-color-picker-button[^}]*row-select-checkbox[^}]*\)\s*\{[^}]*color-scheme:\s*dark/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\) affine-menu\s*\{[^}]*border-radius:\s*var\(--radius-container\)[^}]*background:\s*var\(--color-background-popover\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\) affine-menu-button \.affine-menu-button\s*\{[^}]*min-height:\s*36px[^}]*border-radius:\s*var\(--radius-element\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+affine-menu\s+\.affine-menu-search-container\s*\{[^}]*border:\s*1px solid var\(--color-border-emphasized\)[^}]*background:\s*var\(--color-background-body\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+affine-menu-input\s+\.affine-menu-input\s*\{[^}]*border-radius:\s*var\(--radius-element\)[^}]*background:\s*var\(--color-background-body\)/s,
  );
  assert.match(
    css,
    /\.project-document-editor\s+:is\([^}]*affine-slash-menu[^}]*affine-linked-doc-popover[^}]*affine-database-select-cell-editing[^}]*affine-multi-tag-select[^}]*data-view-group-title-select-view[^}]*edgeless-auto-complete-panel[^}]*edgeless-templates-panel[^}]*edgeless-font-weight-and-style-panel[^}]*edgeless-one-row-color-panel[^}]*\)\s*\{[^}]*color-scheme:\s*dark/s,
  );
  assert.match(
    css,
    /\.project-document-editor\s+:is\([^}]*date-picker[^}]*edgeless-copilot-panel[^}]*presentation-toolbar[^}]*\)\s*,/s,
  );
  assert.match(
    css,
    /\.project-document-editor\s+:is\([^}]*affine-linked-doc-popover[^}]*affine-mobile-linked-doc-menu[^}]*reference-popup[^}]*reference-alias-popup[^}]*link-popup[^}]*date-picker[^}]*\)\s*,/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+:is\([^}]*affine-slash-menu[^}]*affine-linked-doc-popover[^}]*affine-database-select-cell-editing[^}]*affine-multi-tag-select[^}]*affine-code-toolbar[^}]*affine-pie-menu[^}]*data-view-group-title-select-view[^}]*edgeless-align-panel[^}]*edgeless-auto-complete-panel[^}]*edgeless-templates-panel[^}]*edgeless-color-picker[^}]*edgeless-shape-style-panel[^}]*edgeless-font-weight-and-style-panel[^}]*edgeless-one-row-color-panel[^}]*\)\s*\{[^}]*color-scheme:\s*dark/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+:is\([^}]*mobile-menu[^}]*mobile-menu-button[^}]*mobile-menu-input[^}]*mobile-sub-menu[^}]*date-picker[^}]*presentation-toolbar[^}]*\)\s*\{[^}]*color-scheme:\s*dark/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+:is\([^}]*affine-linked-doc-popover[^}]*\)\s*\{[^}]*--affine-v2-layer-background-primary:\s*var\(--color-background-popover\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+affine-menu-sub-menu\s+\.affine-menu-button\s*\{[^}]*min-height:\s*36px[^}]*border-radius:\s*var\(--radius-element\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+affine-menu-button\s+\.affine-menu-button\.delete-item:hover\s*\{[^}]*color:\s*var\(--color-error\)[^}]*background:\s*var\(--color-error-muted\)/s,
  );
  assert.match(
    css,
    /\.project-document-editor\s+:is\([^}]*\.database-view-button[^}]*\.affine-database-toolbar-item\.more-action[^}]*\.affine-select-cell-container[^}]*\)\s*\{[^}]*border-radius:\s*var\(--radius-full\)/s,
  );
  assert.match(
    css,
    /\.project-document-editor \.affine-database-search-container\s*\{[^}]*border:\s*1px solid var\(--color-border-emphasized\)[^}]*border-radius:\s*var\(--radius-full\)/s,
  );
  assert.match(
    css,
    /\.project-document-editor \.affine-database-search-input::placeholder\s*\{[^}]*color:\s*var\(--color-text-disabled\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\) reference-alias-popup \.alias-form-popup\s*\{[^}]*border-radius:\s*var\(--radius-container\)[^}]*background:\s*var\(--color-background-popover\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\) affine-multi-tag-select\s*\{[^}]*border-radius:\s*var\(--radius-container\)[^}]*background:\s*var\(--color-background-popover\)/s,
  );
  assert.match(
    css,
    /affine-multi-tag-select\s+\.tag-select-input-container\s*\{[^}]*min-height:\s*36px[^}]*border-radius:\s*var\(--radius-element\)/s,
  );
  assert.match(
    css,
    /affine-multi-tag-select\s+\.select-option\s*\{[^}]*min-height:\s*36px[^}]*border-radius:\s*var\(--radius-element\)/s,
  );
});

test("extends BlockSuite Canvas templates with Astryx BA/PO planning boards", () => {
  const workspaceSource = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const templateSource = readFileSync(
    new URL("./projectDocumentCanvasTemplates.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    workspaceSource,
    /import\("\.\.\/projectDocumentCanvasTemplates\.ts"\)/,
  );
  assert.match(
    workspaceSource,
    /configureProjectDocumentCanvasTemplates\(\s*blocks\.EdgelessTemplatePanel,\s*runtime\.doc/s,
  );
  assert.match(workspaceSource, /canvasTemplateConfigurationDispose\?\.\(\)/);
  assert.match(templateSource, /name: "User Story Map"/);
  assert.match(templateSource, /name: "Product Discovery Board"/);
  assert.match(templateSource, /name: "Release Plan"/);
  assert.match(
    templateSource,
    /new DocCollection\(\{ schema: doc\.collection\.schema \}\)/,
  );
  assert.match(templateSource, /new Job\(\{ collection \}\)\.docToSnapshot/);
  assert.match(templateSource, /templateDoc\.addBlock\(\s*"affine:note"/s);
  assert.match(
    templateSource,
    /panelHost\.templates\.extend\?\.\(state\.manager\)/,
  );
});

test("gives the BlockSuite Canvas toolbar Astryx theming and keyboard semantics", () => {
  const workspaceSource = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const uiSource = readFileSync(
    new URL("./projectDocumentBlockSuiteUi.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    workspaceSource,
    /import\("\.\.\/projectDocumentBlockSuiteUi\.ts"\)/,
  );
  assert.match(
    workspaceSource,
    /blockSuiteUi\.ProjectDocumentCanvasThemeExtension/,
  );
  assert.match(
    workspaceSource,
    /installProjectDocumentBlockSuiteAccessibility\(editor\)/,
  );
  assert.match(workspaceSource, /blockSuiteAccessibilityDispose\?\.\(\)/);
  assert.match(uiSource, /getAppTheme: \(\) => projectDocumentCanvasAppTheme/);
  assert.match(
    uiSource,
    /getEdgelessTheme: \(\) => projectDocumentCanvasSurfaceTheme/,
  );
  assert.match(uiSource, /signal\(ColorScheme\.Dark\)/);
  assert.match(uiSource, /signal\(ColorScheme\.Light\)/);
  assert.match(uiSource, /"edgeless-default-tool-button": "Select"/);
  assert.match(uiSource, /"edgeless-template-button": "Templates"/);
  assert.match(uiSource, /control\.setAttribute\("aria-label", label\)/);
  assert.match(uiSource, /control\.tabIndex = 0/);
  assert.match(uiSource, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(uiSource, /:host\(:focus-visible\)/);
  assert.match(uiSource, /"inner-slash-menu"/);
  assert.match(uiSource, /element\.setAttribute\("role", "listbox"\)/);
  assert.match(uiSource, /control\.setAttribute\("role", "option"\)/);
  assert.match(uiSource, /No matching blocks\. Try another command\./);
  assert.match(uiSource, /element\.matches\("editor-toolbar"\)/);
  assert.match(uiSource, /element\.setAttribute\("role", "toolbar"\)/);
  assert.match(
    uiSource,
    /element\.setAttribute\("aria-label", "Text formatting"\)/,
  );
  assert.match(uiSource, /element\.matches\("editor-menu-content"\)/);
  assert.match(uiSource, /element\.matches\("editor-menu-action"\)/);
  assert.match(uiSource, /editorDropdownControlSelector/);
  assert.match(uiSource, /blockSuitePopoverSurfaceSelector/);
  assert.match(uiSource, /enhancedSurfaceSelector/);
  assert.match(uiSource, /"link-popup"/);
  assert.match(uiSource, /"reference-popup"/);
  assert.match(uiSource, /"reference-alias-popup"/);
  assert.match(uiSource, /"affine-linked-doc-popover"/);
  assert.match(uiSource, /"affine-mobile-linked-doc-menu"/);
  assert.match(uiSource, /"date-picker"/);
  assert.match(uiSource, /"affine-multi-tag-select"/);
  assert.match(uiSource, /databaseDropdownControlSelector/);
  assert.match(uiSource, /"Filter database"/);
  assert.match(uiSource, /"Sort database"/);
  assert.match(uiSource, /"More database actions"/);
  assert.match(uiSource, /`Select value: \$\{value\}`/);
  assert.match(uiSource, /`Switch to \$\{view\}`/);
  assert.match(uiSource, /control\.matches\(databaseDropdownControlSelector\)/);
  assert.match(uiSource, /control\.setAttribute\("aria-haspopup", "menu"\)/);
  assert.match(
    uiSource,
    /control\.setAttribute\("aria-expanded", String\(expanded\)\)/,
  );
  assert.match(uiSource, /new MouseEvent\("mouseover"/);
  assert.match(uiSource, /editorMenuPanelForControl/);
  assert.match(uiSource, /openEditorMenu/);
  assert.match(uiSource, /event\.key === "ArrowDown"/);
  assert.match(uiSource, /moveEditorMenuFocus/);
  assert.match(uiSource, /"ArrowDown", "ArrowUp", "Home", "End"/);
  assert.match(uiSource, /"Text style options"/);
  assert.match(uiSource, /"Text color and background options"/);
  assert.match(uiSource, /element\.setAttribute\("aria-level", "3"\)/);
  assert.match(uiSource, /syncLinkPopupParts/);
  assert.match(uiSource, /"Link URL"/);
  assert.match(uiSource, /"Linked document options"/);
  assert.match(uiSource, /syncDatePickerParts/);
  assert.match(uiSource, /role: "grid"/);
  assert.match(uiSource, /role: "gridcell"/);
  assert.match(uiSource, /syncMultiTagSelectParts/);
  assert.match(uiSource, /role: "combobox"/);
  assert.match(uiSource, /role: "listbox"/);
  assert.match(uiSource, /role: "option"/);
  assert.match(uiSource, /"aria-activedescendant"/);
  assert.match(
    uiSource,
    /control\.matches\("editor-menu-action, affine-menu-button"\)/,
  );
  assert.match(uiSource, /control\.setAttribute\("role", "menuitem"\)/);
  assert.match(
    uiSource,
    /element\.setAttribute\("aria-label", "Editor options"\)/,
  );
  assert.match(uiSource, /:host\(\[data-show\]\)/);
  assert.match(uiSource, /:host\(:focus-visible\.delete\)/);
  assert.match(uiSource, /blockSuitePortalSelector/);
  assert.match(uiSource, /"Select or drag block"/);
  assert.match(uiSource, /"aria-roledescription", "drag handle"/);
  assert.match(uiSource, /\.affine-drag-handle-grabber/);
  assert.match(uiSource, /background-image: radial-gradient/);
  assert.match(uiSource, /emptyParagraphPlaceholderSelector/);
  assert.match(
    uiSource,
    /inlineEditor\.setAttribute\("aria-placeholder", text\)/,
  );
  assert.match(uiSource, /placeholder\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(uiSource, /width: min\(320px, calc\(100vw - 24px\)\)/);
  assert.match(uiSource, /portalObserver\.observe\(document\.body/);
  assert.match(uiSource, /portalObserver\.disconnect\(\)/);
});

test("keeps the Page editor on one continuous light document surface", () => {
  const css = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.project-document-page-scroll\s*\{[^}]*background:\s*#fff[^}]*color:\s*#111827/s,
  );
  assert.match(
    css,
    /\.project-document-page-content\s*\{[^}]*background:\s*#fff/s,
  );
  assert.match(
    css,
    /\.project-document-editor \.affine-paragraph-placeholder\.visible\s*\{[^}]*color:\s*var\(--color-text-disabled,\s*#94a3b8\)[^}]*font-size:\s*14px/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\) affine-menu\s*\{[^}]*border-radius:\s*var\(--radius-container\)[^}]*background:\s*var\(--color-background-popover\)/s,
  );
  assert.match(
    css,
    /body:has\(\.project-document-editor\)\s+affine-menu-button\s+\.affine-menu-button\.focused\s*\{[^}]*outline:\s*2px solid var\(--color-accent\)/s,
  );
  assert.match(
    css,
    /\.project-document-page-header\s*\{[^}]*--color-text-primary:\s*#111827[^}]*--color-background-surface:\s*#fff[^}]*color-scheme:\s*light/s,
  );
  assert.match(
    css,
    /\.project-document-page-title-input:focus-visible\s*\{[^}]*outline:\s*none[^}]*box-shadow:\s*inset 0 -2px 0 #1e96eb/s,
  );
});

test("uses native design-system primitives for the document toolbar", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentWorkspaceView
      title="Project notes"
      mode="page"
      status="Saving"
      onMode={() => undefined}
      onRetry={() => undefined}
    />,
  );
  const css = readFileSync(
    new URL("./components/ProjectDocumentWorkspace.css", import.meta.url),
    "utf8",
  );

  assert.match(html, /class="[^"]*project-document-identity[^"]*"/);
  assert.match(html, /class="[^"]*project-document-title[^"]*"/);
  assert.match(html, /data-state="saving"/);
  assert.match(html, /class="[^"]*astryx-toolbar[^"]*"/);
  assert.match(html, /class="[^"]*astryx-breadcrumbs[^"]*"/);
  assert.match(html, /class="[^"]*astryx-segmented-control[^"]*"/);
  assert.match(html, /class="[^"]*astryx-statusdot[^"]*"/);
  assert.doesNotMatch(css, /\.project-document-mode-switcher button/);
  assert.doesNotMatch(css, /\.project-document-save-state::before/);
  assert.match(
    css,
    /\[data-project-document-frame="true"\] \.project-document-page\s*\{[^}]*flex:\s*1 1 auto[^}]*height:\s*auto/s,
  );
  assert.match(
    css,
    /\[data-project-document-frame="true"\]\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s,
  );
  assert.match(css, /\.project-document-editor\s*\{[^}]*height:\s*100%/s);
  assert.match(
    css,
    /\.project-document-page-content\s*\{[^}]*width:\s*min\(100%,\s*816px\)[^}]*margin:\s*0 auto/s,
  );
  assert.match(
    css,
    /\.project-document-page-content\[data-page-width="full"\]\s*\{[^}]*width:\s*min\(100%,\s*1180px\)/s,
  );
  assert.match(
    css,
    /\.project-document-outline\s*\{[^}]*width:\s*280px[^}]*border-left:/s,
  );
  assert.match(
    css,
    /\.project-document-sidebar\s*\{[^}]*flex:\s*0 0 248px[^}]*border-right:/s,
  );
});
