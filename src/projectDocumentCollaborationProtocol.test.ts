import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";

import {
  decodeProjectDocumentStateVector,
  parseProjectDocumentPersistenceMessage,
  projectDocumentStateVectorCoversDocument,
} from "./projectDocumentCollaborationProtocol.ts";

test("parses document persistence acknowledgements and rejects unrelated messages", () => {
  const persistedAt = "2026-08-04T08:00:00.000Z";
  assert.deepEqual(
    parseProjectDocumentPersistenceMessage(JSON.stringify({
      type: "project-document.persisted",
      persistedAt,
      stateVector: "AQE=",
    })),
    {
      type: "project-document.persisted",
      persistedAt,
      stateVector: "AQE=",
    },
  );
  assert.deepEqual(
    parseProjectDocumentPersistenceMessage(JSON.stringify({
      type: "project-document.persistence-error",
    })),
    { type: "project-document.persistence-error" },
  );
  assert.equal(parseProjectDocumentPersistenceMessage("not json"), undefined);
  assert.equal(
    parseProjectDocumentPersistenceMessage(JSON.stringify({ type: "presence" })),
    undefined,
  );
});

test("accepts an acknowledgement only when it covers the current Yjs document", () => {
  const document = new Y.Doc();
  document.getText("body").insert(0, "First edit");
  const firstVector = Y.encodeStateVector(document);
  const encodedFirstVector = Buffer.from(firstVector).toString("base64");

  assert.equal(
    projectDocumentStateVectorCoversDocument(
      decodeProjectDocumentStateVector(encodedFirstVector),
      document,
    ),
    true,
  );

  document.getText("body").insert(document.getText("body").length, " and newer edit");
  assert.equal(
    projectDocumentStateVectorCoversDocument(
      decodeProjectDocumentStateVector(encodedFirstVector),
      document,
    ),
    false,
  );
  document.destroy();
});
