import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('loads the Apps shape prototype after the existing product layers', async () => {
  const main = await read('./main.tsx');
  const shapeImport = main.indexOf("import './productShape.css'");

  assert.ok(shapeImport > main.indexOf("import './productSpacing.css'"));
});

test('rolls the approved shape hierarchy across normal product screens', async () => {
  const styles = await read('./productShape.css');

  assert.match(styles, /:where\(\.apps-discovery, \.sites-discovery\)/);
  assert.match(styles, /--radius-page:\s*20px/);
  assert.match(styles, /--reference-card-radius:\s*var\(--radius-page\)/);
  assert.match(styles, /--reference-media-radius:\s*var\(--radius-container\)/);
  assert.match(styles, /--reference-logo-radius:\s*var\(--radius-container\)/);
  assert.match(styles, /var\(--radius-element\)/);
  assert.match(styles, /var\(--radius-full\)/);
  assert.match(styles, /\[data-admin-dashboard="true"\]/);
  assert.match(styles, /\.projects-workspace \.discovery-card/);
  assert.match(styles, /\.projects-workspace__empty/);
  assert.match(styles, /\.collections-workspace__card/);
  assert.match(styles, /\.collections-workspace__empty/);
  assert.match(styles, /\.settings-workspace__form-card/);
  assert.match(styles, /\.team-settings__card/);
  assert.match(styles, /\.settings-workspace__content\s*\{[\s\S]*?var\(--radius-page\) var\(--radius-page\) 0 0/);
  assert.match(styles, /\.astryx-card:not\(/);
  assert.match(styles, /\.astryx-dropdown-panel/);
  assert.match(styles, /box-shadow:\s*var\(--shadow-low\)/);
  assert.match(styles, /box-shadow:\s*var\(--shadow-med\)/);
  assert.match(styles, /dialog\.astryx-modal\.astryx-modal--dialog:not\(\.flow-preview-dialog-shell\)[\s\S]*?box-shadow:\s*var\(--shadow-high\)/);
  assert.match(styles, /\.reference-detail\[data-reference-detail="app"\]/);
  assert.match(styles, /\.reference-detail__logo\s*\{[\s\S]*?border-radius:\s*var\(--radius-container\)/);
  assert.doesNotMatch(styles, /\.reference-detail__navigation\s*\{/);
  assert.match(styles, /\.screen-grid-card__media[\s\S]*?> \.astryx-clickable-card\s*\{[\s\S]*?border-radius:\s*var\(--radius-container\)[\s\S]*?box-shadow:\s*var\(--shadow-low\)/);
  assert.match(styles, /\.screen-grid-card__select\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-med\)/);
  assert.match(styles, /\.screen-grid-card__actions\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-high\)/);
  assert.match(styles, /\.astryx-dropdown-panel:not\(\.flow-workspace \*\)\s*\{[\s\S]*?border-radius:\s*var\(--radius-container\)[\s\S]*?box-shadow:\s*var\(--shadow-med\)/);
  assert.match(styles, /:not\(\.flow-workspace \*\)/);

  assert.match(styles, /\.flows-discovery \*/);
  assert.match(styles, /\.flow-workspace \*/);
  assert.match(styles, /\.project-document__editor \*/);
  assert.match(styles, /\.project-canvas-document-editor \*/);
  assert.match(styles, /\.document-flow \*/);
  assert.match(styles, /\.flow-preview-dialog \*/);
  assert.match(styles, /\.excalidraw \*/);
});
