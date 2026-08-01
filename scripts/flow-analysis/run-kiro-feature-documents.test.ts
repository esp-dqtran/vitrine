import assert from "node:assert/strict";
import { test } from "node:test";

test("Kiro Feature Document batch runner is exposed as an executable module", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("./run-kiro-feature-documents.ts", import.meta.url), "utf8")
  );
  assert.match(source, /createKiroCliFeatureDocumentProvider/);
  assert.match(source, /createFeatureDocumentService/);
  assert.match(source, /createGeneration/);
  assert.match(source, /createRegeneration/);
  assert.match(source, /parseFeatureDocumentContent|Feature Document job ended/);
  assert.match(source, /--limit/);
  assert.match(source, /--workers/);
  assert.match(source, /--flow-ids/);
  assert.match(source, /PROMPT_VERSION = 14/);
  assert.match(source, /analysisMode: provider\.analyzeFlow \? "whole-flow" : "per-image"/);
  assert.match(source, /--official-docs/);
  assert.match(source, /--official-domains/);
  assert.match(source, /KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOCUMENTATION/);
  assert.match(source, /KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOMAINS/);
  assert.match(source, /r\.prompt_version = \$5/);
  assert.match(source, /latest\.job_prompt_version === PROMPT_VERSION/);
  assert.match(source, /d\.visibility = 'catalog'/);
  assert.match(source, /--visibility must be private or catalog/);
  assert.match(source, /SET user_id = NULL, visibility = 'catalog'/);
  assert.match(source, /completedCatalogFlowIds/);
});
