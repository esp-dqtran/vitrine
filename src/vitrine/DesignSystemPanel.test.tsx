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
