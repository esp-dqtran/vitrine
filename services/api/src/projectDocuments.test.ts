import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

import express from "express";

import type {
  ProjectDocument,
  ProjectDocumentFolder,
  ProjectDocumentSmartCollection,
  ProjectDocumentTag,
} from "../../../src/projectDocument.ts";
import type { ProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import type { OctoBaseClient } from "./octobaseClient.ts";
import {
  mountProjectDocumentRoutes,
  mountPublicProjectDocumentRoutes,
} from "./projectDocuments.ts";

const document: ProjectDocument = {
  id: 41,
  projectId: 7,
  ownerUserId: 3,
  documentKey: "main",
  title: "Project notes",
  icon: "none",
  isFavorite: false,
  isTemplate: false,
  pageWidth: "standard",
  properties: [],
  octobaseDocumentId: "workspace-1",
  lastEditorMode: "page",
  integrationVersion: "integration-1",
  createdByUserId: 3,
  createdByEmail: "admin@localhost.test",
  lastEditedByUserId: 3,
  lastEditedByEmail: "admin@localhost.test",
  journalDate: null,
  trashedAt: null,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

const folder: ProjectDocumentFolder = {
  id: 8,
  projectId: 7,
  ownerUserId: 3,
  parentFolderId: null,
  name: "Planning",
  isFavorite: false,
  documentIds: [41],
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
};

const tag: ProjectDocumentTag = {
  id: 9,
  projectId: 7,
  ownerUserId: 3,
  name: "Priority",
  color: "blue",
  documentIds: [41],
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
};

const collection: ProjectDocumentSmartCollection = {
  id: 10,
  projectId: 7,
  ownerUserId: 3,
  name: "Product decisions",
  isFavorite: false,
  mode: "manual",
  rules: [],
  documentIds: [41],
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
};

async function serve(input: {
  enabled?: boolean;
  userId?: number;
  store?: Partial<ProjectDocumentStore>;
  octobaseClient?: Partial<OctoBaseClient>;
  objectStore?: ObjectStore;
}) {
  const store = {
    listOwned: async () => [document],
    listTrashed: async () => [],
    findByKey: async () => undefined,
    createForOwnedProject: async () => document,
    findOwned: async () => document,
    findTrashed: async () => undefined,
    updateMode: async () => document,
    updateMetadata: async () => document,
    trashOwned: async () => document,
    restoreOwned: async () => document,
    deleteTrashed: async () => true,
    ...input.store,
  } as ProjectDocumentStore;
  const octobaseClient = {
    accessToken: async () => "private-token",
    createWorkspace: async () => "workspace-1",
    deleteWorkspace: async () => undefined,
    ...input.octobaseClient,
  } as OctoBaseClient;
  const objects = new Map<string, { metadata: ObjectMetadata; body: Buffer }>();
  const objectStore =
    input.objectStore ??
    ({
      async put(value) {
        const created = !objects.has(value.key);
        const stored = {
          metadata: {
            key: value.key,
            sha256: value.sha256,
            byteSize: value.byteSize,
            contentType: value.contentType,
            accessClass: value.accessClass,
          },
          body: Buffer.from(value.body),
        };
        objects.set(value.key, stored);
        return { created, metadata: stored.metadata };
      },
      async head(key) {
        return objects.get(key)?.metadata;
      },
      async get(key) {
        const value = objects.get(key);
        if (!value)
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return value;
      },
      async signedGetUrl() {
        return undefined;
      },
      async *list(prefix = "") {
        for (const [key, value] of objects) {
          if (key.startsWith(prefix)) yield value.metadata;
        }
      },
      async delete(key) {
        return objects.delete(key);
      },
    } satisfies ObjectStore);
  const app = express();
  app.use(express.json());
  mountPublicProjectDocumentRoutes(app, {
    enabled: input.enabled ?? true,
    store,
    objectStore,
  });
  app.use((_req, res, next) => {
    res.locals.user = { id: input.userId ?? 3, role: "user" };
    next();
  });
  mountProjectDocumentRoutes(app, {
    enabled: input.enabled ?? true,
    testProjectId: 7,
    store,
    octobaseClient,
    objectStore,
    appUrl: "https://astryx.test",
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return {
    base: `http://127.0.0.1:${address.port}`,
    server,
  };
}

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("feature flag and test Project boundary hide document routes", async (t) => {
  const disabled = await serve({ enabled: false });
  t.after(() => close(disabled.server));
  assert.equal(
    (
      await fetch(`${disabled.base}/research-projects/7/document`, {
        method: "POST",
      })
    ).status,
    404,
  );

  const enabled = await serve({});
  t.after(() => close(enabled.server));
  assert.equal(
    (
      await fetch(`${enabled.base}/research-projects/8/document`, {
        method: "POST",
      })
    ).status,
    404,
  );
});

test("bootstrap creates one private workspace and omits its ID and token", async (t) => {
  let workspaces = 0;
  const instance = await serve({
    octobaseClient: {
      createWorkspace: async () => {
        workspaces += 1;
        return "workspace-1";
      },
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/document`,
    { method: "POST" },
  );
  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 201);
  assert.equal(workspaces, 1);
  assert.equal(body.created, true);
  assert.equal(body.syncBaseUrl, "/api/project-document-sync/7");
  assert.equal(body.blobBaseUrl, "/api/research-projects/7/document/41/blobs");
  assert.doesNotMatch(
    JSON.stringify(body),
    /workspace-1|private-token|octobaseDocumentId/,
  );
});

test("repeated bootstrap returns existing metadata without another workspace", async (t) => {
  let workspaces = 0;
  const instance = await serve({
    store: { findByKey: async () => document },
    octobaseClient: {
      createWorkspace: async () => {
        workspaces += 1;
        return "workspace-2";
      },
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/document`,
    { method: "POST" },
  );
  assert.equal(response.status, 200);
  assert.equal(workspaces, 0);
  assert.equal(
    ((await response.json()) as { created: boolean }).created,
    false,
  );
});

test("lists only public owner-scoped document metadata", async (t) => {
  const instance = await serve({
    store: {
      listOwned: async () => [
        document,
        {
          ...document,
          id: 42,
          documentKey: "doc-2",
          title: "Product brief",
          octobaseDocumentId: "workspace-2",
        },
      ],
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/documents`,
  );
  const body = (await response.json()) as {
    documents: Array<Record<string, unknown>>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.documents.map((item) => item.title),
    ["Project notes", "Product brief"],
  );
  assert.doesNotMatch(
    JSON.stringify(body),
    /workspace-[12]|octobaseDocumentId/,
  );
});

test("searches document body text and updates the owner-scoped index", async (t) => {
  const calls: unknown[][] = [];
  const { octobaseDocumentId: _octobaseDocumentId, ...publicDocument } =
    document;
  const instance = await serve({
    store: {
      searchOwned: async (...args) => {
        calls.push(args);
        return [
          {
            document: publicDocument,
            snippet: "Acceptance criteria cover offline editing.",
          },
        ];
      },
      updateSearchText: async (...args) => {
        calls.push(args);
        return true;
      },
    },
  });
  t.after(() => close(instance.server));

  const searched = await fetch(
    `${instance.base}/research-projects/7/documents/search?q=acceptance%20criteria`,
  );
  const indexed = await fetch(
    `${instance.base}/research-projects/7/document/41/search-index`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Acceptance criteria cover offline editing." }),
    },
  );

  assert.equal(searched.status, 200);
  assert.match(await searched.text(), /Acceptance criteria/);
  assert.equal(indexed.status, 204);
  assert.deepEqual(calls, [
    [3, 7, "acceptance criteria"],
    [3, 7, 41, "Acceptance criteria cover offline editing."],
  ]);
});

test("keeps document search readable but indexing read-only for viewers", async (t) => {
  const instance = await serve({
    userId: 9,
    store: {
      accessForUser: async () => ({ ownerUserId: 3, role: "viewer" }),
      searchOwned: async () => [],
      updateSearchText: async () => true,
    },
  });
  t.after(() => close(instance.server));

  assert.equal(
    (
      await fetch(
        `${instance.base}/research-projects/7/documents/search?q=decision`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(
        `${instance.base}/research-projects/7/document/41/search-index`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Decision" }),
        },
      )
    ).status,
    403,
  );
});

test("returns folders and tags with the public document collection", async (t) => {
  const instance = await serve({
    store: {
      listFolders: async () => [folder],
      listTags: async () => [tag],
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/documents`,
  );
  const body = (await response.json()) as {
    folders: ProjectDocumentFolder[];
    tags: ProjectDocumentTag[];
  };

  assert.equal(response.status, 200);
  assert.equal(body.folders[0]?.name, "Planning");
  assert.equal(body.tags[0]?.name, "Priority");
});

test("creates nested folders and replaces their owner-scoped documents", async (t) => {
  const createCalls: unknown[][] = [];
  const assignmentCalls: unknown[][] = [];
  const instance = await serve({
    store: {
      listFolders: async () => [folder],
      listTags: async () => [],
      createFolder: async (...args) => {
        createCalls.push(args);
        return { ...folder, parentFolderId: 4 };
      },
      setFolderDocuments: async (...args) => {
        assignmentCalls.push(args);
        return true;
      },
    },
  });
  t.after(() => close(instance.server));

  const created = await fetch(
    `${instance.base}/research-projects/7/document-folders`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Research ", parentFolderId: 4 }),
    },
  );
  const assigned = await fetch(
    `${instance.base}/research-projects/7/document-folders/8/documents`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds: [41, 42] }),
    },
  );

  assert.equal(created.status, 201);
  assert.deepEqual(createCalls[0], [
    3,
    7,
    { name: "Research", parentFolderId: 4 },
  ]);
  assert.equal(assigned.status, 200);
  assert.deepEqual(assignmentCalls[0], [3, 7, 8, [41, 42]]);
});

test("creates tags and replaces owner-scoped document assignments", async (t) => {
  const createCalls: unknown[][] = [];
  const assignmentCalls: unknown[][] = [];
  const instance = await serve({
    store: {
      listFolders: async () => [],
      listTags: async () => [tag],
      createTag: async (...args) => {
        createCalls.push(args);
        return tag;
      },
      setDocumentTags: async (...args) => {
        assignmentCalls.push(args);
        return true;
      },
    },
  });
  t.after(() => close(instance.server));

  const created = await fetch(
    `${instance.base}/research-projects/7/document-tags`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Priority ", color: "blue" }),
    },
  );
  const assigned = await fetch(
    `${instance.base}/research-projects/7/document/41/tags`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagIds: [9] }),
    },
  );

  assert.equal(created.status, 201);
  assert.deepEqual(createCalls[0], [3, 7, { name: "Priority", color: "blue" }]);
  assert.equal(assigned.status, 200);
  assert.deepEqual(assignmentCalls[0], [3, 7, 41, [9]]);
});

