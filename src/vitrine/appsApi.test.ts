import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAppDetail, mergeApp } from './appsApi.ts';

test('loads an app detail by encoded slug and maps its screens', async () => {
  let requested = '';
  const app = await fetchAppDetail('quora mobile', undefined, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({
      app: {
        id: 'quora mobile',
        app: 'Quora',
        cat: 'Social',
        accent: '#b92b27',
        totalScreens: 563,
      },
      screens: [{
        id: 1,
        type: 'Home',
        productArea: 'Feed',
        theme: 'light',
        visibleStates: [],
        platform: 'ios',
        description: null,
        url: '/media/1',
      }],
      nextCursor: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(requested, '/api/apps/quora%20mobile?limit=1');
  assert.equal(app.id, 'quora mobile');
  assert.equal(app.screens.length, 1);
});

test('mergeApp adds a missing deep-linked app without duplicating an existing app', () => {
  const linear = {
    id: 'linear', app: 'Linear', cat: 'Productivity', accent: '#000', totalScreens: 1, screens: [],
  };
  const quora = {
    id: 'quora', app: 'Quora', cat: 'Social', accent: '#b92b27', totalScreens: 1, screens: [],
  };

  assert.deepEqual(mergeApp([linear], quora).map(({ id }) => id), ['linear', 'quora']);
  assert.equal(mergeApp([linear, quora], quora).length, 2);
});
