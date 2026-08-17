import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsEvent,
  analyticsPathname,
  paletteAnalyticsProperties,
} from './analyticsEvents.ts';
import { getPostHogConfig, shouldTrackAnalyticsForHost } from './analytics.ts';

test('keeps Colors analytics properties low-cardinality and free of palette copy', () => {
  assert.deepEqual(
    paletteAnalyticsProperties({ id: 'quiet-authority', kind: 'solid' }),
    { palette_id: 'quiet-authority', palette_type: 'solid' },
  );
  assert.equal(analyticsEvent.colorPostImageCopied, 'color post image copied');
});

test('does not include query values in page analytics', () => {
  assert.equal(
    analyticsPathname('https://vitrines.ai/colors?query=private-search'),
    '/colors',
  );
});

test('requires explicit enablement and uses the regional ingestion host by default', () => {
  assert.equal(
    getPostHogConfig({ VITE_POSTHOG_ENABLED: 'false', VITE_POSTHOG_KEY: 'phc_test' }),
    null,
  );
  assert.deepEqual(
    getPostHogConfig({ VITE_POSTHOG_ENABLED: 'true', VITE_POSTHOG_KEY: 'phc_test' }),
    { projectToken: 'phc_test', apiHost: 'https://us.i.posthog.com' },
  );
});

test('does not send development traffic to PostHog', () => {
  assert.equal(shouldTrackAnalyticsForHost('localhost'), false);
  assert.equal(shouldTrackAnalyticsForHost('127.0.0.1'), false);
  assert.equal(shouldTrackAnalyticsForHost('::1'), false);
  assert.equal(shouldTrackAnalyticsForHost('vitrines.ai'), true);
});