test("returns and replaces bi-directional document link metadata", async (t) => {
  const assignmentCalls: unknown[][] = [];
  const link = {
    projectId: 7,
    ownerUserId: 3,
    sourceDocumentId: 41,
    targetDocumentId: 42,
    createdAt: document.createdAt,
  };
  const instance = await serve({
    store: {
      listLinks: async () => [link],
      setDocumentLinks: async (...args) => {
        assignmentCalls.push(args);
        return true;
      },
    },
  });
  t.after(() => close(instance.server));

  const listed = await fetch(`${instance.base}/research-projects/7/documents`);
  const assigned = await fetch(
    `${instance.base}/research-projects/7/document/41/links`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds: [42] }),
    },
  );
  const listedBody = (await listed.json()) as { links: unknown[] };
  const assignedBody = (await assigned.json()) as { links: unknown[] };

  assert.equal(listed.status, 200);
  assert.deepEqual(listedBody.links, [link]);
  assert.equal(assigned.status, 200);
  assert.deepEqual(assignmentCalls[0], [3, 7, 41, [42]]);
  assert.deepEqual(assignedBody.links, [link]);
});

test("lists, creates, resolves, and reopens document comments", async (t) => {
  const calls: unknown[][] = [];
  const comment = {
    id: 12,
    projectId: 7,
    documentId: 41,
    authorUserId: 3,
    authorEmail: "admin@localhost.test",
    body: "Confirm the rollout metric.",
    blockId: "block-1",
    quote: "rollout metric",
    resolvedAt: null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
  const instance = await serve({
    store: {
      listComments: async (...args) => {
        calls.push(["list", ...args]);
        return [comment];
      },
      createComment: async (...args) => {
        calls.push(["create", ...args]);
        return comment;
      },
      resolveComment: async (...args) => {
        calls.push(["resolve", ...args]);
        return {
          ...comment,
          resolvedAt: args[4] ? "2026-07-31T09:00:00.000Z" : null,
        };
      },
    },
  });
  t.after(() => close(instance.server));

  const listed = await fetch(
    `${instance.base}/research-projects/7/document/41/comments`,
  );
  const created = await fetch(
    `${instance.base}/research-projects/7/document/41/comments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: " Confirm the rollout metric. ",
        blockId: "block-1",
        quote: " rollout metric ",
      }),
    },
  );
  const resolved = await fetch(
    `${instance.base}/research-projects/7/document/41/comments/12`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    },
  );
  const reopened = await fetch(
    `${instance.base}/research-projects/7/document/41/comments/12`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved: false }),
    },
  );

  assert.equal(listed.status, 200);
  assert.equal(created.status, 201);
  assert.equal(resolved.status, 200);
  assert.equal(reopened.status, 200);
  assert.deepEqual(await listed.json(), [comment]);
  assert.deepEqual(await created.json(), comment);
  assert.equal(
    ((await resolved.json()) as { resolvedAt: string }).resolvedAt,
    "2026-07-31T09:00:00.000Z",
  );
  assert.equal(
    ((await reopened.json()) as { resolvedAt: string | null }).resolvedAt,
    null,
  );
  assert.deepEqual(calls, [
    ["list", 3, 7, 41],
    [
      "create",
      3,
      7,
      41,
      "Confirm the rollout metric.",
      3,
      { blockId: "block-1", quote: "rollout metric" },
    ],
    ["resolve", 3, 7, 41, 12, true],
    ["resolve", 3, 7, 41, 12, false],
  ]);
});

test("creates collections and replaces owner-scoped memberships", async (t) => {
  const createCalls: unknown[][] = [];
  const assignmentCalls: unknown[][] = [];
  const instance = await serve({
    store: {
      listCollections: async () => [collection],
      createCollection: async (...args) => {
        createCalls.push(args);
        return collection;
      },
      setCollectionDocuments: async (...args) => {
        assignmentCalls.push(args);
        return true;
      },
    },
  });
  t.after(() => close(instance.server));

  const created = await fetch(
    `${instance.base}/research-projects/7/document-collections`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Product decisions " }),
    },
  );
  const assigned = await fetch(
    `${instance.base}/research-projects/7/document-collections/10/documents`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds: [41] }),
    },
  );

  assert.equal(created.status, 201);
  assert.deepEqual(createCalls[0], [3, 7, { name: "Product decisions" }]);
  assert.equal(assigned.status, 200);
  assert.deepEqual(assignmentCalls[0], [3, 7, 10, [41]]);
});

test("creates and reopens one journal per calendar date", async (t) => {
  const createCalls: unknown[][] = [];
  const instance = await serve({
    store: {
      createForOwnedProject: async (...args) => {
        createCalls.push(args);
        const input = args[2] as {
          documentKey: string;
          title: string;
          journalDate?: string;
        };
        return {
          ...document,
          documentKey: input.documentKey,
          title: input.title,
          journalDate: input.journalDate ?? null,
        };
      },
    },
    octobaseClient: {
      createWorkspace: async () => "journal-workspace",
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/journals/2026-07-31`,
    { method: "POST" },
  );
  const body = (await response.json()) as {
    created: boolean;
    document: { title: string; journalDate: string };
  };

  assert.equal(response.status, 201);
  assert.equal(body.created, true);
  assert.equal(body.document.title, "July 31, 2026");
  assert.equal(body.document.journalDate, "2026-07-31");
  assert.equal(
    (createCalls[0]?.[2] as { documentKey?: string }).documentKey,
    "journal-2026-07-31",
  );
  assert.doesNotMatch(JSON.stringify(body), /journal-workspace/);
});

test("creates and reopens an owner-scoped document workspace", async (t) => {
  const createCalls: unknown[][] = [];
  const instance = await serve({
    store: {
      createForOwnedProject: async (...args) => {
        createCalls.push(args);
        return {
          ...document,
          id: 42,
          documentKey: String((args[2] as { documentKey: string }).documentKey),
          title: "Product brief",
          octobaseDocumentId: "workspace-2",
        };
      },
      findOwned: async (_userId, _projectId, documentId) =>
        documentId === 42
          ? {
              ...document,
              id: 42,
              documentKey: "doc-2",
              title: "Product brief",
              octobaseDocumentId: "workspace-2",
            }
          : undefined,
    },
    octobaseClient: {
      createWorkspace: async () => "workspace-2",
    },
  });
  t.after(() => close(instance.server));

  const created = await fetch(
    `${instance.base}/research-projects/7/documents`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: " Product brief " }),
    },
  );
  const createdBody = (await created.json()) as {
    document: { id: number; title: string };
  };
  assert.equal(created.status, 201);
  assert.equal(createdBody.document.id, 42);
  assert.equal(createdBody.document.title, "Product brief");
  assert.match(
    String(
      (createCalls[0]?.[2] as { documentKey?: string } | undefined)
        ?.documentKey,
    ),
    /^doc-[0-9a-f-]{36}$/,
  );

  const reopened = await fetch(
    `${instance.base}/research-projects/7/document/42`,
  );
  assert.equal(reopened.status, 200);
  assert.equal(
    ((await reopened.json()) as { document: { id: number } }).document.id,
    42,
  );
});

