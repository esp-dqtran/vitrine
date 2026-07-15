import type { RowVM } from './ImportDialog';

const STATUS_COLOR: Record<string, string> = {
  Queued: '#71717a',
  'In progress': '#2563eb',
  'Needs attention': '#dc2626',
  Cancelled: '#71717a',
};

// A pipeline row with no real App yet (nothing captured to preview) — shown as a lightweight
// placeholder card in the same grid, not clickable since there's no screen data to open.
export function ImportingAppCard({ row }: { row: RowVM }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '16 / 10',
        borderRadius: 'var(--radius-container)',
        border: '1px dashed var(--color-border)',
        background: 'var(--color-background-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 20,
      }}
    >
      <span
        style={{
          padding: '3px 9px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          background: STATUS_COLOR[row.status] ?? '#71717a',
        }}
      >
        {row.status}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center' }}>{row.name}</span>
    </div>
  );
}
