import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { FOUNDATION_TOKEN_CONTRACT, UI_FOUNDATION_STANDARD } from './uiFoundationStandard.ts';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

async function collectCss(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectCss(target);
    return entry.isFile() && entry.name.endsWith('.css') ? [target] : [];
  }));
  return files.flat();
}

test('publishes a compact product-owned typography contract', async () => {
  const foundation = await read('./uiFoundation.css');
  const tokens = FOUNDATION_TOKEN_CONTRACT.typography;

  assert.equal(tokens.length, 11);
  assert.equal(new Set(tokens).size, tokens.length);
  tokens.forEach((token) => {
    assert.match(token, /^--vitrine-(?:font-family|type)-/);
    assert.match(foundation, new RegExp(`${token}:\\s*`), `missing Vitrines typography token: ${token}`);
  });
  assert.equal(UI_FOUNDATION_STANDARD.typographySource, 'Vitrines App Screen detail');
  assert.match(UI_FOUNDATION_STANDARD.typographyPolicy, /presentation layer/);
  assert.match(UI_FOUNDATION_STANDARD.typographyPolicy, /Figtree/);
  assert.match(foundation, /--vitrine-font-family-sans:\s*'Figtree',\s*system-ui,\s*sans-serif/);
});

test('bridges shared component typography into the Vitrines roles', async () => {
  const foundation = await read('./uiFoundation.css');

  assert.match(foundation, /--font-family-body:\s*var\(--vitrine-font-family-sans\)/);
  assert.match(foundation, /--font-family-heading:\s*var\(--vitrine-font-family-sans\)/);
  assert.match(foundation, /--font-family-code:\s*var\(--vitrine-font-family-code\)/);
  assert.match(foundation, /--text-heading-1-size:\s*1\.125rem/);
  assert.match(foundation, /--text-body-size:\s*0\.875rem/);
  assert.match(foundation, /--text-label-weight:\s*600/);
  assert.match(foundation, /--text-supporting-leading:\s*1\.3333/);
});

test('keeps the measured App Screen detail hierarchy on semantic roles', async () => {
  const preview = await read('./flowPreviewDialog.css');

  assert.match(preview, /\.flow-preview-dialog__app strong\s*\{[^}]*font:\s*var\(--vitrine-type-title\)/s);
  assert.match(preview, /\.flow-preview-dialog__footer-actions > button,[^}]*font:\s*var\(--vitrine-type-action\)\s*!important/s);
  assert.match(preview, /\.flow-preview-dialog__metadata\s*\{[^}]*font:\s*var\(--vitrine-type-body\)/s);
  assert.match(preview, /\.flow-preview-dialog__metadata button\s*\{[^}]*font:\s*var\(--vitrine-type-label\)/s);
  assert.match(preview, /\.flow-preview-dialog__info strong\s*\{[^}]*font:\s*var\(--vitrine-type-heading\)/s);
  assert.match(preview, /\.flow-preview-dialog__info span,[^}]*font:\s*var\(--vitrine-type-detail\)/s);
});

test('keeps large App overview type outside the compact product contract', async () => {
  const foundation = await read('./uiFoundation.css');
  const styles = await read('./styles.css');

  assert.doesNotMatch(FOUNDATION_TOKEN_CONTRACT.typography.join('\n'), /presentation/);
  assert.match(foundation, /--vitrine-presentation-display:/);
  assert.match(styles, /\.reference-detail__heading h1\s*\{[^}]*font:\s*var\(--vitrine-presentation-display\)/s);
  assert.match(styles, /\.reference-detail__heading p\s*\{[^}]*font:\s*var\(--vitrine-presentation-lead\)/s);
});

test('loads Figtree as the product family while preserving the Apps taxonomy hierarchy', async () => {
  const vitrineDirectory = path.dirname(new URL('./styles.css', import.meta.url).pathname);
  const files = await collectCss(vitrineDirectory);
  const screenStyles = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const preview = await read('../../.storybook/preview.tsx');
  const main = await read('./main.tsx');
  const productTypography = await read('./productTypography.css');
  const typographyStory = await read('../stories/Foundations/Typography.stories.tsx');

  ['400', '500', '600', '700'].forEach((weight) => {
    const fontImport = new RegExp(`@fontsource/figtree/${weight}\\.css`);
    assert.match(main, fontImport);
    assert.match(preview, fontImport);
  });
  assert.match(typographyStory, />Figtree</);
  assert.doesNotMatch(typographyStory, />System UI</);
  assert.match(screenStyles, /--reference-font-family:\s*var\(--font-family-body\)/);
  assert.doesNotMatch(screenStyles, /--reference-taxonomy-font-family/);
  assert.match(screenStyles, /\.reference-discovery__facet h2\s*\{[^}]*font-family:\s*inherit\s*!important;[^}]*font-size:\s*14px\s*!important;[^}]*font-weight:\s*500\s*!important/s);
  assert.match(screenStyles, /\.reference-discovery__facet button\s*\{[^}]*font-family:\s*inherit\s*!important;[^}]*font-size:\s*var\(--reference-facet-size\)\s*!important;[^}]*font-weight:\s*600\s*!important;[^}]*line-height:\s*32px\s*!important;[^}]*letter-spacing:\s*-\.025em\s*!important/s);
  assert.equal((productTypography.match(/\.reference-discovery__taxonomy \*/g) ?? []).length, 2);
  assert.match(screenStyles, /\.vitrine-page\s*\{[^}]*font-family:\s*var\(--font-family-body\)/s);
});
