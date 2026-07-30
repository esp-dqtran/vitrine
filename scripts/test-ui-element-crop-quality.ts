import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { closePool, query } from "../src/db.ts";
import { deriveUiElementCrop } from "../src/uiElementCrop.ts";
import type { UiElementCandidate } from "../src/uiElementExtraction.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";
import {
  createObjectStore,
  objectStoreConfigFromEnvironment,
} from "../src/objectStoreConfig.ts";

const TARGET_TYPES = ["Dropdown Menu", "Loading Indicator", "Status Dot"];
const CELL_WIDTH = 560;
const PREVIEW_HEIGHT = 340;
const LABEL_HEIGHT = 58;

interface AuditRow {
  id: number;
  platform: "ios" | "android" | "web";
  candidate: UiElementCandidate;
  source: ObjectMetadata;
  existingCrop: ObjectMetadata;
}

function metadata(row: Record<string, unknown>, prefix: string): ObjectMetadata {
  return {
    key: String(row[`${prefix}_object_key`]),
    sha256: String(row[`${prefix}_sha256`]),
    byteSize: Number(row[`${prefix}_byte_size`]),
    contentType: String(row[`${prefix}_content_type`]) as ObjectMetadata["contentType"],
    accessClass: String(row[`${prefix}_access_class`]) as ObjectMetadata["accessClass"],
  };
}

function rows(values: Record<string, unknown>[]): AuditRow[] {
  return values.map((row) => ({
    id: Number(row.id),
    platform: String(row.platform) as AuditRow["platform"],
    candidate: {
      type: String(row.type),
      variant: String(row.variant),
      purpose: String(row.purpose),
      anatomy: row.anatomy as string[],
      visibleStates: row.visible_states as string[],
      observedProperties: row.observed_properties as string[],
      region: {
        x: Number(row.region_x),
        y: Number(row.region_y),
        width: Number(row.region_width),
        height: Number(row.region_height),
      },
      confidence: Number(row.confidence),
    },
    source: metadata(row, "source"),
    existingCrop: metadata(row, "crop"),
  }));
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

async function verifiedGet(store: ObjectStore, expected: ObjectMetadata): Promise<Buffer> {
  const object = await store.get(expected.key);
  const sha256 = createHash("sha256").update(object.body).digest("hex");
  if (
    !sameMetadata(object.metadata, expected)
    || object.body.byteLength !== expected.byteSize
    || sha256 !== expected.sha256
  ) {
    throw new Error(`Object metadata mismatch: ${expected.key}`);
  }
  return object.body;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;",
  })[character]!);
}

async function preview(body: Buffer): Promise<Buffer> {
  return sharp(body)
    .resize({
      width: CELL_WIDTH - 32,
      height: PREVIEW_HEIGHT - 32,
      fit: "inside",
      withoutEnlargement: true,
    })
    .extend({
      top: 16,
      bottom: 16,
      left: 16,
      right: 16,
      background: "#f3f4f6",
    })
    .png({ palette: false })
    .toBuffer();
}

