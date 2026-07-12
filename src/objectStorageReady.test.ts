import assert from "node:assert/strict";
import test from "node:test";

import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import { verifyObjectStoreReady } from "./objectStorageReady.ts";

const metadata: ObjectMetadata = {
  key: "images/1/" + "a".repeat(64) + ".png",
  sha256: "a".repeat(64),
  byteSize: 1,
  contentType: "image/png",
  accessClass: "protected",
};

function store(list: ObjectStore["list"]): ObjectStore {
  return {
    list,
    async put() { throw new Error("unused"); },
    async head() { throw new Error("unused"); },
    async get() { throw new Error("unused"); },
    async signedGetUrl() { throw new Error("unused"); },
    async delete() { throw new Error("unused"); },
  };
}

test("storage readiness succeeds after a list call reaches the bucket", async () => {
  const prefixes: string[] = [];

  await verifyObjectStoreReady(store(async function* (prefix = "") {
    prefixes.push(prefix);
    yield metadata;
  }));

  assert.deepEqual(prefixes, [""]);
});

test("storage readiness reports a generic failure", async () => {
  await assert.rejects(
    verifyObjectStoreReady(store(async function* () {
      throw new Error("connect ECONNREFUSED http://minio:9000/astryx-media?secret=leaked");
    })),
    (error: unknown) => {
      assert.equal((error as Error).message, "Object storage is unavailable");
      assert.doesNotMatch((error as Error).message, /minio|secret|leaked|9000/);
      return true;
    },
  );
});
