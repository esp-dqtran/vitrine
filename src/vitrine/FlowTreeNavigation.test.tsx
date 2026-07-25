import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import { FlowTree } from './components/FlowTree.tsx';
import { FlowsPanel } from './components/FlowsPanel.tsx';
import { FlowsWorkspaceLoading } from './components/FlowsWorkspace.tsx';
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

test('keeps the tree mounted beside a selected Flow viewer', () => {
  const flows = [
    flow('invite', 'Inviting a team member', 'Onboarding'),
    {
      ...flow('trial', 'Starting a trial', 'Onboarding'),
      steps: [{
        label: 'Choose a plan',
        evidence: [{
          imageId: 1,
          imageUrl: '/trial.png',
          description: 'Plan selection',
        }],
      }],
    },
  ];
  const html = renderToStaticMarkup(
    <FlowsPanel
      flows={flows}
      selectedFlowId="trial"
      selectedStep={1}
      onSelectionChange={() => undefined}
    />,
  );

  assert.match(html, /data-flow-workspace="true"/);
  assert.match(html, /aria-label="Flows"/);
  assert.match(html, /aria-current="page"[^>]*>Starting a trial/);
  assert.match(html, /Back to all flows/);
  assert.match(html, /Choose a plan/);
  assert.match(html, /Browse flows/);
  assert.match(html, /class="[^"]*flow-tree-drawer/);
  assert.match(html, /desktop-flow-group-/);
  assert.match(html, /drawer-flow-group-/);
});

test('keeps invalid routed Flow recovery inside the normal gallery workspace', () => {
  const html = renderToStaticMarkup(
    <FlowsPanel
      flows={[flow('invite', 'Inviting a team member', 'Onboarding')]}
      selectedFlowId="deleted-flow"
      onSelectionChange={() => undefined}
    />,
  );
  assert.match(html, /role="status"/);
  assert.match(html, /Flow unavailable/);
  assert.match(html, /Open Inviting a team member flow/);
});

test('renders Flow navigation skeletons beside the existing loading state', () => {
  const html = renderToStaticMarkup(<FlowsWorkspaceLoading />);
  assert.match(html, /data-flow-workspace-loading="true"/);
  assert.match(html, /aria-label="Loading flows navigation"/);
  assert.equal((html.match(/flow-tree__skeleton/g) ?? []).length, 7);
  assert.match(html, /aria-label="Loading flows"/);
});

test('defines the desktop rail and 980px drawer transition', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.flow-workspace\s*\{[\s\S]*grid-template-columns:\s*280px minmax\(0,\s*1fr\)/);
  assert.match(css, /\.flow-workspace__rail\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\]/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.flow-workspace__rail\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.flow-workspace__browse\s*\{[\s\S]*display:/);
});
