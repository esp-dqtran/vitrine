import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("UI element extraction reads ordinary screen objects directly", async () => {
  const source = await readFile(
    new URL("./uiElementExtractionStore.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export async function listUiElementExtractionSources");
  const end = source.indexOf("\nexport async function", start + 1);
  const body = source.slice(start, end);

  assert.match(body, /screen\.kind = 'screen'/);
  assert.match(body, /screen\.id AS source_image_id/);
  assert.match(body, /screen\.id AS screen_image_id/);
  assert.match(body, /screen\.id = \$8/);
  assert.doesNotMatch(body, /mobbin-bulk:ui_element/);
});

test("migration permits screen sources and persists component layers", async () => {
  const migration = await readFile(
    new URL("../migrations/0105_screen_ui_element_sources_and_layers.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /ADD COLUMN layer TEXT NOT NULL DEFAULT 'whole-screen'/);
  assert.match(migration, /outer-presentation/);
  assert.match(migration, /embedded-ui/);
  assert.match(migration, /source\.kind IN \('screen', 'ui_element'\)/);
  assert.match(migration, /'logo-wall', 'Logo Wall'/);
  assert.match(migration, /'hero-image', 'Hero Image'/);
  assert.match(migration, /'product-image', 'Product Image'/);
});

test("screen analysis keeps detections but does not persist crops by default", async () => {
  const extraction = await readFile(
    new URL("../scripts/extract-ui-elements.ts", import.meta.url),
    "utf8",
  );
  const store = await readFile(
    new URL("./uiElementExtractionStore.ts", import.meta.url),
    "utf8",
  );

  assert.match(extraction, /cropUiElements: boolean/);
  assert.match(extraction, /let cropUiElements = false/);
  assert.match(extraction, /argument === "--crop-ui-elements"/);
  assert.match(
    extraction,
    /selected\.cropUiElements\s*\? await prepareCrops\(source, body, analysis, store\)\s*:\s*\[\]/,
  );
  assert.match(store, /input\.analysis\.components\.length/);
});

test("screen sweep can prioritize requested apps without excluding the remaining catalog", async () => {
  const sweep = await readFile(
    new URL("../scripts/sweep-screen-analysis.ts", import.meta.url),
    "utf8",
  );

  assert.match(sweep, /SCREEN_ANALYSIS_PRIORITY_APPS/);
  assert.match(sweep, /--priority-apps/);
  assert.match(sweep, /priorityRank\.get\(left\[0\]\.toLowerCase\(\)\)/);
  assert.match(sweep, /Number\.MAX_SAFE_INTEGER/);
  assert.match(sweep, /full-catalog-v\$\{UI_ELEMENT_PROMPT_VERSION\}/);
  assert.match(sweep, /log\.end\(\);\s+if \(stopping\) return;/);
  assert.match(sweep, /await Promise\.all[\s\S]*if \(stopping\) \{/);
});
