import { test } from "node:test";
import assert from "node:assert/strict";
import { groupPipelines } from "./jobs.ts";
import type { Job } from "./types.ts";

const job = (id: number, parent_id: number | null, type: Job["type"]): Job => ({
  id,
  parent_id,
  type,
  payload: { name: "linear" },
  status: "done",
  message: null,
  created_at: `2026-07-10T00:00:0${id}Z`,
  updated_at: null,
});

test("groups import, caption, and synthesis into one ordered pipeline", () => {
  const pipelines = groupPipelines([
    job(3, 2, "synthesize-app"),
    job(2, 1, "caption-app"),
    job(1, null, "import-app"),
  ]);
  assert.equal(pipelines.length, 1);
  assert.deepEqual(
    pipelines[0].stages.map((stage) => stage.type),
    ["import-app", "caption-app", "synthesize-app"]
  );
});
