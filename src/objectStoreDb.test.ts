import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient, QueryResult } from "pg";
import {
  attachImageObject,
  adminImageObject,
  entitledImageObject,
  legacyImageReference,
  imageObjectById,
  publishedPreviewObject,
  type DatabaseQuery,
} from "./objectStoreDb.ts";
import type { ObjectMetadata } from "./objectStore.ts";

const metadata: ObjectMetadata = {
  key: "images/7/aaaaaaaaaaaaaaaa.png",
  sha256: "b".repeat(64),
  byteSize: 123,
  contentType: "image/png",
  accessClass: "protected",
};

function result(rows: Record<string, unknown>[] = [], rowCount = rows.length): QueryResult<any> {
  return { rows, rowCount, command: "SELECT", oid: 0, fields: [] };
}

test("attaches metadata and its image association in one transaction", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO stored_objects")) return result([{ object_key: metadata.key }]);
      if (sql.includes("UPDATE images")) return result([{ id: 7 }]);
      return result();
    },
  } as unknown as PoolClient;

  await attachImageObject(client, { imageId: 7, metadata });

  assert.deepEqual(calls.map(({ sql }) => sql.trim().split(/\s+/)[0]), ["BEGIN", "INSERT", "UPDATE", "COMMIT"]);
  assert.deepEqual(calls[1].values, [metadata.key, metadata.sha256, 123, "image/png", "protected"]);
  assert.deepEqual(calls[2].values, [7, metadata.key]);
});

test("rejects the same object key with different metadata and rolls back", async () => {
  const calls: string[] = [];
  const client = {
    async query(sql: string) {
      calls.push(sql);
      if (sql.includes("INSERT INTO stored_objects")) return result([], 0);
      return result();
    },
  } as unknown as PoolClient;

  await assert.rejects(
    attachImageObject(client, { imageId: 7, metadata }),
    /object key already exists with different metadata/i,
  );
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(calls.some((sql) => sql.includes("UPDATE images")), false);
});

test("rejects invalid metadata before opening a transaction", async () => {
  let calls = 0;
  const client = { async query() { calls += 1; return result(); } } as unknown as PoolClient;
  await assert.rejects(
    attachImageObject(client, { imageId: 7, metadata: { ...metadata, key: "images/../escape.png" } }),
    /invalid object key/i,
  );
  assert.equal(calls, 0);
});

test("rolls back metadata when the image association fails", async () => {
  const calls: string[] = [];
  const client = {
    async query(sql: string) {
      calls.push(sql);
      if (sql.includes("INSERT INTO stored_objects")) return result([{ object_key: metadata.key }]);
      if (sql.includes("UPDATE images")) return result([], 0);
      return result();
    },
  } as unknown as PoolClient;

  await assert.rejects(attachImageObject(client, { imageId: 7, metadata }), /image.*not found|already attached/i);
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(calls.includes("COMMIT"), false);
});

test("customer image lookup is app-scoped, entitled, and in the latest published version", async () => {
  let captured: { sql: string; values?: readonly unknown[] } | undefined;
  const query: DatabaseQuery = async (sql, values) => {
    captured = { sql, values };
    return result([{
      object_key: metadata.key,
      sha256: metadata.sha256,
      byte_size: "123",
      content_type: metadata.contentType,
      access_class: metadata.accessClass,
    }]);
  };

  assert.deepEqual(await entitledImageObject({ userId: 9, app: "alpha", hash: "0123456789abcdef" }, query), metadata);
  assert.deepEqual(captured?.values, [9, "alpha", "0123456789abcdef"]);
  assert.match(captured!.sql, /JOIN platforms p ON p\.id = i\.platform_id/);
  assert.match(captured!.sql, /JOIN apps a ON a\.id = p\.app_id/);
  assert.match(captured!.sql, /JOIN LATERAL[\s\S]+status = 'published'[\s\S]+ORDER BY av\.version_number DESC[\s\S]+LIMIT 1/);
  assert.match(captured!.sql, /JOIN version_images vi ON vi\.version_id = published\.id AND vi\.image_id = i\.id/);
  assert.match(captured!.sql, /subscriptions|free_app_unlocks/);
  assert.match(captured!.sql, /u\.role = 'admin'/);
  assert.match(captured!.sql, /'protected', 'public-preview'/);
  assert.doesNotMatch(captured!.sql, /object_key\s*=\s*\$\d/);
});

