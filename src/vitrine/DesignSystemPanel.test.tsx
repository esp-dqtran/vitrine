import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignSystemPanel, designSystemMarkdown } from './components/DesignSystemPanel.tsx';

test('renders observed foundations with evidence counts', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'linear',
    generatedAt: '2026-07-10T00:00:00.000Z',
    tokens: [
      { id: 'color-primary', kind: 'color', name: 'Primary', value: '#5E6AD2', role: 'primary action', evidence: [{ imageId: 7, imageUrl: '/api/media/linear/a', description: 'Toolbar' }] },
      { id: 'space-8', kind: 'spacing', name: 'Space 8', value: '8px', role: 'control gap', evidence: [{ imageId: 8, imageUrl: '/api/media/linear/b', description: 'Form' }] },
    ],
    components: [],
    flows: [],
  }} status="ready" />);
  assert.match(html, /Color palette/);
  assert.match(html, /#5E6AD2/);
  assert.match(html, /Spacing rhythm/);
  assert.match(html, /1 source screen/);
});

test('renders observed components from their reconstruction spec, and rules grouped by kind', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'linear',
    generatedAt: '2026-07-10T00:00:00.000Z',
    tokens: [],
    components: [{
      id: 'button', name: 'Button', category: 'Actions', description: 'Triggers an action',
      variants: [{
        id: 'primary', name: 'Primary', description: 'Filled action', evidence: [{ imageId: 7, imageUrl: '/api/media/linear/a', description: 'Hero' }],
        confidence: 0.94, reviewStatus: 'reviewed',
        reconstruction: { layoutMode: 'HORIZONTAL', width: 120, height: 36, padding: 8, radius: 8, fill: '#5E6AD2', visibleText: 'Continue' },
      }],
    }],
    flows: [],
    rules: [{ id: 'rule-1', kind: 'layout', name: 'Full-bleed cards', description: 'Signature cards run edge to edge', evidence: [{ imageId: 7, imageUrl: '/api/media/linear/a', description: 'Hero' }] }],
  }} status="ready" />);
  assert.match(html, /Button/);
  assert.match(html, /Continue/);
  assert.match(html, /Reviewed/);
  assert.match(html, /94% confidence/);
  assert.match(html, /Full-bleed cards/);
  assert.match(html, /layout/i);
});

test('renders an evidence-free imported system as visible native UI', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'linear', generatedAt: '2026-07-22T00:00:00.000Z', summary: 'Dark, precise product UI.',
    tokens: [
      { id: 'primary', kind: 'color', name: 'Primary', value: '#5e6ad2', role: 'Brand', evidence: [] },
      { id: 'display', kind: 'typography', name: 'Display', value: 'font-family: Linear; font-size: 56px; font-weight: 600', role: 'Display', evidence: [] },
    ],
    components: [{ id: 'button', name: 'Button', category: 'Components', description: 'Primary action', variants: [{ id: 'button-default', name: 'Default', description: 'Default action', evidence: [], reconstruction: { fill: '#5e6ad2', radius: 8, visibleText: 'Button' } }] }],
    flows: [], rules: [{ id: 'responsive', kind: 'responsive', name: 'Responsive behavior', description: 'Use one column below 720px.', evidence: [] }],
  }} status="ready" />);
  assert.match(html, /Design system analysis/);
  assert.match(html, /Dark, precise product UI/);
  assert.match(html, /#5e6ad2/);
  assert.match(html, /font-size:\s*56px/);
  assert.match(html, /Button/);
  assert.match(html, /Responsive behavior/);
  assert.doesNotMatch(html, /source screen|confidence|Reviewed|Needs review/i);
});

test('shows concise actionable patterns and keeps their full guidance on demand', () => {
  const longGuidance = 'Collapse secondary table columns on compact screens so the asset, price, and primary action remain visible. Preserve access to lower-priority market metrics in an expanded row instead of squeezing every value into the viewport.';
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'binance', generatedAt: '2026-07-22T00:00:00.000Z', tokens: [], components: [], flows: [],
    rules: [
      { id: 'overview', kind: 'layout', name: 'Overview', description: 'A long product introduction that is reference material, not a usage pattern.', evidence: [] },
      { id: 'responsive', kind: 'responsive', name: 'Responsive behavior', description: longGuidance, evidence: [] },
      { id: 'observed', kind: 'layout', name: 'Full-bleed cards', description: 'Signature cards run edge to edge.', evidence: [{ imageId: 7, imageUrl: '/api/media/binance/a', description: 'Markets' }] },
    ],
  }} status="ready" />);

  assert.doesNotMatch(html, />Overview</);
  assert.match(html, /Collapse secondary table columns on compact screens/);
  assert.match(html, /<summary>View details<\/summary>/);
  assert.match(html, /Full-bleed cards/);
  assert.match(html, /<strong>2<\/strong> patterns/);
});

