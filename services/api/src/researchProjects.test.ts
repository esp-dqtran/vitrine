import assert from "node:assert/strict";
import type { Server } from "node:http";
import { test } from "node:test";
import express from "express";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import type { ResearchProjectStore } from "../../../src/researchProjectStore.ts";
import { createApiApp } from "./app.ts";
import { mountDesignerCanvasRoutes } from "./designerCanvases.ts";
import { mountResearchProjectRoutes } from "./researchProjects.ts";

const user = { id: 7, email: "designer@example.com", role: "user" as const };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const canvasAssetMetadata: ObjectMetadata = {
  key: `research/${user.id}/${"a".repeat(64)}.png`,
  sha256: "a".repeat(64),
  byteSize: 3,
  contentType: "image/png",
  accessClass: "protected",
};
const workspace = {
  id: PROJECT_ID,
  title: "SSO",
  question: "How should SSO work?",
  platformFilter: "web" as const,
  pinned: false,
  constraints: "",
  decision: "",
  rationale: "",
  openQuestions: "",
  revision: 1,
  lanes: [],
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
};
let attachedFlowInput: unknown;

const store = {
  listProjects: async () => [
    {
      id: PROJECT_ID,
      title: "SSO",
      question: "How should SSO work?",
      platformFilter: "web",
      pinned: false,
      revision: 1,
      evidenceCount: 0,
      synthesisState: "none",
      updatedAt: workspace.updatedAt,
    },
  ],
  createProject: async () => workspace,
  getProject: async () => workspace,
  getCanvas: async () => ({ snapshot: null, revision: 0 }),
  saveCanvas: async (
    _userId: number,
    _projectId: string,
    snapshot: Record<string, unknown>,
  ) => ({
    snapshot,
    revision: 1,
    updatedAt: "2026-08-01T00:00:00.000Z",
  }),
  attachCanvasAsset: async (
    _userId: number,
    _projectId: string,
    _assetId: string,
    metadata: ObjectMetadata,
  ) => metadata,
  getCanvasAsset: async () => canvasAssetMetadata,
  attachFlow: async (_userId: number, input: unknown) => {
    attachedFlowInput = input;
    return workspace;
  },
} as unknown as ResearchProjectStore;

async function serve(
  enabled = true,
  recordEvent?: (event: {
    featureKey?: string;
    action: string;
    outcome: string;
  }) => Promise<void>,
  objectStore?: ObjectStore,
  organizationRole?: (
    organizationId: number,
    userId: number,
  ) => Promise<"owner" | "admin" | "member" | undefined>,
  routeStore: ResearchProjectStore = store,
): Promise<{ base: string; server: Server }> {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.user = user;
    next();
  });
  mountDesignerCanvasRoutes(app, { store: routeStore, enabled, objectStore });
  mountResearchProjectRoutes(app, {
    store: routeStore,
    enabled,
    objectStore,
    canAccessApp: async () => true,
    listPublishedCandidates: async () => [],
    recordEvent,
    organizationRole,
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("lists and creates owner-scoped research projects", async (t) => {
  const events: Array<{
    featureKey?: string;
    action: string;
    outcome: string;
  }> = [];
  const { base, server } = await serve(true, async (event) => {
    events.push(event);
  });
  t.after(() => close(server));

  const listed = await fetch(`${base}/research-projects`);
  assert.equal(listed.status, 200);
  assert.equal(
    ((await listed.json()) as Array<{ id: string }>)[0].id,
    PROJECT_ID,
  );

  const created = await fetch(`${base}/research-projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "SSO" }),
  });
  assert.equal(created.status, 201);
  assert.equal(((await created.json()) as { title: string }).title, "SSO");
  assert.deepEqual(events[0], {
    userId: user.id,
    featureKey: "research",
    action: "research_project_created",
    outcome: "created",
  });
});

test("feature flag hides every research route", async (t) => {
  const { base, server } = await serve(false);
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/research-projects`)).status, 404);
});

test("validates project bodies and identifiers", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/research-projects/zero`)).status, 400);
  assert.equal(
    (
      await fetch(`${base}/research-projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "",
          question: "",
          platformFilter: "desktop",
        }),
      })
    ).status,
    400,
  );
});

