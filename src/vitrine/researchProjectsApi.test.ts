import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRouteLocation, parseRoutePath, routeToPath } from "./router.ts";
import {
  ResearchProjectApiError,
  addResearchProjectMember,
  attachResearchFlow,
  getResearchProjectCanvas,
  listResearchProjects,
  listResearchProjectMembers,
  removeResearchProjectMember,
  saveResearchProjectCanvas,
} from "./researchProjectsApi.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

test("maps UUID Project routes and rejects incremental project ids", () => {
  assert.equal(routeToPath({ name: "projects" }), "/projects");
  assert.equal(
    routeToPath({ name: "project", projectId: PROJECT_ID }),
    `/projects/${PROJECT_ID}`,
  );
  assert.equal(
    routeToPath({ name: "project-playground", projectId: PROJECT_ID }),
    `/projects/${PROJECT_ID}/playground`,
  );
  assert.deepEqual(parseRoutePath(`/projects/${PROJECT_ID}`), {
    name: "project",
    projectId: PROJECT_ID,
  });
  assert.deepEqual(parseRoutePath(`/projects/${PROJECT_ID}/playground`), {
    name: "project-playground",
    projectId: PROJECT_ID,
  });
  assert.deepEqual(parseRouteLocation("/projects/7"), {
    name: "not-found",
    pathname: "/projects/7",
  });
});

test("returns typed API conflicts with the latest project", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: "changed",
        code: "revision_conflict",
        project: { id: PROJECT_ID, revision: 3 },
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );

  await assert.rejects(
    listResearchProjects(),
    (error: unknown) =>
      error instanceof ResearchProjectApiError &&
      error.status === 409 &&
      error.code === "revision_conflict" &&
      error.project?.revision === 3,
  );
});

test("uses the dedicated Excalidraw media type for durable canvas snapshots", async (t) => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ snapshot: null, revision: 0 });
  };

  await getResearchProjectCanvas(PROJECT_ID);
  await saveResearchProjectCanvas(PROJECT_ID, {
    type: "excalidraw",
    version: 2,
    source: "https://astryx.design",
    elements: [],
    appState: {},
    files: {},
  });

  assert.equal(calls[0].url, `/api/research-projects/${PROJECT_ID}/canvas`);
  assert.equal(calls[1].init?.method, "PUT");
  assert.equal(
    (calls[1].init?.headers as Record<string, string>)["content-type"],
    "application/vnd.astryx.excalidraw+json",
  );
});

test("posts a whole catalog flow to the project attachment endpoint", async (t) => {
  const original = globalThis.fetch;
  let call: { url: string; init?: RequestInit } | undefined;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    call = { url: String(input), init };
    return Response.json({ id: PROJECT_ID, revision: 2 });
  };

  await attachResearchFlow({
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
    },
  });

  assert.equal(call?.url, `/api/research-projects/${PROJECT_ID}/flows`);
  assert.equal(call?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(call?.init?.body)), {
    laneId: 21,
    expectedRevision: 1,
    catalog: {
      app: "Linear",
      appId: "linear",
      versionId: 3,
      flowId: "creating-account",
      platform: "web",
      title: "Creating an account",
    },
  });
});

test("uses Project-scoped member endpoints", async (t) => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ members: [], canManage: true });
  };

  await listResearchProjectMembers(PROJECT_ID);
  await addResearchProjectMember(PROJECT_ID, "stakeholder@example.com", "viewer");
  await removeResearchProjectMember(PROJECT_ID, 9);

  assert.equal(calls[0].url, `/api/research-projects/${PROJECT_ID}/members`);
  assert.equal(calls[1].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    email: "stakeholder@example.com",
    role: "viewer",
  });
  assert.equal(calls[2].url, `/api/research-projects/${PROJECT_ID}/members/9`);
  assert.equal(calls[2].init?.method, "DELETE");
});