test("moves documents to trash, restores them, and deletes private workspaces", async (t) => {
  const calls: unknown[][] = [];
  const deletedWorkspaces: string[] = [];
  const trashedDocument = {
    ...document,
    trashedAt: "2026-07-31T08:00:00.000Z",
  };
  const instance = await serve({
    store: {
      listOwned: async () => [],
      listTrashed: async () => [trashedDocument],
      trashOwned: async (...args) => {
        calls.push(["trash", ...args]);
        return trashedDocument;
      },
      restoreOwned: async (...args) => {
        calls.push(["restore", ...args]);
        return document;
      },
      findTrashed: async (...args) => {
        calls.push(["find", ...args]);
        return trashedDocument;
      },
      deleteTrashed: async (...args) => {
        calls.push(["delete", ...args]);
        return true;
      },
    },
    octobaseClient: {
      deleteWorkspace: async (workspaceId) => {
        deletedWorkspaces.push(workspaceId);
      },
    },
  });
  t.after(() => close(instance.server));

  const trashed = await fetch(
    `${instance.base}/research-projects/7/document/41/trash`,
    { method: "PATCH" },
  );
  assert.equal(trashed.status, 200);
  assert.equal(
    ((await trashed.json()) as { trash: ProjectDocument[] }).trash[0]
      ?.trashedAt,
    "2026-07-31T08:00:00.000Z",
  );

  const restored = await fetch(
    `${instance.base}/research-projects/7/document/41/restore`,
    { method: "PATCH" },
  );
  assert.equal(restored.status, 200);

  const deleted = await fetch(
    `${instance.base}/research-projects/7/document/41/permanent`,
    { method: "DELETE" },
  );
  assert.equal(deleted.status, 204);
  assert.deepEqual(deletedWorkspaces, ["workspace-1"]);
  assert.deepEqual(calls, [
    ["trash", 3, 7, 41],
    ["restore", 3, 7, 41],
    ["find", 3, 7, 41],
    ["delete", 3, 7, 41],
  ]);
});

