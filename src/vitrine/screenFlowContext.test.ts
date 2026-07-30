import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import {
  buildScreenFlowMembership,
  rankFlowsForScreens,
  rankHighlightedScreens,
} from './screenFlowContext.ts';
import type { Screen } from './types.ts';

const evidence = (imageId: number): EvidenceView => ({
  imageId,
  imageUrl: `/screen-${imageId}.png`,
  description: null,
});

const flow = (
  id: string,
  title: string,
  imageIds: number[],
): DesignFlow<EvidenceView> => ({
  id,
  title,
  description: '',
  tags: [],
  steps: imageIds.map((imageId) => ({
    label: `Screen ${imageId}`,
    evidence: [evidence(imageId)],
  })),
});

const screen = (id: number): Screen => ({
  id,
  type: 'Unclassified',
  productArea: 'Unclassified',
  theme: 'mixed',
  visibleStates: [],
  platform: 'ios',
  description: null,
  url: `/screen-${id}.png`,
});

test('maps each screen to its real Flow memberships without duplicate entries', () => {
  const membership = buildScreenFlowMembership([
    {
      ...flow('checkout', 'Checkout', [1]),
      steps: [{ label: 'Checkout', evidence: [evidence(1), evidence(1)] }],
    },
    flow('orders', 'Orders', [1, 2]),
  ]);

  assert.deepEqual(membership.get(1), [
    { id: 'checkout', title: 'Checkout' },
    { id: 'orders', title: 'Orders' },
  ]);
  assert.deepEqual(membership.get(2), [{ id: 'orders', title: 'Orders' }]);
});

test('ranks highlights by repeated Flow evidence and preserves capture order for ties', () => {
  const flows = [
    flow('one', 'One', [1, 2]),
    flow('two', 'Two', [2]),
  ];
  const membership = buildScreenFlowMembership(flows);

  assert.deepEqual(
    rankHighlightedScreens([screen(1), screen(2), screen(3)], membership)
      .map(({ id }) => id),
    [2, 1],
  );
});

test('selects the Flows that best explain the currently loaded screens', () => {
  const flows = [
    flow('account', 'Account', [1]),
    flow('checkout', 'Checkout', [1, 2, 3]),
    flow('search', 'Search', [4, 5]),
  ];

  assert.deepEqual(
    rankFlowsForScreens(flows, [screen(1), screen(2), screen(4)], 2)
      .map(({ id }) => id),
    ['checkout', 'search'],
  );
});
