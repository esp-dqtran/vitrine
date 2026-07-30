import { createHash } from "node:crypto";
import { closePool, query } from "../src/db.ts";
import { deriveUiElementCrop } from "../src/uiElementCrop.ts";
import {
  parseUiElementScreenExtraction,
  type UiElementScreenExtraction,
} from "../src/uiElementExtraction.ts";
import {
  completeUiElementExtraction,
  listScreenPatternOptions,
  startUiElementExtraction,
  type PersistedUiElementCrop,
  type UiElementExtractionSource,
} from "../src/uiElementExtractionStore.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";
import {
  createObjectStore,
  objectStoreConfigFromEnvironment,
} from "../src/objectStoreConfig.ts";

const TARGET_TYPES = ["Dropdown Menu", "Loading Indicator", "Status Dot"];

interface SelectedExtraction {
  source: UiElementExtractionSource;
  providerModel: string;
  promptVersion: number;
  analysis: UiElementScreenExtraction;
}

function metadata(row: Record<string, unknown>): ObjectMetadata {
  return {
    key: String(row.object_key),
    sha256: String(row.sha256),
    byteSize: Number(row.byte_size),
    contentType: String(row.content_type) as ObjectMetadata["contentType"],
    accessClass: String(row.access_class) as ObjectMetadata["accessClass"],
  };
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

async function prepareCrops(input: {
  source: UiElementExtractionSource;
  body: Buffer;
  analysis: UiElementScreenExtraction;
  store: ObjectStore;
  apply: boolean;
}): Promise<PersistedUiElementCrop[]> {
  const crops: PersistedUiElementCrop[] = [];
  for (const candidate of input.analysis.components) {
    const crop = await deriveUiElementCrop({
      source: input.body,
      candidate,
      platform: input.source.platform,
    });
    const object: ObjectMetadata = {
      key: `ui-elements/crops/${crop.sha256}.png`,
      sha256: crop.sha256,
      byteSize: crop.byteSize,
      contentType: crop.contentType,
      accessClass: "protected",
    };
    if (input.apply) {
      const stored = await input.store.put({ ...object, body: crop.body });
      if (!sameMetadata(object, stored.metadata)) {
        throw new Error(`Crop object write mismatch for ${candidate.type}`);
      }
    }
    crops.push({ candidate, object, quality: crop.quality });
  }
  return crops;
}

async function selectedExtractions(): Promise<SelectedExtraction[]> {
  const screenPatterns = await listScreenPatternOptions();
  const result = await query(
    `SELECT DISTINCT ON (
       extraction.version_id, extraction.source_image_id,
       extraction.provider_model, extraction.prompt_version
     )
       extraction.version_id, app.name AS app, version.platform,
       source.platform_id, extraction.source_image_id,
       extraction.screen_image_id, extraction.provider_model,
       extraction.prompt_version, extraction.analysis,
       object.object_key, object.sha256, object.byte_size,
       object.content_type, object.access_class
     FROM ui_element_extractions extraction
     JOIN app_versions version ON version.id = extraction.version_id
     JOIN apps app ON app.id = version.app_id
     JOIN images source ON source.id = extraction.source_image_id
     JOIN stored_objects object ON object.object_key = source.object_key
     JOIN screen_ui_elements occurrence
       ON occurrence.version_id = extraction.version_id
      AND occurrence.source_image_id = extraction.source_image_id
      AND occurrence.provider_model = extraction.provider_model
      AND occurrence.prompt_version = extraction.prompt_version
     JOIN ui_element_types type ON type.id = occurrence.ui_element_type_id
     WHERE extraction.status = 'complete'
       AND extraction.analysis IS NOT NULL
       AND occurrence.review_status = 'accepted'
       AND type.name = ANY($1::text[])
     ORDER BY extraction.version_id, extraction.source_image_id,
       extraction.provider_model, extraction.prompt_version`,
    [TARGET_TYPES],
  );
  return result.rows.map((row) => ({
    source: {
      versionId: Number(row.version_id),
      app: String(row.app),
      platformId: Number(row.platform_id),
      platform: String(row.platform) as UiElementExtractionSource["platform"],
      sourceImageId: Number(row.source_image_id),
      screenImageId: Number(row.screen_image_id),
      object: metadata(row),
    },
    providerModel: String(row.provider_model),
    promptVersion: Number(row.prompt_version),
    analysis: parseUiElementScreenExtraction(row.analysis, screenPatterns),
  }));
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const selected = await selectedExtractions();
  if (selected.length === 0) throw new Error("No accepted target crops require reprocessing");
  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const report = [];
  for (const extraction of selected) {
    const body = await verifiedSource(extraction.source, store);
    const crops = await prepareCrops({
      source: extraction.source,
      body,
      analysis: extraction.analysis,
      store,
      apply,
    });
    const componentReport = crops.map(({ candidate, quality }) => ({
      type: candidate.type,
      variant: candidate.variant,
      quality,
      nextReviewStatus: quality.passed && candidate.confidence >= 0.82
        ? "accepted"
        : "pending",
    }));
    if (apply) {
      await startUiElementExtraction(
        extraction.source,
        extraction.providerModel,
        extraction.promptVersion,
      );
      await completeUiElementExtraction({
        source: extraction.source,
        providerModel: extraction.providerModel,
        promptVersion: extraction.promptVersion,
        analysis: extraction.analysis,
        crops,
        autoAcceptConfidence: 0.82,
      });
    }
    report.push({
      sourceImageId: extraction.source.sourceImageId,
      screenImageId: extraction.source.screenImageId,
      components: componentReport,
    });
  }
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    sources: selected.length,
    components: report.reduce((total, item) => total + item.components.length, 0),
    accepted: report.flatMap(({ components }) => components)
      .filter(({ nextReviewStatus }) => nextReviewStatus === "accepted").length,
    pending: report.flatMap(({ components }) => components)
      .filter(({ nextReviewStatus }) => nextReviewStatus === "pending").length,
    report,
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