test("mode updates validate input and remain owner scoped", async (t) => {
  const calls: unknown[][] = [];
  const instance = await serve({
    store: {
      updateMode: async (...args) => {
        calls.push(args);
        return { ...document, lastEditorMode: "edgeless" };
      },
    },
  });
  t.after(() => close(instance.server));

  const invalid = await fetch(
    `${instance.base}/research-projects/7/document/41/mode`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "canvas" }),
    },
  );
  assert.equal(invalid.status, 400);

  const valid = await fetch(
    `${instance.base}/research-projects/7/document/41/mode`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "edgeless" }),
    },
  );
  assert.equal(valid.status, 200);
  assert.deepEqual(calls[0], [3, 7, 41, "edgeless", 3]);
});

test("page metadata updates validate and remain owner scoped", async (t) => {
  const calls: unknown[][] = [];
  const instance = await serve({
    store: {
      updateMetadata: async (...args) => {
        calls.push(args);
        return { ...document, title: "Product brief", icon: "idea" };
      },
    },
  });
  t.after(() => close(instance.server));

  const invalid = await fetch(
    `${instance.base}/research-projects/7/document/41/metadata`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "",
        icon: "rocket",
        isFavorite: "yes",
        pageWidth: "wide",
        properties: "invalid",
      }),
    },
  );
  assert.equal(invalid.status, 400);

  const valid = await fetch(
    `${instance.base}/research-projects/7/document/41/metadata`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: " Product brief ",
        icon: "idea",
        isFavorite: true,
        pageWidth: "full",
        properties: [
          {
            id: "status",
            name: "Status",
            type: "text",
            value: "Ready",
          },
        ],
      }),
    },
  );
  assert.equal(valid.status, 200);
  assert.deepEqual(calls[0], [
    3,
    7,
    41,
    {
      title: "Product brief",
      icon: "idea",
      isFavorite: true,
      pageWidth: "full",
      properties: [
        {
          id: "status",
          name: "Status",
          type: "text",
          value: "Ready",
        },
      ],
    },
    3,
  ]);
});

