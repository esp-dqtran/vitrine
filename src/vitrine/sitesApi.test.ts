import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoutePath, routeToPath } from './router.ts';
import {
  getSiteVersion,
  getSiteVersionBySlug,
  invalidateSitesPageCache,
  listSitesPage,
} from './sitesApi.ts';

const approvedUrl = 'https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview';

test('maps list and positive Site version routes', () => {
  assert.deepEqual(parseRoutePath('/sites'), { name: 'sites' });
  assert.deepEqual(parseRoutePath('/sites/v-7'), { name: 'site-version', siteSlug: 'v-7' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2'), { name: 'site-version', siteId: 1, versionId: 2 });
  assert.deepEqual(parseRoutePath('/sites/0/versions/2'), {
    name: 'not-found',
    pathname: '/sites/0/versions/2',
  });
  assert.equal(routeToPath({ name: 'sites' }), '/sites');
  assert.equal(routeToPath({ name: 'site-version', siteSlug: 'v-7' }), '/sites/v-7');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2 }), '/sites/1/versions/2');
});

test('loads Site details only from dedicated detail endpoints', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    return Response.json({
      siteId: 1, versionId: 2, name: 'V7', slug: 'v-7', routeSlug: 'v7', sourceUrl: 'https://v7labs.com/',
      canonicalUrl: approvedUrl, label: 'Jul 2026', isLatest: true,
      previewMediaKind: 'image',
      previewUrl: '/api/sites/1/versions/2/media/preview',
      analysisStatus: 'ready',
      analysisModel: 'fixture-model',
      mobilePageUrl: '/api/sites/1/versions/2/media/mobile',
      analysis: {
        schemaVersion: 1,
        status: 'ready',
        evidence: [{ id: 'TECH-1', kind: 'runtime', value: 'GSAP 3.15.0' }],
        structure: [{ id: 'STRUCTURE-1', label: 'Sticky hero' }],
        visualTokens: [],
        motion: [{
          id: 'MOTION-1',
          targetEvidenceId: 'STRUCTURE-1',
          type: 'scroll-linked',
          trigger: 'scroll-progress',
          properties: ['transform'],
          states: [],
          viewports: ['desktop'],
          evidenceIds: ['TECH-1'],
          confidence: 0.9,
        }],
        technology: [{
          id: 'TECHNOLOGY-1',
          name: 'GSAP',
          version: '3.15.0',
          category: 'animation',
          state: 'observed-in-use',
          evidenceIds: ['TECH-1'],
          confidence: 1,
        }],
        responsive: [],
        synthesis: {
          purpose: 'Marketing platform',
          category: 'Website builder',
          structure: ['Sticky hero'],
          rendering: ['Webflow DOM runtime'],
          motion: ['Scroll-linked hero'],
          technology: ['GSAP drives visible motion'],
          responsive: ['Mobile disables the hero ScrollTrigger'],
          reconstructionPriorities: ['Rebuild sticky hero first'],
          unknowns: [],
          claims: [],
        },
        warnings: [],
      },
      versions: [
        { id: 2, label: 'Jul 2026', isLatest: true, updatedAt: '2026-07-20T00:00:00.000Z' },
        { id: 1, label: 'Nov 2025', isLatest: false, updatedAt: '2025-11-20T00:00:00.000Z' },
      ],
      pages: [{
        id: 10,
        sourceId: 'page-1',
        title: 'Home',
        url: 'https://v7labs.com/',
        position: 0,
        fullPageImageUrl: '/api/sites/1/versions/2/pages/10/media',
        sections: [{
          id: 12,
          sourceId: 'section-1',
          position: 0,
          mediaKind: 'image',
          mediaUrl: '/api/sites/1/versions/2/sections/12/media',
          cropTop: 0,
          cropBottom: 800,
          ocrBoxes: [],
          sourceMetadata: { patterns: ['Hero Section', 'Features'] },
        }],
      }],
    });
  };

  const detail = await getSiteVersion(1, 2);
  const namedDetail = await getSiteVersionBySlug('v7');
  const selectedNamedDetail = await getSiteVersionBySlug('v7', 2);
  const legacyNamedDetail = await getSiteVersionBySlug('v7-2');
  assert.deepEqual(detail.site, { id: 1, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/' });
  assert.equal(detail.version.previewMediaKind, 'image');
  assert.deepEqual(detail.versionOptions.map((version) => version.label), ['Jul 2026', 'Nov 2025']);
  assert.deepEqual(detail.pages[0].sections[0].patterns, ['Hero Section', 'Features']);
  assert.equal(detail.analysisStatus, 'ready');
  assert.equal(detail.analysis?.technology[0]?.name, 'GSAP');
  assert.equal(detail.mobilePageUrl, '/api/sites/1/versions/2/media/mobile');
  assert.equal(namedDetail.site.name, 'V7');
  assert.equal(selectedNamedDetail.version.id, 2);
  assert.equal(legacyNamedDetail.routeSlug, 'v7');
  assert.deepEqual(urls, [
    '/api/sites/1/versions/2',
    '/api/sites/v7',
    '/api/sites/v7?version=2',
    '/api/sites/v7-2',
  ]);
  assert.ok(urls.every((url) => url !== '/api/jobs'));
});

