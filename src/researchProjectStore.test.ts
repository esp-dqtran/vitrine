import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import { createResearchProjectStore, type DatabaseQuery } from "./researchProjectStore.ts";

const result = (rows: Record<string, unknown>[] = []): QueryResult<Record<string, unknown>> => ({
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
  rows,
});

test("loads projects through ownership", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    return result();
  };

  assert.equal(await createResearchProjectStore(query).getProject(7, 11), undefined);
  assert.ok(calls.some((sql) => /research_projects[\s\S]*user_id\s*=\s*\$2/.test(sql)));
});

test("creates a project and two lanes in one transaction", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/INSERT INTO research_projects/.test(sql)) return result([{
      id: 12,
      title: "SSO research",
      question: "How should SSO be introduced?",
      platform_filter: "web",
      constraints: "",
      decision: "",
      rationale: "",
      open_questions: "",
      revision: 1,
      created_at: "2026-07-17T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z",
    }]);
    if (/FROM research_projects rp/.test(sql)) return result([{
      id: 12,
      title: "SSO research",
      question: "How should SSO be introduced?",
      platform_filter: "web",
      constraints: "",
      decision: "",
      rationale: "",
      open_questions: "",
      revision: 1,
      created_at: "2026-07-17T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z",
    }]);
    if (/FROM research_project_lanes/.test(sql)) return result([
      { id: 21, title: "Alternative A", position: 0, conclusion: "" },
      { id: 22, title: "Alternative B", position: 1, conclusion: "" },
    ]);
    return result();
  };

  const workspace = await createResearchProjectStore(query).createProject(7, {
    title: "SSO research",
    question: "How should SSO be introduced?",
    platformFilter: "web",
  });

  assert.equal(workspace.lanes.length, 2);
  assert.equal(calls.filter((sql) => /INSERT INTO research_project_lanes/.test(sql)).length, 1);
});

test("locks the owned project before a mutation", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ revision: 3 }]);
    return result();
  };

  await createResearchProjectStore(query).updateProject(7, 11, 3, { title: "Updated" });

  assert.ok(calls.some((sql) => /user_id\s*=\s*\$2[\s\S]*FOR UPDATE/.test(sql)));
});

test("attaches private object metadata and evidence in one transaction", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ revision: 1 }]);
    if (/SELECT count\(\*\)/.test(sql)) return result([{ total: 0, private_count: 0 }]);
    if (/SELECT id FROM research_project_lanes/.test(sql)) return result([{ id: 2 }]);
    if (/INSERT INTO stored_objects/.test(sql)) return result([{ object_key: "research/7/a.png" }]);
    return result();
  };
  const store = createResearchProjectStore(query);

  await store.addPrivateItem(7, {
    projectId: 1,
    laneId: 2,
    expectedRevision: 1,
    sourceKind: "private_upload",
    snapshot: { title: "Own product" },
    privateObjectKey: "research/7/a.png",
  }, {
    key: "research/7/a.png",
    sha256: "a".repeat(64),
    byteSize: 10,
    contentType: "image/png",
    accessClass: "protected",
  });

  assert.ok(calls.some((sql) => /INSERT INTO stored_objects/.test(sql)));
  assert.ok(calls.some((sql) => /INSERT INTO research_project_items/.test(sql)));
});

test("loads private media only through project ownership", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    return result([{
      object_key: "research/7/a.png",
      sha256: "a".repeat(64),
      byte_size: 10,
      content_type: "image/png",
      access_class: "protected",
    }]);
  };
  const metadata = await createResearchProjectStore(query).getPrivateObject(7, 1, 2);
  assert.equal(metadata?.key, "research/7/a.png");
  assert.ok(calls.some((sql) => /rp\.user_id\s*=\s*\$1/.test(sql)));
});

test("duplicates every evidence source reference", async () => {
  const calls: string[] = [];
  const project = {
    id: 11,
    title: "Checkout research",
    question: "Which checkout pattern should we use?",
    platform_filter: "web",
    constraints: "",
    decision: "",
    rationale: "",
    open_questions: "",
    revision: 1,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z",
  };
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ revision: 1 }]);
    if (/INSERT INTO research_projects/.test(sql)) return result([{ id: 12 }]);
    if (/INSERT INTO research_project_lanes/.test(sql)) return result([{ id: 22 }]);
    if (/FROM research_projects rp/.test(sql)) return result([project]);
    if (/FROM research_project_lanes/.test(sql)) {
      return result([{ id: 21, title: "Alternative A", position: 0, conclusion: "" }]);
    }
    if (/FROM research_project_items i/.test(sql)) {
      return result([{
        id: 31,
        project_id: 11,
        lane_id: 21,
        position: 0,
        source_kind: "catalog_flow_step",
        step_label: "Payment",
        note: "",
        tags: [],
        important: false,
        source_snapshot: { title: "Payment" },
      }]);
    }
    return result();
  };

  await createResearchProjectStore(query).duplicateProject(7, 11);

  const copiedItem = calls.find((sql) => /INSERT INTO research_project_items/.test(sql)) ?? "";
  for (const column of [
    "catalog_app",
    "catalog_version_id",
    "catalog_image_id",
    "catalog_flow_id",
    "catalog_step_index",
    "private_object_key",
  ]) {
    assert.match(copiedItem, new RegExp(`\\b${column}\\b`));
  }
});

test("moves evidence without out-of-range sentinel positions", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql) && /research_projects/.test(sql)) return result([{ revision: 1 }]);
    if (/SELECT lane_id, position/.test(sql)) return result([{ lane_id: 2, position: 0 }]);
    if (/SELECT id FROM research_project_lanes/.test(sql)) return result([{ id: 3 }]);
    if (/SELECT count\(\*\)/.test(sql)) return result([{ count: 1 }]);
    return result();
  };

  await createResearchProjectStore(query).moveItem(7, {
    projectId: 11,
    itemId: 31,
    targetLaneId: 3,
    targetPosition: 0,
    expectedRevision: 1,
  });

  assert.ok(calls.some((sql) => /SET CONSTRAINTS research_project_items_lane_position_unique DEFERRED/.test(sql)));
  assert.equal(calls.some((sql) => /1000|999/.test(sql)), false);
});
