import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteImportDialog } from './components/SiteImportDialog.tsx';
import { filterAndSortSites, SitesPageView } from './components/SitesPage.tsx';
import * as SitesPageModule from './components/SitesPage.tsx';
import * as SiteCardModule from './components/SiteCard.tsx';
import { SiteVersionView } from './components/SiteVersionPage.tsx';
import { Lightbox } from './components/Lightbox.tsx';
import { MediaGridCard } from './components/MediaGridCard.tsx';
import type { SiteSummary, SiteVersionDetail } from './types.ts';

const site: SiteSummary = {
  id: 1, versionId: 2, name: 'V7', slug: 'v-7', sourceUrl: 'https://v7labs.com/',
  label: 'Jul 2026', isLatest: true, pageCount: 16, sectionCount: 46,
  previewUrl: '/api/sites/1/versions/2/media/preview', updatedAt: '2026-07-20T00:00:00.000Z',
  description: 'AI-powered visual data platform.',
  logoUrl: '/site-logo.png',
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
  assert.match(html, /class="[^"]*reference-discovery[^"]*reference-discovery--sites[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery-nav[^"]*sites-top-nav[^"]*"/);
  assert.match(html, /class="[^"]*reference-search-trigger[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__content[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__taxonomy[^"]*reference-discovery__taxonomy--sites[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__facet[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__facet--wide[^"]*"/);
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
  assert.match(html, /data-reference-discovery-toolbar="true"/);
  assert.match(html, /class="reference-discovery-toolbar__sort"/);
  assert.match(html, /aria-label="Site ordering"/);
  assert.match(html, /data-facet-preview="categories"/);
  assert.match(html, /data-facet-preview="sections"/);
  assert.doesNotMatch(html, /data-facet-preview="styles"/);
  assert.match(html, /class="apps-discovery__hover-preview sites-discovery__hover-preview"/);
  assert.equal((html.match(/data-preview-frame=/g) ?? []).length, 3);
  assert.doesNotMatch(html, />Filter</);
  assert.doesNotMatch(html, /sites-discovery__toolbar-actions/);
  assert.match(html, /V7/);
  assert.match(html, /Open search and filters/);
  assert.match(html, /Search on Web\.\.\./);
  assert.match(html, /⌘K/);
  assert.doesNotMatch(html, /Search Sites/);
  assert.match(html, /data-discovery-card="true"/);
  assert.match(html, /class="[^"]*reference-discovery__grid[^"]*"/);
  assert.match(html, /class="discovery-card site-discovery-card"/);
  assert.match(html, /class="discovery-card__media site-discovery-card__media"/);
  assert.match(html, /class="discovery-card__identity site-discovery-card__identity"/);
  assert.match(html, /data-site-discovery-card="true"/);
  assert.match(html, /46 sections/);
  assert.match(html, /AI-powered visual data platform/);
  assert.match(html, /<video/);
  assert.match(html, /<a[^>]+href="\/sites\/1\/versions\/2"[^>]+class="discovery-card__link site-discovery-card__link"/);
  assert.doesNotMatch(html, /Refresh/);
  assert.doesNotMatch(html, /Showing 1 of 1 sites/);
  assert.match(html, /Import Site/);
  assert.equal((html.match(/>Import Site</g) ?? []).length, 1);
});

test('composes Sites through the shared reference discovery shell', () => {
  const source = readFileSync(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ ReferenceDiscoveryPageShell \} from '\.\/ReferenceDiscoveryPageShell\.tsx';/);
  assert.match(source, /<ReferenceDiscoveryPageShell[\s\S]*kind="sites"/);
});

test('builds Site hover previews from matching categories and captured sections', () => {
  const module = (
    SitesPageModule as typeof SitesPageModule & {
      buildSiteFacetPreviewPools?: (sites: SiteSummary[]) => unknown;
      visibleSiteFacetPreviews?: (pools: unknown) => Array<{ kind: string; label: string }>;
      siteFacetPreview?: (
        pools: unknown,
        facet: { group: 'categories' | 'sections' | 'styles'; value: string },
        random?: () => number,
      ) => unknown;
    }
  );
  const { buildSiteFacetPreviewPools, visibleSiteFacetPreviews, siteFacetPreview } = module;
  assert.equal(typeof buildSiteFacetPreviewPools, 'function');
  assert.equal(typeof visibleSiteFacetPreviews, 'function');
  assert.equal(typeof siteFacetPreview, 'function');
  if (!buildSiteFacetPreviewPools || !visibleSiteFacetPreviews || !siteFacetPreview) return;

  const pools = buildSiteFacetPreviewPools([site]);
  assert.deepEqual(
    visibleSiteFacetPreviews(pools).map(({ kind, label }) => ({ kind, label })),
    [
      { kind: 'icon', label: 'Business' },
      { kind: 'screen', label: 'Pricing' },
    ],
  );
  const category = siteFacetPreview(pools, { group: 'categories', value: 'Business' }, () => 0);
  const section = siteFacetPreview(pools, { group: 'sections', value: 'Pricing' }, () => 0);
  const style = siteFacetPreview(pools, { group: 'styles', value: 'Minimal' }, () => 0);

  assert.deepEqual(category, {
    kind: 'icon',
    app: 'V7',
    label: 'Business',
    iconUrl: '/site-logo.png',
    media: [],
  });
  assert.deepEqual(section, {
    kind: 'screen',
    app: 'V7',
    label: 'Pricing',
    iconUrl: '/site-logo.png',
    media: ['/api/sites/1/versions/2/pages/11/media'],
  });
  assert.equal(style, null);
});

