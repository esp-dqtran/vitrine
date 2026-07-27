import { useEffect, useRef } from 'react';
import { Button, Icon } from '@astryxdesign/core';
import type { FlowTreeGroup } from '../flowTree.ts';
import { SearchInput } from './SearchInput.tsx';

export interface FlowTreeProps {
  idPrefix: string;
  groups: FlowTreeGroup[];
  query: string;
  expandedGroupIds: ReadonlySet<string>;
  selectedFlowId?: string;
  onQueryChange(query: string): void;
  onToggleGroup(groupId: string): void;
  onSelectFlow(flowId: string): void;
}

export function FlowTree({
  idPrefix,
  groups,
  query,
  expandedGroupIds,
  selectedFlowId,
  onQueryChange,
  onToggleGroup,
  onSelectFlow,
}: FlowTreeProps) {
  const treeRef = useRef<HTMLElement>(null);
  const visibleFlowCount = groups.reduce(
    (total, group) => total + group.flows.length,
    0,
  );
  const renderFlow = (
    flow: FlowTreeGroup['flows'][number],
    tabIndex?: number,
  ) => (
    <li className="flow-tree__flow-branch" key={flow.id}>
      <Button
        label={flow.title}
        variant="ghost"
        size="sm"
        className="flow-tree__flow-button"
        aria-current={flow.id === selectedFlowId ? 'page' : undefined}
        tabIndex={tabIndex}
        onClick={() => onSelectFlow(flow.id)}
      />
    </li>
  );
  useEffect(() => {
    const activeFlow = treeRef.current?.querySelector<HTMLElement>(
      '.flow-tree__flow-button[aria-current="page"]',
    );
    activeFlow?.scrollIntoView({ block: 'nearest' });
  }, [selectedFlowId]);

  return (
    <nav className="flow-tree" aria-label="Flows" ref={treeRef}>
      <div className="flow-tree__search">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Search flows…"
        />
      </div>
      <div className="flow-tree__root">
        <span className="flow-tree__root-label">Flows</span>
        <span className="flow-tree__root-count">{visibleFlowCount}</span>
      </div>
      {groups.length === 0 ? (
        <p className="flow-tree__empty" role="status">
          No flows match your search
        </p>
      ) : (
        <ul className="flow-tree__groups">
          {groups.map((group, groupIndex) => {
            if (group.standalone) {
              return group.flows.map((flow) => renderFlow(flow));
            }

            const expanded = expandedGroupIds.has(group.id);
            const childId = `${idPrefix}-flow-group-${groupIndex}`;
            return (
              <li className="flow-tree__group" key={group.id}>
                <Button
                  label={`${group.label}, ${group.flows.length} flows`}
                  variant="ghost"
                  size="sm"
                  className="flow-tree__group-button"
                  aria-expanded={expanded}
                  aria-controls={childId}
                  onClick={() => onToggleGroup(group.id)}
                >
                  <span className="flow-tree__group-content">
                    <span className="flow-tree__group-label">{group.label}</span>
                    <span
                      className="flow-tree__group-chevron"
                      data-expanded={expanded}
                      aria-hidden="true"
                    >
                      <Icon icon="chevronRight" size="sm" />
                    </span>
                  </span>
                </Button>
                <div
                  className="flow-tree__flows-collapse"
                  data-expanded={expanded}
                  aria-hidden={!expanded}
                >
                  <ul className="flow-tree__flows" id={childId}>
                    {group.flows.map((flow) =>
                      renderFlow(flow, expanded ? undefined : -1),
                    )}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
