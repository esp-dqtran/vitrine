import assert from "node:assert/strict";
import test from "node:test";

import {
  MindmapStyle,
  type SurfaceBlockModel,
  DatabaseBlockModel,
  type LatexBlockModel,
  type ListBlockModel,
  type ParagraphBlockModel,
} from "@blocksuite/blocks";

import type {
  ProjectDocumentBootstrap,
  ProjectDocumentPublic,
} from "../projectDocument.ts";
import {
  appendProjectDocumentSimpleTable,
  appendProjectDocumentStarterBlocks,
  createProjectDocumentRuntime,
  htmlProjectDocumentExport,
  initializeBlankDocument,
  markdownProjectDocumentBlocks,
  markdownProjectDocumentExport,
  projectDocumentPresenceColor,
  syncProjectDocumentCollectionMetadata,
} from "./projectDocumentRuntime.ts";
import {
  type ProjectDocumentTableBlockModel,
  projectDocumentTableValues,
  moveProjectDocumentTableId,
  orderedProjectDocumentTableRecord,
} from "./projectDocumentTable.ts";
import { createProjectDocumentCalloutProps } from "./projectDocumentCallout.ts";
import {
  createProjectDocumentEmbedProps,
  projectDocumentEmbedUrl,
} from "./projectDocumentEmbed.ts";

class Emitter {
  listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  destroyed = 0;

  on(event: string, listener: (...args: never[]) => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as (...args: unknown[]) => void);
    this.listeners.set(event, listeners);
  }

  off(event: string, listener: (...args: never[]) => void) {
    this.listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }

  destroy() {
    this.destroyed += 1;
  }
}

