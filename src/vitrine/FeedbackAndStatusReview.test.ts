import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const story = readFileSync('src/stories/Components/FeedbackAndStatus.stories.tsx', 'utf8');
const css = readFileSync('src/stories/Components/FeedbackAndStatus.css', 'utf8');

test('builds the Feedback and Status visual review from production components', () => {
  assert.match(story, /title: 'Components\/Feedback and Status\/Visual review'/);
  assert.match(story, /<Banner/);
  assert.match(story, /<Badge/);
  assert.match(story, /<ProgressBannerView/);
  assert.match(story, /screen-action-toast feedback-review__application-toast/);
  assert.match(story, /<EmptyState/);
  assert.match(story, /<AlertDialog/);
});

test('uses the Apps import and analysis lifecycle as the pilot', () => {
  assert.match(story, /Aboard import started/);
  assert.match(story, /total: 624/);
  assert.match(story, /Preparing screen evidence/);
  assert.match(story, /Queued/);
  assert.match(story, /In progress/);
  assert.match(story, /Complete/);
  assert.match(story, /Needs attention/);
  assert.match(story, /Cancelled/);
});

test('covers persistent transient empty progress and irreversible feedback', () => {
  assert.match(story, /title="Semantic feedback"/);
  assert.match(story, /title="Lifecycle and progress"/);
  assert.match(story, /title="Transient feedback"/);
  assert.match(story, /title="Empty and irreversible states"/);
  assert.match(story, /isInline/);
  assert.match(story, /feedback-review__application-toast--error/);
});

test('uses the approved button and feedback sizing contract', () => {
  assert.match(story, /label="View progress" variant="primary" size="md"/);
  assert.match(story, /label="Try again" variant="destructive" size="md"/);
  assert.match(story, /label="Clear filters" variant="primary" size="md"/);
  assert.match(css, /feedback-review__progress-card \.astryx-progressbar-track[\s\S]*height: 20px[\s\S]*min-height: 20px/);
  assert.match(css, /feedback-review__banner-grid[\s\S]*button\.astryx-button\.primary,[\s\S]*button\.astryx-button\.destructive[\s\S]*height: 44px !important[\s\S]*min-height: 44px !important[\s\S]*border-radius: var\(--radius-full\)/);
  assert.match(css, /feedback-review__application-toast--error[\s\S]*background: var\(--vitrine-color-status-error\)/);
  assert.match(css, /feedback-review__banner-grid > :first-child \.astryx-banner[\s\S]*background: var\(--vitrine-color-action-primary\)/);
  assert.match(css, /vitrine-icon-size-emphasis/);
  assert.match(css, /feedback-review__dialog-card \.astryx-button\.ghost[\s\S]*background: var\(--vitrine-color-action-primary\)/);
});

test('uses foundation tokens and responsive review composition', () => {
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
  assert.match(css, /var\(--color-background-body\)/);
  assert.match(css, /var\(--radius-container\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
