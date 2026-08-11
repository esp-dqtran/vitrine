import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  appDetailTabs,
  appVisitSiteUrl,
  ScreenDetail,
  selectedScreensInSelectionOrder,
} from './components/ScreenDetail.tsx';
import { flowMatchesFilters, screenMatchesFilters } from './detailFilters.ts';

test('shows the Design System tab only when the App has a snapshot', () => {
  assert.deepEqual(appDetailTabs(false).map(({ id }) => id), [
    'screens',
    'flows',
  ]);
  assert.deepEqual(appDetailTabs(true).map(({ id }) => id), [
    'screens',
    'flows',
    'design-system',
  ]);

  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'linear',
        app: 'Linear',
        categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
        accent: '#5E6AD2',
        totalScreens: 0,
        totalUiElements: 0,
        totalFlows: 0,
      }}
      onBack={() => {}}
    />
  );
  assert.match(html, /Screens/);
  assert.doesNotMatch(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.doesNotMatch(html, /aria-label="Overview"/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Screens"/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.doesNotMatch(html, /app-detail__more-selector|More sections/);
  assert.doesNotMatch(html, /Design System/);
  assert.doesNotMatch(html, /aria-label="Review"/);
  assert.doesNotMatch(html, /Crawler/);
});

test('does not expose the crawler workspace in App information tabs', () => {
  assert.deepEqual(appDetailTabs(false).map(({ id }) => id), [
    'screens',
    'flows',
  ]);
  assert.equal(appDetailTabs(false).some(({ id }) => id === 'crawl'), false);
});

test('falls back removed Crawl selections to Screens', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      initialSection="crawl"
      app={{
        id: 'linear',
        app: 'Linear',
        categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
        accent: '#5E6AD2',
        totalScreens: 0,
        totalUiElements: 0,
        totalFlows: 0,
      }}
      onBack={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /AI Crawl|Intelligent crawler/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Screens"/);
});

test('falls back removed Review selections to Screens', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      initialSection="review"
      app={{
        id: 'linear',
        app: 'Linear',
        categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
        accent: '#5E6AD2',
        totalScreens: 0,
        totalUiElements: 0,
        totalFlows: 0,
      }}
      onBack={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /aria-label="Review"/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Screens"/);
});

test('preserves selection order when setting an AppCard preview', () => {
  const screens = [{ id: 10 }, { id: 20 }, { id: 30 }];
  const selected = new Set([30, 10, 20]);

  assert.deepEqual(
    selectedScreensInSelectionOrder(screens, selected).map(({ id }) => id),
    [30, 10, 20],
  );
});

test('does not expose capture version controls in app detail', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import \{ VersionPanel \}/);
  assert.doesNotMatch(source, /<VersionPanel/);
});

test('continues screen preview navigation across lazy gallery pages', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /index !== screens\.length \|\| !nextCursor \|\| loadingMore/);
  assert.match(source, /const nextPage = await loadMore\(\)/);
  assert.match(source, /showLightboxScreen\(index, nextPage\.screens\)/);
  assert.match(source, /total=\{Math\.max\(sectionTotals\.screens, screens\.length\)\}/);
  assert.match(source, /canNavigateNext=\{lightbox\.index < screens\.length - 1 \|\| Boolean\(nextCursor\)\}/);
});

test('removes App Knowledge analysis while preserving route selections', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /id: 'analysis'/);
  assert.doesNotMatch(source, /label: 'Analysis'/);
  assert.doesNotMatch(source, /<AppKnowledgePanel/);
  assert.match(source, /label: 'Design System'/);
  assert.match(source, /initialPlatform/);
  assert.match(source, /initialVersion/);
  assert.match(source, /initialEvidence/);
  assert.match(source, /onEvidenceChange/);
  assert.match(source, /SCREEN.*screen\.id/);
  assert.match(source, /initialFlow/);
  assert.match(source, /initialStep/);
  assert.match(source, /initialFlowView/);
});

test('forwards controlled Flow route state and an exact selection callback', () => {
  const source = readFileSync(
    new URL('./components/ScreenDetail.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /selectedFlowId=\{initialFlow\}/);
  assert.match(source, /selectedStep=\{initialStep\}/);
  assert.match(source, /selectedFlowView=\{initialFlowView\}/);
  assert.match(source, /onSelectionChange=\{\(flow, step, flowView\) => onFlowChange\?\.\(/);
  assert.match(source, /selectedPlatform/);
  assert.match(source, /sectionData\.resolvedVersion/);
  assert.match(source, /section === 'flows'\s*\?\s*<FlowsWorkspaceLoading/);
});

test('does not use generic component or flow libraries', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ELEMENT_LIBRARY|FLOW_LIBRARY/);
});

test('copies selected screens as one board without exposing image downloads', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /'Copy as board'/);
  assert.doesNotMatch(source, /Download originals?/);
  assert.doesNotMatch(source, /downloadScreenImages/);
  assert.match(source, /`Preparing \$\{copyProgress\.completed\} of \$\{copyProgress\.total\}`/);
  assert.match(source, /Board copied with \$\{result\.succeeded\} of/);
});

