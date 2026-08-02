import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";

import { createProjectDocumentStore } from "./projectDocumentStore.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const result = (
  rows: Array<Record<string, unknown>>,
  rowCount = rows.length,
): QueryResult<Record<string, unknown>> => ({
  command: "SELECT",
  rowCount,
  oid: 0,
  fields: [],
  rows,
});

test("creates the project document through the research project owner", async () => {
  const statements: string[] = [];
  let call = 0;
  const store = createProjectDocumentStore(
    async () => result([]),
    async (work) => work(async (sql) => {
      statements.push(sql);
      call += 1;
      if (call === 1) return result([]);
      if (call === 2) return result([{ id: 41 }], 1);
      return result([{
        id: 41,
        project_public_id: PROJECT_ID,
        title: "Checkout notes",
        icon: "document",
        is_favorite: false,
        page_width: "standard",
        collaboration_document_id: "22222222-2222-4222-8222-222222222222",
        role: "editor",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      }]);
    }),
  );

  const document = await store.ensureDocument(7, PROJECT_ID);
  const insert = statements[1];

  assert.equal(document?.id, 41);
  assert.match(insert, /project\.user_id/);
  assert.doesNotMatch(insert, /project\.owner_user_id/);
  assert.match(insert, /ON CONFLICT \(project_id, document_key\) DO NOTHING/);
  assert.equal(document?.icon, "document");
  assert.equal(document?.pageWidth, "standard");
});

test("updates Notion-style page metadata only for editors", async () => {
  const statements: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const store = createProjectDocumentStore(async (sql, values) => {
    statements.push({ sql, values });
    if (statements.length === 1) {
      return result([{
        id: 41,
        project_public_id: PROJECT_ID,
        title: "Checkout notes",
        icon: "document",
        is_favorite: false,
        page_width: "standard",
        collaboration_document_id: "22222222-2222-4222-8222-222222222222",
        role: "editor",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      }]);
    }
    if (statements.length === 2) return result([{ id: 41 }], 1);
    return result([{
      id: 41,
      project_public_id: PROJECT_ID,
      title: "Checkout decisions",
      icon: "idea",
      is_favorite: true,
      page_width: "full",
      collaboration_document_id: "22222222-2222-4222-8222-222222222222",
      role: "editor",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T01:00:00.000Z",
    }]);
  });

  const updated = await store.updateDocument(7, PROJECT_ID, {
    title: "Checkout decisions",
    icon: "idea",
    isFavorite: true,
    pageWidth: "full",
  });

  assert.equal(updated?.title, "Checkout decisions");
  assert.equal(updated?.isFavorite, true);
  assert.match(statements[1].sql, /last_edited_by_user_id/);
});

test("lists and creates page discussions for document editors", async () => {
  let call = 0;
  const store = createProjectDocumentStore(async () => {
    call += 1;
    if (call === 1 || call === 3) {
      return result([{
        id: 41,
        project_public_id: PROJECT_ID,
        title: "Checkout notes",
        icon: "none",
        is_favorite: false,
        page_width: "standard",
        collaboration_document_id: "22222222-2222-4222-8222-222222222222",
        role: "editor",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      }]);
    }
    return result([{
      id: 9,
      body: "Clarify the approval step",
      resolved_at: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      author_user_id: 7,
      author_email: "po@example.com",
    }]);
  });

  const comments = await store.listComments(7, PROJECT_ID);
  const created = await store.addComment(7, PROJECT_ID, "Clarify the approval step");

  assert.equal(comments?.[0].authorEmail, "po@example.com");
  assert.equal(created?.body, "Clarify the approval step");
});

test("lets viewers read discussion but blocks document and discussion mutations", async () => {
  const statements: string[] = [];
  const store = createProjectDocumentStore(async (sql) => {
    statements.push(sql);
    if (sql.includes("FROM project_document_comments")) {
      return result([{
        id: 9,
        body: "Clarify the approval step",
        resolved_at: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        author_user_id: 7,
        author_email: "po@example.com",
      }]);
    }
    return result([{
      id: 41,
      project_public_id: PROJECT_ID,
      title: "Checkout notes",
      icon: "document",
      is_favorite: false,
      page_width: "standard",
      collaboration_document_id: "22222222-2222-4222-8222-222222222222",
      role: "viewer",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    }]);
  });

  assert.equal((await store.listComments(8, PROJECT_ID))?.length, 1);
  assert.equal(await store.updateDocument(8, PROJECT_ID, { title: "Blocked" }), undefined);
  assert.equal(await store.addComment(8, PROJECT_ID, "Blocked"), undefined);
  assert.equal(await store.resolveComment(8, PROJECT_ID, 9, true), undefined);
  assert.equal(statements.some((sql) => sql.includes("UPDATE project_documents")), false);
  assert.equal(statements.some((sql) => sql.includes("INSERT INTO project_document_comments")), false);
  assert.equal(statements.some((sql) => sql.includes("UPDATE project_document_comments")), false);
});

test("rejects oversized realtime states before opening a transaction", async () => {
  let transactionCalled = false;
  const store = createProjectDocumentStore(
    async () => result([]),
    async (work) => {
      transactionCalled = true;
      return work(async () => result([]));
    },
  );

  await assert.rejects(
    store.storeRealtimeState("document", new Uint8Array(8 * 1024 * 1024 + 1)),
    /exceeds the supported size/,
  );
  assert.equal(transactionCalled, false);
});
