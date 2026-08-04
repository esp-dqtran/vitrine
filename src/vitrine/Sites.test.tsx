import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SitesPageView } from './components/SitesPage.tsx';
import * as SitesPageModule from './components/SitesPage.tsx';
import * as SiteCardModule from './components/SiteCard.tsx';
import { SiteVersionView } from './components/SiteVersionPage.tsx';
import * as SiteVersionPageModule from './components/SiteVersionPage.tsx';
import { Lightbox } from './components/Lightbox.tsx';
import { MediaGridCard } from './components/MediaGridCard.tsx';
import * as MediaGridCardModule from './components/MediaGridCard.tsx';
import {
  SiteAnalysisPanel,
  technologyIconUrl,
  wappalyzerIconUrl,
} from './components/SiteAnalysisPanel.tsx';
import type { SitesDiscoveryControllerState } from './sitesDiscoveryAdapter.ts';
import type { DiscoveryController } from './useDiscoveryController.ts';
import type { SiteSummary, SiteVersionDetail } from './types.ts';

const site: SiteSummary = {
  id: 1, versionId: 2, name: 'V7', slug: 'v-7', routeSlug: 'v7', sourceUrl: 'https://v7labs.com/',
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

const siteController = (
  overrides: Partial<DiscoveryController<
    SiteSummary,
    SitesDiscoveryControllerState['sort'],
    SitesDiscoveryControllerState
  >> = {},
): DiscoveryController<
  SiteSummary,
  SitesDiscoveryControllerState['sort'],
  SitesDiscoveryControllerState
> => ({
  state: {
    platform: 'web',
    sort: 'latest',
    query: '',
    filters: [],
  },
  items: [site],
  facets: [
    { group: 'categories', value: 'Business', count: 1, section: 'Categories' },
    { group: 'sections', value: 'Pricing', count: 1, section: 'Sections' },
    { group: 'styles', value: 'Minimal', count: 1, section: 'Styles' },
  ],
  totalCount: 1,
  loading: false,
  loadingMore: false,
  error: null,
  loadMoreError: null,
  hasMore: false,
  sentinelRef: { current: null },
  setState: () => undefined,
  setPlatform: () => undefined,
  setSort: () => undefined,
  setQuery: () => undefined,
  toggleFilter: () => undefined,
  clearFilterGroup: () => undefined,
  retry: () => undefined,
  retryLoadMore: () => undefined,
  ...overrides,
});

const detail: SiteVersionDetail = {
  routeSlug: 'v7',
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
    schemaVersion: 2,
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
      slug: 'gsap',
      categories: ['JavaScript libraries'],
      icon: 'GSAP.svg',
      source: 'wappalyzer',
      version: '3.15.0',
      category: 'animation',
      state: 'observed-in-use',
      evidenceIds: ['TECH-1'],
      confidence: 1,
    }, {
      id: 'TECHNOLOGY-2',
      name: 'React',
      category: 'framework',
      state: 'not-detected',
      evidenceIds: [],
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
  const html = renderToStaticMarkup(<SitesPageView controller={siteController()} isAdmin />);
  assert.match(html, /data-sites-discovery="true"/);
  assert.match(html, /class="[^"]*reference-discovery[^"]*reference-discovery--sites[^"]*"/);
  assert.doesNotMatch(html, /reference-discovery-nav/);
  assert.match(html, /class="[^"]*reference-discovery__content[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__taxonomy[^"]*reference-discovery__taxonomy--sites[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__facet[^"]*"/);
  assert.match(html, /class="[^"]*reference-discovery__facet--wide[^"]*"/);
  assert.match(html, /Categories/);
  assert.match(html, /Sections/);
  assert.match(html, /Styles/);
  assert.match(html, /Business/);
  assert.match(html, /Pricing/);
  assert.match(html, /Minimal/);
  assert.match(html, /data-sites-filterbar="true"/);
  assert.match(html, /aria-label="Site discovery controls"/);
  assert.match(html, /aria-label="Site platform: Web"/);
  assert.doesNotMatch(html, /role="radiogroup"[^>]*aria-label="Site platform"/);
  assert.match(html, /Open Categories filters/);
  assert.match(html, /Open Sections filters/);
  assert.match(html, /Open Styles filters/);
  assert.match(html, />1 site</);
  assert.match(html, /Latest/);
  assert.doesNotMatch(html, /data-reference-discovery-toolbar="true"/);
  assert.match(html, /data-facet-preview="categories"/);
  assert.match(html, /data-facet-preview="sections"/);
  assert.doesNotMatch(html, /data-facet-preview="styles"/);
  assert.match(html, /class="apps-discovery__hover-preview sites-discovery__hover-preview"/);
  assert.equal((html.match(/data-preview-frame=/g) ?? []).length, 3);
  assert.doesNotMatch(html, /sites-discovery__toolbar-actions/);
  assert.match(html, /V7/);
  assert.match(html, /data-discovery-card="true"/);
  assert.match(html, /class="[^"]*reference-discovery__grid[^"]*"/);
  assert.match(html, /class="discovery-card site-discovery-card"/);
  assert.match(html, /class="discovery-card__media site-discovery-card__media"/);
  assert.match(html, /class="discovery-card__identity site-discovery-card__identity"/);
  assert.match(html, /data-site-discovery-card="true"/);
  assert.match(html, /46 sections/);
  assert.match(html, /AI-powered visual data platform/);
  assert.match(html, /<video/);
  assert.match(html, /<a[^>]+href="\/sites\/v7"[^>]+class="discovery-card__link site-discovery-card__link"/);
  assert.doesNotMatch(html, /Refresh/);
  assert.equal((html.match(/Showing/g) ?? []).length, 1);
  assert.match(html, /<strong>1 site<\/strong>/);
  assert.doesNotMatch(html, /Import Site/);
});

test('keeps the Sites hero taxonomy curated when the API returns noisy facets', () => {
  const html = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({
        facets: [
          { group: 'categories', value: 'Business', count: 1, section: 'Categories' },
          { group: 'sections', value: '000', count: 1, section: 'Sections' },
          { group: 'sections', value: '7HgfXftRBBqsYtAEYcqjGLQrNJLL6Tww9ek4rE3Apump', count: 1, section: 'Sections' },
          { group: 'styles', value: 'Minimal', count: 1, section: 'Styles' },
        ],
      })}
      isAdmin
    />,
  );

  assert.match(html, />Portfolio</);
  assert.match(html, />How It Works</);
  assert.match(html, />Colorful</);
  assert.doesNotMatch(html, />000</);
  assert.doesNotMatch(html, />7HgfXftRBBqsYtAEYcqjGLQrNJLL6Tww9ek4rE3Apump</);
});

