import { Button } from '@astryxdesign/core';
import type { FeatureDocumentRevisionView } from '../../featureDocument.ts';

const authorLabel = { generated: 'Generated', user: 'User edit', restored: 'Restored' } as const;

export function FeatureDocumentRevisionHistory({
  revisions,
  selectedRevisionId,
  comparisonRevisionId,
  onSelect,
  onCompare,
  onRestore,
}: {
  revisions: FeatureDocumentRevisionView[];
  selectedRevisionId: number;
  comparisonRevisionId?: number;
  onSelect: (revisionId: number) => void;
  onCompare?: (revisionId: number | undefined) => void;
  onRestore: (revisionId: number) => void;
}) {
  return (
    <aside className="feature-document-revision-history" aria-label="Revision history">
      <h3>Revisions</h3>
      {revisions.map((revision) => (
        <article key={revision.id} className={revision.id === selectedRevisionId ? 'is-selected' : ''}>
          <button type="button" className="feature-document-revision-select" onClick={() => onSelect(revision.id)}>
            <strong>Revision {revision.revisionNumber} · {authorLabel[revision.authorType]}</strong>
            <span>{revision.reviewStatus}</span>
            <span>{revision.source.platform} · Source {revision.source.versionId ? `version ${revision.source.versionId}` : 'current'}</span>
            <span>{revision.providerModel} · Prompt {revision.promptVersion}</span>
            {revision.focusInstruction && <span>Focus: {revision.focusInstruction}</span>}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {onCompare && revision.id !== selectedRevisionId && <Button label={comparisonRevisionId === revision.id ? 'Stop comparing' : 'Compare'} size="sm" variant="ghost" clickAction={() => onCompare(comparisonRevisionId === revision.id ? undefined : revision.id)} />}
            {revision.id !== selectedRevisionId && <Button label={`Restore revision ${revision.revisionNumber}`} size="sm" variant="ghost" clickAction={() => onRestore(revision.id)} />}
          </div>
        </article>
      ))}
    </aside>
  );
}
