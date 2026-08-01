import {
  AffineSlashMenuWidget,
  databaseViewInitTemplate,
  type AffineSlashMenuActionItem,
  type AffineSlashMenuItem,
  getSurfaceBlock,
  MindmapStyle,
  toast,
  type DatabaseBlockModel,
} from "@blocksuite/blocks";
import {
  insertContent,
  REFERENCE_NODE,
} from "@blocksuite/affine-components/rich-text";
import { Text } from "@blocksuite/store";

import {
  PROJECT_DOCUMENT_CALLOUT_FLAVOUR,
  createProjectDocumentCalloutProps,
} from "./projectDocumentCallout.ts";
import { createProjectDocumentTableProps } from "./projectDocumentTable.ts";
import type { ProjectDocumentTextAlignment } from "./projectDocumentTextAlignment.ts";
import {
  PROJECT_DOCUMENT_EMBED_FLAVOUR,
  createProjectDocumentEmbedProps,
} from "./projectDocumentEmbed.ts";

const PROJECT_DOCUMENT_SLASH_MENU_MARKER =
  "astryx-project-document-slash-menu";

type ProjectDocumentSlashMenuCreateDocument = () => Promise<
  number | undefined
>;

let createPersistentDocument:
  | ProjectDocumentSlashMenuCreateDocument
  | undefined;

type DatabaseBlockView = {
  dataSource: {
    viewManager: {
      viewAdd(type: string): string;
      setCurrentView(id: string): void;
    };
  };
};

