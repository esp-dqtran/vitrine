import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FOUNDATION_TOKEN_CONTRACT,
  RESPONSIVE_RANGES,
  UI_FOUNDATION_STANDARD,
} from './uiFoundationStandard.ts';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('publishes the three-range Vitrines responsive contract', async () => {
  const foundation = await read('./uiFoundation.css');

  assert.deepEqual(
    RESPONSIVE_RANGES.map(({ id, range, columns, gutter }) => [id, range, columns, gutter]),
    [
      ['compact', '0–720px', 1, '20px'],
      ['medium', '721–1100px', 2, '24px'],
      ['wide', '1101px and above', 3, '32px'],
    ],
  );
  FOUNDATION_TOKEN_CONTRACT.responsive.forEach((token) => {
    assert.match(foundation, new RegExp(`${token}:\\s*`), `missing responsive token: ${token}`);
  });
  assert.equal(UI_FOUNDATION_STANDARD.responsiveSource, 'Vitrines Apps discovery');
  assert.match(UI_FOUNDATION_STANDARD.responsivePolicy, /Reflow before hiding/);
  assert.match(UI_FOUNDATION_STANDARD.responsivePolicy, /horizontal page overflow/);
});

test('loads the Apps responsive pilot after the visual foundations', async () => {
  const main = await read('./main.tsx');
  const responsiveImport = main.indexOf("import './productResponsive.css'");

  assert.ok(responsiveImport > main.indexOf("import './productMotion.css'"));
  assert.ok(responsiveImport > main.indexOf("import './productSpacing.css'"));
});

test('keeps the responsive pilot scoped to Apps discovery', async () => {
  const styles = await read('./productResponsive.css');

  assert.match(styles, /\.apps-discovery/);
  assert.match(styles, /\.apps-top-nav/);
  assert.match(styles, /\.apps-filterbar/);
  assert.doesNotMatch(styles, /\.sites-discovery/);
  assert.doesNotMatch(styles, /\.flows-discovery/);
  assert.doesNotMatch(styles, /\.flow-workspace/);
  assert.doesNotMatch(styles, /\.project-document/);
  assert.doesNotMatch(styles, /\.excalidraw/);
});

test('defines compact, medium, and wide Apps behavior without page overflow', async () => {
  const styles = await read('./productResponsive.css');

  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /@media \(min-width:\s*721px\) and \(max-width:\s*1100px\)/);
  assert.match(styles, /\.reference-discovery-nav\.apps-top-nav\s*\{[\s\S]*?--reference-nav-height:\s*112px[\s\S]*?--vitrine-responsive-gutter:\s*var\(--vitrine-page-gutter-medium\)/);
  assert.match(styles, /grid-template-rows:\s*64px 48px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(max-width:\s*720px\)/);
  assert.match(styles, /scroll-snap-type:\s*inline proximity/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('documents responsive behavior in Storybook', async () => {
  const story = await read('../stories/Foundations/Responsive.stories.tsx');

  assert.match(story, /FOUNDATION 07 · RESPONSIVE/);
  assert.match(story, /RESPONSIVE_RANGES/);
  assert.match(story, /Three layout ranges/);
  assert.match(story, /Reflow before hiding/);
});
