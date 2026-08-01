import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult } from "pg";

import {
  createProjectDocumentStore,
  type ProjectDocumentQuery,
} from "./projectDocumentStore.ts";

const result = (
  rows: Record<string, unknown>[] = [],
): QueryResult<Record<string, unknown>> => ({
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
  rows,
});

const row = {
  id: 41,
  project_id: 7,
  owner_user_id: 3,
  document_key: "main",
  title: "Project notes",
  icon: "none",
  is_favorite: false,
  is_template: false,
  page_width: "standard",
  properties: [],
  octobase_document_id: "workspace-1",
  last_editor_mode: "page",
  integration_version: "integration-1",
  created_by_user_id: 3,
  created_by_email: "admin@localhost.test",
  last_edited_by_user_id: 3,
  last_edited_by_email: "admin@localhost.test",
  journal_date: null,
  trashed_at: null,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
};

test("resolves owner and collaborator access without widening document queries", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ owner_user_id: 3, role: "editor" }]);
  };

  const access = await createProjectDocumentStore(query).accessForUser?.(9, 7);

  assert.deepEqual(access, { ownerUserId: 3, role: "editor" });
  assert.deepEqual(calls[0]?.values, [7, 9]);
  assert.match(calls[0]?.sql ?? "", /project_document_collaborators/);
  assert.match(
    calls[0]?.sql ?? "",
    /rp\.user_id = \$2 OR c\.user_id IS NOT NULL/,
  );
});

test("invites a registered non-owner by email with an explicit Project role", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      {
        user_id: 9,
        role: "viewer",
        created_at: "2026-07-31T09:00:00.000Z",
      },
    ]);
  };

  const collaborator = await createProjectDocumentStore(
    query,
  ).addCollaboratorByEmail?.(3, 7, 3, "viewer@example.com", "viewer");

  assert.deepEqual(collaborator, {
    userId: 9,
    email: "viewer@example.com",
    role: "viewer",
    createdAt: "2026-07-31T09:00:00.000Z",
  });
  assert.deepEqual(calls[0]?.values, [7, 3, 3, "viewer@example.com", "viewer"]);
  assert.match(calls[0]?.sql ?? "", /ON CONFLICT \(project_id, user_id\)/);
  assert.match(calls[0]?.sql ?? "", /u\.id <> rp\.user_id/);
});

test("loads keyed documents through project ownership", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([row]);
  };

  const document = await createProjectDocumentStore(query).findByKey(
    3,
    7,
    "main",
  );

  assert.equal(document?.octobaseDocumentId, "workspace-1");
  assert.deepEqual(calls[0]?.values, [7, 3, "main"]);
  assert.match(calls[0]?.sql ?? "", /project_id = \$1 AND owner_user_id = \$2/);
});

test("lists owner-scoped documents with favorites and recent updates first", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      { ...row, id: 42, title: "Favorite brief", is_favorite: true },
      row,
    ]);
  };

  const documents = await createProjectDocumentStore(query).listOwned(3, 7);

  assert.deepEqual(
    documents.map((document) => document.title),
    ["Favorite brief", "Project notes"],
  );
  assert.deepEqual(calls[0]?.values, [7, 3]);
  assert.match(
    calls[0]?.sql ?? "",
    /ORDER BY is_favorite DESC, updated_at DESC, id DESC/,
  );
  assert.match(calls[0]?.sql ?? "", /trashed_at IS NULL/);
});

test("searches owner-scoped document titles and indexed body text", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      {
        ...row,
        search_snippet: "The acceptance criteria cover offline editing.",
      },
    ]);
  };
  const results = await createProjectDocumentStore(query).searchOwned?.(
    3,
    7,
    "acceptance criteria",
  );

  assert.equal(results?.[0]?.document.title, "Project notes");
  assert.equal(
    results?.[0]?.snippet,
    "The acceptance criteria cover offline editing.",
  );
  assert.doesNotMatch(JSON.stringify(results), /octobaseDocumentId/);
  assert.deepEqual(calls[0]?.values, [7, 3, "acceptance criteria"]);
  assert.match(calls[0]?.sql ?? "", /owner_user_id = \$2/);
  assert.match(calls[0]?.sql ?? "", /search_text ILIKE/);
  assert.match(calls[0]?.sql ?? "", /websearch_to_tsquery\('simple', \$3\)/);
  assert.match(calls[0]?.sql ?? "", /trashed_at IS NULL/);
  assert.match(calls[0]?.sql ?? "", /LIMIT 30/);
});

