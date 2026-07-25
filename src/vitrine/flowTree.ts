import type { DesignFlow, EvidenceView } from '../designSystem.ts';

export const STANDALONE_FLOW_GROUP_ID = 'standalone';
export const STANDALONE_FLOW_GROUP_LABEL = 'Standalone flows';

export interface FlowTreeGroup {
  id: string;
  label: string;
  flows: DesignFlow<EvidenceView>[];
  standalone: boolean;
}

const normalizedCategory = (flow: DesignFlow<EvidenceView>): string =>
  flow.category?.trim() ?? '';

export function buildFlowTreeGroups(
  flows: DesignFlow<EvidenceView>[],
): FlowTreeGroup[] {
  const grouped = new Map<string, FlowTreeGroup>();

  for (const flow of flows) {
    const category = normalizedCategory(flow);
    const id = category ? `category:${category}` : STANDALONE_FLOW_GROUP_ID;
    const existing = grouped.get(id);
    if (existing) {
      existing.flows.push(flow);
      continue;
    }
    grouped.set(id, {
      id,
      label: category || STANDALONE_FLOW_GROUP_LABEL,
      flows: [flow],
      standalone: !category,
    });
  }

  const standalone = grouped.get(STANDALONE_FLOW_GROUP_ID);
  const categorized = [...grouped.values()]
    .filter(({ standalone: itemStandalone }) => !itemStandalone)
    .sort((left, right) => left.label.localeCompare(right.label));
  return standalone ? [standalone, ...categorized] : categorized;
}

export function filterFlowTreeGroups(
  groups: FlowTreeGroup[],
  query: string,
): FlowTreeGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    if (group.label.toLocaleLowerCase().includes(normalizedQuery)) return [group];
    const matchingFlows = group.flows.filter(({ title }) =>
      title.toLocaleLowerCase().includes(normalizedQuery)
    );
    return matchingFlows.length ? [{ ...group, flows: matchingFlows }] : [];
  });
}

export function toggleFlowGroup(
  expanded: ReadonlySet<string>,
  groupId: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  return next;
}

export function effectiveExpandedFlowGroupIds({
  groups,
  visibleGroups,
  userExpanded,
  selectedFlowId,
  searching,
}: {
  groups: FlowTreeGroup[];
  visibleGroups: FlowTreeGroup[];
  userExpanded: ReadonlySet<string>;
  selectedFlowId?: string;
  searching: boolean;
}): Set<string> {
  const effective = new Set(userExpanded);
  if (searching) {
    for (const group of visibleGroups) effective.add(group.id);
  }
  if (selectedFlowId) {
    const selectedGroup = groups.find(({ flows }) =>
      flows.some(({ id }) => id === selectedFlowId)
    );
    if (selectedGroup) effective.add(selectedGroup.id);
  }
  return effective;
}