test("rejects invalid metadata read from PostgreSQL", async () => {
  const query: DatabaseQuery = async () => result([{
    object_key: metadata.key,
    sha256: "not-a-checksum",
    byte_size: 123,
    content_type: metadata.contentType,
    access_class: metadata.accessClass,
  }]);
  await assert.rejects(
    entitledImageObject({ userId: 9, app: "alpha", hash: "0123456789abcdef" }, query),
    /invalid stored object/i,
  );
});

test("customer image lookup denies cross-app and unpublished objects", async () => {
  const queries: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    queries.push(sql);
    return result();
  };

  assert.equal(await entitledImageObject({ userId: 9, app: "other", hash: "0123456789abcdef" }, query), undefined);
  assert.match(queries[0], /a\.name = \$2/);
  assert.match(queries[0], /published\.id/);
});

test("admin object lookup remains app-scoped without published-only filtering", async () => {
  let captured: { sql: string; values?: readonly unknown[] } | undefined;
  const query: DatabaseQuery = async (sql, values) => {
    captured = { sql, values };
    return result([{ object_key: metadata.key, sha256: metadata.sha256, byte_size: 123, content_type: metadata.contentType, access_class: "internal" }]);
  };
  assert.equal((await adminImageObject({ app: "alpha", hash: "0123456789abcdef" }, query))?.key, metadata.key);
  assert.deepEqual(captured?.values, ["alpha", "0123456789abcdef"]);
  assert.match(captured!.sql, /JOIN platforms p[\s\S]+JOIN apps a/);
  assert.doesNotMatch(captured!.sql, /object_key\s*=\s*\$\d/);
  assert.doesNotMatch(captured!.sql, /status = 'published'/);
});

test("trusted worker lookup resolves metadata by image id without accepting a key", async () => {
  let captured: { sql: string; values?: readonly unknown[] } | undefined;
  const query: DatabaseQuery = async (sql, values) => {
    captured = { sql, values };
    return result([{ object_key: metadata.key, sha256: metadata.sha256, byte_size: 123, content_type: metadata.contentType, access_class: metadata.accessClass }]);
  };
  assert.deepEqual(await imageObjectById(7, query), metadata);
  assert.deepEqual(captured?.values, [7]);
  assert.match(captured!.sql, /JOIN images i ON i\.object_key = so\.object_key/);
  assert.doesNotMatch(captured!.sql, /object_key\s*=\s*\$1/);
});

test("preview lookup uses explicit ranks one to three on the latest published version", async () => {
  let captured: { sql: string; values?: readonly unknown[] } | undefined;
  const query: DatabaseQuery = async (sql, values) => {
    captured = { sql, values };
    return result([{
      object_key: metadata.key,
      sha256: metadata.sha256,
      byte_size: 123,
      content_type: metadata.contentType,
      access_class: "public-preview",
    }]);
  };

  assert.equal((await publishedPreviewObject({ app: "alpha", rank: 3 }, query))?.key, metadata.key);
  assert.deepEqual(captured?.values, ["alpha", 3]);
  assert.match(captured!.sql, /JOIN app_preview_images api ON api\.version_id = published\.id/);
  assert.match(captured!.sql, /ORDER BY av\.version_number DESC/);
  assert.match(captured!.sql, /so\.access_class = 'public-preview'/);
});

test("preview lookup rejects ranks outside one to three without querying", async () => {
  let calls = 0;
  const query: DatabaseQuery = async () => {
    calls += 1;
    return result();
  };
  await assert.rejects(publishedPreviewObject({ app: "alpha", rank: 0 }, query), /rank/i);
  await assert.rejects(publishedPreviewObject({ app: "alpha", rank: 4 }, query), /rank/i);
  assert.equal(calls, 0);
});

test("legacy lookup returns only image rows that have no object association", async () => {
  let captured: { sql: string; values?: readonly unknown[] } | undefined;
  const query: DatabaseQuery = async (sql, values) => {
    captured = { sql, values };
    return result([{ image_url: "capture:0123456789abcdef" }]);
  };

  assert.equal(await legacyImageReference({ app: "alpha", hash: "0123456789abcdef" }, query), "capture:0123456789abcdef");
  assert.deepEqual(captured?.values, ["alpha", "0123456789abcdef"]);
  assert.match(captured!.sql, /i\.object_key IS NULL/);
  assert.match(captured!.sql, /JOIN platforms p[\s\S]+JOIN apps a/);
  assert.match(captured!.sql, /status = 'published'[\s\S]+JOIN version_images/);
});