test("updates only the owned active document search index", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ id: 41 }]);
  };
  const updated = await createProjectDocumentStore(query).updateSearchText?.(
    3,
    7,
    41,
    "Decision record acceptance criteria",
  );

  assert.equal(updated, true);
  assert.deepEqual(calls[0]?.values, [
    41,
    7,
    3,
    "Decision record acceptance criteria",
  ]);
  assert.match(calls[0]?.sql ?? "", /SET search_text = \$4/);
  assert.match(
    calls[0]?.sql ?? "",
    /id = \$1\s+AND project_id = \$2\s+AND owner_user_id = \$3/,
  );
  assert.match(calls[0]?.sql ?? "", /trashed_at IS NULL/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /updated_at = now/);
});

test("lists, trashes, restores, and permanently deletes owner-scoped documents", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("DELETE FROM project_documents")) {
      return result([{ id: 41 }]);
    }
    return result([
      {
        ...row,
        trashed_at: "2026-07-31T08:00:00.000Z",
      },
    ]);
  };
  const store = createProjectDocumentStore(query);

  const trashed = await store.listTrashed(3, 7);
  await store.trashOwned(3, 7, 41);
  await store.restoreOwned(3, 7, 41);
  assert.equal(await store.deleteTrashed(3, 7, 41), true);

  assert.equal(trashed[0]?.trashedAt, "2026-07-31T08:00:00.000Z");
  assert.match(calls[0]?.sql ?? "", /trashed_at IS NOT NULL/);
  assert.match(calls[1]?.sql ?? "", /SET trashed_at = now\(\)/);
  assert.match(calls[2]?.sql ?? "", /SET trashed_at = NULL/);
  assert.match(calls[3]?.sql ?? "", /DELETE FROM project_documents/);
  assert.ok(calls.every((call) => call.sql.includes("owner_user_id")));
});

test("creates metadata only by selecting an owned Research Project", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([row]);
  };

  await createProjectDocumentStore(query).createForOwnedProject(3, 7, {
    documentKey: "main",
    title: "Project notes",
    octobaseDocumentId: "workspace-1",
    integrationVersion: "integration-1",
  });

  assert.match(calls[0]?.sql ?? "", /SELECT\s+rp\.id, rp\.user_id/);
  assert.match(calls[0]?.sql ?? "", /rp\.id = \$1 AND rp\.user_id = \$2/);
  assert.match(
    calls[0]?.sql ?? "",
    /ON CONFLICT \(project_id, document_key\) DO NOTHING/,
  );
  assert.deepEqual(calls[0]?.values, [
    7,
    3,
    "main",
    "Project notes",
    "workspace-1",
    "integration-1",
    null,
    3,
  ]);
});

test("preserves calendar dates returned as local-midnight Date values", async () => {
  const localMidnight = new Date(2026, 6, 31);
  const query: ProjectDocumentQuery = async () =>
    result([{ ...row, journal_date: localMidnight }]);

  const documents = await createProjectDocumentStore(query).listOwned(3, 7);

  assert.equal(documents[0]?.journalDate, "2026-07-31");
});

test("finds a document by document, Project, and owner IDs", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([row]);
  };

  await createProjectDocumentStore(query).findOwned(3, 7, 41);

  assert.deepEqual(calls[0]?.values, [41, 7, 3]);
  assert.match(
    calls[0]?.sql ?? "",
    /id = \$1 AND project_id = \$2 AND owner_user_id = \$3/,
  );
});

test("updates editor mode without mutating the Research Project", async () => {
  const calls: string[] = [];
  const query: ProjectDocumentQuery = async (sql) => {
    calls.push(sql);
    return result([{ ...row, last_editor_mode: "edgeless" }]);
  };

  const updated = await createProjectDocumentStore(query).updateMode(
    3,
    7,
    41,
    "edgeless",
  );

  assert.equal(updated?.lastEditorMode, "edgeless");
  assert.match(calls[0] ?? "", /UPDATE project_documents/);
  assert.doesNotMatch(calls[0] ?? "", /UPDATE research_projects/);
});