test('uses the server total in Sites result metadata while one cursor page is loaded', () => {
  const sites = Array.from({ length: 24 }, (_, index) => ({
    ...site,
    id: index + 1,
    versionId: index + 101,
    routeSlug: `site-${index + 1}`,
  }));
  const html = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({
        state: {
          platform: 'web',
          sort: 'latest',
          query: 'pricing',
          filters: [],
        },
        items: sites,
        totalCount: 100,
        hasMore: true,
      })}
      isAdmin={false}
    />,
  );

  assert.equal((html.match(/<strong>100 sites<\/strong>/g) ?? []).length, 1);
});

test('composes Sites through the shared reference discovery shell', () => {
  const source = readFileSync(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ DiscoveryPageLayout \} from '\.\/DiscoveryPageLayout\.tsx';/);
  assert.match(source, /<DiscoveryPageLayout[\s\S]*kind="sites"/);
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

test('loads Site taxonomy previews only after pointer entry', () => {
  const source = readFileSync(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /const previewPools = useMemo\(\s*\(\) => buildSiteFacetPreviewPools\(controller\.items\),\s*\[controller\.items\],?\s*\)/);
  assert.doesNotMatch(source, /requestIdleCallback/);
  assert.doesNotMatch(source, /prefetchVisibleSiteFacetPreviews/);
  assert.match(source, /siteFacetPreview\([\s\S]*siteFacetImageReady/);
  assert.match(source, /if \(preview\) showPreview\(preview,\s*event\.clientX,\s*event\.clientY\)/);
  assert.match(source, /prefetchNextSiteFacetPreview\(previewPools,\s*hoverFacet\)/);
  assert.doesNotMatch(source, /await prefetchSiteFacetPreview|prefetchSiteFacetPreview\(preview\)\.then/);
  assert.doesNotMatch(source, /siteFacetPreview\(sites,\s*hoverFacet\)/);
});

test('renders every Site page item and only the generic discovery sentinel', () => {
  const sites = Array.from({ length: 30 }, (_, index) => ({
    ...site,
    id: index + 1,
    versionId: index + 101,
    name: `Site ${index + 1}`,
    slug: `site-${index + 1}`,
  }));
  const html = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({ items: sites, totalCount: 30, hasMore: true })}
      isAdmin={false}
    />,
  );

  assert.equal((html.match(/data-site-discovery-card="true"/g) ?? []).length, 30);
  assert.equal((html.match(/data-discovery-sentinel="sites"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-sites-gallery-sentinel/);
});

test('renders image-only Mobbin Site previews without a broken video element', () => {
  const imageSite: SiteSummary = { ...site, previewMediaKind: 'image' };
  const imageDetail: SiteVersionDetail = {
    ...detail,
    version: { ...detail.version, previewMediaKind: 'image' },
  };
  const catalog = renderToStaticMarkup(
    <SitesPageView controller={siteController({ items: [imageSite] })} isAdmin={false} />,
  );
  const version = renderToStaticMarkup(
    <SiteVersionView detail={imageDetail} isAdmin={false} section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );

  assert.match(catalog, /<img[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"/);
  assert.doesNotMatch(catalog, /<video/);
  assert.match(version, /<img[^>]+src="\/api\/sites\/1\/versions\/2\/pages\/10\/media"/);
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

test('keeps related Site preview media inactive until user intent', () => {
  const imageSite: SiteSummary = { ...site, previewMediaKind: 'image' };
  const html = renderToStaticMarkup(
    <SiteCardModule.SiteCard
      site={imageSite}
      onOpen={() => undefined}
      deferMediaUntilIntent
    />,
  );

  assert.match(html, /data-site-discovery-card="true"/);
  assert.match(html, />V7</);
  assert.doesNotMatch(html, new RegExp(`src="${imageSite.previewUrl}"`));
  assert.doesNotMatch(html, new RegExp(`src="${imageSite.previews[0]?.url}"`));
  assert.doesNotMatch(html, /aria-label="Open V7"/);
});

test('uses an AA text token for related Site metadata', () => {
  const css = readFileSync(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const rule = css.match(/\.discovery-card__copy small\s*\{[^}]+\}/)?.[0] ?? '';
  assert.match(rule, /color:\s*var\(--color-text-secondary\)/);
  assert.doesNotMatch(rule, /color-text-disabled/);
});

test('loads a bounded Mobbin-style related Site page on detail routes', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /listSitesPage\(7,\s*0\)/);
  assert.doesNotMatch(source, /listSites\(\)/);
  assert.match(source, /relatedSites\.slice\(0,\s*6\)/);
  assert.match(source, /More like \{detail\.site\.name\}/);
  assert.match(source, /showMetadata=\{false\}/);
  assert.doesNotMatch(source, /Continue exploring/);
  assert.doesNotMatch(source, /<SiteCard[\s\S]*?deferMediaUntilIntent/);
});

test('renders related Sites with visible previews and compact identity copy', () => {
  const relatedSite: SiteSummary = { ...site, previewMediaKind: 'image' };
  const html = renderToStaticMarkup(
    <SiteVersionView
      detail={detail}
      relatedSites={[relatedSite]}
      isAdmin={false}
      section="preview"
      onSectionChange={() => undefined}
      onVersionChange={() => undefined}
      onBack={() => undefined}
    />,
  );

  assert.match(html, /<h2 id="related-sites-title">More like V7<\/h2>/);
  assert.match(html, new RegExp(`src="${relatedSite.previewUrl}"`));
  assert.doesNotMatch(html, /Continue exploring/);
  assert.doesNotMatch(html, new RegExp(`${relatedSite.label} · ${relatedSite.sectionCount} sections`));
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

test('delegates query, sort, filters, pagination, and retry state to the generic controller', () => {
  const source = readFileSync(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /useDiscoveryController\(/);
  assert.match(source, /controller\.toggleFilter/);
  assert.match(source, /controller\.clearFilterGroup/);
  assert.match(source, /controller\.setSort/);
  assert.match(source, /sentinelRef=\{controller\.sentinelRef\}/);
  assert.match(source, /renderedCount=\{controller\.items\.length\}/);
  assert.doesNotMatch(source, /\blistSites\s*\(/);
  assert.doesNotMatch(
    source,
    /filterAndSortSites|SITE_RENDER_BATCH|setRenderedCount|observeSiteGallerySentinel|new IntersectionObserver/,
  );
  assert.doesNotMatch(source, /\brevision\b/);
});

test('keeps a stable adapter while bridging external and URL-backed Site queries', () => {
  const source = readFileSync(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /query: string/);
  assert.match(source, /onQueryChange: \(value: string\) => void/);
  assert.match(source, /createSitesDiscoveryAdapter\(\{ query:/);
  assert.match(source, /controller\.setQuery\(query\)/);
  assert.match(source, /onQueryChangeRef\.current\(controller\.state\.query\)/);
  assert.doesNotMatch(source, /useMemo\([\s\S]{0,160}\[query\]/);
});

test('keeps member Sites route content independent from the persistent app header', () => {
  const html = renderToStaticMarkup(
    <SitesPageView
      controller={siteController()}
      isAdmin={false}
      memberControls={<button type="button">Account</button>}
    />,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.doesNotMatch(html, /data-reference-gallery-identity="true"/);
  assert.doesNotMatch(html, /<strong>Vitrine<\/strong>/);
  assert.doesNotMatch(html, />Account</);
  assert.doesNotMatch(html, /<h1[^>]*>References<\/h1>/);
});

test('keeps Sites route content visible for errors and no-result searches', () => {
  const error = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({ items: [], totalCount: null, error: 'network down' })}
      isAdmin
    />,
  );
  const noResults = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({
        state: { platform: 'web', sort: 'latest', query: 'missing', filters: [] },
        items: [],
        totalCount: 0,
      })}
      isAdmin={false}
    />,
  );

  assert.doesNotMatch(error, /aria-label="Reference type"/);
  assert.match(error, /Could not load sites/);
  assert.match(error, /network down/);
  assert.match(error, />Retry</);
  assert.doesNotMatch(noResults, /aria-label="Reference type"/);
  assert.match(noResults, /No sites found/);
});

test('keeps the Sites route shell mounted while the catalog loads', () => {
  const html = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({ items: [], totalCount: null, loading: true })}
      isAdmin={false}
    />,
  );

  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.doesNotMatch(html, /aria-label="Reference type"/);
  assert.match(html, /aria-label="Loading sites"/);
  assert.doesNotMatch(html, /data-sites-discovery-skeleton="true"/);
  assert.doesNotMatch(html, /No sites found/);
});

test('preserves Site cards through loading-more and load-more retry states', () => {
  const loadingMore = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({
        loadingMore: true,
        hasMore: true,
        totalCount: 3,
      })}
      isAdmin={false}
    />,
  );
  const loadMoreError = renderToStaticMarkup(
    <SitesPageView
      controller={siteController({
        loadMoreError: 'cursor failed',
        hasMore: true,
        totalCount: 3,
      })}
      isAdmin={false}
    />,
  );

  assert.match(loadingMore, /data-site-discovery-card="true"/);
  assert.match(loadingMore, /aria-label="Loading more sites"/);
  assert.match(loadMoreError, /data-site-discovery-card="true"/);
  assert.match(loadMoreError, /Could not load more sites: cursor failed/);
  assert.match(loadMoreError, />Retry</);
});

test('replaces Site Analysis with icon-based Wappalyzer Technology results', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin section="technology" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );
  assert.match(html, /aria-label="Technology"/);
  assert.match(html, />Technology</);
  assert.match(html, /GSAP/);
  assert.match(html, /src="https:\/\/www\.wappalyzer\.com\/images\/icons\/GSAP\.svg"/);
  assert.match(html, /JavaScript libraries/);
  assert.match(html, /Observed in use/);
  assert.doesNotMatch(html, /Checked but not detected|React/);
  assert.doesNotMatch(html, />Analysis</);
  assert.doesNotMatch(html, /Structure|Measured motion|Evidence-backed claims|Mobile render|Limitations/);
});

test('keeps the old analysis URL section as a Technology alias', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin section="analysis" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );
  assert.match(html, /aria-selected="true"[^>]*aria-label="Technology"/);
  assert.match(html, /GSAP/);
});

