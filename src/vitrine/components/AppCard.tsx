import { useEffect, useState } from 'react';
import type { AppsPlatform } from '../appsDiscovery';
import { categoryNames, type App } from '../types';
import { AppIcon } from './AppIcon';
import { DiscoveryCard } from './DiscoveryCard';
import { PlaceholderImage } from './PlaceholderImage';

interface AppCardProps {
  app: App;
  platform?: AppsPlatform;
  onOpen: () => void;
}

export function AppCard({
  app,
  platform,
  onOpen,
}: AppCardProps) {
  const active = platform
    ? app.screens.find((screen) => screen.platform === platform)
    : app.screens[0];
  const resolvedPreviewUrl = app.previewUrl;
  const [sitePreviewFailed, setSitePreviewFailed] = useState(false);
  useEffect(() => { setSitePreviewFailed(false); }, [resolvedPreviewUrl]);
  const usingSitePreview = Boolean(resolvedPreviewUrl) && !sitePreviewFailed;
  // A site capture is always a desktop page, so it must not get the phone frame
  // even when the app itself is iOS/Android.
  const isMobilePreview = !usingSitePreview
    && (active?.platform === 'ios' || active?.platform === 'android');
  const previewSrc = active?.thumbnailUrl ?? active?.url;
  const previewSrcSet = active?.thumbnailUrl && active.url && active.thumbnailUrl !== active.url
    ? `${active.thumbnailUrl} 1x,${active.url} 2x`
    : undefined;
  // Site captures are whole pages (~1920x16000), so `contain` would shrink one
  // to an unreadable sliver — anchor to the top instead and show the hero.
  // On failure fall through to the screen capture rather than PlaceholderImage's
  // empty state, so a bad site preview never leaves the card worse than before.
  const preview = resolvedPreviewUrl && !sitePreviewFailed ? (
    <img
      src={resolvedPreviewUrl}
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
      // A real href, like the Site cards already have: middle-click and
      // open-in-new-tab work, and the card is a link to assistive tech.
      href={`/apps/${encodeURIComponent(app.id)}`}
      articleProps={{ 'data-preview-platform': active?.platform }}
      media={(
        <>
          {isMobilePreview
            ? <span className="app-discovery-card__phone-preview">{preview}</span>
            : preview}
          <span className="discovery-card__badge">{app.isUpdated ? 'Updated' : 'New'}</span>
        </>
      )}
      logo={<AppIcon name={app.app} iconUrl={app.iconUrl} accent={app.accent} size={44} />}
      title={app.app}
      description={app.description || categoryNames(app).join(', ')}
    />
  );
}