const bootstrap: ProjectDocumentBootstrap = {
  document: {
    id: 41,
    projectId: 7,
    ownerUserId: 3,
    documentKey: "main",
    title: "Project notes",
    icon: "none",
    isFavorite: false,
    pageWidth: "standard",
    lastEditorMode: "page",
    integrationVersion: "integration-1",
    journalDate: null,
    trashedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  created: true,
  syncBaseUrl: "/api/project-document-sync/7",
  blobBaseUrl: "/api/research-projects/7/document/41/blobs",
  syncInstanceId: "sync-instance-1",
};

function setup(quietMs = 5) {
  const indexedDb = new Emitter();
  const websocket = new Emitter();
  const runtime = createProjectDocumentRuntime(bootstrap, {
    origin: "http://astryx.test",
    quietMs,
    indexedDbFactory: () => indexedDb,
    websocketFactory: () => websocket,
  });
  return { runtime, indexedDb, websocket };
}

test("waits for both local readiness and remote sync before initializing", () => {
  const { runtime, indexedDb, websocket } = setup();

  assert.equal(runtime.doc.root, null);
  indexedDb.emit("synced");
  assert.equal(runtime.doc.root, null);
  websocket.emit("status", { status: "connected" });
  websocket.emit("sync", true);
  assert.ok(runtime.doc.root);
  assert.equal(runtime.doc.getBlocksByFlavour("affine:page").length, 1);
  assert.equal(runtime.doc.getBlocksByFlavour("affine:paragraph").length, 1);
  runtime.dispose();
});

test("keeps public share runtimes read-only and never seeds an empty doc", () => {
  const indexedDb = new Emitter();
  const websocket = new Emitter();
  const runtime = createProjectDocumentRuntime(bootstrap, {
    origin: "http://astryx.test",
    readOnly: true,
    indexedDbName: "public-share-cache",
    indexedDbFactory: (name) => {
      assert.equal(name, "public-share-cache");
      return indexedDb;
    },
    websocketFactory: () => websocket,
  });

  assert.equal(runtime.doc.readonly, true);
  indexedDb.emit("synced");
  websocket.emit("status", { status: "connected" });
  websocket.emit("sync", true);
  assert.equal(runtime.doc.root, null);
  runtime.dispose();
});

test("shares BlockSuite awareness with WebSocket presence", () => {
  const indexedDb = new Emitter();
  const websocket = new Emitter();
  let awareness: unknown;
  const runtime = createProjectDocumentRuntime(bootstrap, {
    presence: { name: "admin@localhost.test" },
    indexedDbFactory: () => indexedDb,
    websocketFactory: (_url, _room, _doc, nextAwareness) => {
      awareness = nextAwareness;
      return websocket;
    },
  });

  assert.equal(awareness, runtime.doc.awarenessStore.awareness);
  assert.deepEqual(runtime.presence(), [
    {
      clientId: runtime.doc.spaceDoc.clientID,
      name: "admin@localhost.test",
      color: projectDocumentPresenceColor("admin@localhost.test"),
      isLocal: true,
    },
  ]);
  runtime.dispose();
});

test("maps provider lifecycle and quiet local changes to save states", async (t) => {
  const { runtime, indexedDb, websocket } = setup();
  t.after(() => runtime.dispose());
  assert.equal(runtime.snapshot(), "Saving");

  indexedDb.emit("synced");
  websocket.emit("status", { status: "connected" });
  websocket.emit("sync", true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(runtime.snapshot(), "Saved");

  runtime.doc.spaceDoc.getMap("compatibility-test").set("value", "Hello");
  assert.equal(runtime.snapshot(), "Saving");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(runtime.snapshot(), "Saved");

  websocket.emit("status", { status: "disconnected" });
  assert.equal(runtime.snapshot(), "Offline");
  websocket.emit("connection-error");
  assert.equal(runtime.snapshot(), "Offline");

  websocket.emit("status", { status: "connected" });
  assert.equal(runtime.snapshot(), "Saving");
  websocket.emit("sync", true);
  assert.equal(runtime.snapshot(), "Saved");
});

test("settles local IndexedDB changes after remote sync connects", async (t) => {
  const { runtime, indexedDb, websocket } = setup();
  t.after(() => runtime.dispose());

  indexedDb.emit("synced");
  runtime.doc.spaceDoc.getMap("duplicate-test").set("copied", true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(runtime.snapshot(), "Saving");

  websocket.emit("status", { status: "connected" });
  websocket.emit("sync", true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(runtime.snapshot(), "Saved");
});

test("exports recovery state and disposes providers once", () => {
  const { runtime, indexedDb, websocket } = setup();
  indexedDb.emit("synced");
  websocket.emit("status", { status: "connected" });
  websocket.emit("sync", true);

  assert.ok(runtime.recoveryUpdate().byteLength > 0);
  runtime.dispose();
  runtime.dispose();

  assert.equal(indexedDb.destroyed, 1);
  assert.equal(websocket.destroyed, 1);
});

test("converts Markdown headings and lists into seed blocks without generation", () => {
  assert.deepEqual(
    markdownProjectDocumentBlocks(
      "# Product brief\n\nProblem statement\n\n- In scope\n1. First measure",
    ),
    [
      { type: "h1", text: "Product brief" },
      { type: "text", text: "Problem statement" },
      { type: "bulleted", text: "In scope" },
      { type: "numbered", text: "First measure" },
    ],
  );
});

test("exposes other Project documents to BlockSuite linked-document mentions", () => {
  const { runtime } = setup();
  const relatedDocument: ProjectDocumentPublic = {
    ...bootstrap.document,
    id: 52,
    documentKey: "product-brief",
    title: "Product brief",
  };

  syncProjectDocumentCollectionMetadata(runtime.doc, bootstrap.document.id, [
    bootstrap.document,
    relatedDocument,
  ]);

  assert.equal(
    runtime.doc.collection.meta.getDocMeta(runtime.doc.id)?.title,
    "Project notes",
  );
  assert.deepEqual(runtime.doc.collection.meta.getDocMeta("52"), {
    id: "52",
    title: "Product brief",
    tags: [],
    createDate: Date.parse(relatedDocument.createdAt),
    updatedDate: Date.parse(relatedDocument.updatedAt),
  });

  syncProjectDocumentCollectionMetadata(runtime.doc, bootstrap.document.id, [
    bootstrap.document,
  ]);
  assert.equal(runtime.doc.collection.meta.getDocMeta("52"), undefined);
  runtime.dispose();
});

test("appends one native AFFiNE-style data block starter set", async () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);

  assert.equal(await appendProjectDocumentStarterBlocks(runtime.doc), true);
  assert.equal(await appendProjectDocumentStarterBlocks(runtime.doc), false);

  const databases = runtime.doc
    .getBlocksByFlavour("affine:database")
    .map((block) => block.model as DatabaseBlockModel);
  assert.deepEqual(
    databases.map((database) => database.title.toString()),
    ["Project tracker", "Kanban for Todos"],
  );
  assert.deepEqual(
    databases.map((database) => database.views.map((view) => view.mode)),
    [["table"], ["kanban", "table"]],
  );
  assert.deepEqual(
    databases[1]?.children.map((row) =>
      (row as ParagraphBlockModel).text?.toString(),
    ),
    [
      "Try the Canvas",
      "Invite and collaborate",
      "Observe what Astryx can do",
      "Review the result",
    ],
  );
  const tables = runtime.doc
    .getBlocksByFlavour("affine:table")
    .map((block) => block.model as ProjectDocumentTableBlockModel);
  assert.equal(tables.length, 1);
  assert.deepEqual(projectDocumentTableValues(tables[0]!), [
    ["Column", "", "Expandable"],
    ["Row", "", "Hover here to see table actions"],
  ]);
  assert.equal(
    (
      runtime.doc.getBlocksByFlavour("affine:latex")[0]
        ?.model as LatexBlockModel
    )?.latex,
    "x^2 - 1 = 1",
  );
  assert.equal(
    runtime.doc
      .getBlocksByFlavour("affine:list")
      .some((block) => (block.model as ListBlockModel).type === "toggle"),
    true,
  );
  runtime.dispose();
});

test("can append additional simple tables without duplicating starter blocks", async () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  await appendProjectDocumentStarterBlocks(runtime.doc);

  const tableId = appendProjectDocumentSimpleTable(runtime.doc);

  assert.equal(runtime.doc.getBlock(tableId)?.model.flavour, "affine:table");
  assert.equal(runtime.doc.getBlocksByFlavour("affine:table").length, 2);
  assert.equal(await appendProjectDocumentStarterBlocks(runtime.doc), false);
  runtime.dispose();
});

test("normalizes persisted table order after row and column moves", () => {
  const moved = moveProjectDocumentTableId(
    ["first", "second", "third"],
    "third",
    0,
  );
  const record = orderedProjectDocumentTableRecord(
    {
      first: { order: "000000", value: "First" },
      second: { order: "000001", value: "Second" },
      third: { order: "000002", value: "Third" },
    },
    moved,
  );

  assert.deepEqual(moved, ["third", "first", "second"]);
  assert.equal(record.third?.order, "000000");
  assert.equal(record.first?.order, "000001");
  assert.equal(record.second?.order, "000002");
  assert.equal(record.third?.value, "Third");
  assert.deepEqual(moveProjectDocumentTableId(moved, "missing", 1), moved);
});

test("persists app-owned callouts and exports them as readable Markdown", () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  assert.ok(note);

  const calloutId = runtime.doc.addBlock(
    "affine:callout" as BlockSuite.Flavour,
    createProjectDocumentCalloutProps("Confirm the acceptance criteria"),
    note,
  );
  const markdown = markdownProjectDocumentExport(runtime.doc, "Product brief");

  assert.equal(
    runtime.doc.getBlock(calloutId)?.model.flavour,
    "affine:callout",
  );
  assert.match(markdown, /> 💡 Confirm the acceptance criteria/);
  runtime.dispose();
});

