import assert from "node:assert/strict";
import { test } from "node:test";
import { BlockNoteEditor } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import * as Y from "yjs";

import type { ResearchProjectWorkspace } from "../researchProject.ts";
import {
  catalogFlowOption,
  insertProjectDocumentEvidenceBlock,
  projectDocumentEvidenceOptions,
  projectDocumentFlowView,
  projectDocumentFlowOptions,
  projectDocumentSchema,
  projectDocumentSlashMenuItems,
} from "./components/projectDocumentFlowBlock.tsx";

const workspace = {
  id: "3d48a5c7-20b5-480a-a268-c3de515d8344",
  title: "Checkout research",
  question: "How should checkout work?",
  platformFilter: "web",
  pinned: false,
  constraints: "",
  decision: "",
  rationale: "",
  openQuestions: "",
  revision: 3,
  lanes: [
    {
      id: 1,
      title: "Examples",
      position: 0,
      conclusion: "",
      items: [
        {
          id: 10,
          appId: "shopify",
          appIconUrl: "/icons/shopify.png",
          projectId: "3d48a5c7-20b5-480a-a268-c3de515d8344",
          laneId: 1,
          position: 0,
          sourceKind: "catalog_flow_step",
          stepLabel: "Cart",
          note: "",
          tags: [],
          important: false,
          snapshot: {
            title: "Cart screen",
            app: "Shopify",
            flow: "Guest checkout",
            description: "Checkout without creating an account.",
          },
          mediaUrl: "/api/media/cart.png",
        },
        {
          id: 11,
          projectId: "3d48a5c7-20b5-480a-a268-c3de515d8344",
          laneId: 1,
          position: 1,
          sourceKind: "catalog_flow_step",
          stepLabel: "Payment",
          note: "",
          tags: [],
          important: false,
          snapshot: { title: "Payment screen", app: "Shopify", flow: "Guest checkout" },
          mediaUrl: "/api/media/payment.png",
        },
        {
          id: 12,
          projectId: "3d48a5c7-20b5-480a-a268-c3de515d8344",
          laneId: 1,
          position: 2,
          sourceKind: "catalog_screen",
          stepLabel: "Receipt",
          note: "",
          tags: [],
          important: false,
          snapshot: {
            title: "Receipt",
            app: "Shopify",
            platform: "web",
            sourcePath: "/apps/shopify/screens/12",
            description: "Confirmation after a completed order.",
          },
          mediaUrl: "/api/media/receipt.png",
        },
        {
          id: 13,
          projectId: "3d48a5c7-20b5-480a-a268-c3de515d8344",
          laneId: 1,
          position: 3,
          sourceKind: "private_upload",
          stepLabel: "Competitor notes",
          note: "Annotated checkout review",
          tags: [],
          important: true,
          snapshot: {
            title: "Checkout annotations",
            capturedAt: "2026-08-01T09:30:00.000Z",
          },
          mediaUrl: "/api/research-projects/project/uploads/13",
        },
      ],
    },
  ],
  createdAt: "2026-08-02T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
} satisfies ResearchProjectWorkspace;

function collaborativeEditor(document = new Y.Doc()) {
  const editor = BlockNoteEditor.create(withCollaboration({
    schema: projectDocumentSchema,
    defaultStyles: true,
    collaboration: {
      fragment: document.getXmlFragment("document-store"),
      user: { name: "po@example.com", color: "#5b67f1" },
    },
  }));
  return { document, editor };
}

test("groups project flow evidence into embeddable flow options", () => {
  const flows = projectDocumentFlowOptions(workspace);

  assert.equal(flows.length, 1);
  assert.deepEqual(flows[0], {
    app: "Shopify",
    appIconUrl: "/icons/shopify.png",
    appId: "shopify",
    description: "Checkout without creating an account.",
    id: "project-flow:shopify:guest%20checkout",
    previews: [
      { label: "Cart", url: "/api/media/cart.png" },
      { label: "Payment", url: "/api/media/payment.png" },
    ],
    source: "project",
    stepCount: 2,
    title: "Guest checkout",
  });
});

test("turns Project screens and uploads into stable evidence references", () => {
  const evidence = projectDocumentEvidenceOptions(workspace);

  assert.deepEqual(evidence, [
    {
      app: "Shopify",
      appIconUrl: "",
      appId: "",
      capturedAt: "",
      description: "Confirmation after a completed order.",
      id: "project-evidence:12",
      lane: "Examples",
      mediaUrl: "/api/media/receipt.png",
      platform: "web",
      sourcePath: "/apps/shopify/screens/12",
      title: "Receipt",
      type: "screen",
    },
    {
      app: "",
      appIconUrl: "",
      appId: "",
      capturedAt: "2026-08-01T09:30:00.000Z",
      description: "Annotated checkout review",
      id: "project-evidence:13",
      lane: "Examples",
      mediaUrl: "/api/research-projects/project/uploads/13",
      platform: "",
      sourcePath: "",
      title: "Checkout annotations",
      type: "upload",
    },
  ]);
});

