import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
} from '@astryxdesign/core';
import {
  projectAppKnowledge,
  type AppKnowledgeReviewStatus,
  type AppKnowledgeRoleProjection,
} from '../../appKnowledge.ts';
import type { AppKnowledgeEvidenceManifestItem } from '../../appKnowledgeEvidence.ts';
import type { AppKnowledgeJobView } from '../../appKnowledgeStore.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { PLATFORM_LABEL } from '../../platformFromUrl.ts';
import type {
  AppKnowledgeEvidenceReference,
  AppKnowledgeRole,
  AppKnowledgeView,
} from '../appKnowledgeApi.ts';
import type { AppKnowledgeState } from '../appKnowledgeStore.ts';
import { useAppKnowledge } from '../useAppKnowledge.ts';
import { AppKnowledgeEvidenceLink } from './AppKnowledgeEvidenceLink.tsx';

interface PanelActions {
  start?(): Promise<unknown>;
  cancel?(jobId: number): Promise<unknown>;
  resume?(jobId: number): Promise<unknown>;
  retryFailed?(jobId: number): Promise<unknown>;
  regenerate?(snapshotId: number): Promise<unknown>;
  setReviewStatus?(
    snapshotId: number,
    revisionId: number,
    status: Exclude<AppKnowledgeReviewStatus, 'superseded'>,
  ): Promise<unknown>;
}

const roleLabel: Record<AppKnowledgeRole, string> = {
  designer: 'Designer',
  developer: 'Developer',
  product: 'Product',
};

const statusLabel = (value: string) =>
  value.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');

const reviewVariant = (status: AppKnowledgeReviewStatus) =>
  status === 'approved' ? 'success' as const
    : status === 'in_review' ? 'info' as const
      : status === 'superseded' ? 'neutral' as const
        : 'warning' as const;

