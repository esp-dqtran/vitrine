import assert from "node:assert/strict";
import test from "node:test";

import {
  bootstrapProjectDocument,
  createProjectDocumentCollection,
  createProjectDocumentComment,
  createProjectDocumentFolder,
  createProjectDocumentJournal,
  createProjectDocumentShare,
  createProjectDocumentVersion,
  createProjectDocumentTag,
  createProjectDocument,
  createProjectDocumentFromTemplate,
  deleteProjectDocumentFolder,
  deleteProjectDocumentCollection,
  deleteProjectDocumentTag,
  listProjectDocuments,
  listProjectDocumentComments,
  listProjectDocumentShares,
  listProjectDocumentVersions,
  searchProjectDocuments,
  getPublicProjectDocumentShare,
  permanentlyDeleteProjectDocument,
  restoreProjectDocument,
  restoreProjectDocumentVersion,
  resolveProjectDocumentComment,
  revokeProjectDocumentShare,
  setProjectDocumentFolderDocuments,
  setProjectDocumentCollectionDocuments,
  setProjectDocumentTags,
  trashProjectDocument,
  updateProjectDocumentFolder,
  updateProjectDocumentCollection,
  updateProjectDocumentMetadata,
  updateProjectDocumentMode,
  updateProjectDocumentSearchIndex,
  updateProjectDocumentTag,
  updateProjectDocumentTemplate,
} from "./projectDocumentsApi.ts";

test("bootstraps the Project document with POST", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({
      document: { id: 41 },
      created: true,
      syncBaseUrl: "/api/project-document-sync/7",
      blobBaseUrl: "/api/research-projects/7/document/41/blobs",
    });
  };

  await bootstrapProjectDocument(7);

  assert.equal(calls[0]?.url, "/api/research-projects/7/document");
  assert.equal(calls[0]?.init?.method, "POST");
});

test("reopens a selected document and lists the workspace", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("/documents")
        ? { documents: [{ id: 41, title: "Project notes" }] }
        : {
            document: { id: 41, title: "Project notes" },
            created: false,
            syncBaseUrl: "/api/project-document-sync/7",
            blobBaseUrl: "/api/research-projects/7/document/41/blobs",
          },
    );
  };

  await bootstrapProjectDocument(7, 41);
  await listProjectDocuments(7);

  assert.equal(calls[0]?.url, "/api/research-projects/7/document/41");
  assert.equal(calls[0]?.init, undefined);
  assert.equal(calls[1]?.url, "/api/research-projects/7/documents");
});

test("searches document contents and updates the persistent search index", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return init?.method === "PATCH"
      ? new Response(null, { status: 204 })
      : Response.json([]);
  };

  await searchProjectDocuments(7, "acceptance criteria");
  await updateProjectDocumentSearchIndex(
    7,
    41,
    "Acceptance criteria cover offline editing.",
  );

  assert.equal(
    calls[0]?.url,
    "/api/research-projects/7/documents/search?q=acceptance%20criteria",
  );
  assert.equal(
    calls[1]?.url,
    "/api/research-projects/7/document/41/search-index",
  );
  assert.equal(calls[1]?.init?.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
    text: "Acceptance criteria cover offline editing.",
  });
});

test("creates a new Project document", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      {
        document: { id: 42, title: "Untitled" },
        created: true,
        syncBaseUrl: "/api/project-document-sync/7",
        blobBaseUrl: "/api/research-projects/7/document/42/blobs",
      },
      { status: 201 },
    );
  };

  await createProjectDocument(7);

  assert.equal(calls[0]?.url, "/api/research-projects/7/documents");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    title: "Untitled",
  });
});

