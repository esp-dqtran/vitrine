import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicAppPreview, trackAppFunnelEvent } from './publicAppPreviewApi.ts';

test('loads the bounded public app preview with an encoded app slug', async () => {
  let endpoint = '';
  const preview = await loadPublicAppPreview('quora mobile', undefined, async (input) => {
    endpoint = String(input);
    return Response.json({
      app: { id: 'quora mobile', app: 'Quora', totalScreens: 10, totalUiElements: 2, totalFlows: 1 },
      previewScreens: [],
      previewUiElements: [],
      previewFlows: [],
    });
  });
  assert.equal(endpoint, '/api/apps/quora%20mobile/preview?v=2');
  assert.equal(preview.app.app, 'Quora');
});

test('sends only the selected app funnel action', async () => {
  let body = '';
  await trackAppFunnelEvent('linear', 'paywall_viewed', async (_input, init) => {
    body = String(init?.body);
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(JSON.parse(body), { action: 'paywall_viewed' });
});