test("persists AFFiNE-style text alignment on paragraphs and lists", () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  const paragraph =
    runtime.doc.getBlocksByFlavour("affine:paragraph")[0]?.model;
  assert.ok(note);
  assert.ok(paragraph);

  const listId = runtime.doc.addBlock(
    "affine:list",
    { type: "bulleted" },
    note,
  );
  const list = runtime.doc.getBlock(listId)?.model;
  assert.ok(list);

  runtime.doc.updateBlock(paragraph, { textAlign: "center" } as never);
  runtime.doc.updateBlock(list, { textAlign: "right" } as never);

  assert.equal(
    (paragraph as typeof paragraph & { textAlign?: string }).textAlign,
    "center",
  );
  assert.equal(paragraph.yBlock.get("prop:textAlign"), "center");
  assert.equal(
    (list as typeof list & { textAlign?: string }).textAlign,
    "right",
  );
  assert.equal(list.yBlock.get("prop:textAlign"), "right");
  runtime.dispose();
});

test("persists sandboxed HTTPS embeds and exports their source links", () => {
  assert.equal(projectDocumentEmbedUrl("http://example.com"), undefined);
  assert.equal(
    projectDocumentEmbedUrl("https://app.affine.pro/workspace/demo"),
    undefined,
  );
  assert.equal(
    projectDocumentEmbedUrl("https://example.com/brief")?.hostname,
    "example.com",
  );

  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  assert.ok(note);

  const embedId = runtime.doc.addBlock(
    "affine:embed-iframe",
    {
      ...createProjectDocumentEmbedProps("https://example.com/brief"),
      title: "External brief",
      caption: "Supporting research",
    },
    note,
  );
  const embed = runtime.doc.getBlock(embedId)?.model;
  assert.ok(embed);
  assert.equal(embed.yBlock.get("prop:url"), "https://example.com/brief");

  const markdown = markdownProjectDocumentExport(runtime.doc, "Product brief");
  assert.match(
    markdown,
    /\[Supporting research\]\(https:\/\/example\.com\/brief\)/,
  );
  runtime.dispose();
});

test("supports native BlockSuite PDF attachment embeds", () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  assert.ok(note);

  const attachmentId = runtime.doc.addBlock(
    "affine:attachment",
    {
      name: "requirements.pdf",
      size: 2048,
      type: "application/pdf",
      sourceId: "pdf-blob",
      embed: true,
      style: "pdf",
    },
    note,
  );
  const attachment = runtime.doc.getBlock(attachmentId)?.model as
    | (NonNullable<ReturnType<typeof runtime.doc.getBlock>>["model"] & {
        type?: string;
        embed?: boolean;
        style?: string;
      })
    | undefined;

  assert.equal(attachment?.type, "application/pdf");
  assert.equal(attachment?.embed, true);
  assert.equal(attachment?.style, "pdf");
  runtime.dispose();
});

