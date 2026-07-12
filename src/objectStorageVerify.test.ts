import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import {
  verifyObjectStorage,
  type ObjectStorageVerificationSource,
  type VerificationImage,
} from "./objectStorageVerify.ts";

const firstBody = Buffer.from("first image");
const secondBody = Buffer.from("export bytes");

function metadata(key: string, body: Buffer, accessClass: ObjectMetadata["accessClass"]): ObjectMetadata {
  return {
    key,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.byteLength,
    contentType: key.endsWith(".png") ? "image/png" : "application/zip",
    accessClass,
  };
}

const imageObject = metadata("images/7/first.png", firstBody, "protected");
const exportObject = metadata("exports/9/archive.zip", secondBody, "internal");

function fixtures(): {
  source: ObjectStorageVerificationSource;
  store: ObjectStore;
  images: VerificationImage[];
} {
  const images: VerificationImage[] = [{
    id: 7,
    app: "linear",
    legacyReference: "mobbin-bulk:0123456789abcdef",
    object: imageObject,
  }];
  const objects = new Map([[imageObject.key, { metadata: imageObject, body: firstBody }], [
    exportObject.key, { metadata: exportObject, body: secondBody },
  ]]);
  return {
    images,
    source: {
      loadImages: async () => images,
      loadStoredObjects: async () => [imageObject, exportObject],
      loadObjectReferences: async () => [
        { kind: "image", id: "7", objectKey: imageObject.key, object: imageObject },
        { kind: "export", id: "9", objectKey: exportObject.key, object: exportObject },
      ],
      loadRelationshipIntegrity: async () => ({ total: 4, invalid: 0 }),
      loadPreviews: async () => [
        { appId: 3, versionId: 12, latestPublishedVersionId: 12, imageId: 7, rank: 1, belongsToVersion: true },
      ],
      readLegacyBytes: async () => firstBody,
    },
    store: {
      head: async (key) => objects.get(key)?.metadata,
      get: async (key) => {
        const object = objects.get(key);
        if (!object) throw new Error("missing");
        return object;
      },
    } as ObjectStore,
  };
}

test("verifies all parity checks and emits only aggregate evidence", async () => {
  const { source, store } = fixtures();
  const report = await verifyObjectStorage(source, store);

  const evidence = `7\0${imageObject.key}\0${imageObject.sha256}\0${imageObject.byteSize}\n`;
  assert.deepEqual(report, {
    totalObjects: 2,
    totalBytes: imageObject.byteSize + exportObject.byteSize,
    totalImages: 1,
    versionImageRelationships: 4,
    previewRows: 1,
    compatibilityChecks: 1,
    evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
  });
  assert.doesNotMatch(JSON.stringify(report), /postgres|https?:|\/Users\/|secret|signed/i);
});

test("fails when an image has no stored object", async () => {
  const { source, store, images } = fixtures();
  images[0] = { ...images[0], object: undefined };
  await assert.rejects(verifyObjectStorage(source, store), /image_object_missing id=7/);
});

test("fails on missing and mismatched object heads without leaking storage errors", async () => {
  const { source, store } = fixtures();
  store.head = async () => { throw new Error("https://user:secret@storage.example/private"); };
  await assert.rejects(verifyObjectStorage(source, store), (error: Error) => {
    assert.equal(error.message, "object_head_failed");
    return true;
  });

  const healthy = fixtures();
  healthy.store.head = async (key) => key === imageObject.key ? { ...imageObject, byteSize: 1 } : exportObject;
  await assert.rejects(verifyObjectStorage(healthy.source, healthy.store), /object_metadata_mismatch/);
});

test("fails when a database object reference has no metadata row", async () => {
  const { source, store } = fixtures();
  source.loadObjectReferences = async () => [
    { kind: "crawl-step", id: "4:login:submit", objectKey: "crawl-failures/missing.png" },
  ];
  await assert.rejects(verifyObjectStorage(source, store), /database_object_reference_missing/);
});

test("fails on broken version-image integrity", async () => {
  const { source, store } = fixtures();
  source.loadRelationshipIntegrity = async () => ({ total: 4, invalid: 1 });
  await assert.rejects(verifyObjectStorage(source, store), /version_image_relationship_invalid/);
});

test("requires latest-published contiguous preview ranks with valid memberships", async () => {
  for (const previews of [
    [{ appId: 3, versionId: 11, latestPublishedVersionId: 12, imageId: 7, rank: 1, belongsToVersion: true }],
    [{ appId: 3, versionId: 12, latestPublishedVersionId: 12, imageId: 7, rank: 2, belongsToVersion: true }],
    [{ appId: 3, versionId: 12, latestPublishedVersionId: 12, imageId: 7, rank: 1, belongsToVersion: false }],
  ]) {
    const { source, store } = fixtures();
    source.loadPreviews = async () => previews;
    await assert.rejects(verifyObjectStorage(source, store), /preview_integrity_invalid/);
  }

  const inaccessible = fixtures();
  const internalPreview = { ...imageObject, accessClass: "internal" as const };
  inaccessible.images[0] = { ...inaccessible.images[0], object: internalPreview };
  inaccessible.source.loadStoredObjects = async () => [internalPreview, exportObject];
  inaccessible.source.loadObjectReferences = async () => [
    { kind: "image", id: "7", objectKey: internalPreview.key, object: internalPreview },
    { kind: "export", id: "9", objectKey: exportObject.key, object: exportObject },
  ];
  inaccessible.store.head = async (key) => key === internalPreview.key ? internalPreview : exportObject;
  inaccessible.store.get = async () => ({ metadata: internalPreview, body: firstBody });
  await assert.rejects(verifyObjectStorage(inaccessible.source, inaccessible.store), /preview_integrity_invalid/);
});

test("compares legacy and object bytes by full SHA-256", async () => {
  const { source, store } = fixtures();
  source.readLegacyBytes = async () => Buffer.from("different bytes");
  await assert.rejects(verifyObjectStorage(source, store), /compatibility_checksum_mismatch id=7/);
});

test("sanitizes database and legacy-reader failures", async () => {
  const dbFailure = fixtures();
  dbFailure.source.loadImages = async () => { throw new Error("postgres://admin:secret@db/astryx"); };
  await assert.rejects(verifyObjectStorage(dbFailure.source, dbFailure.store), (error: Error) => {
    assert.equal(error.message, "database_read_failed");
    return true;
  });

  const fileFailure = fixtures();
  fileFailure.source.readLegacyBytes = async () => { throw new Error("ENOENT /Users/kai/data/private.png"); };
  await assert.rejects(verifyObjectStorage(fileFailure.source, fileFailure.store), (error: Error) => {
    assert.equal(error.message, "legacy_read_failed id=7");
    return true;
  });
});