test("updates Page metadata without mutating the Research Project", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      {
        ...row,
        title: "Product brief",
        icon: "idea",
        is_favorite: true,
        page_width: "full",
        properties: [
          {
            id: "status",
            name: "Status",
            type: "text",
            value: "Ready",
          },
        ],
      },
    ]);
  };

  const updated = await createProjectDocumentStore(query).updateMetadata(
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
  );

  assert.equal(updated?.title, "Product brief");
  assert.equal(updated?.icon, "idea");
  assert.equal(updated?.isFavorite, true);
  assert.equal(updated?.pageWidth, "full");
  assert.deepEqual(updated?.properties, [
    { id: "status", name: "Status", type: "text", value: "Ready" },
  ]);
  assert.deepEqual(calls[0]?.values, [
    41,
    7,
    3,
    "Product brief",
    "idea",
    true,
    "full",
    JSON.stringify([
      { id: "status", name: "Status", type: "text", value: "Ready" },
    ]),
    3,
  ]);
  assert.match(calls[0]?.sql ?? "", /UPDATE project_documents/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /UPDATE research_projects/);
});

test("captures and clears an owner-scoped reusable document template", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const snapshot = new Uint8Array([1, 2, 3]);
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT template_snapshot")) {
      return result([{ template_snapshot: Buffer.from(snapshot) }]);
    }
    return result([{ ...row, is_template: values?.[3] }]);
  };
  const store = createProjectDocumentStore(query);

  const enabled = await store.updateTemplate?.(3, 7, 41, snapshot);
  const stored = await store.getTemplateSnapshot?.(3, 7, 41);
  const disabled = await store.updateTemplate?.(3, 7, 41);

  assert.equal(enabled?.isTemplate, true);
  assert.deepEqual(stored, snapshot);
  assert.equal(disabled?.isTemplate, false);
  assert.deepEqual(calls[0]?.values, [
    41,
    7,
    3,
    true,
    Buffer.from(snapshot),
    3,
  ]);
  assert.match(calls[0]?.sql ?? "", /SET is_template = \$4/);
  assert.match(calls[1]?.sql ?? "", /AND is_template = true/);
  assert.deepEqual(calls[2]?.values, [41, 7, 3, false, null, 3]);
});

test("casts edit attribution parameters consistently across document updates", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ ...row, id: 41 }]);
  };
  const store = createProjectDocumentStore(query);

  await store.updateMode(3, 7, 41, "edgeless", 5);
  await store.updateMetadata(
    3,
    7,
    41,
    {
      title: "Decision record",
      icon: "none",
      isFavorite: false,
      pageWidth: "standard",
      properties: [],
    },
    5,
  );
  await store.updateTemplate?.(3, 7, 41, new Uint8Array([1]), 5);
  await store.touchLastEdited?.(3, 7, 41, 5);
  await store.replaceWorkspace?.(3, 7, 41, "workspace-1", "workspace-2", 5);

  const attributionParameters = [
    ["$5", calls[0]?.sql],
    ["$9", calls[1]?.sql],
    ["$6", calls[2]?.sql],
    ["$4", calls[3]?.sql],
    ["$6", calls[4]?.sql],
  ] as const;

  for (const [parameter, sql] of attributionParameters) {
    const escapedParameter = parameter.replace("$", "\\$");
    assert.match(
      sql ?? "",
      new RegExp(`last_edited_by_user_id = ${escapedParameter}::bigint`),
    );
    assert.match(
      sql ?? "",
      new RegExp(`users WHERE id = ${escapedParameter}::bigint`),
    );
  }
});

test("lists nested owner-scoped folders with document memberships", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      {
        id: 8,
        project_id: 7,
        owner_user_id: 3,
        parent_folder_id: 4,
        name: "Research",
        is_favorite: true,
        document_ids: ["41", 42],
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    ]);
  };

  const folders = await createProjectDocumentStore(query).listFolders?.(3, 7);

  assert.deepEqual(folders?.[0], {
    id: 8,
    projectId: 7,
    ownerUserId: 3,
    parentFolderId: 4,
    name: "Research",
    isFavorite: true,
    documentIds: [41, 42],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  assert.deepEqual(calls[0]?.values, [7, 3]);
  assert.match(calls[0]?.sql ?? "", /project_document_folder_memberships/);
  assert.match(calls[0]?.sql ?? "", /owner_user_id = \$2/);
});

