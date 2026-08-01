import type {
  DatabaseBlockModel,
  LatexBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
} from "@blocksuite/blocks";
import { AffineSchemas } from "@blocksuite/blocks/schemas";
import {
  DocCollection,
  Schema,
  Text,
  type BlockModel,
  type Doc,
} from "@blocksuite/store";
import { IndexedDBBlobSource, type BlobSource } from "@blocksuite/sync";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { BLOCKSUITE_DOC_ID } from "../projectDocumentCompatibility.ts";
import type {
  ProjectDocumentBootstrap,
  ProjectDocumentPublic,
} from "../projectDocument.ts";
import {
  projectDocumentSaveState,
  type ProjectDocumentSaveState,
  type ProjectDocumentSyncState,
} from "./projectDocumentStatus.ts";
import {
  ProjectDocumentTableBlockSchema,
  type ProjectDocumentTableBlockModel,
  createProjectDocumentTableProps,
  projectDocumentTableValues,
} from "./projectDocumentTable.ts";
import {
  ProjectDocumentCalloutBlockSchema,
  type ProjectDocumentCalloutBlockModel,
} from "./projectDocumentCallout.ts";
import {
  ProjectDocumentEmbedBlockSchema,
  type ProjectDocumentEmbedBlockModel,
} from "./projectDocumentEmbed.ts";
import { ProjectDocumentHttpBlobSource } from "./projectDocumentBlobSource.ts";

type IndexedDbPort = {
  on(event: "synced", listener: () => void): void;
  off?(event: "synced", listener: () => void): void;
  destroy(): void | Promise<void>;
};

type WebsocketPort = {
  on(event: string, listener: (...args: never[]) => void): void;
  off?(event: string, listener: (...args: never[]) => void): void;
  destroy(): void;
};

export interface ProjectDocumentPresence {
  clientId: number;
  name: string;
  color: string;
  isLocal: boolean;
}

export interface ProjectDocumentRuntime {
  doc: Doc;
  subscribe(listener: () => void): () => void;
  snapshot(): ProjectDocumentSaveState;
  presence(): ProjectDocumentPresence[];
  recoveryUpdate(): Uint8Array;
  dispose(): void;
}

export type ProjectDocumentRuntimeOptions = {
  origin?: string;
  quietMs?: number;
  indexedDbName?: string;
  initialUpdate?: Uint8Array;
  readOnly?: boolean;
  indexedDbFactory?: (name: string, doc: Y.Doc) => IndexedDbPort;
  websocketFactory?: (
    url: string,
    room: string,
    doc: Y.Doc,
    awareness: Doc["awarenessStore"]["awareness"],
  ) => WebsocketPort;
  presence?: {
    name: string;
    color?: string;
  };
  blobSourcesFactory?: (input: {
    blobBaseUrl: string;
    indexedDbName: string;
    readOnly: boolean;
  }) => {
    main: BlobSource;
    shadows?: BlobSource[];
  };
};

export type ProjectDocumentSeedBlock = {
  type: "text" | "h1" | "h2" | "h3" | "bulleted" | "numbered" | "quote";
  text: string;
};

const projectDocumentPresencePalette = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0891b2",
] as const;

export function projectDocumentPresenceColor(identity: string): string {
  let hash = 0;
  for (const character of identity) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return projectDocumentPresencePalette[
    Math.abs(hash) % projectDocumentPresencePalette.length
  ]!;
}

export function initializeBlankDocument(doc: Doc): void {
  if (doc.root) return;
  const pageId = doc.addBlock("affine:page", {});
  doc.addBlock("affine:surface", {}, pageId);
  const noteId = doc.addBlock("affine:note", {}, pageId);
  doc.addBlock("affine:paragraph", {}, noteId);
}

