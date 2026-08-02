import assert from "node:assert/strict";
import type { Server } from "node:http";
import { test } from "node:test";
import express from "express";
import type { ResearchProjectStore } from "../../../src/researchProjectStore.ts";
import { createApiApp } from "./app.ts";
import { mountResearchProjectRoutes } from "./researchProjects.ts";

const user = { id: 7, email: "designer@example.com", role: "user" as const };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
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
  listProjects: async () => [{
    id: PROJECT_ID,
    title: "SSO",
    question: "How should SSO work?",
    platformFilter: "web",
    pinned: false,
    revision: 1,
    evidenceCount: 0,
    synthesisState: "none",
    updatedAt: workspace.updatedAt,
  }],
  createProject: async () => workspace,
  getProject: async () => workspace,
  attachFlow: async (_userId: number, input: unknown) => {
    attachedFlowInput = input;
    return workspace;
  },
} as unknown as ResearchProjectStore;

async function serve(enabled = true, recordEvent?: (event: { featureKey?: string; action: string; outcome: string }) => Promise<void>): Promise<{ base: string; server: Server }> {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.user = user; next(); });
  mountResearchProjectRoutes(app, {
    store,
    enabled,
    canAccessApp: async () => true,
    listPublishedCandidates: async () => [],
    recordEvent,
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

const close = (server: Server) => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test("lists and creates owner-scoped research projects", async (t) => {
  const events: Array<{ featureKey?: string; action: string; outcome: string }> = [];
  const { base, server } = await serve(true, async (event) => { events.push(event); });
  t.after(() => close(server));

  const listed = await fetch(`${base}/research-projects`);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json() as Array<{ id: string }>)[0].id, PROJECT_ID);

  const created = await fetch(`${base}/research-projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "SSO" }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json() as { title: string }).title, "SSO");
  assert.deepEqual(events[0], { userId: user.id, featureKey: "research", action: "research_project_created", outcome: "created" });
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
  assert.equal((await fetch(`${base}/research-projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "", question: "", platformFilter: "desktop" }),
  })).status, 400);
});

test("rejects non-positive catalog identifiers", async (t) => {
  const { base, server } = await serve();
  t.after(() => close(server));
  const response = await fetch(`${base}/research-projects/${PROJECT_ID}/items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      laneId: 1,
      expectedRevision: 1,
      sourceKind: "catalog_screen",
      snapshot: { title: "Checkout" },
      catalog: { app: "example", versionId: 0, imageId: 0 },
    }),
  });
  assert.equal(response.status, 400);
});

test("attaches a validated catalog flow through one project operation", async (t) => {
  attachedFlowInput = undefined;
  const { base, server } = await serve();
  t.after(() => close(server));
  const response = await fetch(`${base}/research-projects/${PROJECT_ID}/flows`, {
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
  });

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
  const response = await fetch(`${base}/research-projects/${PROJECT_ID}/uploads?laneId=1&revision=1`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not an image",
  });
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

  const response = await fetch(`http://127.0.0.1:${address.port}/research-projects`, {
    headers: { cookie: "astryx_session=user" },
  });
  assert.equal(response.status, 200);
});