test("updates a project name and icon together", async (t) => {
  let receivedPatch: unknown;
  const routeStore = {
    ...store,
    updateProject: async (
      _userId: number,
      _projectId: string,
      _expectedRevision: number,
      patch: unknown,
    ) => {
      receivedPatch = patch;
      return {
        ...workspace,
        title: "Checkout refresh",
        icon: "sparkle" as const,
        revision: 2,
      };
    },
  } as unknown as ResearchProjectStore;
  const { base, server } = await serve(
    true,
    undefined,
    undefined,
    undefined,
    routeStore,
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/research-projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expectedRevision: 1,
      title: "Checkout refresh",
      icon: "sparkle",
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(receivedPatch, {
    title: "Checkout refresh",
    icon: "sparkle",
  });
  assert.equal(((await response.json()) as { icon: string }).icon, "sparkle");
});

test("rejects unsupported project icons", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));
  const response = await fetch(`${base}/research-projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 1, icon: "custom-emoji" }),
  });
  assert.equal(response.status, 400);
});

test("creates Team projects only for current organization members", async (t) => {
  const denied = await serve();
  t.after(() => close(denied.server));
  assert.equal(
    (
      await fetch(`${denied.base}/research-projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Shared research", organizationId: 4 }),
      })
    ).status,
    403,
  );

  const allowed = await serve(
    true,
    undefined,
    undefined,
    async (organizationId, userId) =>
      organizationId === 4 && userId === user.id ? "member" : undefined,
  );
  t.after(() => close(allowed.server));
  assert.equal(
    (
      await fetch(`${allowed.base}/research-projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Shared research", organizationId: 4 }),
      })
    ).status,
    201,
  );
});

test("manages direct Project editor and viewer access", async (t) => {
  const changes: string[] = [];
  const membersView = {
    members: [
      {
        userId: 9,
        email: "stakeholder@example.com",
        role: "viewer" as const,
        createdAt: "2026-08-02T00:00:00.000Z",
      },
    ],
    canManage: true,
    organization: { id: 4, name: "Northstar" },
  };
  const memberStore = {
    ...store,
    listMembers: async () => membersView,
    addMemberByEmail: async (
      _userId: number,
      _projectId: string,
      email: string,
      role: string,
    ) => {
      changes.push(`add:${email}:${role}`);
      return "added" as const;
    },
    removeMember: async (
      _userId: number,
      _projectId: string,
      targetUserId: number,
    ) => {
      changes.push(`remove:${targetUserId}`);
      return true;
    },
  } as unknown as ResearchProjectStore;
  const { base, server } = await serve(
    true,
    undefined,
    undefined,
    undefined,
    memberStore,
  );
  t.after(() => close(server));

  const listed = await fetch(`${base}/research-projects/${PROJECT_ID}/members`);
  assert.equal(listed.status, 200);
  assert.deepEqual(await listed.json(), membersView);

  const added = await fetch(`${base}/research-projects/${PROJECT_ID}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "Stakeholder@example.com", role: "viewer" }),
  });
  assert.equal(added.status, 201);

  const removed = await fetch(
    `${base}/research-projects/${PROJECT_ID}/members/9`,
    { method: "DELETE" },
  );
  assert.equal(removed.status, 204);
  assert.deepEqual(changes, ["add:Stakeholder@example.com:viewer", "remove:9"]);
});

test("loads and saves a project-scoped Excalidraw canvas", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));

  const loaded = await fetch(`${base}/research-projects/${PROJECT_ID}/canvas`);
  assert.equal(loaded.status, 200);
  assert.equal(((await loaded.json()) as { revision: number }).revision, 0);

  const saved = await fetch(`${base}/research-projects/${PROJECT_ID}/canvas`, {
    method: "PUT",
    headers: { "content-type": "application/vnd.astryx.excalidraw+json" },
    body: JSON.stringify({
      snapshot: {
        type: "excalidraw",
        version: 2,
        source: "https://astryx.design",
        elements: [],
        appState: {},
        files: {},
      },
    }),
  });
  assert.equal(saved.status, 200);
  assert.equal(((await saved.json()) as { revision: number }).revision, 1);

  const invalid = await fetch(
    `${base}/research-projects/${PROJECT_ID}/canvas`,
    {
      method: "PUT",
      headers: { "content-type": "application/vnd.astryx.excalidraw+json" },
      body: JSON.stringify({ snapshot: {} }),
    },
  );
  assert.equal(invalid.status, 400);
});

