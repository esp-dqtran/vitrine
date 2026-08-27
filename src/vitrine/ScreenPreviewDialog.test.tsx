import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenPreviewDialog } from './components/ScreenPreviewDialog.tsx';
import type { Screen } from './types.ts';

const screen: Screen = {
  id: 42,
  type: 'Order detail',
  productArea: 'Placing an order',
  theme: 'light',
  visibleStates: ['Default'],
  platform: 'ios',
  description: 'An observed Amazon Shopping order detail screen.',
  purpose: 'Review a completed order and its delivery details.',
  sourcePresentation: 'marketing-composite',
  embeddedPageType: 'Order tracking',
  url: '/media/order-detail.png',
  sourceUrl: 'https://www.amazon.com/orders/42',
  capturedAt: '2026-08-01T12:00:00.000Z',
  confidence: 0.93,
  componentNames: ['Status timeline', 'Order summary'],
  visibleText: ['Delivered', 'Track package'],
  layoutPatterns: ['Stacked detail sections'],
  icons: ['Package'],
  imagery: ['Product thumbnail'],
  contentPatterns: ['Metadata row'],
  interactionPatterns: ['Disclosure'],
  responsiveViewport: 'mobile',
  uiElements: [
    {
      type: 'Button',
      group: 'Control',
      layer: 'embedded-ui',
      confidence: 0.91,
      reviewStatus: 'accepted',
    },
    {
      type: 'Top Navigation Bar',
      group: 'View',
      layer: 'embedded-ui',
      confidence: 0.86,
      reviewStatus: 'accepted',
    },
  ],
};

test('renders a Mobbin-style app screen viewer with identity, navigation, actions, and metadata', () => {
  const html = renderToStaticMarkup(
    <ScreenPreviewDialog
      appName="Amazon Shopping"
      appIconUrl="/media/amazon-icon.png"
      screen={screen}
      index={1}
      total={3}
      foundInFlows={['Placing an order', 'Order detail']}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /data-app-screen-preview="42"/);
  assert.match(html, /Amazon Shopping/);
  assert.match(html, /aria-label="Previous screen"/);
  assert.match(html, /aria-label="Next screen"/);
  assert.match(html, />Found in</);
  assert.match(html, /Placing an order \+1/);
  assert.match(html, />Save</);
  assert.match(html, />Copy image</);
  assert.doesNotMatch(html, /Copy as PNG/);
  assert.doesNotMatch(html, /aria-label="More screen actions"/);
  assert.match(html, /iOS \(393×852\)/);
  assert.match(html, />More info</);
  assert.match(html, /aria-controls="screen-analysis-42"/);
  assert.match(html, /aria-label="Screen analysis"/);
  assert.doesNotMatch(html, />Purpose</);
  assert.doesNotMatch(html, /Review a completed order and its delivery details/);
  assert.match(html, />Visual description</);
  assert.match(html, />Page Types</);
  assert.match(html, />Order detail</);
  assert.match(html, />Order tracking</);
  assert.match(html, />UI Elements</);
  assert.match(html, />Button</);
  assert.match(html, />Top Navigation Bar</);
  assert.doesNotMatch(html, />Theme</);
  assert.doesNotMatch(html, />Viewport</);
  assert.doesNotMatch(html, />Visible states</);
  assert.doesNotMatch(html, />Components</);
  assert.doesNotMatch(html, />Layout patterns</);
  assert.equal((html.match(/>Found in</g) ?? []).length, 1);
  assert.match(html, /aria-label="Evidence trust details"/);
  assert.match(html, />93%</);
  assert.match(html, />Not assessed</);
  assert.match(html, />Correct this evidence</);
});

test('shows the complete web capture in the wide preview frame', () => {
  const html = renderToStaticMarkup(
    <ScreenPreviewDialog
      appName="Aboard"
      screen={{ ...screen, platform: 'web' }}
      index={0}
      total={1}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );

  assert.match(
    html,
    /flow-preview-dialog app-screen-preview-dialog flow-preview-dialog--web/,
  );
});

