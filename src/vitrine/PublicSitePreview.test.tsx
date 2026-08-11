import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicSitePreviewModal } from './components/PublicSitePreviewModal.tsx';
import type { SiteSummary } from './types.ts';

const site: SiteSummary = {
  id: 12,
  versionId: 34,
  name: 'V7',
  slug: 'v-7',
  routeSlug: 'v-7',
  sourceUrl: 'https://v7labs.com/',
  description: 'Training data engine',
  logoUrl: '/v7-logo.svg',
  label: 'Jul 2026',
  isLatest: true,
  pageCount: 3,
  sectionCount: 12,
  previewUrl: '/v7-preview.webm',
  posterUrl: '/v7-poster.webp',
  previewMediaKind: 'video',
  previews: [
    { id: 1, title: 'Home', position: 0, url: '/v7-home.webp' },
    { id: 2, title: 'Pricing', position: 1, url: '/v7-pricing.webp' },
  ],
  updatedAt: '2026-08-11T00:00:00.000Z',
};

test('renders a Site media preview and blurred Design System teaser without a detail button', () => {
  const html = renderToStaticMarkup(
    <PublicSitePreviewModal site={site} onClose={() => undefined} onOpenDetail={() => undefined} />,
  );

  assert.match(html, /data-public-site-preview-modal="true"/);
  assert.match(html, /aria-label="Site preview"/);
  assert.match(html, /<video[^>]+src="\/v7-preview\.webm"/);
  assert.match(html, /poster="\/v7-poster\.webp"/);
  assert.match(html, /autoPlay=""/);
  assert.match(html, /loop=""/);
  assert.match(html, /pointer-events:none/);
  assert.doesNotMatch(html, /controls=""/);
  assert.match(html, /aria-label="Design system preview"/);
  assert.match(html, /data-public-site-design-system-preview="true"/);
  assert.match(html, /filter:blur\(8px\)/);
  assert.match(html, /View full design system/);
  assert.doesNotMatch(html, /Open full Site detail/);
  assert.doesNotMatch(html, /aria-label="Pages"/);
  assert.doesNotMatch(html, /\/v7-home\.webp/);
  assert.doesNotMatch(html, />Pricing</);
  assert.doesNotMatch(html, /UI Elements/);
  assert.doesNotMatch(html, /Flows/);
});

test('renders an image preview when no captured video is available', () => {
  const html = renderToStaticMarkup(
    <PublicSitePreviewModal
      site={{ ...site, previewMediaKind: 'image', previewUrl: '/v7-preview.webp' }}
      onClose={() => undefined}
      onOpenDetail={() => undefined}
    />,
  );

  assert.match(html, /src="\/v7-preview\.webp"/);
  assert.doesNotMatch(html, /<video/);
});