async function run(): Promise<void> {
  const outputIndex = process.argv.indexOf("--output");
  const output = resolve(
    outputIndex >= 0 && process.argv[outputIndex + 1]
      ? process.argv[outputIndex + 1]
      : "/tmp/astryx-ui-crop-quality-test",
  );
  const result = await query(
    `SELECT occurrence.id, version.platform, type.name AS type,
       occurrence.variant, occurrence.purpose, occurrence.anatomy,
       occurrence.visible_states, occurrence.observed_properties,
       occurrence.region_x, occurrence.region_y,
       occurrence.region_width, occurrence.region_height, occurrence.confidence,
       source_object.object_key AS source_object_key,
       source_object.sha256 AS source_sha256,
       source_object.byte_size AS source_byte_size,
       source_object.content_type AS source_content_type,
       source_object.access_class AS source_access_class,
       crop_object.object_key AS crop_object_key,
       crop_object.sha256 AS crop_sha256,
       crop_object.byte_size AS crop_byte_size,
       crop_object.content_type AS crop_content_type,
       crop_object.access_class AS crop_access_class
     FROM screen_ui_elements occurrence
     JOIN app_versions version ON version.id = occurrence.version_id
     JOIN ui_element_types type ON type.id = occurrence.ui_element_type_id
     JOIN images source_image ON source_image.id = occurrence.source_image_id
     JOIN stored_objects source_object ON source_object.object_key = source_image.object_key
     JOIN images crop_image ON crop_image.id = occurrence.cropped_image_id
     JOIN stored_objects crop_object ON crop_object.object_key = crop_image.object_key
     WHERE occurrence.review_status = 'accepted'
       AND type.name = ANY($1::text[])
     ORDER BY type.name, occurrence.id`,
    [TARGET_TYPES],
  );
  const selected = rows(result.rows);
  if (selected.length === 0) throw new Error("No accepted target crops found");

  await mkdir(output, { recursive: true });
  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const report = [];
  const composites: sharp.OverlayOptions[] = [];
  const canvasHeight = selected.length * (LABEL_HEIGHT + PREVIEW_HEIGHT);

  for (const [index, row] of selected.entries()) {
    const [source, original] = await Promise.all([
      verifiedGet(store, row.source),
      verifiedGet(store, row.existingCrop),
    ]);
    const optimized = await deriveUiElementCrop({
      source,
      candidate: row.candidate,
      platform: row.platform,
    });
    const [originalMetadata, optimizedMetadata, originalPreview, optimizedPreview] =
      await Promise.all([
        sharp(original).metadata(),
        sharp(optimized.body).metadata(),
        preview(original),
        preview(optimized.body),
      ]);
    await writeFile(
      join(output, `${row.id}-${row.candidate.type.toLowerCase().replaceAll(" ", "-")}.png`),
      optimized.body,
    );
    const status = optimized.quality.passed
      ? optimized.quality.refined ? "PASS · refined" : "PASS"
      : `HOLD · ${optimized.quality.issues.join(", ")}`;
    const label = Buffer.from(
      `<svg width="${CELL_WIDTH * 2}" height="${LABEL_HEIGHT}">
         <rect width="100%" height="100%" fill="#111827"/>
         <text x="16" y="23" fill="white" font-family="Arial" font-size="17">
           ${escapeXml(`${row.candidate.type} · #${row.id} · original ${originalMetadata.width}×${originalMetadata.height}`)}
         </text>
         <text x="${CELL_WIDTH + 16}" y="23" fill="white" font-family="Arial" font-size="17">
           ${escapeXml(`optimized ${optimizedMetadata.width}×${optimizedMetadata.height} · ${status}`)}
         </text>
       </svg>`,
    );
    const top = index * (LABEL_HEIGHT + PREVIEW_HEIGHT);
    composites.push(
      { input: label, left: 0, top },
      { input: originalPreview, left: 0, top: top + LABEL_HEIGHT },
      { input: optimizedPreview, left: CELL_WIDTH, top: top + LABEL_HEIGHT },
    );
    report.push({
      id: row.id,
      type: row.candidate.type,
      original: {
        width: originalMetadata.width,
        height: originalMetadata.height,
        bytes: original.byteLength,
      },
      optimized: {
        width: optimizedMetadata.width,
        height: optimizedMetadata.height,
        bytes: optimized.body.byteLength,
        sourceRegionPixels: optimized.sourceRegionPixels,
        quality: optimized.quality,
      },
    });
  }

  const sheet = await sharp({
    create: {
      width: CELL_WIDTH * 2,
      height: canvasHeight,
      channels: 4,
      background: "#f3f4f6",
    },
  }).composite(composites).png({ palette: false }).toBuffer();
  await Promise.all([
    writeFile(join(output, "comparison.png"), sheet),
    writeFile(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
  ]);
  console.log(JSON.stringify({
    output,
    crops: report.length,
    passed: report.filter(({ optimized }) => optimized.quality.passed).length,
    held: report.filter(({ optimized }) => !optimized.quality.passed).length,
    report: join(output, "report.json"),
    comparison: join(output, "comparison.png"),
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
