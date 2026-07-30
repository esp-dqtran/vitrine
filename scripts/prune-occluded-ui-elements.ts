import { pool, closePool } from "../src/db.ts";
import {
  UI_ELEMENT_PROMPT_VERSION,
  parseUiElementExtraction,
  type UiElementCandidate,
} from "../src/uiElementExtraction.ts";
import { CHATGPT_BROWSER_MODEL } from "../src/appKnowledgeBrowserProvider.ts";

const PROVIDER_MODEL = `${CHATGPT_BROWSER_MODEL}-ui-elements`;

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positive(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be positive`);
  return parsed;
}

function occurrenceKey(candidate: Pick<UiElementCandidate, "type" | "region">): string {
  return [
    candidate.type,
    candidate.region.x.toFixed(8),
    candidate.region.y.toFixed(8),
    candidate.region.width.toFixed(8),
    candidate.region.height.toFixed(8),
  ].join("|");
}

async function run(): Promise<void> {
  const app = argument("--app");
  const platform = argument("--platform");
  const versionNumber = positive(argument("--version"), "version");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const version = await client.query(
      `SELECT version.id
       FROM app_versions version
       JOIN apps app ON app.id = version.app_id
       WHERE app.name = $1 AND version.platform = $2 AND version.version_number = $3
       LIMIT 1`,
      [app, platform, versionNumber],
    );
    const versionId = Number(version.rows[0]?.id);
    if (!Number.isSafeInteger(versionId) || versionId <= 0) throw new Error("Version not found");
    const runs = await client.query(
      `SELECT source_image_id, analysis, component_count
       FROM ui_element_extractions
       WHERE version_id = $1 AND provider_model = $2
         AND prompt_version = $3 AND status = 'complete'
       ORDER BY source_image_id`,
      [versionId, PROVIDER_MODEL, UI_ELEMENT_PROMPT_VERSION],
    );

    let changedSources = 0;
    let removedOccurrences = 0;
    for (const extraction of runs.rows) {
      const filtered = parseUiElementExtraction(extraction.analysis);
      if (filtered.components.length === Number(extraction.component_count)) continue;
      const keep = new Set(filtered.components.map(occurrenceKey));
      const occurrences = await client.query(
        `SELECT occurrence.id, occurrence.cropped_image_id, type.name AS type,
           occurrence.region_x, occurrence.region_y,
           occurrence.region_width, occurrence.region_height
         FROM screen_ui_elements occurrence
         JOIN ui_element_types type ON type.id = occurrence.ui_element_type_id
         WHERE occurrence.version_id = $1 AND occurrence.source_image_id = $2
           AND occurrence.provider_model = $3 AND occurrence.prompt_version = $4`,
        [
          versionId,
          extraction.source_image_id,
          PROVIDER_MODEL,
          UI_ELEMENT_PROMPT_VERSION,
        ],
      );
      const dropped = occurrences.rows.filter((occurrence) =>
        !keep.has(occurrenceKey({
          type: String(occurrence.type),
          region: {
            x: Number(occurrence.region_x),
            y: Number(occurrence.region_y),
            width: Number(occurrence.region_width),
            height: Number(occurrence.region_height),
          },
        })));
      if (dropped.length > 0) {
        await client.query(
          `UPDATE screen_ui_elements
           SET review_status = 'rejected', updated_at = now()
           WHERE id = ANY ($1::bigint[])`,
          [dropped.map(({ id }) => id)],
        );
        removedOccurrences += dropped.length;
      }
      await client.query(
        `UPDATE ui_element_extractions
         SET analysis = $2::jsonb, component_count = $3, updated_at = now()
         WHERE version_id = $1 AND source_image_id = $4
           AND provider_model = $5 AND prompt_version = $6`,
        [
          versionId,
          JSON.stringify(filtered),
          filtered.components.length,
          extraction.source_image_id,
          PROVIDER_MODEL,
          UI_ELEMENT_PROMPT_VERSION,
        ],
      );
      changedSources += 1;
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      changedSources,
      rejectedOccurrences: removedOccurrences,
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  await run();
} finally {
  await closePool();
}
