import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPreviewApps } from './useCatalogPreview.ts';

test('keeps only apps with a servable preview screen and drops null urls', () => {
  const apps = toPreviewApps({
    apps: [
      { id: 'linear', app: 'Linear', accent: '#5e6ad2', cat: 'Productivity', iconUrl: 'i.svg',
        previewScreens: [{ url: '/api/preview-media/linear/1', type: 'Dashboard' }, { url: null, type: 'x' }] },
      { id: 'empty', app: 'Empty', accent: '#000', cat: 'x', iconUrl: null, previewScreens: [{ url: null, type: 'x' }] },
      { id: 'none', app: 'None', accent: '#000', cat: 'x', iconUrl: null },
    ],
  });

  assert.equal(apps.length, 1);
  assert.equal(apps[0].id, 'linear');
  assert.deepEqual(apps[0].screens, [{ url: '/api/preview-media/linear/1', type: 'Dashboard' }]);
});

test('tolerates a missing apps array', () => {
  assert.deepEqual(toPreviewApps({}), []);
});
