import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAppFlows,
  fetchAppMetadata,
  fetchAppScreens,
  fetchAppUiElements,
  fetchAppUiElementSummary,
  replaceAppCardPreviewScreens,
} from './appsApi.ts';

const metadata = {
  id: 'quora', app: 'Quora', categories: [{ id: 1, name: 'Social', slug: 'social' }], accent: '#b92b27', totalScreens: 563,
  totalUiElements: 80, totalFlows: 12, platforms: ['ios'],
};
const section = {
  screens: [], nextCursor: null, platform: 'ios',
  version: { id: 7, app: 'quora', platform: 'ios', version_number: 3, status: 'published' },
};

test('loads app metadata without section query parameters', async () => {
  let requested = '';
  const result = await fetchAppMetadata('quora mobile', undefined, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ app: metadata }), { status: 200 });
  });
  assert.equal(requested, '/api/apps/quora%20mobile');
  assert.equal(result.totalScreens, 563);
});

test('loads each app section from its dedicated endpoint', async () => {
  const requested: string[] = [];
  const request = async (input: string | URL | Request) => {
    requested.push(String(input));
    const body = String(input).endsWith('/flows?platform=ios&version=3')
      ? { flows: [], platform: 'ios', version: section.version }
      : section;
    return new Response(JSON.stringify(body), { status: 200 });
  };

  const input = { platform: 'ios' as const, version: 3, limit: 48 };
  await fetchAppScreens('quora mobile', { ...input, screenTypes: ['Login', 'Dashboard'] }, request);
  await fetchAppUiElements('quora mobile', { ...input, cursor: 'next page' }, request);
  await fetchAppUiElementSummary('quora mobile', { ...input, limit: 12 }, request);
  await fetchAppFlows('quora mobile', { platform: 'ios', version: 3 }, request);

  assert.deepEqual(requested, [
    '/api/apps/quora%20mobile/screens?platform=ios&version=3&type=Login&type=Dashboard&limit=48',
    '/api/apps/quora%20mobile/ui-elements?platform=ios&version=3&cursor=next+page&limit=48',
    '/api/apps/quora%20mobile/ui-element-summary?platform=ios&version=3&limit=12',
    '/api/apps/quora%20mobile/flows?platform=ios&version=3',
  ]);
});

test('reports a metadata API failure without converting it to empty data', async () => {
  await assert.rejects(
    () => fetchAppMetadata('missing', undefined, async () => new Response(null, { status: 404 })),
    /\/api\/apps\/missing returned 404/,
  );
});

test('replaces the ordered AppCard preview selection', async () => {
  let requested = '';
  let init: RequestInit | undefined;
  const result = await replaceAppCardPreviewScreens('quora mobile', {
    platform: 'ios', version: 3, imageIds: [41, 19, 28],
  }, async (input, options) => {
    requested = String(input);
    init = options;
    return new Response(JSON.stringify({ versionId: 7, imageIds: [41, 19, 28] }), { status: 200 });
  });
  assert.equal(requested, '/api/apps/quora%20mobile/preview-screens');
  assert.equal(init?.method, 'PUT');
  assert.equal(init?.body, JSON.stringify({ platform: 'ios', version: 3, imageIds: [41, 19, 28] }));
  assert.deepEqual(result.imageIds, [41, 19, 28]);
});