test('builds only safe Wappalyzer technology icon URLs', () => {
  assert.equal(
    wappalyzerIconUrl('Next.js.svg'),
    'https://www.wappalyzer.com/images/icons/Next.js.svg',
  );
  assert.equal(
    wappalyzerIconUrl('Tailwind CSS.svg'),
    'https://www.wappalyzer.com/images/icons/Tailwind%20CSS.svg',
  );
  assert.equal(wappalyzerIconUrl('../React.svg'), undefined);
  assert.equal(wappalyzerIconUrl('https://example.com/React.svg'), undefined);
});

test('hides CSS Keyframes and gives native Technology results app icons', () => {
  const nativeDetail: SiteVersionDetail = {
    ...detail,
    analysis: {
      ...detail.analysis!,
      status: 'evidence-only',
      technology: [{
        id: 'TECHNOLOGY-CSS',
        name: 'CSS Keyframes',
        category: 'animation',
        state: 'observed-in-use',
        evidenceIds: [],
        confidence: 0.99,
      }, {
        id: 'TECHNOLOGY-JS',
        name: 'Custom JavaScript Motion',
        category: 'animation',
        state: 'observed-in-use',
        evidenceIds: [],
        confidence: 0.99,
      }, {
        id: 'TECHNOLOGY-NEXT',
        name: 'Next.js',
        category: 'framework',
        state: 'confirmed',
        evidenceIds: [],
        confidence: 0.98,
      }],
    },
  };
  const html = renderToStaticMarkup(<SiteAnalysisPanel detail={nativeDetail} />);

  assert.doesNotMatch(html, /Detected technology|CSS Keyframes|&lt;\/&gt;/);
  assert.match(html, />2 detected</);
  assert.match(html, /cdn\.simpleicons\.org\/javascript/);
  assert.match(html, /cdn\.simpleicons\.org\/nextdotjs/);
  assert.equal(
    technologyIconUrl({ name: 'Turbopack' }),
    'https://cdn.simpleicons.org/turborepo',
  );
});

