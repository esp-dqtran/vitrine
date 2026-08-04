import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const story = readFileSync('src/stories/Components/MediaAndEvidence.stories.tsx', 'utf8');
const css = readFileSync('src/stories/Components/MediaAndEvidence.css', 'utf8');

test('grounds the media review in production App Detail components and evidence', () => {
  assert.match(story, /ScreenGridCard/);
  assert.match(story, /MediaGridCard/);
  assert.match(story, /ScreenPreviewDialog/);
  assert.match(story, /api\/preview-media\/\$\{APP_ID\}\/1\?variant=full/);
  assert.match(story, /data-reference-detail="app"/);
});

test('documents gallery, fit, state, preview, and responsive contracts', () => {
  assert.match(story, /Production evidence gallery/);
  assert.match(story, /Fit and hierarchy/);
  assert.match(story, /System states/);
  assert.match(story, /Loading/);
  assert.match(story, /Locked/);
  assert.match(story, /Unavailable/);
  assert.match(story, /Responsive contract/);
});

test('keeps media frames stable and evidence uncropped', () => {
  assert.match(story, /imageFit="contain"/);
  assert.match(story, /preferFullImage/);
  assert.match(story, /preserveNaturalAspectRatio/);
  assert.doesNotMatch(story, /badges=\{\['Home', 'Default'\]\}/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-height: 208px/);
  assert.match(css, /object-fit: cover/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*grid-template-columns: 1fr/);
});

test('uses the approved primary action for locked evidence', () => {
  assert.match(
    story,
    /<Button[\s\S]*label="Unlock more"[\s\S]*variant="primary"[\s\S]*size="md"/,
  );
  assert.doesNotMatch(story, /<Badge label="Unlock more"/);
  assert.match(
    css,
    /\.media-review__locked-overlay > \.astryx-button[\s\S]*font: var\(--vitrine-type-action\) !important/,
  );
});

test('uses design-system tokens and respects reduced motion', () => {
  assert.match(css, /var\(--color-background-body\)/);
  assert.match(css, /var\(--radius-container\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
});
