import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Spinner,
  TextArea,
} from '@astryxdesign/core';
import type {
  AppKnowledgeClaim,
  AppKnowledgeReviewStatus,
  AppKnowledgeSnapshot,
} from '../../appKnowledge.ts';
import type { AppKnowledgeRevisionView } from '../../appKnowledgeStore.ts';
import type { Platform } from '../../platformFromUrl.ts';
import type { AdminAppKnowledgeView } from '../appKnowledgeApi.ts';
import { useAppKnowledge } from '../useAppKnowledge.ts';
import { AppKnowledgeEvidenceLink } from './AppKnowledgeEvidenceLink.tsx';

type ReviewAction =
  | 'claim_edited'
  | 'claim_approved'
  | 'claim_rejected'
  | 'component_confirmed'
  | 'component_rejected'
  | 'token_confirmed'
  | 'token_rejected'
  | 'flow_reviewed'
  | 'role_projection_reviewed'
  | 'pilot_auth_accepted'
  | 'snapshot_submitted'
  | 'snapshot_approved';

interface ReviewActions {
  saveRevision(
    snapshotId: number,
    revisionId: number,
    content: AppKnowledgeSnapshot,
  ): Promise<AppKnowledgeRevisionView | { id: number }>;
  recordReviewAction(
    snapshotId: number,
    revisionId: number,
    action: ReviewAction,
    entityId: string,
  ): Promise<unknown>;
  setReviewStatus(
    snapshotId: number,
    revisionId: number,
    status: Exclude<AppKnowledgeReviewStatus, 'superseded'>,
  ): Promise<unknown>;
  acknowledgeCoverage(snapshotId: number, revisionId: number, note?: string): Promise<unknown>;
  regenerate(snapshotId: number): Promise<unknown>;
}

interface ClaimReference {
  claim: AppKnowledgeClaim;
  path: Array<string | number>;
  section: string;
}

const sectionTitle: Record<string, string> = {
  screens: 'Screens',
  componentCandidates: 'Components',
  designLanguage: 'Design language',
  flows: 'Flows',
  productKnowledge: 'Product knowledge',
};

function isClaim(value: unknown): value is AppKnowledgeClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.text === 'string'
    && typeof item.confidence === 'number'
    && Array.isArray(item.evidenceIds);
}

function collectClaims(
  value: unknown,
  path: Array<string | number> = [],
  output: ClaimReference[] = [],
): ClaimReference[] {
  if (isClaim(value)) {
    output.push({
      claim: value,
      path,
      section: sectionTitle[String(path[0])] ?? 'Other',
    });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectClaims(item, [...path, index], output));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectClaims(item, [...path, key], output));
  }
  return output;
}

function replaceClaimText(
  snapshot: AppKnowledgeSnapshot,
  path: Array<string | number>,
  text: string,
): AppKnowledgeSnapshot {
  const next = structuredClone(snapshot);
  let current: unknown = next;
  for (const key of path.slice(0, -1)) {
    current = (current as Record<string | number, unknown>)[key];
  }
  const finalKey = path.at(-1);
  if (finalKey === undefined) throw new Error('Claim path is invalid');
  const target = (current as Record<string | number, unknown>)[finalKey];
  if (!isClaim(target)) throw new Error('Claim no longer exists');
  (current as Record<string | number, unknown>)[finalKey] = { ...target, text };
  return next;
}

function decisionFor(view: AdminAppKnowledgeView, entityId: string): string | undefined {
  return [...view.snapshot.reviewEvents].reverse().find((event) =>
    (event.details as { entityId?: string }).entityId === entityId)?.action;
}

