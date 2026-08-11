import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORM_CONTROL_SCALE, UI_COMPONENT_STANDARD } from './uiFoundationStandard.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const productForms = read('./productForms.css');
const foundation = read('./uiFoundation.css');
const main = read('./main.tsx');
const preview = read('../../.storybook/preview.tsx');
const filterBar = read('./components/AppsFilterBar.tsx');
const discovery = read('./referenceDiscovery.css');
const styles = read('./styles.css');
const projects = read('./components/ProjectsPage.tsx');
const collections = read('./components/CollectionsWorkspacePage.tsx');
const projectsWorkspace = read('./projectsWorkspace.css');
const typography = read('./productTypography.css');

test('forms component contract records the approved Apps Search source', () => {
  assert.equal(UI_COMPONENT_STANDARD.forms.source, 'Vitrines Apps header Search');
  assert.deepEqual(
    FORM_CONTROL_SCALE.map(({ value }) => value),
    ['48px', '44px', '999px', '22px', '18px', '40px', '24px'],
  );
  assert.match(UI_COMPONENT_STANDARD.forms.policy, /preserve native input behavior/);
  assert.match(UI_COMPONENT_STANDARD.forms.policy, /editor or canvas geometry domain-owned/);
});

test('application and Storybook load product forms after foundation styles', () => {
  assert.ok(main.indexOf("import './productResponsive.css';") < main.indexOf("import './productForms.css';"));
  assert.ok(preview.indexOf("import '../src/vitrine/uiFoundation.css';") < preview.indexOf("import '../src/vitrine/productForms.css';"));
});

test('shared editable controls use foundation geometry and semantic states', () => {
  for (const token of [
    '--vitrine-form-input-height: 48px',
    '--vitrine-form-input-height-compact: 44px',
    '--vitrine-form-input-radius: 999px',
    '--vitrine-form-input-padding-inline: 22px',
    '--vitrine-form-choice-size: 18px',
    '--vitrine-form-switch-width: 40px',
    '--vitrine-form-switch-height: 24px',
  ]) assert.match(foundation, new RegExp(token.replace(/[()]/g, '\\$&')));

  assert.match(productForms, /\.astryx-text-input \{/);
  assert.match(productForms, /height: var\(--vitrine-form-input-height\)/);
  assert.match(productForms, /\.astryx-text-input[\s\S]*border: 1px solid var\(--vitrine-color-border-emphasized\)/);
  assert.match(productForms, /border-radius: var\(--vitrine-form-input-radius\)/);
  assert.match(productForms, /\.astryx-text-input:focus-within/);
  assert.match(productForms, /\.astryx-text-input\[data-status='success'\]/);
  assert.match(productForms, /var\(--color-text-green\)/);
  assert.match(productForms, /\.astryx-text-input\[data-status='warning'\]/);
  assert.match(productForms, /\.astryx-text-input\[data-status='error'\]/);
  assert.match(productForms, /\.astryx-textarea \{/);
  assert.match(productForms, /\.astryx-textarea[\s\S]*padding: 0;[\s\S]*border: 1px solid var\(--vitrine-color-border-emphasized\)/);
  assert.match(productForms, /\.astryx-text-input input[\s\S]*font: var\(--vitrine-type-action\) !important/);
  assert.match(productForms, /\.astryx-textarea textarea[\s\S]*box-sizing: border-box[\s\S]*min-height: calc\(120px - 2px\)[\s\S]*padding: var\(--spacing-4\) var\(--vitrine-form-input-padding-inline\)[\s\S]*font: var\(--vitrine-presentation-body-large\) !important/);
  assert.match(foundation, /--vitrine-form-textarea-radius: var\(--radius-container\)/);
  assert.match(productForms, /\.astryx-field-status\.attached[\s\S]*margin-top: -16px/);
  assert.match(productForms, /padding-block-start: 24px/);
  assert.match(productForms, /\.astryx-field-status\.success[\s\S]*color-mix\(in srgb, var\(--color-text-green\) 18%, transparent\)/);
  assert.match(productForms, /\.astryx-checkbox,[\s\S]*\.astryx-radio[\s\S]*var\(--vitrine-form-choice-size\)/);
  assert.match(productForms, /\.astryx-checkbox\.checked,[\s\S]*\.astryx-radio\.checked[\s\S]*var\(--vitrine-color-action-primary\)/);
  assert.match(productForms, /\.astryx-switch[\s\S]*var\(--vitrine-form-switch-width\)[\s\S]*var\(--vitrine-form-switch-height\)/);
  assert.match(productForms, /input:focus-visible \+ \.astryx-checkbox/);
  assert.match(productForms, /input:focus-visible \+ \.astryx-radio/);
  assert.match(productForms, /input:focus-visible \+ \.astryx-switch/);
  assert.match(productForms, /:has\(input:disabled\)/);
  assert.match(productForms, /\.astryx-field-label[\s\S]*font: var\(--vitrine-type-action\) !important/);
  assert.match(typography, /:not\([\s\S]*\.astryx-field-label/);
  assert.match(typography, /:not\([\s\S]*\.astryx-text-input input,[\s\S]*\.astryx-textarea textarea/);
  assert.match(productForms, /@media \(prefers-reduced-motion: reduce\)/);
});

test('Apps filters use the shared editable field instead of a second shell', () => {
  assert.match(filterBar, /startIcon=\{<Icon icon="search" size="sm" \/>\}/);
  assert.match(filterBar, /hasClear/);
  assert.doesNotMatch(filterBar, /<div className="apps-filterbar__search">\s*<Icon/s);
  assert.match(discovery, /\.apps-filterbar__search \{[\s\S]*min-height: var\(--vitrine-form-input-height\)/);
  assert.doesNotMatch(discovery, /\.apps-filterbar__search \.astryx-text-input[\s\S]*background: transparent/);
});

test('workspace header searches use the shared editable field', () => {
  assert.doesNotMatch(projects, /projects-workspace__header-search/);
  assert.doesNotMatch(collections, /projects-workspace__header-search/);
  assert.match(projects, /<TextInput/);
  assert.match(projectsWorkspace, /\.projects-workspace__header-search/);
});

test('specialized editor and canvas owners retain their higher-specificity geometry', () => {
  for (const owner of [
    '.project-canvas-document-editor__page .astryx-text-input',
    '.project-template-library__content .astryx-text-input',
    '.project-screen-library .astryx-text-input',
    '.project-playground__references .astryx-text-input',
  ]) assert.match(styles, new RegExp(owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.doesNotMatch(styles, /\.command-palette-search \.astryx-text-input[\s\S]*border: 0 !important/);
});
