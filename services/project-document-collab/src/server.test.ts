import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HocuspocusProvider,
  type HocuspocusProviderConfiguration,
} from "@hocuspocus/provider";
import { WebSocket } from "ws";
import * as Y from "yjs";

import {
  decodeProjectDocumentStateVector,
  parseProjectDocumentPersistenceMessage,
  projectDocumentStateVectorCoversDocument,
} from "../../../src/projectDocumentCollaborationProtocol.ts";
import { createProjectDocumentCollaborationService } from "./server.ts";

const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const waitFor = async (predicate: () => boolean, label: string): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

function connect(input: {
  url: string;
  token: string;
  document: Y.Doc;
  onStateless?: (payload: string) => void;
}): HocuspocusProvider {
  return new HocuspocusProvider({
    url: input.url,
    name: DOCUMENT_ID,
    token: input.token,
    document: input.document,
    WebSocketPolyfill: WebSocket,
    onStateless: ({ payload }) => input.onStateless?.(payload),
  } as HocuspocusProviderConfiguration & { WebSocketPolyfill: typeof WebSocket });
}

test("synchronizes two Yjs clients and restores the persisted document", async (t) => {
  const persisted = new Map<string, Uint8Array>();
  const createService = () => createProjectDocumentCollaborationService({
    async authenticate({ token }) {
      return token === "editor" ? { userId: 7, email: "po@example.com" } : undefined;
    },
    async authorize(_identity, documentId) {
      return documentId === DOCUMENT_ID ? { documentId: 41, role: "editor" } : undefined;
    },
    async load(documentId) {
      return persisted.get(documentId) ?? null;
    },
    async store(documentId, state) {
      persisted.set(documentId, new Uint8Array(state));
    },
  });

  const firstServer = createService();
  await firstServer.listen(0);
  const url = `ws://127.0.0.1:${firstServer.address.port}`;
  const firstDocument = new Y.Doc();
  const secondDocument = new Y.Doc();
  const first = connect({ url, token: "editor", document: firstDocument });
  const second = connect({ url, token: "editor", document: secondDocument });
  t.after(async () => {
    first.destroy();
    second.destroy();
    firstDocument.destroy();
    secondDocument.destroy();
    await firstServer.destroy();
  });

  await waitFor(() => first.synced && second.synced, "both clients to sync");
  firstDocument.getText("body").insert(0, "Realtime requirements");
  await waitFor(
    () => secondDocument.getText("body").toString() === "Realtime requirements",
    "the second client to receive the edit",
  );
  first.destroy();
  second.destroy();
  await firstServer.destroy();
  await waitFor(() => persisted.has(DOCUMENT_ID), "the Yjs state to persist");

  const restarted = createService();
  await restarted.listen(0);
  const restoredDocument = new Y.Doc();
  const restored = connect({
    url: `ws://127.0.0.1:${restarted.address.port}`,
    token: "editor",
    document: restoredDocument,
  });
  await waitFor(() => restored.synced, "the restored client to sync");
  assert.equal(restoredDocument.getText("body").toString(), "Realtime requirements");
  restored.destroy();
  restoredDocument.destroy();
  await restarted.destroy();
});

