import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('loads the product typography contract after route and overlay styles', async () => {
  const main = await read('./main.tsx');
  const productImport = main.indexOf("import './productTypography.css'");

  assert.ok(productImport > main.indexOf("import './projectsWorkspace.css'"));
  assert.ok(productImport > main.indexOf("import './flowPreviewDialog.css'"));
  assert.ok(productImport > main.indexOf("import './components/AstryxModal.css'"));
});

test('maps every application surface to the compact Screen detail hierarchy', async () => {
  const styles = await read('./productTypography.css');

  assert.match(styles, /\[data-application-surface="true"\]\s*\{[^}]*font:\s*var\(--vitrine-type-body\)/s);
  assert.match(styles, /:where\(h1\)[^{]*\{[^}]*font:\s*var\(--vitrine-type-title\)\s*!important/s);
  assert.match(styles, /:where\(h2, h3\)[^{]*\{[^}]*font:\s*var\(--vitrine-type-heading\)\s*!important/s);
  assert.match(styles, /h4, h5, h6, label, legend[^{]*\{[^}]*font:\s*var\(--vitrine-type-label\)\s*!important/s);
  assert.match(styles, /p, li, dt, dd, blockquote, input, textarea, select[^{]*\{[^}]*font:\s*var\(--vitrine-type-body\)\s*!important/s);
  assert.match(styles, /button\[data-variant="primary"\][^{]*\{[^}]*font:\s*var\(--vitrine-type-action\)\s*!important/s);
  assert.match(styles, /small, time, figcaption[^{]*\{[^}]*font:\s*var\(--vitrine-type-supporting\)\s*!important/s);
  assert.match(styles, /\[class\*="__metadata"\][^{]*\{[^}]*font:\s*var\(--vitrine-type-detail\)\s*!important/s);
  assert.match(styles, /\[data-admin-dashboard="true"\][^}]*h1\s*\{[^}]*font:\s*var\(--vitrine-type-title\)\s*!important/s);
});

test('keeps evidence, document, canvas, dialog-source, and editorial type scoped', async () => {
  const styles = await read('./productTypography.css');

  [
    '.project-document__editor *',
    '.project-canvas-document-editor *',
    '.document-flow *',
    '.flow-preview-dialog *',
    '.excalidraw *',
  ].forEach((exception) => assert.match(styles, new RegExp(exception.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(styles, /\.reference-detail__heading h1\s*\{[^}]*var\(--vitrine-presentation-display\)/s);
  assert.match(styles, /\.project-files__hero-heading p\s*\{[^}]*var\(--vitrine-presentation-lead\)/s);
});
