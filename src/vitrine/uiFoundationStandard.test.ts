import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FOUNDATION_TOKEN_CONTRACT,
  UI_FOUNDATION_AREAS,
  UI_FOUNDATION_STANDARD,
} from './uiFoundationStandard.ts';

test('the Vitrines foundation contract resolves exactly 13 product-owned color roles', async () => {
  const requiredTokens = Object.values(FOUNDATION_TOKEN_CONTRACT).flat();
  const foundation = await readFile(new URL('./uiFoundation.css', import.meta.url), 'utf8');

  assert.equal(new Set(requiredTokens).size, requiredTokens.length, 'foundation token roles must be unique');
  FOUNDATION_TOKEN_CONTRACT.color.forEach((token) => {
    assert.match(token, /^--vitrine-color-/);
    assert.match(foundation, new RegExp(`${token}:\\s*`), `missing Vitrines foundation token: ${token}`);
  });
});

test('App detail is the source of truth for action and neutral status roles', async () => {
  const foundation = await readFile(new URL('./uiFoundation.css', import.meta.url), 'utf8');
  const appStyles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(foundation, /--vitrine-color-action-primary:\s*#ffffff/);
  assert.match(foundation, /--vitrine-color-on-action-primary:\s*#111111/);
  assert.match(foundation, /--vitrine-color-status-success:\s*light-dark\(#0a1317,\s*#dfe2e5\)/);
  assert.match(foundation, /--vitrine-color-status-warning:\s*light-dark\(#4e606f,\s*#aaafb5\)/);
  assert.match(appStyles, /background:\s*var\(--vitrine-color-action-primary\)\s*!important/);
  assert.match(appStyles, /color:\s*var\(--vitrine-color-on-action-primary\)\s*!important/);
});

test('shared component colors bridge into the Vitrines foundation on every screen', async () => {
  const foundation = await readFile(new URL('./uiFoundation.css', import.meta.url), 'utf8');
  const bridges = {
    '--color-background-body': '--vitrine-color-page',
    '--color-background-surface': '--vitrine-color-surface',
    '--color-background-muted': '--vitrine-color-surface-muted',
    '--color-border': '--vitrine-color-border',
    '--color-text-primary': '--vitrine-color-text-primary',
    '--color-text-secondary': '--vitrine-color-text-secondary',
    '--color-text-disabled': '--vitrine-color-text-disabled',
    '--color-success': '--vitrine-color-status-success',
    '--color-warning': '--vitrine-color-status-warning',
    '--color-error': '--vitrine-color-status-error',
  } as const;

  Object.entries(bridges).forEach(([shared, product]) => {
    assert.match(foundation, new RegExp(`${shared}:\\s*var\\(${product}\\)`));
  });
});

test('the public product palette stays intentionally small', () => {
  assert.equal(FOUNDATION_TOKEN_CONTRACT.color.length, 13);
  assert.ok(FOUNDATION_TOKEN_CONTRACT.color.length <= 13, 'product UI must not expose the full implementation palette');
  assert.match(UI_FOUNDATION_STANDARD.specializedColorPolicy, /not product foundation choices/);
});

test('the foundation standard covers every system decision before components', () => {
  assert.equal(UI_FOUNDATION_STANDARD.productName, 'Vitrines');
  assert.equal(UI_FOUNDATION_STANDARD.colorSource, 'Vitrines App detail');
  assert.deepEqual(UI_FOUNDATION_STANDARD.modes, ['light', 'dark']);
  assert.deepEqual(
    UI_FOUNDATION_AREAS.map(({ id }) => id),
    ['color', 'typography', 'spacing', 'shape', 'motion', 'responsive', 'accessibility'],
  );
  UI_FOUNDATION_AREAS.forEach((area) => {
    assert.ok(area.intent.length > 0, `${area.id} needs an intent`);
    assert.ok(area.rules.length >= 3, `${area.id} needs actionable rules`);
  });
});

test('Storybook presents the current Vitrines product name for the foundation theme', async () => {
  const preview = await readFile(new URL('../../.storybook/preview.tsx', import.meta.url), 'utf8');
  assert.match(preview, /description:\s*'Vitrines color scheme'/);
  assert.doesNotMatch(preview, /description:\s*'Astryx color scheme'/);
});
