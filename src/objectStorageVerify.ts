import { createHash } from "node:crypto";
import {
  validateObjectMetadata,
  type ObjectMetadata,
  type ObjectStore,
} from "./objectStore.ts";

export interface VerificationImage {
  id: number;
  app: string;
  legacyReference?: string;
  object?: ObjectMetadata;
}

export interface VerificationReference {
  kind: "image" | "export" | "crawl-step";
  id: string;
  objectKey: string;
  object?: ObjectMetadata;
}

export interface VerificationPreview {
  appId: number;
  versionId: number;
  latestPublishedVersionId: number;
  imageId: number;
  rank: number;
  belongsToVersion: boolean;
}

export interface ObjectStorageVerificationSource {
  loadImages(): Promise<VerificationImage[]>;
  loadStoredObjects(): Promise<ObjectMetadata[]>;
  loadObjectReferences(): Promise<VerificationReference[]>;
  loadRelationshipIntegrity(): Promise<{ total: number; invalid: number }>;
  loadPreviews(): Promise<VerificationPreview[]>;
  readLegacyBytes(image: VerificationImage): Promise<Buffer | undefined>;
}

export interface ObjectStorageVerificationReport {
  totalObjects: number;
  totalBytes: number;
  totalImages: number;
  versionImageRelationships: number;
  previewRows: number;
  compatibilityChecks: number;
  evidenceSha256: string;
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

function fail(code: string): never {
  throw new Error(code);
}

async function loadSnapshot(source: ObjectStorageVerificationSource) {
  try {
    return {
      images: await source.loadImages(),
      objects: await source.loadStoredObjects(),
      references: await source.loadObjectReferences(),
      relationships: await source.loadRelationshipIntegrity(),
      previews: await source.loadPreviews(),
    };
  } catch {
    return fail("database_read_failed");
  }
}

export async function verifyObjectStorage(
  source: ObjectStorageVerificationSource,
  store: ObjectStore,
): Promise<ObjectStorageVerificationReport> {
  const { images, objects, references, relationships, previews } = await loadSnapshot(source);
  const objectByKey = new Map<string, ObjectMetadata>();
  let totalBytes = 0;

  for (const object of objects) {
    try { validateObjectMetadata(object); } catch { fail("database_object_metadata_invalid"); }
    if (objectByKey.has(object.key)) fail("database_object_duplicate");
    objectByKey.set(object.key, object);
    totalBytes += object.byteSize;
    if (!Number.isSafeInteger(totalBytes)) fail("database_object_bytes_invalid");

    let head: ObjectMetadata | undefined;
    try { head = await store.head(object.key); } catch { fail("object_head_failed"); }
    if (!head) fail("object_unreachable");
    if (!sameMetadata(object, head)) fail("object_metadata_mismatch");
  }

  for (const reference of references) {
    const object = objectByKey.get(reference.objectKey);
    if (!object || !reference.object || !sameMetadata(object, reference.object)) {
      fail("database_object_reference_missing");
    }
  }

  const orderedImages = [...images].sort((left, right) => left.id - right.id);
  const imageById = new Map(orderedImages.map((image) => [image.id, image]));
  const seenImageIds = new Set<number>();
  const evidence = createHash("sha256");
  let compatibilityChecks = 0;
  for (const image of orderedImages) {
    if (!Number.isSafeInteger(image.id) || image.id <= 0 || seenImageIds.has(image.id)) {
      fail("database_image_identity_invalid");
    }
    seenImageIds.add(image.id);
    if (!image.object) fail(`image_object_missing id=${image.id}`);
    const stored = objectByKey.get(image.object.key);
    if (!stored || !sameMetadata(stored, image.object)) fail(`image_object_missing id=${image.id}`);
    evidence.update(`${image.id}\0${stored.key}\0${stored.sha256}\0${stored.byteSize}\n`);

    if (!image.legacyReference) continue;
    let legacyBytes: Buffer | undefined;
    try { legacyBytes = await source.readLegacyBytes(image); } catch { fail(`legacy_read_failed id=${image.id}`); }
    if (!legacyBytes) fail(`legacy_read_failed id=${image.id}`);
    let object: Awaited<ReturnType<ObjectStore["get"]>>;
    try { object = await store.get(stored.key); } catch { fail(`object_read_failed id=${image.id}`); }
    if (!sameMetadata(stored, object.metadata)
      || object.body.byteLength !== stored.byteSize
      || createHash("sha256").update(object.body).digest("hex") !== stored.sha256
      || createHash("sha256").update(legacyBytes).digest("hex") !== stored.sha256) {
      fail(`compatibility_checksum_mismatch id=${image.id}`);
    }
    compatibilityChecks += 1;
  }

  if (!Number.isSafeInteger(relationships.total) || relationships.total < 0
    || relationships.invalid !== 0) fail("version_image_relationship_invalid");

  const previewsByApp = new Map<number, VerificationPreview[]>();
  for (const preview of previews) {
    const previewObject = imageById.get(preview.imageId)?.object;
    if (!previewObject || !["protected", "public-preview"].includes(previewObject.accessClass)) {
      fail("preview_integrity_invalid");
    }
    const rows = previewsByApp.get(preview.appId) ?? [];
    rows.push(preview);
    previewsByApp.set(preview.appId, rows);
  }
  for (const rows of previewsByApp.values()) {
    rows.sort((left, right) => left.rank - right.rank);
    if (rows.length > 3 || rows.some((row, index) =>
      row.versionId !== row.latestPublishedVersionId
      || row.rank !== index + 1
      || !row.belongsToVersion)) fail("preview_integrity_invalid");
  }

  return {
    totalObjects: objects.length,
    totalBytes,
    totalImages: images.length,
    versionImageRelationships: relationships.total,
    previewRows: previews.length,
    compatibilityChecks,
    evidenceSha256: evidence.digest("hex"),
  };
}
