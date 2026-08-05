import { useRef, useState } from 'react';
import type { SiteSummary } from '../types.ts';
import { AppIcon } from './AppIcon.tsx';
import { DiscoveryCard } from './DiscoveryCard.tsx';

export function SiteCard({
  site,
  onOpen,
}: {
  site: SiteSummary;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Preview videos are multi-megabyte, so nothing about them is fetched — not
  // even metadata — until someone hovers. Once loaded the element stays mounted
  // so a second hover replays from cache instead of re-fetching.
  const [videoRequested, setVideoRequested] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const hostname = safeHostname(site.sourceUrl);
  const description = site.description || `${site.sectionCount} captured sections from ${hostname}.`;

  // The derived card thumbnail: for a video Site this is the video's own first
  // frame, so playback starts on exactly the image already on screen.
  const thumbnailUrl = site.posterUrl
    ?? (site.previewMediaKind === 'image' ? site.previewUrl : site.previews[0]?.url);
  const playsVideo = site.previewMediaKind !== 'image' && !videoFailed;

  const startPreview = () => {
    if (!playsVideo) return;
    setVideoRequested(true);
    const video = videoRef.current;
    if (video) void video.play().catch(() => undefined);
  };
  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    // Frame 0 is the thumbnail, so resetting leaves the card looking untouched.
    video.currentTime = 0;
  };

  return (
    <DiscoveryCard
      kind="site"
      ariaLabel={`Open ${site.name}`}
      onOpen={onOpen}
      href={`/sites/${encodeURIComponent(site.routeSlug)}`}
      articleProps={{
        onMouseEnter: startPreview,
        onMouseLeave: stopPreview,
        onFocus: startPreview,
        onBlur: stopPreview,
      }}
      media={(
        <>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={`${site.name} website preview`} loading="lazy" />
          ) : (
            <span className="site-discovery-card__fallback">Preview unavailable</span>
          )}
          {playsVideo && videoRequested ? (
            <video
              ref={videoRef}
              className="site-discovery-card__video"
              src={site.previewUrl}
              poster={thumbnailUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={() => setVideoFailed(true)}
            />
          ) : null}
          <span className="discovery-card__badge">{site.isUpdated ? 'Updated' : 'New'}</span>
        </>
      )}
      // The same tile the App cards use: it handles the initial fallback when a
      // logo is missing *or* fails to load, which hotlinked logos still do.
      logo={(
        <AppIcon
          name={site.name}
          iconUrl={site.logoUrl}
          size={44}
          fallbackTextColor="var(--color-text-primary)"
        />
      )}
      title={site.name}
      description={description}
    />
  );
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'the source website';
  }
}