test('lays out Technology icons in a responsive card grid', () => {
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(
    styles,
    /\.site-technology__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\)/,
  );
  assert.match(
    styles,
    /\.site-technology__icon\s*\{[\s\S]*width:\s*32px[\s\S]*height:\s*32px/,
  );
});

test('shows only Preview and Sections to normal Site users', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="analysis" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );
  assert.match(html, /aria-label="Preview"/);
  assert.match(html, /aria-label="Sections"/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Preview"/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.doesNotMatch(html, /aria-label="Technology"/);
  assert.doesNotMatch(html, /Evidence-backed claims/);
});

test('renders images and native videos through the shared media primitives', () => {
  const image = renderToStaticMarkup(<MediaGridCard label="Open Home" kind="image" url="/home.png" onOpen={() => undefined} />);
  const video = renderToStaticMarkup(<MediaGridCard label="Open Hero video" kind="video" url="/hero.mp4" posterUrl="/hero.webp" onOpen={() => undefined} />);
  const deferredImage = renderToStaticMarkup(<MediaGridCard label="Open deferred Home" kind="image" url="/deferred-home.png" deferMedia onOpen={() => undefined} />);
  assert.match(image, /home\.png/);
  assert.match(image, /astryx-clickable-card/);
  assert.match(image, /<button[^>]+aria-label="Open Home"/);
  assert.match(image, /<img[^>]+src="\/home\.png"/);
  assert.match(image, /object-fit:contain/);
  assert.doesNotMatch(image, /astryx-badge/);
  assert.match(video, /<video/);
  assert.match(video, /controls=""/);
  assert.match(video, /poster="\/hero\.webp"/);
  assert.match(video, /object-fit:contain/);
  assert.doesNotMatch(deferredImage, /deferred-home\.png/);
});

