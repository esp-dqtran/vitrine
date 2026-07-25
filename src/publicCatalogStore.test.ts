import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  publishedCatalogPage,
  type DatabaseQuery,
} from "./publicCatalogStore.ts";

function result(rows: Record<string, unknown>[] = []): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

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

test("selects one extra app name before reading bounded catalog metadata", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const names = Array.from({ length: 25 }, (_, index) => ({
    app: `app-${String(index + 1).padStart(2, "0")}`,
  }));
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return result(names);
    if (calls.length === 2) {
      return result(names.slice(0, 24).map(({ app }) => ({
        app,
        display_name: app.toUpperCase(),
        category: "Productivity",
        website_url: null,
        icon_url: null,
        accent_color: "#123456",
        total_screens: 12,
        available_platforms: ["web"],
      })));
    }
    return result(names.slice(0, 24).map(({ app }, index) => preview(app, index + 1)));
  };

  const page = await publishedCatalogPage({ limit: 24 }, query);

  assert.equal(page.apps.length, 24);
  assert.equal(page.previews.length, 24);
  assert.equal(decode(page.nextCursor!), "app-24");
  assert.deepEqual(calls[0]?.values, [null, 25]);
  assert.match(calls[0]?.sql ?? "", /LIMIT \$2/);
  assert.match(calls[1]?.sql ?? "", /ANY\(\$1::text\[\]\)/);
  assert.match(calls[2]?.sql ?? "", /preview_rank <= 3/);
});

test("uses a decoded app-name cursor and clamps the page size", async () => {
  const calls: Array<{ values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (_sql, values) => {
    calls.push({ values });
    return result();
  };

  await publishedCatalogPage({ cursor: encode("linear"), limit: 500 }, query);

  assert.deepEqual(calls[0]?.values, ["linear", 25]);
});

test("treats malformed cursors as the first page", async () => {
  const calls: Array<{ values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (_sql, values) => {
    calls.push({ values });
    return result();
  };

  await publishedCatalogPage({ cursor: "***", limit: 3 }, query);

  assert.deepEqual(calls[0]?.values, [null, 4]);
});