test('animates the active platform indicator and platform content', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  const switcherSource = readFileSync(new URL('./components/AppsPlatformSwitcher.tsx', import.meta.url), 'utf8');
  assert.match(switcherSource, /--apps-platform-indicator-shift/);
  assert.match(source, /\}, \[section, selectedPlatform\]\);/);
});

test('renders Apps through the generic reference detail page', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceDetailPage \} from '.\/ReferenceDetailPage'/);
  assert.match(source, /<ReferenceDetailPage/);
  assert.doesNotMatch(source, /<ReferenceDetailShell/);
  assert.doesNotMatch(source, /<ApplicationHeader/);
});

test('renders Export to Figma as the primary App detail action', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(
    source,
    /<HeroButton primary onClick=\{\(\) => setSection\('export'\)\}>Export to Figma<\/HeroButton>/,
  );
});

test('renders Visit Site beside the primary action when the App has a website', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'linear',
        app: 'Linear',
        categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
        accent: '#5E6AD2',
        totalScreens: 24,
        totalUiElements: 8,
        totalFlows: 3,
        websiteUrl: 'https://linear.app',
      }}
      onBack={() => undefined}
    />,
  );
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(html, />Export to Figma</);
  assert.match(html, />Visit Site</);
  assert.match(source, /window\.open\(visitSiteUrl, '_blank', 'noopener,noreferrer'\)/);
});

test('uses the selected platform version source for Visit Site', () => {
  assert.equal(appVisitSiteUrl([
    { version_number: 1, source_url: 'https://apps.apple.com/gb/app/cleo/id1447274646' },
  ], 1, 'https://play.google.com/store/apps/details?id=com.meetcleo.cleo'),
  'https://apps.apple.com/gb/app/cleo/id1447274646');
  assert.equal(appVisitSiteUrl([], undefined, 'https://cleo.com'), 'https://cleo.com');
});

test('does not fall back to a store URL for the wrong active platform', () => {
  assert.equal(appVisitSiteUrl(
    [], undefined, 'https://play.google.com/store/apps/details?id=com.example', 'ios',
  ), null);
  assert.equal(appVisitSiteUrl(
    [], undefined, 'https://apps.apple.com/us/app/example/id123456789', 'android',
  ), null);
  assert.equal(appVisitSiteUrl([], undefined, 'https://example.com', 'android'), 'https://example.com');
});

test('does not render a Back to all apps button in App detail', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: '15five',
        app: '15Five',
        categories: [{ id: 2, name: 'Business', slug: 'business' }],
        accent: '#ff4f1f',
        totalScreens: 610,
        totalUiElements: 610,
        totalFlows: 144,
      }}
      onBack={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /Back to all apps/);
  assert.doesNotMatch(html, /reference-detail__back/);
});

test('does not use Escape to leave an App detail page', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /if \(!lightbox\) return;/);
  assert.doesNotMatch(source, /else if \(event\.key === 'Escape'\) onBack\(\)/);
});

test('renders the App identity and interactive platform inside the reference metadata rhythm', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="user"
      app={{
        id: 'linear',
        app: 'Linear',
        categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
        accent: '#5E6AD2',
        totalScreens: 24,
        totalUiElements: 8,
        totalFlows: 3,
        description: 'Plan and build products together.',
        platforms: ['web'],
      }}
      onBack={() => undefined}
    />,
  );

  assert.match(html, /<h1>Linear<\/h1>/);
  assert.doesNotMatch(html, /<h1>Linear —<\/h1>/);
  assert.match(
    html,
    /reference-detail__metadata-item[^>]*><span>Platform<\/span><div role="radiogroup"[^>]*class="apps-platform-switcher"/,
  );
});

test('does not leave a dangling title dash when an App has no description', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="user"
      app={{
        id: 'mercor',
        app: 'Mercor',
        categories: [{ id: 1, name: 'Jobs & Recruitment', slug: 'jobs-recruitment' }],
        accent: '#7767ff',
        totalScreens: 190,
        totalUiElements: 190,
        totalFlows: 39,
      }}
      onBack={() => undefined}
    />,
  );

  assert.match(html, /<h1>Mercor<\/h1>/);
  assert.doesNotMatch(html, /<h1>Mercor —<\/h1>/);
});

