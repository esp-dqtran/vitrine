import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRouteLocation, parseRoutePath, routeToPath } from "./router.ts";
import {
  ResearchProjectApiError,
  listResearchProjects,
} from "./researchProjectsApi.ts";

test("maps project routes and rejects invalid project ids", () => {
  assert.equal(routeToPath({ name: "projects" }), "/projects");
  assert.equal(routeToPath({ name: "project", projectId: 17 }), "/projects/17");
  assert.equal(
    routeToPath({ name: "project-document", projectId: 17 }),
    "/projects/17/docs",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      documentId: 42,
    }),
    "/projects/17/docs?doc=42",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      folderId: 8,
    }),
    "/projects/17/docs?folder=8",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      tagId: 9,
    }),
    "/projects/17/docs?tag=9",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      workspaceView: "tags",
    }),
    "/projects/17/docs?view=tags",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      collectionId: 10,
    }),
    "/projects/17/docs?collection=10",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      workspaceView: "journals",
    }),
    "/projects/17/docs?view=journals",
  );
  assert.equal(
    routeToPath({
      name: "project-document",
      projectId: 17,
      workspaceView: "trash",
    }),
    "/projects/17/docs?view=trash",
  );
  assert.deepEqual(parseRoutePath("/projects/17"), {
    name: "project",
    projectId: 17,
  });
  assert.deepEqual(parseRoutePath("/projects/17/docs"), {
    name: "project-document",
    projectId: 17,
  });
  assert.deepEqual(parseRouteLocation("/projects/17/docs", "?doc=42"), {
    name: "project-document",
    projectId: 17,
    documentId: 42,
  });
  assert.deepEqual(parseRouteLocation("/projects/17/docs", "?folder=8"), {
    name: "project-document",
    projectId: 17,
    folderId: 8,
  });
  assert.deepEqual(parseRouteLocation("/projects/17/docs", "?tag=9"), {
    name: "project-document",
    projectId: 17,
    tagId: 9,
  });
  assert.deepEqual(parseRouteLocation("/projects/17/docs", "?view=tags"), {
    name: "project-document",
    projectId: 17,
    workspaceView: "tags",
  });
  assert.deepEqual(
    parseRouteLocation("/projects/17/docs", "?collection=10"),
    {
      name: "project-document",
      projectId: 17,
      collectionId: 10,
    },
  );
  assert.deepEqual(
    parseRouteLocation("/projects/17/docs", "?view=collections"),
    {
      name: "project-document",
      projectId: 17,
      workspaceView: "collections",
    },
  );
  assert.deepEqual(parseRouteLocation("/projects/17/docs", "?view=trash"), {
    name: "project-document",
    projectId: 17,
    workspaceView: "trash",
  });
  assert.deepEqual(parseRoutePath("/projects/0"), {
    name: "not-found",
    pathname: "/projects/0",
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
        project: { id: 1, revision: 3 },
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
