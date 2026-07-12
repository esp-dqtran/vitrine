import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScreenAnalysis } from './screenAnalysis.ts';
import { parseDesignSystemSnapshot } from './designSystem.ts';

test('benchmark preserves responsive classification, distinct variants, and observed rules', () => {
  const screen = parseScreenAnalysis(JSON.stringify({ description: 'Dense dark issue table', purpose: 'Manage issues', pageType: 'Table', productArea: 'Issues', theme: 'dark', visibleStates: ['bulk selected'], componentNames: ['Compact button', 'Issue table'], visibleText: ['Archive'], layoutPatterns: ['Fixed sidebar', 'Dense table'], icons: ['Archive'], imagery: [], contentPatterns: ['Metadata row'], interactionPatterns: ['Bulk selection'], responsiveViewport: 'desktop', confidence: .94 }));
  assert.equal(screen.responsiveViewport, 'desktop');
  assert.deepEqual(screen.interactionPatterns, ['Bulk selection']);

  const system = parseDesignSystemSnapshot(JSON.stringify({
    tokens: [{ id: 'space-8', kind: 'spacing', name: 'Space 8', value: '8px', role: 'Compact control gap', evidence: [1], confidence: .9, responsiveViewports: ['desktop'] }],
    components: [{ id: 'button', name: 'Button', category: 'Actions', description: 'Compact action', anatomy: ['label', 'icon'], associatedTokenIds: ['space-8'], responsiveBehavior: [], variants: [
      { id: 'compact', name: 'Compact', description: 'Compact button', evidence: [1], observedProperties: ['32px height'], observedStates: ['default'], responsiveViewports: ['desktop'], confidence: .92, reconstruction: { layoutMode: 'HORIZONTAL', height: 32, padding: 8, gap: 4, radius: 6, visibleText: 'Archive' } },
      { id: 'compact-disabled', name: 'Compact disabled', description: 'Disabled compact button', evidence: [2], observedProperties: ['reduced opacity'], observedStates: ['disabled'], responsiveViewports: ['desktop'], confidence: .88 },
    ] }],
    rules: [{ id: 'dense-table', kind: 'layout', name: 'Dense table', description: 'Compact rows beside a fixed sidebar', evidence: [1], confidence: .9 }], flows: [],
  }), 'linear', new Set([1, 2]));
  assert.deepEqual(system.components[0].variants.map(({ id }) => id), ['compact', 'compact-disabled']);
  assert.equal(system.components[0].variants[0].reconstruction?.height, 32);
  assert.equal(system.rules?.[0].kind, 'layout');
});
