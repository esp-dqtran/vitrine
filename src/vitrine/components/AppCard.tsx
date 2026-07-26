import { Badge, type BadgeVariant } from '@astryxdesign/core';
import type { AppsPlatform } from '../appsDiscovery';
import type { App, RowStatus } from '../types';
import { DiscoveryCard } from './DiscoveryCard';
import { PlaceholderImage } from './PlaceholderImage';

const STATUS_VARIANT: Record<RowStatus, BadgeVariant> = {
  Queued: 'neutral',
  'In progress': 'info',
  Complete: 'success',
  'Needs attention': 'error',
  Cancelled: 'neutral',
};

const APP_DATE_FORMAT = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

interface AppCardProps {
  app: App;
  platform?: AppsPlatform;
  onOpen: () => void;
  /** Import/analysis status — omit or pass 'Complete' to render the card exactly as before. */
  status?: RowStatus;
  progressLabel?: string;
}

export function AppCard({ app, platform, onOpen, status, progressLabel }: AppCardProps) {
  const active = platform
    ? app.screens.find((screen) => screen.platform === platform)
    : app.screens[0];
  const isMobilePreview = active?.platform === 'ios' || active?.platform === 'android';
  const capturedAt = app.lastCapturedAt ? new Date(app.lastCapturedAt) : null;
  const updatedLabel = capturedAt && !Number.isNaN(capturedAt.getTime())
    ? APP_DATE_FORMAT.format(capturedAt)
    : null;
  const screenLabel = `${app.totalScreens} ${app.totalScreens === 1 ? 'screen' : 'screens'}`;
  const metadata = [
    updatedLabel,
    screenLabel,
    progressLabel && status && status !== 'Complete' ? progressLabel : null,
  ].filter(Boolean).join(' · ');
  const preview = (
    <PlaceholderImage
      src={active?.thumbnailUrl ?? active?.url}
      accent={app.accent}
      style={{
        background: 'transparent',
        objectFit: isMobilePreview ? 'contain' : 'cover',
      }}
    />
  );

  return (
    <DiscoveryCard
      kind="app"
      ariaLabel={`Open ${app.app}`}
      onOpen={onOpen}
      articleProps={{ 'data-preview-platform': active?.platform }}
      media={(
        <>
          {isMobilePreview
            ? <span className="app-discovery-card__phone-preview">{preview}</span>
            : preview}
          {status && status !== 'Complete' ? (
            <span className="app-discovery-card__badge">
              <Badge label={status} variant={STATUS_VARIANT[status]} />
            </span>
          ) : null}
        </>
      )}
      logo={app.iconUrl
        ? <img src={app.iconUrl} alt="" loading="lazy" />
        : app.app.slice(0, 1).toUpperCase()}
      title={app.app}
      description={app.description || app.cat}
      metadata={metadata}
    />
  );
}
