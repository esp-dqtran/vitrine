import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CONTROL_SIZE_SCALE,
  FOUNDATION_TOKEN_CONTRACT,
  SPACING_SCALE,
  UI_FOUNDATION_STANDARD,
} from './uiFoundationStandard.ts';

test('Vitrines exposes a compact seven-step product spacing scale', () => {
  assert.deepEqual(
    SPACING_SCALE.map(({ token, value }) => [token, value]),
    [
      ['--spacing-1', '4px'],
      ['--spacing-2', '8px'],
      ['--spacing-3', '12px'],
      ['--spacing-4', '16px'],
      ['--spacing-6', '24px'],
      ['--spacing-8', '32px'],
      ['--spacing-12', '48px'],
    ],
  );
  assert.deepEqual(
    FOUNDATION_TOKEN_CONTRACT.spacing,
    SPACING_SCALE.map(({ token }) => token),
  );
  assert.ok(SPACING_SCALE.every(({ use }) => use.length > 0));
});

test('control sizing stays aligned to the shared component contract', () => {
  assert.deepEqual(
    CONTROL_SIZE_SCALE.map(({ token, value }) => [token, value]),
    [
      ['--size-element-sm', '28px'],
      ['--size-element-md', '32px'],
      ['--size-element-lg', '36px'],
    ],
  );
  assert.deepEqual(
    FOUNDATION_TOKEN_CONTRACT.size,
    CONTROL_SIZE_SCALE.map(({ token }) => token),
  );
});

test('the spacing standard records its product evidence and adoption policy', () => {
  assert.equal(UI_FOUNDATION_STANDARD.spacingSource, 'Vitrines Apps, App detail, and Workspace');
  assert.match(UI_FOUNDATION_STANDARD.spacingPolicy, /seven-step/);
  assert.match(UI_FOUNDATION_STANDARD.spacingPolicy, /nearest token/);
  assert.match(UI_FOUNDATION_STANDARD.spacingPolicy, /full internal scale/);
});

test('Storybook teaches scale, control sizes, and composition rhythm', async () => {
  const story = await readFile(
    new URL('../stories/Foundations/Spacing.stories.tsx', import.meta.url),
    'utf8',
  );

  assert.match(story, /FOUNDATION 03 · SPACING & SIZE/);
  assert.match(story, /Seven spacing choices/);
  assert.match(story, /Control heights/);
  assert.match(story, /Composition rhythm/);
  assert.match(story, /SPACING_SCALE\.map/);
  assert.match(story, /CONTROL_SIZE_SCALE\.map/);
  assert.match(story, /var\(\$\{token\}\)/);
});