test('delegates image media-card keyboard activation to ClickableCard', () => {
  const source = readFileSync(new URL('./components/MediaGridCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ClickableCard[\s\S]*label=\{label\}[\s\S]*onClick=\{onOpen\}/);
  assert.doesNotMatch(source, /<button/);
  assert.doesNotMatch(source, /handleMediaCardKeyDown/);
});

test('returns focus to the section card after closing the inspector', () => {
  const restoreInspectorFocus = (
    SiteVersionPageModule as typeof SiteVersionPageModule & {
      restoreInspectorFocus?: (
        trigger: { focus: () => void } | null,
        schedule: (callback: () => void) => void,
      ) => void;
    }
  ).restoreInspectorFocus;
  assert.equal(typeof restoreInspectorFocus, 'function');
  if (!restoreInspectorFocus) return;

  let focused = 0;
  restoreInspectorFocus(
    { focus: () => { focused += 1; } },
    (callback) => callback(),
  );
  assert.equal(focused, 1);

  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /onClose=\{closeInspector\}/);
  assert.match(source, /restoreInspectorFocus\(inspectorTriggerRef\.current\)/);
});

test('renders Site sections as deferred Mobbin-style media actions', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="sections" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );
  assert.doesNotMatch(html, /src="\/video"/);
  assert.doesNotMatch(html, /poster="\/poster"/);
  assert.doesNotMatch(html, /src="\/image"/);
  assert.match(html, /View section/);
  assert.match(html, /data-site-section-video-card="true"/);
});

