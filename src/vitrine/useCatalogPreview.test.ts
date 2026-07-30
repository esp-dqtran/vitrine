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
  assert.deepEqual(apps[0].screens, [{ url: '/api/preview-media/linear/1', type: 'Dashboard' }]);
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