test("lists owner-scoped tags with assigned documents", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      {
        id: 9,
        project_id: 7,
        owner_user_id: 3,
        name: "Priority",
        color: "blue",
        document_ids: [41],
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    ]);
  };

  const tags = await createProjectDocumentStore(query).listTags?.(3, 7);

  assert.equal(tags?.[0]?.name, "Priority");
  assert.deepEqual(tags?.[0]?.documentIds, [41]);
  assert.deepEqual(calls[0]?.values, [7, 3]);
  assert.match(calls[0]?.sql ?? "", /project_document_tag_assignments/);
  assert.match(calls[0]?.sql ?? "", /owner_user_id = \$2/);
});

test("replaces folder and tag assignments behind owner-scoped guards", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ ok: true }]);
  };
  const store = createProjectDocumentStore(query);

  assert.equal(await store.setFolderDocuments?.(3, 7, 8, [41, 42]), true);
  assert.equal(await store.setDocumentTags?.(3, 7, 41, [9]), true);

  assert.deepEqual(calls[0]?.values, [8, 7, 3, [41, 42]]);
  assert.match(calls[0]?.sql ?? "", /project_document_folder_memberships/);
  assert.deepEqual(calls[1]?.values, [41, 7, 3, [9]]);
  assert.match(calls[1]?.sql ?? "", /project_document_tag_assignments/);
});

test("lists and replaces owner-scoped document links", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT\n           project_id")) {
      return result([
        {
          project_id: 7,
          owner_user_id: 3,
          source_document_id: 41,
          target_document_id: 42,
          created_at: row.created_at,
        },
      ]);
    }
    return result([{ ok: true }]);
  };
  const store = createProjectDocumentStore(query);

  const links = await store.listLinks?.(3, 7);
  const updated = await store.setDocumentLinks?.(3, 7, 41, [42, 43]);

  assert.deepEqual(links?.[0], {
    projectId: 7,
    ownerUserId: 3,
    sourceDocumentId: 41,
    targetDocumentId: 42,
    createdAt: row.created_at,
  });
  assert.equal(updated, true);
  assert.deepEqual(calls[0]?.values, [7, 3]);
  assert.match(calls[0]?.sql ?? "", /project_document_links/);
  assert.deepEqual(calls[1]?.values, [41, 7, 3, [42, 43]]);
  assert.match(calls[1]?.sql ?? "", /source_document_id/);
  assert.match(calls[1]?.sql ?? "", /target_document_id/);
  assert.match(calls[1]?.sql ?? "", /trashed_at IS NULL/);
});

test("lists, creates, resolves, and reopens owner-scoped comments", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const commentRow = {
    id: 12,
    project_id: 7,
    document_id: 41,
    author_user_id: 3,
    author_email: "admin@localhost.test",
    body: "Confirm the rollout metric.",
    block_id: "block-1",
    quote: "rollout metric",
    resolved_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([
      sql.includes("CASE WHEN $5")
        ? {
            ...commentRow,
            resolved_at: values?.[4] ? "2026-07-31T09:00:00.000Z" : null,
          }
        : commentRow,
    ]);
  };
  const store = createProjectDocumentStore(query);

  const comments = await store.listComments?.(3, 7, 41);
  const created = await store.createComment?.(
    3,
    7,
    41,
    "Confirm the rollout metric.",
    3,
    { blockId: "block-1", quote: "rollout metric" },
  );
  const resolved = await store.resolveComment?.(3, 7, 41, 12, true);
  const reopened = await store.resolveComment?.(3, 7, 41, 12, false);

  assert.equal(comments?.[0]?.authorEmail, "admin@localhost.test");
  assert.equal(created?.body, "Confirm the rollout metric.");
  assert.equal(resolved?.resolvedAt, "2026-07-31T09:00:00.000Z");
  assert.equal(reopened?.resolvedAt, null);
  assert.deepEqual(calls[0]?.values, [7, 41, 3]);
  assert.deepEqual(calls[1]?.values, [
    41,
    7,
    3,
    "Confirm the rollout metric.",
    3,
    "block-1",
    "rollout metric",
  ]);
  assert.deepEqual(calls[2]?.values, [12, 41, 7, 3, true]);
  assert.deepEqual(calls[3]?.values, [12, 41, 7, 3, false]);
  assert.match(calls[0]?.sql ?? "", /project_document_comments/);
  assert.match(calls[1]?.sql ?? "", /INSERT INTO project_document_comments/);
  assert.match(calls[2]?.sql ?? "", /resolved_at = CASE WHEN \$5/);
});

