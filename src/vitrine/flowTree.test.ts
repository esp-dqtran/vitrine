import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import {
  buildFlowTreeGroups,
  effectiveExpandedFlowGroupIds,
  filterFlowTreeGroups,
  STANDALONE_FLOW_GROUP_ID,
  toggleFlowGroup,
} from './flowTree.ts';

const flow = (
  id: string,
  title: string,
  category?: string,
): DesignFlow<EvidenceView> => ({
  id,
  title,
  ...(category === undefined ? {} : { category }),
  description: '',
  tags: [],
  steps: [],
});

test('normalizes categories, keeps standalone flows first, and preserves flow source order', () => {
  const groups = buildFlowTreeGroups([
    flow('standalone', 'Home'),
    flow('second', 'Second action', ' Settings '),
    flow('first', 'First action', 'Settings'),
    flow('auth', 'Log in', 'Authentication'),
    flow('blank', 'Blank category', '   '),
  ]);

  assert.deepEqual(groups.map(({ id, label }) => ({ id, label })), [
    { id: STANDALONE_FLOW_GROUP_ID, label: 'Standalone flows' },
    { id: 'category:Authentication', label: 'Authentication' },
    { id: 'category:Settings', label: 'Settings' },
  ]);
  assert.deepEqual(groups[0].flows.map(({ id }) => id), ['standalone', 'blank']);
  assert.deepEqual(groups[2].flows.map(({ id }) => id), ['second', 'first']);
});

test('category matches retain all children while title matches retain only matching flows', () => {
  const groups = buildFlowTreeGroups([
    flow('invite', 'Inviting a team member', 'Onboarding'),
    flow('trial', 'Starting a trial', 'Onboarding'),
    flow('setup', 'Complete setup', 'Dashboard'),
  ]);

  assert.deepEqual(
    filterFlowTreeGroups(groups, 'onboard')[0].flows.map(({ id }) => id),
    ['invite', 'trial'],
  );
  assert.deepEqual(
    filterFlowTreeGroups(groups, 'trial')[0].flows.map(({ id }) => id),
    ['trial'],
  );
  assert.deepEqual(filterFlowTreeGroups(groups, 'missing'), []);
});

test('search and routed selection derive expansion without mutating user choices', () => {
  const groups = buildFlowTreeGroups([
    flow('invite', 'Inviting a team member', 'Onboarding'),
    flow('setup', 'Complete setup', 'Dashboard'),
  ]);
  const userExpanded = new Set(['category:Dashboard']);

  const effective = effectiveExpandedFlowGroupIds({
    groups,
    visibleGroups: filterFlowTreeGroups(groups, 'invit'),
    userExpanded,
    selectedFlowId: 'setup',
    searching: true,
  });

  assert.deepEqual([...effective].sort(), ['category:Dashboard', 'category:Onboarding']);
  assert.deepEqual([...userExpanded], ['category:Dashboard']);
  assert.deepEqual([...toggleFlowGroup(userExpanded, 'category:Dashboard')], []);
});
