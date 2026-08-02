import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addProjectDocumentComment,
  ensureProjectDocument,
  listProjectDocumentComments,
  ProjectDocumentApiError,
  updateProjectDocument,
} from "./projectDocumentsApi.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

test("bootstraps a project document through the authenticated project route", async (t) => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({
      id: 41,
      projectId: PROJECT_ID,
      title: "Checkout notes",
      icon: "document",
      isFavorite: false,
      pageWidth: "standard",
      collaborationDocumentId: "22222222-2222-4222-8222-222222222222",
      role: "editor",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  };

  const document = await ensureProjectDocument(PROJECT_ID);

  assert.equal(document.id, 41);
  assert.equal(calls[0].url, `/api/research-projects/${PROJECT_ID}/document`);
  assert.equal(calls[0].init?.method, "POST");
});

test("updates page metadata and sends page discussion requests", async (t) => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/comments") && init?.method !== "POST") return Response.json([]);
    if (String(input).endsWith("/comments")) return Response.json({ id: 9 }, { status: 201 });
    return Response.json({ title: "Checkout decisions" });
  };

  await updateProjectDocument(PROJECT_ID, { title: "Checkout decisions", pageWidth: "full" });
  await listProjectDocumentComments(PROJECT_ID);
  await addProjectDocumentComment(PROJECT_ID, "Clarify the approval step");

  assert.equal(calls[0].init?.method, "PATCH");
  assert.equal(calls[1].url, `/api/research-projects/${PROJECT_ID}/document/comments`);
  assert.equal(calls[2].init?.method, "POST");
});

test("surfaces project document API failures", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json(
    { error: "Project document not found" },
    { status: 404 },
  );

  await assert.rejects(
    ensureProjectDocument(PROJECT_ID),
    (error: unknown) => error instanceof ProjectDocumentApiError
      && error.status === 404
      && error.message === "Project document not found",
  );
});
