import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FOUNDATION_TOKEN_CONTRACT,
  ICON_SIZE_SCALE,
  UI_FOUNDATION_STANDARD,
} from './uiFoundationStandard.ts';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('publishes the three-size Vitrines iconography contract', async () => {
  const foundation = await read('./uiFoundation.css');

  assert.deepEqual(
    ICON_SIZE_SCALE.map(({ token, value }) => [token, value]),
    [
      ['--vitrine-icon-size-inline', '16px'],
      ['--vitrine-icon-size-control', '20px'],
      ['--vitrine-icon-size-emphasis', '24px'],
    ],
  );
  FOUNDATION_TOKEN_CONTRACT.iconography.forEach((token) => {
    assert.match(foundation, new RegExp(`${token}:\\s*`), `missing iconography token: ${token}`);
  });
  assert.equal(UI_FOUNDATION_STANDARD.iconographySource, 'Vitrines App detail');
  assert.match(UI_FOUNDATION_STANDARD.iconographyPolicy, /2px rounded stroke/);
  assert.match(UI_FOUNDATION_STANDARD.iconographyPolicy, /accessible 40px icon-only controls/);
});

test('loads the App Detail iconography pilot after shape and spacing', async () => {
  const main = await read('./main.tsx');
  const iconographyImport = main.indexOf("import './productIconography.css'");

  assert.ok(iconographyImport > main.indexOf("import './productShape.css'"));
  assert.ok(iconographyImport > main.indexOf("import './productSpacing.css'"));
});

test('continues the App Detail icon language through shared discovery controls', async () => {
  const styles = await read('./productIconography.css');

  assert.match(styles, /\.reference-discovery-nav/);
  assert.match(styles, /\.reference-discovery:not\(\.flows-discovery\)/);
  assert.match(styles, /reference-detail\[data-reference-detail="app"\]/);
  assert.match(styles, /\.app-screen-preview-dialog/);
  assert.match(styles, /\.flow-preview-dialog-shell/);
  assert.match(styles, /stroke-width:\s*var\(--vitrine-icon-stroke-width\)/);
  assert.match(styles, /width:\s*var\(--vitrine-icon-size-inline\)\s*!important/);
  assert.match(styles, /width:\s*var\(--vitrine-icon-size-control\)\s*!important/);
  assert.match(styles, /width:\s*var\(--vitrine-icon-button-size\)\s*!important/);
  assert.doesNotMatch(styles, /(?:^|,\n\s*)\.flows-discovery(?:[,\s{])/m);
});

test('removes the legacy 12px icon size from shared discovery controls', async () => {
  const [dropdown, search] = await Promise.all([
    read('./components/AstryxDropdown.tsx'),
    read('./components/SearchTrigger.tsx'),
  ]);

  assert.match(dropdown, /icon="chevronDown" size="sm"/);
  assert.match(dropdown, /icon="check" size="sm"/);
  assert.doesNotMatch(dropdown, /size="xsm"/);
  assert.match(search, /icon="close" size="sm"/);
});

test('documents the system and keeps icon-only App Detail controls named and tooltipped', async () => {
  const story = await read('../stories/Foundations/Iconography.stories.tsx');
  const screenCard = await read('./components/ScreenGridCard.tsx');
  const screenPreview = await read('./components/ScreenPreviewDialog.tsx');
  const flowCard = await read('./components/FlowCard.tsx');
  const flowPreview = await read('./components/FlowPreviewDialog.tsx');

  assert.match(story, /FOUNDATION 05 · ICONOGRAPHY/);
  assert.match(story, /Three sizes only/);
  assert.match(story, /accessible label plus tooltip/);
  assert.match(screenCard, /label=\{\s*selected[\s\S]*?tooltip=\{\s*selected/);
  assert.match(screenPreview, /label="Close screen preview"[\s\S]*?tooltip="Close screen preview"/);
  assert.match(flowCard, /iconTooltips\?: boolean/);
  assert.match(flowCard, /tooltip=\{iconTooltips \? 'More flow actions' : undefined\}/);
  assert.match(flowPreview, /iconTooltips\?: boolean/);
  assert.doesNotMatch(flowPreview, /More screen actions/);
  assert.doesNotMatch(flowPreview, /More prototype actions/);
});
