import { useEffect, useState } from 'react';
import { Badge, type BadgeVariant } from '@astryxdesign/core';
import type { AppsPlatform } from '../appsDiscovery';
import { categoryNames, type App, type RowStatus } from '../types';
import { AppIcon } from './AppIcon';
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
  /**
   * Full-page capture of the app's marketing site, when one has been crawled.
   * Preferred over a screen capture because screens are unclassified — the
   * first one is arbitrary, so the grid reads as incoherent without this.
   */
  sitePreviewUrl?: string | null;
}

export function AppCard({
  app,
  platform,
  onOpen,
  status,
  progressLabel,
  sitePreviewUrl,
}: AppCardProps) {
  const active = platform
    ? app.screens.find((screen) => screen.platform === platform)
    : app.screens[0];
  const [sitePreviewFailed, setSitePreviewFailed] = useState(false);
  useEffect(() => { setSitePreviewFailed(false); }, [sitePreviewUrl]);
  const usingSitePreview = Boolean(sitePreviewUrl) && !sitePreviewFailed;
  // A site capture is always a desktop page, so it must not get the phone frame
  // even when the app itself is iOS/Android.
  const isMobilePreview = !usingSitePreview
    && (active?.platform === 'ios' || active?.platform === 'android');
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
  const previewSrc = active?.thumbnailUrl ?? active?.url;
  const previewSrcSet = active?.thumbnailUrl && active.url && active.thumbnailUrl !== active.url
    ? `${active.thumbnailUrl} 1x,${active.url} 2x`
    : undefined;
  // Site captures are whole pages (~1920x16000), so `contain` would shrink one
  // to an unreadable sliver — anchor to the top instead and show the hero.
  // On failure fall through to the screen capture rather than PlaceholderImage's
  // empty state, so a bad site preview never leaves the card worse than before.
  const preview = sitePreviewUrl && !sitePreviewFailed ? (
    <img
      src={sitePreviewUrl}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setSitePreviewFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'top',
      }}
    />
  ) : (
    <PlaceholderImage
      src={previewSrc}
      srcSet={previewSrcSet}
      accent={app.accent}
      style={{
        background: 'transparent',
        objectFit: 'contain',
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
      logo={<AppIcon name={app.app} iconUrl={app.iconUrl} accent={app.accent} size={44} />}
      title={app.app}
      description={app.description || categoryNames(app).join(', ')}
      metadata={metadata}
    />
  );
}
