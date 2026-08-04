import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('publishes a production-grounded Search, Filters and Results review', async () => {
  const story = await read('../stories/Patterns/SearchFiltersAndResults.stories.tsx');

  assert.match(story, /Patterns\/Search, Filters and Results/);
  assert.match(story, /SearchTrigger/);
  assert.match(story, /QuickSearch/);
  assert.match(story, /DiscoveryFilterBar/);
  assert.match(story, /AppCard/);
  assert.match(story, /AppCardSkeleton/);
  assert.match(story, /ReferenceDiscoveryTopNav/);
  assert.match(story, /mode="advanced"/);
  assert.match(story, /client=\{async \(\) => searchResult\}/);
});

test('reviews filtering, sorting, stable result states, and recovery actions', async () => {
  const story = await read('../stories/Patterns/SearchFiltersAndResults.stories.tsx');

  assert.match(story, /Filters and sort/);
  assert.match(story, /Result states/);
  assert.match(story, /No apps match these filters/);
  assert.match(story, /Apps could not be loaded/);
  assert.match(story, /Clear filters/);
  assert.match(story, /Try again/);
  assert.match(story, /sortOptions=\{\[/);
  assert.match(story, /onToggleFilter=\{toggleFilter\}/);
});

test('keeps responsive hierarchy and reduced-motion coverage explicit', async () => {
  const styles = await read('../stories/Patterns/SearchFiltersAndResults.css');

  assert.match(styles, /var\(--vitrine-page-gutter-wide\)/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /var\(--vitrine-page-gutter-medium\)/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /var\(--vitrine-page-gutter-compact\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
});
