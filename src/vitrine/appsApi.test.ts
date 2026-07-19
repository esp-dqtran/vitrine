import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAppFlows, fetchAppMetadata, fetchAppScreens, fetchAppUiElements } from './appsApi.ts';

const metadata = {
  id: 'quora', app: 'Quora', cat: 'Social', accent: '#b92b27', totalScreens: 563,
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
  await fetchAppScreens('quora mobile', input, request);
  await fetchAppUiElements('quora mobile', { ...input, cursor: 'next page' }, request);
  await fetchAppFlows('quora mobile', { platform: 'ios', version: 3 }, request);

  assert.deepEqual(requested, [
    '/api/apps/quora%20mobile/screens?platform=ios&version=3&limit=48',
    '/api/apps/quora%20mobile/ui-elements?platform=ios&version=3&cursor=next+page&limit=48',
    '/api/apps/quora%20mobile/flows?platform=ios&version=3',
  ]);
});

test('reports a metadata API failure without converting it to empty data', async () => {
  await assert.rejects(
    () => fetchAppMetadata('missing', undefined, async () => new Response(null, { status: 404 })),
    /\/api\/apps\/missing returned 404/,
  );
});
