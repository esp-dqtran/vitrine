import { useMemo } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { buildFlowTreeGroups } from '../flowTree.ts';
import { FlowsWorkspace } from './FlowsWorkspace.tsx';
import { ReferenceGallerySection } from './ReferenceGallerySection.tsx';

export function FlowsPanel({
  flows,
  app,
  platform,
  version,
  selectedFlowId,
  selectedStep,
  initialFlowId,
  initialStep,
  onSelectionChange = () => undefined,
}: {
  flows: DesignFlow<EvidenceView>[];
  app?: string;
  platform?: Platform;
  version?: number;
  selectedFlowId?: string;
  selectedStep?: number;
  initialFlowId?: string;
  initialStep?: number;
  onSelectionChange?(flowId?: string, step?: number): void;
}) {
  const groups = useMemo(() => buildFlowTreeGroups(flows), [flows]);
  const activeFlowId = selectedFlowId ?? initialFlowId;
  const activeStep = selectedStep ?? initialStep;
  const selectedFlow = activeFlowId
    ? flows.find(({ id }) => id === activeFlowId)
    : undefined;
  const invalidFlowId = activeFlowId && !selectedFlow
    ? activeFlowId
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
      selectedFlow={selectedFlow}
      selectedFlowId={activeFlowId}
      selectedStep={activeStep}
      invalidFlowId={invalidFlowId}
      app={app}
      platform={platform}
      version={version}
      onSelectionChange={onSelectionChange}
    />
  );
}
