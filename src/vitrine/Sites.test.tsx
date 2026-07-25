import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteImportDialog } from './components/SiteImportDialog.tsx';
import { filterAndSortSites, SitesPageView } from './components/SitesPage.tsx';
import { SiteVersionView } from './components/SiteVersionPage.tsx';
import { Lightbox } from './components/Lightbox.tsx';
import { MediaGridCard } from './components/MediaGridCard.tsx';
import type { SiteSummary, SiteVersionDetail } from './types.ts';

const site: SiteSummary = {
  id: 1, versionId: 2, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/',
  label: 'Jul 2026', isLatest: true, pageCount: 16, sectionCount: 46,
  previewUrl: '/api/sites/1/versions/2/media/preview', updatedAt: '2026-07-20T00:00:00.000Z',
  description: 'AI-powered visual data platform.',
  categories: ['Technology', 'Business'],
  styles: ['Minimal', 'Motion'],
  popularity: 91,
  previews: [
    { id: 10, title: 'Home', position: 0, url: '/api/sites/1/versions/2/pages/10/media' },
    { id: 11, title: 'Pricing', position: 1, url: '/api/sites/1/versions/2/pages/11/media' },
  ],
};

const detail: SiteVersionDetail = {
  site: {
    id: 1,
    name: 'V7',
    slug: 'v-7',
    sourceUrl: 'https://v7labs.com/',
    description: 'AI-powered visual data platform.',
    categories: ['Technology', 'Business'],
    styles: ['Minimal', 'Motion'],
  },
  version: { id: 2, label: 'Jul 2026', isLatest: true, previewUrl: site.previewUrl },
  versionOptions: [
    { id: 2, label: 'Jul 2026', isLatest: true, updatedAt: '2026-07-20T00:00:00.000Z' },
    { id: 1, label: 'Nov 2025', isLatest: false, updatedAt: '2025-11-20T00:00:00.000Z' },
  ],
  canonicalUrl: 'https://mobbin.com/sites/v-7/id/preview',
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
      claims: [{
        kind: 'observed',
        text: 'Marketing platform',
        evidenceIds: ['TECH-1'],
        confidence: 0.9,
      }, {
        kind: 'inferred',
        text: 'Website builder',
        evidenceIds: ['TECH-1'],
        confidence: 0.8,
      }, {
        kind: 'observed',
        text: 'Sticky hero',
        evidenceIds: ['TECH-1'],
        confidence: 0.9,
      }, {
        kind: 'observed',
        text: 'Scroll-linked hero',
        evidenceIds: ['TECH-1'],
        confidence: 0.9,
      }, {
        kind: 'inferred',
        text: 'Mobile disables the hero ScrollTrigger',
        evidenceIds: ['TECH-1'],
        confidence: 0.8,
      }, {
        kind: 'inferred',
        text: 'Rebuild sticky hero first',
        evidenceIds: ['TECH-1'],
        confidence: 0.8,
      }],
    },
    warnings: [],
  },
  pages: [{
    id: 10, sourceId: 'page-1', title: 'Home', url: 'https://v7labs.com/', position: 0,
    fullPageImageUrl: '/api/sites/1/versions/2/pages/10/media',
    sections: [
      { id: 12, sourceId: 'section-image', position: 0, mediaKind: 'image', mediaUrl: '/image', cropTop: 0, cropBottom: 800, patterns: ['Hero Section'], ocrBoxes: [{ x: 1, y: 2, width: 3, height: 4, text: 'Secret visible copy' }], sourceMetadata: { patterns: ['Hero Section'] } },
      { id: 13, sourceId: 'section-video', position: 1, mediaKind: 'video', mediaUrl: '/video', posterUrl: '/poster', videoStartSeconds: 2, videoEndSeconds: 8, patterns: ['Navigation Section'], ocrBoxes: [], sourceMetadata: { patterns: ['Navigation Section'] } },
    ],
  }],
};

