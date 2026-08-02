import assert from "node:assert/strict";
import type { Server } from "node:http";
import { test } from "node:test";
import express from "express";

import type { ProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import { mountProjectDocumentRoutes } from "./projectDocuments.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const user = { id: 7, email: "po@example.com", role: "user" as const };
const document = {
  id: 41,
  projectId: PROJECT_ID,
  title: "Checkout notes",
  icon: "document" as const,
  isFavorite: false,
  pageWidth: "standard" as const,
  collaborationDocumentId: "22222222-2222-4222-8222-222222222222",
  role: "editor" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

async function serve(
  store: Pick<ProjectDocumentStore,
    "ensureDocument" | "getDocument" | "updateDocument" | "listComments" | "addComment" | "resolveComment">,
  enabled = true,
): Promise<{ base: string; server: Server }> {
  const app = express();
  app.use(express.json());
  app.use((_request, response, next) => {
    response.locals.user = user;
    next();
  });
  mountProjectDocumentRoutes(app, { store, enabled });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

const close = (server: Server) => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test("bootstraps and reads the authenticated project document", async (t) => {
  const calls: Array<{ operation: string; userId: number; projectId: string }> = [];
  const store = {
    async ensureDocument(userId: number, projectId: string) {
      calls.push({ operation: "ensure", userId, projectId });
      return document;
    },
    async getDocument(userId: number, projectId: string) {
      calls.push({ operation: "get", userId, projectId });
      return document;
    },
    async updateDocument() { return document; },
    async listComments() { return []; },
    async addComment() { return undefined; },
    async resolveComment() { return undefined; },
  };
  const { base, server } = await serve(store);
  t.after(() => close(server));

  const created = await fetch(`${base}/research-projects/${PROJECT_ID}/document`, {
    method: "POST",
  });
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), document);

  const loaded = await fetch(`${base}/research-projects/${PROJECT_ID}/document`);
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json() as { collaborationDocumentId: string }).collaborationDocumentId,
    document.collaborationDocumentId);
  assert.deepEqual(calls, [
    { operation: "ensure", userId: user.id, projectId: PROJECT_ID },
    { operation: "get", userId: user.id, projectId: PROJECT_ID },
  ]);
});

test("rejects invalid, unavailable, and disabled documents", async (t) => {
  const missingStore = {
    ensureDocument: async () => undefined,
    getDocument: async () => undefined,
    updateDocument: async () => undefined,
    listComments: async () => undefined,
    addComment: async () => undefined,
    resolveComment: async () => undefined,
  };
  const enabled = await serve(missingStore);
  const disabled = await serve(missingStore, false);
  t.after(() => Promise.all([close(enabled.server), close(disabled.server)]).then(() => undefined));

  assert.equal((await fetch(`${enabled.base}/research-projects/not-a-uuid/document`)).status, 400);
  assert.equal((await fetch(`${enabled.base}/research-projects/${PROJECT_ID}/document`)).status, 404);
  assert.equal((await fetch(`${disabled.base}/research-projects/${PROJECT_ID}/document`)).status, 404);
});

test("updates page chrome and manages the page discussion", async (t) => {
  const comments = [{
    id: 9,
    body: "Clarify the approval step",
    authorUserId: 7,
    authorEmail: user.email,
    resolvedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  }];
  const calls: string[] = [];
  const store = {
    ensureDocument: async () => document,
    getDocument: async () => document,
    async updateDocument(_userId: number, _projectId: string, patch: unknown) {
      calls.push(`update:${JSON.stringify(patch)}`);
      return { ...document, title: "Checkout decisions", isFavorite: true };
    },
    async listComments() { calls.push("list"); return comments; },
    async addComment(_userId: number, _projectId: string, body: string) {
      calls.push(`add:${body}`);
      return comments[0];
    },
    async resolveComment(_userId: number, _projectId: string, commentId: number, resolved: boolean) {
      calls.push(`resolve:${commentId}:${resolved}`);
      return { ...comments[0], resolvedAt: resolved ? "2026-08-01T01:00:00.000Z" : null };
    },
  };
  const { base, server } = await serve(store);
  t.after(() => close(server));

  const updated = await fetch(`${base}/research-projects/${PROJECT_ID}/document`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Checkout decisions", isFavorite: true }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json() as { title: string }).title, "Checkout decisions");

  assert.equal((await fetch(`${base}/research-projects/${PROJECT_ID}/document/comments`)).status, 200);
  assert.equal((await fetch(`${base}/research-projects/${PROJECT_ID}/document/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "Clarify the approval step" }),
  })).status, 201);
  assert.equal((await fetch(`${base}/research-projects/${PROJECT_ID}/document/comments/9`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resolved: true }),
  })).status, 200);
  assert.deepEqual(calls, [
    'update:{"title":"Checkout decisions","isFavorite":true}',
    "list",
    "add:Clarify the approval step",
    "resolve:9:true",
  ]);
});

test("validates document metadata and discussion payload boundaries", async (t) => {
  const store = {
    ensureDocument: async () => document,
    getDocument: async () => document,
    updateDocument: async () => document,
    listComments: async () => [],
    addComment: async () => undefined,
    resolveComment: async () => undefined,
  };
  const { base, server } = await serve(store);
  t.after(() => close(server));

  const patch = (body: unknown) => fetch(`${base}/research-projects/${PROJECT_ID}/document`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  for (const body of [
    {},
    { title: "   " },
    { title: "x".repeat(121) },
    { icon: "rocket" },
    { isFavorite: "yes" },
    { pageWidth: "wide" },
    { title: "Valid", unknown: true },
  ]) {
    assert.equal((await patch(body)).status, 400);
  }

  const comment = (body: unknown) => fetch(
    `${base}/research-projects/${PROJECT_ID}/document/comments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  assert.equal((await comment({ body: "   " })).status, 400);
  assert.equal((await comment({ body: "x".repeat(2001) })).status, 400);

  const resolve = (commentId: string, body: unknown) => fetch(
    `${base}/research-projects/${PROJECT_ID}/document/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  assert.equal((await resolve("0", { resolved: true })).status, 400);
  assert.equal((await resolve("9", { resolved: "yes" })).status, 400);
});
