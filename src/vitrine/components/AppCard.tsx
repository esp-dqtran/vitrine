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
  // The catalog supplies up to three published preview screens. Fall back to
  // the filtered platform, then the app's declared platforms if a card has no
  // servable preview image yet.
  const activePlatform = active?.platform
    ?? (platform && app.platforms?.includes(platform) ? platform : app.platforms?.[0]);
  const isMobile = activePlatform === 'ios' || activePlatform === 'android';
  // A screen-derived preview is the same image the phone-framed path already
  // renders, so on iOS/Android it is ignored and mobile cards keep their
  // original treatment: PlaceholderImage, `contain`, inside the phone frame.
  const previewIsScreen = isScreenPreview(resolvedPreviewUrl);
  const usingSitePreview = Boolean(resolvedPreviewUrl) && !sitePreviewFailed;
  // A phone screenshot belongs in the phone frame whether it arrives as the
  // card preview or from the screen list.
  const showsPhoneScreenshot = isMobile && (!usingSitePreview || previewIsScreen);
  // A site capture is always a desktop page, so it must not get the phone frame
  // even when the app itself is iOS/Android.
  const isMobilePreview = showsPhoneScreenshot;
  const mobilePreviewScreens = isMobilePreview
    ? app.screens.filter((screen) => screen.platform === activePlatform).slice(0, 3)
    : [];
  const hasMobilePreviewRow = mobilePreviewScreens.length > 1;
  const previewSrc = active?.thumbnailUrl ?? active?.url;
  const previewSrcSet = active?.thumbnailUrl && active.url && active.thumbnailUrl !== active.url
    ? `${active.thumbnailUrl} 1x,${active.url} 2x`
    : undefined;
  // Site captures are whole pages (~1920x16000), so `contain` would shrink one
  // to an unreadable sliver — anchor to the top instead and show the hero.
  // On failure fall through to the screen capture rather than PlaceholderImage's
  // empty state, so a bad site preview never leaves the card worse than before.
  const preview = usingSitePreview ? (
    <img
      src={resolvedPreviewUrl ?? undefined}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setSitePreviewFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        // Fill the phone mask edge-to-edge for a website capture; letterbox a
        // phone screenshot so the whole screen stays visible.
        objectFit: showsPhoneScreenshot ? 'contain' : 'cover',
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
      articleProps={{
        'data-preview-platform': activePlatform,
        // The portrait card shape follows the image, not the app: an iOS app
        // showing a crawled website is a desktop page and belongs in the
        // standard frame, same signal that decides the phone mask.
        'data-preview-shape': isMobilePreview ? 'phone' : undefined,
        'data-preview-layout': hasMobilePreviewRow ? 'triptych' : undefined,
      }}
      media={(
        <>
          {hasMobilePreviewRow
            ? (
              <span className="app-discovery-card__phone-preview-row" aria-hidden="true">
                {mobilePreviewScreens.map((screen) => {
                  const src = screen.thumbnailUrl ?? screen.url;
                  const srcSet = screen.thumbnailUrl && screen.url && screen.thumbnailUrl !== screen.url
                    ? `${screen.thumbnailUrl} 1x,${screen.url} 2x`
                    : undefined;
                  return (
                    <span key={screen.id} className="app-discovery-card__phone-preview">
                      <PlaceholderImage
                        src={src}
                        srcSet={srcSet}
                        accent={app.accent}
                        style={{ background: 'transparent', objectFit: 'contain' }}
                      />
                    </span>
                  );
                })}
              </span>
            )
            : isMobilePreview
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

// Screen thumbnails live at thumbnails/<imageId>/…; every Site-derived image is
// namespaced (thumbnails/site-previews/…, thumbnails/apps/…, sites/…), so the
// numeric segment is what separates "a screenshot of this app" from "a capture
// of its website".
function isScreenPreview(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^\/assets\/thumbnails\/\d+\//.test(url);
}