test('shows a focused Technology empty state for captures without detections', () => {
  const evidenceOnlyDetail: SiteVersionDetail = {
    ...detail,
    analysisStatus: 'evidence-only',
    analysisModel: undefined,
    analysis: {
      schemaVersion: 1,
      status: 'evidence-only',
      evidence: [
        { id: 'DOM-1', kind: 'dom', value: 'navigation' },
        { id: 'MOTION-1', kind: 'animation', value: 'sticky navigation' },
      ],
      structure: [
        { id: 'STRUCTURE-1', key: 'header', tag: 'header', visible: true },
        { id: 'STRUCTURE-2', key: 'header > nav[aria-label="Main navigation"]', tag: 'nav', visible: true },
        { id: 'STRUCTURE-3', key: 'body > div:nth-of-type(2) > main', tag: 'main', visible: true },
        { id: 'STRUCTURE-4', key: 'main > section:nth-of-type(1)', tag: 'section', visible: true },
        { id: 'STRUCTURE-5', key: 'main > section:nth-of-type(2)', tag: 'section', visible: true },
        { id: 'STRUCTURE-6', key: 'body > footer', tag: 'footer', visible: true },
      ],
      visualTokens: [],
      responsive: [
        { id: 'RESPONSIVE-1', key: 'header > nav', change: 'hidden-on-mobile' },
        { id: 'RESPONSIVE-2', key: 'header > a', change: 'hidden-on-mobile' },
        { id: 'RESPONSIVE-3', key: 'button[aria-label="Menu"]', change: 'mobile-only' },
      ],
      motion: [0, 1].map((position) => ({
        id: `MOTION-FINDING-${position}`,
        targetEvidenceId: 'STRUCTURE-2',
        type: 'sticky' as const,
        trigger: 'scroll-progress' as const,
        properties: ['top'],
        states: [],
        viewports: ['desktop' as const, 'mobile' as const],
        evidenceIds: ['MOTION-1'],
        confidence: 0.92,
      })),
      technology: [],
      synthesis: null,
      warnings: [],
    },
  };

  const html = renderToStaticMarkup(<SiteAnalysisPanel detail={evidenceOnlyDetail} />);

  assert.match(html, />Technology</);
  assert.match(html, /No technologies detected/);
  assert.doesNotMatch(html, /body &gt; div:nth-of-type/);
  assert.doesNotMatch(html, /Structure|Measured motion|Evidence-backed claims|Mobile render|Limitations/);
});

test('defers Site section assets and preserves complete image crops', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /<SiteSectionVideoCard[\s\S]*deferMedia/);
  assert.match(source, /<MediaGridCard[\s\S]*imageFit="contain"[\s\S]*deferMedia/);
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
  assert.match(source, /var\(--color-text-secondary\)/);
  assert.match(source, /var\(--shadow-high\)/);
  assert.match(source, /objectFit:\s*'contain'/);
  assert.doesNotMatch(source, /#fff|#d4d4d8|rgba\(10,\s*10,\s*11/);
});

