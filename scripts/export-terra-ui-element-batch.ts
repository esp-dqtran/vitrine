import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { closePool } from "../src/db.ts";
import { UI_ELEMENT_PROMPT_VERSION } from "../src/uiElementExtraction.ts";
import {
  listUiElementExtractionSources,
  type UiElementExtractionSource,
} from "../src/uiElementExtractionStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";

const PROVIDER_MODEL = "gpt-5.6-terra-ui-elements";

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positive(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be positive`);
  return parsed;
}

function extension(contentType: ObjectMetadata["contentType"]): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  throw new Error(`Unsupported image content type: ${contentType}`);
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

async function verifiedBody(
  source: UiElementExtractionSource,
  store: ObjectStore,
): Promise<Buffer> {
  const object = await store.get(source.object.key);
  const digest = createHash("sha256").update(object.body).digest("hex");
  if (
    !sameMetadata(source.object, object.metadata)
    || object.body.byteLength !== source.object.byteSize
    || digest !== source.object.sha256
  ) {
    throw new Error(`Source ${source.sourceImageId} object metadata mismatch`);
  }
  return object.body;
}

async function run(): Promise<void> {
  const app = argument("--app");
  const platform = argument("--platform") as "ios" | "android" | "web";
  if (!["ios", "android", "web"].includes(platform)) {
    throw new Error("--platform must be ios, android, or web");
  }
  const versionNumber = positive(argument("--version"), "version");
  const limit = positive(argument("--limit", "30"), "limit");
  const outputDirectory = resolve(argument("--output"));
  const sourcesDirectory = resolve(outputDirectory, "sources");
  const sources = await listUiElementExtractionSources({
    app,
    platform,
    versionNumber,
    limit,
    providerModel: PROVIDER_MODEL,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    reprocess: false,
  });
  if (sources.length === 0) throw new Error("No pending Terra UI-element sources were found");

  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  await mkdir(sourcesDirectory, { recursive: true, mode: 0o700 });
  const manifest = [];
  for (const source of sources) {
    const file = resolve(
      sourcesDirectory,
      `${source.sourceImageId}.${extension(source.object.contentType)}`,
    );
    await writeFile(file, await verifiedBody(source, store), { mode: 0o600 });
    manifest.push({
      sourceImageId: source.sourceImageId,
      screenImageId: source.screenImageId,
      file,
      contentType: source.object.contentType,
    });
  }
  const manifestPath = resolve(outputDirectory, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    app,
    platform,
    versionNumber,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    sourceCount: manifest.length,
    manifestPath,
  }));
}

try {
  await run();
} finally {
  await closePool();
}
