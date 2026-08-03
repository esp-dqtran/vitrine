import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import {
  createResearchProjectStore,
  type DatabaseQuery,
} from "./researchProjectStore.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const DUPLICATE_PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const result = (
  rows: Record<string, unknown>[] = [],
): QueryResult<Record<string, unknown>> => ({
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

  assert.equal(
    await createResearchProjectStore(query).getProject(7, PROJECT_ID),
    undefined,
  );
  assert.ok(
    calls.some((sql) => /research_projects[\s\S]*user_id\s*=\s*\$2/.test(sql)),
  );
});

test("lists Team projects through membership and exposes the active role", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    return result([
      {
        public_id: PROJECT_ID,
        title: "Checkout redesign",
        question: "",
        platform_filter: "web",
        pinned: false,
        revision: 1,
        updated_at: "2026-08-01T00:00:00.000Z",
        evidence_count: 2,
        synthesis_revision: null,
        organization_id: 4,
        organization_name: "Northstar",
        organization_role: "member",
      },
    ]);
  };

  const projects = await createResearchProjectStore(query).listProjects(7);

  assert.deepEqual(projects[0].organization, {
    id: 4,
    name: "Northstar",
    role: "member",
  });
  assert.match(calls[0], /organization_members/);
  assert.match(calls[0], /membership\.user_id = \$1/);
});

test("lists direct Project members and exposes management state", async () => {
  const query: DatabaseQuery = async () =>
    result([
      {
        project_id: 3,
        organization_id: 4,
        organization_name: "Northstar",
        can_manage: true,
        user_id: 9,
        email: "stakeholder@example.com",
        role: "viewer",
        created_at: "2026-08-02T00:00:00.000Z",
      },
    ]);

  const view = await createResearchProjectStore(query).listMembers(
    7,
    PROJECT_ID,
  );

  assert.deepEqual(view, {
    members: [
      {
        userId: 9,
        email: "stakeholder@example.com",
        role: "viewer",
        createdAt: "2026-08-02T00:00:00.000Z",
      },
    ],
    canManage: true,
    organization: { id: 4, name: "Northstar" },
  });
});

test("Project writes honor direct editor access and viewer overrides", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    return result();
  };

  await createResearchProjectStore(query).saveCanvas(7, PROJECT_ID, {
    elements: [],
  });

  assert.match(calls[0], /project_document_collaborators project_member/);
  assert.match(calls[0], /project_member\.role = 'viewer'/);
  assert.match(calls[0], /project_member\.role = 'editor'/);
});

test("loads protected and catalog evidence with browser-safe media URLs", async () => {
  const query: DatabaseQuery = async (sql) => {
    if (
      /FROM research_projects rp/.test(sql) &&
      !/research_project_items/.test(sql)
    ) {
      return result([
        {
          public_id: PROJECT_ID,
          title: "Moodboard research",
          question: "Which direction should we explore?",
          platform_filter: "web",
          pinned: false,
          constraints: "",
          decision: "",
          rationale: "",
          open_questions: "",
          revision: 1,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ]);
    }
    if (/FROM research_project_lanes/.test(sql)) {
      return result([
        { id: 21, title: "Direction", position: 0, conclusion: "" },
      ]);
    }
    if (/FROM research_project_items i/.test(sql)) {
      return result([
        {
          id: 31,
          project_public_id: PROJECT_ID,
          lane_id: 21,
          position: 0,
          source_kind: "catalog_screen",
          step_label: "Checkout",
          note: "",
          tags: [],
          important: false,
          source_snapshot: { title: "Checkout" },
          catalog_app: "aboard",
          catalog_app_icon_url: "https://cdn.example.com/aboard.png",
          catalog_image_url: "mobbin-bulk:0123456789abcdef",
        },
        {
          id: 32,
          project_public_id: PROJECT_ID,
          lane_id: 21,
          position: 1,
          source_kind: "private_upload",
          step_label: "Our current screen",
          note: "",
          tags: [],
          important: false,
          source_snapshot: { title: "Our current screen" },
        },
      ]);
    }
    return result();
  };

  const workspace = await createResearchProjectStore(query).getProject(
    7,
    PROJECT_ID,
  );

  assert.equal(
    workspace?.lanes[0].items[0].mediaUrl,
    "/api/media/aboard/0123456789abcdef",
  );
  assert.equal(workspace?.lanes[0].items[0].appId, "aboard");
  assert.equal(
    workspace?.lanes[0].items[0].appIconUrl,
    "https://cdn.example.com/aboard.png",
  );
  assert.equal(
    workspace?.lanes[0].items[1].mediaUrl,
    `/api/research-projects/${PROJECT_ID}/private-media/32`,
  );
});

test("loads and saves a canvas through project ownership", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/LEFT JOIN research_project_canvases/.test(sql)) {
      return result([
        { snapshot: null, canvas_revision: null, canvas_updated_at: null },
      ]);
    }
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 1 }]);
    if (/INSERT INTO research_project_canvases/.test(sql)) {
      return result([
        {
          snapshot: { document: {}, session: {} },
          revision: 1,
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ]);
    }
    return result();
  };
  const store = createResearchProjectStore(query);

  assert.deepEqual(await store.getCanvas(7, PROJECT_ID), {
    snapshot: null,
    revision: 0,
  });
  const saved = await store.saveCanvas(7, PROJECT_ID, {
    document: {},
    session: {},
  });

  assert.equal(saved?.revision, 1);
  assert.ok(
    calls.some((sql) =>
      /rp\.public_id\s*=\s*\$1[\s\S]*organization_members/.test(sql),
    ),
  );
  assert.ok(
    calls.some((sql) => /ON CONFLICT \(project_id\) DO UPDATE/.test(sql)),
  );
});

