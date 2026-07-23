import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppKnowledgeEvidenceLink } from './components/AppKnowledgeEvidenceLink.tsx';

const manifest = [
  {
    evidenceId: 'SCREEN-42',
    imageId: 42,
    kind: 'screen' as const,
  },
  {
    evidenceId: 'FLOW-9-2',
    imageId: 51,
    kind: 'flow_step' as const,
    flow: { id: 'onboarding', stepIndex: 2 },
  },
  {
    evidenceId: 'UI-ELEMENT-7',
    imageId: 7,
    kind: 'ui_element' as const,
  },
];

test('links screen evidence to the exact App capture context', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgeEvidenceLink
      app="15five"
      platform="web"
      version={1}
      evidenceId="SCREEN-42"
      manifest={manifest}
    />,
  );
  assert.match(
    html,
    /href="\/apps\/15five\/screens\?platform=web&amp;version=1&amp;evidence=SCREEN-42"/,
  );
});

test('links flow evidence to its exact flow and one-based step', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgeEvidenceLink
      app="15five"
      platform="web"
      version={1}
      evidenceId="FLOW-9-2"
      manifest={manifest}
    />,
  );
  assert.match(
    html,
    /href="\/apps\/15five\/flows\?platform=web&amp;version=1&amp;flow=onboarding&amp;step=3"/,
  );
});

test('renders a stable unavailable label when evidence is not in the safe manifest', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgeEvidenceLink
      app="15five"
      platform="web"
      version={1}
      evidenceId="SCREEN-99"
      manifest={manifest}
    />,
  );
  assert.match(html, /SCREEN-99 \(unavailable\)/);
  assert.doesNotMatch(html, /href=/);
});