test("supports native Canvas frames referenced from the Page", () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  const surface = runtime.doc.getBlocksByFlavour("affine:surface")[0]?.model;
  assert.ok(note);
  assert.ok(surface);

  const frameId = runtime.doc.addBlock(
    "affine:frame",
    { xywh: "[0,0,1600,900]" },
    surface,
  );
  const surfaceRefId = runtime.doc.addBlock(
    "affine:surface-ref",
    { reference: frameId, refFlavour: "frame" },
    note,
  );
  const surfaceRef = runtime.doc.getBlock(surfaceRefId)?.model as
    | (NonNullable<ReturnType<typeof runtime.doc.getBlock>>["model"] & {
        reference?: string;
        refFlavour?: string;
      })
    | undefined;

  assert.equal(surfaceRef?.reference, frameId);
  assert.equal(surfaceRef?.refFlavour, "frame");
  runtime.dispose();
});

test("supports one native Mind Map shared between Page and Canvas", () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  const surface = runtime.doc.getBlocksByFlavour("affine:surface")[0]?.model as
    | SurfaceBlockModel
    | undefined;
  assert.ok(note);
  assert.ok(surface);

  const mindMapId = surface.addElement({
    type: "mindmap",
    style: MindmapStyle.ONE,
    children: {
      text: "Mind Map",
      children: [
        { text: "Discovery", children: [] },
        { text: "Delivery", children: [] },
      ],
    },
  });
  const surfaceRefId = runtime.doc.addBlock(
    "affine:surface-ref",
    { reference: mindMapId, refFlavour: "mindmap" },
    note,
  );
  const surfaceRef = runtime.doc.getBlock(surfaceRefId)?.model as
    | (NonNullable<ReturnType<typeof runtime.doc.getBlock>>["model"] & {
        reference?: string;
        refFlavour?: string;
      })
    | undefined;

  assert.equal(surface.getElementById(mindMapId)?.type, "mindmap");
  assert.equal(surfaceRef?.reference, mindMapId);
  assert.equal(surfaceRef?.refFlavour, "mindmap");
  runtime.dispose();
});

test("exports Page content and native data blocks as readable Markdown", async () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  await appendProjectDocumentStarterBlocks(runtime.doc);

  const markdown = markdownProjectDocumentExport(
    runtime.doc,
    "Decision record",
  );

  assert.match(markdown, /^# Decision record/m);
  assert.match(markdown, /^# Data-intensive blocks/m);
  assert.match(markdown, /^\| Column \|  \| Expandable \|/m);
  assert.match(markdown, /^\| --- \| --- \| --- \|/m);
  assert.match(markdown, /^\| Row \|  \| Hover here to see table actions \|/m);
  assert.match(markdown, /^### Project tracker/m);
  assert.match(markdown, /- Define the problem/);
  assert.match(markdown, /^### Kanban for Todos/m);
  assert.match(markdown, /- Invite and collaborate/);
  assert.match(markdown, /\$\$\nx\^2 - 1 = 1\n\$\$/);
  assert.match(markdown, /- Expand implementation details/);
  runtime.dispose();
});

test("exports a safe standalone HTML document with rich Page blocks", async () => {
  const { runtime } = setup();
  initializeBlankDocument(runtime.doc);
  await appendProjectDocumentStarterBlocks(runtime.doc);
  const note = runtime.doc.getBlocksByFlavour("affine:note")[0]?.model;
  assert.ok(note);
  runtime.doc.addBlock(
    "affine:callout" as BlockSuite.Flavour,
    createProjectDocumentCalloutProps("Ship <safely> & verify"),
    note,
  );
  runtime.doc.addBlock(
    "affine:embed-iframe",
    {
      ...createProjectDocumentEmbedProps("https://example.com/brief?x=1&y=2"),
      caption: "External <brief>",
    },
    note,
  );

  const html = htmlProjectDocumentExport(
    runtime.doc,
    'Decision record <Q3> & "launch"',
  );

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(
    html,
    /<title>Decision record &lt;Q3&gt; &amp; &quot;launch&quot;<\/title>/,
  );
  assert.match(html, /<h1>Data-intensive blocks<\/h1>/);
  assert.match(html, /<table><thead><tr><th>Column<\/th>/);
  assert.match(html, /<section class="project-document-database">/);
  assert.match(html, /Ship &lt;safely&gt; &amp; verify/);
  assert.match(
    html,
    /href="https:\/\/example\.com\/brief\?x=1&amp;y=2"/,
  );
  assert.match(html, />External &lt;brief&gt;<\/a>/);
  assert.doesNotMatch(html, /<script/i);
  runtime.dispose();
});
