import { useEffect, useRef, useState } from 'react';
import type { SiteSummary } from '../types.ts';
import { DiscoveryCard } from './DiscoveryCard.tsx';

type VisibilityObserver = Pick<IntersectionObserver, 'observe' | 'disconnect'>;
type VisibilityObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => VisibilityObserver;

export function observeSiteCardMedia(
  target: Element,
  onVisible: () => void,
  createObserver: VisibilityObserverFactory = (callback, options) =>
    new IntersectionObserver(callback, options),
) {
  const observer = createObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    onVisible();
    observer.disconnect();
  }, { rootMargin: '320px 0px', threshold: 0.01 });
  observer.observe(target);
  return () => observer.disconnect();
}

export function SiteCard({
  site,
  onOpen,
  deferMediaUntilIntent = false,
}: {
  site: SiteSummary;
  onOpen: () => void;
  deferMediaUntilIntent?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldPlayRef = useRef(false);
  const [mediaActive, setMediaActive] = useState(
    site.previewMediaKind === 'image' && !deferMediaUntilIntent,
  );
  const [mediaFailed, setMediaFailed] = useState(false);
  const hostname = safeHostname(site.sourceUrl);
  const description = site.description || `${site.sectionCount} captured sections from ${hostname}.`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaActive || deferMediaUntilIntent) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMediaActive(true);
      return;
    }
    return observeSiteCardMedia(video, () => setMediaActive(true));
  }, [deferMediaUntilIntent, mediaActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!mediaActive || !video || !shouldPlayRef.current) return;
    void video.play().catch(() => undefined);
  }, [mediaActive]);

  const startPreview = () => {
    shouldPlayRef.current = true;
    setMediaActive(true);
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  };
  const stopPreview = () => {
    shouldPlayRef.current = false;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  };

  return (
    <DiscoveryCard
      kind="site"
      ariaLabel={`Open ${site.name}`}
      onOpen={onOpen}
      href={`/sites/${site.id}/versions/${site.versionId}`}
      articleProps={{
        onMouseEnter: startPreview,
        onMouseLeave: stopPreview,
        onFocus: startPreview,
        onBlur: stopPreview,
      }}
      media={(
        <>
          {deferMediaUntilIntent && !mediaActive ? (
            <span className="site-discovery-card__fallback" aria-hidden="true" />
          ) : site.previewMediaKind === 'image' ? (
            <img src={site.previewUrl} alt={`${site.name} website preview`} loading="lazy" />
          ) : !mediaFailed ? (
            <video
              ref={videoRef}
              src={mediaActive ? site.previewUrl : undefined}
              poster={mediaActive ? site.previews[0]?.url : undefined}
              muted
              loop
              playsInline
              preload={mediaActive ? 'metadata' : 'none'}
              onError={() => setMediaFailed(true)}
            />
          ) : site.previews[0] ? (
            <img src={site.previews[0].url} alt={`${site.name} website preview`} loading="lazy" />
          ) : (
            <span className="site-discovery-card__fallback">Preview unavailable</span>
          )}
          {site.isLatest ? <span className="site-discovery-card__badge">New</span> : null}
        </>
      )}
      logo={site.logoUrl
        ? <img src={site.logoUrl} alt="" loading="lazy" />
        : site.name.slice(0, 1).toUpperCase()}
      title={site.name}
      description={description}
      metadata={<>{site.label} · {site.sectionCount} sections</>}
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
