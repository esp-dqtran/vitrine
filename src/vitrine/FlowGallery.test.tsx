import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import { FlowGallery } from './components/FlowGallery.tsx';
import * as FlowGalleryModule from './components/FlowGallery.tsx';

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

test('renders a table-of-contents target beyond the first batch with a scroll anchor', () => {
  const html = renderToStaticMarkup(
    <FlowGallery
      groups={[{
        id: 'all',
        label: 'All',
        standalone: false,
        flows: Array.from({ length: 10 }, (_, index) => flow(index + 1)),
      }]}
      scrollTargetFlowId="flow-10"
      onSelectFlow={() => undefined}
    />,
  );

  assert.equal((html.match(/data-flow-strip-card="true"/g) ?? []).length, 10);
  assert.match(html, /data-flow-gallery-id="flow-10"/);
  assert.match(html, /id="flow-gallery-flow-10"/);
  assert.match(html, />Flow 10</);
});

test('selects the intersecting flow nearest the gallery reading line', () => {
  const activeFlowIdFromEntries = (
    FlowGalleryModule as unknown as {
      activeFlowIdFromEntries?: (
        entries: Array<{
          flowId: string;
          isIntersecting: boolean;
          top: number;
        }>,
      ) => string | undefined;
    }
  ).activeFlowIdFromEntries;

  assert.equal(typeof activeFlowIdFromEntries, 'function');
  assert.equal(activeFlowIdFromEntries?.([
    { flowId: 'flow-1', isIntersecting: false, top: 5 },
    { flowId: 'flow-2', isIntersecting: true, top: 180 },
    { flowId: 'flow-3', isIntersecting: true, top: 30 },
  ]), 'flow-3');
});

test('keeps the clicked target pinned while smooth scrolling past intermediate flows', () => {
  const activeFlowIdFromEntries = (
    FlowGalleryModule as unknown as {
      activeFlowIdFromEntries?: (
        entries: Array<{
          flowId: string;
          isIntersecting: boolean;
          top: number;
        }>,
        navigationTargetFlowId?: string,
      ) => string | undefined;
    }
  ).activeFlowIdFromEntries;

  assert.equal(activeFlowIdFromEntries?.([
    { flowId: 'flow-2', isIntersecting: true, top: 20 },
    { flowId: 'flow-3', isIntersecting: true, top: 180 },
  ], 'flow-10'), undefined);
  assert.equal(activeFlowIdFromEntries?.([
    { flowId: 'flow-9', isIntersecting: true, top: 20 },
    { flowId: 'flow-10', isIntersecting: true, top: 180 },
  ], 'flow-10'), 'flow-10');
});

test('keeps a scrolled Flow card below the sticky app header', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.flow-strip-card\s*\{[^}]*scroll-margin-top:\s*calc\(var\(--reference-nav-height\) \+ 24px\)/,
  );
});