test('requests a bounded Site page for related detail references', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return Response.json({
      items: [{
        siteId: 1, versionId: 2, name: 'V7', slug: 'v-7', routeSlug: 'v7', sourceUrl: 'https://v7labs.com/',
        categories: [], styles: [], popularity: 0,
        label: 'Jul 2026', isLatest: true, pageCount: 16, sectionCount: 46,
        previewMediaKind: 'image',
        previewUrl: '/api/sites/1/versions/2/media/preview', updatedAt: '2026-07-20T00:00:00.000Z',
        previews: [],
      }],
      nextCursor: 'next',
      totalCount: 274,
      facets: [],
    });
  };

  const page = await listSitesPage(4, 0);
  assert.equal(page.sites[0]?.id, 1);
  assert.equal(page.nextOffset, 4);
  assert.equal(page.total, 274);
  assert.deepEqual(urls, ['/api/sites?platform=web&sort=latest&facets=summary&limit=4']);
});

test('requests one canonical cursor Site page from discovery state', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json({
      items: [{
        siteId: 1, versionId: 2, name: 'Linear', slug: 'linear', routeSlug: 'linear',
        sourceUrl: 'https://linear.app/', description: 'Plan products', logoUrl: null,
        categories: ['Business'], styles: ['Minimal'], popularity: 42,
        label: 'Jul 2026', isLatest: true, pageCount: 8, sectionCount: 20,
        previewMediaKind: 'image',
        previewUrl: '/api/sites/1/versions/2/catalog-media/preview',
        updatedAt: '2026-07-29T03:00:00.000Z',
        previews: [],
      }],
      nextCursor: 'next',
      totalCount: 37,
      facets: [{ group: 'sections', value: 'Pricing', count: 8, section: 'Sections' }],
    });
  };

  const page = await listSitesPage({
    platform: 'web',
    sort: 'popular',
    query: ' linear ',
    filters: [
      { group: 'categories', value: 'Business' },
      { group: 'categories', value: 'Finance' },
      { group: 'sections', value: 'Pricing' },
    ],
  }, 'opaque', { limit: 12 });

  assert.equal(page.items[0]?.name, 'Linear');
  assert.equal(page.nextCursor, 'next');
  assert.equal(page.totalCount, 37);
  assert.deepEqual(page.facets, [
    { group: 'sections', value: 'Pricing', count: 8, section: 'Sections' },
  ]);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.url,
    '/api/sites/search?platform=web&sort=popular&facets=summary&query=linear'
      + '&filter=categories.Business&filter=categories.Finance'
      + '&filter=sections.Pricing&cursor=opaque&limit=12',
  );
});

test('reuses a successful Site page across catalog remounts until invalidated', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
    invalidateSitesPageCache();
  });
  invalidateSitesPageCache();
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({
      items: [],
      nextCursor: null,
      totalCount: 0,
      facets: [],
    });
  };
  const state = {
    platform: 'web' as const,
    sort: 'latest' as const,
    query: '',
    filters: [],
  };

  await listSitesPage(state);
  await listSitesPage(state);
  assert.equal(requests, 1);

  invalidateSitesPageCache();
  await listSitesPage(state);
  assert.equal(requests, 2);
});

test('never caches malformed canonical Site responses and exposes no-store retry', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let malformed = true;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (malformed) {
      malformed = false;
      return Response.json({
        items: [{
          siteId: 1,
          versionId: 2,
          name: 'Broken',
          isLatest: 'yes',
        }],
        nextCursor: null,
        totalCount: 1,
        facets: [],
      });
    }
    return Response.json({
      items: [],
      nextCursor: null,
      totalCount: 0,
      facets: [],
    });
  };
  const state = {
    platform: 'web' as const,
    sort: 'latest' as const,
    query: '',
    filters: [],
  };

  await assert.rejects(() => listSitesPage(state), /Sites returned an invalid response/);
  const uncached = await listSitesPage(state);
  assert.deepEqual(uncached.items, []);
  assert.equal(requests.length, 2);
  const retry = await listSitesPage(state, undefined, { noStore: true });
  assert.deepEqual(retry.items, []);
  assert.equal(requests[2]?.url, '/api/sites?platform=web&sort=latest&facets=summary&limit=24&refresh=1');
  assert.equal(requests[2]?.init?.cache, 'no-store');
});