test("captures and instantiates reusable document templates", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).includes("/from-template/")
        ? {
            bootstrap: {
              document: { id: 42, title: "Launch brief" },
              syncInstanceId: "sync-copy",
            },
            snapshotBase64: "AQID",
          }
        : { id: 41, isTemplate: init?.method === "PUT" },
      { status: String(url).includes("/from-template/") ? 201 : 200 },
    );
  };

  await updateProjectDocumentTemplate(7, 41, new Uint8Array([1, 2, 3]));
  await updateProjectDocumentTemplate(7, 41);
  await createProjectDocumentFromTemplate(7, 41);

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      ["PUT", "/api/research-projects/7/document/41/template"],
      ["DELETE", "/api/research-projects/7/document/41/template"],
      ["POST", "/api/research-projects/7/documents/from-template/41"],
    ],
  );
  assert.equal(
    (calls[0]?.init?.headers as Record<string, string>)["content-type"],
    "application/octet-stream",
  );
  assert.equal((calls[0]?.init?.body as Blob).type, "application/octet-stream");
});

test("updates the owner-scoped editor mode", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  };

  await updateProjectDocumentMode(7, 41, "edgeless");

  assert.equal(calls[0]?.url, "/api/research-projects/7/document/41/mode");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    mode: "edgeless",
  });
});

test("updates persistent Page metadata", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({
      id: 41,
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
    });
  };

  await updateProjectDocumentMetadata(7, 41, {
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
  });

  assert.equal(calls[0]?.url, "/api/research-projects/7/document/41/metadata");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
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
  });
});

test("maps folder and tag management calls to the organization API", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ documents: [], folders: [], tags: [] });
  };

  await createProjectDocumentFolder(7, {
    name: "Planning",
    parentFolderId: null,
  });
  await updateProjectDocumentFolder(7, 8, {
    name: "Research",
    isFavorite: true,
  });
  await setProjectDocumentFolderDocuments(7, 8, [41, 42]);
  await deleteProjectDocumentFolder(7, 8);
  await createProjectDocumentTag(7, { name: "Priority", color: "blue" });
  await updateProjectDocumentTag(7, 9, {
    name: "Urgent",
    color: "rose",
  });
  await setProjectDocumentTags(7, 41, [9]);
  await deleteProjectDocumentTag(7, 9);

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      ["POST", "/api/research-projects/7/document-folders"],
      ["PATCH", "/api/research-projects/7/document-folders/8"],
      ["PUT", "/api/research-projects/7/document-folders/8/documents"],
      ["DELETE", "/api/research-projects/7/document-folders/8"],
      ["POST", "/api/research-projects/7/document-tags"],
      ["PATCH", "/api/research-projects/7/document-tags/9"],
      ["PUT", "/api/research-projects/7/document/41/tags"],
      ["DELETE", "/api/research-projects/7/document-tags/9"],
    ],
  );
  assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
    documentIds: [41, 42],
  });
  assert.deepEqual(JSON.parse(String(calls[6]?.init?.body)), {
    tagIds: [9],
  });
});

test("maps collection and journal calls to the workspace API", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({
          documents: [],
          folders: [],
          tags: [],
          collections: [],
          document: { id: 43, journalDate: "2026-07-31" },
        });
  };

  await createProjectDocumentCollection(7, {
    name: "Product decisions",
  });
  await updateProjectDocumentCollection(7, 10, {
    name: "Important decisions",
    isFavorite: true,
    mode: "rules",
    rules: [{ field: "favorite", value: true }],
  });
  await setProjectDocumentCollectionDocuments(7, 10, [41, 42]);
  await deleteProjectDocumentCollection(7, 10);
  await createProjectDocumentJournal(7, "2026-07-31");

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      ["POST", "/api/research-projects/7/document-collections"],
      ["PATCH", "/api/research-projects/7/document-collections/10"],
      ["PUT", "/api/research-projects/7/document-collections/10/documents"],
      ["DELETE", "/api/research-projects/7/document-collections/10"],
      ["POST", "/api/research-projects/7/journals/2026-07-31"],
    ],
  );
  assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
    documentIds: [41, 42],
  });
});

