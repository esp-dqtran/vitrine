import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingDatabase } from "./recordingDatabase.ts";

test("returns scripted rows and records SQL with parameters", async () => {
  const db = createRecordingDatabase([
    { rows: [{ id: 7 }], rowCount: 1 },
  ]);
  const result = await db.query<{ id: number }>(
    "SELECT id FROM users WHERE id = $1",
    [7],
  );
  assert.deepEqual(result.rows, [{ id: 7 }]);
  assert.deepEqual(db.calls, [
    { sql: "SELECT id FROM users WHERE id = $1", params: [7] },
  ]);
});

test("records transaction control without consuming scripted results", async () => {
  const db = createRecordingDatabase([{ rows: [{ ok: true }] }]);
  const client = await db.pool.connect();
  await client.query("BEGIN");
  const result = await client.query<{ ok: boolean }>("SELECT true AS ok");
  await client.query("COMMIT");
  client.release();
  assert.deepEqual(result.rows, [{ ok: true }]);
  assert.deepEqual(db.calls.map(({ sql }) => sql), [
    "BEGIN",
    "SELECT true AS ok",
    "COMMIT",
  ]);
  assert.equal(db.releases, 1);
});