test('renders the shared Site detail hierarchy without a description', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />);
  assert.match(html, /data-reference-detail="site"/);
  assert.doesNotMatch(html, /Back to Sites/);
  assert.match(html, /<h1>V7<\/h1>/);
  assert.doesNotMatch(html, /<h1>V7<\/h1><p>/);
  assert.match(html, /<span>Platform<\/span><strong>Web<\/strong>/);
  assert.match(html, /<span>Category<\/span>/);
  assert.match(html, /<span>Sections<\/span>/);
  assert.match(html, /<span>Last updated<\/span>/);
  assert.doesNotMatch(html, /<span>Style<\/span>/);
  assert.match(html, />Latest</);
  assert.match(html, /Preview/);
  assert.match(html, />Sections</);
  assert.doesNotMatch(html, />Sections 2</);
  assert.doesNotMatch(html, />Save</);
  assert.doesNotMatch(html, />Saved</);
  assert.match(html, /Technology/);
  assert.doesNotMatch(html, /AI-powered visual data platform/);
  assert.doesNotMatch(html, /Import Site/);
  assert.match(html, /Visit Site/);
  assert.match(html, /data-variant="primary"/);
  assert.match(html, /<span>Showing<\/span><strong>1 page<\/strong>/);
  assert.match(html, /data-site-preview-stage="true"/);
  assert.match(html, /<video[^>]+data-site-preview-video="true"[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"[^>]+loop=""[^>]+preload="auto"/);
  assert.doesNotMatch(html, /data-site-preview-video="true"[^>]+controls=/);
  assert.match(html, /class="site-preview-player site-preview-player--video"/);
  assert.match(html, /aria-label="Site preview mode"/);
  assert.match(html, /aria-label="V7 website video; plays on hover or focus"/);
  assert.match(html, />Video</);
  assert.match(html, />Full screen</);
  assert.doesNotMatch(html, />Overview</);
  assert.doesNotMatch(html, /aria-label="Pages"/);
  assert.doesNotMatch(html, /16 pages/);
});

test('renders the Mobbin white identity mark on a black plate', () => {
  const mobbinDetail: SiteVersionDetail = {
    ...detail,
    routeSlug: 'mobbin',
    site: {
      ...detail.site,
      name: 'Mobbin',
      slug: 'mobbin-catalog-source',
      logoUrl: 'https://framerusercontent.com/images/oPS7zaP2iinQmw4du221pyfo.svg',
    },
  };
  const html = renderToStaticMarkup(
    <SiteVersionView
      detail={mobbinDetail}
      isAdmin
      section="preview"
      onSectionChange={() => undefined}
      onVersionChange={() => undefined}
      onBack={() => undefined}
    />,
  );

  assert.match(
    html,
    /reference-detail__logo--image reference-detail__logo--image-dark/,
  );
});

test('renders Site detail through the generic reference detail page', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /ReferenceDetailPage/);
  assert.match(source, /<ReferenceDetailPage/);
  assert.doesNotMatch(source, /<ReferenceDetailShell/);
  assert.doesNotMatch(source, /<SitesTopNav/);
});

test('resets the document scroll when a Site detail opens or changes', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /window\.scrollTo\(\{\s*top:\s*0,\s*left:\s*0,\s*behavior:\s*'auto'\s*\}\)/);
  assert.match(source, /\}, \[siteId, siteSlug\]\);/);
});

test('plays the main Site preview only on hover or keyboard focus', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /onMouseEnter=\{playPreview\}/);
  assert.match(source, /onMouseLeave=\{stopPreview\}/);
  assert.match(source, /onFocus=\{playPreview\}/);
  assert.match(source, /onBlur=\{stopPreview\}/);
  assert.match(source, /preload="auto"/);
  assert.match(source, /video\.pause\(\);\s*video\.currentTime = 0;/);
});

test('renders the inline Site preview with the Flow modal UI and two smooth modes', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(source, /site-preview-player site-preview-player--\$\{activeMode\}/);
  assert.match(source, /className="flow-preview-dialog__header site-preview-player__header"/);
  assert.match(source, /aria-label="Site preview mode"/);
  assert.match(source, /ref=\{registerMode\('video'\)\}/);
  assert.match(source, /ref=\{registerMode\('full-screen'\)\}/);
  assert.match(source, /data-site-preview-video="true"/);
  assert.match(source, /src=\{fullPageImageUrl\}/);
  assert.match(source, /useSlidingIndicator\(activeMode\)/);
  assert.doesNotMatch(source, /function SitePreviewDialog|<AstryxModal/);
  assert.match(styles, /max-width:\s*1440px/);
  assert.match(styles, /aspect-ratio:\s*8\s*\/\s*5/);
  assert.match(styles, /object-fit:\s*contain/);
});

