import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('removes legacy FLOW.md while preserving Feature Document creation', async () => {
  const [
    flowsPanel,
    flowViewer,
    exportPanel,
    researchApi,
    exportEngine,
    apiApp,
    database,
    migrationVerifier,
    readme,
    dropMigration,
  ] = await Promise.all([
    source('./vitrine/components/FlowsPanel.tsx'),
    source('./vitrine/components/FlowViewer.tsx'),
    source('./vitrine/components/ExportPanel.tsx'),
    source('./vitrine/researchApi.ts'),
    source('./exportEngine.ts'),
    source('../services/api/src/app.ts'),
    source('./db.ts'),
    source('../scripts/verify-migrations.ts'),
    source('../README.md'),
    source('../migrations/0020_drop_flow_documents.sql').catch(() => ''),
  ]);

  assert.doesNotMatch(flowsPanel, /FlowDocEditor|Open FLOW\.md|editingDoc/);
  assert.match(flowViewer, /Create Feature Document/);
  assert.doesNotMatch(exportPanel, /flow-md|Export FLOW\.md|Product flow documentation/);
  assert.doesNotMatch(researchApi, /flow-doc|loadFlowDoc|saveFlowDoc/);
  assert.doesNotMatch(exportEngine, /flow-md|function flowMd/);
  assert.doesNotMatch(apiApp, /flow-doc|flow-md|getFlowDocument|saveFlowDocument/);
  assert.doesNotMatch(database, /getFlowDocument|saveFlowDocument|flow_documents/);
  assert.doesNotMatch(migrationVerifier, /["']flow_documents["']/);
  assert.doesNotMatch(readme, /FLOW\.md|flow-md|flow-doc/);
  assert.match(dropMigration, /DROP TABLE IF EXISTS flow_documents/i);

  for (const path of [
    './vitrine/components/FlowDocEditor.tsx',
    './vitrine/markdownToHtml.ts',
    './vitrine/markdownToHtml.test.ts',
  ]) {
    const legacyFileExists = await access(new URL(path, import.meta.url)).then(() => true, () => false);
    assert.equal(legacyFileExists, false, `${path} should be removed`);
  }
});