test('reuses the Apps header on admin App detail', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: '15five',
        app: '15Five',
        categories: [{ id: 2, name: 'Business', slug: 'business' }],
        accent: '#ff4f1f',
        totalScreens: 610,
        totalUiElements: 610,
        totalFlows: 144,
      }}
      accountControls={<button>Account</button>}
      onOpenSearch={() => undefined}
      onBack={() => undefined}
    />,
  );

  assert.match(html, /data-reference-component="top-nav"/);
  assert.match(html, /class="reference-discovery-nav reference-detail-top-nav"/);
  assert.match(html, /Apps/);
  assert.match(html, /Sites/);
  assert.match(html, /Search on Web\.\.\./);
  assert.doesNotMatch(html, /Import App/);
  assert.match(html, /Account/);
});

test('keeps the Screens tab to one unlabelled screen gallery', () => {
  const source = readFileSync(
    new URL('./components/ScreenDetail.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /All screens/);
  assert.doesNotMatch(source, /loaded ·/);
  assert.doesNotMatch(source, /app-screen-highlights/);
  assert.doesNotMatch(source, /Flows using these screens/);
  assert.doesNotMatch(source, /rankHighlightedScreens/);
  assert.doesNotMatch(source, /rankFlowsForScreens/);
});

test('renders Screens and UI Elements through the shared gallery section and grid', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceGalleryGrid, ReferenceGallerySection \} from '.\/ReferenceGallerySection'/);
  assert.match(source, /<ReferenceGallerySection/);
  assert.match(source, /<ReferenceGalleryGrid/);
  assert.match(source, /minCardWidth=\{section === 'screens' \? 240 : 360\}/);
  assert.match(source, /columns=\{section === 'elements' \? 2 : undefined\}/);
  assert.match(source, /selectedPlatform === 'web'[\s\S]*?'web-screens'[\s\S]*?'mobile-screens'/);
  assert.match(source, /section === 'screens' \|\| section === 'elements' \|\| section === 'flows'/);
  assert.match(source, /section === 'flows'\s*\?\s*\(filteredFlows\.length[\s\S]*?<FlowsPanel[\s\S]*flows=\{filteredFlows\}/);
  assert.match(source, /foundInFlows=/);
});

test('falls back legacy Overview selections to Screens without rendering an Overview tab', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      initialSection="overview"
      app={{
        id: 'claude', app: 'Claude', categories: [{ id: 3, name: 'AI', slug: 'ai' }], accent: '#d97757',
        totalScreens: 120, totalUiElements: 31, totalFlows: 7,
        analyzedScreens: 115, platforms: ['ios', 'android'],
      }}
      onBack={() => undefined}
    />
  );
  assert.doesNotMatch(html, /aria-label="Overview"/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Screens"/);
  assert.doesNotMatch(html, /App overview/);
  assert.doesNotMatch(html, /115 analyzed/);
});

test('shows every platform reported by app metadata even when the first screen page is web-only', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'adidas',
        app: 'Adidas',
        categories: [{ id: 4, name: 'Shopping', slug: 'shopping' }],
        accent: '#000000',
        totalScreens: 615,
        totalUiElements: 80,
        totalFlows: 20,
        platforms: ['web', 'ios', 'android'],
      }}
      onBack={() => {}}
    />
  );

  assert.match(html, />Web</);
  assert.match(html, />iOS</);
  assert.match(html, />Android</);
  assert.match(html, /role="radiogroup" aria-label="App platform"/);
  assert.match(html, /role="radio"[^>]*aria-checked="true"[^>]*aria-label="Web"/);
});

test('shows full metadata totals before paginated Screens, UI Elements, and Flows finish loading', () => {
  const app = {
    id: 'zapier',
    app: 'Zapier',
    categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
    accent: '#ff4f00',
    totalScreens: 587,
    totalUiElements: 587,
    totalFlows: 117,
    platforms: ['web' as const],
  };
  const renderSection = (initialSection: 'screens' | 'elements' | 'flows') =>
    renderToStaticMarkup(
      <ScreenDetail
        collections={[]}
        onCollectionsChange={() => undefined}
        role="user"
        app={app}
        initialSection={initialSection}
        initialPlatform="web"
        initialVersion={1}
        onBack={() => undefined}
      />,
    );

  assert.match(renderSection('screens'), />587 screens</);
  assert.match(renderSection('elements'), />587 UI elements</);
  assert.match(renderSection('flows'), />117 flows</);
});