test("attaches and loads canvas assets through project ownership", async () => {
  const calls: string[] = [];
  const metadata = {
    key: "research/7/asset.png",
    sha256: "a".repeat(64),
    byteSize: 3,
    contentType: "image/png" as const,
    accessClass: "protected" as const,
  };
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 1 }]);
    if (/INSERT INTO stored_objects/.test(sql))
      return result([{ object_key: metadata.key }]);
    if (/FROM research_project_canvas_assets/.test(sql)) {
      return result([
        {
          object_key: metadata.key,
          sha256: metadata.sha256,
          byte_size: metadata.byteSize,
          content_type: metadata.contentType,
          access_class: metadata.accessClass,
        },
      ]);
    }
    return result();
  };
  const store = createResearchProjectStore(query);

  assert.deepEqual(
    await store.attachCanvasAsset(7, PROJECT_ID, "asset:image-1", metadata),
    metadata,
  );
  assert.deepEqual(
    await store.getCanvasAsset(7, PROJECT_ID, "asset:image-1"),
    metadata,
  );
  assert.ok(
    calls.some((sql) => /user_id\s*=\s*\$2[\s\S]*FOR UPDATE/.test(sql)),
  );
  assert.ok(
    calls.some((sql) => /INSERT INTO research_project_canvas_assets/.test(sql)),
  );
  assert.ok(
    calls.some((sql) =>
      /rp\.public_id\s*=\s*\$1[\s\S]*organization_members/.test(sql),
    ),
  );
});

test("creates a project and two lanes in one transaction", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/INSERT INTO research_projects/.test(sql))
      return result([
        {
          id: 12,
          public_id: PROJECT_ID,
          title: "SSO research",
          question: "How should SSO be introduced?",
          platform_filter: "web",
          pinned: false,
          constraints: "",
          decision: "",
          rationale: "",
          open_questions: "",
          revision: 1,
          created_at: "2026-07-17T00:00:00.000Z",
          updated_at: "2026-07-17T00:00:00.000Z",
        },
      ]);
    if (/FROM research_projects rp/.test(sql))
      return result([
        {
          public_id: PROJECT_ID,
          title: "SSO research",
          question: "How should SSO be introduced?",
          platform_filter: "web",
          pinned: false,
          constraints: "",
          decision: "",
          rationale: "",
          open_questions: "",
          revision: 1,
          created_at: "2026-07-17T00:00:00.000Z",
          updated_at: "2026-07-17T00:00:00.000Z",
        },
      ]);
    if (/FROM research_project_lanes/.test(sql))
      return result([
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
  assert.equal(
    calls.filter((sql) => /INSERT INTO research_project_lanes/.test(sql))
      .length,
    1,
  );
});

test("locks the owned project before a mutation", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 3 }]);
    return result();
  };

  await createResearchProjectStore(query).updateProject(7, PROJECT_ID, 3, {
    title: "Updated",
  });

  assert.ok(
    calls.some((sql) => /user_id\s*=\s*\$2[\s\S]*FOR UPDATE/.test(sql)),
  );
});

