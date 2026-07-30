import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Badge, ClickableCard } from '@astryxdesign/core';
import { observeNearViewportMedia } from './deferredMedia.ts';

interface MediaGridCardProps {
  label: string;
  kind: 'image' | 'video';
  url?: string;
  thumbnailUrl?: string | null;
  posterUrl?: string;
  accent?: string;
  aspectRatio?: string | number;
  imageFit?: 'cover' | 'contain';
  preserveNaturalAspectRatio?: boolean;
  preferFullImage?: boolean;
  deferMedia?: boolean;
  badges?: string[];
  title?: string;
  overlay?: ReactNode;
  delay?: number;
  onOpen: () => void;
}

export function MediaGridCard({
  label,
  kind,
  url,
  thumbnailUrl,
  posterUrl,
  accent,
  aspectRatio = '16 / 10',
  imageFit = 'cover',
  preserveNaturalAspectRatio = false,
  preferFullImage = false,
  deferMedia = false,
  badges = [],
  title,
  overlay,
  delay = 0,
  onOpen,
}: MediaGridCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [mediaActive, setMediaActive] = useState(!deferMedia);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(null);
  const imageSrc = preferFullImage ? url : thumbnailUrl ?? url;
  const imageSrcSet = !preferFullImage && thumbnailUrl && url && thumbnailUrl !== url
    ? `${thumbnailUrl} 1x,${url} 2x`
    : undefined;

  useEffect(() => {
    const card = cardRef.current;
    if (!deferMedia || mediaActive || !card) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMediaActive(true);
      return;
    }
    return observeNearViewportMedia(card, () => setMediaActive(true));
  }, [deferMedia, mediaActive]);

  const activateMedia = () => {
    setMediaActive(true);
  };
  const captureNaturalAspectRatio = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!preserveNaturalAspectRatio) return;
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setNaturalAspectRatio(naturalWidth / naturalHeight);
    }
  };
  const cardStyle = {
    position: 'relative' as const,
    aspectRatio: preserveNaturalAspectRatio && naturalAspectRatio
      ? naturalAspectRatio
      : aspectRatio,
    overflow: 'hidden',
    boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
    animation: `vtFadeUp .45s cubic-bezier(.16,1,.3,1) ${delay}s both`,
    transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
    transform: hovered ? 'translateY(-4px)' : 'none',
  };
  const contents = (
    <>
      {!mediaActive ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: accent ? `${accent}22` : 'var(--color-background-muted)' }} />
      ) : mediaFailed || !url ? (
        <div role="img" aria-label="Preview unavailable" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)', background: `linear-gradient(135deg, ${accent ? `${accent}22` : 'var(--color-background-muted)'}, var(--color-background-surface))` }}>
          Preview unavailable
        </div>
      ) : kind === 'video' ? (
        <video
          src={url}
          poster={posterUrl}
          controls
          muted
          playsInline
          preload="metadata"
          onError={() => setMediaFailed(true)}
          onClick={(event) => event.stopPropagation()}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#111' }}
        />
      ) : (
        <img
          src={imageSrc}
          srcSet={imageSrcSet}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={captureNaturalAspectRatio}
          onError={() => setMediaFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imageFit, background: accent ? `${accent}22` : 'var(--color-background-muted)', transform: hovered && imageFit === 'cover' ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
        />
      )}
      {title && (
        <div
          data-media-grid-card-title="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            padding: '28px 10px 10px',
            background: 'linear-gradient(to top, rgba(0,0,0,.72), transparent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ position: 'absolute', left: 10, right: 10, ...(title ? { top: 8, justifyContent: 'flex-end' } : { bottom: 10 }), zIndex: 2, display: 'flex', gap: 5, flexWrap: 'wrap', pointerEvents: 'none' }}>
        {badges.filter(Boolean).map((badge) => <Badge key={badge} label={badge} variant="neutral" style={{ background: 'rgba(24,24,27,.72)', color: '#fff', backdropFilter: 'blur(4px)' }} />)}
      </div>
      {overlay}
    </>
  );

  if (kind === 'image') {
    return (
      <ClickableCard
        ref={cardRef}
        label={label}
        onClick={onOpen}
        padding={0}
        variant="muted"
        onMouseEnter={() => {
          setHovered(true);
          setMediaActive(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={activateMedia}
        style={cardStyle}
      >
        {contents}
      </ClickableCard>
    );
  }

  return (
    <ClickableCard
      ref={cardRef}
      label={label}
      onClick={onOpen}
      padding={0}
      variant="muted"
      onMouseEnter={() => {
        setHovered(true);
        setMediaActive(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={activateMedia}
      style={cardStyle}
    >
      {contents}
    </ClickableCard>
  );
}
