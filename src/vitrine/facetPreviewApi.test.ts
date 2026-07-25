import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearFacetPreviewCache,
  fetchFacetPreview,
} from './facetPreviewApi.ts';

test('loads and caches a public taxonomy preview by platform, group, and value', async () => {
  clearFacetPreviewCache();
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      kind: 'component',
      app: 'Linear',
      label: 'Dialog',
      iconUrl: '/api/catalog/icon/linear',
      media: ['/api/catalog/facet-media/linear/elements/Dialog/web/1'],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const input = { group: 'elements', value: 'Dialog', platform: 'web' } as const;
  const [first, second] = await Promise.all([
    fetchFacetPreview(input, fetcher),
    fetchFacetPreview(input, fetcher),
  ]);

  assert.deepEqual(first, {
    kind: 'component',
    app: 'Linear',
    label: 'Dialog',
    iconUrl: '/api/catalog/icon/linear',
    media: ['/api/catalog/facet-media/linear/elements/Dialog/web/1'],
  });
  assert.equal(second, first);
  assert.deepEqual(calls, ['/api/catalog/facet-preview?group=elements&value=Dialog&platform=web']);
});

test('returns null for missing or malformed taxonomy previews', async () => {
  clearFacetPreviewCache();
  assert.equal(
    await fetchFacetPreview(
      { group: 'screens', value: 'Signup', platform: 'ios' },
      async () => new Response('', { status: 404 }),
    ),
    null,
  );

  clearFacetPreviewCache();
  assert.equal(
    await fetchFacetPreview(
      { group: 'flows', value: 'Setting Up', platform: 'web' },
      async () => new Response(JSON.stringify({
        kind: 'flow',
        app: 'Linear',
        label: 'Setting Up',
        iconUrl: null,
        media: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ),
    null,
  );
});
