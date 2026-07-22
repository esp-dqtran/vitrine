import type { FeatureDocumentRevisionView } from '../../featureDocument.ts';

export function FeatureDocumentEvidencePanel({
  documentId,
  revision,
  selectedEvidenceId,
  onSelect,
}: {
  documentId: number;
  revision: FeatureDocumentRevisionView;
  selectedEvidenceId?: string;
  onSelect: (evidenceId: string) => void;
}) {
  const selected = revision.evidenceManifest.find(({ evidenceId }) => evidenceId === selectedEvidenceId)
    ?? revision.evidenceManifest[0];
  return (
    <aside className="feature-document-evidence-panel" aria-label="Evidence inspector">
      <h3>Evidence</h3>
      {selected ? (
        <>
          <img
            src={`/api/feature-documents/${documentId}/revisions/${revision.id}/media/${selected.imageId}`}
            alt={`Flow step ${selected.stepIndex + 1} image ${selected.imageIndex + 1}`}
            className="feature-document-evidence-image"
          />
          <strong>{selected.stepLabel}</strong>
          <p>{selected.description || 'No image description'}</p>
          {selected.interaction && <p>Interaction: {selected.interaction}</p>}
          {selected.capturedAt && <p>Captured {new Date(selected.capturedAt).toLocaleString()}</p>}
        </>
      ) : <p>No evidence in this revision.</p>}
      <div className="feature-document-evidence-list">
        {revision.evidenceManifest.map((item) => (
          <button type="button" key={item.evidenceId} aria-pressed={item.evidenceId === selected?.evidenceId} onClick={() => onSelect(item.evidenceId)}>
            Step {item.stepIndex + 1} · Image {item.imageIndex + 1}<span>{item.evidenceId}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