test('uses selected-version totals in the app hero and platform-specific detail classes', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /\{ label: 'Screens', value: String\(sectionTotals\.screens\) \}/);
  assert.match(source, /className=\{`app-detail app-detail--\$\{selectedPlatform\}`\}/);
});

test('exposes UI-element totals with the existing app-version count projection', () => {
  const source = readFileSync(new URL('../db.ts', import.meta.url), 'utf8');
  assert.match(source, /ui_element_count: number/);
  assert.match(source, /AS ui_element_count/);
});

test('shows only Screens and Flows to members', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="user"
      app={{
        id: 'linear',
        app: 'Linear',
        categories: [{ id: 1, name: 'Productivity', slug: 'productivity' }],
        accent: '#5E6AD2',
        totalScreens: 1,
        totalUiElements: 0,
        totalFlows: 0,
        description: 'Plan and build products together.',
        lastCapturedAt: '2026-07-25T00:00:00.000Z',
      }}
      accountControls={<button>Account</button>}
      onOpenSearch={() => undefined}
      onBack={() => undefined}
    />,
  );
  assert.match(html, /aria-label="Screens"/);
  assert.doesNotMatch(html, /aria-label="UI Elements"/);
  assert.match(html, /aria-label="Flows"/);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Screens"/);
  assert.doesNotMatch(html, /aria-label="Overview"/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.doesNotMatch(html, /aria-label="Design System"/);
  assert.doesNotMatch(html, /aria-label="Export"/);
  assert.doesNotMatch(html, /aria-label="Review"/);
  assert.doesNotMatch(html, /Export to Figma/);
  assert.match(html, /Plan and build products together\./);
  assert.match(html, /Last updated/);
  assert.match(html, /Search on Web\.\.\./);
  assert.match(html, /Account/);
});

test('renders detail platforms through the Apps platform switcher', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ AppsPlatformSwitcher \} from '.\/AppsPlatformSwitcher'/);
  assert.match(source, /onSectionChange\?\.\(section, platform\)/);
  assert.match(source, /<AppsPlatformSwitcher/);
});

test('renders the Mobbin-style App detail navigation rail with real version state and totals', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(source, /<AstryxSingleSelectDropdown[\s\S]*?ariaLabel="App version"/);
  assert.match(source, /label: version\.version_number === latestVersion\?\.version_number\s*\?\s*'Latest'/);
  assert.match(source, /className="reference-detail__section-total"/);
  assert.match(source, /<span>Showing<\/span>/);
  assert.match(
    css,
    /\.reference-detail__navigation\s*\{[^}]*min-height:\s*var\(--reference-nav-height\)/,
  );
  assert.match(
    css,
    /\.reference-detail__navigation\s*\{[^}]*gap:\s*24px/,
  );
  assert.match(
    css,
    /\.reference-detail__tabs\s*\{[^}]*gap:\s*24px;[^}]*justify-content:\s*flex-start;[^}]*flex:\s*0 1 auto/,
  );
  assert.match(
    css,
    /\.reference-detail__tab-controls\s*\{[^}]*padding-left:\s*24px;[^}]*border-left:\s*2px solid var\(--color-border\)/,
  );
  assert.match(
    css,
    /\.reference-detail__tab-trailing\s*\{[^}]*justify-content:\s*flex-end;[^}]*flex:\s*1 1 auto/,
  );
  assert.match(
    css,
    /\.reference-detail__version-selector\s*\{[^}]*min-width:\s*88px;[^}]*justify-content:\s*space-between !important;[^}]*font:\s*var\(--vitrine-type-label\) !important/,
  );
  assert.match(
    css,
    /\.reference-detail__section-total\s*\{[^}]*text-align:\s*right/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*?\.reference-detail__navigation\s*\{[^}]*grid-template-areas:[^}]*["']leading controls["'][^}]*["']tabs tabs["']/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*?\.reference-detail__tabs\s*\{[^}]*gap:\s*24px/,
  );
});

