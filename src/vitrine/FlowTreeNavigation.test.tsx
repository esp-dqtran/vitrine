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

test('renders standalone flows at the root and categories as disclosures', () => {
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
  assert.match(html, /class="flow-tree__root"/);
  assert.match(html, /class="flow-tree__root-label">Flows<\/span>/);
  assert.match(html, /class="flow-tree__root-count">3<\/span>/);
  assert.doesNotMatch(html, /class="flow-tree__root-marker"/);
  assert.doesNotMatch(html, /class="flow-tree__folder-icon"/);
  assert.doesNotMatch(html, /class="flow-tree__leaf-icon"/);
  assert.match(html, /class="flow-tree__flow-branch"/);
  assert.match(html, /class="flow-tree__group-chevron"/);
  assert.doesNotMatch(html, /class="flow-tree__count"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Onboarding/);
  assert.match(html, /Inviting a team member/);
  assert.match(html, /aria-current="page"[\s\S]*Starting a trial/);
  assert.doesNotMatch(html, /Standalone flows/);
  assert.match(
    html,
    /<ul class="flow-tree__groups"><li class="flow-tree__flow-branch">[\s\S]*Home/,
  );
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

test('keeps collapsed category content mounted but out of keyboard focus', () => {
  const html = renderToStaticMarkup(
    <FlowTree
      idPrefix="desktop"
      groups={buildFlowTreeGroups([
        flow('invite', 'Inviting a team member', 'Onboarding'),
      ])}
      query=""
      expandedGroupIds={new Set()}
      onQueryChange={() => undefined}
      onToggleGroup={() => undefined}
      onSelectFlow={() => undefined}
    />,
  );

  assert.match(
    html,
    /class="flow-tree__flows-collapse" data-expanded="false" aria-hidden="true"/,
  );
  assert.match(html, /Inviting a team member/);
  assert.match(html, /tabindex="-1"/);
});

test('keeps the Flow gallery mounted when URL state selects a modal preview', () => {
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
  assert.match(html, /class="flow-workspace"/);
  assert.match(html, /<aside class="flow-workspace__rail"/);
  assert.match(html, /aria-current="page"[\s\S]*Starting a trial/);
  assert.doesNotMatch(html, /class="selected-flow-workspace"/);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.doesNotMatch(html, /aria-modal="true"/);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /data-flow-preview-url-sync="true"/);
  assert.match(html, /src="\/trial\.png"/);
  assert.match(html, /Starting a trial/);
  assert.match(html, /1 screen/);
  assert.match(html, /Browse flows/);
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
  assert.match(html, /flow-tree__flow-button/);
  assert.match(html, /Inviting a team member/);
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
  assert.doesNotMatch(css, /\.flow-workspace--viewer/);
  assert.match(css, /\.flow-strip-card\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.flow-strip-card__track\s*\{[\s\S]*height:\s*clamp\(380px,\s*30\.67vw,\s*450px\)[\s\S]*gap:\s*16px[\s\S]*justify-content:\s*flex-start[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.flow-strip-card__screen\s*\{[\s\S]*flex:\s*0 0 auto[\s\S]*aspect-ratio:\s*390 \/ 844[\s\S]*border-radius:\s*24px/);
  assert.match(css, /\.flow-strip-card__stage\[data-platform=["']web["']\] \.flow-strip-card__track\s*\{[^}]*height:\s*clamp\(240px,\s*22vw,\s*340px\)/);
  assert.match(css, /\.flow-strip-card__stage\[data-platform=["']web["']\] \.flow-strip-card__screen\s*\{[^}]*aspect-ratio:\s*8 \/ 5;[^}]*border-radius:\s*12px/);
  assert.match(css, /\.flow-strip-card__footer\s*\{[\s\S]*justify-content:\s*space-between/);
  assert.doesNotMatch(css, /\.flow-strip-card__step-label/);
  assert.match(css, /\.visual-flow-panel\s*\{[\s\S]*background:\s*#1f1f1f/);
  assert.match(css, /\.visual-flow-panel--web \.visual-flow-panel__screen-card\s*\{[\s\S]*flex:\s*0 0 min\(76vw,\s*1120px\)[\s\S]*background:\s*transparent/);
  assert.match(css, /\.visual-flow-panel--web \.visual-flow-panel__prototype-card\s*\{[\s\S]*width:\s*min\(76vw,\s*1120px\)[\s\S]*background:\s*transparent/);
  assert.match(css, /\.visual-flow-panel__submodes button\[aria-pressed=['"]true['"]\]/);
  assert.match(css, /\.visual-flow-panel__prototype-stage\s*\{[\s\S]*place-items:\s*center/);
  assert.doesNotMatch(css, /\.flow-viewer__/);
  assert.match(css, /\.flow-workspace__rail\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /\.flow-tree__root\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.flow-tree__root-label\s*\{[^}]*font-size:\s*18px/);
  assert.doesNotMatch(css, /\.flow-tree__root-marker/);
  assert.doesNotMatch(css, /\.flow-tree__(folder|leaf)-icon/);
  assert.match(css, /\.flow-tree__group-button\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*auto\)/);
  assert.match(css, /\.flow-tree__group-button\s*\{[^}]*min-height:\s*42px[\s\S]*font-size:\s*18px/);
  assert.match(css, /\.flow-tree__group-content\s*\{[^}]*justify-content:\s*flex-start[\s\S]*gap:\s*14px/);
  assert.match(css, /\.flow-tree__group-chevron\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.flow-tree__flows\s*\{[^}]*padding-left:\s*48px/);
  assert.match(css, /\.flow-tree__flow-branch\s*\{[^}]*justify-content:\s*flex-start/);
  assert.match(css, /\.flow-tree__flow-button\s*\{[^}]*justify-content:\s*flex-start/);
  assert.match(css, /\.flow-tree__flow-button\s*\{[^}]*min-height:\s*40px[\s\S]*font-size:\s*17px/);
  assert.match(css, /\.flow-tree__flow-button > span:first-child\s*\{[^}]*justify-content:\s*flex-start/);
  assert.doesNotMatch(css, /\.flow-tree__flows::before/);
  assert.doesNotMatch(css, /\.flow-tree__flow-branch::before/);
  assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\]/);
  assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\]\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\]\s*\{[^}]*box-shadow:\s*none/);
  assert.match(css, /\.flow-tree__flow-button\s*\{[^}]*transition:[^}]*transform/);
  assert.match(css, /\.flow-tree__flow-button\[aria-current=['"]page['"]\]\s*\{[^}]*transform:\s*translateX\(4px\)/);
  assert.match(css, /\.flow-tree__flows-collapse\s*\{[^}]*grid-template-rows:\s*0fr[\s\S]*transition:/);
  assert.match(css, /\.flow-tree__flows-collapse\[data-expanded=['"]true['"]\]\s*\{[^}]*grid-template-rows:\s*1fr/);
  assert.match(css, /\.flow-tree__group-chevron\s*\{[^}]*transition:\s*transform/);
  assert.match(css, /\.flow-tree__group-chevron\[data-expanded=['"]true['"]\]\s*\{[^}]*transform:\s*rotate\(90deg\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.flow-tree__flows-collapse/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.flow-workspace__rail\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.flow-workspace__browse\s*\{[\s\S]*display:/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*selected-flow-workspace/);
  assert.match(css, /\.selected-flow-workspace__tabs button:focus-visible/);
});

test('moves Flow galleries and the selected Flow by exact screen positions', () => {
  const cardSource = readFileSync(
    new URL('./components/FlowCard.tsx', import.meta.url),
    'utf8',
  );
  const visualFlowSource = readFileSync(
    new URL('./components/VisualFlowPanel.tsx', import.meta.url),
    'utf8',
  );

  assert.match(cardSource, /scrollToAdjacentFlowScreen\(track,\s*direction\)/);
  assert.match(visualFlowSource, /scrollToAdjacentFlowScreen\(track,\s*direction\)/);
  assert.doesNotMatch(cardSource, /track\.clientWidth \* 0\.72/);
  assert.doesNotMatch(visualFlowSource, /track\.clientWidth \* 0\.72/);
});

test('focuses the selected Visual Flow screen after cross-view evidence navigation', () => {
  const source = readFileSync(
    new URL('./components/VisualFlowPanel.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const selectedCard = trackRef\.current/);
  assert.match(source, /selectedCard\?\.scrollIntoView/);
  assert.match(source, /selectedCard\?\.querySelector<HTMLElement>\('button'\)\?\.focus/);
});

test('styles Document Flow as a responsive requirements workspace', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.document-flow__summary\s*\{[\s\S]*grid-template-columns:/);
  assert.match(css, /\.document-flow__counts\s*\{[\s\S]*grid-template-columns:/);
  assert.match(css, /\.document-flow__requirement\s*\{/);
  assert.match(css, /\.document-flow__scenario dl div\s*\{[\s\S]*grid-template-columns:\s*64px/);
  assert.match(css, /\.document-flow__evidence-chip\s*\{/);
  assert.match(css, /\.document-flow__evidence-list\s*\{[\s\S]*display:\s*flex[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.document-flow__evidence-node:not\(:last-child\)::after\s*\{/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.document-flow__summary\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

test('uses Astryx controls for every Flow tree action', () => {
  const source = readFileSync(
    new URL('./components/FlowTree.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /<button\b/);
  assert.match(source, /<Button/);
});
