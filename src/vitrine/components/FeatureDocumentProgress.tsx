import { Button } from '@astryxdesign/core';
import type { FeatureDocumentJobView } from '../../featureDocument.ts';

const stageLabel = (job: FeatureDocumentJobView): string => ({
  preparing: 'Preparing evidence',
  analyzing: `Analyzing image ${Math.min(job.doneCount + 1, job.totalCount)} of ${job.totalCount}`,
  synthesizing: 'Synthesizing requirements',
  validating: 'Validating citations',
  saving: 'Saving draft',
  complete: 'Feature Document ready',
})[job.stage];

export function FeatureDocumentProgress({
  job,
  connectionError,
  onCancel,
  onReconnect,
  onRetry,
}: {
  job: FeatureDocumentJobView;
  connectionError?: string;
  onCancel?: () => void;
  onReconnect?: () => void;
  onRetry?: () => void;
}) {
  const active = job.status === 'queued' || job.status === 'running';
  return (
    <section aria-label="Feature Document generation progress" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <strong>{stageLabel(job)}</strong>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 3 }}>{job.doneCount} of {job.totalCount} images complete</div>
        </div>
        {active && onCancel && <Button label="Cancel generation" variant="ghost" size="sm" clickAction={onCancel} />}
      </div>
      <progress max={job.totalCount} value={job.doneCount} aria-label="Analyzed images" style={{ width: '100%' }} />
      {(job.status === 'error' || job.status === 'stale' || job.status === 'cancelled') && onRetry && <Button label="Retry generation" variant="primary" size="sm" clickAction={onRetry} />}
      {connectionError && (
        <div role="alert" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <span>{connectionError}</span>
          {onReconnect && <Button label="Reconnect" variant="ghost" size="sm" clickAction={onReconnect} />}
        </div>
      )}
    </section>
  );
}
