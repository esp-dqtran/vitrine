import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { query, closePool } from "../src/db.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";
import {
  CHATGPT_BROWSER_MODEL,
} from "../src/appKnowledgeBrowserProvider.ts";
import { UI_ELEMENT_PROMPT_VERSION } from "../src/uiElementExtraction.ts";

const DEFAULT_PROVIDER_MODEL = `${CHATGPT_BROWSER_MODEL}-ui-elements`;

interface ReviewRow {
  source_image_id: number;
  screen_image_id: number;
  summary: string;
  source_object_key: string;
  source_sha256: string;
  source_byte_size: string | number;
  source_content_type: ObjectMetadata["contentType"];
  source_access_class: ObjectMetadata["accessClass"];
  occurrence_id: number;
  type: string;
  variant: string;
  confidence: number;
  review_status: "pending" | "accepted";
  cropped_image_id: number;
  crop_object_key: string;
  crop_sha256: string;
  crop_byte_size: string | number;
  crop_content_type: ObjectMetadata["contentType"];
  crop_access_class: ObjectMetadata["accessClass"];
}

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

function optionalPositiveArgument(name: string): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return 0;
  return positive(process.argv[index + 1] ?? "", name);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function label(text: string, width: number, color: string): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="${width}" height="44" fill="${color}"/>`
    + `<text x="10" y="28" fill="white" font-family="Arial" font-size="16">`
    + `${escapeXml(text)}</text></svg>`,
  );
}

function metadata(row: ReviewRow, prefix: "source" | "crop"): ObjectMetadata {
  return {
    key: row[`${prefix}_object_key`],
    sha256: row[`${prefix}_sha256`],
    byteSize: Number(row[`${prefix}_byte_size`]),
    contentType: row[`${prefix}_content_type`],
    accessClass: row[`${prefix}_access_class`],
  };
}

async function body(store: ObjectStore, expected: ObjectMetadata): Promise<Buffer> {
  const object = await store.get(expected.key);
  if (
    object.metadata.sha256 !== expected.sha256
    || object.metadata.byteSize !== expected.byteSize
    || object.body.byteLength !== expected.byteSize
  ) throw new Error(`Review object mismatch: ${expected.key}`);
  return object.body;
}

async function run(): Promise<void> {
  const app = argument("--app");
  const platform = argument("--platform");
  const versionNumber = positive(argument("--version"), "version");
  const limit = positive(argument("--limit", "10"), "limit");
  const afterSourceImageId = optionalPositiveArgument("--after-source-id");
  const providerModel = argument("--provider", DEFAULT_PROVIDER_MODEL);
  const promptVersion = positive(
    argument("--prompt-version", String(UI_ELEMENT_PROMPT_VERSION)),
    "prompt version",
  );
  const outputDir = resolve(
    argument("--output", `data/ui-element-extraction/review/${app}-${platform}-v${versionNumber}`),
  );
  const result = await query<ReviewRow>(
    `WITH selected_sources AS (
       SELECT extraction.version_id, extraction.source_image_id
       FROM ui_element_extractions extraction
       JOIN app_versions version ON version.id = extraction.version_id
       JOIN apps app ON app.id = version.app_id
       WHERE app.name = $1
         AND version.platform = $2
         AND version.version_number = $3
         AND extraction.provider_model = $4
         AND extraction.prompt_version = $5
         AND extraction.status = 'complete'
         AND extraction.source_image_id > $6
       ORDER BY extraction.source_image_id
       LIMIT $7
     )
     SELECT extraction.source_image_id, extraction.screen_image_id,
       extraction.analysis->>'summary' AS summary,
       source_object.object_key AS source_object_key,
       source_object.sha256 AS source_sha256,
       source_object.byte_size AS source_byte_size,
       source_object.content_type AS source_content_type,
       source_object.access_class AS source_access_class,
       occurrence.id AS occurrence_id, type.name AS type,
       occurrence.variant, occurrence.confidence, occurrence.review_status,
       occurrence.cropped_image_id,
       crop_object.object_key AS crop_object_key,
       crop_object.sha256 AS crop_sha256,
       crop_object.byte_size AS crop_byte_size,
       crop_object.content_type AS crop_content_type,
       crop_object.access_class AS crop_access_class
     FROM selected_sources selected
     JOIN ui_element_extractions extraction
       ON extraction.version_id = selected.version_id
      AND extraction.source_image_id = selected.source_image_id
      AND extraction.provider_model = $4
      AND extraction.prompt_version = $5
     JOIN images source_image ON source_image.id = extraction.source_image_id
     JOIN stored_objects source_object ON source_object.object_key = source_image.object_key
     JOIN screen_ui_elements occurrence
       ON occurrence.version_id = extraction.version_id
      AND occurrence.source_image_id = extraction.source_image_id
      AND occurrence.provider_model = extraction.provider_model
      AND occurrence.prompt_version = extraction.prompt_version
     JOIN ui_element_types type ON type.id = occurrence.ui_element_type_id
     JOIN images crop_image ON crop_image.id = occurrence.cropped_image_id
     JOIN stored_objects crop_object ON crop_object.object_key = crop_image.object_key
     WHERE occurrence.review_status <> 'rejected'
     ORDER BY extraction.source_image_id, occurrence.id`,
    [
      app,
      platform,
      versionNumber,
      providerModel,
      promptVersion,
      afterSourceImageId,
      limit,
    ],
  );
  if (result.rows.length === 0) throw new Error("No completed UI element occurrences found");
  await mkdir(outputDir, { recursive: true });
  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const grouped = new Map<number, ReviewRow[]>();
  for (const row of result.rows) {
    grouped.set(row.source_image_id, [...(grouped.get(row.source_image_id) ?? []), row]);
  }

  const summary: Array<Record<string, unknown>> = [];
  for (const [sourceImageId, rows] of grouped) {
    const source = await body(store, metadata(rows[0], "source"));
    const sourcePreview = await sharp(source)
      .autoOrient()
      .resize({ width: 340, height: 760, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const sourceSize = await sharp(sourcePreview).metadata();
    const cropColumns = 3;
    const cropCellWidth = 230;
    const cropCellHeight = 220;
    const cropRows = Math.ceil(rows.length / cropColumns);
    const width = 360 + cropColumns * cropCellWidth;
    const height = Math.max(64 + (sourceSize.height ?? 760), 64 + cropRows * cropCellHeight);
    const composites: Array<{ input: Buffer; left: number; top: number }> = [
      { input: label(`source ${sourceImageId} / screen ${rows[0].screen_image_id}`, 340, "#111827"), left: 10, top: 10 },
      { input: sourcePreview, left: 10, top: 54 },
    ];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const crop = await body(store, metadata(row, "crop"));
      const cropPreview = await sharp(crop)
        .resize({ width: 210, height: 154, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const size = await sharp(cropPreview).metadata();
      const column = index % cropColumns;
      const line = Math.floor(index / cropColumns);
      const left = 370 + column * cropCellWidth;
      const top = 10 + line * cropCellHeight;
      const statusColor = row.review_status === "accepted" ? "#166534" : "#92400e";
      composites.push(
        {
          input: label(
            `${row.type} · ${row.confidence.toFixed(2)} · ${row.review_status}`,
            210,
            statusColor,
          ),
          left,
          top,
        },
        {
          input: cropPreview,
          left: left + Math.max(0, Math.floor((210 - (size.width ?? 210)) / 2)),
          top: top + 50,
        },
      );
    }
    const sheet = await sharp({
      create: { width, height, channels: 4, background: "#e5e7eb" },
    }).composite(composites).png().toBuffer();
    const path = `${outputDir}/${sourceImageId}.png`;
    await writeFile(path, sheet);
    summary.push({
      sourceImageId,
      screenImageId: rows[0].screen_image_id,
      summary: rows[0].summary,
      occurrenceCount: rows.length,
      accepted: rows.filter(({ review_status }) => review_status === "accepted").length,
      pending: rows.filter(({ review_status }) => review_status === "pending").length,
      types: rows.map(({ type }) => type),
      sheet: path,
    });
  }
  await writeFile(
    `${outputDir}/summary.json`,
    `${JSON.stringify({
      app,
      platform,
      versionNumber,
      providerModel,
      promptVersion,
      sources: summary,
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(JSON.stringify({
    outputDir,
    providerModel,
    promptVersion,
    sourceCount: summary.length,
    occurrenceCount: result.rows.length,
    accepted: result.rows.filter(({ review_status }) => review_status === "accepted").length,
    pending: result.rows.filter(({ review_status }) => review_status === "pending").length,
  }));
}

try {
  await run();
} finally {
  await closePool();
}
