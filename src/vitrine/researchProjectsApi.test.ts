import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRoutePath, routeToPath } from "./router.ts";
import {
  ResearchProjectApiError,
  listResearchProjects,
} from "./researchProjectsApi.ts";

test("maps project routes and rejects invalid project ids", () => {
  assert.equal(routeToPath({ name: "projects" }), "/projects");
  assert.equal(routeToPath({ name: "project", projectId: 17 }), "/projects/17");
  assert.deepEqual(parseRoutePath("/projects/17"), { name: "project", projectId: 17 });
  assert.deepEqual(parseRoutePath("/projects/0"), { name: "landing" });
});

test("returns typed API conflicts with the latest project", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "changed",
    code: "revision_conflict",
    project: { id: 1, revision: 3 },
  }), { status: 409, headers: { "content-type": "application/json" } });

  await assert.rejects(
    listResearchProjects(),
    (error: unknown) => error instanceof ResearchProjectApiError
      && error.status === 409
      && error.code === "revision_conflict"
      && error.project?.revision === 3,
  );
});
