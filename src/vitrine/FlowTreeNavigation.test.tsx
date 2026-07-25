import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import { FlowTree } from './components/FlowTree.tsx';
import { buildFlowTreeGroups } from './flowTree.ts';

const flow = (
  id: string,
  title: string,
  category?: string,
): DesignFlow<EvidenceView> => ({
  id,
  title,
  ...(category ? { category } : {}),
  description: '',
  tags: [],
  steps: [],
});

test('renders category disclosures, counts, nested flows, and selected state', () => {
  const groups = buildFlowTreeGroups([
    flow('invite', 'Inviting a team member', 'Onboarding'),
    flow('trial', 'Starting a trial', 'Onboarding'),
    flow('home', 'Home'),
  ]);
  const html = renderToStaticMarkup(
    <FlowTree
      idPrefix="desktop"
      groups={groups}
      query=""
      expandedGroupIds={new Set(groups.map(({ id }) => id))}
      selectedFlowId="trial"
      onQueryChange={() => undefined}
      onToggleGroup={() => undefined}
      onSelectFlow={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Flows"/);
  assert.match(html, /placeholder="Search flows…"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Onboarding/);
  assert.match(html, />2<\/span>/);
  assert.match(html, /Inviting a team member/);
  assert.match(html, /aria-current="page"[^>]*>Starting a trial/);
  assert.match(html, /Standalone flows/);
  assert.match(html, /id="desktop-flow-group-/);
});

test('renders a local no-match status without replacing the workspace', () => {
  const html = renderToStaticMarkup(
    <FlowTree
      idPrefix="drawer"
      groups={[]}
      query="missing"
      expandedGroupIds={new Set()}
      onQueryChange={() => undefined}
      onToggleGroup={() => undefined}
      onSelectFlow={() => undefined}
    />,
  );
  assert.match(html, /role="status"/);
  assert.match(html, /No flows match your search/);
});
