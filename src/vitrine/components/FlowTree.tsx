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
  return (
    <nav className="flow-tree" aria-label="Flows">
      <div className="flow-tree__search">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Search flows…"
        />
      </div>
      {groups.length === 0 ? (
        <p className="flow-tree__empty" role="status">
          No flows match your search
        </p>
      ) : (
        <ul className="flow-tree__groups">
          {groups.map((group, groupIndex) => {
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
                  icon={(
                    <Icon
                      icon={expanded ? 'chevronDown' : 'chevronRight'}
                      size="sm"
                    />
                  )}
                  endContent={(
                    <span className="flow-tree__count">{group.flows.length}</span>
                  )}
                >
                  <span className="flow-tree__group-label">{group.label}</span>
                </Button>
                {expanded && (
                  <ul className="flow-tree__flows" id={childId}>
                    {group.flows.map((flow) => (
                      <li key={flow.id}>
                        <Button
                          label={flow.title}
                          variant="ghost"
                          size="sm"
                          className="flow-tree__flow-button"
                          aria-current={flow.id === selectedFlowId ? 'page' : undefined}
                          onClick={() => onSelectFlow(flow.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
