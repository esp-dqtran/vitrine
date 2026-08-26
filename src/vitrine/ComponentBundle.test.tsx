import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { COMPONENT_BUNDLES, componentBundleFor } from './componentBundles.ts';
import { OverlapTransitionDemo } from './generated-components/overlap-transition/OverlapTransitionDemo.tsx';

test('publishes a copyable and evidence-labelled overlap transition bundle', () => {
  const bundle = componentBundleFor('details-so-overlaptransitionstage');

  assert.ok(bundle);
  assert.equal(COMPONENT_BUNDLES.length, 1);
  assert.deepEqual(bundle.dependencies, ['react', 'motion']);
  assert.equal(bundle.assets.length, 0);
  assert.ok(bundle.files.some((file) => file.path === 'OverlapTransitionStage.tsx'));
  assert.ok(bundle.files.some((file) => file.path === 'overlapTransition.css'));
  assert.match(bundle.usage, /transitionKey=\{activePlatform\}/);
  assert.ok(bundle.evidence.some((entry) => entry.kind === 'observed'));
  assert.ok(bundle.evidence.some((entry) => entry.kind === 'reconstructed'));
  assert.ok(bundle.evidence.some((entry) => entry.kind === 'inferred'));
  assert.ok(bundle.unknowns.length > 0);
  assert.equal(componentBundleFor('not-generated'), null);
});

test('renders the overlap transition with a stable shell and keyed stage', () => {
  const html = renderToStaticMarkup(<OverlapTransitionDemo />);

  assert.match(html, /data-live-component="OverlapTransitionStage"/);
  assert.match(html, /data-overlap-transition-stage="true"/);
  assert.match(html, /data-transition-key="0"/);
  assert.match(html, /aria-label="Demo pages"/);
  assert.match(html, /Interfaces with rhythm/);
});
