import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import { FlowGallery } from './components/FlowGallery.tsx';

const flow = (index: number): DesignFlow<EvidenceView> => ({
  id: `flow-${index}`,
  title: `Flow ${index}`,
  description: '',
  tags: [],
  steps: [],
});

test('renders only the first eight Flow cards before viewport advancement', () => {
  const html = renderToStaticMarkup(
    <FlowGallery
      groups={[{
        id: 'all',
        label: 'All',
        standalone: false,
        flows: Array.from({ length: 10 }, (_, index) => flow(index + 1)),
      }]}
      onSelectFlow={() => undefined}
    />,
  );

  assert.equal((html.match(/data-flow-strip-card="true"/g) ?? []).length, 8);
  assert.match(html, />Flow 8</);
  assert.doesNotMatch(html, />Flow 9</);
});
