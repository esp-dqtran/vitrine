import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteImportDialog } from './components/SiteImportDialog.tsx';
import { SitesPageView } from './components/SitesPage.tsx';
import { SiteVersionView } from './components/SiteVersionPage.tsx';
import type { SiteSummary, SiteVersionDetail } from './types.ts';

const site: SiteSummary = {
  id: 1, versionId: 2, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/',
  label: 'Jul 2026', isLatest: true, pageCount: 16, sectionCount: 46,
  previewUrl: '/api/sites/1/versions/2/media/preview', updatedAt: '2026-07-20T00:00:00.000Z',
  previews: [
    { id: 10, title: 'Home', position: 0, url: '/api/sites/1/versions/2/pages/10/media' },
    { id: 11, title: 'Pricing', position: 1, url: '/api/sites/1/versions/2/pages/11/media' },
  ],
};

const detail: SiteVersionDetail = {
  site: { id: 1, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/' },
  version: { id: 2, label: 'Jul 2026', isLatest: true, previewUrl: site.previewUrl },
  canonicalUrl: 'https://mobbin.com/sites/v-7/id/preview',
  pages: [{
    id: 10, sourceId: 'page-1', title: 'Home', url: 'https://v7labs.com/', position: 0,
    fullPageImageUrl: '/api/sites/1/versions/2/pages/10/media',
    sections: [
      { id: 12, sourceId: 'section-image', position: 0, mediaKind: 'image', mediaUrl: '/image', cropTop: 0, cropBottom: 800, ocrBoxes: [{ x: 1, y: 2, width: 3, height: 4, text: 'Secret visible copy' }], sourceMetadata: {} },
      { id: 13, sourceId: 'section-video', position: 1, mediaKind: 'video', mediaUrl: '/video', posterUrl: '/poster', videoStartSeconds: 2, videoEndSeconds: 8, ocrBoxes: [], sourceMetadata: {} },
    ],
  }],
};

test('renders Sites with Apps gallery cards instead of preview-video cards', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin query="" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /V7/);
  assert.match(html, /Search sites, versions, and pages/);
  assert.match(html, /View pages/);
  assert.match(html, /Home/);
  assert.match(html, /16 pages · 46 sections/);
  assert.match(html, /Refresh/);
  assert.match(html, /Import Site/);
  assert.doesNotMatch(html, /<video/);
});

test('filters Sites by name, version, and preview page title', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin={false} query="Pricing" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Showing 1 of 1 sites/);
});

test('keeps the Site import dialog URL-only', () => {
  const html = renderToStaticMarkup(<SiteImportDialog isOpen onClose={() => undefined} onExisting={() => undefined} />);
  assert.match(html, /Mobbin Sites URL/);
  assert.doesNotMatch(html, /App name|Platform/);
});

test('renders ordered image and native video sections without dumping OCR text', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin onBack={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Back to Sites/);
  assert.match(html, /Import Site/);
  assert.match(html, /Full-page reference/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<video[^>]+controls=""[^>]+preload="metadata"/);
  assert.match(html, /Crop 0–800 px/);
  assert.match(html, /2–8 seconds/);
  assert.match(html, /1 OCR region/);
  assert.doesNotMatch(html, /Secret visible copy/);
  assert.ok(html.indexOf('/image') < html.indexOf('/video'));
});
