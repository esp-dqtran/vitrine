import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  FlowInstanceSearchCache,
  searchPublishedFlowInstances,
} from "./flowInstanceSearchStore.ts";

function result(rows: Record<string, unknown>[] = []): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

function row(app: string, versionFlowId: number): Record<string, unknown> {
  return {
    flow_id: "72",
    category_id: "2",
    category: "Onboarding",
    category_key: "onboarding",
    flow_type: "Welcome / value proposition",
    flow_type_key: "onboarding/welcome",
    title: "Onboarding",
    title_key: "onboarding",
    exact_match: 2,
    title_term_matches: 1,
    term_matches: 1,
    version_id: versionFlowId + 100,
    version_number: 1,
    app,
    app_name: app.toUpperCase(),
    app_icon_url: null,
    version_flow_id: versionFlowId,
    source_flow_id: `mobbin-flow-${app}`,
    description: "New-user onboarding",
    tags: ["onboarding"],
    steps: [{ label: "Welcome", evidence: [versionFlowId + 1] }],
  };
}

test("returns separate published app instances for one canonical Flow", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const items = await searchPublishedFlowInstances({
    platform: "web",
    query: "new user onboarding flow",
    limit: 4,
    now: () => new Date("2026-09-03T00:00:00.000Z"),
  }, async (sql, values) => {
    calls.push({ sql, values });
    return result([row("slite", 11), row("superlist", 12)]);
  });

  assert.deepEqual(items.map(({ preview, title }) => ({
    app: preview.appId,
    flowId: preview.sourceFlowId,
    title,
  })), [
    { app: "slite", flowId: "flow-slite", title: "Onboarding" },
    { app: "superlist", flowId: "flow-superlist", title: "Onboarding" },
  ]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.values, [
    "web",
    "2026-09-03T00:00:00.000Z",
    "new user onboarding flow",
    ["new", "user", "onboard", "flow"],
    3,
    4,
  ]);
  assert.match(calls[0]!.sql, /exact_flow_matches AS MATERIALIZED/);
  assert.match(calls[0]!.sql, /PARTITION BY candidate\.app, candidate\.title_key/);
  assert.match(calls[0]!.sql, /JOIN latest ON latest\.version_id = app_flow\.version_id/);
});

test("does not query the catalog for an empty search", async () => {
  let called = false;
  const items = await searchPublishedFlowInstances({
    platform: "web",
    query: "   ",
  }, async () => {
    called = true;
    return result();
  });
  assert.deepEqual(items, []);
  assert.equal(called, false);
});

test("caches warm instance searches with bounded TTL and LRU eviction", async () => {
  let now = 0;
  let calls = 0;
  const cache = new FlowInstanceSearchCache({ maxEntries: 1, ttlMs: 100, now: () => now });
  const runQuery = async () => {
    calls += 1;
    return result([row("slite", calls)]);
  };
  const input = {
    platform: "web" as const,
    query: "onboarding",
    limit: 4,
    cache,
    now: () => new Date("2026-09-03T00:00:00.000Z"),
  };

  await searchPublishedFlowInstances(input, runQuery);
  await searchPublishedFlowInstances(input, runQuery);
  assert.equal(calls, 1);
  assert.equal(cache.size, 1);

  await searchPublishedFlowInstances({ ...input, query: "logging in" }, runQuery);
  assert.equal(calls, 2);
  assert.equal(cache.size, 1);

  now = 101;
  await searchPublishedFlowInstances({ ...input, query: "logging in" }, runQuery);
  assert.equal(calls, 3);
});
