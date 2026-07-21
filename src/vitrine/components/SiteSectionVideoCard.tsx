import { useEffect, useRef, useState } from 'react';
import { Badge, ClickableCard } from '@astryxdesign/core';

export const SITE_VIDEO_VISIBILITY_THRESHOLD = 0.35;

type VisibilityObserver = Pick<IntersectionObserver, 'observe' | 'disconnect'>;
type VisibilityObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => VisibilityObserver;

export function observeSiteVideoPlayback(
  video: Pick<HTMLVideoElement, 'play' | 'pause'>,
  target: Element,
  createObserver: VisibilityObserverFactory = (callback, options) => new IntersectionObserver(callback, options),
) {
  const observer = createObserver((entries) => {
    const entry = entries[0];
    if (entry?.isIntersecting && entry.intersectionRatio >= SITE_VIDEO_VISIBILITY_THRESHOLD) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, { threshold: SITE_VIDEO_VISIBILITY_THRESHOLD });

  observer.observe(target);
  return () => observer.disconnect();
}

interface SiteSectionVideoCardProps {
  label: string;
  url: string;
  posterUrl?: string;
  badges?: string[];
  delay?: number;
  onOpen: () => void;
}

export function SiteSectionVideoCard({
  label,
  url,
  posterUrl,
  badges = [],
  delay = 0,
  onOpen,
}: SiteSectionVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const actionVisible = hovered || focused;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;
    return observeSiteVideoPlayback(video, video);
  }, [url]);

  return (
    <div
      data-site-section-video-card="true"
      style={{
        display: 'grid',
        gap: 10,
        animation: `vtFadeUp .45s cubic-bezier(.16,1,.3,1) ${delay}s both`,
      }}
    >
      <ClickableCard
        label={label}
        onClick={onOpen}
        padding={0}
        variant="muted"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          overflow: 'hidden',
          borderRadius: 8,
          background: 'var(--color-background-muted)',
          boxShadow: 'var(--shadow-low)',
        }}
      >
        {mediaFailed ? (
          <div
            role="img"
            aria-label="Preview unavailable"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-background-muted)',
            }}
          >
            Preview unavailable
          </div>
        ) : (
          <video
            ref={videoRef}
            src={url}
            poster={posterUrl}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setMediaFailed(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: 'var(--color-background-muted)',
              pointerEvents: 'none',
            }}
          />
        )}

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: 'rgba(0,0,0,.1)',
            opacity: actionVisible ? 1 : 0,
            transition: 'opacity 300ms cubic-bezier(.16,1,.3,1)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 2,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 9999,
            background: '#fff',
            color: '#18181b',
            fontSize: 14,
            fontWeight: 650,
            opacity: actionVisible ? 1 : 0,
            transform: actionVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 300ms cubic-bezier(.16,1,.3,1), transform 300ms cubic-bezier(.16,1,.3,1)',
            pointerEvents: 'none',
          }}
        >
          View section
        </div>
      </ClickableCard>

      {badges.some(Boolean) && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minHeight: 24 }}>
          {badges.filter(Boolean).map((badge) => <Badge key={badge} label={badge} variant="neutral" />)}
        </div>
      )}
    </div>
  );
}
