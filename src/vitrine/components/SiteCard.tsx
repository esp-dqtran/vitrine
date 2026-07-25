import { useRef, useState } from 'react';
import type { SiteSummary } from '../types.ts';

export function SiteCard({ site, onOpen }: { site: SiteSummary; onOpen: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const hostname = safeHostname(site.sourceUrl);
  const description = site.description || `${site.sectionCount} captured sections from ${hostname}.`;

  const startPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  };
  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  };

  return (
    <article
      data-site-discovery-card="true"
      className="site-discovery-card"
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
    >
      <a
        href={`/sites/${site.id}/versions/${site.versionId}`}
        className="site-discovery-card__link"
        aria-label={`Open ${site.name}`}
        onClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
      >
        <span className="site-discovery-card__media">
          {site.previewMediaKind === 'image' ? (
            <img src={site.previewUrl} alt={`${site.name} website preview`} loading="lazy" />
          ) : !mediaFailed ? (
            <video
              ref={videoRef}
              src={site.previewUrl}
              poster={site.previews[0]?.url}
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setMediaFailed(true)}
            />
          ) : site.previews[0] ? (
            <img src={site.previews[0].url} alt={`${site.name} website preview`} loading="lazy" />
          ) : (
            <span className="site-discovery-card__fallback">Preview unavailable</span>
          )}
          {site.isLatest ? <span className="site-discovery-card__badge">New</span> : null}
        </span>
        <span className="site-discovery-card__identity">
          <span className="site-discovery-card__logo" aria-hidden="true">
            {site.logoUrl
              ? <img src={site.logoUrl} alt="" loading="lazy" />
              : site.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="site-discovery-card__copy">
            <strong>{site.name}</strong>
            <span>{description}</span>
            <small>{site.label} · {site.sectionCount} sections</small>
          </span>
        </span>
      </a>
    </article>
  );
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'the source website';
  }
}
