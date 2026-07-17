import { createHash } from "node:crypto";
import { RESEARCH_LIMITS, type ResearchProjectWorkspace } from "./researchProject.ts";
import {
  researchUploadObjectKey,
  type ObjectMetadata,
  type ObjectStore,
  type StoredContentType,
} from "./objectStore.ts";

const IMAGE_TYPES = new Map<string, { extension: "png" | "jpg" | "webp"; contentType: StoredContentType }>([
  ["image/png", { extension: "png", contentType: "image/png" }],
  ["image/jpeg", { extension: "jpg", contentType: "image/jpeg" }],
  ["image/webp", { extension: "webp", contentType: "image/webp" }],
]);

export function validateResearchUpload(body: Uint8Array, contentType: string): {
  extension: "png" | "jpg" | "webp";
  contentType: StoredContentType;
  sha256: string;
  byteSize: number;
} {
  if (!body.byteLength) throw new Error("Research upload is empty");
  if (body.byteLength > RESEARCH_LIMITS.uploadBytesMax) {
    throw new Error("Research uploads may not exceed 10 MiB");
  }
  const image = IMAGE_TYPES.get(contentType.toLowerCase().split(";", 1)[0]);
  if (!image) throw new Error("Unsupported research upload type");
  return {
    ...image,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.byteLength,
  };
}

export async function storeResearchUpload(input: {
  userId: number;
  body: Uint8Array;
  contentType: string;
  objectStore: ObjectStore;
  persist(metadata: ObjectMetadata): Promise<ResearchProjectWorkspace | undefined>;
}): Promise<ResearchProjectWorkspace | undefined> {
  const validated = validateResearchUpload(input.body, input.contentType);
  const metadata: ObjectMetadata = {
    key: researchUploadObjectKey(input.userId, validated.sha256, validated.extension),
    sha256: validated.sha256,
    byteSize: validated.byteSize,
    contentType: validated.contentType,
    accessClass: "protected",
  };
  const stored = await input.objectStore.put({ ...metadata, body: input.body });
  try {
    return await input.persist(stored.metadata);
  } catch (error) {
    if (stored.created) await input.objectStore.delete(metadata.key);
    throw error;
  }
}
