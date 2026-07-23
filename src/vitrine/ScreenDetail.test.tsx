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
        cat: 'Productivity',
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
  assert.match(html, /Analysis/);
  assert.match(html, /aria-label="Design System"/);
  assert.doesNotMatch(html, /Crawler/);
});

test('mounts App Knowledge only for the Analysis section and preserves route selections', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /section === 'analysis' \? <AppKnowledgePanel/);
  assert.match(source, /initialPlatform/);
  assert.match(source, /initialVersion/);
  assert.match(source, /initialEvidence/);
  assert.match(source, /initialFlow/);
  assert.match(source, /initialStep/);
});

test('does not use generic component or flow libraries', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ELEMENT_LIBRARY|FLOW_LIBRARY/);
});

test('animates the active platform indicator and platform content', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /layoutId="platform-active-indicator"/);
  assert.match(source, /\}, \[section, selectedPlatform\]\);/);
});

test('renders Apps through the shared reference detail shell', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceDetailShell \} from '.\/ReferenceDetailShell'/);
  assert.match(source, /<ReferenceDetailShell/);
});

test('renders Screens and UI Elements through the shared gallery section and grid', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ ReferenceGalleryGrid, ReferenceGallerySection \} from '.\/ReferenceGallerySection'/);
  assert.match(source, /<ReferenceGallerySection/);
  assert.match(source, /<ReferenceGalleryGrid/);
  assert.match(source, /section === 'screens' \|\| section === 'elements' \|\| section === 'flows'/);
  assert.match(source, /section === 'flows' \? <FlowsPanel flows=\{flows\}/);
});

test('renders metadata-only aggregate counts on Overview', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'claude', app: 'Claude', cat: 'AI', accent: '#d97757',
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
        cat: 'Shopping',
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
  assert.match(html, /role="tablist" aria-label="Platform"/);
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*aria-label="Web"/);
});
