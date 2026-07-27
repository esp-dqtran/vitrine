import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenDetail } from './components/ScreenDetail.tsx';

test('offers the generated design system alongside screens, elements, and flows', () => {
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
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.doesNotMatch(html, /aria-label="Analysis"/);
  assert.match(html, /aria-label="Design System"/);
  assert.doesNotMatch(html, /Crawler/);
});

test('does not expose capture version controls in app detail', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import \{ VersionPanel \}/);
  assert.doesNotMatch(source, /<VersionPanel/);
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

test('animates the active platform indicator and platform content', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  const switcherSource = readFileSync(new URL('./components/AppsPlatformSwitcher.tsx', import.meta.url), 'utf8');
  assert.match(switcherSource, /--apps-platform-indicator-shift/);
  assert.match(source, /\}, \[section, selectedPlatform\]\);/);
});

test('renders Apps through the shared reference detail shell', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceDetailShell \} from '.\/ReferenceDetailShell'/);
  assert.match(source, /<ReferenceDetailShell/);
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

  assert.match(html, /<h1>Linear —<\/h1>/);
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
  assert.match(html, /class="reference-discovery-nav apps-top-nav"/);
  assert.match(html, /Apps/);
  assert.match(html, /Sites/);
  assert.match(html, /Search on Web\.\.\./);
  assert.doesNotMatch(html, /Import App/);
  assert.match(html, /Account/);
});

test('renders Screens and UI Elements through the shared gallery section and grid', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceGalleryGrid, ReferenceGallerySection \} from '.\/ReferenceGallerySection'/);
  assert.match(source, /<ReferenceGallerySection/);
  assert.match(source, /<ReferenceGalleryGrid/);
  assert.match(source, /minCardWidth=\{360\}/);
  assert.match(source, /columns=\{section === 'screens' \|\| section === 'elements' \? 2 : undefined\}/);
  assert.match(source, /section === 'screens' \|\| section === 'elements' \|\| section === 'flows'/);
  assert.match(source, /section === 'flows'\s*\?\s*<FlowsPanel[\s\S]*flows=\{flows\}/);
});

test('renders metadata-only aggregate counts on Overview', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'claude', app: 'Claude', categories: [{ id: 3, name: 'AI', slug: 'ai' }], accent: '#d97757',
        totalScreens: 120, totalUiElements: 31, totalFlows: 7,
        analyzedScreens: 115, platforms: ['ios', 'android'],
      }}
      onBack={() => undefined}
    />
  );
  assert.match(html, /120/);
  assert.match(html, /31/);
  assert.match(html, /7/);
  assert.match(html, /115 analyzed/);
  assert.doesNotMatch(html, /Capture versions/);
  assert.doesNotMatch(html, /Complete observed design system/);
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

test('exposes UI-element totals with the existing app-version count projection', () => {
  const source = readFileSync(new URL('../db.ts', import.meta.url), 'utf8');
  assert.match(source, /ui_element_count: number/);
  assert.match(source, /AS ui_element_count/);
});

test('shows only Screens, UI Elements, and Flows to members', () => {
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
  assert.match(html, /aria-label="UI Elements"/);
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
  assert.match(source, /<AppsPlatformSwitcher/);
});

test('renders App section totals at the readable navigation scale', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /tabTrailing=\{<span style=\{\{ fontSize: 16,/);
});

test('uses a compact App-only detail header without promoting a content section', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__hero\s*\{[^}]*min-height:\s*auto;/,
  );
  assert.match(
    css,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__hero-inner\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*80px minmax\(0,\s*1fr\) auto;[^}]*grid-template-areas:\s*"logo heading actions"\s*"logo metadata actions";/,
  );
  assert.match(
    css,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__logo\s*\{[^}]*grid-area:\s*logo;[^}]*width:\s*80px;[^}]*height:\s*80px;[^}]*margin-bottom:\s*0;/,
  );
  assert.match(
    css,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__metadata\s*\{[^}]*grid-area:\s*metadata;[^}]*gap:\s*32px;[^}]*padding-top:\s*0;/,
  );
  assert.match(
    css,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__actions\s*\{[^}]*grid-area:\s*actions;[^}]*align-self:\s*center;[^}]*padding:\s*0;/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-detail\[data-reference-detail='app'\] \.reference-detail__hero-inner\s*\{[^}]*display:\s*flex;[^}]*padding-top:\s*24px;[^}]*padding-bottom:\s*20px;/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-detail\[data-reference-detail='app'\] \.reference-detail__metadata\s*\{[^}]*width:\s*100%;[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)[\s\S]*\.reference-detail\[data-reference-detail='app'\] \.reference-detail__actions\s*\{[^}]*width:\s*100%;[^}]*padding:\s*18px 0 0;/,
  );
  assert.doesNotMatch(css, /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button:nth-child/);
  assert.doesNotMatch(css, /\.reference-detail\[data-reference-detail='site'\] \.reference-detail__hero\s*\{/);
});
