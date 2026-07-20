import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  exportObjectKey,
  failureObjectKey,
  imageObjectKey,
  LocalObjectStore,
  researchUploadObjectKey,
  siteObjectKey,
  type ObjectMetadata,
} from "./objectStore.ts";

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

test("builds deterministic image and export keys from validated identities", () => {
  const digest = "a".repeat(64);
  assert.equal(imageObjectKey(301, digest, "webp"), `images/301/${digest}.webp`);
  assert.equal(exportObjectKey("42", digest, "json"), `exports/42/${digest}.json`);
});

test("research keys are owner scoped", () => {
  const digest = "a".repeat(64);
  assert.equal(researchUploadObjectKey(42, digest, "png"), `research/42/${digest}.png`);
  assert.throws(() => researchUploadObjectKey(0, digest, "png"), /invalid research upload identity/i);
});

test("builds isolated Sites object keys", () => {
  const digest = "a".repeat(64);
  const key = siteObjectKey(
    "site-1",
    "version-1",
    "section",
    "section-1",
    digest,
    "mp4",
  );
  assert.match(key, /^sites\/[0-9a-f]+\/versions\/[0-9a-f]+\/section\/[0-9a-f]+\/[0-9a-f]{64}\.mp4$/);
  assert.equal(key.includes("site-1"), false);
  assert.equal(key.includes("section-1"), false);
  assert.throws(
    () => siteObjectKey("", "version-1", "preview", "preview", digest, "mp4"),
    /invalid object-key identity part/i,
  );
});

test("accepts MP4 while retaining the shared media ceiling", async () => {
  await withStore(async (store) => {
    const body = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70]);
    const digest = sha256(body);
    const key = siteObjectKey("site", "version", "preview", "preview", digest, "mp4");
    const stored = await store.put(input({
      key,
      body,
      contentType: "video/mp4",
    }));
    assert.equal(stored.created, true);
    assert.equal(stored.metadata.byteSize, body.byteLength);
  });
});

test("rejects invalid image IDs, export IDs, hashes, and extensions", () => {
  const digest = "a".repeat(64);
  for (const imageId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => imageObjectKey(imageId, digest, "png"), /invalid image object identity/i);
  }
  for (const exportId of ["", "0", "01", "-1", "1.5", "customer/export"]) {
    assert.throws(() => exportObjectKey(exportId, digest, "zip"), /invalid export object identity/i);
  }
  for (const hash of ["a".repeat(63), "A".repeat(64), "g".repeat(64)]) {
    assert.throws(() => imageObjectKey(1, hash, "png"), /invalid image object identity/i);
    assert.throws(() => exportObjectKey("1", hash, "zip"), /invalid export object identity/i);
  }
  for (const extension of ["", "jpeg", "PNG", ".png", "png/../json", "html"]) {
    assert.throws(() => imageObjectKey(1, digest, extension), /invalid object extension/i);
    assert.throws(() => exportObjectKey("1", digest, extension), /invalid object extension/i);
  }
});

test("builds failure keys with byte-encoded flow and step identities", () => {
  const digest = "b".repeat(64);
  assert.equal(
    failureObjectKey("7", "flow/../customer Acme", "画面-1", digest),
    `crawl-failures/7/${Buffer.from("flow/../customer Acme").toString("hex")}/${Buffer.from("画面-1").toString("hex")}/${digest}.png`,
  );
});

test("failure keys never expose traversal or customer text", () => {
  const flowId = "../../Customer Name/private";
  const stepId = "https://customer.example/account?token=secret";
  const key = failureObjectKey("9", flowId, stepId, "c".repeat(64));
  assert.equal(key.includes(".."), false);
  assert.equal(key.includes("Customer"), false);
  assert.equal(key.includes("customer.example"), false);
  assert.equal(key.includes("secret"), false);
});

test("rejects invalid failure run IDs, hashes, and empty or oversized encoded parts", () => {
  const digest = "d".repeat(64);
  for (const runId of ["", "0", "01", "-1", "1.5", "run-1"]) {
    assert.throws(() => failureObjectKey(runId, "flow", "step", digest), /invalid failure object identity/i);
  }
  for (const hash of ["d".repeat(63), "D".repeat(64), "z".repeat(64)]) {
    assert.throws(() => failureObjectKey("1", "flow", "step", hash), /invalid failure object identity/i);
  }
  for (const [flowId, stepId] of [["", "step"], ["flow", ""], ["é".repeat(61), "step"], ["flow", "é".repeat(61)]]) {
    assert.throws(() => failureObjectKey("1", flowId, stepId, digest), /invalid object-key identity part/i);
  }
  assert.doesNotThrow(() => failureObjectKey("1", "é".repeat(60), "x".repeat(120), digest));
});

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
