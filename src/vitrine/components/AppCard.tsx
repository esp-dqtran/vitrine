import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { AppsPlatform } from '../appsDiscovery';
import type { App } from '../types';
import { AppIcon } from './AppIcon';
import { CardVideoControl } from './CardVideoControl';
import { DiscoveryCard } from './DiscoveryCard';
import { PlaceholderImage } from './PlaceholderImage';

const NEW_APP_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const APP_CARD_VIDEO_PRELOAD_MARGIN = '240px 0px';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type VideoPlaybackIntent = 'automatic' | 'manual-play' | 'manual-pause';

function isNewApp(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp)
    && timestamp <= now
    && now - timestamp <= NEW_APP_WINDOW_MS;
}

interface AppCardProps {
  app: App;
  platform?: AppsPlatform;
  slider?: boolean;
  onOpen: () => void;
  href?: string;
}

export function AppCard({
  app,
  platform,
  slider = false,
  onOpen,
  href = `/apps/${encodeURIComponent(app.id)}`,
}: AppCardProps) {
  const isNew = isNewApp(app.createdAt);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [leavingSlide, setLeavingSlide] = useState<{ index: number; direction: -1 | 1 } | null>(null);
  const eligibleScreens = platform
    ? app.screens.filter((screen) => screen.platform === platform)
    : app.screens;
  const sliderCount = slider ? eligibleScreens.length : 0;
  const normalizedSlideIndex = sliderCount > 0 ? activeSlideIndex % sliderCount : 0;
  const active = slider
    ? eligibleScreens[normalizedSlideIndex]
    : platform
    ? eligibleScreens[0]
    : app.screens[0];
  const activePlatform = active?.platform
    ?? (platform && app.platforms?.includes(platform) ? platform : app.platforms?.[0]);
  const isMobile = activePlatform === 'ios' || activePlatform === 'android';
  const prefersScreenPreview = slider || (isMobile && Boolean(active));
  const resolvedPreviewUrl = prefersScreenPreview && active
    ? active.thumbnailUrl ?? active.url
    : app.previewUrl;
  const [sitePreviewFailed, setSitePreviewFailed] = useState(false);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoNearViewport, setVideoNearViewport] = useState(false);
  const [preloadedVideoUrl, setPreloadedVideoUrl] = useState<string | null>(null);
  const [videoPlaybackIntent, setVideoPlaybackIntent] = useState<VideoPlaybackIntent>('automatic');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(REDUCED_MOTION_QUERY).matches
  ));
  useEffect(() => { setSitePreviewFailed(false); }, [resolvedPreviewUrl]);
  useEffect(() => {
    setVideoPreviewFailed(false);
    setVideoPaused(true);
    setVideoProgress(0);
    setVideoNearViewport(false);
    setPreloadedVideoUrl(null);
    setVideoPlaybackIntent('automatic');
  }, [app.previewVideoUrl]);
  useEffect(() => {
    setActiveSlideIndex(0);
    setLeavingSlide(null);
  }, [app.id, platform, slider]);
  // The catalog supplies up to three published preview screens. Fall back to
  // the filtered platform, then the app's declared platforms if a card has no
  // servable preview image yet.
  const mobilePreviewFit = activePlatform === 'android' ? 'cover' : 'contain';
  // A screen-derived preview is the same image the phone-framed path already
  // renders, so on iOS/Android it is ignored and mobile cards keep the shared
  // phone-frame treatment below.
  const previewIsScreen = prefersScreenPreview || isScreenPreview(resolvedPreviewUrl);
  const usingSitePreview = Boolean(resolvedPreviewUrl)
    && !sitePreviewFailed
    && !(isMobile && prefersScreenPreview);
  // A phone screenshot belongs in the phone frame whether it arrives as the
  // card preview or from the screen list.
  const showsPhoneScreenshot = isMobile && (!usingSitePreview || previewIsScreen);
  // A site capture is always a desktop page, so it must not get the phone frame
  // even when the app itself is iOS/Android.
  const isMobilePreview = showsPhoneScreenshot;
  const usingVideoPreview = Boolean(app.previewVideoUrl) && !isMobilePreview && !videoPreviewFailed;
  const videoHasEnteredPreloadZone = Boolean(app.previewVideoUrl)
    && preloadedVideoUrl === app.previewVideoUrl;
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!usingVideoPreview || !video) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVideoNearViewport(true);
      setPreloadedVideoUrl(app.previewVideoUrl ?? null);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      const isNearViewport = entry?.isIntersecting === true;
      setVideoNearViewport(isNearViewport);
      if (isNearViewport) setPreloadedVideoUrl(app.previewVideoUrl ?? null);
    }, { rootMargin: APP_CARD_VIDEO_PRELOAD_MARGIN, threshold: 0.01 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [app.previewVideoUrl, usingVideoPreview]);
  useEffect(() => {
    const video = videoRef.current;
    if (!usingVideoPreview || !video || !videoHasEnteredPreloadZone) return;
    const shouldPlay = videoNearViewport && (
      videoPlaybackIntent === 'manual-play'
      || (!prefersReducedMotion && videoPlaybackIntent === 'automatic')
    );
    if (!shouldPlay) {
      video.pause();
      return;
    }
    void video.play().catch(() => setVideoPaused(true));
  }, [
    prefersReducedMotion,
    usingVideoPreview,
    videoHasEnteredPreloadZone,
    videoNearViewport,
    videoPlaybackIntent,
  ]);
  const mobilePreviewScreens = isMobilePreview && !slider
    ? app.screens.filter((screen) => screen.platform === activePlatform).slice(0, 3)
    : [];
  const hasMobilePreviewRow = mobilePreviewScreens.length > 1;
  const previewSrc = active?.thumbnailUrl ?? active?.url;
  const previewSrcSet = active?.thumbnailUrl && active.url && active.thumbnailUrl !== active.url
    ? `${active.thumbnailUrl} 1x,${active.url} 2x`
    : undefined;
  const leavingPreviewUrl = leavingSlide && slider
    ? eligibleScreens[leavingSlide.index]?.thumbnailUrl ?? eligibleScreens[leavingSlide.index]?.url
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
        // Fill website captures edge-to-edge. Keep iOS screens intact while
        // Android AppCard thumbnails fill the same narrow phone slot.
        objectFit: showsPhoneScreenshot ? mobilePreviewFit : 'cover',
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
        objectFit: mobilePreviewFit,
      }}
    />
  );
  const desktopPreview = usingVideoPreview ? (
    <video
      ref={videoRef}
      src={videoHasEnteredPreloadZone ? app.previewVideoUrl ?? undefined : undefined}
      poster={resolvedPreviewUrl ?? previewSrc ?? undefined}
      muted
      loop
      playsInline
      preload={videoHasEnteredPreloadZone ? 'metadata' : 'none'}
      data-video-preload={videoHasEnteredPreloadZone ? 'active' : 'poster'}
      data-video-motion={prefersReducedMotion ? 'reduced' : 'standard'}
      onPlay={() => setVideoPaused(false)}
      onPause={() => setVideoPaused(true)}
      onTimeUpdate={(event) => {
        const { currentTime, duration } = event.currentTarget;
        setVideoProgress(Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0);
      }}
      onError={() => setVideoPreviewFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  ) : preview;

  const toggleVideo = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setVideoPlaybackIntent('manual-play');
      if (!videoHasEnteredPreloadZone) {
        setVideoNearViewport(true);
        setPreloadedVideoUrl(app.previewVideoUrl ?? null);
        return;
      }
      void video.play().catch(() => setVideoPaused(true));
    } else {
      setVideoPlaybackIntent('manual-pause');
      video.pause();
    }
  };

  const changeSlide = (direction: -1 | 1) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (sliderCount < 2) return;
    setLeavingSlide({ index: normalizedSlideIndex, direction });
    setActiveSlideIndex((current) => (current + direction + sliderCount) % sliderCount);
  };

  return (
    <DiscoveryCard
      kind="app"
      ariaLabel={`Open ${app.app}`}
      onOpen={onOpen}
      // A real href, like the Site cards already have: middle-click and
      // open-in-new-tab work, and the card is a link to assistive tech.
      href={href}
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
                        style={{ background: 'transparent', objectFit: mobilePreviewFit }}
                      />
                    </span>
                  );
                })}
              </span>
            )
            : isMobilePreview
            ? <span className="app-discovery-card__phone-preview">{preview}</span>
            : (
              <span className="app-discovery-card__desktop-preview">
                {leavingSlide && leavingPreviewUrl ? (
                  <span
                    key={`leaving-${leavingSlide.index}-${leavingSlide.direction}`}
                    className="app-discovery-card__desktop-preview-slide"
                    data-slider-leaving="true"
                    data-direction={leavingSlide.direction === 1 ? 'forward' : 'backward'}
                    onAnimationEnd={() => setLeavingSlide(null)}
                  >
                    <img
                      src={leavingPreviewUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top',
                      }}
                    />
                  </span>
                ) : null}
                <span
                  key={slider ? resolvedPreviewUrl : 'preview'}
                  className="app-discovery-card__desktop-preview-slide"
                  data-slider-entering={leavingSlide ? 'true' : undefined}
                  data-direction={leavingSlide?.direction === -1 ? 'backward' : 'forward'}
                >
                  {desktopPreview}
                </span>
              </span>
            )}
          {sliderCount > 1 && !usingVideoPreview ? (
            <AppCardSliderDots activeIndex={normalizedSlideIndex} count={sliderCount} />
          ) : null}
        </>
      )}
      logo={<AppIcon name={app.app} iconUrl={app.iconUrl} accent={app.accent} size={44} />}
      title={app.app}
      description={app.description}
      overlay={(
        <AppCardMediaCorners
          status={isNew ? 'New' : undefined}
          video={usingVideoPreview ? { paused: videoPaused, progress: videoProgress, onToggle: toggleVideo } : undefined}
          slider={sliderCount > 1 && !usingVideoPreview ? {
            activeIndex: normalizedSlideIndex,
            count: sliderCount,
            onPrevious: changeSlide(-1),
            onNext: changeSlide(1),
          } : undefined}
        />
      )}
    />
  );
}

