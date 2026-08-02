import assert from "node:assert/strict";
import { test } from "node:test";

import { startProjectDocumentCollaboration } from "./start.ts";

test("checks migrations before accepting document collaboration traffic", async () => {
  const events: string[] = [];
  await startProjectDocumentCollaboration({
    async assertMigrations() { events.push("migrations"); },
    async start() { events.push("listen"); },
  });
  assert.deepEqual(events, ["migrations", "listen"]);
});
