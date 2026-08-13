import assert from "node:assert/strict";
import { test } from "node:test";

import {
  consumeProjectDocumentFlowInsertIntent,
  storeProjectDocumentFlowInsertIntent,
} from "./projectDocumentFlowInsertIntent.ts";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

const flow = {
  app: "Linear",
  appId: "linear",
  description: "Invite a teammate",
  id: "catalog-flow:web:linear:invite",
  platform: "web" as const,
  previews: [{ label: "Members", url: "/api/media/42" }],
  source: "catalog" as const,
  stepCount: 1,
  title: "Invite teammate",
};

test("hands a selected Flow to one project document exactly once", () => {
  const target = storage();
  storeProjectDocumentFlowInsertIntent("project-a", flow, target);
  assert.deepEqual(consumeProjectDocumentFlowInsertIntent("project-a", target), flow);
  assert.equal(consumeProjectDocumentFlowInsertIntent("project-a", target), undefined);
});

test("keeps project Flow handoff scoped to its selected project", () => {
  const target = storage();
  storeProjectDocumentFlowInsertIntent("project-a", flow, target);
  assert.equal(consumeProjectDocumentFlowInsertIntent("project-b", target), undefined);
  assert.deepEqual(consumeProjectDocumentFlowInsertIntent("project-a", target), flow);
});

test("drops malformed project Flow handoffs", () => {
  const target = storage();
  target.setItem("vitrines:project-document-flow-insert:project-a", "{");
  assert.equal(consumeProjectDocumentFlowInsertIntent("project-a", target), undefined);
});