export function replaceProjectDocumentBlocks(
  doc: Doc,
  blocks: readonly ProjectDocumentSeedBlock[],
): void {
  initializeBlankDocument(doc);
  const note = doc.getBlocksByFlavour("affine:note")[0]?.model;
  if (!note) throw new Error("Project document note is unavailable");
  for (const child of [...note.children]) doc.deleteBlock(child);
  const source =
    blocks.length > 0 ? blocks : [{ type: "text", text: "" } as const];
  for (const block of source) {
    if (block.type === "bulleted" || block.type === "numbered") {
      doc.addBlock(
        "affine:list",
        { type: block.type, text: new Text(block.text) },
        note,
      );
      continue;
    }
    doc.addBlock(
      "affine:paragraph",
      { type: block.type, text: new Text(block.text) },
      note,
    );
  }
}

const STARTER_DATABASE_TITLES = [
  "Project tracker",
  "Kanban for Todos",
] as const;

function hasProjectDocumentStarterDatabases(doc: Doc): boolean {
  const titles = new Set<string>(STARTER_DATABASE_TITLES);
  return doc
    .getBlocksByFlavour("affine:database")
    .some((block) =>
      titles.has((block.model as DatabaseBlockModel).title.toString()),
    );
}

export function hasProjectDocumentStarterBlocks(doc: Doc): boolean {
  return (
    hasProjectDocumentStarterDatabases(doc) &&
    doc.getBlocksByFlavour("affine:table").length > 0
  );
}

function addProjectDocumentSimpleTable(
  doc: Doc,
  parent: BlockModel,
  parentIndex?: number,
): string {
  return doc.addBlock(
    "affine:table",
    createProjectDocumentTableProps(),
    parent,
    parentIndex,
  );
}

export function appendProjectDocumentSimpleTable(doc: Doc): string {
  initializeBlankDocument(doc);
  const note = doc.getBlocksByFlavour("affine:note")[0]?.model;
  if (!note) throw new Error("Project document note is unavailable");
  doc.captureSync();
  return addProjectDocumentSimpleTable(doc, note);
}

export async function appendProjectDocumentStarterBlocks(
  doc: Doc,
): Promise<boolean> {
  initializeBlankDocument(doc);
  if (hasProjectDocumentStarterBlocks(doc)) return false;

  const note = doc.getBlocksByFlavour("affine:note")[0]?.model;
  if (!note) throw new Error("Project document note is unavailable");

  const { databaseViewAddView, databaseViewInitTemplate } =
    await import("@blocksuite/blocks");
  const hasStarterDatabases = hasProjectDocumentStarterDatabases(doc);
  const hasSimpleTable = doc.getBlocksByFlavour("affine:table").length > 0;
  doc.captureSync();

  const addParagraph = (
    type: "text" | "h1" | "h2" | "h3" | "quote",
    text: string,
    parent = note,
  ) => doc.addBlock("affine:paragraph", { type, text: new Text(text) }, parent);

  const addDatabase = (
    title: string,
    viewType: "table" | "kanban",
    rowTitles: readonly string[],
  ) => {
    const databaseId = doc.addBlock(
      "affine:database",
      { title: new Text(title) },
      note,
    );
    const database = doc.getBlock(databaseId)?.model as
      | DatabaseBlockModel
      | undefined;
    if (!database) throw new Error("Project database block is unavailable");

    databaseViewInitTemplate(database, viewType);
    database.children.forEach((row, index) => {
      const rowTitle = rowTitles[index];
      if (rowTitle) doc.updateBlock(row, { text: new Text(rowTitle) });
    });
    if (viewType === "kanban") databaseViewAddView(database, "table");
    return databaseId;
  };

  if (!hasStarterDatabases) {
    addParagraph("h1", "Data-intensive blocks");
    addParagraph("h2", "Table");
    addParagraph(
      "text",
      "Create a lightweight table for requirements and comparisons.",
    );
    if (!hasSimpleTable) addProjectDocumentSimpleTable(doc, note);
    addDatabase("Project tracker", "table", [
      "Define the problem",
      "Confirm acceptance criteria",
      "Review with engineering",
      "Ship the feature",
    ]);

    addParagraph("h2", "Kanban for Todos");
    addDatabase("Kanban for Todos", "kanban", [
      "Try the Canvas",
      "Invite and collaborate",
      "Observe what Astryx can do",
      "Review the result",
    ]);

    addParagraph("h1", "Examples for advanced blocks");
    addParagraph("text", "Use LaTeX for equations and technical requirements.");
    doc.addBlock("affine:latex", { latex: "x^2 - 1 = 1" }, note);

    addParagraph("h1", "Continue with the rabbit hole");
    const toggleId = doc.addBlock(
      "affine:list",
      {
        type: "toggle",
        text: new Text("Expand implementation details"),
        collapsed: false,
      },
      note,
    );
    addParagraph(
      "text",
      "Add nested decisions, risks, and follow-up actions here.",
      doc.getBlock(toggleId)?.model ?? note,
    );
    addParagraph("text", "");
  } else if (!hasSimpleTable) {
    const projectTrackerIndex = note.children.findIndex(
      (child) =>
        child.flavour === "affine:database" &&
        (child as DatabaseBlockModel).title.toString() ===
          STARTER_DATABASE_TITLES[0],
    );
    addProjectDocumentSimpleTable(
      doc,
      note,
      projectTrackerIndex >= 0 ? projectTrackerIndex : undefined,
    );
  }
  return true;
}