export function AppKnowledgeReviewPanel(props: {
  app: string;
  platform: Platform;
  version?: number;
  view: AdminAppKnowledgeView;
  actions: ReviewActions;
  retry(): void | Promise<unknown>;
}) {
  const revision = props.view.snapshot.currentRevision;
  const claims = useMemo(
    () => revision ? collectClaims(revision.content) : [],
    [revision],
  );
  const [selectedClaimId, setSelectedClaimId] = useState(claims[0]?.claim.id ?? '');
  const selected = claims.find(({ claim }) => claim.id === selectedClaimId) ?? claims[0];
  const [draftText, setDraftText] = useState(selected?.claim.text ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setSelectedClaimId(claims[0]?.claim.id ?? '');
  }, [revision?.id]);
  useEffect(() => setDraftText(selected?.claim.text ?? ''), [selected?.claim.id, selected?.claim.text]);

  if (!revision) {
    return <EmptyState title="No App Knowledge revision to review" />;
  }

  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (pending) return;
    setPending(true);
    setMessage('');
    try {
      await operation();
      setMessage(success);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setPending(false);
    }
  };
  const decide = (action: ReviewAction, entityId: string, success: string) =>
    run(
      () => props.actions.recordReviewAction(
        props.view.snapshot.id,
        revision.id,
        action,
        entityId,
      ),
      success,
    );
  const saveClaim = () => {
    if (!selected || !draftText.trim() || draftText.trim() === selected.claim.text) return;
    void run(async () => {
      const content = replaceClaimText(revision.content, selected.path, draftText.trim());
      const saved = await props.actions.saveRevision(
        props.view.snapshot.id,
        revision.id,
        content,
      );
      await props.actions.recordReviewAction(
        props.view.snapshot.id,
        saved.id,
        'claim_edited',
        selected.claim.id,
      );
    }, 'Saved as a new draft revision. Source evidence was preserved.');
  };
  const coverageAcknowledged = props.view.snapshot.reviewEvents.some((event) =>
    event.action === 'partial_coverage_acknowledged'
    && (event.revisionId === undefined || event.revisionId === revision.id));
  const sourceFresh = !props.view.qualityDiagnostics?.sourceChanged;
  const approvalReady = revision.reviewStatus === 'in_review'
    && sourceFresh
    && (revision.content.coverage.failed === 0 || coverageAcknowledged);
  const groupedClaims = new Map<string, ClaimReference[]>();
  for (const reference of claims) {
    const group = groupedClaims.get(reference.section);
    if (group) group.push(reference);
    else groupedClaims.set(reference.section, [reference]);
  }
  const tokenCandidates = Object.entries(revision.content.designLanguage)
    .flatMap(([kind, items]) => items.map((item: AppKnowledgeClaim) => ({ kind, item })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>App Knowledge review</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Review claims and candidates without deleting their source evidence.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button label="Regenerate" size="sm" isDisabled={pending} clickAction={() => void run(() => props.actions.regenerate(props.view.snapshot.id), 'Regeneration queued without overwriting this revision.')} />
          {revision.reviewStatus === 'draft' && <Button label="Submit for review" variant="primary" size="sm" isDisabled={pending} clickAction={() => void run(async () => {
            await props.actions.setReviewStatus(props.view.snapshot.id, revision.id, 'in_review');
            await props.actions.recordReviewAction(props.view.snapshot.id, revision.id, 'snapshot_submitted', 'snapshot');
          }, 'Snapshot submitted for review.')} />}
          {revision.reviewStatus === 'in_review' && <Button label="Return to draft" size="sm" isDisabled={pending} clickAction={() => void run(() => props.actions.setReviewStatus(props.view.snapshot.id, revision.id, 'draft'), 'Snapshot returned to draft.')} />}
          {revision.reviewStatus === 'in_review' && <Button label="Approve snapshot" variant="primary" size="sm" isDisabled={pending || !approvalReady} tooltip={!sourceFresh ? 'The capture source changed; regenerate first.' : !coverageAcknowledged && revision.content.coverage.failed > 0 ? 'Acknowledge partial coverage first.' : undefined} clickAction={() => void run(async () => {
            await props.actions.setReviewStatus(props.view.snapshot.id, revision.id, 'approved');
            await props.actions.recordReviewAction(props.view.snapshot.id, revision.id, 'snapshot_approved', 'snapshot');
          }, 'Snapshot approved.')} />}
        </div>
      </div>

      {revision.content.coverage.failed > 0 && !coverageAcknowledged && (
        <Card variant="orange" padding={4}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 220, color: 'var(--color-text-primary)', fontSize: 13 }}>
              {revision.content.coverage.failed} evidence item(s) failed. Approval requires an explicit acknowledgement.
            </span>
            <Button label="Acknowledge partial coverage" size="sm" isDisabled={pending} clickAction={() => void run(() => props.actions.acknowledgeCoverage(props.view.snapshot.id, revision.id), 'Partial coverage acknowledged.')} />
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 0.8fr) minmax(320px, 1.4fr) minmax(220px, 0.8fr)', gap: 16, alignItems: 'start' }}>
        <Card variant="muted" padding={3}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...groupedClaims].map(([section, sectionClaims]) => (
              <section key={section}>
                <h3 style={{ margin: '0 0 7px', fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{section}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sectionClaims.map(({ claim: item }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedClaimId(item.id)}
                      aria-pressed={selected?.claim.id === item.id}
                      style={{
                        border: 0,
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'left',
                        background: selected?.claim.id === item.id ? 'var(--color-background-surface)' : 'transparent',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.35 }}>{item.text}</span>
                      {decisionFor(props.view, item.id) && <Badge label={decisionFor(props.view, item.id)!.replace('claim_', '')} variant="neutral" />}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <Card padding={4}>
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={selected.claim.kind} variant={selected.claim.kind === 'observed' ? 'success' : 'info'} />
                <Badge label={`${Math.round(selected.claim.confidence * 100)}% confidence`} variant={selected.claim.confidence >= 0.8 ? 'success' : 'warning'} />
              </div>
              <TextArea label="Claim" value={draftText} onChange={setDraftText} rows={6} width="100%" isDisabled={revision.reviewStatus === 'approved'} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button label="Save edit" variant="primary" size="sm" isDisabled={pending || revision.reviewStatus === 'approved' || !draftText.trim() || draftText.trim() === selected.claim.text} clickAction={saveClaim} />
                <Button label="Approve claim" size="sm" isDisabled={pending} clickAction={() => void decide('claim_approved', selected.claim.id, 'Claim approved; evidence preserved.')} />
                <Button label="Reject claim" variant="destructive" size="sm" isDisabled={pending} clickAction={() => void decide('claim_rejected', selected.claim.id, 'Claim rejected; evidence preserved.')} />
              </div>
            </div>
          ) : <EmptyState title="No claims in this revision" isCompact />}
        </Card>

        <Card variant="muted" padding={3}>
          <h3 style={{ margin: '0 0 10px', color: 'var(--color-text-primary)', fontSize: 14 }}>Evidence</h3>
          {selected?.claim.evidenceIds.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selected.claim.evidenceIds.map((evidenceId) => (
                <AppKnowledgeEvidenceLink
                  key={evidenceId}
                  app={props.app}
                  platform={props.platform}
                  version={props.version}
                  evidenceId={evidenceId}
                  manifest={revision.manifest}
                />
              ))}
            </div>
          ) : <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No evidence cited.</span>}
        </Card>
      </div>

      <section>
        <h3 style={{ color: 'var(--color-text-primary)' }}>Component candidates</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {revision.content.componentCandidates.map((component) => (
            <Card key={component.id} padding={3}>
              <strong style={{ color: 'var(--color-text-primary)' }}>{component.name}</strong>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{component.purpose}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button label="Confirm component" size="sm" isDisabled={pending} clickAction={() => void decide('component_confirmed', component.id, 'Component confirmed.')} />
                <Button label="Reject component" variant="destructive" size="sm" isDisabled={pending} clickAction={() => void decide('component_rejected', component.id, 'Component rejected; evidence preserved.')} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ color: 'var(--color-text-primary)' }}>Approximate design tokens</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {tokenCandidates.map(({ kind, item }) => (
            <Card key={item.id} padding={3}>
              <Badge label={kind} variant="neutral" />
              <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>{item.text}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button label="Confirm token" size="sm" isDisabled={pending} clickAction={() => void decide('token_confirmed', item.id, 'Token candidate confirmed.')} />
                <Button label="Reject token" variant="destructive" size="sm" isDisabled={pending} clickAction={() => void decide('token_rejected', item.id, 'Token candidate rejected; evidence preserved.')} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ color: 'var(--color-text-primary)' }}>Pilot acceptance</h3>
        <Card variant="muted" padding={4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Complete Flows</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {revision.content.flows.map((flow) => (
                  <Button
                    key={flow.id}
                    label={decisionFor(props.view, flow.id) === 'flow_reviewed' ? `${flow.title} reviewed` : `Mark ${flow.title} reviewed`}
                    size="sm"
                    isDisabled={pending || decisionFor(props.view, flow.id) === 'flow_reviewed'}
                    clickAction={() => void decide('flow_reviewed', flow.id, `${flow.title} marked reviewed.`)}
                  />
                ))}
              </div>
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Role projections</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {(['designer', 'developer', 'product'] as const).map((role) => (
                  <Button
                    key={role}
                    label={decisionFor(props.view, role) === 'role_projection_reviewed' ? `${role} reviewed` : `Record ${role} review`}
                    size="sm"
                    isDisabled={pending || decisionFor(props.view, role) === 'role_projection_reviewed'}
                    clickAction={() => void decide('role_projection_reviewed', role, `${role} projection marked reviewed.`)}
                  />
                ))}
              </div>
            </div>
            <Button
              label={decisionFor(props.view, 'auth') === 'pilot_auth_accepted' ? 'Auth test recorded' : 'Record auth test passed'}
              size="sm"
              isDisabled={pending || decisionFor(props.view, 'auth') === 'pilot_auth_accepted'}
              clickAction={() => void decide('pilot_auth_accepted', 'auth', 'Admin/member auth boundary accepted.')}
            />
          </div>
        </Card>
      </section>
      {message && <div role="status">{message}</div>}
    </div>
  );
}

export function AppKnowledgeReviewWorkspace(props: {
  app: string;
  platform: Platform;
  version?: number;
}) {
  const knowledge = useAppKnowledge({
    app: props.app,
    platform: props.platform,
    version: props.version,
    role: 'designer',
    userRole: 'admin',
  });
  if ((knowledge.status === 'idle' || knowledge.status === 'loading') && !knowledge.data) {
    return <div role="status" aria-label="Loading App Knowledge review" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>;
  }
  if (knowledge.status === 'error' && !knowledge.data) {
    return <div role="alert"><EmptyState title="Could not load App Knowledge review" description={knowledge.error?.message} actions={<Button label="Retry" clickAction={() => void knowledge.retry()} />} /></div>;
  }
  if (knowledge.status === 'missing' || !knowledge.data || !('snapshot' in knowledge.data)) {
    return <EmptyState title="No App Knowledge analysis to review" description="Start analysis from the Analysis tab first." />;
  }
  return (
    <AppKnowledgeReviewPanel
      {...props}
      view={knowledge.data}
      actions={knowledge.actions!}
      retry={knowledge.retry}
    />
  );
}
