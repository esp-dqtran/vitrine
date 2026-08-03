import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const story = readFileSync(
  new URL('../stories/Foundations/FormsAndInputs.stories.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../stories/Foundations/FormsAndInputs.css', import.meta.url),
  'utf8',
);
const productForms = readFileSync(new URL('./productForms.css', import.meta.url), 'utf8');
const foundation = readFileSync(new URL('./uiFoundation.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../../.storybook/preview.tsx', import.meta.url), 'utf8');

test('forms review covers the approved control family and states', () => {
  for (const component of [
    'TextInput',
    'TextArea',
    'CheckboxInput',
    'RadioList',
    'RadioListItem',
    'Switch',
  ]) {
    assert.match(story, new RegExp(`\\b${component}\\b`));
  }

  for (const state of ['Default', 'Filled', 'Success', 'Error', 'Disabled', 'Focus']) {
    assert.match(story, new RegExp(`name="${state}"`));
  }

  assert.match(story, /rows=\{3\}/);
});

test('forms review documents the approved interactive Apps pilot', () => {
  assert.match(story, /title="Apps pilot"/);
  assert.match(story, /placeholder="Search Apps…"/);
  assert.match(story, /placeholder="Search categories…"/);
  assert.match(story, /Approved standard · applied/);
  assert.match(story, /className="forms-review__product-input"/);
  assert.match(story, /Apps header Search control is the selected visual standard/);
  assert.match(main, /import '\.\/productForms\.css';/);
  assert.match(preview, /import '\.\.\/src\/vitrine\/productForms\.css';/);
});

test('editable fields reproduce the Apps SearchTrigger shell', () => {
  assert.match(foundation, /--vitrine-form-input-height: 48px/);
  assert.match(foundation, /--vitrine-form-input-radius: 999px/);
  assert.match(foundation, /--vitrine-form-input-padding-inline: 22px/);
  assert.match(productForms, /height: var\(--vitrine-form-input-height\)/);
  assert.match(productForms, /\.astryx-text-input[\s\S]*border: 1px solid var\(--vitrine-color-border-emphasized\)/);
  assert.match(productForms, /border-radius: var\(--vitrine-form-input-radius\)/);
  assert.match(productForms, /padding: 0 var\(--vitrine-form-input-padding-inline\)/);
  assert.match(productForms, /\.astryx-text-input:focus-within/);
  assert.match(productForms, /\.astryx-text-input\[data-status='success'\][\s\S]*var\(--color-text-green\)/);
  assert.match(productForms, /\.astryx-text-input\[data-status='error'\]/);
  assert.match(productForms, /\.astryx-field-status\.attached[\s\S]*margin-top: -16px/);
  assert.match(productForms, /\.astryx-textarea[\s\S]*min-height: 120px/);
  assert.match(productForms, /\.astryx-textarea[\s\S]*padding: 0;[\s\S]*border: 1px solid var\(--vitrine-color-border-emphasized\)/);
  assert.match(productForms, /\.astryx-textarea[\s\S]*background: var\(--vitrine-form-control-hover\)/);
  assert.match(productForms, /\.astryx-textarea textarea[\s\S]*box-sizing: border-box;[\s\S]*min-height: calc\(120px - 2px\);[\s\S]*padding: var\(--spacing-4\) var\(--vitrine-form-input-padding-inline\)[\s\S]*var\(--vitrine-presentation-body-large\)/);
  assert.doesNotMatch(styles, /\.forms-review__product-input\.astryx-text-input/);
});

test('forms review follows responsive foundation gutters', () => {
  assert.match(styles, /--vitrine-page-gutter-wide/);
  assert.match(styles, /--vitrine-page-gutter-medium/);
  assert.match(styles, /--vitrine-page-gutter-compact/);
  assert.match(styles, /@media \(max-width: 620px\)/);
});
