import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the search dialog mounted through its close animation', async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL('./components/CommandPalette.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /data-closing=/);
  assert.match(source, /onAnimationEnd=/);
  assert.match(source, /requestClose/);
  assert.match(styles, /@keyframes vitrine-command-palette-in/);
  assert.match(styles, /@keyframes vitrine-command-palette-out/);
  assert.match(styles, /\.command-palette-dialog\[data-closing="true"\]::backdrop/);
  assert.match(source, /InspirationPrompts/);
  assert.match(source, /InspirationResults/);
  assert.match(source, /InspirationPreview/);
  assert.match(source, /searchRelatedCatalog/);
  assert.match(source, /onKeyDownCapture/);
  assert.doesNotMatch(source, /appMatches/);
  assert.doesNotMatch(source, /screenMatches/);
  assert.match(styles, /\.inspiration-result-grid/);
  assert.match(styles, /\.inspiration-preview-layout/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@keyframes inspiration-view-enter/);
  assert.match(styles, /@keyframes inspiration-view-back/);
});
