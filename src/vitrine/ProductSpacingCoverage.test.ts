import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('loads the product spacing contract after route and typography styles', async () => {
  const main = await read('./main.tsx');
  const spacingImport = main.indexOf("import './productSpacing.css'");

  assert.ok(spacingImport > main.indexOf("import './productTypography.css'"));
  assert.ok(spacingImport > main.indexOf("import './components/AstryxModal.css'"));
});

test('applies the seven-step rhythm to every product-screen family', async () => {
  const styles = await read('./productSpacing.css');

  [
    '[data-application-surface="true"]',
    '.reference-discovery',
    '.reference-detail',
    '.projects-workspace',
    '.project-document-page',
    '[data-admin-dashboard="true"]',
    '.admin-users-state',
  ].forEach((scope) => assert.match(styles, new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));

  [
    '--spacing-1',
    '--spacing-2',
    '--spacing-3',
    '--spacing-4',
    '--spacing-6',
    '--spacing-8',
    '--spacing-12',
    '--vitrine-control-height',
  ].forEach((token) => assert.match(styles, new RegExp(token)));
});

test('standardizes shared buttons and dropdown selectors at 40px', async () => {
  const styles = await read('./productSpacing.css');
  const foundation = await read('./uiFoundation.css');
  const sharedControlRule = styles.match(/:is\(\n  \.astryx-button\.astryx-button\.sm,[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(foundation, /--vitrine-control-height:\s*40px/);
  [
    '.astryx-button.astryx-button.sm',
    '.astryx-button.astryx-button.md',
    '.astryx-button.astryx-button.lg',
    '.astryx-selector.astryx-selector.sm',
    '.astryx-selector.astryx-selector.md',
    '.astryx-selector.astryx-selector.lg',
  ].forEach((selector) => assert.ok(sharedControlRule.includes(selector)));
  assert.match(sharedControlRule, /height:\s*var\(--vitrine-control-height\)\s*!important/);
  assert.match(sharedControlRule, /min-height:\s*var\(--vitrine-control-height\)\s*!important/);
  assert.match(sharedControlRule, /flow-workspace/);
  assert.match(sharedControlRule, /flows-discovery/);
  assert.doesNotMatch(sharedControlRule, /reference-detail__metadata/);
  assert.match(sharedControlRule, /project-document__editor/);
  assert.match(sharedControlRule, /project-canvas-document-editor/);
  assert.match(sharedControlRule, /document-flow/);
  assert.match(sharedControlRule, /flow-preview-dialog/);
  assert.match(sharedControlRule, /excalidraw/);
});

test('keeps selected discovery filters inside one 40px composite control', async () => {
  const styles = await read('./productSpacing.css');

  assert.match(styles, /\.apps-filterbar__filter\s*\{[\s\S]*?height:\s*var\(--vitrine-control-height\)\s*!important/);
  assert.match(
    styles,
    /:is\(\.apps-filterbar, \.reference-detail__tab-controls, \.quick-search__quick-filters, \.advanced-search-active-filters, \.admin-users-filter-control\) \.apps-filterbar__filter :is\(\.apps-filterbar__filter-button\.apps-filterbar__filter-button, \.apps-filterbar__filter-label\)\s*\{[\s\S]*?height:\s*calc\(var\(--vitrine-control-height\) - var\(--spacing-1\)\)\s*!important[\s\S]*?min-height:\s*calc\(var\(--vitrine-control-height\) - var\(--spacing-1\)\)\s*!important/,
  );
  assert.match(
    styles,
    /:is\(\.apps-filterbar, \.reference-detail__tab-controls, \.quick-search__quick-filters, \.advanced-search-active-filters, \.admin-users-filter-control\) \.apps-filterbar__filter \.apps-filterbar__clear\.apps-filterbar__clear\s*\{[\s\S]*?width:\s*calc\(var\(--vitrine-control-height\) - var\(--spacing-2\)\)\s*!important[\s\S]*?height:\s*calc\(var\(--vitrine-control-height\) - var\(--spacing-2\)\)\s*!important/,
  );
});

test('normalizes relationships while preserving flow, evidence, and canvas geometry', async () => {
  const styles = await read('./productSpacing.css');

  assert.match(styles, /__actions/);
  assert.match(styles, /__controls/);
  assert.match(styles, /__metadata-item/);
  assert.match(styles, /__page-header/);
  assert.match(styles, /__body-inner/);
  assert.match(styles, /project-document__editor \*/);
  assert.match(styles, /project-canvas-document-editor \*/);
  assert.match(styles, /document-flow \*/);
  assert.match(styles, /flow-workspace \*/);
  assert.match(styles, /flows-discovery \*/);
  assert.match(styles, /flow-preview-dialog \*/);
  assert.match(styles, /excalidraw \*/);
});

test('keeps Flow internals domain-owned while sharing the App-detail body container', async () => {
  const styles = await read('./productSpacing.css');
  const flowWorkspaceExclusions = styles.match(/\.flow-workspace \*/g) ?? [];
  const flowDiscoveryExclusions = styles.match(/\.flows-discovery \*/g) ?? [];

  assert.equal(flowWorkspaceExclusions.length, 5);
  assert.equal(flowDiscoveryExclusions.length, 5);
  assert.doesNotMatch(styles, /\.reference-detail__body-inner:has\(\.flow-workspace\)/);
  assert.match(styles, /\.reference-detail__body-inner\s*\{[\s\S]*?padding:\s*var\(--spacing-8\) var\(--spacing-6\) var\(--spacing-12\)\s*!important/);
  assert.match(styles, /\.reference-discovery__content\s*\{/);
  assert.match(styles, /\.reference-discovery__taxonomy\s*\{/);
});

test('keeps App-card copy in one compact text group', async () => {
  const styles = await read('./productSpacing.css');

  assert.match(styles, /\.apps-discovery \.discovery-card__copy small\s*\{[\s\S]*?margin-top:\s*0/);
});

test('balances App-detail tab height, label size, and secondary controls', async () => {
  const styles = await read('./productSpacing.css');

  assert.match(styles, /\.reference-detail__navigation\s*\{[\s\S]*?min-height:\s*var\(--reference-nav-height\)\s*!important/);
  assert.match(styles, /\.reference-detail \.reference-detail__tabs > button\s*\{[\s\S]*?height:\s*var\(--vitrine-control-height\)\s*!important[\s\S]*?font-size:\s*15px\s*!important/);
  assert.match(styles, /\.reference-detail__tab-controls\s*\{[\s\S]*?min-height:\s*var\(--vitrine-control-height\)\s*!important/);
  assert.match(styles, /\.reference-detail__tab-leading :is\([\s\S]*?\.astryx-button\.astryx-button\.astryx-button,[\s\S]*?\.astryx-selector\.astryx-selector\.astryx-selector[\s\S]*?\),/);
  assert.match(styles, /\.reference-detail__tab-controls :is\([\s\S]*?\.astryx-button\.astryx-button\.astryx-button,[\s\S]*?\.astryx-selector\.astryx-selector\.astryx-selector[\s\S]*?\)\s*\{[\s\S]*?height:\s*var\(--vitrine-control-height\)\s*!important/);
  assert.match(styles, /\.apps-platform-switcher\s+button\.astryx-button\s*\{[\s\S]*?height:\s*auto\s*!important[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(styles, /@media \(max-width:\s*720px\)[\s\S]*?\.reference-detail__navigation\s*\{[\s\S]*?min-height:\s*calc\(var\(--spacing-12\) \* 2\)\s*!important/);
});

test('the rollout layer uses foundation tokens instead of new pixel choices', async () => {
  const styles = await read('./productSpacing.css');
  const declarations = styles
    .split('\n')
    .filter((line) => /^\s*(?:gap|row-gap|column-gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|height|min-height):/.test(line));

  declarations.forEach((line) => {
    assert.doesNotMatch(line, /\b\d+(?:\.\d+)?px\b/, `raw spacing value in rollout layer: ${line.trim()}`);
  });
});
