import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPreviewApps } from './useCatalogPreview.ts';

test('keeps only apps with a servable preview screen and drops null urls', () => {
  const apps = toPreviewApps({
    items: [
      { id: 'linear', app: 'Linear', accent: '#5e6ad2', categories: [{ id: 7, name: 'Productivity', slug: 'productivity' }], iconUrl: 'i.svg',
        previewScreens: [{ url: '/api/preview-media/linear/1', type: 'Dashboard' }, { url: null, type: 'x' }] },
      { id: 'empty', app: 'Empty', accent: '#000', categories: [], iconUrl: null, previewScreens: [{ url: null, type: 'x' }] },
      { id: 'none', app: 'None', accent: '#000', categories: [], iconUrl: null },
    ],
  });

  assert.equal(apps.length, 1);
  assert.equal(apps[0].id, 'linear');
  assert.deepEqual(apps[0].categories, [{ id: 7, name: 'Productivity', slug: 'productivity' }]);
  assert.deepEqual(apps[0].screens, [{
    url: '/api/preview-media/linear/1',
    type: 'Dashboard',
    platform: 'web',
    thumbnailUrl: '/api/preview-media/linear/1',
  }]);
});

test('carries the framing metadata the landing needs for each shot', () => {
  const [app] = toPreviewApps({
    items: [{
      id: 'tide', app: 'Tide Guide', accent: '#f0763b', categories: [], iconUrl: 'i.png',
      platforms: ['ios', 'ios', 'web'], totalScreens: 154,
      previewScreens: [
        { url: '/full/1', type: 'Home', thumbnailUrl: '/thumb/1' },
        { url: '/full/2', type: 'Settings', platform: 'web' },
      ],
    }],
  });

  assert.deepEqual(app.platforms, ['ios', 'web']);
  assert.equal(app.totalScreens, 154);
  // No per-screen platform → inherit the app's first platform, not a blind default.
  assert.equal(app.screens[0].platform, 'ios');
  assert.equal(app.screens[0].thumbnailUrl, '/thumb/1');
  assert.equal(app.screens[1].platform, 'web');
  assert.equal(app.screens[1].thumbnailUrl, '/full/2');
});

test('tolerates a missing items array', () => {
  assert.deepEqual(toPreviewApps({}), []);
});

test('does not depend on the retired apps compatibility alias', () => {
  assert.deepEqual(toPreviewApps({
    apps: [{
      id: 'legacy',
      app: 'Legacy',
      accent: '#000',
      categories: [],
      iconUrl: null,
      previewScreens: [{ url: '/legacy', type: 'Legacy' }],
    }],
  } as never), []);
});
