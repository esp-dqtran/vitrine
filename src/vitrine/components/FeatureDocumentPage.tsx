import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Spinner } from '@astryxdesign/core';
import type {
  FeatureDocumentContent,
  FeatureDocumentJobView,
  FeatureDocumentReviewStatus,
  FeatureDocumentRevisionView,
  FeatureDocumentShareView,
  FeatureDocumentView,
} from '../../featureDocument.ts';
import {
  acknowledgeFeatureDocumentSourceChange,
  cancelFeatureDocumentJob,
  createFeatureDocumentShare,
  downloadFeatureDocumentMarkdown,
  getFeatureDocument,
  regenerateFeatureDocument,
  retryFeatureDocumentJob,
  revokeFeatureDocumentShare,
  restoreFeatureDocumentRevision,
  saveFeatureDocumentRevision,
  setFeatureDocumentReviewStatus,
  subscribeFeatureDocumentJob,
} from '../featureDocumentsApi.ts';
import { FeatureDocumentEditor } from './FeatureDocumentEditor.tsx';
import { FeatureDocumentEvidencePanel } from './FeatureDocumentEvidencePanel.tsx';
import { FeatureDocumentProgress } from './FeatureDocumentProgress.tsx';
import { FeatureDocumentRevisionHistory } from './FeatureDocumentRevisionHistory.tsx';

const activeJob = (job: FeatureDocumentJobView | undefined) =>
  job?.status === 'queued' || job?.status === 'running';

export function featureDocumentReviewActions(
  status: FeatureDocumentReviewStatus,
): FeatureDocumentReviewStatus[] {
  return status === 'draft' ? ['in_review'] : status === 'in_review' ? ['draft', 'approved'] : [];
}

export function FeatureDocumentPendingState({
  title,
  job,
  error,
  connectionError,
  onCancel,
  onReconnect,
  onRetry,
}: {
  title: string;
  job?: FeatureDocumentJobView;
  error?: string;
  connectionError?: string;
  onCancel?: () => void;
  onReconnect?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="vitrine-page feature-document-page">
      <header className="feature-document-header">
        <div>
          <div className="feature-document-kicker">Feature Document</div>
          <h1>{title}</h1>
        </div>
      </header>
      {error && <div role="alert" className="feature-document-warning">{error}</div>}
      {job
        ? (
            <FeatureDocumentProgress
              job={job}
              connectionError={connectionError}
              onCancel={onCancel}
              onReconnect={onReconnect}
              onRetry={onRetry}
            />
          )
        : (
            <EmptyState
              title="Generation unavailable"
              description="This Feature Document has no revision or active generation."
            />
          )}
    </div>
  );
}

export interface FeatureDocumentWorkspaceProps {
  initialDocument: FeatureDocumentView;
  onDocumentChange?(document: FeatureDocumentView): void;
  embedded?: boolean;
}