test('opens imported systems as a specimen-first preview with document and theme controls', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'binance', generatedAt: '2026-07-22T00:00:00.000Z', summary: 'Bold yellow accents on precise trading surfaces.',
    tokens: [
      { id: 'brand-yellow', kind: 'color', name: 'Brand Yellow', value: '#f0b90b', role: 'Primary action', evidence: [] },
      { id: 'heading-xl', kind: 'typography', name: 'Heading XL', value: 'font-size: 48px; font-weight: 600; line-height: 1.1', role: 'Page title', evidence: [] },
      { id: 'space-4', kind: 'spacing', name: 'Space 4', value: '16px', role: 'Control gap', evidence: [] },
    ],
    components: [{
      id: 'button', name: 'Button', category: 'Actions', description: 'High-emphasis action',
      variants: [{ id: 'primary', name: 'Primary', description: 'Yellow filled action', evidence: [], reconstruction: { fill: '#f0b90b', radius: 8, visibleText: 'Start trading' } }],
    }],
    flows: [], rules: [],
  }} status="ready" />);

  assert.match(html, /aria-checked="true"[^>]*><span>Preview<\/span>/);
  assert.match(html, /aria-checked="false"[^>]*><span>DESIGN\.md<\/span>/);
  assert.match(html, />Light</);
  assert.match(html, /aria-checked="true"[^>]*><span>Dark<\/span>/);
  assert.match(html, /Color palette/);
  assert.match(html, /Typography scale/);
  assert.match(html, /Component gallery/);
  assert.match(html, /Start trading/);
  assert.match(html, /Primary action/);
});

test('formats the loaded snapshot as a developer-readable DESIGN.md document', () => {
  const markdown = designSystemMarkdown({
    app: 'binance', generatedAt: '2026-07-22T00:00:00.000Z', summary: 'Bold trading interface.',
    tokens: [
      { id: 'brand-yellow', kind: 'color', name: 'Brand Yellow', value: '#f0b90b', role: 'Primary action', evidence: [] },
      { id: 'space-4', kind: 'spacing', name: 'Space 4', value: '16px', role: 'Control gap', evidence: [] },
    ],
    components: [{
      id: 'button', name: 'Button', category: 'Actions', description: 'High-emphasis action',
      variants: [{ id: 'primary', name: 'Primary', description: 'Yellow filled action', evidence: [] }],
    }],
    flows: [],
    rules: [{ id: 'responsive', kind: 'responsive', name: 'Responsive tables', description: 'Collapse secondary columns.', evidence: [] }],
  });

  assert.match(markdown, /^# Binance Design System/m);
  assert.match(markdown, /## Colors/);
  assert.match(markdown, /`#f0b90b` — Primary action/);
  assert.match(markdown, /## Spacing/);
  assert.match(markdown, /### Button/);
  assert.match(markdown, /\*\*Primary\*\*: Yellow filled action/);
  assert.match(markdown, /## Responsive/);
  assert.match(markdown, /Responsive tables/);
});

test('renders market-table components as realistic product UI', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'binance', generatedAt: '2026-07-22T00:00:00.000Z',
    tokens: [{ id: 'ink', kind: 'color', name: 'Ink', value: '#181a20', role: 'Canvas', evidence: [] }],
    components: [{
      id: 'markets-table', name: 'Markets Table Card', category: 'Components', description: 'Compact trading market overview.',
      variants: [{ id: 'default', name: 'Default', description: 'Dark market table', evidence: [], reconstruction: { fill: '#1e2329', radius: 12 } }],
    }],
    flows: [], rules: [],
  }} status="ready" />);

  assert.match(html, /BTC\/USDT/);
  assert.match(html, /78,065\.04/);
  assert.match(html, /\+1\.42%/);
});

test('uses a source-neutral empty state', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'empty', generatedAt: '2026-07-22T00:00:00.000Z', tokens: [], components: [], flows: [], rules: [],
  }} status="ready" />);
  assert.match(html, /No design tokens, components, or rules are available for this app/);
  assert.doesNotMatch(html, /observed|evidence/i);
});
