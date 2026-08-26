import { useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import type { SiteSummary } from '../types.ts';
import { AppIcon } from './AppIcon.tsx';
import { CardVideoControl } from './CardVideoControl.tsx';
import { DiscoveryCard } from './DiscoveryCard.tsx';

export function SiteCard({
  site,
  onOpen,
  matchLabel,
  href = `/sites/${encodeURIComponent(site.routeSlug)}`,
}: {
  site: SiteSummary;
  onOpen: () => void;
  matchLabel?: string;
  href?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Preview videos are multi-megabyte, so nothing about them is fetched — not
  // even metadata — until the card is hovered or focused. Unmount it again as
  // soon as that intent ends, leaving the poster as the only idle media.
  const [previewActive, setPreviewActive] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const hostname = safeHostname(site.sourceUrl);
  const description = site.description || `${site.sectionCount} captured sections from ${hostname}.`;

  // The derived card thumbnail: for a video Site this is the video's own first
  // frame, so playback starts on exactly the image already on screen.
  const thumbnailUrl = site.posterUrl
    ?? (site.previewMediaKind === 'image' ? site.previewUrl : site.previews[0]?.url);
  const playsVideo = site.previewMediaKind !== 'image' && !videoFailed;

  const startPreview = () => {
    if (!playsVideo) return;
    setPreviewActive(true);
    const video = videoRef.current;
    if (video) void video.play().catch(() => setVideoPaused(true));
  };
  const stopPreview = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setPreviewActive(false);
    setVideoPaused(false);
    setVideoProgress(0);
  };
  const stopPreviewOnBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    stopPreview();
  };
  const toggleVideo = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setVideoPaused(true));
    } else {
      video.pause();
    }
  };

  return (
    <DiscoveryCard
      kind="site"
      ariaLabel={`Open ${site.name}`}
      onOpen={onOpen}
      href={href}
      articleProps={{
        onMouseEnter: startPreview,
        onMouseLeave: stopPreview,
        onFocus: startPreview,
        onBlur: stopPreviewOnBlur,
      }}
      media={(
        <>
          <span className="site-discovery-card__preview">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={`${site.name} website preview`} loading="lazy" />
            ) : (
              <span className="site-discovery-card__fallback">Preview unavailable</span>
            )}
            {playsVideo && previewActive ? (
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
                onPlay={() => setVideoPaused(false)}
                onPause={() => setVideoPaused(true)}
                onTimeUpdate={(event) => {
                  const { currentTime, duration } = event.currentTarget;
                  setVideoProgress(Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0);
                }}
                onError={() => {
                  setVideoFailed(true);
                  setPreviewActive(false);
                }}
              />
            ) : null}
          </span>
          <span className="discovery-card__badge site-discovery-card__status">{site.isUpdated ? 'Updated' : 'New'}</span>
        </>
      )}
      // The same tile the App cards use: it handles the initial fallback when a
      // logo is missing *or* fails to load, which hotlinked logos still do.
      logo={(
        <AppIcon
          name={site.name}
          iconUrl={site.logoUrl}
          size={44}
          fit="contain"
          fallbackTextColor="var(--color-text-primary)"
        />
      )}
      title={site.name}
      description={description}
      metadata={matchLabel}
      overlay={playsVideo && previewActive ? (
        <CardVideoControl
          paused={videoPaused}
          progress={videoProgress}
          onToggle={toggleVideo}
        />
      ) : undefined}
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
