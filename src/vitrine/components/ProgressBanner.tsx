import { Button, ProgressBar } from '@astryxdesign/core';
import { useProgress } from '../useProgress';
import type { Progress, ProgressSnapshot } from '../types';

const STAGE_LABEL: Record<string, string> = {
  crawl: 'Crawling',
  caption: 'Captioning',
  synthesize: 'Synthesizing design system',
  'smart-crawl': 'Smart crawling',
};

function cancel() {
  fetch('/api/progress/cancel', { method: 'POST' }).catch(() => {});
}

function compareProgress(left: Progress, right: Progress): number {
  if (left.status === 'running' && right.status !== 'running') return -1;
  if (left.status !== 'running' && right.status === 'running') return 1;
  return right.updatedAt.localeCompare(left.updatedAt);
}

function ProgressRow({ progress }: { progress: Progress }) {
  const variant = progress.status === 'error' ? 'error' : progress.status === 'cancelled' ? 'neutral' : 'accent';
  const label = [
    `${STAGE_LABEL[progress.stage] ?? progress.stage} · ${progress.app}`,
    progress.message,
    progress.status !== 'running' && !progress.message ? progress.status : undefined,
  ].filter(Boolean).join(' — ');

  return progress.total === 0 && progress.status === 'running' ? (
    <ProgressBar label={label} isIndeterminate variant={variant} />
  ) : (
    <ProgressBar
      label={label}
      value={progress.done}
      max={Math.max(progress.total, 1)}
      hasValueLabel
      variant={variant}
    />
  );
}

export function ProgressBannerView({ snapshot }: { snapshot: ProgressSnapshot | null }) {
  const entries = (snapshot?.entries ?? [])
    .filter(({ status }) => status !== 'idle' && status !== 'done')
    .sort(compareProgress);
  if (!entries.length) return null;
  const running = entries.filter(({ status }) => status === 'running');
  const summary = running.length
    ? `${running.length} ${running.length === 1 ? 'app' : 'apps'} crawling`
    : 'Crawl progress';

  return (
    <div
      aria-label="Crawl progress"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        background: 'var(--color-background-surface)',
        padding: '14px 16px',
        marginTop: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--color-text-primary)' }}>{summary}</div>
        {running.length ? (
          <Button label="Cancel all" variant="destructive" size="sm" clickAction={cancel} />
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {entries.map((progress) => <ProgressRow key={progress.id} progress={progress} />)}
      </div>
    </div>
  );
}

export function ProgressBanner() {
  return <ProgressBannerView snapshot={useProgress()} />;
}
