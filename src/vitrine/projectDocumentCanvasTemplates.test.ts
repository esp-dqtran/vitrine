import assert from "node:assert/strict";
import test from "node:test";

import type { TemplateManager } from "@blocksuite/blocks";
import { AffineSchemas } from "@blocksuite/blocks/schemas";
import { DocCollection, Schema } from "@blocksuite/store";

import { configureProjectDocumentCanvasTemplates } from "./projectDocumentCanvasTemplates.ts";

test("provides valid BA/PO Canvas templates through BlockSuite's manager extension", async () => {
  const collection = new DocCollection({
    schema: new Schema().register(AffineSchemas),
  });
  collection.meta.initialize();
  const doc = collection.createDoc({ id: "canvas-template-test" });
  doc.load();
  let manager: TemplateManager | undefined;
  const dispose = configureProjectDocumentCanvasTemplates(
    {
      templates: {
        categories: () => [],
        list: () => [],
        search: () => [],
        extend: (candidate) => {
          manager = candidate;
        },
      },
    },
    doc,
  );

  try {
    assert.ok(manager);
    assert.deepEqual(await manager.categories(), [
      "Product planning",
      "Delivery",
    ]);

    const planning = await manager.list("Product planning");
    assert.deepEqual(
      planning.map(({ name }) => name),
      ["User Story Map", "Product Discovery Board"],
    );
    const releasePlan = (await manager.search("release"))[0];
    assert.equal(releasePlan?.name, "Release Plan");
    assert.match(releasePlan?.preview ?? "", /^<svg/);

    const snapshot = releasePlan?.content as {
      type?: string;
      blocks?: {
        flavour?: string;
        children?: { flavour?: string; children?: unknown[] }[];
      };
    };
    assert.equal(snapshot.type, "page");
    assert.equal(snapshot.blocks?.flavour, "affine:page");
    const notes =
      snapshot.blocks?.children?.filter(
        ({ flavour }) => flavour === "affine:note",
      ) ?? [];
    assert.equal(notes.length, 5);
    assert.ok(notes.every(({ children }) => (children?.length ?? 0) >= 3));
  } finally {
    dispose();
    collection.dispose();
  }
});