export function FeatureDocumentWorkspace({
  initialDocument,
  onDocumentChange,
  embedded = false,
}: FeatureDocumentWorkspaceProps) {
  const initialRevision = initialDocument.currentRevision ?? initialDocument.revisions[0];
  const [document, setDocument] = useState(initialDocument);
  const [selectedRevisionId, setSelectedRevisionId] = useState(initialRevision?.id);
  const [comparisonRevisionId, setComparisonRevisionId] = useState<number>();
  const [draft, setDraft] = useState<FeatureDocumentContent | undefined>(
    () => initialRevision ? structuredClone(initialRevision.content) : undefined,
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(
    initialRevision?.evidenceManifest[0]?.evidenceId,
  );
  const [job, setJob] = useState(initialDocument.currentJob);
  const [connectionError, setConnectionError] = useState('');
  const [subscriptionRevision, setSubscriptionRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shares, setShares] = useState<FeatureDocumentShareView[]>(initialDocument.shares ?? []);
  const [error, setError] = useState('');
  const documentId = document.id;

  const publishDocument = (next: FeatureDocumentView) => {
    setDocument(next);
    onDocumentChange?.(next);
  };

  const applyDocument = (next: FeatureDocumentView) => {
    publishDocument(next);
    const revision = next.currentRevision ?? next.revisions[0];
    setSelectedRevisionId(revision?.id);
    setComparisonRevisionId(undefined);
    setDraft(revision ? structuredClone(revision.content) : undefined);
    setSelectedEvidenceId(revision?.evidenceManifest[0]?.evidenceId);
    setJob(next.currentJob);
    setShares(next.shares ?? []);
  };

  const reload = async () => {
    applyDocument(await getFeatureDocument(documentId));
  };

  useEffect(() => {
    if (initialDocument.id !== document.id) {
      applyDocument(initialDocument);
    }
  }, [initialDocument.id]);

  useEffect(() => {
    if (!job || !activeJob(job)) return;
    setConnectionError('');
    return subscribeFeatureDocumentJob(
      job.id,
      (next) => {
        setJob(next);
        if (next.status === 'done') {
          void reload().catch((cause: Error) => setError(cause.message));
        }
      },
      (cause) => setConnectionError(cause.message),
    );
  }, [job?.id, subscriptionRevision]);

  const selectedRevision = document.revisions.find(({ id }) => id === selectedRevisionId);
  const comparisonRevision = document.revisions.find(({ id }) => id === comparisonRevisionId);
  const dirty = Boolean(
    selectedRevision
    && draft
    && JSON.stringify(selectedRevision.content) !== JSON.stringify(draft),
  );
  const isCurrent = selectedRevision?.id === document.currentRevision?.id;

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const selectRevision = (revisionId: number) => {
    if (dirty && !window.confirm('Discard unsaved Feature Document changes?')) return;
    const revision = document.revisions.find(({ id }) => id === revisionId);
    if (!revision) return;
    setSelectedRevisionId(revision.id);
    setDraft(structuredClone(revision.content));
    setSelectedEvidenceId(revision.evidenceManifest[0]?.evidenceId);
  };

  const updateCurrentRevision = (revision: FeatureDocumentRevisionView) => {
    const revisions = [revision, ...document.revisions.filter(({ id }) => id !== revision.id)];
    publishDocument({
      ...document,
      reviewStatus: revision.reviewStatus,
      currentRevision: revision,
      revisions,
    });
    setSelectedRevisionId(revision.id);
    setDraft(structuredClone(revision.content));
    setSelectedEvidenceId(revision.evidenceManifest[0]?.evidenceId);
  };

  const save = async () => {
    if (!document.currentRevision || !draft || !isCurrent || !dirty) return;
    setBusy(true);
    setError('');
    try {
      updateCurrentRevision(
        await saveFeatureDocumentRevision(documentId, document.currentRevision.id, draft),
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (revisionId: number) => {
    if (!window.confirm('Restore this snapshot as a new Draft revision?')) return;
    setBusy(true);
    setError('');
    try {
      updateCurrentRevision(await restoreFeatureDocumentRevision(documentId, revisionId));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    const focus = window.prompt(
      'Focus instruction for regeneration',
      document.currentRevision?.focusInstruction ?? '',
    );
    if (focus === null || focus.length > 2_000) return;
    setBusy(true);
    setError('');
    try {
      const nextJob = await regenerateFeatureDocument(documentId, focus);
      setJob(nextJob);
      publishDocument({ ...document, currentJob: nextJob });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const retain = async () => {
    setBusy(true);
    setError('');
    try {
      applyDocument(await acknowledgeFeatureDocumentSourceChange(documentId));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const transitionReview = async (status: FeatureDocumentReviewStatus) => {
    if (!selectedRevision || !isCurrent) return;
    setBusy(true);
    setError('');
    try {
      applyDocument(
        await setFeatureDocumentReviewStatus(documentId, selectedRevision.id, status),
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadMarkdown = async () => {
    if (!selectedRevision) return;
    setBusy(true);
    setError('');
    try {
      const download = await downloadFeatureDocumentMarkdown(documentId, selectedRevision.id);
      const url = URL.createObjectURL(download.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = download.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createShare = async () => {
    if (!selectedRevision) return;
    setBusy(true);
    setError('');
    try {
      const created = await createFeatureDocumentShare(documentId, selectedRevision.id);
      const nextShares = [created, ...shares.filter(({ id }) => id !== created.id)];
      setShares(nextShares);
      publishDocument({ ...document, shares: nextShares });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      const next = await retryFeatureDocumentJob(job.id);
      setJob(next);
      publishDocument({ ...document, currentJob: next });
      setSubscriptionRevision((value) => value + 1);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!job) return;
    try {
      const next = await cancelFeatureDocumentJob(job.id);
      setJob(next);
      publishDocument({ ...document, currentJob: next });
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const revokeShare = async (shareId: number) => {
    setBusy(true);
    setError('');
    try {
      await revokeFeatureDocumentShare(documentId, shareId);
      const nextShares = shares.map((share) =>
        share.id === shareId ? { ...share, revokedAt: new Date().toISOString() } : share);
      setShares(nextShares);
      publishDocument({ ...document, shares: nextShares });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selectedLabel = useMemo(
    () => selectedRevision ? `Revision ${selectedRevision.revisionNumber}` : '',
    [selectedRevision],
  );

  if (!selectedRevision || !draft) {
    return (
      <FeatureDocumentPendingState
        title={document.title}
        job={job}
        error={error}
        connectionError={connectionError}
        onCancel={job && activeJob(job) ? () => void cancel() : undefined}
        onReconnect={() => setSubscriptionRevision((value) => value + 1)}
        onRetry={
          job && (job.status === 'error' || job.status === 'cancelled' || job.status === 'stale')
            ? () => void retry()
            : undefined
        }
      />
    );
  }

  const canSave = Boolean(isCurrent && dirty && !busy);
  return (
    <section
      className={`feature-document-workspace-shell${embedded ? ' is-embedded' : ''}`}
      aria-label="Document Flow editor"
    >
      <header className="feature-document-header">
        <div>
          <div className="feature-document-kicker">Feature Document</div>
          <h1>{document.title}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge label={selectedRevision.reviewStatus} variant="neutral" />
            <span>{selectedLabel}</span>
          </div>
        </div>
        <div className="feature-document-actions">
          {isCurrent && featureDocumentReviewActions(selectedRevision.reviewStatus).map((status) => (
            <Button
              key={status}
              label={
                status === 'in_review'
                  ? 'Submit for review'
                  : status === 'approved'
                    ? 'Approve revision'
                    : 'Return to draft'
              }
              variant={status === 'approved' ? 'primary' : 'ghost'}
              isDisabled={busy || dirty}
              clickAction={() => void transitionReview(status)}
            />
          ))}
          <Button
            label="Download Markdown"
            variant="ghost"
            isDisabled={busy}
            clickAction={() => void downloadMarkdown()}
          />
          <Button
            label="Create read-only share"
            variant="ghost"
            isDisabled={busy}
            clickAction={() => void createShare()}
          />
          {document.sourceChanged && (
            <Button
              label="Retain current document"
              variant="ghost"
              isDisabled={busy}
              clickAction={() => void retain()}
            />
          )}
          <Button
            label="Regenerate"
            variant="ghost"
            isDisabled={busy || activeJob(job)}
            clickAction={() => void regenerate()}
          />
          <Button
            label="Save new revision"
            variant="primary"
            isDisabled={!canSave}
            isLoading={busy}
            clickAction={() => void save()}
          />
        </div>
      </header>
      {document.sourceChanged && (
        <div role="alert" className="feature-document-warning">
          The source Flow changed. Regenerate from current evidence or explicitly retain this revision.
        </div>
      )}
      {error && <div role="alert" className="feature-document-warning">{error}</div>}
      {shares.map((share) => (
        <div className="feature-document-share-grant" key={share.id}>
          <span>Share URL</span>
          <code className="feature-document-share-url" aria-label="Share URL">
            {share.url ?? `Share ${share.id} (URL hidden after creation)`}
          </code>
          <span>Expires {new Date(share.expiresAt).toLocaleString()}</span>
          {share.url && (
            <Button
              label="Copy share URL"
              variant="ghost"
              size="sm"
              clickAction={() => void navigator.clipboard.writeText(share.url!)}
            />
          )}
          {share.url && (
            <Button
              label="Open share"
              variant="ghost"
              size="sm"
              clickAction={() => window.open(share.url!, '_blank', 'noopener,noreferrer')}
            />
          )}
          <Button
            label={share.revokedAt ? 'Revoked' : 'Revoke share'}
            variant="ghost"
            size="sm"
            isDisabled={busy || Boolean(share.revokedAt)}
            clickAction={() => void revokeShare(share.id)}
          />
        </div>
      ))}
      {job && (activeJob(job) || job.status === 'error' || job.status === 'stale') && (
        <FeatureDocumentProgress
          job={job}
          connectionError={connectionError}
          onCancel={activeJob(job) ? () => void cancel() : undefined}
          onReconnect={() => setSubscriptionRevision((value) => value + 1)}
          onRetry={() => void retry()}
        />
      )}
      <div className="feature-document-workspace">
        <FeatureDocumentRevisionHistory
          revisions={document.revisions}
          selectedRevisionId={selectedRevision.id}
          comparisonRevisionId={comparisonRevisionId}
          onSelect={selectRevision}
          onCompare={setComparisonRevisionId}
          onRestore={restore}
        />
        <main className="feature-document-main">
          {!isCurrent && (
            <div className="feature-document-readonly-note">
              Historical revisions are read-only. Restore this revision to continue editing it.
            </div>
          )}
          <FeatureDocumentEditor
            content={draft}
            onChange={setDraft}
            onEvidence={setSelectedEvidenceId}
            readOnly={!isCurrent}
          />
          {comparisonRevision && (
            <section className="feature-document-comparison">
              <h2>Compare with Revision {comparisonRevision.revisionNumber}</h2>
              <FeatureDocumentEditor
                content={comparisonRevision.content}
                onChange={() => undefined}
                onEvidence={setSelectedEvidenceId}
                readOnly
              />
            </section>
          )}
        </main>
        <FeatureDocumentEvidencePanel
          documentId={documentId}
          revision={selectedRevision}
          selectedEvidenceId={selectedEvidenceId}
          onSelect={setSelectedEvidenceId}
        />
      </div>
    </section>
  );
}

export function FeatureDocumentPage({ documentId }: { documentId: number }) {
  const [document, setDocument] = useState<FeatureDocumentView | null>(null);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setError('');
    getFeatureDocument(documentId)
      .then((next) => {
        if (live) setDocument(next);
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      });
    return () => {
      live = false;
    };
  }, [documentId, reloadVersion]);

  if (error && !document) {
    return (
      <EmptyState
        title="Could not load Feature Document"
        description={error}
        actions={
          <Button
            label="Retry"
            clickAction={() => setReloadVersion((value) => value + 1)}
          />
        }
      />
    );
  }
  if (!document) {
    return (
      <div
        role="status"
        aria-label="Loading Feature Document"
        style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="vitrine-page feature-document-page">
      <FeatureDocumentWorkspace initialDocument={document} onDocumentChange={setDocument} />
    </div>
  );
}
