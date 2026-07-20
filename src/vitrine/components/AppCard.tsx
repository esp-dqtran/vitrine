import { Badge, type BadgeVariant } from '@astryxdesign/core';
import type { App, RowStatus } from '../types';
import { PreviewCarouselCard } from './PreviewCarouselCard';

const STATUS_VARIANT: Record<RowStatus, BadgeVariant> = {
  Queued: 'neutral',
  'In progress': 'info',
  Complete: 'success',
  'Needs attention': 'error',
  Cancelled: 'neutral',
};

interface AppCardProps {
  app: App;
  onOpen: () => void;
  /** Import/analysis status — omit or pass 'Complete' to render the card exactly as before. */
  status?: RowStatus;
  progressLabel?: string;
}

export function AppCard({ app, onOpen, status, progressLabel }: AppCardProps) {
  return (
    <PreviewCarouselCard
      label={`Open ${app.app}`}
      identityKey={`app-icon-${app.id}`}
      identityLabel={app.app}
      identityImageUrl={app.iconUrl}
      accent={app.accent}
      supportingText={progressLabel && status && status !== 'Complete' ? progressLabel : undefined}
      overlayLabel="View screens"
      previews={app.screens.map((screen, index) => ({
        key: String(screen.id ?? index),
        url: screen.url,
        alt: `${app.app} screen ${index + 1}`,
      }))}
      cornerBadge={status && status !== 'Complete' ? <Badge label={status} variant={STATUS_VARIANT[status]} /> : undefined}
      onOpen={onOpen}
    />
  );
}