test("acknowledges an edit only after its Yjs snapshot is durably stored", async (t) => {
  let releaseStore: (() => void) | undefined;
  let markStoreStarted: (() => void) | undefined;
  const storeStarted = new Promise<void>((resolve) => { markStoreStarted = resolve; });
  const storeReleased = new Promise<void>((resolve) => { releaseStore = resolve; });
  const server = createProjectDocumentCollaborationService({
    async authenticate() { return { userId: 7, email: "editor@example.com" }; },
    async authorize() { return { documentId: 41, role: "editor" }; },
    async load() { return null; },
    async store() {
      markStoreStarted?.();
      await storeReleased;
    },
  });
  await server.listen(0);
  const document = new Y.Doc();
  const messages: string[] = [];
  const provider = connect({
    url: `ws://127.0.0.1:${server.address.port}`,
    token: "editor",
    document,
    onStateless: (payload) => messages.push(payload),
  });
  t.after(async () => {
    releaseStore?.();
    provider.destroy();
    document.destroy();
    await server.destroy();
  });

  await waitFor(() => provider.synced, "the editor to sync");
  document.getText("body").insert(0, "Persist this change");
  await storeStarted;
  assert.equal(
    messages.some((payload) =>
      parseProjectDocumentPersistenceMessage(payload)?.type
        === "project-document.persisted"),
    false,
  );

  releaseStore?.();
  await waitFor(
    () => messages.some((payload) =>
      parseProjectDocumentPersistenceMessage(payload)?.type
        === "project-document.persisted"),
    "the persistence acknowledgement",
  );
  const acknowledgement = messages
    .map(parseProjectDocumentPersistenceMessage)
    .find((message) => message?.type === "project-document.persisted");
  assert.ok(acknowledgement?.type === "project-document.persisted");
  assert.equal(
    projectDocumentStateVectorCoversDocument(
      decodeProjectDocumentStateVector(acknowledgement.stateVector),
      document,
    ),
    true,
  );
});

test("reports a persistence error when storing the Yjs snapshot fails", async (t) => {
  const server = createProjectDocumentCollaborationService({
    async authenticate() { return { userId: 7, email: "editor@example.com" }; },
    async authorize() { return { documentId: 41, role: "editor" }; },
    async load() { return null; },
    async store() { throw new Error("database unavailable"); },
  });
  await server.listen(0);
  const document = new Y.Doc();
  const messages: string[] = [];
  const provider = connect({
    url: `ws://127.0.0.1:${server.address.port}`,
    token: "editor",
    document,
    onStateless: (payload) => messages.push(payload),
  });
  t.after(async () => {
    provider.destroy();
    document.destroy();
    await server.destroy();
  });

  await waitFor(() => provider.synced, "the editor to sync");
  document.getText("body").insert(0, "Unsaved change");
  await waitFor(
    () => messages.some((payload) =>
      parseProjectDocumentPersistenceMessage(payload)?.type
        === "project-document.persistence-error"),
    "the persistence error",
  );
  assert.equal(
    messages.some((payload) =>
      parseProjectDocumentPersistenceMessage(payload)?.type
        === "project-document.persisted"),
    false,
  );
});

test("enforces authentication, document authorization, and viewer scope", async (t) => {
  const server = createProjectDocumentCollaborationService({
    async authenticate({ token }) {
      if (token === "editor") return { userId: 7, email: "editor@example.com" };
      if (token === "viewer") return { userId: 8, email: "viewer@example.com" };
      return undefined;
    },
    async authorize(identity, documentId) {
      if (documentId !== DOCUMENT_ID) return undefined;
      return { documentId: 41, role: identity.userId === 8 ? "viewer" : "editor" };
    },
    async load() { return null; },
    async store() {},
  });
  await server.listen(0);
  t.after(() => server.destroy());
  const url = `ws://127.0.0.1:${server.address.port}`;

  const editorDocument = new Y.Doc();
  const editor = connect({ url, token: "editor", document: editorDocument });
  await waitFor(() => editor.synced, "editor authentication");

  const viewerDocument = new Y.Doc();
  const viewer = connect({ url, token: "viewer", document: viewerDocument });
  await waitFor(() => viewer.synced, "viewer authentication");
  assert.equal(viewer.authorizedScope, "readonly");
  viewerDocument.getText("body").insert(0, "viewer write");
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(editorDocument.getText("body").toString(), "");

  const deniedDocument = new Y.Doc();
  let authenticationFailed = false;
  const denied = new HocuspocusProvider({
    url,
    name: DOCUMENT_ID,
    token: "invalid",
    document: deniedDocument,
    WebSocketPolyfill: WebSocket,
    onAuthenticationFailed: () => { authenticationFailed = true; },
  } as HocuspocusProviderConfiguration & { WebSocketPolyfill: typeof WebSocket });
  await waitFor(() => authenticationFailed, "invalid authentication to be rejected");

  editor.destroy();
  viewer.destroy();
  denied.destroy();
  editorDocument.destroy();
  viewerDocument.destroy();
  deniedDocument.destroy();
});
