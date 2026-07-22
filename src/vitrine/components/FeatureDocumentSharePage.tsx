import { useEffect, useState } from 'react';
import { Badge, EmptyState, Spinner } from '@astryxdesign/core';
import type { PublicFeatureDocumentShare } from '../../featureDocumentStore.ts';
import { getPublicFeatureDocumentShare } from '../featureDocumentsApi.ts';
import { FeatureDocumentEditor } from './FeatureDocumentEditor.tsx';

export function FeatureDocumentSharePage({
  token,
  initialShare,
}: {
  token: string;
  initialShare?: PublicFeatureDocumentShare;
}) {
  const [share, setShare] = useState<PublicFeatureDocumentShare | undefined>(initialShare);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(initialShare?.revision.evidenceManifest[0]?.evidenceId);
  const [error, setError] = useState('');
  useEffect(() => {
    if (initialShare) return;
    let live = true;
    getPublicFeatureDocumentShare(token)
      .then((value) => {
        if (!live) return;
        setShare(value);
        setSelectedEvidenceId(value.revision.evidenceManifest[0]?.evidenceId);
      })
      .catch((cause: Error) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [initialShare, token]);

  if (error) return <EmptyState title="Feature Document share unavailable" description="This share may have expired or been revoked." />;
  if (!share) return <div role="status" aria-label="Loading shared Feature Document" style={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}><Spinner size="lg" /></div>;
  const evidence = share.revision.evidenceManifest.find(({ evidenceId }) => evidenceId === selectedEvidenceId)
    ?? share.revision.evidenceManifest[0];
  return (
    <div className="feature-document-share-page">
      <header>
        <div className="feature-document-kicker">Read-only Feature Document</div>
        <h1>{share.title}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge label={share.reviewStatus} variant="neutral" /><span>Revision {share.revision.revisionNumber}</span><span>Expires {new Date(share.expiresAt).toLocaleDateString()}</span></div>
      </header>
      <div className="feature-document-share-layout">
        <main><FeatureDocumentEditor content={share.revision.content} onChange={() => {}} onEvidence={setSelectedEvidenceId} readOnly /></main>
        <aside className="feature-document-evidence-panel">
          <h3>Evidence</h3>
          {evidence ? <>
            <img className="feature-document-evidence-image" src={`/api/feature-document-shares/${encodeURIComponent(token)}/media/${evidence.imageId}`} alt={`Flow step ${evidence.stepIndex + 1} image ${evidence.imageIndex + 1}`} />
            <strong>{evidence.stepLabel}</strong><p>{evidence.description}</p>
          </> : <p>No evidence supplied.</p>}
          <div className="feature-document-evidence-list">{share.revision.evidenceManifest.map((item) => <button type="button" key={item.evidenceId} onClick={() => setSelectedEvidenceId(item.evidenceId)}>{item.evidenceId}</button>)}</div>
        </aside>
      </div>
    </div>
  );
}
