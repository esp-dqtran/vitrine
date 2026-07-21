import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteImportDialog } from './components/SiteImportDialog.tsx';
import { SitesPageView } from './components/SitesPage.tsx';
import { SiteVersionView } from './components/SiteVersionPage.tsx';
import { Lightbox } from './components/Lightbox.tsx';
import { MediaGridCard } from './components/MediaGridCard.tsx';
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
  versionOptions: [
    { id: 2, label: 'Jul 2026', isLatest: true, updatedAt: '2026-07-20T00:00:00.000Z' },
    { id: 1, label: 'Nov 2025', isLatest: false, updatedAt: '2025-11-20T00:00:00.000Z' },
  ],
  canonicalUrl: 'https://mobbin.com/sites/v-7/id/preview',
  pages: [{
    id: 10, sourceId: 'page-1', title: 'Home', url: 'https://v7labs.com/', position: 0,
    fullPageImageUrl: '/api/sites/1/versions/2/pages/10/media',
    sections: [
      { id: 12, sourceId: 'section-image', position: 0, mediaKind: 'image', mediaUrl: '/image', cropTop: 0, cropBottom: 800, patterns: ['Hero Section'], ocrBoxes: [{ x: 1, y: 2, width: 3, height: 4, text: 'Secret visible copy' }], sourceMetadata: { patterns: ['Hero Section'] } },
      { id: 13, sourceId: 'section-video', position: 1, mediaKind: 'video', mediaUrl: '/video', posterUrl: '/poster', videoStartSeconds: 2, videoEndSeconds: 8, patterns: ['Navigation Section'], ocrBoxes: [], sourceMetadata: { patterns: ['Navigation Section'] } },
    ],
  }],
};

test('renders Sites with Apps gallery cards instead of preview-video cards', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin query="" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /References/);
  assert.match(html, /V7/);
  assert.match(html, /Search sites, versions, and sections/);
  assert.match(html, /View site/);
  assert.match(html, /Home/);
  assert.match(html, /46 sections/);
  assert.doesNotMatch(html, /16 pages/);
  assert.doesNotMatch(html, /View pages/);
  assert.doesNotMatch(html, /page by page/);
  assert.match(html, /Refresh/);
  assert.match(html, /Import Site/);
  assert.doesNotMatch(html, /<video/);
});

test('filters Sites by name, version, and source page title', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin={false} query="Pricing" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Showing 1 of 1 sites/);
});

test('keeps the Site import dialog URL-only', () => {
  const html = renderToStaticMarkup(<SiteImportDialog isOpen onClose={() => undefined} onExisting={() => undefined} />);
  assert.match(html, /Mobbin Sites URL/);
  assert.doesNotMatch(html, /App name|Platform/);
});

test('renders images and native videos through the shared media primitives', () => {
  const image = renderToStaticMarkup(<MediaGridCard label="Open Home" kind="image" url="/home.png" badges={['Home']} onOpen={() => undefined} />);
  const video = renderToStaticMarkup(<MediaGridCard label="Open Hero video" kind="video" url="/hero.mp4" posterUrl="/hero.webp" badges={['Home', 'Video']} onOpen={() => undefined} />);
  assert.match(image, /home\.png/);
  assert.match(video, /<video/);
  assert.match(video, /controls=""/);
  assert.match(video, /poster="\/hero\.webp"/);
});

test('contains image and video failures inside one media card', () => {
  const source = readFileSync(new URL('./components/MediaGridCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /onError/);
  assert.match(source, /mediaFailed/);
  assert.match(source, /Preview unavailable/);
});

test('renders native video in the shared lightbox', () => {
  const html = renderToStaticMarkup(
    <Lightbox
      item={{ kind: 'video', url: '/hero.mp4', posterUrl: '/hero.webp', type: 'Video', caption: 'Home hero' }}
      index={0}
      total={1}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );
  assert.match(html, /<video/);
  assert.match(html, /controls=""/);
  assert.match(html, /Home hero — 1 of 1/);
});

test('renders Preview and Sections without exposing Pages as a primary object', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Back to Sites/);
  assert.match(html, /Preview/);
  assert.match(html, /Sections/);
  assert.match(html, /Import Site/);
  assert.match(html, /Visit site/);
  assert.match(html, /<video[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"[^>]+controls=""[^>]+preload="metadata"/);
  assert.doesNotMatch(html, />Overview</);
  assert.doesNotMatch(html, />Pages</);
  assert.doesNotMatch(html, /16 pages/);
});

test('filters Sections by keyword and renders patterns without dumping OCR text', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin section="sections" initialSectionQuery="Hero" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />);
  assert.match(html, /Search sections/);
  assert.match(html, /All patterns/);
  assert.match(html, /Hero Section/);
  assert.match(html, /All media/);
  assert.match(html, /Images/);
  assert.match(html, /Videos/);
  assert.doesNotMatch(html, /Secret visible copy/);
  assert.match(html, /\/image/);
  assert.doesNotMatch(html, /\/video/);
});

test('falls back legacy and unknown Site detail sections to Preview', () => {
  const unknown = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin={false} section="unknown" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />);
  const pages = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin={false} section="pages" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />);
  const html = `${unknown}${pages}`;
  assert.match(html, /<video[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"/);
  assert.doesNotMatch(html, /Full-page capture/);
});

test('maps ready versions and sections into their dedicated controls', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /detail\.versionOptions\.map/);
  assert.match(source, /SiteSectionInspector/);
});

test('keeps Site loading and failures inside the detail frame', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /function SiteVersionLoading/);
  assert.match(source, /Back to Sites/);
  assert.match(source, /Retry/);
});
