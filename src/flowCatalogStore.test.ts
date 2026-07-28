import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  FlowCatalogCursorError,
  publishedFlowCatalogPage,
  type FlowCatalogQuery,
} from "./flowCatalogStore.ts";

function result(rows: Record<string, unknown>[] = []): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

test("returns grouped normalized Flow counts with bounded pagination", async () => {
  let capturedSql = "";
  let capturedValues: readonly unknown[] | undefined;
  const query: FlowCatalogQuery = async (sql, values) => {
    capturedSql = sql;
    capturedValues = values;
    return result([
      {
        category: "Account Management",
        title: "Editing Profile",
        count: 1081,
        version_id: 7,
        app: "linear",
        app_name: "Linear",
        app_icon_url: "https://cdn.example.com/linear.png",
        version_flow_id: 71,
        source_flow_id: "editing-profile",
        description: "",
        tags: [],
        steps: [{ label: "Open profile", evidence: [10] }],
      },
      {
        category: "Account Management",
        title: "Logging In",
        count: 744,
        version_id: 7,
        app: "linear",
        app_name: "Linear",
        app_icon_url: "https://cdn.example.com/linear.png",
        version_flow_id: 72,
        source_flow_id: "logging-in",
        description: "",
        tags: [],
        steps: [{ label: "Submit", evidence: [11] }],
      },
      {
        category: "Commerce & Finance",
        title: "Checkout",
        count: 620,
        version_id: 8,
        app: "stripe",
        app_name: "Stripe",
        app_icon_url: null,
        version_flow_id: 80,
        source_flow_id: "checkout",
        description: "",
        tags: [],
        steps: [{ label: "Pay", evidence: [12] }],
      },
    ]);
  };

  const page = await publishedFlowCatalogPage({
    platform: "web",
    query: "account",
    limit: 2,
  }, query);

  assert.equal(page.items.length, 2);
  assert.deepEqual(
    page.items.map(({ category, title, count }) => ({ category, title, count })),
    [
      { category: "Account Management", title: "Editing Profile", count: 1081 },
      { category: "Account Management", title: "Logging In", count: 744 },
    ],
  );
  assert.deepEqual(page.items[0]?.preview, {
    appId: "linear",
    appName: "Linear",
    appIconUrl: "https://cdn.example.com/linear.png",
    screenCount: 1,
    flow: {
      id: "linear:71",
      title: "Editing Profile",
      category: "Account Management",
      description: "",
      tags: [],
      steps: [{
        label: "Open profile",
        evidence: [{
          imageId: 1,
          imageUrl: "/api/catalog/flow-media/linear/web/7/71/1",
          thumbnailUrl: "/api/catalog/flow-media/linear/web/7/71/1",
          description: "Open profile",
        }],
      }],
    },
  });
  assert.ok(page.nextCursor);
  assert.deepEqual(capturedValues, ["web", "account", 0, 3, "grouped"]);
  assert.match(capturedSql, /JOIN app_flow_version_mappings mapping/);
  assert.match(capturedSql, /JOIN flows canonical/);
  assert.match(capturedSql, /LEFT JOIN flows parent/);
  assert.match(capturedSql, /COUNT\(\*\)::int AS count/);
  assert.match(capturedSql, /SELECT DISTINCT app_id, category, title/);
  assert.match(capturedSql, /COUNT\(DISTINCT app_id\)::int AS count/);
  assert.match(capturedSql, /ARRAY_AGG/);
  assert.match(capturedSql, /SUM\(count\) OVER \(PARTITION BY category\)/);
  assert.match(capturedSql, /ROW_NUMBER\(\) OVER/);
  assert.match(capturedSql, /representatives AS/);
});

test("continues from an opaque cursor and rejects malformed cursors", async () => {
  let cursor = "";
  const first = await publishedFlowCatalogPage(
    { platform: "ios", limit: 1 },
    async () => result([
      { category: "Onboarding", title: "Creating Account", count: 727 },
      { category: "Onboarding", title: "Browsing Tutorial", count: 217 },
    ]),
  );
  cursor = first.nextCursor ?? "";

  let values: readonly unknown[] | undefined;
  await publishedFlowCatalogPage(
    { platform: "ios", cursor, limit: 1 },
    async (_sql, nextValues) => {
      values = nextValues;
      return result();
    },
  );

  assert.deepEqual(values, ["ios", "", 1, 2, "grouped"]);
  await assert.rejects(
    () => publishedFlowCatalogPage(
      { platform: "web", cursor: "***" },
      async () => result(),
    ),
    FlowCatalogCursorError,
  );
});
