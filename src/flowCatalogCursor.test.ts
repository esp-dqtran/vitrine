import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  decodeFlowCatalogCursor,
  encodeFlowCatalogCursor,
  flowCatalogQueryIdentity,
  FlowCatalogCursorError,
  type FlowCatalogCursor,
} from "./flowCatalogCursor.ts";

const secret = "flow-cursor-secret-0123456789abcdef";
const wrong = "wrong-flow-secret-0123456789abcdef";
const identity = flowCatalogQueryIdentity({
  query: "log in",
  flowGroups: ["account management"],
});
const grouped: FlowCatalogCursor = {
  v: 1,
  sort: "grouped",
  platform: "web",
  snapshotAt: "2026-07-29T05:00:00.000Z",
  identity,
  key: {
    other: 0,
    categoryCount: 1081,
    category: "account management",
    categoryId: "7",
    count: 744,
    title: "logging in",
    flowId: "42",
  },
};

function signed(payload: unknown): string {
  return Buffer.from(JSON.stringify({
    payload,
    signature: createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("base64url"),
  })).toString("base64url");
}

test("round-trips exact versioned grouped and popular Flow cursors", () => {
  const popular: FlowCatalogCursor = {
    ...grouped,
    sort: "popular",
    key: { ...grouped.key, categoryRank: 2 },
  };
  for (const cursor of [grouped, popular]) {
    assert.deepEqual(decodeFlowCatalogCursor(
      encodeFlowCatalogCursor(cursor, secret),
      { sort: cursor.sort, platform: cursor.platform, identity },
      secret,
    ), cursor);
  }
  const other: FlowCatalogCursor = {
    ...grouped,
    key: {
      ...grouped.key,
      other: 1,
      category: "other flows",
      categoryId: "0",
    },
  };
  assert.deepEqual(decodeFlowCatalogCursor(
    encodeFlowCatalogCursor(other, secret),
    { sort: "grouped", platform: "web", identity },
    secret,
  ), other);
});

test("rejects tampering, wrong secret, sort/platform/filter mismatch, and overlong input", () => {
  const encoded = encodeFlowCatalogCursor(grouped, secret);
  for (const run of [
    () => decodeFlowCatalogCursor(`${encoded.slice(0, -1)}A`, {
      sort: "grouped", platform: "web", identity,
    }, secret),
    () => decodeFlowCatalogCursor(encoded, {
      sort: "grouped", platform: "web", identity,
    }, wrong),
    () => decodeFlowCatalogCursor(encoded, {
      sort: "popular", platform: "web", identity,
    }, secret),
    () => decodeFlowCatalogCursor(encoded, {
      sort: "grouped", platform: "ios", identity,
    }, secret),
    () => decodeFlowCatalogCursor(encoded, {
      sort: "grouped", platform: "web", identity: flowCatalogQueryIdentity({ query: "other" }),
    }, secret),
    () => decodeFlowCatalogCursor("A".repeat(2_049), {
      sort: "grouped", platform: "web", identity,
    }, secret),
  ]) assert.throws(run, FlowCatalogCursorError);
});

test("rejects extra keys and impossible tuple values before use", () => {
  for (const payload of [
    { ...grouped, extra: true },
    { ...grouped, key: { ...grouped.key, extra: true } },
    { ...grouped, key: { ...grouped.key, count: -1 } },
    { ...grouped, key: { ...grouped.key, categoryCount: 2_147_483_648 } },
    { ...grouped, key: { ...grouped.key, category: "Not Normalized" } },
    { ...grouped, key: { ...grouped.key, flowId: "9223372036854775808" } },
  ]) {
    assert.throws(() => decodeFlowCatalogCursor(signed(payload), {
      sort: "grouped", platform: "web", identity,
    }, secret), FlowCatalogCursorError);
  }
});

test("round-trips the maximum bounded taxonomy sort keys", () => {
  const longKey = "a".repeat(120);
  const cursor: FlowCatalogCursor = {
    ...grouped,
    key: {
      ...grouped.key,
      category: longKey,
      title: "t".repeat(120),
      categoryId: "7",
    },
  };
  const encoded = encodeFlowCatalogCursor(cursor, secret);
  assert.ok(encoded.length <= 2_048);
  assert.deepEqual(decodeFlowCatalogCursor(encoded, {
    sort: "grouped",
    platform: "web",
    identity,
  }, secret), cursor);
  assert.throws(() => encodeFlowCatalogCursor({
    ...cursor,
    key: { ...cursor.key, title: "t".repeat(121) },
  }, secret), FlowCatalogCursorError);
});
