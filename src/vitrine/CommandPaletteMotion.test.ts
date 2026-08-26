import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the search dialog mounted through its close animation', async () => {
  const [source, styles, flowApi, flowLifecycle] = await Promise.all([
    readFile(new URL('./components/CommandPalette.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./flowCatalogApi.ts', import.meta.url), 'utf8'),
    readFile(new URL('./useCommandPaletteFlowCatalog.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /dataClosing=\{closing \? 'true' : undefined\}/);
  assert.doesNotMatch(source, /data-closing=\{closing/);
  assert.match(source, /onAnimationEnd=/);
  assert.match(source, /requestClose/);
  assert.match(styles, /@keyframes vitrine-command-palette-in/);
  assert.match(styles, /@keyframes vitrine-command-palette-out/);
  assert.match(styles, /\.command-palette-dialog\[data-closing="true"\]::backdrop/);
  assert.match(source, /InspirationPrompts/);
  assert.match(source, /InspirationResults/);
  assert.match(source, /InspirationPreview/);
  assert.match(source, /searchRelatedCatalog/);
  assert.match(source, /useCommandPaletteFlowCatalog/);
  assert.match(source, /cancel:\s*cancelFlowRequests/);
  assert.match(source, /const requestClose[\s\S]*cancelFlowRequests\(\)[\s\S]*setClosing\(true\)/);
  assert.match(flowLifecycle, /initialRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(flowLifecycle, /cursorRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(flowLifecycle, /observerRef\.current\?\.disconnect\(\)/);
  assert.match(flowApi, /\/api\/flows/);
  assert.doesNotMatch(source, /loadDesignSystem/);
  assert.doesNotMatch(source, /Promise\.all\(apps\.map/);
  assert.match(source, /onKeyDownCapture/);
  assert.match(source, /if \(event\.key === 'Escape'\) \{[\s\S]*requestClose\(\)/);
  assert.doesNotMatch(source, /appMatches/);
  assert.doesNotMatch(source, /screenMatches/);
  assert.match(styles, /\.inspiration-result-grid/);
  assert.match(styles, /\.inspiration-preview-layout/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@keyframes inspiration-view-enter/);
  assert.match(styles, /@keyframes inspiration-view-back/);
});