export function markdownProjectDocumentExport(doc: Doc, title: string): string {
  const note = doc.getBlocksByFlavour("affine:note")[0]?.model;
  const lines = [`# ${title.trim() || "Untitled"}`, ""];
  if (!note) return lines.join("\n");

  const renderChildren = (
    children: typeof note.children,
    depth = 0,
  ): string[] =>
    children.flatMap((child) => {
      const indent = "  ".repeat(depth);
      if (child.flavour === "affine:paragraph") {
        const paragraph = child as ParagraphBlockModel;
        const text = paragraph.text?.toString() ?? "";
        const prefix =
          paragraph.type === "h1"
            ? "# "
            : paragraph.type === "h2"
              ? "## "
              : paragraph.type === "h3"
                ? "### "
                : paragraph.type === "quote"
                  ? "> "
                  : "";
        return [
          `${indent}${prefix}${text}`,
          ...renderChildren(child.children, depth + 1),
          "",
        ];
      }
      if (child.flavour === "affine:list") {
        const list = child as ListBlockModel;
        const marker = list.type === "numbered" ? "1." : "-";
        return [
          `${indent}${marker} ${list.text?.toString() ?? ""}`,
          ...renderChildren(child.children, depth + 1),
        ];
      }
      if (child.flavour === "affine:latex") {
        const latex = child as LatexBlockModel;
        return [`${indent}$$`, `${indent}${latex.latex}`, `${indent}$$`, ""];
      }
      if (child.flavour === "affine:database") {
        const database = child as DatabaseBlockModel;
        return [
          `${indent}### ${database.title.toString() || "Database"}`,
          "",
          ...database.children.flatMap((row) => [
            `${indent}- ${
              (row as ParagraphBlockModel).text?.toString() || "Untitled"
            }`,
          ]),
          "",
        ];
      }
      if (child.flavour === "affine:table") {
        const table = projectDocumentTableValues(
          child as ProjectDocumentTableBlockModel,
        );
        const width = Math.max(1, ...table.map((row) => row.length));
        const normalize = (value: string) =>
          value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
        const header = Array.from({ length: width }, (_, index) =>
          normalize(table[0]?.[index] ?? ""),
        );
        const rows = table
          .slice(1)
          .map((row) =>
            Array.from({ length: width }, (_, index) =>
              normalize(row[index] ?? ""),
            ),
          );
        return [
          `${indent}| ${header.join(" | ")} |`,
          `${indent}| ${header.map(() => "---").join(" | ")} |`,
          ...rows.map((row) => `${indent}| ${row.join(" | ")} |`),
          "",
        ];
      }
      if (child.flavour === "affine:callout") {
        const callout = child as ProjectDocumentCalloutBlockModel;
        return [
          `${indent}> ${callout.icon ?? "💡"} ${callout.text?.toString() ?? ""}`,
          "",
        ];
      }
      if (child.flavour === "affine:embed-iframe") {
        const embed = child as ProjectDocumentEmbedBlockModel;
        const label = embed.caption || embed.title || embed.url;
        return embed.url
          ? [`${indent}[${label || "Embedded page"}](${embed.url})`, ""]
          : [];
      }
      return renderChildren(child.children, depth);
    });

  return [...lines, ...renderChildren(note.children)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}

function escapeProjectDocumentHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlProjectDocumentExport(doc: Doc, title: string): string {
  const normalizedTitle = title.trim() || "Untitled";
  const note = doc.getBlocksByFlavour("affine:note")[0]?.model;

  const renderChildren = (
    children: readonly BlockModel[],
    depth = 0,
  ): string =>
    children
      .map((child) => {
        if (child.flavour === "affine:paragraph") {
          const paragraph = child as ParagraphBlockModel;
          const text = escapeProjectDocumentHtml(
            paragraph.text?.toString() ?? "",
          );
          const tag =
            paragraph.type === "h1" ||
            paragraph.type === "h2" ||
            paragraph.type === "h3"
              ? paragraph.type
              : paragraph.type === "quote"
                ? "blockquote"
                : "p";
          return `<${tag}>${text}</${tag}>${renderChildren(child.children, depth + 1)}`;
        }
        if (child.flavour === "affine:list") {
          const list = child as ListBlockModel;
          const text = escapeProjectDocumentHtml(list.text?.toString() ?? "");
          const nested = renderChildren(child.children, depth + 1);
          if (list.type === "toggle") {
            return `<details open><summary>${text}</summary>${nested}</details>`;
          }
          const listTag = list.type === "numbered" ? "ol" : "ul";
          return `<${listTag}><li>${text}${nested}</li></${listTag}>`;
        }
        if (child.flavour === "affine:latex") {
          const latex = child as LatexBlockModel;
          return `<pre class="project-document-latex"><code>${escapeProjectDocumentHtml(latex.latex)}</code></pre>`;
        }
        if (child.flavour === "affine:database") {
          const database = child as DatabaseBlockModel;
          const rows = database.children
            .map(
              (row) =>
                `<li>${escapeProjectDocumentHtml(
                  (row as ParagraphBlockModel).text?.toString() || "Untitled",
                )}</li>`,
            )
            .join("");
          return `<section class="project-document-database"><h3>${escapeProjectDocumentHtml(
            database.title.toString() || "Database",
          )}</h3><ul>${rows}</ul></section>`;
        }
        if (child.flavour === "affine:table") {
          const table = projectDocumentTableValues(
            child as ProjectDocumentTableBlockModel,
          );
          const width = Math.max(1, ...table.map((row) => row.length));
          const cells = (row: readonly string[], tag: "th" | "td") =>
            Array.from({ length: width }, (_, index) => {
              const value = escapeProjectDocumentHtml(row[index] ?? "").replace(
                /\n/g,
                "<br>",
              );
              return `<${tag}>${value}</${tag}>`;
            }).join("");
          const header = cells(table[0] ?? [], "th");
          const body = table
            .slice(1)
            .map((row) => `<tr>${cells(row, "td")}</tr>`)
            .join("");
          return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
        }
        if (child.flavour === "affine:callout") {
          const callout = child as ProjectDocumentCalloutBlockModel;
          return `<aside class="project-document-callout"><span aria-hidden="true">${escapeProjectDocumentHtml(
            callout.icon ?? "💡",
          )}</span><p>${escapeProjectDocumentHtml(
            callout.text?.toString() ?? "",
          )}</p></aside>`;
        }
        if (child.flavour === "affine:embed-iframe") {
          const embed = child as ProjectDocumentEmbedBlockModel;
          if (!embed.url) return "";
          const label =
            embed.caption || embed.title || embed.url || "Embedded page";
          return `<p class="project-document-embed"><a href="${escapeProjectDocumentHtml(
            embed.url,
          )}">${escapeProjectDocumentHtml(label)}</a></p>`;
        }
        if (child.flavour === "affine:attachment") {
          const attachment = child as BlockModel & { name?: string };
          return `<p class="project-document-attachment">${escapeProjectDocumentHtml(
            attachment.name || "Attachment",
          )}</p>`;
        }
        return renderChildren(child.children, depth);
      })
      .join("");

  const body = note ? renderChildren(note.children) : "";
  const escapedTitle = escapeProjectDocumentHtml(normalizedTitle);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #fff; }
    body { max-width: 816px; margin: 0 auto; padding: 64px 28px 120px; font-size: 16px; line-height: 1.65; }
    h1 { margin: 1.3em 0 .4em; font-size: 2em; line-height: 1.2; }
    h1:first-child { margin-top: 0; font-size: 2.6em; }
    h2 { margin: 1.4em 0 .45em; font-size: 1.5em; line-height: 1.3; }
    h3 { margin: 1.3em 0 .4em; font-size: 1.2em; line-height: 1.35; }
    p, ul, ol, blockquote, pre, table, details { margin: .75em 0; }
    blockquote { padding-left: 1em; border-left: 3px solid #cbd5e1; color: #475569; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; border: 1px solid #dbe3ed; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 650; }
    pre { overflow-x: auto; padding: 14px 16px; border-radius: 10px; background: #f1f5f9; }
    .project-document-callout { display: flex; gap: 10px; margin: 1em 0; padding: 14px 16px; border: 1px solid #dbeafe; border-radius: 12px; background: #eff6ff; }
    .project-document-callout p { margin: 0; }
    a { color: #1769aa; }
    @media print { body { max-width: none; padding: 0; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapedTitle}</h1>
    ${body}
  </main>
</body>
</html>
`;
}

export function markdownProjectDocumentBlocks(
  source: string,
): ProjectDocumentSeedBlock[] {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line): ProjectDocumentSeedBlock[] => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        return [
          {
            type: `h${heading[1]?.length}` as "h1" | "h2" | "h3",
            text: heading[2] ?? "",
          },
        ];
      }
      const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
      if (bullet) return [{ type: "bulleted", text: bullet[1] ?? "" }];
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (numbered) return [{ type: "numbered", text: numbered[1] ?? "" }];
      const quote = line.match(/^\s*>\s?(.+)$/);
      if (quote) return [{ type: "quote", text: quote[1] ?? "" }];
      return line.trim() ? [{ type: "text", text: line.trim() }] : [];
    });
}

export function htmlProjectDocumentBlocks(
  source: string,
): ProjectDocumentSeedBlock[] {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const blocks: ProjectDocumentSeedBlock[] = [];
  for (const element of parsed.body.querySelectorAll(
    "h1,h2,h3,p,li,blockquote",
  )) {
    const text = element.textContent?.trim();
    if (!text) continue;
    blocks.push({
      type:
        element.tagName === "H1"
          ? "h1"
          : element.tagName === "H2"
            ? "h2"
            : element.tagName === "H3"
              ? "h3"
              : element.tagName === "LI"
                ? "bulleted"
                : element.tagName === "BLOCKQUOTE"
                  ? "quote"
                  : "text",
      text,
    });
  }
  return blocks;
}

function waitForRuntime(
  runtime: ProjectDocumentRuntime,
  predicate: () => boolean,
  timeoutMs = 12_000,
): Promise<void> {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Project document sync timed out"));
    }, timeoutMs);
    const unsubscribe = runtime.subscribe(() => {
      if (!predicate()) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

export async function seedProjectDocument(
  bootstrap: ProjectDocumentBootstrap,
  blocks: readonly ProjectDocumentSeedBlock[],
  options: ProjectDocumentRuntimeOptions = {},
): Promise<void> {
  const runtime = createProjectDocumentRuntime(bootstrap, options);
  try {
    await waitForRuntime(
      runtime,
      () => runtime.snapshot() === "Saved" && Boolean(runtime.doc.root),
    );
    replaceProjectDocumentBlocks(runtime.doc, blocks);
    await waitForRuntime(runtime, () => runtime.snapshot() === "Saved");
  } finally {
    runtime.dispose();
  }
}

function emptyBlockSuiteDoc(blobSources: {
  main: BlobSource;
  shadows?: BlobSource[];
}): Doc {
  const projectDocumentSchemas = AffineSchemas.map((blockSchema) => {
    if (blockSchema.model.flavour === "affine:note") {
      return {
        ...blockSchema,
        model: {
          ...blockSchema.model,
          children: [
            ...(blockSchema.model.children ?? []),
            "affine:table",
            "affine:callout" as BlockSuite.Flavour,
            "affine:embed-iframe" as BlockSuite.Flavour,
          ],
        },
      } as typeof blockSchema;
    }
    if (
      blockSchema.model.flavour === "affine:paragraph" ||
      blockSchema.model.flavour === "affine:list"
    ) {
      const baseProps = blockSchema.model.props;
      return {
        ...blockSchema,
        model: {
          ...blockSchema.model,
          props: (internal: Parameters<NonNullable<typeof baseProps>>[0]) => ({
            ...(baseProps?.(internal) ?? {}),
            textAlign: undefined,
          }),
        },
      } as typeof blockSchema;
    }
    return blockSchema;
  });
  const schema = new Schema().register([
    ...projectDocumentSchemas,
    ProjectDocumentTableBlockSchema,
    ProjectDocumentCalloutBlockSchema,
    ProjectDocumentEmbedBlockSchema,
  ]);
  const collection = new DocCollection({ schema, blobSources });
  collection.meta.initialize();
  const doc = collection.createDoc({ id: BLOCKSUITE_DOC_ID });
  doc.load();
  return doc;
}

export function syncProjectDocumentCollectionMetadata(
  doc: Doc,
  activeDocumentId: number,
  documents: readonly ProjectDocumentPublic[],
): void {
  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId,
  );
  if (activeDocument) {
    doc.collection.setDocMeta(doc.id, {
      title: activeDocument.title,
      updatedDate: new Date(activeDocument.updatedAt).getTime(),
    });
  }

  const relatedDocuments = documents.filter(
    (document) =>
      document.id !== activeDocumentId && document.trashedAt === null,
  );
  const relatedIds = new Set(
    relatedDocuments.map((document) => String(document.id)),
  );

  for (const metadata of doc.collection.meta.docMetas) {
    if (metadata.id !== doc.id && !relatedIds.has(metadata.id)) {
      doc.collection.meta.removeDocMeta(metadata.id);
    }
  }

  for (const document of relatedDocuments) {
    const id = String(document.id);
    const metadata = {
      title: document.title,
      createDate: new Date(document.createdAt).getTime(),
      updatedDate: new Date(document.updatedAt).getTime(),
      tags: [],
    };
    if (doc.collection.meta.getDocMeta(id)) {
      doc.collection.setDocMeta(id, metadata);
    } else {
      doc.collection.meta.addDocMeta({ id, ...metadata });
    }
  }
}

export function createProjectDocumentRuntime(
  bootstrap: ProjectDocumentBootstrap,
  options: ProjectDocumentRuntimeOptions = {},
): ProjectDocumentRuntime {
  const indexedDbName =
    options.indexedDbName ??
    `astryx-project-document-${bootstrap.document.id}-${bootstrap.syncInstanceId}`;
  const blobSources = (
    options.blobSourcesFactory ??
    ((input) => ({
      main: new ProjectDocumentHttpBlobSource(input.blobBaseUrl, {
        readOnly: input.readOnly,
      }),
      shadows: [new IndexedDBBlobSource(`${input.indexedDbName}-blobs`)],
    }))
  )({
    blobBaseUrl: bootstrap.blobBaseUrl,
    indexedDbName,
    readOnly: options.readOnly ?? false,
  });
  const doc = emptyBlockSuiteDoc(blobSources);
  if (options.initialUpdate?.byteLength) {
    Y.applyUpdate(doc.spaceDoc, options.initialUpdate, "version-restore");
  }
  if (options.presence?.name.trim()) {
    const name = options.presence.name.trim().slice(0, 120);
    doc.awarenessStore.awareness.setLocalStateField("user", { name });
    doc.awarenessStore.awareness.setLocalStateField(
      "color",
      options.presence.color ?? projectDocumentPresenceColor(name),
    );
  }
  if (options.readOnly) {
    doc.awarenessStore.setReadonly(doc.blockCollection, true);
  }
  const origin =
    options.origin ??
    (typeof window === "undefined"
      ? "http://127.0.0.1"
      : window.location.origin);
  const indexedDb = (
    options.indexedDbFactory ??
    ((name, spaceDoc) => new IndexeddbPersistence(name, spaceDoc))
  )(indexedDbName, doc.spaceDoc);
  const websocket = (
    options.websocketFactory ??
    ((url, room, spaceDoc, awareness) =>
      new WebsocketProvider(url, room, spaceDoc, {
        protocols: ["AFFiNE"],
        awareness,
      }))
  )(
    `${origin.replace(/^http/, "ws")}${bootstrap.syncBaseUrl}`,
    String(bootstrap.document.id),
    doc.spaceDoc,
    doc.awarenessStore.awareness,
  );
  const listeners = new Set<() => void>();
  const quietMs = options.quietMs ?? 500;
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let initialized = false;
  let state: ProjectDocumentSyncState = {
    indexedDbReady: false,
    connected: false,
    synced: false,
    dirty: false,
    disconnected: false,
    failed: false,
  };

  const emit = () => listeners.forEach((listener) => listener());
  const patch = (next: Partial<ProjectDocumentSyncState>) => {
    state = { ...state, ...next };
    emit();
  };
  const settleDirtyState = () => {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      if (state.connected && state.synced) patch({ dirty: false });
    }, quietMs);
  };
  const initializeIfSafe = () => {
    if (initialized || !state.indexedDbReady || !state.synced || doc.root) {
      return;
    }
    initialized = true;
    if (!options.readOnly) initializeBlankDocument(doc);
  };
  const onIndexedDbSynced = () => {
    patch({ indexedDbReady: true });
    initializeIfSafe();
  };
  const onStatus = (event: { status: string }) => {
    if (event.status === "connected") {
      patch({ connected: true, disconnected: false, failed: false });
      if (state.synced && state.dirty) settleDirtyState();
      return;
    }
    if (event.status === "disconnected") {
      patch({ connected: false, synced: false, disconnected: true });
    }
  };
  const onSync = (synced: boolean) => {
    patch({ synced });
    if (synced) {
      initializeIfSafe();
      if (state.dirty) settleDirtyState();
    }
  };
  const onFailure = () =>
    patch({
      connected: false,
      synced: false,
      disconnected: true,
      failed: true,
    });
  const onUpdate = (_update: Uint8Array, updateOrigin: unknown) => {
    if (disposed || updateOrigin === websocket || updateOrigin === indexedDb) {
      return;
    }
    patch({ dirty: true });
    settleDirtyState();
  };
  const awarenessSubscription = doc.awarenessStore.slots.update.on(emit);

  indexedDb.on("synced", onIndexedDbSynced);
  websocket.on("status", onStatus as (...args: never[]) => void);
  websocket.on("sync", onSync as (...args: never[]) => void);
  websocket.on("connection-error", onFailure);
  doc.spaceDoc.on("update", onUpdate);

  return {
    doc,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      return projectDocumentSaveState(state);
    },
    presence() {
      return Array.from(
        doc.awarenessStore.getStates(),
        ([clientId, value]) => ({
          clientId,
          name: value.user?.name ?? "Anonymous",
          color: value.color ?? "#64748b",
          isLocal: clientId === doc.spaceDoc.clientID,
        }),
      ).filter((entry) => entry.name !== "Anonymous");
    },
    recoveryUpdate() {
      return Y.encodeStateAsUpdate(doc.spaceDoc);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (quietTimer) clearTimeout(quietTimer);
      doc.spaceDoc.off("update", onUpdate);
      indexedDb.off?.("synced", onIndexedDbSynced);
      websocket.off?.("status", onStatus as (...args: never[]) => void);
      websocket.off?.("sync", onSync as (...args: never[]) => void);
      websocket.off?.("connection-error", onFailure);
      awarenessSubscription.dispose();
      websocket.destroy();
      void indexedDb.destroy();
      doc.collection.forceStop();
      doc.dispose();
      doc.spaceDoc.destroy();
      doc.collection.dispose();
      listeners.clear();
    },
  };
}
