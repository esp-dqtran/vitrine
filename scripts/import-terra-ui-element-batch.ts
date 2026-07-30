import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deriveUiElementCrop } from "../src/uiElementCrop.ts";
import { closePool, query } from "../src/db.ts";
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

interface ManifestEntry {
  sourceImageId: number;
  screenImageId: number;
}

interface TerraResult {
  sourceImageId: number;
  screenImageId: number;
  analysis: UiElementScreenExtraction;
}

function argumentsFor(name: string): string[] {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index += 1;
    }
  }
  return values;
}

function argument(name: string): string {
  const values = argumentsFor(name);
  if (values.length !== 1) throw new Error(`${name} is required exactly once`);
  return values[0];
}

function optionalPositiveIntegerArgument(name: string): number | undefined {
  const values = argumentsFor(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1) throw new Error(`${name} may be provided at most once`);
  return positiveInteger(values[0], name);
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} is invalid`);
  return parsed;
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
  const crops = [];
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

async function loadManifest(path: string): Promise<ManifestEntry[]> {
  const raw = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Manifest must be a non-empty array");
  const seen = new Set<number>();
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`manifest[${index}] must be an object`);
    }
    const value = entry as Record<string, unknown>;
    const sourceImageId = positiveInteger(value.sourceImageId, `manifest[${index}].sourceImageId`);
    const screenImageId = positiveInteger(value.screenImageId, `manifest[${index}].screenImageId`);
    if (seen.has(sourceImageId)) throw new Error(`Duplicate manifest source ${sourceImageId}`);
    seen.add(sourceImageId);
    return { sourceImageId, screenImageId };
  });
}

async function loadResults(
  paths: string[],
  screenPatterns: readonly ScreenPatternOption[],
): Promise<TerraResult[]> {
  if (paths.length === 0) throw new Error("At least one --results file is required");
  const raw = (
    await Promise.all(paths.map(async (path) =>
      JSON.parse(await readFile(resolve(path), "utf8")) as unknown))
  ).flat();
  if (!Array.isArray(raw)) throw new Error("Terra result files must contain arrays");
  const seen = new Set<number>();
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`results[${index}] must be an object`);
    }
    const value = entry as Record<string, unknown>;
    const sourceImageId = positiveInteger(value.sourceImageId, `results[${index}].sourceImageId`);
    const screenImageId = positiveInteger(value.screenImageId, `results[${index}].screenImageId`);
    if (seen.has(sourceImageId)) throw new Error(`Duplicate Terra result ${sourceImageId}`);
    seen.add(sourceImageId);
    return {
      sourceImageId,
      screenImageId,
      analysis: parseUiElementScreenExtraction(value.analysis, screenPatterns),
    };
  });
}

async function run(): Promise<void> {
  const app = argument("--app");
  const platform = argument("--platform") as "ios" | "android" | "web";
  if (!["ios", "android", "web"].includes(platform)) {
    throw new Error("--platform must be ios, android, or web");
  }
  const versionNumber = positiveInteger(argument("--version"), "version");
  const manifest = await loadManifest(argument("--manifest"));
  const screenPatterns = await listScreenPatternOptions();
  const results = await loadResults(argumentsFor("--results"), screenPatterns);
  const expected = new Map(manifest.map((entry) => [entry.sourceImageId, entry.screenImageId]));
  if (
    results.length !== manifest.length
    || results.some((result) => expected.get(result.sourceImageId) !== result.screenImageId)
  ) {
    throw new Error("Terra results do not exactly match the exported manifest");
  }

  const completedRows = await query<{ source_image_id: number }>(
    `
      SELECT source_image_id
      FROM ui_element_extractions
      WHERE provider_model = $1
        AND prompt_version = $2
        AND status = 'complete'
        AND source_image_id = ANY($3::bigint[])
    `,
    [
      PROVIDER_MODEL,
      UI_ELEMENT_PROMPT_VERSION,
      manifest.map(({ sourceImageId }) => sourceImageId),
    ],
  );
  const completedSourceIds = new Set(
    completedRows.rows.map(({ source_image_id: sourceImageId }) => Number(sourceImageId)),
  );
  const importLimit = optionalPositiveIntegerArgument("--limit");
  const pendingEntries = manifest.filter(
    ({ sourceImageId }) => !completedSourceIds.has(sourceImageId),
  );
  const entriesToImport = importLimit === undefined
    ? pendingEntries
    : pendingEntries.slice(0, importLimit);
  const entryIdsToImport = new Set(entriesToImport.map(({ sourceImageId }) => sourceImageId));
  const resultsToImport = results.filter(({ sourceImageId }) => entryIdsToImport.has(sourceImageId));

  const sources = await listUiElementExtractionSources({
    app,
    platform,
    versionNumber,
    limit: entriesToImport.length,
    providerModel: PROVIDER_MODEL,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    reprocess: false,
  });
  const sourcesById = new Map(sources.map((source) => [source.sourceImageId, source]));
  if (
    sources.length !== entriesToImport.length
    || entriesToImport.some(
      (entry) => sourcesById.get(entry.sourceImageId)?.screenImageId !== entry.screenImageId,
    )
  ) {
    throw new Error("Pending database sources changed after this batch was exported");
  }

  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const imported = [];
  for (const result of resultsToImport.sort(
    (left, right) => left.sourceImageId - right.sourceImageId,
  )) {
    const source = sourcesById.get(result.sourceImageId);
    if (!source) throw new Error(`Source ${result.sourceImageId} is no longer pending`);
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

  const completedBatch = await query<{
    completed_source_count: number;
    component_count: number;
  }>(
    `
      SELECT
        count(*) FILTER (WHERE status = 'complete')::int AS completed_source_count,
        coalesce(sum(component_count) FILTER (WHERE status = 'complete'), 0)::int
          AS component_count
      FROM ui_element_extractions
      WHERE provider_model = $1
        AND prompt_version = $2
        AND source_image_id = ANY($3::bigint[])
    `,
    [
      PROVIDER_MODEL,
      UI_ELEMENT_PROMPT_VERSION,
      manifest.map(({ sourceImageId }) => sourceImageId),
    ],
  );
  const completedSourceCount = Number(
    completedBatch.rows[0]?.completed_source_count ?? 0,
  );
  const completedComponentCount = Number(completedBatch.rows[0]?.component_count ?? 0);
  const completedReviews = await query<{
    accepted: number;
    pending: number;
    rejected: number;
  }>(
    `
      SELECT
        count(*) FILTER (WHERE review_status = 'accepted')::int AS accepted,
        count(*) FILTER (WHERE review_status = 'pending')::int AS pending,
        count(*) FILTER (WHERE review_status = 'rejected')::int AS rejected
      FROM screen_ui_elements
      WHERE provider_model = $1
        AND prompt_version = $2
        AND source_image_id = ANY($3::bigint[])
    `,
    [
      PROVIDER_MODEL,
      UI_ELEMENT_PROMPT_VERSION,
      manifest.map(({ sourceImageId }) => sourceImageId),
    ],
  );

  const report = {
    app,
    platform,
    versionNumber,
    providerModel: PROVIDER_MODEL,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    manifestSourceCount: manifest.length,
    previouslyCompletedSourceCount: completedSourceIds.size,
    importedSourceCount: imported.length,
    completedSourceCount,
    remainingSourceCount: manifest.length - completedSourceCount,
    completedComponentCount,
    accepted: Number(completedReviews.rows[0]?.accepted ?? 0),
    pending: Number(completedReviews.rows[0]?.pending ?? 0),
    rejected: Number(completedReviews.rows[0]?.rejected ?? 0),
    importedResults: imported,
  };
  await writeFile(resolve(argument("--report")), `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(JSON.stringify(report));
}

try {
  await run();
} finally {
  await closePool();
}