test("maps document comment lifecycle calls to collaboration routes", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      init?.method
        ? {
            id: 12,
            body: "Confirm the rollout metric.",
            resolvedAt:
              init.method === "PATCH" && JSON.parse(String(init.body)).resolved
                ? "2026-07-31T09:00:00.000Z"
                : null,
          }
        : [],
      { status: init?.method === "POST" ? 201 : 200 },
    );
  };

  await listProjectDocumentComments(7, 41);
  await createProjectDocumentComment(7, 41, "Confirm the rollout metric.", {
    blockId: "block-1",
    quote: "rollout metric",
  });
  await resolveProjectDocumentComment(7, 41, 12, true);
  await resolveProjectDocumentComment(7, 41, 12, false);

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      [undefined, "/api/research-projects/7/document/41/comments"],
      ["POST", "/api/research-projects/7/document/41/comments"],
      ["PATCH", "/api/research-projects/7/document/41/comments/12"],
      ["PATCH", "/api/research-projects/7/document/41/comments/12"],
    ],
  );
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
    body: "Confirm the rollout metric.",
    blockId: "block-1",
    quote: "rollout metric",
  });
  assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
    resolved: true,
  });
  assert.deepEqual(JSON.parse(String(calls[3]?.init?.body)), {
    resolved: false,
  });
});

test("maps public Project Document share lifecycle calls", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return Response.json(
      String(url).startsWith("/api/project-document-shares/")
        ? {
            document: { id: 41, title: "Project notes" },
            syncBaseUrl: "/api/project-document-share-sync/public-token",
            blobBaseUrl: "/api/project-document-shares/public-token/blobs",
            sharedAt: "2026-07-31T10:00:00.000Z",
          }
        : init?.method === "POST"
          ? {
              id: 15,
              url: "https://astryx.test/project-document-shares/public-token",
            }
          : [],
      { status: init?.method === "POST" ? 201 : 200 },
    );
  };

  await listProjectDocumentShares(7, 41);
  await createProjectDocumentShare(7, 41);
  await revokeProjectDocumentShare(7, 41, 15);
  await getPublicProjectDocumentShare("public-token");

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      [undefined, "/api/research-projects/7/document/41/shares"],
      ["POST", "/api/research-projects/7/document/41/shares"],
      ["DELETE", "/api/research-projects/7/document/41/shares/15"],
      [undefined, "/api/project-document-shares/public-token"],
    ],
  );
});

test("maps Project Document version history and binary snapshots", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("/restore")
        ? {
            bootstrap: {
              document: { id: 41 },
              syncInstanceId: "restored-instance",
            },
            snapshotBase64: "AQID",
          }
        : init?.method === "POST"
          ? {
              id: 9,
              label: "Review ready",
              byteSize: 3,
            }
          : [],
      { status: init?.method === "POST" ? 201 : 200 },
    );
  };

  await listProjectDocumentVersions(7, 41);
  await createProjectDocumentVersion(
    7,
    41,
    "Review ready",
    new Uint8Array([1, 2, 3]),
  );
  await restoreProjectDocumentVersion(7, 41, 9);

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      [undefined, "/api/research-projects/7/document/41/versions"],
      [
        "POST",
        "/api/research-projects/7/document/41/versions?label=Review%20ready",
      ],
      ["POST", "/api/research-projects/7/document/41/versions/9/restore"],
    ],
  );
  assert.equal(
    calls[1]?.init?.headers &&
      new Headers(calls[1].init.headers).get("content-type"),
    "application/octet-stream",
  );
  assert.deepEqual(
    Array.from(
      new Uint8Array(await (calls[1]?.init?.body as Blob).arrayBuffer()),
    ),
    [1, 2, 3],
  );
});

test("maps trash lifecycle calls to owner-scoped document routes", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({
          documents: [],
          trash: [],
          folders: [],
          tags: [],
          collections: [],
        });
  };

  await trashProjectDocument(7, 41);
  await restoreProjectDocument(7, 41);
  await permanentlyDeleteProjectDocument(7, 41);

  assert.deepEqual(
    calls.map((call) => [call.init?.method, call.url]),
    [
      ["PATCH", "/api/research-projects/7/document/41/trash"],
      ["PATCH", "/api/research-projects/7/document/41/restore"],
      ["DELETE", "/api/research-projects/7/document/41/permanent"],
    ],
  );
});