test("uploads and serves an authenticated project canvas image", async (t) => {
  let storedBody: Buffer | undefined;
  const objectStore: ObjectStore = {
    async put(input) {
      storedBody = Buffer.from(input.body);
      return {
        created: true,
        metadata: { ...input, body: undefined } as unknown as ObjectMetadata,
      };
    },
    async get() {
      return {
        metadata: canvasAssetMetadata,
        body: storedBody ?? Buffer.from([1, 2, 3]),
      };
    },
    async head() {
      return canvasAssetMetadata;
    },
    async signedGetUrl() {
      return undefined;
    },
    async *list() {
      yield canvasAssetMetadata;
    },
    async delete() {
      return true;
    },
  };
  const { base, server } = await serve(true, undefined, objectStore);
  t.after(() => close(server));

  const uploaded = await fetch(
    `${base}/research-projects/${PROJECT_ID}/canvas/assets/${encodeURIComponent("asset:image-1")}`,
    {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: new Uint8Array([1, 2, 3]),
    },
  );
  assert.equal(uploaded.status, 201);
  assert.deepEqual(await uploaded.json(), {
    assetId: "asset:image-1",
    src: `/api/research-projects/${PROJECT_ID}/canvas/assets/asset%3Aimage-1`,
  });
  assert.deepEqual(storedBody, Buffer.from([1, 2, 3]));

  const served = await fetch(
    `${base}/research-projects/${PROJECT_ID}/canvas/assets/${encodeURIComponent("asset:image-1")}`,
  );
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
  assert.deepEqual(
    Buffer.from(await served.arrayBuffer()),
    Buffer.from([1, 2, 3]),
  );

  const unsupported = await fetch(
    `${base}/research-projects/${PROJECT_ID}/canvas/assets/${encodeURIComponent("asset:image-2")}`,
    {
      method: "POST",
      headers: { "content-type": "image/gif" },
      body: new Uint8Array([1]),
    },
  );
  assert.equal(unsupported.status, 415);
});

test("rejects non-positive catalog identifiers", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));
  const response = await fetch(
    `${base}/research-projects/${PROJECT_ID}/items`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        laneId: 1,
        expectedRevision: 1,
        sourceKind: "catalog_screen",
        snapshot: { title: "Checkout" },
        catalog: { app: "example", versionId: 0, imageId: 0 },
      }),
    },
  );
  assert.equal(response.status, 400);
});

test("attaches a validated catalog flow through one project operation", async (t) => {
  attachedFlowInput = undefined;
  const { base, server } = await serve();
  t.after(() => close(server));
  const response = await fetch(
    `${base}/research-projects/${PROJECT_ID}/flows`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        laneId: 21,
        expectedRevision: 1,
        catalog: {
          app: "Linear",
          appId: "linear",
          versionId: 3,
          flowId: "creating-account",
          platform: "web",
          title: "Creating an account",
          description: "Account onboarding",
        },
      }),
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(attachedFlowInput, {
    projectId: PROJECT_ID,
    laneId: 21,
    expectedRevision: 1,
    catalog: {
      app: "Linear",
      appId: "linear",
      versionId: 3,
      flowId: "creating-account",
      platform: "web",
      title: "Creating an account",
      description: "Account onboarding",
    },
  });
});

test("returns the media-specific status for an unsupported upload type", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));
  const response = await fetch(
    `${base}/research-projects/${PROJECT_ID}/uploads?laneId=1&revision=1`,
    {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not an image",
    },
  );
  assert.equal(response.status, 415);
});

test("mounts research projects inside the authenticated API", async (t) => {
  const app = createApiApp({
    resolveSession: async () => user,
    researchProjectStore: store,
    researchProjectsEnabled: true,
    listResearchCandidates: async () => [],
  } as never);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => close(server));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/research-projects`,
    {
      headers: { cookie: "astryx_session=user" },
    },
  );
  assert.equal(response.status, 200);
});
