import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalObjectStore, type ObjectMetadata } from "./objectStore.ts";

const sha256 = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");

function input(overrides: Partial<ObjectMetadata & { body: Uint8Array }> = {}) {
  const body = overrides.body ?? Buffer.from("fixture");
  return {
    key: "images/301/" + "a".repeat(64) + ".png",
    body,
    byteSize: body.byteLength,
    sha256: sha256(body),
    contentType: "image/png" as const,
    accessClass: "protected" as const,
    ...overrides,
  };
}

async function withStore(run: (store: LocalObjectStore, root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "astryx-object-store-"));
  try {
    await run(new LocalObjectStore(root), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("rejects traversal, absolute, backslash, control-byte, and invalid-character keys", async () => {
  await withStore(async (store) => {
    for (const key of ["..", "images/../escape.png", "images/./alias.png", "images//alias.png", "images/", "/absolute.png", "images\\escape.png", "images/\0bad.png", "Images/upper.png", "images/space bad.png"]) {
      await assert.rejects(store.put(input({ key })), /invalid object key/i, key);
    }
  });
});

test("accepts every allowed key character", async () => {
  await withStore(async (store) => {
    const result = await store.put(input({ key: "images/az09/_-=.@/file.png" }));
    assert.equal(result.created, true);
  });
});

test("rejects content types outside the storage allowlist", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      store.put(input({ contentType: "text/html" as "image/png" })),
      /unsupported content type/i,
    );
  });
});

test("rejects declared byte sizes that do not match the body", async () => {
  await withStore(async (store) => {
    await assert.rejects(store.put(input({ byteSize: 6 })), /byte size mismatch/i);
  });
});

test("rejects SHA-256 values that do not match the body", async () => {
  await withStore(async (store) => {
    await assert.rejects(store.put(input({ sha256: "0".repeat(64) })), /sha-256 mismatch/i);
  });
});

test("rejects content larger than 64 MiB and accepts the ceiling", async () => {
  await withStore(async (store) => {
    const maximum = Buffer.alloc(64 * 1024 * 1024);
    assert.equal((await store.put(input({ key: "media/maximum.bin", body: maximum }))).created, true);

    const tooLarge = Buffer.alloc(64 * 1024 * 1024 + 1);
    await assert.rejects(
      store.put(input({ key: "media/too-large.bin", body: tooLarge })),
      /64 MiB/i,
    );
  });
});

test("put is idempotent for identical content and rejects overwrite mismatches", async () => {
  await withStore(async (store) => {
    const original = input();
    assert.deepEqual(await store.put(original), {
      created: true,
      metadata: {
        key: original.key,
        sha256: original.sha256,
        byteSize: 7,
        contentType: "image/png",
        accessClass: "protected",
      },
    });
    assert.deepEqual(await store.put(original), {
      created: false,
      metadata: {
        key: original.key,
        sha256: original.sha256,
        byteSize: 7,
        contentType: "image/png",
        accessClass: "protected",
      },
    });

    await assert.rejects(
      store.put(input({ body: Buffer.from("changed") })),
      /object already exists with different metadata/i,
    );
  });
});

test("concurrent identical puts converge idempotently", async () => {
  await withStore(async (store) => {
    const results = await Promise.all([store.put(input()), store.put(input())]);
    assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
    assert.deepEqual((await store.get(input().key)).body, Buffer.from("fixture"));
  });
});

test("concurrent puts can create different keys under one new prefix", async () => {
  await withStore(async (store) => {
    const results = await Promise.all([
      store.put(input({ key: "shared/a.png" })),
      store.put(input({ key: "shared/b.png" })),
    ]);
    assert.deepEqual(results.map((result) => result.created), [true, true]);
  });
});

test("put repairs matching body-only and metadata-only partial publications", async () => {
  await withStore(async (store, root) => {
    const stored = input();
    const bodyPath = path.join(root, stored.key);
    await mkdir(path.dirname(bodyPath), { recursive: true });
    await writeFile(bodyPath, stored.body, { mode: 0o600 });
    assert.equal((await store.put(stored)).created, false);
    assert.deepEqual((await store.get(stored.key)).body, Buffer.from("fixture"));

    await rm(bodyPath);
    assert.equal((await store.put(stored)).created, false);
    assert.deepEqual((await store.get(stored.key)).body, Buffer.from("fixture"));
  });
});

test("idempotent put verifies existing bytes instead of trusting the sidecar", async () => {
  await withStore(async (store, root) => {
    const stored = input();
    await store.put(stored);
    await writeFile(path.join(root, stored.key), "corrupt");
    await assert.rejects(store.put(stored), /checksum|bytes.*metadata/i);
  });
});

test("rejects symlinked ancestors inside the storage root", async () => {
  const outside = await mkdtemp(path.join(tmpdir(), "astryx-object-outside-"));
  try {
    await withStore(async (store, root) => {
      await symlink(outside, path.join(root, "images"));
      await assert.rejects(store.put(input()), /symlink|storage root/i);
      await assert.rejects(readFile(path.join(outside, "301", `${"a".repeat(64)}.png`)));
    });
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("get and head return stored bytes and metadata", async () => {
  await withStore(async (store) => {
    const stored = input();
    await store.put(stored);
    const metadata = {
      key: stored.key,
      sha256: stored.sha256,
      byteSize: stored.byteSize,
      contentType: stored.contentType,
      accessClass: stored.accessClass,
    };

    assert.deepEqual(await store.head(stored.key), metadata);
    assert.deepEqual(await store.get(stored.key), { metadata, body: Buffer.from("fixture") });
    assert.equal(await store.head("images/missing.png"), undefined);
    assert.equal(await store.signedGetUrl(stored.key, 60), undefined);
  });
});

test("list returns metadata in key order and supports a prefix", async () => {
  await withStore(async (store) => {
    await store.put(input({ key: "exports/b.json", contentType: "application/json" }));
    await store.put(input({ key: "images/a.png" }));
    await store.put(input({ key: "images/b.png" }));

    const all: string[] = [];
    for await (const metadata of store.list()) all.push(metadata.key);
    assert.deepEqual(all, ["exports/b.json", "images/a.png", "images/b.png"]);

    const images: string[] = [];
    for await (const metadata of store.list("images/")) images.push(metadata.key);
    assert.deepEqual(images, ["images/a.png", "images/b.png"]);
  });
});

test("delete removes bytes and metadata and reports whether an object existed", async () => {
  await withStore(async (store) => {
    const stored = input();
    await store.put(stored);
    assert.equal(await store.delete(stored.key), true);
    assert.equal(await store.delete(stored.key), false);
    assert.equal(await store.head(stored.key), undefined);
    await assert.rejects(store.get(stored.key), /not found/i);
  });
});

test("delete repairs body-only and metadata-only partial states", async () => {
  await withStore(async (store, root) => {
    const stored = input();
    const bodyPath = path.join(root, stored.key);
    await mkdir(path.dirname(bodyPath), { recursive: true });
    await writeFile(bodyPath, stored.body);
    assert.equal(await store.delete(stored.key), true);
    assert.equal(await store.delete(stored.key), false);

    await writeFile(`${bodyPath}.metadata.json`, JSON.stringify({
      key: stored.key, sha256: stored.sha256, byteSize: stored.byteSize,
      contentType: stored.contentType, accessClass: stored.accessClass,
    }));
    assert.equal(await store.delete(stored.key), true);
    assert.equal(await store.delete(stored.key), false);
  });
});