test('closes only when the empty preview stage is clicked', () => {
  const source = readFileSync(
    new URL('./components/ScreenPreviewDialog.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    source,
    /app-screen-preview-dialog__stage"[\s\S]*?onClick=\{onClose\}/,
  );
  assert.match(
    source,
    /app-screen-preview-dialog__screen"[\s\S]*?onClick=\{\(event\) => event\.stopPropagation\(\)\}/,
  );
});

test('uses compact dark arrows and direction-aware screen transitions', () => {
  const source = readFileSync(
    new URL('./components/ScreenPreviewDialog.tsx', import.meta.url),
    'utf8',
  );
  const css = readFileSync(new URL('./flowPreviewDialog.css', import.meta.url), 'utf8');

  assert.match(source, /setNavigationDirection\('previous'\)/);
  assert.match(source, /setNavigationDirection\('next'\)/);
  assert.match(source, /data-navigation-direction=\{navigationDirection \?\? undefined\}/);
  assert.match(source, /key=\{displayedMedia\?\.screenId \?\? screen\.id\}/);
  assert.match(css, /\.flow-preview-dialog__arrow\s*\{[^}]*width:\s*44px\s*!important;[^}]*height:\s*44px\s*!important;[^}]*background:\s*var\(--vitrine-color-page\)\s*!important;/);
  assert.match(css, /@keyframes appScreenPreviewEnterNext[\s\S]*translateX\(28px\)/);
  assert.match(css, /@keyframes appScreenPreviewEnterPrevious[\s\S]*translateX\(-28px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*data-navigation-direction[\s\S]*animation:\s*none/);
});

test('prefetches adjacent screens and keeps the current image until the next one is decoded', () => {
  const source = readFileSync(
    new URL('./components/ScreenPreviewDialog.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /previousScreen\?: Screen \| null/);
  assert.match(source, /nextScreen\?: Screen \| null/);
  assert.match(source, /useDeliveredImageUrl\(previousScreen\?\.url/);
  assert.match(source, /useDeliveredImageUrl\(nextScreen\?\.url/);
  assert.match(source, /const preload = new Image\(\)/);
  assert.match(source, /await preload\.decode\(\)/);
  assert.match(source, /setDisplayedMedia\(\{/);
});

test('reveals preview navigation on hover, arrow focus, and non-hover devices', () => {
  const css = readFileSync(new URL('./flowPreviewDialog.css', import.meta.url), 'utf8');

  assert.match(css, /\.flow-preview-dialog__arrow\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/);
  assert.match(css, /\.flow-preview-dialog:hover \.flow-preview-dialog__arrow/);
  assert.match(css, /\.flow-preview-dialog__arrow:focus-visible/);
  assert.match(css, /@media \(hover:\s*none\)[\s\S]*\.flow-preview-dialog__arrow[\s\S]*opacity:\s*1/);
});

test('does not emit a native protected-media request from the screen viewer', () => {
  const html = renderToStaticMarkup(
    <ScreenPreviewDialog
      appName="Aboard"
      screen={{ ...screen, url: '/api/media/aboard/0123456789abcdef' }}
      index={0}
      total={1}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /src="\/api\/media\//);
  assert.doesNotMatch(html, /Captured preview unavailable/);
  assert.match(html, /aria-label="Aboard screen viewer"/);
});

test('keeps next navigation available when another screen page can be loaded', () => {
  const html = renderToStaticMarkup(
    <ScreenPreviewDialog
      appName="Aboard"
      screen={{ ...screen, platform: 'web' }}
      index={15}
      total={624}
      canNavigateNext
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Previous screen"/);
  assert.match(html, /aria-label="Next screen"/);
  assert.match(html, /aria-label="Aboard screen 16 of 624"/);
});
