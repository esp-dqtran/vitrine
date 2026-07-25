import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from './types.ts';
import { filterAndSortApps } from './appsDiscovery.ts';

const makeApp = (overrides: Partial<App> = {}): App => ({
  id: 'base',
  app: 'Base',
  cat: 'Business',
  accent: '#777777',
  totalScreens: 1,
  platforms: ['web'],
  analyzedScreens: 1,
  lastCapturedAt: '2026-07-20T00:00:00.000Z',
  iconUrl: null,
  description: 'Business workspace',
  previewVideoUrl: null,
  screens: [{
    id: 1,
    type: 'Dashboard',
    productArea: 'Workspace',
    theme: 'dark',
    visibleStates: ['Setting Up'],
    platform: 'web',
    description: 'Navigation Menu and Card',
    url: '/base.png',
    componentNames: ['Navigation Menu', 'Card'],
    layoutPatterns: ['Dashboard'],
    capturedAt: '2026-07-20T00:00:00.000Z',
    stateContext: 'Setting Up',
    confidence: 0.8,
  }],
  ...overrides,
});

test('filters Apps across Mobbin taxonomy fields and platform', () => {
  const apps = [
    makeApp({ id: 'web', app: 'Web App' }),
    makeApp({
      id: 'ios',
      app: 'iOS App',
      cat: 'Health & Fitness',
      platforms: ['ios'],
      screens: [{ ...makeApp().screens[0]!, id: 2, platform: 'ios', type: 'Signup' }],
    }),
  ];

  assert.deepEqual(
    filterAndSortApps(apps, {
      query: '',
      facet: { group: 'screens', value: 'Signup' },
      platform: 'ios',
      sort: 'latest',
    }).map((app) => app.id),
    ['ios'],
  );
  assert.deepEqual(
    filterAndSortApps(apps, {
      query: '',
      facet: { group: 'elements', value: 'Navigation Menu' },
      platform: 'web',
      sort: 'latest',
    }).map((app) => app.id),
    ['web'],
  );
});

test('orders Apps from real capture, coverage, and animation fields', () => {
  const apps = [
    makeApp({ id: 'older', lastCapturedAt: '2026-07-01T00:00:00.000Z', totalScreens: 8 }),
    makeApp({ id: 'newer', lastCapturedAt: '2026-07-24T00:00:00.000Z', totalScreens: 2 }),
    makeApp({ id: 'motion', previewVideoUrl: '/motion.mp4', totalScreens: 4 }),
  ];
  const options = { query: '', facet: null, platform: 'web' as const };

  assert.equal(filterAndSortApps(apps, { ...options, sort: 'latest' })[0]?.id, 'newer');
  assert.equal(filterAndSortApps(apps, { ...options, sort: 'popular' })[0]?.id, 'older');
  assert.equal(filterAndSortApps(apps, { ...options, sort: 'animations' })[0]?.id, 'motion');
});