test('renders the Mobbin Sites catalog taxonomy and a semantic full-card link', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin query="" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /data-sites-discovery="true"/);
  assert.match(html, /Categories/);
  assert.match(html, /Sections/);
  assert.match(html, /Styles/);
  assert.match(html, /Portfolio/);
  assert.match(html, /Lifestyle/);
  assert.match(html, /How It Works/);
  assert.match(html, /Social Proof/);
  assert.match(html, /Photography/);
  assert.match(html, /Colorful/);
  assert.match(html, /Latest/);
  assert.match(html, /Most popular/);
  assert.match(html, /V7/);
  assert.match(html, /Search Sites/);
  assert.match(html, /data-site-discovery-card="true"/);
  assert.match(html, /46 sections/);
  assert.match(html, /AI-powered visual data platform/);
  assert.match(html, /<video/);
  assert.match(html, /<a[^>]+href="\/sites\/1\/versions\/2"[^>]+class="site-discovery-card__link"/);
  assert.doesNotMatch(html, /Refresh/);
  assert.doesNotMatch(html, /Showing 1 of 1 sites/);
  assert.match(html, /Import Site/);
  assert.equal((html.match(/>Import Site</g) ?? []).length, 1);
});

test('renders image-only Mobbin Site previews without a broken video element', () => {
  const imageSite: SiteSummary = { ...site, previewMediaKind: 'image' };
  const imageDetail: SiteVersionDetail = {
    ...detail,
    version: { ...detail.version, previewMediaKind: 'image' },
  };
  const catalog = renderToStaticMarkup(
    <SitesPageView sites={[imageSite]} isAdmin={false} query="" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />,
  );
  const version = renderToStaticMarkup(
    <SiteVersionView detail={imageDetail} isAdmin={false} section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
  );

  assert.match(catalog, /<img[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"/);
  assert.doesNotMatch(catalog, /<video/);
  assert.match(version, /<img[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"/);
  assert.doesNotMatch(version, /<video/);
});

test('filters Sites by name, version, and source page title', () => {
  const html = renderToStaticMarkup(<SitesPageView sites={[site]} isAdmin={false} query="Pricing" onQueryChange={() => undefined} onRefresh={() => undefined} onImport={() => undefined} />);
  assert.match(html, /data-site-discovery-card="true"/);
  assert.doesNotMatch(html, /Showing 1 of 1 sites/);
});

test('filters Sites by taxonomy and ranks popular references by captured depth', () => {
  const finance: SiteSummary = {
    ...site,
    id: 2,
    versionId: 3,
    name: 'Ledger',
    sourceUrl: 'https://ledger.example/',
    categories: ['Finance'],
    styles: ['Photography'],
    popularity: 30,
    sectionCount: 70,
    updatedAt: '2026-07-18T00:00:00.000Z',
    previews: [{ id: 20, title: 'Pricing', position: 0, url: '/api/sites/2/versions/3/pages/20/media' }],
  };
  const newest = filterAndSortSites([finance, site], '', { group: 'styles', value: 'Minimal' }, 'latest');
  const popular = filterAndSortSites([finance, site], '', null, 'popular');
  const pricing = filterAndSortSites([finance, site], '', { group: 'sections', value: 'Pricing' }, 'latest');

  assert.deepEqual(newest.map((item) => item.name), ['V7']);
  assert.deepEqual(popular.map((item) => item.name), ['V7', 'Ledger']);
  assert.deepEqual(pricing.map((item) => item.name), ['V7', 'Ledger']);
});

test('renders member Sites with the Apps gallery identity and account-control slots', () => {
  const html = renderToStaticMarkup(
    <SitesPageView
      sites={[site]}
      isAdmin={false}
      query=""
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
      memberControls={<button type="button">Account</button>}
    />,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.match(html, /data-reference-gallery-identity="true"/);
  assert.match(html, />Vitrine</);
  assert.match(html, />Account</);
  assert.doesNotMatch(html, /<h1[^>]*>References<\/h1>/);
});

test('keeps shared Sites chrome visible for errors and no-result searches', () => {
  const error = renderToStaticMarkup(
    <SitesPageView
      sites={[]}
      isAdmin
      error="network down"
      query=""
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
    />,
  );
  const noResults = renderToStaticMarkup(
    <SitesPageView
      sites={[site]}
      isAdmin={false}
      query="missing"
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
    />,
  );

  assert.match(error, /aria-label="Reference type"/);
  assert.match(error, /Could not load Sites/);
  assert.match(error, /network down/);
  assert.match(error, />Retry</);
  assert.match(noResults, /aria-label="Reference type"/);
  assert.match(noResults, /No Sites match this search/);
});

test('keeps the Site import dialog URL-only', () => {
  const html = renderToStaticMarkup(<SiteImportDialog isOpen onClose={() => undefined} onExisting={() => undefined} />);
  assert.match(html, /Analyze one public page/);
  assert.match(html, /Public page URL/);
  assert.doesNotMatch(html, /Import Site from Mobbin/);
  assert.doesNotMatch(html, /App name|Platform/);
});

test('renders evidence-backed Site analysis without raw evidence values', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="analysis" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
  );
  assert.match(html, />Analysis</);
  assert.match(html, /GSAP/);
  assert.match(html, /Observed in use/);
  assert.match(html, /Evidence-backed claims/);
  assert.match(html, /TECH-1/);
  assert.match(html, /Scroll-linked hero/);
  assert.match(html, /Mobile disables the hero ScrollTrigger/);
  assert.doesNotMatch(html, /GSAP 3\.15\.0<\/[^>]+>.*runtime/s);
});

test('renders images and native videos through the shared media primitives', () => {
  const image = renderToStaticMarkup(<MediaGridCard label="Open Home" kind="image" url="/home.png" badges={['Home']} onOpen={() => undefined} />);
  const video = renderToStaticMarkup(<MediaGridCard label="Open Hero video" kind="video" url="/hero.mp4" posterUrl="/hero.webp" badges={['Home', 'Video']} onOpen={() => undefined} />);
  assert.match(image, /home\.png/);
  assert.match(video, /<video/);
  assert.match(video, /controls=""/);
  assert.match(video, /poster="\/hero\.webp"/);
});

test('renders Site videos as Mobbin-style section actions without changing image cards', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="sections" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
  );
  const video = html.match(/<video[^>]+src="\/video"[^>]*>/)?.[0] ?? '';
  assert.match(video, /poster="\/poster"/);
  assert.match(video, /loop=""/);
  assert.match(video, /playsInline=""/);
  assert.doesNotMatch(video, /controls=/);
  assert.match(html, /View section/);
  assert.match(html, /data-site-section-video-card="true"/);
  assert.match(html, /<img[^>]+src="\/image"/);
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

test('renders the Mobbin Site-version hierarchy without Back or tab counts', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />);
  assert.match(html, /data-site-detail="true"/);
  assert.match(html, /data-site-detail-hero="true"/);
  assert.doesNotMatch(html, /Back to Sites/);
  assert.match(html, /<h1><span>V7 —<\/span><span>AI-powered visual data platform\.<\/span><\/h1>/);
  assert.match(html, /<span>Category<\/span>/);
  assert.match(html, /<span>Style<\/span>/);
  assert.match(html, />Latest</);
  assert.match(html, /Preview/);
  assert.match(html, />Sections</);
  assert.doesNotMatch(html, />Sections 2</);
  assert.match(html, /Save/);
  assert.match(html, /Technology/);
  assert.match(html, /Minimal/);
  assert.match(html, /AI-powered visual data platform/);
  assert.doesNotMatch(html, /Import Site/);
  assert.match(html, /Visit site/);
  assert.match(html, /data-site-preview-stage="true"/);
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
  assert.match(html, /data-site-sections-grid="true"/);
  assert.match(html, /0 selected/);
});

test('uses the captured page title when a section has no extracted pattern', () => {
  const withoutPatterns: SiteVersionDetail = {
    ...detail,
    pages: detail.pages.map((page) => ({
      ...page,
      sections: page.sections.map((item) => ({ ...item, patterns: [] })),
    })),
  };
  const html = renderToStaticMarkup(
    <SiteVersionView detail={withoutPatterns} isAdmin={false} section="sections" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
  );
  assert.match(html, /<strong>Home<\/strong>/);
  assert.doesNotMatch(html, /Unclassified/);
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
  assert.match(source, /Retry/);
});
