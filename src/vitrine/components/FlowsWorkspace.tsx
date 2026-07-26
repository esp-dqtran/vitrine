import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Dialog, EmptyState, Spinner } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import {
  effectiveExpandedFlowGroupIds,
  filterFlowTreeGroups,
  toggleFlowGroup,
  type FlowTreeGroup,
} from '../flowTree.ts';
import { FlowGallery } from './FlowGallery.tsx';
import { FlowTree } from './FlowTree.tsx';
import { SelectedFlowWorkspace } from './SelectedFlowWorkspace.tsx';
import type { FlowRepresentation } from '../router.ts';

export interface FlowsWorkspaceProps {
  groups: FlowTreeGroup[];
  selectedFlow?: DesignFlow<EvidenceView>;
  selectedFlowId?: string;
  selectedStep?: number;
  selectedFlowView?: FlowRepresentation;
  invalidFlowId?: string;
  app?: string;
  platform?: Platform;
  version?: number;
  userRole?: 'admin' | 'user';
  analysisControls?: ReactNode;
  onSelectionChange(flowId?: string, step?: number, flowView?: FlowRepresentation): void;
}

export function FlowsWorkspaceLoading() {
  return (
    <div className="flow-workspace" data-flow-workspace-loading="true">
      <aside
        className="flow-workspace__rail flow-workspace__rail--loading"
        aria-label="Loading flows navigation"
      >
        {Array.from({ length: 7 }, (_, index) => (
          <span className="flow-tree__skeleton" key={index} />
        ))}
      </aside>
      <main
        className="flow-workspace__content flow-workspace__content--loading"
        role="status"
        aria-label="Loading flows"
      >
        <Spinner size="lg" />
      </main>
    </div>
  );
}

export function FlowsWorkspace({
  groups,
  selectedFlow,
  selectedFlowId,
  selectedStep,
  selectedFlowView,
  invalidFlowId,
  app,
  platform,
  version,
  userRole = 'user',
  analysisControls,
  onSelectionChange,
}: FlowsWorkspaceProps) {
  const groupSignature = groups.map(({ id }) => id).join('\u0000');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.map(({ id }) => id)),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setExpanded(new Set(groups.map(({ id }) => id)));
  }, [groupSignature]);

  const visibleGroups = useMemo(
    () => filterFlowTreeGroups(groups, query),
    [groups, query],
  );
  const effectiveExpanded = useMemo(
    () => effectiveExpandedFlowGroupIds({
      groups,
      visibleGroups,
      userExpanded: expanded,
      selectedFlowId,
      searching: Boolean(query.trim()),
    }),
    [expanded, groups, query, selectedFlowId, visibleGroups],
  );

  const selectFlow = (flowId: string) => {
    setDrawerOpen(false);
    onSelectionChange(flowId, undefined, 'visual');
  };
  const treeProps = {
    groups: visibleGroups,
    query,
    expandedGroupIds: effectiveExpanded,
    selectedFlowId,
    onQueryChange: setQuery,
    onToggleGroup: (groupId: string) =>
      setExpanded((current) => toggleFlowGroup(current, groupId)),
    onSelectFlow: selectFlow,
  };
  return (
    <div className="flow-workspace" data-flow-workspace="true">
      <aside className="flow-workspace__rail">
        <FlowTree idPrefix="desktop" {...treeProps} />
      </aside>
      <main className="flow-workspace__content">
        <Button
          className="flow-workspace__browse"
          label="Browse flows"
          variant="secondary"
          size="sm"
          clickAction={() => setDrawerOpen(true)}
        />
        {analysisControls}
        {invalidFlowId && (
          <div className="flow-workspace__notice" role="status">
            <span>Flow unavailable</span>
            <Button
              label="Dismiss"
              size="sm"
              variant="ghost"
              clickAction={() => onSelectionChange(undefined, undefined, undefined)}
            />
          </div>
        )}
        {selectedFlow ? (
          <SelectedFlowWorkspace
            flow={selectedFlow}
            app={app}
            platform={platform}
            version={version}
            userRole={userRole}
            view={selectedFlowView ?? 'visual'}
            selectedStep={selectedStep}
            onViewChange={(flowView, step) =>
              onSelectionChange(selectedFlow.id, step, flowView)}
            onStepChange={(step) =>
              onSelectionChange(selectedFlow.id, step, selectedFlowView ?? 'visual')}
            onBack={() => onSelectionChange(undefined, undefined, undefined)}
          />
        ) : visibleGroups.length ? (
          <FlowGallery groups={visibleGroups} onSelectFlow={selectFlow} />
        ) : (
          <EmptyState
            title="No flows match your search"
            description={`Nothing found for "${query}".`}
          />
        )}
      </main>
      {drawerOpen && (
        <Dialog
          isOpen
          onOpenChange={setDrawerOpen}
          purpose="info"
          width={320}
          maxHeight="100vh"
          position={{ top: 0, bottom: 0, left: 0 }}
          padding={0}
          className="flow-tree-drawer"
        >
          <div className="flow-tree-drawer__header">
            <strong>Flows</strong>
            <Button
              label="Close"
              size="sm"
              variant="ghost"
              clickAction={() => setDrawerOpen(false)}
            />
          </div>
          <FlowTree idPrefix="drawer" {...treeProps} />
        </Dialog>
      )}
    </div>
  );
}