test('renders Sections with a compact filter toolbar and does not dump OCR text', () => {
  const html = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin section="sections" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />);
  assert.match(html, /class="site-sections__toolbar"/);
  assert.match(html, /aria-label="Filter sections by type"/);
  assert.match(html, /aria-label="Search sections"/);
  assert.match(html, /class="site-sections__count"[^>]*>2 sections<\/span>/);
  assert.doesNotMatch(html, /Open a capture to inspect/);
  assert.match(html, /<strong>Hero<\/strong>/);
  assert.match(html, /<strong>Navigation<\/strong>/);
  assert.ok(html.indexOf('<strong>Hero</strong>') < html.indexOf('<strong>Navigation</strong>'));
  assert.match(html, /<small>Home<\/small>/);
  assert.doesNotMatch(html, /All media/);
  assert.doesNotMatch(html, /Secret visible copy/);
  assert.doesNotMatch(html, /src="\/image"/);
  assert.doesNotMatch(html, /src="\/video"/);
  assert.match(html, /data-site-sections-grid="true"/);
  assert.doesNotMatch(html, /Select Hero Section|Save selected|site-sections__selection|site-section-tile__select/);
  assert.doesNotMatch(html, />Save</);
});

test('uses a consistent 16:10 frame for every Site section capture', () => {
  const pageSource = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  const imageCardSource = readFileSync(new URL('./components/MediaGridCard.tsx', import.meta.url), 'utf8');
  const videoCardSource = readFileSync(new URL('./components/SiteSectionVideoCard.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /preserveNaturalAspectRatio/);
  assert.match(pageSource, /imageFit="contain"/);
  assert.match(imageCardSource, /aspectRatio = '16 \/ 10'/);
  assert.match(videoCardSource, /aspectRatio: '16 \/ 10'/);
  assert.doesNotMatch(videoCardSource, /captureNaturalAspectRatio|onLoadedMetadata/);
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
    <SiteVersionView detail={withoutPatterns} isAdmin={false} section="sections" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );
  assert.match(html, /<strong>Home<\/strong>/);
  assert.doesNotMatch(html, /Unclassified/);
});

test('falls back legacy and unknown Site detail sections to Preview', () => {
  const unknown = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin={false} section="unknown" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />);
  const pages = renderToStaticMarkup(<SiteVersionView detail={detail} isAdmin={false} section="pages" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />);
  const html = `${unknown}${pages}`;
  assert.match(html, /<video[^>]+src="\/api\/sites\/1\/versions\/2\/media\/preview"/);
  assert.doesNotMatch(html, /Full-page capture/);
});

test('reuses the shared compact version selector and keeps the section inspector', () => {
  const html = renderToStaticMarkup(
    <SiteVersionView detail={detail} isAdmin={false} section="preview" onSectionChange={() => undefined} onVersionChange={() => undefined} onBack={() => undefined} />,
  );
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /triggerClassName="reference-detail__version-selector"/);
  assert.match(source, /<AstryxSingleSelectDropdown/);
  assert.match(html, /aria-label="Site version: Latest"/);
  assert.match(html, />Latest</);
  assert.doesNotMatch(html, /astryx-selector/);
  assert.match(html, /role="menuitem"/);
  assert.match(html, /aria-current="true"/);
  assert.doesNotMatch(html, /<select/);
  assert.match(source, /versions\.map/);
  assert.match(source, /SiteSectionInspector/);
  assert.match(source, /onInspectorChange\(inspectorItems\[index\]\?\.id/);
  assert.match(source, /onInspectorChange\(null\)/);
});

test('keeps Site loading and failures inside the detail frame', () => {
  const source = readFileSync(new URL('./components/SiteVersionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /function SiteVersionLoading/);
  assert.match(source, /<ReferenceDetailLoading kind="site" label="Loading Site details"/);
  assert.match(source, /Retry/);
});
