import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('publishes a production-grounded interaction and motion visual review', async () => {
  const story = await read('../stories/Patterns/InteractionPatternsAndMotion.stories.tsx');

  assert.match(story, /Patterns\/Interaction Patterns and Motion/);
  assert.match(story, /Interaction Patterns &amp; Motion/);
  assert.match(story, /AppCard/);
  assert.match(story, /productDataDisplay\.css/);
  assert.match(story, /interaction-review__app-card data-display-card/);
  assert.match(story, /DiscoveryFilterMenu/);
  assert.match(story, /components\/AstryxDropdown\.css/);
  assert.match(story, /Shared Apps filter panel/);
  assert.match(story, /open=\{popoverOpen\}/);
  assert.doesNotMatch(story, /Sort review/);
  assert.match(story, /120ms/);
  assert.match(story, /180ms/);
  assert.match(story, /240ms/);
  assert.match(story, /Preview reduced motion/);
  assert.match(story, /APPS_DISCOVERY_URL/);
  assert.doesNotMatch(story, /sticky_chrome_review/);
  assert.match(story, /Apps,[\s\S]*Sites, and Flows visible/);
  assert.match(story, /second sticky header line/);
  assert.match(story, /Live production Apps Discovery sticky chrome/);
  assert.doesNotMatch(story, /interaction-review__taxonomy-preview/);
  assert.doesNotMatch(story, /interaction-review__sticky-toolbar/);
});

test('promotes the approved sticky chrome behavior to the production Apps route', async () => {
  const app = await read('./App.tsx');
  const styles = await read('./referenceDiscovery.css');

  assert.match(app, /const stickyChromeEnabled = route\.name === "apps"/);
  assert.match(app, /data-sticky-chrome=/);
  assert.doesNotMatch(app, /sticky_chrome_review/);
  assert.match(styles, /\[data-sticky-chrome='merged'\] \.apps-filterbar/);
  assert.doesNotMatch(styles, /data-sticky-chrome-review/);
});

test('covers selection overlays, loading footprint, sticky chrome, and reduced motion', async () => {
  const styles = await read('../stories/Patterns/InteractionPatternsAndMotion.css');

  assert.doesNotMatch(styles, /interaction-review__selection-overlay/);
  assert.match(styles, /background:\s*var\(--color-background-body\)/);
  assert.match(styles, /interaction-review__live-apps/);
  assert.match(styles, /animation:\s*interaction-review-shimmer/);
  assert.match(styles, /opacity var\(--vitrine-transition-slow\)/);
  assert.match(styles, /data-reduced-motion='true'/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /animation-duration:\s*1ms\s*!important/);
});