test('adds section-specific metadata filters for Screens, UI Elements, and Flows', () => {
  const renderSection = (initialSection: 'screens' | 'elements' | 'flows') => renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'shopee',
        app: 'Shopee',
        categories: [{ id: 5, name: 'Shopping', slug: 'shopping' }],
        accent: '#ee4d2d',
        totalScreens: 1625,
        totalUiElements: 320,
        totalFlows: 538,
        platforms: ['ios'],
      }}
      initialSection={initialSection}
      initialPlatform="ios"
      initialVersion={1}
      onBack={() => undefined}
    />,
  );
  const screensHtml = renderSection('screens');
  const elementsHtml = renderSection('elements');
  const flowsHtml = renderSection('flows');
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(screensHtml, /class="reference-detail__tab-controls"/);
  assert.match(screensHtml, /aria-label="Open Screens filters"/);
  assert.match(elementsHtml, /aria-label="Open UI Elements filters"/);
  assert.match(flowsHtml, /aria-label="Open Flows filters"/);
  assert.match(screensHtml, /class="[^"]*apps-filterbar__filter-button/);
  assert.match(source, /tabControls=\{activeMetadataFilter \?/);
  assert.match(source, /app-detail__navigation-tools/);
  assert.doesNotMatch(source, /adminSectionControl|More sections|app-detail__more-selector/);
  assert.doesNotMatch(screensHtml, />More</);
  assert.match(source, /<DiscoveryFilterMenu/);
  assert.match(source, /flows=\{filteredFlows\}/);
  assert.match(source, /No flows match these filters/);
  assert.match(source, /Found in Flows/);
  assert.doesNotMatch(source, /toolbar=\{section === 'screens'/);
  assert.doesNotMatch(source, /app-detail-screen-filter/);
  assert.doesNotMatch(css, /\.app-detail-screen-filter/);
  assert.match(css, /\.reference-detail__tab-controls \.astryx-dropdown-panel\s*\{/);
});

test('combines selections within a metadata group and intersects separate groups', () => {
  const screen = {
    id: 1,
    type: 'Checkout',
    productArea: 'Commerce',
    theme: 'light' as const,
    visibleStates: ['Loading', 'Error'],
    platform: 'ios',
    description: null,
    url: '/checkout.png',
    layoutPatterns: ['Multi-column'],
    componentNames: ['Button', 'Text field'],
  };

  assert.equal(screenMatchesFilters(screen, {
    types: ['Checkout', 'Account'],
    layouts: [],
    components: ['Button'],
    states: ['Error'],
  }), true);
  assert.equal(screenMatchesFilters(screen, {
    types: ['Checkout'],
    layouts: ['Single-column'],
    components: [],
    states: [],
  }), false);
});

test('filters flows by real groups, tags, interactions, and analyzed states', () => {
  const flow = {
    id: 'checkout-card',
    title: 'Pay with card',
    category: 'Checkout',
    description: 'Completes checkout with a saved card.',
    tags: ['Commerce', 'Payment'],
    steps: [{
      label: 'Confirm payment',
      interaction: 'Tap',
      evidence: [],
      analysis: {
        interaction: 'Tap primary action',
        visibleStates: ['Processing', 'Success'],
        systemFeedback: ['Progress indicator'],
        source: 'llm_inferred' as const,
      },
    }],
  };

  assert.equal(flowMatchesFilters(flow, {
    categories: ['Checkout'],
    tags: ['Payment', 'Account'],
    interactions: ['Tap primary action'],
    states: ['Success'],
  }), true);
  assert.equal(flowMatchesFilters(flow, {
    categories: ['Onboarding'],
    tags: [],
    interactions: [],
    states: [],
  }), false);
});

test('uses the shared compact detail header without promoting a content section', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.reference-detail__hero\s*\{[^}]*min-height:\s*auto;/,
  );
  assert.match(
    css,
    /\.reference-detail__hero-inner\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*80px minmax\(0,\s*1fr\) auto;[^}]*grid-template-areas:\s*"logo heading actions"\s*"logo metadata actions";/,
  );
  assert.match(
    css,
    /\.reference-detail__logo\s*\{[^}]*grid-area:\s*logo;[^}]*width:\s*80px;[^}]*height:\s*80px;[^}]*margin-bottom:\s*0;/,
  );
  assert.match(
    css,
    /\.reference-detail__metadata\s*\{[^}]*grid-area:\s*metadata;[^}]*gap:\s*32px;[^}]*padding-top:\s*0;/,
  );
  assert.match(
    css,
    /\.reference-detail__actions\s*\{[^}]*grid-area:\s*actions;[^}]*align-self:\s*center;[^}]*padding:\s*0;/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-detail__hero-inner\s*\{[^}]*display:\s*flex;[^}]*padding-top:\s*24px;[^}]*padding-bottom:\s*20px;/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-detail__metadata\s*\{[^}]*width:\s*100%;[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-detail__actions\s*\{[^}]*width:\s*100%;[^}]*padding:\s*18px 0 0;/,
  );
  assert.doesNotMatch(css, /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button:nth-child/);
  assert.doesNotMatch(css, /\.reference-detail\[data-reference-detail='(?:app|site)'\] \.reference-detail__hero\s*\{/);
});