const simpleTableItem: AffineSlashMenuActionItem = {
  name: "Table",
  description: "Create a simple table.",
  alias: ["simple table"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has("affine:table"),
  action: ({ model }) => {
    const parent = model.doc.getParent(model);
    if (!parent) return;
    const index = parent.children.indexOf(model);
    model.doc.captureSync();
    model.doc.addBlock(
      "affine:table",
      createProjectDocumentTableProps(),
      parent,
      index + 1,
    );
    if (model.text?.length === 0) model.doc.deleteBlock(model);
  },
};

const calendarViewItem: AffineSlashMenuActionItem = {
  name: "Calendar View",
  description: "Display items by date in a calendar.",
  alias: ["database", "calendar"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has("affine:database"),
  action: ({ model, rootComponent }) => {
    const parent = model.doc.getParent(model);
    if (!parent) return;
    const index = parent.children.indexOf(model);
    model.doc.captureSync();
    const databaseId = model.doc.addBlock(
      "affine:database",
      {},
      parent,
      index + 1,
    );
    const database = model.doc.getBlock(databaseId)?.model as
      | DatabaseBlockModel
      | undefined;
    if (!database) return;
    databaseViewInitTemplate(database, "table");
    if (model.text?.length === 0) model.doc.deleteBlock(model);
    queueMicrotask(() => {
      const block = rootComponent.std.view.getBlock(
        databaseId,
      ) as DatabaseBlockView | null;
      if (!block) return;
      const calendarViewId =
        block.dataSource.viewManager.viewAdd("calendar");
      block.dataSource.viewManager.setCurrentView(calendarViewId);
    });
  },
};

const calloutItem: AffineSlashMenuActionItem = {
  name: "Callout",
  description: "Let your words stand out.",
  alias: ["notice", "info"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has("affine:callout"),
  action: ({ model }) => {
    const parent = model.doc.getParent(model);
    if (!parent) return;
    const index = parent.children.indexOf(model);
    model.doc.captureSync();
    model.doc.addBlock(
      PROJECT_DOCUMENT_CALLOUT_FLAVOUR as BlockSuite.Flavour,
      createProjectDocumentCalloutProps(),
      parent,
      index + 1,
    );
    if (model.text?.length === 0) model.doc.deleteBlock(model);
  },
};

const embedItem: AffineSlashMenuActionItem = {
  name: "Embed",
  description: "Embed a web page from an HTTPS link.",
  alias: ["iframe", "website", "web page"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has(
      PROJECT_DOCUMENT_EMBED_FLAVOUR,
    ),
  action: ({ model }) => {
    const parent = model.doc.getParent(model);
    if (!parent) return;
    const index = parent.children.indexOf(model);
    model.doc.captureSync();
    model.doc.addBlock(
      PROJECT_DOCUMENT_EMBED_FLAVOUR,
      createProjectDocumentEmbedProps(),
      parent,
      index + 1,
    );
    if (model.text?.length === 0) model.doc.deleteBlock(model);
  },
};

async function selectProjectDocumentPdf(): Promise<File | null> {
  const showOpenFilePicker = (
    window as Window & {
      showOpenFilePicker?: (options: {
        types: {
          description: string;
          accept: Record<string, string[]>;
        }[];
        multiple: boolean;
        excludeAcceptAllOption: boolean;
      }) => Promise<{ getFile(): Promise<File> }[]>;
    }
  ).showOpenFilePicker;

  if (showOpenFilePicker) {
    try {
      const handles = await showOpenFilePicker({
        types: [
          {
            description: "PDF",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
        multiple: false,
        excludeAcceptAllOption: true,
      });
      return handles[0]?.getFile() ?? null;
    } catch (cause) {
      if ((cause as DOMException).name === "AbortError") return null;
      throw cause;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.hidden = true;
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener(
      "change",
      () => finish(input.files?.[0] ?? null),
      { once: true },
    );
    input.addEventListener("cancel", () => finish(null), { once: true });
    document.body.append(input);
    input.click();
  });
}

const pdfItem: AffineSlashMenuActionItem = {
  name: "PDF",
  description: "Upload and display a PDF.",
  alias: ["document", "portable document"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has("affine:attachment"),
  action: async ({ model, rootComponent }) => {
    const file = await selectProjectDocumentPdf();
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLocaleLowerCase().endsWith(".pdf")
    ) {
      toast(rootComponent.host, "Choose a PDF file.");
      return;
    }

    const attachmentService =
      rootComponent.std.getService("affine:attachment");
    if (!attachmentService) {
      toast(rootComponent.host, "PDF attachments are unavailable.");
      return;
    }
    if (file.size > attachmentService.maxFileSize) {
      toast(rootComponent.host, "This PDF exceeds the attachment size limit.");
      return;
    }

    const parent = model.doc.getParent(model);
    if (!parent) return;
    const index = parent.children.indexOf(model);
    model.doc.captureSync();
    const attachmentId = model.doc.addBlock(
      "affine:attachment",
      {
        name: file.name,
        size: file.size,
        type: "application/pdf",
        embed: true,
        style: "pdf",
      },
      parent,
      index + 1,
    );
    if (model.text?.length === 0) model.doc.deleteBlock(model);

    try {
      const sourceId = await model.doc.blobSync.set(file);
      const attachment = model.doc.getBlock(attachmentId)?.model;
      if (attachment) {
        model.doc.updateBlock(attachment, { sourceId } as never);
      }
    } catch (cause) {
      toast(
        rootComponent.host,
        `Unable to upload PDF: ${(cause as Error).message}`,
      );
    }
  },
};

const frameItem: AffineSlashMenuActionItem = {
  name: "Frame",
  description: "Insert a blank Canvas frame.",
  alias: ["canvas frame", "edgeless frame"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has("affine:frame") &&
    model.doc.schema.flavourSchemaMap.has("affine:surface-ref"),
  action: ({ model }) => {
    const surface = getSurfaceBlock(model.doc);
    const parent = model.doc.getParent(model);
    if (!surface || !parent) return;
    const index = parent.children.indexOf(model);
    const frameNumber =
      model.doc.getBlocksByFlavour("affine:frame").length + 1;
    const offset = (frameNumber - 1) * 80;
    model.doc.captureSync();
    const frameId = model.doc.addBlock(
      "affine:frame",
      {
        title: new Text(`Frame ${frameNumber}`),
        xywh: `[${offset},${offset},1600,900]`,
      },
      surface,
    );
    model.doc.addBlock(
      "affine:surface-ref",
      {
        reference: frameId,
        refFlavour: "frame",
      },
      parent,
      index + 1,
    );
    if (model.text?.length === 0) model.doc.deleteBlock(model);
  },
};

const mindMapItem: AffineSlashMenuActionItem = {
  name: "Mind Map",
  description: "Insert a mind map shared with Canvas.",
  alias: ["mindmap", "diagram", "canvas map"],
  showWhen: ({ model }) =>
    model.doc.schema.flavourSchemaMap.has("affine:surface-ref"),
  action: ({ model }) => {
    const surface = getSurfaceBlock(model.doc);
    const parent = model.doc.getParent(model);
    if (!surface || !parent) return;
    const index = parent.children.indexOf(model);
    model.doc.captureSync();
    const mindMapId = surface.addElement({
      type: "mindmap",
      style: MindmapStyle.ONE,
      children: {
        text: "Mind Map",
        children: [
          { text: "Text", children: [] },
          { text: "Text", children: [] },
          { text: "Text", children: [] },
        ],
      },
    });
    model.doc.addBlock(
      "affine:surface-ref",
      {
        reference: mindMapId,
        refFlavour: "mindmap",
      },
      parent,
      index + 1,
    );
    if (model.text?.length === 0) model.doc.deleteBlock(model);
  },
};

const alignmentItems: AffineSlashMenuActionItem[] = (
  [
    ["Align left", "left"],
    ["Align center", "center"],
    ["Align right", "right"],
  ] as const satisfies readonly [
    string,
    ProjectDocumentTextAlignment,
  ][]
).map(([name, textAlign]) => ({
  name,
  description: `Align this block ${textAlign}.`,
  alias: [`text ${textAlign}`, `${textAlign} align`],
  showWhen: ({ model }) =>
    model.flavour === "affine:paragraph" ||
    model.flavour === "affine:list",
  action: ({ model }) => {
    model.doc.captureSync();
    model.doc.updateBlock(model, { textAlign } as never);
  },
}));

function insertGroupBefore(
  beforeGroupName: string,
  groupName: string,
  groupItems: AffineSlashMenuActionItem[],
): void {
  const items = AffineSlashMenuWidget.DEFAULT_CONFIG.items;
  if (
    items.some(
      (candidate) =>
        "groupName" in candidate &&
        candidate.groupName === groupName,
    )
  ) {
    return;
  }
  const beforeIndex = items.findIndex(
    (candidate) =>
      "groupName" in candidate &&
      candidate.groupName === beforeGroupName,
  );
  const insertionIndex = beforeIndex < 0 ? items.length : beforeIndex;
  const additions: AffineSlashMenuItem[] = [
    { groupName },
    ...groupItems,
  ];
  items.splice(insertionIndex, 0, ...additions);
}

function insertAfterGroup(
  groupName: string,
  item: AffineSlashMenuActionItem,
): void {
  const items = AffineSlashMenuWidget.DEFAULT_CONFIG.items;
  if (
    items.some(
      (candidate) =>
        "name" in candidate &&
        candidate.name === item.name,
    )
  ) {
    return;
  }
  const groupIndex = items.findIndex(
    (candidate) =>
      "groupName" in candidate &&
      candidate.groupName === groupName,
  );
  items.splice(groupIndex < 0 ? items.length : groupIndex + 1, 0, item);
}

function insertAfterItem(
  itemName: string,
  item: AffineSlashMenuActionItem,
): void {
  const items = AffineSlashMenuWidget.DEFAULT_CONFIG.items;
  if (
    items.some(
      (candidate) =>
        "name" in candidate &&
        candidate.name === item.name,
    )
  ) {
    return;
  }
  const itemIndex = items.findIndex(
    (candidate) =>
      "name" in candidate &&
      candidate.name === itemName,
  );
  items.splice(itemIndex < 0 ? items.length : itemIndex + 1, 0, item);
}

function replaceNewDocumentItem(): void {
  const item = AffineSlashMenuWidget.DEFAULT_CONFIG.items.find(
    (candidate) =>
      "name" in candidate && candidate.name === "New Doc",
  );
  if (!item || !("action" in item)) return;
  item.description = "Create and link a project document.";
  item.showWhen = ({ model }) =>
    Boolean(createPersistentDocument) &&
    model.doc.schema.flavourSchemaMap.has("affine:embed-linked-doc");
  item.action = async ({ model, rootComponent }) => {
    const documentId = await createPersistentDocument?.();
    if (!documentId) return;
    insertContent(rootComponent.host, model, REFERENCE_NODE, {
      reference: {
        type: "LinkedPage",
        pageId: String(documentId),
      },
    });
  };
}

export function registerProjectDocumentSlashMenu(): void {
  const widget = AffineSlashMenuWidget as typeof AffineSlashMenuWidget & {
    [PROJECT_DOCUMENT_SLASH_MENU_MARKER]?: boolean;
  };
  if (widget[PROJECT_DOCUMENT_SLASH_MENU_MARKER]) return;
  widget[PROJECT_DOCUMENT_SLASH_MENU_MARKER] = true;
  insertAfterGroup("Basic", calloutItem);
  insertGroupBefore("Style", "Align", alignmentItems);
  insertAfterGroup("Content & Media", simpleTableItem);
  insertAfterItem("Attachment", pdfItem);
  insertAfterItem("PDF", embedItem);
  insertGroupBefore("Date", "Edgeless Element", [
    frameItem,
    mindMapItem,
  ]);
  insertAfterGroup("Database", calendarViewItem);
  replaceNewDocumentItem();
}

export function configureProjectDocumentSlashMenu(options: {
  createDocument: ProjectDocumentSlashMenuCreateDocument;
}): () => void {
  createPersistentDocument = options.createDocument;
  return () => {
    if (createPersistentDocument === options.createDocument) {
      createPersistentDocument = undefined;
    }
  };
}
