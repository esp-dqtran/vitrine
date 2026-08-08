import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignSystemReferencePane, referenceBlocks } from './components/DesignSystemReferencePane.tsx';

test('maps Design System markdown headings to their matching left-pane sections', () => {
  const blocks = referenceBlocks([
    '# Example — Design System',
    '',
    '## Color',
    'color content',
    '## Typography',
    'type content',
    '## Spacing',
    'spacing content',
    '## Radius',
    'radius content',
    '## Border',
    'border content',
    '## Effect',
    'effect content',
    '## Components',
    'component content',
  ].join('\n'), 'design-md');

  assert.deepEqual(blocks.map(({ section }) => section), [
    'overview', 'color', 'typography', 'spacing', 'spacing', 'spacing', 'effect', 'components',
  ]);
});

test('shows and highlights the active left-pane section in the reference', () => {
  const html = renderToStaticMarkup(
    <DesignSystemReferencePane
      activeSection="color"
      markdown={'# Example — Design System\n\n## Color\n\n- **Brand**: `#123456`\n'}
      snapshot={{ app: 'Example', generatedAt: '2026-08-08T00:00:00.000Z', tokens: [], components: [], flows: [] }}
    />,
  );

  assert.match(html, /data-active-section="color"/);
  assert.match(html, /Viewing: Color palette/);
  assert.match(html, /data-design-system-reference-section="color" data-active="true"/);
});
