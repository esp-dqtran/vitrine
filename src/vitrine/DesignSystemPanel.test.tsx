import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignSystemPanel } from './components/DesignSystemPanel.tsx';

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
  assert.match(html, /Colors/);
  assert.match(html, /#5E6AD2/);
  assert.match(html, /Spacing/);
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
  assert.match(html, /layout/);
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
  assert.match(html, /Theme overview/);
  assert.match(html, /Dark, precise product UI/);
  assert.match(html, /#5e6ad2/);
  assert.match(html, /font-size:56px/);
  assert.match(html, /Button/);
  assert.match(html, /Responsive behavior/);
  assert.doesNotMatch(html, /source screen|confidence|Reviewed|Needs review/i);
});

test('uses a source-neutral empty state', () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: 'empty', generatedAt: '2026-07-22T00:00:00.000Z', tokens: [], components: [], flows: [], rules: [],
  }} status="ready" />);
  assert.match(html, /No design tokens, components, or rules are available for this app/);
  assert.doesNotMatch(html, /observed|evidence/i);
});