interface AppCardMediaCornersProps {
  status?: string;
  video?: {
    paused: boolean;
    progress: number;
    onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  };
  slider?: {
    activeIndex: number;
    count: number;
    onPrevious: (event: MouseEvent<HTMLButtonElement>) => void;
    onNext: (event: MouseEvent<HTMLButtonElement>) => void;
  };
}

function AppCardMediaCorners({ status, video, slider }: AppCardMediaCornersProps) {
  return (
    <>
      {status ? <span className="discovery-card__badge app-discovery-card__status">{status}</span> : null}
      {video ? (
        <CardVideoControl {...video} />
      ) : slider ? (
        <>
          <button
            type="button"
            className="app-discovery-card__slider-arrow app-discovery-card__slider-arrow--previous"
            aria-label="Previous preview"
            onClick={slider.onPrevious}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </button>
          <button
            type="button"
            className="app-discovery-card__slider-arrow app-discovery-card__slider-arrow--next"
            aria-label="Next preview"
            onClick={slider.onNext}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        </>
      ) : null}
    </>
  );
}

function AppCardSliderDots({ activeIndex, count }: { activeIndex: number; count: number }) {
  const activeSlide = Math.min(Math.max(0, activeIndex), Math.max(0, count - 1));
  return (
    <span className="app-discovery-card__slider-status" aria-label={`Slide ${activeSlide + 1} of ${count}`}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} data-active={index === activeSlide ? 'true' : undefined} />
      ))}
    </span>
  );
}

// Screen thumbnails live at thumbnails/<imageId>/…; every Site-derived image is
// namespaced (thumbnails/site-previews/…, thumbnails/apps/…, sites/…), so the
// numeric segment is what separates "a screenshot of this app" from "a capture
// of its website".
function isScreenPreview(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^\/assets\/thumbnails\/\d+\//.test(url);
}
