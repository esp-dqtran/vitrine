import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import { createFeatureDocumentStore, type DatabaseQuery } from "./featureDocumentStore.ts";

function emptyResult(): QueryResult<Record<string, unknown>> {
  return {
    command: "UPDATE",
    rowCount: 0,
    oid: 0,
    fields: [],
    rows: [],
  };
}

test("binds only placeholders used by Feature Document cancel and retry queries", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values = []) => {
    calls.push({ sql, values });
    return emptyResult();
  };
  const store = createFeatureDocumentStore(query);

  await store.requestCancel(7, 91);
  await store.retryJob(7, 91, 123);

  assert.deepEqual(calls[0]?.values, [91]);
  assert.deepEqual(calls[1]?.values, [91, 123]);
  assert.match(calls[1]?.sql ?? "", /transport_job_id = \$2/);
  assert.doesNotMatch(calls[1]?.sql ?? "", /\$3/);
});
