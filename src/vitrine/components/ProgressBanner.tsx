import { Button, ProgressBar } from '@astryxdesign/core';
import { useProgress } from '../useProgress';

const STAGE_LABEL: Record<string, string> = {
  crawl: 'Crawling',
  caption: 'Captioning',
  synthesize: 'Synthesizing design system',
};

function cancel() {
  fetch('/api/progress/cancel', { method: 'POST' }).catch(() => {});
}

export function ProgressBanner() {
  const progress = useProgress();
  if (!progress || progress.status === 'idle' || progress.status === 'done') return null;

  const label = `${STAGE_LABEL[progress.stage] ?? progress.stage} · ${progress.app}`;
  const variant = progress.status === 'error' ? 'error' : progress.status === 'cancelled' ? 'neutral' : 'accent';
  const suffix = progress.status !== 'running' ? ` — ${progress.message ?? progress.status}` : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        background: 'var(--color-background-surface)',
        padding: '14px 16px',
        marginTop: 14,
      }}
    >
      <div style={{ flex: 1 }}>
        {progress.total === 0 && progress.status === 'running' ? (
          <ProgressBar label={label} isIndeterminate variant={variant} />
        ) : (
          <ProgressBar
            label={`${label}${suffix}`}
            value={progress.done}
            max={Math.max(progress.total, 1)}
            hasValueLabel
            variant={variant}
          />
        )}
      </div>
      {progress.status === 'running' ? (
        <Button label="Cancel" variant="destructive" size="sm" clickAction={cancel} />
      ) : null}
    </div>
  );
}
