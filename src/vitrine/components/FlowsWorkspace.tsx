import { Spinner } from './Spinner.tsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, EmptyState } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl.ts';
import type { ResearchCollection } from '../../db.ts';
import {
  effectiveExpandedFlowGroupIds,
  filterFlowTreeGroups,
  toggleFlowGroup,
  type FlowTreeGroup,
} from '../flowTree.ts';
import { FlowGallery } from './FlowGallery.tsx';
import { FlowTree } from './FlowTree.tsx';
import { AstryxModal } from './AstryxModal.tsx';
import type { FlowRepresentation } from '../router.ts';

export interface FlowsWorkspaceProps {
  groups: FlowTreeGroup[];
  selectedFlowId?: string;
  invalidFlowId?: string;
  app?: string;
  platform?: Platform;
  version?: number;
  userRole?: 'admin' | 'user';
  sourceAppName?: string;
  sourceAppIconUrl?: string | null;
  analysisControls?: ReactNode;
  cardVariant?: 'captured' | 'draft';
  collections?: ResearchCollection[];
  onCollectionsChange?: (collections: ResearchCollection[]) => void;
  plan?: 'free' | 'pro';
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
  selectedFlowId,
  invalidFlowId,
  app,
  platform,
  version,
  userRole = 'user',
  sourceAppName,
  sourceAppIconUrl,
  analysisControls,
  cardVariant,
  collections,
  onCollectionsChange,
  plan = 'free',
  onSelectionChange,
}: FlowsWorkspaceProps) {
  const groupSignature = groups.map(({ id }) => id).join('\u0000');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.map(({ id }) => id)),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTocFlowId, setActiveTocFlowId] = useState<string>();
  const [scrollTargetFlowId, setScrollTargetFlowId] = useState<string>();

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

  const openFlow = (flowId: string) => {
    setDrawerOpen(false);
    setActiveTocFlowId(flowId);
    setScrollTargetFlowId(undefined);
    onSelectionChange(flowId, undefined, 'visual');
  };
  const navigateToFlow = (flowId: string) => {
    setDrawerOpen(false);
    setActiveTocFlowId(flowId);
    setScrollTargetFlowId(flowId);
    if (selectedFlowId) {
      onSelectionChange(undefined, undefined, undefined);
    }
  };
  const treeProps = {
    groups: visibleGroups,
    query,
    expandedGroupIds: effectiveExpanded,
    selectedFlowId: selectedFlowId ?? activeTocFlowId,
    onQueryChange: setQuery,
    onToggleGroup: (groupId: string) =>
      setExpanded((current) => toggleFlowGroup(current, groupId)),
    onSelectFlow: navigateToFlow,
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
        {visibleGroups.length ? (
          <FlowGallery
            groups={visibleGroups}
            scrollTargetFlowId={scrollTargetFlowId}
            onScrollTargetHandled={() => setScrollTargetFlowId(undefined)}
            onActiveFlowChange={setActiveTocFlowId}
            onSelectFlow={openFlow}
            app={app}
            platform={platform}
            version={version}
            userRole={userRole}
            collections={collections}
            onCollectionsChange={onCollectionsChange}
            plan={plan}
            sourceAppName={sourceAppName}
            sourceAppIconUrl={sourceAppIconUrl}
            cardPropsForFlow={(flow) => {
              const variant = flow.tags.includes('crawl-draft')
                ? 'draft'
                : cardVariant;
              return variant ? { variant } : undefined;
            }}
          />
        ) : (
          <EmptyState
            title="No flows match your search"
            description={`Nothing found for "${query}".`}
          />
        )}
      </main>
      {drawerOpen && (
        <AstryxModal
          isOpen
          onOpenChange={setDrawerOpen}
          purpose="info"
          width={320}
          maxHeight="100vh"
          position={{ top: 0, bottom: 0, left: 0 }}
          padding={0}
          className="flow-tree-drawer"
          presentation="drawer-left"
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
        </AstryxModal>
      )}
    </div>
  );
}
