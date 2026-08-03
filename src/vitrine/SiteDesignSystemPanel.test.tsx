import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SiteVersionDetail } from './types.ts';
import {
  SiteDesignSystemPanel,
  siteDesignSystemForDetail,
} from './components/SiteDesignSystemPanel.tsx';

test('renders an analyzed Site as a Refero-style design-system reference', () => {
  const detail = {
    routeSlug: 'example',
    site: { id: 1, name: 'Example', slug: 'example', sourceUrl: 'https://example.com/' },
    version: { id: 2, label: 'Latest', isLatest: true, previewUrl: '/preview.webp' },
    versionOptions: [],
    canonicalUrl: 'https://example.com/',
    analysisStatus: 'ready',
    analysis: {
      schemaVersion: 1,
      status: 'ready',
      evidence: [],
      structure: [],
      visualTokens: [],
      motion: [],
      technology: [],
      responsive: [],
      synthesis: null,
      warnings: [],
      designSystem: {
        app: 'Example',
        generatedAt: '2026-08-03T00:00:00.000Z',
        summary: 'A high-contrast product design language.',
        provenance: {
          provider: 'vitrines',
          sourceUrl: 'https://example.com/',
          originalUrl: 'https://example.com/',
          attribution: 'Analyzed from the rendered public page',
          theme: 'dark',
          northStar: 'Make the primary action obvious.',
        },
        tokens: [{
          id: 'site-color-accent',
          kind: 'color',
          name: 'Action Surface',
          value: 'rgb(115, 92, 255)',
          role: 'Observed action surface value',
          evidence: ['STRUCTURE-1'],
        }],
        components: [{
          id: 'site-component-button',
          name: 'Button',
          category: 'Interface',
          description: 'Observed button patterns from the rendered page.',
          variants: [{
            id: 'site-variant-primary',
            name: 'Primary',
            description: 'Rendered button instance.',
            evidence: ['STRUCTURE-1'],
          }],
        }],
        flows: [],
        rules: [{
          id: 'site-rule-layout',
          kind: 'layout',
          name: 'Page structure',
          description: 'Use one dominant hero action.',
          evidence: ['STRUCTURE-1'],
        }],
      },
    },
    pages: [{
      id: 3,
      sourceId: 'page',
      title: 'Example',
      url: 'https://example.com/',
      position: 0,
      fullPageImageUrl: '/api/sites/1/versions/2/page.png',
      sections: [],
    }],
  } satisfies SiteVersionDetail;

  const html = renderToStaticMarkup(<SiteDesignSystemPanel detail={detail} />);

  assert.match(html, /Example design system/);
  assert.match(html, /Foundations/);
  assert.match(html, /Button/);
  assert.match(html, /DESIGN\.md/);
  assert.match(html, /Tailwind v4/);
  assert.match(html, /CSS Variables/);
  assert.match(html, /Design Tokens/);
  assert.match(html, /\/api\/sites\/1\/versions\/2\/page\.png/);
});

test('derives the design-system view for previously captured Site evidence', () => {
  const detail = {
    routeSlug: 'legacy',
    site: { id: 1, name: 'Legacy', slug: 'legacy', sourceUrl: 'https://legacy.example/' },
    version: { id: 2, label: 'Latest', isLatest: true, previewUrl: '/preview.webp' },
    versionOptions: [{ id: 2, label: 'Latest', isLatest: true, updatedAt: '2026-08-03T00:00:00.000Z' }],
    canonicalUrl: 'https://legacy.example/',
    analysisStatus: 'evidence-only',
    analysis: {
      schemaVersion: 1,
      status: 'evidence-only',
      evidence: [{ id: 'STRUCTURE-0', kind: 'dom', value: 'button' }],
      structure: [{ id: 'STRUCTURE-0', tag: 'button', role: 'button', visible: true, text: 'Continue' }],
      visualTokens: [{
        id: 'VISUAL-0',
        structureId: 'STRUCTURE-0',
        color: 'rgb(255, 255, 255)',
        background: 'rgb(0, 0, 0)',
        fontFamily: 'Inter',
        fontSize: '16px',
      }],
      motion: [],
      technology: [],
      responsive: [],
      synthesis: null,
      warnings: [],
    },
    pages: [],
  } satisfies SiteVersionDetail;

  const system = siteDesignSystemForDetail(detail);

  assert.equal(system?.generatedAt, '2026-08-03T00:00:00.000Z');
  assert.ok(system?.tokens.some((token) => token.kind === 'color'));
  assert.ok(system?.components.some((component) => component.name === 'Button'));
});
