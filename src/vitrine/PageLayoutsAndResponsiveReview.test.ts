import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const story = readFileSync(
  new URL('../stories/Patterns/PageLayoutsAndResponsive.stories.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../stories/Patterns/PageLayoutsAndResponsive.css', import.meta.url),
  'utf8',
);
const discoveryStyles = readFileSync(
  new URL('./referenceDiscovery.css', import.meta.url),
  'utf8',
);
const responsiveStyles = readFileSync(
  new URL('./productResponsive.css', import.meta.url),
  'utf8',
);

test('grounds discovery in production components and App Detail in the live production route', () => {
  assert.match(story, /ReferenceDiscoveryPageShell/);
  assert.match(story, /ApplicationHeader/);
  assert.match(story, /DiscoveryFilterBar/);
  assert.match(story, /AppCard/);
  assert.match(story, /APP_DETAIL_URL/);
  assert.match(story, /Live production App Detail/);
  assert.match(story, /\/apps\/\$\{APP_ID\}\/screens\?platform=web&version=1/);
  assert.doesNotMatch(story, /layout-review__detail-results/);
});

test('mirrors the production Apps header ownership and account dropdown', () => {
  assert.match(story, /AstryxDropdown/);
  assert.match(story, /ariaLabel="Account menu: admin@gmail\.com"/);
  assert.match(story, /<ApplicationHeader[\s\S]*?<ReferenceDiscoveryPageShell/);
  assert.match(story, /<ReferenceDiscoveryPageShell[\s\S]*?header=\{null\}/);
  assert.doesNotMatch(story, /accountControls=\{<Button label="admin@gmail\.com"/);
});

test('uses the Storybook document scroll to review sticky header and toolbar behavior', () => {
  assert.match(story, /aria-label="Apps Discovery scroll behavior preview"/);
  assert.doesNotMatch(story, /tabIndex=\{0\}/);
  assert.match(styles, /\.layout-review__discovery-frame\s*\{[\s\S]*?overflow:\s*visible;/);
  assert.doesNotMatch(styles, /\.layout-review__discovery-frame\s*\{[\s\S]*?height:\s*500px;/);
  assert.doesNotMatch(styles, /\.layout-review__discovery-frame\s*\{[\s\S]*?overflow-y:\s*auto;/);
});

test('reviews the complete page-layout contract', () => {
  assert.match(story, /Layout contract/);
  assert.match(story, /Apps Discovery pilot/);
  assert.match(story, /App Detail pilot/);
  assert.match(story, /System state placement/);
});

test('defines wide, medium, and compact gutters with three, two, and one-column reflow', () => {
  assert.match(styles, /var\(--vitrine-page-gutter-wide\)/);
  assert.match(styles, /var\(--vitrine-page-gutter-medium\)/);
  assert.match(styles, /var\(--vitrine-page-gutter-compact\)/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /repeat\(2, minmax\(0, 1fr\)\)/);
});

test('keeps state placement stable and respects reduced motion', () => {
  assert.match(styles, /min-height: 280px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(story, /No apps match these filters/);
  assert.match(story, /Apps could not be loaded/);
});

test('keeps medium discovery filters and sort controls on one aligned row', () => {
  for (const productStyles of [discoveryStyles, responsiveStyles]) {
    assert.match(productStyles, /\.apps-filterbar\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?flex-wrap:\s*nowrap;/);
    assert.match(productStyles, /\.apps-filterbar__controls\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow-x:\s*auto;/);
  }
});
