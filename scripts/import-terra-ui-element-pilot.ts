import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deriveUiElementCrop } from "../src/uiElementCrop.ts";
import { closePool } from "../src/db.ts";
import {
  UI_ELEMENT_AUTO_ACCEPT_CONFIDENCE,
  UI_ELEMENT_PROMPT_VERSION,
  parseUiElementScreenExtraction,
  type ScreenPatternOption,
  type UiElementScreenExtraction,
} from "../src/uiElementExtraction.ts";
import {
  completeUiElementExtraction,
  listScreenPatternOptions,
  listUiElementExtractionSources,
  startUiElementExtraction,
  type PersistedUiElementCrop,
  type UiElementExtractionSource,
} from "../src/uiElementExtractionStore.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";
import {
  createObjectStore,
  objectStoreConfigFromEnvironment,
} from "../src/objectStoreConfig.ts";

const PROVIDER_MODEL = "gpt-5.6-terra-ui-elements";
const PILOT_SIZE = 10;
const RESULT_FILES = ["a", "b", "c"].map((batch) =>
  `data/ui-element-extraction/terra-pilot/results-v${UI_ELEMENT_PROMPT_VERSION}-${batch}.json`);

interface TerraPilotResult {
  sourceImageId: number;
  screenImageId: number;
  analysis: UiElementScreenExtraction;
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

async function verifiedSource(
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

async function prepareCrops(
  body: Buffer,
  analysis: UiElementScreenExtraction,
  store: ObjectStore,
  platform: UiElementExtractionSource["platform"],
): Promise<PersistedUiElementCrop[]> {
  const crops: PersistedUiElementCrop[] = [];
  for (const candidate of analysis.components) {
    const crop = await deriveUiElementCrop({ source: body, candidate, platform });
    const object: ObjectMetadata = {
      key: `ui-elements/crops/${crop.sha256}.png`,
      sha256: crop.sha256,
      byteSize: crop.byteSize,
      contentType: crop.contentType,
      accessClass: "protected",
    };
    const stored = await store.put({ ...object, body: crop.body });
    if (!sameMetadata(object, stored.metadata)) {
      throw new Error(`Crop object write mismatch for ${candidate.type}`);
    }
    crops.push({ candidate, object, quality: crop.quality });
  }
  return crops;
}

async function loadResults(
  screenPatterns: readonly ScreenPatternOption[],
): Promise<TerraPilotResult[]> {
  const values = (
    await Promise.all(RESULT_FILES.map(async (file) =>
      JSON.parse(await readFile(resolve(file), "utf8")) as unknown))
  ).flat();
  if (values.length !== PILOT_SIZE) {
    throw new Error(`Expected ${PILOT_SIZE} Terra results, received ${values.length}`);
  }
  const seen = new Set<number>();
  return values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Terra result must be an object");
    }
    const raw = value as Record<string, unknown>;
    const sourceImageId = Number(raw.sourceImageId);
    const screenImageId = Number(raw.screenImageId);
    if (
      !Number.isSafeInteger(sourceImageId)
      || sourceImageId <= 0
      || !Number.isSafeInteger(screenImageId)
      || screenImageId <= 0
      || seen.has(sourceImageId)
    ) {
      throw new Error("Terra result image identity is invalid or duplicated");
    }
    seen.add(sourceImageId);
    return {
      sourceImageId,
      screenImageId,
      analysis: parseUiElementScreenExtraction(raw.analysis, screenPatterns),
    };
  });
}

async function run(): Promise<void> {
  const screenPatterns = await listScreenPatternOptions();
  if (screenPatterns.length === 0) {
    throw new Error("No screen-pattern taxonomy is configured");
  }
  const results = await loadResults(screenPatterns);
  const sources = await listUiElementExtractionSources({
    app: "shopee",
    platform: "ios",
    versionNumber: 1,
    limit: PILOT_SIZE,
    providerModel: PROVIDER_MODEL,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    reprocess: true,
  });
  const sourcesById = new Map(sources.map((source) => [source.sourceImageId, source]));
  const expectedIds = new Set(sourcesById.keys());
  if (
    sources.length !== PILOT_SIZE
    || results.some(({ sourceImageId }) => !expectedIds.has(sourceImageId))
  ) {
    throw new Error("Terra results do not match the selected pilot sources");
  }

  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const imported = [];
  for (const result of results.sort((left, right) => left.sourceImageId - right.sourceImageId)) {
    const source = sourcesById.get(result.sourceImageId);
    if (!source || source.screenImageId !== result.screenImageId) {
      throw new Error(`Terra result ${result.sourceImageId} has the wrong source screen`);
    }
    const body = await verifiedSource(source, store);
    const crops = await prepareCrops(body, result.analysis, store, source.platform);
    await startUiElementExtraction(source, PROVIDER_MODEL, UI_ELEMENT_PROMPT_VERSION);
    const occurrences = await completeUiElementExtraction({
      source,
      providerModel: PROVIDER_MODEL,
      promptVersion: UI_ELEMENT_PROMPT_VERSION,
      analysis: result.analysis,
      crops,
      autoAcceptConfidence: UI_ELEMENT_AUTO_ACCEPT_CONFIDENCE,
    });
    imported.push({
      sourceImageId: source.sourceImageId,
      screenImageId: source.screenImageId,
      screenPatterns: result.analysis.screenPatterns.map(({ slug }) => slug),
      componentCount: occurrences.length,
      accepted: occurrences.filter(({ reviewStatus }) => reviewStatus === "accepted").length,
      pending: occurrences.filter(({ reviewStatus }) => reviewStatus === "pending").length,
    });
  }

  const report = {
    providerModel: PROVIDER_MODEL,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceCount: imported.length,
    componentCount: imported.reduce((sum, result) => sum + result.componentCount, 0),
    accepted: imported.reduce((sum, result) => sum + result.accepted, 0),
    pending: imported.reduce((sum, result) => sum + result.pending, 0),
    results: imported,
  };
  await writeFile(
    `data/ui-element-extraction/terra-pilot/import-report-v${UI_ELEMENT_PROMPT_VERSION}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report));
}

try {
  await run();
} finally {
  await closePool();
}
