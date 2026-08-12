import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { buildFlowTreeGroups } from '../flowTree.ts';
import { FlowsWorkspace } from './FlowsWorkspace.tsx';
import { ReferenceGallerySection } from './ReferenceGallerySection.tsx';
import type { FlowRepresentation } from '../router.ts';
import { listCrawlPlans } from '../researchApi.ts';
import type { CrawlPlanView } from '../types.ts';

export function latestFlowDraft(plans: readonly CrawlPlanView[]): CrawlPlanView | undefined {
  return plans
    .filter((plan) => plan.status === 'draft' && plan.research_metadata.stage === 2 && plan.plan.flows.length > 0)
    .sort((left, right) => right.revision - left.revision)[0];
}

function draftFlows(draft: CrawlPlanView): DesignFlow<EvidenceView>[] {
  return draft.plan.flows.map((flow) => ({
    id: flow.id,
    title: flow.title,
    description: flow.description,
    tags: [],
    // Stage 2 is an inventory only. Stage 3 adds the observed steps and evidence.
    steps: [],
  }));
}

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
  draftPlan,
  onDraftCountChange,
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
  /** Provided by tests or an already-loaded admin surface; never rendered for non-admin users. */
  draftPlan?: CrawlPlanView;
  onDraftCountChange?(count: number): void;
}) {
  const groups = useMemo(() => buildFlowTreeGroups(flows), [flows]);
  const [loadedDraft, setLoadedDraft] = useState<CrawlPlanView>();
  const selectedFlow = selectedFlowId
    ? flows.find(({ id }) => id === selectedFlowId)
    : undefined;
  const invalidFlowId = selectedFlowId && !selectedFlow
    ? selectedFlowId
    : undefined;

  useEffect(() => {
    if (flows.length > 0 || userRole !== 'admin' || !app || draftPlan) {
      setLoadedDraft(undefined);
      return;
    }

    let current = true;
    void listCrawlPlans(app)
      .then((plans) => {
        if (current) setLoadedDraft(latestFlowDraft(plans));
      })
      // A missing or unavailable draft must not hide the normal published-empty state.
      .catch(() => {
        if (current) setLoadedDraft(undefined);
      });
    return () => { current = false; };
  }, [app, draftPlan, flows.length, userRole]);

  const visibleDraft = flows.length === 0 && userRole === 'admin'
    ? draftPlan ?? loadedDraft
    : undefined;
  const visibleDraftFlows = useMemo(
    () => visibleDraft ? draftFlows(visibleDraft) : [],
    [visibleDraft],
  );

  useEffect(() => {
    onDraftCountChange?.(visibleDraftFlows.length);
  }, [onDraftCountChange, visibleDraftFlows.length]);

  if (flows.length === 0) {
    if (visibleDraft) {
      return (
        <FlowsWorkspace
          groups={buildFlowTreeGroups(visibleDraftFlows)}
          app={app}
          platform={platform}
          version={version}
          userRole={userRole}
          sourceAppName={sourceAppName}
          sourceAppIconUrl={sourceAppIconUrl}
          cardVariant="draft"
          analysisControls={(
            <div className="flow-workspace__notice" data-flow-draft-status="true">
              <span>Draft · Stage 2 · {visibleDraftFlows.length} flows · Screens pending Stage 3</span>
            </div>
          )}
          onSelectionChange={() => undefined}
        />
      );
    }
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
