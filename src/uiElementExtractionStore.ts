import type { ObjectMetadata } from "./objectStore.ts";
import { query, withTransaction } from "./db.ts";
import type { UiElementCropQuality } from "./uiElementCrop.ts";
import type {
  ScreenPatternOption,
  UiElementCandidate,
  UiElementScreenExtraction,
} from "./uiElementExtraction.ts";

export interface UiElementExtractionSource {
  versionId: number;
  app: string;
  platformId: number;
  platform: "ios" | "android" | "web";
  sourceImageId: number;
  screenImageId: number;
  object: ObjectMetadata;
}

export interface PersistedUiElementCrop {
  candidate: UiElementCandidate;
  object: ObjectMetadata;
  quality: UiElementCropQuality;
}

export interface UiElementExtractionOccurrence {
  id: number;
  type: string;
  croppedImageId: number;
  screenImageId: number;
  confidence: number;
  reviewStatus: "pending" | "accepted";
}

function positiveInteger(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error(`${label} is invalid`);
  return result;
}

function platform(value: unknown): UiElementExtractionSource["platform"] {
  if (value !== "ios" && value !== "android" && value !== "web") {
    throw new Error("UI element extraction platform is invalid");
  }
  return value;
}

function metadata(row: Record<string, unknown>): ObjectMetadata {
  const result = {
    key: String(row.object_key),
    sha256: String(row.sha256),
    byteSize: Number(row.byte_size),
    contentType: String(row.content_type) as ObjectMetadata["contentType"],
    accessClass: String(row.access_class) as ObjectMetadata["accessClass"],
  };
  if (
    !/^[a-z0-9][a-z0-9/_=.@-]{0,1023}$/.test(result.key)
    || !/^[0-9a-f]{64}$/.test(result.sha256)
    || !Number.isSafeInteger(result.byteSize)
    || result.byteSize <= 0
    || !["image/png", "image/jpeg", "image/webp"].includes(result.contentType)
    || result.accessClass !== "protected"
  ) {
    throw new Error("UI element extraction object metadata is invalid");
  }
  return result;
}

export async function listScreenPatternOptions(): Promise<ScreenPatternOption[]> {
  const result = await query(
    `SELECT pattern.slug, pattern.name, section.name AS section
     FROM screen_patterns pattern
     JOIN screen_pattern_sections section ON section.id = pattern.section_id
     ORDER BY section.position, pattern.position, pattern.id`,
  );
  return result.rows.map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    section: String(row.section),
  }));
}

export async function listUiElementExtractionSources(input: {
  app: string;
  platform: "ios" | "android" | "web";
  versionNumber: number;
  limit: number;
  providerModel: string;
  promptVersion: number;
  reprocess?: boolean;
}): Promise<UiElementExtractionSource[]> {
  const result = await query(
    `WITH selected_version AS (
       SELECT av.id, av.app_id, av.platform
       FROM app_versions av
       JOIN apps a ON a.id = av.app_id
       WHERE a.name = $1
         AND av.platform = $2
         AND av.version_number = $3
       LIMIT 1
     ),
     screen_objects AS (
       SELECT screen.id, screen.platform_id, object.sha256
       FROM selected_version selected
       JOIN version_images membership ON membership.version_id = selected.id
       JOIN images screen ON screen.id = membership.image_id AND screen.kind = 'screen'
       JOIN stored_objects object ON object.object_key = screen.object_key
     )
     SELECT selected.id AS version_id, a.name AS app, source.platform_id,
       selected.platform, source.id AS source_image_id,
       matching_screen.id AS screen_image_id,
       object.object_key, object.sha256, object.byte_size,
       object.content_type, object.access_class
     FROM selected_version selected
     JOIN apps a ON a.id = selected.app_id
     JOIN version_images membership ON membership.version_id = selected.id
     JOIN images source ON source.id = membership.image_id
       AND source.kind = 'ui_element'
       AND source.image_url LIKE 'mobbin-bulk:ui_element:%'
     JOIN stored_objects object ON object.object_key = source.object_key
     JOIN LATERAL (
       SELECT screen.id
       FROM screen_objects screen
       WHERE screen.sha256 = object.sha256
         AND screen.platform_id = source.platform_id
       ORDER BY screen.id
       LIMIT 1
     ) matching_screen ON true
     LEFT JOIN ui_element_extractions extraction
       ON extraction.version_id = selected.id
      AND extraction.source_image_id = source.id
      AND extraction.provider_model = $5
      AND extraction.prompt_version = $6
     WHERE ($7::boolean OR extraction.status IS DISTINCT FROM 'complete')
     ORDER BY source.id
     LIMIT $4`,
    [
      input.app,
      input.platform,
      input.versionNumber,
      input.limit,
      input.providerModel,
      input.promptVersion,
      input.reprocess ?? false,
    ],
  );
  return result.rows.map((row) => ({
    versionId: positiveInteger(row.version_id, "version"),
    app: String(row.app),
    platformId: positiveInteger(row.platform_id, "platform"),
    platform: platform(row.platform),
    sourceImageId: positiveInteger(row.source_image_id, "source image"),
    screenImageId: positiveInteger(row.screen_image_id, "screen image"),
    object: metadata(row),
  }));
}

