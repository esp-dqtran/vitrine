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

const activeJob = (job: FeatureDocumentJobView | undefined) => job?.status === 'queued' || job?.status === 'running';

export function featureDocumentReviewActions(status: FeatureDocumentReviewStatus): FeatureDocumentReviewStatus[] {
  return status === 'draft' ? ['in_review'] : status === 'in_review' ? ['draft', 'approved'] : [];
}

export function FeatureDocumentPage({ documentId }: { documentId: number }) {
  const [document, setDocument] = useState<FeatureDocumentView | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number>();
  const [comparisonRevisionId, setComparisonRevisionId] = useState<number>();
  const [draft, setDraft] = useState<FeatureDocumentContent>();
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>();
  const [job, setJob] = useState<FeatureDocumentJobView>();
  const [connectionError, setConnectionError] = useState('');
  const [subscriptionRevision, setSubscriptionRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<FeatureDocumentShareView>();
  const [error, setError] = useState('');

  const applyDocument = (next: FeatureDocumentView) => {
    setDocument(next);
    const revision = next.currentRevision ?? next.revisions[0];
    setSelectedRevisionId(revision?.id);
    if (revision) {
      setDraft(structuredClone(revision.content));
      setSelectedEvidenceId(revision.evidenceManifest[0]?.evidenceId);
    }
    setJob(next.currentJob);
  };

  const reload = async () => {
    const next = await getFeatureDocument(documentId);
    applyDocument(next);
  };

  useEffect(() => {
    let live = true;
    setError('');
    getFeatureDocument(documentId)
      .then((next) => { if (live) applyDocument(next); })
      .catch((cause: Error) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [documentId]);

  useEffect(() => {
    if (!job || !activeJob(job)) return;
    setConnectionError('');
    return subscribeFeatureDocumentJob(job.id, (next) => {
      setJob(next);
      if (next.status === 'done') void reload().catch((cause: Error) => setError(cause.message));
    }, (cause) => setConnectionError(cause.message));
  }, [job?.id, subscriptionRevision]);

  const selectedRevision = document?.revisions.find(({ id }) => id === selectedRevisionId);
  const comparisonRevision = document?.revisions.find(({ id }) => id === comparisonRevisionId);
  const dirty = Boolean(selectedRevision && draft && JSON.stringify(selectedRevision.content) !== JSON.stringify(draft));
  const isCurrent = selectedRevision?.id === document?.currentRevision?.id;

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const selectRevision = (revisionId: number) => {
    if (dirty && !window.confirm('Discard unsaved Feature Document changes?')) return;
    const revision = document?.revisions.find(({ id }) => id === revisionId);
    if (!revision) return;
    setSelectedRevisionId(revision.id);
    setDraft(structuredClone(revision.content));
    setSelectedEvidenceId(revision.evidenceManifest[0]?.evidenceId);
  };

  const updateCurrentRevision = (revision: FeatureDocumentRevisionView) => {
    if (!document) return;
    const revisions = [revision, ...document.revisions.filter(({ id }) => id !== revision.id)];
    const next = { ...document, reviewStatus: revision.reviewStatus, currentRevision: revision, revisions };
    setDocument(next);
    setSelectedRevisionId(revision.id);
    setDraft(structuredClone(revision.content));
    setSelectedEvidenceId(revision.evidenceManifest[0]?.evidenceId);
  };

  const save = async () => {
    if (!document?.currentRevision || !draft || !isCurrent || !dirty) return;
    setBusy(true); setError('');
    try { updateCurrentRevision(await saveFeatureDocumentRevision(documentId, document.currentRevision.id, draft)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const restore = async (revisionId: number) => {
    if (!window.confirm('Restore this snapshot as a new Draft revision?')) return;
    setBusy(true); setError('');
    try { updateCurrentRevision(await restoreFeatureDocumentRevision(documentId, revisionId)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const regenerate = async () => {
    const focus = window.prompt('Focus instruction for regeneration', document?.currentRevision?.focusInstruction ?? '');
    if (focus === null || focus.length > 2_000) return;
    setBusy(true); setError('');
    try { setJob(await regenerateFeatureDocument(documentId, focus)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const retain = async () => {
    setBusy(true); setError('');
    try { applyDocument(await acknowledgeFeatureDocumentSourceChange(documentId)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const transitionReview = async (status: FeatureDocumentReviewStatus) => {
    if (!selectedRevision || !isCurrent) return;
    setBusy(true); setError('');
    try { applyDocument(await setFeatureDocumentReviewStatus(documentId, selectedRevision.id, status)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const downloadMarkdown = async () => {
    if (!selectedRevision) return;
    setBusy(true); setError('');
    try {
      const download = await downloadFeatureDocumentMarkdown(documentId, selectedRevision.id);
      const url = URL.createObjectURL(download.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = download.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const createShare = async () => {
    if (!selectedRevision) return;
    setBusy(true); setError('');
    try { setShare(await createFeatureDocumentShare(documentId, selectedRevision.id)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const revokeShare = async () => {
    if (!share) return;
    setBusy(true); setError('');
    try { await revokeFeatureDocumentShare(documentId, share.id); setShare(undefined); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  const title = document?.title ?? 'Feature Document';
  const canSave = Boolean(isCurrent && dirty && !busy);
  const selectedLabel = useMemo(() => selectedRevision ? `Revision ${selectedRevision.revisionNumber}` : '', [selectedRevision]);

  if (error && !document) return <EmptyState title="Could not load Feature Document" description={error} actions={<Button label="Retry" clickAction={() => void reload()} />} />;
  if (!document || !selectedRevision || !draft) return <div role="status" aria-label="Loading Feature Document" style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><Spinner size="lg" /></div>;

  return (
    <div className="feature-document-page">
      <header className="feature-document-header">
        <div><div className="feature-document-kicker">Feature Document</div><h1>{title}</h1><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge label={selectedRevision.reviewStatus} variant="neutral" /><span>{selectedLabel}</span></div></div>
        <div className="feature-document-actions">
          {isCurrent && featureDocumentReviewActions(selectedRevision.reviewStatus).map((status) => (
            <Button
              key={status}
              label={status === 'in_review' ? 'Submit for review' : status === 'approved' ? 'Approve revision' : 'Return to draft'}
              variant={status === 'approved' ? 'primary' : 'ghost'}
              isDisabled={busy || dirty}
              clickAction={() => transitionReview(status)}
            />
          ))}
          <Button label="Download Markdown" variant="ghost" isDisabled={busy} clickAction={downloadMarkdown} />
          <Button label="Create read-only share" variant="ghost" isDisabled={busy} clickAction={createShare} />
          {document.sourceChanged && <Button label="Retain current document" variant="ghost" isDisabled={busy} clickAction={retain} />}
          <Button label="Regenerate" variant="ghost" isDisabled={busy || activeJob(job)} clickAction={regenerate} />
          <Button label="Save new revision" variant="primary" isDisabled={!canSave} isLoading={busy} clickAction={save} />
        </div>
      </header>
      {document.sourceChanged && <div role="alert" className="feature-document-warning">The source Flow changed. Regenerate from current evidence or explicitly retain this revision.</div>}
      {error && <div role="alert" className="feature-document-warning">{error}</div>}
      {share?.url && (
        <div className="feature-document-share-grant">
          <label htmlFor="feature-document-share-url">Share URL</label>
          <input id="feature-document-share-url" aria-label="Share URL" readOnly value={share.url} />
          <span>Expires {new Date(share.expiresAt).toLocaleString()}</span>
          <Button label="Copy share URL" variant="ghost" size="sm" clickAction={() => navigator.clipboard.writeText(share.url!)} />
          <Button label="Open share" variant="ghost" size="sm" clickAction={() => { window.open(share.url!, '_blank', 'noopener,noreferrer'); }} />
          <Button label="Revoke share" variant="ghost" size="sm" isDisabled={busy} clickAction={revokeShare} />
        </div>
      )}
      {job && (activeJob(job) || job.status === 'error' || job.status === 'stale') && (
        <FeatureDocumentProgress
          job={job}
          connectionError={connectionError}
          onCancel={activeJob(job) ? () => void cancelFeatureDocumentJob(job.id).then(setJob).catch((cause: Error) => setError(cause.message)) : undefined}
          onReconnect={() => setSubscriptionRevision((value) => value + 1)}
          onRetry={regenerate}
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
          {!isCurrent && <div className="feature-document-readonly-note">Historical revisions are read-only. Restore this revision to continue editing it.</div>}
          <FeatureDocumentEditor content={draft} onChange={setDraft} onEvidence={setSelectedEvidenceId} readOnly={!isCurrent} />
          {comparisonRevision && (
            <section className="feature-document-comparison"><h2>Compare with Revision {comparisonRevision.revisionNumber}</h2><FeatureDocumentEditor content={comparisonRevision.content} onChange={() => {}} onEvidence={setSelectedEvidenceId} readOnly /></section>
          )}
        </main>
        <FeatureDocumentEvidencePanel documentId={documentId} revision={selectedRevision} selectedEvidenceId={selectedEvidenceId} onSelect={setSelectedEvidenceId} />
      </div>
    </div>
  );
}