test("creates, lists, revokes, and resolves public document shares", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const shareRow = {
    id: 15,
    project_id: 7,
    document_id: 41,
    created_at: "2026-07-31T10:00:00.000Z",
    revoked_at: null,
  };
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("WITH active_share")) {
      return result([
        {
          ...row,
          shared_at: shareRow.created_at,
        },
      ]);
    }
    if (sql.includes("UPDATE project_document_shares s")) {
      return result([{ id: 15 }]);
    }
    return result([shareRow]);
  };
  const store = createProjectDocumentStore(query);

  const shares = await store.listShares?.(3, 7, 41);
  const created = await store.createShare?.(3, 7, 41, "a".repeat(64));
  const revoked = await store.revokeShare?.(3, 7, 41, 15);
  const shared = await store.publicShare?.("a".repeat(64));

  assert.equal(shares?.[0]?.id, 15);
  assert.equal(created?.documentId, 41);
  assert.equal(revoked, true);
  assert.equal(shared?.document.octobaseDocumentId, "workspace-1");
  assert.equal(shared?.sharedAt, shareRow.created_at);
  assert.deepEqual(calls[1]?.values, [41, 7, 3, "a".repeat(64)]);
  assert.deepEqual(calls[2]?.values, [15, 41, 7, 3]);
  assert.deepEqual(calls[3]?.values, ["a".repeat(64)]);
  assert.match(calls[0]?.sql ?? "", /s\.revoked_at IS NULL/);
  assert.match(calls[3]?.sql ?? "", /SET last_accessed_at = now\(\)/);
});

test("creates, lists, reads, and restores owner-scoped document versions", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const snapshot = Buffer.from([1, 2, 3]);
  const versionRow = {
    id: 18,
    project_id: 7,
    document_id: 41,
    created_by_user_id: 3,
    created_by_email: "admin@localhost.test",
    label: "Review ready",
    byte_size: snapshot.byteLength,
    snapshot,
    created_at: "2026-07-31T11:00:00.000Z",
  };
  const query: ProjectDocumentQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("UPDATE project_documents\n")) {
      return result([
        {
          ...row,
          octobase_document_id: "workspace-restored",
        },
      ]);
    }
    return result([versionRow]);
  };
  const store = createProjectDocumentStore(query);

  const versions = await store.listVersions?.(3, 7, 41);
  const created = await store.createVersion?.(
    3,
    7,
    41,
    3,
    "Review ready",
    new Uint8Array(snapshot),
  );
  const stored = await store.getVersion?.(3, 7, 41, 18);
  const restored = await store.replaceWorkspace?.(
    3,
    7,
    41,
    "workspace-1",
    "workspace-restored",
  );

  assert.equal(versions?.[0]?.label, "Review ready");
  assert.equal(created?.createdByEmail, "admin@localhost.test");
  assert.deepEqual(Array.from(stored?.snapshot ?? []), [1, 2, 3]);
  assert.equal(restored?.octobaseDocumentId, "workspace-restored");
  assert.deepEqual(calls[0]?.values, [7, 41, 3]);
  assert.deepEqual(calls[1]?.values, [
    41,
    7,
    3,
    3,
    "Review ready",
    snapshot,
    3,
  ]);
  assert.deepEqual(calls[2]?.values, [18, 41, 7, 3]);
  assert.deepEqual(calls[3]?.values, [
    41,
    7,
    3,
    "workspace-1",
    "workspace-restored",
    3,
  ]);
  assert.match(calls[1]?.sql ?? "", /INSERT INTO project_document_versions/);
  assert.match(calls[2]?.sql ?? "", /v\.snapshot/);
  assert.match(calls[3]?.sql ?? "", /octobase_document_id = \$5/);
});
