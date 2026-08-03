import assert from "node:assert/strict";
import { test } from "node:test";
import { startDesignerCanvasCollaboration } from "./start.ts";

test("checks database migrations before accepting collaboration traffic", async () => {
  const events: string[] = [];
  await startDesignerCanvasCollaboration({
    async assertMigrations() { events.push("migrations"); },
    async start() { events.push("listen"); },
  });
  assert.deepEqual(events, ["migrations", "listen"]);
});
