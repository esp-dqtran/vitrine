import { Badge, Card, Spinner, Text, type BadgeVariant } from '@astryxdesign/core';
import type { RowVM } from './ImportDialog';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  Queued: 'neutral',
  'In progress': 'info',
  'Needs attention': 'error',
  Cancelled: 'neutral',
};

// A pipeline row with no real App yet (nothing captured to preview) — shown as a lightweight
// placeholder card in the same grid, not clickable since there's no screen data to open.
export function ImportingAppCard({ row }: { row: RowVM }) {
  return (
    <Card
      role="status"
      aria-label={`${row.name} import ${row.status}`}
      padding={5}
      variant="muted"
      style={{
        position: 'relative',
        aspectRatio: '16 / 10',
        border: '1px dashed var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {(row.status === 'Queued' || row.status === 'In progress') && <Spinner size="md" aria-hidden="true" />}
      <Badge label={row.status} variant={STATUS_VARIANT[row.status] ?? 'neutral'} />
      <Text type="body" weight="semibold">{row.name}</Text>
    </Card>
  );
}