test('prefetches bounded Site taxonomy previews and starts GSAP without waiting', () => {
  const source = readFileSync(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /const previewPools = useMemo\(\s*\(\) => buildSiteFacetPreviewPools\(sites\),\s*\[sites\],?\s*\)/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /prefetchVisibleSiteFacetPreviews\(previewPools\)/);
  assert.match(source, /siteFacetPreview\([\s\S]*siteFacetImageReady/);
  assert.match(source, /if \(preview\) showPreview\(preview,\s*event\.clientX,\s*event\.clientY\)/);
  assert.match(source, /prefetchNextSiteFacetPreview\(previewPools,\s*hoverFacet\)/);
  assert.doesNotMatch(source, /await prefetchSiteFacetPreview|prefetchSiteFacetPreview\(preview\)\.then/);
  assert.doesNotMatch(source, /siteFacetPreview\(sites,\s*hoverFacet\)/);
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

test('defers Site video assets until the card is near the viewport', () => {
  const html = renderToStaticMarkup(
    <SiteCardModule.SiteCard site={site} onOpen={() => undefined} />,
  );

  assert.match(html, /<video[^>]+preload="none"/);
  assert.doesNotMatch(html, new RegExp(`src="${site.previewUrl}"`));
  assert.doesNotMatch(html, /poster=/);
});

test('activates deferred Site media once near the viewport and disconnects', () => {
  const observeSiteCardMedia = (
    SiteCardModule as typeof SiteCardModule & {
      observeSiteCardMedia?: (
        target: Element,
        onVisible: () => void,
        createObserver: (
          callback: IntersectionObserverCallback,
          options: IntersectionObserverInit,
        ) => Pick<IntersectionObserver, 'observe' | 'disconnect'>,
      ) => () => void;
    }
  ).observeSiteCardMedia;
  assert.equal(typeof observeSiteCardMedia, 'function');
  if (!observeSiteCardMedia) return;

  let callback: IntersectionObserverCallback | undefined;
  let visibleCalls = 0;
  let disconnectCalls = 0;
  const target = {} as Element;
  const cleanup = observeSiteCardMedia(
    target,
    () => { visibleCalls += 1; },
    (next, options) => {
      callback = next;
      assert.deepEqual(options, { rootMargin: '320px 0px', threshold: 0.01 });
      return {
        observe: (value) => assert.equal(value, target),
        disconnect: () => { disconnectCalls += 1; },
      };
    },
  );

  callback?.(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  assert.equal(visibleCalls, 1);
  assert.equal(disconnectCalls, 1);

  cleanup();
  assert.equal(disconnectCalls, 2);
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

test('keeps shared Sites chrome mounted while the catalog loads', () => {
  const html = renderToStaticMarkup(
    <SitesPageView
      sites={[]}
      loading
      isAdmin={false}
      query=""
      onQueryChange={() => undefined}
      onRefresh={() => undefined}
      onImport={() => undefined}
    />,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.match(html, /aria-label="Reference type"/);
  assert.match(html, /Open search and filters/);
  assert.match(html, /Search on Web\.\.\./);
  assert.match(html, /aria-label="Loading Sites"/);
  assert.equal((html.match(/data-sites-discovery-skeleton="true"/g) ?? []).length, 6);
  assert.doesNotMatch(html, /No Sites imported yet/);
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
    <SiteVersionView detail={detail} isAdmin section="analysis" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
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

test('shows only Preview and Sections to normal Site users', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="analysis" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />,
  );
  assert.match(html, /aria-label="Preview"/);
  assert.match(html, /aria-label="Sections"/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Preview"/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.doesNotMatch(html, /Evidence-backed claims/);
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

test('uses the shared neutral tokens for Site media overlays', () => {
  const lightboxSource = readFileSync(new URL('./components/Lightbox.tsx', import.meta.url), 'utf8');
  const inspectorSource = readFileSync(
    new URL('./components/SiteSectionInspector.tsx', import.meta.url),
    'utf8',
  );
  const source = `${lightboxSource}\n${inspectorSource}`;

  assert.match(source, /var\(--color-background-body\)/);
  assert.match(source, /var\(--color-text-primary\)/);
  assert.match(source, /var\(--color-text-secondary\)/);
  assert.match(source, /var\(--shadow-high\)/);
  assert.doesNotMatch(source, /#fff|#d4d4d8|rgba\(10,\s*10,\s*11/);
});

test('renders the Mobbin Site-version hierarchy without Back or tab counts', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} onImport={() => undefined} />);
  assert.match(html, /data-reference-detail="site"/);
  assert.doesNotMatch(html, /Back to Sites/);
  assert.match(html, /<h1>V7<\/h1><p>AI-powered visual data platform\.<\/p>/);
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
  assert.doesNotMatch(html, /aria-label="Pages"/);
  assert.doesNotMatch(html, /16 pages/);
});

test('renders Site detail through the shared reference shell', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceDetailShell \} from '.\/ReferenceDetailShell/);
  assert.match(source, /<ReferenceDetailShell/);
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