test("captures and clears reusable document templates", async (t) => {
  const calls: Array<Uint8Array | undefined> = [];
  const instance = await serve({
    store: {
      updateTemplate: async (
        _userId,
        _projectId,
        _documentId,
        snapshot,
      ) => {
        calls.push(snapshot);
        return { ...document, isTemplate: snapshot !== undefined };
      },
    },
  });
  t.after(() => close(instance.server));

  const enabled = await fetch(
    `${instance.base}/research-projects/7/document/41/template`,
    {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from([1, 2, 3]),
    },
  );
  const disabled = await fetch(
    `${instance.base}/research-projects/7/document/41/template`,
    { method: "DELETE" },
  );

  assert.equal(enabled.status, 200);
  assert.equal(
    ((await enabled.json()) as { isTemplate: boolean }).isTemplate,
    true,
  );
  assert.equal(disabled.status, 200);
  assert.equal(
    ((await disabled.json()) as { isTemplate: boolean }).isTemplate,
    false,
  );
  assert.deepEqual(calls[0], new Uint8Array([1, 2, 3]));
  assert.equal(calls[1], undefined);
});

test("creates an independent document from a full reusable template", async (t) => {
  const snapshot = new Uint8Array([4, 5, 6]);
  const template = { ...document, isTemplate: true, title: "Launch brief" };
  const createdDocument = {
    ...document,
    id: 42,
    documentKey: "copy",
    title: "Launch brief",
    octobaseDocumentId: "workspace-copy",
  };
  let createdWorkspace = false;
  const instance = await serve({
    store: {
      findOwned: async (_userId, _projectId, documentId) =>
        documentId === 41 ? template : createdDocument,
      getTemplateSnapshot: async () => snapshot,
      createForOwnedProject: async () => createdDocument,
      updateMetadata: async () => createdDocument,
      updateMode: async () => createdDocument,
    },
    octobaseClient: {
      createWorkspace: async () => {
        createdWorkspace = true;
        return "workspace-copy";
      },
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/documents/from-template/41`,
    { method: "POST" },
  );
  const body = (await response.json()) as {
    bootstrap: { document: { id: number; isTemplate: boolean } };
    snapshotBase64: string;
  };

  assert.equal(response.status, 201);
  assert.equal(createdWorkspace, true);
  assert.equal(body.bootstrap.document.id, 42);
  assert.equal(body.bootstrap.document.isTemplate, false);
  assert.equal(
    body.snapshotBase64,
    Buffer.from(snapshot).toString("base64"),
  );
});

test("stores, lists, serves, and removes owner-scoped BlockSuite blobs", async (t) => {
  const instance = await serve({});
  t.after(() => close(instance.server));
  const blobId = "source_AbC123";
  const bytes = Buffer.from("durable-image");
  const base = `${instance.base}/research-projects/7/document/41/blobs`;

  const uploaded = await fetch(`${base}/${blobId}`, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: bytes,
  });
  assert.equal(uploaded.status, 201);

  const listed = await fetch(base);
  assert.deepEqual(await listed.json(), { ids: [blobId] });

  const downloaded = await fetch(`${base}/${blobId}`);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);

  const removed = await fetch(`${base}/${blobId}`, { method: "DELETE" });
  assert.equal(removed.status, 204);
  assert.equal((await fetch(`${base}/${blobId}`)).status, 404);
});

test("keeps viewer blob access read-only", async (t) => {
  const instance = await serve({
    userId: 8,
    store: {
      accessForUser: async () => ({ ownerUserId: 3, role: "viewer" }),
    },
  });
  t.after(() => close(instance.server));

  const response = await fetch(
    `${instance.base}/research-projects/7/document/41/blobs/source_1`,
    {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: Buffer.from("viewer-write"),
    },
  );
  assert.equal(response.status, 403);
});

test("creates, lists, and safely restores document versions", async (t) => {
  const snapshot = new Uint8Array([1, 2, 3, 4]);
  const version = {
    id: 18,
    projectId: 7,
    documentId: 41,
    createdByUserId: 3,
    createdByEmail: "admin@localhost.test",
    label: "Review ready",
    byteSize: snapshot.byteLength,
    createdAt: "2026-07-31T11:00:00.000Z",
  };
  const deleted: string[] = [];
  let replaceArgs: readonly unknown[] = [];
  const instance = await serve({
    store: {
      listVersions: async () => [version],
      createVersion: async (
        _ownerUserId,
        _projectId,
        _documentId,
        _actorUserId,
        label,
        bytes,
      ) => ({ ...version, label, byteSize: bytes.byteLength }),
      getVersion: async () => ({ version, snapshot }),
      replaceWorkspace: async (...args) => {
        replaceArgs = args;
        return {
          ...document,
          octobaseDocumentId: "workspace-restored",
        };
      },
    },
    octobaseClient: {
      createWorkspace: async () => "workspace-restored",
      deleteWorkspace: async (workspaceId) => {
        deleted.push(workspaceId);
      },
    },
  });
  t.after(() => close(instance.server));

  const list = await fetch(
    `${instance.base}/research-projects/7/document/41/versions`,
  );
  assert.equal(list.status, 200);
  assert.equal(((await list.json()) as unknown[]).length, 1);

  const created = await fetch(
    `${instance.base}/research-projects/7/document/41/versions` +
      "?label=Review%20ready",
    {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from(snapshot),
    },
  );
  assert.equal(created.status, 201);
  assert.equal(
    ((await created.json()) as { byteSize: number }).byteSize,
    snapshot.byteLength,
  );

  const restored = await fetch(
    `${instance.base}/research-projects/7/document/41/versions/18/restore`,
    { method: "POST" },
  );
  const restoredBody = (await restored.json()) as {
    bootstrap: { syncInstanceId: string };
    snapshotBase64: string;
  };
  assert.equal(restored.status, 200);
  assert.match(restoredBody.bootstrap.syncInstanceId, /^[0-9a-f]{24}$/);
  assert.equal(
    restoredBody.snapshotBase64,
    Buffer.from(snapshot).toString("base64"),
  );
  assert.deepEqual(replaceArgs, [
    3,
    7,
    41,
    "workspace-1",
    "workspace-restored",
    3,
  ]);
  assert.deepEqual(deleted, ["workspace-1"]);
});

test("creates, serves, lists, and revokes live read-only shares", async (t) => {
  let active = true;
  let tokenHash = "";
  const share = {
    id: 15,
    projectId: 7,
    documentId: 41,
    createdAt: "2026-07-31T10:00:00.000Z",
  };
  const instance = await serve({
    store: {
      listShares: async () => (active ? [share] : []),
      createShare: async (_userId, _projectId, _documentId, hash) => {
        tokenHash = hash;
        active = true;
        return share;
      },
      revokeShare: async () => {
        active = false;
        return true;
      },
      publicShare: async () =>
        active
          ? {
              document,
              sharedAt: share.createdAt,
            }
          : undefined,
    },
  });
  t.after(() => close(instance.server));

  const createdResponse = await fetch(
    `${instance.base}/research-projects/7/document/41/shares`,
    { method: "POST" },
  );
  const created = (await createdResponse.json()) as {
    id: number;
    url: string;
  };
  assert.equal(createdResponse.status, 201);
  assert.equal(created.id, 15);
  assert.match(
    created.url,
    /^https:\/\/astryx\.test\/project-document-shares\/[A-Za-z0-9_-]{43}$/,
  );
  assert.match(tokenHash, /^[0-9a-f]{64}$/);

  const token = created.url.split("/").at(-1)!;
  const publicResponse = await fetch(
    `${instance.base}/project-document-shares/${token}`,
  );
  const publicBody = (await publicResponse.json()) as Record<string, unknown>;
  assert.equal(publicResponse.status, 200);
  assert.equal(
    publicBody.syncBaseUrl,
    `/api/project-document-share-sync/${token}`,
  );
  assert.equal(
    publicBody.blobBaseUrl,
    `/api/project-document-shares/${token}/blobs`,
  );
  assert.equal(
    JSON.stringify(publicBody).includes("octobaseDocumentId"),
    false,
  );

  const privateBlobBase = `${instance.base}/research-projects/7/document/41/blobs`;
  assert.equal(
    (
      await fetch(`${privateBlobBase}/shared_blob`, {
        method: "PUT",
        headers: { "content-type": "application/pdf" },
        body: Buffer.from("shared-pdf"),
      })
    ).status,
    201,
  );
  const publicBlob = await fetch(
    `${instance.base}/project-document-shares/${token}/blobs/shared_blob`,
  );
  assert.equal(publicBlob.status, 200);
  assert.equal(publicBlob.headers.get("content-type"), "application/pdf");
  assert.equal(await publicBlob.text(), "shared-pdf");

  const listed = await fetch(
    `${instance.base}/research-projects/7/document/41/shares`,
  );
  assert.equal(((await listed.json()) as unknown[]).length, 1);

  const revoked = await fetch(
    `${instance.base}/research-projects/7/document/41/shares/15`,
    { method: "DELETE" },
  );
  assert.equal(revoked.status, 204);
  assert.equal(
    (await fetch(`${instance.base}/project-document-shares/${token}`)).status,
    404,
  );
});
