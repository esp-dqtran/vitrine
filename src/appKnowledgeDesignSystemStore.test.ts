import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import {
  createAppKnowledgeStore,
  type DatabaseQuery,
} from "./appKnowledgeStore.ts";

function result(rows: Record<string, unknown>[] = [], rowCount = rows.length): QueryResult<Record<string, unknown>> {
  return {
    command: "",
    rowCount,
    oid: 0,
    fields: [],
    rows,
  };
}

test("prepares deterministic design-system chunks and returns their durable state", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT chunk_key")) {
      return result([
        {
          chunk_key: "a".repeat(64),
          ordinal: 0,
          status: "pending",
          fragment: null,
          attempt_count: 0,
          error_code: null,
        },
        {
          chunk_key: "b".repeat(64),
          ordinal: 1,
          status: "complete",
          fragment: { components: [] },
          attempt_count: 1,
          error_code: null,
        },
      ]);
    }
    return result([], 1);
  };
  const store = createAppKnowledgeStore(query);

  const records = await store.prepareDesignSystemChunks(7, [
    { key: "a".repeat(64), ordinal: 0 },
    { key: "b".repeat(64), ordinal: 1 },
  ]);

  assert.deepEqual(records, [
    {
      key: "a".repeat(64),
      ordinal: 0,
      status: "pending",
      attemptCount: 0,
    },
    {
      key: "b".repeat(64),
      ordinal: 1,
      status: "complete",
      fragment: { components: [] },
      attemptCount: 1,
    },
  ]);
  assert.match(calls[0].sql, /INSERT INTO app_knowledge_design_system_chunks/);
  assert.match(calls[0].sql, /ON CONFLICT \(job_id, chunk_key\) DO NOTHING/);
  assert.deepEqual(calls[0].values, [
    7,
    ["a".repeat(64), "b".repeat(64)],
    [0, 1],
  ]);
});

test("records design-system chunk success and failure only for active jobs", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ id: 1 }], 1);
  };
  const store = createAppKnowledgeStore(query);

  await store.recordDesignSystemChunkResult(9, {
    key: "c".repeat(64),
    fragment: { designLanguage: { color: [] } },
    attemptCount: 2,
  });
  await store.recordDesignSystemChunkFailure(9, {
    key: "d".repeat(64),
    errorCode: "provider_timeout",
    attemptCount: 3,
  });

  assert.match(calls[0].sql, /j.status = 'running'/);
  assert.deepEqual(calls[0].values, [
    9,
    "c".repeat(64),
    JSON.stringify({ designLanguage: { color: [] } }),
    2,
  ]);
  assert.match(calls[1].sql, /status = 'failed'/);
  assert.deepEqual(calls[1].values, [
    9,
    "d".repeat(64),
    "provider_timeout",
    3,
  ]);
});
