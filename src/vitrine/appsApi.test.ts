import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAppDetailPage } from './appsApi.ts';

const screen = {
  id: 1,
  type: 'Home',
  productArea: 'Feed',
  theme: 'light' as const,
  visibleStates: [],
  platform: 'ios',
  description: null,
  url: '/media/1',
};

test('loads the first 48 detail screens with version and cursor metadata', async () => {
  let requested = '';
  const detail = await fetchAppDetailPage('quora mobile', undefined, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({
      app: {
        id: 'quora mobile',
        app: 'Quora',
        cat: 'Social',
        accent: '#b92b27',
        totalScreens: 563,
      },
      screens: [screen],
      nextCursor: 'next-screen',
      version: {
        id: 7,
        app: 'quora mobile',
        platform: 'ios',
        version_number: 3,
        status: 'published',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(requested, '/api/apps/quora%20mobile?limit=48');
  assert.equal(detail.app.id, 'quora mobile');
  assert.equal(detail.app.screens.length, 1);
  assert.equal(detail.nextCursor, 'next-screen');
  assert.equal(detail.version?.version_number, 3);
});

test('reports a detail API failure without converting it to empty data', async () => {
  await assert.rejects(
    () => fetchAppDetailPage('missing', undefined, async () => new Response(null, { status: 404 })),
    /\/api\/apps\/missing returned 404/,
  );
});