export async function startUiElementExtraction(
  source: UiElementExtractionSource,
  providerModel: string,
  promptVersion: number,
): Promise<void> {
  await query(
    `INSERT INTO ui_element_extractions
       (version_id, source_image_id, screen_image_id, provider_model,
        prompt_version, status, component_count, analysis, error_code,
        analyzed_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'running', 0, NULL, NULL, NULL, now())
     ON CONFLICT (version_id, source_image_id, provider_model, prompt_version)
     DO UPDATE SET screen_image_id = EXCLUDED.screen_image_id,
       status = 'running', component_count = 0, analysis = NULL,
       error_code = NULL, analyzed_at = NULL, updated_at = now()`,
    [
      source.versionId,
      source.sourceImageId,
      source.screenImageId,
      providerModel,
      promptVersion,
    ],
  );
}

export async function failUiElementExtraction(
  source: UiElementExtractionSource,
  providerModel: string,
  promptVersion: number,
  errorCode: string,
): Promise<void> {
  await query(
    `UPDATE ui_element_extractions
     SET status = 'failed', error_code = $6, analyzed_at = now(), updated_at = now()
     WHERE version_id = $1 AND source_image_id = $2
       AND screen_image_id = $3 AND provider_model = $4 AND prompt_version = $5`,
    [
      source.versionId,
      source.sourceImageId,
      source.screenImageId,
      providerModel,
      promptVersion,
      errorCode.slice(0, 500),
    ],
  );
}

function imageReference(crop: PersistedUiElementCrop): string {
  return `capture:ui_element:${crop.object.sha256.slice(0, 16)}`;
}

