import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  publishedCatalogPage,
  type DatabaseQuery,
} from "./publicCatalogStore.ts";
import {
  CatalogCursorError,
  decodeUpdatedCatalogCursor,
  encodeUpdatedCatalogCursor,
} from "./catalogCursor.ts";

function result(rows: Record<string, unknown>[] = []): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

function preview(app: string, id: number) {
  return {
    id,
    app,
    platform: "web",
    image_url: `capture:${String(id).padStart(16, "0")}`,
    kind: "screen",
    description: null,
    analysis: null,
    capture_url: null,
    viewport_width: 1440,
    viewport_height: 900,
    state_context: null,
    captured_at: "2026-07-25T00:00:00.000Z",
    preview_rank: 1,
  };
}

test("selects published Apps globally by Updated At and emits a snapshot cursor", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const selected = [
    { app_id: 91, app: "alltrails", updated_at: "2026-07-26T03:14:54.618Z" },
    { app_id: 42, app: "ipsy", updated_at: "2026-07-26T03:03:57.624Z" },
    { app_id: 17, app: "tubi", updated_at: "2026-07-26T02:57:07.457Z" },
  ];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return result(selected);
    if (calls.length === 2) {
      return result(selected.slice(0, 2).reverse().map(({ app_id, app }) => ({
        app_id,
        app,
        display_name: app.toUpperCase(),
        categories: [{
          id: 7,
          name: "Productivity",
          slug: "productivity",
        }],
        website_url: null,
        icon_url: null,
        accent_color: "#123456",
        total_screens: 12,
        available_platforms: ["web"],
      })));
    }
    return result(selected.slice(0, 2).map(({ app }, index) => preview(app, index + 1)));
  };

  const page = await publishedCatalogPage(
    { limit: 2, now: new Date("2026-07-26T04:00:00.000Z") },
    query,
  );

  assert.deepEqual(page.apps.map(({ app }) => app), ["alltrails", "ipsy"]);
  assert.equal(page.apps[0]?.last_captured_at, selected[0]?.updated_at);
  assert.deepEqual(decodeUpdatedCatalogCursor(page.nextCursor!), {
    v: 1,
    sort: "updated",
    snapshotAt: "2026-07-26T04:00:00.000Z",
    updatedAt: "2026-07-26T03:03:57.624Z",
    appId: 42,
  });
  assert.deepEqual(calls[0]?.values, [
    "2026-07-26T04:00:00.000Z",
    null,
    null,
    null,
    null,
    null,
    3,
  ]);
  assert.match(calls[0]?.sql ?? "", /ORDER BY updated_at DESC,\s*app_id DESC/);
  assert.match(calls[0]?.sql ?? "", /MAX\(latest\.captured_at\) AS updated_at/);
  assert.match(calls[0]?.sql ?? "", /latest\.screen_count > 0/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /JOIN LATERAL/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /JOIN images/);
  assert.match(calls[0]?.sql ?? "", /av\.published_at <= \$1::timestamptz/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /av\.status = 'published'/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /GROUP BY[\s\S]*MAX\(i\.created_at\)/);
  assert.match(calls[1]?.sql ?? "", /\b(?:FROM|JOIN) app_categories/);
  assert.match(calls[1]?.sql ?? "", /JOIN categories/);
  assert.match(calls[1]?.sql ?? "", /jsonb_agg/);
  assert.doesNotMatch(calls[1]?.sql ?? "", /\ba\.category\b/);
});

test("selects one extra Updated At identity before reading bounded catalog metadata", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const identities = Array.from({ length: 25 }, (_, index) => ({
    app_id: index + 1,
    app: `app-${String(index + 1).padStart(2, "0")}`,
    updated_at: new Date(Date.UTC(2026, 6, 26, 4, 0, 0) - index * 1_000).toISOString(),
  }));
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return result(identities);
    if (calls.length === 2) {
      return result(identities.slice(0, 24).map(({ app_id, app }) => ({
        app_id,
        app,
        display_name: app.toUpperCase(),
        categories: [{
          id: 7,
          name: "Productivity",
          slug: "productivity",
        }],
        website_url: null,
        icon_url: null,
        accent_color: "#123456",
        total_screens: 12,
        available_platforms: ["web"],
      })));
    }
    return result(identities.slice(0, 24).map(({ app }, index) => preview(app, index + 1)));
  };

  const page = await publishedCatalogPage(
    { limit: 24, now: new Date("2026-07-26T04:00:00.000Z") },
    query,
  );

  assert.equal(page.apps.length, 24);
  assert.equal(page.previews.length, 24);
  assert.equal(decodeUpdatedCatalogCursor(page.nextCursor!).appId, 24);
  assert.match(calls[0]?.sql ?? "", /LIMIT \$7/);
  assert.match(calls[1]?.sql ?? "", /ANY\(\$1::integer\[\]\)/);
  assert.match(calls[2]?.sql ?? "", /preview_rank <= 3/);
  assert.match(calls[2]?.sql ?? "", /DISTINCT ON \(a\.id, latest\.platform, i\.id\)/);
  assert.match(calls[2]?.sql ?? "", /PARTITION BY app, platform/);
  assert.match(calls[2]?.sql ?? "", /ORDER BY platform_rank, platform/);
});

test("reuses the Updated At snapshot cursor and clamps the page size", async () => {
  const calls: Array<{ values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (_sql, values) => {
    calls.push({ values });
    return result();
  };
  const cursor = encodeUpdatedCatalogCursor({
    v: 1,
    sort: "updated",
    snapshotAt: "2026-07-26T04:00:00.000Z",
    updatedAt: "2026-07-26T03:03:57.624Z",
    appId: 42,
  });

  await publishedCatalogPage({ cursor, limit: 500 }, query);

  assert.deepEqual(calls[0]?.values, [
    "2026-07-26T04:00:00.000Z",
    "2026-07-26T03:03:57.624Z",
    42,
    null,
    null,
    null,
    25,
  ]);
});

test("filters catalog identities by category and platform before pagination", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result();
  };

  await publishedCatalogPage({
    facet: { group: "categories", value: "CRM", platform: "web" },
  }, query);

  assert.deepEqual(calls[0]?.values?.slice(3), ["categories", "CRM", "web", 25]);
  assert.match(calls[0]?.sql ?? "", /JOIN categories c/);
  assert.match(calls[0]?.sql ?? "", /lower\(c\.name\) = lower\(\$5\)/);
  assert.match(calls[0]?.sql ?? "", /platform_latest\.platform = \$6/);
});

test("filters catalog identities through normalized Flow mappings", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result();
  };

  await publishedCatalogPage({
    facet: {
      group: "flows",
      value: "Logging in (saved login info)",
      platform: "android",
    },
  }, query);

  assert.deepEqual(
    calls[0]?.values?.slice(3),
    ["flows", "Logging in (saved login info)", "android", 25],
  );
  assert.match(calls[0]?.sql ?? "", /JOIN app_flow_versions afv/);
  assert.match(calls[0]?.sql ?? "", /JOIN app_flow_version_mappings mapping/);
  assert.match(calls[0]?.sql ?? "", /JOIN flows canonical/);
  assert.match(calls[0]?.sql ?? "", /lower\(canonical\.name\) = lower\(\$5\)/);
});

test("rejects malformed Updated At cursors", async () => {
  await assert.rejects(
    () => publishedCatalogPage(
      { cursor: "***", limit: 3 },
      async () => { throw new Error("query should not run"); },
    ),
    CatalogCursorError,
  );
});