test("stores a selected project icon as revisioned metadata", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 3 }]);
    return result();
  };

  await createResearchProjectStore(query).updateProject(7, PROJECT_ID, 3, {
    icon: "book",
  });

  const update =
    calls.find((sql) => /UPDATE research_projects SET icon/.test(sql)) ?? "";
  assert.match(update, /icon\s*=\s*\$2/);
  assert.match(update, /revision\s*=\s*revision\s*\+\s*1/);
});

test("pinning is a workspace preference and does not revise project content", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 3 }]);
    return result();
  };

  await createResearchProjectStore(query).updateProject(7, PROJECT_ID, 3, {
    pinned: true,
  });

  const update =
    calls.find((sql) => /UPDATE research_projects SET pinned/.test(sql)) ?? "";
  assert.match(update, /pinned\s*=\s*\$2/);
  assert.doesNotMatch(update, /revision\s*=|updated_at\s*=/);
});

test("attaches private object metadata and evidence in one transaction", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ id: 1, revision: 1 }]);
    if (/SELECT count\(\*\)/.test(sql))
      return result([{ total: 0, private_count: 0 }]);
    if (/SELECT id FROM research_project_lanes/.test(sql))
      return result([{ id: 2 }]);
    if (/INSERT INTO stored_objects/.test(sql))
      return result([{ object_key: "research/7/a.png" }]);
    return result();
  };
  const store = createResearchProjectStore(query);

  await store.addPrivateItem(
    7,
    {
      projectId: PROJECT_ID,
      laneId: 2,
      expectedRevision: 1,
      sourceKind: "private_upload",
      snapshot: { title: "Own product" },
      privateObjectKey: "research/7/a.png",
    },
    {
      key: "research/7/a.png",
      sha256: "a".repeat(64),
      byteSize: 10,
      contentType: "image/png",
      accessClass: "protected",
    },
  );

  assert.ok(calls.some((sql) => /INSERT INTO stored_objects/.test(sql)));
  assert.ok(
    calls.some((sql) => /INSERT INTO research_project_items/.test(sql)),
  );
});

test("attaches only missing catalog flow steps and bumps revision once", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 1 }]);
    if (/SELECT id FROM research_project_lanes/.test(sql))
      return result([{ id: 21 }]);
    if (/FROM app_flow_versions afv/.test(sql)) {
      return result([
        {
          app_name: "Linear",
          steps: Array.from({ length: 7 }, (_, index) => ({
            label: `Step ${index + 1}`,
            evidence: [41 + index],
          })),
        },
      ]);
    }
    if (/SELECT catalog_image_id, catalog_step_index/.test(sql)) {
      return result([{ catalog_image_id: 41, catalog_step_index: 0 }]);
    }
    if (/SELECT count\(\*\)::integer AS total/.test(sql))
      return result([{ total: 1 }]);
    if (/SELECT COALESCE\(max\(position\)/.test(sql))
      return result([{ position: 0 }]);
    if (
      /FROM research_projects rp/.test(sql) &&
      !/research_project_items/.test(sql)
    ) {
      return result([
        {
          public_id: PROJECT_ID,
          title: "Onboarding research",
          question: "",
          platform_filter: "ios",
          pinned: false,
          constraints: "",
          decision: "",
          rationale: "",
          open_questions: "",
          revision: 2,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ]);
    }
    if (/FROM research_project_lanes/.test(sql)) {
      return result([
        { id: 21, title: "Alternative A", position: 0, conclusion: "" },
      ]);
    }
    return result();
  };

  const workspace = await createResearchProjectStore(query).attachFlow(7, {
    projectId: PROJECT_ID,
    laneId: 21,
    expectedRevision: 1,
    catalog: {
      app: "Linear",
      appId: "linear",
      versionId: 3,
      flowId: "creating-account",
      platform: "ios",
      title: "Creating an account",
      description: "Account onboarding",
    },
  });

  const inserts = calls.filter(({ sql }) =>
    /INSERT INTO research_project_items/.test(sql),
  );
  assert.equal(
    inserts.length,
    6,
    "the backend attaches beyond the six-card preview limit",
  );
  assert.equal(inserts[0].values?.[2], 1);
  assert.equal(inserts[0].values?.[6], 42);
  assert.equal(inserts[5].values?.[2], 6);
  assert.equal(inserts[5].values?.[6], 47);
  assert.equal(
    calls.filter(({ sql }) => /SET revision = revision \+ 1/.test(sql)).length,
    1,
  );
  assert.equal(workspace?.revision, 2);
});

