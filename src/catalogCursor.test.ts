import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogCursorError,
  decodeCatalogCursor,
  decodeUpdatedCatalogCursor,
  encodeCatalogCursor,
  encodeUpdatedCatalogCursor,
} from "./catalogCursor.ts";

const cursor = {
  v: 1 as const,
  sort: "updated" as const,
  snapshotAt: "2026-07-26T04:00:00.000Z",
  updatedAt: "2026-07-26T03:14:54.618Z",
  appId: 123,
};

test("round-trips a versioned Updated At cursor", () => {
  assert.deepEqual(
    decodeUpdatedCatalogCursor(encodeUpdatedCatalogCursor(cursor)),
    cursor,
  );
});

test("rejects malformed, mismatched, and non-canonical cursor values", () => {
  for (const value of [
    "***",
    "AQ",
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, v: 2 })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, sort: "popular" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, appId: 0 })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...cursor, updatedAt: "yesterday" })).toString("base64url"),
  ]) {
    assert.throws(() => decodeUpdatedCatalogCursor(value), CatalogCursorError);
  }
});

test("round-trips latest and trending catalog cursors and enforces the requested sort", () => {
  const latest = {
    v: 2 as const,
    sort: "latest" as const,
    snapshotAt: cursor.snapshotAt,
    updatedAt: cursor.updatedAt,
    appId: 123,
  };
  const trending = {
    ...latest,
    sort: "trending" as const,
    totalScreens: 845,
  };

  assert.deepEqual(decodeCatalogCursor(encodeCatalogCursor(latest), "latest"), latest);
  assert.deepEqual(
    decodeCatalogCursor(encodeCatalogCursor(trending), "trending"),
    trending,
  );
  assert.throws(
    () => decodeCatalogCursor(encodeCatalogCursor(latest), "trending"),
    CatalogCursorError,
  );
  assert.throws(
    () => decodeCatalogCursor(encodeCatalogCursor(trending), "latest"),
    CatalogCursorError,
  );
});
