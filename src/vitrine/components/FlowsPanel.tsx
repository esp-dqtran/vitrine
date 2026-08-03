import { useMemo } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { buildFlowTreeGroups } from '../flowTree.ts';
import { FlowsWorkspace } from './FlowsWorkspace.tsx';
import { ReferenceGallerySection } from './ReferenceGallerySection.tsx';
import type { FlowRepresentation } from '../router.ts';

export function FlowsPanel({
  flows,
  app,
  platform,
  version,
  selectedFlowId,
  onSelectionChange = () => undefined,
  userRole = 'user',
  sourceAppName,
  sourceAppIconUrl,
}: {
  flows: DesignFlow<EvidenceView>[];
  app?: string;
  platform?: Platform;
  version?: number;
  selectedFlowId?: string;
  selectedStep?: number;
  selectedFlowView?: FlowRepresentation;
  onSelectionChange?(flowId?: string, step?: number, flowView?: FlowRepresentation): void;
  userRole?: 'admin' | 'user';
  sourceAppName?: string;
  sourceAppIconUrl?: string | null;
}) {
  const groups = useMemo(() => buildFlowTreeGroups(flows), [flows]);
  const selectedFlow = selectedFlowId
    ? flows.find(({ id }) => id === selectedFlowId)
    : undefined;
  const invalidFlowId = selectedFlowId && !selectedFlow
    ? selectedFlowId
    : undefined;

  if (flows.length === 0) {
    return (
      <ReferenceGallerySection>
        <EmptyState title="No captured flows yet" description="Import a curator-reviewed flow manifest to publish ordered evidence." />
      </ReferenceGallerySection>
    );
  }

  return (
    <FlowsWorkspace
      groups={groups}
      selectedFlowId={selectedFlowId}
      invalidFlowId={invalidFlowId}
      app={app}
      platform={platform}
      version={version}
      userRole={userRole}
      sourceAppName={sourceAppName}
      sourceAppIconUrl={sourceAppIconUrl}
      onSelectionChange={onSelectionChange}
    />
  );
}