test("loads private media only through project ownership", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    return result([
      {
        object_key: "research/7/a.png",
        sha256: "a".repeat(64),
        byte_size: 10,
        content_type: "image/png",
        access_class: "protected",
      },
    ]);
  };
  const metadata = await createResearchProjectStore(query).getPrivateObject(
    7,
    PROJECT_ID,
    2,
  );
  assert.equal(metadata?.key, "research/7/a.png");
  assert.ok(calls.some((sql) => /rp\.user_id\s*=\s*\$1/.test(sql)));
});

test("duplicates every evidence source reference", async () => {
  const calls: string[] = [];
  const project = {
    public_id: DUPLICATE_PROJECT_ID,
    title: "Checkout research",
    question: "Which checkout pattern should we use?",
    platform_filter: "web",
    pinned: false,
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
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 1 }]);
    if (/INSERT INTO research_projects/.test(sql)) {
      return result([{ id: 12, public_id: DUPLICATE_PROJECT_ID }]);
    }
    if (/INSERT INTO research_project_lanes/.test(sql))
      return result([{ id: 22 }]);
    if (/FROM research_projects rp/.test(sql)) return result([project]);
    if (/FROM research_project_lanes/.test(sql)) {
      return result([
        { id: 21, title: "Alternative A", position: 0, conclusion: "" },
      ]);
    }
    if (/FROM research_project_items i/.test(sql)) {
      return result([
        {
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
        },
      ]);
    }
    return result();
  };

  await createResearchProjectStore(query).duplicateProject(7, PROJECT_ID);

  const copiedItem =
    calls.find((sql) => /INSERT INTO research_project_items/.test(sql)) ?? "";
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
  assert.ok(
    calls.some((sql) => /INSERT INTO research_project_canvases/.test(sql)),
  );
  assert.ok(
    calls.some((sql) => /INSERT INTO research_project_canvas_assets/.test(sql)),
  );
});

test("deletes only private and canvas objects not shared by another project", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) return result([{ id: 11, revision: 1 }]);
    if (/SELECT DISTINCT candidate\.object_key/.test(sql)) {
      return result([
        { object_key: "research/7/private.png" },
        { object_key: "research/7/canvas.png" },
      ]);
    }
    return result();
  };

  const deleted = await createResearchProjectStore(query).deleteProject(
    7,
    PROJECT_ID,
  );

  assert.deepEqual(deleted, {
    deleted: true,
    privateObjectKeys: ["research/7/private.png", "research/7/canvas.png"],
  });
  const cleanupQuery =
    calls.find((sql) => /SELECT DISTINCT candidate\.object_key/.test(sql)) ??
    "";
  assert.match(cleanupQuery, /FROM research_project_canvas_assets asset/);
  assert.match(cleanupQuery, /other_item\.project_id <> \$1/);
  assert.match(cleanupQuery, /other_asset\.project_id <> \$1/);
  assert.ok(calls.some((sql) => /DELETE FROM research_projects/.test(sql)));
});

test("moves evidence without out-of-range sentinel positions", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql) && /research_projects/.test(sql)) {
      return result([{ id: 11, revision: 1 }]);
    }
    if (/SELECT lane_id, position/.test(sql))
      return result([{ lane_id: 2, position: 0 }]);
    if (/SELECT id FROM research_project_lanes/.test(sql))
      return result([{ id: 3 }]);
    if (/SELECT count\(\*\)/.test(sql)) return result([{ count: 1 }]);
    return result();
  };

  await createResearchProjectStore(query).moveItem(7, {
    projectId: PROJECT_ID,
    itemId: 31,
    targetLaneId: 3,
    targetPosition: 0,
    expectedRevision: 1,
  });

  assert.ok(
    calls.some((sql) =>
      /SET CONSTRAINTS research_project_items_lane_position_unique DEFERRED/.test(
        sql,
      ),
    ),
  );
  assert.equal(
    calls.some((sql) => /1000|999/.test(sql)),
    false,
  );
});
