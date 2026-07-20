import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoutePath, routeToPath } from './router.ts';
import { getSiteVersion, listSites, submitSiteImport } from './sitesApi.ts';

const approvedUrl = 'https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview';

test('maps list and positive Site version routes', () => {
  assert.deepEqual(parseRoutePath('/sites'), { name: 'sites' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2'), { name: 'site-version', siteId: 1, versionId: 2 });
  assert.deepEqual(parseRoutePath('/sites/0/versions/2'), { name: 'landing' });
  assert.equal(routeToPath({ name: 'sites' }), '/sites');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2 }), '/sites/1/versions/2');
});

test('submits only an import-site URL and distinguishes queued from existing', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests: Array<{ url: string; method?: string; body?: string }> = [];
  let existing = false;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method, body: init?.body as string | undefined });
    return existing
      ? Response.json({ existing: true, siteId: 7, versionId: 9 }, { status: 200 })
      : Response.json({ id: 42 }, { status: 201 });
  };

  assert.deepEqual(await submitSiteImport(approvedUrl), { existing: false, id: 42 });
  existing = true;
  assert.deepEqual(await submitSiteImport(approvedUrl), { existing: true, siteId: 7, versionId: 9 });
  assert.deepEqual(requests, [
    { url: '/api/jobs', method: 'POST', body: JSON.stringify({ type: 'import-site', url: approvedUrl }) },
    { url: '/api/jobs', method: 'POST', body: JSON.stringify({ type: 'import-site', url: approvedUrl }) },
  ]);
});

test('loads Sites only from dedicated list and detail endpoints', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url === '/api/sites') return Response.json([{
      siteId: 1, versionId: 2, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/',
      label: 'Jul 2026', isLatest: true, pageCount: 16, sectionCount: 46,
      previewUrl: '/api/sites/1/versions/2/media/preview', updatedAt: '2026-07-20T00:00:00.000Z',
      previews: [
        { id: 10, title: 'Home', position: 0, url: '/api/sites/1/versions/2/pages/10/media' },
        { id: 11, title: 'Pricing', position: 1, url: '/api/sites/1/versions/2/pages/11/media' },
      ],
    }]);
    return Response.json({
      siteId: 1, versionId: 2, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/',
      canonicalUrl: approvedUrl, label: 'Jul 2026', isLatest: true,
      previewUrl: '/api/sites/1/versions/2/media/preview', pages: [],
    });
  };

  const sites = await listSites();
  const detail = await getSiteVersion(1, 2);
  assert.equal(sites[0].id, 1);
  assert.deepEqual(sites[0].previews, [
    { id: 10, title: 'Home', position: 0, url: '/api/sites/1/versions/2/pages/10/media' },
    { id: 11, title: 'Pricing', position: 1, url: '/api/sites/1/versions/2/pages/11/media' },
  ]);
  assert.deepEqual(detail.site, { id: 1, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/' });
  assert.deepEqual(urls, ['/api/sites', '/api/sites/1/versions/2']);
  assert.ok(urls.every((url) => url !== '/api/jobs'));
});

test('rejects malformed successful Sites responses', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ id: 0 }, { status: 201 });
  await assert.rejects(() => submitSiteImport(approvedUrl), /invalid response/i);
});