test("converts a catalog result into a stable embeddable Flow reference", () => {
  const option = catalogFlowOption({
    category: "Account Management",
    title: "Creating Account",
    preview: {
      appId: "linear",
      appName: "Linear",
      appIconUrl: null,
      versionId: 7,
      version: 3,
      sourceFlowId: "creating-account",
      screenCount: 2,
      flow: {
        id: "linear:71",
        title: "Creating Account",
        category: "Account Management",
        description: "Create an account from the welcome screen.",
        tags: ["onboarding"],
        steps: [
          {
            label: "Open account",
            evidence: [{
              imageId: 1,
              imageUrl: "/api/flows/media/linear/web/7/71/1?variant=full",
              thumbnailUrl: "/api/flows/media/linear/web/7/71/1?variant=thumb",
              description: "Open account",
            }],
          },
          {
            label: "Submit details",
            evidence: [{
              imageId: 2,
              imageUrl: "/api/flows/media/linear/web/7/71/2?variant=full",
              thumbnailUrl: "/api/flows/media/linear/web/7/71/2?variant=thumb",
              description: "Submit details",
            }],
          },
        ],
      },
    },
  }, "web");

  assert.deepEqual(option, {
    app: "Linear",
    appIconUrl: null,
    appId: "linear",
    catalog: {
      app: "Linear",
      appId: "linear",
      versionId: 7,
      flowId: "creating-account",
      platform: "web",
      title: "Creating Account",
      description: "Create an account from the welcome screen.",
    },
    description: "Create an account from the welcome screen.",
    id: "catalog-flow:web:linear:3:creating-account",
    platform: "web",
    previews: [
      { label: "Open account", url: "/api/flows/media/linear/web/7/71/1?variant=thumb" },
      { label: "Submit details", url: "/api/flows/media/linear/web/7/71/2?variant=thumb" },
    ],
    source: "catalog",
    stepCount: 2,
    title: "Creating Account",
  });
});

test("keeps the complete visible step sequence instead of truncating the Flow card to four previews", () => {
  const steps = Array.from({ length: 10 }, (_, index) => ({
    label: `Step ${index + 1}`,
    evidence: [{
      imageId: index + 1,
      imageUrl: `/api/flows/media/lovable/web/9/22/${index + 1}?variant=full`,
      thumbnailUrl: `/api/flows/media/lovable/web/9/22/${index + 1}?variant=thumb`,
      description: `Step ${index + 1}`,
    }],
  }));
  const option = catalogFlowOption({
    category: "Account Management",
    title: "Deleting account",
    preview: {
      appId: "lovable",
      appName: "Lovable",
      appIconUrl: null,
      versionId: 9,
      version: 2,
      sourceFlowId: "deleting-account",
      screenCount: 10,
      flow: {
        id: "lovable:22",
        title: "Deleting account",
        category: "Account Management",
        description: "Delete a workspace account.",
        tags: [],
        steps,
      },
    },
  }, "web");

  assert.equal(option.previews.length, 10);
  assert.deepEqual(option.previews.map((preview) => preview.label), steps.map((step) => step.label));

  const appFlow = projectDocumentFlowView(option);
  assert.equal(appFlow.id, option.id);
  assert.equal(appFlow.steps.length, 10);
  assert.deepEqual(
    appFlow.steps.map((step) => step.evidence[0]?.imageUrl),
    option.previews.map((preview) => preview.url),
  );
});

test("inserts the custom Flow block from the slash menu", () => {
  const { document, editor } = collaborativeEditor();
  const flowItem = projectDocumentSlashMenuItems(editor, "flow")
    .find((item) => item.title === "Flow");

  assert.ok(flowItem);
  flowItem.onItemClick();
  assert.equal(editor.document[0]?.type, "astryxReference");
  assert.equal(editor.document[0]?.props.referenceType, "flow");
  document.destroy();
});

test("inserts the Evidence Composer from the slash menu and toolbar helper", () => {
  const slash = collaborativeEditor();
  const evidenceItem = projectDocumentSlashMenuItems(slash.editor, "evidence")
    .find((item) => item.title === "Vitrines evidence");

  assert.ok(evidenceItem);
  evidenceItem.onItemClick();
  assert.equal(slash.editor.document[0]?.type, "vitrinesEvidence");
  slash.document.destroy();

  const toolbar = collaborativeEditor();
  insertProjectDocumentEvidenceBlock(toolbar.editor);
  assert.equal(toolbar.editor.document[0]?.type, "vitrinesEvidence");
  toolbar.document.destroy();
});

test("keeps evidence identity, snapshot, caption, and layout in collaboration", () => {
  const first = collaborativeEditor();
  const block = first.editor.updateBlock(first.editor.document[0], {
    type: "vitrinesEvidence",
    props: {
      referenceType: "screen",
      referenceId: "project-evidence:12",
      title: "Receipt",
      app: "Shopify",
      description: "Confirmation after a completed order.",
      mediaUrl: "/api/media/receipt.png",
      sourcePath: "/apps/shopify/screens/12",
      caption: "Keep the next action visible after confirmation.",
      layout: "wide",
    },
  });

  assert.equal(block.type, "vitrinesEvidence");
  assert.equal(block.props.referenceType, "screen");
  assert.equal(block.props.caption, "Keep the next action visible after confirmation.");
  assert.equal(block.props.layout, "wide");
  first.document.destroy();
});

test("keeps Flow block identity and snapshot in the collaborative schema", () => {
  const first = collaborativeEditor();
  const block = first.editor.updateBlock(first.editor.document[0], {
    type: "astryxReference",
    props: {
      referenceType: "flow",
      referenceId: "project-flow:shopify:guest%20checkout",
      title: "Guest checkout",
      app: "Shopify",
      description: "Checkout without creating an account.",
      stepCount: 2,
    },
  });

  assert.equal(block.type, "astryxReference");
  assert.deepEqual(block.props, {
    referenceType: "flow",
    referenceId: "project-flow:shopify:guest%20checkout",
    source: "project",
    title: "Guest checkout",
    app: "Shopify",
    appIconUrl: "",
    appId: "",
    description: "Checkout without creating an account.",
    platform: "",
    previewSnapshot: "",
    stepCount: 2,
  });
  first.document.destroy();
});