function viewModel(
  view: AppKnowledgeView,
  role: AppKnowledgeRole,
): {
  projection: AppKnowledgeRoleProjection;
  manifest: Array<AppKnowledgeEvidenceReference | AppKnowledgeEvidenceManifestItem>;
  reviewStatus: AppKnowledgeReviewStatus;
  revisionNumber: number;
  generatedAt: string;
  sourceSha256?: string;
  providerModel?: string;
  promptVersion?: number;
  coverage: {
    eligible: number;
    analyzed: number;
    failed: number;
    total: number;
  };
  snapshotId?: number;
  revisionId: number;
  diagnostics?: {
    partialCoverage: boolean;
    failedEvidenceCount: number;
    lowConfidenceClaimIds: string[];
    sourceChanged: boolean;
  } | null;
} {
  if ('snapshot' in view) {
    const revision = view.snapshot.currentRevision;
    if (!revision) throw new Error('App Knowledge snapshot has no current revision');
    return {
      projection: projectAppKnowledge(revision.content, role),
      manifest: revision.manifest,
      reviewStatus: revision.reviewStatus,
      revisionNumber: revision.revisionNumber,
      generatedAt: revision.content.identity.generatedAt,
      sourceSha256: revision.sourceSha256,
      providerModel: revision.providerModel,
      promptVersion: revision.promptVersion,
      coverage: revision.content.coverage,
      snapshotId: view.snapshot.id,
      revisionId: revision.id,
      diagnostics: view.qualityDiagnostics,
    };
  }
  return {
    projection: view.projection,
    manifest: view.revision.evidence,
    reviewStatus: view.revision.reviewStatus,
    revisionNumber: view.revision.revisionNumber,
    generatedAt: view.revision.content.identity.generatedAt,
    coverage: view.revision.content.coverage,
    revisionId: view.revision.id,
  };
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        color: 'var(--color-text-secondary)',
        fontSize: 11,
        fontWeight: 650,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

export function AppKnowledgePanelView(props: {
  app: string;
  platform: Platform;
  version?: number;
  userRole: 'admin' | 'user';
  knowledgeRole: AppKnowledgeRole;
  status: AppKnowledgeState['status'];
  view: AppKnowledgeView | null;
  error: Error | null;
  currentJob: AppKnowledgeJobView | null;
  actions: PanelActions | null;
  onRoleChange(role: AppKnowledgeRole): void;
  retry(): void | Promise<unknown>;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const run = (operation: (() => Promise<unknown>) | undefined) => {
    if (!operation || actionPending) return;
    setActionPending(true);
    setActionError(null);
    void operation()
      .catch((error: Error) => setActionError(error.message))
      .finally(() => setActionPending(false));
  };
  const scope = `${props.app} · ${PLATFORM_LABEL[props.platform]}${props.version ? ` · Version ${props.version}` : ''}`;

  if ((props.status === 'idle' || props.status === 'loading') && !props.view) {
    return (
      <div role="status" aria-label="Loading App Knowledge" style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (props.status === 'error' && !props.view) {
    return (
      <div role="alert">
        <EmptyState
          title="Could not load analysis"
          description={props.error?.message}
          actions={<Button label="Retry" clickAction={() => void props.retry()} />}
        />
      </div>
    );
  }
  if (props.status === 'missing' || !props.view) {
    return (
      <EmptyState
        title="Analysis is not published yet"
        description={props.userRole === 'admin'
          ? `${scope}. Start a scoped analysis for this capture version.`
          : 'A curator has not published an analysis for this capture version.'}
        actions={props.userRole === 'admin' ? (
          <Button
            label="Start analysis"
            variant="primary"
            isDisabled={!props.version || actionPending}
            clickAction={() => run(props.actions?.start)}
          />
        ) : undefined}
      />
    );
  }

  const model = viewModel(props.view, props.knowledgeRole);
  const job = props.currentJob ?? ('job' in props.view ? props.view.job : null);
  const active = job?.status === 'queued' || job?.status === 'running';
  const canRegenerate = props.userRole === 'admin' && model.snapshotId && !active;
  const actions = props.actions;
  const actionButtons = props.userRole === 'admin' ? (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {active && <Button label="Cancel" variant="secondary" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.cancel!(job.id))} />}
      {job && (job.status === 'cancelled' || job.status === 'stale') && <Button label="Resume" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.resume!(job.id))} />}
      {job?.status === 'error' && job.failedCount > 0 && <Button label="Retry failed evidence" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.retryFailed!(job.id))} />}
      {canRegenerate && <Button label="Regenerate" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.regenerate!(model.snapshotId!))} />}
      {model.reviewStatus === 'draft' && <Button label="Send to review" variant="primary" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.setReviewStatus!(model.snapshotId!, model.revisionId, 'in_review'))} />}
      {model.reviewStatus === 'in_review' && (
        <>
          <Button label="Approve" variant="primary" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.setReviewStatus!(model.snapshotId!, model.revisionId, 'approved'))} />
          <Button label="Return to draft" size="sm" isDisabled={actionPending} clickAction={() => run(() => actions!.setReviewStatus!(model.snapshotId!, model.revisionId, 'draft'))} />
        </>
      )}
    </div>
  ) : null;

  return (
    <section aria-label="App Knowledge analysis" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 24 }}>App Knowledge</h2>
            <Badge variant={reviewVariant(model.reviewStatus)} label={statusLabel(model.reviewStatus)} />
            {job && <Badge variant={active ? 'info' : job.status === 'error' ? 'error' : 'neutral'} label={`Job ${statusLabel(job.status)}`} />}
          </div>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{scope}</span>
        </div>
        {actionButtons}
      </div>

      <Card variant="muted" padding={4}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 18 }}>
          <MetaItem label="Revision" value={`#${model.revisionNumber}`} />
          <MetaItem label="Coverage" value={`${model.coverage.analyzed}/${model.coverage.eligible} analyzed`} />
          <MetaItem label="Failed" value={String(model.coverage.failed)} />
          <MetaItem label="Generated" value={new Date(model.generatedAt).toLocaleDateString()} />
          {model.providerModel && <MetaItem label="Provider" value={model.providerModel} />}
          {model.promptVersion && <MetaItem label="Prompt" value={`v${model.promptVersion}`} />}
          {model.sourceSha256 && <MetaItem label="Source" value={model.sourceSha256.slice(0, 12)} />}
        </div>
      </Card>

      {job && active && (
        <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            <span>{statusLabel(job.stage)}</span>
            <span>{job.doneCount}/{job.totalCount || '—'}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--color-background-muted)', overflow: 'hidden' }}>
            <div style={{
              width: `${job.totalCount ? Math.min(100, (job.doneCount / job.totalCount) * 100) : 4}%`,
              minWidth: 12,
              height: '100%',
              background: 'var(--color-accent)',
            }} />
          </div>
        </div>
      )}

      {props.userRole === 'admin' && model.diagnostics?.partialCoverage && (
        <Card variant="orange" padding={4}>
          <strong style={{ color: 'var(--color-text-primary)' }}>Partial coverage needs review</strong>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            {model.diagnostics.failedEvidenceCount} evidence item(s) failed and {model.diagnostics.lowConfidenceClaimIds.length} claim(s) are below the confidence threshold.
          </p>
        </Card>
      )}
      {actionError && <div role="alert" style={{ color: 'var(--color-text-error)' }}>{actionError}</div>}

      <SegmentedControl
        value={props.knowledgeRole}
        onChange={(value) => props.onRoleChange(value as AppKnowledgeRole)}
        label="Knowledge audience"
        size="sm"
      >
        {(Object.keys(roleLabel) as AppKnowledgeRole[]).map((role) => (
          <SegmentedControlItem key={role} value={role} label={roleLabel[role]} />
        ))}
      </SegmentedControl>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {model.projection.sections.map((section) => (
          <section key={section.id} aria-labelledby={`knowledge-${section.id}`}>
            <h3 id={`knowledge-${section.id}`} style={{ margin: '0 0 12px', color: 'var(--color-text-primary)', fontSize: 18 }}>
              {section.title}
            </h3>
            {section.claims.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {section.claims.map((claim) => (
                  <Card key={claim.id} padding={4}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 14, lineHeight: 1.5 }}>{claim.text}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Badge label={statusLabel(claim.kind)} variant={claim.kind === 'observed' ? 'success' : claim.kind === 'inferred' ? 'info' : 'neutral'} />
                        <Badge label={`${Math.round(claim.confidence * 100)}% confidence`} variant={claim.confidence >= 0.8 ? 'success' : claim.confidence >= 0.6 ? 'warning' : 'error'} />
                        <Badge label={statusLabel(model.reviewStatus)} variant={reviewVariant(model.reviewStatus)} />
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {claim.evidenceIds.map((evidenceId) => (
                          <AppKnowledgeEvidenceLink
                            key={evidenceId}
                            app={props.app}
                            platform={props.platform}
                            version={props.version}
                            evidenceId={evidenceId}
                            manifest={model.manifest}
                          />
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title={`No ${section.title.toLowerCase()} claims`} isCompact />
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

export function AppKnowledgePanel(props: {
  app: string;
  platform: Platform;
  version?: number;
  userRole: 'admin' | 'user';
}) {
  const [knowledgeRole, setKnowledgeRole] = useState<AppKnowledgeRole>('designer');
  const knowledge = useAppKnowledge({
    app: props.app,
    platform: props.platform,
    version: props.version,
    role: knowledgeRole,
    userRole: props.userRole,
  });
  return (
    <AppKnowledgePanelView
      {...props}
      knowledgeRole={knowledgeRole}
      status={knowledge.status}
      view={knowledge.data}
      error={knowledge.error}
      currentJob={knowledge.currentJob}
      actions={knowledge.actions}
      onRoleChange={setKnowledgeRole}
      retry={knowledge.retry}
    />
  );
}
