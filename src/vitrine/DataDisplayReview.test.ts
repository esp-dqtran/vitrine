import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const story = readFileSync('src/stories/Components/DataDisplay.stories.tsx', 'utf8');
const css = readFileSync('src/stories/Components/DataDisplay.css', 'utf8');
const productCss = readFileSync('src/vitrine/productDataDisplay.css', 'utf8');

test('builds the Data Display review from production card components', () => {
  assert.match(story, /title: 'Components\/DataDisplay\/Cards and lists'/);
  assert.match(story, /<AppCard/);
  assert.match(story, /<AppCardSkeleton/);
  assert.match(story, /<EmptyState/);
  assert.match(story, /title="Production card"/);
  assert.match(story, /title="Grid and interaction states"/);
  assert.match(story, /title="Compact list"/);
  assert.match(story, /title="Empty and responsive behavior"/);
});

test('keeps the live Aboard card hierarchy and progress in the visual pilot', () => {
  assert.match(story, /app: 'Aboard'/);
  assert.match(story, /totalScreens: 624/);
  assert.match(story, /status: 'In progress'/);
  assert.match(story, /progressLabel: '0\/624 analyzed'/);
  assert.match(story, /Business, Jobs & Recruitment/);
});

test('makes the selected grid example explicit and keeps loading beside it', () => {
  assert.match(story, /useState\(reviewApps\[2\]\.app\.id\)/);
  assert.match(story, /data-display-review__state-example/);
  assert.match(story, /selectedId === item\.app\.id \? 'Selected' : 'Default'/);
  assert.match(story, /<span>Loading<\/span>/);
});

test('loads the production visual layers before review-only composition', () => {
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/styles\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/referenceDiscovery\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productSpacing\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productShape\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productMotion\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productDataDisplay\.css'/);
});

test('documents responsive grid and compact list behavior without raw review colors', () => {
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(story, /data-display-review__list data-display-list/);
  assert.match(productCss, /data-display-list \.discovery-card/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
});

test('uses a non-blocking full-card overlay for selected data items', () => {
  assert.match(story, /data-display-review__card-slot data-display-card/);
  assert.match(productCss, /data-display-card\[data-selected="true"\]::after/);
  assert.match(productCss, /inset: 0/);
  assert.match(productCss, /border-radius: inherit/);
  assert.match(productCss, /color-mix\(in srgb, var\(--color-text-primary\) 10%, transparent\)/);
  assert.match(productCss, /pointer-events: none/);
  assert.doesNotMatch(productCss, /height: 2px/);
});

test('uses the compact-row logo overlay and approved 16 14 12 text hierarchy', () => {
  assert.match(productCss, /data-display-list \.discovery-card__logo/);
  assert.match(productCss, /position: absolute/);
  assert.match(productCss, /width: 32px/);
  assert.match(productCss, /data-display-list \.discovery-card__copy strong[\s\S]*font-size: 16px/);
  assert.match(productCss, /data-display-list \.discovery-card__copy > span[\s\S]*font-size: 14px/);
  assert.match(productCss, /data-display-list \.discovery-card__copy small[\s\S]*font-size: 12px/);
});

test('keeps Flow evidence document and canvas geometry out of the shared layer', () => {
  assert.doesNotMatch(productCss, /flow-(workspace|evidence|preview)|document-|canvas-/);
});