export async function completeUiElementExtraction(input: {
  source: UiElementExtractionSource;
  providerModel: string;
  promptVersion: number;
  analysis: UiElementScreenExtraction;
  crops: PersistedUiElementCrop[];
  autoAcceptConfidence: number;
}): Promise<UiElementExtractionOccurrence[]> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE screen_ui_elements
       SET review_status = 'rejected', updated_at = now()
       WHERE version_id = $1 AND source_image_id = $2
         AND provider_model = $3 AND prompt_version = $4`,
      [
        input.source.versionId,
        input.source.sourceImageId,
        input.providerModel,
        input.promptVersion,
      ],
    );
    const analyzedScreen = await client.query(
      `UPDATE images
       SET description = $1, analysis = $2::jsonb
       WHERE id = $3 AND kind = 'screen'`,
      [
        input.analysis.screenAnalysis.description,
        JSON.stringify(input.analysis.screenAnalysis),
        input.source.screenImageId,
      ],
    );
    if (analyzedScreen.rowCount !== 1) {
      throw new Error("UI element source screen does not exist");
    }
    const versionScreen = await client.query(
      `UPDATE version_images
       SET state_context = $1
       WHERE version_id = $2 AND image_id = $3`,
      [
        input.analysis.screenAnalysis.visibleStates.join(", ") || null,
        input.source.versionId,
        input.source.screenImageId,
      ],
    );
    if (versionScreen.rowCount !== 1) {
      throw new Error("UI element source screen is not in the selected version");
    }
    await client.query(
      `DELETE FROM screen_pattern_assignments
       WHERE image_id = $1 AND source = 'analysis'`,
      [input.source.screenImageId],
    );
    for (const pattern of input.analysis.screenPatterns) {
      const assigned = await client.query(
        `INSERT INTO screen_pattern_assignments
           (image_id, screen_pattern_id, source, confidence)
         SELECT $1, pattern.id, 'analysis', $3
         FROM screen_patterns pattern
         WHERE pattern.slug = $2
         ON CONFLICT (image_id, screen_pattern_id) DO UPDATE SET
           source = CASE
             WHEN screen_pattern_assignments.source = 'manual'
               THEN screen_pattern_assignments.source
             ELSE EXCLUDED.source
           END,
           confidence = CASE
             WHEN screen_pattern_assignments.source = 'manual'
               THEN screen_pattern_assignments.confidence
             ELSE EXCLUDED.confidence
           END,
           updated_at = now()
         RETURNING screen_pattern_id`,
        [input.source.screenImageId, pattern.slug, pattern.confidence],
      );
      if (assigned.rowCount !== 1) {
        throw new Error(`Screen pattern does not exist: ${pattern.slug}`);
      }
    }
    await client.query(
      "SELECT refresh_screen_pattern_previews($1)",
      [input.source.versionId],
    );
    const persisted: UiElementExtractionOccurrence[] = [];
    for (const crop of input.crops) {
      const stored = await client.query(
        `INSERT INTO stored_objects
           (object_key, sha256, byte_size, content_type, access_class)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
         WHERE stored_objects.sha256 = EXCLUDED.sha256
           AND stored_objects.byte_size = EXCLUDED.byte_size
           AND stored_objects.content_type = EXCLUDED.content_type
           AND stored_objects.access_class = EXCLUDED.access_class
         RETURNING object_key`,
        [
          crop.object.key,
          crop.object.sha256,
          crop.object.byteSize,
          crop.object.contentType,
          crop.object.accessClass,
        ],
      );
      if (stored.rowCount !== 1) throw new Error("UI element crop object metadata conflicts");

      const existingImage = await client.query(
        `SELECT id FROM images WHERE object_key = $1 LIMIT 1`,
        [crop.object.key],
      );
      let croppedImageId = existingImage.rows[0]?.id
        ? positiveInteger(existingImage.rows[0].id, "cropped image")
        : undefined;
      if (!croppedImageId) {
        const image = await client.query(
          `INSERT INTO images
             (platform_id, image_url, kind, object_key, description)
           VALUES ($1, $2, 'ui_element', $3, $4)
           ON CONFLICT (platform_id, image_url) DO UPDATE SET
             object_key = EXCLUDED.object_key,
             description = EXCLUDED.description
           WHERE images.kind = 'ui_element'
             AND images.object_key = EXCLUDED.object_key
           RETURNING id`,
          [
            input.source.platformId,
            imageReference(crop),
            crop.object.key,
            `${crop.candidate.type} · ${crop.candidate.variant}`,
          ],
        );
        if (image.rowCount !== 1) throw new Error("UI element crop image identity conflicts");
        croppedImageId = positiveInteger(image.rows[0].id, "cropped image");
      }

      await client.query(
        `INSERT INTO version_images (version_id, image_id, captured_at)
         VALUES ($1, $2, now())
         ON CONFLICT (version_id, image_id) DO NOTHING`,
        [input.source.versionId, croppedImageId],
      );

      const type = await client.query(
        `SELECT id FROM ui_element_types WHERE name = $1 LIMIT 1`,
        [crop.candidate.type],
      );
      const typeId = positiveInteger(type.rows[0]?.id, "UI element type");
      const reviewStatus = crop.quality.passed
        && crop.candidate.confidence >= input.autoAcceptConfidence
        ? "accepted"
        : "pending";
      const occurrence = await client.query(
        `INSERT INTO screen_ui_elements
           (version_id, screen_image_id, source_image_id, ui_element_type_id,
           cropped_image_id, variant, purpose, anatomy,
            observed_properties, region_x, region_y, region_width, region_height,
            confidence, provider_model, prompt_version, review_status, crop_quality)
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb
         )
         ON CONFLICT (
           version_id, screen_image_id, ui_element_type_id,
           region_x, region_y, region_width, region_height,
           provider_model, prompt_version
         ) DO UPDATE SET
           source_image_id = EXCLUDED.source_image_id,
           cropped_image_id = EXCLUDED.cropped_image_id,
           variant = EXCLUDED.variant,
           purpose = EXCLUDED.purpose,
           anatomy = EXCLUDED.anatomy,
           observed_properties = EXCLUDED.observed_properties,
           confidence = EXCLUDED.confidence,
           review_status = EXCLUDED.review_status,
           crop_quality = EXCLUDED.crop_quality,
           updated_at = now()
         RETURNING id`,
        [
          input.source.versionId,
          input.source.screenImageId,
          input.source.sourceImageId,
          typeId,
          croppedImageId,
          crop.candidate.variant,
          crop.candidate.purpose,
          crop.candidate.anatomy,
          crop.candidate.observedProperties,
          crop.candidate.region.x,
          crop.candidate.region.y,
          crop.candidate.region.width,
          crop.candidate.region.height,
          crop.candidate.confidence,
          input.providerModel,
          input.promptVersion,
          reviewStatus,
          JSON.stringify(crop.quality),
        ],
      );
      persisted.push({
        id: positiveInteger(occurrence.rows[0]?.id, "UI element occurrence"),
        type: crop.candidate.type,
        croppedImageId,
        screenImageId: input.source.screenImageId,
        confidence: crop.candidate.confidence,
        reviewStatus,
      });
    }

    const completed = await client.query(
      `UPDATE ui_element_extractions
       SET status = 'complete', component_count = $6, analysis = $7::jsonb,
         error_code = NULL, analyzed_at = now(), updated_at = now()
       WHERE version_id = $1 AND source_image_id = $2
         AND screen_image_id = $3 AND provider_model = $4 AND prompt_version = $5
       RETURNING source_image_id`,
      [
        input.source.versionId,
        input.source.sourceImageId,
        input.source.screenImageId,
        input.providerModel,
        input.promptVersion,
        persisted.length,
        JSON.stringify(input.analysis),
      ],
    );
    if (completed.rowCount !== 1) throw new Error("UI element extraction was not running");
    return persisted;
  });
}
