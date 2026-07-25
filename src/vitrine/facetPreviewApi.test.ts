import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearFacetPreviewCache,
  fetchRandomFacetPreview,
  type FacetPreview,
} from './facetPreviewApi.ts';

const componentPreview = (app: string): FacetPreview => ({
  kind: 'component',
  app,
  label: 'Dialog',
  iconUrl: null,
  media: [`/api/catalog/facet-media/${app.toLowerCase()}/elements/Dialog/web/1`],
});

const screenPreview = (app: string): FacetPreview => ({
  kind: 'screen',
  app,
  label: 'Signup',
  iconUrl: null,
  media: [`/api/catalog/facet-media/${app.toLowerCase()}/screens/Signup/web/1`],
});

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('loads one public taxonomy pool and deduplicates concurrent requests', async () => {
  clearFacetPreviewCache();
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    calls.push(String(input));
    return jsonResponse({
      previews: [componentPreview('Linear'), componentPreview('Notion')],
    });
  };
  const input = { group: 'elements', value: 'Dialog', platform: 'web' } as const;

  const [first, second] = await Promise.all([
    fetchRandomFacetPreview(input, fetcher, () => 0),
    fetchRandomFacetPreview(input, fetcher, () => 0),
  ]);

  assert.equal(first?.app, 'Linear');
  assert.equal(second?.app, 'Notion');
  assert.deepEqual(calls, ['/api/catalog/facet-preview?group=elements&value=Dialog&platform=web']);
});

test('selects again on every hover without immediately repeating an app', async () => {
  clearFacetPreviewCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return jsonResponse({
      previews: [
        componentPreview('Linear'),
        componentPreview('Notion'),
        componentPreview('Slack'),
      ],
    });
  };
  const input = { group: 'elements', value: 'Dialog', platform: 'web' } as const;

  const first = await fetchRandomFacetPreview(input, fetcher, () => 0);
  const second = await fetchRandomFacetPreview(input, fetcher, () => 0);

  assert.equal(first?.app, 'Linear');
  assert.equal(second?.app, 'Notion');
  assert.equal(calls, 1);
});

test('keeps a single-candidate pool stable', async () => {
  clearFacetPreviewCache();
  const input = { group: 'screens', value: 'Signup', platform: 'web' } as const;
  const fetcher = async () => jsonResponse({ previews: [screenPreview('Linear')] });

  assert.equal((await fetchRandomFacetPreview(input, fetcher, () => 0))?.app, 'Linear');
  assert.equal((await fetchRandomFacetPreview(input, fetcher, () => 0.9))?.app, 'Linear');
});

test('returns null for missing or malformed taxonomy preview pools', async () => {
  clearFacetPreviewCache();
  assert.equal(
    await fetchRandomFacetPreview(
      { group: 'screens', value: 'Signup', platform: 'ios' },
      async () => new Response('', { status: 404 }),
    ),
    null,
  );

  clearFacetPreviewCache();
  assert.equal(
    await fetchRandomFacetPreview(
      { group: 'flows', value: 'Setting Up', platform: 'web' },
      async () => jsonResponse({
        previews: [{
          kind: 'flow',
          app: 'Linear',
          label: 'Setting Up',
          iconUrl: null,
          media: [],
        }],
      }),
    ),
    null,
  );
});

test('does not cache a failed taxonomy pool request', async () => {
  clearFacetPreviewCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) return new Response('', { status: 503 });
    return jsonResponse({ previews: [screenPreview('Linear')] });
  };
  const input = { group: 'screens', value: 'Signup', platform: 'web' } as const;

  await assert.rejects(
    fetchRandomFacetPreview(input, fetcher),
    /Facet preview request failed: 503/,
  );
  assert.equal((await fetchRandomFacetPreview(input, fetcher))?.app, 'Linear');
  assert.equal(calls, 2);
});
