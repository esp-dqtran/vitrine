import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SiteVersionDetail } from './types.ts';
import {
  curateTokens,
  SiteDesignSystemPanel,
  siteDesignSystemForDetail,
} from './components/SiteDesignSystemPanel.tsx';
import { ColorSection, LayoutTokensSection, TypographySection, swatchTextColor } from './components/DesignSystemShowcase.tsx';

test('uses a readable foreground for both dark and light palette swatches', () => {
  assert.equal(swatchTextColor('rgb(45, 45, 45)'), '#fff');
  assert.equal(swatchTextColor('rgb(248, 248, 248)'), '#101114');

  const html = renderToStaticMarkup(<ColorSection index={1} tokens={[
    { id: 'dark', kind: 'color', name: 'Text', value: 'rgb(45, 45, 45)', role: 'Observed text color', evidence: [] },
    { id: 'light', kind: 'color', name: 'Background', value: 'rgb(248, 248, 248)', role: 'Observed background color', evidence: [] },
  ]} />);

  assert.match(html, /background:rgb\(45, 45, 45\);color:#fff/);
  assert.match(html, /background:rgb\(248, 248, 248\);color:#101114/);
});

test('curates typography into a semantic scale from largest to smallest', () => {
  const typography = curateTokens([
    { id: 'body', kind: 'typography', name: 'body', value: 'Figma Sans / 14.4px / 400 / 20px / normal', role: 'Observed interface text value', evidence: ['one'] },
    { id: 'heading', kind: 'typography', name: 'heading', value: 'Figma Sans / 24px / 400 / 30px / normal', role: 'Observed heading text value', evidence: ['one'] },
    { id: 'display', kind: 'typography', name: 'display', value: 'Figma Sans / 94px / 400 / 82px / -4.32px', role: 'Observed heading text value', evidence: ['one'] },
    { id: 'display-alt', kind: 'typography', name: 'display-alt', value: 'Figma Sans / 94px / 400 / 80px / -4.32px', role: 'Observed heading text value', evidence: ['two'] },
    { id: 'heading-bold', kind: 'typography', name: 'heading-bold', value: 'Figma Sans / 24px / 700 / 30px / normal', role: 'Observed heading text value', evidence: ['one'] },
    { id: 'caption', kind: 'typography', name: 'caption', value: 'Figma Sans / 12px / 400 / 14px / normal', role: 'Observed interface text value', evidence: ['one'] },
  ], 'typography');

  assert.deepEqual(typography.map((token) => token.name), ['Display', 'Heading / Bold', 'Heading', 'Body', 'Caption']);
});

test('renders clean designer typography specs while retaining raw values elsewhere', () => {
  const html = renderToStaticMarkup(
    <TypographySection
      index={1}
      tokens={[{ id: 'display', kind: 'typography', name: 'Display', value: '"Figma Sans Regular", Arial, sans-serif / 94px / 400 / 81.9999px / -4.32px', role: 'Observed heading text value', evidence: Array.from({ length: 12 }, (_, index) => String(index)) }]}
    />,
  );

  assert.match(html, /94 \/ 82/);
  assert.match(html, /Regular · 400/);
  assert.match(html, /Figma Sans Regular/);
  assert.match(html, /Observed in 12 elements/);
  assert.doesNotMatch(html, /ds-type__measure">[^<]*81\.9999|ds-type__family">[^<]*Arial/);
});

test('curates layout tokens into a usable scale and removes absent borders', () => {
  const spacing = curateTokens([
    { id: 'space-negative', kind: 'spacing', name: 'Negative margin', value: '-2.16px', role: 'Observed interface margin value', evidence: ['one'] },
    { id: 'space-noise', kind: 'spacing', name: 'Subpixel padding', value: '1.08px', role: 'Observed interface padding value', evidence: ['one'] },
    { id: 'space-small', kind: 'spacing', name: 'Small gap', value: '9.36px', role: 'Observed interface gap value', evidence: ['one'] },
    { id: 'space-medium', kind: 'spacing', name: 'Action gap', value: '18px', role: 'Observed action gap value', evidence: ['two'] },
    { id: 'space-large', kind: 'spacing', name: 'Page margin', value: '28.8px', role: 'Observed interface margin value', evidence: ['three'] },
  ], 'spacing');
  const radius = curateTokens([
    { id: 'radius-tight', kind: 'radius', name: 'Tight radius', value: '2.16px', role: 'Observed interface corner value', evidence: ['one'] },
    { id: 'radius-surface', kind: 'radius', name: 'Surface radius', value: '10.08px', role: 'Observed interface corner value', evidence: ['two'] },
  ], 'radius');
  const borders = curateTokens([
    { id: 'border-none', kind: 'border', name: 'No border', value: '0px none rgb(255, 255, 255)', role: 'Observed interface boundary value', evidence: ['one'] },
    { id: 'border-stroke', kind: 'border', name: 'Action boundary', value: '1px solid rgb(37, 37, 37)', role: 'Observed action boundary value', evidence: ['two'] },
  ], 'border');

  assert.deepEqual(spacing.map((token) => token.value), ['8px', '16px', '32px']);
  assert.deepEqual(radius.map((token) => token.value), ['2px', '10px']);
  assert.deepEqual(borders.map((token) => token.value), ['1px solid rgb(37, 37, 37)']);

  const html = renderToStaticMarkup(<LayoutTokensSection index={3} spacing={spacing} radius={radius} border={borders} />);
  assert.match(html, /Spacing &amp; Borders/);
  assert.match(html, /Space 8/);
  assert.match(html, /Tight/);
  assert.match(html, /1px solid/);
  assert.doesNotMatch(html, /0px none/);
});

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
        summary: 'A high-contrast product design language with 4 design tokens and 1 component family.',
        provenance: {
          provider: 'vitrines',
          sourceUrl: 'https://example.com/',
          originalUrl: 'https://example.com/',
          attribution: 'Analyzed from the rendered public page',
          theme: 'dark',
          northStar: 'Make the primary action obvious.',
        },
        tokens: [
          {
            id: 'site-color-accent',
            kind: 'color',
            name: 'Action Surface',
            value: 'rgb(115, 92, 255)',
            role: 'Observed action surface value',
            evidence: ['STRUCTURE-1'],
            confidence: 0.9,
            reviewStatus: 'needs_review',
          },
          {
            id: 'site-spacing',
            kind: 'spacing',
            name: 'Action Gap',
            value: '16px',
            role: 'Observed action gap value',
            evidence: ['STRUCTURE-1'],
          },
          {
            id: 'site-effect',
            kind: 'effect',
            name: 'Action Filter',
            value: 'blur(8px)',
            role: 'Observed action filter value',
            evidence: ['STRUCTURE-1'],
          },
          {
            id: 'site-border-color',
            kind: 'color',
            name: '--border--soft--grey-200',
            value: '#d0d0d2',
            role: 'Observed border color token',
            evidence: ['STRUCTURE-1'],
          },
        ],
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
            confidence: 0.9,
            reviewStatus: 'needs_review',
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

  assert.match(html, /aria-label="Design system"/);
  assert.doesNotMatch(html, /Design system analysis|Example design system|Vitrines · Observed evidence/);
  assert.match(html, /Color palette/);
  assert.match(html, /data-design-system-section="color"/);
  assert.match(html, /data-design-system-section="spacing"/);
  assert.doesNotMatch(html, /data-design-system-section="effect"/);
  assert.match(html, /rgb\(115, 92, 255\)/);
  assert.match(html, /ds-color__hex/);
  assert.doesNotMatch(html, /Border \/ Soft \/ Grey \/ 200/);
  assert.match(html, /<div class="ds-foundations-panel__content" data-design-system-section="spacing">/);
  assert.doesNotMatch(html, /<details class="ds-foundations-panel"[^>]*data-design-system-section="spacing">/);
  assert.match(html, /Spacing &amp; Borders/);
  assert.doesNotMatch(html, /Visual effects|data-effect-type="filter"/);
  assert.doesNotMatch(html, /## Effect|Action Filter/);
  assert.doesNotMatch(html, /Usage patterns/);
  assert.doesNotMatch(html, /Living styleguide|ds-toolbar|ds-canvas__intro|ds-canvas__showcase/);
  assert.match(html, /class="ds-canvas__theme-control"/);
  assert.match(html, /aria-label="Preview theme"/);
  assert.match(html, /Light/);
  assert.match(html, /Dark/);
  assert.doesNotMatch(html, /data-design-system-section="components"|Component gallery|Observed components|Inferred preview/);
  assert.doesNotMatch(html, /## Components/);
  assert.doesNotMatch(html, /component family/);
  assert.match(html, /DESIGN\.md/);
  assert.match(html, /Tailwind v4/);
  assert.match(html, /CSS Variables/);
  assert.match(html, /Design Tokens/);
  assert.match(html, /\/api\/sites\/1\/versions\/2\/page\.png/);
  assert.match(html, /background: #1f1f22/);
  assert.match(html, /ds-reference-pane__copy/);
  assert.doesNotMatch(html, /Needs review|90% confidence/);

  const adminHtml = renderToStaticMarkup(<SiteDesignSystemPanel detail={detail} isAdmin />);
  assert.match(adminHtml, /Raw extraction evidence/);
  assert.match(adminHtml, /Needs review/);
  assert.match(adminHtml, /90% confidence/);
  assert.match(adminHtml, /Usage patterns/);
  const adminReferenceHtml = adminHtml.slice(adminHtml.indexOf('<aside class="ds-reference-pane"'));
  assert.match(adminReferenceHtml, /## Usage rules/);
  assert.doesNotMatch(adminReferenceHtml, /## Effect|Action Filter|## Components|Button/);
});

test('uses the captured Site video preview in the design-system hero when available', () => {
  const detail = {
    routeSlug: 'example-video',
    site: { id: 1, name: 'Example', slug: 'example', sourceUrl: 'https://example.com/' },
    version: {
      id: 2,
      label: 'Latest',
      isLatest: true,
      previewUrl: '/api/sites/1/versions/2/preview.mp4',
      posterUrl: '/api/sites/1/versions/2/poster.webp',
      previewMediaKind: 'video' as const,
    },
    versionOptions: [],
    canonicalUrl: 'https://example.com/',
    analysisStatus: 'ready' as const,
    analysis: {
      schemaVersion: 1,
      status: 'ready' as const,
      evidence: [], structure: [], visualTokens: [], motion: [], technology: [], responsive: [], synthesis: null, warnings: [],
      designSystem: {
        app: 'Example', generatedAt: '2026-08-03T00:00:00.000Z', tokens: [], components: [], flows: [], rules: [],
      },
    },
    pages: [{
      id: 3, sourceId: 'page', title: 'Example', url: 'https://example.com/', position: 0,
      fullPageImageUrl: '/api/sites/1/versions/2/page.png', sections: [],
    }],
  } satisfies SiteVersionDetail;

  const html = renderToStaticMarkup(<SiteDesignSystemPanel detail={detail} />);

  assert.match(html, /data-site-design-system-preview-video="true"/);
  assert.match(html, /src="\/api\/sites\/1\/versions\/2\/preview\.mp4"/);
  assert.match(html, /poster="\/api\/sites\/1\/versions\/2\/poster\.webp"/);
  assert.doesNotMatch(html, /<img[^>]+page\.png/);
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
