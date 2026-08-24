import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

test("app detail queries are explicit and evidence pagination stays in SQL", () => {
  assert.match(source, /export async function appMetadata\(/);
  assert.match(source, /export async function appEvidencePage\(/);
  assert.match(source, /export async function getVersionFlows\(/);
  assert.match(source, /export async function flowEvidenceImages\(/);

  const evidenceStart = source.indexOf("export async function appEvidencePage(");
  const evidenceEnd = source.indexOf("\nexport async function", evidenceStart + 1);
  const evidenceBody = source.slice(evidenceStart, evidenceEnd);
  assert.match(evidenceBody, /requestedLimit \+ 1/);
  assert.match(evidenceBody, /i\.analysis->>'pageType' = ANY\(\$8\)/);
  assert.match(evidenceBody, /LIMIT \$\d/);
  assert.match(evidenceBody, /WHERE \(\$6::integer IS NULL OR id < \$6\)/);
  assert.match(evidenceBody, /ORDER BY id DESC/);
  assert.match(evidenceBody, /FROM screen_ui_elements occurrence/);
  assert.match(evidenceBody, /occurrence\.review_status = 'accepted'/);
  assert.match(evidenceBody, /occurrence\.version_id = sv\.id/);
  assert.match(evidenceBody, /'layer', element\.layer/);
  assert.match(evidenceBody, /AS ui_elements/);
  assert.match(evidenceBody, /occurrence\.cropped_image_id = i\.id/);
  assert.doesNotMatch(evidenceBody, /occurrence\.source_image_id = i\.id/);
  assert.match(evidenceBody, /'pageType', reference\.component_type/);
  assert.doesNotMatch(evidenceBody, /\$2 <> 'ui_element' OR reference\.component_type IS NOT NULL/);
  assert.match(evidenceBody, /source_screen_id/);
  assert.doesNotMatch(evidenceBody, /\bappImages\(/);
  assert.doesNotMatch(evidenceBody, /\bversionImages\(/);
});

test("screen category facets are read independently of the paginated gallery", () => {
  const start = source.indexOf("export async function appScreenTypes(");
  const end = source.indexOf("\nexport async function", start + 1);
  const body = source.slice(start, end);

  assert.ok(start >= 0, "appScreenTypes source was not found");
  assert.match(body, /SELECT DISTINCT trimmed\.page_type/);
  assert.match(body, /i\.kind = 'screen'/);
  assert.doesNotMatch(body, /LIMIT \$\d/);
});

test("UI element summaries group reviewed crop occurrences in SQL", () => {
  const start = source.indexOf("export async function appUiElementSummary(");
  const end = source.indexOf("\nexport async function", start + 1);
  const body = source.slice(start, end);

  assert.ok(start >= 0, "appUiElementSummary source was not found");
  assert.match(body, /FROM screen_ui_elements occurrence/);
  assert.match(body, /occurrence\.review_status = 'accepted'/);
  assert.match(body, /JOIN images crop ON crop\.id = occurrence\.cropped_image_id/);
  assert.match(body, /COUNT\(\*\) OVER \(PARTITION BY component_type_id\)/);
  assert.match(body, /representative_rank = 1/);
  assert.match(body, /ORDER BY ranked\.occurrence_count DESC/);
});

test("app metadata aggregates ordered Category records without a scalar read", () => {
  const start = source.indexOf("export async function appMetadata(");
  const end = source.indexOf("\nasync function legacyAppMetadata", start);
  const body = source.slice(start, end);

  assert.match(body, /\b(?:FROM|JOIN) app_categories/);
  assert.match(body, /JOIN categories/);
  assert.match(body, /jsonb_agg/);
  assert.match(body, /ORDER BY lower\(category_rows\.name\), category_rows\.id/);
  assert.match(body, /COUNT\(DISTINCT ei\.id\) FILTER \(WHERE ei\.kind = 'ui_element'\)/);
  assert.doesNotMatch(body, /i\.kind <> 'ui_element' OR EXISTS/);
  assert.doesNotMatch(body, /\bt\.category\b/);
});

test("app metadata counts normalized Flow rows after the hierarchical migration", () => {
  const start = source.indexOf("export async function appMetadata(");
  const end = source.indexOf("\nasync function legacyAppMetadata", start);
  const body = source.slice(start, end);

  assert.match(body, /COUNT\(af\.id\)::integer AS flow_count/);
  assert.match(body, /COUNT\(afv\.id\)::integer/);
  assert.doesNotMatch(body, /jsonb_array_length\(af\.flows\)/);
  assert.doesNotMatch(body, /jsonb_array_length\(afv\.flows\)/);
});

test("app version and Flow reads use normalized rows after the hierarchical migration", () => {
  const versionStart = source.indexOf("const versionSelect =");
  const versionEnd = source.indexOf("\nexport async function listAppVersions", versionStart);
  const versionBody = source.slice(versionStart, versionEnd);
  assert.match(versionBody, /SELECT COUNT\(\*\) FROM app_flows/);
  assert.match(versionBody, /SELECT COUNT\(\*\) FROM app_flow_versions/);
  assert.match(
    versionBody,
    /COUNT\(\*\) FILTER \(WHERE i\.kind = 'ui_element' AND NOT \([\s\S]*\)\)::int AS ui_element_count/,
  );
  assert.doesNotMatch(versionBody, /i\.kind = 'ui_element' AND EXISTS/);
  assert.doesNotMatch(versionBody, /\b(?:af|afv)\.flows\b/);

  const currentStart = source.indexOf("export async function getAppFlows(");
  const currentEnd = source.indexOf("\nexport async function", currentStart + 1);
  const currentBody = source.slice(currentStart, currentEnd);
  assert.match(currentBody, /readCurrentFlows/);
  assert.doesNotMatch(currentBody, /SELECT f\.flows/);

  const versionFlowStart = source.indexOf("export async function getVersionFlows(");
  const versionFlowEnd = source.indexOf("\nexport async function", versionFlowStart + 1);
  const versionFlowBody = source.slice(versionFlowStart, versionFlowEnd);
  assert.match(versionFlowBody, /readCurrentFlows/);
  assert.match(versionFlowBody, /readVersionFlows/);
  assert.doesNotMatch(versionFlowBody, /\b(?:af|afv)\.flows\b/);
});

test("versioned design systems load Flows through the normalized read path", () => {
  const start = source.indexOf("export async function getVersionDesignSystem(");
  const end = source.indexOf("\nexport async function", start + 1);
  const body = source.slice(start, end);

  assert.match(body, /getVersionFlows\(app, platform, version\.version_number/);
  assert.doesNotMatch(body, /\bafv\.flows\b/);
  assert.doesNotMatch(body, /JOIN app_flow_versions/);
});

test("image read paths return Category arrays without reading the legacy App column", () => {
  assert.doesNotMatch(source, /\b(?:a|t|pa)\.category\b/);

  for (const functionName of [
    "appEvidencePage",
    "flowEvidenceImages",
    "allImages",
    "appImages",
    "publishedImages",
    "publishedPreviewImages",
  ]) {
    const start = source.indexOf(`export async function ${functionName}(`);
    const end = source.indexOf("\nexport ", start + 1);
    const body = source.slice(start, end);

    assert.ok(start >= 0, `${functionName} source was not found`);
    assert.match(body, /\b(?:FROM|JOIN) app_categories/);
    assert.match(body, /JOIN categories/);
    assert.match(body, /jsonb_agg/);
  }
});

test("Flow analysis persists atomically to the exact app version", () => {
  const start = source.indexOf("export async function saveAnalyzedAppFlows(");
  const end = source.indexOf("\nexport async function", start + 1);
  const body = source.slice(start, end);

  assert.ok(start >= 0, "saveAnalyzedAppFlows source was not found");
  assert.match(body, /withTransaction/);
  assert.match(body, /WHERE av\.id = \$1[\s\S]*FOR UPDATE/);
  assert.match(body, /app !== input\.app|input\.app !==/);
  assert.match(body, /platform !== input\.platform|input\.platform !==/);
  assert.match(body, /replaceVersionFlows/);
  assert.match(body, /replaceCurrentFlows/);
  assert.doesNotMatch(body, /INSERT INTO app_flow_versions/);
  assert.doesNotMatch(body, /INSERT INTO app_flows/);
  assert.match(body, /draft[\s\S]*in_review/);
});

test("future Flow imports and publication share the normalized persistence boundary", () => {
  const saveStart = source.indexOf("export async function saveAppFlows(");
  const saveEnd = source.indexOf("\nexport async function", saveStart + 1);
  const saveBody = source.slice(saveStart, saveEnd);
  assert.match(saveBody, /withTransaction/);
  assert.match(saveBody, /replaceCurrentFlows/);
  assert.doesNotMatch(saveBody, /INSERT INTO app_flows/);

  const publishStart = source.indexOf("export async function publishAppVersion(");
  const publishEnd = source.indexOf("\nexport async function", publishStart + 1);
  const publishBody = source.slice(publishStart, publishEnd);
  assert.match(publishBody, /readCurrentFlows/);
  assert.match(publishBody, /replaceVersionFlows/);
  assert.doesNotMatch(publishBody, /SELECT flows FROM app_flows/);
  assert.doesNotMatch(publishBody, /INSERT INTO app_flow_versions/);
});

test("feature source reads current active Flows and immutable published Flows by version id", () => {
  const start = source.indexOf("export async function getVersionFlowsById(");
  const end = source.indexOf("\nexport async function", start + 1);
  const body = source.slice(start, end);

  assert.match(body, /av\.id = \$1 AND a\.name = \$2 AND av\.platform = \$3/);
  assert.match(body, /draft[\s\S]*in_review/);
  assert.match(body, /readCurrentFlows/);
  assert.match(body, /readVersionFlows/);
  assert.doesNotMatch(body, /\b(?:af|afv)\.flows\b/);
});
